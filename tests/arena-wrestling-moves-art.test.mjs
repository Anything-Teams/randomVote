import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts, arenaCarryHolderPoint, arenaReleaseSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'a', name: 'a', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const points = contacts => [contacts.head, contacts.back, contacts.waist, ...contacts.headSides, ...contacts.shoulders, ...contacts.elbows, ...contacts.hands, ...contacts.feet];
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
function bones(actor, result, upper = 11, lower = 10.5) {
  for (let leg = 0; leg < 2; leg++) {
    const { hips, knees, feet } = result.skeleton;
    if (actor.animation.airborne) {
      assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001);
      assert.ok(Math.abs(distance(knees[leg], feet[leg]) - 11) < .001, 'each connected airborne shin keeps its complete bone');
    } else {
      assert.ok(distance(hips[leg], knees[leg]) >= 4 && distance(hips[leg], knees[leg]) <= 11.001, 'depthward loading preserves the existing forward knee projection');
      assert.ok(distance(knees[leg], feet[leg]) >= 4 && distance(knees[leg], feet[leg]) <= 11.001, 'the planted lower leg keeps a complete visible connected section');
    }
  }
  for (let arm = 0; arm < 2; arm++) {
    const { shoulders, elbows, hands } = result.contacts;
    assert.ok(Math.abs(distance(shoulders[arm], elbows[arm]) - upper * actor.scale) < .001, 'contact does not stretch the upper arm');
    assert.ok(Math.abs(distance(elbows[arm], hands[arm]) - lower * actor.scale) < .001, 'contact does not shrink or stretch the forearm');
  }
  assert.ok(result.matrix.every(Number.isFinite) && result.rectangles.flat().every(Number.isFinite) && result.vertices.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.ok(Math.abs(Math.hypot(result.matrix[0], result.matrix[1]) - actor.scale) < 1e-8, 'the complete body and shorts retain adult width');
}

test('a dropkick contacts both distinct chest points with two complete extending legs', () => {
  for (const facing of [-1, 1]) for (let index = 0; index < 10; index++) {
    const actor = fighter({ index, facing, y: 362, pose: 'dropkick', dropkickProgress: .45, phase: .45, yaw: 1.4 });
    const targets = [{ x: actor.x + facing * 29, y: actor.y - 39 }, { x: actor.x + facing * 29, y: actor.y - 25 }];
    actor.footTargets = targets; actor.feetStrength = 1;
    const result = paint(actor, 1000);
    targets.forEach((target, leg) => assert.ok(distance(result.contacts.feet[leg], target) < .001, 'each actual sole reaches its own chest contact'));
    assert.ok(distance(result.contacts.feet[0], result.contacts.feet[1]) > 12, 'the two striking legs remain distinct');
    assert.equal(actor.animation.airborne, true);
    bones(actor, result);
    actor.footTargets = targets.map(point => ({ x: point.x + facing * 200, y: point.y }));
    const far = paint(actor, 1016);
    bones(actor, far);
    assert.ok(far.contacts.feet.every((point, leg) => distance(point, actor.footTargets[leg]) > 150), 'an unreachable kick cannot lengthen either leg');
  }
});

test('a two-foot jump keeps the planted launch and returns both complete legs to the same landing', () => {
  for (const facing of [-1, 1]) {
    const actor = fighter({ facing, motionImmediate: false });
    const planted = paint(actor, 1000).contacts;
    actor.pose = 'dropkick'; actor.dropkickProgress = 0;
    const first = paint(actor, 1016);
    points(planted).forEach((point, part) => assert.ok(distance(point, points(first.contacts)[part]) < .001, 'the takeoff cannot snap either foot or the upper body'));
    let previous = first.contacts;
    for (let frame = 1; frame <= 60; frame++) {
      actor.dropkickProgress = frame / 60; actor.phase = frame / 60;
      const result = paint(actor, 1016 + frame * 10);
      bones(actor, result);
      result.contacts.feet.forEach((foot, leg) => assert.ok(distance(foot, previous.feet[leg]) < 7, 'each knee chambers and extends through one continuous arc'));
      previous = structuredClone(result.contacts);
    }
    const final = paint(actor, 1616).contacts;
    actor.pose = 'land'; actor.phase = 0;
    const landed = paint(actor, 1632).contacts;
    final.feet.forEach((foot, leg) => assert.ok(distance(foot, landed.feet[leg]) < 1, 'both actual soles keep the same root when the airborne kick lands'));
  }
});

test('a bulldog grips the actual painted head sides with ordinary arms even as both bodies turn onto the floor', () => {
  for (const facing of [-1, 1]) for (const angle of [0, .3, .8, Math.PI * .47]) for (const suspension of [0, 1]) {
    const driver = fighter({ facing, pose: 'bulldog', bulldogProgress: .5, angle: facing * angle, suspension, gripMode: 'head' });
    const free = paint(driver, 1000), center = { x: (free.contacts.shoulders[0].x + free.contacts.shoulders[1].x) / 2, y: (free.contacts.shoulders[0].y + free.contacts.shoulders[1].y) / 2 };
    const victim = fighter({ index: 1, pose: 'held', angle: facing * angle, suspension: 1, facing });
    let sides = sampleArenaFighterContacts(victim, 1000).headSides;
    const middle = { x: (sides[0].x + sides[1].x) / 2, y: (sides[0].y + sides[1].y) / 2 };
    const offset = { x: Math.cos(angle) * facing * 15 + Math.sin(angle) * 9, y: Math.sin(angle) * 15 - Math.cos(angle) * 9 };
    victim.x += center.x + offset.x - middle.x; victim.y += center.y + offset.y - middle.y;
    sides = sampleArenaFighterContacts(victim, 1000).headSides;
    Object.assign(driver, { gripTarget: sides[1], secondaryGripTarget: sides[0], gripStrength: 1, gripLocked: true });
    const result = paint(driver, 1000);
    sides.forEach((point, arm) => assert.ok(distance(result.contacts.hands[arm], point) < .001, 'both real palms stay on the head after final floor-aware projection'));
    bones(driver, result);
    assert.ok(distance(sides[0], sides[1]) > 25, 'head supports correspond to the visible skull width');
  }
});

test('back body drop and both waist slams load and extend through complete planted legs', () => {
  for (const pose of ['backbodydrop', 'spinebuster', 'scoopslam']) for (const facing of [-1, 1]) for (const index of [0, 3, 6, 9]) {
    const actor = fighter({ index, facing, pose, motionImmediate: false });
    let previous;
    for (let frame = 0; frame <= 80; frame++) {
      const progress = frame / 80;
      Object.assign(actor, { backBodyProgress: progress, spinebusterProgress: progress, scoopSlamProgress: progress });
      const result = paint(actor, 1000 + frame * 10);
      bones(actor, result);
      assert.equal(actor.animation.airborne, false, 'the catcher and floor-slam driver keep supporting the load on the sand');
      assert.ok(actor.animation.feet.every(foot => foot.lift === 0));
      if (previous) {
        result.contacts.feet.forEach((foot, leg) => assert.ok(distance(foot, previous.feet[leg]) < .001, 'loading and throwing cannot lift a planted heel'));
        assert.ok(distance(result.contacts.back, previous.back) < 4, 'the hip/back loading point moves continuously into the lifting stroke');
      }
      previous = structuredClone(result.contacts);
    }
  }
});

test('shared throw release starts at all actual supported palms then lowers both connected arms in the throw direction', () => {
  const smooth = value => value * value * (3 - 2 * value);
  for (const side of [-1, 1]) for (const gripMode of ['shoulder', 'ankle']) {
    const victim = fighter({ index: 2, pose: 'carried', carrySupport: 'shoulder', carryStretch: 1, angle: side * Math.PI / 2, facing: -side, y: 274, suspension: 1 });
    const held = sampleArenaFighterContacts(victim, 1000), endpoints = gripMode === 'shoulder' ? held.shoulders : held.feet;
    const actor = fighter({ index: 1, pose: 'overhead', facing: gripMode === 'shoulder' ? -side : side, overheadRaise: 1, carrierDrive: 1, gripMode, gripTarget: endpoints[0], secondaryGripTarget: endpoints[1], gripStrength: 1, gripLocked: true });
    Object.assign(actor, arenaCarryHolderPoint(actor, endpoints, 1000));
    const supported = paint(actor, 1000), hands = structuredClone(supported.contacts.hands);
    actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
    let previous = supported.contacts;
    for (let frame = 0; frame <= 35; frame++) {
      const progress = frame / 35, settled = smooth(progress);
      actor.carrierRelease = { hands, elbows: supported.contacts.elbows, shoulders: supported.contacts.shoulders, progress, direction: side }; actor.carrierDrive = .86 + .14 * settled;
      const result = paint(actor, 1000 + frame * 10);
      if (frame === 0) hands.forEach((hand, arm) => assert.ok(distance(result.contacts.hands[arm], hand) < .001, 'dropping the support targets must preserve every actual palm on the release frame'));
      bones(actor, result, 14 - 3 * settled, 14 - 3.5 * settled);
      result.contacts.hands.forEach((hand, arm) => assert.ok(distance(hand, previous.hands[arm]) < 9, 'a supported palm cannot jump to a default overhead hand on release'));
      result.contacts.elbows.forEach((elbow, arm) => assert.ok(distance(elbow, previous.elbows[arm]) < 12, 'the two forearms unfold continuously after releasing their shoulder/ankle holds'));
      previous = structuredClone(result.contacts);
    }
    assert.ok(previous.hands.every((point, arm) => point.y > hands[arm].y + 40), 'both carriers finish with arms naturally lowered instead of frozen above their heads');
  }
});

test('any actually supported wrestling body preserves its complete painted rig when released', () => {
  for (const facing of [-1, 1]) for (const source of [
    { pose: 'airborne', suspension: 1, jumpTuck: .55, angle: facing * Math.PI * .75, y: 332 },
    { pose: 'carried', suspension: .6, carryStretch: .72, carrySupport: 'shoulder', angle: facing * Math.PI / 2, y: 362 },
    { pose: 'stunned', slamProgress: { tuck: .2, slump: .75 }, angle: facing * Math.PI * .47 },
  ]) {
    const held = fighter({ facing, ...source }), before = paint(held, 1000).contacts;
    const snapshot = arenaReleaseSnapshot(held, 1000);
    const released = fighter({ facing, x: held.x, y: held.y, pose: 'airborne', angle: held.angle, spinRelease: { snapshot, weight: 1 } });
    const first = paint(released, 1000);
    points(before).forEach((point, part) => assert.ok(distance(point, points(first.contacts)[part]) < .001, `a first flight frame cannot jump a painted endpoint (${source.pose}/${part})`));
    const original = structuredClone(held.animation);
    arenaReleaseSnapshot(held, 1000);
    assert.deepEqual(held.animation, original, 'sampling release geometry does not advance the actual fighter animation');
    released.x += 5; released.y -= 3;
    const next = paint(released, 1016);
    points(before).forEach((point, part) => assert.ok(distance({ x: point.x + 5, y: point.y - 3 }, points(next.contacts)[part]) < .001, 'the captured whole body follows the same translated flight origin'));
    for (let frame = 1; frame <= 30; frame++) {
      const weight = 1 - frame / 30;
      released.spinRelease.weight = weight;
      const result = paint(released, 1016 + frame * 10);
      assert.ok(Math.abs(Math.hypot(result.matrix[0], result.matrix[1]) - released.scale) < 1e-8, 'rotating out of the captured pose cannot thin the whole body');
      for (let leg = 0; leg < 2; leg++) {
        const originalUpper = distance(snapshot.hips[leg], snapshot.knees[leg]), originalLower = distance(snapshot.knees[leg], snapshot.feet[leg]);
        assert.ok(Math.abs(distance(result.skeleton.hips[leg], result.skeleton.knees[leg]) - (11 + (originalUpper - 11) * weight)) < .001, 'the thigh relaxes through bone angles instead of collapsing between two knee positions');
        assert.ok(Math.abs(distance(result.skeleton.knees[leg], result.skeleton.feet[leg]) - (11 + (originalLower - 11) * weight)) < .001, 'the shin retains its captured length throughout free flight');
      }
    }
  }
});
