import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaFinalTechniques, arenaTechniqueTargets, arenaTechniqueExit } = await source('src/arenaTechniques.ts');
const { arenaAction, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter } = await source('src/game/ArenaFighter.ts');
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

test('the rendered held wrist stays connected through either direction of the airborne pivot', () => {
  const round = bout('armspin');
  for (const center of centers) for (const phase of [.70, .80, .90]) {
    const frame = at(round, phase, center), clock = round.start + (round.impact - round.start) * phase;
    const aggressor = fighter(0, { ...frame.aggressor, facing: frame.side, pose: 'grapple', phase, yaw: frame.yaw, pivotTurn: frame.yaw });
    const victim = fighter(1, { x: frame.victim.x, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: aggressor.x > frame.victim.x ? 1 : -1, pose: 'held', phase, angle: frame.victimAngle });
    const grip = { x: (aggressor.x + victim.x) / 2, y: (aggressor.y + victim.y) / 2 - 56 };
    for (const actor of [aggressor, victim]) {
      actor.gripTarget = grip;
      actor.secondaryGripTarget = { x: grip.x - actor.facing * 3, y: grip.y + 2 };
      actor.gripStrength = 1;
      drawArenaFighter(ctx, actor, clock);
      assert.ok(distance(actor.animation.contactPoints.hands[1], grip) <= 4, `side ${frame.side}, phase ${phase}: a fixed-length arm must reach the shared wrist`);
    }
    const gap = distance(aggressor.animation.contactPoints.hands[1], victim.animation.contactPoints.hands[1]);
    assert.ok(gap <= 4, `side ${frame.side}, phase ${phase}: held wrist gap ${gap.toFixed(2)}px`);
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

test('the ankle hook precedes the loss of balance and the tripped fighter rolls on the ground', () => {
  const round = bout('trip');
  for (const center of centers) {
    const grip = at(round, .36, center), hook = at(round, .57, center), fall = at(round, .88, center), landed = at(round, 1, center);
    assert.equal(grip.stage, 'grip');
    assert.equal(grip.grip, 'waist');
    assert.equal(grip.contact, 0);
    assert.equal(hook.stage, 'hook');
    assert.ok(hook.contact > .8, 'the attacking foot has made contact before the fall');
    assert.equal(Math.abs(hook.victimAngle), 0, 'the victim cannot already be lying down before the hook');
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
      assert.ok(landed.side * (frame.groundX - previous.groundX) >= -1e-8);
      assert.ok(distance(frame, previous) < 8, 'the rolling body travels continuously along the floor');
      previous = frame;
    }
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
    assert.ok(lifted.lift > 45, 'the opponent leaves the floor before the backward arc');
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
    const drag = arenaTechniqueExit(round, 1700, origin, landing, stunned.side, 1, preparation);
    assert.equal(drag.stage, 'drag');
    assert.equal(drag.height, 0);
    assert.ok(distance(drag, origin) > 40 && distance(drag, landing) > 20, 'the opponent actually slides between the two floor positions');
    assert.equal(drag.angle, stunned.victimAngle, 'dragging cannot silently stand the opponent upright');
    const dragging = arenaAction(round, round.impact + 700);
    assert.equal(dragging.actors.find(actor => actor.id === round.aggressor).pose, 'drag', 'the connected action cannot become a generic guard or throw during the ankle drag');
    assert.equal(dragging.actors.find(actor => actor.id === round.victim).pose, 'stunned');
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
    assert.ok(second.contact > .45, 'the second sole reaches the victim before recoil begins');
    assert.equal(second.lift, 0, 'the target stays grounded until the kick hits');
    assert.equal(impact.stage, 'impact');
    assert.ok(impact.contact > .9 && impact.lift > 0);
    assert.equal(release.stage, 'release');
    assert.ok(release.aggressorLift < .001, 'the kicker comes down while the opponent exits');
    assert.ok(release.lift > 20);
    assert.ok([planted, first, second, impact, release].every(frame => frame.grip === undefined), 'a side kick never adopts a lifting grip');
    const strike = arenaAction(round, round.start + (round.impact - round.start) * .75);
    assert.equal(strike.actors.find(actor => actor.id === round.aggressor).pose, 'sidekick');
    assert.ok(strike.actors.every(actor => !actor.gripId), 'the connected action also keeps the kicking hands free');
  }
});

test('new finishing contacts and their floor exits remain continuous when the scene clock crosses a stage boundary', () => {
  for (const tactic of arenaFinalTechniques) for (const center of centers) {
    const round = bout(tactic), span = round.impact - round.start;
    for (const fraction of [.08, .20, .30, .34, .38, .43, .48, .56, .60, .64, .74, .82, .90, 1]) {
      const time = round.start + span * fraction, before = arenaTechniqueTargets(round, time - .001, center), after = arenaTechniqueTargets(round, time + .001, center);
      for (const key of ['aggressor', 'victim']) assert.ok(distance(before[key], after[key]) < .005, `${tactic}/${fraction} cannot teleport a root`);
      for (const key of ['lift', 'aggressorLift', 'victimAngle', 'aggressorAngle', 'yaw', 'contact']) assert.ok(Math.abs(before[key] - after[key]) < .005, `${tactic}/${fraction}/${key} remains continuous`);
    }
    if (!['trip', 'suplex'].includes(tactic)) continue;
    const final = at(round, 1, center), origin = final.victim, landing = { x: center.x + final.side * 220, y: center.y + 45 }, preparation = { lift: final.lift, angle: final.victimAngle };
    const boundaries = tactic === 'trip' ? [880, 1100, 1600] : [300, round.resolve - round.impact - 200, round.resolve - round.impact, round.resolve - round.impact + 500];
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
