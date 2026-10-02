import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function source(path) {
  const bundled = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
}
const { ARENA_RIM_CHARGE_DURATION, arenaRimChargeOutcome, arenaRimChargeTargets } = await source('src/arenaRimCharge.ts');
const { arenaRounds, arenaRanks } = await source('src/arenaLogic.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const radius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const base = { id: 'charge', index: 0, tactic: 'brace', aggressor: 'defender', victim: 'charger', start: 2600, impact: 6400, resolve: 7500, end: 7500, final: false, timeScale: 1 };

test('an independent charge story roll gives exactly three dodges and seven planted defenses', () => {
  const outcomes = Array.from({ length: 10 }, (_, roll) => arenaRimChargeOutcome(roll));
  assert.equal(outcomes.filter(outcome => outcome === 'dodge').length, 3);
  assert.equal(outcomes.filter(outcome => outcome === 'resist').length, 7);
  for (const roll of [-1, 10, .5, NaN]) assert.throws(() => arenaRimChargeOutcome(roll), RangeError);
});

test('an aligned outer charge uses the current two bodies, shows an actual sidestep or contact, and resumes a resisted duel where it ended', () => {
  for (const side of [-1, 1]) for (const outcome of ['dodge', 'resist']) {
    const round = { ...base, rimCharge: { start: 0, end: ARENA_RIM_CHARGE_DURATION, outcome } }, center = { x: 500 + side * 180, y: 416 };
    const origins = { charger: { x: center.x - side * 105, y: 416 }, defender: { x: center.x + side * 23, y: 416 } };
    const at = time => arenaRimChargeTargets(round, time, center, origins), initial = at(0), end = at(ARENA_RIM_CHARGE_DURATION);
    assert.deepEqual(initial.charger, origins.charger); assert.deepEqual(initial.defender, origins.defender);
    assert.equal(initial.chargerId, round.victim); assert.equal(initial.defenderId, round.aggressor);
    assert.equal(initial.canRun, true); assert.equal(initial.canReachRim, true);
    let previous = initial;
    for (let time = 16; time <= ARENA_RIM_CHARGE_DURATION; time += 16) {
      const frame = at(time);
      for (const role of ['charger', 'defender']) assert.ok(distance(frame[role], previous[role]) <= 165 * .016 + .01, 'neither the sprint nor sidestep can jump to a prepared position');
      assert.ok(side * (frame.charger.x - previous.charger.x) >= -1e-8, 'the charger cannot reverse to line up a new run');
      assert.ok(radius(frame.defender) < 1);
      previous = frame;
    }
    if (outcome === 'dodge') {
      assert.ok(Math.abs(at(initial.contactAt).defender.y - origins.defender.y) > 39, 'the defender visibly clears the charging path');
      assert.ok(radius(end.charger) > .98, 'the drawn loser reaches the actual outer boundary');
      assert.equal(end.out, true); assert.equal(end.grip, false);
    } else {
      assert.equal(at(initial.contactAt + 1).grip, true);
      assert.ok(distance(at(initial.contactAt).charger, at(initial.contactAt).defender) < 36, 'a planted defense starts from an actual body contact');
      assert.ok(radius(end.charger) < 1); assert.equal(end.out, false);
      assert.ok(Math.abs(end.returnCenter.x - (end.charger.x + end.defender.x) / 2) < 1e-8);
    }
    assert.deepEqual(at(1500), at(1500), 'pausing or directly seeking to a frame keeps the same story');
    for (const boundary of [312, 1352, initial.contactAt, 2158, 2600]) {
      const before = at(boundary - .001), after = at(boundary + .001);
      assert.ok(distance(before.charger, after.charger) < .01); assert.ok(distance(before.defender, after.defender) < .01);
    }
  }
});

test('the added twelve-percent eligible attempt keeps its independent thirty-to-seventy story ratio and every supplied rank', () => {
  let order;
  for (let variant = 0; variant < 100 && !order; variant++) {
    const candidate = Array.from({ length: 3 }, (_, i) => `rim-charge-${variant}-${i}`), round = arenaRounds(candidate)[0];
    if (!round.helper && !round.rushOutcome && !['bait', 'ram', 'edge'].includes(round.tactic)) order = candidate;
  }
  assert.ok(order);
  let eligible = 0, attempts = 0, dodges = 0;
  for (let seed = 0; seed < 4096; seed++) {
    const rounds = arenaRounds(order, 44000, 7, seed), round = rounds[0];
    if (round.rimCharge || !round.escape && !round.recovery && !round.rim && !['bait', 'ram'].includes(round.tactic)) eligible++;
    if (round.rimCharge) {
      attempts++;
      assert.equal(round.final, false); assert.equal(round.helper, undefined); assert.equal(round.rushOutcome, undefined);
      assert.equal(round.escape, undefined); assert.equal(round.recovery, undefined); assert.equal(round.rim, undefined);
      assert.ok(Math.abs((round.rimCharge.end - round.rimCharge.start) / round.timeScale - ARENA_RIM_CHARGE_DURATION) < 1e-8);
      if (round.rimCharge.outcome === 'dodge') { dodges++; assert.equal(round.tactic, 'bait'); assert.equal(round.impact, round.rimCharge.end); }
      else { assert.equal(round.start, round.rimCharge.end); assert.ok(round.impact > round.start); }
      assert.equal(arenaRanks(order, round.resolve - .001, 44000, 7, seed)[round.victim], undefined);
      assert.equal(arenaRanks(order, round.resolve, 44000, 7, seed)[round.victim], order.indexOf(round.victim) + 1);
    }
    assert.ok(rounds.every(round => !round.final || !round.rimCharge), 'the final pair is never given this optional failed charge');
    assert.deepEqual(arenaRanks(order, 44000, 44000, 7, seed), Object.fromEntries(order.map((id, i) => [id, i + 1])));
    assert.ok(rounds.at(-1).end <= 44000);
  }
  assert.ok(attempts / eligible > .10 && attempts / eligible < .14, `${attempts}/${eligible}: the new story remains a modest eligible addition`);
  assert.ok(dodges / attempts > .25 && dodges / attempts < .35, `${dodges}/${attempts}: the dodge outcome is independent of eligibility`);
});
