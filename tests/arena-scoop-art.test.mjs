import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
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
    for (let clock = 0; clock <= 1100; clock += step) {
      Object.assign(actor, { scoopLoad: smooth(clock / 180), scoopLift: smooth((clock - 180) / 380), scoopTurn: smooth((clock - 560) / 220), scoopDown: smooth((clock - 780) / 320) });
      const frame = paint(actor, clock);
      humanBones(actor, frame);
      assert.equal(actor.animation.airborne, false);
      assert.ok(actor.animation.feet.every(foot => foot.lift === 0), 'the wrestler drives through planted feet');
      assert.ok(frame.rig.motion.crouch <= 5.81, 'accepting weight does not collapse into a seated pose');
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
