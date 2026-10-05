import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Replay the natural eight-person field from zero. No actor locations, contact
// clocks or move outcomes are supplied; only scenery and observation are added.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const initialize = 'const ambient = won ? [] : active.filter';
const decline = 'if (!initial.canPerform) fallback();';
assert.ok(source.includes(draw) && source.includes(ranks) && source.includes(initialize) && source.includes(decline));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'rushStallScenery(ctx, clock,')
  .replace(draw, `rushStallActors = actors; ${draw}`)
  .replace(ranks, `${ranks} rushStallRanks = ranks;`)
  .replace(initialize, `rushStallInitialize(sim, reset); ${initialize}`)
  .replace(decline, 'if (!initial.canPerform) { rushStallDeclines.push({ id: exchange.id, kind: window.kind, elapsed, canPerform: initial.canPerform, launchAt: window.launchAt, origins: structuredClone(origins) }); fallback(); }');
source += '\nlet rushStallActors, rushStallRanks; const rushStallDeclines = []; const rushStallScenery = () => {}; let rushStallInitialize = () => {}; export const setInitialize = fn => { rushStallInitialize = fn; }; export const capture = () => ({ actors: rushStallActors, ranks: rushStallRanks, declines: rushStallDeclines }); export { render, createArenaCamera, arenaRounds };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, setInitialize, capture } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (one, two) => Math.hypot(one.x - two.x, one.y - two.y);

for (const [mirrored, delta] of [[false, 16], [false, 50], [true, 16]]) {
  test(`natural incoming scoop ${mirrored ? 'mirrored' : 'ordinary'} ${delta}ms: arriving at the receiver completes a real catch without a stalled restart`, () => {
    const order = Array.from({ length: 8 }, (_, index) => String(index + 1)), duration = 54150, seed = 19;
    const planned = arenaRounds(order, duration, 7, seed).at(-1);
    assert.equal(planned.wrestlingMove?.kind, 'scoopslam');
    const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset || !mirrored) return;
      for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
    });
    const declineStart = capture().declines.length;
    let firstLaunch, nearStopAt, runFrames = 0, contacted = false, released = false, finished = false, declined = false, previous;
    for (let elapsed = 0; elapsed < duration + 30000; elapsed += delta) {
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      const { actors, ranks, declines } = capture(), actual = sim.contacts.get(planned.id)?.round, window = actual?.wrestlingMove;
      if (Object.keys(ranks).length === order.length) {
        assert.deepEqual(ranks, Object.fromEntries(order.map((id, index) => [id, index + 1]))); finished = true; break;
      }
      if (!actual || elapsed < window?.start) continue;
      if (window?.kind !== 'scoopslam') {
        const reason = declines.slice(declineStart).find(value => value.id === planned.id && value.kind === 'scoopslam');
        assert.ok(reason && reason.canPerform === false && reason.launchAt == null && firstLaunch == null && !runFrames,
          'only the actual prelaunch space check may decline the scoop; a launched failed catch must never fall back');
        assert.ok(reason.origins.driver && reason.origins.victim, 'the declined move was evaluated from the real natural field');
        declined = true; continue;
      }
      assert.equal(window?.kind, 'scoopslam', 'the actual incoming catch must succeed as the selected scoop, without an ordinary fallback');
      const caster = actors.get(planned.aggressor), runner = actors.get(planned.victim);
      assert.ok(caster && runner);
      if (!contacted && previous) for (const [actor, before] of [[caster, previous.caster], [runner, previous.runner]]) {
        assert.ok(distance(actor, before) <= 190 * delta / 1000 + 5, `the real approach/contact cannot teleport a fighter: ${elapsed}/${distance(actor, before).toFixed(2)}px`);
      }
      if (window.launchAt != null) {
        firstLaunch ??= window.launchAt;
        assert.equal(window.launchAt, firstLaunch, 'a stopped rush cannot conceal the failed catch by launching it again');
        runFrames += Number(runner.pose === 'run' && Math.hypot(runner.velocityX, runner.velocityY) > 80);
        if (window.contactAt == null && runFrames && distance(caster, runner) < 80 && Math.hypot(runner.velocityX, runner.velocityY) < 5) nearStopAt ??= elapsed;
        if (nearStopAt !== undefined) assert.ok(window.contactAt != null || elapsed - nearStopAt <= 250 + delta, `the runner has reached the receiver and must take the actual grip within 250ms: ${elapsed}, stopped at ${nearStopAt}`);
      }
      if (window.contactAt != null) {
        if (!contacted) {
          assert.equal(window.contactAt, elapsed, 'the catch is recorded on its actual painted-contact frame');
          assert.ok(runFrames > 0, 'a real incoming run precedes the selected catch');
          if (nearStopAt !== undefined) assert.ok(window.contactAt - nearStopAt <= 250 + delta);
        }
        contacted = true;
      }
      const exit = sim.exits.get(planned.victim);
      if (exit) { assert.ok(contacted && exit.spinFlight, 'the caught opponent completes its real ankle-spin release'); released = true; }
      assert.ok(!sim.exits.has(planned.aggressor), 'the receiver survives its selected catch');
      previous = { caster: { x: caster.x, y: caster.y }, runner: { x: runner.x, y: runner.y } };
    }
    if (declined) assert.ok(firstLaunch == null && !contacted && !released && finished, 'a genuine prelaunch decline still completes the unchanged drawn ranks');
    else assert.ok(firstLaunch != null && contacted && released && finished, 'the actual run, scoop, release and unchanged drawn ranks all complete');
  });
}
