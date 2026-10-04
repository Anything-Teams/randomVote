import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaWrestlingMoveOutcome, arenaWrestlingMoveTargets, ARENA_WRESTLING_MOVE_CHANCE, ARENA_WRESTLING_MOVE_TIMING } = await source('src/arenaWrestlingMoves.ts');
const { createArenaFighterAnimation, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const kinds = ['clothesline', 'dropkick', 'bulldog', 'backbodydrop', 'spinebuster', 'scoopslam'];
const center = { x: 500, y: 416 }, distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;
const window = kind => ({ kind, start: 1000, end: 8000, launchAt: null, contactAt: null, releaseAt: null, kickAt: null, ankleGripAt: null });
function origins(kind, side = 1) {
  return kind === 'bulldog' || kind === 'scoopslam'
    ? { driver: { x: 500 - side * 30, y: 416 }, victim: { x: 500 + side * 30, y: 416 } }
    : kind === 'backbodydrop' || kind === 'spinebuster'
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
const fighter = (index, values) => ({ candidate: { id: String(index), name: String(index), color: '#ffad72' }, index, x: 500, y: 416, scale: 2.04, facing: 1, pose: 'guard', phase: 0, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });

test('each new wrestling move uses an independent four percent cosmetic roll', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaWrestlingMoveOutcome(roll)).filter(Boolean).length, 1000 * ARENA_WRESTLING_MOVE_CHANCE);
  for (const invalid of [-1, 1000, .5, NaN]) assert.throws(() => arenaWrestlingMoveOutcome(invalid), RangeError);
});

test('clothesline needs a real accelerating runway while hip counters wait for the incoming opponent', () => {
  for (const side of [-1, 1]) {
    const clothesline = launched('clothesline', side), early = arenaWrestlingMoveTargets(clothesline.actual, clothesline.actual.launchAt + 250, center, clothesline.initial, side);
    assert.equal(early.canContact, false); assert.equal(early.driverPose, 'run'); assert.ok(distance(early.driver, clothesline.initial.driver) > 25);
    const close = arenaWrestlingMoveTargets(window('clothesline'), 1000, center, { driver: { x: 500, y: 416 }, victim: { x: 500 + side * 90, y: 416 } }, side);
    assert.equal(close.canPerform, false, 'a short reach cannot become an instant running clothesline');
    for (const kind of ['spinebuster', 'backbodydrop']) {
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
  for (const kind of ['bulldog', 'backbodydrop']) for (const side of [-1, 1]) {
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

test('close combat and running moves decline unsuitable geometry without manufacturing a runway', () => {
  for (const kind of kinds) {
    const initial = origins(kind);
    if (kind === 'bulldog' || kind === 'scoopslam') { initial.driver.x = 650; initial.victim.x = 780; }
    else initial.driver = { x: initial.victim.x - 20, y: initial.victim.y };
    const frame = arenaWrestlingMoveTargets(window(kind), 6000, center, initial);
    assert.equal(frame.canPerform, false); assert.equal(frame.canLaunch, false); assert.equal(frame.canContact, false); assert.equal(frame.canRelease, false);
    assert.deepEqual(frame.driver, initial.driver); assert.deepEqual(frame.victim, initial.victim);
  }
});

test('a close move approaches a distant real opponent at bounded speed before enabling the grip', () => {
  for (const kind of ['bulldog', 'scoopslam']) for (const side of [-1, 1]) {
    const initial = { driver: { x: 500 - side * 190, y: 416 }, victim: { x: 500 + side * 90, y: 416 } };
    const opening = arenaWrestlingMoveTargets(window(kind), 1000, center, initial, side);
    assert.equal(opening.canPerform, true); assert.equal(opening.canContact, false); assert.equal(opening.gripStrength, 0);
    assert.ok(opening.plannedLaunchAt > 1000 + 1200, 'a far opponent needs the full physical approach before the planted grip');
    let previous = opening;
    for (let elapsed = 1016; elapsed <= opening.plannedLaunchAt; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(window(kind), elapsed, center, initial, side);
      assert.ok(distance(frame.driver, previous.driver) / .016 <= 190 + 1e-6);
      assert.equal(frame.canContact, false); assert.equal(frame.gripStrength, 0); assert.equal(frame.victimHeight, 0);
      previous = frame;
    }
    assert.ok(distance(previous.driver, initial.victim) < 35, 'the real approach reaches a normal arm length instead of teleporting a grip');
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

test('both painted dropkick soles can reach the actual chest during the bounded contact window', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const values = launched('dropkick', side), victim = fighter((index + 3) % 10, { ...values.initial.victim, facing: -side });
    const rig = sampleArenaFighterContacts(victim, 1000), target = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 + victim.scale * 5 };
    values.initial.target = target; values.initial.contactTargets = [{ x: target.x, y: target.y - 6 }, { x: target.x, y: target.y + 6 }];
    let contacted = false;
    for (let elapsed = values.actual.launchAt + 16; elapsed < values.opening.landingAt; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial, side);
      if (!frame.canContact || frame.feetStrength < .9) continue;
      const actor = fighter(index, { ...frame.driver, y: frame.driver.y - frame.driverHeight, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, suspension: frame.driverSuspension, dropkickProgress: frame.dropkickProgress, footTargets: frame.footTargets, feetStrength: frame.feetStrength });
      const feet = sampleArenaFighterContacts(actor, elapsed).feet;
      if (feet.every((foot, leg) => distance(foot, frame.footTargets[leg]) < 7)) { contacted = true; break; }
    }
    assert.ok(contacted, `${side}/${index}: both fixed-length painted legs must be able to reach the real chest`);
  }
});

test('the solo clothesline forearm can cross the real neck instead of only pointing at it', () => {
  const segmentGap = (point, from, to) => { const dx = to.x - from.x, dy = to.y - from.y, p = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy))); return distance(point, { x: from.x + dx * p, y: from.y + dy * p }); };
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const values = launched('clothesline', side), victim = fighter((index + 3) % 10, { ...values.initial.victim, facing: -side });
    const rig = sampleArenaFighterContacts(victim, 1000), neck = { x: rig.head.x, y: rig.head.y + victim.scale * 20 };
    values.initial.target = neck; let touched = false;
    for (let elapsed = values.actual.launchAt; elapsed < values.opening.requiredEndAt; elapsed += 16) {
      const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial, side);
      if (!frame.canContact || frame.clotheslineStrength <= .75) continue;
      const actor = fighter(index, { ...frame.driver, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, clotheslineArm: 1, clotheslineTarget: frame.clotheslineTarget, clotheslineStrength: frame.clotheslineStrength });
      const contact = sampleArenaFighterContacts(actor, elapsed);
      if (segmentGap(neck, contact.elbows[1], contact.hands[1]) < 8) { touched = true; break; }
    }
    assert.ok(touched, `${side}/${index}: the nearly straight forearm crosses the painted neck during the real contact window`);
  }
});

test('a close bulldog can establish both actual head-side grips before either body falls', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const values = launched('bulldog', side), victim = fighter((index + 3) % 10, { ...values.initial.victim, facing: -side });
    const contacts = sampleArenaFighterContacts(victim, values.actual.launchAt);
    const frame = arenaWrestlingMoveTargets(values.actual, values.actual.launchAt, center, values.initial, side);
    const actor = fighter(index, { ...frame.driver, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, bulldogProgress: frame.bulldogProgress, gripMode: 'head', gripTarget: contacts.headSides[1], secondaryGripTarget: contacts.headSides[0], gripStrength: 1, gripLocked: true });
    const hands = sampleArenaFighterContacts(actor, values.actual.launchAt).hands;
    assert.ok(hands.every((hand, arm) => distance(hand, contacts.headSides[arm]) < 6), `${side}/${index}: both fixed-length hands can hold the actual temples before the forward fall`);
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
    assert.ok(peak > 63 && peak <= 64, 'the received hips pass over the catcher within natural arm reach'); assert.ok(Math.abs(ready.victimAngle) > 1.6); assert.ok(Math.abs(ready.victimHeight) < .001); assert.equal(ready.victimSlam.slump, 1); assert.equal(ready.canRelease, false, 'landing the received body is not an automatic exit');
  }
});

test('a head slam creates one shared fall then lets only the attacker rise and approach the actual ankles', () => {
  for (const side of [-1, 1]) {
    const values = contacted('bulldog', side), frame = arenaWrestlingMoveTargets(values.actual, values.contactAt + 300, center, values.initial, side);
    assert.equal(frame.stage, 'fall'); assert.ok(frame.side * frame.driverAngle > 1); assert.ok(frame.side * frame.victimAngle > 1);
    assert.ok(frame.side * (frame.driver.x - values.initial.contactDriver.x) > 25); assert.ok(frame.side * (frame.victim.x - values.initial.contactVictim.x) > 25);
    const groggy = arenaWrestlingMoveTargets(values.actual, values.contactAt + 700, center, values.initial, side);
    assert.equal(groggy.driverPose, 'recover'); assert.equal(groggy.victimPose, 'stunned');
    const pickup = arenaWrestlingMoveTargets(values.actual, values.contactAt + 900, center, values.initial, side);
    assert.equal(pickup.victimPose, 'stunned'); assert.equal(pickup.victimAngle, groggy.victimAngle); assert.equal(pickup.victimSlam.slump, 1);
    assert.equal(pickup.stage, 'ankle-approach'); assert.equal(pickup.gripMode, 'ankle'); assert.equal(Math.abs(pickup.driverAngle), 0); assert.equal(pickup.driverSlam, undefined); assert.equal(pickup.canGrabAnkle, true);
    assert.equal(pickup.canRelease, false, 'the head slam waits for the actual ankle hold before the connected toss');
  }
});

test('all four floor finishes reserve the loser until an actual two-ankle hold completes the lifting stroke', () => {
  for (const kind of ['clothesline', 'bulldog', 'backbodydrop', 'scoopslam']) for (const side of [-1, 1]) {
    const values = contacted(kind, side), initialFloor = arenaWrestlingMoveTargets(values.actual, values.contactAt + 1500, center, values.initial, side);
    assert.equal(initialFloor.victimHeight, 0); assert.equal(initialFloor.victimPose, 'stunned'); assert.equal(initialFloor.victimSlam.slump, 1);
    assert.equal(initialFloor.gripMode, 'ankle'); assert.equal(initialFloor.canGrabAnkle, true); assert.equal(initialFloor.canRelease, false);
    assert.equal(arenaWrestlingMoveTargets({ ...values.actual, releaseAt: undefined }, values.contactAt + 1500, center, values.initial, side).releaseAt, null);
    const held = { ...values.actual, ankleGripAt: values.contactAt + 1500 };
    const grip = arenaWrestlingMoveTargets(held, held.ankleGripAt, center, values.initial, side), toss = arenaWrestlingMoveTargets(held, held.ankleGripAt + 300, center, values.initial, side);
    assert.equal(grip.stage, 'ankle-grip'); assert.equal(grip.victimHeight, 0);
    assert.equal(toss.stage, 'toss'); assert.equal(toss.victimHeight, 34); assert.equal(toss.canRelease, true);
    assert.equal(arenaWrestlingMoveTargets(held, held.ankleGripAt + 299, center, values.initial, side).canRelease, false);
    assert.ok(inside(toss.driver), `${kind}: the two-hand throw leaves its caster on the sand`);
  }
});

test('a spinebuster must complete the floor slam before its separate actual kick can release the loser', () => {
  const values = contacted('spinebuster'), floorAt = values.contactAt + ARENA_WRESTLING_MOVE_TIMING.slamLift + ARENA_WRESTLING_MOVE_TIMING.slamFall;
  const held = arenaWrestlingMoveTargets(values.actual, values.contactAt + 420, center, values.initial);
  assert.equal(held.victimHeight, 72); assert.equal(held.victimPose, 'airborne');
  const waiting = arenaWrestlingMoveTargets(values.actual, floorAt + 1000, center, values.initial);
  assert.equal(waiting.victimHeight, 0); assert.equal(waiting.victimSlam.slump, 1); assert.equal(waiting.canKick, true); assert.equal(waiting.canRelease, false);
  assert.equal(arenaWrestlingMoveTargets({ ...values.actual, releaseAt: undefined }, floorAt + 1000, center, values.initial).releaseAt, null, 'an omitted release clock cannot bypass the actual body kick');
  const kicked = arenaWrestlingMoveTargets({ ...values.actual, kickAt: floorAt + 1000 }, floorAt + 1000, center, values.initial);
  assert.equal(kicked.canRelease, true); assert.equal(kicked.frontKick, .62);
});

test('a spinebuster walks into actual fallen-body reach and plants before its kick windup', () => {
  const values = contacted('spinebuster'), floorAt = values.contactAt + ARENA_WRESTLING_MOVE_TIMING.slamLift + ARENA_WRESTLING_MOVE_TIMING.slamFall;
  values.initial.contactDriver = { x: 525, y: 416 }; values.initial.contactVictim = { x: 450, y: 416 };
  values.initial.kickTarget = { x: 451, y: 388 }; values.initial.kickDriver = { x: 475, y: 416 };
  let previous = arenaWrestlingMoveTargets(values.actual, floorAt, center, values.initial), ready;
  const finishingSlam = arenaWrestlingMoveTargets(values.actual, floorAt - 1, center, values.initial);
  assert.ok(distance(previous.driver, finishingSlam.driver) < .001, 'the kick approach starts from the receiver\'s actual supported-slam root');
  assert.equal(previous.driverPose, 'run'); assert.equal(previous.frontKick, undefined); assert.equal(previous.canKick, false);
  for (let elapsed = floorAt + 16; elapsed <= floorAt + 1200; elapsed += 16) {
    const frame = arenaWrestlingMoveTargets(values.actual, elapsed, center, values.initial);
    assert.ok(distance(frame.driver, previous.driver) / .016 <= 160 + 1e-6);
    assert.equal(frame.driverFacing, -1); assert.equal(frame.canRelease, false);
    if (frame.frontKick !== undefined) assert.deepEqual(frame.driver, values.initial.kickDriver, 'the actual sole extends only after the supporting foot plants at the reachable root');
    if (frame.canKick) { ready = frame; break; }
    previous = frame;
  }
  assert.ok(ready); assert.equal(ready.frontKick, .62); assert.deepEqual(ready.driverFootTarget, values.initial.kickTarget);
  assert.ok(ready.requiredReleaseAt > floorAt + 600, 'the release plan includes the real approach rather than only the 240ms leg stroke');
});

test('a scoop slam lowers the same horizontal rig and reserves the toss until its real ankle hold', () => {
  const values = contacted('scoopslam'), floorAt = values.contactAt + ARENA_WRESTLING_MOVE_TIMING.slamLift + ARENA_WRESTLING_MOVE_TIMING.slamFall;
  const carried = arenaWrestlingMoveTargets(values.actual, values.contactAt + 420, center, values.initial);
  assert.equal(carried.victimPose, 'carried'); assert.equal(carried.victimHeight, 70); assert.equal(carried.victimCarryStretch, 1); assert.equal(Math.abs(carried.victimAngle), Math.PI / 2);
  const waiting = arenaWrestlingMoveTargets(values.actual, floorAt + 700, center, values.initial);
  assert.equal(waiting.victimHeight, 0); assert.equal(waiting.gripMode, 'ankle'); assert.equal(waiting.canGrabAnkle, true); assert.equal(waiting.canRelease, false);
  assert.equal(arenaWrestlingMoveTargets({ ...values.actual, releaseAt: undefined }, floorAt + 700, center, values.initial).releaseAt, null, 'an omitted release clock cannot bypass the actual ankle grip');
  values.initial.ankles = [{ x: waiting.victim.x - 80, y: waiting.victim.y - 4 }, { x: waiting.victim.x - 84, y: waiting.victim.y - 13 }];
  values.initial.ankleDriver = { ...waiting.driver };
  const held = { ...values.actual, ankleGripAt: floorAt + 700 };
  assert.equal(arenaWrestlingMoveTargets(held, held.ankleGripAt + 299, center, values.initial).canRelease, false);
  const tossing = arenaWrestlingMoveTargets(held, held.ankleGripAt + 300, center, values.initial);
  assert.equal(tossing.canRelease, true); assert.deepEqual(tossing.driver, values.initial.ankleDriver); assert.deepEqual(tossing.gripTargets, values.initial.ankles);
  assert.equal(tossing.victimHeight, 34); assert.equal(tossing.victimSuspension, 1); assert.ok(Math.abs(tossing.victimAngle) > Math.PI / 2, 'the supported ankles actually lift and swing the body before release');
});
