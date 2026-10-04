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
