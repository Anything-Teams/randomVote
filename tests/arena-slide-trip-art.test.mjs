import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts, arenaLinkedHandPoint } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fighter = values => ({ candidate: { id: 'a', name: 'a', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'slide', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, slideProgress: 0, motionImmediate: true, animation: createArenaFighterAnimation(), motionEpoch: 'slide-art', ...values });
function paint(actor, clock) {
  let matrix;
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
  ctx.transform = (...values) => { matrix = values; };
  drawArenaFighter(ctx, actor, clock);
  return { contacts: actor.animation.contactPoints, skeleton: actor.animation.skeleton, matrix };
}

test('a feet-first grounded slide retains full body scale, fixed leg bones and a bent rear knee', () => {
  for (const facing of [-1, 1]) for (let index = 0; index < 10; index++) for (const slideProgress of [0, .25, .5, .75, 1]) {
    const actor = fighter({ index, facing, slideProgress, yaw: 1.2 });
    const { contacts, skeleton, matrix } = paint(actor, 1000);
    assert.ok(Math.abs(Math.hypot(matrix[0], matrix[1]) - actor.scale) < 1e-8);
    assert.ok(Math.abs(Math.hypot(matrix[2], matrix[3]) - actor.scale) < 1e-8, 'the grounded sliding body cannot flatten into an edge-on flight projection');
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(Math.abs(distance(skeleton.hips[leg], skeleton.knees[leg]) - 11) < .001);
      assert.ok(Math.abs(distance(skeleton.knees[leg], skeleton.feet[leg]) - 11) < .001);
    }
    for (let arm = 0; arm < 2; arm++) {
      assert.ok(Math.abs(distance(contacts.shoulders[arm], contacts.elbows[arm]) - 11 * actor.scale) < .001);
      assert.ok(Math.abs(distance(contacts.elbows[arm], contacts.hands[arm]) - 10.5 * actor.scale) < .001);
    }
    if (slideProgress === 1) {
      assert.ok(distance(skeleton.hips[0], skeleton.feet[0]) < 12, 'the back knee remains visibly folded');
      assert.ok(distance(skeleton.hips[1], skeleton.feet[1]) > 19, 'the leading leg reaches forward instead of making a second folded knee');
      assert.ok(Math.abs(contacts.feet[1].y - (actor.y - 2 * actor.scale)) < 1e-8);
    }
  }
});

test('the leading sole reaches the supplied actual ankle and the rise keeps its first planted footprint', () => {
  for (const facing of [-1, 1]) {
    const ankle = { x: 500 + facing * 40.8, y: 411.92 };
    const actor = fighter({ facing, slideProgress: 1, footTarget: ankle, footStrength: 1, kickLeg: 1, motionImmediate: false });
    const first = paint(actor, 1000).contacts;
    assert.ok(distance(first.feet[1], ankle) < .001, 'contact comes from the actual full-length leading shin and sole');
    const feet = structuredClone(first.feet);
    actor.pose = 'recover'; actor.phase = 0; actor.footStrength = 0; actor.footTarget = undefined;
    const next = paint(actor, 1016).contacts;
    next.feet.forEach((point, leg) => assert.ok(distance(point, feet[leg]) < .001, 'the grounded rise cannot restart airborne feet at a different position'));
    for (let frame = 1; frame <= 25; frame++) { actor.phase = frame / 25; paint(actor, 1016 + frame * 16); }
    assert.ok(actor.animation.skeleton.hips.every(hip => hip.y < -15), 'the driver stands upright before preparing the follow-up kick');
    actor.pose = 'trip'; actor.frontKick = .62; actor.kickLeg = 1; actor.footTarget = { x: actor.x + facing * 38, y: 402 }; actor.footStrength = 1;
    const kicked = paint(actor, 1450).contacts;
    assert.ok(distance(kicked.feet[1], actor.footTarget) < .001, 'the subsequent kick reuses the exact contact rig');
  }
});

test('linked allies join only the chosen horizontal arms while free arms and normal running feet keep moving', () => {
  for (const direction of [-1, 1]) {
    const first = fighter({ candidate: { id: 'first', name: 'first', color: '#ffad72' }, x: 444, pose: 'run', slideProgress: undefined, facing: 1, linkedArm: 1, linkedArmStrength: 1, velocityY: direction * 150, motionImmediate: false });
    const second = fighter({ candidate: { id: 'second', name: 'second', color: '#ffad72' }, x: 556, pose: 'run', slideProgress: undefined, facing: -1, linkedArm: 1, linkedArmStrength: 1, velocityY: direction * 150, motionImmediate: false });
    let freeMotion = 0, footLift = 0, previousFree;
    for (let frame = 0; frame <= 60; frame++) {
      const clock = 1000 + frame * 16;
      for (const actor of [first, second]) { actor.y = actor.depthY = 416 + direction * frame * 2.4; actor.gaitDistance = frame * 2.4; }
      const point = arenaLinkedHandPoint(first, second, clock);
      assert.ok(point, 'nearby inner shoulders can establish a real shared palm');
      for (const actor of [first, second]) {
        actor.linkedHandTarget = point;
        const { contacts } = paint(actor, clock);
        assert.ok(distance(contacts.hands[1], point) < .001);
        assert.ok(Math.abs(distance(contacts.shoulders[1], contacts.elbows[1]) - 11 * actor.scale) < .001);
        assert.ok(Math.abs(distance(contacts.elbows[1], contacts.hands[1]) - 10.5 * actor.scale) < .001);
        assert.ok(Math.abs(contacts.hands[1].y - contacts.shoulders[1].y) < 3, 'the joined arm runs perpendicular to the upright chest');
        footLift = Math.max(footLift, ...actor.animation.feet.map(foot => foot.lift));
      }
      const free = first.animation.contactPoints.hands[0];
      if (previousFree) freeMotion += distance({ x: free.x - first.x, y: free.y - first.y }, previousFree);
      previousFree = { x: free.x - first.x, y: free.y - first.y };
    }
    assert.ok(footLift > 1.2 && freeMotion > 10, 'only the linked arm freezes; the free arm and both strides remain active');
    assert.equal(arenaLinkedHandPoint(first, { ...second, x: 720 }, 2000), null, 'farther allies must approach rather than extending their bones');
  }
});
