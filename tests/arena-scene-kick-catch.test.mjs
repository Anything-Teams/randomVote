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
const rankRead = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
assert.ok(source.includes(rankRead));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'kickCatchTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} kickCatchTestRanks = ranks;`)
  .replace(draw, 'kickCatchTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.surpriseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.surpriseEnd(); });');
source += '\nlet kickCatchTestActors, kickCatchTestRanks; const kickCatchTestScenery = () => {}; export const capturedActors = () => kickCatchTestActors; export const capturedRanks = () => kickCatchTestRanks; export { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaKickCatchTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaKickCatchTargets, capturedActors, capturedRanks } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const order = ['1', '2', '3', '4', '5'];
const duration = 44000, rushRoll = 7;

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
      records.get(currentId).rectangles.push([{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map(point => project(matrix, point)));
    },
    surpriseStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix], rectangles: [] }); },
    surpriseEnd() { currentId = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
function game(seed, reversed = false, mirrored = false, candidateOrder, suppliedOrder = order, frameDelta = 16) {
  const props = { candidates: (candidateOrder ?? (reversed ? [...order].reverse() : order)).map(id => ({ id, name: id, color: '#ffad72' })), order: suppliedOrder, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : frameDelta, false);
    // The rare punch has a deterministic ordinary layout. Reflect its real
    // initialized bodies once to exercise the other physical heading as well.
    if (mirrored && elapsed === 0) {
      for (const body of sim.bodies.values()) {
        body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.motorX = 0; body.animation = undefined;
      }
      for (const contact of sim.contacts.values()) {
        contact.center.x = 1000 - contact.center.x; contact.side *= -1;
        if (contact.round.contactSide) contact.round = { ...contact.round, contactSide: -contact.round.contactSide };
        if (contact.chargerOrigin) contact.chargerOrigin.x = 1000 - contact.chargerOrigin.x;
        if (contact.kickCatchOrigins) {
          for (const point of Object.values(contact.kickCatchOrigins)) if (point && typeof point === 'object' && 'x' in point) point.x = 1000 - point.x;
        }
      }
    }
    return capturedActors();
  } };
}
function snapshot(actor, body) {
  return { x: actor.x, y: actor.y, depthY: actor.depthY, height: actor.depthY - actor.y, heldHeight: body.y - actor.animation.contactPoints.origin.y, angle: actor.angle, facing: actor.facing, pose: actor.pose, contacts: structuredClone(actor.animation.contactPoints) };
}
const points = contacts => [contacts.origin, contacts.head, contacts.waist, ...contacts.hands, ...contacts.feet];
const intersectsViewport = values => Math.max(...values.map(point => point.x)) > 0 && Math.min(...values.map(point => point.x)) < 1000 && Math.max(...values.map(point => point.y)) > 0 && Math.min(...values.map(point => point.y)) < 620;

for (const frameDelta of [16, 50]) for (const mirrored of [false, true]) test(`a rare kick catch makes ankle contact, completes one full turn and preserves the drawn loser (${mirrored ? 'mirrored' : 'ordinary'}, ${frameDelta}ms frames)`, () => {
  const seed = 17, planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.kickCatch);
  assert.ok(planned);
  const scene = game(seed, false, mirrored, ['4', '1', '2', '5', '3'], order, frameDelta);
  let jumped = false, caught = false, spun = false, released = false, resolved = false, maxTurn = 0, priorTurn = 0;
  let caughtAt, priorKicker, releaseSnapshot;
  for (let elapsed = 0; elapsed < 14000; elapsed += frameDelta) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.kickCatchOrigins || !contact.round.kickCatch) continue;
    const actual = contact.round, frame = arenaKickCatchTargets(actual.kickCatch, elapsed, contact.center, contact.kickCatchOrigins, actual.contactSide);
    const catcher = actors.get(actual.aggressor), kicker = actors.get(actual.victim), exit = scene.sim.exits.get(actual.victim);
    const detail = `${elapsed}/${frame.stage}/${mirrored}`;
    assert.ok(points(catcher.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), detail);
    assert.ok(Math.hypot((scene.sim.bodies.get(actual.aggressor).x - 500) / 303, (scene.sim.bodies.get(actual.aggressor).y - 416) / 112) < 1, 'the catcher plants inside the sand');
    if (frame.kickerHeight > 1 && !caught) { assert.equal(kicker.pose, 'sidekick'); jumped = true; }
    if (actual.kickCatch.catchAt === elapsed) {
      caughtAt = elapsed; caught = true;
      const foot = kicker.animation.contactPoints.feet[frame.kickLeg];
      assert.ok(jumped && catcher.animation.contactPoints.hands.every(hand => distance(hand, foot) < 9), `both painted hands catch the actual kicking ankle: ${detail}`);
      assert.equal(exit, undefined, 'catching a foot cannot eject its owner before the turn');
    }
    if (frame.spin && !exit) {
      assert.equal(kicker.spinSuspension.gripLimb, 'feet');
      const foot = kicker.animation.contactPoints.feet[frame.kickLeg], palms = catcher.animation.contactPoints.hands;
      assert.ok(palms.every(hand => distance(hand, foot) < 9), `the held ankle remains in both painted hands: ${detail}`);
      assert.ok(frame.side * (frame.turn - priorTurn) >= -1e-8, 'the one-turn spin never reverses');
      priorTurn = frame.turn; maxTurn = Math.max(maxTurn, Math.abs(frame.turn));
      if (Math.abs(frame.turn) > Math.PI) spun = true;
      priorKicker = structuredClone(kicker.animation.contactPoints);
      assert.equal(capturedRanks()[actual.victim], undefined, 'the held fighter is alive until actual release resolves');
    }
    if (exit && !released) {
      released = true; releaseSnapshot = exit.spinSnapshot;
      assert.ok(caught && spun && elapsed - caughtAt >= 1420, 'real contact is followed by a full load and spin');
      assert.ok(Math.abs(frame.turn) >= 2 * Math.PI - 1e-8 && Math.abs(frame.turn) <= 2 * Math.PI + 1e-8, 'exactly one turn completes at release');
      assert.ok(releaseSnapshot && exit.launchedAt === frame.releaseAt);
      assert.ok(priorKicker && distance(kicker.animation.contactPoints.feet[frame.kickLeg], priorKicker.feet[frame.kickLeg]) < 10, 'the ankle leaves its support continuously');
      assert.ok(!scene.sim.exits.has(actual.aggressor), 'only the original drawn loser exits');
    }
    if (released && elapsed >= actual.resolve) {
      assert.equal(capturedRanks()[actual.victim], order.indexOf(actual.victim) + 1);
      resolved = true; break;
    }
  }
  assert.ok(jumped && caught && spun && released && resolved, JSON.stringify({ jumped, caught, spun, released, resolved, maxTurn }));
});

test('a geometry-ineligible kick catch resumes a complete ordinary deciding bout', () => {
  const scene = game(17), planned = arenaRounds(order, duration, rushRoll, 17).find(round => round.kickCatch);
  scene.step(0);
  assert.equal(scene.sim.contacts.get(planned.id).round.kickCatch, undefined, 'a distant diagonal layout cannot invent foot contact');
  for (let elapsed = 16; elapsed < planned.resolve + 3000; elapsed += 16) scene.step(elapsed);
  assert.equal(capturedRanks()[planned.victim], order.indexOf(planned.victim) + 1);
});

test('a two-fighter final kick catch finishes with the catcher inside and the drawn winner on the podium', () => {
  const finalOrder = ['2', '1'], scene = game(17, false, false, ['1', '2'], finalOrder);
  const planned = arenaRounds(finalOrder, duration, rushRoll, 17).at(-1);
  assert.ok(planned.kickCatch);
  let caught = false, exit;
  for (let elapsed = 0; elapsed <= 12000; elapsed += 16) {
    scene.step(elapsed);
    caught ||= scene.sim.contacts.get(planned.id)?.round.kickCatch?.catchAt != null;
    exit = scene.sim.exits.get(planned.victim);
  }
  assert.ok(caught && exit?.spinSnapshot, 'the final uses an actual ankle catch and supported release');
  assert.deepEqual(capturedRanks(), { '1': 2, '2': 1 });
  assert.ok(!scene.sim.exits.has(planned.aggressor), 'the drawn winner is never ejected');
});
