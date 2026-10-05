import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Replay the actual eight-person match from zero. Capture the live painted
// pickup and rankings; no actor positions, contact times or outcomes are set.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const grip = 'if (feet.every((foot, leg) => Math.hypot(foot.x - hands[1 - leg].x, foot.y - hands[1 - leg].y) < 5)) {';
assert.ok(source.includes(draw) && source.includes(ranks) && source.includes(grip));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'elbowTestScenery(ctx, clock,')
  .replace(draw, `elbowTestActors = actors; ${draw}`)
  .replace(ranks, `${ranks} elbowTestRanks = ranks;`)
  .replace(grip, `${grip} elbowTestGrip = { id: exchange.id, at: elapsed, feet: structuredClone(feet), hands: structuredClone(hands) };`);
source += '\nlet elbowTestActors, elbowTestRanks, elbowTestGrip; const elbowTestScenery = () => {}; export const capture = () => ({ actors: elbowTestActors, ranks: elbowTestRanks, grip: elbowTestGrip }); export { render, createArenaCamera, arenaRounds }; export { ARENA_DRAGGED_ANKLE_THROW_TIMING } from "./arenaWrestlingMoves";';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture, ARENA_DRAGGED_ANKLE_THROW_TIMING } = module.exports;
const rimThrowDuration = ARENA_DRAGGED_ANKLE_THROW_TIMING.raise + ARENA_DRAGGED_ANKLE_THROW_TIMING.heave;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (one, two) => Math.hypot(one.x - two.x, one.y - two.y);
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;

for (const delta of [16, 50]) {
  test(`natural tapered-rim elbow ${delta}ms: real two-foot pickup, drag, rim release and drawn ranks complete`, () => {
    const order = Array.from({ length: 8 }, (_, index) => String(index + 1));
    const duration = 61050, seed = 13, rushRoll = 7;
    const planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.tactic === 'elbow');
    assert.ok(planned && planned.id === 'arena-1' && planned.aggressor === '1' && planned.victim === '7');
    const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    let awaitingAt, gripAt, dragOrigin, throwAt, releaseAt;
    let dragFrames = 0, dragDistance = 0, heldThrowFrames = 0, landed = false, finished = false;

    for (let elapsed = 0; elapsed < duration + 45000; elapsed += delta) {
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      const { actors, ranks, grip } = capture(), contact = sim.contacts.get(planned.id), actual = contact?.round;
      const caster = actors.get(planned.aggressor), victim = actors.get(planned.victim), exit = sim.exits.get(planned.victim);
      if (actual) assert.equal(actual.tactic, 'elbow', 'the rare elbow must complete without substituting a different move');
      if (actual?.elbowGripAt === null && contact.elbowFall) {
        awaitingAt ??= elapsed;
        assert.ok(elapsed - awaitingAt < 3000, 'the real grounded pickup cannot reserve this round forever');
      }
      if (actual?.elbowGripAt != null && gripAt === undefined) {
        gripAt = actual.elbowGripAt;
        assert.equal(gripAt, elapsed, 'pickup is committed on its actual contact frame');
        assert.ok(grip?.id === planned.id && grip.at === elapsed, 'both live palms were sampled at the selected pickup');
        assert.ok(grip.feet.every((foot, leg) => distance(foot, grip.hands[1 - leg]) < 5), 'both actual palms hold their corresponding toe endpoints');
        assert.ok(awaitingAt !== undefined && gripAt - awaitingAt < 3000);
        dragOrigin = { x: victim.x, y: victim.y };
      }
      if (gripAt !== undefined && actual?.floorFinish?.throwAt == null && caster && victim) {
        const hands = caster.animation.contactPoints.hands, feet = victim.animation.contactPoints.feet;
        assert.ok(feet.every((foot, leg) => distance(foot, hands[leg]) < 5), `${elapsed}: the painted drag preserves both real ankle contacts after the pickup gate`);
        assert.ok(inside(sim.bodies.get(planned.aggressor)), 'the attacker remains on the sand while holding the feet');
        dragFrames++;
        dragDistance = Math.max(dragDistance, distance(victim, dragOrigin));
      }
      if (actual?.floorFinish?.throwAt != null) {
        throwAt ??= actual.floorFinish.throwAt;
        assert.ok(gripAt !== undefined && throwAt > gripAt, 'the attacker reaches the rim before beginning the throw');
        if (actual.floorFinish.releaseAt == null) {
          assert.equal(caster.pose, 'throw');
          assert.ok(victim.spinSuspension, 'the visible throw raises the body from its actual held feet');
          assert.ok(inside(sim.bodies.get(planned.aggressor)), 'the thrower stays inside the ring');
          const hands = caster.animation.contactPoints.hands, feet = victim.animation.contactPoints.feet;
          assert.ok(feet.every((foot, leg) => distance(foot, hands[leg]) < 5), 'the raised throw still holds both painted foot ends');
          heldThrowFrames++;
        }
      }
      if (actual?.floorFinish?.releaseAt != null) {
        releaseAt ??= actual.floorFinish.releaseAt;
        assert.ok(releaseAt - throwAt >= rimThrowDuration && releaseAt - throwAt < rimThrowDuration + delta);
        assert.ok(exit?.spinFlight && exit.launchedAt === releaseAt, 'the full throw opens its palms into actual free flight');
        assert.ok(!inside(exit.landing), 'the thrown body lands beyond the sand');
      }
      if (ranks[planned.victim]) {
        assert.equal(ranks[planned.victim], 7);
        assert.ok(releaseAt !== undefined && elapsed > releaseAt);
        landed = true;
      }
      if (Object.keys(ranks).length === order.length) {
        assert.deepEqual(ranks, Object.fromEntries(order.map((id, index) => [id, index + 1])));
        finished = true;
        break;
      }
    }
    assert.ok(gripAt !== undefined && dragFrames >= 10 && dragDistance > 8, 'the actual held floor drag is visible');
    assert.ok(throwAt !== undefined && releaseAt !== undefined && heldThrowFrames >= rimThrowDuration / delta - 2);
    assert.ok(landed && finished, 'the formerly blocked elbow and the full natural match reach their unchanged drawn ranks');
  });
}
