import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/arenaSlideTrip.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaSlideTripOutcome, arenaSlideTripEvadeOutcome, arenaSlideTripTargets, ARENA_SLIDE_TRIP_CHANCE, ARENA_SLIDE_TRIP_EVADE_CHANCE, ARENA_SLIDE_TRIP_MIN_GAP, ARENA_SLIDE_TRIP_TIMING, ARENA_SLIDE_TRIP_JUMP_DURATION } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const center = { x: 500, y: 416 }, distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const window = { start: 1000, end: 8000 };

test('sliding trips use exactly two percent of one independent cosmetic roll', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaSlideTripOutcome(roll)).filter(Boolean).length, 1000 * ARENA_SLIDE_TRIP_CHANCE);
  for (const invalid of [-1, .2, 1000, NaN]) assert.throws(() => arenaSlideTripOutcome(invalid), RangeError);
});

test('jump dodges use a separate two percent branch among eligible slides', () => {
  assert.equal(Array.from({ length: 1000 }, (_, roll) => arenaSlideTripEvadeOutcome(roll)).filter(Boolean).length, 1000 * ARENA_SLIDE_TRIP_EVADE_CHANCE);
  for (const invalid of [-1, .2, 1000, NaN]) assert.throws(() => arenaSlideTripEvadeOutcome(invalid), RangeError);
});

test('a running slide requires the real starting gap and runway even with recorded or replayed clocks', () => {
  for (const side of [-1, 1]) for (const separation of [25, 100, ARENA_SLIDE_TRIP_MIN_GAP - 1, ARENA_SLIDE_TRIP_MIN_GAP, 180]) {
    const origins = { driver: { x: 500 - side * separation, y: 416 }, victim: { x: 500, y: 416 } };
    for (const recorded of [{ ...window }, { ...window, launchAt: 1000, hookAt: 1400, kickAt: 2400 }]) {
      const frame = arenaSlideTripTargets(recorded, 3000, center, origins, side);
      assert.equal(frame.canPerform, separation >= ARENA_SLIDE_TRIP_MIN_GAP);
      if (!frame.canPerform) {
        assert.deepEqual(frame.driver, origins.driver, 'an ineligible layout cannot move backwards or produce a slide');
        assert.equal(frame.canLaunch, false); assert.equal(frame.canHook, false); assert.equal(frame.canKick, false);
        assert.equal(Math.abs(frame.victimAngle), 0, 'a close layout never scripts an ankle hook even from recorded clocks');
      }
    }
  }
  const vertical = { driver: { x: 500, y: 286 }, victim: { x: 500, y: 416 } };
  assert.equal(arenaSlideTripTargets(window, 4000, center, vertical).canPerform, false, 'distance alone cannot invent a forward running runway');
});

test('a recorded two-foot dodge never hooks or kicks and returns both actors to the same sand footprints', () => {
  for (const side of [-1, 1]) {
    const origins = { driver: { x: 500 - side * 220, y: 416 }, victim: { x: 500, y: 416 } };
    const first = arenaSlideTripTargets({ ...window, evade: true }, window.start, center, origins, side);
    const launchAt = first.plannedLaunchAt, jumpAt = first.plannedJumpAt, passAt = first.plannedHookAt;
    const recorded = { ...window, evade: true, launchAt, jumpAt, passAt, hookAt: null, kickAt: null };
    let peak = 0, previous = arenaSlideTripTargets(recorded, window.start, center, origins, side);
    for (let clock = window.start + 16; clock < first.requiredEndAt + 200; clock += 16) {
      const frame = arenaSlideTripTargets(recorded, clock, center, origins, side);
      assert.equal(frame.hookAt, null); assert.equal(frame.kickAt, null); assert.equal(frame.canHook, false); assert.equal(frame.canKick, false);
      assert.deepEqual(frame.victim, origins.victim, 'the two-foot hop keeps its landing footprint inside the arena');
      assert.equal(frame.victimAngle, 0); assert.equal(frame.victimSlam, undefined, 'the dodging opponent never falls or becomes groggy');
      assert.ok(distance(frame.driver, previous.driver) / .016 <= 240 + 1e-6, 'the missed slide and recovery remain bounded');
      peak = Math.max(peak, frame.victimHeight); previous = frame;
    }
    assert.ok(peak > 91 && peak <= 92);
    const passing = arenaSlideTripTargets(recorded, passAt, center, origins, side);
    assert.equal(passing.stage, 'pass'); assert.ok(passing.victimHeight > 70 && passing.victimJumpTuck > .6, 'both knees are raised when the slide reaches the ankle line');
    const recovered = arenaSlideTripTargets(recorded, first.requiredEndAt + 200, center, origins, side);
    assert.equal(recovered.recovered, true); assert.equal(recovered.driverPose, 'guard'); assert.equal(recovered.victimPose, 'guard'); assert.equal(recovered.victimHeight, 0);
    assert.equal(recovered.landingAt - jumpAt, ARENA_SLIDE_TRIP_JUMP_DURATION);
  }
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

test('the low slide begins with room left and carries running momentum through a visible ground journey', () => {
  for (const side of [-1, 1]) {
    const origins = { driver: { x: 500 - side * 280, y: 416 }, victim: { x: 500, y: 416 }, standingAnkle: { x: 500 - side * 7, y: 411.92 } };
    const opening = arenaSlideTripTargets(window, window.start, center, origins, side);
    const recorded = { ...window, launchAt: opening.plannedLaunchAt, hookAt: null, kickAt: null };
    const before = arenaSlideTripTargets(recorded, recorded.launchAt - .001, center, origins, side);
    const entered = arenaSlideTripTargets(recorded, recorded.launchAt, center, origins, side);
    const lowered = arenaSlideTripTargets(recorded, recorded.launchAt + 180, center, origins, side);
    const stopped = arenaSlideTripTargets(recorded, opening.plannedHookAt, center, origins, side);
    assert.equal(entered.driverPose, 'slide');
    assert.ok(distance(entered.driver, origins.standingAnkle) > 120, 'the seated slide starts well outside ankle reach');
    assert.ok(distance(before.driverVelocity, entered.driverVelocity) < .001, 'the slide inherits the committed running speed without braking to a stop');
    assert.ok(distance(before.driver, entered.driver) < .001, 'changing pose cannot move the root');
    assert.equal(lowered.slideProgress, 1);
    assert.ok(distance(lowered.driver, origins.standingAnkle) > 85, 'the body is already low while substantial travel remains');
    assert.ok(distance(lowered.driver, entered.driver) > 30, 'lowering happens during real forward ground travel');
    assert.ok(distance(stopped.driver, entered.driver) > 80, 'the foot reaches the rival after a visible slide, not an immediate hook');
    assert.ok(distance(lowered.driverVelocity, { x: 0, y: 0 }) < distance(entered.driverVelocity, { x: 0, y: 0 }), 'ground friction reduces momentum after entry');
    assert.deepEqual(stopped.victim, origins.victim); assert.equal(Math.abs(stopped.victimAngle), 0); assert.equal(stopped.victimPose, 'brace', 'the travel alone cannot script the fall');
  }
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

test('ordinary and jump-evaded slides label the actual attacking run as 돌진!', async () => {
  const sources = await Promise.all(['src/arenaLogic.ts', 'src/arenaStoryLogic.ts'].map(async entry => {
    const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  }));
  const [{ arenaActionWords }, { arenaStoryState }] = sources;
  for (const evade of [false, true]) {
    const round = { id: 'slide-words', index: 0, tactic: 'trip', aggressor: 'a', victim: 'v', start: 1000, impact: 7000, resolve: 8100, end: 8100, final: false, timeScale: 1,
      slideTrip: { start: 1000, end: 7000, evade, launchAt: null, hookAt: null, kickAt: null, jumpAt: null, passAt: null } };
    assert.deepEqual(arenaActionWords(round, 1300), [{ id: 'a', word: '돌진!' }]);
    const running = arenaStoryState(round, 1300);
    assert.equal(running.label, '돌진!'); assert.equal(running.steps[running.step], '돌진!');
    const lowered = { ...round, slideTrip: { ...round.slideTrip, launchAt: 1800 } };
    assert.equal(arenaActionWords(lowered, 1950)[0].word, '슬라이딩!', 'the running word ends when the grounded slide starts');
  }
});
