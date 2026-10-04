import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual Scene and painted rig; only the static scenery is skipped.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
const rankRead = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
assert.ok(source.includes(rankRead));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'surpriseTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} surpriseTestRanks = ranks;`)
  .replace(draw, 'surpriseTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.surpriseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.surpriseEnd(); });');
source += '\nlet surpriseTestActors, surpriseTestRanks; const surpriseTestScenery = () => {}; export const capturedActors = () => surpriseTestActors; export const capturedRanks = () => surpriseTestRanks; export { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaSlideTripTargets, arenaLinkedRushTargets, arenaPairRushTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaSlideTripTargets, arenaLinkedRushTargets, arenaPairRushTargets, capturedActors, capturedRanks } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const order = ['1', '2', '3', '4', '5'];
const duration = 44000, rushRoll = 7;

function context() {
  let matrix = identity(), stack = [], currentId;
  const records = new Map();
  const target = {
    globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; target.globalAlpha = saved.alpha; } },
    transform(...next) { matrix = multiply(matrix, next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    fillRect(x, y, width, height) {
      if (!currentId || target.globalAlpha <= 0) return;
      records.get(currentId).rectangles.push([{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map(point => project(matrix, point)));
    },
    surpriseStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix], rectangles: [] }); },
    surpriseEnd() { currentId = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
function game(seed, reversed = false, mirrored = false) {
  const props = { candidates: (reversed ? [...order].reverse() : order).map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : 16, false);
    // The rare passer has one deterministic ordinary layout. Reflect its real
    // initialized bodies once to exercise the other physical heading as well.
    if (mirrored && elapsed === 0) {
      for (const body of sim.bodies.values()) {
        body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.motorX = 0; body.animation = undefined;
      }
      for (const contact of sim.contacts.values()) {
        contact.center.x = 1000 - contact.center.x; contact.side *= -1;
        if (contact.round.contactSide) contact.round = { ...contact.round, contactSide: -contact.round.contactSide };
        if (contact.chargerOrigin) contact.chargerOrigin.x = 1000 - contact.chargerOrigin.x;
        if (contact.slideTripOrigins) {
          for (const point of Object.values(contact.slideTripOrigins)) point.x = 1000 - point.x;
        }
      }
    }
    return capturedActors();
  } };
}
function snapshot(actor, body) {
  return { x: actor.x, y: actor.y, depthY: actor.depthY, height: actor.depthY - actor.y, heldHeight: body.y - actor.animation.contactPoints.origin.y, angle: actor.angle, facing: actor.facing, pose: actor.pose, contacts: structuredClone(actor.animation.contactPoints) };
}
const points = contacts => [contacts.origin, contacts.head, contacts.waist, ...contacts.hands, ...contacts.feet];
const intersectsViewport = values => Math.max(...values.map(point => point.x)) > 0 && Math.min(...values.map(point => point.x)) < 1000 && Math.max(...values.map(point => point.y)) > 0 && Math.min(...values.map(point => point.y)) < 620;

for (const mirrored of [false, true]) test(`a live feet-first slide hooks the real ankle, stands, and kicks one opponent out (${mirrored ? 'mirrored' : 'ordinary'})`, () => {
  const seed = 46, planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.slideTrip);
  assert.ok(planned, 'the production independent roll selects the sliding attack');
  const scene = game(seed, false, mirrored), stages = new Set();
  let hooked = false, kicked = false, rolled = false, resolved = false, previousDriver;
  for (let elapsed = 0; elapsed <= planned.resolve + 1500; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.slideTripOrigins || !contact.round.slideTrip) continue;
    const actual = contact.round, window = actual.slideTrip;
    const frame = arenaSlideTripTargets(window, elapsed, contact.center, contact.slideTripOrigins, actual.contactSide);
    const driver = actors.get(actual.aggressor), victim = actors.get(actual.victim), body = scene.sim.bodies.get(actual.aggressor);
    const detail = `${mirrored}/${elapsed}/${frame.stage}`;
    stages.add(frame.stage);
    assert.ok(points(driver.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `the actual sliding/rising rig stays finite: ${detail}`);
    if (!scene.sim.exits.has(actual.victim) && previousDriver) assert.ok(distance(body, previousDriver) <= 240 * .016 + .01, `the slide cannot teleport the actual body: ${detail}`);
    previousDriver = { x: body.x, y: body.y };
    if (window.hookAt === elapsed) {
      assert.equal(driver.pose, 'slide');
      assert.ok(driver.animation.contactPoints.feet.some(foot => distance(foot, contact.slideTripOrigins.standingAnkle) < 8), `a real leading sole contacts the ankle before the fall: ${detail}`);
      assert.equal(Math.abs(victim.angle), 0, 'the defender is still upright at the first ankle contact');
      hooked = true;
    }
    if (hooked && !scene.sim.exits.has(actual.victim)) assert.ok(distance(scene.sim.bodies.get(actual.victim), contact.slideTripOrigins.hookVictim) < .001, 'the victim falls on the same footprint until the kick');
    if (window.kickAt === elapsed) {
      assert.equal(driver.pose, 'trip'); assert.ok((driver.frontKick ?? 0) >= .615, 'a complete forward strike follows the rise');
      assert.ok(driver.animation.contactPoints.feet.some(foot => distance(foot, contact.slideTripOrigins.kickTarget) < 8), 'the real sole reaches the fallen opponent before release');
      assert.ok(elapsed - window.hookAt >= 800, 'the driver has time for one fall and one grounded rise before kicking');
      assert.equal(scene.sim.exits.get(actual.victim)?.launchedAt, elapsed, 'only the actual kick starts the exit');
      kicked = true;
    }
    if (scene.sim.exits.get(actual.victim)?.round.id === actual.id && victim.pose === 'roll') rolled = true;
    assert.ok(!scene.sim.exits.has(actual.aggressor), 'the sliding attacker remains inside');
    if (elapsed >= actual.resolve) {
      assert.equal(capturedRanks()[actual.victim], order.indexOf(actual.victim) + 1, 'the new scene preserves the selected rank');
      resolved = true; break;
    }
  }
  assert.ok(hooked && kicked && rolled && resolved, `the whole contact-triggered sliding scene completes: ${[...stages]}`);
  assert.ok(stages.has('approach') && stages.has('slide') && stages.has('fall') && stages.has('rise') && stages.has('kick'));
});

test('a close opponent uses the ordinary trip instead of backing up to invent a running slide', () => {
  const seed = 25, planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.slideTrip);
  const scene = game(seed);
  let declined = false, resolved = false;
  for (let elapsed = 0; elapsed <= planned.resolve + 100; elapsed += 16) {
    scene.step(elapsed);
    const contact = scene.sim.contacts.get(planned.id);
    if (contact && elapsed >= planned.start && !contact.round.slideTrip) {
      assert.equal(contact.slideTripOrigins, undefined, 'no slide roots or manufactured runway are introduced');
      assert.equal(contact.round.tactic, 'trip'); declined = true;
      if (elapsed >= contact.round.resolve) {
        assert.equal(capturedRanks()[planned.victim], order.indexOf(planned.victim) + 1); resolved = true; break;
      }
    }
  }
  assert.ok(declined && resolved, 'the nearby ordinary exchange still completes the chosen elimination');
});

for (const mirrored of [false, true]) test(`two live allies join arms, hit the neck, and inherit the exact shared throw (${mirrored ? 'mirrored' : 'ordinary'})`, () => {
  const seed = 570, planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.linkedRush);
  assert.ok(planned, 'the production extremely rare roll selects the linked attack');
  const scene = game(seed, false, mirrored), previous = new Map();
  let linked = false, hit = false, held = false, thrown = false, resolved = false, previousVictim;
  for (let elapsed = 0; elapsed <= planned.resolve + 1500; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.linkedRushOrigins || !contact.round.linkedRush) continue;
    const actual = contact.round, window = actual.linkedRush, pairIds = [actual.aggressor, actual.helper];
    const victim = actors.get(actual.victim), exit = scene.sim.exits.get(actual.victim);
    const detail = `${mirrored}/${elapsed}`;
    for (const id of pairIds) {
      const actor = actors.get(id), body = scene.sim.bodies.get(id);
      assert.ok(actor && points(actor.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `both actual allies remain painted: ${detail}/${id}`);
      const last = previous.get(id);
      if (last && elapsed < actual.impact) assert.ok(distance(body, last) <= 165 * .016 + .01, `the linked charge and shared pickup use bounded real steps: ${detail}/${id}`);
      previous.set(id, { x: body.x, y: body.y });
      assert.ok(!scene.sim.exits.has(id), 'neither attacking ally is eliminated');
    }
    if (window.launchAt === elapsed) {
      const pair = pairIds.map(id => actors.get(id));
      const palms = pair.map(actor => actor.animation.contactPoints.hands[actor.linkedArm]);
      assert.ok(distance(palms[0], palms[1]) < 4, 'both actual palms meet before the shared run');
      linked = true;
    }
    if (window.contactAt === elapsed) {
      assert.ok(contact.pairCarryOrigins, 'the hit captures the existing bodies instead of restaging a joint throw');
      assert.ok(distance(contact.pairCarryOrigins.victim, scene.sim.bodies.get(actual.victim)) < .001, 'the shared fall starts at the victim already touched by the joined arms');
      const pair = pairIds.map(id => actors.get(id)), palms = pair.map(actor => actor.animation.contactPoints.hands[actor.linkedArm]);
      const head = victim.animation.contactPoints.head, neck = { x: head.x, y: head.y + victim.scale * 20 };
      assert.ok(distance(palms[0], palms[1]) < 4, 'the joined-arm contact must actually be painted before the arms are released');
      assert.ok(palms.every(palm => distance(palm, neck) < 8), 'the final painted hand line reaches the actual neck on the recorded impact frame');
      assert.equal(actual.impact - window.contactAt, 2200, 'the existing ordinary-speed shared throw is reused');
      hit = true;
    }
    if (contact.pairCarryOrigins && !exit) {
      const frame = arenaPairRushTargets(actual, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
      if (frame.lift > 1) {
        const contacts = victim.animation.contactPoints;
        for (const [id, endpoints] of [[frame.armsHolderId, contacts.hands], [frame.legsHolderId, contacts.feet]]) {
          const hands = actors.get(id).animation.contactPoints.hands;
          endpoints.forEach(endpoint => assert.ok(hands.some(hand => distance(hand, endpoint) < 4), `all four actual joint holds stay attached: ${detail}/${id}`));
        }
        held = true;
      }
    }
    if (exit?.round.id === actual.id && !thrown) {
      assert.equal(previousVictim?.pose, 'carried', 'the free flight inherits the last supported body');
      assert.ok(Math.abs(exit.lift - 142) < .01, 'the throw starts at the same existing overhead height');
      assert.ok(distance(previousVictim.contacts.origin, { x: exit.origin.x, y: exit.origin.y - exit.lift }) < .01, 'releasing the shared body cannot teleport it');
      thrown = true;
    }
    if (elapsed >= actual.resolve) {
      assert.equal(capturedRanks()[actual.victim], order.indexOf(actual.victim) + 1);
      resolved = true; break;
    }
    previousVictim = snapshot(victim, scene.sim.bodies.get(actual.victim));
  }
  assert.ok(linked && hit && held && thrown && resolved, 'the actual linked attack, groggy fall, four-point lift and single throw all complete');
});
