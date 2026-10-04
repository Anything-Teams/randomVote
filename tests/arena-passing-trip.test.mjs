import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaPassingTripTargets, arenaPassingTripOutcome, arenaPassingTripAnkleHolder, ARENA_PASSING_TRIP_CHANCE } = await source('src/arenaPassingTrip.ts');
const { sampleArenaFighterContacts, drawArenaFighter, createArenaFighterAnimation, arenaCarryHolderPoint } = await source('src/game/ArenaFighter.ts');
const center = { x: 500, y: 416 }, window = { start: 10_000, end: 13_500, passerId: 'passing-survivor' };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const initial = side => ({ passer: { x: 500 + side * 76, y: 428 }, victim: { x: 500 + side * 24, y: 416 }, opponent: { x: 500 - side * 24, y: 416 } });
const actor = (index, overrides) => ({ candidate: { id: String(index + 1), name: '선수', color: '#ffad72' }, index, scale: 2.04, x: 500, y: 416, facing: 1, pose: 'brace', phase: 1, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, power: .55, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
const victimActor = (frame, side) => actor(1, { x: frame.victim.x, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -side, pose: frame.victimPose, angle: frame.victimAngle, suspension: frame.victimSuspension, carryStretch: frame.victimCarryStretch, slamProgress: frame.victimSlam });
const context = new Proxy({}, { get: () => () => {}, set: () => true });

test('exactly one independent cosmetic outcome in a thousand enables the passing trip', () => {
  assert.equal(ARENA_PASSING_TRIP_CHANCE, .001);
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaPassingTripOutcome(roll)).filter(Boolean).length, 1);
  assert.equal(arenaPassingTripOutcome(0), true);
  for (const invalid of [-1, .5, 1000, NaN, Infinity]) assert.throws(() => arenaPassingTripOutcome(invalid), RangeError);
});

test('the passer starts at its actual origin and keeps walking through the hook inside the sand', () => {
  for (const side of [-1, 1]) {
    const origins = initial(side), frozen = structuredClone(origins), first = arenaPassingTripTargets(window, window.start, center, origins, side);
    assert.deepEqual(first.passer, origins.passer);
    assert.deepEqual(first.victim, origins.victim);
    assert.deepEqual(first.opponent, origins.opponent);
    assert.ok(first.canHook && first.pickupReachable);
    assert.ok(first.requiredImpactAt - window.start >= 2600 && first.requiredImpactAt - window.start <= 3500);
    const before = arenaPassingTripTargets(window, first.hookAt - 16, center, origins, side), after = arenaPassingTripTargets(window, first.hookAt + 16, center, origins, side);
    assert.ok(distance(before.passer, after.passer) > 3.8, 'the passer does not brake to pose at the victim');
    let previous = first;
    for (let clock = window.start + 8; clock <= window.end; clock += 8) {
      const frame = arenaPassingTripTargets(window, clock, center, origins, side);
      assert.ok(Math.hypot((frame.passer.x - 500) / 278, (frame.passer.y - 416) / 80) <= 1 + 1e-9, 'the third fighter stays inside the safe ellipse');
      assert.ok(distance(frame.passer, previous.passer) / .008 <= 130.001, 'a small elapsed step never teleports the walker');
      assert.ok(distance(frame.opponent, previous.opponent) / .008 <= 180, 'the toe holder approaches and follows the same lift with human-paced steps');
      assert.ok((frame.passer.x - previous.passer.x) * frame.passerFacing >= -1e-8, 'walking never reverses to the staging origin');
      previous = frame;
    }
    assert.ok(distance(previous.passer, after.passer) > 100, 'the passer leaves the pair and survives, rather than joining the throw');
    assert.deepEqual(origins, frozen, 'reading this cosmetic story cannot mutate the living bodies');
  }
});

test('the hooking boot reaches the victim’s actual painted ankle before the body falls on either side', () => {
  for (const side of [-1, 1]) {
    const origins = initial(side), brace = sampleArenaFighterContacts(actor(1, { ...origins.victim, facing: -side }), window.start);
    origins.standingAnkle = brace.feet.reduce((near, foot) => distance(foot, origins.passer) < distance(near, origins.passer) ? foot : near);
    const timing = arenaPassingTripTargets(window, window.start, center, origins, side), frame = arenaPassingTripTargets(window, timing.hookAt, center, origins, side);
    assert.equal(frame.stage, 'hook'); assert.equal(frame.footStrength, 1); assert.equal(Math.abs(frame.victimAngle), 0);
    const passer = actor(2, { ...frame.passer, facing: frame.passerFacing, pose: 'trip', footTarget: frame.passerFootTarget, footStrength: frame.footStrength, kickLeg: 1 });
    drawArenaFighter(context, passer, timing.hookAt);
    assert.ok(distance(passer.animation.contactPoints.feet[1], origins.standingAnkle) <= 2, 'the painted striking sole reaches the real ankle with fixed leg lengths');
    const falling = arenaPassingTripTargets(window, timing.fallAt + 175, center, origins, side);
    assert.equal(falling.stage, 'fall'); assert.ok(Math.abs(falling.victimAngle) > .6);
    assert.equal(falling.footStrength, 0, 'the boot withdraws so it does not tow the falling body');
    assert.equal(falling.grip, false, 'the duel opponent has not magically caught the ankles during the fall');
  }
});

test('both rendered hands reach the grounded toes and keep those actual endpoints through one overhead lift', () => {
  for (const side of [-1, 1]) {
    let origins = initial(side), timing = arenaPassingTripTargets(window, window.start, center, origins, side);
    const fallen = arenaPassingTripTargets(window, timing.fallenAt, center, origins, side);
    const floorRig = sampleArenaFighterContacts(victimActor(fallen, side), timing.fallenAt);
    origins = { ...origins, fallenFeet: floorRig.feet };
    timing = arenaPassingTripTargets(window, window.start, center, origins, side);
    for (const clock of [timing.gripAt + 120, timing.launchedAt, timing.launchedAt + 260, timing.launchedAt + 550, timing.tossAt]) {
      const layout = arenaPassingTripTargets(window, clock, center, origins, side), victim = victimActor(layout, side);
      drawArenaFighter(context, victim, clock);
      const feet = victim.animation.contactPoints.feet;
      const frame = arenaPassingTripTargets(window, clock, center, { ...origins, heldFeet: feet }, side);
      assert.ok(frame.grip, 'toe contact remains attached until the release');
      const opponent = actor(0, { ...frame.opponent, facing: frame.opponentFacing, pose: frame.opponentPose, overheadRaise: frame.overheadRaise, gripMode: 'ankle', gripStrength: 1, gripLocked: true, gripTarget: feet[0], secondaryGripTarget: feet[1] });
      const saved = structuredClone(opponent.animation);
      Object.assign(opponent, arenaCarryHolderPoint(opponent, feet, clock, frame.opponent));
      assert.deepEqual(opponent.animation, saved, 'anatomical holder placement cannot advance the live gait');
      drawArenaFighter(context, opponent, clock);
      for (let foot = 0; foot < 2; foot++) assert.ok(distance(opponent.animation.contactPoints.hands[1 - foot], feet[foot]) <= 4, `side ${side}, clock ${clock}, foot ${foot}: both actual toes must be held`);
    }
    assert.throws(() => arenaPassingTripAnkleHolder([floorRig.feet[0]], side, 0), RangeError);
  }
});

test('real grip feedback gates the lift and preserves the floor pose while contact is still missing', () => {
  const origins = initial(1), pending = { ...window, launchAt: null }, timing = arenaPassingTripTargets(pending, window.start, center, origins);
  for (const clock of [timing.gripAt + 200, timing.gripAt + 1500]) {
    const frame = arenaPassingTripTargets(pending, clock, center, origins);
    assert.equal(frame.stage, 'grip'); assert.equal(frame.lift, 0); assert.equal(frame.victimCarryStretch, 0); assert.equal(frame.victimSuspension, 0);
    assert.equal(frame.launchedAt, null); assert.ok(frame.waitingForGrip);
  }
  const confirmedAt = timing.gripAt + 180, confirmed = { ...window, launchAt: confirmedAt };
  const before = arenaPassingTripTargets(pending, confirmedAt, center, origins), at = arenaPassingTripTargets(confirmed, confirmedAt, center, origins);
  assert.deepEqual(at.victim, before.victim); assert.deepEqual(at.opponent, before.opponent);
  assert.equal(at.victimCarryStretch, 0); assert.equal(at.lift, 0, 'confirming contact does not instantly load the body above the hands');
  assert.equal(at.launchedAt, confirmedAt + 300);
  assert.equal(at.requiredImpactAt, confirmedAt + 300 + 750 + 270);
  const release = arenaPassingTripTargets(confirmed, at.requiredImpactAt, center, origins);
  assert.equal(release.stage, 'release'); assert.equal(release.grip, false); assert.ok(release.releaseVelocity.x > 80 && release.releaseVelocity.y < 0);
  const actualHook = { ...window, hookAt: window.start + 210 }, recorded = arenaPassingTripTargets(actualHook, actualHook.hookAt, center, origins);
  assert.equal(recorded.hookAt, actualHook.hookAt, 'a sole verified before the root passes takes effect at that real contact');
  assert.equal(recorded.fallAt, actualHook.hookAt + 130);
  assert.deepEqual(recorded.passer, arenaPassingTripTargets(window, actualHook.hookAt, center, origins).passer, 'recording a strike changes the fall clock without pulling the passer forward');
});

test('every physical stage boundary is continuous and distant entrants remain ineligible instead of being pulled forward', () => {
  for (const side of [-1, 1]) {
    const origins = initial(side), timing = arenaPassingTripTargets(window, window.start, center, origins, side);
    for (const boundary of [timing.hookAt, timing.fallAt, timing.fallenAt, timing.gripAt, timing.launchedAt, timing.tossAt, timing.requiredImpactAt]) {
      const before = arenaPassingTripTargets(window, boundary - .001, center, origins, side), after = arenaPassingTripTargets(window, boundary + .001, center, origins, side);
      for (const body of ['passer', 'victim', 'opponent']) assert.ok(distance(before[body], after[body]) < .005, `${body} cannot snap at ${boundary}`);
      for (const value of ['victimAngle', 'victimSuspension', 'lift', 'overheadRaise']) assert.ok(Math.abs(before[value] - after[value]) < .005, `${value} cannot reset at ${boundary}`);
    }
  }
  const far = { ...initial(1), passer: { x: 730, y: 380 }, opponent: { x: 270, y: 416 } }, first = arenaPassingTripTargets(window, window.start, center, far);
  assert.deepEqual(first.passer, far.passer); assert.deepEqual(first.opponent, far.opponent);
  assert.equal(first.canHook, false); assert.equal(first.pickupReachable, false);
  const rim = { ...initial(1), passer: { x: 777, y: 416 }, victim: { x: 775, y: 416 } };
  assert.equal(arenaPassingTripTargets(window, window.start, center, rim).canHook, false, 'the passing lane must have room beyond the contact');
  const noRunway = { ...initial(1), passer: { x: 778, y: 416 }, victim: { x: 776, y: 416 } };
  const rimFrame = arenaPassingTripTargets(window, window.start + 500, center, noRunway);
  assert.equal(rimFrame.canHook, false); assert.deepEqual(rimFrame.passer, noRunway.passer, 'an ineligible zero-runway walker remains finite at its real origin');
  for (const unit of [.5, 1, 1.6]) {
    const origins = initial(1); let previous = arenaPassingTripTargets(window, window.start, center, origins, 1, unit);
    for (let clock = window.start + 8; clock <= previous.requiredImpactAt; clock += 8) {
      const current = arenaPassingTripTargets(window, clock, center, origins, 1, unit);
      assert.ok(distance(current.opponent, previous.opponent) / .008 <= 180, 'a shorter or longer run does not compress the physical loading stroke');
      previous = current;
    }
  }
});
