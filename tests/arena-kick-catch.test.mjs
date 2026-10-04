import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaKickCatchTargets: targets, arenaKickCatchOutcome, ARENA_KICK_CATCH_TIMING: timing } = await source('src/arenaKickCatch.ts');
const { arenaRounds, arenaRanks, arenaEliminatedIds, arenaMiniExchanges, arenaContactRound, arenaRimPushOutcome, ARENA_RIM_PUSH_DISTANCE } = await source('src/arenaLogic.ts');
const { arenaEscapeRoll } = await source('src/arenaEscape.ts');
const { arenaSlideTripEvadeOutcome } = await source('src/arenaSlideTrip.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const center = { x: 500, y: 416 }, start = 1000;
const window = { start, end: start + 6000, launchAt: null, catchAt: null };
const origins = side => ({ catcher: { x: 500 - side * 24, y: 416 }, kicker: { x: 500 + side * 160, y: 416 }, kickTarget: { x: 500 - side * 6, y: 340 } });

test('a kick catch uses exactly ten independent outcomes per thousand eligible kicks', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaKickCatchOutcome(roll)).filter(Boolean).length, 10);
  for (const roll of [-1, 1000, .1, NaN]) assert.throws(() => arenaKickCatchOutcome(roll), RangeError);
});

test('the losing kicker approaches from the actual root, accelerates and plants without an invented backwards runway', () => {
  for (const side of [-1, 1]) {
    const initial = origins(side), first = targets(window, start, center, initial);
    assert.ok(first.canPerform); assert.deepEqual(first.kicker, initial.kicker); assert.deepEqual(first.catcher, initial.catcher);
    assert.equal(first.kickerHeight, 0); assert.equal(first.launchAt, null);
    assert.ok(first.plannedLaunchAt > start + timing.plant);
    let previous = first;
    for (let elapsed = start + 16; elapsed <= first.plannedLaunchAt + 1000; elapsed += 16) {
      const frame = targets(window, elapsed, center, initial);
      assert.ok(side * (frame.kicker.x - previous.kicker.x) <= 1e-8, 'the kicker never steps back to manufacture a jump');
      assert.ok(distance(frame.kicker, previous.kicker) / .016 <= 160 + 1e-7);
      assert.equal(frame.kickerHeight, 0); assert.equal(frame.grip, false); assert.equal(frame.spin, undefined);
      assert.deepEqual(frame.catcher, initial.catcher);
      previous = frame;
    }
    const ready = targets(window, first.plannedLaunchAt, center, initial);
    assert.equal(ready.stage, 'load'); assert.ok(ready.canLaunch);
    assert.deepEqual(ready, targets(window, first.plannedLaunchAt, center, initial), 'pausing cannot advance the runway');
  }
});

test('a missed or unrecorded ankle catch finishes the same jump and lands inside without an invented suspension', () => {
  for (const side of [-1, 1]) for (const catchAt of [null, undefined]) {
    const initial = origins(side), planned = targets(window, start, center, initial);
    const live = { ...window, launchAt: planned.plannedLaunchAt, catchAt };
    const jump = targets(live, live.launchAt + 200, center, initial);
    assert.ok(jump.canCatch && jump.kickerHeight > 20);
    assert.equal(jump.kickerPose, 'sidekick'); assert.equal(jump.kickerFacing, -side);
    for (const elapsed of [live.launchAt, live.launchAt + 325, live.launchAt + timing.air, live.launchAt + timing.air + timing.land + timing.recover]) {
      const frame = targets(live, elapsed, center, initial);
      assert.equal(frame.catchAt, null); assert.equal(frame.releaseAt, null); assert.equal(frame.grip, false); assert.equal(frame.spin, undefined);
      assert.equal(Math.abs(frame.turn), 0);
    }
    const landing = targets(live, live.launchAt + timing.air, center, initial);
    assert.equal(landing.stage, 'land'); assert.equal(landing.kickerHeight, 0);
    assert.ok(Math.hypot((landing.kicker.x - 500) / 293, (landing.kicker.y - 416) / 102) < 1);
    assert.equal(targets(live, live.launchAt + timing.air + timing.land + timing.recover, center, initial).active, false);
  }
});

test('an actual caught foot connects continuously to two close palms and exactly one accelerating turn in both directions', () => {
  for (const side of [-1, 1]) for (const kickLeg of [0, 1]) {
    const initial = { ...origins(side), kickLeg }, planned = targets(window, start, center, initial);
    const launched = { ...window, launchAt: planned.plannedLaunchAt }, catchAt = launched.launchAt + 325;
    const atContact = targets(launched, catchAt, center, initial);
    const recorded = { ...initial, caughtKicker: atContact.kicker, caughtCatcher: atContact.catcher, caughtHeight: atContact.kickerHeight, caughtFoot: atContact.footTarget };
    const live = { ...launched, catchAt }, caught = targets(live, catchAt, center, recorded);
    assert.deepEqual(caught.kicker, atContact.kicker); assert.deepEqual(caught.catcher, atContact.catcher);
    assert.equal(caught.kickerHeight, atContact.kickerHeight); assert.equal(caught.kickerAngle, atContact.kickerAngle);
    assert.equal(caught.kickerPose, 'sidekick', 'the foot variant starts with the actual extended kick, not a different airborne rig');
    assert.equal(caught.footStrength, 1); assert.deepEqual(caught.footTarget, recorded.caughtFoot);
    assert.ok(caught.grip); assert.equal(caught.spin.weight, 0);
    for (const palm of caught.gripTargets) assert.deepEqual(palm, recorded.caughtFoot);
    const releaseAt = catchAt + timing.load + timing.spin;
    assert.equal(caught.releaseAt, releaseAt); assert.equal(caught.requiredImpactAt, releaseAt);
    let previous = caught, previousTurn = 0;
    for (let elapsed = catchAt + 8; elapsed <= releaseAt; elapsed += 8) {
      const frame = targets(live, elapsed, center, recorded);
      assert.ok(side * frame.turn >= previousTurn - 1e-10); previousTurn = side * frame.turn;
      assert.ok(distance(frame.gripTargets[0], frame.gripTargets[1]) <= 6 + 1e-8, 'both palms hold one ankle');
      for (let arm = 0; arm < 2; arm++) assert.ok(distance(frame.gripTargets[arm], previous.gripTargets[arm]) / .008 < 140, 'the planted catcher can follow the grip without teleporting');
      assert.deepEqual(frame.catcher, recorded.caughtCatcher);
      assert.equal(frame.spin.gripLimb, 'feet'); assert.equal(frame.spin.gripFoot, kickLeg);
      previous = frame;
    }
    const release = targets(live, releaseAt, center, recorded);
    assert.equal(release.stage, 'release'); assert.equal(release.grip, false);
    assert.ok(Math.abs(release.turn - side * Math.PI * 2) < 1e-10);
    const last = targets(live, releaseAt - .001, center, recorded);
    assert.ok(Math.abs(release.turn - last.turn) / .000001 > 5, 'release keeps angular momentum instead of stopping at the last palm grip');
    assert.ok(Math.hypot(release.releaseVelocity.x, release.releaseVelocity.y) > 100);
    for (const boundary of [catchAt, catchAt + 80, catchAt + timing.load, releaseAt]) {
      const a = targets(live, boundary - .001, center, recorded), b = targets(live, boundary + .001, center, recorded);
      for (const field of ['kicker', 'catcher']) assert.ok(distance(a[field], b[field]) < .002, `${boundary}/${field}: no phase boundary root reset`);
      assert.ok(Math.abs(a.kickerHeight - b.kickerHeight) < .002);
    }
  }
});

test('close and outside encounters decline the counter without moving or suspending either body', () => {
  for (const initial of [{ catcher: { x: 476, y: 416 }, kicker: { x: 524, y: 416 } }, { catcher: { x: 780, y: 460 }, kicker: { x: 680, y: 460 } }]) {
    const frame = targets({ ...window, launchAt: 2000, catchAt: 2300 }, 2600, center, initial);
    assert.equal(frame.canPerform, false); assert.equal(frame.active, false); assert.equal(frame.launchAt, null); assert.equal(frame.catchAt, null);
    assert.deepEqual(frame.kicker, initial.kicker); assert.deepEqual(frame.catcher, initial.catcher);
    assert.equal(frame.grip, false); assert.equal(frame.spin, undefined); assert.equal(frame.kickerHeight, 0);
  }
});

test('only eligible solo sidekicks receive the counter and every drawn loser keeps their supplied placement', () => {
  let selected = 0, finalSelected = 0;
  for (const order of [['2', '1'], ['1', '3', '2', '4', '5'], Array.from({ length: 10 }, (_, i) => String(i + 1))]) for (let seed = 0; seed < 2048; seed++) {
    const original = [...order], rounds = arenaRounds(order, 44000, 7, seed);
    assert.deepEqual(rounds.flatMap(arenaEliminatedIds), [...order].reverse().slice(0, -1));
    for (const [index, round] of rounds.entries()) {
      if (round.slideTrip) {
        assert.equal(round.slideTrip.evade, arenaSlideTripEvadeOutcome(arenaEscapeRoll(seed, round.index + 1237) % 1000));
        assert.equal(round.slideTrip.jumpAt, null); assert.equal(round.slideTrip.passAt, null);
      }
      if (!round.kickCatch) continue;
      selected++; if (round.final) finalSelected++;
      assert.equal(round.tactic, 'sidekick'); assert.ok(!round.helper && !round.secondaryVictim && !round.rushOutcome && !round.exchange);
      assert.ok(!round.supermanPunch && !round.linkedRush && !round.slideTrip && !round.pairDodge && !round.passingTrip && !round.tripCounter && !round.escape && !round.recovery && !round.rim && !round.rimCharge);
      assert.equal(round.kickCatch.start, rounds[index - 1]?.resolve ?? 0); assert.equal(round.kickCatch.start, round.start);
      assert.equal(round.kickCatch.end, round.impact); assert.equal(round.kickCatch.launchAt, null); assert.equal(round.kickCatch.catchAt, null);
      assert.ok(Math.abs((round.impact - round.start) / round.timeScale - 6000) < 1e-7);
      assert.equal(round.victim, order[order.length - 1 - round.index]);
      assert.equal(arenaRanks(order, round.resolve, 44000, 7, seed)[round.victim], order.indexOf(round.victim) + 1);
      const bodies = order.map((id, i) => ({ id, x: 410 + i * 20, y: 416 }));
      assert.ok(!arenaMiniExchanges(bodies, Math.max(0, round.start - 100), 44000, [round]).some(mini => mini.prepares === round.id));
      assert.equal(arenaContactRound(round, { x: 740, y: 416 }, { aggressor: { x: 710, y: 416 }, victim: { x: 770, y: 416 } }).tactic, 'sidekick', 'rim weighting cannot replace the recorded counter roles');
    }
    assert.deepEqual(order, original);
  }
  assert.ok(selected >= 25 && selected < 150, 'production numeric-id fixtures occasionally select the low chance action');
  assert.ok(finalSelected > 0, 'a two-person deciding sidekick can also be countered');
});

test('actual nearby outward encounters favor pushes while central, inward and reserved stories keep their finish', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaRimPushOutcome(roll)).filter(Boolean).length, 700);
  for (const roll of [-1, 1000, .1, NaN]) assert.throws(() => arenaRimPushOutcome(roll), RangeError);
  const base = { id: 'weighted', index: 0, tactic: 'lift', aggressor: 'winner', victim: 'loser', final: true, start: 0, impact: 5000, resolve: 6100, end: 10800 };
  for (const side of [-1, 1]) for (let roll = 0; roll < 1000; roll++) {
    const point = { x: 500 + side * (303 - ARENA_RIM_PUSH_DISTANCE + 5), y: 416 };
    const participants = { aggressor: { x: point.x - side * 25, y: 416 }, victim: { x: point.x + side * 25, y: 416 } };
    const planned = { ...base, rimPushRoll: roll }, actual = arenaContactRound(planned, point, participants);
    assert.equal(actual.tactic, roll < 700 ? 'edge' : 'lift'); assert.equal(!!actual.rimPush, roll < 700);
    assert.equal(actual.aggressor, base.aggressor); assert.equal(actual.victim, base.victim); assert.deepEqual(arenaEliminatedIds(actual), ['loser']);
    for (const clock of ['start', 'impact', 'resolve', 'end']) assert.equal(actual[clock], base[clock]);
    assert.equal(arenaContactRound(planned, center, { aggressor: { x: 475, y: 416 }, victim: { x: 525, y: 416 } }).tactic, 'lift');
    assert.equal(arenaContactRound(planned, point, { aggressor: participants.victim, victim: participants.aggressor }).tactic, 'lift');
    for (const reserved of [{ recovery: { start: 0, end: 6000 } }, { escape: { start: 0, end: 2600 } }, { helper: 'third' }, { slideTrip: { start: 0, end: 6000 } }, { supermanPunch: { start: 0, end: 6000 } }, { kickCatch: { start: 0, end: 6000 } }]) {
      assert.equal(arenaContactRound({ ...planned, ...reserved }, point, participants).tactic, 'lift');
    }
  }
});
