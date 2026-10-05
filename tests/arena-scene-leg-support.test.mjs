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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'legSupportScenery(ctx, clock,')
  .replace(draw, `legSupportActors = actors; ${draw}`)
  .replace(initial, `legSupportInitialize(sim, reset); ${initial}`);
source += '\nlet legSupportActors; const legSupportScenery = () => {}; let legSupportInitialize = () => {}; export const setInitialize = fn => { legSupportInitialize = fn; }; export const capturedActors = () => legSupportActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seeds = { clothesline: 19, powerbomb: 4, backbodydrop: 16, spinebuster: 11, scoopslam: 40 };

for (const kind of Object.keys(seeds)) test(`${kind}: the actual ankle throw keeps supporting soles instead of starting a kick or restoring old feet`, () => {
  for (const mirrored of [false, true]) for (const delta of [16, 50]) {
    const order = ['2', '1'], duration = 44000, seed = seeds[kind];
    const planned = arenaRounds(order, duration, 7, seed)[0];
    assert.equal(planned.wrestlingMove?.kind, kind);
    const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset) return;
      const roots = ['powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'].includes(kind) ? [{ x: 525, y: 416 }, { x: 300, y: 416 }] : [{ x: 320, y: 416 }, { x: 520, y: 416 }];
      Object.assign(sim.bodies.get(planned.aggressor), roots[0]); Object.assign(sim.bodies.get(planned.victim), roots[1]);
      for (const body of sim.bodies.values()) {
        if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
        body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
      }
    });
    let strokeFrames = 0, previousFeet, previousHead, released = false;
    for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      const actor = capturedActors().get(planned.aggressor), actual = sim.contacts.get(planned.id)?.round;
      assert.ok(actor?.animation?.contactPoints, 'the actual surviving holder remains visible');
      const rig = actor.animation.contactPoints, feet = actor.animation.feet;
      if (actor.ankleThrowProgress !== undefined && !sim.exits.has(planned.victim)) {
        strokeFrames++;
        const detail = `${kind}/${mirrored}/${delta}ms/${elapsed}`;
        assert.equal(actor.animation.moving, false, `a throw is a planted leg drive, not a gait: ${detail}`);
        assert.ok(feet.some(foot => !foot.swinging && foot.lift < .05), `a loaded throw keeps at least one actual support sole grounded: ${detail} ${JSON.stringify({ root: { x: actor.x, y: actor.y }, feet, skeleton: actor.animation.skeleton, progress: actor.ankleThrowProgress })}`);
        assert.ok(feet.every(foot => foot.lift * actor.scale < 9), `finishing a short prior step cannot become a high kicking leg: ${detail}`);
        if (previousFeet) rig.feet.forEach((foot, leg) => assert.ok(distance(foot, previousFeet[leg]) < 10 + delta * .35, `the actual sole cannot return to an old grip position: ${detail}`));
        if (previousHead) assert.ok(distance(rig.head, previousHead) < 8 + delta * .9, `a stale heel cannot displace the whole holder: ${detail}`);
        for (let leg = 0; leg < 2; leg++) {
          const skeleton = actor.animation.skeleton;
          assert.ok(distance(skeleton.hips[leg], skeleton.knees[leg]) <= 11.001 && distance(skeleton.knees[leg], skeleton.feet[leg]) <= 11.001, `the supporting leg keeps normal connected bone lengths: ${detail}`);
        }
      }
      previousFeet = structuredClone(rig.feet); previousHead = { ...rig.head };
      if (sim.exits.has(planned.victim)) {
        assert.ok(actual.wrestlingMove.ankleGripAt != null, 'the complete real ankle pickup precedes release');
        assert.ok(!sim.exits.has(planned.aggressor), 'the holder stays inside');
        released = true; break;
      }
    }
    assert.ok(released && strokeFrames >= (delta === 16 ? 8 : 4), `${kind}/${mirrored}/${delta}ms must exercise the actual held stroke and complete release`);
  }
});
