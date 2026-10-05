import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Inspect the actual Scene's painted mass, ankles and free-flight stages. The
// fixture selects natural encounters; it supplies no contacts or release clocks.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const initialize = 'const ambient = won ? [] : active.filter';
const flight = "if (flight.stage === 'flight' || flight.stage === 'rim-toss') effects.push";
assert.ok(source.includes(draw) && source.includes(ranks) && source.includes(flight) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'ankleMotionScenery(ctx, clock,')
  .replace(draw, `ankleMotionActors = actors; ${draw}`)
  .replace(ranks, `${ranks} ankleMotionRanks = ranks;`)
  .replace(flight, `ankleMotionStages.set(id, flight.stage); ${flight}`)
  .replace(initialize, `ankleMotionInitialize(sim, reset); ${initialize}`);
source += '\nlet ankleMotionActors, ankleMotionRanks; const ankleMotionStages = new Map(); const ankleMotionScenery = () => {}; let ankleMotionInitialize = () => {}; export const setInitialize = fn => { ankleMotionInitialize = fn; }; export const capture = () => ({ actors: ankleMotionActors, ranks: ankleMotionRanks, stages: ankleMotionStages }); export { render, createArenaCamera, arenaRounds };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture, setInitialize } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;
const fixtures = [['suplex', 42], ['elbow', 12], ['clothesline', 19], ['spinebuster', 11], ['backbodydrop', 16], ['scoopslam', 40], ['powerbomb', 4]];

for (const [kind, seed] of fixtures) for (const mirrored of [false, true]) for (const delta of [16, 50]) {
  test(`${kind} ${mirrored ? 'mirrored' : 'ordinary'} ${delta}ms: ankle-supported body keeps its floor clearance and release momentum`, () => {
    const order = ['2', '1'], duration = 44000;
    const planned = arenaRounds(order, duration, 7, seed)[0];
    assert.equal(planned.wrestlingMove?.kind ?? planned.tactic, kind);
    const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset || !mirrored) return;
      for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
    });
    let previous, release, floorLength, heldFrames = 0, freeFrames = 0, complete = false;
    const fullSpin = !['suplex', 'elbow'].includes(kind);
    for (let elapsed = 0; elapsed < 30000; elapsed += delta) {
      capture().stages.clear(); render(ctx, props, elapsed, elapsed, sim, delta, false);
      const { actors, ranks: actualRanks, stages } = capture(), actual = sim.contacts.get(planned.id)?.round;
      assert.equal(actual?.wrestlingMove?.kind ?? actual?.tactic, kind, 'the natural encounter must complete the selected technique without a fallback');
      if (actualRanks[planned.victim]) { assert.deepEqual(actualRanks, { '1': 2, '2': 1 }); complete = true; break; }
      const caster = actors.get(planned.aggressor), victim = actors.get(planned.victim), exit = sim.exits.get(planned.victim);
      assert.ok(caster?.animation?.contactPoints && victim?.animation?.contactPoints);
      assert.ok(!sim.exits.has(planned.aggressor), 'the supported caster stays in the arena');
      const rig = victim.animation.contactPoints, palms = caster.animation.contactPoints, suspension = victim.spinSuspension;
      const feet = midpoint(rig.feet), waist = rig.waist;
      const released = exit?.spinFlight && exit.launchedAt !== undefined;
      if (suspension && !released) {
        assert.equal(!!suspension.planar, fullSpin, 'only the two grounded drag finishes use a short rim throw');
        floorLength ??= distance(rig.head, feet);
        const sandPlane = Math.max(caster.depthY ?? caster.y, victim.depthY ?? caster.y);
        assert.ok(rig.head.y <= sandPlane + 3, `the supported crown cannot pass through the sand during a lift or swing: ${elapsed}`);
        if (suspension.weight === 1) {
          heldFrames++;
          assert.ok(inside(sim.bodies.get(planned.aggressor)), 'the loaded feet remain inside the sand');
          if (suspension.planar) assert.ok(distance(rig.head, feet) >= floorLength * .5, `${elapsed}: the horizontal swing keeps a recognizable whole body through its depth turn (${distance(rig.head, feet).toFixed(2)} / ${floorLength.toFixed(2)}px)`);
          for (let arm = 0; arm < 2; arm++) {
            assert.ok(distance(palms.hands[arm], rig.feet[caster.ankleGripReversed ? 1 - arm : arm]) < 8, 'both actual ankles stay in their supporting palms');
            assert.ok(Math.abs(distance(palms.shoulders[arm], palms.elbows[arm]) - 11 * caster.scale) < .001);
            assert.ok(Math.abs(distance(palms.elbows[arm], palms.hands[arm]) - 10.5 * caster.scale) < .001);
          }
        }
      }
      if (released) {
        if (!release) {
          assert.ok(previous?.held, 'the hands open directly from the supported body');
          if (fullSpin) assert.ok(Math.abs(caster.pivotTurn) >= Math.PI * 2 - 1e-8, 'the ankle hold completes its real full revolution before the palms open');
          release = { at: exit.launchedAt, waist: { ...waist }, velocity: { ...exit.spinFlight.velocity } };
          const measured = (waist.x - previous.waist.x) * 1000 / (elapsed - previous.at), ratio = measured / release.velocity.x;
          assert.ok(Math.abs(release.velocity.x) > 20 && ratio > .72 && ratio < 1.35, `the final held step cannot stop before the actual release (${measured.toFixed(2)} vs ${release.velocity.x.toFixed(2)}px/s)`);
        }
        const age = elapsed - release.at;
        if (stages.get(planned.victim) === 'flight' && age <= 800) {
          const expectedX = release.waist.x + release.velocity.x * age / 1000;
          assert.ok(Math.abs(waist.x - expectedX) < 1, `the released mass keeps its horizontal momentum instead of accelerating toward a target: ${age}ms/${(waist.x - expectedX).toFixed(2)}px`);
          freeFrames++;
        }
      }
      previous = { at: elapsed, waist: { ...waist }, held: !!suspension && !released };
    }
    assert.ok(complete && release && heldFrames >= 4 && freeFrames >= 4, 'the actual supported stroke, free flight and ranking all finish');
  });
}
