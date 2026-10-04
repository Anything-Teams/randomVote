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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'recoveryTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} recoveryTestRanks = ranks;`)
  .replace(draw, 'recoveryTestActors = actors; recoveryTestWords = words; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.surpriseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.surpriseEnd(); });');
source += '\nlet recoveryTestActors, recoveryTestRanks, recoveryTestWords; const recoveryTestScenery = () => {}; export const capturedActors = () => recoveryTestActors; export const capturedRanks = () => recoveryTestRanks; export const capturedWords = () => recoveryTestWords; export { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaRecoveryTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaRecoveryTargets, capturedActors, capturedRanks, capturedWords } = module.exports;
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
function game(seed, reversed = false, mirrored = false, candidateOrder, suppliedOrder = order, frameDelta = 16) {
  const props = { candidates: (candidateOrder ?? (reversed ? [...order].reverse() : order)).map(id => ({ id, name: id, color: '#ffad72' })), order: suppliedOrder, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : frameDelta, false);
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
        if (contact.kickCatchOrigins) {
          for (const point of Object.values(contact.kickCatchOrigins)) if (point && typeof point === 'object' && 'x' in point) point.x = 1000 - point.x;
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

const fixtures = [
  { kind: undefined, seed: 3, order: ['1', '2', '4', '5', '3'] },
  { kind: 'overhead-escape', seed: 117, order: ['1', '5', '4', '3', '2'] },
];
for (const fixture of fixtures) for (const [mirrored, frameDelta] of [[false, 16], [true, 50]]) test(`live ${fixture.kind ?? 'somersault'} leaves the original thrower, meets another survivor and cannot remake the old duel (${mirrored ? 'mirror' : 'ordinary'}, ${frameDelta}ms)`, () => {
  const planned = arenaRounds(fixture.order, duration, rushRoll, fixture.seed).find(round => round.recovery?.kind === fixture.kind && round.recovery && !round.final);
  assert.ok(planned && planned.index === 0, 'a real numeric-id draw chooses the first recovery without injecting clocks');
  const originalThrower = planned.recovery.throwerId;
  assert.ok(originalThrower && originalThrower !== planned.aggressor);
  const scene = game(fixture.seed, false, mirrored, order, fixture.order, frameDelta);
  let landedGap, departureGap, running = false, airborne = false, previous, maxClosing = 0, finished = false, deciding = false, rankResolved = false, called = false;
  const isOldPair = round => [round.aggressor, round.victim].includes(originalThrower) && [round.aggressor, round.victim].includes(planned.victim);
  for (let elapsed = 0; elapsed < 16000; elapsed += frameDelta) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact) continue;
    const actual = contact.round, frame = arenaRecoveryTargets(actual, elapsed, contact.center);
    const survivor = actors.get(planned.victim), thrower = actors.get(originalThrower);
    const gap = distance(scene.sim.bodies.get(planned.victim), scene.sim.bodies.get(originalThrower));
    if (frame?.active) {
      if (frame.airborne) airborne = true;
      if (frame.stage === 'lift' && !frame.kind && capturedWords().get(originalThrower) === '던지기!') called = true;
      if (frame.stage === 'land') landedGap = gap;
      if (frame.stage === 'separate' || frame.stage === 'release') {
        assert.equal(survivor.gripTarget, undefined); assert.equal(thrower.gripTarget, undefined);
        if (survivor.pose === 'run') running = true;
        if (previous) maxClosing = Math.max(maxClosing, previous - gap);
        previous = gap; departureGap = gap;
        assert.ok(points(survivor.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
        assert.equal(scene.sim.exits.has(planned.victim), false, 'a successful landing is not an elimination');
        assert.equal(capturedRanks()[planned.victim], undefined);
      }
    }
    if (contact.recoveryFinished) {
      finished = true;
      assert.equal(actual.aggressor, planned.aggressor, 'the later deciding fighter is a different actual survivor');
      assert.notEqual(actual.aggressor, originalThrower);
      for (const mini of scene.sim.minis.values()) assert.ok(!isOldPair(mini), 'the original thrower and survivor cannot immediately remake the same background duel');
      for (const other of scene.sim.contacts.values()) if (other.started && elapsed < other.round.resolve && (!other.round.recovery || elapsed >= other.round.recovery.end)) assert.ok(!isOldPair(other.round), 'an own bout cannot restore the original thrower after the landing');
      deciding ||= !!contact.metAt || !!contact.committed;
      if (capturedRanks()[planned.victim] !== undefined) {
        assert.equal(capturedRanks()[planned.victim], fixture.order.indexOf(planned.victim) + 1);
        rankResolved = true; break;
      }
    }
  }
  assert.ok(airborne && running && finished && deciding && rankResolved, JSON.stringify({ airborne, running, finished, deciding, rankResolved }));
  if (!fixture.kind) assert.ok(called, 'the actual lifted body is accompanied by the early thrower call');
  assert.ok(departureGap > landedGap + 12, `${departureGap}/${landedGap}: a recovered fighter visibly leaves the original opponent`);
  assert.ok(maxClosing < 1, 'landing and departure cannot snap back into another grip');
});

for (const fixture of fixtures) for (const mirrored of [false, true]) test(`a landed ${fixture.kind ?? 'somersault'} keeps its painted arms connected when departure begins (${mirrored ? 'mirror' : 'ordinary'})`, () => {
  for (const frameDelta of [16, 50]) {
    const planned = arenaRounds(fixture.order, duration, rushRoll, fixture.seed).find(round => round.recovery?.kind === fixture.kind && round.recovery && !round.final);
    assert.ok(planned);
    const scene = game(fixture.seed, false, mirrored, order, fixture.order, frameDelta);
    let previous, boundarySeen = false;
    const armPoints = rig => [...rig.shoulders, ...rig.elbows, ...rig.hands];
    for (let elapsed = 0; elapsed <= planned.recovery.end; elapsed += frameDelta) {
      const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
      if (!contact) continue;
      const frame = arenaRecoveryTargets(contact.round, elapsed, contact.center);
      if (!frame?.active) continue;
      const survivor = actors.get(planned.victim), rig = survivor.animation.contactPoints;
      if (previous?.stage === 'land' && frame.stage === 'separate') {
        boundarySeen = true;
        const cap = 10 + frameDelta * .55;
        armPoints(rig).forEach((point, index) => {
          const gap = distance(point, armPoints(previous.rig)[index]);
          assert.ok(gap < cap, `${fixture.kind ?? 'somersault'}/${mirrored}/${frameDelta}ms/${elapsed}: a grounded departure cannot mirror an arm endpoint by ${gap.toFixed(2)}px`);
        });
        assert.equal(scene.sim.exits.has(planned.victim), false);
        assert.equal(capturedRanks()[planned.victim], undefined);
        break;
      }
      previous = { stage: frame.stage, rig: structuredClone(rig) };
    }
    assert.ok(boundarySeen, 'the actual first departure frame follows a visible grounded landing');
  }
});
