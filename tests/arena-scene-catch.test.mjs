import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual frame loop and painted skeletons. Static scenery is
// skipped so these motion regressions do not require a DOM or canvas package.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw), 'the harness captures the real scene draw loop');
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'motionTestScenery(ctx, clock,')
  .replace(draw, `motionTestActors = actors; ${draw}`)
  .replace('const start = arenaStartingPoint(props.candidates.findIndex(candidate => candidate.id === id), props.candidates.length);', 'const start = motionTestStarts?.get(id) ?? arenaStartingPoint(props.candidates.findIndex(candidate => candidate.id === id), props.candidates.length);');
source += '\nlet motionTestActors, motionTestStarts; const motionTestScenery = () => {}; export const capturedActors = () => motionTestActors; export const controlledStarts = points => { motionTestStarts = points; }; export { render, createArenaCamera, arenaRounds, arenaStartingPoint, arenaFloorExitTiming, arenaRimTargets, arenaRimChargeTargets, arenaTechniqueTargets, arenaRecoveryTargets, arenaCatchTargets }; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaMinimumDuration, arenaCatchTargets, capturedActors, controlledStarts } = module.exports;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const noop = () => {};
const context = () => new Proxy({ measureText: text => ({ width: text.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => (target[key] = value, true) });
function game(order, seed = 31, duration = 44000, { rushRoll = 7, candidateOrder = order, delta = 16 } = {}) {
  duration = Math.max(duration, arenaMinimumDuration(order, rushRoll, seed));
  const props = { candidates: candidateOrder.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, paused: false, preview: false, arenaRushRoll: rushRoll, arenaEscapeSeed: seed };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  const rounds = arenaRounds(order, duration, rushRoll, seed);
  assert.ok(rounds.every(round => round.timeScale >= 1), 'live motion fixtures use the production physical duration');
  return { props, sim, rounds, step(elapsed, paused = false) { render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : delta, false); return capturedActors(); } };
}
function fixture(tactic, { rushRoll = 7, count = 5, predicate, maxSeeds = 80 } = {}) {
  for (let seed = 0; seed < maxSeeds; seed++) for (let variant = 0; variant < 12; variant++) {
    const order = Array.from({ length: count }, (_, i) => `scene-${variant}-${i}`), duration = Math.max(44000, arenaMinimumDuration(order, rushRoll, seed)), rounds = arenaRounds(order, duration, rushRoll, seed);
    const round = rounds.find(round => predicate ? predicate(round) : round.tactic === tactic && !round.recovery && !round.escape && !round.rim);
    if (round) return { order, seed, duration, rushRoll, round };
  }
  assert.fail(`a real ${tactic} scene must remain in the catalog`);
}


for (const [side, cadence] of [[-1, 16], [1, 16], [1, 200], [-1, 400]]) test(`a real catch accepts the incoming body only after both palms touch, then loads and turns in direction ${side} at ${cadence}ms cadence`, () => {
  const found = fixture('catch', { count: 2 }), delta = Math.min(cadence, 50), scene = game(found.order, found.seed, found.duration, { delta }), planned = found.round;
  // Supply ordinary ground spawn positions with a clear runway. All approach,
  // palm contacts and completion gates still execute in the production scene.
  controlledStarts(new Map([[planned.aggressor, { x: 500 + side * 70, y: 425 }], [planned.victim, { x: 500 - side * 70, y: 425 }]]));
  let contacted = false, loaded = false, turned = false, released = false, actual, prior;
  for (let elapsed = 0; elapsed <= planned.resolve + 6000; elapsed += cadence) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.round.chargeSetup || contact.round.tactic !== 'catch') continue;
    actual = contact.round;
    const frame = arenaCatchTargets(actual, elapsed, contact.center), receiver = actors.get(actual.aggressor), charger = actors.get(actual.victim);
    if (!scene.sim.exits.has(actual.victim)) {
      if (prior) for (const [id, body] of [[actual.aggressor, scene.sim.bodies.get(actual.aggressor)], [actual.victim, scene.sim.bodies.get(actual.victim)]]) assert.ok(distance(body, prior.get(id)) < 165 * delta / 1000 + .01, 'contact, load and turn keep the preceding grounded roots continuous');
      prior = new Map([actual.aggressor, actual.victim].map(id => [id, { ...scene.sim.bodies.get(id) }]));
    }
    if (actual.chargeSetup.contactAt === elapsed) {
      const waist = charger.animation.contactPoints.waist, hands = receiver.animation.contactPoints.hands;
      assert.ok(hands.every((hand, arm) => distance(hand, arm ? waist : receiver.secondaryGripTarget) < 7), 'both real palms establish waist contact before receiving the load');
      contacted = true;
    }
    if (frame.stage === 'load') { assert.ok(contacted); assert.equal(frame.height, 0, 'weight is received before lifting'); loaded = true; }
    if (frame.turn > 0 && !scene.sim.exits.has(actual.victim)) { assert.ok(contacted && loaded); turned = true; }
    if (frame.gripStrength > 0 && !scene.sim.exits.has(actual.victim)) {
      const joints = receiver.animation.contactPoints;
      assert.ok(joints.hands.every((hand, arm) => distance(hand, arm ? charger.animation.contactPoints.waist : receiver.secondaryGripTarget) < 8), `both palms support the real body during ${frame.stage} at ${elapsed}ms`);
      joints.hands.forEach((hand, arm) => {
        assert.ok(Math.abs(distance(joints.shoulders[arm], joints.elbows[arm]) - 11 * receiver.scale) < 1e-6);
        assert.ok(Math.abs(distance(joints.elbows[arm], hand) - 10.5 * receiver.scale) < 1e-6, 'support does not grow either arm bone');
      });
      assert.ok(Math.hypot((receiver.x - 500) / 303, ((receiver.depthY ?? receiver.y) - 416) / 112) < 1, 'the thrower stays on the sand');
    }
    if (scene.sim.exits.has(actual.victim)) { assert.ok(contacted && loaded && turned, `the actual contact, load and turn all precede the throw: ${JSON.stringify({ elapsed, contactAt: actual.chargeSetup.contactAt, contacted, loaded, turned })}`); released = true; break; }
  }
  assert.ok(contacted && loaded && turned && released, `a complete actual catch is required: ${JSON.stringify({found, actual, contacted, loaded, turned, released})}`);
});
