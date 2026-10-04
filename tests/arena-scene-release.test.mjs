import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw), 'capture the actual scene frame loop');
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'releaseTestScenery(ctx, clock,').replace(draw, `releaseTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.releaseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.releaseEnd(); });`);
source += '\nlet releaseTestActors; const releaseTestScenery = () => {}; export const capturedActors = () => releaseTestActors; export { render, createArenaCamera, arenaRounds, arenaEscapeTargets, arenaRecoveryTargets }; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaEscapeTargets, arenaRecoveryTargets, arenaMinimumDuration, capturedActors } = module.exports;
const noop = () => {};
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
function inverse(matrix) {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  return [matrix[3] / determinant, -matrix[1] / determinant, -matrix[2] / determinant, matrix[0] / determinant, (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant, (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant];
}
function context() {
  let matrix = [1, 0, 0, 1, 0, 0], actor, sceneInverse;
  const stack = [], torsos = new Map();
  const target = {
    measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), torsos,
    save() { stack.push([...matrix]); }, restore() { matrix = stack.pop() ?? matrix; },
    transform(...next) { matrix = multiply(matrix, next); }, setTransform(...next) { matrix = [...next]; },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); }, scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    releaseStart(current) { actor = current; sceneInverse = inverse(matrix); }, releaseEnd() { actor = undefined; },
    fillRect(x, y, width, height) {
      if (!actor || y !== -23 || height !== 23 || x !== -width / 2) return;
      torsos.set(actor.candidate.id, [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }].map(point => project(sceneInverse, project(matrix, point))));
    },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function torsoGap(point, polygon) {
  let positive = false, negative = false, nearest = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y;
    const cross = dx * (point.y - a.y) - dy * (point.x - a.x);
    positive ||= cross > 1e-8; negative ||= cross < -1e-8;
    const along = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    nearest = Math.min(nearest, distance(point, { x: a.x + dx * along, y: a.y + dy * along }));
  }
  return positive && negative ? nearest : 0;
}
function fixture(predicate) {
  for (let seed = 0; seed < 80; seed++) for (let variant = 0; variant < 12; variant++) {
    const order = Array.from({ length: 5 }, (_, i) => `release-${variant}-${i}`), duration = Math.max(44000, arenaMinimumDuration(order, 7, seed)), rounds = arenaRounds(order, duration, 7, seed);
    const round = rounds.find(predicate);
    if (round) return { order, seed, duration, round };
  }
  assert.fail('the optional scene must remain available');
}
function game(found) {
  const props = { candidates: found.order.map(id => ({ id, name: id, color: '#ffad72' })), order: found.order, duration: found.duration, arenaRushRoll: 7, arenaEscapeSeed: found.seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  assert.ok(arenaRounds(props.order, props.duration, 7, found.seed).every(round => round.timeScale >= 1));
  return { sim, ctx, step(elapsed) { ctx.torsos.clear(); render(ctx, props, elapsed, elapsed, sim, 16, false); return capturedActors(); } };
}

test('a live successful escape keeps running after its announcement and the pursuer stops forward through the free interval without a root jump', () => {
  const found = fixture(round => round.escape?.outcome === 'separate'), scene = game(found), round = found.round;
  const announcementAt = round.escape.start + 2840 * round.timeScale, releasedUntil = round.escape.releasedUntil;
  let previous, announcement, end, releasedFrames = 0;
  for (let elapsed = 0; elapsed < releasedUntil; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(round.id);
    if (!contact || elapsed < announcementAt) continue;
    const frame = arenaEscapeTargets(contact.round, elapsed, contact.center), current = {};
    for (const [role, id] of [['runner', frame.runnerId], ['chaser', frame.chaserId]]) {
      const body = scene.sim.bodies.get(id), actor = actors.get(id);
      current[role] = { x: body.x, y: body.y, facing: actor.facing };
      assert.equal(actor.facing, frame[`${role}Facing`], 'the successful release cannot instantly face the previous opponent again');
      if (previous) {
        assert.ok(distance(current[role], previous[role]) <= 2.65, `${role}: the free interval cannot snap a lagging live body to a pure model endpoint (${found.seed}/${round.id}/${elapsed}, step ${distance(current[role], previous[role]).toFixed(2)}px)`);
        assert.ok(frame[`${role}Facing`] * (current[role].x - previous[role].x) >= -.05, `${role}: the successful escape keeps its forward direction`);
      }
    }
    announcement ??= structuredClone(current);
    if (elapsed >= round.escape.end) { releasedFrames++; if (end) assert.ok(distance(current.chaser, end.chaser) < 1e-8, 'the pursuer stops at its forward position rather than walking back'); else end = structuredClone(current); }
    previous = current;
  }
  assert.ok(releasedFrames > 10, 'the release has a visible free interval');
  assert.ok(distance(previous.runner, announcement.runner) > 15, 'the runner visibly continues fleeing after the success announcement');
});

test('a live recovery keeps the ordinary hold and full lift timing before one airborne survival and a grounded landing', () => {
  const found = fixture(round => round.recovery && !round.recovery.kind), scene = game(found), round = found.round, recovery = round.recovery;
  let held = false, lifted = false, flew = false, landed = false, peak = 0, lastBody, releaseSeen = false;
  for (let elapsed = 0; elapsed < recovery.end; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(round.id);
    if (!contact || elapsed < recovery.start) continue;
    const actual = contact.round, frame = arenaRecoveryTargets(actual, elapsed, contact.center), actor = actors.get(round.victim), thrower = actors.get(round.recovery.throwerId ?? round.aggressor), body = scene.sim.bodies.get(round.victim);
    const height = (actor.depthY ?? body.y) - actor.y;
    assert.equal(scene.sim.exits.has(round.victim), false, 'a surviving throw cannot create an eliminated actor');
    assert.equal(scene.sim.exits.has(round.aggressor), false);
    // A late motor approach can establish its grounded grip after the normal
    // lift pose starts. Require the painted palms to reach both grip targets
    // and the victim's painted torso before counting this as a real hold.
    if (elapsed < recovery.throwAt && ['grapple', 'lift'].includes(thrower.pose) && (thrower.gripStrength ?? 0) > .95 && height < .01) {
      const hands = thrower.animation.contactPoints.hands, targets = [thrower.secondaryGripTarget, thrower.gripTarget], torso = scene.ctx.torsos.get(round.victim);
      assert.ok(torso, 'capture the victim torso from the actual paint calls');
      if (targets.every((target, arm) => target && distance(hands[arm], target) < 7 && torsoGap(hands[arm], torso) < 7)) held = true;
    }
    if (elapsed < recovery.throwAt && height > 25) { lifted = true; assert.ok(held, 'the actual normal grip precedes the full painted lift'); }
    if (elapsed < recovery.throwAt) assert.equal(frame.airborne, false, 'the release cannot happen before the full normal throw span');
    if (frame.airborne) {
      flew = true; assert.ok(elapsed >= recovery.throwAt); assert.equal(actor.pose, 'airborne');
      assert.ok(Number.isFinite(height) && height >= 0); assert.ok(Math.abs(actor.angle - frame.angle) < 1e-8); peak = Math.max(peak, height);
    }
    if (frame.stage === 'land') { landed = true; assert.equal(actor.pose, 'land'); assert.ok(height < .01); assert.ok(Math.abs(Math.abs(actor.angle) - Math.PI * 2) < 1e-8, 'one full rotation is complete before the planted landing'); }
    if (frame.stage === 'release') releaseSeen = true;
    if (lastBody && elapsed >= recovery.throwAt && elapsed <= recovery.throwAt + 48 * round.timeScale) assert.ok(distance(body, lastBody) < 2.65, 'release starts at the actual held body instead of resetting it to an old origin');
    lastBody = { x: body.x, y: body.y };
  }
  assert.ok(held && lifted && flew && landed && releaseSeen, `the normal hold, lift, throw, somersault and landing all remain visible (${found.seed}/${round.id})`);
  assert.ok(peak > 170 && peak < 190, 'the survivor completes its rotation around a readable high apex');
});
