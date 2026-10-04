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
const { arenaWrestlingMoveTargets, ARENA_WRESTLING_MOVE_TIMING, ARENA_SPINEBUSTER_TIMING, ARENA_BACK_BODY_DROP_TIMING, ARENA_POWERBOMB_TIMING, ARENA_SCOOP_FINISH_TIMING } = await source('src/arenaWrestlingMoves.ts');
const [{ arenaSupermanPunchTargets }, { arenaKickCatchTargets }, { arenaSlideTripTargets }, { arenaLinkedRushTargets }, { arenaPairRushTargets }, { arenaPairDodgeTargets }, { arenaRimChargeTargets }] = await Promise.all([
  source('src/arenaSupermanPunch.ts'), source('src/arenaKickCatch.ts'), source('src/arenaSlideTrip.ts'), source('src/arenaLinkedRush.ts'), source('src/arenaPairRush.ts'), source('src/arenaPairDodge.ts'), source('src/arenaRimCharge.ts'),
]);
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
  for (const name of [...arenaSoloFinalTactics, 'elbow', 'superman', 'slide', 'slide-evade', 'trip-counter', 'kick-catch', 'clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam']) assert.ok(seen.has(name), `${name} is available without changing the two numeric ids`);
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
    if (frame.height > .01) { firstLift = clock; break; }
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

test('each attack run calls 돌진 above the actual running fighter, including both linked attackers', () => {
  const center = { x: 500, y: 416 }, profiles = [];
  const moving = velocity => Math.hypot(velocity.x, velocity.y) > 1;
  for (const kind of ['clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam']) {
    const round = { ...base, wrestlingMove: { kind, start: 0, end: 6000, launchAt: 1000, contactAt: null, ankleGripAt: null, releaseAt: null } };
    profiles.push({ name: kind, round, runners(clock) {
      const frame = arenaWrestlingMoveTargets(round.wrestlingMove, clock, center);
      return [...(frame.driverPose === 'run' && moving(frame.driverVelocity) ? ['a'] : []), ...(frame.victimPose === 'run' && moving(frame.victimVelocity) ? ['v'] : [])];
    } });
  }
  const superman = { ...base, supermanPunch: { start: 0, end: 6000, launchAt: null, hitAt: null } };
  profiles.push({ name: 'superman approach', round: superman, runners(clock) { const frame = arenaSupermanPunchTargets(superman.supermanPunch, clock, center); return frame.driverPose === 'run' && moving(frame.driverVelocity) ? ['a'] : []; } });
  const kickCatch = { ...base, kickCatch: { start: 0, end: 6000, launchAt: null, catchAt: null } };
  profiles.push({ name: 'incoming sidekick', round: kickCatch, runners(clock) { const frame = arenaKickCatchTargets(kickCatch.kickCatch, clock, center); return frame.kickerPose === 'run' && moving(frame.kickerVelocity) ? ['v'] : []; } });
  for (const evade of [false, true]) {
    const round = { ...base, slideTrip: { start: 0, end: 6000, launchAt: null, hookAt: null, kickAt: null, evade } };
    profiles.push({ name: `slide ${evade ? 'evaded' : 'ordinary'}`, round, runners(clock) { const frame = arenaSlideTripTargets(round.slideTrip, clock, center); return frame.driverPose === 'run' && moving(frame.driverVelocity) ? ['a'] : []; } });
  }
  const linked = { ...base, helper: 'h', linkedRush: { start: 0, end: 9200, launchAt: 1800 }, rushContactAt: undefined };
  profiles.push({ name: 'two linked attacks', round: linked, runners(clock) { return arenaLinkedRushTargets(linked.linkedRush, clock, center).stage === 'charge' ? ['a', 'h'] : []; } });
  for (const rushOutcome of ['counter-throw', 'double-out']) {
    const round = { ...base, tactic: 'double-shove', helper: 'h', rushOutcome, rushLaunchAt: 800 };
    profiles.push({ name: `third party ${rushOutcome}`, round, runners(clock) { const frame = arenaPairRushTargets(round, clock, center); return frame.stage === 'charge' ? [frame.chargerId] : []; } });
  }
  for (const outcome of ['resist', 'dodge']) {
    const round = { ...base, rimCharge: { start: 0, end: 2600, outcome } };
    profiles.push({ name: `rim ${outcome}`, round, runners(clock) { const frame = arenaRimChargeTargets(round, clock, center); return frame.stage === 'charge' || frame.stage === 'dodge' ? [frame.chargerId] : []; } });
  }
  for (const tactic of ['ram', 'bait', 'catch']) {
    const round = { ...base, tactic };
    profiles.push({ name: `ordinary ${tactic}`, round, runners(clock) { return clock < round.impact ? arenaAction(round, clock).actors.filter(actor => actor.pose === 'run').map(actor => actor.id) : []; } });
  }
  for (const profile of profiles) {
    let runningFrames = 0;
    for (let clock = 0; clock < 6000; clock += 32) {
      const runners = profile.runners(clock), words = arenaActionWords(profile.round, clock);
      for (const id of runners) {
        runningFrames++;
        assert.ok(words.some(word => word.id === id && word.word === '돌진!'), `${profile.name}: ${id} runs at ${clock}ms and needs its own 돌진! word`);
        assert.ok(!words.some(word => word.id === id && word.word === '달려든다!'));
      }
    }
    assert.ok(runningFrames >= 2, `${profile.name} includes a visible attack run`);
  }
});

test('a charging third fighter keeps its 돌진 word while both opponents jump out of its path', () => {
  for (const outcome of ['escape', 'out']) {
    const round = { ...base, helper: 'h', pairDodge: { start: 0, end: 6000, launchAt: 180, partnerId: 'h', outcome } };
    let preContactJumpFrames = 0, passingJumpFrames = 0;
    for (let clock = 0; clock < 3000; clock += 16) {
      const frame = arenaPairDodgeTargets(round.pairDodge, clock, { x: 500, y: 416 });
      if (!['jump', 'pass'].includes(frame.stage) || !frame.jumpHeight.some(height => height > 1)) continue;
      const words = arenaActionWords(round, clock);
      for (const id of ['a', 'h']) assert.ok(words.some(word => word.id === id && word.word === '점프 회피!'), 'each avoiding fighter keeps its own jump reaction');
      assert.ok(words.some(word => word.id === 'v' && word.word === '돌진!'), `the approaching third fighter still charges during ${frame.stage} at ${clock}ms`);
      if (clock < frame.contactAt) preContactJumpFrames++; else passingJumpFrames++;
    }
    assert.ok(preContactJumpFrames > 2 && passingJumpFrames > 2, 'both the incoming charge and passage below the jumping pair are visible');
  }
});

test('spinebuster describes the incoming runner, weight catch, slam, ankle grip, drag and inside throw in that order', () => {
  const center = { x: 500, y: 416 };
  const window = { kind: 'spinebuster', start: 0, end: 18000, plannedLaunchAt: 1000, plannedContactAt: 2200, counterReadyAt: 1600, launchAt: 1000, contactAt: 2200, ankleGripAt: null, releaseAt: null, kickAt: null };
  const floor = arenaWrestlingMoveTargets(window, 5000, center), gripAt = floor.pickupReadyAt + ARENA_WRESTLING_MOVE_TIMING.ankleReach + 64;
  const holding = { ...window, ankleGripAt: gripAt }, ready = arenaWrestlingMoveTargets(holding, gripAt, center);
  const round = { ...base, impact: ready.requiredReleaseAt, resolve: ready.requiredReleaseAt + 1100, end: ready.requiredReleaseAt + 1100, wrestlingMove: { ...holding, releaseAt: ready.requiredReleaseAt } };
  const observedAt = clock => ({ ...round, wrestlingMove: { ...round.wrestlingMove, launchAt: clock >= window.launchAt ? window.launchAt : null, contactAt: clock >= window.contactAt ? window.contactAt : null, ankleGripAt: clock >= gripAt ? gripAt : null, releaseAt: clock >= ready.requiredReleaseAt ? ready.requiredReleaseAt : null } });
  const liftStart = window.contactAt + ARENA_SPINEBUSTER_TIMING.load, slamStart = liftStart + ARENA_SPINEBUSTER_TIMING.lift;
  const samples = [
    ['approach', 500, 0, 'v', '돌진!', /달려/],
    ['attack', 1900, 0, 'v', '돌진!', /달려/],
    ['lift', liftStart + ARENA_SPINEBUSTER_TIMING.lift / 2, 2, 'a', '들어올리기!', /다리를 펴 들어/],
    ['fall', slamStart + ARENA_SPINEBUSTER_TIMING.slam / 2, 3, 'a', '내려찍기!', /등부터 모래/],
    ['recover', (floor.floorAt + floor.pickupReadyAt) / 2, 4, 'v', '기절!', /누워/],
    ['ankle-approach', floor.pickupReadyAt + ARENA_WRESTLING_MOVE_TIMING.ankleReach / 2, 5, 'a', '다리 잡기!', /아직 잡은 손은 없습니다/],
    ['ankle-grip', gripAt + 80, 6, 'a', '다리 잡기!', /양손.*두 발목에 닿/],
    ['drag', (gripAt + 160 + ready.dragEndAt) / 2, 7, 'a', '끌기!', /모래판 끝까지 끕니다/],
    ['toss', (ready.dragEndAt + ready.requiredReleaseAt) / 2, 8, 'a', '던지기!', /손은 아직 붙어/],
    ['release', ready.requiredReleaseAt, 9, 'v', '장외로!', /손을 놓았/],
  ];
  let previousClock = -1;
  for (const [stage, clock, step, id, word, detail] of samples) {
    assert.ok(clock > previousClock, 'the action clocks move forward through the whole technique'); previousClock = clock;
    const observed = observedAt(clock), frame = arenaWrestlingMoveTargets(observed.wrestlingMove, clock, center), story = arenaStoryState(observed, clock), words = arenaActionWords(observed, clock), narration = arenaNarration(observed, candidates(['a', 'v']), ['a', 'v'], clock);
    assert.equal(frame.stage, stage); assert.equal(story.step, step, `${stage} selects the corresponding visible step`);
    assert.match(story.action, detail); assert.match(narration.detail, detail);
    assert.ok(words.some(value => value.id === id && value.word === word), `${stage} calls ${word} above ${id}`);
    assert.doesNotMatch([story.label, story.action, narration.title, narration.detail, ...words.map(value => value.word)].join(' '), /발차기|몸통을 차|기술 모션/);
  }
  const incoming = arenaActionWords(observedAt(1200), 1200);
  assert.ok(incoming.some(word => word.id === 'v' && word.word === '돌진!'));
  assert.ok(!incoming.some(word => word.id === 'a' && /받아내기/.test(word.word)), 'the receiver is not announced as countering before the runner reaches halfway');
  assert.ok(arenaActionWords(observedAt(1900), 1900).some(word => word.id === 'v' && word.word === '돌진!'), 'the runner keeps its charge word when the receiver begins preparing');
});

test('six move descriptions follow actual fall, ankle pickup and finishing contact without old technical shouts', () => {
  for (const kind of ['clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam']) {
    const round = { ...base, wrestlingMove: { kind, start: 0, end: 9000, launchAt: 1800, contactAt: 2800, ankleGripAt: null, releaseAt: null, kickAt: null } };
    const forbidden = /클로스라인|스파인버스터|스쿱 슬램|백 바디 드롭|불독/;
    for (const clock of [0, 1000, 1800, 2800, 3100, 4000, 5000]) {
      const story = arenaStoryState(round, clock), words = arenaActionWords(round, clock), narration = arenaNarration(round, candidates(['a', 'v']), ['a', 'v'], clock);
      assert.doesNotMatch([story.label, story.action, narration.title, narration.detail, ...words.map(word => word.word)].join(' '), forbidden);
      assert.ok(story.step >= 0 && story.step < story.steps.length);
      if (kind !== 'dropkick') assert.doesNotMatch(story.action + narration.detail, /장외로 날아|장외로 나갑/);
    }
    if (kind === 'dropkick') continue;
    const floor = arenaWrestlingMoveTargets(round.wrestlingMove, 5000, { x: 500, y: 416 });
    const gripAt = Math.max(5000, floor.pickupReadyAt + 100);
    const holding = { ...round.wrestlingMove, ankleGripAt: gripAt };
    const ready = arenaWrestlingMoveTargets(holding, gripAt, { x: 500, y: 416 });
    const gripped = { ...round, wrestlingMove: { ...holding, releaseAt: ready.requiredReleaseAt } };
    const spinningFinish = kind === 'backbodydrop' || kind === 'scoopslam' || kind === 'powerbomb';
    const tossAt = spinningFinish ? ready.requiredReleaseAt - 16 : (ready.requiredReleaseAt + (ready.dragEndAt ?? gripAt)) / 2;
    if (spinningFinish) {
      const timing = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING : kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING : ARENA_SCOOP_FINISH_TIMING;
      const spinAt = gripAt + timing.ankleLoad + timing.ankleSpin / 2;
      assert.equal(arenaActionWords(gripped, spinAt)[0].word, '회전!');
      assert.match(arenaStoryState(gripped, spinAt).action, /두 발끝.*한 바퀴/);
    }
    assert.equal(arenaActionWords(gripped, gripAt + 10)[0].word, '다리 잡기!');
    assert.equal(arenaActionWords(gripped, tossAt)[0].word, '던지기!');
    assert.match(arenaStoryState(gripped, tossAt).action, spinningFinish ? /잡은 채 계속 돕니다.*마치는 순간 손을 놓아/ : /손은 아직 붙어/);
    assert.equal(arenaActionWords(gripped, ready.requiredReleaseAt).at(-1).word, '장외로!');
  }
});
