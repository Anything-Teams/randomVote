import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaFinalTechniques, arenaFloorExitTiming, arenaTechniqueTargets, arenaTechniqueReactionAt, arenaTechniqueExit, arenaSuplexRim, arenaSidekickWindow } = await source('src/arenaTechniques.ts');
const { arenaAction, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter, arenaSpinGripPair, arenaSpinSnapshot, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
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
    assert.ok(Math.abs(turning.yaw) > Math.PI / 2 && Math.abs(lastGrip.yaw) > Math.PI * 3, 'the held opponent makes more than one and a half revolutions');
    assert.equal(turning.lift, 0, 'hand-driven suspension cannot add a second root lift');
    assert.equal(turning.victimAngle, 0, 'the body is not rotated around its feet');
    assert.equal(turning.spin.weight, 1);
    assert.equal(lastGrip.grip, 'wrist');
    assert.equal(release.stage, 'release');
    assert.equal(release.grip, undefined, 'release happens after the turn rather than before its motion');
    assert.ok(Math.abs(Math.abs(release.yaw) - Math.PI * 4) < 1e-8, 'both complete revolutions finish before release');
    const held = arenaAction(round, round.start + (round.impact - round.start) * .70);
    assert.ok(held.actors.every(actor => actor.gripId), 'the visible pivot keeps both participants linked');
    assert.ok(arenaAction(round, round.impact).actors.every(actor => !actor.gripId), 'the linked wrists are released when flight begins');
  }
});

test('both painted hands stay held while the suspended body and extended legs circle outside the driver', () => {
  const round = bout('armspin');
  for (const center of centers) for (let phase = .50; phase < 1; phase += .01) {
    const frame = at(round, phase, center), clock = round.start + (round.impact - round.start) * phase;
    const aggressor = fighter(0, { ...frame.aggressor, facing: frame.side, pose: 'grapple', phase, yaw: frame.yaw, pivotTurn: frame.yaw });
    const grips = arenaSpinGripPair(aggressor, frame.spin.orbit, clock, frame.spin.weight);
    Object.assign(aggressor, { gripTarget: grips[1], secondaryGripTarget: grips[0], gripStrength: 1, gripLocked: true });
    const victim = fighter(1, { ...frame.victim, facing: -frame.side, pose: 'held', phase, gripMode: 'wrist', spinSuspension: { ...frame.spin, grips } });
    drawArenaFighter(ctx, aggressor, clock); drawArenaFighter(ctx, victim, clock);
    const driver = aggressor.animation.contactPoints, suspended = victim.animation.contactPoints;
    for (let arm = 0; arm < 2; arm++) {
      assert.ok(distance(driver.hands[arm], grips[arm]) < .01, `side ${frame.side}, phase ${phase}: driver hand ${arm} holds the actual wrist`);
      assert.ok(distance(suspended.hands[arm], driver.hands[arm]) < .01, `side ${frame.side}, phase ${phase}: both hands must stay held`);
    }
    if (frame.spin.weight === 1) {
      assert.ok(suspended.feet.every(foot => foot.y < aggressor.y - 8), 'neither extended foot drags on the sand');
      assert.ok(suspended.head.y >= driver.head.y - 4, 'a foot-root rotation cannot launch the face over the driver');
      if (Math.abs(Math.cos(frame.spin.orbit)) > .5) {
        const outward = Math.sign(Math.cos(frame.spin.orbit)), waist = suspended.waist.x * outward;
        assert.ok(suspended.feet.every(foot => foot.x * outward > waist + 14), 'both legs extend outward beyond the torso rather than tucking under the held hands');
      }
    }
  }
});

test('the hand-driven spin accelerates gently before a steady orbit and preserves its exact release geometry', () => {
  const round = bout('armspin');
  for (const side of [-1, 1]) {
    const actual = { ...round, contactSide: side }, center = { x: 500, y: 416 };
    const phases = [.44, .46, .48, .50], angles = phases.map(phase => at(actual, phase, center).yaw * side);
    const angularSteps = angles.slice(1).map((angle, index) => angle - angles[index]);
    assert.ok(angularSteps[0] > 0 && angularSteps[1] > angularSteps[0] && angularSteps[2] > angularSteps[1], 'the hands do not instantly begin at full angular speed');
    const cruise = [.66, .76, .86, .96].map(phase => at(actual, phase, center).yaw * side);
    assert.ok(cruise.slice(2).every((angle, index) => Math.abs((angle - cruise[index + 1]) - (cruise[1] - cruise[0])) < 1e-8), 'the visible revolutions have a steady cadence before release');
    const final = at(actual, 1, center), repeated = at(actual, 1, center);
    assert.deepEqual(final, repeated, 'pause and direct seek cannot change the spin geometry');
    assert.ok(side * Math.cos(final.spin.orbit) > .999, 'the body is extended beside the driver when both hands release');
    assert.ok(final.victim.y < center.y - 20, 'the foot target is already airborne before the throw starts');
  }
});

test('the airborne release preserves the actual head, waist and feet before easing into a floor-aware landing', () => {
  const round = bout('armspin');
  for (const center of centers) {
    const frame = at(round, 1, center), clock = round.impact;
    const driver = fighter(0, { ...frame.aggressor, facing: frame.side, pose: 'grapple', phase: 1, yaw: frame.yaw, pivotTurn: frame.yaw });
    const grips = arenaSpinGripPair(driver, frame.spin.orbit, clock, frame.spin.weight);
    const victim = fighter(1, { ...frame.victim, facing: -frame.side, pose: 'held', phase: 1, gripMode: 'wrist', spinSuspension: { ...frame.spin, grips } });
    drawArenaFighter(ctx, victim, clock);
    const held = structuredClone(victim.animation.contactPoints);
    const snapshot = arenaSpinSnapshot(victim, clock);
    Object.assign(victim, { ...held.origin, pose: 'airborne', gripMode: undefined, spinSuspension: undefined, spinRelease: { snapshot, weight: 1 }, motionImmediate: false });
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
      Object.assign(driver, frame.aggressor, { pose: frame.aggressorPose ?? action.actors[0].pose, overheadRaise: frame.aggressorOverheadRaise, gripMode: frame.grip, phase: frame.phase, facing: frame.side, angle: frame.aggressorAngle, motionImmediate: !previous, motionEpoch: 1 });
      Object.assign(victim, { x: frame.victim.x, y: frame.victim.y - frame.lift, depthY: frame.victim.y, pose: frame.victimPose ?? (frame.lift > 5 ? 'airborne' : 'brace'), phase: frame.phase, facing: -frame.side, angle: frame.victimAngle, suspension: frame.victimSuspension, slamProgress: frame.victimSlam, motionImmediate: !previous, motionEpoch: 1 });
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
    const grip = at(round, .36, center), hook = at(round, .50, center), fall = at(round, .62, center), grounded = at(round, .68, center), kick = at(round, .80, center), landed = at(round, 1, center);
    assert.equal(grip.stage, 'grip');
    assert.equal(grip.grip, 'waist');
    assert.equal(grip.contact, 0);
    assert.equal(hook.stage, 'hook');
    assert.ok(hook.contact > .99, 'the ankle hook has a readable full-contact beat before the fall');
    assert.equal(Math.abs(hook.victimAngle), 0, 'the victim cannot already be lying down before the hook');
    assert.equal(fall.stage, 'fall');
    assert.ok(Math.abs(fall.victimAngle) > 1, 'the hook visibly puts the victim on the ground before a kick');
    assert.equal(grounded.stage, 'stunned');
    assert.equal(grounded.victimPose, 'stunned');
    assert.equal(grounded.contact, 0, 'the fall can be read before the kicking leg begins to reach');
    assert.ok(Math.abs(grounded.victimAngle) > Math.PI * .46);
    const chamber = at(round, .75, center), extension = at(round, .785, center), recovery = at(round, .815, center);
    assert.ok(chamber.frontKick > 0 && chamber.frontKick < .4, 'the knee folds before the shin extends toward the target');
    assert.equal(chamber.contact, 0, 'a chambered knee cannot register a sole hit');
    assert.ok(extension.frontKick > .4 && extension.frontKick < .62 && extension.contact > 0, 'the forward stroke reaches the body after lifting the knee');
    assert.ok(recovery.frontKick > .62 && recovery.frontKick < .78 && recovery.contact < .5, 'the shin is withdrawn immediately after impact');
    assert.equal(at(round, .85, center).frontKick, 1, 'the one forward kick lowers its foot before another action');
    assert.equal(kick.stage, 'kick');
    assert.equal(kick.grip, undefined, 'the waist is released before the leg pushes the opponent away');
    assert.ok(kick.contact > .99);
    const clock = arenaTechniqueReactionAt(round);
    assert.equal(kick.kickReactionAt, clock);
    assert.equal(kick.victimPose, 'roll', 'the victim starts tumbling at the first full sole contact');
    const target = fighter(1, { ...kick.victim, facing: -kick.side, pose: kick.victimPose, angle: kick.victimAngle, phase: .80 });
    const contacts = sampleArenaFighterContacts(target, clock);
    const kicker = fighter(0, { ...kick.aggressor, facing: kick.side, pose: 'trip', phase: .80, footTarget: contacts.waist, footStrength: kick.contact, kickLeg: 1 });
    drawArenaFighter(ctx, kicker, clock);
    assert.ok(distance(kicker.animation.contactPoints.feet[1], contacts.waist) < .01, 'the visible sole reaches the fallen waist before the recoil');
    assert.ok(Math.abs(kicker.animation.contactPoints.feet[0].y - (kicker.y - 2 * kicker.scale)) < .01, 'the other foot stays planted during the waist kick');
    const reacting = arenaTechniqueTargets(round, clock + 16, center);
    assert.ok(reacting.reactionProgress > 0 && kick.side * (reacting.victimAngle - kick.victimAngle) > 0, 'the next rendered frame reacts instead of waiting for a second impact clock');
    assert.ok(at(round, .81, center).contact > 0 && at(round, .83, center).contact === 0, 'the sole withdraws promptly instead of following a rolling body');
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

test('the grounded ankle fall preserves the live body through its floor-pivot transition', () => {
  const round = bout('trip');
  for (const side of [-1, 1]) for (const phase of [.54, .58, .80]) {
    const actual = { ...round, contactSide: side }, victim = fighter(1, { motionImmediate: false, motionEpoch: 1 });
    const render = clock => {
      const frame = arenaTechniqueTargets(actual, clock, { x: 500, y: 416 });
      Object.assign(victim, frame.victim, { facing: -side, pose: frame.victimPose ?? 'brace', phase: frame.phase, angle: frame.victimAngle, suspension: frame.victimSuspension });
      drawArenaFighter(ctx, victim, clock);
      return structuredClone(victim.animation.contactPoints);
    };
    const boundary = round.start + (round.impact - round.start) * phase;
    for (let clock = round.start; clock < boundary - .001; clock += 16) render(clock);
    const before = render(boundary - .001), after = render(boundary + .001);
    for (const part of ['head', 'waist']) assert.ok(distance(before[part], after[part]) < .01, `${side}/${phase}/${part}: touching the floor cannot reset the body pivot`);
    for (let leg = 0; leg < 2; leg++) assert.ok(distance(before.feet[leg], after.feet[leg]) < .01);
  }
});

test('an overhead waist lift reads its raised hold before accelerating into a slam and dragging the grounded opponent', () => {
  const round = bout('suplex');
  for (const center of centers) {
    const grip = at(round, .32, center), lifted = at(round, .55, center), raised = at(round, .70, center), stunned = at(round, .95, center);
    assert.equal(grip.stage, 'grip');
    assert.equal(grip.grip, 'waist');
    assert.equal(grip.lift, 0);
    assert.equal(lifted.stage, 'lift');
    assert.ok(lifted.lift > 70 && lifted.lift < 100, 'the opponent is raised by the waist through an observable upward stroke');
    assert.equal(raised.stage, 'overhead');
    assert.equal(raised.grip, 'waist');
    assert.equal(raised.lift, 100);
    assert.equal(Math.abs(raised.victimAngle), 0, 'the raised hold cannot already be a backwards arch');
    const clock = round.start + (round.impact - round.start) * .70;
    const raisedBody = sampleArenaFighterContacts(fighter(1, { ...raised.victim, y: raised.victim.y - raised.lift, facing: -raised.side, pose: raised.victimPose, phase: raised.phase, angle: raised.victimAngle, suspension: raised.victimSuspension, slamProgress: raised.victimSlam }), clock);
    const holder = fighter(0, { ...raised.aggressor, facing: raised.side, pose: raised.aggressorPose, overheadRaise: raised.aggressorOverheadRaise, gripMode: 'waist', phase: raised.phase, gripTarget: raisedBody.waist, secondaryGripTarget: { x: raisedBody.waist.x - raised.side * 6, y: raisedBody.waist.y + 3 }, gripStrength: 1, gripLocked: true });
    const held = sampleArenaFighterContacts(holder, clock);
    assert.ok(distance(held.hands[1], raisedBody.waist) < .01, 'the raised waist stays attached to the lifting hands');
    assert.ok(raisedBody.waist.y < held.head.y, 'the waist hold reaches above the painted thrower’s head');
    assert.equal(stunned.stage, 'stunned');
    assert.equal(stunned.lift, 0);
    const high = at(round, .70, center), dropping = at(round, .86, center), slammed = at(round, .89, center);
    assert.equal(high.lift, 100, 'the overhead peak stays still long enough to read before the downward stroke');
    assert.ok(at(round, .78, center).lift > at(round, .82, center).lift && at(round, .82, center).lift > dropping.lift, 'the slam accelerates downward without another idle beat');
    assert.ok(dropping.lift > 15 && dropping.lift < high.lift, 'the visible shoulder landing has an actual downward approach');
    assert.equal(slammed.stage, 'slam');
    assert.equal(slammed.lift, 0);
    assert.ok(slammed.slamImpact > .9, 'the ground collision has its own readable impact beat');
    assert.ok(stunned.victimSlam.slump === 1, 'the limbs relax only after the slam');
    const origin = stunned.victim, landing = { x: center.x + stunned.side * 230, y: center.y + 50 }, preparation = { lift: 0, angle: stunned.victimAngle };
    for (const age of [0, 100, 899]) {
      const frame = arenaTechniqueExit(round, age, origin, landing, stunned.side, 1, preparation);
      assert.equal(frame.stage, 'stunned');
      assert.ok(distance(frame, origin) < 1e-8, 'a visible stunned beat precedes the ankle drag');
    }
    const rim = arenaSuplexRim(origin, stunned.side);
    const drag = arenaTechniqueExit(round, 1700, origin, landing, stunned.side, 1, preparation);
    assert.equal(drag.stage, 'drag');
    assert.equal(drag.height, 0);
    const pull = distance(drag, origin) / distance(origin, rim);
    assert.ok(pull > .4 && pull < .8, 'the opponent travels through the interior of the remaining floor path before the rim toss');
    assert.equal(drag.angle, stunned.victimAngle, 'dragging cannot silently stand the opponent upright');
    const dragging = arenaAction(round, round.impact + 700);
    assert.equal(dragging.actors.find(actor => actor.id === round.aggressor).pose, 'drag', 'the connected action cannot become a generic guard or throw during the ankle drag');
    assert.equal(dragging.actors.find(actor => actor.id === round.victim).pose, 'stunned');
    const timing = arenaFloorExitTiming(round);
    const heldFloor = arenaTechniqueExit(round, timing.dragUntil + 500, origin, landing, stunned.side, 1, preparation);
    assert.equal(heldFloor.stage, 'hold');
    const toss = arenaTechniqueExit(round, timing.throwUntil + 350, origin, landing, stunned.side, 1, preparation);
    assert.equal(toss.stage, 'rim-toss');
    assert.ok(toss.height > 0 && toss.height <= 12, 'the last stroke sends only the opponent over the rim on a shallow arc');
    assert.ok(timing.tossUntil - timing.throwUntil <= 600, 'the outside toss completes promptly instead of floating');
    const resolved = arenaTechniqueExit(round, timing.landUntil, origin, landing, stunned.side, 1, preparation);
    assert.ok(distance(resolved, landing) < 1e-8, 'the drawn loser reaches the outside landing by the ranking reveal');
  }
});

test('one airborne side kick has a single jump and launches at sole contact', () => {
  const round = bout('sidekick');
  for (const center of centers) {
    const window = arenaSidekickWindow(round), jumpAt = fraction => arenaTechniqueTargets(round, window.start + window.duration * fraction, center);
    assert.equal(window.duration, 650, 'a long introduction cannot stretch the jump into slow motion');
    const planted = arenaTechniqueTargets(round, window.start - 16, center), first = jumpAt(.16), second = jumpAt(.48), impact = jumpAt(.54), release = jumpAt(1);
    assert.equal(planted.stage, 'approach');
    assert.equal(planted.aggressorLift, 0);
    assert.equal(first.stage, 'jump');
    assert.ok(first.aggressorLift > 10);
    assert.equal(second.stage, 'kick');
    assert.ok(second.aggressorLift > 20);
    assert.ok(Math.abs(second.aggressorAngle) > .17 && second.yaw > .6, 'the airborne kick turns the torso sideways and balances its extended leg');
    assert.ok(second.contact > .45, 'the second sole reaches the victim before recoil begins');
    assert.equal(second.lift, 0, 'the target stays grounded until the kick hits');
    assert.equal(impact.stage, 'impact');
    const touch = jumpAt(.5), reacting = arenaTechniqueTargets(round, touch.kickReactionAt + 16, center);
    assert.equal(touch.kickReactionAt, arenaTechniqueReactionAt(round));
    assert.ok(touch.contact > .999 && touch.lift === 0, 'the final sole contact and the flight launch share one exact clock');
    assert.ok(reacting.lift > 0 && reacting.reactionProgress > 0 && reacting.side * (reacting.victim.x - touch.victim.x) > 0, 'the victim leaves immediately in the next rendered frame');
    assert.ok(impact.contact > 0 && impact.lift > 0);
    assert.equal(jumpAt(.65).contact, 0, 'the striking foot cannot stay locked onto the departing opponent');
    assert.equal(release.stage, 'release');
    assert.ok(release.aggressorLift < .001, 'the kicker comes down while the opponent exits');
    assert.ok(release.lift > 13 && release.lift <= 14, 'impact gives a short recoil before the actual flight');
    assert.ok(jumpAt(.35).aggressorLift > 20, 'there is no intermediate landing');
    assert.ok(jumpAt(.65).aggressorLift > 21);
    const heights = Array.from({ length: 101 }, (_, i) => jumpAt(i / 100).aggressorLift);
    const peaks = heights.filter((height, i) => i > 0 && i < 100 && height > heights[i - 1] && height > heights[i + 1]);
    assert.equal(peaks.length, 1, 'the body has exactly one airborne apex');
    assert.ok([planted, first, second, impact, release].every(frame => frame.grip === undefined), 'a side kick never adopts a lifting grip');
    const strike = arenaAction(round, window.start + window.duration * .48);
    assert.equal(strike.actors.find(actor => actor.id === round.aggressor).pose, 'sidekick');
    assert.ok(strike.actors.every(actor => !actor.gripId), 'the connected action also keeps the kicking hands free');
  }
});

test('sidekick contact clocks and jump duration remain physical across short and long bouts', () => {
  for (const span of [700, 2100, 2800, 5000, 7200]) for (const timeScale of [.4, .8, 1, 1.4]) {
    const round = { ...bout('sidekick'), impact: base.start + span, timeScale }, window = arenaSidekickWindow(round);
    assert.ok(window.duration <= 650 && window.duration <= span * .68);
    assert.equal(arenaTechniqueReactionAt(round), window.contactAt);
    assert.ok(window.start >= round.start && window.start - round.start <= 650, 'approaching cannot add a long planted waiting beat');
    for (const boundary of [window.start, window.start + window.duration * .22, window.contactAt, window.start + window.duration * .62, window.end]) {
      const before = arenaTechniqueTargets(round, boundary - .001, { x: 500, y: 416 }), after = arenaTechniqueTargets(round, boundary + .001, { x: 500, y: 416 });
      for (const key of ['aggressor', 'victim']) assert.ok(distance(before[key], after[key]) < .005);
      for (const key of ['aggressorLift', 'aggressorAngle', 'lift', 'contact']) assert.ok(Math.abs(before[key] - after[key]) < .005);
    }
    const touch = arenaTechniqueTargets(round, window.contactAt, { x: 500, y: 416 });
    assert.ok(touch.contact > .999 && touch.reactionProgress === 0);
    assert.ok(arenaTechniqueTargets(round, window.contactAt + 16, { x: 500, y: 416 }).reactionProgress > 0);
  }
});

test('a sidekick goes directly from its recorded first approach into a jump without a blocked probe or reset', () => {
  const round = { ...bout('sidekick'), sidekickLaunchAt: base.start + 420 }, center = { x: 500, y: 416 };
  const window = arenaSidekickWindow(round);
  assert.equal(window.start, round.sidekickLaunchAt);
  for (const elapsed of [round.start, round.start + 100, window.start - 1]) {
    const frame = arenaTechniqueTargets(round, elapsed, center);
    assert.equal(frame.stage, 'approach'); assert.equal(frame.grip, undefined); assert.equal(frame.aggressorLift, 0);
    assert.equal(frame.aggressor.x, center.x - frame.side * 24); assert.equal(frame.victim.x, center.x + frame.side * 24);
  }
  const jumped = arenaTechniqueTargets(round, window.start + 16, center);
  assert.equal(jumped.stage, 'jump'); assert.ok(jumped.aggressorLift > 0);
  assert.equal(arenaTechniqueReactionAt(round), window.contactAt);
  assert.equal(arenaTechniqueTargets(round, window.end, center).stage, 'release', 'completing the jump never waits for the original planning impact');
});

test('new finishing contacts and their floor exits remain continuous when the scene clock crosses a stage boundary', () => {
  for (const tactic of arenaFinalTechniques) for (const center of centers) {
    const round = bout(tactic), span = round.impact - round.start;
    for (const fraction of [.08, .20, .30, .34, .38, .40, .43, .44, .48, .51, .54, .56, .5744, .58, .60, .62, .64, .70, .72, .74, .78, .80, .82, .84, .88, .90, .94, 1]) {
      const time = round.start + span * fraction, before = arenaTechniqueTargets(round, time - .001, center), after = arenaTechniqueTargets(round, time + .001, center);
      for (const key of ['aggressor', 'victim']) assert.ok(distance(before[key], after[key]) < .005, `${tactic}/${fraction} cannot teleport a root`);
      for (const key of ['lift', 'aggressorLift', 'victimAngle', 'aggressorAngle', 'yaw', 'contact']) assert.ok(Math.abs(before[key] - after[key]) < .005, `${tactic}/${fraction}/${key} remains continuous`);
    }
    if (!['trip', 'suplex'].includes(tactic)) continue;
    const final = at(round, 1, center), origin = final.victim, landing = { x: center.x + final.side * 220, y: center.y + 45 }, preparation = { lift: final.lift, angle: final.victimAngle };
    const boundaries = tactic === 'trip' ? [880, 1100, 1600] : [900, 2600, 3480, 3680, 4180];
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
