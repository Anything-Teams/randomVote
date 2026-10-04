import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/arenaLinkedRush.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const {
  arenaLinkedRushTargets, arenaLinkedRushOutcome, ARENA_LINKED_RUSH_CHANCE,
  ARENA_LINKED_RUSH_SPEED, ARENA_LINKED_RUSH_MAX_PRELUDE,
} = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const center = { x: 500, y: 416 }, window = { start: 4000, end: 13000 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) <= 1 + 1e-9;
const initial = (above = false, reversed = false) => ({
  pair: (reversed ? [{ x: 591, y: above ? 355 : 484 }, { x: 410, y: above ? 363 : 492 }]
    : [{ x: 410, y: above ? 363 : 492 }, { x: 591, y: above ? 355 : 484 }]),
  victim: { x: 507, y: 415 }, neck: { x: 503, y: 331 },
});
const rendered = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { sampleArenaFighterContacts, drawArenaFighter, createArenaFighterAnimation } = await import(`data:text/javascript;base64,${Buffer.from(rendered.outputFiles[0].text).toString('base64')}`);
const context = new Proxy({}, { get: () => () => {}, set: () => true });
const actor = (index, overrides = {}) => ({ candidate: { id: String(index), name: '선수', color: '#ffad72' }, index,
  x: 500, y: 416, scale: 2.04, facing: 1, pose: 'run', angle: 0, alpha: 1, velocityX: 0, velocityY: 162,
  gaitDistance: 0, phase: 0, power: .55, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });

test('one independent cosmetic roll in a thousand enables the double clothesline', () => {
  assert.equal(ARENA_LINKED_RUSH_CHANCE, .001);
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaLinkedRushOutcome(roll)).filter(Boolean).length, 1);
  for (const roll of [-1, .5, 1000, NaN, Infinity]) assert.throws(() => arenaLinkedRushOutcome(roll), RangeError);
});

test('both allies keep their actual roots, walk into formation, and run together at real speed', () => {
  for (const above of [false, true]) for (const reversed of [false, true]) {
    const origins = initial(above, reversed), saved = structuredClone(origins);
    const first = arenaLinkedRushTargets(window, window.start, center, origins);
    assert.deepEqual(first.pair, origins.pair);
    assert.deepEqual(first.victim, origins.victim);
    assert.ok(first.canHit);
    assert.equal(first.linkStrength, 0);
    assert.ok(first.contactAt - first.launchAt >= 480, 'running has visible steps rather than a single contact frame');
    let previous = first, peakRunSpeed = 0;
    for (let clock = window.start + 8; clock <= first.contactAt; clock += 8) {
      const frame = arenaLinkedRushTargets(window, clock, center, origins);
      for (let index = 0; index < 2; index++) {
        const speed = distance(frame.pair[index], previous.pair[index]) / .008;
        assert.ok(speed <= ARENA_LINKED_RUSH_SPEED + 1e-6, `fighter ${index} must use bounded steps at ${clock}`);
        assert.ok(inside(frame.pair[index]), 'both allies stay on the sand throughout their approach');
        if (frame.stage === 'charge') peakRunSpeed = Math.max(peakRunSpeed, speed);
      }
      if (previous.stage === 'charge' && frame.stage === 'charge') {
        const firstStep = { x: frame.pair[0].x - previous.pair[0].x, y: frame.pair[0].y - previous.pair[0].y };
        const secondStep = { x: frame.pair[1].x - previous.pair[1].x, y: frame.pair[1].y - previous.pair[1].y };
        assert.ok(distance(firstStep, secondStep) < 1e-9, 'the parallel runners translate together, without separate lane snaps');
      }
      assert.deepEqual(frame.victim, origins.victim, 'the recipient does not advance invisibly into the striking arms');
      previous = frame;
    }
    assert.ok(peakRunSpeed > 160, 'the double clothesline has normal running pace');
    assert.equal(first.direction.y, above ? 1 : -1);
    assert.deepEqual(origins, saved, 'planning must not mutate the live bodies');
  }
});

test('two distinct striking hands reach separate actual neck and chest points with normal straight arms', () => {
  for (const reversed of [false, true]) {
    const origins = initial(false, reversed);
    // Actual renderer samples may differ with lean/personality; planning uses
    // those measured offsets rather than assuming a generic torso origin.
    origins.shoulderOffsets = reversed
      ? [{ x: -11.7, y: -82.3 }, { x: 19.7, y: -79.5 }]
      : [{ x: 19.7, y: -79.5 }, { x: -11.7, y: -82.3 }];
    origins.strikeTargets = reversed ? [{ x: 511, y: 337 }, { x: 495, y: 331 }] : [{ x: 495, y: 331 }, { x: 511, y: 337 }];
    const plan = arenaLinkedRushTargets(window, window.start, center, origins);
    const hit = arenaLinkedRushTargets(window, plan.contactAt, center, origins);
    assert.equal(hit.stage, 'contact');
    assert.deepEqual(hit.strikeTargets, origins.strikeTargets);
    assert.ok(distance(hit.strikeHands[0], hit.strikeHands[1]) > 16, 'each runner strikes independently rather than joining hands');
    for (let index = 0; index < 2; index++) {
      const shoulder = { x: hit.pair[index].x + origins.shoulderOffsets[index].x, y: hit.pair[index].y + origins.shoulderOffsets[index].y };
      assert.ok(distance(hit.strikeHands[index], origins.strikeTargets[index]) < 1e-9, 'each hand reaches its own captured impact point');
      assert.ok(Math.abs(shoulder.y - hit.strikeHands[index].y) < 1e-9, 'the attack arm is transverse to the upright torso');
      assert.ok(distance(shoulder, hit.strikeHands[index]) <= 21.3 * 2.04, 'striking arms retain the renderer’s anatomical length');
      assert.ok(distance(shoulder, hit.strikeHands[index]) > 39, 'both attack arms are visibly extended rather than cramped around the chest');
    }
    assert.deepEqual(hit.linkedArms, reversed ? [0, 1] : [1, 0]);
    assert.deepEqual(hit.contactPair, hit.pair, 'the post-contact throw inherits the exact two hit roots');
    assert.deepEqual(hit.contactVictim, origins.victim);
    assert.equal(hit.requiredEndAt, hit.contactAt + 2200, 'only the existing shared post-contact stroke owns the remainder');
  }
});

test('the actual clothesline renderer strikes both captured targets without joining hands on either depth entry', () => {
  for (const above of [false, true]) for (const reversed of [false, true]) {
    const origins = initial(above, reversed), selected = reversed ? [0, 1] : [1, 0];
    const runners = origins.pair.map((point, index) => actor(index, { ...point, clotheslineArm: selected[index] }));
    origins.shoulderOffsets = runners.map((runner, index) => {
      const shoulder = sampleArenaFighterContacts(runner, window.start).shoulders[selected[index]];
      return { x: shoulder.x - runner.x, y: shoulder.y - runner.y };
    });
    const victim = sampleArenaFighterContacts(actor(2, { ...origins.victim, pose: 'brace', velocityY: 0 }), window.start);
    origins.neck = { x: (victim.shoulders[0].x + victim.shoulders[1].x) / 2,
      y: (victim.shoulders[0].y + victim.shoulders[1].y) / 2 - 2.2 * 2.04 };
    const plan = arenaLinkedRushTargets(window, window.start, center, origins);
    const hit = arenaLinkedRushTargets(window, plan.contactAt, center, origins);
    const atHit = runners.map((runner, index) => ({ ...runner, ...hit.pair[index], velocityY: hit.direction.y * 162 }));
    const saved = atHit.map(runner => structuredClone(runner.animation));
    atHit.forEach((runner, index) => {
      runner.clotheslineTarget = hit.strikeHands[index]; runner.clotheslineStrength = 1;
      drawArenaFighter(context, runner, hit.contactAt);
      const painted = runner.animation.contactPoints, arm = selected[index];
      assert.ok(distance(painted.hands[arm], hit.strikeTargets[index]) < 1e-8, 'the painted striking hand reaches its own neck/chest point');
      assert.ok(Math.abs(distance(painted.shoulders[arm], painted.elbows[arm]) - 11 * runner.scale) < 1e-8);
      assert.ok(Math.abs(distance(painted.elbows[arm], painted.hands[arm]) - 10.5 * runner.scale) < 1e-8);
      assert.ok(distance(painted.hands[1 - arm], hit.strikeTargets[index]) > 25, 'the free arm remains available for running balance');
      assert.equal(saved[index].clock, null, 'contact sampling cannot advance a live animation');
    });
    assert.ok(distance(atHit[0].animation.contactPoints.hands[selected[0]], atHit[1].animation.contactPoints.hands[selected[1]]) > 16, 'the two actual palms never become a shared grip');
  }
});

test('an unconfirmed extended-arm formation waits on the ground and confirming it causes no position jump', () => {
  const origins = initial(), pending = { ...window, launchAt: null };
  const plan = arenaLinkedRushTargets(pending, window.start, center, origins);
  const waiting = arenaLinkedRushTargets(pending, plan.readyAt + 1500, center, origins);
  assert.equal(waiting.stage, 'extend'); assert.equal(waiting.launchAt, null);
  assert.equal(waiting.waitingForFormation, true);
  assert.equal(waiting.linkStrength, 1); assert.equal(waiting.chargeStrength, 0);
  const confirmedAt = plan.readyAt + 1500, confirmed = { ...window, launchAt: confirmedAt };
  const at = arenaLinkedRushTargets(confirmed, confirmedAt, center, origins);
  assert.deepEqual(at.pair, waiting.pair);
  assert.deepEqual(at.linkPoint, waiting.linkPoint);
  assert.equal(at.chargeStrength, 0);
  const step = arenaLinkedRushTargets(confirmed, confirmedAt + 16, center, origins);
  assert.ok(distance(at.pair[0], step.pair[0]) < .12, 'a real first step accelerates from the verified stance');
});

test('stage boundaries preserve roots, separate striking hands, and preparation instead of resetting poses', () => {
  for (const unit of [.5, 1, 1.6]) {
    const origins = initial(), plan = arenaLinkedRushTargets(window, window.start, center, origins, unit);
    for (const boundary of [plan.readyAt, plan.launchAt, plan.contactAt, plan.requiredEndAt]) {
      const before = arenaLinkedRushTargets(window, boundary - .001, center, origins, unit);
      const after = arenaLinkedRushTargets(window, boundary + .001, center, origins, unit);
      for (let index = 0; index < 2; index++) assert.ok(distance(before.pair[index], after.pair[index]) < .001, `root continuity at ${boundary}`);
      assert.ok(distance(before.linkPoint, after.linkPoint) < .001);
      assert.ok(Math.abs(before.linkStrength - after.linkStrength) < .001);
      assert.ok(Math.abs(before.chargePreparation - after.chargePreparation) < .001);
    }
  }
});

test('a recorded real contact freezes that actual hit root rather than pulling allies to the nominal mark', () => {
  const origins = initial(), plan = arenaLinkedRushTargets(window, window.start, center, origins);
  const actualContact = plan.contactAt - 16;
  const incoming = arenaLinkedRushTargets(window, actualContact, center, origins);
  const recorded = { ...window, launchAt: plan.launchAt, contactAt: actualContact };
  for (const clock of [actualContact, actualContact + 16, actualContact + 700]) {
    const frame = arenaLinkedRushTargets(recorded, clock, center, origins);
    assert.deepEqual(frame.pair, incoming.pair);
    assert.deepEqual(frame.contactPair, incoming.pair);
    assert.equal(frame.contactAt, actualContact);
    assert.equal(frame.requiredEndAt, actualContact + 2200);
  }
});

test('outside-sand and distant layouts decline the rare attack without moving or stretching anyone', () => {
  const unsafe = [
    { pair: [{ x: 730, y: 440 }, { x: 770, y: 423 }], victim: { x: 812, y: 416 } },
    { pair: [{ x: 500, y: 540 }, { x: 600, y: 490 }], victim: { x: 500, y: 416 } },
  ];
  for (const origins of unsafe) {
    const frame = arenaLinkedRushTargets(window, window.start + 5000, center, origins);
    assert.equal(frame.canHit, false); assert.equal(frame.active, false);
    assert.deepEqual(frame.pair, origins.pair); assert.deepEqual(frame.victim, origins.victim);
    assert.equal(frame.linkStrength, 0);
  }
  assert.equal(ARENA_LINKED_RUSH_MAX_PRELUDE, 7000);
  for (let row = 360; row <= 472; row += 14) {
    const origins = { pair: [{ x: 420, y: row }, { x: 580, y: row + 8 }], victim: { x: 500, y: 416 } };
    const plan = arenaLinkedRushTargets(window, window.start, center, origins);
    assert.ok(plan.canHit);
    assert.ok(plan.contactAt - window.start < ARENA_LINKED_RUSH_MAX_PRELUDE, 'a long surrounding bout cannot slow the physical prelude');
  }
});

test('two separate forearms approach rim opponents from the open interior side without changing depth formations', () => {
  for (const victimX of [250, 750]) {
    const origins = { pair: [{ x: 430, y: 397 }, { x: 610, y: 431 }], victim: { x: victimX, y: 430 }, neck: { x: victimX, y: 346 } };
    const plan = arenaLinkedRushTargets(window, window.start, center, origins);
    assert.ok(plan.canHit);
    assert.equal(plan.direction.y, 0, 'a rim opponent has an inward horizontal runway');
    assert.equal(plan.direction.x, victimX < 500 ? -1 : 1);
    assert.deepEqual(plan.clotheslineArms, [0, 0], 'each runner uses their own forearm across the upper body');
    assert.deepEqual(plan.pairFacing, [plan.direction.x, plan.direction.x]);
    let previous = plan;
    for (let clock = window.start + 8; clock <= plan.contactAt; clock += 8) {
      const frame = arenaLinkedRushTargets(window, clock, center, origins);
      frame.pair.forEach((point, index) => {
        assert.ok(inside(point));
        assert.ok(distance(point, previous.pair[index]) <= ARENA_LINKED_RUSH_SPEED * .008 + 1e-6, 'formation and attack both use actual bounded steps');
      });
      previous = frame;
    }
    const hit = arenaLinkedRushTargets(window, plan.contactAt, center, origins);
    assert.ok(Math.abs(hit.pair[0].y - hit.pair[1].y) >= 18, 'the two runners occupy separate visible depth lanes');
    hit.strikeHands.forEach((hand, index) => assert.ok(distance(hand, hit.strikeTargets[index]) < 1e-9));
    assert.ok(distance(hit.strikeHands[0], hit.strikeHands[1]) > 12, 'two distinct attacks never join palms');
  }
});
