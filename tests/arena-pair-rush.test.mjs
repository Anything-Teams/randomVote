import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaPairRushOutcome, arenaPairRushCast, arenaPairRushTargets } = await source('src/arenaPairRush.ts');
const { createArenaFighterAnimation, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const { arenaAction, arenaActionWords, arenaNarration } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const base = { id: 'rush', index: 0, tactic: 'double-shove', start: 0, impact: 8000, resolve: 9100, end: 10000, final: false };
const round = (roll, side = 1, impact = 8000) => ({ ...base, ...arenaPairRushCast(['winner', 'second', 'third', 'last'], roll), contactSide: side, impact });
const frameAt = (actual, phase, center = { x: 500, y: 416 }) => arenaPairRushTargets(actual, actual.start + (actual.impact - actual.start) * phase, center);
const frameAtBeat = (actual, beat, center = { x: 500, y: 416 }, origin) => {
  const opening = arenaPairRushTargets(actual, actual.start, center, origin), span = actual.impact - actual.start;
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
    assert.equal(grabbed.lift, 0);
    assert.equal(grabbed.armsHolderId, actual.aggressor);
    assert.equal(grabbed.legsHolderId, actual.helper);
    assert.ok(side * (grabbed.aggressor.x - grabbed.helper.x) > 80, 'the pair occupies opposite ends of the body');
    assert.ok(raised.lift === 142 && raised.victimPose === 'carried');
    assert.equal(raised.stage, 'overhead', 'a held overhead beat separates lifting from the final throw');
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

test('both holders keep both painted hand and toe endpoints attached from the floor to the overhead throw', () => {
  const fighter = (id, index, values) => ({ candidate: { id, name: id, color: '#dd784c' }, index, x: 500, y: 416, scale: 2.04, facing: 1, pose: 'brace', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
  for (const side of [-1, 1]) for (let bodyIndex = 0; bodyIndex < 10; bodyIndex++) for (let victimIndex = 0; victimIndex < 10; victimIndex++) for (const phase of [.62, .66, .70, .74, .78, .80, .82, .84, .86, .93, .96, .99]) {
    const actual = round(7, side), frame = frameAtBeat(actual, phase), clock = actual.start + frame.phase * (actual.impact - actual.start);
    const victim = fighter(actual.victim, victimIndex, { ...frame.victim, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -side, phase, pose: frame.victimPose, angle: frame.victimAngle, suspension: frame.victimSuspension, carryStretch: frame.victimCarryStretch });
    const body = sampleArenaFighterContacts(victim, clock);
    for (const [id, points, position, facing, index] of [[actual.aggressor, body.hands, frame.aggressor, -side, bodyIndex], [actual.helper, body.feet, frame.helper, side, bodyIndex]]) {
      const holder = fighter(id, index, { ...position, facing, phase, pose: frame.carrierPose, gripMode: id === frame.legsHolderId ? 'ankle' : 'wrist', overheadRaise: frame.overhead, carrierDrive: frame.carrierDrive, gripTarget: points[0], secondaryGripTarget: points[1], gripStrength: 1, gripLocked: true });
      const contact = sampleArenaFighterContacts(holder, clock);
      for (let hand = 0; hand < 2; hand++) assert.ok(distance(contact.hands[1 - hand], points[hand]) < .01, `${side}/${phase}/${id}/${hand}: each painted hand must hold its actual fingertip or toe`);
      if (frame.stage === 'overhead') {
        assert.ok(body.waist.y < contact.head.y, 'the held body reaches above the carrier’s head before the throw');
        for (let arm = 0; arm < 2; arm++) {
          const shoulder = contact.shoulders[arm], elbow = contact.elbows[arm], hand = contact.hands[arm];
          const upper = distance(shoulder, elbow), lower = distance(hand, elbow);
          const cosine = ((shoulder.x - elbow.x) * (hand.x - elbow.x) + (shoulder.y - elbow.y) * (hand.y - elbow.y)) / (upper * lower);
          assert.ok(Math.acos(Math.max(-1, Math.min(1, cosine))) > 145 * Math.PI / 180, `${side}/${bodyIndex}/${id}/${arm}: a raised carrier cannot fold one arm across their head`);
          assert.ok(Math.abs(upper / 2.04 - 14) < .001 && Math.abs(lower / 2.04 - 14) < .001, 'contact does not stretch either upper arm or forearm');
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
    const actual = round(roll, side, 10000), contact = { x: center.x - side * (roll < 3 ? 36 : 53), y: center.y + 5 };
    const charger = roll < 3 ? 'aggressor' : 'victim';
    for (const offset of [{ x: -230, y: 0 }, { x: 230, y: 0 }, { x: -180, y: 65 }, { x: 180, y: -65 }, { x: 0, y: -90 }, { x: 0, y: 90 }]) {
      const origin = { x: contact.x + offset.x, y: contact.y + offset.y };
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
      assert.ok(distance(arenaPairRushTargets(actual, opening.contactAt, center, origin)[charger], contact) < 1e-8, 'the runner reaches the pair without a backwards reset');
    }
  }
});

test('a blocked diagonal or vertical rush recoils back along its path and stays where it fell', () => {
  const center = { x: 500, y: 416 };
  for (const side of [-1, 1]) for (const offset of [{ x: 190, y: -50 }, { x: -190, y: 50 }, { x: 0, y: -85 }, { x: 0, y: 85 }]) {
    const actual = round(7, side, 10000), origin = { x: center.x - side * 53 + offset.x, y: center.y + 5 + offset.y };
    const opening = arenaPairRushTargets(actual, 0, center, origin), contactPhase = opening.contactAt / actual.impact;
    const atBeat = beat => arenaPairRushTargets(actual, actual.impact * (contactPhase + (1 - contactPhase) * (beat - .44) / .56), center, origin);
    const contact = atBeat(.44), fallen = atBeat(.60), grabbed = atBeat(.78), held = atBeat(.93);
    const recoil = (fallen.victim.x - contact.victim.x) * opening.chargeDirection.x + (fallen.victim.y - contact.victim.y) * opening.chargeDirection.y;
    assert.ok(Math.abs(recoil + 18) < 1e-8, 'the failed charger bounces against its actual running direction');
    assert.ok(distance(fallen.victim, grabbed.victim) < 1e-8, 'grabbing the fallen body does not pull it onto a horizontal staging mark');
    assert.ok(distance(grabbed.victim, held.victim) < 1e-8, 'only the overhead lift changes height while the base stays in place');
    assert.equal(held.lift, 142, 'the shared overhead height is preserved for every arrival direction');
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
      if (distance(origin, contact) > 60) assert.ok(arrivingSpeed > 150, 'a clear runway produces a committed fast charge');
      assert.deepEqual(opening[charger], origin, 'a short runway never sends the runner back to invent more distance');
      assert.ok(opening.contactAt < actual.impact * .40, 'the charge reaches contact without the old fixed forty-two percent delay');
      assert.equal(hit.impactStrength, 1, 'the collision pulse starts on the exact arrival frame');
    }
  }
});

test('a failed charge is groggy on the arrival frame and begins falling in the very next frame', () => {
  for (const side of [-1, 1]) {
    const actual = round(7, side), center = { x: 500, y: 416 }, opening = frameAt(actual, 0, center);
    const before = arenaPairRushTargets(actual, opening.contactAt - .001, center), hit = arenaPairRushTargets(actual, opening.contactAt, center), after = arenaPairRushTargets(actual, opening.contactAt + 16, center);
    assert.equal(before.stage, 'charge');
    assert.equal(before.victimPose, undefined);
    assert.equal(hit.stage, 'groggy');
    assert.equal(hit.victimPose, 'stunned');
    assert.equal(hit.groggy, 1, 'there is no waiting-for-next-story-phase groggy delay');
    assert.equal(hit.impactStrength, 1);
    assert.ok(Math.abs(after.victimAngle) > Math.abs(hit.victimAngle), 'the fall starts during the next rendered frame');
    assert.ok(after.rebound > 0, 'physical backward recoil starts with the same collision');
    assert.ok(distance(hit.victim, after.victim) < 2, 'the reaction begins continuously rather than snapping onto the floor');
    const held = frameAtBeat(actual, .93, center), last = frameAtBeat(actual, .998, center), release = frameAtBeat(actual, 1, center);
    assert.equal(held.lift, 142);
    assert.equal(held.carrierDrive, 1);
    assert.ok(side * (release.victim.x - last.victim.x) > .8, 'the shared toss keeps forward drive through release instead of braking first');
  }
});

test('the collision immediately rocks both bodies then a continuous planted push ejects them without lifting', () => {
  for (const side of [-1, 1]) {
    const actual = round(0, side), center = { x: side > 0 ? 650 : 350, y: 420 }, opening = frameAt(actual, 0, center);
    const at = progress => arenaPairRushTargets(actual, opening.contactAt + (actual.impact - opening.contactAt) * progress, center);
    const hit = at(0), next = arenaPairRushTargets(actual, opening.contactAt + 16, center), shock = arenaPairRushTargets(actual, opening.contactAt + 45, center), pushing = at(.2), last = at(.999), release = at(1);
    assert.equal(hit.stage, 'contact');
    assert.equal(hit.impactStrength, 1);
    assert.equal(hit.grip, undefined, 'the shoulder hit breaks their old mutual wrestling grip');
    assert.ok(Math.abs(next.victimAngle) > .10 && Math.abs(next.helperAngle) > .07, 'both recoil in the very next displayed frame');
    assert.ok(Math.abs(shock.victimAngle) > .35 && Math.abs(shock.helperAngle) > .25, 'the shoulder impact has a visible body recoil rather than a tiny tilt');
    assert.equal(pushing.stage, 'push');
    assert.ok(pushing.pushStroke > 0);
    for (let progress = 0; progress <= 1; progress += .01) {
      const frame = at(progress);
      assert.equal(frame.victimLift, 0); assert.equal(frame.helperLift, 0);
      assert.equal(frame.victimSuspension, 0); assert.equal(frame.helperSuspension, 0);
      assert.equal(frame.victim.y, center.y + 14); assert.equal(frame.helper.y, center.y - 14);
    }
    assert.equal(release.stage, 'release');
    for (const id of ['victim', 'helper', 'aggressor']) assert.ok(side * (release[id].x - last[id].x) > .05, 'the shared shove retains forward movement on the release frame');
    const before = arenaPairRushTargets(actual, opening.contactAt - .001, center), after = arenaPairRushTargets(actual, opening.contactAt + .001, center);
    assert.ok(distance(before.aggressor, after.aggressor) < .001, 'the charger does not step backwards onto a push staging mark');
    const ellipse = point => ((point.x - 500) / 303) ** 2 + ((point.y - 416) / 112) ** 2;
    assert.ok(ellipse(release.victim) > .9 && ellipse(release.helper) > .9, 'both bodies reach the lip of the arena before their exit flight');
    assert.ok(ellipse(release.aggressor) < 1, 'the pushing charger remains on the sand');
  }
});

test('a successful two-body rush is described as shoulder impact then grounded pushing in every explanation', () => {
  const actual = round(0), opening = frameAt(actual, 0), elapsed = opening.contactAt + (actual.impact - opening.contactAt) * .5;
  const candidates = [actual.aggressor, actual.victim, actual.helper].map(id => ({ id, name: id, color: '#dc784c' }));
  const action = arenaAction(actual, elapsed), words = arenaActionWords(actual, elapsed);
  assert.equal(action.lift, 0); assert.equal(action.liftedId, undefined);
  assert.equal(action.actors.find(part => part.id === actual.aggressor).pose, 'push');
  assert.deepEqual(words, [{ id: actual.aggressor, word: '둘을 밀기!' }]);
  const story = arenaStoryState(actual, elapsed), narration = arenaNarration(actual, candidates, candidates.map(candidate => candidate.id), elapsed);
  assert.equal(story.step, 3); assert.match(story.action, /밀어붙/); assert.match(narration.title, /밀어붙/);
  for (const text of [story.action, story.relationLabel, ...story.steps, narration.title, narration.detail]) assert.doesNotMatch(text, /퍼올|공중|들어 올|던지/);
  assert.match(arenaStoryState(actual, actual.impact).action, /두 사람만.*떨어/);
});
