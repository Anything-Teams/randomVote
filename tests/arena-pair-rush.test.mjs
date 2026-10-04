import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { ARENA_PAIR_COUNTER_TIMING, ARENA_PAIR_CONTACT_RADIUS, ARENA_PAIR_THROW_UPWARD, arenaPairRushContact, arenaPairRushOutcome, arenaPairRushCast, arenaPairRushTargets, arenaPairRushFlight, arenaPairPushFlight } = await source('src/arenaPairRush.ts');
const { createArenaFighterAnimation, sampleArenaFighterContacts, arenaCarryHolderPoint } = await source('src/game/ArenaFighter.ts');
const { arenaAction, arenaActionWords, arenaNarration } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const base = { id: 'rush', index: 0, tactic: 'double-shove', start: 0, impact: 8000, resolve: 9100, end: 10000, final: false };
const round = (roll, side = 1, impact = 8000) => ({ ...base, ...arenaPairRushCast(['winner', 'second', 'third', 'last'], roll), contactSide: side, impact });
const frameAt = (actual, phase, center = { x: 500, y: 416 }) => arenaPairRushTargets(actual, actual.start + (actual.impact - actual.start) * phase, center);
const frameAtBeat = (actual, beat, center = { x: 500, y: 416 }, origin) => {
  const opening = arenaPairRushTargets(actual, actual.start, center, origin), span = actual.impact - actual.start;
  if (opening.outcome === 'counter-throw' && beat >= .44) {
    const cues = [[.44, 0], [.62, ARENA_PAIR_COUNTER_TIMING.grip], [.78, ARENA_PAIR_COUNTER_TIMING.lift], [.92, ARENA_PAIR_COUNTER_TIMING.overhead], [.96, ARENA_PAIR_COUNTER_TIMING.toss], [1, ARENA_PAIR_COUNTER_TIMING.release]];
    const [from, to] = cues.slice(1).map((cue, index) => [cues[index], cue]).find(([from, to]) => beat >= from[0] && beat <= to[0]);
    const age = from[1] + (to[1] - from[1]) * (beat - from[0]) / (to[0] - from[0]);
    return arenaPairRushTargets(actual, beat === 1 ? actual.impact : opening.contactAt + age, center, origin);
  }
  const contactPhase = (opening.contactAt - actual.start) / span;
  const phase = beat < .44 ? beat / .44 * contactPhase : contactPhase + (1 - contactPhase) * (beat - .44) / .56;
  return arenaPairRushTargets(actual, actual.start + span * phase, center, origin);
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('an independent ten-way rush story roll has exactly three double exits and seven counters', () => {
  const outcomes = Array.from({ length: 10 }, (_, roll) => arenaPairRushOutcome(roll));
  assert.equal(outcomes.filter(outcome => outcome === 'double-out').length, 3);
  assert.equal(outcomes.filter(outcome => outcome === 'counter-throw').length, 7);
  for (const invalid of [-1, 10, .5, NaN]) assert.throws(() => arenaPairRushOutcome(invalid), RangeError);
});

test('either story branch uses distinct living actors and consumes only the already drawn lowest places', () => {
  for (let count = 3; count <= 10; count++) for (let roll = 0; roll < 10; roll++) for (let selector = 0; selector < 8; selector++) {
    const living = Array.from({ length: count }, (_, index) => `rank-${index + 1}`), original = [...living];
    const cast = arenaPairRushCast(living, roll, selector);
    assert.equal(new Set([cast.aggressor, cast.victim, cast.helper]).size, 3);
    assert.ok([cast.aggressor, cast.victim, cast.helper].every(id => living.includes(id)));
    assert.equal(cast.victim, living.at(-1));
    if (roll < 3) {
      assert.equal(cast.secondaryVictim, living.at(-2));
      assert.equal(cast.helper, cast.secondaryVictim);
      assert.ok(!living.slice(-2).includes(cast.aggressor), 'the charger is one of the surviving ranks');
    } else {
      assert.equal(cast.secondaryVictim, undefined);
      assert.ok(![cast.aggressor, cast.helper].includes(cast.victim), 'the original pair survives the counter');
    }
    assert.deepEqual(living, original, 'choreography does not reorder the uniform draw');
  }
});

test('a delayed counter never shows a throw before its actual collision and release', () => {
  const waiting = { ...round(7), rushLaunchAt: null, resolve: 15000, end: 15000 };
  for (const elapsed of [waiting.impact, waiting.impact + 600, waiting.impact + 1800]) {
    const frame = arenaPairRushTargets(waiting, elapsed, { x: 500, y: 416 });
    const action = arenaAction(waiting, elapsed);
    assert.equal(frame.stage, 'wrestle');
    assert.equal(frame.grip, 'pair');
    assert.equal(action.stage, 'approach');
    assert.equal(action.lift, 0);
    for (const id of frame.pairIds) assert.equal(action.actors.find(actor => actor.id === id).pose, 'grapple');
  }
  const delayed = { ...waiting, rushLaunchAt: 9000, rushContactAt: 10000, impact: 10000 + ARENA_PAIR_COUNTER_TIMING.release };
  assert.equal(arenaAction(delayed, 10020).stage, 'resist', 'the recorded collision starts the rebound even after the planned impact');
  assert.equal(arenaAction(delayed, 10000 + ARENA_PAIR_COUNTER_TIMING.release + 20).stage, 'throw', 'the helpers release only after the complete actual lifting stroke');
});

test('a failed rush rebounds, pauses groggy, and is grabbed at both ends before the shared throw', () => {
  for (const side of [-1, 1]) {
    const actual = round(7, side), contact = frameAtBeat(actual, .44), rebound = frameAtBeat(actual, .52), groggy = frameAtBeat(actual, .58), grabbed = frameAtBeat(actual, .73), raised = frameAtBeat(actual, .93), tossed = frameAtBeat(actual, .98), release = frameAtBeat(actual, 1);
    assert.ok(side * (rebound.victim.x - contact.victim.x) < -15, 'the rushing third fighter visibly bounces back');
    assert.equal(groggy.stage, 'groggy');
    assert.equal(groggy.victimPose, 'stunned');
    assert.ok(Math.abs(groggy.victimAngle) > 1.2, 'the groggy charger falls onto the sand instead of standing hunched over');
    const lying = frameAtBeat(actual, .61);
    assert.ok(Math.abs(lying.victimAngle) > Math.PI * .46 && lying.lift === 0, 'the pair approaches a visibly prone body before their first grip');
    assert.equal(groggy.lift, 0, 'the victim cannot float before the pair holds them');
    assert.equal(grabbed.grip, 'arms-legs');
    assert.ok(grabbed.lift > 0 && grabbed.lift < 70, 'both helpers stand through one shared lift after accepting the actual weight');
    assert.equal(grabbed.armsHolderId, actual.aggressor);
    assert.equal(grabbed.legsHolderId, actual.helper);
    assert.ok(side * (grabbed.aggressor.x - grabbed.helper.x) > 80, 'the pair occupies opposite ends of the body');
    assert.ok(raised.lift >= 64 && raised.lift <= 70 && raised.victimPose === 'carried');
    assert.equal(raised.stage, 'overhead', 'a short backward load separates the chest-height lift from the final heave');
    assert.equal(raised.victimCarryStretch, 1);
    assert.equal(raised.victimSuspension, 1);
    assert.ok(Math.abs(Math.abs(raised.victimAngle) - Math.PI * .5) < 1e-12, 'the hands and toes are at opposite ends of a flat extended body');
    assert.equal(tossed.stage, 'toss');
    assert.equal(tossed.grip, 'arms-legs', 'both holds stay connected through the pushing stroke');
    assert.equal(release.grip, undefined);
    assert.equal(release.chargerId, actual.victim);
    assert.deepEqual(frameAtBeat(actual, .58), groggy, 'pause and direct seek produce the same groggy beat');
  }
});

test('a successful shoulder collision drives both wrestlers along the ground to the rim', () => {
  for (const side of [-1, 1]) {
    const actual = round(0, side), center = { x: side > 0 ? 650 : 350, y: 420 };
    const opening = frameAtBeat(actual, .1, center), raised = frameAt(actual, .98, center);
    assert.equal(opening.grip, 'pair');
    assert.deepEqual(raised.pairIds, [actual.victim, actual.helper]);
    assert.equal(raised.chargerId, actual.aggressor);
    for (const actor of ['victim', 'helper']) assert.ok(side * (raised[actor].x - opening[actor].x) > 80, 'both wrestlers are driven outward by the planted push');
    const ellipse = point => ((point.x - 500) / 303) ** 2 + ((point.y - 416) / 112) ** 2;
    assert.ok(ellipse(raised.aggressor) < 1, 'the throwing third fighter does not join the double elimination');
    assert.equal(raised.chargerPose, 'push');
    assert.ok(raised.pushStroke > .95 && raised.pressure === raised.pushStroke);
    assert.equal(raised.victimPose, 'brace');
    assert.equal(raised.helperPose, 'brace');
    assert.equal(raised.victimLift, 0);
    assert.equal(raised.helperLift, 0);
    assert.equal(raised.victimSuspension, 0);
    assert.equal(raised.helperSuspension, 0);
    assert.notEqual(raised.victimAngle, raised.helperAngle);
  }
});

test('both rush outcomes keep bounded continuous movement without returning to a starting position', () => {
  for (const roll of [0, 7]) for (const side of [-1, 1]) for (const span of [roll === 0 ? 4300 * 40 / 44 : 6000 * 40 / 44, 8000 * 62 / 44]) {
    const actual = round(roll, side, span), center = { x: side > 0 ? 650 : 350, y: 420 };
    let previous = arenaPairRushTargets(actual, 0, center);
    for (let elapsed = 16; elapsed <= span; elapsed += 16) {
      const current = arenaPairRushTargets(actual, elapsed, center);
      for (const actor of ['aggressor', 'victim', 'helper']) assert.ok(distance(current[actor], previous[actor]) / .016 < 165, `${roll}/${side}/${actor} cannot teleport or exceed the movement cap`);
      previous = current;
    }
    for (const phase of [.15, .38, .44, .49, .52, .56, .60, .62, .66, .74, .84, .90, 1]) {
      const before = arenaPairRushTargets(actual, span * phase - .001, center), after = arenaPairRushTargets(actual, span * phase + .001, center);
      for (const actor of ['aggressor', 'victim', 'helper']) assert.ok(distance(before[actor], after[actor]) < .001);
      for (const value of ['lift', 'victimAngle']) assert.ok(Math.abs(before[value] - after[value]) < .001);
    }
  }
});

test('both holders keep normal arms on the actual shoulders and toes through the floor pickup and chest-height heave', () => {
  const fighter = (id, index, values) => ({ candidate: { id, name: id, color: '#dd784c' }, index, x: 500, y: 416, scale: 2.04, facing: 1, pose: 'brace', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
  for (const side of [-1, 1]) for (let bodyIndex = 0; bodyIndex < 10; bodyIndex++) for (let victimIndex = 0; victimIndex < 10; victimIndex++) for (const phase of [.62, .66, .70, .74, .78, .80, .82, .84, .86, .93, .96, .99]) {
    const actual = round(7, side), frame = frameAtBeat(actual, phase), clock = actual.start + frame.phase * (actual.impact - actual.start);
    const victim = fighter(actual.victim, victimIndex, { ...frame.victim, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -side, phase, pose: frame.victimPose, angle: frame.victimAngle, suspension: frame.victimSuspension, carryStretch: frame.victimCarryStretch, carrySupport: 'shoulder', pairCarry: true, pairLoad: frame.pairLoad, pairLift: frame.pairLift, pairBackload: frame.pairBackload, pairHeave: frame.pairHeave });
    const body = sampleArenaFighterContacts(victim, clock);
    for (const [id, points, position, facing, index] of [[actual.aggressor, body.shoulders, frame.aggressor, -side, bodyIndex], [actual.helper, body.feet, frame.helper, side, bodyIndex]]) {
      const holder = fighter(id, index, { ...position, facing, phase, pose: frame.carrierPose, gripMode: id === frame.legsHolderId ? 'ankle' : 'shoulder', pairLoad: frame.pairLoad, pairLift: frame.pairLift, pairBackload: frame.pairBackload, pairHeave: frame.pairHeave, overheadRaise: frame.overhead, carrierDrive: frame.carrierDrive, gripTarget: points[0], secondaryGripTarget: points[1], gripStrength: 1, gripLocked: true });
      Object.assign(holder, arenaCarryHolderPoint(holder, points, clock));
      const contact = sampleArenaFighterContacts(holder, clock);
      for (let hand = 0; hand < 2; hand++) assert.ok(distance(contact.hands[1 - hand], points[hand]) < .01, `${side}/${phase}/${id}/${hand}: each painted hand must hold its actual shoulder or toe`);
      if (frame.stage === 'overhead') {
        assert.ok(body.waist.y > contact.head.y && body.waist.y < contact.waist.y, 'the held hips stay near the chest, below the carrier’s head');
        for (let arm = 0; arm < 2; arm++) {
          const shoulder = contact.shoulders[arm], elbow = contact.elbows[arm], hand = contact.hands[arm];
          const upper = distance(shoulder, elbow), lower = distance(hand, elbow);
          assert.ok(Math.abs(upper / 2.04 - 11) < .001 && Math.abs(lower / 2.04 - 10.5) < .001, 'contact does not stretch either upper arm or forearm');
          assert.ok((hand.x - shoulder.x) * facing >= -1e-6, 'both support hands stay in front of the caster instead of reaching behind their torso');
        }
      }
    }
  }
});

test('the third fighter runs from farther behind and the collision pulse follows actual arrival', () => {
  for (const roll of [0, 7]) for (const side of [-1, 1]) {
    const actual = round(roll, side), center = { x: side > 0 ? 650 : 350, y: 420 };
    const opening = frameAt(actual, 0, center), contact = arenaPairRushTargets(actual, opening.contactAt, center);
    const charger = roll < 3 ? 'aggressor' : 'victim';
    assert.ok(distance(opening[charger], contact[charger]) > 145, 'the rushing third fighter has a visible runway rather than a tiny step');
    assert.equal(opening.impactStrength, 0);
    const hit = arenaPairRushTargets(actual, opening.contactAt + 45, center);
    assert.ok(hit.impactStrength > .8, 'the collision has one strong readable impulse after actual arrival');
    if (roll < 3) {
      assert.ok(Math.abs(hit.victimRecoil) > .15 && Math.abs(hit.helperRecoil) > .10);
      assert.notEqual(hit.victimRecoil, hit.helperRecoil, 'the two fighters respond with individual collision motion');
    }
    const origin = { x: center.x - side * 155, y: center.y + 60 };
    assert.deepEqual(arenaPairRushTargets(actual, 0, center, origin)[charger], origin, 'an actual start position never snaps backwards onto the default runway');
    let previous = arenaPairRushTargets(actual, 0, center, origin)[charger];
    for (let elapsed = 16; elapsed < opening.contactAt; elapsed += 16) {
      const frame = arenaPairRushTargets(actual, elapsed, center, origin);
      assert.ok(distance(frame[charger], previous) / .016 < 165);
      previous = frame[charger];
    }
  }
});

test('a runner faces its real approach from either side, diagonally or vertically', () => {
  const center = { x: 500, y: 416 };
  for (const roll of [0, 7]) for (const side of [-1, 1]) {
    const actual = round(roll, side, 10000), targetCenter = center;
    const charger = roll < 3 ? 'aggressor' : 'victim';
    for (const offset of [{ x: -230, y: 0 }, { x: 230, y: 0 }, { x: -180, y: 65 }, { x: 180, y: -65 }, { x: 0, y: -90 }, { x: 0, y: 90 }]) {
      const origin = { x: targetCenter.x + offset.x, y: targetCenter.y + offset.y };
      const opening = arenaPairRushTargets(actual, 0, center, origin);
      assert.deepEqual(opening[charger], origin, 'the runner starts at its actual position');
      assert.ok(Math.abs(Math.hypot(opening.chargeDirection.x, opening.chargeDirection.y) - 1) < 1e-12);
      if (offset.x) assert.equal(opening.chargerFacing, -Math.sign(offset.x), 'the body cannot face the rim side while its feet run the other way');
      else assert.equal(opening.chargeDirection.x, 0, 'a vertical rush retains its vertical trajectory');
      let previous = opening[charger];
      for (let elapsed = 16; elapsed < opening.contactAt; elapsed += 16) {
        const frame = arenaPairRushTargets(actual, elapsed, center, origin), current = frame[charger];
        const forward = (current.x - previous.x) * opening.chargeDirection.x + (current.y - previous.y) * opening.chargeDirection.y;
        assert.ok(forward >= -1e-9, 'every approach step advances toward the pair');
        assert.ok(distance(current, previous) / .016 < 165, 'an arbitrary origin keeps the same bounded running speed');
        if (frame.stage === 'charge' && roll === 7) assert.equal(frame.victimPose, undefined, 'a running charger cannot be frozen by a brace pose');
        previous = current;
      }
      assert.ok(distance(arenaPairRushTargets(actual, opening.contactAt, center, origin)[charger], opening.contactPoint) < 1e-8, 'the runner reaches the pair without a backwards reset');
    }
  }
});

test('a blocked diagonal or vertical rush recoils back along its path and stays where it fell', () => {
  const center = { x: 500, y: 416 };
  for (const side of [-1, 1]) for (const offset of [{ x: 190, y: -50 }, { x: -190, y: 50 }, { x: 0, y: -85 }, { x: 0, y: 85 }]) {
    const actual = round(7, side, 10000), origin = { x: center.x - side * 53 + offset.x, y: center.y + 5 + offset.y };
    const opening = arenaPairRushTargets(actual, 0, center, origin);
    const atBeat = beat => frameAtBeat(actual, beat, center, origin);
    const contact = atBeat(.44), fallen = atBeat(.60), grabbed = atBeat(.78), held = atBeat(.93);
    const recoil = (fallen.victim.x - contact.victim.x) * opening.chargeDirection.x + (fallen.victim.y - contact.victim.y) * opening.chargeDirection.y;
    assert.ok(Math.abs(recoil + 30) < 1e-8, 'the failed charger has a visible recoil against its actual running direction');
    const sideways = -(fallen.victim.x - contact.victim.x) * opening.chargeDirection.y + (fallen.victim.y - contact.victim.y) * opening.chargeDirection.x;
    assert.ok(Math.abs(Math.abs(sideways) - 10) < 1e-8, 'the collision also deflects the body beside its running line');
    assert.ok(Math.abs(grabbed.victim.y - fallen.victim.y) < 1e-8, 'the suspended body retains the actual landing depth');
    assert.ok(Math.abs(held.victim.x - fallen.victim.x - held.throwShift) < 1e-8, 'the body moves only with the short actual load rather than a manufactured sprite-pivot step');
    assert.ok(held.lift >= 64 && held.lift <= 70, 'the shared chest-height load is preserved for every arrival direction');
  }
});

test('a charge keeps its running speed into the hit and never reverses a nearby starting position', () => {
  const center = { x: 500, y: 416 };
  for (const roll of [0, 7]) for (const side of [-1, 1]) {
    const actual = round(roll, side), charger = roll < 3 ? 'aggressor' : 'victim';
    const contact = { x: center.x - side * (roll < 3 ? 36 : 53), y: center.y + 5 };
    for (const offset of [{ x: -180, y: 50 }, { x: 180, y: -50 }, { x: 0, y: -80 }, { x: -3, y: 2 }, { x: 0, y: 0 }]) {
      const origin = { x: contact.x + offset.x, y: contact.y + offset.y }, opening = arenaPairRushTargets(actual, 0, center, origin);
      const before = arenaPairRushTargets(actual, opening.contactAt - 50, center, origin), next = arenaPairRushTargets(actual, opening.contactAt - 25, center, origin), hit = arenaPairRushTargets(actual, opening.contactAt, center, origin);
      const earlierSpeed = distance(before[charger], next[charger]) / .025, arrivingSpeed = distance(next[charger], hit[charger]) / .025;
      assert.ok(Math.abs(arrivingSpeed - earlierSpeed) < .01, 'the final steps do not ease down to a stop before collision');
      assert.ok(arrivingSpeed < 165);
      if (distance(origin, opening.contactPoint) > 60) assert.ok(arrivingSpeed > 150, 'a clear runway produces a committed fast charge');
      assert.deepEqual(opening[charger], origin, 'a short runway never sends the runner back to invent more distance');
      assert.ok(opening.contactAt < actual.impact * .40, 'the charge reaches contact without the old fixed forty-two percent delay');
      assert.equal(hit.impactStrength, 1, 'the collision pulse starts on the exact arrival frame');
    }
  }
});

test('a failed charge visibly rebounds beside the pair before becoming groggy at its actual landing', () => {
  for (const side of [-1, 1]) {
    const actual = round(7, side), center = { x: 500, y: 416 }, opening = frameAt(actual, 0, center);
    const before = arenaPairRushTargets(actual, opening.contactAt - .001, center), hit = arenaPairRushTargets(actual, opening.contactAt, center), after = arenaPairRushTargets(actual, opening.contactAt + 16, center);
    assert.equal(before.stage, 'charge');
    assert.equal(before.victimPose, undefined);
    assert.equal(hit.stage, 'rebound');
    assert.equal(hit.victimPose, 'stunned');
    assert.equal(hit.groggy, 0, 'the first impact deflects the body before it lies groggy');
    assert.equal(hit.impactStrength, 1);
    assert.ok(Math.abs(after.victimAngle) > Math.abs(hit.victimAngle), 'the recoil tilts the body during the next rendered frame');
    assert.ok(after.reboundHeight > 0);
    assert.ok(after.rebound > 0, 'physical backward recoil starts with the same collision');
    assert.ok(distance(hit.victim, after.victim) < 2, 'the reaction begins continuously rather than snapping onto the floor');
    const flying = arenaPairRushTargets(actual, opening.contactAt + ARENA_PAIR_COUNTER_TIMING.rebound / 2, center), landed = arenaPairRushTargets(actual, opening.contactAt + ARENA_PAIR_COUNTER_TIMING.rebound + 80, center), settled = arenaPairRushTargets(actual, opening.contactAt + ARENA_PAIR_COUNTER_TIMING.grip - 1, center);
    assert.equal(flying.stage, 'rebound'); assert.equal(flying.reboundHeight, 26);
    assert.ok(Math.abs(distance(hit.victim, flying.victim) - Math.hypot(30, 10) / 2) < .001 && Math.abs(flying.victimAngle) < .35, 'the body first completes half its actual recoil while still mostly upright');
    assert.equal(landed.stage, 'groggy'); assert.equal(landed.reboundHeight, 0); assert.equal(landed.groggy, 1);
    assert.ok(Math.abs(landed.victimAngle) > Math.PI * .46);
    assert.ok(distance(hit.victim, landed.victim) > 30);
    assert.deepEqual(landed.victim, settled.victim, 'the fallen victim stays at the recoil landing instead of being put back under the collision');
    const held = frameAtBeat(actual, .93, center), last = frameAtBeat(actual, .998, center), release = frameAtBeat(actual, 1, center);
    assert.ok(held.lift >= 64 && held.lift <= 70);
    assert.equal(held.carrierDrive, 1);
    assert.ok(side * (release.victim.x - last.victim.x) > .5, 'the shared toss keeps forward drive through release instead of braking first');
  }
});

test('the collision immediately rocks both bodies then a continuous planted push ejects them without lifting', () => {
  for (const side of [-1, 1]) {
    const actual = round(0, side), center = { x: side > 0 ? 650 : 350, y: 420 }, opening = frameAt(actual, 0, center);
    const at = progress => arenaPairRushTargets(actual, opening.contactAt + opening.postContactDuration * progress, center);
    const hit = at(0), next = arenaPairRushTargets(actual, opening.contactAt + 16, center), shock = arenaPairRushTargets(actual, opening.contactAt + 45, center), pushing = at(.2), last = at(.999), release = at(1);
    assert.equal(hit.stage, 'contact');
    assert.equal(hit.impactStrength, 1);
    assert.equal(hit.grip, 'pair', 'the near wrestler transmits the planted push through the real mutual grip');
    assert.ok(Math.abs(next.victimAngle) > .10 && Math.abs(next.helperAngle) > .07, 'both recoil in the very next displayed frame');
    assert.ok(Math.abs(shock.victimAngle) > .35 && Math.abs(shock.helperAngle) > .25, 'the shoulder impact has a visible body recoil rather than a tiny tilt');
    assert.equal(pushing.stage, 'push');
    assert.ok(pushing.pushStroke > 0);
    for (let progress = 0; progress <= 1; progress += .01) {
      const frame = at(progress);
      assert.equal(frame.victimLift, 0); assert.equal(frame.helperLift, 0);
      assert.equal(frame.victimSuspension, 0); assert.equal(frame.helperSuspension, 0);
      const across = point => (point.x - hit.victim.x) * opening.chargeDirection.y - (point.y - hit.victim.y) * opening.chargeDirection.x;
      assert.ok(Math.abs(across(frame.victim)) < 1e-8, 'a grounded push keeps the actual incoming line');
      assert.ok(Math.abs((frame.helper.x - hit.helper.x) * opening.chargeDirection.y - (frame.helper.y - hit.helper.y) * opening.chargeDirection.x) < 1e-8);
    }
    assert.equal(release.stage, 'release');
    for (const id of ['victim', 'helper', 'aggressor']) assert.ok((release[id].x - last[id].x) * opening.chargeDirection.x + (release[id].y - last[id].y) * opening.chargeDirection.y > .05, 'the shared shove retains the incoming forward movement on the release frame');
    const before = arenaPairRushTargets(actual, opening.contactAt - .001, center), after = arenaPairRushTargets(actual, opening.contactAt + .001, center);
    assert.ok(distance(before.aggressor, after.aggressor) < .001, 'the charger does not step backwards onto a push staging mark');
    const ellipse = point => ((point.x - 500) / 303) ** 2 + ((point.y - 416) / 112) ** 2;
    assert.ok(Math.max(ellipse(release.victim), ellipse(release.helper)) > .9, 'the first lost footing starts the free group motion without compressing the distant body onto the rim');
    assert.ok(Math.abs((release.victim.x - release.helper.x) - (hit.victim.x - hit.helper.x)) < 1e-8);
    assert.ok(Math.abs((release.victim.y - release.helper.y) - (hit.victim.y - hit.helper.y)) < 1e-8);
    assert.ok(ellipse(release.aggressor) < 1, 'the pushing charger remains on the sand');
  }
});

test('a successful two-body rush is described as shoulder impact then grounded pushing in every explanation', () => {
  const planned = round(0), opening = frameAt(planned, 0), actual = { ...planned, rushLaunchAt: opening.launchAt, rushContactAt: opening.contactAt, rushPushDuration: opening.postContactDuration, impact: opening.requiredImpactAt }, elapsed = opening.contactAt + opening.postContactDuration * .5;
  const candidates = [actual.aggressor, actual.victim, actual.helper].map(id => ({ id, name: id, color: '#dc784c' }));
  const action = arenaAction(actual, elapsed), words = arenaActionWords(actual, elapsed);
  assert.equal(action.lift, 0); assert.equal(action.liftedId, undefined);
  assert.equal(action.actors.find(part => part.id === actual.aggressor).pose, 'push');
  assert.deepEqual(words, [{ id: actual.aggressor, word: '밀어붙이기!' }]);
  const story = arenaStoryState(actual, elapsed), narration = arenaNarration(actual, candidates, candidates.map(candidate => candidate.id), elapsed);
  assert.equal(story.step, 3); assert.match(story.action, /밀어붙/); assert.match(narration.title, /밀어붙/);
  for (const text of [story.action, story.relationLabel, ...story.steps, narration.title, narration.detail]) assert.doesNotMatch(text, /퍼올|공중|들어 올|던지/);
  assert.match(arenaStoryState(actual, actual.impact).action, /두 사람만.*떨어/);
});

test('an explicit grip gate reserves the actual charger until both wrestlers are ready', () => {
  for (const roll of [0, 7]) for (const side of [-1, 1]) {
    const center = { x: 500, y: 416 }, actual = { ...round(roll, side, 12000), rushLaunchAt: null }, charger = roll < 3 ? 'aggressor' : 'victim';
    const origin = { x: center.x - side * 194, y: center.y + 62 };
    for (const elapsed of [0, 800, 2200, 5400, 11999]) {
      const frame = arenaPairRushTargets(actual, elapsed, center, origin);
      assert.equal(frame.waitingForGrip, true); assert.equal(frame.launchAt, null); assert.equal(frame.stage, 'wrestle');
      assert.deepEqual(frame[charger], origin, 'only the other two wrestlers can approach while their real grip is pending');
      assert.equal(frame.chargeStrength, 0); assert.equal(frame.impactStrength, 0); assert.equal(frame.rebound, 0); assert.equal(frame.lift, 0);
      assert.equal(frame.grip, 'pair');
    }
    const launch = { ...actual, rushLaunchAt: 2300, rushContactAt: 1000 };
    const before = arenaPairRushTargets(launch, 2299, center, origin), starts = arenaPairRushTargets(launch, 2300, center, origin), moving = arenaPairRushTargets(launch, 2500, center, origin);
    assert.deepEqual(before[charger], origin); assert.deepEqual(starts[charger], origin);
    assert.equal(starts.stage, 'charge'); assert.equal(starts.waitingForGrip, false);
    assert.ok(distance(moving[charger], origin) > 5);
    assert.ok(starts.contactAt > starts.launchAt + 900, 'an old contact forecast cannot make a real launch teleport into the pair');
    assert.ok(starts.requiredImpactAt <= launch.impact, 'the production bout leaves room for the entire post-contact sequence');
    let previous = starts;
    for (let elapsed = 2316; elapsed <= launch.impact; elapsed += 16) {
      const frame = arenaPairRushTargets(launch, elapsed, center, origin);
      for (const actor of ['aggressor', 'victim', 'helper']) assert.ok(distance(frame[actor], previous[actor]) / .016 < 165, `${roll}/${side}/${actor}: a delayed physical grip cannot accelerate the full encounter past its movement limit`);
      previous = frame;
    }
  }
});

test('the grip gate reports the real runway and minimum remaining story time for a late or distant charger', () => {
  for (const roll of [0, 7]) for (const side of [-1, 1]) {
    const center = { x: 500, y: 416 }, actual = { ...round(roll, side, 10900), rushLaunchAt: 3000, timeScale: 1 };
    const contact = { x: center.x - side * (roll < 3 ? 36 : 53), y: center.y + 5 }, origin = { x: contact.x - side * 285, y: contact.y + 60 };
    const frame = arenaPairRushTargets(actual, 3000, center, origin);
    assert.ok(frame.contactAt > 4900 && frame.contactAt < 5100, 'a long runway receives actual running time after the real grip');
    assert.ok(Math.abs(frame.requiredImpactAt - frame.contactAt - frame.postContactDuration) < 1e-8);
    if (roll < 3) assert.ok(frame.postContactDuration >= 700, 'the planted push follows its actual distance at bounded speed');
    else assert.equal(frame.postContactDuration, ARENA_PAIR_COUNTER_TIMING.release);
    assert.ok(frame.requiredImpactAt <= actual.impact);
    const tooLate = arenaPairRushTargets({ ...actual, rushLaunchAt: 9500 }, 9500, center, origin);
    assert.ok(tooLate.requiredImpactAt > actual.impact, 'the scene can reject an impossible late launch without secretly increasing running speed');
  }
});

test('a blocked runner contacts the near face of the pair and never crosses through them from any arrival direction', () => {
  const center = { x: 500, y: 416 };
  for (const side of [-1, 1]) for (let direction = 0; direction < 16; direction++) {
    const angle = direction * Math.PI / 8, origin = { x: center.x + Math.cos(angle) * 190, y: center.y + Math.sin(angle) * 100 };
    const actual = { ...round(7, side, 10000), rushLaunchAt: 500 };
    const opening = arenaPairRushTargets(actual, 0, center, origin);
    const first = { x: center.x + side * 22, y: center.y + 6 }, second = { x: center.x - side * 22, y: center.y - 6 };
    const pairDistance = point => {
      const dx = second.x - first.x, dy = second.y - first.y;
      const along = Math.max(0, Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / (dx * dx + dy * dy)));
      return distance(point, { x: first.x + along * dx, y: first.y + along * dy });
    };
    assert.ok(Math.abs(pairDistance(opening.contactPoint) - ARENA_PAIR_CONTACT_RADIUS) < 1e-7, 'contact is the first outside face rather than the far wrestler');
    const runDistance = distance(origin, opening.contactPoint);
    for (let elapsed = opening.launchAt; elapsed <= opening.contactAt; elapsed += 16) {
      const frame = arenaPairRushTargets(actual, elapsed, center, origin);
      assert.ok(pairDistance(frame.victim) >= ARENA_PAIR_CONTACT_RADIUS - 1e-7, 'the approach cannot enter the wrestling pair before its impact reaction');
      assert.ok(distance(origin, frame.victim) <= runDistance + 1e-7, 'the charge never overshoots its contact point');
    }
    for (let age = 0; age <= ARENA_PAIR_COUNTER_TIMING.rebound; age += 16) {
      const frame = arenaPairRushTargets(actual, opening.contactAt + age, center, origin);
      const forward = (frame.victim.x - opening.contactPoint.x) * opening.chargeDirection.x + (frame.victim.y - opening.contactPoint.y) * opening.chargeDirection.y;
      assert.ok(forward <= 1e-7, 'the blocked runner recoils on the arrival side instead of continuing behind the pair');
    }
  }
  for (const origin of [center, { x: 530, y: 418 }, { x: 478, y: 410 }]) {
    const contact = arenaPairRushContact(center, origin);
    assert.deepEqual(contact, origin, 'an already close runner does not walk backwards to invent a runway');
  }
});

test('a recorded short-run contact drives the same action clock and a touching charger never runs in place', () => {
  const center = { x: 370, y: 408 }, launchAt = 3000;
  const short = { ...round(7, -1, 9000), rushLaunchAt: launchAt };
  const opening = arenaPairRushTargets(short, launchAt, center, { x: 404, y: 433 });
  const actual = { ...short, rushContactAt: opening.contactAt, impact: opening.requiredImpactAt };
  for (const age of [1200, 2000, 2700]) {
    const elapsed = actual.rushContactAt + age, local = arenaPairRushTargets(actual, elapsed, center, { x: 404, y: 433 });
    assert.equal(arenaPairRushTargets(actual, elapsed, { x: 500, y: 416 }).contactAt, actual.rushContactAt, 'a consumer without the actual runway honors the recorded collision');
    assert.equal(arenaAction(actual, elapsed).lift, local.lift, 'the Scene and action rig lift on the same contact clock');
  }
  const touching = arenaPairRushTargets(short, launchAt, center, center);
  assert.equal(touching.contactAt, launchAt);
  assert.equal(touching.stage, 'rebound', 'an already touching body starts its shoulder reaction without stationary running');
});

test('counter actions keep the same brisk real milliseconds in short and long bouts', () => {
  const center = { x: 500, y: 416 }, origin = { x: 290, y: 444 }, timing = ARENA_PAIR_COUNTER_TIMING;
  const cues = [[100, 'rebound'], [(timing.rebound + timing.grip) / 2, 'groggy'], [timing.grip + 20, 'grip'], [timing.grip + 80, 'load'], [(timing.load + timing.lift) / 2, 'lift'], [(timing.overhead + timing.toss) / 2, 'overhead'], [(timing.toss + timing.release) / 2, 'toss']];
  for (const unit of [.55, 1, 1.4]) for (const span of [6000, 16000]) {
    let actual = { ...round(7, 1, span * unit), timeScale: unit, rushLaunchAt: 500 * unit };
    const opening = arenaPairRushTargets(actual, actual.start, center, origin);
    assert.equal(opening.postContactDuration, timing.release);
    assert.ok(Math.abs(opening.requiredImpactAt - opening.contactAt - timing.release) < 1e-7, 'a long match cannot slow the same anatomical pickup and lift');
    actual = { ...actual, impact: opening.requiredImpactAt, rushContactAt: opening.contactAt };
    for (const [age, stage] of cues) assert.equal(arenaPairRushTargets(actual, opening.contactAt + age, center, origin).stage, stage);
    const holding = arenaPairRushTargets(actual, actual.impact - .001, center, origin), release = arenaPairRushTargets(actual, actual.impact, center, origin);
    assert.equal(holding.grip, 'arms-legs'); assert.ok(holding.lift > 83.999 && holding.lift <= 84);
    assert.equal(release.stage, 'release'); assert.equal(release.grip, undefined);
    for (const age of [0, 240, ...Object.values(timing)]) {
      const before = arenaPairRushTargets(actual, opening.contactAt + age - .001, center, origin), after = arenaPairRushTargets(actual, opening.contactAt + age + .001, center, origin);
      for (const actor of ['aggressor', 'victim', 'helper']) assert.ok(distance(before[actor], after[actor]) < .002, 'fixed phase boundaries do not teleport any participant');
      for (const key of ['lift', 'victimAngle', 'victimCarryStretch', ...(age ? ['victimSuspension'] : [])]) assert.ok(Math.abs(before[key] - after[key]) < .002, `${unit}/${age}/${key}: the post-collision rig remains continuous`);
    }
  }
});

test('the floor pickup waits for four actual contacts, then load, shared rise and heave use that saved clock', () => {
  const center = { x: 500, y: 416 }, timing = ARENA_PAIR_COUNTER_TIMING;
  for (const side of [-1, 1]) {
    const origin = { x: center.x - side * 190, y: 446 }, pending = { ...round(7, side), rushLaunchAt: 500, pairPickupAt: null };
    const opening = arenaPairRushTargets(pending, 0, center, origin);
    const grounded = arenaPairRushTargets(pending, opening.contactAt + timing.grip, center, origin);
    for (const elapsed of [opening.plannedPickupAt, opening.plannedPickupAt + 1000, opening.plannedPickupAt + 6000]) {
      const frame = arenaPairRushTargets(pending, elapsed, center, origin);
      assert.equal(frame.stage, 'grip'); assert.equal(frame.canPickup, true); assert.equal(frame.waitingForPickup, true);
      assert.equal(frame.pickupAt, null); assert.equal(frame.grip, 'arms-legs'); assert.equal(frame.carrierPose, 'pairlift');
      assert.deepEqual(frame.victim, grounded.victim, 'the fallen body cannot creep toward a scheduled fake lift');
      for (const field of ['lift', 'victimSuspension', 'victimCarryStretch', 'pairLoad', 'pairLift', 'pairBackload', 'pairHeave', 'throwShift']) assert.equal(Math.abs(frame[field]), 0);
      assert.ok(frame.requiredImpactAt >= elapsed + timing.release - timing.grip, 'an unrecorded four-point pickup cannot resolve the round');
    }
    const pickupAt = opening.plannedPickupAt + 1400, saved = arenaPairRushTargets(pending, pickupAt, center, origin);
    const origins = { victim: opening.contactPoint, pair: [{ x: 500 + side * 22, y: 430 }, { x: 500 - side * 22, y: 402 }], direction: { x: -opening.chargeDirection.x, y: -opening.chargeDirection.y }, facing: opening.chargerFacing, pickup: { victim: saved.victim, pair: [saved.aggressor, saved.helper], waist: { x: saved.victim.x + side * 20, y: saved.victim.y - 15 } } };
    const recorded = { ...pending, rushContactAt: opening.contactAt, pairPickupAt: pickupAt };
    const start = arenaPairRushTargets(recorded, pickupAt, center, origin, origins);
    for (const role of ['aggressor', 'helper', 'victim']) assert.deepEqual(start[role], saved[role], 'the actual pickup begins at the three saved roots');
    assert.equal(start.lift, 0); assert.equal(start.requiredImpactAt, pickupAt + timing.release - timing.grip);
    const accepting = arenaPairRushTargets(recorded, pickupAt + (timing.load - timing.grip) / 2, center, origin, origins);
    assert.equal(accepting.stage, 'load'); assert.equal(accepting.pairLoad, .5); assert.equal(accepting.lift, 0);
    const raised = arenaPairRushTargets(recorded, pickupAt + timing.lift - timing.grip, center, origin, origins);
    assert.equal(raised.lift, 70); assert.equal(raised.pairLift, 1); assert.equal(raised.pairBackload, 0);
    const loadedBack = arenaPairRushTargets(recorded, pickupAt + timing.toss - timing.grip, center, origin, origins);
    assert.equal(loadedBack.lift, 64); assert.equal(loadedBack.throwShift, -side * 6); assert.equal(loadedBack.pairHeave, 0);
    const release = arenaPairRushTargets(recorded, pickupAt + timing.release - timing.grip, center, origin, origins);
    assert.equal(release.stage, 'release'); assert.equal(release.lift, 84); assert.equal(release.throwShift, side * 18);
    assert.equal(release.grip, undefined); assert.equal(release.requiredImpactAt, start.requiredImpactAt, 'the actual release clock stays fixed after pickup');
    assert.deepEqual(origins.pickup.victim, saved.victim, 'sampling never changes the captured floor geometry');
  }
});

test('a successful rush pushes both wrestlers and follows them in the actual incoming vector through the same exit ray', () => {
  const ellipse = point => ((point.x - 500) / 303) ** 2 + ((point.y - 416) / 112) ** 2;
  for (const side of [-1, 1]) for (const center of [{ x: 500, y: 416 }, { x: 600, y: 440 }, { x: 400, y: 390 }]) {
    for (const offset of [{ x: -190, y: 0 }, { x: 190, y: 0 }, { x: 0, y: -90 }, { x: 0, y: 90 }, { x: -150, y: -70 }, { x: 150, y: -70 }, { x: -150, y: 70 }, { x: 150, y: 70 }]) {
      const actual = { ...round(0, side, 9000), rushLaunchAt: 500 }, origin = { x: center.x + offset.x, y: center.y + offset.y };
      const opening = arenaPairRushTargets(actual, 0, center, origin), contact = arenaPairRushTargets(actual, opening.contactAt, center, origin);
      const incoming = opening.chargeDirection, forward = (a, b) => (a.x - b.x) * incoming.x + (a.y - b.y) * incoming.y;
      const across = (a, b) => (a.x - b.x) * incoming.y - (a.y - b.y) * incoming.x;
      let previous = contact;
      for (let elapsed = opening.contactAt + 16; elapsed <= actual.impact; elapsed += 16) {
        const frame = arenaPairRushTargets(actual, elapsed, center, origin);
        assert.deepEqual(frame.pushDirection, incoming);
        for (const role of ['victim', 'helper', 'aggressor']) {
          assert.ok(forward(frame[role], previous[role]) >= -1e-8, 'every planted push step continues toward the incoming shoulder drive');
          assert.ok(Math.abs(across(frame[role], contact[role])) < 1e-7, 'the bodies never cut sideways into the static throw layout');
        }
        previous = frame;
      }
      const release = arenaPairRushTargets(actual, actual.impact, center, origin);
      for (const role of ['victim', 'helper']) {
        const exit = role === 'victim' ? release.victimExit : release.helperExit;
        assert.ok(forward(release[role], contact[role]) > 30);
        assert.ok(ellipse(release[role]) < 1, 'both wrestlers retain their real offsets while their first lost footing starts the exit');
        assert.ok(ellipse(exit) > 1, 'the recorded exit target lies outside that same edge');
        assert.ok(forward(exit, release[role]) >= 90 - 1e-7 && Math.abs(across(exit, release[role])) < 1e-7, 'the free flight continues the push direction instead of turning toward an unrelated rim');
      }
      assert.ok(forward(release.aggressor, contact.aggressor) > 30 && ellipse(release.aggressor) < 1, 'the running charger follows the push while remaining on the sand');
    }
  }
});

test('the faster counter keeps normal ground steps below the movement cap while preserving held endpoint geometry', () => {
  const center = { x: 500, y: 416 };
  for (const side of [-1, 1]) for (let direction = 0; direction < 16; direction++) {
    const angle = direction * Math.PI / 8, origin = { x: center.x + Math.cos(angle) * 190, y: center.y + Math.sin(angle) * 100 };
    let actual = { ...round(7, side, 10000), rushLaunchAt: 500 };
    const opening = arenaPairRushTargets(actual, 0, center, origin);
    actual = { ...actual, impact: opening.requiredImpactAt, rushContactAt: opening.contactAt };
    let previous = arenaPairRushTargets(actual, 0, center, origin);
    for (let elapsed = 16; elapsed <= actual.impact; elapsed += 16) {
      const frame = arenaPairRushTargets(actual, elapsed, center, origin);
      for (const actor of ['aggressor', 'victim', 'helper']) assert.ok(distance(frame[actor], previous[actor]) / .016 <= 165, `${side}/${direction}/${actor}: a faster counter keeps bounded ground motion`);
      previous = frame;
    }
  }
});

test('a shared throw releases every painted held endpoint without rotating or rebuilding the body rig', () => {
  const fighter = (index, values) => ({ candidate: { id: 'v', name: 'v', color: '#e98d67' }, index, scale: 2.04, facing: 1, pose: 'carried', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const actual = round(7, side), held = frameAtBeat(actual, 1), landing = { x: side > 0 ? 885 : 115, y: 436 };
    const carry = fighter(index, { x: held.victim.x, y: held.victim.y - held.lift, depthY: held.victim.y, facing: -side, angle: held.victimAngle, suspension: held.victimSuspension, carryStretch: held.victimCarryStretch, carrySupport: 'shoulder', phase: held.phase });
    const flight = arenaPairRushFlight(0, held.victim, landing, side, 1, { lift: held.lift, angle: held.victimAngle });
    assert.equal(flight.stage, 'flight'); assert.equal(flight.pose, 'carried'); assert.equal(flight.height, held.lift); assert.equal(flight.angle, held.victimAngle);
    assert.equal(flight.carryStretch, 1); assert.equal(flight.suspension, 1); assert.equal(flight.facing, -side);
    const released = fighter(index, { x: flight.x, y: flight.y, depthY: flight.groundY, facing: flight.facing, angle: flight.angle, suspension: flight.suspension, carryStretch: flight.carryStretch, carrySupport: 'shoulder', phase: flight.phase });
    const a = sampleArenaFighterContacts(carry, actual.impact), b = sampleArenaFighterContacts(released, actual.impact);
    for (const key of ['head', 'waist']) assert.ok(distance(a[key], b[key]) < .001, `${side}/${index}/${key}: the release begins at the held painted body`);
    for (const key of ['hands', 'feet', 'elbows', 'shoulders']) for (let endpoint = 0; endpoint < 2; endpoint++) assert.ok(distance(a[key][endpoint], b[key][endpoint]) < .001, `${side}/${index}/${key}/${endpoint}: the flight cannot replace the held skeleton on release`);
    for (let elapsed = 0; elapsed < 880; elapsed += 16) {
      const sample = arenaPairRushFlight(elapsed, held.victim, landing, side, 1, { lift: held.lift, angle: held.victimAngle });
      assert.equal(sample.angle, held.victimAngle, 'the horizontal released body does not gain an unmotivated spin');
      assert.equal(sample.carryStretch, 1, 'hands and feet retain the held extension throughout the airborne stroke');
      assert.ok(sample.height <= held.lift + 45, 'a tall held release does not launch into a second oversized vertical leap');
    }
    for (const boundary of [0, 880, 1100, 1600]) {
      const before = arenaPairRushFlight(boundary - .001, held.victim, landing, side, 1, { lift: held.lift, angle: held.victimAngle });
      const after = arenaPairRushFlight(boundary + .001, held.victim, landing, side, 1, { lift: held.lift, angle: held.victimAngle });
      assert.ok(distance(before, after) < .01);
      for (const key of ['height', 'angle', 'carryStretch', 'suspension']) assert.ok(Math.abs(before[key] - after[key]) < .001, `${boundary}/${key}: landing and recovery remain continuous`);
    }
  }
});

test('the overhead release rises once on a constant-gravity parabola and carries every held limb toward the outside landing', () => {
  const fighter = values => ({ candidate: { id: 'v', name: 'v', color: '#e98d67' }, index: 2, scale: 2.04, facing: 1, pose: 'carried', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
  for (const unit of [.4, 1, 1.4]) for (const side of [-1, 1]) for (const origin of [{ x: 300, y: 365 }, { x: 500, y: 416 }, { x: 700, y: 470 }]) {
    const landing = { x: side > 0 ? 885 : 115, y: 436 }, held = { lift: 142, angle: side * Math.PI / 2 };
    const at = phase => arenaPairRushFlight(phase * 880 * unit, origin, landing, side, unit, held);
    const release = at(0), apex = at(220 / (2 * (held.lift + 220))), falling = at(.75);
    assert.equal(release.height, held.lift); assert.ok(apex.height > held.lift + 30 && apex.height < held.lift + 40, 'the high held body gains one readable upward throw, without an oversized second leap');
    assert.ok(falling.height < held.lift && at(.9).height < falling.height, 'gravity takes the raised body down toward the outside landing');
    const samples = Array.from({ length: 11 }, (_, index) => at(index / 10));
    const changes = samples.slice(1).map((sample, index) => sample.height - samples[index].height);
    for (let index = 1; index < changes.length; index++) assert.ok(Math.abs((changes[index] - changes[index - 1]) - (changes[1] - changes[0])) < 1e-8, 'constant downward acceleration replaces the spring-like easing curve');
    assert.ok(changes[0] > 0 && changes.at(-1) < 0);
    const actor = frame => fighter({ x: frame.x, y: frame.y, depthY: frame.groundY, facing: frame.facing, angle: frame.angle, suspension: frame.suspension, carryStretch: frame.carryStretch, phase: frame.phase });
    const releaseContacts = sampleArenaFighterContacts(actor(release), 0);
    for (const phase of [.1, .3, .5, .69]) {
      const frame = at(phase), contacts = sampleArenaFighterContacts(actor(frame), 0), delta = { x: frame.x - release.x, y: frame.y - release.y };
      for (const key of ['hands', 'feet']) for (let endpoint = 0; endpoint < 2; endpoint++) {
        assert.ok(distance(contacts[key][endpoint], { x: releaseContacts[key][endpoint].x + delta.x, y: releaseContacts[key][endpoint].y + delta.y }) < .001, 'the outstretched hands and feet travel with the same horizontal rig');
      }
    }
    for (let age = -16; age <= 1600; age += 16) {
      const frame = arenaPairRushFlight(age * unit, origin, landing, side, unit, held);
      assert.ok([frame.x, frame.y, frame.groundX, frame.groundY, frame.height, frame.angle, frame.phase, frame.suspension].every(Number.isFinite));
      const contacts = sampleArenaFighterContacts(actor(frame), 0);
      assert.ok([...contacts.hands, ...contacts.feet].every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    }
    assert.deepEqual({ x: at(1).groundX, y: at(1).groundY }, landing);
    assert.equal(at(1).height, 0);
  }
});


test('the joint heave launches upward on one gravity arc without changing the outside landing or other throws', () => {
  const held = { lift: 142, angle: Math.PI / 2, upward: ARENA_PAIR_THROW_UPWARD };
  for (const unit of [.4, 1, 1.4]) for (const side of [-1, 1]) {
    const origin = { x: 500, y: 416 }, landing = { x: side > 0 ? 885 : 115, y: 436 };
    const at = phase => arenaPairRushFlight(phase * 880 * unit, origin, landing, side, unit, held);
    assert.equal(at(0).height, held.lift, 'the upward heave preserves the actual height of both supports at release');
    const apexPhase = ARENA_PAIR_THROW_UPWARD / (2 * (held.lift + ARENA_PAIR_THROW_UPWARD));
    assert.ok(at(apexPhase).height > 232 && at(apexPhase).height < 244, 'the heave gains a readable upward arc above the carriers');
    const samples = Array.from({ length: 11 }, (_, index) => at(index / 10));
    const changes = samples.slice(1).map((sample, index) => sample.height - samples[index].height);
    for (let index = 1; index < changes.length; index++) assert.ok(Math.abs((changes[index] - changes[index - 1]) + 2 * (held.lift + ARENA_PAIR_THROW_UPWARD) * .01) < 1e-8, 'one constant gravity acceleration carries the body down, without another upward bounce');
    assert.ok(changes[0] > 0 && changes.at(-1) < 0);
    const landed = at(1);
    assert.equal(landed.stage, 'land'); assert.equal(landed.height, 0); assert.deepEqual({ x: landed.x, y: landed.y }, landing);
    assert.equal(arenaPairRushFlight(1100 * unit, origin, landing, side, unit, held).stage, 'recover', 'the ranking and recovery clock stay unchanged');
    const other = arenaPairRushFlight(880 * unit * 220 / (2 * 362), origin, landing, side, unit, { lift: 142, angle: side * Math.PI / 2 });
    assert.ok(other.height > 172 && other.height < 182, 'the separate passing-trip throw retains its existing flight');
  }
});

test('two pushed bodies keep their original spacing and final speed until each actually crosses the rim', () => {
  const ellipse = point => ((point.x - 500) / 303) ** 2 + ((point.y - 416) / 112) ** 2;
  for (const side of [-1, 1]) for (const offset of [{ x: -190, y: 0 }, { x: 190, y: 0 }, { x: 0, y: -90 }, { x: 0, y: 90 }, { x: -150, y: 70 }, { x: 150, y: -70 }]) {
    const center = { x: 500, y: 416 }, origin = { x: center.x + offset.x, y: center.y + offset.y };
    const planned = { ...round(0, side, 10000), rushLaunchAt: 500 }, opening = arenaPairRushTargets(planned, 0, center, origin);
    const release = arenaPairRushTargets(planned, opening.requiredImpactAt, center, origin);
    const origins = [release.victim, release.helper], landings = [release.victimExit, release.helperExit];
    const sample = age => origins.map((point, index) => arenaPairPushFlight(age, point, landings[index], side, 1, { speed: release.pushSpeed, angle: index ? release.helperAngle : release.victimAngle }));
    const start = sample(0), infinitesimal = sample(.001);
    for (let index = 0; index < 2; index++) {
      assert.ok(distance(start[index], origins[index]) < 1e-8, 'no release root reset');
      assert.ok(Math.abs(distance(start[index], infinitesimal[index]) * 1e6 - release.pushSpeed) < .1, 'the final push and first free step have the same velocity');
    }
    const originalGap = { x: origins[0].x - origins[1].x, y: origins[0].y - origins[1].y };
    let previous = start, sawSeparateFootLoss = false, bothFell = false;
    for (let age = 16; age <= 1300; age += 16) {
      const current = sample(age);
      assert.ok(Math.abs(current[0].x - current[1].x - originalGap.x) < 1e-7);
      assert.ok(Math.abs(current[0].groundY - current[1].groundY - originalGap.y) < 1e-7, 'the pair never compresses or crosses in free motion');
      for (let index = 0; index < 2; index++) {
        assert.ok(distance(current[index], previous[index]) / .016 <= 165, 'the released motion stays physically bounded');
        assert.ok([current[index].x, current[index].y, current[index].angle].every(Number.isFinite));
        if (current[index].stage === 'overrun') assert.ok(ellipse(current[index]) <= 1 + 1e-7, 'a body only falls after its own feet cross the actual ellipse');
        if (current[index].stage === 'fall') assert.ok(ellipse(current[index]) >= 1 - 1e-7);
      }
      sawSeparateFootLoss ||= current.some(frame => frame.stage === 'overrun') && current.some(frame => frame.stage === 'fall');
      bothFell ||= current.every(frame => ['fall', 'land'].includes(frame.stage));
      previous = current;
    }
    assert.ok(sawSeparateFootLoss && bothFell, 'one coherent push preserves offset while the two distinct rim contacts occur');
  }
});
