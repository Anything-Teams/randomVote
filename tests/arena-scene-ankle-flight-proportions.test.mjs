import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Run actual encounters from their natural layout through the complete flight.
// Mirroring the initial layout does not supply a contact, grip or release clock.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(ranks) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'flightScenery(ctx, clock,')
  .replace(draw, `flightActors = actors; ${draw}`)
  .replace(ranks, `${ranks} flightRanks = ranks;`)
  .replace(initialize, `flightInitialize(sim, reset); ${initialize}`);
source += '\nlet flightActors, flightRanks; const flightScenery = () => {}; let flightInitialize = () => {}; export const setInitialize = fn => { flightInitialize = fn; }; export const capture = () => ({ actors: flightActors, ranks: flightRanks }); export { render, createArenaCamera, arenaRounds };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, setInitialize, capture } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const project = (matrix, p) => ({ x: matrix[0] * p.x + matrix[2] * p.y + matrix[4], y: matrix[1] * p.x + matrix[3] * p.y + matrix[5] });
const smooth = value => { const p = Math.min(1, Math.max(0, value)); return p * p * (3 - 2 * p); };
const parts = rig => [rig.head, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];

for (const [kind, seed] of [['powerbomb', 4], ['backbodydrop', 16], ['spinebuster', 11], ['scoopslam', 40], ['clothesline', 19]]) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`${kind}: an ankle release opens into a complete airborne body without changing its mass trajectory (${mirrored ? 'mirrored' : 'natural'}, ${delta} ms)`, () => {
  const order = ['2', '1'], duration = 44000, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ec8360' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset || !mirrored) return;
    for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.animation = undefined; }
  });
  let release, firstLength, previous, steadyFrames = 0, completed = false, softened = false;
  for (let elapsed = 0; elapsed < 25000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const { actors, ranks } = capture(), exit = sim.exits.get(planned.victim), victim = actors.get(planned.victim);
    const window = sim.contacts.get(planned.id)?.round.wrestlingMove;
    assert.equal(window?.kind, kind, 'the real incoming contact cannot be replaced by an unrelated ordinary throw');
    if (exit?.spinFlight && elapsed - exit.launchedAt < exit.spinFlight.duration) {
      assert.equal(exit.spinSnapshot.planar, true, 'the fixture exercises the complete horizontal ankle turn');
      release ??= structuredClone(exit);
      const age = elapsed - exit.launchedAt, snapshot = victim.spinRelease.snapshot, matrix = snapshot.matrix;
      const width = Math.hypot(matrix[0], matrix[1]) / victim.scale, length = Math.hypot(matrix[2], matrix[3]) / victim.scale;
      const original = exit.spinSnapshot.matrix, originalWidth = Math.hypot(original[0], original[1]) / victim.scale, originalLength = Math.hypot(original[2], original[3]) / victim.scale;
      firstLength ??= originalLength;
      const weight = smooth(age / 300);
      assert.ok(Math.abs(width - (originalWidth + (1 - originalWidth) * weight)) < 1e-8 && Math.abs(length - (originalLength + (1 - originalLength) * weight)) < 1e-8, 'the complete painted body leaves its depth projection gradually, instead of keeping a squashed head, shorts and limbs for the whole flight');
      const rig = victim.animation.contactPoints, time = age / 1000;
      assert.ok(Math.abs(victim.x - (exit.origin.x + exit.spinFlight.velocity.x * time)) < 1e-8 && Math.abs(victim.y - (exit.origin.y - exit.lift + exit.spinFlight.velocity.y * time + .5 * exit.spinFlight.gravity * time * time)) < 1e-8, 'restoring readable pixels cannot move the ballistic flight root');
      const mass = { x: exit.spinFlight.center.x + victim.x - exit.spinSnapshot.origin.x, y: exit.spinFlight.center.y + victim.y - exit.spinSnapshot.origin.y };
      assert.ok(distance(rig.waist, mass) < 1e-8, 'the exact measured waist stays on the same mass trajectory through expansion and rotation');
      assert.deepEqual(exit.spinSnapshot, release.spinSnapshot, 'the reusable release skeleton is immutable');
      assert.deepEqual(exit.spinFlight, release.spinFlight, 'velocity, rotation speed, landing duration and gravity remain the actual release values');
      assert.deepEqual(exit.landing, release.landing, 'the side rim destination does not change');
      assert.equal(ranks[planned.victim], undefined, 'restoring body proportions cannot publish the victim rank before actual landing');
      if (age === 0) {
        assert.deepEqual(matrix, original, 'the first free frame preserves the exact held silhouette');
        assert.deepEqual(snapshot.feet, exit.spinSnapshot.feet); assert.deepEqual(snapshot.hands, exit.spinSnapshot.hands);
      }
      if (age >= 300) {
        const skeleton = victim.animation.skeleton;
        for (let limb = 0; limb < 2; limb++) {
          for (const [a, b, length] of [[project(matrix, skeleton.hips[limb]), project(matrix, skeleton.knees[limb]), 11], [project(matrix, skeleton.knees[limb]), project(matrix, skeleton.feet[limb]), 11], [rig.shoulders[limb], rig.elbows[limb], 11], [rig.elbows[limb], rig.hands[limb], 10.5]]) assert.ok(Math.abs(distance(a, b) - length * victim.scale) < 1e-6, 'each thigh, shin, upper arm and forearm has its ordinary complete length after leaving the ground plane');
        }
        softened ||= snapshot.hands.some((point, arm) => distance(point, exit.spinSnapshot.hands[arm]) > .5);
        steadyFrames++;
      }
      if (previous) {
        const translate = { x: rig.waist.x - previous.waist.x, y: rig.waist.y - previous.waist.y };
        parts(rig).forEach((point, i) => assert.ok(distance(point, { x: parts(previous)[i].x + translate.x, y: parts(previous)[i].y + translate.y }) < delta * .85 + 2, 'expanding and rotating the same joined body cannot teleport a limb between consecutive playback frames'));
      }
      previous = structuredClone(rig);
    }
    if (ranks[planned.victim]) { assert.deepEqual(ranks, { '1': 2, '2': 1 }); completed = true; break; }
  }
  assert.ok(completed && steadyFrames >= (delta === 16 ? 20 : 6), 'the entire received slam, ankle revolution, free flight and actual rank completion are exercised');
  assert.ok(firstLength < .55, 'the regression reproduces the approximately half-length release that previously stayed visibly compressed');
  assert.ok(softened, 'the unconscious arms loosen after release instead of keeping the identical rigid loaded pose');
});
