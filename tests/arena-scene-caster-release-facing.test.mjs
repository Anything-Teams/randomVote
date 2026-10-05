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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'releaseFacingAuditScenery(ctx, clock,')
  .replace(draw, `releaseFacingAuditActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.captureStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.captureEnd(); });`)
  .replace(initial, `releaseFacingAuditInitialize(sim, reset); ${initial}`);
source += '\nlet releaseFacingAuditActors; const releaseFacingAuditScenery = () => {}; let releaseFacingAuditInitialize = () => {}; export const setInitialize = fn => { releaseFacingAuditInitialize = fn; }; export const capturedActors = () => releaseFacingAuditActors; export { render, createArenaCamera, arenaRounds };';
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

const center = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const materialLegs = actor => {
  // These grounded casters use the painter's ordinary root matrix. Their
  // depth turn is already present in the actual hips and knee coordinates.
  assert.ok(Math.abs(actor.angle) < .001, 'the caster remains planted through its release');
  const project = point => ({ x: actor.x + point.x * actor.scale * actor.facing, y: actor.y - 2 * actor.scale + point.y * actor.scale });
  const skeleton = actor.animation.skeleton;
  return { hips: skeleton.hips.map(project), knees: skeleton.knees.map(project), feet: actor.animation.contactPoints.feet.map(point => ({ ...point })) };
};
for (const kind of Object.keys(seeds)) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`${kind}: the ankle caster follows the real exit with its chest and its same material legs (${mirrored ? 'mirrored' : 'ordinary'}, ${delta} ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = seeds[kind], planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  // Alter only the initial ground layout. The full move, genuine toe hold,
  // final angular stroke and its actual free-flight derivative are production.
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: kind === 'clothesline' ? 320 : 525, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: kind === 'clothesline' ? 520 : 300, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let previous, releaseAt, cleanupChecked = false, heldFrames = 0, directedFrames = 0, releaseFrames = 0;
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actor = capturedActors().get(planned.aggressor), victim = capturedActors().get(planned.victim), exit = sim.exits.get(planned.victim);
    const rig = actor?.animation?.contactPoints, actual = sim.contacts.get(planned.id)?.round;
    assert.ok(rig && actor.animation.skeleton && actual?.wrestlingMove, 'the selected actual move retains its surviving painted caster');
    const legs = actor.ankleThrowProgress !== undefined || exit?.spinFlight ? materialLegs(actor) : undefined, detail = `${kind}/${mirrored}/${delta}ms/${elapsed}`;
    if (actor.ankleThrowProgress !== undefined && !exit) {
      heldFrames++;
      rig.hands.forEach((palm, arm) => assert.ok(distance(palm, victim.animation.contactPoints.feet[arm]) < 8, `the continuous body turn retains each genuine held toe until hand opening: ${detail}`));
    }
    if (exit?.spinFlight) {
      const first = releaseAt === undefined;
      releaseAt ??= elapsed; releaseFrames++;
      const velocity = exit.spinFlight.velocity, direction = Math.sign(velocity.x), age = elapsed - releaseAt;
      assert.ok(Math.abs(velocity.x) > Math.abs(velocity.y) * 3, 'the actual released mass exits along the horizontal tangent');
      if (!actor.carrierRelease) {
        assert.ok(previous?.releasing && age >= 450, 'the real post-throw stance finishes before returning to its next ordinary pose');
        // Far/near array names may change when the throw plane ends. Follow
        // each physical hip into its new slot together with its knee and heel.
        const permutations = [[0, 1], [1, 0]], mapping = permutations.reduce((best, slots) =>
          slots.reduce((sum, slot, leg) => sum + distance(previous.legs.hips[leg], legs.hips[slot]), 0)
          < best.reduce((sum, slot, leg) => sum + distance(previous.legs.hips[leg], legs.hips[slot]), 0) ? slots : best);
        mapping.forEach((slot, leg) => {
          assert.ok(distance(previous.legs.hips[leg], legs.hips[slot]) < 10.5, `the physical hip remains continuous when ordinary stance names replace the throw slots: ${detail}`);
          assert.ok(distance(previous.legs.knees[leg], legs.knees[slot]) < 8 + delta * .5, `the same physical knee follows its own hip through the end of the throw: ${detail}`);
          assert.ok(distance(previous.legs.feet[leg], legs.feet[slot]) < 8 + delta * .15, `ending the throw plane cannot attach a planted heel to the opposite hip: ${detail}`);
        });
        cleanupChecked = true;
        break;
      }
      assert.ok(actor.carrierRelease, 'the caster carries its true release pose into the follow-through');
      assert.equal(actor.carrierRelease.direction, direction, 'the follow-through uses the actual free-flight direction');
      assert.ok(Math.abs(actor.pivotTurn) >= Math.PI * 2, 'changing the caster facing cannot shorten the genuine full ankle revolution');
      assert.ok(!sim.exits.has(planned.aggressor), 'turning toward the release cannot eliminate its caster');
      if (first) {
        assert.ok(previous?.held, 'the first release follows the last genuine held frame');
        for (const key of ['hips', 'knees']) legs[key].forEach((point, leg) => assert.ok(distance(point, previous.legs[key][leg]) < 10.5, `the caster cannot exchange its two material ${key} when it turns toward the flying opponent: leg ${leg}, ${detail}`));
      }
      if (previous) {
        for (const key of ['hips', 'knees']) legs[key].forEach((point, leg) => assert.ok(distance(point, previous.legs[key][leg]) < 8 + delta * .5, `the material ${key} remain continuous throughout body recovery: leg ${leg}, ${detail}`));
        legs.feet.forEach((point, leg) => assert.ok(distance(point, previous.legs.feet[leg]) < 10 + delta * .35, `each same support sole remains at its actual landing instead of mirroring to the other leg: leg ${leg}, ${detail}`));
        for (const key of ['headSides', 'shoulders', 'elbows', 'hands']) rig[key].forEach((point, slot) => assert.ok(distance(point, previous.rig[key][slot]) < 8 + delta * .9, `the ${key} cannot mirror instantaneously when release direction changes: ${detail}`));
      }
      if (age >= 80 && age <= 260) {
        directedFrames++;
        const head = center(rig.headSides), paintedForwardLean = (head.x - rig.waist.x) * direction;
        assert.ok(paintedForwardLean > .2 * actor.scale, `the actual painted head and chest must lean toward the flying opponent instead of maintaining the former rush facing (lean ${paintedForwardLean.toFixed(3)}px): ${detail}`);
      }
      const skeleton = actor.animation.skeleton;
      for (let leg = 0; leg < 2; leg++) {
        assert.ok(distance(skeleton.hips[leg], skeleton.knees[leg]) <= 11.001 && distance(skeleton.knees[leg], skeleton.feet[leg]) <= 11.001, `following the real release keeps both normal connected leg sections: ${detail}`);
      }
    }
    previous = { held: actor.ankleThrowProgress !== undefined && !exit, releasing: !!actor.carrierRelease, rig: structuredClone(rig), legs };
  }
  assert.ok(releaseAt !== undefined && heldFrames >= (delta === 16 ? 55 : 17), 'the complete actual held revolution ends in its genuine free flight');
  assert.ok(directedFrames >= (delta === 16 ? 10 : 4) && releaseFrames >= (delta === 16 ? 28 : 10), 'the real painted forward lean and subsequent supporting stance remain visible through recovery');
  assert.ok(cleanupChecked, 'the actual throw reaches its ordinary-stance handoff with both whole physical legs intact');
});
