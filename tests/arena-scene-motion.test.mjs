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
source += '\nlet motionTestActors; const motionTestScenery = () => {}; export const capturedActors = () => motionTestActors; export { render, createArenaCamera, arenaRounds, arenaStartingPoint, arenaFloorExitTiming, arenaRimTargets, arenaRimChargeTargets }; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaStartingPoint, arenaMinimumDuration, arenaFloorExitTiming, arenaRimTargets, arenaRimChargeTargets, capturedActors } = module.exports;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const noop = () => {};
const context = () => new Proxy({ measureText: text => ({ width: text.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => (target[key] = value, true) });
function game(order, seed = 31, duration = 44000, { rushRoll = 7, candidateOrder = order } = {}) {
  duration = Math.max(duration, arenaMinimumDuration(order, rushRoll, seed));
  const props = { candidates: candidateOrder.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, paused: false, preview: false, arenaRushRoll: rushRoll, arenaEscapeSeed: seed };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  const rounds = arenaRounds(order, duration, rushRoll, seed);
  assert.ok(rounds.every(round => round.timeScale >= 1), 'live motion fixtures use the production physical duration');
  return { props, sim, rounds, step(elapsed, paused = false) { render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : 16, false); return capturedActors(); } };
}
function fixture(tactic, { rushRoll = 7, count = 5, predicate } = {}) {
  for (let seed = 0; seed < 80; seed++) for (let variant = 0; variant < 12; variant++) {
    const order = Array.from({ length: count }, (_, i) => `scene-${variant}-${i}`), duration = Math.max(44000, arenaMinimumDuration(order, rushRoll, seed)), rounds = arenaRounds(order, duration, rushRoll, seed);
    const round = rounds.find(round => predicate ? predicate(round) : round.tactic === tactic && !round.recovery && !round.escape && !round.rim);
    if (round) return { order, seed, duration, rushRoll, round };
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

// The scene reads the last painted skeleton before the next frame's movement.
// Copy these points because its animation state is intentionally mutable.
function snapshot(scene) {
  return new Map([...scene.sim.bodies].map(([id, body]) => [id, {
    x: body.x, y: body.y,
    contacts: body.animation?.contactPoints ? structuredClone(body.animation.contactPoints) : undefined,
  }]));
}
const waistGap = (holder, opponent) => Math.min(...holder.contacts.hands.map(hand => distance(hand, opponent.contacts.waist)));

for (const rushRoll of [0, 7]) test(`live pair rush roll ${rushRoll} waits at its actual origin until both painted hands reach the opponent's waist`, () => {
  const found = fixture('pair rush', { rushRoll, predicate: round => !!round.rushOutcome }), scene = game(found.order, found.seed, found.duration, { rushRoll }), round = found.round;
  let waited = false, launched = false, origin, lastState;
  for (let elapsed = 0; elapsed < round.impact; elapsed += 16) {
    const previous = snapshot(scene);
    scene.step(elapsed);
    const contact = scene.sim.contacts.get(round.id), actual = contact?.round;
    if (!contact?.started) continue;
    const chargerId = actual.rushOutcome === 'counter-throw' ? actual.victim : actual.aggressor;
    const firstId = actual.rushOutcome === 'counter-throw' ? actual.aggressor : actual.victim;
    const firstNow = snapshot(scene).get(firstId), secondNow = snapshot(scene).get(actual.helper);
    lastState = { elapsed, seed: found.seed, order: found.order, duration: found.duration, round: actual, waited, launched, first: firstNow, second: secondNow, waistGaps: firstNow?.contacts && secondNow?.contacts ? [waistGap(firstNow, secondNow), waistGap(secondNow, firstNow)] : undefined };
    if (actual.rushLaunchAt === null) {
      origin ??= { ...contact.chargerOrigin };
      assert.ok(distance(scene.sim.bodies.get(chargerId), origin) < 1e-8, `waiting charger moves before the pair grip at ${elapsed}ms`);
      waited = true;
    } else if (Number.isFinite(actual.rushLaunchAt) && !launched) {
      const first = previous.get(firstId), second = previous.get(actual.helper);
      assert.ok(first?.contacts && second?.contacts, 'launch requires actual painted skeletons from the preceding frame');
      const firstGap = waistGap(first, second), secondGap = waistGap(second, first);
      assert.ok(firstGap < 16 && secondGap < 16 && distance(first, second) < 70 && Math.abs(first.y - second.y) < 34, `launch ${elapsed}ms: waist gaps ${firstGap.toFixed(2)}/${secondGap.toFixed(2)}px, roots ${distance(first, second).toFixed(2)}px`);
      assert.equal(actual.rushLaunchAt, elapsed);
      assert.ok(distance(contact.center, { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }) < 1e-8, 'the charger aims at the two actual fighters rather than a scripted center');
      launched = true;
      break;
    }
  }
  assert.ok(waited && launched, `${round.id}: both a visible wait and a physical launch must occur before collision: ${JSON.stringify(lastState)}`);
});

test('a live rim push cannot apply pressure until a painted palm reaches the opponent', () => {
  const found = fixture('rim', { predicate: round => !!round.rim }), scene = game(found.order, found.seed, found.duration), round = found.round;
  let waitingSeen = false, pressureSeen = false, contactSeen = false, placed = false, lastState;
  for (let elapsed = 0; elapsed < round.rim.end; elapsed += 16) {
    if (!placed && elapsed >= round.rim.start - 2400 * round.timeScale - 16 && !scene.sim.contacts.has(round.id)) {
      // A central meeting deliberately omits this optional story. Put the
      // still-free fighters at a valid rim before the real contact is made.
      for (const [id, x] of [[round.aggressor, 650], [round.victim, 750]]) {
        Object.assign(scene.sim.bodies.get(id), { x, y: 416, motorX: 0, motorY: 0, roam: undefined });
      }
      placed = true;
    }
    const previous = snapshot(scene), actors = scene.step(elapsed), contact = scene.sim.contacts.get(round.id), actual = contact?.round;
    lastState = { elapsed, fixture: found, contact: contact ? { started: contact.started, rimOrigins: contact.rimOrigins, round: actual } : undefined, waitingSeen, contactSeen, pressureSeen };
    if (!contact?.rimOrigins || elapsed < actual.rim.start) continue;
    const rim = arenaRimTargets(actual, elapsed, contact.center, contact.rimOrigins);
    const driverNow = snapshot(scene).get(actual.aggressor), defenderNow = snapshot(scene).get(actual.victim);
    lastState = { elapsed, seed: found.seed, order: found.order, duration: found.duration, rim, round: actual, waitingSeen, contactSeen, pressureSeen, driver: driverNow, defender: defenderNow, gap: driverNow?.contacts && defenderNow?.contacts ? Math.min(...driverNow.contacts.hands.flatMap(hand => [...defenderNow.contacts.shoulders, defenderNow.contacts.waist].map(point => distance(hand, point)))) : undefined };
    if (actual.rim.contactAt === null) {
      waitingSeen = true;
      assert.equal(rim.pressure, 0);
      assert.equal(actors.get(actual.aggressor).phase, 0, 'only the approach runs while the physical palm contact is missing');
      if (previous.has(actual.victim)) assert.ok(distance(scene.sim.bodies.get(actual.victim), previous.get(actual.victim)) < 2.3, 'the uncontacted defender only takes bounded approach steps');
    } else if (!contactSeen) {
      const driver = previous.get(actual.aggressor), defender = previous.get(actual.victim);
      const gap = Math.min(...driver.contacts.hands.flatMap(hand => [...defender.contacts.shoulders, defender.contacts.waist].map(point => distance(hand, point))));
      assert.ok(gap < 10 && distance(driver, defender) < 72, `rim pressure starts at ${elapsed}ms with actual palm gap ${gap.toFixed(2)}px`);
      assert.equal(actual.rim.contactAt, elapsed);
      contactSeen = true;
    }
    if (rim.pressure > 0) { assert.ok(contactSeen); pressureSeen = true; }
  }
  assert.ok(waitingSeen && contactSeen && pressureSeen, `the rim sequence includes approach, actual contact, and only then pressure: ${JSON.stringify(lastState)}`);
});

for (const outcome of ['resist', 'dodge']) test(`a live outer charge ${outcome} guards its actual origin and follows the independent story without lining up a new run`, () => {
  const found = fixture(`outer charge ${outcome}`, { predicate: round => round.rimCharge?.start > 3000 && round.rimCharge.outcome === outcome }), scene = game(found.order, found.seed, found.duration), round = found.round;
  // Start this optional story from two already aligned free fighters. This is
  // a fixture setup, before its physical clock or the scene's origin capture.
  const origins = { charger: { x: 590, y: 416 }, defender: { x: 720, y: 416 } };
  let placed = false, activeSeen = false, chargeSeen = false, responseSeen = false, endSeen = false, lastState;
  for (let elapsed = 0; elapsed < round.rimCharge.end + 32; elapsed += 16) {
    if (!placed && elapsed >= round.rimCharge.start - 200) {
      for (const [id, point] of [[round.victim, origins.charger], [round.aggressor, origins.defender]]) {
        Object.assign(scene.sim.bodies.get(id), point, { motorX: 0, motorY: 0, animation: undefined, roam: undefined });
      }
      placed = true;
    }
    const before = snapshot(scene), actors = scene.step(elapsed), contact = scene.sim.contacts.get(round.id), actual = contact?.round;
    const charger = scene.sim.bodies.get(round.victim), defender = scene.sim.bodies.get(round.aggressor);
    lastState = { elapsed, fixture: found, round: actual, origins: contact?.rimChargeOrigins, charger: { x: charger.x, y: charger.y }, defender: { x: defender.x, y: defender.y }, activeSeen, chargeSeen, responseSeen, endSeen };
    if (!placed) continue;
    if (elapsed < round.rimCharge.start) {
      assert.ok(distance(charger, origins.charger) < 1e-8 && distance(defender, origins.defender) < 1e-8, `the awaiting runners relocate before the charge: ${JSON.stringify(lastState)}`);
      assert.ok(['guard', 'brace'].includes(actors.get(round.victim).pose) && actors.get(round.aggressor).pose === 'guard', 'both fighters guard the existing aligned start');
      continue;
    }
    assert.ok(actual?.rimCharge && contact.rimChargeOrigins, `a viable outer charge must be active: ${JSON.stringify(lastState)}`);
    assert.deepEqual(contact.rimChargeOrigins, origins, 'the run begins from the same real two bodies');
    const charge = arenaRimChargeTargets(actual, elapsed, contact.center, contact.rimChargeOrigins);
    if (charge.active) {
      activeSeen = true;
      assert.ok(distance(charger, charge.charger) < 1e-8 && distance(defender, charge.defender) < 1e-8, 'the actual bodies use the physical model without an extra approach motor');
      for (const id of [round.victim, round.aggressor]) {
        const travel = distance(scene.sim.bodies.get(id), before.get(id));
        assert.ok(travel <= 2.65, `neither runner snaps onto a prepared line (${id}: ${travel.toFixed(2)}px): ${JSON.stringify({ ...lastState, charge, previous: before.get(id) })}`);
      }
      assert.ok(charge.side * (charger.x - before.get(round.victim).x) >= -1e-8, 'the charger never reverses to begin the run');
      if (charge.charge > 0) chargeSeen = true;
      if (outcome === 'dodge' && charge.dodge > .8) {
        responseSeen = true;
        assert.equal(actors.get(round.aggressor).pose, 'dodge');
        assert.ok(Math.abs(defender.y - origins.defender.y) > 35, 'the defender visibly leaves the path');
        assert.equal(actors.get(round.victim).gripStrength, 0, 'a dodged runner cannot take a scripted hold');
      }
      if (outcome === 'resist' && charge.grip) {
        responseSeen = true;
        assert.equal(actors.get(round.aggressor).pose, 'brace');
        assert.equal(actors.get(round.victim).gripLocked, true);
        assert.ok(distance(charger, defender) < 36, 'the planted defense only starts once the actual bodies meet');
        assert.ok(!scene.sim.exits.has(round.victim), 'a successfully resisted charge continues into the duel');
      }
    } else if (!endSeen) {
      endSeen = true;
      if (outcome === 'dodge') {
        assert.ok(scene.sim.exits.has(round.victim), 'the missed charger keeps its forward momentum over the outer rim');
        assert.ok(Math.hypot((charger.x - 500) / 303, (charger.y - 416) / 112) > .98);
      } else {
        assert.ok(contact.rimChargeFinished && !scene.sim.exits.has(round.victim));
        assert.ok(distance(contact.center, { x: (before.get(round.victim).x + before.get(round.aggressor).x) / 2, y: (before.get(round.victim).y + before.get(round.aggressor).y) / 2 }) < 1e-8, 'the resumed duel stays at the real charge ending point');
      }
    }
  }
  assert.ok(activeSeen && chargeSeen && responseSeen && endSeen, `the actual charge includes its complete ${outcome} response: ${JSON.stringify(lastState)}`);
});

for (const reverse of [false, true]) test(`the first live opponents keep their initial left/right order during approach${reverse ? ' with reversed starting places' : ''}`, () => {
  const found = fixture('first pair', { count: 3, predicate: round => round.index === 0 && !round.rushOutcome && !round.escape && !round.recovery && !round.rim && !['bait', 'catch', 'ram', 'spin', 'double-shove'].includes(round.tactic) });
  const scene = game(found.order, found.seed, found.duration, { candidateOrder: reverse ? [...found.order].reverse() : found.order }), round = found.round;
  const starting = id => arenaStartingPoint(scene.props.candidates.findIndex(candidate => candidate.id === id), scene.props.candidates.length);
  const side = Math.sign(starting(round.victim).x - starting(round.aggressor).x);
  let observed = false;
  for (let elapsed = 0; elapsed < round.impact; elapsed += 16) {
    scene.step(elapsed);
    const contact = scene.sim.contacts.get(round.id);
    if (!contact) continue;
    const a = scene.sim.bodies.get(round.aggressor), v = scene.sim.bodies.get(round.victim);
    assert.equal(contact.round.contactSide, side, 'the planned contact follows these fighters\' actual initial sides');
    assert.equal(Math.sign(v.x - a.x), side, `the opponents cross roots before a real grapple at ${elapsed}ms`);
    observed = true;
    if (contact.metAt !== undefined) break;
  }
  assert.ok(observed && side !== 0, 'a real first encounter must be observed');
});

test('a live slammed body stays grounded through pickup and drag while both hands track its actual feet', () => {
  const { order, seed, duration, round } = fixture('suplex'), scene = game(order, seed, duration), timing = arenaFloorExitTiming(round);
  let previous, pickupSeen = false, dragSeen = false, maxHandGap = 0;
  for (let elapsed = 0; elapsed < round.impact + timing.dragUntil; elapsed += 16) {
    const actors = scene.step(elapsed), exit = scene.sim.exits.get(round.victim);
    if (!exit || elapsed < round.impact) continue;
    const victim = actors.get(round.victim), driver = actors.get(round.aggressor), body = scene.sim.bodies.get(round.victim);
    const age = elapsed - round.impact;
    assert.ok(Math.abs(victim.y - body.y) < 1e-8 && victim.depthY === body.y, 'pickup never lowers the body below its prescribed floor anchor');
    if (age < timing.stunnedUntil) { if (previous) assert.ok(distance(body, previous.body) < 1e-8, 'the stunned opponent cannot slide toward the hands during the pickup'); }
    else { dragSeen = true; if (previous) assert.ok(distance(body, previous.body) <= 2.65, 'the shared drag follows the bounded floor speed'); }
    if (driver.gripMode === 'ankle' && driver.gripStrength === 1 && driver.gripLocked) {
      pickupSeen = true;
      assert.ok(driver.animation.motion.crouch < 6 && driver.animation.skeleton.hips.every(hip => hip.y <= -14), 'the ankle holder bends an adult torso with full-height legs');
      const feet = victim.animation.contactPoints.feet, hands = driver.animation.contactPoints.hands;
      maxHandGap = Math.max(maxHandGap, ...feet.map((foot, i) => distance(foot, hands[1 - i])));
    }
    previous = { body: { x: body.x, y: body.y } };
  }
  assert.ok(pickupSeen && dragSeen);
  assert.ok(maxHandGap < 5, `both palms follow the real toes throughout the floor pull (max gap ${maxHandGap.toFixed(2)}px)`);
});

test('a live elbow counter leaves its stunned opponent at the hit and the holder walks to those feet', () => {
  const { order, seed, duration, round } = fixture('elbow'), scene = game(order, seed, duration), timing = arenaFloorExitTiming(round);
  let fallen, lastDriver, previousBody, movedTowardFeet = false, gripSeen = false, dragSeen = false, maxHandGap = 0, lastState;
  for (let elapsed = 0; elapsed < round.impact + timing.dragUntil; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(round.id);
    if (!contact?.elbowFall) continue;
    fallen ??= { ...contact.elbowFall };
    const body = scene.sim.bodies.get(round.victim), victim = actors.get(round.victim), driver = actors.get(round.aggressor);
    lastState = { elapsed, seed, order, duration, round: contact.round, timing, fallen, body: { x: body.x, y: body.y }, driver: { x: driver.x, y: driver.y, pose: driver.pose, gripMode: driver.gripMode, gripLocked: driver.gripLocked, gripStrength: driver.gripStrength }, movedTowardFeet, gripSeen, dragSeen };
    const age = elapsed - round.impact;
    if (age < timing.stunnedUntil) assert.ok(distance(body, fallen) < 1e-8, 'only the holder moves toward the grip; the victim stays where the head hit occurred');
    else {
      dragSeen = true;
      if (previousBody) assert.ok(distance(body, previousBody) <= 2.65, 'the elbow knockout follows the same bounded floor pull as a slam');
    }
    if (elapsed >= round.impact) {
      assert.ok(victim?.candidate, 'the grounded opponent keeps a valid painted actor after leaving the active fighter list');
      assert.ok(Math.abs(victim.y - body.y) < 1e-8 && victim.depthY === body.y, 'the knockout stays on the floor until the rim throw');
      assert.equal(victim.suspension ?? 0, 0, 'the holder never raises the stunned opponent again');
    }
    if (lastDriver && distance(driver, lastDriver) > .1) movedTowardFeet = true;
    if (driver.gripMode === 'ankle' && driver.gripStrength === 1 && driver.gripLocked) {
      gripSeen = true;
      assert.ok(driver.animation.motion.crouch < 6 && driver.animation.skeleton.hips.every(hip => hip.y <= -14), 'the live holder keeps adult leg proportions while reaching down');
      const feet = victim.animation.contactPoints.feet, hands = driver.animation.contactPoints.hands;
      maxHandGap = Math.max(maxHandGap, ...feet.map((foot, i) => distance(foot, hands[1 - i])));
    }
    lastDriver = { x: driver.x, y: driver.y };
    previousBody = { x: body.x, y: body.y };
  }
  assert.ok(fallen && movedTowardFeet && gripSeen && dragSeen, `the counter includes a grounded fall, an actual approach, a visible ankle grip, and a floor pull: ${JSON.stringify(lastState)}`);
  assert.ok(maxHandGap < 5, `the actual ankle pull maintains both palm contacts (max gap ${maxHandGap.toFixed(2)}px)`);
});
