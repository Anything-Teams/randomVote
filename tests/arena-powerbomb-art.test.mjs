import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { drawArenaFighter, createArenaFighterAnimation, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const { arenaWrestlingMoveTargets, ARENA_POWERBOMB_TIMING: timing } = await source('src/arenaWrestlingMoves.ts');
const { arenaTechniqueTargets } = await source('src/arenaTechniques.ts');
const center = { x: 500, y: 416 }, floorAge = timing.load + timing.lift + timing.hold + timing.slam;
const legacy = { id: 'existing-overhead', index: 0, aggressor: 'a', victim: 'v', tactic: 'suplex', start: 1000, impact: 5100, resolve: 9200, end: 11000, final: false };
const fighter = values => ({ candidate: { id: 'a', name: '선수', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, phase: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const points = rig => [rig.head, ...rig.headSides, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
function paint(actor, clock) {
  const noop = () => {}, eyes = []; let matrix;
  const ctx = new Proxy({ globalAlpha: 1, fillStyle: '', transform(...value) { matrix = value; }, fillRect(_x, _y, width, height) { if (this.fillStyle === '#172b37' && width === 1.8) eyes.push(height); } }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
  drawArenaFighter(ctx, actor, clock);
  const rig = structuredClone(actor.animation.contactPoints), skeleton = structuredClone(actor.animation.skeleton);
  assert.ok(matrix.every(Number.isFinite) && points(rig).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.ok(Math.abs(Math.hypot(matrix[0], matrix[1]) - actor.scale) < .001, 'the overhead body cannot become paper thin');
  assert.ok(skeleton.shorts.every(panel => panel.length === 4 && panel.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))), 'both connected shorts panels remain finite');
  return { rig, skeleton, eyes, matrix };
}
function sequence(side) {
  const initial = { driver: { x: 500, y: 416 }, victim: { x: 500 + side * 200, y: 416 } };
  const pending = { kind: 'powerbomb', start: 1000, end: 11000, launchAt: null, contactAt: null, releaseAt: null, ankleGripAt: null };
  const opening = arenaWrestlingMoveTargets(pending, pending.start, center, initial, side);
  const actual = { ...pending, launchAt: opening.plannedLaunchAt };
  const launch = arenaWrestlingMoveTargets(actual, actual.launchAt, center, initial, side);
  initial.launchDriver = launch.driver; initial.launchVictim = launch.victim;
  const caught = arenaWrestlingMoveTargets(actual, opening.plannedContactAt, center, initial, side);
  initial.contactDriver = caught.driver; initial.contactVictim = caught.victim;
  actual.contactAt = opening.plannedContactAt;
  return age => ({ clock: actual.contactAt + age, frame: arenaWrestlingMoveTargets(actual, actual.contactAt + age, center, initial, side) });
}
function apply(frame, victim, driver) {
  Object.assign(victim, { x: frame.victim.x, y: frame.victim.y - frame.victimHeight, depthY: frame.victim.y, facing: frame.victimFacing, pose: frame.victimPose, phase: frame.victimPhase, angle: frame.victimAngle, suspension: frame.victimSuspension, slamProgress: frame.victimSlam, overheadSlam: true, eyesClosed: frame.victimEyesClosed, carryStretch: frame.victimCarryStretch, powerbombVictim: frame.powerbombVictim, powerbombLoad: frame.powerbombLoad, powerbombLift: frame.powerbombLift, powerbombDown: frame.powerbombDown });
  Object.assign(driver, { x: frame.driver.x, y: frame.driver.y, depthY: frame.driver.y, facing: frame.driverFacing, pose: frame.driverPose, phase: frame.driverPhase, overheadRaise: frame.overheadRaise, gripMode: frame.gripMode, gripStrength: frame.gripStrength, gripLocked: true, powerbombLoad: frame.powerbombLoad, powerbombLift: frame.powerbombLift, powerbombDown: frame.powerbombDown });
}
function grip(driver, victim, clock, side) {
  const waist = sampleArenaFighterContacts(victim, clock).waist;
  driver.gripTarget = driver.gripStrength > 0 ? waist : undefined;
  driver.secondaryGripTarget = driver.gripStrength > 0 ? { x: waist.x - side * 6, y: waist.y + 3 } : undefined;
}

test('the received overhead slam uses the existing suplex body, supporting arms and floor rig in both headings', () => {
  const ages = [timing.load, timing.load + timing.lift * .25, timing.load + timing.lift * .5, timing.load + timing.lift, timing.load + timing.lift + timing.hold / 2, timing.load + timing.lift + timing.hold + timing.slam * .25, timing.load + timing.lift + timing.hold + timing.slam * .5, floorAge, floorAge + timing.recover / 2, floorAge + timing.recover];
  for (const side of [-1, 1]) for (const index of [0, 4, 9]) {
    const at = sequence(side);
    for (const age of ages) {
      const { frame, clock } = at(age), victim = fighter({ index, motionImmediate: true }), driver = fighter({ index: (index + 1) % 10, motionImmediate: true });
      apply(frame, victim, driver); grip(driver, victim, clock, side);
      const ordinary = arenaTechniqueTargets({ ...legacy, contactSide: side }, legacy.start + (legacy.impact - legacy.start) * frame.driverPhase, center);
      const referenceVictim = fighter({ ...victim, animation: createArenaFighterAnimation(), pose: ordinary.victimPose ?? 'brace', angle: ordinary.victimAngle, suspension: ordinary.victimSuspension, slamProgress: ordinary.victimSlam, overheadSlam: true, carryStretch: undefined, powerbombVictim: undefined });
      const referenceDriver = fighter({ ...driver, animation: createArenaFighterAnimation(), pose: ordinary.aggressorPose ?? 'guard', overheadRaise: ordinary.aggressorOverheadRaise, powerbombLoad: undefined, powerbombLift: undefined, powerbombDown: undefined });
      assert.ok(Math.abs(frame.victimHeight - ordinary.lift) < 1e-8); assert.ok(Math.abs(frame.victimAngle - ordinary.victimAngle) < 1e-8);
      for (const [actual, expected] of [[victim, referenceVictim], [driver, referenceDriver]]) {
        const one = paint(actual, clock), two = paint(expected, clock);
        points(one.rig).forEach((point, part) => assert.ok(distance(point, points(two.rig)[part]) < 1e-8, `side ${side}, body ${index}, age ${age}, ${actual === victim ? 'victim' : 'driver'} point ${part} follows the existing overhead rig`));
        for (const field of ['hips', 'knees', 'feet', 'pelvis']) one.skeleton[field].forEach((point, part) => assert.ok(distance(point, two.skeleton[field][part]) < 1e-8, `${field} uses the existing connected skeleton`));
        one.skeleton.shorts.forEach((panel, leg) => panel.forEach((point, part) => assert.ok(distance(point, two.skeleton.shorts[leg][part]) < 1e-8, 'both shorts cuffs follow the same thigh')));
        one.skeleton.footAngles.forEach((angle, leg) => assert.ok(Math.abs(angle - two.skeleton.footAngles[leg]) < 1e-8));
      }
      assert.equal(victim.animation.powerbombRearLeg, undefined); assert.equal(driver.animation.cradleForearm, undefined, 'the old seated straddle support cannot paint over the reused overhead arms');
    }
  }
});

test('the reused lift and accelerating shoulder drop retain continuous complete limbs at 16 and 50 ms', () => {
  for (const side of [-1, 1]) for (const step of [16, 50]) {
    const at = sequence(side), victim = fighter({ index: 1 }), driver = fighter({ index: 0 });
    const referenceVictim = fighter({ index: 1 }), referenceDriver = fighter({ index: 0 });
    let previous;
    for (let age = timing.load; age <= floorAge + timing.recover; age += step) {
      const { frame, clock } = at(age); apply(frame, victim, driver); grip(driver, victim, clock, side);
      const painted = [paint(victim, clock), paint(driver, clock)];
      const ordinary = arenaTechniqueTargets({ ...legacy, contactSide: side }, legacy.start + (legacy.impact - legacy.start) * frame.driverPhase, center);
      const victimAnimation = referenceVictim.animation, driverAnimation = referenceDriver.animation;
      Object.assign(referenceVictim, victim, { animation: victimAnimation, pose: ordinary.victimPose ?? 'brace', angle: ordinary.victimAngle, suspension: ordinary.victimSuspension, slamProgress: ordinary.victimSlam, overheadSlam: true, carryStretch: undefined, powerbombVictim: undefined });
      Object.assign(referenceDriver, driver, { animation: driverAnimation, pose: ordinary.aggressorPose ?? 'guard', overheadRaise: ordinary.aggressorOverheadRaise, gripMode: ordinary.grip, gripStrength: ordinary.grip ? 1 : 0 });
      grip(referenceDriver, referenceVictim, clock, side);
      const reference = [paint(referenceVictim, clock), paint(referenceDriver, clock)];
      for (let role = 0; role < 2; role++) {
        const actor = role ? driver : victim, body = painted[role];
        points(body.rig).forEach((point, part) => assert.ok(distance(point, points(reference[role].rig)[part]) < 1e-8, 'continuous received and existing overhead motion retain the same painted joints'));
        if (previous) points(body.rig).forEach((point, part) => assert.ok(distance(point, points(previous[role].rig)[part]) < 8 + step * .9, `the connected ${role ? 'supporter' : 'falling body'} cannot reset at a lift, release or floor boundary (${age}, part ${part}, ${distance(point, points(previous[role].rig)[part]).toFixed(3)}px)`));
        const raise = actor.pose === 'overhead' ? actor.overheadRaise : 0;
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(Math.abs(distance(body.rig.shoulders[arm], body.rig.elbows[arm]) - actor.scale * (11 + 3 * raise)) < .001, 'the same complete overhead upper arm stays connected');
          assert.ok(Math.abs(distance(body.rig.elbows[arm], body.rig.hands[arm]) - actor.scale * (10.5 + 3.5 * raise)) < .001, 'the same complete overhead forearm stays connected');
          if (!role) {
            const shoulder = body.rig.shoulders[arm], elbow = body.rig.elbows[arm], hand = body.rig.hands[arm];
            const upper = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y }, lower = { x: hand.x - elbow.x, y: hand.y - elbow.y };
            const opening = Math.PI - Math.abs(Math.atan2(upper.x * lower.y - upper.y * lower.x, upper.x * lower.x + upper.y * lower.y));
            assert.ok(opening >= .35 - 1e-6, 'the protective elbow keeps anatomical room instead of folding its hand into its shoulder');
          }
        }
        if (!role) for (let leg = 0; leg < 2; leg++) {
          const lengths = [distance(body.skeleton.hips[leg], body.skeleton.knees[leg]), distance(body.skeleton.knees[leg], body.skeleton.feet[leg])];
          assert.ok(lengths.every(length => length >= 7 && length <= 11.001), `the lift keeps both adult leg sections (${age}, ${leg}: ${lengths})`);
          if (victim.slamProgress.tuck === 1) assert.ok(lengths.every(length => Math.abs(length - 11) < .001), 'the fully lifted and falling bones keep their complete lengths');
        }
      }
      if (age >= timing.load + timing.lift + timing.hold && age < floorAge) {
        assert.equal(frame.gripStrength, 0, 'the physical waist grip ends at the original drop clock while the shoulders ease open');
        if (age < timing.load + timing.lift + timing.hold + 150) assert.ok(driver.animation.motion.contact > 0 && driver.animation.motion.contact < 1, 'the released shoulder and arm retain fading inertia rather than resetting');
      }
      assert.ok(painted[0].eyes.every(height => height === (age < floorAge ? 1.8 : .7)), 'the lifted opponent closes its eyes on the floor impact');
      previous = painted;
    }
  }
});

test('the shoulder impact keeps the tucked body before its existing limp floor relaxation', () => {
  for (const side of [-1, 1]) {
    const at = sequence(side), victim = fighter({ index: 1, motionImmediate: true }), driver = fighter({ motionImmediate: true });
    const high = at(timing.load + timing.lift + timing.hold / 2); apply(high.frame, victim, driver);
    const raised = paint(victim, high.clock);
    assert.ok(raised.rig.shoulders.every(point => point.y < high.frame.victim.y - 14));
    assert.ok(raised.skeleton.feet.every((foot, leg) => foot.y > raised.skeleton.knees[leg].y + 7), 'the legs hang below the lifted waist rather than seating across the receiving shoulders');
    const hit = at(floorAge); apply(hit.frame, victim, driver);
    const impact = paint(victim, hit.clock);
    assert.equal(victim.slamProgress.slump, 0); assert.equal(hit.frame.slamImpact, 1);
    assert.ok(Math.max(...impact.rig.shoulders.map(point => point.y)) > hit.frame.victim.y - 12, 'the shoulder reaches the sand at the impact');
    assert.ok(impact.eyes.every(height => height === .7));
    const rest = at(floorAge + timing.recover); apply(rest.frame, victim, driver);
    const flat = paint(victim, rest.clock);
    assert.equal(victim.slamProgress.slump, 1);
    assert.ok(Math.abs(flat.rig.head.y - flat.rig.waist.y) < 14, 'the unconscious head and torso stay low on the sand');
    assert.equal(rest.frame.canRelease, false, 'the floor recovery cannot skip the actual two-ankle hold and full-turn finish');
  }
});
