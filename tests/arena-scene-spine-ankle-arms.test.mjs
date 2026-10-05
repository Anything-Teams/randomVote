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

const opening = (shoulder, elbow, palm) => {
  const upper = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const forearm = { x: palm.x - elbow.x, y: palm.y - elbow.y };
  const cosine = (upper.x * forearm.x + upper.y * forearm.y) / (Math.hypot(upper.x, upper.y) * Math.hypot(forearm.x, forearm.y));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
};
const bendSide = (shoulder, elbow, palm) => Math.sign((elbow.x - shoulder.x) * (palm.y - shoulder.y) - (elbow.y - shoulder.y) * (palm.x - shoulder.x));

for (const kind of ['spinebuster', 'backbodydrop']) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`${kind}: reaching for the floored opponent's ankles cannot fold either forearm back through its upper arm (${mirrored ? 'mirrored' : 'ordinary'}, ${delta} ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = seeds[kind];
  const planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  // Lay out an actual incoming opponent before the Scene makes contact. The
  // selected move, recovery, hand targets and pickup clock remain production.
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let reachingFrames = 0, loadedFrames = 0, pickupSeen = false, pickupAt, released = false, previous;
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actor = capturedActors().get(planned.aggressor), victim = capturedActors().get(planned.victim);
    const actual = sim.contacts.get(planned.id)?.round;
    assert.ok(actor?.animation?.contactPoints && victim?.animation?.contactPoints, 'both actual painted fighters remain visible');
    const rig = actor.animation.contactPoints;
    const reaching = actor.ankleApproach !== undefined && actor.pivotTurn === undefined;
    const loading = pickupAt != null && elapsed - pickupAt <= 600 && actor.ankleThrowProgress !== undefined;
    if (reaching) reachingFrames++;
    if (loading) loadedFrames++;
    if (reaching || loading) {
      const detail = `${kind}/${mirrored}/${delta}ms/${elapsed}/reach ${actor.ankleApproach}`;
      for (let arm = 0; arm < 2; arm++) {
        const angle = opening(rig.shoulders[arm], rig.elbows[arm], rig.hands[arm]);
        assert.ok(angle > 20, `the palm must reach around its shoulder, never return to it with the forearm folded onto the upper arm (${angle.toFixed(4)} degrees): arm ${arm}, ${detail}`);
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * actor.scale) < .001, `the reaching upper arm keeps its normal connected bone: ${detail}`);
        assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * actor.scale) < .001, `the reaching forearm keeps its normal connected bone: ${detail}`);
        if (previous?.supported) {
          const before = previous.rig, beforeAngle = opening(before.shoulders[arm], before.elbows[arm], before.hands[arm]);
          if (bendSide(before.shoulders[arm], before.elbows[arm], before.hands[arm]) !== bendSide(rig.shoulders[arm], rig.elbows[arm], rig.hands[arm])) {
            assert.ok(Math.max(beforeAngle, angle) > 150, `an elbow can change sides through extension, not by folding backwards: arm ${arm}, ${detail}`);
          }
          for (const key of ['shoulders', 'elbows', 'hands']) assert.ok(distance(rig[key][arm], before[key][arm]) < 8 + delta * .9, `the ${key} cannot jump to a different side of the reach: arm ${arm}, ${detail}`);
        }
      }
    }
    if (!pickupSeen && actor.ankleThrowProgress !== undefined && !sim.exits.has(planned.victim)) {
      pickupSeen = true; pickupAt = elapsed;
      assert.ok(actual.wrestlingMove.ankleGripAt != null, 'the real four-contact gate schedules the pickup');
      rig.hands.forEach((palm, arm) => {
        assert.ok(distance(palm, victim.animation.contactPoints.feet[arm]) < 5, 'both actual palms reach the actual ankle endpoints before rotation begins');
        // Measure in front of the actual inclined chest, rather than a
        // vertical line through its forward shoulder. A lowered elbow can
        // sit slightly behind that shoulder while still bracing in front.
        const chest = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 };
        const up = { x: chest.x - rig.waist.x, y: chest.y - rig.waist.y }, length = Math.hypot(up.x, up.y);
        const front = { x: -up.y / length * actor.facing, y: up.x / length * actor.facing };
        const elbow = rig.elbows[arm];
        assert.ok((elbow.x - chest.x) * front.x + (elbow.y - chest.y) * front.y > -.5 * actor.scale, `the low ankle hold keeps the elbow on the front of the inclined chest: arm ${arm}, ${kind}/${mirrored}/${delta}ms/${elapsed}`);
      });
    }
    previous = { supported: reaching || loading || pickupAt === elapsed, rig: structuredClone(rig) };
    if (sim.exits.has(planned.victim)) { released = true; break; }
  }
  assert.ok(released && pickupSeen && reachingFrames >= (delta === 16 ? 12 : 5) && loadedFrames >= (delta === 16 ? 20 : 8), `${kind}/${mirrored}/${delta}ms exercises the complete ankle reach, genuine pickup and release`);
});
