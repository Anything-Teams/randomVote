import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { drawArenaFighter, createArenaFighterAnimation } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const turn = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function crossings(polygon) {
  const pairs = [];
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    polygon.forEach((c, j) => {
      if (j <= i + 1 || i === 0 && j === polygon.length - 1) return;
      const d = polygon[(j + 1) % polygon.length];
      if (turn(a, b, c) * turn(a, b, d) < -1e-8 && turn(c, d, a) * turn(c, d, b) < -1e-8) pairs.push([i, j]);
    });
  });
  return pairs;
}
function inside(point, polygon) {
  let found = false;
  polygon.forEach((b, i) => {
    const a = polygon[(i + polygon.length - 1) % polygon.length];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) found = !found;
  });
  return found;
}
function actor(values) {
  return { candidate: { id: 'drag', name: '선수', color: '#4bb68c' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'drag', gripMode: 'ankle', angle: 0, alpha: 1, phase: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, animation: createArenaFighterAnimation(), ...values };
}
function paint(body, clock) {
  let path = []; const fills = [];
  const ctx = new Proxy({ globalAlpha: 1, beginPath() { path = []; }, moveTo(x, y) { path.push({ x, y }); }, lineTo(x, y) { path.push({ x, y }); }, fill() { fills.push({ points: structuredClone(path), color: ctx.fillStyle }); } }, { get: (target, key) => key in target ? target[key] : () => {}, set: (target, key, value) => (target[key] = value, true) });
  drawArenaFighter(ctx, body, clock);
  return fills;
}

test('the actual dragger paints a continuous pelvic panel without crossed belt edges or triangular gaps', () => {
  for (let index = 0; index < 10; index++) for (const facing of [-1, 1]) for (const velocityY of [-105, 0, 105]) {
    const body = actor({ index, facing, velocityX: -facing * 60, velocityY });
    for (let clock = 0; clock <= 960; clock += 16) {
      if (clock) { body.x += body.velocityX * .016; body.y += velocityY * .016; body.depthY = body.y; body.gaitDistance += Math.hypot(body.velocityX, velocityY) * .016; }
      const fills = paint(body, clock), rig = body.animation.skeleton;
      assert.ok(body.animation.motion.lean > 45, 'the check exercises the deep ankle-reaching bend that used to cross the belt');
      assert.deepEqual(crossings(rig.pelvis), [], `${index}/${facing}/${velocityY}/${clock}: the connected fabric cannot fold its own edges through each other`);
      const rounded = rig.pelvis.map(point => ({ x: Math.round(point.x), y: Math.round(point.y) }));
      assert.ok(fills.some(fill => fill.color === body.candidate.color && JSON.stringify(fill.points) === JSON.stringify(rounded)), 'the noncrossing panel is the real Canvas polygon, not only diagnostic skeleton data');
      assert.deepEqual(crossings(rounded), [], 'pixel rounding must not recreate a bow-tie polygon');
      rig.hips.forEach((hip, leg) => {
        assert.ok(inside(hip, rig.shorts[leg]));
        assert.ok(inside({ x: hip.x, y: hip.y + .5 }, rig.pelvis), 'the pelvic panel overlaps both cuff seams at the actual thigh roots');
        assert.ok(distance(hip, rig.knees[leg]) <= 11.01 && distance(rig.knees[leg], rig.feet[leg]) <= 11.01, 'repairing the fabric cannot stretch either leg bone');
      });
    }
  }
});

test('pulling an unconscious floor body translates intact shorts while preserving both normal leg sections', () => {
  for (let index = 0; index < 10; index++) for (const facing of [-1, 1]) for (const slammed of [false, true]) {
    const body = actor({ index, facing, pose: 'stunned', angle: facing * Math.PI * .47, slamProgress: slammed ? { tuck: 0, slump: 1 } : undefined });
    let initial;
    for (let clock = 0; clock <= 640; clock += 16) {
      body.x += -facing * 105 * .016; paint(body, clock);
      const rig = body.animation.skeleton;
      initial ??= structuredClone(rig);
      assert.deepEqual(rig.shorts, initial.shorts); assert.deepEqual(rig.pelvis, initial.pelvis, 'an unconscious body has no moving fabric seam while being dragged');
      assert.deepEqual(crossings(rig.pelvis), []);
      for (let leg = 0; leg < 2; leg++) {
        const thigh = distance(rig.hips[leg], rig.knees[leg]), shin = distance(rig.knees[leg], rig.feet[leg]);
        assert.ok(thigh <= 11.01 && shin <= 11.01 && thigh > 8 && shin > 8, 'the existing floor perspective retains two complete unextended leg sections');
        if (!slammed) { assert.ok(Math.abs(thigh - 11) < .001); assert.ok(Math.abs(shin - 11) < .001); }
      }
    }
  }
});
