import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Replay the production Scene without a DOM. The renderer still paints every
// articulated skeleton, so contact gates and animation history remain real.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'flowTestScenery(ctx, clock,')
  .replace(draw, `flowTestFrame = { actors, ranks, rounds, exchange, ambient }; ${draw}`);
source += '\nlet flowTestFrame; const flowTestScenery = () => {}; export const capturedFrame = () => flowTestFrame; export { render, createArenaCamera, arenaRounds }; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaMinimumDuration, capturedFrame } = module.exports;
const noop = () => {};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const context = () => new Proxy({ measureText: text => ({ width: text.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => (target[key] = value, true) });

for (const [count, seed] of [[8, 19], [6, 42], [6, 12], [5, 19]]) for (const delta of [16, 50]) test(`a natural ${count}-fighter seed ${seed} moves on after the released drag throw at ${delta}ms frames`, () => {
  const order = Array.from({ length: count }, (_, index) => String(count - index));
  const duration = Math.max(44000, arenaMinimumDuration(order, 7, seed));
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, paused: false, preview: false, arenaRushRoll: 7, arenaEscapeSeed: seed };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  const planned = arenaRounds(order, duration, 7, seed), releases = new Map();
  let playbackEnd = planned.at(-1).end, elapsed = 0, ranks = {}, verified = 0;
  const ceiling = playbackEnd + 60000, published = new Set();
  for (; elapsed <= playbackEnd + delta && elapsed < ceiling; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const frame = capturedFrame(); ranks = frame.ranks;
    playbackEnd = Math.max(playbackEnd, ...[...sim.contacts.values()].map(contact => contact.round.end));
    for (const [victimId, exit] of sim.exits) {
      if (!exit.floorThrow || !exit.spinFlight || !Number.isFinite(exit.launchedAt) || releases.has(victimId)) continue;
      const driverId = exit.round.aggressor;
      const others = frame.rounds.filter(round => round.id !== exit.round.id && round.end > elapsed && [round.aggressor, round.victim, round.helper].includes(driverId));
      const next = others[0], opponentId = next && (next.aggressor === driverId ? next.victim : next.aggressor), opponent = opponentId && sim.bodies.get(opponentId), driver = sim.bodies.get(driverId);
      if (opponent && !sim.exits.has(opponentId) && distance(driver, opponent) > 85) releases.set(victimId, { driverId, roundId: exit.round.id, at: exit.launchedAt, flightDuration: exit.spinFlight.duration, nextId: next.id, nextVictim: next.victim, last: { x: driver.x, y: driver.y }, movingFrames: 0, travel: 0 });
    }
    for (const [victimId, release] of releases) {
      const driver = sim.bodies.get(release.driverId), actor = frame.actors.get(release.driverId), age = elapsed - release.at;
      if (age < release.flightDuration) assert.equal(ranks[victimId], undefined, 'letting the survivor move must not publish the thrown opponent before landing');
      if (age < 650 || age > 1100 + delta) { release.last = { x: driver.x, y: driver.y }; continue; }
      release.anchor ??= { x: driver.x, y: driver.y };
      const step = distance(driver, release.last);
      if (step > .15) release.movingFrames++;
      release.travel = Math.max(release.travel, distance(driver, release.anchor));
      release.last = { x: driver.x, y: driver.y };
      assert.ok(step <= delta * .65 + .5, 'returning to the next opponent uses continuous steps rather than a position jump');
      if (age >= 1050 && !release.verified) {
        assert.ok(release.travel > 6 && release.movingFrames >= 2, `the released caster remains locked for ${age.toFixed(0)}ms while a living opponent is available: ${JSON.stringify({ seed, count, delta, release, pose: actor.pose, root: { x: driver.x, y: driver.y }, focus: frame.exchange?.id })}`);
        if (frame.exchange?.id === release.roundId) assert.notEqual(actor.pose, 'throw', 'the completed throw cannot restart its old arm pose while the opponent is already in flight');
        release.verified = true; verified++;
      }
    }
    for (const round of frame.rounds) {
      if (ranks[round.victim] === undefined || published.has(round.id)) continue;
      const contact = sim.contacts.get(round.id), actual = contact?.round;
      assert.ok(actual, 'each later rank belongs to a real Scene encounter');
      assert.ok(elapsed >= actual.resolve, 'rank publication retains its actual physical resolution clock');
      const exit = sim.exits.get(round.victim);
      assert.ok(exit, 'a future opponent cannot disappear before its own physical exit');
      if (actual.wrestlingMove) {
        assert.ok(Number.isFinite(actual.wrestlingMove.contactAt) && Number.isFinite(exit.launchedAt), 'a later wrestling counter still waits for actual body contact and release');
        assert.ok(exit.launchedAt >= actual.wrestlingMove.contactAt);
      }
      if (actual.floorFinish) assert.ok(Number.isFinite(actual.floorFinish.releaseAt), 'a later dragged throw cannot be skipped before its real release');
      published.add(round.id);
    }
  }
  assert.ok(verified > 0, 'the natural game must exercise a drag release while another live opponent is available');
  assert.ok([...releases.values()].every(release => release.verified), 'each encountered postthrow continuation was observed through its follow-through');
  assert.deepEqual(ranks, Object.fromEntries(order.map((id, index) => [id, index + 1])), 'moving on early preserves every predetermined rank and completes the full game');
  assert.ok(elapsed < ceiling, 'following the actual published game clock must finish within the bounded replay');
});

for (const delta of [16, 50]) test(`a real sidekick following a floor throw continues toward its next opponent at ${delta}ms frames`, () => {
  const order = Array.from({ length: 5 }, (_, index) => `scene-4-${index}`), seed = 0;
  const duration = Math.max(44000, arenaMinimumDuration(order, 7, seed));
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, paused: false, preview: false, arenaRushRoll: 7, arenaEscapeSeed: seed };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  let playbackEnd = arenaRounds(order, duration, 7, seed).at(-1).end, elapsed = 0, ranks, floorSeen = false, release;
  const ceiling = playbackEnd + 60000;
  for (; elapsed <= playbackEnd + delta && elapsed < ceiling; elapsed += delta) {
    const previousView = release && {
      facing: sim.bodies.get(release.driverId).facing,
      x: sim.bodies.get(release.driverId).x,
    };
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const frame = capturedFrame(); ranks = frame.ranks;
    playbackEnd = Math.max(playbackEnd, ...[...sim.contacts.values()].map(contact => contact.round.end));
    floorSeen ||= [...sim.exits.values()].some(exit => Number.isFinite(exit.round.floorFinish?.releaseAt));
    if (!release && floorSeen) for (const [victimId, exit] of sim.exits) {
      const round = exit.round;
      if (round.tactic !== 'sidekick' || round.wrestlingMove || round.kickCatch || round.final || !Number.isFinite(round.sidekickLaunchAt) || !Number.isFinite(exit.launchedAt)) continue;
      const next = frame.rounds.find(candidate => candidate.index > round.index && [candidate.aggressor, candidate.victim, candidate.helper].includes(round.aggressor));
      if (!next) continue;
      const opponentId = next.aggressor === round.aggressor ? next.victim : next.aggressor, driver = sim.bodies.get(round.aggressor);
      assert.ok(!sim.exits.has(opponentId), 'the postkick continuation has a live next opponent');
      assert.ok(exit.launchedAt > round.sidekickLaunchAt, 'the opponent leaves only after the running kick reaches actual sole contact');
      release = { victimId, driverId: round.aggressor, roundId: round.id, nextId: next.id, opponentId, at: exit.launchedAt, launchAt: round.sidekickLaunchAt, last: { x: driver.x, y: driver.y }, movingFrames: 0, travel: 0 };
      break;
    }
    if (!release) continue;
    const driver = sim.bodies.get(release.driverId), actor = frame.actors.get(release.driverId), age = elapsed - release.at;
    if (age < 650) assert.equal(ranks[release.victimId], undefined, 'the kick follows through before the thrown opponent is ranked');
    const roamingTarget = driver.roam?.target;
    // The next roaming destination is already ahead. Braking the preceding
    // leftward step cannot turn the whole sprite away, then immediately back.
    // Only free walking/guarding frames are checked; techniques keep their
    // independent physical turn and contact clocks.
    if (previousView && age >= 650 && age <= 1100 && frame.ambient.includes(release.driverId) && ['walk', 'guard'].includes(actor.pose)
      && roamingTarget && !driver.roam.neighborId && (driver.motorX ?? 0) * (roamingTarget.x - previousView.x) < -1) {
      assert.equal(actor.facing, previousView.facing, `postkick braking must not mirror the fighter away from its new destination at ${age}ms`);
      release.brakingFrames = (release.brakingFrames ?? 0) + 1;
    }
    if (age < 650 || age > 1100 + delta) { release.last = { x: driver.x, y: driver.y }; continue; }
    release.anchor ??= { x: driver.x, y: driver.y };
    const step = distance(driver, release.last);
    if (step > .15) release.movingFrames++;
    release.travel = Math.max(release.travel, distance(driver, release.anchor));
    release.last = { x: driver.x, y: driver.y };
    assert.ok(step <= delta * .65 + .5, 'the postkick survivor resumes with continuous steps');
    if (age >= 1050 && !release.verified) {
      const nextContact = sim.contacts.get(release.nextId), opponent = sim.bodies.get(release.opponentId);
      const actualNewHold = Number.isFinite(nextContact?.metAt) && nextContact.metAt >= release.at && distance(driver, opponent) < 90 && (actor.gripStrength ?? 0) > .25;
      assert.ok(release.travel > 6 && release.movingFrames >= 2 || actualNewHold, `the finished sidekick must move on or meet the next opponent instead of holding the old guard: ${JSON.stringify({ delta, age, release, pose: actor.pose, nextContactAt: nextContact?.metAt, gap: distance(driver, opponent), focus: frame.exchange?.id })}`);
      assert.notEqual(frame.exchange?.id, release.roundId, 'the finished running kick no longer reserves the survivor until the old rank clock');
      release.verified = true;
    }
  }
  assert.ok(floorSeen && release?.verified, 'the real game exercises a floor finish, actual running kick, and its continuous next encounter');
  assert.ok(release.brakingFrames >= 2, 'the natural continuation exercises several actual braking frames against the new destination');
  const kick = sim.contacts.get(release.roundId).round, next = sim.contacts.get(release.nextId)?.round;
  assert.ok(Number.isFinite(kick.sidekickLaunchAt) && sim.exits.get(release.victimId).launchedAt === release.at, 'the recorded sole contact is retained across the following bout');
  assert.ok(next && sim.exits.has(next.victim), 'the next opponent still completes its own physical encounter');
  if (next.wrestlingMove) assert.ok(Number.isFinite(next.wrestlingMove.contactAt), 'continuation cannot skip the next real wrestling contact');
  assert.deepEqual(ranks, Object.fromEntries(order.map((id, index) => [id, index + 1])), 'all predetermined ranks remain identical after the postkick handoff');
  assert.ok(elapsed < ceiling, 'the actual extended game clock completes within the bounded replay');
});
