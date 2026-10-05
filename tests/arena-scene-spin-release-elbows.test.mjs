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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'releaseElbowAuditScenery(ctx, clock,')
  .replace(draw, `releaseElbowAuditActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.captureStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.captureEnd(); });`)
  .replace(initial, `releaseElbowAuditInitialize(sim, reset); ${initial}`);
source += '\nlet releaseElbowAuditActors; const releaseElbowAuditScenery = () => {}; let releaseElbowAuditInitialize = () => {}; export const setInitialize = fn => { releaseElbowAuditInitialize = fn; }; export const capturedActors = () => releaseElbowAuditActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize } = module.exports;
const noop = () => {};
function context() {
  const target = { measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), captureStart: noop, captureEnd: noop };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seeds = { spinebuster: 11, backbodydrop: 16, scoopslam: 40, powerbomb: 4, clothesline: 19 };


const opening = (shoulder, elbow, palm) => {
  const upper = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const lower = { x: palm.x - elbow.x, y: palm.y - elbow.y };
  return Math.acos(Math.max(-1, Math.min(1, (upper.x * lower.x + upper.y * lower.y) / Math.hypot(upper.x, upper.y) / Math.hypot(lower.x, lower.y)))) * 180 / Math.PI;
};
const bendSide = (rig, arm) => Math.sign((rig.elbows[arm].x - rig.shoulders[arm].x) * (rig.hands[arm].y - rig.shoulders[arm].y) - (rig.elbows[arm].y - rig.shoulders[arm].y) * (rig.hands[arm].x - rig.shoulders[arm].x));
const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const bodyPoints = rig => [rig.head, rig.back, rig.waist, ...rig.headSides, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
// Infer the body's consecutive transform from the actual painted temples and
// waist. Its arms and feet must travel with that same head/trunk transform.
function carryWithBody(point, before, after) {
  const origin = midpoint(before.headSides), next = midpoint(after.headSides);
  const across = { x: before.headSides[1].x - before.headSides[0].x, y: before.headSides[1].y - before.headSides[0].y };
  const down = { x: before.waist.x - origin.x, y: before.waist.y - origin.y };
  const determinant = across.x * down.y - across.y * down.x;
  assert.ok(Math.abs(determinant) > 1, 'the real released body keeps a visible complete width');
  const dx = point.x - origin.x, dy = point.y - origin.y;
  const u = (down.y * dx - down.x * dy) / determinant, v = (-across.y * dx + across.x * dy) / determinant;
  return { x: next.x + u * (after.headSides[1].x - after.headSides[0].x) + v * (after.waist.x - next.x), y: next.y + u * (after.headSides[1].y - after.headSides[0].y) + v * (after.waist.y - next.y) };
}
for (const kind of Object.keys(seeds)) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`${kind}: the complete released body turns together and the caster's elbow opens without folding through itself (${mirrored ? 'mirrored' : 'ordinary'}, ${delta} ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = seeds[kind], planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  // Only the initial layout is controlled. The Scene supplies the incoming
  // opponent, slam, toe pickup, full rotation, release and follow-through.
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: kind === 'clothesline' ? 320 : 525, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: kind === 'clothesline' ? 520 : 300, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let previous, followFrames = 0, rigidFrames = 0, releaseAt;
  for (let elapsed = 0; elapsed < 22000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actors = capturedActors(), caster = actors.get(planned.aggressor), victim = actors.get(planned.victim), exit = sim.exits.get(planned.victim);
    assert.equal(sim.contacts.get(planned.id)?.round?.wrestlingMove?.kind, kind, 'the actual selected move cannot fall back to an unrelated finish');
    const rig = caster.animation.contactPoints, victimRig = victim.animation.contactPoints, rigid = victim.spinRelease?.weight === 1 && !!exit?.spinFlight;
    if (exit?.spinFlight) {
      releaseAt ??= elapsed;
      const age = elapsed - releaseAt, detail = `${kind}/${mirrored}/${delta}ms/${age}ms`;
      assert.ok(caster.carrierRelease, 'the genuine toe release keeps its continuous supporting stance');
      for (let arm = 0; arm < 2; arm++) {
        const angle = opening(rig.shoulders[arm], rig.elbows[arm], rig.hands[arm]);
        assert.ok(angle > 30, `the released forearm cannot fold back onto the upper arm (${angle.toFixed(3)} degrees): arm ${arm}, ${detail}`);
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - caster.scale * 11) < .001 && Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - caster.scale * 10.5) < .001, `both normal arm sections remain joined: ${detail}`);
        if (previous?.releasing) {
          const beforeAngle = opening(previous.caster.shoulders[arm], previous.caster.elbows[arm], previous.caster.hands[arm]);
          if (bendSide(previous.caster, arm) !== bendSide(rig, arm)) assert.ok(Math.max(beforeAngle, angle) > 150, `the elbow changes sides through an open extension: arm ${arm}, ${detail}`);
          for (const key of ['shoulders', 'elbows', 'hands']) assert.ok(distance(rig[key][arm], previous.caster[key][arm]) < 8 + delta * .9, `a released ${key} stays on its continuous path: arm ${arm}, ${detail}`);
        }
      }
      if (rigid && previous?.rigid) {
        bodyPoints(previous.victim).forEach((point, slot) => assert.ok(distance(carryWithBody(point, previous.victim, victimRig), bodyPoints(victimRig)[slot]) < .05, `the head, trunk, arms and feet share the same continuing rotation after the palms open: part ${slot}, ${detail}`));
        rigidFrames++;
      }
      followFrames++;
      if (age >= 600) break;
    }
    previous = { caster: structuredClone(rig), victim: structuredClone(victimRig), rigid, releasing: !!exit?.spinFlight };
  }
  assert.ok(releaseAt !== undefined && followFrames >= (delta === 16 ? 35 : 12) && rigidFrames >= (delta === 16 ? 30 : 10), 'the real release and the complete moving body are checked continuously through 600 ms of follow-through');
});
