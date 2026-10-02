import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaPairRushOutcome, arenaPairRushCast, arenaPairRushTargets } = await source('src/arenaPairRush.ts');
const { createArenaFighterAnimation, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const base = { id: 'rush', index: 0, tactic: 'double-shove', start: 0, impact: 8000, resolve: 9100, end: 10000, final: false };
const round = (roll, side = 1, impact = 8000) => ({ ...base, ...arenaPairRushCast(['winner', 'second', 'third', 'last'], roll), contactSide: side, impact });
const frameAt = (actual, phase, center = { x: 500, y: 416 }) => arenaPairRushTargets(actual, actual.start + (actual.impact - actual.start) * phase, center);
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
    const actual = round(7, side), contact = frameAt(actual, .43), rebound = frameAt(actual, .52), groggy = frameAt(actual, .58), grabbed = frameAt(actual, .73), raised = frameAt(actual, .93), tossed = frameAt(actual, .98), release = frameAt(actual, 1);
    assert.ok(side * (rebound.victim.x - contact.victim.x) < -15, 'the rushing third fighter visibly bounces back');
    assert.equal(groggy.stage, 'groggy');
    assert.equal(groggy.victimPose, 'stunned');
    assert.ok(Math.abs(groggy.victimAngle) > 1.2, 'the groggy charger falls onto the sand instead of standing hunched over');
    const lying = frameAt(actual, .61);
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
    assert.deepEqual(frameAt(actual, .58), groggy, 'pause and direct seek produce the same groggy beat');
  }
});

test('a successful rush moves only the locked pair to the edge while the charger remains inside', () => {
  for (const side of [-1, 1]) {
    const actual = round(0, side), center = { x: side > 0 ? 650 : 350, y: 420 };
    const opening = frameAt(actual, .1, center), pushed = frameAt(actual, .98, center);
    assert.equal(opening.grip, 'pair');
    assert.deepEqual(pushed.pairIds, [actual.victim, actual.helper]);
    assert.equal(pushed.chargerId, actual.aggressor);
    for (const actor of ['victim', 'helper']) assert.ok(side * (pushed[actor].x - opening[actor].x) > 60);
    const ellipse = point => ((point.x - 500) / 303) ** 2 + ((point.y - 416) / 112) ** 2;
    assert.ok(ellipse(pushed.aggressor) < 1, 'the pushing third fighter does not join the double elimination');
    assert.ok(ellipse(pushed.victim) > .95 && ellipse(pushed.helper) > .95);
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
  for (const side of [-1, 1]) for (const phase of [.62, .66, .70, .74, .78, .80, .82, .84, .86, .93, .96, .99]) {
    const actual = round(7, side), frame = frameAt(actual, phase), clock = phase * actual.impact;
    const victim = fighter(actual.victim, 2, { ...frame.victim, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -side, phase, pose: frame.victimPose, angle: frame.victimAngle, suspension: frame.victimSuspension, carryStretch: frame.victimCarryStretch });
    const body = sampleArenaFighterContacts(victim, clock);
    for (const [id, points, position, facing, index] of [[actual.aggressor, body.hands, frame.aggressor, -side, 0], [actual.helper, body.feet, frame.helper, side, 1]]) {
      const holder = fighter(id, index, { ...position, facing, phase, pose: frame.carrierPose, overheadRaise: frame.overhead, gripTarget: points[0], secondaryGripTarget: points[1], gripStrength: 1, gripLocked: true });
      const contact = sampleArenaFighterContacts(holder, clock);
      for (let hand = 0; hand < 2; hand++) assert.ok(distance(contact.hands[1 - hand], points[hand]) < .01, `${side}/${phase}/${id}/${hand}: each painted hand must hold its actual fingertip or toe`);
      if (frame.stage === 'overhead') assert.ok(body.waist.y < contact.head.y, 'the held body reaches above the carrier’s head before the throw');
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
    const hit = arenaPairRushTargets(actual, opening.contactAt + 180, center);
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
    const actual = round(roll, side, 10000), contact = { x: center.x - side * (roll < 3 ? 75 : 53), y: center.y + 5 };
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
