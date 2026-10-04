import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/arenaSlideTrip.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaSlideTripOutcome, arenaSlideTripTargets, ARENA_SLIDE_TRIP_CHANCE, ARENA_SLIDE_TRIP_TIMING } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const center = { x: 500, y: 416 }, distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const window = { start: 1000, end: 8000 };

test('sliding trips use exactly two percent of one independent cosmetic roll', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaSlideTripOutcome(roll)).filter(Boolean).length, 1000 * ARENA_SLIDE_TRIP_CHANCE);
  for (const invalid of [-1, .2, 1000, NaN]) assert.throws(() => arenaSlideTripOutcome(invalid), RangeError);
});

test('a real runway accelerates into a brief feet-first slide with bounded speed and no reset', () => {
  for (const side of [-1, 1]) for (const separation of [25, 100, 280, 450]) {
    const origins = { driver: { x: 500 - side * separation, y: 431 }, victim: { x: 500, y: 416 }, standingAnkle: { x: 500 - side * 7, y: 411.92 } };
    const saved = structuredClone(origins), opening = arenaSlideTripTargets(window, 1000, center, origins), until = opening.plannedHookAt + 1;
    let previous = opening;
    for (let at = 1016; at <= until; at += 16) {
      const frame = arenaSlideTripTargets(window, at, center, origins);
      const cap = frame.stage === 'approach' && previous.stage === 'approach' ? 190 : 240;
      assert.ok(distance(frame.driver, previous.driver) / .016 <= cap + 1e-6);
      assert.ok(side * (frame.driver.x - origins.driver.x) >= -1e-8, 'a close runner cannot back up to invent a runway');
      if (frame.stage === 'slide') assert.ok(side * (frame.driver.x - origins.victim.x) < 0, 'the leading foot hits from outside the victim instead of passing through the body');
      previous = frame;
    }
    for (const at of [opening.plannedLaunchAt, opening.plannedHookAt]) {
      const a = arenaSlideTripTargets(window, at - .001, center, origins), b = arenaSlideTripTargets(window, at + .001, center, origins);
      assert.ok(distance(a.driver, b.driver) < .001);
    }
    assert.deepEqual(origins, saved, 'sampling cannot rewrite actual actor origins');
  }
});

test('actual launch and ankle contact gates keep the uncontacted defender upright on the same footprint', () => {
  const origins = { driver: { x: 300, y: 416 }, victim: { x: 520, y: 416 }, standingAnkle: { x: 514, y: 411.92 } };
  const planned = arenaSlideTripTargets(window, 1000, center, origins);
  const waiting = arenaSlideTripTargets({ ...window, launchAt: null, hookAt: null, kickAt: null }, 6000, center, origins);
  assert.equal(waiting.stage, 'approach'); assert.equal(waiting.hookAt, null); assert.equal(waiting.canLaunch, true);
  assert.deepEqual(waiting.victim, origins.victim); assert.equal(waiting.victimAngle, 0);
  const sliding = arenaSlideTripTargets({ ...window, launchAt: planned.plannedLaunchAt, hookAt: null, kickAt: null }, 6000, center, origins);
  assert.equal(sliding.stage, 'slide'); assert.equal(sliding.canHook, true);
  assert.equal(sliding.victimPose, 'brace'); assert.equal(sliding.victimSlam, undefined); assert.deepEqual(sliding.victim, origins.victim);
});

test('one recorded ankle hook causes one fall, a complete rise, then a distinct real kick before the roll exit', () => {
  for (const side of [-1, 1]) {
    const origins = { driver: { x: 500 - side * 180, y: 416 }, victim: { x: 520, y: 416 }, hookVictim: { x: 523, y: 419 }, hookDriver: { x: 523 - side * 43, y: 419 }, kickTarget: { x: 523 - side * 8, y: 406 } };
    const recorded = { ...window, launchAt: 1500, hookAt: 1800, kickAt: null }, fallEnd = recorded.hookAt + ARENA_SLIDE_TRIP_TIMING.hook + ARENA_SLIDE_TRIP_TIMING.fall;
    let falls = 0, previousAngle = 0;
    for (let at = recorded.hookAt; at < fallEnd + 1200; at += 16) {
      const frame = arenaSlideTripTargets(recorded, at, center, origins, side);
      assert.deepEqual(frame.victim, origins.hookVictim, 'the fallen body never moves to a new staging mark');
      assert.ok(Math.abs(frame.victimAngle) + 1e-8 >= previousAngle, 'a single fall cannot stand up and fall again');
      if (previousAngle === 0 && Math.abs(frame.victimAngle) > 0) falls++;
      previousAngle = Math.abs(frame.victimAngle);
      if (at < fallEnd) assert.equal(frame.frontKick, undefined);
    }
    assert.equal(falls, 1);
    const kicking = arenaSlideTripTargets(recorded, fallEnd + ARENA_SLIDE_TRIP_TIMING.rise + 500, center, origins, side);
    assert.equal(kicking.stage, 'kick'); assert.equal(kicking.driverPose, 'trip'); assert.equal(kicking.frontKick, .62);
    assert.equal(kicking.kickAt, null, 'the strike pose cannot script an exit until its actual sole contact is recorded');
    const kickAt = fallEnd + ARENA_SLIDE_TRIP_TIMING.rise + 500, released = arenaSlideTripTargets({ ...recorded, kickAt }, kickAt, center, origins, side);
    assert.equal(released.stage, 'release'); assert.equal(released.requiredImpactAt, kickAt);
    assert.equal(released.frontKick, .62, 'recording contact does not jump to a fully retracted kick');
    assert.deepEqual(released.victim, kicking.victim);
  }
});
