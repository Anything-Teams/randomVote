import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Mount the real component, run its real effects/RAF callback, and let the
// Scene's state setter update the roster and story through normal rerenders.
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const alive = '  const alive = props.candidates.length - Object.values(ranks).filter(rank => rank !== 1).length;';
assert.ok(source.includes(draw) && source.includes(alive));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'uiClockScenery(ctx, clock,')
  .replace(draw, `uiClockCanvas = { sim, actors, ranks, rounds, exchange, elapsed }; ${draw}`)
  .replace(alive, `${alive}\n  uiClockComponent = { ranks, round, actualRounds, alive, finished };`);
source += '\nlet uiClockCanvas, uiClockComponent; const uiClockScenery = () => {}; export const getCanvasClock = () => uiClockCanvas; export const getComponentClock = () => uiClockComponent; export { arenaRounds }; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, loader: 'tsx' }, bundle: true, format: 'cjs', platform: 'node', write: false, jsx: 'automatic', external: ['react', 'react/jsx-runtime'], loader: { '.css': 'empty' } });
const noop = () => {};
const context = () => new Proxy({ measureText: text => ({ width: text.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => (target[key] = value, true) });
const canvas = () => ({ width: 1000, height: 620, getContext: () => context(), getBoundingClientRect: () => ({ width: 1000, height: 620 }) });
function findNode(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const found = findNode(child, predicate); if (found) return found;
  }
}
function game(count, seed) {
  let cursor = 0, now = 0, dirty = false, tree;
  const cells = [], effects = [], frames = new Map(), cleanups = [], display = canvas();
  const react = {
    useState(initial) { const index = cursor++; cells[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [cells[index].value, next => { cells[index].value = typeof next === 'function' ? next(cells[index].value) : next; dirty = true; }]; },
    useRef(initial) { const index = cursor++; cells[index] ??= { current: initial }; return cells[index]; },
    useMemo(fn) { cursor++; return fn(); },
    useEffect(fn, dependencies) {
      const index = cursor++, previous = cells[index];
      if (!previous || dependencies.some((value, key) => !Object.is(value, previous.dependencies[key]))) {
        cells[index] = { dependencies: [...dependencies] }; effects.push(fn);
      }
    },
  };
  const previous = Object.fromEntries(['window', 'document', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]));
  globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
  globalThis.document = { createElement: tag => { assert.equal(tag, 'canvas'); return canvas(); } };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  let frameId = 0;
  globalThis.requestAnimationFrame = callback => { const id = ++frameId; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const module = { exports: {} };
  const require = name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    throw new Error(`Unexpected UI clock test dependency: ${name}`);
  };
  new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
  const order = Array.from({ length: count }, (_, index) => String(count - index));
  const duration = Math.max(44000, module.exports.arenaMinimumDuration(order, 7, seed));
  const planned = module.exports.arenaRounds(order, duration, 7, seed);
  let playbackEnd = planned.at(-1).end;
  let props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, elapsed: 0, paused: false, preview: false, arenaRushRoll: 7, arenaEscapeSeed: seed, onArenaTimelineUpdate: end => { playbackEnd = Math.max(playbackEnd, end); } };
  const rerender = () => {
    cursor = 0; dirty = false; tree = module.exports.default(props);
    const node = findNode(tree, item => item.type === 'canvas'); assert.ok(node); node.props.ref.current = display;
    while (effects.length) { const cleanup = effects.shift()(); if (cleanup) cleanups.push(cleanup); }
  };
  rerender();
  return {
    order, planned, get playbackEnd() { return playbackEnd; },
    step(elapsed) {
      now = elapsed; props = { ...props, elapsed }; rerender();
      const callbacks = [...frames]; frames.clear(); callbacks.forEach(([, callback]) => callback(now));
      if (dirty) rerender();
      return { ui: module.exports.getComponentClock(), frame: module.exports.getCanvasClock(), tree };
    },
    restore() {
      cleanups.forEach(cleanup => cleanup());
      for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    },
  };
}

for (const [count, seed, hasDelayedPlain] of [[8, 19, false], [8, 42, true], [5, 19, false]]) test(`the mounted ${count}-fighter seed ${seed} roster and story follow the Scene's real delayed clocks`, () => {
  const scene = game(count, seed);
  let delayedPlainSeen = false, activeStorySeen = false, complete = false, elapsed = 0;
  const plannedById = new Map(scene.planned.map(round => [round.id, round]));
  const ceiling = scene.playbackEnd + 60000;
  try {
    for (; elapsed <= scene.playbackEnd + 16 && elapsed < ceiling; elapsed += 16) {
      const { ui, frame, tree } = scene.step(elapsed);
      assert.ok(frame, 'the mounted component starts its real Canvas effect');
      assert.deepEqual(ui.ranks, frame.ranks, `the visible roster and painted Scene publish the same ranks at ${elapsed}: ${JSON.stringify({ focus: frame.exchange?.id, uiRounds: ui.actualRounds.map(r => ({ id: r.id, resolve: r.resolve })), sceneRounds: frame.rounds.map(r => ({ id: r.id, resolve: r.resolve })) })}`);
      const story = findNode(tree, item => typeof item.type === 'function' && item.type.name === 'ArenaStory');
      assert.ok(story); assert.equal(story.props.round?.id, ui.round?.id);
      assert.equal(ui.alive, count - Object.values(frame.ranks).filter(rank => rank !== 1).length);
      for (const [id, contact] of frame.sim.contacts) {
        const planned = plannedById.get(id), actual = contact.round;
        if (!planned || !(contact.plannedDelay > 0) || actual.wrestlingMove || actual.kickCatch || actual.supermanPunch || actual.slideTrip || actual.linkedRush || actual.pairDodge || actual.passingTrip || actual.rushOutcome || actual.rimPush || actual.floorFinish || actual.escape || actual.recovery || actual.rim || actual.rimCharge || actual.chargeSetup || ['elbow', 'sidekick'].includes(actual.tactic)) continue;
        if (elapsed >= planned.resolve && elapsed < actual.resolve) {
          delayedPlainSeen = true;
          assert.equal(ui.ranks[actual.victim], undefined, 'an ordinary queued bout cannot reveal its nominal rank before its real delayed finish');
          const roster = findNode(tree, item => item.props?.role === 'listitem' && item.props['aria-label'] === `${actual.victim}, 생존`);
          assert.ok(roster, 'the actual rendered row remains alive while that delayed encounter is pending');
        }
      }
      for (const exit of frame.sim.exits.values()) {
        if (!exit.spinFlight || !exit.floorThrow || elapsed < exit.launchedAt + 650 || elapsed >= exit.round.resolve || frame.exchange?.id === exit.round.id || !frame.exchange) continue;
        activeStorySeen = true;
        assert.equal(ui.round.id, frame.exchange.id, 'the rendered story follows the next active fight while the previous opponent is still landing');
        assert.equal(ui.ranks[exit.round.victim], undefined, 'advancing the story does not publish the previous airborne fighter early');
      }
      if (ui.finished) {
        assert.deepEqual(ui.ranks, Object.fromEntries(scene.order.map((id, index) => [id, index + 1])));
        complete = true; break;
      }
    }
    assert.ok(activeStorySeen, 'a real dragged opponent flies outside while the next active story is rendered');
    if (hasDelayedPlain) assert.ok(delayedPlainSeen, 'the natural fixture exercises an ordinary delayed encounter after its original nominal resolution');
    assert.ok(complete && elapsed < ceiling, 'actual effect publication finishes the full game with its drawn ranks');
  } finally { scene.restore(); }
});
