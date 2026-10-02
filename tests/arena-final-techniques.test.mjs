import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaFinalTechniques, arenaTechniqueTargets, arenaTechniqueExit, arenaSuplexRim } = await source('src/arenaTechniques.ts');
const { arenaAction, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter, arenaWristGripPoint, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const fighter = (index, overrides) => ({ candidate: { id: String(index + 1), name: '선수', color: '#ffad72' }, index, scale: 2.04, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, power: .55, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const base = { id: 'new-final', index: 0, aggressor: 'winner', victim: 'runner-up', start: 33_200, impact: 38_200, resolve: 39_300, end: 44_000, final: true };
const centers = [{ x: 360, y: 400 }, { x: 640, y: 440 }];
const bout = tactic => ({ ...base, tactic, ...(tactic === 'suplex' ? { impact: 35_300 } : {}) });
const at = (round, fraction, center) => arenaTechniqueTargets(round, round.start + (round.impact - round.start) * fraction, center);

test('wrist control is established before the pivot and is released only when the spin finishes', () => {
  const round = bout('armspin');
  for (const center of centers) {
    const reaching = at(round, .36, center), turning = at(round, .70, center), lastGrip = at(round, .999, center), release = at(round, 1, center);
    assert.equal(reaching.stage, 'wrist');
    assert.equal(reaching.grip, 'wrist');
    assert.equal(reaching.yaw, 0, 'the pair does not pivot before the wrist is controlled');
    assert.equal(reaching.lift, 0, 'the opponent is grounded while the wrist is reached');
    assert.ok(distance(reaching.aggressor, reaching.victim) < 63, 'the wrist is within the two fighters’ reach');
    assert.equal(turning.stage, 'pivot');
    assert.equal(turning.grip, 'wrist');
    assert.ok(turning.yaw > Math.PI / 2 && lastGrip.yaw > Math.PI, 'the held opponent actually circles the planted pivot');
    assert.ok(turning.lift > 0);
    assert.equal(lastGrip.grip, 'wrist');
    assert.equal(release.stage, 'release');
    assert.equal(release.grip, undefined, 'release happens after the turn rather than before its motion');
    const held = arenaAction(round, round.start + (round.impact - round.start) * .70);
    assert.ok(held.actors.every(actor => actor.gripId), 'the visible pivot keeps both participants linked');
    assert.ok(arenaAction(round, round.impact).actors.every(actor => !actor.gripId), 'the linked wrists are released when flight begins');
  }
});

test('the rendered held wrist stays connected while the extended opponent rises through either direction of the pivot', () => {
  const round = bout('armspin');
  for (const center of centers) for (let phase = .50; phase < 1; phase += .01) {
    const frame = at(round, phase, center), clock = round.start + (round.impact - round.start) * phase;
    const aggressor = fighter(0, { ...frame.aggressor, facing: frame.side, pose: 'grapple', phase, yaw: frame.yaw, pivotTurn: frame.yaw });
    const victim = fighter(1, { x: frame.victim.x, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: aggressor.x > frame.victim.x ? 1 : -1, pose: 'held', phase, angle: frame.victimAngle, gripMode: 'wrist' });
    const grip = arenaWristGripPoint(aggressor, victim, clock);
    for (const actor of [aggressor, victim]) {
      actor.gripTarget = grip;
      actor.secondaryGripTarget = { x: grip.x - actor.facing * 3, y: grip.y + 2 };
      actor.gripStrength = 1;
      drawArenaFighter(ctx, actor, clock);
      assert.ok(distance(actor.animation.contactPoints.hands[1], grip) <= 4, `side ${frame.side}, phase ${phase}: a fixed-length arm must reach the shared wrist`);
    }
    const gap = distance(aggressor.animation.contactPoints.hands[1], victim.animation.contactPoints.hands[1]);
    assert.ok(gap <= 4, `side ${frame.side}, phase ${phase}: held wrist gap ${gap.toFixed(2)}px`);
    if (phase >= .78) {
      assert.ok(frame.lift > 40, 'centrifugal lift raises the body rather than dragging it around the ankles');
      assert.ok(victim.animation.localFeet.every(foot => foot.y > -3), 'the feet trail the lifted torso instead of using a jumping knee tuck');
    }
  }
});

test('the airborne release preserves the actual head, waist and feet before easing into a floor-aware landing', () => {
  const round = bout('armspin');
  for (const center of centers) {
    const frame = at(round, 1, center), clock = round.impact;
    const victim = fighter(1, { x: frame.victim.x, y: frame.victim.y - frame.lift, facing: frame.aggressor.x > frame.victim.x ? 1 : -1, pose: 'held', phase: 1, angle: frame.victimAngle, gripMode: 'wrist' });
    drawArenaFighter(ctx, victim, clock);
    const held = structuredClone(victim.animation.contactPoints);
    Object.assign(victim, { pose: 'airborne', gripMode: undefined, suspension: 1, motionImmediate: false });
    drawArenaFighter(ctx, victim, clock);
    const released = victim.animation.contactPoints;
    for (const part of ['head', 'waist']) assert.ok(distance(held[part], released[part]) < 1e-8, `${part} must not jump when the wrist releases`);
    for (let leg = 0; leg < 2; leg++) assert.ok(distance(held.feet[leg], released.feet[leg]) < 1e-8);
    const saved = structuredClone(victim.animation);
    drawArenaFighter(ctx, victim, clock);
    assert.deepEqual(victim.animation, saved, 'a paused release cannot advance the skeleton or its transform');
    const landing = fighter(1, { x: 720, y: 500, facing: -frame.side, pose: 'land', phase: 0, angle: frame.side * .7, suspension: 0 });
    const normal = sampleArenaFighterContacts(landing, clock + 1300);
    assert.deepEqual(normal, sampleArenaFighterContacts({ ...landing, suspension: undefined }, clock + 1300), 'the settled landing retains the original floor-aware transform');
  }
});

test('the rendered ankle drag bends down far enough to hold the grounded opponent on either side', () => {
  for (const side of [-1, 1]) {
    const victim = fighter(1, { x: 500, y: 436, depthY: 436, facing: -side, pose: 'stunned', phase: .5, angle: -side * Math.PI * .47 });
    drawArenaFighter(ctx, victim, 37_000);
    const ankle = victim.animation.contactPoints.feet[1];
    const aggressor = fighter(0, { x: ankle.x + side * 32, y: ankle.y + 8, facing: -side, pose: 'drag', phase: .5, gripStrength: 1, gripTarget: ankle, secondaryGripTarget: { x: ankle.x + side * 5, y: ankle.y + 2 } });
    drawArenaFighter(ctx, aggressor, 37_000);
    const gap = distance(aggressor.animation.contactPoints.hands[1], victim.animation.contactPoints.feet[1]);
    assert.ok(gap <= 4, `side ${side}: ankle grip gap ${gap.toFixed(2)}px`);
    assert.ok(Math.abs(victim.animation.contactPoints.origin.y - 436) < .001, 'the ankle grip reaches the floor pose without lifting the unconscious body');
  }
});

test('a live suplex holds the current rendered waist without advancing the victim while sampling', () => {
  const round = bout('suplex');
  for (const center of centers) {
    const driver = fighter(0, {}), victim = fighter(1, {});
    let previous;
    for (let clock = round.start; clock < round.start + (round.impact - round.start) * .89; clock += 16) {
      const frame = arenaTechniqueTargets(round, clock, center), action = arenaAction(round, clock);
      Object.assign(driver, frame.aggressor, { pose: action.actors[0].pose, phase: frame.phase, facing: frame.side, angle: frame.aggressorAngle, motionImmediate: !previous, motionEpoch: 1 });
      Object.assign(victim, { x: frame.victim.x, y: frame.victim.y - frame.lift, depthY: frame.victim.y, pose: frame.victimPose ?? (frame.lift > 5 ? 'airborne' : 'brace'), phase: frame.phase, facing: -frame.side, angle: frame.victimAngle, motionImmediate: !previous, motionEpoch: 1 });
      if (previous) {
        driver.velocityX = (driver.x - previous.driver.x) / .016; driver.velocityY = (driver.y - previous.driver.y) / .016;
        victim.velocityX = (victim.x - previous.victim.x) / .016; victim.velocityY = (victim.y - previous.victim.y) / .016;
      }
      const saved = structuredClone(victim.animation), predicted = sampleArenaFighterContacts(victim, clock);
      assert.deepEqual(victim.animation, saved, 'contact prediction cannot advance the live skeleton or planted feet');
      if (frame.grip === 'waist') Object.assign(driver, { gripTarget: predicted.waist, secondaryGripTarget: { x: predicted.waist.x - frame.side * 6, y: predicted.waist.y + 3 }, gripStrength: 1, gripLocked: true });
      else Object.assign(driver, { gripTarget: undefined, secondaryGripTarget: undefined, gripStrength: 0 });
      drawArenaFighter(ctx, victim, clock); drawArenaFighter(ctx, driver, clock);
      assert.deepEqual(predicted.waist, victim.animation.contactPoints.waist, 'prediction uses the same pose, velocity and animation epoch as the painted body');
      if (frame.phase >= .55 && frame.grip === 'waist') {
        const gap = distance(driver.animation.contactPoints.hands[1], victim.animation.contactPoints.waist);
        assert.ok(gap <= 4, `side ${frame.side}, phase ${frame.phase.toFixed(3)}: waist hold gap ${gap.toFixed(2)}px`);
      }
      previous = { driver: { x: driver.x, y: driver.y }, victim: { x: victim.x, y: victim.y } };
    }
  }
});

test('an ankle hook is followed by sole contact and a backward somersault in the kicking direction', () => {
  const round = bout('trip');
  for (const center of centers) {
    const grip = at(round, .36, center), hook = at(round, .57, center), kick = at(round, .72, center), fall = at(round, .94, center), landed = at(round, 1, center);
    assert.equal(grip.stage, 'grip');
    assert.equal(grip.grip, 'waist');
    assert.equal(grip.contact, 0);
    assert.equal(hook.stage, 'hook');
    assert.ok(hook.contact > .8, 'the attacking foot has made contact before the fall');
    assert.equal(Math.abs(hook.victimAngle), 0, 'the victim cannot already be lying down before the hook');
    assert.equal(kick.stage, 'kick');
    assert.equal(kick.grip, undefined, 'the waist is released before the leg pushes the opponent away');
    assert.ok(kick.contact > .99);
    const clock = round.start + (round.impact - round.start) * .72;
    const target = fighter(1, { ...kick.victim, facing: -kick.side, pose: 'brace', phase: .72 });
    const contacts = sampleArenaFighterContacts(target, clock);
    const kicker = fighter(0, { ...kick.aggressor, facing: kick.side, pose: 'trip', phase: .72, footTarget: contacts.waist, footStrength: kick.contact, kickLeg: 1 });
    drawArenaFighter(ctx, kicker, clock);
    assert.ok(distance(kicker.animation.contactPoints.feet[1], contacts.waist) < .01, 'the visible sole reaches the current waist before the recoil');
    assert.ok(Math.abs(kicker.animation.contactPoints.feet[0].y - (kicker.y - 2 * kicker.scale)) < .01, 'the other foot stays planted during the waist kick');
    assert.equal(fall.stage, 'fall');
    assert.ok(Math.abs(fall.victimAngle) > .9);
    assert.equal(landed.stage, 'roll');
    assert.ok(landed.lift < .001);
    const landing = { x: center.x + landed.side * 230, y: center.y + 50 };
    let previous = arenaTechniqueExit(round, 0, landed.victim, landing, landed.side, 1, { lift: landed.lift, angle: landed.victimAngle });
    for (let age = 16; age < 880; age += 16) {
      const frame = arenaTechniqueExit(round, age, landed.victim, landing, landed.side, 1, { lift: landed.lift, angle: landed.victimAngle });
      assert.equal(frame.stage, 'roll');
      assert.ok(frame.height < .001, 'a foot sweep has no generic upward throwing arc');
      assert.ok(landed.side * (frame.angle - previous.angle) > 0, 'the head and torso tumble backwards in the same direction as the kick');
      assert.equal(frame.yaw, 0, 'a backwards somersault must not become a sideways body-axis roll');
      assert.ok(landed.side * (frame.groundX - previous.groundX) >= -1e-8);
      assert.ok(distance(frame, previous) < 8, 'the rolling body travels continuously along the floor');
      previous = frame;
    }
    assert.ok(Math.abs(previous.angle - landed.victimAngle) > Math.PI * 1.95, 'the body completes a visible backward revolution');
  }
});

test('the encounter orientation overrides the arena center for both finishing techniques', () => {
  for (const tactic of ['trip', 'armspin']) for (const side of [-1, 1]) {
    const round = { ...bout(tactic), contactSide: side };
    const frame = at(round, .36, { x: side < 0 ? 650 : 350, y: 416 });
    assert.equal(frame.side, side);
    assert.ok(side * (frame.victim.x - frame.aggressor.x) > 0, 'the pair retains the side from which they actually met');
  }
});

test('a suplex keeps waist contact through the back arc and pauses before dragging the grounded opponent', () => {
  const round = bout('suplex');
  for (const center of centers) {
    const grip = at(round, .32, center), lifted = at(round, .55, center), arched = at(round, .78, center), stunned = at(round, .95, center);
    assert.equal(grip.stage, 'grip');
    assert.equal(grip.grip, 'waist');
    assert.equal(grip.lift, 0);
    assert.equal(lifted.stage, 'lift');
    assert.ok(lifted.lift > 36 && lifted.lift <= 40, 'the waist lift is visible without suspending the body high above the hands');
    assert.equal(arched.stage, 'arch');
    assert.equal(arched.grip, 'waist');
    assert.ok(arched.side * (arched.victim.x - arched.aggressor.x) < 0, 'the held body crosses behind the thrower');
    assert.ok(Math.abs(arched.victimAngle) > 1);
    assert.equal(stunned.stage, 'stunned');
    assert.equal(stunned.lift, 0);
    const origin = stunned.victim, landing = { x: center.x + stunned.side * 230, y: center.y + 50 }, preparation = { lift: 0, angle: stunned.victimAngle };
    for (const age of [0, 100, 299]) {
      const frame = arenaTechniqueExit(round, age, origin, landing, stunned.side, 1, preparation);
      assert.equal(frame.stage, 'stunned');
      assert.ok(distance(frame, origin) < 1e-8, 'a visible stunned beat precedes the ankle drag');
    }
    const rim = arenaSuplexRim(origin, stunned.side);
    const drag = arenaTechniqueExit(round, 1700, origin, landing, stunned.side, 1, preparation);
    assert.equal(drag.stage, 'drag');
    assert.equal(drag.height, 0);
    assert.ok(distance(drag, origin) > 20 && distance(drag, rim) > 10, 'the opponent is pulled along the floor toward the inside rim');
    assert.equal(drag.angle, stunned.victimAngle, 'dragging cannot silently stand the opponent upright');
    const dragging = arenaAction(round, round.impact + 700);
    assert.equal(dragging.actors.find(actor => actor.id === round.aggressor).pose, 'drag', 'the connected action cannot become a generic guard or throw during the ankle drag');
    assert.equal(dragging.actors.find(actor => actor.id === round.victim).pose, 'stunned');
    const toss = arenaTechniqueExit(round, 2950, origin, landing, stunned.side, 1, preparation);
    assert.equal(toss.stage, 'rim-toss');
    assert.ok(toss.height > 30, 'the last stroke throws only the opponent over the rim');
    const resolved = arenaTechniqueExit(round, round.resolve - round.impact, origin, landing, stunned.side, 1, preparation);
    assert.ok(distance(resolved, landing) < 1e-8, 'the drawn loser reaches the outside landing by the ranking reveal');
  }
});

test('two jumping side kicks finish with sole contact rather than turning into a waist lift', () => {
  const round = bout('sidekick');
  for (const center of centers) {
    const planted = at(round, .34, center), first = at(round, .52, center), second = at(round, .75, center), impact = at(round, .83, center), release = at(round, 1, center);
    assert.equal(planted.stage, 'plant');
    assert.equal(planted.aggressorLift, 0);
    assert.equal(first.stage, 'first-kick');
    assert.ok(first.aggressorLift > 10);
    assert.equal(second.stage, 'second-kick');
    assert.ok(second.aggressorLift > 20);
    assert.ok(Math.abs(second.aggressorAngle) > .17 && second.yaw > .6, 'the second kick turns the torso sideways and balances its extended leg');
    assert.ok(second.contact > .45, 'the second sole reaches the victim before recoil begins');
    assert.equal(second.lift, 0, 'the target stays grounded until the kick hits');
    assert.equal(impact.stage, 'impact');
    assert.ok(impact.contact > .9 && impact.lift > 0);
    assert.equal(release.stage, 'release');
    assert.ok(release.aggressorLift < .001, 'the kicker comes down while the opponent exits');
    assert.ok(release.lift > 13 && release.lift <= 14, 'impact gives a short recoil before the actual flight');
    assert.ok(at(round, .60, center).aggressorLift < .001, 'the first kick comes down before the second push-off');
    assert.ok(at(round, .80, center).aggressorLift > 21, 'the second push-off has its own readable apex');
    assert.ok([planted, first, second, impact, release].every(frame => frame.grip === undefined), 'a side kick never adopts a lifting grip');
    const strike = arenaAction(round, round.start + (round.impact - round.start) * .75);
    assert.equal(strike.actors.find(actor => actor.id === round.aggressor).pose, 'sidekick');
    assert.ok(strike.actors.every(actor => !actor.gripId), 'the connected action also keeps the kicking hands free');
  }
});

test('new finishing contacts and their floor exits remain continuous when the scene clock crosses a stage boundary', () => {
  for (const tactic of arenaFinalTechniques) for (const center of centers) {
    const round = bout(tactic), span = round.impact - round.start;
    for (const fraction of [.08, .20, .30, .34, .38, .43, .48, .56, .58, .60, .64, .72, .74, .78, .82, .90, 1]) {
      const time = round.start + span * fraction, before = arenaTechniqueTargets(round, time - .001, center), after = arenaTechniqueTargets(round, time + .001, center);
      for (const key of ['aggressor', 'victim']) assert.ok(distance(before[key], after[key]) < .005, `${tactic}/${fraction} cannot teleport a root`);
      for (const key of ['lift', 'aggressorLift', 'victimAngle', 'aggressorAngle', 'yaw', 'contact']) assert.ok(Math.abs(before[key] - after[key]) < .005, `${tactic}/${fraction}/${key} remains continuous`);
    }
    if (!['trip', 'suplex'].includes(tactic)) continue;
    const final = at(round, 1, center), origin = final.victim, landing = { x: center.x + final.side * 220, y: center.y + 45 }, preparation = { lift: final.lift, angle: final.victimAngle };
    const boundaries = tactic === 'trip' ? [880, 1100, 1600] : [300, 2600, 3480, 3680, 4180];
    for (const age of boundaries) {
      const before = arenaTechniqueExit(round, age - .001, origin, landing, final.side, 1, preparation), after = arenaTechniqueExit(round, age + .001, origin, landing, final.side, 1, preparation);
      assert.ok(distance(before, after) < .005, `${tactic} floor transition remains connected`);
      assert.ok(Math.abs(before.angle - after.angle) < .005);
    }
  }
});

test('every new final uses only the drawn finalists and the catalog also retains ordinary finishes', () => {
  const seen = new Set();
  const check = order => {
    const final = arenaRounds(order).at(-1);
    seen.add(final.tactic);
    assert.equal(final.aggressor, order[0]);
    assert.equal(final.victim, order[1]);
    if (arenaFinalTechniques.includes(final.tactic)) {
      const action = arenaAction(final, final.start + (final.impact - final.start) * .75);
      assert.deepEqual(new Set(action.actors.map(actor => actor.id)), new Set(order.slice(0, 2)), 'a finishing technique cannot revive a third participant');
      assert.deepEqual(action.attackers, [order[0]]);
      assert.equal(action.targetId, order[1]);
      assert.equal(arenaRanks(order, final.resolve - .001)[order[0]], undefined, 'the winner is not revealed before the physical finish');
    }
    assert.deepEqual(arenaRanks(order, 44_000), Object.fromEntries(order.map((id, index) => [id, index + 1])));
    return final.tactic;
  };
  for (let count = 2; count <= 10; count++) for (let variant = 0; variant < 90; variant++) check(Array.from({ length: count }, (_, index) => `final-${variant}-${index}`));
  function* permutations(values) {
    if (values.length < 2) { yield values; return; }
    for (let index = 0; index < values.length; index++) for (const rest of permutations(values.filter((_, other) => other !== index))) yield [values[index], ...rest];
  }
  const numericSeen = new Set();
  for (const count of [4, 5, 6]) for (const order of permutations(Array.from({ length: count }, (_, index) => String(index + 1)))) numericSeen.add(check(order));
  for (const tactic of arenaFinalTechniques) assert.ok(seen.has(tactic), `${tactic} is reachable in a real final`);
  assert.ok([...seen].some(tactic => !arenaFinalTechniques.includes(tactic)), 'the four new techniques do not replace every ordinary final');
  for (const tactic of arenaFinalTechniques) assert.ok(numericSeen.has(tactic), `${tactic} also occurs with the preview’s numeric participant IDs`);
  assert.ok([...numericSeen].some(tactic => !arenaFinalTechniques.includes(tactic)), 'numeric fixtures retain ordinary final techniques too');
});
