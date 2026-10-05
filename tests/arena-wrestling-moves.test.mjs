import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { ARENA_CHARGE_SPEED } = await source('src/arenaCharge.ts');
const { arenaOverheadSlamMotion } = await source('src/arenaOverheadSlam.ts');
const { arenaWrestlingMoveOutcome, arenaWrestlingMoveTargets, arenaWrestlingMoveIsCounter, arenaAnkleRimThrowTargets, ARENA_WRESTLING_MOVE_CHANCE, ARENA_WRESTLING_MOVE_TIMING, ARENA_SCOOP_SLAM_TIMING, ARENA_SCOOP_RECOVERY_TIMING, ARENA_SCOOP_FINISH_TIMING, ARENA_SPINEBUSTER_TIMING, ARENA_CLOTHESLINE_FINISH_TIMING, ARENA_DRAGGED_ANKLE_THROW_TIMING, ARENA_BACK_BODY_DROP_TIMING, ARENA_POWERBOMB_TIMING } = await source('src/arenaWrestlingMoves.ts');
const { createArenaFighterAnimation, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const kinds = ['clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'];
const center = { x: 500, y: 416 }, distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;
const window = kind => ({ kind, start: 1000, end: 8000, launchAt: null, contactAt: null, releaseAt: null, kickAt: null, ankleGripAt: null });
function origins(kind, side = 1) {
  return arenaWrestlingMoveIsCounter(kind)
      ? { driver: { x: 500 + side * 25, y: 416 }, victim: { x: 500 - side * 200, y: 416 } }
      : { driver: { x: 500 - side * 180, y: 416 }, victim: { x: 500 + side * 20, y: 416 } };
}
function launched(kind, side = 1) {
  const initial = origins(kind, side), opening = arenaWrestlingMoveTargets(window(kind), 1000, center, initial, side);
  const actual = { ...window(kind), launchAt: opening.plannedLaunchAt };
  const launching = arenaWrestlingMoveTargets(actual, actual.launchAt, center, initial, side);
  initial.launchDriver = launching.driver; initial.launchVictim = launching.victim;
  return { initial, actual, opening };
}
function contacted(kind, side = 1) {
  const values = launched(kind, side), contactAt = values.opening.plannedContactAt;
  const atContact = arenaWrestlingMoveTargets(values.actual, contactAt, center, values.initial, side);
  values.initial.contactDriver = atContact.driver; values.initial.contactVictim = atContact.victim;
  values.actual = { ...values.actual, contactAt };
  return { ...values, contactAt };
}
// Find the observed transition rather than inventing an ankle-contact clock
// while the caster is still walking to the toe side of the floored body.
function firstPickupClock(values, side = 1, ready = frame => frame.canGrabAnkle) {
  const at = clock => arenaWrestlingMoveTargets(values.actual, clock, center, values.initial, side);
  let low = at(values.contactAt).pickupReadyAt, high = low + 4000;
  assert.ok(ready(at(high)), 'the complete floor recovery, toe-side walk and reaching hand finish in a finite time');
  for (let iteration = 0; iteration < 50; iteration++) {
    const middle = (low + high) / 2;
    if (ready(at(middle))) high = middle; else low = middle;
  }
  return high;
}
const fighter = (index, values) => ({ candidate: { id: String(index), name: String(index), color: '#ffad72' }, index, x: 500, y: 416, scale: 2.04, facing: 1, pose: 'guard', phase: 0, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });

test('each new wrestling move uses an independent four percent cosmetic roll', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaWrestlingMoveOutcome(roll)).filter(Boolean).length, 1000 * ARENA_WRESTLING_MOVE_CHANCE);
  for (const invalid of [-1, 1000, .5, NaN]) assert.throws(() => arenaWrestlingMoveOutcome(invalid), RangeError);
});

test('a clothesline runs into its flying arm strike while hip counters wait for the incoming opponent', () => {
  for (const side of [-1, 1]) {
    const clothesline = launched('clothesline', side), early = arenaWrestlingMoveTargets(clothesline.actual, clothesline.actual.start + 250, center, clothesline.initial, side);
    assert.equal(early.canContact, false); assert.equal(early.driverPose, 'run'); assert.ok(distance(early.driver, clothesline.initial.driver) > 25);
    const flying = arenaWrestlingMoveTargets(clothesline.actual, clothesline.actual.launchAt + 250, center, clothesline.initial, side);
    assert.ok(flying.driverHeight > 20 && flying.driverSuspension === 1 && Math.abs(flying.driverAngle) > 1, 'the accelerating stride launches a visibly horizontal flying body before contact');
    assert.equal(flying.footTargets, undefined); assert.equal(flying.feetStrength, 0, 'the flying clothesline strikes with its arm rather than converting into a two-foot kick');
    const close = arenaWrestlingMoveTargets(window('clothesline'), 1000, center, { driver: { x: 500, y: 416 }, victim: { x: 500 + side * 90, y: 416 } }, side);
    assert.equal(close.canPerform, false, 'a short reach cannot become an instant running clothesline');
    for (const kind of ['powerbomb', 'spinebuster', 'backbodydrop', 'scoopslam']) {
      const values = launched(kind, side), rushing = arenaWrestlingMoveTargets(values.actual, values.actual.launchAt + 500, center, values.initial, side);
      assert.deepEqual(rushing.driver, values.initial.driver); assert.deepEqual(rushing.driverVelocity, { x: 0, y: 0 });
      assert.equal(rushing.victimPose, 'run'); assert.ok(distance(rushing.victim, values.initial.victim) > 50); assert.ok(Math.hypot(rushing.victimVelocity.x, rushing.victimVelocity.y) > 100);
    }
  }
});

test('all six moves preserve actual starting roots and reserve unrecorded contact without fake lifts or falls', () => {
  for (const kind of kinds) for (const side of [-1, 1]) {
    const values = launched(kind, side), opening = arenaWrestlingMoveTargets(window(kind), 1000, center, values.initial, side);
    assert.equal(opening.canPerform, true); assert.deepEqual(opening.driver, values.initial.driver); assert.deepEqual(opening.victim, values.initial.victim);
    const saved = structuredClone(values.initial), pending = arenaWrestlingMoveTargets(values.actual, values.opening.plannedContactAt + 500, center, values.initial, side);
    assert.equal(pending.contactAt, null); assert.equal(pending.canRelease, false);
    assert.equal(pending.victimHeight, 0); assert.equal(Math.abs(pending.victimAngle), 0); assert.equal(pending.victimSlam, undefined);
    assert.deepEqual(values.initial, saved, 'sampling never writes the real origins');
  }
});

test('actual contact begins from the same roots and keeps the complete world rig finite in both headings', () => {
  for (const kind of kinds) for (const side of [-1, 1]) {
    const values = contacted(kind, side), at = values.contactAt;
    const before = arenaWrestlingMoveTargets(values.actual, at - .001, center, values.initial, side), after = arenaWrestlingMoveTargets(values.actual, at + .001, center, values.initial, side);
    for (const role of ['driver', 'victim']) assert.ok(distance(before[role], after[role]) < .001, `${kind}/${side}/${role}: contact cannot reset a body`);
    for (let elapsed = at; elapsed <= at + 1800; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial, side);
      for (const role of ['driver', 'victim']) for (const coordinate of ['x', 'y']) assert.ok(Number.isFinite(frame[role][coordinate]));
      assert.ok(inside(frame.driver), `${kind}/${side}: the survivor stays inside through the finish`);
      assert.ok(Number.isFinite(frame.victimHeight) && Number.isFinite(frame.victimAngle));
    }
  }
});

test('recording a head fall or incoming hip catch preserves its exact contact-frame rig', () => {
  for (const kind of ['powerbomb', 'backbodydrop']) for (const side of [-1, 1]) {
    const values = launched(kind, side), at = values.opening.plannedContactAt;
    const before = arenaWrestlingMoveTargets(values.actual, at, center, values.initial, side);
    values.initial.contactDriver = { ...before.driver }; values.initial.contactVictim = { ...before.victim };
    const after = arenaWrestlingMoveTargets({ ...values.actual, contactAt: at }, at, center, values.initial, side);
    assert.equal(after.driverPose, before.driverPose); assert.equal(after.victimPose, before.victimPose);
    assert.equal(after.driverSlam, undefined); assert.equal(after.victimSlam, undefined);
    assert.equal(after.victimHeight, 0); assert.equal(Math.abs(after.victimAngle), 0); assert.equal(after.victimSuspension, 0);
    if (kind === 'backbodydrop') {
      assert.equal(after.backBodyProgress, before.backBodyProgress, 'the catcher cannot undo the planted load at the instant of contact');
      const startingFlip = arenaWrestlingMoveTargets({ ...values.actual, contactAt: at }, at + 16, center, values.initial, side);
      assert.ok(startingFlip.victimSuspension > 0 && startingFlip.victimSuspension < 1, 'the flight pivot takes over gradually after the genuine hip grip');
    }
  }
});

test('running moves decline unsuitable geometry without manufacturing a runway', () => {
  for (const kind of kinds) {
    const initial = origins(kind);
    initial.driver = { x: initial.victim.x - 20, y: initial.victim.y };
    const frame = arenaWrestlingMoveTargets(window(kind), 6000, center, initial);
    assert.equal(frame.canPerform, false); assert.equal(frame.canLaunch, false); assert.equal(frame.canContact, false); assert.equal(frame.canRelease, false);
    assert.deepEqual(frame.driver, initial.driver); assert.deepEqual(frame.victim, initial.victim);
  }
});

test('a powerbomb receives a bounded incoming rush without moving its waiting holder', () => {
  for (const kind of ['powerbomb']) for (const side of [-1, 1]) {
    const initial = { driver: { x: 500 - side * 190, y: 416 }, victim: { x: 500 + side * 90, y: 416 } };
    const opening = arenaWrestlingMoveTargets(window(kind), 1000, center, initial, side);
    assert.equal(opening.canPerform, true); assert.equal(opening.canContact, false); assert.equal(opening.gripStrength, 0);
    assert.equal(opening.plannedLaunchAt, 1000 + ARENA_WRESTLING_MOVE_TIMING.load);
    assert.ok(opening.plannedContactAt > opening.plannedLaunchAt + 1000, 'the runner needs a real runway before the planted grip');
    const actual = { ...window(kind), launchAt: opening.plannedLaunchAt };
    let previous = arenaWrestlingMoveTargets(actual, actual.launchAt, center, initial, side);
    for (let elapsed = actual.launchAt + 16; elapsed <= opening.plannedContactAt; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(actual, elapsed, center, initial, side);
      assert.deepEqual(frame.driver, initial.driver); assert.deepEqual(frame.driverVelocity, { x: 0, y: 0 });
      assert.ok(distance(frame.victim, previous.victim) / .016 <= ARENA_CHARGE_SPEED + 1e-6);
      assert.equal(frame.victimPose, 'run'); assert.equal(frame.victimHeight, 0); assert.equal(frame.victimEyesClosed, false);
      if (elapsed <= opening.counterReadyAt) {
        assert.equal(frame.driverPose, 'guard'); assert.equal(frame.gripStrength, 0); assert.equal(frame.canContact, false);
      } else assert.ok(frame.gripStrength >= 0 && frame.gripStrength <= 1);
      previous = frame;
    }
    const arrival = arenaWrestlingMoveTargets(actual, opening.plannedContactAt, center, initial, side);
    assert.ok(distance(arrival.victim, initial.driver) <= 42.001, 'the incoming body reaches normal gripping distance');
    assert.equal(arrival.canContact, true); assert.equal(arrival.gripStrength, 1);
  }
});

test('an uncontacted dropkick finishes its finite jump and lands inside instead of hovering', () => {
  for (const side of [-1, 1]) {
    const values = launched('dropkick', side); let previous, peak = 0;
    for (let elapsed = 1000; elapsed <= values.opening.requiredEndAt + 32; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial, side);
      if (previous) assert.ok(distance(frame.driver, previous.driver) / .016 <= 240 + 1e-6, 'approach and aerial travel keep the normal motion cap');
      peak = Math.max(peak, frame.driverHeight); previous = frame;
    }
    assert.ok(peak > 53.9 && peak <= 54);
    assert.equal(previous.driverHeight, 0); assert.equal(previous.driverPose, 'guard'); assert.equal(previous.missed, true);
    assert.ok(inside(previous.driver)); assert.equal(previous.canRelease, false);
  }
});

test('a dropkick carries its running speed through takeoff without a planted preparation pause', () => {
  for (const side of [-1, 1]) {
    const values = launched('dropkick', side), at = values.actual.launchAt, delta = .01;
    const before = arenaWrestlingMoveTargets(values.actual, at - delta, center, values.initial, side);
    const takeoff = arenaWrestlingMoveTargets(values.actual, at, center, values.initial, side);
    const after = arenaWrestlingMoveTargets(values.actual, at + delta, center, values.initial, side);
    assert.equal(before.driverPose, 'run'); assert.equal(takeoff.driverPose, 'dropkick');
    assert.ok(distance(before.driver, takeoff.driver) < .002);
    assert.ok(Math.hypot(before.driverVelocity.x, before.driverVelocity.y) > ARENA_CHARGE_SPEED - .1);
    assert.ok(distance(before.driverVelocity, after.driverVelocity) < .01, 'the first airborne frame retains the real incoming horizontal tangent');
    for (const age of [-100, -50, -16, 0, 16, 50, 100]) {
      const frame = arenaWrestlingMoveTargets(values.actual, at + age, center, values.initial, side);
      assert.ok(Math.hypot(frame.driverVelocity.x, frame.driverVelocity.y) > ARENA_CHARGE_SPEED * (170 / 190), 'the last running strides and initial jump cannot stop near the opponent');
    }
  }
});

test('a quantized dropkick carries the remainder of its running stride into the first 16 or 50 ms airborne frame', () => {
  for (const side of [-1, 1]) for (const delta of [16, 50]) {
    const initial = origins('dropkick', side), pending = window('dropkick');
    const opening = arenaWrestlingMoveTargets(pending, pending.start, center, initial, side);
    const actualTakeoff = Math.ceil(opening.plannedLaunchAt / delta) * delta;
    const priorAt = actualTakeoff - delta;
    const before = arenaWrestlingMoveTargets(pending, priorAt, center, initial, side);
    initial.launchDriver = arenaWrestlingMoveTargets(pending, actualTakeoff, center, initial, side).driver;
    const recorded = { ...pending, launchAt: actualTakeoff, plannedLaunchAt: opening.plannedLaunchAt, plannedContactAt: opening.plannedContactAt };
    const after = arenaWrestlingMoveTargets(recorded, actualTakeoff, center, initial, side);
    const rootSpeed = distance(before.driver, after.driver) * 1000 / delta;
    assert.ok(rootSpeed > ARENA_CHARGE_SPEED * (180 / 190) && rootSpeed < ARENA_CHARGE_SPEED * (215 / 190), 'late event sampling advances the first airborne root instead of discarding the end of a running stride');
    assert.ok(after.dropkickProgress > 0 && after.driverHeight > 0, 'the first visible jump contains the fractional airborne time');
    assert.equal(after.landingAt, opening.plannedLaunchAt + ARENA_WRESTLING_MOVE_TIMING.jump, 'landing follows the continuous flight clock');
  }
});

test('both painted dropkick soles can reach the actual chest during the bounded contact window', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const values = launched('dropkick', side), victim = fighter((index + 3) % 10, { ...values.initial.victim, facing: -side });
    const rig = sampleArenaFighterContacts(victim, 1000), target = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 + victim.scale * 5 };
    values.initial.target = target; values.initial.contactTargets = [{ x: target.x, y: target.y - 6 }, { x: target.x, y: target.y + 6 }];
    let contacted = false;
    for (let elapsed = values.actual.launchAt + 16; elapsed < values.opening.landingAt; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial, side);
      if (!frame.canContact || frame.feetStrength < .9) continue;
      const actor = fighter(index, { ...frame.driver, y: frame.driver.y - frame.driverHeight, angle: frame.driverAngle, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, suspension: frame.driverSuspension, dropkickProgress: frame.dropkickProgress, footTargets: frame.footTargets, feetStrength: frame.feetStrength });
      const feet = sampleArenaFighterContacts(actor, elapsed).feet;
      if (feet.every((foot, leg) => distance(foot, frame.footTargets[leg]) < 7)) { contacted = true; break; }
    }
    assert.ok(contacted, `${side}/${index}: both fixed-length painted legs must be able to reach the real chest`);
  }
});

test('the solo clothesline strikes the real neck with its extended middle arm before the body passes', () => {
  const segmentGap = (point, from, to) => { const dx = to.x - from.x, dy = to.y - from.y, p = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy))); return distance(point, { x: from.x + dx * p, y: from.y + dy * p }); };
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const values = launched('clothesline', side), victim = fighter((index + 3) % 10, { ...values.initial.victim, facing: -side });
    const rig = sampleArenaFighterContacts(victim, 1000);
    const head = { x: (rig.headSides[0].x + rig.headSides[1].x) / 2, y: (rig.headSides[0].y + rig.headSides[1].y) / 2 };
    const shoulders = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 };
    const neck = { x: head.x + (shoulders.x - head.x) * .65, y: head.y + (shoulders.y - head.y) * .65 };
    values.initial.target = neck; let touched = false;
    // Search in time order so a later backward neck hook cannot substitute
    // for the first collision of the flying, already extended arm.
    for (let elapsed = values.actual.launchAt; elapsed < values.opening.requiredEndAt; elapsed += 2) {
      const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial, side);
      if (!frame.canContact || frame.clotheslineStrength <= .75) continue;
      const actor = fighter(index, { ...frame.driver, y: frame.driver.y - frame.driverHeight, angle: frame.driverAngle, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, suspension: frame.driverSuspension, dropkickProgress: frame.dropkickProgress, clotheslineArm: 1, clotheslineTarget: frame.clotheslineTarget, clotheslineStrength: frame.clotheslineStrength, clotheslineInner: frame.clotheslineInner });
      const contact = sampleArenaFighterContacts(actor, elapsed);
      const shoulder = contact.shoulders[1], elbow = contact.elbows[1], hand = contact.hands[1];
      const upper = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y }, lower = { x: hand.x - elbow.x, y: hand.y - elbow.y };
      const bend = Math.abs(Math.atan2(upper.x * lower.y - upper.y * lower.x, upper.x * lower.x + upper.y * lower.y));
      const upperInside = { x: shoulder.x + upper.x * .5, y: shoulder.y + upper.y * .5 };
      const lowerInside = { x: elbow.x + lower.x * .45, y: elbow.y + lower.y * .45 };
      if (Math.min(segmentGap(neck, upperInside, elbow), segmentGap(neck, elbow, lowerInside)) < 8 && distance(neck, hand) > 12) {
        assert.ok(bend <= .3, `${side}/${index}: the arm is extended rather than hooked around the neck`);
        assert.ok(side * (hand.x - neck.x) > 10, `${side}/${index}: the fist continues beyond the middle-arm collision`);
        assert.ok(side * (contact.waist.x - neck.x) < 1, `${side}/${index}: the middle arm strikes before the torso passes the neck`);
        assert.ok(frame.driverHeight > 20 && frame.driverSuspension === 1, 'the neck collision happens during the same flying attack');
        assert.ok(Math.abs(distance(contact.shoulders[1], contact.elbows[1]) - 11 * actor.scale) < .001);
        assert.ok(Math.abs(distance(contact.elbows[1], contact.hands[1]) - 10.5 * actor.scale) < .001);
        touched = true; break;
      }
    }
    assert.ok(touched, `${side}/${index}: the extended middle arm crosses the painted neck while the fist stays beyond it`);
  }
});

test('a powerbomb establishes both actual waist grips before accepting and lifting the weight', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const values = launched('powerbomb', side), at = values.opening.plannedContactAt;
    const frame = arenaWrestlingMoveTargets(values.actual, at, center, values.initial, side);
    const victim = fighter((index + 3) % 10, { ...frame.victim, facing: frame.victimFacing, pose: frame.victimPose });
    const contacts = sampleArenaFighterContacts(victim, at);
    const targets = [contacts.waist, { x: contacts.waist.x + frame.side * 6, y: contacts.waist.y + 3 }];
    const actor = fighter(index, { ...frame.driver, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, powerbombLoad: 0, powerbombLift: 0, powerbombDown: 0, gripMode: 'waist', gripTarget: targets[1], secondaryGripTarget: targets[0], gripStrength: 1, gripLocked: true });
    const hands = sampleArenaFighterContacts(actor, at).hands;
    hands.forEach((hand, arm) => assert.ok(distance(hand, targets[arm]) < 7, 'both complete arms meet the real waist before any rise'));
    assert.equal(frame.victimHeight, 0); assert.equal(frame.victimSlam, undefined); assert.equal(frame.canRelease, false);
  }
});

test('a back body drop catches the running loser and flips only that body behind the inside catcher', () => {
  for (const side of [-1, 1]) {
    const values = contacted('backbodydrop', side), end = values.contactAt + ARENA_WRESTLING_MOVE_TIMING.backFlip;
    let peak = 0;
    for (let elapsed = values.contactAt; elapsed <= end; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial, side);
      assert.deepEqual(frame.driver, values.initial.driver); peak = Math.max(peak, frame.victimHeight);
    }
    const ready = arenaWrestlingMoveTargets(values.actual, end, center, values.initial, side);
    assert.ok(ready.side * (ready.victim.x - ready.driver.x) < -60, 'the incoming loser crosses above the hips to the opposite side');
    assert.ok(peak > 115 && peak <= 116, 'the received body clears the catcher before the overhead turn'); assert.ok(Math.abs(ready.victimAngle) > 1.6); assert.ok(Math.abs(ready.victimHeight) < .001); assert.equal(ready.victimSlam.slump, 1); assert.equal(ready.canRelease, false, 'landing the received body is not an automatic exit');
  }
});

test('every receiving slam stays ordinary until the real runner has covered half the runway', () => {
  for (const kind of ['powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam']) for (const side of [-1, 1]) for (const gap of [150, 225, 300]) {
    const initial = { driver: { x: 500 + side * 25, y: 416 }, victim: { x: 500 + side * (25 - gap), y: 416 } };
    const pending = window(kind), opening = arenaWrestlingMoveTargets(pending, pending.start, center, initial, side);
    const actual = { ...pending, launchAt: opening.plannedLaunchAt };
    const launch = arenaWrestlingMoveTargets(actual, actual.launchAt, center, initial, side);
    initial.launchVictim = { ...launch.victim };
    const arriving = arenaWrestlingMoveTargets(actual, opening.plannedContactAt, center, initial, side);
    const runway = distance(launch.victim, arriving.victim);
    let preparationSeen = false;
    for (let elapsed = actual.launchAt; elapsed <= opening.plannedContactAt; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(actual, elapsed, center, initial, side);
      const travelled = distance(frame.victim, launch.victim);
      assert.deepEqual(frame.driver, initial.driver, 'the defender does not manufacture the counter by approaching');
      if (travelled <= runway / 2) {
        assert.equal(frame.driverPose, 'guard'); assert.equal(frame.gripStrength, 0); assert.equal(frame.backBodyProgress, 0);
        assert.equal(frame.counterPreparation, 0); assert.equal(frame.canContact, false);
        assert.equal(frame.stage, kind === 'spinebuster' || kind === 'scoopslam' ? 'attack' : 'approach');
      } else preparationSeen ||= frame.counterPreparation > 0;
    }
    assert.equal(preparationSeen, true);
    const halfway = arenaWrestlingMoveTargets(actual, opening.counterReadyAt, center, initial, side);
    assert.ok(Math.abs(distance(halfway.victim, launch.victim) - runway / 2) < 1e-8, 'the preparation clock corresponds to physical half distance');
    const captured = { ...actual, counterReadyAt: opening.counterReadyAt, plannedLaunchAt: opening.plannedLaunchAt, plannedContactAt: opening.plannedContactAt };
    for (const elapsed of [opening.counterReadyAt - 1, opening.counterReadyAt + 80, opening.plannedContactAt]) {
      assert.ok(Math.abs(arenaWrestlingMoveTargets(captured, elapsed, center).counterPreparation - arenaWrestlingMoveTargets(actual, elapsed, center, initial, side).counterPreparation) < 1e-12, 'story consumers use the saved real runway clock without reconstructing another layout');
    }
    const delayed = { ...captured, launchAt: captured.launchAt + 280 };
    assert.equal(arenaWrestlingMoveTargets(delayed, opening.counterReadyAt + 279, center).counterPreparation, 0, 'a delayed real launch delays the hidden counter preparation equally');
  }
});

test('a received hip throw leaves a readable stunned beat and takes the ankle weight before the final stroke', () => {
  for (const side of [-1, 1]) {
    const values = contacted('backbodydrop', side), timing = ARENA_BACK_BODY_DROP_TIMING;
    const floor = arenaWrestlingMoveTargets(values.actual, values.contactAt + ARENA_WRESTLING_MOVE_TIMING.backFlip, center, values.initial, side);
    for (const age of [0, 200, timing.groggy - 1]) {
      const frame = arenaWrestlingMoveTargets(values.actual, floor.floorAt + age, center, values.initial, side);
      assert.equal(frame.stage, 'groggy'); assert.equal(frame.victimPose, 'stunned'); assert.equal(frame.victimHeight, 0); assert.equal(frame.canGrabAnkle, false);
    }
    const grabAt = floor.pickupReadyAt + ARENA_WRESTLING_MOVE_TIMING.ankleReach;
    assert.equal(arenaWrestlingMoveTargets(values.actual, grabAt - 1, center, values.initial, side).canGrabAnkle, false);
    const held = { ...values.actual, ankleGripAt: grabAt };
    for (const age of [0, 80, timing.ankleLoad - 1]) {
      const frame = arenaWrestlingMoveTargets(held, grabAt + age, center, values.initial, side);
      assert.equal(frame.stage, 'ankle-grip'); assert.equal(frame.driverPose, 'grapple'); assert.equal(frame.victimHeight, 0);
      assert.equal(frame.victimPose, 'stunned'); assert.equal(frame.canRelease, false);
      assert.ok(frame.ankleThrowProgress >= 0 && frame.ankleThrowProgress < 1, 'the actual low ankle hold gradually raises the caster while its rotation begins');
    }
    const spinning = arenaWrestlingMoveTargets(held, grabAt + timing.ankleLoad + timing.ankleSpin / 2, center, values.initial, side);
    assert.equal(spinning.stage, 'spin'); assert.ok(Math.abs(spinning.pivotTurn) > Math.PI * .9 && Math.abs(spinning.pivotTurn) < Math.PI * 1.1, 'the held body is halfway around during the middle of the swing'); assert.equal(spinning.ankleSpin.gripBoth, true); assert.equal(spinning.canRelease, false);
    const stroke = arenaWrestlingMoveTargets(held, grabAt + timing.ankleLoad + timing.ankleSpin - 16, center, values.initial, side);
    assert.equal(stroke.stage, 'toss'); assert.ok(stroke.ankleThrowProgress > .99); assert.equal(stroke.canRelease, false);
    const complete = arenaWrestlingMoveTargets(held, grabAt + timing.ankleLoad + timing.ankleSpin + timing.ankleThrow, center, values.initial, side);
    assert.ok(Math.abs(Math.abs(complete.pivotTurn) - Math.PI * 2) < 1e-8); assert.equal(complete.canRelease, true); assert.ok(inside(complete.driver));
    assert.equal(complete.requiredReleaseAt, grabAt + timing.ankleLoad + timing.ankleSpin, 'the recorded two-ankle hold owns the load and full revolution, then releases immediately');
    assert.ok(Math.abs(complete.ankleAngularVelocity) > 4.8, 'the full-turn release keeps its angular momentum');
    assert.ok(Math.abs(Math.cos(complete.ankleSpin.orbit)) < 1e-8 && Math.sin(complete.ankleSpin.orbit) < -.999, 'the head-up release phase gives the supported mass a horizontal tangent');
  }
});

test('all two-ankle finishes begin turning during the pickup and retain velocity into the full swing', () => {
  for (const kind of ['clothesline', 'spinebuster', 'powerbomb', 'backbodydrop', 'scoopslam']) for (const side of [-1, 1]) {
    const values = contacted(kind, side), pickup = arenaWrestlingMoveTargets(values.actual, values.contactAt, center, values.initial, side).pickupReadyAt;
    const held = { ...values.actual, ankleGripAt: pickup + 240 }, at = age => arenaWrestlingMoveTargets(held, held.ankleGripAt + age, center, values.initial, side);
    const first = at(0), early = at(160), loaded = at(520);
    assert.equal(Math.abs(first.pivotTurn), 0); assert.equal(Math.abs(first.ankleOrbitVelocity), 0);
    assert.ok(early.ankleSpin.weight > 0 && early.ankleSpin.weight < 1 && Math.abs(early.pivotTurn) > .02, 'both held feet rise while the caster is already turning');
    assert.ok(Math.abs(loaded.pivotTurn) > .3 && Math.abs(loaded.ankleOrbitVelocity) > 1, 'finishing the lift never leaves a motionless body');
    for (let age = 505; age <= 535; age++) {
      const before = at(age - .5), after = at(age + .5), current = at(age);
      const actualVelocity = (after.pivotTurn - before.pivotTurn) * 1000;
      assert.ok(Math.abs(actualVelocity - current.ankleOrbitVelocity) < .003, 'the painted turn and release derivative remain connected across the former pause');
      assert.ok(Math.abs(after.pivotTurn) > Math.abs(before.pivotTurn), 'each pickup-to-swing frame keeps moving in the same direction');
    }
    const released = at(first.requiredReleaseAt - held.ankleGripAt);
    assert.ok(Math.abs(Math.abs(released.pivotTurn) - Math.PI * 2) < 1e-8);
    assert.ok(released.canRelease && released.ankleSpin.gripBoth, 'the continuous pickup still completes exactly one held revolution');
  }
});

test('the two-foot revolution preserves its captured pickup facing and cannot start before the real ankle clock', () => {
  for (const side of [-1, 1]) {
    const values = contacted('backbodydrop', side);
    const floor = arenaWrestlingMoveTargets(values.actual, values.contactAt + ARENA_WRESTLING_MOVE_TIMING.backFlip, center, values.initial, side);
    const grabAt = floor.pickupReadyAt + 420;
    const initial = { ...values.initial, ankleFacing: -side, ankleOrbit: side * .21,
      ankleDriver: { x: 500 + side * 30, y: 416 }, pickupDriver: { x: 500 - side * 25, y: 416 },
      ankles: [{ x: 500 + side * 10, y: 374 }, { x: 500 + side * 12, y: 396 }] };
    const held = { ...values.actual, ankleGripAt: grabAt };
    for (const elapsed of [floor.pickupReadyAt, grabAt - 1]) {
      const frame = arenaWrestlingMoveTargets(held, elapsed, center, initial, side);
      assert.equal(frame.driverFacing, initial.ankleFacing, 'approaching the actual ankles cannot reverse the captured material side');
      assert.equal(frame.ankleSpin, undefined); assert.equal(frame.pivotTurn, undefined); assert.equal(frame.canRelease, false);
    }
    for (const age of [0, 520, 1000, 1670, 2400]) {
      const frame = arenaWrestlingMoveTargets(held, grabAt + age, center, initial, side);
      assert.deepEqual(frame.driver, initial.ankleDriver, 'a supported revolution keeps its planted pivot inside the arena');
      assert.equal(frame.driverFacing, initial.ankleFacing);
      assert.ok(Math.abs(frame.ankleSpin.orbit + Math.PI / 2 - frame.pivotTurn) < 1e-8, 'the horizontal orbit follows one integrated turn instead of a vertical cartwheel');
      assert.equal(frame.ankleSpin.planar, true);
      assert.equal(frame.canRelease, age >= ARENA_BACK_BODY_DROP_TIMING.ankleLoad + ARENA_BACK_BODY_DROP_TIMING.ankleSpin);
    }
    const waiting = arenaWrestlingMoveTargets({ ...held, ankleGripAt: null }, grabAt + 5000, center, initial, side);
    assert.equal(waiting.ankleSpin, undefined); assert.equal(waiting.canRelease, false);
  }
});

test('an incoming waist catch uses the existing overhead slam and waits for a real ankle pickup', () => {
  for (const side of [-1, 1]) {
    const values = contacted('powerbomb', side), timing = ARENA_POWERBOMB_TIMING;
    const at = age => arenaWrestlingMoveTargets(values.actual, values.contactAt + age, center, values.initial, side);
    const load = at(timing.load / 2);
    assert.equal(load.stage, 'contact'); assert.equal(load.victimHeight, 0); assert.equal(load.gripMode, 'waist'); assert.equal(load.gripStrength, 1);
    const raised = at(timing.load + timing.lift + timing.hold / 2);
    assert.equal(raised.stage, 'turn'); assert.equal(raised.powerbombLift, 1); assert.equal(raised.powerbombDown, 0);
    assert.equal(raised.victimEyesClosed, false, 'the incoming player stays conscious while being caught and lifted');
    assert.equal(raised.driverPose, 'overhead'); assert.equal(raised.overheadRaise, 1);
    assert.equal(raised.victimPose, 'airborne'); assert.equal(raised.victimHeight, 100); assert.equal(Math.abs(raised.victimAngle), 0);
    assert.equal(raised.powerbombVictim, undefined); assert.equal(raised.victimCarryStretch, undefined); assert.equal(raised.powerbombSupport, undefined, 'the old seated waist curve cannot override the reused overhead body');
    for (const age of [timing.load, timing.load + timing.lift / 2, timing.load + timing.lift, timing.load + timing.lift + timing.hold, timing.load + timing.lift + timing.hold + timing.slam / 2]) {
      const frame = at(age), motion = arenaOverheadSlamMotion(frame.driverPhase, frame.side);
      assert.equal(frame.victimHeight, motion.height); assert.equal(frame.victimAngle, motion.angle);
      assert.equal(frame.victimSuspension, motion.suspension); assert.deepEqual(frame.victimSlam, motion.victimSlam);
      assert.equal(frame.overheadRaise, motion.overheadRaise); assert.equal(frame.driverPose, 'overhead');
      assert.equal(frame.gripStrength, motion.gripping ? 1 : 0, 'the reused downward stroke releases the waist at its original phase');
    }
    const floorAt = timing.load + timing.lift + timing.hold + timing.slam;
    assert.equal(at(floorAt - 1).victimEyesClosed, false, 'the eyes close on floor impact, not while accepting the rush');
    const floor = at(floorAt);
    assert.equal(floor.victimPose, 'stunned'); assert.equal(floor.victimHeight, 0); assert.equal(floor.victimSlam.slump, 0); assert.equal(floor.victimEyesClosed, true);
    assert.equal(floor.slamImpact, 1, 'the shoulder first hits the sand before the tucked body relaxes');
    assert.equal(at(floorAt + timing.recover).victimSlam.slump, 1, 'the existing floor relaxation completes before ankle pickup');
    assert.ok(Math.abs(floor.victimAngle) > 1.4); assert.equal(floor.canRelease, false);
    const pending = at(floorAt + timing.recover + timing.groggy + 2000);
    assert.equal(pending.ankleGripAt, null); assert.equal(pending.canRelease, false); assert.equal(pending.victimHeight, 0);
    const held = { ...values.actual, ankleGripAt: pending.pickupReadyAt + 600 };
    const end = held.ankleGripAt + timing.ankleLoad + timing.ankleSpin;
    const finish = arenaWrestlingMoveTargets(held, end, center, values.initial, side);
    assert.equal(finish.canRelease, true); assert.ok(Math.abs(Math.abs(finish.pivotTurn) - Math.PI * 2) < 1e-8);
    assert.ok(Math.abs(Math.cos(finish.ankleSpin.orbit)) < 1e-8, 'the shared full-turn finish releases horizontally');
  }
});

test('all five floor finishes reserve the loser until an actual two-ankle hold completes one full turn', () => {
  for (const kind of ['clothesline', 'spinebuster', 'powerbomb', 'backbodydrop', 'scoopslam']) for (const side of [-1, 1]) {
    const values = contacted(kind, side), grabAt = firstPickupClock(values, side);
    const initialFloor = arenaWrestlingMoveTargets(values.actual, grabAt, center, values.initial, side);
    assert.equal(initialFloor.victimHeight, 0); assert.equal(initialFloor.victimPose, 'stunned'); assert.equal(initialFloor.victimSlam.slump, 1);
    assert.equal(initialFloor.gripMode, 'ankle'); assert.equal(initialFloor.canGrabAnkle, true); assert.equal(initialFloor.canRelease, false);
    assert.equal(arenaWrestlingMoveTargets(values.actual, grabAt - 1, center, values.initial, side).canGrabAnkle, false, 'the hold cannot start before the actual completed walk and reach');
    assert.equal(arenaWrestlingMoveTargets({ ...values.actual, releaseAt: undefined }, grabAt, center, values.initial, side).releaseAt, null);
    const held = { ...values.actual, ankleGripAt: grabAt };
    const grip = arenaWrestlingMoveTargets(held, held.ankleGripAt, center, values.initial, side);
    const releaseReadyAt = grip.requiredReleaseAt;
    const toss = arenaWrestlingMoveTargets(held, releaseReadyAt, center, values.initial, side);
    assert.equal(grip.stage, 'ankle-grip'); assert.equal(grip.victimHeight, 0);
    assert.equal(toss.stage, 'toss'); assert.equal(toss.victimHeight, 0); assert.equal(toss.canRelease, true);
    assert.ok(toss.ankleSpin?.gripBoth && Math.abs(Math.abs(toss.pivotTurn) - Math.PI * 2) < 1e-8, 'the snapshot supplies the real release root at the end of the full two-ankle rotation');
    assert.equal(arenaWrestlingMoveTargets(held, releaseReadyAt - 1, center, values.initial, side).canRelease, false);
    assert.ok(inside(toss.driver), `${kind}: the two-hand throw leaves its caster on the sand`);
  }
});

test('a flying clothesline falls in opposite orientations, rises before the ankle hold and finishes with a planted complete revolution', () => {
  for (const side of [-1, 1]) {
    const values = contacted('clothesline', side), fallAt = values.contactAt + 300;
    const falling = arenaWrestlingMoveTargets(values.actual, fallAt, center, values.initial, side);
    assert.equal(falling.stage, 'fall');
    assert.ok(-side * falling.driverAngle > 1 && side * falling.victimAngle > 1, 'the airborne driver passes the victim and the collision brings their bodies down in opposite orientations');
    assert.ok(falling.driverSlam.slump > .8 && falling.victimSlam.slump > .8);
    const floor = arenaWrestlingMoveTargets(values.actual, falling.floorAt, center, values.initial, side);
    assert.equal(floor.victimEyesClosed, true); assert.equal(floor.slamImpact, 1);
    assert.ok(Math.abs(distance(floor.driver, floor.victim) - 68) < .001, 'the flying collision carries the fallen driver well past the opponent');
    const standing = arenaWrestlingMoveTargets(values.actual, falling.pickupReadyAt, center, values.initial, side);
    assert.equal(standing.driverAngle, 0); assert.equal(standing.driverSlam, undefined);
    assert.equal(standing.victimPose, 'stunned'); assert.equal(standing.victimHeight, 0);
    const grabAt = standing.pickupReadyAt + 240, pending = arenaWrestlingMoveTargets(values.actual, grabAt + 3000, center, values.initial, side);
    assert.equal(pending.stage, 'ankle-approach'); assert.equal(pending.canRelease, false);
    assert.deepEqual(pending.victim, standing.victim, 'without actual ankle contact, the unconscious body cannot start rotating');
    values.initial.ankleDriver = { ...pending.driver }; values.initial.ankles = pending.gripTargets;
    const held = { ...values.actual, ankleGripAt: grabAt };
    const duration = ARENA_SCOOP_FINISH_TIMING.ankleLoad + ARENA_SCOOP_FINISH_TIMING.ankleSpin;
    for (let age = 0; age < duration; age += 16) {
      const frame = arenaWrestlingMoveTargets(held, grabAt + age, center, values.initial, side);
      assert.deepEqual(frame.driver, values.initial.ankleDriver, 'the survivor turns around its inside planted pivot');
      assert.equal(frame.victimPose, 'stunned'); assert.equal(frame.canRelease, false);
      assert.equal(frame.ankleSpin.planar, true); assert.equal(frame.ankleSpin.gripBoth, true);
    }
    const ready = arenaWrestlingMoveTargets(held, grabAt + duration, center, values.initial, side);
    assert.equal(ready.canRelease, true); assert.ok(inside(ready.driver));
    assert.ok(Math.abs(Math.abs(ready.pivotTurn) - Math.PI * 2) < 1e-8);
    assert.equal(ready.dragEndAt, undefined, 'the solo collision uses the same full ankle spin as the receiving counters');
  }
});

test('a spinebuster overlaps its supported lift with the backward slam, then reserves the actual complete ankle revolution', () => {
  const values = contacted('spinebuster'), timing = ARENA_SPINEBUSTER_TIMING;
  const floorAt = values.contactAt + timing.load + timing.lift + timing.slam;
  const loading = arenaWrestlingMoveTargets(values.actual, values.contactAt + timing.load * .7 - 1, center, values.initial);
  assert.equal(loading.victimHeight, 0); assert.equal(loading.stage, 'contact');
  const rising = arenaWrestlingMoveTargets(values.actual, values.contactAt + timing.load - 1, center, values.initial);
  assert.ok(rising.spineLoad > .99 && rising.spineLift > 0 && rising.victimHeight > 0, 'the knees start standing before the waist load stops');
  const lifted = arenaWrestlingMoveTargets(values.actual, values.contactAt + timing.load + timing.lift, center, values.initial);
  assert.ok(lifted.victimHeight > 60 && lifted.spineDown > 0 && lifted.driverAngle !== 0, 'the lifted receiver is already falling backward rather than stopping with a held body');
  assert.equal(lifted.victimPose, 'carried');
  const waiting = arenaWrestlingMoveTargets(values.actual, floorAt + 1000, center, values.initial);
  assert.equal(waiting.victimHeight, 0); assert.equal(waiting.victimSlam.slump, 1); assert.equal(waiting.canGrabAnkle, true); assert.equal(waiting.canRelease, false);
  assert.equal(waiting.frontKick, undefined); assert.equal(waiting.canKick, false);
  assert.equal(arenaWrestlingMoveTargets({ ...values.actual, releaseAt: undefined }, floorAt + 1000, center, values.initial).releaseAt, null);
  const recorded = { ...values.actual, ankleGripAt: floorAt + 1000 };
  const gripped = arenaWrestlingMoveTargets(recorded, recorded.ankleGripAt, center, values.initial);
  assert.equal(gripped.canRelease, false); assert.equal(gripped.stage, 'ankle-grip');
  assert.equal(gripped.requiredReleaseAt, recorded.ankleGripAt + ARENA_SCOOP_FINISH_TIMING.ankleLoad + ARENA_SCOOP_FINISH_TIMING.ankleSpin);
  assert.equal(arenaWrestlingMoveTargets(recorded, gripped.requiredReleaseAt - 1, center, values.initial).canRelease, false);
  const tossing = arenaWrestlingMoveTargets(recorded, gripped.requiredReleaseAt, center, values.initial);
  assert.equal(tossing.canRelease, true); assert.equal(tossing.ankleThrowProgress, 1);
  assert.ok(Math.abs(Math.abs(tossing.pivotTurn) - Math.PI * 2) < 1e-8);
});

test('a spinebuster walks to both actual ankles after the supported floor slam without accelerating the pickup', () => {
  const values = contacted('spinebuster'), timing = ARENA_SPINEBUSTER_TIMING, floorAt = values.contactAt + timing.load + timing.lift + timing.slam;
  values.initial.contactDriver = { x: 525, y: 416 }; values.initial.contactVictim = { x: 450, y: 416 };
  values.initial.ankles = [{ x: 366, y: 412 }, { x: 364, y: 403 }];
  let previous = arenaWrestlingMoveTargets(values.actual, floorAt, center, values.initial), ready;
  const finishingSlam = arenaWrestlingMoveTargets(values.actual, floorAt - 1, center, values.initial);
  assert.ok(distance(previous.driver, finishingSlam.driver) < .1, 'the ankle approach retains the receiver\'s actual supported-slam ground root');
  assert.equal(previous.driverPose, 'recover'); assert.equal(previous.frontKick, undefined); assert.equal(previous.canGrabAnkle, false);
  assert.ok(previous.driverSlam.slump > .99 && Math.abs(previous.driverAngle) > 1.4, 'both received bodies reach the sand before the receiver rises');
  assert.equal(previous.pickupReadyAt, floorAt + timing.recover, 'the grounded receiver has a complete rising beat before approaching the ankles');
  for (let elapsed = floorAt + 16; elapsed <= floorAt + 1200; elapsed += 16) {
    const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial);
    assert.ok(distance(frame.driver, previous.driver) / .016 <= 160 + 1e-6);
    assert.equal(frame.canRelease, false); assert.equal(frame.frontKick, undefined);
    if (frame.gripMode === 'ankle') { assert.equal(frame.driverFacing, (values.initial.ankles[0].x + values.initial.ankles[1].x) / 2 >= frame.driver.x ? 1 : -1); assert.equal(frame.victimHeight, 0); }
    if (frame.canGrabAnkle) { ready = frame; break; }
    previous = frame;
  }
  assert.ok(ready); assert.equal(ready.ankleApproach, 1); assert.deepEqual(ready.gripTargets, values.initial.ankles);
  assert.ok(ready.requiredReleaseAt > floorAt + 1000, 'the release reservation includes the complete actual pickup, ankle load and revolution');
});

test('the received spine waist keeps moving through the lifted key pose and drives down into its backward floor impact', () => {
  for (const side of [-1, 1]) {
    const values = contacted('spinebuster', side), timing = ARENA_SPINEBUSTER_TIMING;
    values.initial.spineWaist = { x: values.initial.contactVictim.x, y: 370 };
    values.initial.spineFloorWaist = { x: values.initial.driver.x - values.opening.side * 87, y: 397 };
    const delta = .01;
    for (const age of [timing.load * .7, timing.load + timing.lift]) {
      const at = values.contactAt + age;
      const before = arenaWrestlingMoveTargets(values.actual, at - delta, center, values.initial, side).spineSupport;
      const current = arenaWrestlingMoveTargets(values.actual, at, center, values.initial, side).spineSupport;
      const after = arenaWrestlingMoveTargets(values.actual, at + delta, center, values.initial, side).spineSupport;
      const arriving = { x: (current.x - before.x) * 1000 / delta, y: (current.y - before.y) * 1000 / delta };
      const leaving = { x: (after.x - current.x) * 1000 / delta, y: (after.y - current.y) * 1000 / delta };
      assert.ok(distance(arriving, leaving) < .05, 'passing the lifted body into the backward fall preserves the supported waist tangent');
      assert.ok(Math.hypot(arriving.x, arriving.y) > 15, 'the caster cannot pause with the received body at the transition');
    }
    const floorAt = values.contactAt + timing.load + timing.lift + timing.slam;
    for (const step of [16, 50]) {
      const before = arenaWrestlingMoveTargets(values.actual, floorAt - step, center, values.initial, side);
      const floor = arenaWrestlingMoveTargets(values.actual, floorAt, center, values.initial, side);
      assert.ok((floor.spineSupport.y - before.spineSupport.y) * 1000 / step > 300, 'the weight reaches the sand with a downward impact rather than being gently lowered');
      assert.equal(before.victimEyesClosed, false); assert.equal(floor.victimEyesClosed, true);
      assert.ok(floor.driverSuspension > .99 && Math.abs(floor.driverAngle) > 1.4, 'the receiver follows the held opponent onto its own back');
    }
  }
});

test('an incoming scoop cradles the chest, pivots the hip and lands the complete back before its ankle finish', () => {
  const values = contacted('scoopslam'), timing = ARENA_SCOOP_SLAM_TIMING, floorAt = values.contactAt + Object.values(timing).reduce((sum, duration) => sum + duration, 0);
  const loaded = arenaWrestlingMoveTargets(values.actual, values.contactAt + timing.load / 2, center, values.initial);
  assert.equal(loaded.stage, 'contact'); assert.ok(loaded.scoopLoad > 0 && loaded.scoopLoad < 1); assert.equal(loaded.victimHeight, 0);
  const carried = arenaWrestlingMoveTargets(values.actual, values.contactAt + timing.load + timing.lift, center, values.initial);
  assert.equal(carried.victimPose, 'carried'); assert.equal(carried.victimHeight, 124); assert.equal(carried.victimCarryStretch, 1); assert.equal(carried.gripMode, 'cradle');
  assert.ok(Math.abs(carried.victimAngle) >= Math.PI * .3 && Math.abs(carried.victimAngle) < Math.PI / 2, 'the complete back stays cradled diagonally above the receiving head, without a head-first inversion');
  assert.ok(carried.scoopTurn > 0, 'the hips pivot while the knees finish raising the actual load');
  const turned = arenaWrestlingMoveTargets(values.actual, values.contactAt + timing.load + timing.lift + timing.turn, center, values.initial);
  assert.equal(turned.scoopTurn, 1); assert.ok(turned.scoopDown > 0, 'the supported back is already descending as the hip pivot ends'); assert.ok(Math.abs(turned.victimAngle) < Math.PI / 2, 'the head never turns below the feet in an inverted wheel');
  assert.ok(distance(carried.scoopSupport, turned.scoopSupport) > 8);
  const floor = arenaWrestlingMoveTargets(values.actual, floorAt, center, values.initial);
  assert.equal(floor.victimHeight, 0); assert.equal(floor.victimSlam.slump, 1); assert.equal(Math.abs(floor.victimAngle), Math.PI / 2); assert.equal(floor.canRelease, false);
  assert.equal(floor.scoopHeadPivot, undefined); assert.equal(floor.victimCarryStretch, undefined);
  assert.equal(floor.stage, 'recover'); assert.equal(floor.slamImpactAt, floorAt);
  const halfwayUp = arenaWrestlingMoveTargets(values.actual, floorAt + ARENA_SCOOP_RECOVERY_TIMING.stand / 2, center, values.initial);
  assert.equal(halfwayUp.stage, 'recover'); assert.equal(halfwayUp.scoopRecover, .5);
  assert.equal(arenaWrestlingMoveTargets(values.actual, floorAt + ARENA_SCOOP_RECOVERY_TIMING.stand, center, values.initial).stage, 'groggy');
  const beginningReach = arenaWrestlingMoveTargets(values.actual, floor.pickupReadyAt, center, values.initial);
  assert.equal(beginningReach.ankleApproach, 0); assert.equal(beginningReach.canGrabAnkle, false);
  assert.equal(beginningReach.driverPose, 'walk'); assert.equal(beginningReach.gripTargets, undefined, 'the moving caster keeps its arms free until reaching the real toes');
  const arrivedAt = firstPickupClock(values, 1, frame => frame.driverPose === 'drag');
  assert.ok(arrivedAt > floor.pickupReadyAt, 'the recovery is followed by an actual toe-side walk before the low reach begins');
  const midwayReach = arenaWrestlingMoveTargets(values.actual, arrivedAt + ARENA_WRESTLING_MOVE_TIMING.ankleReach / 2, center, values.initial);
  assert.ok(Math.abs(midwayReach.ankleApproach - .5) < 1e-8); assert.equal(midwayReach.canGrabAnkle, false);
  const grabAt = firstPickupClock(values);
  assert.ok(Math.abs(grabAt - arrivedAt - ARENA_WRESTLING_MOVE_TIMING.ankleReach) < .001, 'the full normal-bone reach follows arrival instead of elapsing during the walk');
  assert.equal(arenaWrestlingMoveTargets(values.actual, grabAt, center, values.initial).canGrabAnkle, true, 'only the completed normal-bone reach can establish the two-ankle hold');
  const waitingAt = grabAt + 300, waiting = arenaWrestlingMoveTargets(values.actual, waitingAt, center, values.initial);
  assert.equal(waiting.victimHeight, 0); assert.equal(waiting.gripMode, 'ankle'); assert.equal(waiting.canGrabAnkle, true); assert.equal(waiting.canRelease, false);
  assert.equal(arenaWrestlingMoveTargets({ ...values.actual, releaseAt: undefined }, waitingAt, center, values.initial).releaseAt, null, 'an omitted release clock cannot bypass the actual ankle grip');
  values.initial.ankles = [{ x: waiting.victim.x - 80, y: waiting.victim.y - 4 }, { x: waiting.victim.x - 84, y: waiting.victim.y - 13 }];
  values.initial.ankleDriver = { ...waiting.driver };
  const held = { ...values.actual, ankleGripAt: waitingAt };
  const finishDuration = ARENA_SCOOP_FINISH_TIMING.ankleLoad + ARENA_SCOOP_FINISH_TIMING.ankleSpin;
  assert.equal(arenaWrestlingMoveTargets(held, held.ankleGripAt + finishDuration - 1, center, values.initial).canRelease, false);
  const tossing = arenaWrestlingMoveTargets(held, held.ankleGripAt + finishDuration, center, values.initial);
  assert.equal(tossing.canRelease, true); assert.deepEqual(tossing.driver, values.initial.ankleDriver);
  assert.equal(tossing.victimHeight, 0); assert.equal(tossing.ankleSpin.gripBoth, true); assert.equal(tossing.ankleSpin.weight, 1);
  assert.ok(Math.abs(Math.abs(tossing.pivotTurn) - Math.PI * 2) < 1e-8, 'the supported ankles complete exactly one revolution at release');
});

test('the received scoop keeps waist velocity continuous through the load, chest lift, hip pivot and back impact', () => {
  for (const side of [-1, 1]) {
    const values = contacted('scoopslam', side), timing = ARENA_SCOOP_SLAM_TIMING;
    values.initial.scoopWaist = { x: values.initial.contactVictim.x, y: 370 };
    values.initial.scoopFloorWaist = { x: values.initial.driver.x + values.opening.side * 87, y: 397 };
    values.initial.scoopHeadImpact = { x: 100, y: 416 };
    const offsets = [timing.load, timing.load + timing.lift, timing.load + timing.lift + timing.turn];
    const delta = .01;
    for (const offset of offsets) {
      const at = values.contactAt + offset;
      const before = arenaWrestlingMoveTargets(values.actual, at - delta, center, values.initial, side).scoopSupport;
      const current = arenaWrestlingMoveTargets(values.actual, at, center, values.initial, side).scoopSupport;
      const after = arenaWrestlingMoveTargets(values.actual, at + delta, center, values.initial, side).scoopSupport;
      const arriving = { x: (current.x - before.x) * 1000 / delta, y: (current.y - before.y) * 1000 / delta };
      const leaving = { x: (after.x - current.x) * 1000 / delta, y: (after.y - current.y) * 1000 / delta };
      assert.ok(distance(arriving, leaving) < .05, 'a key pose cannot reset the actual supported waist velocity');
      assert.ok(Math.hypot(arriving.x, arriving.y) > 5, 'the next part of the move continues receiving the body weight');
    }
    const duration = Object.values(timing).reduce((sum, value) => sum + value, 0);
    for (const step of [16, 50]) {
      let previous = arenaWrestlingMoveTargets(values.actual, values.contactAt, center, values.initial, side);
      for (let age = step; age <= duration + ARENA_SCOOP_RECOVERY_TIMING.stand; age += step) {
        const frame = arenaWrestlingMoveTargets(values.actual, values.contactAt + age, center, values.initial, side);
        assert.ok(distance(frame.driver, previous.driver) < step * .13, 'the caster transfers weight through bounded planted steps');
        assert.ok(distance(frame.scoopSupport, previous.scoopSupport) < step * .6, 'a supported hip cannot teleport between separate Bézier paths');
        assert.ok(inside(frame.driver)); assert.ok(Math.abs(frame.victimAngle) <= Math.PI / 2 + 1e-12);
        assert.equal(frame.scoopHeadPivot, undefined, 'the whole back, rather than a previously recorded crown, receives the slam');
        if (age >= duration) {
          assert.ok(distance(frame.scoopSupport, values.initial.scoopFloorWaist) < 1e-9);
          assert.equal(frame.victimCarryStretch, undefined);
        }
        previous = frame;
      }
    }
  }
});

test('a planted rim throw lifts both ankles below the head and sends the feet out first', () => {
  const duration = ARENA_DRAGGED_ANKLE_THROW_TIMING.raise + ARENA_DRAGGED_ANKLE_THROW_TIMING.heave;
  assert.equal(duration, 850, 'the shared low throw is fifteen percent faster than its original 1000ms stroke');
  for (const facing of [-1, 1]) {
    const origins = { driver: { x: 500, y: 416 }, ankles: [{ x: 500 + facing * 32, y: 411 }, { x: 500 + facing * 30, y: 400 }], orbit: facing === 1 ? 0 : Math.PI, facing, direction: -facing };
    const saved = structuredClone(origins), first = arenaAnkleRimThrowTargets(0, origins);
    assert.deepEqual(first.gripTargets, origins.ankles); assert.equal(first.ankleSpin.weight, 0);
    const high = arenaAnkleRimThrowTargets(ARENA_DRAGGED_ANKLE_THROW_TIMING.raise, origins);
    const midpoint = frame => ({ x: (frame.gripTargets[0].x + frame.gripTargets[1].x) / 2, y: (frame.gripTargets[0].y + frame.gripTargets[1].y) / 2 });
    assert.equal(high.overheadRaise, 0); assert.equal(midpoint(high).y, origins.driver.y - 52);
    assert.equal(high.ankleSpin.orbit, origins.orbit, 'raising the ankles keeps the dragged body pointing the same way');
    assert.equal(high.ankleSpin.planar, false); assert.equal(high.ankleSpin.gripBoth, true);
    const before = arenaAnkleRimThrowTargets(duration - .1, origins), released = arenaAnkleRimThrowTargets(duration, origins);
    assert.equal(before.releaseReady, false); assert.equal(released.releaseReady, true);
    const terminalAngularVelocity = Math.PI * .13 / (ARENA_DRAGGED_ANKLE_THROW_TIMING.heave / 1000);
    assert.ok(Math.abs(Math.abs(released.angularVelocity) - terminalAngularVelocity) < 1e-10, 'the same small tilt continues at the shortened heave speed without an overhead flip');
    assert.ok(Math.abs(released.ankleSpin.orbit - origins.orbit) <= Math.PI * .13 + 1e-12);
    assert.ok(Math.cos(released.ankleSpin.orbit) * facing > .9, 'the victim leaves with its feet ahead of its head');
    assert.ok((midpoint(released).x - midpoint(before).x) * origins.direction > 0, 'the actual hand support moves towards the outside before the flight');
    assert.ok(midpoint(released).x > 480 && midpoint(released).x < 520, 'the stationary inside caster never follows the loser across the rim');
    for (const step of [16, 50]) {
      const sampledAt = (Math.floor(duration / step) + 1) * step;
      const lateRelease = arenaAnkleRimThrowTargets(sampledAt, origins);
      assert.equal(lateRelease.releaseReady, true);
      assert.equal(lateRelease.angularVelocity, released.angularVelocity, `the first ready ${step}ms frame must inherit the full terminal heave momentum`);
      assert.ok((midpoint(lateRelease).x - midpoint(released).x) * origins.direction > 0, 'the real held hand support keeps heaving until the first actual release frame');
      assert.ok(Math.abs((lateRelease.ankleSpin.orbit - released.ankleSpin.orbit) * 1000 / (sampledAt - duration) - released.angularVelocity) < 1e-9, 'the late frame retains the actual continuing angular momentum instead of pausing at the nominal clock');
    }
    assert.deepEqual(origins, saved, 'sampling the same throw does not mutate either real ankle origin');
  }
});
