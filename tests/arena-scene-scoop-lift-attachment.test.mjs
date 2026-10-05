import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Inspect the production Scene's painted chest as well as the true palm rig.
// Connected upper/lower arm bones alone cannot detect a floating shoulder.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initial = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initial));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'scoopAttachmentScenery(ctx, clock,')
  .replace(draw, 'scoopAttachmentActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.beginActor(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.endActor(); });')
  .replace(initial, `scoopAttachmentInitialize(sim, reset); ${initial}`);
source += '\nlet scoopAttachmentActors; const scoopAttachmentScenery = () => {}; let scoopAttachmentInitialize = () => {}; export const setInitialize = fn => { scoopAttachmentInitialize = fn; }; export const capturedActors = () => scoopAttachmentActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize, arenaWrestlingMoveTargets } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (m, p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
const inverse = m => {
  const d = m[0] * m[3] - m[1] * m[2];
  assert.ok(Math.abs(d) > 1e-6);
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
};
const paintedChestDistance = (p, polygon) => {
  const gap = Math.min(...polygon.map((a, i) => segmentDistance(p, a, polygon[(i + 1) % polygon.length])));
  if (gap < 1e-6) return 0;
  let inside = false;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  });
  return inside ? 0 : gap;
};

function context() {
  let matrix = identity(), stack = [], actor, path = [];
  const records = new Map();
  const target = {
    globalAlpha: 1, records, measureText: text => ({ width: String(text).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const last = stack.pop(); if (last) { matrix = last.matrix; target.globalAlpha = last.alpha; } },
    transform(...m) { matrix = multiply(matrix, m); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(a) { matrix = multiply(matrix, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    setTransform(...m) { matrix = [...m]; },
    beginActor(value) { actor = value; records.set(actor.candidate.id, { scene: [...matrix], chests: [], polygons: [] }); },
    endActor() { actor = undefined; },
    beginPath() { path = []; },
    moveTo(x, y) { path.push(project(matrix, { x, y })); },
    lineTo(x, y) { path.push(project(matrix, { x, y })); },
    fill() {
      if (!actor || path.length < 3 || target.globalAlpha <= 0) return;
      const record = records.get(actor.candidate.id), toWorld = inverse(record.scene);
      record.polygons.push({ color: target.fillStyle, points: path.map(p => project(toWorld, p)) });
    },
    fillRect(x, y, width, height) {
      if (!actor || width !== 18 + actor.index % 3 || height < 23 || target.globalAlpha <= 0) return;
      const record = records.get(actor.candidate.id), toWorld = inverse(record.scene);
      record.chestColor = target.fillStyle;
      record.chests.push([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }].map(p => project(toWorld, project(matrix, p))));
    },
  };
  return new Proxy(target, { get: (o, k) => k in o ? o[k] : noop, set: (o, k, v) => (o[k] = v, true) });
}

for (const mirrored of [false, true]) for (const step of [16, 50]) test(`received scoop ${mirrored ? 'left' : 'right'}/${step}ms: both lifted shoulders stay joined to the painted chest`, () => {
  const order = ['2', '1'], duration = 44000, seed = 40;
  const planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, 'scoopslam');
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset || !mirrored) return;
    for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
  });
  let lifted = 0, top = 0, worst;
  for (let clock = 0; clock < 5000; clock += step) {
    render(ctx, props, clock, clock, sim, step, false);
    const contact = sim.contacts.get(planned.id), window = contact?.round?.wrestlingMove;
    if (window?.contactAt == null) continue;
    const frame = arenaWrestlingMoveTargets(window, clock, contact.center, contact.wrestlingMoveOrigins, contact.round.contactSide);
    if (frame.scoopDown > 0) break;
    if (frame.scoopLift <= .05 || frame.gripStrength <= .95) continue;
    const driver = capturedActors().get(planned.aggressor), victim = capturedActors().get(planned.victim);
    const rig = driver.animation.contactPoints, body = victim.animation.contactPoints, record = ctx.records.get(driver.candidate.id);
    assert.equal(record.chests.length, 1, 'inspect the actual complete painted torso');
    const joinedSkin = record.polygons.filter(polygon => polygon.color === record.chestColor && polygon.points.some(p => paintedChestDistance(p, record.chests[0]) < .001));
    const chestSurfaces = [...record.chests, ...joinedSkin.map(polygon => polygon.points)];
    const thigh = { x: body.waist.x + ((body.feet[0].x + body.feet[1].x) / 2 - body.waist.x) * .28, y: body.waist.y + ((body.feet[0].y + body.feet[1].y) / 2 - body.waist.y) * .28 };
    for (let arm = 0; arm < 2; arm++) {
      const shoulder = rig.shoulders[arm], elbow = rig.elbows[arm], palm = rig.hands[arm];
      assert.ok(Math.abs(distance(shoulder, elbow) - 11 * driver.scale) < .001 && Math.abs(distance(elbow, palm) - 10.5 * driver.scale) < .001, 'the lift keeps both complete arm bones');
      assert.ok(distance(palm, arm ? thigh : body.back) < 8, `the actual palms continue supporting the received back and thigh: ${JSON.stringify({ mirrored, step, clock, arm, gap: distance(palm, arm ? thigh : body.back), scoopLift: frame.scoopLift })}`);
      const gap = Math.min(...chestSurfaces.map(polygon => paintedChestDistance(shoulder, polygon))), allowed = 2.8 * driver.scale + .05;
      if (!worst || gap - allowed > worst.gap - worst.allowed) worst = { clock, arm, gap, allowed, shoulder, chest: chestSurfaces, scoopLift: frame.scoopLift };
    }
    lifted++; if (frame.scoopLift > .85) top++;
  }
  assert.ok(lifted > 8 && top > 2, 'exercise the actual received body through the complete overhead lift');
  assert.ok(worst.gap <= worst.allowed, `a lifting shoulder square must overlap the painted chest instead of floating above it: ${JSON.stringify({ mirrored, step, ...worst })}`);
});
