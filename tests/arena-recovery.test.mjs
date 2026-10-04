import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { ARENA_RECOVERY_DURATION, ARENA_RECOVERY_THROW_SPAN, ARENA_RECOVERY_EXIT_DURATION, arenaRecoveryTargets } = await source('src/arenaRecovery.ts');
const { arenaEscapeRoll } = await source('src/arenaEscape.ts');
const { arenaAction, arenaActionWords, arenaBeat, arenaThrow, arenaFocusRound, arenaPlaybackEnd, arenaRanks, arenaRounds, arenaSoloFinalTactics } = await source('src/arenaLogic.ts');
const { sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sandRadius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const eligible = new Set(['lift', 'brace', 'counter', 'final', 'catch', 'spin', 'armspin', 'suplex', 'elbow']);
const base = { id: 'recovery', index: 0, tactic: 'lift', aggressor: 'thrower', victim: 'receiver', start: ARENA_RECOVERY_DURATION, impact: ARENA_RECOVERY_DURATION + 5000, resolve: ARENA_RECOVERY_DURATION + 6100, end: ARENA_RECOVERY_DURATION + 6600, final: false, timeScale: 1, recovery: { start: 0, throwAt: ARENA_RECOVERY_THROW_SPAN, end: ARENA_RECOVERY_DURATION } };

test('a failed throw completes one airborne somersault and lands feet first inside the sand', () => {
  assert.equal(arenaRecoveryTargets({ ...base, recovery: undefined }, 2000, { x: 500, y: 416 }), undefined);
  for (const side of [-1, 1]) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, contactSide: side }, at = age => arenaRecoveryTargets(round, age, center);
    assert.equal(at(-1).active, false); assert.equal(at(0).active, true); assert.equal(at(ARENA_RECOVERY_DURATION).active, false);
    const span = ARENA_RECOVERY_THROW_SPAN, lifting = at(span * .85), release = at(span), midair = at(span + 460), landed = at(span + 880), recovered = at(span + 1099);
    assert.equal(lifting.stage, 'lift'); assert.equal(lifting.grip, true); assert.ok(lifting.height > 0 && lifting.height < 42);
    assert.equal(release.stage, 'somersault'); assert.equal(release.grip, false); assert.equal(release.height, 42); assert.equal(release.angle, -.22 * 42 / 52);
    assert.equal(midair.airborne, true); assert.ok(midair.height > 170 && midair.height < 190 && Math.abs(midair.angle) > 3, 'the full somersault has a tall readable apex');
    assert.equal(landed.stage, 'land'); assert.equal(landed.airborne, false); assert.equal(landed.height, 0);
    assert.ok(Math.abs(landed.angle - side * Math.PI * 2) < 1e-10, 'exactly one full rotation reaches the landing');
    assert.equal(recovered.stage, 'land'); assert.equal(recovered.height, 0); assert.equal(recovered.grip, false);
    assert.deepEqual(landed.receiver, recovered.receiver, 'the feet land at the same point instead of snapping to a home');
    assert.ok(distance(release.receiver, landed.receiver) >= 140 && distance(release.receiver, landed.receiver) <= 170, 'the failed throw carries far across the sand');
    assert.ok(sandRadius(landed.receiver) < .92, 'the cosmetic escape throw never sends a survivor over the rim');
    const body = { candidate: { id: 'receiver', name: '선수', color: '#ffad72' }, index: 1, x: landed.receiver.x, y: landed.receiver.y, depthY: landed.receiver.y, scale: 2.04, facing: -side, pose: 'land', angle: landed.angle, suspension: 0, phase: landed.landingPhase, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true };
    const contacts = sampleArenaFighterContacts(body, span + 880);
    assert.ok(contacts.feet.every(foot => sandRadius(foot) < 1), 'both painted foot endpoints remain inside the arena after the somersault');
    assert.ok(contacts.feet.every(foot => Math.abs(foot.y - (body.y - 2 * body.scale)) < .5), 'the completed rotation plants both soles within a quarter local pixel of their projected ground');
    let previous = release;
    const trajectory = { x: landed.receiver.x - release.receiver.x, y: landed.receiver.y - release.receiver.y };
    for (let elapsed = span + 16; elapsed < span + 880; elapsed += 16) {
      const current = at(elapsed);
      assert.ok(side * (current.angle - previous.angle) >= -1e-8, 'the somersault cannot reverse before the feet are straightened');
      assert.ok((current.receiver.x - previous.receiver.x) * trajectory.x + (current.receiver.y - previous.receiver.y) * trajectory.y >= -1e-8);
      assert.ok(sandRadius(current.receiver) < 1);
      previous = current;
    }
    const early = at(span + 40 + 840 * .25), late = at(span + 40 + 840 * .75);
    assert.ok(Math.abs(late.angle - early.angle) > Math.PI * 1.6, 'most of the complete rotation happens high around the apex');
  }
});

test('recovery geometry is continuous at lift, flight, landing and release boundaries at every clock scale', () => {
  for (const unit of [.4, .8, 1, 1.4]) for (const side of [-1, 1]) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const span = ARENA_RECOVERY_THROW_SPAN, round = { ...base, contactSide: side, timeScale: unit, start: ARENA_RECOVERY_DURATION * unit, recovery: { start: 0, throwAt: span * unit, end: ARENA_RECOVERY_DURATION * unit } };
    for (const boundary of [0, span * .30, span * .52, span * .72, span, span + 40, span + 40 + 840 * .08, span + 40 + 840 * .84, span + 880, span + 1100, span + 2100, ARENA_RECOVERY_DURATION]) {
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

test('the survival branch uses the same full lift and release timing as an ordinary throw', () => {
  for (const span of [3100, 3500, 3900, 5000]) for (const unit of [.5, 1, 1.4]) {
    const recovery = { ...base, timeScale: unit, recovery: { start: 0, throwAt: span * unit, end: (span + ARENA_RECOVERY_EXIT_DURATION) * unit } };
    const normal = { ...base, recovery: undefined, start: 0, impact: span * unit, resolve: (span + 1100) * unit };
    for (const progress of [.30, .52, .60, .72, .80, .92, .999]) {
      const elapsed = span * unit * progress, frame = arenaRecoveryTargets(recovery, elapsed, { x: 500, y: 416 }), ordinary = arenaBeat(normal, elapsed);
      assert.ok(Math.abs(frame.height - ordinary.liftProgress * 42) < 1e-8, 'the thrown survivor is not rushed through a short bonus lift');
      assert.ok(Math.abs(frame.liftPhase - ordinary.liftProgress) < 1e-8);
      const ordinaryAction = arenaAction(normal, elapsed);
      assert.ok(Math.abs(frame.phase - ordinaryAction.actors[0].phase) < 1e-12, 'the waist hold and loaded knees follow the same ordinary pose clock before release');
      assert.ok(Math.abs(frame.angle - -.22 * ordinaryAction.lift / 52) < 1e-12, 'the lifted victim inherits the ordinary slight body tilt rather than revealing a separate upright escape rig');
    }
    for (const age of [0, 16, 39, 40]) {
      const recovered = arenaRecoveryTargets(recovery, (span + age) * unit, { x: 500, y: 416 });
      const ordinary = arenaThrow(age * unit, { x: 523, y: 416 }, { x: 678, y: 425 }, 1, unit, { lift: 42, angle: -.22 * 42 / 52 });
      assert.equal(recovered.height, ordinary.height, 'the release inherits the normal 40ms hold instead of immediately dropping the carried height');
      assert.equal(recovered.angle, ordinary.angle, 'the ordinary release hold finishes before the escape rotation begins in flight');
    }
    assert.equal(arenaRecoveryTargets(recovery, (span + 879) * unit, { x: 500, y: 416 }).airborne, true);
    assert.equal(arenaRecoveryTargets(recovery, (span + 880) * unit, { x: 500, y: 416 }).stage, 'land');
  }
});

test('the optional somersault recovery selects five percent of eligible story rolls and never redraws a final', () => {
  let order;
  for (let variant = 0; variant < 100 && !order; variant++) {
    const candidate = [`recovery-${variant}-a`, `recovery-${variant}-v`], final = arenaRounds(candidate).at(-1);
    if (!final.helper && !final.rushOutcome && eligible.has(final.tactic)) order = candidate;
  }
  assert.ok(order); assert.ok(arenaRounds(order).every(round => !round.recovery), 'omitting the cosmetic seed preserves a game without the optional prelude');
  assert.deepEqual(arenaRounds(order), arenaRounds(order, 44_000, 7, undefined));
  let occurrences = 0, eligibleSamples = 0, addedBoundary = 0;
  const samples = 4096, original = [...order], expected = Object.fromEntries(order.map((id, index) => [id, index + 1]));
  for (let seed = 0; seed < samples; seed++) {
    const rounds = arenaRounds(order, 44_000, 7, seed), final = rounds.at(-1);
    const baseTactic = arenaSoloFinalTactics[arenaEscapeRoll(seed, final.index + 1717) % arenaSoloFinalTactics.length];
    const earlierSpecial = final.supermanPunch || final.slideTrip || final.tripCounter || final.kickCatch;
    if (eligible.has(baseTactic) && !earlierSpecial && final.recovery?.kind !== 'overhead-escape') {
      eligibleSamples++;
      const roll = arenaEscapeRoll(seed, final.index + 67) % 100;
      assert.equal(!!final.recovery, roll < 5, 'all existing rolls 0–3 survive; only roll 4 adds a new somersault');
      if (final.recovery) occurrences++;
      if (roll === 4) addedBoundary++;
    }
    assert.equal(final.aggressor, order[0]); assert.equal(final.victim, order[1]); assert.equal(final.escape, undefined, 'the final pair cannot run away');
    assert.deepEqual(arenaRanks(order, 44_000, 44_000, 7, seed), expected);
  }
  assert.ok(addedBoundary > 0, 'the added one-percent band is exercised by deterministic cosmetic seeds');
  assert.ok(occurrences / eligibleSamples > .037 && occurrences / eligibleSamples < .063, `${occurrences}/${eligibleSamples}: a somersault remains a rare cosmetic surprise`);
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
      assert.ok(Math.abs(round.start - round.recovery.throwAt - ARENA_RECOVERY_EXIT_DURATION * round.timeScale) < 1e-8);
      const liftSpan = (round.recovery.throwAt - round.recovery.start) / round.timeScale;
      assert.ok(round.final ? Math.abs(liftSpan - 5000) < 1e-8 : liftSpan >= 3100 - 1e-8 && liftSpan <= 3900 + 1e-8, 'the survivor is lifted for a full normal bout, not a shortened bonus motion');
      assert.ok(round.start < round.impact && round.impact < round.resolve && round.resolve <= round.end);
      const before = arenaRanks(order, round.recovery.start, duration, rushRoll, seed);
      for (const elapsed of [round.recovery.start, (round.recovery.start + round.recovery.end) / 2, round.recovery.end - .001]) {
        assert.deepEqual(arenaRanks(order, elapsed, duration, rushRoll, seed), before, 'the landing survivor remains unranked throughout the prelude');
        assert.equal(arenaFocusRound(order, elapsed, duration, rushRoll, seed).id, round.id);
        const action = arenaAction(round, elapsed);
        assert.equal(action.outcome, 'pending');
        assert.deepEqual(action.actors.map(actor => actor.id), [round.recovery.throwerId ?? round.aggressor, round.victim]);
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


test('a somersault survivor runs clear before the next bout and the thrower calls the throw', () => {
  for (const side of [-1, 1]) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, contactSide: side }, at = age => arenaRecoveryTargets(round, ARENA_RECOVERY_THROW_SPAN + age, center);
    const landed = at(1100), departed = at(2100), ready = at(ARENA_RECOVERY_EXIT_DURATION);
    assert.equal(at(1500).stage, 'separate');
    assert.ok(distance(departed.receiver, departed.thrower) > distance(landed.receiver, landed.thrower) + 12, 'both surviving fighters leave their old grip behind');
    assert.deepEqual(ready.receiver, departed.receiver, 'the survivor settles clear rather than being pulled straight back to the same opponent');
    let gap = distance(landed.receiver, landed.thrower);
    for (let age = 1116; age <= 2100; age += 16) {
      const frame = at(age), next = distance(frame.receiver, frame.thrower);
      assert.ok(next >= gap - 1e-8, 'the departure never closes on the old opponent');
      gap = next;
    }
    for (const age of [40, 460, 880, 1000]) {
      assert.ok(arenaActionWords(round, ARENA_RECOVERY_THROW_SPAN + age).some(word => word.id === round.aggressor && word.word === '던지기!'));
    }
  }
});
