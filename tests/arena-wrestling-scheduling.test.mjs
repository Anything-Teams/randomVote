import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaRounds, arenaRanks, arenaEliminatedIds, arenaMiniExchanges, arenaContactRound } = await source('src/arenaLogic.ts');
const { arenaEscapeRoll } = await source('src/arenaEscape.ts');
const { arenaWrestlingMoveOutcome, arenaClotheslineDuckOutcome, ARENA_CLOTHESLINE_DUCK_CHANCE } = await source('src/arenaWrestlingMoves.ts');
const offsets = [['clothesline', 1409], ['dropkick', 1451], ['powerbomb', 1487], ['backbodydrop', 1511], ['spinebuster', 1553], ['scoopslam', 1597]];
const fallback = { clothesline: 'ram', dropkick: 'sidekick', powerbomb: 'brace', backbodydrop: 'catch', spinebuster: 'counter', scoopslam: 'lift' };
const reserved = round => round.exchange || round.helper || round.rushOutcome || round.escape || round.recovery || round.rim || round.rimCharge
  || round.kickCatch || round.supermanPunch || round.linkedRush || round.slideTrip || round.pairDodge || round.passingTrip || round.tripCounter;

test('each wrestling move uses four percent of a separate cosmetic roll with a precise threshold', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaWrestlingMoveOutcome(roll)).filter(Boolean).length, 40);
  assert.ok(arenaWrestlingMoveOutcome(39)); assert.equal(arenaWrestlingMoveOutcome(40), false);
  for (const roll of [-1, 1000, .1, NaN]) assert.throws(() => arenaWrestlingMoveOutcome(roll), RangeError);
});

test('a solo clothesline duck uses a separate half-percent roll with an exact threshold', () => {
  assert.equal(ARENA_CLOTHESLINE_DUCK_CHANCE, .005);
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaClotheslineDuckOutcome(roll)).filter(Boolean).length, 5);
  assert.ok(arenaClotheslineDuckOutcome(4)); assert.equal(arenaClotheslineDuckOutcome(5), false);
  for (const roll of [-1, 1000, .1, NaN]) assert.throws(() => arenaClotheslineDuckOutcome(roll), RangeError);
});

test('rare solo ducks retain both fighters and the drawn elimination for their later finish', () => {
  for (const [order, seed, expectedIndex] of [[['2', '1'], 6280, 0], [['1', '2', '3', '4', '5'], 1676, 2], [['5', '4', '3', '2', '1'], 1676, 2]]) {
    const rounds = arenaRounds(order, 44000, 7, seed);
    const round = rounds.find(bout => bout.wrestlingMove?.duck);
    assert.ok(round); assert.equal(round.index, expectedIndex);
    assert.equal(round.wrestlingMove.kind, 'clothesline'); assert.equal(round.tactic, 'ram');
    assert.equal(round.exchange, undefined); assert.equal(round.helper, undefined); assert.equal(round.rushOutcome, undefined);
    for (const clock of ['launchAt', 'contactAt', 'releaseAt', 'ankleGripAt']) assert.equal(round.wrestlingMove[clock], null, 'a selected duck cannot predeclare a hit or an ankle throw');
    const beforeFinish = arenaRanks(order, round.resolve - .001, 44000, 7, seed);
    assert.equal(beforeFinish[round.aggressor], undefined); assert.equal(beforeFinish[round.victim], undefined);
    assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1), 'a missed cosmetic attack never redraws the final placements');
    assert.equal(arenaRanks(order, round.resolve, 44000, 7, seed)[round.victim], order.indexOf(round.victim) + 1);
    assert.deepEqual(arenaRounds(order, 44000, 7, seed), rounds, 'replaying the same seed keeps the same duck and all clocks');
  }
});

test('the established solo clothesline hit fixtures keep their original selection and no duck', () => {
  for (const [order, seed] of [[['2', '1'], 19], [['5', '4', '3', '2', '1'], 31]]) {
    const rounds = arenaRounds(order, 44000, 7, seed);
    const clothesline = rounds.find(round => round.wrestlingMove?.kind === 'clothesline');
    assert.ok(clothesline); assert.equal(clothesline.wrestlingMove.duck, undefined);
    assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1));
  }
});

test('new move windows preserve drawn eliminations and reserve actual contact clocks after earlier specials', () => {
  const seen = new Set(), finalSeen = new Set();
  for (const order of [['2', '1'], ['1', '2', '3'], ['1', '2', '3', '4', '5'], Array.from({ length: 10 }, (_, i) => String(i + 1))]) for (let seed = 0; seed < 1024; seed++) {
    const input = [...order], rounds = arenaRounds(order, 44000, seed % 10, seed);
    assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1));
    assert.equal(rounds.at(-1).aggressor, order[0]);
    for (const [index, round] of rounds.entries()) {
      const selected = round.wrestlingMove;
      if (reserved(round)) { assert.equal(selected, undefined, 'existing escape, recovery and rare contact stories retain their own seeds and clocks'); continue; }
      const expected = offsets.find(([, offset]) => arenaWrestlingMoveOutcome(arenaEscapeRoll(seed, round.index + offset) % 1000))?.[0];
      assert.equal(selected?.kind, expected, 'only the first eligible independent move roll controls the cosmetic motion');
      if (!selected) continue;
      const duck = selected.kind === 'clothesline' && arenaClotheslineDuckOutcome(arenaEscapeRoll(seed, round.index + 1637) % 1000);
      assert.equal(selected.duck, duck ? true : undefined, 'only the separate duck roll changes an already selected solo clothesline');
      seen.add(selected.kind); if (round.final) finalSeen.add(selected.kind);
      assert.equal(round.tactic, fallback[selected.kind], 'a physically declined window has an existing ordinary fallback');
      assert.equal(selected.start, rounds[index - 1]?.resolve ?? 0); assert.equal(selected.start, round.start); assert.equal(selected.end, round.impact);
      for (const clock of ['launchAt', 'contactAt', 'releaseAt', 'kickAt', 'ankleGripAt']) assert.equal(selected[clock], null, `${clock} cannot claim planned contact as actual motion`);
      assert.ok(Math.abs((round.impact - round.start) / round.timeScale - 6000) < 1e-7);
      assert.ok(Math.abs((round.resolve - round.impact) / round.timeScale - 1100) < 1e-7);
      const living = order.slice(0, order.indexOf(round.victim) + 1);
      assert.ok(living.includes(round.aggressor) && round.aggressor !== round.victim);
      assert.equal(arenaRanks(order, round.resolve - .001, 44000, seed % 10, seed)[round.victim], undefined);
      assert.equal(arenaRanks(order, round.resolve, 44000, seed % 10, seed)[round.victim], order.indexOf(round.victim) + 1);
      const bodies = living.map((id, i) => ({ id, x: 400 + i * 20, y: 416 }));
      assert.ok(!arenaMiniExchanges(bodies, Math.max(0, round.start - 100), 44000, [round]).some(mini => mini.prepares === round.id));
      assert.equal(arenaContactRound(round, { x: 740, y: 416 }, { aggressor: { x: 710, y: 416 }, victim: { x: 770, y: 416 } }).rimPush, undefined, 'weighted rim finishing cannot replace an already selected move');
    }
    assert.deepEqual(order, input);
  }
  assert.deepEqual([...seen].sort(), offsets.map(([kind]) => kind).sort());
  assert.deepEqual([...finalSeen].sort(), offsets.map(([kind]) => kind).sort(), 'all six remain available to the two drawn finalists');
});
