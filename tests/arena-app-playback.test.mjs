import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

let source = await readFile('src/App.tsx', 'utf8');
const renderStart = '  return (\n    <div className={`site-shell';
assert.ok(source.includes(renderStart));
source = source.replace(renderStart, '  appClockProbe = { start, togglePause, reset, status, elapsed, duration, sportsScene, playbackEnd: playback.current.duration };\n' + renderStart);
source += '\nlet appClockProbe; export const getAppClockProbe = () => appClockProbe;';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, loader: 'tsx' }, bundle: true, format: 'cjs', platform: 'node', write: false, jsx: 'automatic', external: ['react', 'react/jsx-runtime', './GameStage', './BroadcastShow', './RacingShow', './ArenaShow', './LadderShow', './PlaybackButton', './session', './sports', './election', './playbackTiming'], loader: { '.css': 'empty' } });

function game() {
  let cursor = 0, now = 0, reduceMotion = false;
  const cells = [], intervals = new Map();
  const react = {
    useState(initial) { const index = cursor++; cells[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [cells[index].value, next => { cells[index].value = typeof next === 'function' ? next(cells[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; cells[index] ??= { current: initial }; return cells[index]; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
  };
  const candidates = [{ id: 1, name: '하나' }, { id: 2, name: '둘' }];
  const require = name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === './session') return { readSession: () => ({ entries: candidates, mode: 'arena', topic: '오늘 커피 쏠 사람은?' }), saveSession() {} };
    if (name === './sports') return { createSportsOrder: () => ['2', '1'] };
    if (name === './election') return { CANDIDATE_COLORS: ['#ef9863', '#65b896'], MAX_CANDIDATES: 10, randomInt: limit => limit === 10 ? 7 : 11 };
    if (name === './playbackTiming') return { basePlaybackDuration: () => 44000, createPlaybackDuration: () => 44000 };
    if (/^\.\//.test(name)) return { default: function Scene() {} };
    throw new Error(`Unexpected test dependency: ${name}`);
  };
  const module = { exports: {} };
  const previousWindow = globalThis.window, previousPerformance = globalThis.performance;
  globalThis.window = { matchMedia: () => ({ matches: reduceMotion }), scrollTo() {}, setInterval(fn) { intervals.set(1, fn); return 1; }, clearInterval(id) { intervals.delete(id); } };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
  const render = () => { cursor = 0; module.exports.default(); return module.exports.getAppClockProbe(); };
  const initial = render(); initial.start();
  return {
    read: render,
    tick(at) { now = at; intervals.get(1)?.(); return render(); },
    reduceMotion(value) { reduceMotion = value; },
    get active() { return intervals.size > 0; },
    restore() { globalThis.window = previousWindow; Object.defineProperty(globalThis, 'performance', { configurable: true, value: previousPerformance }); },
  };
}

test('the real app clock waits for a delayed arena throw without rescaling the fight', () => {
  const scene = game();
  try {
    const playing = scene.read();
    assert.equal(playing.status, 'running');
    assert.equal(playing.duration, 44000);
    assert.equal(typeof playing.sportsScene.props.onArenaTimelineUpdate, 'function');
    const plannedEnd = playing.playbackEnd, actualEnd = plannedEnd + 3000;
    playing.sportsScene.props.onArenaTimelineUpdate(actualEnd);
    const delayed = scene.tick(plannedEnd + 100);
    assert.equal(delayed.status, 'running', 'the original plan cannot stop a still-held ankle throw');
    assert.equal(delayed.elapsed, plannedEnd + 100);
    assert.equal(delayed.duration, 44000, 'extending the finish must preserve all existing motion speeds');
    assert.equal(scene.active, true);
    delayed.sportsScene.props.onArenaTimelineUpdate(actualEnd - 1000);
    assert.equal(scene.tick(actualEnd - 500).status, 'running', 'an older scene deadline cannot shorten an active throw');
    const finished = scene.tick(actualEnd);
    assert.equal(finished.status, 'finished');
    assert.equal(finished.elapsed, actualEnd);
    assert.equal(scene.active, false);
    assert.equal(finished.sportsScene.props.onArenaTimelineUpdate, undefined);
  } finally { scene.restore(); }
});

test('pause and resume preserve the actual extended arena completion time', () => {
  const scene = game();
  try {
    const actualEnd = scene.read().playbackEnd + 3000;
    scene.read().sportsScene.props.onArenaTimelineUpdate(actualEnd);
    scene.tick(7000).togglePause();
    assert.equal(scene.tick(9000).elapsed, 7000);
    scene.read().togglePause();
    assert.equal(scene.tick(actualEnd + 1500).status, 'running');
    assert.equal(scene.read().elapsed, actualEnd - 500);
    assert.equal(scene.tick(actualEnd + 2000).status, 'finished');
  } finally { scene.restore(); }
});

test('turning on reduced motion during a held throw completes the app clock', () => {
  const scene = game();
  try {
    const actualEnd = scene.read().playbackEnd + 3000;
    scene.read().sportsScene.props.onArenaTimelineUpdate(actualEnd);
    scene.tick(7000);
    scene.reduceMotion(true);
    const finished = scene.tick(7050);
    assert.equal(finished.status, 'finished');
    assert.equal(finished.elapsed, actualEnd);
    assert.equal(scene.active, false);
    assert.equal(finished.sportsScene.props.onArenaTimelineUpdate, undefined);
  } finally { scene.restore(); }
});
