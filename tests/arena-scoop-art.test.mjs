import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const motionBundle = await build({ entryPoints: ['src/arenaWrestlingMoves.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { ARENA_SCOOP_SLAM_TIMING: timing, ARENA_SCOOP_FINISH_TIMING: finishTiming, ARENA_WRESTLING_MOVE_TIMING: commonTiming, arenaWrestlingMoveTargets } = await import(`data:text/javascript;base64,${Buffer.from(motionBundle.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'a', name: 'a', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
function paint(actor, clock) {
  let matrix;
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'ellipse', 'fill', 'closePath', 'fillRect', 'moveTo', 'lineTo'].map(key => [key, () => {}]));
  ctx.transform = (...values) => { matrix = values; };
  drawArenaFighter(ctx, actor, clock);
  return { contacts: structuredClone(actor.animation.contactPoints), rig: structuredClone(actor.animation.rig), skeleton: structuredClone(actor.animation.skeleton), matrix };
}
function humanBones(actor, frame) {
  assert.ok(frame.matrix.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(frame.matrix[0], frame.matrix[1]) - actor.scale) < 1e-8, 'lifting keeps the complete body width');
  for (let arm = 0; arm < 2; arm++) {
    assert.ok(Math.abs(distance(frame.contacts.shoulders[arm], frame.contacts.elbows[arm]) - 11 * actor.scale) < .001, 'the upper arm stays connected and full length');
    assert.ok(Math.abs(distance(frame.contacts.elbows[arm], frame.contacts.hands[arm]) - 10.5 * actor.scale) < .001, 'the forearm stays connected and full length');
  }
  if (actor.animation.airborne && !actor.slamProgress) for (let leg = 0; leg < 2; leg++) {
    assert.ok(Math.abs(distance(frame.skeleton.hips[leg], frame.skeleton.knees[leg]) - 11) < .001);
    assert.ok(Math.abs(distance(frame.skeleton.knees[leg], frame.skeleton.feet[leg]) - 11) < .001);
  }
}

test('a scoop supports the load with a planted upright lift instead of the spinebuster dive', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ facing });
    paint(actor, 0);
    actor.pose = 'scoopslam';
    let previous;
    const turnAt = timing.load + timing.lift, downAt = turnAt + timing.turn;
    for (let clock = 0; clock <= downAt + timing.slam; clock += step) {
      Object.assign(actor, { scoopLoad: smooth(clock / timing.load), scoopLift: smooth((clock - timing.load) / timing.lift), scoopTurn: smooth((clock - turnAt - timing.turn * .25) / (timing.turn * .75)), scoopDown: smooth((clock - downAt) / timing.slam) });
      const frame = paint(actor, clock);
      humanBones(actor, frame);
      assert.equal(actor.animation.airborne, false);
      assert.ok(actor.animation.feet.every(foot => foot.lift === 0), 'the wrestler drives through planted feet');
      assert.ok(frame.rig.motion.crouch <= 5.81, 'accepting weight uses a knee bend rather than a seated pose');
      assert.ok(frame.skeleton.feet.every((foot, leg) => distance(foot, frame.skeleton.hips[leg]) > 14), 'both supporting legs retain space beneath the hips throughout the load');
      assert.ok(frame.rig.motion.lean <= 24, 'the standing scoop avoids the forward diving tackle posture');
      if (previous) frame.contacts.hands.forEach((hand, arm) => assert.ok(distance(hand, previous.hands[arm]) < (step === 16 ? 8 : 22), 'both support arms follow the body continuously'));
      previous = frame.contacts;
    }
  }
});

test('a cradled wrestler responds with folded arms and soft knees through pickup and back-first landing', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ facing });
    const grounded = paint(actor, 1000);
    Object.assign(actor, { pose: 'carried', carrySupport: 'cradle', carryStretch: 0, carryEntry: true, suspension: 0 });
    const first = paint(actor, 1000);
    grounded.contacts.hands.forEach((hand, arm) => assert.ok(distance(hand, first.contacts.hands[arm]) < 1, 'pickup begins at the actual previous hands within one display pixel'));
    let previous = first;
    for (let elapsed = step; elapsed <= 600 + step; elapsed += step) {
      const progress = smooth(elapsed / 600);
      Object.assign(actor, { carryStretch: progress, angle: -facing * Math.PI * .36 * progress, y: 416 - 56 * progress, suspension: progress });
      const frame = paint(actor, 1000 + elapsed);
      humanBones(actor, frame);
      frame.contacts.hands.forEach((hand, arm) => assert.ok(distance(hand, previous.contacts.hands[arm]) < (step === 16 ? 11 : 28), 'the receiving arms do not flip at lift boundaries'));
      previous = frame;
    }
    const lifted = previous;
    assert.ok(lifted.rig.hands.every(hand => hand.y < lifted.rig.hip.y + 8), 'both arms brace near the upper body instead of dangling beside the hips');
    assert.ok(lifted.skeleton.feet.every((foot, leg) => distance(lifted.skeleton.hips[leg], foot) < 20.5), 'the carried legs have a natural knee bend rather than rigid straight sticks');
    Object.assign(actor, { slamProgress: { tuck: 1, slump: 0 }, slamEntry: true });
    paint(actor, 1650);
    for (let elapsed = step; elapsed <= 320 + step; elapsed += step) {
      const down = smooth(elapsed / 320);
      Object.assign(actor, { angle: -facing * Math.PI * (.36 + .14 * down), y: 360 + 56 * down, slamProgress: { tuck: 1 - down, slump: down } });
      humanBones(actor, paint(actor, 1650 + elapsed));
    }
  }
});

test('the scoop ankle reach turns the actual resting arms into the pickup without reversing an elbow in one frame', () => {
  for (const facing of [-1, 1]) for (const turn of [false, true]) for (const step of [16, 50]) {
    const actor = fighter({ facing });
    const rested = paint(actor, 1000);
    const targetFacing = turn ? -facing : facing;
    const targetActor = fighter({ facing: targetFacing, pose: 'drag', gripMode: 'ankle', motionImmediate: true });
    const target = paint(targetActor, 1000).contacts.hands;
    Object.assign(actor, { facing: targetFacing, pose: 'drag', gripMode: 'ankle', gripLocked: true, gripTarget: target[1], secondaryGripTarget: target[0], gripStrength: 1, ankleApproach: 0 });
    const entered = paint(actor, 1000);
    for (let arm = 0; arm < 2; arm++) {
      assert.ok(distance(entered.contacts.hands[arm], rested.contacts.hands[arm]) < .001, 'pickup starts at the previous world-space palm even through a grounded turn');
      assert.ok(distance(entered.contacts.elbows[arm], rested.contacts.elbows[arm]) < .001);
    }
    let previous = entered;
    for (let elapsed = step; elapsed <= 240 + step; elapsed += step) {
      actor.ankleApproach = smooth(elapsed / 240);
      const frame = paint(actor, 1000 + elapsed);
      humanBones(actor, frame);
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(distance(frame.contacts.elbows[arm], previous.contacts.elbows[arm]) < (step === 16 ? 15 : 42), 'the back elbow travels through the reach instead of choosing a mirrored IK branch');
        assert.ok(distance(frame.contacts.hands[arm], previous.contacts.hands[arm]) < (step === 16 ? 15 : 42), JSON.stringify({facing,turn,step,elapsed,arm,gap:distance(frame.contacts.hands[arm],previous.contacts.hands[arm])}));
      }
      previous = frame;
    }
    delete actor.ankleApproach;
    const done = paint(actor, 1280);
    for (let arm = 0; arm < 2; arm++) assert.ok(distance(done.contacts.elbows[arm], previous.contacts.elbows[arm]) < 6, 'finishing the pickup does not restart its elbow bend');
  }
});

test('the complete scoop gives the load, chest hold, guided fall and ankle heave distinct real time', () => {
  const duration = Object.values(timing).reduce((sum, value) => sum + value, 0);
  assert.ok(timing.load >= 300 && timing.lift >= 560 && timing.turn >= 460 && timing.slam >= 460);
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const contactAt = 1000, center = { x: 500, y: 416 };
    const origins = { driver: { x: 500 - facing * 30, y: 416 }, victim: { x: 500 + facing * 30, y: 416 }, contactDriver: { x: 500 - facing * 24, y: 416 }, contactVictim: { x: 500 + facing * 30, y: 416 } };
    const window = { kind: 'scoopslam', start: 0, end: 9000, launchAt: 800, contactAt, ankleGripAt: null, releaseAt: null, kickAt: null };
    let heldFrames = 0, previous;
    for (let age = 0; age <= duration + commonTiming.groggy; age += step) {
      const frame = arenaWrestlingMoveTargets(window, contactAt + age, center, origins, facing);
      assert.equal(frame.canRelease, false, 'a floor slam cannot bypass the actual ankle grip');
      if (age <= timing.load) assert.equal(frame.victimHeight, 0, 'the planted receiving knees bear the load before the body rises');
      if (frame.scoopLift === 1 && frame.scoopTurn === 0 && frame.scoopDown === 0) {
        heldFrames++;
        assert.equal(frame.gripStrength, 1, 'the back and thigh stay supported throughout the chest hold');
      }
      if (previous) assert.ok(distance(frame.scoopSupport, previous.scoopSupport) < (step === 16 ? 8 : 24), 'the real supported waist follows one continuous gather, lift and lowering arc');
      previous = frame;
      if (age >= duration && age < duration + commonTiming.groggy) assert.equal(frame.driverPose, 'scoopslam', 'the receiving arms follow the back onto the sand before beginning the ankle reach');
    }
    assert.ok(heldFrames >= (step === 16 ? 6 : 2), 'even at 20fps the supported chest hold is readable');
    const ankleGripAt = contactAt + duration + commonTiming.groggy + commonTiming.ankleReach;
    const held = { ...window, ankleGripAt };
    for (let age = 0; age < finishTiming.ankleLoad; age += step) {
      const frame = arenaWrestlingMoveTargets(held, ankleGripAt + age, center, origins, facing);
      assert.equal(frame.driverPose, 'drag'); assert.equal(frame.victimHeight, 0); assert.equal(frame.ankleThrowProgress, undefined);
      assert.equal(frame.canRelease, false, 'the actual two-ankle hold receives the weight before heaving');
    }
    const release = ankleGripAt + finishTiming.ankleLoad + finishTiming.ankleThrow;
    assert.equal(arenaWrestlingMoveTargets(held, release - 1, center, origins, facing).canRelease, false);
    const ready = arenaWrestlingMoveTargets(held, release, center, origins, facing);
    assert.equal(ready.canRelease, true); assert.equal(ready.ankleThrowProgress, 1); assert.equal(ready.victimHeight, 34);
    assert.equal(ready.requiredReleaseAt, release, 'both the contact gate and release reservation use the complete supported load and throw clocks');
  }
});
