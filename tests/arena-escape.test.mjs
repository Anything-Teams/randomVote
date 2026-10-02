import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaActionWords, arenaEliminatedIds, arenaFocusRound, arenaMiniExchanges, arenaNarration, arenaPlaybackEnd, arenaPodium, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { ARENA_ESCAPE_DURATION, ARENA_ESCAPE_RELEASE_DURATION, arenaEscapeTargets } = await source('src/arenaEscape.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const radius = p => Math.hypot((p.x - 500) / 303, (p.y - 416) / 112);
const base = { id: 'escape', index: 0, tactic: 'brace', aggressor: 'a', victim: 'v', start: 3800, impact: 6900, resolve: 8000, end: 8000, final: false, timeScale: 1 };
const boundaries = [1200, 1440, 1620, 2520, 2840, 3800];

test('cosmetic escapes are optional, quarter-probability, finite and never change the supplied draw', () => {
  const pair = ['a', 'v'];
  assert.deepEqual(arenaRounds(pair), arenaRounds(pair, 44_000, 7, undefined));
  assert.ok(arenaRounds(pair).every(round => !round.escape));
  let escaped = 0, separated = 0;
  const runnerRoles = new Set();
  for (let seed = 0; seed < 4000; seed++) {
    const round = arenaRounds(pair, 44_000, 7, seed)[0];
    if (round.escape) { escaped++; runnerRoles.add(round.escape.runnerId); if (round.escape.outcome === 'separate') separated++; }
  }
  assert.ok(escaped / 4000 > .23 && escaped / 4000 < .27);
  assert.ok(separated / escaped > .47 && separated / escaped < .53, 'roughly half the escapes break contact completely');
  assert.equal(runnerRoles.size, 2, 'the runner is cosmetic and can be either eventual rank');
  let cappedGames = 0;
  for (const duration of [40_000, 44_000, 62_000]) for (const rushRoll of [0, 7]) for (let count = 2; count <= 10; count++) for (let seed = 0; seed < 24; seed++) {
    const order = Array.from({ length: count }, (_, i) => `draw-${seed}-${i}`), original = [...order];
    const rounds = arenaRounds(order, duration, rushRoll, seed), expected = Object.fromEntries(order.map((id, i) => [id, i + 1]));
    assert.ok(rounds.filter(round => round.escape).length <= 2);
    if (rounds.filter(round => round.escape).length === 2) cappedGames++;
    rounds.forEach((round, index) => {
      const entry = round.escape?.start ?? round.start;
      assert.equal(entry, rounds[index - 1]?.resolve ?? 0, 'each next scene immediately follows the previous deciding result');
      assert.ok([entry, round.start, round.impact, round.resolve, round.end].every(Number.isFinite));
      assert.ok(entry <= round.start && round.start < round.impact && round.impact < round.resolve && round.resolve <= round.end);
      if (!round.escape) return;
      assert.ok(!round.helper && !round.rushOutcome, 'three-person maneuvers do not invent another escaping pair');
      assert.ok(!rounds[index - 1]?.escape, 'escapes cannot run consecutively');
      assert.equal(round.escape.releasedUntil, round.start);
      assert.ok(Math.abs(round.start - round.escape.end - (round.escape.outcome === 'separate' ? ARENA_ESCAPE_RELEASE_DURATION * round.timeScale : 0)) < 1e-8);
      assert.ok(Math.abs(round.escape.end - round.escape.start - ARENA_ESCAPE_DURATION * round.timeScale) < 1e-8);
      const ranks = arenaRanks(order, entry, duration, rushRoll, seed);
      for (const elapsed of [entry, (entry + round.escape.end) / 2, round.escape.end - .001]) {
        assert.deepEqual(arenaRanks(order, elapsed, duration, rushRoll, seed), ranks, 'running away does not eliminate either opponent');
        assert.equal(arenaFocusRound(order, elapsed, duration, rushRoll, seed).id, round.id);
        const action = arenaAction(round, elapsed);
        assert.equal(action.lift, 0); assert.equal(action.liftedId, undefined); assert.equal(action.outcome, 'pending');
        assert.deepEqual(action.actors.map(part => part.id).sort(), [round.escape.runnerId, round.escape.chaserId].sort());
      }
      assert.deepEqual(arenaRanks(order, round.start - .001, duration, rushRoll, seed), ranks, 'the released pair stays in the game during the search interval');
      assert.deepEqual(arenaRanks(order, round.resolve - .001, duration, rushRoll, seed), ranks);
      assert.equal(arenaRanks(order, round.resolve, duration, rushRoll, seed)[round.victim], expected[round.victim]);
    });
    assert.equal(arenaPlaybackEnd(order, duration, rushRoll, seed), rounds.at(-1).end);
    assert.ok(rounds.at(-1).end <= duration);
    assert.deepEqual(arenaRanks(order, duration, duration, rushRoll, seed), expected);
    assert.ok(arenaPodium(order, duration, rushRoll, seed).every(place => place.readyAt <= duration));
    assert.deepEqual(order, original);
  }
  assert.ok(cappedGames > 0, 'the two-escape limit is exercised in large fields');
});

test('successful escapes release the original pair and use another surviving opponent when one exists', () => {
  let switched = 0, twoPlayer = 0;
  for (const order of [['a', 'v'], ['a', 'b', 'v'], ['a', 'b', 'c', 'v']]) for (let seed = 0; seed < 160; seed++) {
    const rounds = arenaRounds(order, 44_000, 7, seed);
    for (const round of rounds.filter(round => round.escape?.outcome === 'separate')) {
      const { escape } = round, originalPair = [escape.runnerId, escape.chaserId];
      const survivorAlternatives = order.slice(0, order.indexOf(round.victim)).filter(id => !originalPair.includes(id));
      if (survivorAlternatives.length) {
        switched++;
        assert.ok(survivorAlternatives.includes(round.aggressor), 'the next deciding bout uses a different surviving opponent');
        assert.ok(!originalPair.includes(round.aggressor));
      } else {
        twoPlayer++;
        assert.ok(originalPair.includes(round.aggressor));
        assert.ok(round.start > escape.end, 'the final pair can search freely before a later meeting');
      }
      const end = arenaEscapeTargets(round, escape.end, { x: 500, y: 416 });
      assert.equal(end.grip, false); assert.equal(end.separated, true); assert.equal(end.released, true);
      assert.equal(end.runnerId, escape.runnerId); assert.equal(end.chaserId, escape.chaserId);
      assert.ok(distance(end.runner, end.chaser) > 140, 'the two runners finish apart instead of returning to a grip');
      assert.equal(arenaEscapeTargets(round, round.start - .001, { x: 500, y: 416 }).released, true);
      assert.equal(arenaEscapeTargets(round, round.start, { x: 500, y: 416 }).released, false);
      assert.equal(arenaPlaybackEnd(order, 44_000, 7, seed), rounds.at(-1).end);
      assert.deepEqual(arenaRanks(order, 44_000, 44_000, 7, seed), Object.fromEntries(order.map((id, i) => [id, i + 1])));
    }
  }
  assert.ok(switched > 0); assert.ok(twoPlayer > 0);
});

test('escape paths keep their contacts, bounded running speed and continuous rejoin at the live encounter', () => {
  for (const unit of [.5, .8, 1, 1.4]) for (const contactSide of [-1, 1]) for (const side of [-1, 1]) for (const runnerId of ['a', 'v']) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, start: ARENA_ESCAPE_DURATION * unit, timeScale: unit, contactSide, escape: { start: 0, end: ARENA_ESCAPE_DURATION * unit, runnerId, side } };
    const at = age => arenaEscapeTargets(round, age * unit, center);
    assert.equal(at(-1).active, false); assert.equal(at(0).active, true); assert.equal(at(ARENA_ESCAPE_DURATION).active, false);
    assert.equal(at(ARENA_ESCAPE_DURATION).stage, 'done');
    const held = at(1320), heldLater = at(1400);
    assert.equal(held.grip, true); assert.deepEqual(held.runner, heldLater.runner); assert.deepEqual(held.chaser, heldLater.chaser);
    const free = at(1600); assert.equal(free.grip, false); assert.ok(free.release > .9);
    const start = at(0), end = at(ARENA_ESCAPE_DURATION);
    assert.ok(distance(end.returnCenter, center) > 3 && distance(end.returnCenter, center) < 75, 'the pair recontacts near the escape, never at a fixed home');
    assert.ok(Math.abs((end.runner.x + end.chaser.x) / 2 - end.returnCenter.x) < 1e-8);
    for (const boundary of boundaries) {
      const before = at(boundary - 1e-4), after = at(boundary + 1e-4);
      assert.ok(distance(before.runner, after.runner) < .0001);
      assert.ok(distance(before.chaser, after.chaser) < .0001);
    }
    let previous = arenaEscapeTargets(round, 0, center);
    for (let elapsed = 16; elapsed <= round.start; elapsed += 16) {
      const current = arenaEscapeTargets(round, elapsed, center);
      assert.deepEqual(current, arenaEscapeTargets(round, elapsed, center), 'pause and direct seek use identical deterministic geometry');
      for (const id of ['runner', 'chaser']) {
        assert.ok(radius(current[id]) < 1, 'an escape stays on the sand');
        assert.ok(distance(current[id], previous[id]) <= 165 * .016 + .001, 'a target never demands a teleporting ground step');
        assert.ok(distance(current[id], held[id]) <= 140, 'a finite detour stays within 140 pixels of the contact');
      }
      previous = current;
    }
    assert.ok(distance(start.runner, held.runner) > 5);
    assert.ok(distance(at(2500).runner, held.runner) > 25, 'fleeing produces visible travel');
  }
});

test('successful routes stay continuous, remain on the sand and never grip again after releasing', () => {
  for (const unit of [.5, .8, 1, 1.4]) for (const contactSide of [-1, 1]) for (const side of [-1, 1]) for (const runnerId of ['a', 'v']) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, start: (ARENA_ESCAPE_DURATION + ARENA_ESCAPE_RELEASE_DURATION) * unit, timeScale: unit, contactSide, escape: { start: 0, end: ARENA_ESCAPE_DURATION * unit, releasedUntil: (ARENA_ESCAPE_DURATION + ARENA_ESCAPE_RELEASE_DURATION) * unit, runnerId, chaserId: runnerId === 'v' ? 'a' : 'v', side, outcome: 'separate' } };
    const at = age => arenaEscapeTargets(round, age * unit, center);
    for (const boundary of boundaries) {
      const before = at(boundary - 1e-4), after = at(boundary + 1e-4);
      assert.ok(distance(before.runner, after.runner) < .0001); assert.ok(distance(before.chaser, after.chaser) < .0001);
    }
    let previous = at(0);
    for (let elapsed = 16; elapsed <= round.start; elapsed += 16) {
      const current = arenaEscapeTargets(round, elapsed, center);
      assert.deepEqual(current, arenaEscapeTargets(round, elapsed, center));
      for (const id of ['runner', 'chaser']) {
        assert.ok(radius(current[id]) < 1);
        assert.ok(distance(current[id], previous[id]) <= 165 * .016 + .001);
      }
      if (elapsed >= 1620 * unit) assert.equal(current.grip, false);
      previous = current;
    }
    const separate = at(3300), end = at(3800);
    assert.equal(separate.stage, 'separate'); assert.equal(separate.grip, false);
    assert.equal(end.stage, 'done'); assert.equal(end.released, true);
    assert.ok(distance(end.runner, end.chaser) > 65 * Math.min(unit, 1), 'even a rim escape leaves physical space between opponents');
    assert.equal(at(6000).released, false);
  }
});

test('hands release before the run, Korean action words match it and preparation hands off once', () => {
  const round = { ...base, escape: { start: 0, end: ARENA_ESCAPE_DURATION, runnerId: 'v', side: 1 } };
  const candidates = [{ id: 'a', name: '추격자', color: '#f00' }, { id: 'v', name: '도망자', color: '#00f' }];
  const grip = arenaAction(round, 1300), free = arenaAction(round, 1600), fleeing = arenaAction(round, 1900);
  assert.ok(grip.actors.every(part => part.gripId));
  assert.ok(free.actors.every(part => !part.gripId));
  assert.ok(fleeing.actors.every(part => part.pose === 'run' && !part.gripId));
  assert.deepEqual(arenaActionWords(round, 1900), [{ id: 'v', word: '도망!' }, { id: 'a', word: '추격!' }]);
  const narrative = arenaNarration(round, candidates, ['a', 'v'], 1900);
  assert.match(narrative.title, /달아난다.*추격/); assert.match(narrative.detail, /도망자.*추격자/); assert.doesNotMatch(narrative.detail, /탈락|우승|장외로/);
  const later = { ...round, id: 'later', index: 1, start: 8800, impact: 12_000, resolve: 13_100, end: 13_100, escape: { ...round.escape, start: 5000, end: 8800 } };
  const available = candidates.map((candidate, index) => ({ id: candidate.id, x: 440 + index * 100, y: 416 }));
  const mini = arenaMiniExchanges(available, 4500, 44_000, [later])[0];
  assert.equal(mini.end, later.escape.start); assert.equal(mini.impact, later.escape.start); assert.equal(mini.resolve, later.escape.start);
  assert.deepEqual(arenaEliminatedIds(mini), []);
  assert.deepEqual(arenaMiniExchanges(available, later.escape.start, 44_000, [later]), [], 'the escape owns its pair without a second preparation motor');
});
