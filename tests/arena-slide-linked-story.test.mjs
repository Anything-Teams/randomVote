import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaRounds, arenaRanks, arenaEliminatedIds, arenaActionWords, arenaNarration, arenaMiniExchanges } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { arenaSlideTripOutcome, arenaSlideTripTargets, ARENA_SLIDE_TRIP_TIMING } = await source('src/arenaSlideTrip.ts');
const { arenaLinkedRushOutcome } = await source('src/arenaLinkedRush.ts');
const { ARENA_PAIR_COUNTER_TIMING } = await source('src/arenaPairRush.ts');

test('independent slide and linked story rolls retain two percent and one in a thousand thresholds', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaSlideTripOutcome(roll)).filter(Boolean).length, 20);
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaLinkedRushOutcome(roll)).filter(Boolean).length, 1);
  for (const value of [-1, 1000, .5, NaN]) {
    assert.throws(() => arenaSlideTripOutcome(value), RangeError);
    assert.throws(() => arenaLinkedRushOutcome(value), RangeError);
  }
});

test('new solo stories preserve every drawn elimination and reserve their own mutually exclusive physical windows', () => {
  const seen = new Set();
  for (const count of [2, 3, 5, 10]) for (let seed = 0; seed < 1024; seed++) {
    const order = Array.from({ length: count }, (_, i) => String(i + 1)), original = [...order];
    const rounds = arenaRounds(order, 44000, seed % 10, seed), living = new Set(order);
    assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1));
    let previousEnd = 0;
    for (const round of rounds) {
      const entry = round.linkedRush?.start ?? round.slideTrip?.start ?? round.pairDodge?.start ?? round.passingTrip?.start ?? round.rimCharge?.start ?? round.rim?.start ?? round.recovery?.start ?? round.escape?.start ?? round.start;
      assert.equal(entry, previousEnd); previousEnd = round.resolve;
      if (round.linkedRush || round.slideTrip) {
        assert.ok(!round.exchange);
        if (round.linkedRush) assert.equal(round.final, false, 'a two-person final cannot recruit a third attacker');
        assert.ok(!round.pairDodge && !round.passingTrip && !round.tripCounter && !round.escape && !round.recovery && !round.rim && !round.rimCharge);
        assert.equal(round.victim, [...living].at(-1));
        assert.equal(round.secondaryVictim, undefined);
        assert.ok(living.has(round.aggressor));
        const window = round.linkedRush ?? round.slideTrip;
        assert.equal(window.start, round.start); assert.equal(window.end, round.impact);
        assert.equal(window.launchAt, null, 'a schedule cannot claim an unrecorded physical start');
        const mini = arenaMiniExchanges([...living].map((id, i) => ({ id, x: 410 + i * 22, y: 416 })), Math.max(0, entry - 100), 44000, [round]);
        assert.ok(!mini.some(candidate => candidate.prepares === round.id), 'a planned wrestle must not move a runner or linked pair into the wrong formation');
        if (round.linkedRush) {
          seen.add('linked');
          assert.ok(living.size >= 3 && living.has(round.helper));
          assert.equal(new Set([round.aggressor, round.helper, round.victim]).size, 3);
          assert.equal(round.tactic, 'double-shove'); assert.equal(round.rushOutcome, 'counter-throw');
          assert.equal(round.linkedRush.contactAt, undefined);
          assert.ok(Math.abs((round.impact - round.start) / round.timeScale - 9200) < 1e-8);
        } else {
          seen.add('slide');
          assert.equal(round.helper, undefined); assert.equal(round.rushOutcome, undefined);
          assert.equal(round.slideTrip.hookAt, null); assert.equal(round.slideTrip.kickAt, null);
          assert.ok(Math.abs((round.impact - round.start) / round.timeScale - 6000) < 1e-8);
        }
      }
      arenaEliminatedIds(round).forEach(id => { assert.ok(living.has(id)); living.delete(id); });
    }
    assert.deepEqual([...living], [order[0]]); assert.deepEqual(order, original);
    if (rounds.some(round => round.linkedRush || round.slideTrip)) assert.deepEqual(arenaRanks(order, 44000, 44000, seed % 10, seed), Object.fromEntries(order.map((id, i) => [id, i + 1])));
  }
  assert.deepEqual(seen, new Set(['slide', 'linked']));
});

test('slide story and visible head words wait for the actual slide, ankle hook and kick clocks', () => {
  const order = ['1', '2', '3', '4', '5'], planned = Array.from({ length: 256 }, (_, seed) => arenaRounds(order, 44000, 7, seed).find(round => round.slideTrip && !round.slideTrip.evade)).find(Boolean);
  assert.ok(planned);
  const candidates = order.map(id => ({ id, name: id, color: '#ffad72' }));
  const start = 1000, launchAt = 1800, hookAt = 2500;
  const riseAt = hookAt + ARENA_SLIDE_TRIP_TIMING.hook + ARENA_SLIDE_TRIP_TIMING.fall;
  const kickReady = riseAt + ARENA_SLIDE_TRIP_TIMING.rise, kickAt = kickReady + 300;
  const round = { ...planned, start, impact: kickAt, resolve: kickAt + 1100, end: kickAt + 1100, timeScale: 1,
    slideTrip: { start, end: kickAt + 1100, launchAt, hookAt, kickAt } };
  const center = { x: 500, y: 416 };
  for (const [clock, step, stage, word] of [[start, 0, 'approach', '돌진!'], [launchAt + 100, 1, 'slide', '슬라이딩!'], [hookAt, 2, 'hook', '발걸기!'], [hookAt + ARENA_SLIDE_TRIP_TIMING.hook + 1, 3, 'fall', '넘어진다!'], [riseAt, 4, 'rise', '일어서기!'], [kickReady, 5, 'kick', '발차기!'], [kickAt, 6, 'release', '장외로!']]) {
    const frame = arenaSlideTripTargets(round.slideTrip, clock, center), story = arenaStoryState(round, clock);
    assert.equal(frame.stage, stage); assert.equal(story.kind, 'slide-trip'); assert.equal(story.step, step);
    assert.deepEqual(story.left, [round.aggressor]); assert.deepEqual(story.right, [round.victim]);
    assert.equal(arenaActionWords(round, clock)[0]?.word, word);
    assert.ok(arenaNarration(round, candidates, order, clock).title.length > 0);
  }
  const launchPending = { ...round, slideTrip: { ...round.slideTrip, launchAt: null, hookAt: null, kickAt: null } };
  assert.equal(arenaStoryState(launchPending, kickAt - 1).step, 0);
  const hookPending = { ...round, slideTrip: { ...round.slideTrip, hookAt: null, kickAt: null } };
  assert.equal(arenaStoryState(hookPending, kickAt - 1).step, 1);
  assert.doesNotMatch(arenaStoryState(hookPending, kickAt - 1).action, /발목에 닿았습니다|뒤로 넘어집/);
  const kickPending = { ...round, slideTrip: { ...round.slideTrip, kickAt: null } };
  assert.equal(arenaStoryState(kickPending, kickAt - 1).step, 5);
  assert.doesNotMatch(arenaStoryState(kickPending, kickAt - 1).action, /장외로 나갑/);
});

test('rare slide dodge explanations follow the recorded hop and landing without claiming an ankle hook or exit', () => {
  const order = ['1', '2', '3', '4', '5'], planned = Array.from({ length: 4096 }, (_, seed) => arenaRounds(order, 44000, 7, seed).find(round => round.slideTrip?.evade)).find(Boolean);
  assert.ok(planned, 'the rare jump evade comes from a selected normal-probability window');
  const round = { ...planned, start: 1000, impact: 7000, resolve: 8100, end: 8100,
    slideTrip: { start: 1000, end: 7000, evade: true, plannedLaunchAt: 1800, plannedPassAt: 2200, launchAt: 1800, jumpAt: 2000, passAt: 2200, hookAt: null, kickAt: null } };
  const candidates = order.map(id => ({ id, name: id, color: '#ffad72' }));
  for (const [clock, step, stage] of [[1000, 0, 'approach'], [1900, 1, 'slide'], [2100, 2, 'jump'], [2200, 3, 'pass'], [2520, 4, 'land'], [2681, 5, 'recover']]) {
    const frame = arenaSlideTripTargets(round.slideTrip, clock, { x: 500, y: 416 });
    const story = arenaStoryState(round, clock), words = arenaActionWords(round, clock);
    assert.equal(frame.stage, stage); assert.equal(story.step, step);
    assert.deepEqual(story.right, [round.victim]);
    assert.ok(words.every(item => !/발걸기|발차기|장외|넘어진다/.test(item.word)), 'words cannot claim the missed tackle hit');
    assert.doesNotMatch(arenaNarration(round, candidates, order, clock).title, /걸렸다|발차기|장외/);
  }
  const pending = { ...round, slideTrip: { ...round.slideTrip, jumpAt: null, passAt: null } };
  assert.equal(arenaSlideTripTargets(pending.slideTrip, 2100, { x: 500, y: 416 }).stage, 'slide', 'narration cannot launch an unrecorded hop');
});

test('linked story never turns the attacked player into the charger and reads the shared throw from real neck contact', () => {
  const order = ['1', '2', '3', '4', '5'], planned = arenaRounds(order, 44000, 7, 570).find(round => round.linkedRush);
  assert.ok(planned);
  const start = 1000, launchAt = 2400, contactAt = 4000, impact = contactAt + ARENA_PAIR_COUNTER_TIMING.release;
  const round = { ...planned, start, impact, resolve: impact + 1100, end: impact + 1100, timeScale: 1, rushLaunchAt: launchAt, rushContactAt: contactAt,
    linkedRush: { start, end: impact, launchAt, contactAt } };
  const candidates = order.map(id => ({ id, name: id, color: '#ffad72' }));
  for (const [clock, step, word] of [[start, 0, '팔 뻗기!'], [launchAt, 1, '돌진!'], [contactAt, 2, '목 · 가슴 가격!'], [contactAt + 450, 3, '기절!'], [contactAt + 720, 4, '어깨 잡기!'], [contactAt + 900, 5, '함께 들기!'], [impact - 100, 6, '함께 던지기!']]) {
    const story = arenaStoryState(round, clock), words = arenaActionWords(round, clock);
    assert.equal(story.kind, 'linked-rush'); assert.equal(story.step, step);
    assert.deepEqual(story.left, [round.aggressor, round.helper]); assert.deepEqual(story.right, [round.victim]);
    assert.doesNotMatch(story.action + story.label + story.relationLabel, /팔 연결|팔을 연결|연결한 팔|서로의 팔/);
    assert.equal(words[0].word, word);
    assert.ok(arenaNarration(round, candidates, order, clock).title.length > 0);
    if (step === 1) assert.ok(words.every(item => item.id !== round.victim), 'the two linked attackers run, not the attacked player');
  }
  const waiting = { ...round, rushContactAt: undefined, linkedRush: { ...round.linkedRush, launchAt: null, contactAt: undefined } };
  assert.equal(arenaStoryState(waiting, impact - 1).step, 0);
  const running = { ...round, rushContactAt: undefined, linkedRush: { ...round.linkedRush, contactAt: undefined } };
  assert.equal(arenaStoryState(running, impact - 1).step, 1);
  assert.doesNotMatch(arenaStoryState(running, impact - 1).action, /닿았습니다|넘어지고|잡았습니다/);
  assert.deepEqual(arenaEliminatedIds(round), [round.victim]);
});
