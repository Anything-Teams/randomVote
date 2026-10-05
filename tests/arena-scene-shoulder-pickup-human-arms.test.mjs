import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual Scene and painted rig; only the static scenery is skipped.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'shoulderPickupScenery(ctx, clock,')
  .replace(draw, 'shoulderPickupActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.shoulderPickupStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.shoulderPickupEnd(); });');
source += '\nlet shoulderPickupActors; const shoulderPickupScenery = () => {}; export const capturedActors = () => shoulderPickupActors; export { render, createArenaCamera, arenaRounds, arenaPairRushTargets }; ';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaPairRushTargets, capturedActors } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const order = ['1', '2', '3', '4', '5'];
const duration = 44000, seed = 1, rushRoll = 7;
const planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.rushOutcome === 'counter-throw');
assert.ok(planned, 'the requested numeric five-person fixture contains a shared throw');

function context() {
  let matrix = identity(), stack = [], currentId;
  const records = new Map();
  const target = {
    globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; target.globalAlpha = saved.alpha; } },
    transform(...next) { matrix = multiply(matrix, next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    fillRect(x, y, width, height) {
      if (!currentId || target.globalAlpha <= 0) return;
      // Identify the actual painted trunk, rather than assuming an actor root
      // or hand target describes where an upper arm should attach.
      if (y === -23 && height === 23 && width >= 18 && width <= 20) records.get(currentId).chest = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }].map(point => project(matrix, point));
    },
    shoulderPickupStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix] }); },
    shoulderPickupEnd() { currentId = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
function game(reversed = false, delta = 16, overrides = {}) {
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false, ...overrides };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : delta, false);
    if (reversed && !paused && elapsed >= planned.start - 2400 && elapsed < planned.start - 2400 + delta) {
      // Initialize the opposite field layout before this encounter's preparation
      // begins. Reserve its two wrestlers from incidental minis while they walk
      // into their real grips; no attached root is overridden later in the scene.
      const first = sim.bodies.get(planned.aggressor), second = sim.bodies.get(planned.helper);
      const firstOrigin = { x: first.x, y: first.y };
      first.x = second.x; first.y = second.y;
      second.x = firstOrigin.x; second.y = firstOrigin.y;
      for (const body of [first, second]) {
        body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0;
        body.animation = undefined; body.roam = undefined; body.restUntil = planned.start;
      }
      sim.minis.clear();
      for (const key of sim.contacts.keys()) if (key.startsWith('mini-')) sim.contacts.delete(key);
    }
    return capturedActors();
  } };
}

function edgeDistance(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const along = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return distance(point, { x: start.x + dx * along, y: start.y + dy * along });
}
function chestDistance(point, chest) {
  const signs = chest.map((start, edge) => {
    const end = chest[(edge + 1) % chest.length];
    return Math.sign((end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x));
  });
  if (signs.every(sign => sign >= 0) || signs.every(sign => sign <= 0)) return 0;
  return Math.min(...chest.map((start, edge) => edgeDistance(point, start, chest[(edge + 1) % chest.length])));
}

function armCross(firstStart, firstEnd, secondStart, secondEnd) {
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const second = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const between = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
  const determinant = cross(first, second);
  if (Math.abs(determinant) < 1e-8) return false;
  const alongFirst = cross(between, second) / determinant, alongSecond = cross(between, first) / determinant;
  return alongFirst > .001 && alongFirst < .999 && alongSecond > .001 && alongSecond < .999;
}

for (const reversed of [false, true]) for (const delta of [16, 50]) test(`the shoulder carrier receives a floor pickup underneath the weight (${reversed ? 'mirrored' : 'normal'}/${delta}ms)`, () => {
  const scene = game(reversed, delta);
  let lowPalms = 0, loaded = 0, lifted = 0, previous;
  for (let elapsed = 0; elapsed <= planned.resolve; elapsed += delta) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.pairCarryOrigins?.pickup || contact.round.pairPickupAt === null) continue;
    const frame = arenaPairRushTargets(contact.round, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
    if (!['load', 'lift', 'overhead'].includes(frame.stage)) continue;
    const holder = actors.get(frame.armsHolderId), victim = actors.get(planned.victim);
    assert.equal(holder.pose, 'pairlift'); assert.equal(holder.gripMode, 'shoulder');
    const rig = holder.animation.contactPoints, support = victim.animation.contactPoints.shoulders;
    const detail = `${reversed}/${delta}/${elapsed}/${frame.stage}/${holder.candidate.id}`;
    const paint = scene.ctx.records.get(holder.candidate.id);
    assert.ok(paint?.chest, 'the actual supporting trunk is painted');
    const screenScale = Math.hypot(paint.sceneMatrix[0], paint.sceneMatrix[1]) * holder.scale;
    for (const arm of [0, 1]) {
      const shoulder = rig.shoulders[arm], elbow = rig.elbows[arm], palm = rig.hands[arm];
      assert.ok(Math.abs(distance(shoulder, elbow) - 11 * holder.scale) < .001, `receiving the shoulder weight cannot stretch an upper arm: ${detail}/${arm}`);
      assert.ok(Math.abs(distance(elbow, palm) - 10.5 * holder.scale) < .001, `the supporting forearm keeps its adult bone: ${detail}/${arm}`);
      assert.ok(chestDistance(project(paint.sceneMatrix, shoulder), paint.chest) <= 2 * screenScale, `each support arm stays attached to the actual torso: ${detail}/${arm}`);
      // A low shoulder grip needs an elbow under its own shoulder, receiving
      // the horizontal body. Raising the elbow over the neckline reverses it.
      if (palm.y > shoulder.y + holder.scale) {
        assert.ok(elbow.y >= shoulder.y - .25 * holder.scale, `the floor-facing palm is supported by a lowered elbow: ${detail}/${arm}, elbow ${(elbow.y - shoulder.y) / holder.scale}`);
        lowPalms++;
      }
      assert.equal(armCross(shoulder, elbow, rig.elbows[1 - arm], rig.hands[1 - arm]), false, `one support forearm cannot cut through the opposite upper arm: ${detail}/${arm}`);
    }
    support.forEach(point => assert.ok(Math.min(...rig.hands.map(hand => distance(hand, point))) < 4, `both real palms support the victim shoulders throughout the lift: ${detail}`));
    if (previous) {
      const shift = { x: rig.origin.x - previous.origin.x, y: rig.origin.y - previous.origin.y };
      for (const key of ['shoulders', 'elbows', 'hands']) rig[key].forEach((point, arm) => assert.ok(distance(point, { x: previous[key][arm].x + shift.x, y: previous[key][arm].y + shift.y }) < (delta === 16 ? 19 : 49), `the receiving grip flows continuously into the supported chest lift: ${detail}/${key}/${arm}`));
    }
    previous = structuredClone(rig);
    if (frame.stage === 'load') loaded++;
    if (frame.stage === 'lift') lifted++;
  }
  assert.ok(loaded >= (delta === 16 ? 12 : 4), 'the actual scene completes floor pickup and loads the weight');
  assert.ok(lifted >= (delta === 16 ? 20 : 6), 'both real grips lift the same horizontal body');
  assert.ok(lowPalms >= (delta === 16 ? 40 : 12), 'the low grips exercise both underhand support arms before the held body rises');
});
