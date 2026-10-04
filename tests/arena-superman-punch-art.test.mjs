import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fighter = values => ({ candidate: { id: 'a', name: 'a', color: '#ffad72' }, index: 0, x: 500, y: 392, depthY: 416, scale: 2.04, facing: 1, pose: 'superman', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: .5, supermanProgress: .5, motionImmediate: true, animation: createArenaFighterAnimation(), motionEpoch: 'superman-art', ...values });
function paint(actor, clock) {
  let matrix;
  const scales = [], rectangles = [];
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
  ctx.transform = (...values) => { matrix = values; };
  ctx.scale = (...values) => scales.push(values);
  ctx.fillRect = (...values) => rectangles.push(values);
  drawArenaFighter(ctx, actor, clock);
  return { contacts: actor.animation.contactPoints, skeleton: actor.animation.skeleton, matrix, scales, rectangles };
}

const assertBones = (actor, result) => {
  for (let leg = 0; leg < 2; leg++) {
    assert.ok(Math.abs(distance(result.skeleton.hips[leg], result.skeleton.knees[leg]) - 11) < .001, 'each thigh keeps its normal length');
    assert.ok(Math.abs(distance(result.skeleton.knees[leg], result.skeleton.feet[leg]) - 11) < .001, 'each shin keeps its normal length');
  }
  for (let arm = 0; arm < 2; arm++) {
    assert.ok(Math.abs(distance(result.contacts.shoulders[arm], result.contacts.elbows[arm]) - 11 * actor.scale) < .001, 'the punching and guarding upper arms keep their normal length');
    assert.ok(Math.abs(distance(result.contacts.elbows[arm], result.contacts.hands[arm]) - 10.5 * actor.scale) < .001, 'fist contact cannot stretch a forearm');
  }
};

test('a Superman punch meets the actual supplied fist target in both directions without stretching its arm', () => {
  for (const facing of [-1, 1]) for (const punchArm of [0, 1]) {
    const actor = fighter({ facing, punchArm, yaw: 1.1 });
    const shoulders = sampleArenaFighterContacts(actor, 1000).shoulders;
    actor.punchTarget = { x: shoulders[punchArm].x + facing * 38, y: shoulders[punchArm].y - 8 };
    actor.punchStrength = 1;
    const result = paint(actor, 1000);
    assert.ok(distance(result.contacts.hands[punchArm], actor.punchTarget) < .001, 'the painted fist itself lands on the target');
    assertBones(actor, result);
    actor.punchTarget.x += facing * 200;
    const far = paint(actor, 1016);
    assert.ok(distance(far.contacts.shoulders[punchArm], far.contacts.hands[punchArm]) < 21.5 * actor.scale, 'an unreachable target stays beyond the normal arm instead of adding a stretched strike');
    assert.ok(distance(far.contacts.hands[punchArm], actor.punchTarget) > 150);
    assertBones(actor, far);
  }
});

test('the airborne false kick and bent leading knee keep the complete body and shorts at their normal proportions', () => {
  for (const facing of [-1, 1]) for (let index = 0; index < 8; index++) for (const progress of [0, .12, .24, .4, .5, .68, .82, 1]) {
    const actor = fighter({ index, facing, yaw: 1.4, phase: progress, supermanProgress: progress });
    const result = paint(actor, 1000);
    assert.ok(Math.abs(Math.hypot(result.matrix[0], result.matrix[1]) - actor.scale) < 1e-8);
    assert.ok(Math.abs(Math.hypot(result.matrix[2], result.matrix[3]) - actor.scale) < 1e-8);
    assert.ok(result.scales.every(([x, y]) => x === 1 && y === 1), 'jumping cannot compress the torso into a thin side projection');
    assert.ok(result.rectangles.every(rect => rect.every(Number.isFinite)));
    for (const panel of [...result.skeleton.shorts, result.skeleton.pelvis]) assert.ok(panel.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), 'both shorts cuffs remain complete finite polygons');
    assertBones(actor, result);
    if (progress === .5) {
      assert.ok(result.contacts.feet.every(foot => foot.y < actor.depthY - 20), 'both actual soles leave the sand during the punch');
      assert.ok(result.skeleton.feet[0].x < result.skeleton.hips[0].x - 12, 'the rear leg kicks backwards as the fist drives forward');
      assert.ok(result.skeleton.feet[1].y < -3, 'the leading knee stays bent rather than hanging straight below the body');
    }
  }
});

test('the jump inherits the planted load and settles both feet before changing to the landing pose', () => {
  for (const facing of [-1, 1]) {
    const actor = fighter({ facing, y: 416, depthY: 416, pose: 'guard', supermanProgress: undefined, motionImmediate: false });
    paint(actor, 1000);
    actor.chargePreparation = .25;
    for (let frame = 1; frame <= 12; frame++) paint(actor, 1000 + frame * 16);
    const planted = structuredClone(actor.animation.contactPoints);
    actor.pose = 'superman'; actor.supermanProgress = 0; actor.phase = 0; actor.chargePreparation = 0;
    const launch = paint(actor, 1208).contacts;
    assert.ok(distance(planted.waist, launch.waist) < .001, 'launch continues the actual loaded pelvis');
    launch.feet.forEach((foot, leg) => assert.ok(distance(foot, planted.feet[leg]) < .001, 'the jumping frame inherits both planted footprints'));
    let previous = launch;
    for (let frame = 1; frame <= 50; frame++) {
      const progress = frame / 50;
      actor.phase = actor.supermanProgress = progress;
      actor.x = 500 + facing * 56 * (progress * progress * (3 - 2 * progress));
      actor.y = 416 - 24 * Math.sin(progress * Math.PI);
      const current = paint(actor, 1208 + frame * 10).contacts;
      current.feet.forEach((foot, leg) => assert.ok(distance(foot, previous.feet[leg]) < 6, 'the false kick unfolds continuously through flight'));
      previous = current;
    }
    const beforeLanding = structuredClone(previous);
    actor.pose = 'land'; actor.phase = 0; actor.supermanProgress = undefined;
    const landed = paint(actor, 1718).contacts;
    assert.ok(distance(landed.waist, beforeLanding.waist) < 1, 'changing the pose label cannot move the pelvis to a second flight pivot');
    landed.feet.forEach((foot, leg) => assert.ok(distance(foot, beforeLanding.feet[leg]) < 1, 'the floor-aware landing stays within one pixel of the same two returning soles'));
  }
});

test('the short Superman runway enters a complete 180ms two-foot plant without restarting the running rig', () => {
  for (const facing of [-1, 1]) {
    const actor = fighter({ facing, pose: 'run', supermanRun: true, supermanProgress: undefined, phase: 0, y: 416, depthY: 416, velocityX: facing * 180, motionImmediate: false });
    for (let frame = 0; frame <= 30; frame++) {
      actor.x += actor.velocityX * .016; actor.gaitDistance += 180 * .016;
      paint(actor, 1000 + frame * 16);
    }
    const running = structuredClone(actor.animation.contactPoints);
    actor.pose = 'guard'; actor.velocityX = 0; actor.supermanRun = false; actor.supermanLoad = 0;
    const entering = paint(actor, 1480).contacts;
    [entering.head, entering.waist, ...entering.hands, ...entering.feet].forEach((point, index) => assert.ok(distance(point, [running.head, running.waist, ...running.hands, ...running.feet][index]) < .001, 'the preparation starts in the last actual running pose'));
    let prior = entering;
    for (let frame = 1; frame <= 12; frame++) {
      const p = frame / 12; actor.supermanLoad = p * p * (3 - 2 * p);
      const saved = structuredClone(actor.animation), predicted = sampleArenaFighterContacts(actor, 1480 + frame * 15);
      assert.deepEqual(actor.animation, saved);
      const result = paint(actor, 1480 + frame * 15);
      assert.deepEqual(result.contacts, predicted);
      result.contacts.feet.forEach((foot, leg) => assert.ok(distance(foot, prior.feet[leg]) < 4, 'each running foot lowers continuously into the load'));
      for (let leg = 0; leg < 2; leg++) assert.ok(distance(result.skeleton.hips[leg], result.skeleton.knees[leg]) <= 11.001 && distance(result.skeleton.knees[leg], result.skeleton.feet[leg]) <= 11.001, 'the planted loading silhouette cannot lengthen a leg');
      prior = result.contacts;
    }
    assert.ok(actor.animation.feet.every(foot => foot.lift === 0 && !foot.swinging), 'both feet fully plant within the 180ms preparation');
    prior.feet.forEach(foot => assert.ok(Math.abs(foot.y - (actor.y - 2 * actor.scale)) < .001));
    actor.pose = 'superman'; actor.supermanProgress = 0; actor.supermanLoad = undefined;
    const jumping = paint(actor, 1660);
    jumping.contacts.feet.forEach((foot, leg) => assert.ok(distance(foot, prior.feet[leg]) < .001, 'takeoff keeps the exact two loaded soles'));
    assert.ok(distance(jumping.contacts.waist, prior.waist) < .001, 'the loaded pelvis remains continuous at takeoff');
    assertBones(actor, jumping);
  }
});
