import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaRecoveryTargets, ARENA_RECOVERY_EXIT_DURATION } = await source('src/arenaRecovery.ts');
const { arenaTechniqueTargets } = await source('src/arenaTechniques.ts');
const { arenaAction, arenaActionWords, arenaNarration, arenaRanks, arenaRounds, arenaMinimumDuration, arenaSoloFinalTactics } = await source('src/arenaLogic.ts');
const { arenaEscapeRoll } = await source('src/arenaEscape.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sandRadius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const fixtureOrder = ['overhead-18-a', 'overhead-18-v'];
const base = { id: 'overhead-survival', index: 0, tactic: 'suplex', aggressor: 'driver', victim: 'jumper', start: 6250, impact: 10350, resolve: 14450, end: 17050, final: true, timeScale: 1, recovery: { start: 0, throwAt: 5000, end: 6250, kind: 'overhead-escape' } };
const bodyAt = (frame, index) => ({ candidate: { id: 'jumper', name: '점프 선수', color: '#ffad72' }, index, x: frame.receiver.x, y: frame.receiver.y - frame.height, depthY: frame.receiver.y, scale: 2.04, facing: -frame.side, pose: frame.receiverPose, phase: frame.landingPhase, angle: frame.angle, suspension: frame.suspension, slamProgress: frame.receiverSlam, jumpTuck: frame.jumpTuck, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true });

test('overhead escape is an independent two percent suplex surprise and preserves every drawn place', () => {
  assert.equal(arenaRounds(fixtureOrder).at(-1).recovery, undefined, 'a missing cosmetic seed cannot add an escape');
  let eligible = 0, escapes = 0;
  for (let seed = 0; seed < 8192; seed++) {
    const rounds = arenaRounds(fixtureOrder, 44000, 7, seed), final = rounds.at(-1);
    // Later cosmetic moves may replace a failed suplex trial. Count the
    // original eligibility before those moves, including their failures.
    const baseTactic = arenaSoloFinalTactics[arenaEscapeRoll(seed, final.index + 1717) % arenaSoloFinalTactics.length];
    const originallySuplex = baseTactic === 'suplex' && !final.supermanPunch && !final.slideTrip && !final.tripCounter && !final.kickCatch && arenaEscapeRoll(seed, final.index + 39) % 100 >= 8;
    if (originallySuplex) eligible++;
    assert.equal(final.recovery?.kind === 'overhead-escape', originallySuplex && arenaEscapeRoll(seed, final.index + 307) % 100 < 2);
    if (final.recovery?.kind !== 'overhead-escape') continue;
    escapes++;
    assert.equal(final.tactic, 'suplex');
    assert.equal(final.helper, undefined); assert.equal(final.escape, undefined);
    assert.equal(rounds.filter(round => round.recovery).length, 1);
    assert.deepEqual(arenaRanks(fixtureOrder, 44000, 44000, 7, seed), { [fixtureOrder[0]]: 1, [fixtureOrder[1]]: 2 });
  }
  assert.ok(eligible > 400);
  assert.ok(escapes / eligible > .015 && escapes / eligible < .026, `${escapes}/${eligible}: the extra escape remains close to two percent`);
});

test('both directions retain the actual overhead suplex rig, then jump free instead of performing a full throw', () => {
  for (const side of [-1, 1]) for (const unit of [.4, 1, 1.5]) {
    const round = { ...base, contactSide: side, timeScale: unit, start: 6250 * unit, recovery: { ...base.recovery, throwAt: 5000 * unit, end: 6250 * unit } };
    const center = { x: 500, y: 416 }, at = age => arenaRecoveryTargets(round, age * unit, center);
    const ordinary = { ...round, recovery: undefined, start: 0, impact: 5000 * unit / .70 };
    for (const age of [1500, 2500, 4200, 4700, 4999]) {
      const frame = at(age), suplex = arenaTechniqueTargets(ordinary, age * unit, center);
      assert.deepEqual(frame.thrower, suplex.aggressor);
      assert.deepEqual(frame.receiver, suplex.victim);
      assert.equal(frame.height, suplex.lift);
      assert.equal(frame.overheadRaise, suplex.aggressorOverheadRaise);
      assert.deepEqual(frame.receiverSlam, suplex.victimSlam);
    }
    const held = at(4999.999), released = at(5000.001), apex = at(5220), landed = at(5880);
    assert.equal(held.stage, 'overhead'); assert.equal(held.height, 100); assert.equal(held.grip, true);
    assert.equal(released.stage, 'jump'); assert.equal(released.grip, false);
    assert.ok(Math.abs(released.height - 100) < .001);
    assert.ok(apex.height > 115 && apex.jumpTuck > .5, 'the receiver folds its knees and pushes up before descending');
    assert.ok(apex.throwerBalance > .5 && apex.overheadRaise < .3, 'the driver loses the grip and lowers the arms to balance');
    assert.ok(side * (landed.receiver.x - held.receiver.x) > 75, 'the jumper travels backwards away from the lifter');
    assert.equal(landed.height, 0); assert.equal(landed.suspension, 0);
    assert.ok(landed.receiverSlam.tuck === 0 && landed.jumpTuck === 0, 'both knees are unfolded before the soles touch sand');
    for (let age = 5000; age < 5880; age += 16) {
      const frame = at(age);
      assert.ok(Math.abs(frame.angle) <= .120001, 'the escape remains an upright backwards jump');
      assert.ok(frame.airborne && frame.height >= 0 && sandRadius(frame.receiver) < 1);
      assert.deepEqual(frame, at(age), 'pause and direct seek produce the same jump');
    }
    for (let index = 0; index < 10; index++) {
      const left = sampleArenaFighterContacts(bodyAt(held, index), 4999.999 * unit), right = sampleArenaFighterContacts(bodyAt(released, index), 5000.001 * unit);
      for (const key of ['head', 'waist']) assert.ok(distance(left[key], right[key]) < .005, `${side}/${index}/${key}: release preserves the overhead silhouette`);
      for (const key of ['hands', 'feet', 'elbows']) left[key].forEach((point, i) => assert.ok(distance(point, right[key][i]) < .005, `${side}/${index}/${key}${i}: no joint snaps at release`));
    }
  }
});

test('every body type plants both feet inside the arena, then runs farther from the lifter', () => {
  for (const side of [-1, 1]) for (const center of [{ x: 500, y: 416 }, { x: 320, y: 390 }, { x: 680, y: 445 }]) {
    const round = { ...base, contactSide: side }, landed = arenaRecoveryTargets(round, 5880, center), settled = arenaRecoveryTargets(round, 6100, center);
    assert.equal(landed.stage, 'land'); assert.equal(settled.stage, 'separate');
    assert.deepEqual(landed.receiver, settled.receiver, 'a survivor does not move back to a predetermined home');
    assert.equal(settled.height, 0); assert.equal(settled.grip, false);
    const escaped = arenaRecoveryTargets(round, 7350, center);
    assert.ok(distance(escaped.receiver, escaped.thrower) > distance(settled.receiver, settled.thrower) + 30, 'the landing continues into a real departure');
    assert.ok(distance(escaped.receiver, landed.receiver) > 30 && sandRadius(escaped.receiver) < 1);
    for (let index = 0; index < 10; index++) for (const frame of [landed, settled]) {
      const body = bodyAt(frame, index), contacts = sampleArenaFighterContacts(body, 6000);
      assert.ok(contacts.feet.every(foot => Math.abs(foot.y - (frame.receiver.y - 2 * body.scale)) < .05), `${side}/${index}: both painted foot endpoints land together`);
      assert.ok(contacts.feet.every(foot => sandRadius(foot) < 1), 'both feet survive inside the boundary');
    }
    for (const boundary of [5000, 5880, 6100, 6250]) {
      const before = arenaRecoveryTargets(round, boundary - .001, center), after = arenaRecoveryTargets(round, boundary + .001, center);
      for (const key of ['thrower', 'receiver', 'returnCenter']) assert.ok(distance(before[key], after[key]) < .005);
      for (const key of ['height', 'angle']) assert.ok(Math.abs(before[key] - after[key]) < .005);
    }
  }
});

test('jump narration follows each actual phase and only the following bout awards the drawn rank', () => {
  const order = [...fixtureOrder], seed = Array.from({ length: 8192 }, (_, seed) => seed).find(seed => arenaRounds(order, 44000, 7, seed).at(-1).recovery?.kind === 'overhead-escape'), duration = arenaMinimumDuration(order, 7, seed), round = arenaRounds(order, duration, 7, seed).at(-1);
  assert.equal(round.recovery.kind, 'overhead-escape');
  assert.equal(round.recovery.end, round.start);
  assert.equal(round.recovery.end - round.recovery.throwAt, ARENA_RECOVERY_EXIT_DURATION * round.timeScale);
  const candidates = order.map(id => ({ id, name: id, color: '#ffad72' }));
  const probes = [2200, 4200, 4700, 5220, 5900, 6150];
  for (const elapsed of probes) {
    const state = arenaStoryState(round, elapsed), action = arenaAction(round, elapsed), narrative = arenaNarration(round, candidates, order, elapsed);
    assert.equal(state.kind, 'overhead-escape'); assert.ok(state.step >= 0);
    assert.ok(state.action && narrative.detail, 'every stage remains readable');
    assert.equal(action.outcome, 'pending');
    assert.deepEqual(arenaRanks(order, elapsed, duration, 7, seed), {}, 'the original pair both survive the surprise');
  }
  const jump = arenaStoryState(round, 5220);
  assert.match(jump.label, /점프 탈출/); assert.match(jump.action, /무릎/);
  assert.match(arenaNarration(round, candidates, order, 5220).title, /점프 탈출/);
  assert.match(arenaActionWords(round, 5220).at(-1).word, /점프 탈출/);
  assert.deepEqual(arenaRanks(order, round.resolve - .001, duration, 7, seed), {});
  assert.equal(arenaRanks(order, round.resolve, duration, 7, seed)[order[1]], 2);
  assert.deepEqual(arenaRanks(order, duration, duration, 7, seed), { [order[0]]: 1, [order[1]]: 2 });
  assert.deepEqual(order, fixtureOrder);
});
