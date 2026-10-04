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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'jointTestScenery(ctx, clock,')
  .replace(draw, 'jointTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.jointStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.jointEnd(); });');
source += '\nlet jointTestActors; const jointTestScenery = () => {}; export const capturedActors = () => jointTestActors; export { render, createArenaCamera, arenaRounds, arenaPairRushTargets, resolvedRanks }; export { ARENA_PAIR_COUNTER_TIMING } from "./arenaPairRush";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaPairRushTargets, resolvedRanks, capturedActors, ARENA_PAIR_COUNTER_TIMING } = module.exports;
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
      records.get(currentId).rectangles.push([{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map(point => project(matrix, point)));
    },
    jointStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix], rectangles: [] }); },
    jointEnd() { currentId = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
function game(reversed = false) {
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : 16, false);
    if (reversed && !paused && elapsed === planned.start - 2400) {
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
function snapshot(actor, body) {
  return { x: actor.x, y: actor.y, depthY: actor.depthY, height: actor.depthY - actor.y, heldHeight: body.y - actor.animation.contactPoints.origin.y, angle: actor.angle, facing: actor.facing, pose: actor.pose, contacts: structuredClone(actor.animation.contactPoints) };
}
const points = contacts => [contacts.origin, contacts.head, contacts.waist, ...contacts.hands, ...contacts.feet];
const intersectsViewport = values => Math.max(...values.map(point => point.x)) > 0 && Math.min(...values.map(point => point.x)) < 1000 && Math.max(...values.map(point => point.y)) > 0 && Math.min(...values.map(point => point.y)) < 620;
const observedSides = new Set();

for (const reversed of [false, true]) test(`the live overhead joint throw inherits its held rig, rises once and lands outside (${reversed ? 'reversed' : 'normal'} starting layout)`, () => {
  const scene = game(reversed);
  let previous, released = false, rising = false, falling = false, landed = false, peak = 0, lastHeight, lastClock, actualRound;
  for (let elapsed = 0; elapsed <= planned.resolve + 700 * planned.timeScale; elapsed += 16) {
    const actors = scene.step(elapsed), actor = actors.get(planned.victim), exit = scene.sim.exits.get(planned.victim), contact = scene.sim.contacts.get(planned.id);
    if (!actor || !contact || elapsed < planned.start) continue;
    actualRound = contact.round;
    const now = snapshot(actor, scene.sim.bodies.get(planned.victim)), detail = () => JSON.stringify({ reversed, elapsed, planned, actual: actualRound, exit: exit && { origin: exit.origin, lift: exit.lift, angle: exit.angle, landing: exit.landing, side: exit.side }, previous, now });
    assert.ok(points(now.contacts).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `the whole painted rig stays finite: ${detail()}`);
    if (exit && exit.round.id === planned.id) {
      observedSides.add(exit.side);
      if (!released) {
        assert.ok(previous?.pose === 'carried' && Math.abs(previous.heldHeight - 142) < .01, `the last frame actually holds the victim above the carriers: ${detail()}`);
        assert.ok(Math.abs(exit.lift - 142) < .01, `release cannot replace the painted overhead height with zero: ${detail()}`);
        assert.ok(distance(previous.contacts.origin, { x: exit.origin.x, y: exit.origin.y - exit.lift }) < .01, `the exit starts at the last painted horizontal root: ${detail()}`);
        const delta = { x: now.contacts.origin.x - previous.contacts.origin.x, y: now.contacts.origin.y - previous.contacts.origin.y };
        assert.ok(Math.hypot(delta.x, delta.y) < 14, `one 16ms release step cannot teleport the root: ${detail()}`);
        points(now.contacts).forEach((point, index) => assert.ok(distance(point, { x: points(previous.contacts)[index].x + delta.x, y: points(previous.contacts)[index].y + delta.y }) < .01, `head/hands/feet keep the exact released shape: ${detail()}`));
        assert.ok(Math.abs(now.angle - previous.angle) < 1e-8);
        released = true;
      }
      const age = elapsed - (exit.launchedAt ?? exit.round.impact);
      if (age < 880 * actualRound.timeScale) {
        assert.equal(now.pose, 'carried'); assert.ok(Math.abs(now.angle - exit.angle) < 1e-8);
        assert.ok(Math.abs(now.height - (exit.lift + 220 * (age / (880 * actualRound.timeScale)) - (exit.lift + 220) * (age / (880 * actualRound.timeScale)) ** 2)) < .001, 'the actual Scene uses the preserved height on one constant-gravity arc');
        if (lastClock !== undefined && lastHeight !== undefined) {
          if (now.height > lastHeight + .01) { assert.equal(falling, false, 'the released victim cannot bounce upward again'); rising = true; }
          if (now.height < lastHeight - .01) falling = true;
        }
        peak = Math.max(peak, now.height); lastHeight = now.height; lastClock = elapsed;
        const record = scene.ctx.records.get(planned.victim);
        assert.ok(record?.rectangles.some(intersectsViewport), 'the real airborne fighter stays visible in the camera viewport');
      } else if (age < 1100 * actualRound.timeScale) {
        assert.equal(now.height, 0); assert.ok(distance({ x: now.x, y: now.depthY }, exit.landing) < .001);
        assert.ok(Math.hypot((exit.landing.x - 500) / 303, (exit.landing.y - 416) / 112) > 1, 'the throw lands outside the sand');
        landed = true;
      }
    }
    previous = now;
  }
  assert.ok(released && rising && falling && landed, `the actual scene must include the full shared throw (${reversed})`);
  assert.ok(peak > 172 && peak < 182, `the raised body has one readable, bounded apex (${peak})`);
});

test('the two live shared-throw layouts cover both directions', () => {
  assert.deepEqual([...observedSides].sort(), [-1, 1]);
});

for (const reversed of [false, true]) test(`the live pair counter stops at the near contact and completes at ordinary action speed (${reversed ? 'reversed' : 'normal'})`, () => {
  const scene = game(reversed);
  let previous, contacted = false, held = false, released = false, resolved = false;
  for (let elapsed = 0; elapsed <= planned.resolve + 32; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.chargerOrigin || contact.round.rushLaunchAt == null) continue;
    const actual = contact.round, frame = arenaPairRushTargets(actual, elapsed, contact.center, contact.chargerOrigin);
    const victim = actors.get(planned.victim);
    const detail = `${reversed}/${elapsed}/${frame.stage}`;
    assert.ok(Math.abs(actual.impact - frame.contactAt - ARENA_PAIR_COUNTER_TIMING.release) < .001, `the actual scene cannot stretch the counter to fill the planned round: ${detail}`);
    if (elapsed >= frame.contactAt && elapsed < actual.impact) {
      contacted = true;
      const displacement = { x: scene.sim.bodies.get(planned.victim).x - frame.contactPoint.x, y: scene.sim.bodies.get(planned.victim).y - frame.contactPoint.y };
      if (frame.stage === 'rebound' || frame.stage === 'groggy') assert.ok(displacement.x * frame.chargeDirection.x + displacement.y * frame.chargeDirection.y <= .001, `the runner rebounds on the entry side instead of passing through both opponents: ${detail}`);
      assert.equal(victim.facing, frame.chargerFacing, `collision and falling cannot mirror the whole body in one frame: ${detail}`);
      if (previous && elapsed < frame.contactAt + ARENA_PAIR_COUNTER_TIMING.lift) {
        const root = victim.animation.contactPoints.origin, delta = { x: root.x - previous.origin.x, y: root.y - previous.origin.y };
        points(victim.animation.contactPoints).forEach((point, index) => assert.ok(distance(point, { x: points(previous)[index].x + delta.x, y: points(previous)[index].y + delta.y }) < 20, `the painted head, hands and feet move continuously through the impact and prone grip: ${detail}`));
      }
      if (frame.stage === 'overhead') {
        assert.ok(Math.abs(scene.sim.bodies.get(planned.victim).y - victim.y - 142) < .001, 'the actual-contact action clock reaches the full supported lift before release');
        held = true;
      }
      if (frame.lift > 1) {
        for (const [id, endpoints] of [[frame.armsHolderId, victim.animation.contactPoints.hands], [frame.legsHolderId, victim.animation.contactPoints.feet]]) {
          const hands = actors.get(id).animation.contactPoints.hands;
          endpoints.forEach(endpoint => assert.ok(Math.min(...hands.map(hand => distance(hand, endpoint))) < 4, `both helpers keep their actual wrist/ankle holds throughout the supported lift: ${detail}/${id}`));
        }
      }
    }
    if (scene.sim.exits.get(planned.victim)?.round.id === planned.id) released = true;
    if (elapsed >= actual.resolve) {
      assert.equal(resolvedRanks(order, [actual], elapsed)[actual.victim], order.indexOf(actual.victim) + 1, 'the roster resolves the earlier physical throw at the same time');
      resolved = true;
    }
    previous = structuredClone(victim.animation.contactPoints);
  }
  assert.ok(contacted && held && released && resolved, 'the complete physical counter is exercised');
});

test('a paused direct seek reconstructs the overhead release height and its first airborne frame', () => {
  for (const elapsed of [planned.impact, planned.impact + 16, planned.impact + 280 * planned.timeScale]) {
    const scene = game(), actors = scene.step(elapsed, true), exit = scene.sim.exits.get(planned.victim), actor = actors.get(planned.victim);
    assert.ok(exit && actor, 'a paused seek reconstructs the drawn loser');
    assert.ok(Math.abs(exit.lift - 142) < .01, 'the seek uses the model held height when no previous painted frame exists');
    assert.ok(actor.depthY - actor.y >= 142, 'the release starts above the carriers and rises before descending');
    assert.ok(points(actor.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    const previous = structuredClone(actor.animation.contactPoints);
    const repeat = scene.step(elapsed, true).get(planned.victim).animation.contactPoints;
    points(previous).forEach((point, index) => assert.ok(distance(point, points(repeat)[index]) < .001, 'repeated paused seeks cannot change the held body rig'));
  }
});
