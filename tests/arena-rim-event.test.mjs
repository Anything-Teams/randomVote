import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { ARENA_RIM_DURATION, arenaRimOutcome, arenaRimTargets } = await source('src/arenaRimEvent.ts');
const { arenaEscapeRoll } = await source('src/arenaEscape.ts');
const { arenaAction, arenaActionWords, arenaContactRound, arenaFocusRound, arenaMiniExchanges, arenaNarration, arenaRanks, arenaRounds, arenaPlaybackEnd } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const radius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const base = { id: 'rim', index: 0, tactic: 'brace', aggressor: 'a', victim: 'v', final: false, start: ARENA_RIM_DURATION, impact: 5300, resolve: 6400, end: 6400, rim: { start: 0, end: ARENA_RIM_DURATION, outcome: 'resist' } };

test('a rim story has exactly three successful pushes and seven planted defenses', () => {
  const outcomes = Array.from({ length: 10 }, (_, roll) => arenaRimOutcome(roll));
  assert.equal(outcomes.filter(outcome => outcome === 'out').length, 3);
  assert.equal(outcomes.filter(outcome => outcome === 'resist').length, 7);
  for (const roll of [-1, 10, .3, NaN]) assert.throws(() => arenaRimOutcome(roll), RangeError);
});

test('a failed rim push plants, releases and leaves both people at the current shifted encounter', () => {
  for (const side of [-1, 1]) for (const unit of [.4, .8, 1, 1.4]) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, contactSide: side, timeScale: unit, start: ARENA_RIM_DURATION * unit, rim: { ...base.rim, end: ARENA_RIM_DURATION * unit } };
    const at = age => arenaRimTargets(round, age * unit, center);
    assert.equal(arenaRimTargets({ ...round, rim: undefined }, 0, center), undefined);
    assert.equal(at(-1).active, false); assert.equal(at(0).active, true); assert.equal(at(ARENA_RIM_DURATION).active, false);
    const start = at(0), contact = at(600), pushing = at(1050), planted = at(1500), releasing = at(2000), end = at(2200);
    assert.equal(start.stage, 'approach'); assert.equal(contact.stage, 'pressure');
    assert.equal(planted.stage, 'brace'); assert.equal(releasing.stage, 'release'); assert.equal(end.stage, 'done');
    assert.equal(contact.grip, true); assert.equal(planted.grip, true); assert.equal(releasing.grip, false); assert.equal(end.grip, false);
    assert.ok(pushing.pressure > .5 && planted.resistance === 1);
    assert.ok(distance(end.returnCenter, center) > 4, 'the resumed bout uses the shifted live encounter, never the old center');
    assert.equal(end.returnCenter.x, (end.aggressor.x + end.victim.x) / 2);
    assert.equal(end.returnCenter.y, (end.aggressor.y + end.victim.y) / 2);
    let previous = start;
    for (let elapsed = 16; elapsed <= round.rim.end; elapsed += 16) {
      const frame = arenaRimTargets(round, elapsed, center);
      for (const actor of ['aggressor', 'victim']) {
        assert.ok(radius(frame[actor]) < 1, 'a resisting survivor remains on the sand');
        assert.ok(distance(frame[actor], previous[actor]) / .016 < 165, 'planting or releasing cannot teleport either grounded body');
      }
      assert.equal(frame.height, undefined); assert.equal(frame.lift, undefined); assert.equal(frame.angle, undefined);
      assert.deepEqual(frame, arenaRimTargets(round, elapsed, center), 'direct seek and pause use the same seeded choreography');
      previous = frame;
    }
    for (const boundary of [0, 600, 1050, 1300, 1400, 1700, 2200]) {
      const before = at(boundary - .001), after = at(boundary + .001);
      for (const actor of ['aggressor', 'victim', 'returnCenter']) assert.ok(distance(before[actor], after[actor]) < .002, `${boundary}/${unit}/${actor}: story stages cannot reset roots`);
    }
  }
});

test('the rim approach begins at each actual body, including a live position close to the outer sand', () => {
  for (const side of [-1, 1]) {
    const center = { x: side > 0 ? 720 : 280, y: 440 }, origins = { aggressor: { x: center.x - side * 22, y: 433 }, victim: { x: center.x + side * 22, y: 447 } };
    const round = { ...base, contactSide: side }, first = arenaRimTargets(round, 0, center, origins);
    assert.deepEqual(first.aggressor, origins.aggressor); assert.deepEqual(first.victim, origins.victim);
    let previous = first;
    for (let elapsed = 16; elapsed <= 2200; elapsed += 16) {
      const frame = arenaRimTargets(round, elapsed, center, origins);
      for (const actor of ['aggressor', 'victim']) {
        assert.ok(radius(frame[actor]) < 1);
        assert.ok(distance(frame[actor], previous[actor]) / .016 < 165);
      }
      previous = frame;
    }
  }
});

test('a successful rim push keeps forward ground drive through the exit and leaves its pusher inside', () => {
  for (const side of [-1, 1]) {
    const round = { ...base, tactic: 'edge', contactSide: side, start: 0, impact: 3300, rim: { start: 0, end: 3300, outcome: 'out' } }, center = { x: side > 0 ? 650 : 350, y: 420 };
    const first = arenaRimTargets(round, 0, center), last = arenaRimTargets(round, 3299, center), end = arenaRimTargets(round, 3300, center);
    assert.equal(end.stage, 'done'); assert.equal(end.outcome, 'out');
    assert.ok(side * (end.victim.x - first.victim.x) > 100);
    assert.ok(side * (end.victim.x - last.victim.x) > .01, 'the shove does not brake before the loser crosses the rim');
    assert.ok(radius(end.victim) > .98 && radius(end.aggressor) < 1);
    let previous = first;
    for (let elapsed = 16; elapsed <= 3300; elapsed += 16) {
      const frame = arenaRimTargets(round, elapsed, center);
      for (const actor of ['aggressor', 'victim']) assert.ok(distance(frame[actor], previous[actor]) / .016 < 165);
      previous = frame;
    }
  }
});

test('other eligible single encounters add about twelve percent rim attempts with a separate thirty percent success roll', () => {
  const tactics = ['bait', 'catch', 'edge', 'shove', 'counter', 'brace', 'lift', 'armspin', 'trip', 'suplex', 'sidekick'];
  let order;
  for (let index = 0; index < 500 && !order; index++) {
    const candidate = [`rim-rate-${index}-a`, `rim-rate-${index}-b`, `rim-rate-${index}-v`];
    const seed = candidate.join('|').split('').reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0);
    const first = arenaRounds(candidate)[0];
    if (tactics[seed % tactics.length] === 'sidekick' && !first.rushOutcome) order = candidate;
  }
  assert.ok(order);
  let eligible = 0, attempts = 0, successes = 0;
  for (let seed = 0; seed < 4096; seed++) {
    const first = arenaRounds(order, 44_000, 7, seed)[0];
    if (first.escape || first.recovery) continue;
    eligible++;
    const shouldAttempt = arenaEscapeRoll(seed, 101) % 100 < 12;
    assert.equal(!!first.rim, shouldAttempt, 'only the independent twelve percent roll creates an extra encounter');
    if (!first.rim) { assert.equal(first.tactic, 'sidekick'); continue; }
    attempts++;
    const expected = arenaRimOutcome(arenaEscapeRoll(seed, 149) % 10);
    assert.equal(first.rim.outcome, expected);
    if (expected === 'out') { successes++; assert.equal(first.tactic, 'edge'); }
    else assert.equal(first.tactic, 'sidekick', 'a defense resumes the originally planned technique');
  }
  assert.ok(attempts / eligible > .095 && attempts / eligible < .145, `${attempts}/${eligible}: extra attempts are a slight increase`);
  assert.ok(successes / attempts > .25 && successes / attempts < .35, `${successes}/${attempts}: both story outcomes occur at the requested rate`);
});

test('rim windows never stack with other preludes, change drawn places or extend the game deadline', () => {
  let successful = 0, resisted = 0;
  for (const duration of [40_000, 44_000, 62_000]) for (const rushRoll of [0, 7]) for (let count = 3; count <= 10; count++) for (let seed = 0; seed < 24; seed++) {
    const order = Array.from({ length: count }, (_, index) => `rim-field-${seed}-${index}`), original = [...order];
    const rounds = arenaRounds(order, duration, rushRoll, seed), expected = Object.fromEntries(order.map((id, index) => [id, index + 1]));
    rounds.forEach((round, index) => {
      if (!round.rim) return;
      assert.equal(round.final, false); assert.equal(round.helper, undefined); assert.equal(round.rushOutcome, undefined);
      assert.equal(round.escape, undefined); assert.equal(round.recovery, undefined);
      assert.equal(round.rim.start, rounds[index - 1]?.resolve ?? 0);
      assert.ok(round.start < round.impact && round.impact < round.resolve && round.resolve <= round.end);
      if (round.rim.outcome === 'out') {
        successful++; assert.equal(round.tactic, 'edge'); assert.equal(round.start, round.rim.start); assert.equal(round.rim.end, round.impact);
      } else {
        resisted++; assert.notEqual(round.tactic, 'edge'); assert.equal(round.rim.end, round.start);
        assert.ok(Math.abs(round.rim.end - round.rim.start - ARENA_RIM_DURATION * round.timeScale) < 1e-8);
      }
      const before = arenaRanks(order, round.rim.start, duration, rushRoll, seed);
      for (const elapsed of [round.rim.start, (round.rim.start + round.rim.end) / 2, round.rim.end - .001]) {
        assert.deepEqual(arenaRanks(order, elapsed, duration, rushRoll, seed), before, 'no actor loses a place while the push is still undecided');
        assert.equal(arenaFocusRound(order, elapsed, duration, rushRoll, seed).id, round.id);
      }
      assert.deepEqual(arenaRanks(order, round.resolve - .001, duration, rushRoll, seed), before);
      assert.equal(arenaRanks(order, round.resolve, duration, rushRoll, seed)[round.victim], expected[round.victim]);
    });
    assert.equal(arenaPlaybackEnd(order, duration, rushRoll, seed), rounds.at(-1).end);
    assert.ok(rounds.at(-1).end <= duration);
    assert.deepEqual(arenaRanks(order, duration, duration, rushRoll, seed), expected);
    assert.deepEqual(order, original);
  }
  assert.ok(successful > 30 && resisted > 70, 'small and large fields exercise both rim stories');
});

test('the visible rim defense, head words and commentary describe the same grounded action', () => {
  const candidates = ['a', 'v'].map(id => ({ id, name: id, color: '#f69a6d' }));
  const push = arenaAction(base, 1050), planted = arenaAction(base, 1500), release = arenaAction(base, 2050);
  assert.equal(push.stage, 'joint-attack'); assert.equal(planted.stage, 'resist'); assert.equal(release.stage, 'release');
  for (const action of [push, planted, release]) {
    assert.equal(action.lift, 0); assert.equal(action.liftedId, undefined);
    assert.deepEqual(action.actors.map(actor => actor.id), ['a', 'v']);
  }
  assert.equal(push.actors[0].pose, 'push'); assert.equal(planted.actors[1].pose, 'brace');
  assert.ok(release.actors.every(actor => !actor.gripId), 'a failed push releases both actual hands before the later bout');
  assert.ok(arenaActionWords(base, 1050).some(part => part.id === 'a' && /밀기/.test(part.word)));
  assert.deepEqual(arenaActionWords(base, 1500), [{ id: 'v', word: '버텼다!' }]);
  const story = arenaStoryState(base, 1500), narrative = arenaNarration(base, candidates, ['a', 'v'], 1500);
  assert.equal(story.kind, 'rim'); assert.equal(story.step, 2);
  assert.match(story.action, /둘 다 모래판에 남/); assert.match(narrative.title, /밀기를 막/);
  assert.match(arenaStoryState(base, 2050).action, /방금 밀린 자리/);
  assert.notEqual(arenaStoryState(base, base.start).kind, 'rim', 'the later deciding technique replaces the ended prelude');
});

test('a central or inward meeting cancels the rim prelude immediately without moving the drawn result clocks', () => {
  const central = arenaContactRound(base, { x: 500, y: 416 });
  assert.equal(central.rim, undefined); assert.equal(central.start, base.rim.start);
  assert.equal(central.impact, base.impact); assert.equal(central.resolve, base.resolve);
  const out = { ...base, tactic: 'edge', start: 0, rim: { start: 0, end: base.impact, outcome: 'out' } };
  const inward = arenaContactRound(out, { x: 680, y: 416 }, { aggressor: { x: 710, y: 416 }, victim: { x: 650, y: 416 } });
  assert.equal(inward.rim, undefined); assert.equal(inward.tactic, 'brace');
  const outward = arenaContactRound(base, { x: 720, y: 416 }, { aggressor: { x: 694, y: 416 }, victim: { x: 746, y: 416 } });
  assert.deepEqual(outward.rim, base.rim); assert.equal(outward.start, base.start);
  assert.deepEqual(base.rim, { start: 0, end: 2200, outcome: 'resist' }, 'live contact adaptations leave the scheduled rank draw intact');
});

test('preparation hands the same pair over at the rim start rather than competing throughout its prelude', () => {
  const round = { ...base, start: 6200, impact: 9300, resolve: 10400, end: 10400, timeScale: 1, rim: { start: 4000, end: 6200, outcome: 'resist' } };
  const available = [{ id: 'a', x: 660, y: 416 }, { id: 'v', x: 710, y: 416 }];
  const [preparation] = arenaMiniExchanges(available, 3500, 44_000, [round]);
  assert.equal(preparation.prepares, round.id); assert.equal(preparation.end, round.rim.start);
  assert.equal(arenaMiniExchanges(available, round.rim.start, 44_000, [round]).length, 0);
  assert.equal(arenaMiniExchanges(available, 5000, 44_000, [round]).length, 0);
});
