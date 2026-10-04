import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaActionWords, arenaChargeTargets, arenaDoubleShoveTargets, arenaEliminatedIds, arenaInsidePoint, arenaMove, arenaNarration, arenaRanks, arenaRounds, arenaTechniqueExit } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { arenaAnklePickup } = await source('src/arenaPickup.ts');
const { createArenaFighterAnimation, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const base = { id: 'alliance', index: 2, tactic: 'betrayal', aggressor: 'receiver', victim: 'loser', helper: 'other', start: 1000, impact: 6000, resolve: 7100, end: 7550, final: false };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const radius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);

test('an alliance counter chooses either attacker side and its facing target changes only after the alliance breaks', () => {
  for (const side of ['front', 'back']) {
    const round = { ...base, counterSide: side };
    const initial = arenaAction(round, 3600), counter = arenaAction(round, 5600);
    const front = initial.actors.find(part => part.id === (side === 'front' ? round.victim : round.helper));
    assert.ok(front.offset.x < 0, 'the initial front opponent stays on the same side');
    assert.equal(initial.actors.find(part => part.id === round.aggressor).gripId, front.id);
    assert.equal(counter.actors.find(part => part.id === round.aggressor).gripId, round.victim);
    assert.equal(counter.liftedId, round.victim);
    assert.match(arenaStoryState(round, 5600).action, side === 'back' ? /뒤쪽/ : /앞쪽/);
  }
});

test('a failed counter lands, releases both grips and recontacts before the later drawn elimination', () => {
  const round = { ...base, counterFailed: true, counterSide: 'back' };
  const at = p => round.start + (round.impact - round.start) * p;
  const blocked = arenaAction(round, at(.66)), free = arenaAction(round, at(.74)), retry = arenaAction(round, at(.95));
  assert.equal(blocked.stage, 'failed-counter'); assert.equal(blocked.outcome, 'resisted');
  assert.match(arenaStoryState(round, at(.66)).action, /누구도.*떠나지/);
  assert.equal(free.stage, 'reset'); assert.equal(free.lift, 0);
  assert.ok(free.actors.every(part => !part.gripId), 'nobody keeps an invisible grip through the failed attempt');
  assert.equal(retry.stage, 'lift'); assert.ok(retry.lift > 30);
  assert.equal(retry.liftedId, round.victim);
  for (const p of [.62, .70, .73, .80]) {
    const before = arenaAction(round, at(p) - .001), after = arenaAction(round, at(p) + .001);
    assert.ok(Math.abs(before.lift - after.lift) < .01, 'landing and the second lift join continuously');
    before.actors.forEach(part => assert.ok(distance(part.offset, after.actors.find(other => other.id === part.id).offset) < .01));
  }
});

test('the two-person shove first contacts the locked pair, pushes both continuously and keeps the third fighter inside', () => {
  const round = { ...base, tactic: 'double-shove', secondaryVictim: base.helper, impact: 7500, resolve: 8600, end: 9000 };
  for (const center of [{ x: 390, y: 413 }, { x: 610, y: 413 }, { x: 500, y: 430 }]) {
    let previous = arenaDoubleShoveTargets(round, round.start, center);
    const bodies = Object.fromEntries(['aggressor', 'victim', 'helper'].map(role => [role, { ...previous[role], facing: previous.side }]));
    let contact = false;
    for (let at = round.start + 16; at <= round.impact; at += 16) {
      const frame = arenaDoubleShoveTargets(round, at, center);
      for (const role of ['aggressor', 'victim', 'helper']) {
        assert.ok(distance(frame[role], previous[role]) < 2.65, 'a force moves the pair rather than teleporting them to a prescribed rim');
        arenaMove(bodies[role], frame[role], .016, 165);
      }
      if (frame.stage === 'contact') contact ||= distance(bodies.aggressor, bodies.helper) < 64;
      assert.ok(radius(frame.aggressor) < .99, 'the third fighter never exits with the two wrestlers');
      previous = frame;
    }
    assert.ok(contact, 'the third fighter reaches an actual wrestler before the push');
    for (const role of ['victim', 'helper']) assert.ok(radius(previous[role]) > .95, 'both wrestlers reach the boundary');
    assert.equal(arenaAction(round, round.impact).lift, 0);
    assert.match(arenaStoryState(round, round.impact).action, /두 선수만.*떨어/);
  }
});

test('an occasional rush keeps its exact three-to-seven branch ratio and consumes only the next drawn losers', () => {
  const seen = new Set(); let rushGames = 0, doubles = 0, counters = 0, dodges = 0;
  for (let variant = 0; variant < 160; variant++) for (let roll = 0; roll < 10; roll++) {
    const order = Array.from({ length: 8 }, (_, i) => `narrative-${variant}-${i}`), living = new Set(order);
    const rounds = arenaRounds(order, 44000, roll); let previousEnd = 0;
    if (!roll && rounds.some(round => round.rushOutcome)) rushGames++;
    for (const round of rounds) {
      assert.equal(round.rimCharge?.start ?? round.rim?.start ?? round.pairDodge?.start ?? round.passingTrip?.start ?? round.recovery?.start ?? round.escape?.start ?? round.start, previousEnd); previousEnd = round.end;
      assert.ok(living.has(round.aggressor));
      if (round.tactic === 'betrayal') { seen.add(round.counterSide); seen.add(round.counterFailed ? 'failed' : 'succeeded'); }
      const exits = arenaEliminatedIds(round);
      if (round.pairDodge) {
        assert.ok(roll >= 3); assert.equal(round.secondaryVictim, undefined);
        assert.equal(round.victim, [...living].at(-1)); dodges++;
      }
      if (round.rushOutcome) {
        assert.equal(round.rushOutcome, roll < 3 ? 'double-out' : 'counter-throw');
        if (roll >= 3) { counters++; assert.equal(round.secondaryVictim, undefined); }
      }
      if (round.secondaryVictim) {
        doubles++;
        assert.equal(round.rushOutcome, 'double-out');
        assert.equal(round.helper, round.secondaryVictim);
        assert.deepEqual(exits, [...living].slice(-2).reverse());
        assert.ok(!exits.includes(round.aggressor));
        assert.equal(round.final, living.size === 3, 'a last three-person double exit confirms the only survivor');
        const before = arenaRanks(order, round.resolve - .001, 44000, roll), after = arenaRanks(order, round.resolve, 44000, roll);
        for (const id of exits) { assert.equal(before[id], undefined); assert.equal(after[id], order.indexOf(id) + 1); }
      }
      exits.forEach(id => { assert.ok(living.has(id)); living.delete(id); });
    }
    assert.deepEqual([...living], [order[0]]);
    assert.deepEqual(arenaRanks(order, 44000, 44000, roll), Object.fromEntries(order.map((id, i) => [id, i + 1])));
    assert.ok(rounds.filter(round => !!round.secondaryVictim).length <= 1);
  }
  assert.ok(rushGames > 10 && rushGames < 80, 'the three-person story remains occasional across matches');
  assert.equal(doubles, rushGames * 3); assert.equal(counters + dodges, rushGames * 7);
  assert.deepEqual(seen, new Set(['front', 'back', 'failed', 'succeeded']));
});

test('a charge dodge clears the path visibly and its brief word belongs to the dodging fighter', () => {
  const round = { ...base, tactic: 'bait' }, center = { x: 680, y: 425 };
  const waiting = arenaChargeTargets(round, round.start, center), avoiding = arenaChargeTargets(round, round.impact - 40, center);
  assert.ok(Math.abs(avoiding.target.y - waiting.target.y) > 59);
  assert.ok(distance(avoiding.target, avoiding.charger) > 62);
  const words = arenaActionWords(round, round.impact - 40);
  assert.deepEqual(words, [{ id: round.victim, word: '돌진!' }, { id: round.aggressor, word: '회피!' }]);
  assert.deepEqual(arenaActionWords(round, round.resolve + 1), []);
  const candidates = [{ id: 'receiver', name: '받는 선수', color: '#ddd' }, { id: 'loser', name: '밀린 선수', color: '#eee' }, { id: 'other', name: '동료', color: '#aaa' }];
  assert.match(arenaNarration({ ...base, counterFailed: true }, candidates, candidates.map(c => c.id), 4300).detail, /역습도 막혔/);
});

test('a suplex driver target remains inside while the held ankle approaches the rim', () => {
  for (const side of [-1, 1]) for (const y of [380, 425, 468]) {
    const target = arenaInsidePoint({ x: 500 + side * 270, y });
    assert.ok(radius(target) < .97);
    assert.ok(Math.abs(target.x - 500) <= 280);
    const extreme = arenaInsidePoint({ x: 500 + side * 470, y: 580 });
    assert.ok(radius(extreme) < .99);
  }
});

test('short head words follow the actual wrist pivot, fall, floor roll and ankle drag stages', () => {
  const final = { ...base, start: 33200, impact: 38200, resolve: 39300, end: 44000, final: true };
  const at = fraction => final.start + (final.impact - final.start) * fraction;
  const armspin = { ...final, tactic: 'armspin' };
  assert.deepEqual(arenaActionWords(armspin, at(.36)), [{ id: final.aggressor, word: '잡기!' }]);
  assert.deepEqual(arenaActionWords(armspin, at(.70)), [{ id: final.aggressor, word: '회전!' }]);
  const trip = { ...final, tactic: 'trip' };
  assert.deepEqual(arenaActionWords(trip, at(.48)), [{ id: final.aggressor, word: '발걸기!' }]);
  assert.deepEqual(arenaActionWords(trip, at(.57)), [{ id: final.victim, word: '넘어진다!' }]);
  assert.match(arenaStoryState(trip, at(.68)).action, /넘어졌습니다/);
  assert.deepEqual(arenaActionWords(trip, at(.82)), [{ id: final.aggressor, word: '발차기!' }, { id: final.victim, word: '구르기!' }]);
  assert.match(arenaStoryState(trip, at(.82)).action, /몸통을 발로/);
  assert.equal(arenaAction(trip, at(.82)).actors.find(actor => actor.id === final.aggressor).pose, 'trip');
  assert.deepEqual(arenaActionWords(trip, at(.80) + 700), [{ id: final.victim, word: '구르기!' }]);
  assert.deepEqual(arenaActionWords(trip, at(.80) + 900), []);
  const suplex = { ...final, tactic: 'suplex', impact: 35300 };
  assert.deepEqual(arenaActionWords(suplex, suplex.impact + 150), []);
  assert.deepEqual(arenaActionWords(suplex, suplex.impact + 1500), [{ id: final.aggressor, word: '끌기!' }]);
  assert.deepEqual(arenaActionWords(suplex, suplex.impact + 2700), [{ id: final.aggressor, word: '던지기!' }]);
  assert.deepEqual(arenaActionWords(suplex, suplex.impact + 3500), []);
});

test('a suplex pull uses reachable live ground speed and the driver stops inside when only the victim is tossed', () => {
  const round = { ...base, tactic: 'suplex', start: 33200, impact: 35300, resolve: 39300, end: 44000, final: true };
  for (const center of [360, 500, 640]) for (const side of [-1, 1]) for (const unit of [.7, 1, 1.5]) {
    const actual = { ...round, resolve: round.impact + 4100 * unit }, origin = { x: center - side * 4, y: 428 }, landing = { x: side > 0 ? 885 : 115, y: 436 }, angle = -side * .53 * Math.PI;
    const driver = { x: center + side * 22, y: 425, facing: -side };
    let previousFloor, endGap = Infinity, arrival = false;
    for (let age = 0; age < 2600 * unit; age += 16) {
      const flight = arenaTechniqueExit(actual, age, origin, landing, side, unit, { lift: 0, angle });
      const victim = { candidate: { id: 'fallen', name: '선수', color: '#ffa977' }, index: 0, x: flight.groundX, y: flight.groundY, depthY: flight.groundY, scale: 2.04, facing: side, pose: 'stunned', angle, slamProgress: { tuck: 1, slump: 1 }, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 1, motionImmediate: true, animation: createArenaFighterAnimation() };
      const toes = sampleArenaFighterContacts(victim, 7990).feet, pickup = arenaAnklePickup(victim, toes, side);
      const target = arenaInsidePoint(pickup.holder), before = { ...driver };
      if (flight.stage === 'stunned') arenaMove(driver, target, .016, 165);
      else Object.assign(driver, target);
      if (flight.stage === 'stunned' && distance(driver, target) < 1) arrival = true;
      assert.ok(distance(driver, before) <= 2.641, `the actual toe grip cannot pull the standing driver faster than 165px/s (${center}/${side}/${unit})`);
      if (previousFloor) assert.ok(distance(victim, previousFloor) <= 2.641, 'the held body follows the same reachable floor speed without a second lagging motor');
      assert.ok(radius(driver) < .97, 'the pulling fighter remains inside during the shared ground path');
      assert.equal(flight.height, 0, 'the opponent remains grounded throughout the pickup and pull');
      endGap = distance(driver, target); previousFloor = { x: victim.x, y: victim.y };
    }
    assert.ok(arrival, 'the driver reaches the real foot ends during the 900ms pickup beat');
    assert.ok(endGap < 1e-8, 'the shared drag path holds the actual toe contact without a second motor lag');
    const release = arenaTechniqueExit(actual, 2600 * unit, origin, landing, side, unit, { lift: 0, angle });
    const leaving = arenaTechniqueExit(actual, 3040 * unit, origin, landing, side, unit, { lift: 0, angle });
    assert.equal(release.stage, 'rim-toss'); assert.equal(release.height, 0);
    assert.ok(leaving.height > 30 && side * (leaving.x - release.x) > 50, 'only the released victim continues outward');
  }
});
