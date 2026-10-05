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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'leftPickupScenery(ctx, clock,')
  .replace(draw, 'leftPickupActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.leftPickupStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.leftPickupEnd(); });');
source += '\nlet leftPickupActors; const leftPickupScenery = () => {}; export const capturedActors = () => leftPickupActors; export { render, createArenaCamera, arenaRounds, arenaPairRushTargets, resolvedRanks }; ';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaPairRushTargets, resolvedRanks, capturedActors } = module.exports;
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
    leftPickupStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix] }); },
    leftPickupEnd() { currentId = undefined; }, records,
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

for (const reversed of [false, true]) for (const delta of [16, 50]) test(`the left shared carrier keeps both pickup shoulders on their own chest sides (${reversed ? 'mirrored' : 'normal'}/${delta}ms)`, () => {
  const scene = game(reversed, delta);
  let reaches = 0, loaded = 0;
  for (let elapsed = 0; elapsed <= planned.resolve; elapsed += delta) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.pairCarryOrigins?.pickup) continue;
    const frame = arenaPairRushTargets(contact.round, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
    if (!['grip', 'load', 'lift'].includes(frame.stage)) continue;
    const left = frame.pairIds.map(id => actors.get(id)).sort((first, second) => first.x - second.x)[0];
    if (left.pose !== 'pairlift') continue;
    const rig = left.animation.contactPoints, paint = scene.ctx.records.get(left.candidate.id);
    assert.ok(paint?.chest, 'the shared pickup actually paints the supporting torso');
    const detail = `${reversed}/${delta}/${elapsed}/${frame.stage}/${left.candidate.id}/${left.pairReach}`;
    const shoulders = rig.shoulders.map(point => project(paint.sceneMatrix, point));
    const axis = { x: paint.chest[1].x - paint.chest[0].x, y: paint.chest[1].y - paint.chest[0].y };
    const screenScale = Math.hypot(paint.sceneMatrix[0], paint.sceneMatrix[1]) * left.scale;
    const separation = ((shoulders[1].x - shoulders[0].x) * axis.x + (shoulders[1].y - shoulders[0].y) * axis.y) / Math.hypot(axis.x, axis.y);
    // A far shoulder may advance toward the front under load. It must not
    // exchange chest sides with the near shoulder during a facing turn.
    assert.ok(separation > 2 * screenScale, `pickup arm roots keep their anatomical order on the painted chest: ${detail}, separation ${separation / screenScale}`);
    shoulders.forEach((point, arm) => assert.ok(chestDistance(point, paint.chest) <= 2 * screenScale, `a pickup upper arm remains attached to the painted trunk: ${detail}/${arm}, gap ${chestDistance(point, paint.chest) / screenScale}`));
    for (const arm of [0, 1]) {
      assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * left.scale) < .001, `the pickup upper arm keeps its ordinary length: ${detail}/${arm}`);
      assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * left.scale) < .001, `the pickup forearm keeps its ordinary length: ${detail}/${arm}`);
    }
    if (left.pairReach !== undefined && left.pairReach < 1) reaches++;
    if (frame.stage !== 'grip') {
      const victim = actors.get(planned.victim).animation.contactPoints;
      const held = left.gripMode === 'shoulder' ? victim.shoulders : victim.feet;
      held.forEach(point => assert.ok(Math.min(...rig.hands.map(hand => distance(hand, point))) < 4, `the settled left carrier supports both real endpoints: ${detail}`));
      loaded++;
    }
  }
  assert.ok(reaches >= (delta === 16 ? 8 : 3), 'the naturally reached scene includes the complete pickup turn');
  assert.ok(loaded >= (delta === 16 ? 30 : 8), 'the scene continues from pickup through the actual loaded lift');
});
