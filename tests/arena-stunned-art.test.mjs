import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'victim', name: '맞은 선수', color: '#ffad72' }, index: 0, x: 520, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'stunned', angle: Math.PI * .47, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 1, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
function paint(actor, clock) {
  const rectangles = [];
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(method => [method, () => {}]));
  ctx.fillRect = (x, y, width, height) => rectangles.push({ x, y, width, height, color: ctx.fillStyle });
  drawArenaFighter(ctx, actor, clock);
  return rectangles;
}
const eyes = rectangles => rectangles.filter(rect => rect.color === '#172b37' && rect.y === -1 && rect.width === 1.8 && (rect.x === -3.5 || rect.x === 3));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('the stunned face paints two closed eyes immediately after a lifting pose and keeps them closed on the floor', () => {
  for (let index = 0; index < 10; index++) for (const facing of [-1, 1]) {
    const actor = fighter({ index, facing, pose: 'lift', angle: 0, motionImmediate: false });
    paint(actor, 1000);
    actor.pose = 'stunned';
    const firstHit = eyes(paint(actor, 1016));
    assert.equal(firstHit.length, 2); assert.ok(firstHit.every(eye => eye.height === .7), 'closed eyes are actual painted rectangles on the first hit frame');
    actor.angle = facing * Math.PI * .47;
    for (let clock = 1032; clock <= 1512; clock += 16) assert.ok(eyes(paint(actor, clock)).every(eye => eye.height === .7));
    assert.ok(Math.abs(actor.animation.motion.head) < .001 && Math.abs(actor.animation.motion.hipX) < .001, 'the unconscious head and pelvis settle instead of breathing or scanning');
    assert.ok(Math.abs(actor.animation.motion.mouth - .7) < .001, 'the mouth settles into the small slack shape');
  }
  const awake = eyes(paint(fighter({ pose: 'guard', angle: 0 }), 0));
  assert.ok(awake.every(eye => eye.height > 1), 'an awake fighter retains its ordinary open-eyed face');
});

test('the limp floor rig remains stationary and retains its connected full-length limbs', () => {
  for (let index = 0; index < 10; index++) for (const facing of [-1, 1]) {
    const actor = fighter({ index, facing, angle: facing * Math.PI * .47 });
    paint(actor, 1000);
    const reference = actor.animation.contactPoints;
    for (const clock of [1800, 2600, 3400]) {
      paint(actor, clock);
      const actual = actor.animation.contactPoints;
      for (const point of ['head', 'waist']) assert.ok(distance(reference[point], actual[point]) < 1e-8);
      for (const limb of ['hands', 'feet']) for (let end = 0; end < 2; end++) assert.ok(distance(reference[limb][end], actual[limb][end]) < 1e-8);
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(actual.shoulders[arm], actual.elbows[arm]) - 11 * actor.scale) < .001);
        assert.ok(Math.abs(distance(actual.elbows[arm], actual.hands[arm]) - 10.5 * actor.scale) < .001);
      }
      const { hips, knees, feet } = actor.animation.skeleton;
      for (let leg = 0; leg < 2; leg++) {
        assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001);
        assert.ok(Math.abs(distance(knees[leg], feet[leg]) - 11) < .001);
      }
    }
  }
});
