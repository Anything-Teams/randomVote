import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const fighterDraw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
let source = await readFile('src/ArenaShow.tsx', 'utf8');
assert.ok(source.includes(fighterDraw));
// Keep the actual stadium painter and rig. Cache the crowd at one clock so
// these state/roster regressions spend their time on the physical encounter.
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'drawArenaScenery(ctx, 0,')
  .replace(fighterDraw, `pendingCounterActors = actors; ${fighterDraw}`);
source += '\nlet pendingCounterActors; export const capturedActors = () => pendingCounterActors; export { render, createArenaCamera, arenaRounds, arenaPairRushTargets, resolvedRanks }; export { arenaMinimumDuration } from "./arenaLogic";';
const built = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', built.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaMinimumDuration, arenaPairRushTargets, resolvedRanks, capturedActors } = module.exports;
const noop = () => {};
function context() {
  const target = { globalAlpha: 1, stadiumDraws: 0, measureText: value => ({ width: String(value).length * 8 }) };
  return new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      return (...args) => {
        args.filter(value => typeof value === 'number').forEach(value => assert.ok(Number.isFinite(value), `${String(key)} receives finite coordinates`));
        if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0, 'painted ellipses have valid radii');
        if (key === 'drawImage') target.stadiumDraws++;
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return { addColorStop: noop };
      };
    },
    set(object, key, value) { if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} is finite`); object[key] = value; return true; },
  });
}
globalThis.document = { createElement() { const ctx = context(); return { width: 1000, height: 620, getContext: () => ctx }; } };
const shuffled = (count, seed) => {
  const order = Array.from({ length: count }, (_, index) => String(index + 1));
  let value = seed >>> 0;
  for (let index = count - 1; index > 0; index--) { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; const other = value % (index + 1); [order[index], order[other]] = [order[other], order[index]]; }
  return order;
};
const fixtures = [
  { count: 5, seed: 1119, order: ['1', '5', '3', '2', '4'] },
  { count: 8, seed: 1, order: ['1', '2', '3', '4', '5', '6', '7', '8'] },
  { count: 10, seed: 123456, order: shuffled(10, 123456) },
];

function game(fixture) {
  const { count, order, seed } = fixture;
  const duration = Math.max(44000, arenaMinimumDuration(order, 7, seed));
  const props = { candidates: Array.from({ length: count }, (_, index) => ({ id: String(index + 1), name: `선수${index + 1}`, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const planned = arenaRounds(order, duration, 7, seed), counter = planned.find(round => round.rushOutcome === 'counter-throw');
  assert.ok(counter, 'the failing fixture includes the shared counter throw');
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { sim, ctx, props, planned, counter, step(elapsed, paused = false) { render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : 50, false); return capturedActors(); } };
}

for (const fixture of fixtures) for (const step of fixture.count === 5 ? [50, 100, 200] : fixture.count === 8 ? [50, 200] : [50]) test(`a shared counter preserves its runner and helpers through the real throw (${fixture.count} people, ${step}ms frames)`, () => {
  const scene = game(fixture), stages = new Set();
  let released = false, resolved = false, delayed = false, actual;
  for (let elapsed = 0; elapsed <= scene.props.duration; elapsed += step) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(scene.counter.id);
    if (!contact) continue;
    actual = contact.round;
    const rounds = scene.planned.map(round => scene.sim.contacts.get(round.id)?.round ?? round), ranks = resolvedRanks(fixture.order, rounds, elapsed);
    const pending = actual.rushLaunchAt === null;
    if (pending || elapsed < actual.impact) {
      assert.ok(!scene.sim.exits.has(actual.victim), 'the nominal impact cannot eject a runner waiting for the real contact/throw');
      assert.equal(ranks[actual.victim], undefined, 'the runner remains on the live roster until actual resolve');
      for (const id of [actual.aggressor, actual.helper, actual.victim]) assert.ok(actors.has(id), `the current participant ${id} remains paintable`);
    }
    if (actual.rushLaunchAt != null) {
      const frame = arenaPairRushTargets(actual, elapsed, contact.center, contact.chargerOrigin);
      stages.add(frame.stage); delayed ||= actual.resolve > scene.counter.resolve;
      if (elapsed < actual.resolve) for (const id of frame.pairIds) assert.equal(ranks[id], undefined, 'a later nominal round cannot remove either active helper');
    }
    const exit = scene.sim.exits.get(actual.victim);
    if (exit?.round.id === actual.id) { assert.ok(elapsed >= actual.impact, 'only the actual release creates the exit'); released = true; }
    if (released && elapsed >= actual.resolve) { assert.equal(ranks[actual.victim], fixture.order.indexOf(actual.victim) + 1); resolved = true; break; }
  }
  assert.ok(released && resolved, `the actual throw finishes: ${JSON.stringify({ stages: [...stages], actual })}`);
  assert.ok(stages.has('charge') && stages.has('groggy') && stages.has('lift') && stages.has('release'), `the real charge, groggy pickup and shared lift all remain visible: ${[...stages]}`);
  if (fixture.count === 8 && step === 200) assert.ok(delayed, 'the slower physical setup exercises contact after the original nominal deadline');
  assert.ok(scene.ctx.stadiumDraws > 10, 'the actual stadium is still painted throughout the encounter');
});

test('a direct paused seek and a quick result retain the existing snapshot behavior', () => {
  const scene = game(fixtures[0]);
  scene.step(scene.counter.impact + 500, true);
  assert.ok(scene.ctx.stadiumDraws > 0);
  const actors = scene.step(scene.props.duration, true);
  assert.ok(actors.has(fixtures[0].order[0]), 'the winner is still painted after a direct result skip');
  assert.deepEqual(Object.keys(resolvedRanks(fixtures[0].order, scene.planned, scene.props.duration)).sort(), [...fixtures[0].order].sort());
});
