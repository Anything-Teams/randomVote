import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the production floor, live toe contacts and pickup gate. Only the
// starting layout is mirrored; the test never supplies a grip or a clock.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'releaseFrontScenery(ctx, clock,')
  .replace(draw, `releaseFrontActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.captureStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.captureEnd(); });`)
  .replace(initialize, `releaseFrontInitialize(sim, reset); ${initialize}`);
source += '\nlet releaseFrontActors; const releaseFrontScenery = () => {}; let releaseFrontInitialize = () => {}; export const setInitialize = fn => { releaseFrontInitialize = fn; }; export const capture = () => releaseFrontActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture, setInitialize } = module.exports;
const noop = () => {};
function context() {
  const stack = [], opacity = new Map(); let current;
  const target = { globalAlpha: 1, fillStyle: '', opacity,
    measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ alpha: this.globalAlpha, style: this.fillStyle }); },
    restore() { const saved = stack.pop(); if (saved) { this.globalAlpha = saved.alpha; this.fillStyle = saved.style; } },
    captureStart(actor) { current = actor.candidate.id; opacity.set(current, 0); }, captureEnd() { current = undefined; },
    fillRect(_x, _y, width) { if (current && this.fillStyle === '#172b37' && width === 1.8) opacity.set(current, Math.max(opacity.get(current), this.globalAlpha)); },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);


const fixtures = [['backbodydrop', 16], ['scoopslam', 40], ['powerbomb', 4], ['clothesline', 19], ['spinebuster', 11]];
for (const [kind, seed] of fixtures) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`${kind}: release opens the chest and keeps both supporting elbows below the shoulders (${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['2', '1'], duration = 44000, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: kind === 'clothesline' ? 320 : 525, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: kind === 'clothesline' ? 520 : 300, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let chestFrames = 0, elbowFrames = 0, released = false;
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const caster = capture().get(planned.aggressor), exit = sim.exits.get(planned.victim);
    if (!exit) continue;
    assert.ok(exit.spinFlight && caster.carrierRelease, 'the selected real ankle revolution finishes without a substitute move');
    const age = elapsed - exit.launchedAt, rig = caster.animation.contactPoints, detail = `${kind}/${mirrored}/${delta}/${age}`;
    if (age >= 100 && age <= 260) {
      assert.ok(ctx.opacity.get(planned.aggressor) > .5, `the painted chest turns toward the released opponent rather than holding a rear-view mask: ${detail}`);
      chestFrames++;
    }
    if (age >= 160 && age <= 260) {
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(rig.elbows[arm].y >= rig.shoulders[arm].y - caster.scale, `the released elbow supports the forward palm from below instead of bending around the back of the neck: arm${arm} ${detail}`);
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * caster.scale) < .001);
        assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * caster.scale) < .001);
      }
      elbowFrames++;
    }
    if (age >= 650) { released = true; break; }
  }
  assert.ok(released && chestFrames >= (delta === 16 ? 9 : 3) && elbowFrames >= (delta === 16 ? 5 : 2), 'the actual release, full directional follow-through and return are exercised continuously');
});
