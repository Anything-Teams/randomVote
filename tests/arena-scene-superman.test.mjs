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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'supermanTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} supermanTestRanks = ranks;`)
  .replace(draw, 'supermanTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.surpriseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.surpriseEnd(); });');
source += '\nlet supermanTestActors, supermanTestRanks; const supermanTestScenery = () => {}; export const capturedActors = () => supermanTestActors; export const capturedRanks = () => supermanTestRanks; export { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaSupermanPunchTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaSupermanPunchTargets, capturedActors, capturedRanks } = module.exports;
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
function game(seed, reversed = false, mirrored = false, candidateOrder) {
  const props = { candidates: (candidateOrder ?? (reversed ? [...order].reverse() : order)).map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : 16, false);
    // The rare punch has a deterministic ordinary layout. Reflect its real
    // initialized bodies once to exercise the other physical heading as well.
    if (mirrored && elapsed === 0) {
      for (const body of sim.bodies.values()) {
        body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.motorX = 0; body.animation = undefined;
      }
      for (const contact of sim.contacts.values()) {
        contact.center.x = 1000 - contact.center.x; contact.side *= -1;
        if (contact.round.contactSide) contact.round = { ...contact.round, contactSide: -contact.round.contactSide };
        if (contact.chargerOrigin) contact.chargerOrigin.x = 1000 - contact.chargerOrigin.x;
        if (contact.supermanPunchOrigins) {
          for (const point of Object.values(contact.supermanPunchOrigins)) point.x = 1000 - point.x;
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

for (const mirrored of [false, true]) test(`a live Superman punch leaps, makes fist contact, and throws only its opponent out (${mirrored ? 'mirrored' : 'ordinary'})`, () => {
  const seed = 1119, planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.supermanPunch);
  assert.ok(planned, 'the independent rare draw selects this attack');
  const scene = game(seed, false, mirrored), stages = new Set();
  let jumped = false, hit = false, landed = false, flew = false, resolved = false, peak = 0, previousDriver, previousVictim;
  for (let elapsed = 0; elapsed <= planned.resolve + 2000; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.supermanPunchOrigins || !contact.round.supermanPunch) continue;
    const actual = contact.round, window = actual.supermanPunch;
    const frame = arenaSupermanPunchTargets(window, elapsed, contact.center, contact.supermanPunchOrigins, actual.contactSide);
    const driver = actors.get(actual.aggressor), victim = actors.get(actual.victim), body = scene.sim.bodies.get(actual.aggressor), exit = scene.sim.exits.get(actual.victim);
    const detail = `${mirrored}/${elapsed}/${frame.stage}`;
    stages.add(frame.stage); peak = Math.max(peak, frame.height);
    assert.ok(points(driver.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `the actual jumping rig remains finite: ${detail}`);
    if (previousDriver && elapsed < actual.resolve) assert.ok(distance(body, previousDriver) <= 240 * .016 + .01, `the real runner and jump cannot teleport: ${detail}`);
    previousDriver = { x: body.x, y: body.y };
    if (frame.height > 1) { assert.equal(driver.pose, 'superman'); jumped = true; }
    if (window.hitAt === elapsed) {
      assert.ok(jumped && frame.height > 10, 'the hit happens during the actual jump');
      assert.ok(frame.punchStrength > .8, 'the front arm extends before impact');
      const fist = driver.animation.contactPoints.hands[1], head = victim.animation.contactPoints.head;
      const target = { x: head.x, y: head.y + victim.scale * 10 };
      assert.ok(distance(fist, target) < 8, `the final painted fist reaches the actual face on the recorded contact: ${distance(fist, target)}/${detail}/${JSON.stringify({fist,target,captured:contact.supermanPunchOrigins.target})}`);
      assert.equal(exit?.launchedAt, elapsed, 'only the actual fist contact starts flight');
      assert.ok(distance(exit.origin, contact.supermanPunchOrigins.victim) < .001, 'the opponent is launched from the touched footprint');
      assert.equal(actual.impact, elapsed); hit = true;
    }
    if (!hit) assert.ok(!exit, 'an unrecorded punch cannot eject the opponent');
    if (exit?.round.id === actual.id && previousVictim && elapsed > window.hitAt) {
      if (victim.depthY - victim.y > 1) flew = true;
    }
    if (hit && frame.stage === 'land') {
      assert.equal(frame.height, 0); assert.equal(driver.pose, 'land');
      assert.ok(Math.hypot((body.x - 500) / 303, (body.y - 416) / 112) < 1, 'the attacker lands inside the sand'); landed = true;
    }
    assert.ok(!scene.sim.exits.has(actual.aggressor), 'the puncher stays in the arena');
    if (elapsed >= actual.resolve) {
      assert.equal(capturedRanks()[actual.victim], order.indexOf(actual.victim) + 1, 'the drawn rank is preserved'); resolved = true; break;
    }
    previousVictim = victim && snapshot(victim, scene.sim.bodies.get(actual.victim));
  }
  assert.ok(jumped && hit && landed && flew && resolved, `the whole live punch completes: ${[...stages]}`);
  assert.ok(peak > 23 && stages.has('approach') && stages.has('load') && stages.has('punch') && stages.has('recover'));
});

test('an initial close layout resumes the ordinary exchange instead of waiting for an impossible Superman punch', () => {
  const seed = 1119, planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.supermanPunch);
  const scene = game(seed, false, false, ['4', '1', '2', '3', '5']);
  scene.step(0);
  const contact = scene.sim.contacts.get(planned.id);
  assert.ok(contact);
  assert.equal(contact.round.supermanPunch, undefined, 'geometry eligibility also applies on initialization and seeking');
  assert.equal(contact.supermanPunchOrigins, undefined, 'a close layout never reserves an impossible launch');
  assert.equal(contact.round.tactic, 'counter', 'the existing close-range contact rule selects the ordinary counter');
  for (let elapsed = 16; elapsed <= planned.resolve + 16; elapsed += 16) scene.step(elapsed);
  assert.equal(capturedRanks()[planned.victim], order.indexOf(planned.victim) + 1, 'the ordinary encounter still completes its drawn elimination');
});
