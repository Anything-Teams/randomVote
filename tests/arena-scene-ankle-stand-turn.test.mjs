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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'standTurnAuditScenery(ctx, clock,')
  .replace(draw, `standTurnAuditActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.captureStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.captureEnd(); });`)
  .replace(initial, `standTurnAuditInitialize(sim, reset); ${initial}`);
source += '\nlet standTurnAuditActors; const standTurnAuditScenery = () => {}; let standTurnAuditInitialize = () => {}; export const setInitialize = fn => { standTurnAuditInitialize = fn; }; export const capturedActors = () => standTurnAuditActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize } = module.exports;
const noop = () => {};
// Read the alpha of the eyes which the production painter actually draws.
// A front/back flag alone cannot reveal a hair overlay appearing too early.
function context() {
  let current, stack = [];
  const records = new Map();
  const target = {
    globalAlpha: 1, measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push(target.globalAlpha); }, restore() { target.globalAlpha = stack.pop() ?? 1; },
    fillRect(_x, _y, _width, _height) {
      if (current && target.fillStyle === '#172b37') records.get(current).eyeAlpha = Math.max(records.get(current).eyeAlpha, target.globalAlpha);
    },
    captureStart(actor) { current = actor.candidate.id; records.set(current, { eyeAlpha: 0 }); },
    captureEnd() { current = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seeds = { spinebuster: 11, backbodydrop: 16, scoopslam: 40, powerbomb: 4, clothesline: 19 };

const opening = (shoulder, elbow, palm) => {
  const upper = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const forearm = { x: palm.x - elbow.x, y: palm.y - elbow.y };
  const cosine = (upper.x * forearm.x + upper.y * forearm.y) / (Math.hypot(upper.x, upper.y) * Math.hypot(forearm.x, forearm.y));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
};
for (const kind of Object.keys(seeds)) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`${kind}: a genuine two-ankle pickup stands before its gradual back turn (${mirrored ? 'mirrored' : 'ordinary'}, ${delta} ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = seeds[kind];
  const planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  // Only initial ground positions change; the production contact, recovery,
  // pickup, loading, spin and release clocks all remain actual Scene results.
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: kind === 'clothesline' ? 320 : 525, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: kind === 'clothesline' ? 520 : 300, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let pickupAt, lateRecoveryFrames = 0, heldFrames = 0, partialTurnMs = 0, backSeen = false, released = false, prior;
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actor = capturedActors().get(planned.aggressor), victim = capturedActors().get(planned.victim);
    const rig = actor?.animation?.contactPoints, victimRig = victim?.animation?.contactPoints;
    const actual = sim.contacts.get(planned.id)?.round;
    assert.ok(rig && victimRig && actual?.wrestlingMove, 'the selected actual move must retain both painted fighters');
    const detail = `${kind}/${mirrored}/${delta}ms/${elapsed}`;
    if (kind === 'spinebuster' && actor.pose === 'recover' && actor.phase > .85) {
      lateRecoveryFrames++;
      rig.hands.forEach((palm, arm) => {
        assert.ok(palm.y >= rig.shoulders[arm].y - 6 * actor.scale, `recovering from the backward floor slam cannot rewind both hands to the old overhead support: arm ${arm}, ${detail}`);
        assert.ok(opening(rig.shoulders[arm], rig.elbows[arm], palm) < 150, `the recovering receiver folds a guard at the chest instead of extending an old lifting arm: arm ${arm}, ${detail}`);
      });
    }
    if (actor.ankleThrowProgress !== undefined && !sim.exits.has(planned.victim)) {
      heldFrames++;
      pickupAt ??= elapsed;
      assert.ok(actual.wrestlingMove.ankleGripAt != null, 'both actual hands establish the toe hold before the raise');
      rig.hands.forEach((palm, arm) => {
        assert.ok(distance(palm, victimRig.feet[actor.ankleGripReversed ? 1 - arm : arm]) < 8, `the stand and turn retain the actual toe in its palm: arm ${arm}, ${detail}`);
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * actor.scale) < .001, `the upper arm stays connected with normal length: ${detail}`);
        assert.ok(Math.abs(distance(rig.elbows[arm], palm) - 10.5 * actor.scale) < .001, `the forearm stays connected with normal length: ${detail}`);
      });
      if (elapsed - pickupAt < 120) assert.ok(ctx.records.get(actor.candidate.id).eyeAlpha > .95, `the first real grip retains its incoming chest and face: ${detail}`);
      if (elapsed - pickupAt <= 650) {
        const eyeAlpha = ctx.records.get(actor.candidate.id).eyeAlpha;
        if (eyeAlpha > .05 && eyeAlpha < .95) partialTurnMs += delta;
        if (eyeAlpha < .5) {
          backSeen = true;
          assert.ok(Math.abs(actor.animation.motion.lean) <= 12, `the back cannot replace a bent pickup before the receiver has stood under the ankle weight (lean ${actor.animation.motion.lean.toFixed(2)}, eye alpha ${eyeAlpha.toFixed(3)}): ${detail}`);
        }
      }
      if (prior?.held) for (const key of ['shoulders', 'elbows', 'hands']) rig[key].forEach((point, arm) => assert.ok(distance(point, prior.rig[key][arm]) < 8 + delta * .9, `the ${key} cannot snap from grip to back view: ${detail}`));
    }
    prior = { held: actor.ankleThrowProgress !== undefined, rig: structuredClone(rig) };
    if (sim.exits.has(planned.victim)) { released = true; break; }
  }
  if (kind === 'spinebuster') assert.ok(lateRecoveryFrames >= (delta === 16 ? 6 : 2), 'the actual receiver finishes its floor recovery before toe pickup');
  assert.ok(released && heldFrames >= (delta === 16 ? 55 : 17), 'the genuine toe hold continues through the complete existing revolution and release');
  assert.ok(backSeen && partialTurnMs >= 100, `the chest-to-back transition must retain readable intermediate views rather than one grip frame (${partialTurnMs} ms)`);
});
