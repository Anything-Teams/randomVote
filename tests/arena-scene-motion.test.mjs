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
  .replace(draw, `motionTestActors = actors; ${draw}`);
source += '\nlet motionTestActors; const motionTestScenery = () => {}; export const capturedActors = () => motionTestActors; export { render, createArenaCamera, arenaRounds };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors } = module.exports;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const noop = () => {};
const context = () => new Proxy({ measureText: text => ({ width: text.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => (target[key] = value, true) });
function game(order, seed = 31, duration = 44000) {
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, paused: false, preview: false, arenaRushRoll: 7, arenaEscapeSeed: seed };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { props, sim, rounds: arenaRounds(order, duration, 7, seed), step(elapsed, paused = false) { render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : 16, false); return capturedActors(); } };
}
function fixture(tactic) {
  for (let seed = 0; seed < 80; seed++) for (let variant = 0; variant < 12; variant++) {
    const order = Array.from({ length: 5 }, (_, i) => `scene-${variant}-${i}`), rounds = arenaRounds(order, 44000, 7, seed);
    const round = rounds.find(round => round.tactic === tactic && !round.recovery && !round.escape && !round.rim);
    if (round) return { order, seed, round };
  }
  assert.fail(`a real ${tactic} scene must remain in the catalog`);
}

test('a live sidekick never throws its opponent before the recorded sole contact even when the approach passes the planned impact', () => {
  const scene = game(Array.from({ length: 5 }, (_, i) => `review-2-${i}`)), round = scene.rounds.find(round => round.tactic === 'sidekick');
  assert.ok(round);
  let launched = false, contactAt;
  for (let elapsed = 0; elapsed < round.resolve; elapsed += 16) {
    scene.step(elapsed);
    const actual = scene.sim.contacts.get(round.id)?.round;
    if (!actual) continue;
    const launch = actual.sidekickLaunchAt;
    if (Number.isFinite(launch)) contactAt = launch + Math.min(650 * Math.min(1, actual.timeScale ?? 1), (actual.impact - actual.start) * .68) * .5;
    const exit = scene.sim.exits.get(round.victim);
    if (exit) { assert.ok(Number.isFinite(contactAt) && elapsed >= contactAt, 'the ranking clock cannot launch the opponent before a real sole contact'); assert.equal(exit.launchedAt, contactAt); launched = true; }
  }
  assert.ok(launched && contactAt < round.resolve, 'the physical kick happens before the unchanged ranking reveal');
});

test('a live slammed body stays grounded through pickup and drag while both hands track its actual feet', () => {
  const { order, seed, round } = fixture('suplex'), scene = game(order, seed);
  let previous, pickupSeen = false, dragSeen = false, maxHandGap = 0;
  for (let elapsed = 0; elapsed < round.impact + 2590 * round.timeScale; elapsed += 16) {
    const actors = scene.step(elapsed), exit = scene.sim.exits.get(round.victim);
    if (!exit || elapsed < round.impact) continue;
    const victim = actors.get(round.victim), driver = actors.get(round.aggressor), body = scene.sim.bodies.get(round.victim);
    const age = (elapsed - round.impact) / round.timeScale;
    assert.ok(Math.abs(victim.y - body.y) < 1e-8 && victim.depthY === body.y, 'pickup never lowers the body below its prescribed floor anchor');
    if (age < 900) { if (previous) assert.ok(distance(body, previous.body) < 1e-8, 'the stunned opponent cannot slide toward the hands during the pickup'); }
    else { dragSeen = true; if (previous) assert.ok(distance(body, previous.body) <= 2.65, 'the shared drag follows the bounded floor speed'); }
    if (driver.gripMode === 'ankle' && driver.gripStrength === 1 && driver.gripLocked) {
      pickupSeen = true;
      const feet = victim.animation.contactPoints.feet, hands = driver.animation.contactPoints.hands;
      maxHandGap = Math.max(maxHandGap, ...feet.map((foot, i) => distance(foot, hands[1 - i])));
    }
    previous = { body: { x: body.x, y: body.y } };
  }
  assert.ok(pickupSeen && dragSeen);
  assert.ok(maxHandGap < 5, `both palms follow the real toes throughout the floor pull (max gap ${maxHandGap.toFixed(2)}px)`);
});

test('a live elbow counter leaves its stunned opponent at the hit and the holder walks to those feet', () => {
  const { order, seed, round } = fixture('elbow'), scene = game(order, seed);
  let fallen, lastDriver, movedTowardFeet = false, gripSeen = false, maxHandGap = 0;
  for (let elapsed = 0; elapsed < round.resolve; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(round.id);
    if (!contact?.elbowFall) continue;
    if (elapsed >= round.impact) {
      assert.ok(actors.get(round.victim)?.candidate, 'the thrown opponent keeps a valid painted actor after leaving the active fighter list');
      continue;
    }
    fallen ??= { ...contact.elbowFall };
    const body = scene.sim.bodies.get(round.victim), victim = actors.get(round.victim), driver = actors.get(round.aggressor);
    assert.ok(distance(body, fallen) < 1e-8, 'only the holder moves toward the grip; the victim stays where the head hit occurred');
    if (lastDriver && distance(driver, lastDriver) > .1) movedTowardFeet = true;
    if (driver.gripMode === 'ankle' && driver.gripStrength === 1 && driver.gripLocked) {
      gripSeen = true;
      const feet = victim.animation.contactPoints.feet, hands = driver.animation.contactPoints.hands;
      maxHandGap = Math.max(maxHandGap, ...feet.map((foot, i) => distance(foot, hands[1 - i])));
    }
    lastDriver = { x: driver.x, y: driver.y };
  }
  assert.ok(fallen && movedTowardFeet && gripSeen, 'the counter includes a grounded fall, an actual approach, and a visible ankle grip');
  assert.ok(maxHandGap < 5, `the actual ankle lift maintains both palm contacts (max gap ${maxHandGap.toFixed(2)}px)`);
});
