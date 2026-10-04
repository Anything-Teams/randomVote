import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts', 'src/arenaKickCatch.ts'], bundle: true, format: 'esm', platform: 'node', write: false, outdir: 'out' });
const modules = await Promise.all(bundled.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)));
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts, arenaSpinSnapshot } = modules[0];
const { arenaKickCatchTargets } = modules[1];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fighter = values => ({ candidate: { id: 'kick', name: '발차기 선수', color: '#ffad72' }, index: 0, x: 552, y: 392, depthY: 416, scale: 2.04, facing: -1, pose: 'sidekick', angle: .2, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: .4, footTarget: { x: 512, y: 340 }, footStrength: 1, kickLeg: 1, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
const parts = contacts => [contacts.head, contacts.waist, ...contacts.shoulders, ...contacts.elbows, ...contacts.hands, ...contacts.feet];
function paint(actor, clock) {
  let matrix;
  const rectangles = [], vertices = [];
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'ellipse', 'fill', 'closePath'].map(key => [key, () => {}]));
  ctx.transform = (...values) => { matrix = values; };
  ctx.fillRect = (...values) => rectangles.push(values);
  ctx.moveTo = (x, y) => vertices.push({ x, y }); ctx.lineTo = ctx.moveTo;
  drawArenaFighter(ctx, actor, clock);
  const world = point => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
  return { contacts: actor.animation.contactPoints, skeleton: actor.animation.skeleton, matrix, rectangles, vertices, world };
}
function assertBones(actor, result) {
  for (let leg = 0; leg < 2; leg++) {
    const { hips, knees, feet } = result.skeleton;
    assert.ok(Math.abs(distance(result.world(hips[leg]), result.world(knees[leg])) - 11 * actor.scale) < .001, 'the caught thigh retains its complete normal bone');
    assert.ok(Math.abs(distance(result.world(knees[leg]), result.world(feet[leg])) - 11 * actor.scale) < .001, 'the caught and tucked shins cannot shrink during the turn');
  }
  for (let arm = 0; arm < 2; arm++) {
    const { shoulders, elbows, hands } = result.contacts;
    assert.ok(Math.abs(distance(shoulders[arm], elbows[arm]) - 11 * actor.scale) < .001);
    assert.ok(Math.abs(distance(elbows[arm], hands[arm]) - 10.5 * actor.scale) < .001);
  }
}

test('the two-palm ankle catch preserves the actual sidekick skeleton on its first frame', () => {
  for (const side of [-1, 1]) for (const kickLeg of [0, 1]) for (let index = 0; index < 10; index++) {
    const actor = fighter({ index, x: 500 + side * 52, facing: -side, angle: side * .2, kickLeg, footTarget: { x: 500 + side * 12, y: 340 } });
    const incoming = sampleArenaFighterContacts(actor, 1000), ankle = incoming.feet[kickLeg];
    const caught = { ...actor, footTarget: ankle, spinSuspension: { orbit: side < 0 ? Math.PI : 0, flatness: .94, weight: 0, gripLimb: 'feet', gripFoot: kickLeg, grips: [ankle, ankle] } };
    const result = paint(caught, 1000);
    parts(incoming).forEach((point, part) => assert.ok(distance(point, parts(result.contacts)[part]) < .001, 'catching the ankle cannot snap the head, arms, pelvis or other foot'));
    assert.ok(distance(result.contacts.feet[kickLeg], ankle) < 1e-8);
    assertBones(caught, result);
  }
});

test('one ankle remains in the two palms through exactly one full turn with complete limbs and full body width', () => {
  for (const side of [-1, 1]) for (const kickLeg of [0, 1]) for (const index of [0, 3, 6, 9]) {
    const initial = { catcher: { x: 500, y: 416 }, kicker: { x: 500 + side * 96, y: 416 }, kickLeg };
    const window = { start: 1000, end: 8000, launchAt: 1180, catchAt: 1480 };
    const incomingFrame = arenaKickCatchTargets({ ...window, catchAt: null }, window.catchAt, { x: 500, y: 416 }, initial, side);
    const incoming = fighter({ index, x: incomingFrame.kicker.x, y: incomingFrame.kicker.y - incomingFrame.kickerHeight, facing: incomingFrame.kickerFacing, angle: incomingFrame.kickerAngle, phase: incomingFrame.kickerPhase, kickLeg, footTarget: incomingFrame.footTarget, footStrength: incomingFrame.footStrength });
    const ankle = sampleArenaFighterContacts(incoming, window.catchAt).feet[kickLeg];
    const origins = { ...initial, caughtFoot: ankle, caughtKicker: incomingFrame.kicker, caughtCatcher: incomingFrame.catcher, caughtHeight: incomingFrame.kickerHeight };
    let previous, previousAngle, winding = 0;
    for (let age = 0; age <= 1420; age += 10) {
      const frame = arenaKickCatchTargets(window, window.catchAt + age, { x: 500, y: 416 }, origins, side);
      const actor = fighter({ index, x: frame.kicker.x, y: frame.kicker.y - frame.kickerHeight, facing: frame.kickerFacing, angle: frame.kickerAngle, phase: frame.kickerPhase, kickLeg, footTarget: frame.footTarget, footStrength: frame.footStrength, spinSuspension: { ...frame.spin, grips: frame.gripTargets } });
      const result = paint(actor, window.catchAt + age), midpoint = { x: (frame.gripTargets[0].x + frame.gripTargets[1].x) / 2, y: (frame.gripTargets[0].y + frame.gripTargets[1].y) / 2 };
      assert.ok(distance(result.contacts.feet[kickLeg], midpoint) < 1e-8, 'the selected painted ankle stays inside both palms');
      assert.ok(Math.abs(Math.hypot(result.matrix[0], result.matrix[1]) - actor.scale) < 1e-8, 'close palms cannot make the victim torso or shorts paper thin');
      assert.ok(Math.abs(Math.hypot(result.matrix[2], result.matrix[3]) - actor.scale) < 1e-8);
      assert.ok(result.matrix.every(Number.isFinite) && result.rectangles.flat().every(Number.isFinite) && result.vertices.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
      assertBones(actor, result);
      if (previous) parts(result.contacts).forEach((point, part) => assert.ok(distance(point, parts(previous)[part]) < 30, 'the loaded kick flows into the turn without a body or limb teleport'));
      if (age >= 220) {
        const angle = Math.atan2(result.matrix[3], result.matrix[2]);
        if (previousAngle !== undefined) winding += Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
        previousAngle = angle;
        const radial = { x: Math.cos(frame.spin.orbit) * .94, y: .06 + Math.sin(frame.spin.orbit) * .45 * .94 };
        const outward = { x: result.contacts.head.x - midpoint.x, y: result.contacts.head.y - midpoint.y };
        assert.ok(outward.x * radial.x + outward.y * radial.y > 40, 'the caught foot stays inward while the head and torso swing outward');
      }
      previous = structuredClone(result.contacts);
    }
    assert.ok(Math.abs(winding - side * Math.PI * 2) < 1e-8, 'the entire supported body turns once before release');
  }
});

test('the ankle spin snapshot releases the identical body and follows its flight root before normal landing', () => {
  for (const side of [-1, 1]) for (const gripFoot of [0, 1]) {
    const orbit = (side < 0 ? Math.PI : 0) + side * Math.PI * 2, center = { x: 500 + side * 18, y: 340 };
    const held = fighter({ facing: -side, kickLeg: gripFoot, spinSuspension: { orbit, flatness: .94, weight: 1, gripLimb: 'feet', gripFoot, grips: [{ x: center.x, y: center.y - 3 }, { x: center.x, y: center.y + 3 }] } });
    const contacts = sampleArenaFighterContacts(held, 3000), snapshot = arenaSpinSnapshot(held, 3000);
    const flight = fighter({ x: snapshot.origin.x, y: snapshot.origin.y, facing: -side, pose: 'airborne', angle: 1.2, footTarget: undefined, spinRelease: { snapshot, weight: 1 } });
    const released = paint(flight, 3000);
    parts(contacts).forEach((point, part) => assert.ok(distance(point, parts(released.contacts)[part]) < 1e-8, 'releasing the ankle preserves every actual painted endpoint'));
    assertBones(flight, released);
    const translated = sampleArenaFighterContacts({ ...flight, x: flight.x + side * 30, y: flight.y - 12 }, 3000);
    parts(contacts).forEach((point, part) => assert.ok(distance({ x: point.x + side * 30, y: point.y - 12 }, parts(translated)[part]) < 1e-8));
    const land = { ...flight, x: 760, y: 500, pose: 'land', spinRelease: { snapshot, weight: 0 } };
    assert.deepEqual(sampleArenaFighterContacts(land, 4000), sampleArenaFighterContacts({ ...land, spinRelease: undefined }, 4000));
  }
});


test('the spinning ankle holder releases from its actual loaded shoulders and retracts smoothly into guard', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const x = facing === 1 ? 516.26 : 483.74, y = 408.82;
    const reflected = point => ({ x: facing === 1 ? point.x : 1000 - point.x, y: point.y });
    const actor = fighter({ x, y, depthY: y, facing, index: 1, pose: 'throw', angle: 0, phase: 1, yaw: facing * Math.PI * 2, pivotTurn: facing * Math.PI * 2, ankleApproach: 1, ankleThrowProgress: 1, ankleSpinRaise: 0, footTarget: undefined, gripMode: 'ankle', gripLocked: true, gripStrength: 1, secondaryGripTarget: reflected({ x: 507.08, y: 316.82 }), gripTarget: reflected({ x: 525.44, y: 316.82 }), motionImmediate: false });
    const supported = structuredClone(paint(actor, 3000).contacts), motion = actor.animation.motion, hip = actor.animation.supportHip;
    const stance = { crouch: hip.y + 20, hipX: hip.x, lean: motion.lean, head: motion.head, shoulderLift: motion.shoulderLift, contact: motion.contact };
    assert.equal(stance.contact, 1, 'the fixture exercises a supporting far shoulder that moved forward for the ankle hold');
    const snapshot = { hands: supported.hands, elbows: supported.elbows, shoulders: supported.shoulders, direction: facing, stance };
    delete actor.gripTarget; delete actor.secondaryGripTarget;
    actor.gripStrength = 0; actor.carrierRelease = { ...snapshot, progress: 0 };
    const released = paint(actor, 3000);
    parts(supported).forEach((point, index) => assert.ok(distance(point, parts(released.contacts)[index]) < .001, 'opening both palms preserves the actual head, shoulders, elbows and material feet on the release frame'));
    let previous = structuredClone(released.contacts);
    for (let age = step; age <= 650 + step; age += step) {
      actor.carrierRelease.progress = Math.min(1, age / 650);
      const frame = paint(actor, 3000 + age);
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(frame.contacts.shoulders[arm], frame.contacts.elbows[arm]) - 11 * actor.scale) < .001);
        assert.ok(Math.abs(distance(frame.contacts.elbows[arm], frame.contacts.hands[arm]) - 10.5 * actor.scale) < .001);
      }
      parts(frame.contacts).forEach((point, index) => assert.ok(distance(point, parts(previous)[index]) < 8 + step * .9, 'the supporting shoulder returns gradually while both complete arms follow and retract'));
      previous = structuredClone(frame.contacts);
    }
    delete actor.carrierRelease; delete actor.ankleApproach; delete actor.ankleThrowProgress; delete actor.ankleSpinRaise; delete actor.pivotTurn; delete actor.yaw; delete actor.gripMode;
    actor.pose = 'guard'; actor.phase = 0;
    for (let age = 650 + 2 * step; age <= 1000; age += step) {
      const frame = paint(actor, 3000 + age);
      parts(frame.contacts).forEach((point, index) => assert.ok(distance(point, parts(previous)[index]) < 8 + step * .9, 'the final guarding arms do not restart a mirrored elbow branch'));
      previous = structuredClone(frame.contacts);
    }
    assert.ok(actor.animation.motion.contact < .01);
  }
});

test('the ankle spin blends face and back surfaces through each profile instead of swapping them in one frame', () => {
  function faceOpacity(actor, clock) {
    const stack = [], eyes = [];
    const ctx = new Proxy({ globalAlpha: 1, fillStyle: '', save() { stack.push({ alpha: this.globalAlpha, color: this.fillStyle }); }, restore() { const saved = stack.pop(); this.globalAlpha = saved.alpha; this.fillStyle = saved.color; }, fillRect() { if (this.fillStyle === '#172b37') eyes.push(this.globalAlpha); } }, { get: (object, key) => key in object ? object[key] : () => {}, set: (object, key, value) => (object[key] = value, true) });
    drawArenaFighter(ctx, actor, clock);
    return eyes[0] ?? 0;
  }
  for (const facing of [-1, 1]) for (const profile of [Math.PI / 2, Math.PI * 1.5]) {
    const alpha = [-.02, 0, .02].map(offset => faceOpacity(fighter({ facing, pose: 'throw', angle: 0, footTarget: undefined, gripMode: 'ankle', pivotTurn: profile + offset, yaw: profile + offset }), 1000));
    assert.ok(alpha.every(value => value > .3 && value < .7), 'both surfaces remain partially visible through the narrow profile');
    assert.ok(Math.abs(alpha[2] - alpha[0]) < .15, 'crossing the profile cannot abruptly erase the painted eyes');
  }
  for (const orbit of [0, Math.PI]) {
    const alpha = [-.02, 0, .02].map(offset => faceOpacity(fighter({ pose: 'stunned', angle: 0, footTarget: undefined, spinSuspension: { orbit: orbit + offset, flatness: 1, weight: 1, gripLimb: 'feet', gripBoth: true, grips: [{ x: 490.82, y: 324 }, { x: 509.18, y: 324 }] } }), 1000));
    assert.ok(alpha.every(value => value > .3 && value < .7));
    assert.ok(Math.abs(alpha[2] - alpha[0]) < .15);
  }
});

test('the ankle holder raises both real hands above its head with ordinary arm bones and grounded feet', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ x: 500, y: 416, depthY: 416, facing, pose: 'throw', angle: 0, phase: .8, footTarget: undefined, ankleThrowProgress: .8, ankleSpinRaise: 1, gripMode: 'ankle', gripLocked: true, gripStrength: 1, secondaryGripTarget: { x: 500 - facing * 9.18, y: 282 }, gripTarget: { x: 500 + facing * 9.18, y: 282 }, motionImmediate: false });
    for (let clock = 1000; clock <= 1200; clock += step) {
      const frame = paint(actor, clock);
      for (const [arm, target] of [actor.secondaryGripTarget, actor.gripTarget].entries()) {
        assert.ok(distance(frame.contacts.hands[arm], target) < .001, 'the high rotating body remains in the two actual palms');
        assert.ok(Math.abs(distance(frame.contacts.shoulders[arm], frame.contacts.elbows[arm]) - 11 * actor.scale) < .001);
        assert.ok(Math.abs(distance(frame.contacts.elbows[arm], frame.contacts.hands[arm]) - 10.5 * actor.scale) < .001);
        assert.ok(frame.contacts.hands[arm].y < frame.contacts.head.y + 10, 'the raised support is visibly at the head rather than a low waist carry');
      }
      assert.ok(actor.animation.motion.crouch < 2 && Math.abs(actor.animation.motion.lean) < 1, 'high support straightens the trunk instead of sinking into a deep squat');
      assert.ok(frame.contacts.feet.every(foot => foot.y <= 416 && foot.y >= 407), 'both supporting soles stay on the sand while the shoulders lift');
    }
  }
});
