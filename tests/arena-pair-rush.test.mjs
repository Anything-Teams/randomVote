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
    const actual = round(7, side), contact = frameAt(actual, .43), rebound = frameAt(actual, .52), groggy = frameAt(actual, .58), grabbed = frameAt(actual, .73), raised = frameAt(actual, .89), tossed = frameAt(actual, .98), release = frameAt(actual, 1);
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
    assert.ok(raised.lift > 47 && raised.victimPose === 'stunned');
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
  for (const roll of [0, 7]) for (const side of [-1, 1]) for (const span of [6000 * 40 / 44, 8000 * 62 / 44]) {
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

test('the arm and ankle holders can reach the painted body before and throughout their shared lifting stroke', () => {
  const fighter = (id, index, values) => ({ candidate: { id, name: id, color: '#dd784c' }, index, x: 500, y: 416, scale: 2.04, facing: 1, pose: 'brace', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
  for (const side of [-1, 1]) for (const phase of [.74, .78, .80, .84, .86, .94, .99]) {
    const actual = round(7, side), frame = frameAt(actual, phase), clock = phase * actual.impact;
    const victim = fighter(actual.victim, 2, { ...frame.victim, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -side, phase, pose: frame.victimPose, angle: frame.victimAngle });
    const body = sampleArenaFighterContacts(victim, clock);
    for (const [id, point, position, facing, index] of [[actual.aggressor, body.hands[0], frame.aggressor, -side, 0], [actual.helper, body.feet[0], frame.helper, side, 1]]) {
      const holder = fighter(id, index, { ...position, facing, phase, pose: frame.carrierPose, gripTarget: point, secondaryGripTarget: { x: point.x - facing * 4, y: point.y + 2 }, gripStrength: 1, gripLocked: true });
      const contact = sampleArenaFighterContacts(holder, clock);
      assert.ok(distance(contact.hands[1], point) < .01, `${side}/${phase}/${id}: the body cannot lift before the visible hand reaches it`);
    }
  }
});
