import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the real frame loop and its painted contact sampling. Only static
// scenery is omitted, and the initial field can be reflected before play.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const rankRead = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const initialize = 'const ambient = won ? [] : active.filter';
const gate = 'if (Math.hypot(striker.shoulders[1].x - chest.x, striker.shoulders[1].y - chest.y) < 12) {';
for (const anchor of [draw, rankRead, initialize, gate]) assert.ok(source.includes(anchor), 'the harness uses the current production frame loop');
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'ramTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} ramTestRanks = ranks;`)
  .replace(initialize, `ramTestInitialize(sim, reset); ${initialize}`)
  .replace(draw, `ramTestActors = actors; ${draw}`)
  .replace(gate, `${gate} ramTestContacts.push({ elapsed, id: exchange.id, striker: structuredClone(striker), receiver: structuredClone(receiver), chest: { ...chest }, driver: { x: a.x, y: a.y }, victim: { x: v.x, y: v.y } });`);
source += '\nlet ramTestActors, ramTestRanks; const ramTestContacts = []; const ramTestScenery = () => {}; let ramTestInitialize = () => {}; export const setInitialize = fn => { ramTestInitialize = fn; }; export const capturedActors = () => ramTestActors; export const capturedRanks = () => ramTestRanks; export const capturedContacts = () => ramTestContacts; export { render, createArenaCamera, arenaRounds, arenaRamTargets }; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaMinimumDuration, arenaRamTargets, setInitialize, capturedActors, capturedRanks, capturedContacts } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: text => ({ width: text.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => (target[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;
const fixtures = [[2, 44], [2, 57], [2, 63], [3, 2], [3, 3], [3, 10]];

function game(count, seed, mirrored, frameDelta, controlled = false) {
  const order = Array.from({ length: count }, (_, index) => String(index + 1));
  const duration = Math.max(44000, arenaMinimumDuration(order, 7, seed));
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const rounds = arenaRounds(order, duration, 7, seed);
  assert.equal(rounds[0].tactic, 'ram', 'the natural fixture selects the ordinary shoulder charge');
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
  const ctx = context(), contactStart = capturedContacts().length;
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    if (controlled) {
      // Supply a real inside runway before the Scene creates any contact.
      // The run, contact time, flight and ranks remain production decisions.
      Object.assign(current.bodies.get(rounds[0].aggressor), { x: 400, y: 416, motorX: 0, motorY: 0, animation: undefined });
      Object.assign(current.bodies.get(rounds[0].victim), { x: 565, y: 416, motorX: 0, motorY: 0, animation: undefined });
    }
    if (mirrored) for (const body of current.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.animation = undefined; }
  });
  return { sim, order, rounds, contactStart, step(elapsed, paused = false) {
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : frameDelta, false);
    return capturedActors();
  } };
}

function verifyRam(count, seed, mirrored, frameDelta, controlled = false) {
    const scene = game(count, seed, mirrored, frameDelta, controlled), planned = scene.rounds[0];
    let actualRam = false, pending = false, runSeen = false, contactSeen = false, flying = false, final = false;
    let prepareOrigin, previous, last;
    for (let elapsed = 0; elapsed <= 60000; elapsed += frameDelta) {
      const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id), round = contact?.round;
      const driver = scene.sim.bodies.get(planned.aggressor), victim = actors.get(planned.victim), exit = scene.sim.exits.get(planned.victim);
      last = { count, seed, mirrored, frameDelta, elapsed, tactic: round?.tactic, setup: round?.chargeSetup, actualRam, pending, runSeen, contactSeen, flying, final };
      if (round?.tactic === 'ram' && round.chargeSetup) {
        actualRam = true;
        const ram = arenaRamTargets(round, elapsed, contact.center);
        if (round.chargeSetup.contactAt === null) {
          pending = true;
          assert.equal(exit, undefined, `a nominal deadline cannot launch an uncontacted ram: ${JSON.stringify(last)}`);
          assert.equal(capturedRanks()[planned.victim], undefined);
          if (ram.stage === 'prepare') {
            prepareOrigin ??= { x: driver.x, y: driver.y };
            assert.ok(distance(driver, prepareOrigin) < 1e-8, 'the planted preparation does not drift or run twice');
          } else if (ram.stage === 'charge') {
            assert.ok(distance(driver, ram.driver) < 1e-8, 'the physical rush is integrated once, without a second approach motor');
            if (previous && previous.ramPending) assert.ok(distance(driver, previous.driver) <= 165 * frameDelta / 1000 + 1e-8, 'the actual run retains its bounded ground speed');
            const painted = actors.get(planned.aggressor);
            runSeen ||= painted.pose === 'run' && Math.hypot(painted.velocityX, painted.velocityY) > 100;
          }
        } else if (!contactSeen) {
          assert.equal(round.chargeSetup.contactAt, elapsed, 'the live contact clock is recorded on the actual collision frame');
          const hit = capturedContacts().slice(scene.contactStart).find(value => value.id === planned.id);
          assert.ok(hit && hit.elapsed === elapsed, 'the recorded collision has actual painted skeletons');
          assert.ok(distance(hit.striker.shoulders[1], hit.chest) < 12, 'the real shoulder reaches the actual chest before flight');
          assert.ok(runSeen, `a visible fast run precedes the shoulder hit: ${JSON.stringify(last)}`);
          assert.ok(exit && exit.launchedAt === elapsed, 'contact immediately starts the flight on the same frame');
          assert.equal(exit.round.victim, planned.victim);
          assert.equal(victim.pose, 'airborne', 'the collision skips a separate fall or stunned pause');
          assert.ok(inside(driver), 'only the drawn loser leaves the field');
          contactSeen = true;
        }
        if (contactSeen && exit && elapsed > exit.launchedAt && elapsed - exit.launchedAt < 120) {
          assert.equal(victim.pose, 'airborne');
          flying ||= (victim.depthY ?? scene.sim.bodies.get(planned.victim).y) - victim.y > 0;
          assert.ok(!scene.sim.exits.has(planned.aggressor), 'the shoulder attacker stays alive');
        }
      }
      previous = { driver: { x: driver.x, y: driver.y }, ramPending: round?.tactic === 'ram' && round.chargeSetup?.contactAt === null };
      if (Object.keys(capturedRanks()).length === count) {
        assert.deepEqual(capturedRanks(), Object.fromEntries(scene.order.map((id, index) => [id, index + 1])));
        final = true; break;
      }
    }
    assert.ok(final, `the natural field must finish with the supplied ranks: ${JSON.stringify(last)}`);
    if (controlled || count === 2) assert.ok(actualRam, 'the valid inside runway must exercise the real shoulder charge');
    if (actualRam) assert.ok(pending && contactSeen && flying, `a viable ram must pass its real run/contact/flight gates: ${JSON.stringify(last)}`);
    else assert.ok(scene.sim.contacts.get(planned.id)?.round.tactic !== 'ram', 'an unsuitable natural runway may resume the normal same-result bout');
}

for (const [count, seed] of fixtures) test(`natural ${count}-player seed ${seed} ram preserves its ranks through the real runway or fallback`, () => {
  for (const mirrored of [false, true]) for (const frameDelta of [16, 50]) verifyRam(count, seed, mirrored, frameDelta);
});

for (const [count, seed] of [[2, 44], [3, 3]]) test(`a viable ${count}-player ram runs once, takes actual shoulder contact and immediately flies out`, () => {
  for (const mirrored of [false, true]) for (const frameDelta of [16, 50]) verifyRam(count, seed, mirrored, frameDelta, true);
});
