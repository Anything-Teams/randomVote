import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaRounds, arenaRanks, arenaEliminatedIds, arenaSoloFinalTactics, arenaAction, arenaActionWords, arenaNarration, arenaCatchTargets } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { arenaEscapeRoll } = await source('src/arenaEscape.ts');
const { arenaRecoveryTargets } = await source('src/arenaRecovery.ts');
const { arenaWrestlingMoveTargets, ARENA_WRESTLING_MOVE_TIMING } = await source('src/arenaWrestlingMoves.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const candidates = ids => ids.map(id => ({ id, name: id, color: '#ffad72' }));
const base = { id: 'review', index: 0, tactic: 'lift', aggressor: 'a', victim: 'v', start: 0, impact: 6000, resolve: 10000, end: 10500, final: true, timeScale: 1 };

// The production IDs stay the same throughout this sample. Cosmetic variation
// must change the action without changing either person's drawn placement.
test('the same two finalists can select every solo technique with normal rare thresholds and no third person', () => {
  const order = ['1', '2'], seen = new Set();
  for (let seed = 0; seed < 16384; seed++) {
    const round = arenaRounds(order, 44000, 7, seed).at(-1);
    assert.equal(round.final, true); assert.equal(round.aggressor, '1'); assert.equal(round.victim, '2');
    assert.ok(!round.helper && !round.secondaryVictim && !round.linkedRush && !round.passingTrip && !round.pairDodge && !round.rushOutcome);
    const superman = arenaEscapeRoll(seed, 1103) % 1000 === 0;
    const slide = !superman && arenaEscapeRoll(seed, 911) % 1000 < 20;
    const counter = !superman && !slide && arenaEscapeRoll(seed, 701) % 1000 < 10;
    assert.equal(!!round.supermanPunch, superman);
    assert.equal(!!round.slideTrip, slide);
    assert.equal(!!round.tripCounter, counter);
    if (slide) assert.equal(round.slideTrip.evade, arenaEscapeRoll(seed, 1237) % 1000 < 20);
    const baseTactic = arenaSoloFinalTactics[arenaEscapeRoll(seed, 1717) % arenaSoloFinalTactics.length];
    assert.equal(!!round.kickCatch, !superman && !slide && !counter && baseTactic === 'sidekick' && arenaEscapeRoll(seed, 1207) % 1000 < 10);
    if (round.wrestlingMove) seen.add(round.wrestlingMove.kind);
    else if (superman) seen.add('superman');
    else if (slide) seen.add(round.slideTrip.evade ? 'slide-evade' : 'slide');
    else if (counter) seen.add('trip-counter');
    else if (round.kickCatch) seen.add('kick-catch');
    else if (!round.recovery) seen.add(round.tactic);
    assert.deepEqual(arenaEliminatedIds(round), ['2']);
    if (seed % 257 === 0) assert.deepEqual(arenaRanks(order, 44000, 44000, 7, seed), { 1: 1, 2: 2 });
  }
  for (const name of [...arenaSoloFinalTactics, 'elbow', 'superman', 'slide', 'slide-evade', 'trip-counter', 'kick-catch', 'clothesline', 'dropkick', 'bulldog', 'backbodydrop', 'spinebuster', 'scoopslam']) assert.ok(seen.has(name), `${name} is available without changing the two numeric ids`);
});

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
}
test('alliances require five living fighters, include the opening bout and allow both stories with fixed ids', () => {
  for (const count of [5, 6]) {
    const order = permutations(Array.from({ length: count }, (_, i) => String(i + 1))).find(order => arenaRounds(order, 44000, 7, 0).some(round => ['team', 'betrayal'].includes(round.tactic)));
    assert.ok(order, `${count} participants have a valid alliance slot`);
    const seen = new Set();
    for (let seed = 0; seed < 256; seed++) {
      const rounds = arenaRounds(order, 44000, 7, seed), alliances = rounds.filter(round => ['team', 'betrayal'].includes(round.tactic));
      assert.ok(alliances.length <= 1); alliances.forEach(round => {
        seen.add(round.tactic); assert.equal(new Set([round.aggressor, round.victim, round.helper]).size, 3);
        if (count === 5) assert.equal(round.index, 0, 'five starters can only ally before the first elimination');
      });
      assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1));
    }
    assert.deepEqual(seen, new Set(['team', 'betrayal']), 'the independent cosmetic roll breaks the old fixed hash parity');
  }
  for (const order of [['1', '2'], ['1', '2', '3'], ['1', '2', '3', '4']]) for (let seed = 0; seed < 32; seed++) assert.ok(!arenaRounds(order, 44000, 7, seed).some(round => ['team', 'betrayal'].includes(round.tactic)));
  let alliances = 0, doubleOutBeforeAlliance = 0;
  for (let count = 5; count <= 10; count++) for (let variation = 0; variation < 128; variation++) for (const rushRoll of [0, 7]) {
    const order = Array.from({ length: count }, (_, i) => `living-${variation}-${i}`);
    const rounds = arenaRounds(order, 44000, rushRoll, variation), living = new Set(order);
    const hash = order.join('|').split('').reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
    const mixed = Math.imul(hash ^ hash >>> 16, 0x45d9f3b) >>> 0;
    const eligibleChance = hash % 3 === 0 || ((mixed ^ mixed >>> 16) >>> 0) % 16 === 0;
    let precedingDoubleOut = false;
    for (const round of rounds) {
      if (['team', 'betrayal'].includes(round.tactic)) {
        alliances++; if (precedingDoubleOut) doubleOutBeforeAlliance++;
        assert.ok(eligibleChance, 'the original alliance chance threshold is unchanged');
        assert.ok(living.size >= 5, `only ${living.size} fighters remain before ${round.id}`);
        for (const id of [round.aggressor, round.victim, round.helper]) assert.ok(living.has(id), 'the whole alliance cast is actually still alive');
      }
      const out = arenaEliminatedIds(round);
      if (out.length === 2) precedingDoubleOut = true;
      out.forEach(id => { assert.ok(living.delete(id), 'each drawn loser exits once'); });
    }
    assert.deepEqual([...living], [order[0]], 'the stricter timing preserves the drawn winner');
  }
  assert.ok(alliances > 0 && doubleOutBeforeAlliance > 0, 'both ordinary schedules and schedules after two simultaneous exits are exercised');
});

test('a betrayal helper leaves the pose participants when it releases the alliance', () => {
  for (const counterFailed of [false, true]) for (const counterSide of ['front', 'back']) {
    const round = { ...base, tactic: 'betrayal', helper: 'h', counterFailed, counterSide };
    const at = p => round.start + (round.impact - round.start) * p;
    assert.ok(arenaAction(round, at(.35)).actors.some(actor => actor.id === 'h'), 'the helper physically contributes before release');
    for (const p of [.82, .90, .99, 1.02]) {
      const action = arenaAction(round, at(p));
      assert.ok(!action.actors.some(actor => actor.id === 'h'), 'an uninvolved helper cannot inherit the lifted or throwing body pose');
      assert.ok(!action.attackers.includes('h')); assert.notEqual(action.liftedId, 'h');
    }
  }
});

test('recovery keeps the original thrower in its prelude but chooses a different living opponent for the deciding bout', () => {
  const seen = new Set();
  for (let variant = 0; variant < 10 && seen.size < 2; variant++) {
    const order = Array.from({ length: 5 }, (_, i) => `review-${variant}-${i}`);
    for (let seed = 0; seed < 2048 && seen.size < 2; seed++) {
      const rounds = arenaRounds(order, 44000, 7, seed);
      for (const round of rounds) {
        if (!round.recovery || round.final) continue;
        seen.add(round.recovery.kind ?? 'somersault');
        const thrower = round.recovery.throwerId;
        assert.ok(thrower && thrower !== round.aggressor);
        const living = order.slice(0, order.indexOf(round.victim) + 1);
        assert.ok(living.includes(thrower) && living.includes(round.aggressor));
        assert.equal(round.victim, living.at(-1));
        const clock = round.recovery.start + (round.recovery.throwAt - round.recovery.start) * .90;
        assert.deepEqual(arenaStoryState(round, clock).left, [thrower]);
        assert.ok(arenaActionWords(round, clock).some(word => word.id === thrower));
        assert.match(arenaNarration(round, candidates(order), order, clock).detail, new RegExp(thrower));
        assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1));
      }
    }
  }
  assert.deepEqual(seen, new Set(['somersault', 'overhead-escape']));
});

test('the somersault throw is called as lifting starts and survival is announced only after landing', () => {
  const round = { ...base, recovery: { start: 0, throwAt: 5000, end: 7600, throwerId: 'original' }, start: 7600, impact: 12600, resolve: 13700 };
  let firstLift;
  for (let clock = 0; clock < 5000; clock += 16) {
    const frame = arenaRecoveryTargets(round, clock, { x: 500, y: 416 });
    if (frame.stage === 'lift') { firstLift = clock; break; }
  }
  assert.ok(firstLift < 4000);
  assert.ok(arenaActionWords(round, firstLift).some(word => word.id === 'original' && word.word === '던지기!'));
  for (const clock of [firstLift, 4999, 5100, 5879]) {
    const story = arenaStoryState(round, clock), narration = arenaNarration(round, candidates(['a', 'v', 'original']), ['a', 'original', 'v'], clock);
    assert.doesNotMatch([story.label, story.action, story.relationLabel, story.rightLabel, narration.title, narration.detail].join(' '), /살아남|살았다|장외 회피|장외를 피/);
  }
  assert.match(arenaStoryState(round, 5880).label, /살아남/);
});

test('ordinary catch accepts actual incoming weight before body rotation and never lifts through an unrecorded grip', () => {
  for (const side of [-1, 1]) {
    const receiver = { x: 500, y: 416 }, charger = { x: 500 - side * 150, y: 416 };
    const round = { ...base, tactic: 'catch', chargeSetup: { charger, receiver, side, contactAt: null } };
    const pending = arenaCatchTargets(round, 5999, receiver);
    assert.equal(pending.gripStrength, 0); assert.equal(pending.height, 0); assert.equal(pending.turn, 0);
    assert.equal(arenaAction(round, 5999).lift, 0);
    const captured = { ...round, chargeSetup: { ...round.chargeSetup, contactAt: 3300, contactCharger: pending.charger, contactReceiver: pending.receiver } };
    const atContact = arenaCatchTargets(captured, 3300, receiver), beforeTurn = arenaCatchTargets(captured, 4019, receiver), afterTurn = arenaCatchTargets(captured, 4021, receiver);
    assert.deepEqual(atContact.charger, pending.charger); assert.deepEqual(atContact.receiver, pending.receiver);
    assert.equal(atContact.turn, 0); assert.equal(atContact.height, 0); assert.equal(atContact.gripStrength, 1);
    assert.equal(beforeTurn.turn, 0); assert.ok(afterTurn.turn > 0);
    assert.ok(distance(beforeTurn.charger, afterTurn.charger) < .01);
    assert.ok(arenaCatchTargets(captured, 5500, receiver).height > 40);
  }
});

test('six move descriptions follow actual fall, ankle pickup and finishing contact without old technical shouts', () => {
  for (const kind of ['clothesline', 'dropkick', 'bulldog', 'backbodydrop', 'spinebuster', 'scoopslam']) {
    const round = { ...base, wrestlingMove: { kind, start: 0, end: 9000, launchAt: 1800, contactAt: 2800, ankleGripAt: null, releaseAt: null, kickAt: null } };
    const forbidden = /클로스라인|스파인버스터|스쿱 슬램|백 바디 드롭|불독/;
    for (const clock of [0, 1000, 1800, 2800, 3100, 4000, 5000]) {
      const story = arenaStoryState(round, clock), words = arenaActionWords(round, clock), narration = arenaNarration(round, candidates(['a', 'v']), ['a', 'v'], clock);
      assert.doesNotMatch([story.label, story.action, narration.title, narration.detail, ...words.map(word => word.word)].join(' '), forbidden);
      assert.ok(story.step >= 0 && story.step < story.steps.length);
      if (kind !== 'dropkick') assert.doesNotMatch(story.action + narration.detail, /장외로 날아|장외로 나갑/);
    }
    if (kind === 'dropkick' || kind === 'spinebuster') continue;
    const floor = arenaWrestlingMoveTargets(round.wrestlingMove, 5000, { x: 500, y: 416 });
    const gripAt = Math.max(5000, floor.pickupReadyAt + 100);
    const gripped = { ...round, wrestlingMove: { ...round.wrestlingMove, ankleGripAt: gripAt, releaseAt: gripAt + ARENA_WRESTLING_MOVE_TIMING.ankleThrow } };
    assert.equal(arenaActionWords(gripped, gripAt + 10)[0].word, '다리 잡기!');
    assert.equal(arenaActionWords(gripped, gripAt + 150)[0].word, '던지기!');
    assert.match(arenaStoryState(gripped, gripAt + 150).action, /손은 아직 붙어/);
    assert.equal(arenaActionWords(gripped, gripAt + 300).at(-1).word, '장외로!');
  }
});
