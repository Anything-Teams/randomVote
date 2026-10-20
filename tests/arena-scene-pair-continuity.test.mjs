import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the real Scene and fighter drawing. Only the static stadium is omitted.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
assert.ok(source.includes(draw) && source.includes(ranks));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'continuityScenery(ctx, clock,')
  .replace(draw, `continuityActors = actors; ${draw}`)
  .replace(ranks, `${ranks} continuityRanks = ranks;`);
source += '\nlet continuityActors, continuityRanks; const continuityScenery = () => {}; export const capturedActors = () => continuityActors; export const capturedRanks = () => continuityRanks; export { render, createArenaCamera, arenaRounds, arenaPairRushTargets }; export { arenaMinimumDuration } from "./arenaLogic";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaPairRushTargets, arenaMinimumDuration, capturedActors, capturedRanks } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = value => ({ x: value.x, y: value.y });

function scene(order, seed, delta = 50) {
  const duration = Math.max(44000, arenaMinimumDuration(order, 7, seed));
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  const planned = arenaRounds(order, duration, 7, seed);
  return { props, sim, planned, delta, step(elapsed, paused = false) {
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : delta, false);
    this.actors = capturedActors(); this.ranks = capturedRanks();
    return this.actors;
  } };
}
function snapshot(game, ids) {
  return new Map(ids.map(id => {
    const body = game.sim.bodies.get(id), actor = game.actors.get(id);
    return [id, { body: point(body), actor: point(actor), painted: point(actor.animation.contactPoints.origin), pose: actor.pose }];
  }));
}
function boundedCarriers(game, ids, previous, label, interval = game.delta) {
  const current = snapshot(game, ids), limit = 165 * interval / 1000 + .02;
  for (const id of ids) for (const coordinate of ['body', 'actor', 'painted']) {
    const step = distance(current.get(id)[coordinate], previous.get(id)[coordinate]);
    assert.ok(step <= limit, `${label}: ${id} ${coordinate} moves ${step.toFixed(3)} px over ${interval} ms, limit ${limit.toFixed(3)}`);
  }
  return current;
}
function supportedEndpoints(game, actual, label) {
  if (actual.frame.pickupAt === null || game.sim.elapsed < actual.frame.pickupAt || game.sim.exits.has(actual.round.victim)) return;
  const actors = game.actors, victim = actors.get(actual.round.victim).animation.contactPoints;
  for (const [id, endpoints] of [[actual.round.aggressor, victim.shoulders], [actual.round.helper, victim.feet]]) {
    const holder = actors.get(id), hands = holder.animation.contactPoints.hands;
    for (const endpoint of endpoints) assert.ok(Math.min(...hands.map(hand => distance(hand, endpoint))) < 5.1, `${label}: ${id} retains both actual support contacts`);
  }
}
function sharedContact(game, planned) {
  const contact = game.sim.contacts.get(planned.id);
  return contact && { contact, round: contact.round, frame: arenaPairRushTargets(contact.round, game.sim.elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins) };
}

for (const delta of [16, 50]) test(`a natural eight-person joint throw hands both survivors to the next encounter without a root jump (${delta} ms)`, () => {
  const order = Array.from({ length: 8 }, (_, index) => String(index + 1)), game = scene(order, 31, delta);
  const planned = game.planned.find(round => round.rushOutcome === 'counter-throw');
  assert.ok(planned && game.planned.indexOf(planned) > 0, 'the regression uses the real middle encounter');
  const ids = [planned.aggressor, planned.helper];
  let previous, pickup = false, released = false, boundary = false, ranked = false, exit;
  for (let elapsed = 0; elapsed < game.props.duration + 10000; elapsed += delta) {
    game.step(elapsed);
    const actual = sharedContact(game, planned);
    if (!actual) continue;
    const { contact, round, frame } = actual;
    if (frame.pickupAt !== null && game.sim.elapsed >= frame.pickupAt && !pickup) { previous = snapshot(game, ids); pickup = true; }
    else if (pickup) previous = boundedCarriers(game, ids, previous, `${elapsed}/${frame.stage}`);
    const outgoing = game.sim.exits.get(round.victim);
    if (outgoing) { exit ??= outgoing; assert.equal(outgoing, exit, 'the outgoing body keeps the same recorded release'); released = true; }
    if (game.ranks[round.victim] !== undefined) {
      assert.ok(released, 'a result cannot precede the physical throw');
      assert.equal(game.ranks[round.victim], order.indexOf(round.victim) + 1);
      ranked = true;
    }
    if (released && game.sim.elapsed >= round.resolve) boundary = true;
    for (const id of ids) assert.ok(!game.sim.exits.has(id), 'neither shared carrier is removed with the thrown fighter');
    if (boundary && ranked && game.sim.elapsed >= round.resolve + 600) break;
  }
  assert.ok(pickup && released && boundary && ranked, 'the fixture traverses floor pickup, lift, release, next encounter and unchanged result');
});

const hitchFixtures = [
  { name: 'counter', seed: 1, order: ['1', '2', '3', '4', '5'], select: round => round.rushOutcome === 'counter-throw' && !round.linkedRush },
  { name: 'linked', seed: 570, order: ['1', '2', '3', '4', '5'], select: round => !!round.linkedRush },
];
for (const fixture of hitchFixtures) for (const stage of ['grip', 'load', 'toss']) for (const gap of [650, 1000]) test(`a ${gap} ms live frame hitch preserves the actual ${fixture.name} shared ${stage} and its two carriers`, () => {
  const game = scene(fixture.order, fixture.seed), control = scene(fixture.order, fixture.seed), planned = game.planned.find(fixture.select);
  assert.ok(planned, 'the natural production draw selects this shared throw');
  let elapsed = 0, reached;
  for (; elapsed < game.props.duration + 10000; elapsed += game.delta) {
    game.step(elapsed); control.step(elapsed);
    const actual = sharedContact(game, planned);
    if (actual?.frame.stage === stage && actual.frame.pickupAt !== null && actual.contact.pairCarryOrigins?.pickup && actual.contact.pairGripMap?.size === 2) { reached = actual; break; }
  }
  assert.ok(reached, `the live ${fixture.name} fixture must reach the real ${stage}`);
  const { contact, round } = reached, ids = [round.aggressor, round.helper], epoch = game.sim.epoch;
  const originalPickup = contact.pairCarryOrigins.pickup, gripMap = contact.pairGripMap, pickupAt = round.pairPickupAt;
  const previous = snapshot(game, ids);
  const beforeElapsed = elapsed; elapsed += gap;
  game.step(elapsed);
  for (let at = beforeElapsed + game.delta; at <= elapsed; at += game.delta) control.step(at);
  assert.equal(game.sim.epoch, epoch, 'a delayed live frame is not an explicit seek or a new match');
  assert.equal(game.sim.contacts.get(planned.id), contact, 'the physical encounter is preserved');
  assert.equal(contact.pairCarryOrigins.pickup, originalPickup, 'the saved floor waist and real support origins cannot be restaged');
  assert.equal(contact.pairGripMap, gripMap, 'the four hands retain their original endpoint assignments');
  assert.equal(contact.round.pairPickupAt, pickupAt, 'the already established physical pickup is not replayed');
  let current = boundedCarriers(game, ids, previous, `live hitch ${gap}/${stage}`, gap);
  const uninterrupted = snapshot(control, ids), controlActual = sharedContact(control, planned);
  for (const id of ids) for (const coordinate of ['body', 'actor', 'painted']) assert.ok(distance(current.get(id)[coordinate], uninterrupted.get(id)[coordinate]) < .001, `${fixture.name}/${stage}/${gap}: ${id} ${coordinate} agrees with uninterrupted normal frames`);
  const victimRig = game.actors.get(round.victim).animation.contactPoints, controlRig = control.actors.get(round.victim).animation.contactPoints;
  for (const endpoint of ['shoulders', 'feet', 'hands']) for (let index = 0; index < 2; index++) assert.ok(distance(victimRig[endpoint][index], controlRig[endpoint][index]) < .001, `${fixture.name}/${stage}/${gap}: the carried ${endpoint}[${index}] is identical to uninterrupted playback`);
  for (const clock of ['start', 'impact', 'resolve', 'end', 'rushLaunchAt', 'rushContactAt', 'pairPickupAt']) assert.equal(contact.round[clock], controlActual.round[clock], `the physical ${clock} clock matches uninterrupted playback`);
  assert.equal(sharedContact(game, planned).frame.stage, controlActual.frame.stage, 'a delayed frame reaches the same actual lift stage');
  assert.deepEqual(game.ranks, control.ranks, 'a delayed frame preserves the same unrevealed or resolved results');
  supportedEndpoints(game, sharedContact(game, planned), `live hitch ${gap}/${stage}`);
  let released = false, ranked = false;
  for (let frames = 0; frames < 250; frames++) {
    elapsed += game.delta; game.step(elapsed);
    const actual = sharedContact(game, planned);
    assert.equal(actual.contact, contact, 'resuming live frames keeps the same encounter');
    if (!released) { current = boundedCarriers(game, ids, current, `resume ${frames}/${actual.frame.stage}`); supportedEndpoints(game, actual, `resume ${frames}/${actual.frame.stage}`); }
    const exit = game.sim.exits.get(round.victim);
    if (exit) released = true;
    if (game.ranks[round.victim] !== undefined) {
      assert.ok(released, 'the victim cannot be ranked while still held');
      assert.equal(game.ranks[round.victim], fixture.order.indexOf(round.victim) + 1);
      ranked = true; break;
    }
  }
  assert.ok(released && ranked, 'the surviving physical lift still throws the same fighter and publishes its original place');
});
