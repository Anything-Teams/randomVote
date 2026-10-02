import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { ARENA_RECOVERY_DURATION, arenaRecoveryTargets } = await source('src/arenaRecovery.ts');
const { arenaAction, arenaFocusRound, arenaPlaybackEnd, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sandRadius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const eligible = new Set(['lift', 'brace', 'counter', 'final', 'catch', 'spin', 'armspin', 'suplex', 'elbow']);
const base = { id: 'recovery', index: 0, tactic: 'lift', aggressor: 'thrower', victim: 'receiver', start: 3100, impact: 8100, resolve: 9200, end: 9700, final: false, timeScale: 1, recovery: { start: 0, end: ARENA_RECOVERY_DURATION } };

test('a failed throw completes one airborne somersault and lands feet first inside the sand', () => {
  assert.equal(arenaRecoveryTargets({ ...base, recovery: undefined }, 2000, { x: 500, y: 416 }), undefined);
  for (const side of [-1, 1]) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, contactSide: side }, at = age => arenaRecoveryTargets(round, age, center);
    assert.equal(at(-1).active, false); assert.equal(at(0).active, true); assert.equal(at(3100).active, false);
    const lifting = at(1650), release = at(1850), midair = at(2200), landed = at(2550), recovered = at(2800);
    assert.equal(lifting.stage, 'lift'); assert.equal(lifting.grip, true); assert.ok(lifting.height > 0 && lifting.height < 42);
    assert.equal(release.stage, 'somersault'); assert.equal(release.grip, false); assert.equal(release.height, 42); assert.ok(Math.abs(release.angle) === 0);
    assert.equal(midair.airborne, true); assert.ok(midair.height > 70 && Math.abs(midair.angle) > 3, 'the body turns while clearly airborne');
    assert.equal(landed.stage, 'land'); assert.equal(landed.airborne, false); assert.equal(landed.height, 0);
    assert.ok(Math.abs(landed.angle - side * Math.PI * 2) < 1e-10, 'exactly one full rotation reaches the landing');
    assert.equal(recovered.stage, 'release'); assert.equal(recovered.height, 0); assert.equal(recovered.grip, false);
    assert.deepEqual(landed.receiver, recovered.receiver, 'the feet land at the same point instead of snapping to a home');
    assert.ok(sandRadius(landed.receiver) < .92, 'the cosmetic escape throw never sends a survivor over the rim');
    const body = { candidate: { id: 'receiver', name: '선수', color: '#ffad72' }, index: 1, x: landed.receiver.x, y: landed.receiver.y, depthY: landed.receiver.y, scale: 2.04, facing: -side, pose: 'land', angle: landed.angle, suspension: 0, phase: landed.landingPhase, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true };
    const contacts = sampleArenaFighterContacts(body, 2550);
    assert.ok(contacts.feet.every(foot => sandRadius(foot) < 1), 'both painted foot endpoints remain inside the arena after the somersault');
    assert.ok(contacts.feet.every(foot => Math.abs(foot.y - (body.y - 2 * body.scale)) < .5), 'the completed rotation plants both soles within a quarter local pixel of their projected ground');
    let previous = release;
    for (let elapsed = 1866; elapsed < 2550; elapsed += 16) {
      const current = at(elapsed);
      assert.ok(side * (current.angle - previous.angle) > 0, 'the rotation cannot reverse or pause midair');
      assert.ok(side * (current.receiver.x - previous.receiver.x) >= -1e-8);
      assert.ok(sandRadius(current.receiver) < 1);
      previous = current;
    }
  }
});

test('recovery geometry is continuous at lift, flight, landing and release boundaries at every clock scale', () => {
  for (const unit of [.4, .8, 1, 1.4]) for (const side of [-1, 1]) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, contactSide: side, timeScale: unit, start: ARENA_RECOVERY_DURATION * unit, recovery: { start: 0, end: ARENA_RECOVERY_DURATION * unit } };
    for (const boundary of [0, 1300, 1850, 2550, 2750, 3100]) {
      const before = arenaRecoveryTargets(round, boundary * unit - .001, center), after = arenaRecoveryTargets(round, boundary * unit + .001, center);
      for (const key of ['thrower', 'receiver', 'returnCenter']) assert.ok(distance(before[key], after[key]) < .005, `${boundary}/${unit}/${key}: a label change cannot teleport a root`);
      for (const key of ['height', 'angle']) assert.ok(Math.abs(before[key] - after[key]) < .005, `${boundary}/${unit}/${key}: release inherits the held body`);
    }
    for (let elapsed = 0; elapsed <= round.start; elapsed += 16) {
      const sample = arenaRecoveryTargets(round, elapsed, center);
      assert.deepEqual(sample, arenaRecoveryTargets(round, elapsed, center), 'pause and direct seek keep identical choreography');
      assert.ok([sample.height, sample.angle, sample.phase, sample.receiver.x, sample.receiver.y].every(Number.isFinite));
      assert.ok(sandRadius(sample.thrower) < 1 && sandRadius(sample.receiver) < 1);
    }
  }
});

test('the optional recovery prelude is close to four percent of eligible encounters and never redraws a final', () => {
  let order;
  for (let variant = 0; variant < 100 && !order; variant++) {
    const candidate = [`recovery-${variant}-a`, `recovery-${variant}-v`], final = arenaRounds(candidate).at(-1);
    if (!final.helper && !final.rushOutcome && eligible.has(final.tactic)) order = candidate;
  }
  assert.ok(order); assert.ok(arenaRounds(order).every(round => !round.recovery), 'omitting the cosmetic seed preserves a game without the optional prelude');
  assert.deepEqual(arenaRounds(order), arenaRounds(order, 44_000, 7, undefined));
  let occurrences = 0;
  const samples = 4096, original = [...order], expected = Object.fromEntries(order.map((id, index) => [id, index + 1]));
  for (let seed = 0; seed < samples; seed++) {
    const rounds = arenaRounds(order, 44_000, 7, seed), final = rounds.at(-1);
    if (final.recovery) occurrences++;
    assert.equal(final.aggressor, order[0]); assert.equal(final.victim, order[1]); assert.equal(final.escape, undefined, 'the final pair cannot run away');
    assert.deepEqual(arenaRanks(order, 44_000, 44_000, 7, seed), expected);
  }
  assert.ok(occurrences / samples > .027 && occurrences / samples < .053, `${occurrences}/${samples}: a recovery is a rare cosmetic surprise`);
  assert.deepEqual(order, original);
});

test('a recovery keeps both drawn participants alive until the later deciding bout and never extends the game past its deadline', () => {
  let exercised = 0;
  for (const duration of [40_000, 44_000, 62_000]) for (const rushRoll of [0, 7]) for (let count = 2; count <= 10; count++) for (let seed = 0; seed < 36; seed++) {
    const order = Array.from({ length: count }, (_, index) => `recovery-field-${seed}-${index}`), original = [...order];
    const rounds = arenaRounds(order, duration, rushRoll, seed), expected = Object.fromEntries(order.map((id, index) => [id, index + 1]));
    assert.ok(rounds.filter(round => round.recovery).length <= 1, 'a match cannot repeatedly pad its length with failed throws');
    rounds.forEach((round, index) => {
      if (!round.recovery) return;
      exercised++;
      assert.equal(round.escape, undefined); assert.equal(round.helper, undefined); assert.equal(round.rushOutcome, undefined);
      assert.ok(eligible.has(round.tactic), 'a failed throw only precedes an encounter which can take a throwing grip');
      assert.equal(round.recovery.start, rounds[index - 1]?.resolve ?? 0);
      assert.equal(round.recovery.end, round.start);
      assert.ok(Math.abs(round.start - round.recovery.start - ARENA_RECOVERY_DURATION * round.timeScale) < 1e-8);
      assert.ok(round.start < round.impact && round.impact < round.resolve && round.resolve <= round.end);
      const before = arenaRanks(order, round.recovery.start, duration, rushRoll, seed);
      for (const elapsed of [round.recovery.start, (round.recovery.start + round.recovery.end) / 2, round.recovery.end - .001]) {
        assert.deepEqual(arenaRanks(order, elapsed, duration, rushRoll, seed), before, 'the landing survivor remains unranked throughout the prelude');
        assert.equal(arenaFocusRound(order, elapsed, duration, rushRoll, seed).id, round.id);
        const action = arenaAction(round, elapsed);
        assert.equal(action.outcome, 'pending');
        assert.deepEqual(action.actors.map(actor => actor.id), [round.aggressor, round.victim]);
        assert.ok(!before[round.aggressor] && !before[round.victim]);
      }
      assert.deepEqual(arenaRanks(order, round.resolve - .001, duration, rushRoll, seed), before);
      assert.equal(arenaRanks(order, round.resolve, duration, rushRoll, seed)[round.victim], expected[round.victim]);
    });
    assert.equal(arenaPlaybackEnd(order, duration, rushRoll, seed), rounds.at(-1).end);
    assert.ok(rounds.at(-1).end <= duration);
    assert.deepEqual(arenaRanks(order, duration, duration, rushRoll, seed), expected);
    assert.deepEqual(order, original);
  }
  assert.ok(exercised > 40, 'small and large fields both exercise successful landings');
});
