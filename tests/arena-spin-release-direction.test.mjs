import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the actual contact gates, rendered limbs and free-flight calculation.
// Only scenery is omitted; reflection changes the initial field before play.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'spinDirectionScenery(ctx, clock,')
  .replace(draw, `spinDirectionActors = actors; ${draw}`)
  .replace(initialize, `spinDirectionInitialize(sim, reset); ${initialize}`);
source += '\nlet spinDirectionActors; const spinDirectionScenery = () => {}; let spinDirectionInitialize = () => {}; export const setInitialize = fn => { spinDirectionInitialize = fn; }; export const capturedActors = () => spinDirectionActors; export { render, createArenaCamera, arenaRounds };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, setInitialize, capturedActors } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const armPoints = rig => [...rig.shoulders, ...rig.elbows, ...rig.hands];

for (const [kind, seed] of [['backbodydrop', 16], ['scoopslam', 40], ['powerbomb', 4]]) for (const mirrored of [false, true]) for (const delta of [16, 50]) {
  test(`${kind} ${mirrored ? 'mirrored' : 'ordinary'} ${delta}ms: released arms follow the actual flight direction with connected normal bones`, () => {
    const order = ['2', '1'], duration = 44000;
    const planned = arenaRounds(order, duration, 7, seed)[0];
    assert.equal(planned.wrestlingMove?.kind, kind);
    const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset) return;
      const receiver = { x: 525, y: 416 };
      const runner = { x: 300, y: 416 };
      Object.assign(sim.bodies.get(planned.aggressor), receiver); Object.assign(sim.bodies.get(planned.victim), runner);
      for (const body of sim.bodies.values()) {
        if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
        body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
      }
    });
    let previous, releaseSeen = false, followFrames = 0, releasedFrames = 0, maxFollowProjection = -Infinity;
    for (let elapsed = 0; elapsed < 22000; elapsed += delta) {
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      const actors = capturedActors(), caster = actors.get(planned.aggressor), victim = actors.get(planned.victim), actual = sim.contacts.get(planned.id)?.round;
      assert.equal(actual?.wrestlingMove?.kind, kind, 'the meaningful fixture completes the selected move without a fallback');
      assert.ok(caster?.animation?.contactPoints && victim?.animation?.contactPoints);
      const rig = caster.animation.contactPoints, exit = sim.exits.get(planned.victim);
      if (!exit && victim.spinSuspension) {
        const palms = midpoint(rig.hands), ankles = midpoint(victim.animation.contactPoints.feet);
        assert.ok(distance(palms, ankles) < 8, 'the actual two-ankle support remains connected immediately before release');
      }
      if (exit) {
        assert.ok(exit.spinFlight && Number.isFinite(exit.launchedAt), 'the release uses the actual tangential free-flight calculation');
        const age = elapsed - exit.launchedAt;
        const velocity = exit.spinFlight.velocity, length = Math.hypot(velocity.x, velocity.y), direction = { x: velocity.x / length, y: velocity.y / length };
        assert.ok(Math.abs(velocity.x) > 80 && Math.abs(velocity.x) > Math.abs(velocity.y) * 3, 'the measured release really travels left or right');
        assert.ok(caster.carrierRelease, 'the supported arms enter the continuous release motion');
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * caster.scale) < .001, 'release preserves the complete upper arm');
          assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * caster.scale) < .001, 'release preserves the complete forearm');
        }
        if (previous) armPoints(rig).forEach((point, index) => assert.ok(distance(point, previous[index]) < (delta === 16 ? 22.4 : 53), `the held-to-free arm cannot snap during its directional follow-through: ${kind}/${mirrored}/${delta}/${age}/${index}`));
        if (age >= 100 && age <= 260) {
          const hands = midpoint(rig.hands), shoulders = midpoint(rig.shoulders);
          const projection = (hands.x - shoulders.x) * direction.x + (hands.y - shoulders.y) * direction.y;
          assert.ok(projection > 4, `the painted hands must follow the actual free-flight velocity rather than the caster's previous facing: ${JSON.stringify({ kind, mirrored, delta, age, velocity, facing: caster.facing, hands, shoulders, projection })}`);
          maxFollowProjection = Math.max(maxFollowProjection, projection); followFrames++;
        }
        releaseSeen = true; releasedFrames++;
        if (age >= 750) break;
      }
      previous = structuredClone(armPoints(rig));
    }
    assert.ok(releaseSeen && followFrames >= (delta === 16 ? 6 : 2) && releasedFrames >= (delta === 16 ? 45 : 15) && maxFollowProjection > 12, 'the real scene exercises the directional support, release and arm recovery through its final 750ms guard recovery');
  });
}
