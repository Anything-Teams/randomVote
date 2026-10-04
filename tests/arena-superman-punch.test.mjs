import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/arenaSupermanPunch.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaSupermanPunchOutcome, arenaSupermanPunchTargets, ARENA_SUPERMAN_PUNCH_CHANCE, ARENA_SUPERMAN_PUNCH_TIMING: timing } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const center = { x: 500, y: 416 }, window = { start: 1000, end: 8000 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const originsFor = side => ({ driver: { x: 500 - side * 180, y: 421 }, victim: { x: 500 + side * 20, y: 416 }, target: { x: 500 + side * 20, y: 319 } });
const inside = point => Math.hypot((point.x - 500) / 293, (point.y - 416) / 102) <= 1 + 1e-9;

test('superman punches use exactly one in one thousand independent cosmetic rolls', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaSupermanPunchOutcome(roll)).filter(Boolean).length, 1000 * ARENA_SUPERMAN_PUNCH_CHANCE);
  for (const invalid of [-1, .5, 1000, Infinity, NaN]) assert.throws(() => arenaSupermanPunchOutcome(invalid), RangeError);
});

test('a genuine run brakes and plants before one bounded leap in either direction', () => {
  for (const side of [-1, 1]) {
    const origins = originsFor(side), saved = structuredClone(origins);
    const first = arenaSupermanPunchTargets(window, window.start, center, origins, side);
    assert.equal(first.canPerform, true);
    let previous = first, maxHeight = 0;
    for (let at = window.start + 8; at <= first.landingAt + timing.land + timing.recover; at += 8) {
      const frame = arenaSupermanPunchTargets(window, at, center, origins, side);
      const speed = distance(previous.driver, frame.driver) / .008;
      assert.ok(speed <= (frame.stage === 'approach' ? 190 : 240) + 1e-6, `${frame.stage} ground speed is bounded: ${speed}`);
      assert.ok(side * (frame.driver.x - previous.driver.x) >= -1e-8, 'no backwards staging or midair reversal');
      assert.ok(inside(frame.driver), 'the attacking ground footprint remains inside the arena');
      assert.deepEqual(frame.victim, origins.victim, 'the defender cannot move before the Scene records the punch');
      if (frame.stage === 'load') assert.equal(frame.height, 0);
      maxHeight = Math.max(maxHeight, frame.height); previous = frame;
    }
    assert.ok(maxHeight > 23.98 && maxHeight <= 24);
    assert.equal(arenaSupermanPunchTargets(window, first.plannedLaunchAt + timing.air / 2, center, origins, side).height, 24);
    assert.deepEqual(origins, saved);
    const landing = arenaSupermanPunchTargets(window, first.landingAt, center, origins, side);
    assert.equal(landing.height, 0); assert.equal(landing.driverPose, 'land');
    assert.deepEqual(landing.driver, { x: origins.victim.x - side * 54, y: origins.victim.y });
    for (const at of [first.plannedLaunchAt - timing.load, first.plannedLaunchAt, first.landingAt]) {
      const before = arenaSupermanPunchTargets(window, at - .001, center, origins, side), after = arenaSupermanPunchTargets(window, at + .001, center, origins, side);
      assert.ok(distance(before.driver, after.driver) < .001);
      assert.ok(Math.abs(before.height - after.height) < .001);
    }
  }
});

test('an actual takeoff gate holds the complete plant and shifts the full flight clock', () => {
  const origins = originsFor(1), first = arenaSupermanPunchTargets(window, window.start, center, origins);
  const waiting = arenaSupermanPunchTargets({ ...window, launchAt: null, hitAt: null }, first.plannedLaunchAt + 3000, center, origins);
  assert.equal(waiting.launchAt, null); assert.equal(waiting.stage, 'load'); assert.equal(waiting.height, 0);
  assert.equal(waiting.loadProgress, 1); assert.equal(waiting.canLaunch, true); assert.equal(waiting.canHit, false);
  const actualLaunch = first.plannedLaunchAt + 800, actualOrigins = { ...origins, launchOrigin: waiting.driver };
  const takeoff = arenaSupermanPunchTargets({ ...window, launchAt: actualLaunch, hitAt: null }, actualLaunch, center, actualOrigins);
  assert.equal(takeoff.stage, 'jump'); assert.equal(takeoff.driverPhase, 0); assert.equal(takeoff.height, 0);
  assert.deepEqual(takeoff.driver, waiting.driver); assert.equal(takeoff.landingAt, actualLaunch + timing.air);
});

test('recorded takeoff remains authoritative for narration without the captured shorter runway', () => {
  const actualLaunch = window.start + 400;
  const narrated = arenaSupermanPunchTargets({ ...window, launchAt: actualLaunch, hitAt: null }, actualLaunch + 250, center);
  assert.equal(narrated.launchAt, actualLaunch); assert.equal(narrated.stage, 'punch');
  assert.equal(narrated.driverPhase, .5); assert.equal(narrated.landingAt, actualLaunch + timing.air);
});

test('the captured longer runway plan keeps narration in approach until the actual plant starts', () => {
  const origins = { driver: { x: 300, y: 416 }, victim: { x: 700, y: 416 } };
  const actual = arenaSupermanPunchTargets({ ...window, launchAt: null, hitAt: null }, window.start, center, origins);
  const captured = { ...window, launchAt: null, hitAt: null, plannedLaunchAt: actual.plannedLaunchAt };
  const loadAt = actual.plannedLaunchAt - timing.load;
  const approach = arenaSupermanPunchTargets(captured, loadAt - 1, center);
  const loading = arenaSupermanPunchTargets(captured, loadAt + timing.load / 2, center);
  assert.equal(approach.stage, 'approach'); assert.equal(approach.loadProgress, 0);
  assert.equal(loading.stage, 'load'); assert.equal(loading.loadProgress, .5);
  assert.equal(loading.plannedLaunchAt, actual.plannedLaunchAt); assert.equal(loading.canLaunch, false);
  assert.equal(arenaSupermanPunchTargets(captured, actual.plannedLaunchAt, center).canLaunch, true);
});

test('the punch extends near the leap peak and only actual aerial contact may launch a defender', () => {
  const origins = originsFor(1), first = arenaSupermanPunchTargets(window, window.start, center, origins);
  const launchAt = first.plannedLaunchAt, live = { ...window, launchAt, hitAt: null };
  const early = arenaSupermanPunchTargets(live, launchAt + timing.extendStart, center, origins);
  const peak = arenaSupermanPunchTargets(live, launchAt + timing.extendEnd, center, origins);
  assert.equal(early.punchProgress, 0); assert.equal(early.canHit, false);
  assert.equal(peak.punchProgress, 1); assert.equal(peak.canHit, true); assert.equal(peak.driverPose, 'superman');
  assert.ok(peak.height > 23.9); assert.deepEqual(peak.punchTarget, origins.target);
  const hitAt = launchAt + 255, contact = arenaSupermanPunchTargets({ ...live, hitAt }, hitAt, center, origins);
  const before = arenaSupermanPunchTargets(live, hitAt, center, origins);
  assert.deepEqual(contact.driver, before.driver); assert.equal(contact.height, before.height);
  assert.equal(contact.requiredImpactAt, hitAt); assert.equal(contact.canHit, false);
  const after = arenaSupermanPunchTargets({ ...live, hitAt }, hitAt + 70, center, { ...origins, hitDriver: contact.driver });
  assert.ok(after.driver.x > contact.driver.x, 'recording a hit cannot freeze the attacker in the air');
  assert.deepEqual(after.victim, origins.victim);
});

test('a missed punch lands and recovers on time instead of hovering for a contact that never happened', () => {
  const origins = originsFor(-1), first = arenaSupermanPunchTargets(window, window.start, center, origins, -1);
  const live = { ...window, launchAt: first.plannedLaunchAt, hitAt: null };
  const landed = arenaSupermanPunchTargets(live, first.landingAt, center, origins, -1);
  assert.equal(landed.stage, 'land'); assert.equal(landed.canHit, false); assert.equal(landed.height, 0);
  const recovered = arenaSupermanPunchTargets(live, first.landingAt + timing.land + timing.recover, center, origins, -1);
  assert.equal(recovered.stage, 'recover'); assert.equal(recovered.driverPose, 'guard'); assert.equal(recovered.active, false);
  assert.deepEqual(recovered.driver, landed.driver); assert.deepEqual(recovered.victim, origins.victim);
});

test('close or unsafe origins decline the trick without manufacturing a runway or crossing an arena edge', () => {
  for (const origins of [
    { driver: { x: 475, y: 416 }, victim: { x: 520, y: 416 } },
    { driver: { x: 460, y: 416 }, victim: { x: 520, y: 416 } },
    { driver: { x: 300, y: 416 }, victim: { x: 500, y: 516 } },
    { driver: { x: 180, y: 416 }, victim: { x: 520, y: 416 } },
  ]) {
    const frame = arenaSupermanPunchTargets({ ...window, launchAt: null, hitAt: null }, 6000, center, origins);
    assert.equal(frame.canPerform, false); assert.equal(frame.canLaunch, false); assert.equal(frame.canHit, false);
    assert.deepEqual(frame.driver, origins.driver); assert.equal(frame.height, 0);
  }
});
