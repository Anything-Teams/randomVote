import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Run the real scene and real fighter renderer. Only static scenery is skipped;
// canvas matrices and painted rectangles retain the camera's actual clipping.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw), 'capture the actual scene draw loop');
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'doubleOutTestScenery(ctx, clock,').replace(draw, `doubleOutTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.doubleOutStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.doubleOutEnd(); });`);
source += '\nlet doubleOutTestActors; const doubleOutTestScenery = () => {}; export const capturedActors = () => doubleOutTestActors; export { render, createArenaCamera, arenaRounds }; export { arenaPairRushTargets, arenaPairPushFlight } from "./arenaPairRush"; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaMinimumDuration, capturedActors, arenaPairRushTargets, arenaPairPushFlight } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });

function context() {
  let matrix = identity(), stack = [], currentId;
  const records = new Map();
  const target = {
    globalAlpha: 1,
    measureText: value => ({ width: value.length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; target.globalAlpha = saved.alpha; } },
    transform(...next) { if (currentId) records.get(currentId).transforms.push([...next]); matrix = multiply(matrix, next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    fillRect(x, y, width, height) {
      if (!currentId || target.globalAlpha <= 0) return;
      const corners = [{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map(point => project(matrix, point));
      records.get(currentId).rectangles.push(corners);
    },
    doubleOutStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix], transforms: [], rectangles: [] }); },
    doubleOutEnd() { currentId = undefined; },
    clearRecords() { records.clear(); }, records
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

function fixture(count, reversed) {
  // The independent roll selects double-out. Find a scheduled occurrence once,
  // then change the starting layout without changing the drawn finish order.
  for (let variant = 0; variant < 12; variant++) for (let seed = 0; seed < 20; seed++) {
    const order = Array.from({ length: count }, (_, index) => `double-out-${variant}-${index}`);
    const duration = Math.max(44000, arenaMinimumDuration(order, 0, seed));
    const rounds = arenaRounds(order, duration, 0, seed), round = rounds.find(value => value.rushOutcome === 'double-out');
    if (round) return { count, reversed, order, candidateOrder: reversed ? [...order].reverse() : order, seed, duration, round };
  }
  assert.fail(`a ${count}-fighter double-out must remain available`);
}

function game(found, delta = 16) {
  const props = { candidates: found.candidateOrder.map(id => ({ id, name: id, color: '#ffad72' })), order: found.order, duration: found.duration, arenaRushRoll: 0, arenaEscapeSeed: found.seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  assert.ok(arenaRounds(props.order, props.duration, 0, found.seed).every(round => round.timeScale >= 1), 'use the production minimum physical duration');
  let lastBeforeImpact;
  return { sim, ctx, step(elapsed) {
    ctx.clearRecords();
    try { render(ctx, props, elapsed, elapsed, sim, delta, false); }
    catch (error) {
      const line = Number(error.stack?.match(/<anonymous>:(\d+):\d+/)?.[1]);
      error.message += `; live fixture ${JSON.stringify({ count: found.count, reversed: found.reversed, seed: found.seed, order: found.order, elapsed, planned: found.round, actual: sim.contacts.get(found.round.id)?.round, bodies: [...sim.bodies.keys()], exits: [...sim.exits.keys()], lastBeforeImpact, failingSource: bundle.outputFiles[0].text.split('\n').slice(Math.max(0, line - 4), line + 1) })}`;
      throw error;
    }
    const actors = capturedActors(), contact = sim.contacts.get(found.round.id);
    if (contact && elapsed < contact.round.impact) {
      const fighters = [contact.round.victim, contact.round.helper].map(id => {
        const actor = actors.get(id), body = sim.bodies.get(id), contacts = actor?.animation?.contactPoints;
        return { id, root: { x: body.x, y: body.y }, facing: actor.facing, pose: actor.pose, gripTarget: actor.gripTarget, strength: actor.gripStrength, locked: actor.gripLocked, waist: contacts?.waist, hands: contacts?.hands };
      });
      lastBeforeImpact = { elapsed, fighters, rootGap: Math.hypot(fighters[0].root.x - fighters[1].root.x, fighters[0].root.y - fighters[1].root.y), verticalGap: Math.abs(fighters[0].root.y - fighters[1].root.y), waistGaps: fighters.map((fighter, index) => Math.min(...fighter.hands.map(hand => Math.hypot(hand.x - fighters[1 - index].waist.x, hand.y - fighters[1 - index].waist.y)))) };
    }
    return actors;
  } };
}

const intersectsViewport = points => Math.max(...points.map(point => point.x)) > 0 && Math.min(...points.map(point => point.x)) < 1000 && Math.max(...points.map(point => point.y)) > 0 && Math.min(...points.map(point => point.y)) < 620;
const observedSides = new Set();
for (const count of [3, 5, 10]) for (const reversed of [false, true]) test(`both live double-out fighters remain painted through collision and landing (${count} fighters, ${reversed ? 'reversed' : 'normal'} starting layout)`, () => {
  const found = fixture(count, reversed), scene = game(found), planned = found.round;
  const ids = [planned.victim, planned.secondaryVictim];
  assert.equal(new Set(ids).size, 2);
  let launched = false, exited = false, fallingFrames = 0, checks = 0;
  const until = planned.resolve + 1500 * planned.timeScale;
  for (let elapsed = 0; elapsed <= until; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact || elapsed < planned.start) continue;
    const actual = contact.round;
    if (actual.rushLaunchAt !== null && actual.rushLaunchAt !== undefined) launched = true;
    if (actual.contactSide) observedSides.add(actual.contactSide);
    for (const id of ids) {
      const actor = actors.get(id), record = scene.ctx.records.get(id), exit = scene.sim.exits.get(id);
      const detail = () => JSON.stringify({ count, reversed, seed: found.seed, order: found.order, elapsed, id, start: actual.start, impact: actual.impact, resolve: actual.resolve, center: contact.center, launch: actual.rushLaunchAt, contactAt: actual.rushContactAt, camera: scene.sim.camera, actor: actor && { x: actor.x, y: actor.y, depthY: actor.depthY, angle: actor.angle, scale: actor.scale, pose: actor.pose }, exit: exit && { origin: exit.origin, landing: exit.landing, side: exit.side }, contacts: actor?.animation?.contactPoints, matrix: record?.sceneMatrix });
      assert.ok(actor && record, `both eliminated fighters must be rendered every frame: ${detail()}`);
      for (const value of [actor.x, actor.y, actor.depthY, actor.scale, actor.angle ?? 0, actor.alpha]) assert.ok(Number.isFinite(value), `a live double-out actor cannot become nonfinite: ${detail()}`);
      assert.ok(record.transforms.length > 0, `the actual fighter rig was painted: ${detail()}`);
      assert.ok([...record.sceneMatrix, ...record.transforms.flat()].every(Number.isFinite), `the camera and painted rig transform must stay finite: ${detail()}`);
      const contacts = actor.animation?.contactPoints;
      assert.ok(contacts?.head && contacts?.waist && contacts?.feet.length === 2, `the real painted skeleton retains all contacts: ${detail()}`);
      const points = [contacts.head, contacts.waist, ...contacts.feet];
      assert.ok(points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `actual head, waist and toe contacts stay finite: ${detail()}`);
      const screenPoints = points.map(point => project(record.sceneMatrix, point));
      assert.ok(screenPoints.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `actual contacts remain finite after the camera transform: ${detail()}`);
      assert.ok(record.rectangles.some(intersectsViewport), `the camera cannot move either falling fighter completely outside the 1000×620 viewport: ${detail()}`);
      if (exit) { exited = true; if (elapsed < actual.resolve) fallingFrames++; }
      checks++;
    }
  }
  assert.ok(launched && exited && fallingFrames > 10 && checks > 100, 'the fixture must include real pair contact, both exits, and visible falling frames');
});

test('the live double-out fixtures cover both sides of the arena', () => {
  assert.deepEqual([...observedSides].sort(), [-1, 1]);
});

for (const count of [3, 5, 10]) test(`direct seeks across double-out impact, rank resolution and falling retain both real fighters (${count} fighters)`, () => {
  const found = fixture(count, false), round = found.round;
  for (const elapsed of [round.impact - 1, round.impact, round.impact + 16, round.resolve - 1, round.resolve, round.resolve + 16, round.resolve + 900 * round.timeScale]) {
    const scene = game(found), actors = scene.step(elapsed);
    for (const id of [round.victim, round.secondaryVictim]) {
      const actor = actors.get(id), record = scene.ctx.records.get(id);
      assert.ok(actor && record, `a direct seek cannot omit either double-out loser (${count}/${elapsed}/${id})`);
      assert.ok([actor.x, actor.y, actor.depthY, actor.angle ?? 0, actor.scale, ...record.sceneMatrix, ...record.transforms.flat()].every(Number.isFinite), `direct-seek actor and canvas transforms remain finite (${count}/${elapsed}/${id})`);
      const contacts = actor.animation?.contactPoints, points = contacts && [contacts.head, contacts.waist, ...contacts.feet];
      assert.ok(points?.length === 4 && points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `direct-seek head, waist and toes remain finite (${count}/${elapsed}/${id})`);
      assert.ok(record.rectangles.some(intersectsViewport), `both direct-seek fighters remain on screen (${count}/${elapsed}/${id})`);
      if (elapsed >= round.resolve) assert.ok(scene.sim.exits.has(id), 'rank resolution creates both eliminated bodies on a seek');
    }
  }
});


for (const count of [3, 5, 10]) for (const reversed of [false, true]) for (const delta of [16, 50]) test(`a planted double-out preserves the real pair spacing, contact and momentum (${count}/${reversed}/${delta}ms)`, () => {
  const found = fixture(count, reversed), scene = game(found, delta), planned = found.round;
  let checks = 0, released = false, previous, previousRigs, previousFacings, initialGap, maximumPalmGap = 0;
  const ellipse = point => ((point.x - 500) / 303) ** 2 + ((point.y - 416) / 112) ** 2;
  for (let elapsed = 0; elapsed <= planned.resolve + 1500; elapsed += delta) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.pairCarryOrigins || elapsed < contact.round.rushContactAt) continue;
    const actual = contact.round, model = arenaPairRushTargets(actual, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
    const pair = [actors.get(actual.victim), actors.get(actual.helper)], driver = actors.get(actual.aggressor);
    if (!driver || pair.some(actor => !actor)) continue;
    const roots = pair.map(actor => ({ x: actor.x, y: actor.depthY ?? actor.y }));
    const vector = { x: roots[0].x - roots[1].x, y: roots[0].y - roots[1].y };
    initialGap ??= { x: contact.pairCarryOrigins.pair[0].x - contact.pairCarryOrigins.pair[1].x, y: contact.pairCarryOrigins.pair[0].y - contact.pairCarryOrigins.pair[1].y };
    const exits = pair.map(actor => scene.sim.exits.get(actor.candidate.id));
    const physical = !exits[0] || elapsed < Math.min(...exits.filter(Boolean).map(exit => exit.round.impact + 850));
    if (!physical) continue;
    const detail = () => JSON.stringify({ count, reversed, delta, elapsed, stage: model.stage, contactAt: actual.rushContactAt, impact: actual.impact, roots, previous, exits, vector, initialGap, driver: { x: driver.x, y: driver.y, pose: driver.pose, facing: driver.facing }, maximumPalmGap });
    assert.ok(Math.hypot(vector.x - initialGap.x, vector.y - initialGap.y) < .05, `the bodies cannot converge or cross: ${detail()}`);
    if (!exits[0]) {
      assert.ok(ellipse(driver) < 1, `the pusher stays on the sand: ${detail()}`);
      const hands = driver.animation.contactPoints.hands;
      const near = [...pair].sort((a, b) => Math.hypot(a.x - driver.x, a.y - driver.y) - Math.hypot(b.x - driver.x, b.y - driver.y))[0];
      const targets = near.animation.contactPoints.shoulders;
      const gaps = targets.map((target, index) => Math.hypot(hands[1 - index].x - target.x, hands[1 - index].y - target.y));
      if (elapsed > actual.rushContactAt + 220) {
        maximumPalmGap = Math.max(maximumPalmGap, ...gaps);
        assert.ok(maximumPalmGap < 8, `both real palms keep pushing the near wrestler: ${detail()}`);
        for (let index = 0; index < pair.length; index++) {
          const a = pair[index].animation.contactPoints, b = pair[1 - index].animation.contactPoints;
          assert.ok(a.hands.some(hand => b.shoulders.some(shoulder => Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y) < 8)), `the fighting pair keeps transmitting the push: ${detail()}; pair ${index} gap=${Math.min(...a.hands.map(hand=>Math.hypot(hand.x-b.waist.x,hand.y-b.waist.y)))}`);
        }
      }
      checks++;
    } else {
      assert.ok(exits[1], 'both intended losers get a physical exit');
      assert.ok(!scene.sim.exits.has(actual.aggressor), 'the pusher never joins the elimination');
      const firstFreeFrame = !released;
      released = true;
      if (previousRigs && elapsed < actual.impact + 650 * actual.timeScale) pair.forEach((actor, index) => {
        const rig = actor.animation.contactPoints, old = previousRigs[index];
        assert.equal(actor.facing, previousFacings[index], 'letting go cannot mirror a pushed body in one frame');
        const shift = { x: rig.origin.x - old.origin.x, y: rig.origin.y - old.origin.y };
        for (const key of ['shoulders', 'elbows', 'hands']) rig[key].forEach((point, arm) => {
          assert.ok(Math.hypot(point.x - old[key][arm].x - shift.x, point.y - old[key][arm].y - shift.y) <= (firstFreeFrame ? 5 : 12.5) * delta / 16 + .1, `the real release joints keep their painted path: ${detail()}/${index}/${key}/${arm}`);
        });
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(Math.abs(Math.hypot(rig.shoulders[arm].x - rig.elbows[arm].x, rig.shoulders[arm].y - rig.elbows[arm].y) - 11 * actor.scale) < .001);
          assert.ok(Math.abs(Math.hypot(rig.elbows[arm].x - rig.hands[arm].x, rig.elbows[arm].y - rig.hands[arm].y) - 10.5 * actor.scale) < .001, 'a release cannot shorten or stretch either normal arm bone');
        }
      });
      for (const exit of exits) {
        const start = arenaPairPushFlight(0, exit.origin, exit.landing, exit.side, actual.timeScale, { speed: exit.velocity, angle: exit.angle });
        const next = arenaPairPushFlight(.001, exit.origin, exit.landing, exit.side, actual.timeScale, { speed: exit.velocity, angle: exit.angle });
        assert.ok(Math.abs(Math.hypot(next.x - start.x, next.y - start.y) * 1e6 - exit.velocity) < .1, 'the first free step retains the final pushing speed');
      }
    }
    if (previous) for (let index = 0; index < roots.length; index++) assert.ok(Math.hypot(roots[index].x - previous[index].x, roots[index].y - previous[index].y) <= 165 * delta / 1000 + .1, `no grounded or release teleport: ${detail()}`);
    previous = roots;
    previousRigs = pair.map(actor => structuredClone(actor.animation.contactPoints));
    previousFacings = pair.map(actor => actor.facing);
  }
  assert.ok(checks > 5 && released, `exercise actual two-body pushing and release: ${JSON.stringify({count,reversed,delta,checks,released,exits:[...scene.sim.exits.keys()],actual:scene.sim.contacts.get(planned.id)?.round})}`);
});
