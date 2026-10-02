import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaTechniqueTargets } = await source('src/arenaTechniques.ts');
const { arenaAction, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { createArenaFighterAnimation, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const round = { id: 'elbow-test', index: 0, tactic: 'elbow', aggressor: 'counter', victim: 'lifter', start: 0, impact: 6300, resolve: 7400, end: 7400, final: false };
const fighter = (id, index, overrides) => ({ candidate: { id, name: id, color: '#ed9166' }, index, scale: 2.04, angle: 0, alpha: 1, facing: 1, pose: 'guard', velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function actors(actual, phase, index = 0) {
  const clock = actual.start + (actual.impact - actual.start) * phase, frame = arenaTechniqueTargets(actual, clock, { x: 500, y: 416 });
  const aggressor = fighter(actual.aggressor, index, { ...frame.aggressor, y: frame.aggressor.y - frame.aggressorLift, depthY: frame.aggressor.y, facing: frame.aggressorFacing ?? frame.side, pose: frame.aggressorPose ?? (frame.aggressorLift > 1 ? 'held' : 'guard'), phase: frame.phase, angle: frame.aggressorAngle, suspension: frame.aggressorSuspension, elbowStrength: frame.elbowContact });
  const victim = fighter(actual.victim, (index + 1) % 10, { ...frame.victim, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -frame.side, pose: frame.victimPose ?? (frame.victimGrip ? 'lift' : 'guard'), phase: frame.phase, angle: frame.victimAngle, suspension: frame.victimSuspension, gripMode: frame.victimGrip });
  return { clock, frame, aggressor, victim };
}

test('a lifted fighter strikes the lifter before groggy recovery and a separate ankle throw', () => {
  for (const side of [-1, 1]) {
    const actual = { ...round, contactSide: side }, lifted = actors(actual, .43), elbow = actors(actual, .55), groggy = actors(actual, .70), grab = actors(actual, .93), release = actors(actual, 1);
    assert.equal(lifted.frame.stage, 'lift-counter');
    assert.ok(lifted.frame.aggressorLift > 28 && lifted.aggressor.y < lifted.victim.y, 'the counter starts while physically lifted');
    assert.equal(lifted.frame.victimGrip, 'waist');
    const raisedBody = sampleArenaFighterContacts(lifted.aggressor, lifted.clock);
    const secondHold = { x: raisedBody.waist.x - lifted.victim.facing * 6, y: raisedBody.waist.y + 3 };
    Object.assign(lifted.victim, { gripTarget: raisedBody.waist, secondaryGripTarget: secondHold, gripStrength: 1, gripLocked: true });
    const lifter = sampleArenaFighterContacts(lifted.victim, lifted.clock);
    assert.ok(distance(lifter.hands[1], raisedBody.waist) < .01 && distance(lifter.hands[0], secondHold) < .01, 'both lifting hands physically hold the raised waist before the counter');
    assert.deepEqual(arenaAction(actual, lifted.clock).attackers, [actual.victim], 'the eventual loser is visibly the initial lifter');
    assert.equal(elbow.frame.elbowContact, 1, 'the contact stroke and groggy reaction share a clock');
    assert.ok(elbow.frame.elbowImpact > .99);
    assert.equal(elbow.frame.victimPose, 'stunned');
    assert.equal(groggy.frame.stage, 'groggy');
    assert.ok(Math.abs(groggy.frame.victimAngle) > 1.4 && groggy.frame.lift === 0, 'the lifter lies groggy before ankles are raised');
    assert.equal(grab.frame.stage, 'ankle-grip');
    assert.equal(grab.frame.grip, 'ankle');
    assert.deepEqual(arenaAction(actual, grab.clock).attackers, [actual.aggressor]);
    assert.equal(arenaAction(actual, grab.clock).targetId, actual.victim);
    assert.equal(release.frame.stage, 'release');
    assert.equal(release.frame.grip, undefined, 'the feet are released for the actual exit');
  }
});

test('the painted elbow reaches the painted head while both arm sections retain their lengths', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const { clock, frame, aggressor, victim } = actors({ ...round, contactSide: side }, .55, index);
    const target = sampleArenaFighterContacts(victim, clock);
    aggressor.elbowTarget = target.head;
    const strike = sampleArenaFighterContacts(aggressor, clock);
    assert.ok(distance(strike.elbows[1], target.head) < .01, `${side}/${index}: the elbow must actually touch the visible head (gap ${distance(strike.elbows[1], target.head).toFixed(2)}px, shoulder ${JSON.stringify(strike.shoulders[1])}, head ${JSON.stringify(target.head)})`);
    assert.ok(distance(strike.shoulders[1], strike.elbows[1]) <= 11 * aggressor.scale + .1, 'a head hit cannot stretch the upper arm');
    assert.ok(distance(strike.shoulders[1], strike.elbows[1]) > 11 * aggressor.scale * .6, 'the arm cannot collapse into a detached elbow pixel');
    assert.ok(Math.abs(distance(strike.elbows[1], strike.hands[1]) - 10.5 * aggressor.scale) < .1, 'the forearm stays folded with its normal length');
    assert.ok(distance(strike.hands[1], target.head) > 15, 'the palm is withdrawn so the hit visibly uses the elbow');
    assert.ok(frame.aggressorLift >= 30, 'contact takes place from the raised counter position');
  }
});

test('the thrower holds both real toe endpoints before releasing the stunned opponent', () => {
  for (const side of [-1, 1]) for (const phase of [.84, .86, .90, .94, .96, .999]) for (let index = 0; index < 10; index++) {
    const { clock, frame, aggressor, victim } = actors({ ...round, contactSide: side }, phase, index);
    const body = sampleArenaFighterContacts(victim, clock);
    Object.assign(aggressor, { facing: -side, gripMode: 'ankle', gripTarget: body.feet[0], secondaryGripTarget: body.feet[1], gripStrength: 1, gripLocked: true });
    const holder = sampleArenaFighterContacts(aggressor, clock);
    for (let hand = 0; hand < 2; hand++) assert.ok(distance(holder.hands[1 - hand], body.feet[hand]) < .01, `${side}/${phase}/${index}/${hand}: each hand holds an actual foot end (gap ${distance(holder.hands[1 - hand], body.feet[hand]).toFixed(2)}px, shoulder ${JSON.stringify(holder.shoulders[1 - hand])}, foot ${JSON.stringify(body.feet[hand])})`);
    assert.equal(frame.grip, 'ankle');
  }
});

test('an elbow victim stays where it fell until its feet are held and the attacker approaches that ground rig', () => {
  for (const side of [-1, 1]) {
    const actual = { ...round, contactSide: side }, fallen = actors(actual, .70), nearFeet = actors(actual, .84), gripped = actors(actual, .899);
    assert.deepEqual(nearFeet.frame.victim, fallen.frame.victim);
    assert.deepEqual(gripped.frame.victim, fallen.frame.victim);
    assert.equal(nearFeet.frame.lift, 0); assert.equal(gripped.frame.lift, 0, 'the body cannot float toward the hands before the feet are held');
    assert.equal(nearFeet.frame.victimSuspension, 0); assert.equal(gripped.frame.victimSuspension, 0);
    assert.deepEqual(fallen.frame.victimFloorRig, nearFeet.frame.victimFloorRig);
    assert.deepEqual(fallen.frame.victimFloorRig, gripped.frame.victimFloorRig, 'an unconscious foot endpoint cannot drift while the attacker comes around');
    assert.ok(side * (nearFeet.aggressor.x - fallen.aggressor.x) > 80, 'only the attacking fighter circles around to the foot ends');
    const floorBody = { ...fallen.victim, ...fallen.frame.victimFloorRig }, frozen = sampleArenaFighterContacts(floorBody, fallen.clock);
    const later = sampleArenaFighterContacts({ ...nearFeet.victim, ...nearFeet.frame.victimFloorRig }, nearFeet.clock);
    assert.deepEqual(frozen.origin, later.origin);
    frozen.feet.forEach((point, index) => assert.ok(distance(point, later.feet[index]) < .4, 'only subpixel breathing can move a grounded foot endpoint'));
    assert.ok(distance(frozen.head, later.head) < .6, 'breathing cannot turn into a movement toward the approaching attacker');
    assert.ok(side * (nearFeet.aggressor.x - (frozen.feet[0].x + frozen.feet[1].x) / 2) > 16, 'the attacker stands outside the foot ends instead of sharing the fallen torso');
    assert.ok(actors(actual, .96).frame.lift > 20, 'the later grounded grip can still lift into its separate throwing stroke');
  }
});

test('the elbow counter is a rare cosmetic branch and preserves every supplied result', () => {
  let order;
  for (let variant = 0; variant < 100 && !order; variant++) {
    const candidate = [`elbow-${variant}-first`, `elbow-${variant}-second`];
    if (['lift', 'suplex', 'final'].includes(arenaRounds(candidate).at(-1).tactic)) order = candidate;
  }
  assert.ok(order, 'there is a lifting finish eligible for an elbow counter');
  const original = [...order], samples = 2048;
  let counters = 0;
  for (let seed = 0; seed < samples; seed++) {
    const rounds = arenaRounds(order, 44000, 7, seed), final = rounds.at(-1);
    if (final.tactic === 'elbow') counters++;
    assert.equal(final.aggressor, order[0]);
    assert.equal(final.victim, order[1]);
    assert.deepEqual(arenaRanks(order, 44000, 44000, 7, seed), { [order[0]]: 1, [order[1]]: 2 }, 'the cosmetic counter never redraws the ranking');
  }
  assert.ok(counters / samples > .05 && counters / samples < .11, `${counters}/${samples}: elbow is close to eight percent of eligible lifts`);
  for (let count = 3; count <= 10; count++) for (let seed = 0; seed < 20; seed++) {
    const field = Array.from({ length: count }, (_, index) => `elbow-field-${seed}-${index}`), saved = [...field];
    arenaRounds(field, 44000, seed % 10, seed);
    assert.deepEqual(arenaRanks(field, 44000, 44000, seed % 10, seed), Object.fromEntries(field.map((id, index) => [id, index + 1])));
    assert.deepEqual(field, saved);
  }
  assert.deepEqual(order, original);
});
