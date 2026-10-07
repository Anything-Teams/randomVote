import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaWrestlingMoveTargets, arenaClotheslineDuckOutcome, ARENA_CLOTHESLINE_DUCK_CHANCE, ARENA_CLOTHESLINE_DUCK_TIMING: duck, ARENA_CLOTHESLINE_JUMP_TIMING: jump } = await source('src/arenaWrestlingMoves.ts');
const { createArenaFighterAnimation, drawArenaFighter } = await source('src/game/ArenaFighter.ts');
const center = { x: 500, y: 416 }, distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a, b, progress) => ({ x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress });
const midpoint = points => mix(points[0], points[1], .5);
const neck = rig => mix(midpoint(rig.headSides), midpoint(rig.shoulders), .65);
const joints = rig => [rig.head, ...rig.headSides, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const fighter = values => ({ candidate: { id: 'a', name: '선수', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, phase: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
function paint(actor, clock) {
  const noop = () => {}; let matrix;
  const ctx = new Proxy({ globalAlpha: 1, transform(...values) { matrix = values; } }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
  drawArenaFighter(ctx, actor, clock);
  return { rig: structuredClone(actor.animation.contactPoints), skeleton: structuredClone(actor.animation.skeleton), matrix };
}
function sequence(side, ducking = true) {
  const initial = { driver: { x: 500 - side * 180, y: 416 }, victim: { x: 500 + side * 20, y: 416 } };
  const pending = { kind: 'clothesline', duck: ducking, start: 1000, end: 8000, launchAt: null, contactAt: null, releaseAt: null, ankleGripAt: null };
  const opening = arenaWrestlingMoveTargets(pending, pending.start, center, initial, side);
  assert.equal(opening.canPerform, true);
  const actual = { ...pending, launchAt: opening.plannedLaunchAt };
  const launch = arenaWrestlingMoveTargets(actual, actual.launchAt, center, initial, side);
  initial.launchDriver = launch.driver; initial.launchVictim = launch.victim;
  return { actual, initial, at: age => arenaWrestlingMoveTargets(actual, actual.launchAt + age, center, initial, side) };
}
function segmentGap(point, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const along = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, mix(from, to, along));
}
function insideArmGap(point, rig, arm) {
  const shoulder = rig.shoulders[arm], elbow = rig.elbows[arm], hand = rig.hands[arm];
  return Math.min(segmentGap(point, mix(shoulder, elbow, .5), elbow), segmentGap(point, elbow, mix(elbow, hand, .45)));
}

test('the independent clothesline duck occurs on exactly five of a thousand valid rolls', () => {
  assert.equal(ARENA_CLOTHESLINE_DUCK_CHANCE, .005);
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaClotheslineDuckOutcome(roll)).filter(Boolean).length, 5);
  assert.equal(arenaClotheslineDuckOutcome(0), true); assert.equal(arenaClotheslineDuckOutcome(4), true);
  assert.equal(arenaClotheslineDuckOutcome(5), false); assert.equal(arenaClotheslineDuckOutcome(999), false);
  for (const invalid of [-1, 1000, .5, NaN, Infinity]) assert.throws(() => arenaClotheslineDuckOutcome(invalid), RangeError);
});

test('the defender lowers after takeoff, holds beneath the arm and rises without a fake knockout or ankle finish', () => {
  assert.deepEqual(duck, { start: 120, low: 280, rise: 560, upright: 900, recover: 980 });
  for (const side of [-1, 1]) {
    const values = sequence(side), beforeLaunch = values.at(-1);
    assert.equal(beforeLaunch.victimDuck, 0); assert.equal(beforeLaunch.driverPose, 'run');
    for (const age of [0, 119, 120, 900, 980]) assert.equal(values.at(age).victimDuck, 0);
    for (const age of [280, 320, 420, 560]) assert.equal(values.at(age).victimDuck, 1);
    assert.equal(values.at(200).victimDuck, .5); assert.equal(values.at(730).victimDuck, .5);
    let previous = 0;
    for (let age = 120; age <= 280; age += 2) {
      const progress = values.at(age).victimDuck;
      assert.ok(progress >= previous && progress <= 1); previous = progress;
    }
    previous = 1;
    for (let age = 560; age <= 900; age += 2) {
      const progress = values.at(age).victimDuck;
      assert.ok(progress <= previous && progress >= 0); previous = progress;
    }
    for (let age = 0; age <= 980; age += 10) {
      const frame = values.at(age);
      assert.deepEqual(frame.victim, values.initial.victim, 'ducking cannot teleport the defender to evade a real arm');
      assert.equal(frame.victimPose, 'guard'); assert.equal(frame.victimHeight, 0); assert.equal(frame.victimAngle, 0);
      assert.equal(frame.victimEyesClosed, false); assert.equal(frame.victimSlam, undefined); assert.equal(frame.slamImpact, 0);
      assert.equal(frame.contactAt, null); assert.equal(frame.ankleGripAt, null); assert.equal(frame.releaseAt, null);
      assert.equal(frame.gripStrength, 0); assert.equal(frame.canGrabAnkle, false); assert.equal(frame.canRelease, false);
      assert.equal(frame.requiredEndAt, values.actual.launchAt + 980);
    }
    assert.equal(values.at(320).canContact, true, 'the lowered physical neck must miss; the roll cannot disable the real collision gate');
    assert.equal(values.at(979).missed, false); assert.equal(values.at(979).recovered, false);
    assert.equal(values.at(980).missed, true); assert.equal(values.at(980).recovered, true);
    assert.equal(values.at(980).driverPose, 'guard'); assert.equal(values.at(980).stage, 'recover');
  }
});

test('a duck leaves the original 640 ms flying attack and horizontal momentum intact', () => {
  assert.equal(jump.flight, 640);
  for (const side of [-1, 1]) {
    const ducking = sequence(side), ordinary = sequence(side, false);
    let previousFlightAngle, previousLandingAngle;
    for (let age = 0; age <= 640; age += 16) {
      const actual = ducking.at(age), reference = ordinary.at(age);
      for (const field of ['driver', 'driverVelocity', 'driverPose', 'driverHeight', 'driverSuspension', 'dropkickProgress', 'clotheslineStrength', 'clotheslineTarget']) assert.deepEqual(actual[field], reference[field], `${field} remains the same empty flying attack`);
      if (age < 640) assert.equal(actual.driverPhase, reference.driverPhase);
      const angle = Math.abs(actual.driverAngle);
      assert.ok(-side * actual.driverAngle >= 0 && angle < Math.PI / 2, 'the flying body rotates forward into its arm strike without an opposite or complete tumble');
      if (previousFlightAngle !== undefined) {
        assert.ok(Math.abs(angle - previousFlightAngle) < .16, 'the flying rotation cannot pop between 16 ms frames');
        if (age <= 320) assert.ok(angle >= previousFlightAngle, 'the opening rotation flows toward the nearly horizontal arm strike');
      }
      previousFlightAngle = angle;
      if (age > 640 * .56) {
        if (previousLandingAngle !== undefined) assert.ok(angle <= previousLandingAngle && previousLandingAngle - angle < .14, 'only the missed landing unfolds smoothly instead of resetting its horizontal body');
        previousLandingAngle = angle;
      }
    }
    const striking = ducking.at(320);
    assert.ok(Math.abs(striking.driverAngle) > Math.PI / 2 * .9 && striking.driverHeight > 30 && striking.clotheslineStrength > .75, 'at the physical contact window the airborne body and its extended arm are nearly horizontal');
    assert.equal(Math.abs(ducking.at(0).driverAngle), 0); assert.equal(Math.abs(ducking.at(640).driverAngle), 0);
    assert.equal(ducking.at(639).driverPose, 'dropkick'); assert.equal(ducking.at(640).driverPose, 'land');
    assert.equal(ducking.at(640).driverHeight, 0); assert.equal(ducking.at(640).driverPhase, 0, 'the landed body begins its ground settling instead of replaying takeoff');
    assert.equal(ducking.at(640).landingAt, ducking.actual.launchAt + 640);
    assert.ok(side * ducking.at(560).driverVelocity.x > 100, 'the attacker passes through the empty strike before slowing on the ground');
  }
});

test('ordinary attempts and an actually recorded hit retain the existing clothesline fall and finish', () => {
  for (const side of [-1, 1]) {
    const values = sequence(side, false), absent = { ...values.actual }; delete absent.duck;
    for (const age of [-200, 0, 200, 384, 640, 980]) {
      assert.deepEqual(values.at(age), arenaWrestlingMoveTargets(absent, values.actual.launchAt + age, center, values.initial, side));
    }
    const contactAt = values.actual.launchAt + 384;
    for (const age of [0, 80, 200, 420, 900, 1500]) {
      const ordinary = arenaWrestlingMoveTargets({ ...values.actual, contactAt }, contactAt + age, center, values.initial, side);
      const duckHit = arenaWrestlingMoveTargets({ ...values.actual, duck: true, contactAt }, contactAt + age, center, values.initial, side);
      assert.deepEqual(duckHit, ordinary, 'physical contact still runs the original hit instead of making the rare roll invulnerable');
      assert.equal(duckHit.victimDuck, 0);
    }
  }
});

for (const side of [-1, 1]) for (const step of [16, 50]) for (const index of [0, 4, 9]) {
  test(`the painted duck has a lowered neck, planted feet and continuous joints (side ${side}, ${step} ms, body ${index})`, () => {
    const values = sequence(side), defender = fighter({ index }), reference = fighter({ index }), attacker = fighter({ index: (index + 1) % 10 });
    let footprints, previous, originalTarget, closestOrdinaryNeck = Infinity, closestDuckedNeck = Infinity, lowestContactDrop = Infinity, recoveryGap;
    for (let age = 0; age <= 980; age += step) {
      const clock = values.actual.launchAt + age, frame = values.at(age);
      const victimValues = { x: frame.victim.x, y: frame.victim.y, depthY: frame.victim.y, facing: frame.victimFacing, pose: frame.victimPose, phase: frame.victimPhase, angle: frame.victimAngle, velocityX: frame.victimVelocity.x, velocityY: frame.victimVelocity.y };
      Object.assign(defender, victimValues, { duckProgress: frame.victimDuck > 0 ? frame.victimDuck : undefined });
      Object.assign(reference, victimValues);
      const painted = paint(defender, clock), upright = paint(reference, clock);
      footprints ??= painted.rig.feet;
      if (!frame.victimDuck) originalTarget = neck(upright.rig);
      Object.assign(attacker, { x: frame.driver.x, y: frame.driver.y - frame.driverHeight, depthY: frame.driver.y, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, angle: frame.driverAngle, suspension: frame.driverSuspension, jumpTuck: frame.driverJumpTuck, velocityX: frame.driverVelocity.x, velocityY: frame.driverVelocity.y, clotheslineTarget: originalTarget, clotheslineArm: frame.clotheslineArm, clotheslineStrength: frame.clotheslineStrength, clotheslineInner: true, dropkickProgress: frame.dropkickProgress });
      const attacking = paint(attacker, clock).rig;
      assert.ok(painted.matrix.every(Number.isFinite) && joints(painted.rig).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
      assert.ok(Math.abs(Math.hypot(painted.matrix[0], painted.matrix[1]) - defender.scale) < 1e-8);
      assert.ok(Math.abs(Math.hypot(painted.matrix[2], painted.matrix[3]) - defender.scale) < 1e-8, 'folding the hips cannot flatten or stretch the body');
      for (let limb = 0; limb < 2; limb++) {
        assert.ok(distance(painted.rig.feet[limb], footprints[limb]) < 1e-8, 'each heel keeps its original footprint throughout lowering and rising');
        assert.ok(Math.abs(painted.rig.feet[limb].y - (defender.y - 2 * defender.scale)) < 1e-8);
        assert.ok(Math.abs(distance(painted.rig.shoulders[limb], painted.rig.elbows[limb]) - 11 * defender.scale) < 1e-8);
        assert.ok(Math.abs(distance(painted.rig.elbows[limb], painted.rig.hands[limb]) - 10.5 * defender.scale) < 1e-8, 'the protecting hands remain connected by normal arm bones');
        const hip = painted.skeleton.hips[limb], knee = painted.skeleton.knees[limb], foot = painted.skeleton.feet[limb];
        for (const length of [distance(hip, knee), distance(knee, foot)]) assert.ok(length > 5.5 && length <= 11, 'each projected ground leg remains connected and visible');
        const bend = (knee.x - hip.x) * (foot.y - knee.y) - (knee.y - hip.y) * (foot.x - knee.x);
        assert.ok(bend > 0, 'both absorbing knees bend forward instead of crossing or inverting');
        const panel = painted.skeleton.shorts[limb];
        assert.equal(panel.length, 4); assert.ok(panel.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
        assert.ok(distance(midpoint(panel.slice(0, 2)), hip) < 6, 'the pants remain attached to the same lowered hip');
      }
      if (previous) joints(painted.rig).forEach((point, part) => assert.ok(distance(point, joints(previous.rig)[part]) < 2 + step * .9, `painted joint ${part} cannot pop on lowering, holding or standing (${age} ms)`));
      previous = painted;
      if (frame.canContact && frame.clotheslineStrength > .75) {
        closestOrdinaryNeck = Math.min(closestOrdinaryNeck, insideArmGap(neck(upright.rig), attacking, frame.clotheslineArm));
        closestDuckedNeck = Math.min(closestDuckedNeck, insideArmGap(neck(painted.rig), attacking, frame.clotheslineArm));
        lowestContactDrop = Math.min(lowestContactDrop, neck(painted.rig).y - neck(upright.rig).y);
      }
      recoveryGap = distance(neck(painted.rig), neck(upright.rig));
    }
    assert.ok(closestOrdinaryNeck < 8, 'this same painted flying inside arm would hit the ordinary upright defender');
    assert.ok(closestDuckedNeck > 20 && lowestContactDrop > 30, 'the real ducked neck clears that arm physically without changing the attack trajectory');
    assert.ok(recoveryGap < 4, 'the defender is upright again by the finite recovery boundary');
  });
}
