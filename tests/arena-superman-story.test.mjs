import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaRounds, arenaRanks, arenaEliminatedIds, arenaActionWords, arenaNarration, arenaMiniExchanges } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { arenaSupermanPunchOutcome, arenaSupermanPunchTargets, ARENA_SUPERMAN_PUNCH_TIMING: timing } = await source('src/arenaSupermanPunch.ts');

test('one independent cosmetic outcome in a thousand enables the Superman punch', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaSupermanPunchOutcome(roll)).filter(Boolean).length, 1);
  for (const roll of [-1, 1000, .1, NaN]) assert.throws(() => arenaSupermanPunchOutcome(roll), RangeError);
});

test('the rare punch reserves a solo preliminary or final and preserves each supplied rank and ordinary fallback tactic', () => {
  let selected = 0;
  for (const count of [2, 3, 5, 10]) for (let seed = 0; seed < 1024; seed++) {
    const order = Array.from({ length: count }, (_, i) => String(i + 1)), original = [...order];
    const rounds = arenaRounds(order, 44000, seed % 10, seed);
    assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1));
    assert.equal(rounds.at(-1).aggressor, order[0]);
    for (const [index, round] of rounds.entries()) {
      if (!round.supermanPunch) continue;
      selected++;
      assert.ok(!round.exchange && !round.helper && !round.secondaryVictim && !round.rushOutcome);
      assert.ok(!round.linkedRush && !round.slideTrip && !round.passingTrip && !round.pairDodge && !round.tripCounter && !round.escape && !round.recovery && !round.rim && !round.rimCharge);
      assert.equal(round.tactic, 'ram', 'a declined jump still has an existing ground tactic');
      assert.equal(round.supermanPunch.start, rounds[index - 1]?.resolve ?? 0);
      assert.equal(round.supermanPunch.start, round.start); assert.equal(round.supermanPunch.end, round.impact);
      assert.equal(round.supermanPunch.launchAt, null); assert.equal(round.supermanPunch.hitAt, null);
      assert.ok(Math.abs((round.impact - round.start) / round.timeScale - 6000) < 1e-8);
      assert.ok(Math.abs((round.resolve - round.impact) / round.timeScale - 1100) < 1e-8);
      const living = order.slice(0, order.indexOf(round.victim) + 1);
      const mini = arenaMiniExchanges(living.map((id, i) => ({ id, x: 410 + i * 20, y: 416 })), Math.max(0, round.start - 100), 44000, [round]);
      assert.ok(!mini.some(candidate => candidate.prepares === round.id), 'the punch runway cannot be replaced by a compulsory preparation grapple');
      assert.equal(arenaRanks(order, round.resolve - .001, 44000, seed % 10, seed)[round.victim], undefined);
      assert.equal(arenaRanks(order, round.resolve, 44000, seed % 10, seed)[round.victim], order.indexOf(round.victim) + 1);
    }
    assert.deepEqual(order, original);
  }
  assert.ok(selected > 0 && selected < 35, 'the real numeric-id fixtures contain occasional punches, never a guaranteed extra event');
});

const order = ['1', '2', '3', '4', '5'];
const planned = Array.from({ length: 2048 }, (_, seed) => arenaRounds(order, 44000, 7, seed).find(round => round.supermanPunch)).find(Boolean);
assert.ok(planned, 'the numeric-id production seed must select the rare punch');
const start = 1000, launchAt = 1560, hitAt = launchAt + 250;
const round = { ...planned, start, impact: hitAt, resolve: hitAt + 1100, end: hitAt + 1100, timeScale: 1,
  supermanPunch: { start, end: hitAt + 1100, launchAt, hitAt } };
const candidates = order.map(id => ({ id, name: id, color: '#ffad72' }));

test('story and head words use the recorded short-run takeoff and the real fist hit instead of a default runway', () => {
  const origins = { driver: { x: 384, y: 416 }, victim: { x: 520, y: 416 } }, center = { x: 500, y: 416 };
  const actual = arenaSupermanPunchTargets(round.supermanPunch, launchAt, center, origins);
  assert.ok(actual.canPerform && actual.plannedLaunchAt <= launchAt, 'the short-run takeoff follows a real complete run and plant');
  const reader = arenaSupermanPunchTargets(round.supermanPunch, launchAt + 50, center);
  assert.equal(reader.launchAt, launchAt, 'a narration reader without real origins must not delay the recorded takeoff');
  const cases = [[start, 0, '달려들기!'], [launchAt + 50, 2, '도약!'], [launchAt + 160, 3, '슈퍼맨 펀치!'], [hitAt, 3, '슈퍼맨 펀치!'], [launchAt + timing.air, 4, undefined], [launchAt + timing.air + timing.land, 5, undefined]];
  for (const [clock, step, word] of cases) {
    const story = arenaStoryState(round, clock), words = arenaActionWords(round, clock);
    assert.equal(story.kind, 'superman-punch'); assert.equal(story.step, step);
    assert.deepEqual(story.left, [round.aggressor]); assert.deepEqual(story.right, [round.victim]);
    if (word) assert.ok(words.some(item => item.id === round.aggressor && item.word === word));
    const out = words.find(item => item.word === '장외로!');
    assert.equal(out?.id, clock >= hitAt ? round.victim : undefined, 'only the truly hit drawn loser receives the exit word');
    const narration = arenaNarration(round, candidates, order, clock);
    if (clock < hitAt) { assert.doesNotMatch(story.action, /닿았습니다|맞은 선수만|장외로 나갑/); assert.doesNotMatch(narration.detail, /닿았습니다|장외로 날아/); }
  }
  assert.match(arenaStoryState(round, hitAt).action, /주먹이 상대의 턱 부근에 닿았습니다/);
  assert.match(arenaStoryState(round, launchAt + timing.air).action, /공격한 선수.*두 발로 착지/);
});

test('an unrecorded or missed punch lands without announcing an invented hit and a declined window restores the ordinary story', () => {
  const pending = { ...round, supermanPunch: { ...round.supermanPunch, launchAt: null, hitAt: null } };
  const waiting = arenaStoryState(pending, hitAt + 500);
  assert.equal(waiting.step, 1); assert.doesNotMatch(waiting.action, /뛰어올라|턱 부근에 닿았습니다|맞은 상대/);
  const missed = { ...round, supermanPunch: { ...round.supermanPunch, hitAt: null } };
  for (const clock of [hitAt, launchAt + timing.air, launchAt + timing.air + timing.land]) {
    const story = arenaStoryState(missed, clock), words = arenaActionWords(missed, clock);
    assert.doesNotMatch(story.action, /닿았습니다|장외|맞은 상대|맞은 선수/);
    assert.ok(words.every(item => item.id === missed.aggressor && item.word !== '장외로!'));
    assert.doesNotMatch(arenaNarration(missed, candidates, order, clock).detail, /닿았습니다|장외/);
  }
  assert.equal(arenaStoryState(missed, launchAt + timing.air + timing.land).step, 5, 'a missed punch still reaches recovery');
  const declined = { ...round, supermanPunch: undefined };
  assert.equal(arenaStoryState(declined, launchAt + 100).kind, 'ram');
  assert.ok(arenaActionWords(declined, launchAt + 100).every(item => item.word !== '슈퍼맨 펀치!'));
  assert.deepEqual(arenaEliminatedIds(declined), [round.victim]);
});
