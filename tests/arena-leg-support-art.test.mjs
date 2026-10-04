import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { drawArenaFighter, createArenaFighterAnimation } = await source('src/game/ArenaFighter.ts');
const { arenaWrestlingMoveTargets } = await source('src/arenaWrestlingMoves.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const smooth = p => { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); };
const fighter = values => ({ candidate: { id: 'a', name: '선수', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, phase: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, animation: createArenaFighterAnimation(), motionImmediate: false, ...values });
function paint(actor, clock) {
  let matrix;
  const noop = () => {}, ctx = new Proxy({ transform(...value) { matrix = value; } }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
  drawArenaFighter(ctx, actor, clock);
  const project = point => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
  const skeleton = structuredClone(actor.animation.skeleton);
  assert.ok([...skeleton.hips, ...skeleton.knees, ...skeleton.feet].every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  for (let leg = 0; leg < 2; leg++) {
    assert.ok(distance(skeleton.hips[leg], skeleton.knees[leg]) <= 11.001, 'the thigh cannot stretch during a stride or loaded stance');
    assert.ok(distance(skeleton.knees[leg], skeleton.feet[leg]) <= 11.001, 'the shin stays connected within its normal bone length');
  }
  return { skeleton, knees: skeleton.knees.map(project), feet: structuredClone(actor.animation.contactPoints.feet) };
}

test('the scoop incoming runner and dropkick attacker keep readable running legs and inherit both actual feet at entry', () => {
  for (const kind of ['scoopslam', 'dropkick']) for (const side of [-1, 1]) for (const step of [16, 50]) for (let index = 0; index < 10; index++) {
    const incoming = kind === 'scoopslam';
    const origins = incoming ? { driver: { x: 500 + side * 25, y: 416 }, victim: { x: 500 - side * 200, y: 416 } }
      : { driver: { x: 500 - side * 180, y: 416 }, victim: { x: 500 + side * 100, y: 416 } }, center = { x: 500, y: 416 };
    const pending = { kind, start: 0, end: 9000, launchAt: null, contactAt: null, ankleGripAt: null, releaseAt: null };
    const opening = arenaWrestlingMoveTargets(pending, 0, center, origins, side), window = { ...pending, launchAt: opening.plannedLaunchAt, contactAt: incoming ? opening.plannedContactAt : null };
    const entryAt = incoming ? window.contactAt : window.launchAt, initialRoot = incoming ? origins.victim : origins.driver;
    const actor = fighter({ index, ...initialRoot, facing: side });
    let previous, lastRoot = { ...initialRoot }, foldedFrames = 0, entrySeen = false, plantedFrames = 0;
    for (let clock = 0; clock <= entryAt + 300; clock += step) {
      const frame = arenaWrestlingMoveTargets(window, clock, center, origins, side);
      const root = incoming ? frame.victim : frame.driver, velocity = incoming ? frame.victimVelocity : frame.driverVelocity;
      actor.gaitDistance += distance(lastRoot, root); lastRoot = { ...root };
      Object.assign(actor, { ...root, y: root.y - (incoming ? frame.victimHeight : frame.driverHeight), depthY: root.y, facing: incoming ? frame.victimFacing : frame.driverFacing, pose: incoming ? frame.victimPose : frame.driverPose, angle: incoming ? frame.victimAngle : frame.driverAngle, phase: incoming ? frame.victimPhase : frame.driverPhase, velocityX: velocity.x, velocityY: velocity.y, suspension: incoming ? frame.victimSuspension : frame.driverSuspension, dropkickProgress: incoming ? undefined : frame.dropkickProgress, carryStretch: incoming ? frame.victimCarryStretch : undefined, carrySupport: incoming ? 'cradle' : undefined, carryEntry: incoming, slamProgress: incoming ? frame.victimSlam : undefined, scoopLoad: frame.scoopLoad, scoopLift: frame.scoopLift, scoopTurn: frame.scoopTurn, scoopDown: frame.scoopDown });
      const drawn = paint(actor, clock);
      if (actor.pose === 'run' && clock > 600 && Math.abs(actor.velocityX) > 100) {
        for (let leg = 0; leg < 2; leg++) {
          assert.ok(distance(drawn.skeleton.hips[leg], drawn.skeleton.knees[leg]) > 10, 'a side-running thigh does not collapse into a short straight depth projection');
          assert.ok(distance(drawn.skeleton.knees[leg], drawn.skeleton.feet[leg]) > 10, 'the recovering side-running shin remains visible at adult length');
        }
        assert.ok(actor.animation.feet.every(foot => !foot.replant), 'a normal running stride cannot start a second corrective footstep');
        foldedFrames++;
      }
      if (!actor.animation.airborne) for (let leg = 0; leg < 2; leg++) if (!actor.animation.feet[leg].swinging && actor.animation.feet[leg].lift < .001) {
        assert.ok(Math.abs(drawn.feet[leg].y + 2 * actor.scale - actor.animation.feet[leg].ground.y) < .001, `each planted heel stays on its real ground point: ${kind}/${side}/${step}/${index}/${clock}/${actor.pose}/${leg} ${JSON.stringify({ actual: drawn.feet[leg], memory: actor.animation.feet[leg] })}`); plantedFrames++;
      }
      if (previous && clock >= entryAt && clock - step < entryAt) {
        drawn.feet.forEach((foot, leg) => assert.ok(distance(foot, previous.feet[leg]) < (step === 16 ? 12 : 28), `${kind} enters from its actual last running/plant foot, without reversing the heel`));
        drawn.knees.forEach((joint, leg) => assert.ok(distance(joint, previous.knees[leg]) < (step === 16 ? 15 : 30), `${kind} cannot reverse the knee bend at entry`)); entrySeen = true;
      }
      previous = drawn;
    }
    assert.ok(foldedFrames > 2 && plantedFrames > 5 && entrySeen, `${kind}/${side}/${step}/${index} exercises running, support and the real technique boundary`);
  }
});

test('every two-ankle throw keeps its planted stance through pose changes and small fitting corrections', () => {
  const center = { x: 500, y: 416 };
  for (const kind of ['backbodydrop', 'scoopslam', 'clothesline', 'powerbomb', 'spinebuster']) for (const side of [-1, 1]) for (const step of [16, 50]) {
    const pending = { kind, start: 0, end: 18000, launchAt: 1000, contactAt: 2000, ankleGripAt: null, releaseAt: null };
    const floor = arenaWrestlingMoveTargets(pending, 6000, center, undefined, side), gripAt = floor.pickupReadyAt + 500;
    const window = { ...pending, ankleGripAt: gripAt }, ready = arenaWrestlingMoveTargets(window, gripAt, center, undefined, side);
    const strokeAt = ready.dragEndAt ?? (() => { for (let clock = gripAt; clock <= ready.requiredReleaseAt; clock++) if (arenaWrestlingMoveTargets(window, clock, center, undefined, side).ankleThrowProgress !== undefined) return clock; assert.fail('the actual ankle stroke remains available'); })();
    const first = arenaWrestlingMoveTargets(window, strokeAt, center, undefined, side), actor = fighter({ ...first.driver, facing: first.driverFacing, pose: 'drag', gripMode: 'ankle', phase: 1 });
    paint(actor, strokeAt - 300); actor.x += side * 4;
    const planted = paint(actor, strokeAt - 16), origin = { x: actor.x, y: actor.y };
    let previous = planted;
    for (let clock = strokeAt; clock <= ready.requiredReleaseAt + step; clock += step) {
      const frame = arenaWrestlingMoveTargets(window, clock, center, undefined, side);
      assert.ok(frame.ankleThrowProgress !== undefined, `${kind} uses the same supported two-ankle throw stroke`);
      const progress = frame.ankleThrowProgress, correctedX = origin.x + side * Math.sin(progress * Math.PI) * 2;
      actor.velocityX = (correctedX - actor.x) * 1000 / step; actor.gaitDistance += Math.abs(correctedX - actor.x); actor.x = correctedX;
      Object.assign(actor, { pose: frame.driverPose, phase: frame.driverPhase, ankleThrowProgress: progress });
      const drawn = paint(actor, clock);
      assert.equal(actor.animation.moving, false, 'a small grip-fitting correction cannot start a running gait during the throw');
      assert.ok(actor.animation.feet.every(foot => foot.lift < .001), `${kind}: a thrower cannot lift either support leg as if delivering a kick`);
      drawn.feet.forEach((foot, leg) => assert.ok(distance(foot, planted.feet[leg]) < .001, 'the actual planted sole does not shuffle merely because drag became throw'));
      drawn.knees.forEach((joint, leg) => assert.ok(distance(joint, previous.knees[leg]) < (step === 16 ? 5 : 14), 'both knees receive and extend the load continuously'));
      previous = drawn;
    }
  }
});

test('shared load and heave preserve grounded support without making a second idle foot shuffle', () => {
  for (const side of [-1, 1]) for (const gripMode of ['shoulder', 'ankle']) for (const step of [16, 50]) {
    const actor = fighter({ facing: side, pose: 'drag', gripMode });
    paint(actor, 1000); actor.x += side * 4;
    const planted = paint(actor, 1020);
    actor.pose = 'pairlift'; actor.pairReach = 1;
    for (let elapsed = 0; elapsed <= 1200; elapsed += step) {
      Object.assign(actor, { pairLoad: smooth(elapsed / 200), pairLift: smooth((elapsed - 200) / 480), pairBackload: smooth((elapsed - 680) / 220), pairHeave: smooth((elapsed - 900) / 300) });
      const drawn = paint(actor, 1040 + elapsed);
      assert.ok(actor.animation.feet.every(foot => foot.lift < .001), 'changing from the low grip to shared lifting leaves both supporting soles down');
      drawn.feet.forEach((foot, leg) => assert.ok(distance(foot, planted.feet[leg]) < .001, 'the heave is driven by both knees and hips rather than an idle corrective shuffle'));
      assert.ok(drawn.skeleton.feet.every((foot, leg) => foot.y > drawn.skeleton.hips[leg].y), 'both carrier feet remain below their knees and pelvis');
    }
  }
});

test('a long backwards ankle drag cannot restore an old idle foot target when the holder starts throwing', () => {
  for (const side of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ x: 500 - side * 40, facing: side, pose: 'run', velocityX: side * 100 });
    paint(actor, 0);
    for (let clock = step; clock <= 400; clock += step) {
      actor.x += side * 100 * step / 1000; actor.gaitDistance += 100 * step / 1000;
      paint(actor, clock);
    }
    actor.pose = 'guard'; actor.velocityX = 0;
    paint(actor, 400 + step);
    assert.ok(actor.animation.feet.some(foot => Number.isFinite(foot.settleAt)), 'the fixture contains an earlier idle planting target');
    const dragOrigin = actor.x;
    actor.pose = 'drag'; actor.gripMode = 'ankle'; actor.velocityX = -side * 95;
    let previous;
    for (let elapsed = step; elapsed <= 2800; elapsed += step) {
      actor.x = dragOrigin - side * 95 * elapsed / 1000; actor.gaitDistance += 95 * step / 1000;
      previous = paint(actor, 400 + step + elapsed);
      assert.ok(actor.animation.feet.every(foot => !Number.isFinite(foot.settleAt)), 'a walking drag discards the earlier idle planting clock');
    }
    const at = 400 + step + Math.floor(2800 / step) * step, endRoot = { x: actor.x, y: actor.y };
    const lastSupport = actor.animation.feet.map((foot, leg) => !foot.swinging && foot.lift < .05 ? { leg, point: { ...previous.feet[leg] } } : undefined).filter(Boolean);
    assert.ok(lastSupport.length >= 1, 'the dragging holder has a genuine supporting sole before the throw');
    actor.pose = 'throw';
    for (let elapsed = step; elapsed <= 500; elapsed += step) {
      actor.ankleThrowProgress = smooth(elapsed / 500);
      const drawn = paint(actor, at + elapsed);
      assert.equal(actor.animation.moving, false, 'remaining drag velocity cannot masquerade as a throwing kick');
      drawn.feet.forEach(foot => assert.ok(Math.abs(foot.x - endRoot.x) < 60, 'the holder cannot teleport its sole back across the sand to an earlier grip point'));
      drawn.knees.forEach((joint, leg) => assert.ok(distance(joint, previous.knees[leg]) < (step === 16 ? 12 : 30), 'stopping the drag cannot teleport the pelvis or knees'));
      if (elapsed === step) lastSupport.forEach(({ leg, point }) => assert.ok(distance(drawn.feet[leg], point) < .001, 'the last actual support heel survives the drag-to-throw boundary'));
      if (elapsed >= 300) assert.ok(actor.animation.feet.every(foot => foot.lift < .001), 'both heels finish the previous step and remain grounded through the throw');
      previous = drawn;
    }
  }
});
