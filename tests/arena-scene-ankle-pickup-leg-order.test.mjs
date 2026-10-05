import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initial = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initial));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'ankleArmAuditScenery(ctx, clock,')
  .replace(draw, `ankleArmAuditActors = actors; ${draw}`)
  .replace(initial, `ankleArmAuditInitialize(sim, reset); ${initial}`);
source += '\nlet ankleArmAuditActors; const ankleArmAuditScenery = () => {}; let ankleArmAuditInitialize = () => {}; export const setInitialize = fn => { ankleArmAuditInitialize = fn; }; export const capturedActors = () => ankleArmAuditActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seeds = { backbodydrop: 16, spinebuster: 11 };


function crosses(a, b, c, d) {
  const v = { x: b.x - a.x, y: b.y - a.y }, w = { x: d.x - c.x, y: d.y - c.y };
  const determinant = v.x * w.y - v.y * w.x;
  if (Math.abs(determinant) < 1e-8) return false;
  const between = { x: c.x - a.x, y: c.y - a.y };
  const first = (between.x * w.y - between.y * w.x) / determinant;
  const second = (between.x * v.y - between.y * v.x) / determinant;
  return first > .001 && first < .999 && second > .001 && second < .999;
}
for (const kind of Object.keys(seeds)) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`${kind}: turning toward the floored ankles keeps each heel under its own hip (${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = seeds[kind];
  const planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let reachFrames = 0, pickedUp = false, released = false, previous;
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actor = capturedActors().get(planned.aggressor), skeleton = actor.animation.skeleton;
    const reaching = actor.ankleApproach !== undefined && actor.pivotTurn === undefined;
    if (reaching) {
      reachFrames++;
      const { hips, knees, feet } = skeleton, detail = `${kind}/${mirrored}/${delta}ms/${elapsed}`;
      // A nominal facing change may rename the legs, but it cannot attach
      // the left pelvis to the other heel and make both thighs cross.
      assert.equal(crosses(hips[0], feet[0], hips[1], feet[1]), false, `the support legs cannot form an X while reaching for the ankles: ${detail}`);
      for (const first of [[hips[0], knees[0]], [knees[0], feet[0]]]) for (const second of [[hips[1], knees[1]], [knees[1], feet[1]]]) {
        assert.equal(crosses(...first, ...second), false, `the actual leg bones cannot pass through the opposite support leg: ${detail}`);
      }
      if (previous) {
        const same = distance(feet[0], previous[0]) + distance(feet[1], previous[1]);
        const renamed = distance(feet[0], previous[1]) + distance(feet[1], previous[0]);
        assert.ok(Math.min(same, renamed) < 8 + delta * .45, `renaming legs preserves the two actual soles continuously: ${detail}`);
      }
    }
    if (actor.ankleThrowProgress !== undefined) pickedUp = true;
    previous = structuredClone(skeleton.feet);
    if (sim.exits.has(planned.victim)) { released = true; break; }
  }
  assert.ok(reachFrames >= (delta === 16 ? 12 : 4), 'the complete real ankle approach is checked before rotation');
  assert.ok(pickedUp && released, 'the corrected supported stance still completes pickup, revolution and release');
});
