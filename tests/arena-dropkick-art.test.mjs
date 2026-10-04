import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const bundled = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
}
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const { arenaWrestlingMoveTargets, ARENA_WRESTLING_MOVE_TIMING: timing } = await source('src/arenaWrestlingMoves.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fighter = (index, values) => ({ candidate: { id: String(index), name: `선수${index}`, color: '#ffad72' }, index, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, phase: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, animation: createArenaFighterAnimation(), motionImmediate: false, ...values });
const noop = () => {};
function paint(actor, clock) {
  let matrix;
  const ctx = new Proxy({ transform(...values) { matrix = values; } }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
  drawArenaFighter(ctx, actor, clock);
  return { rig: structuredClone(actor.animation.contactPoints), skeleton: structuredClone(actor.animation.skeleton), matrix };
}
function humanBones(actor, frame) {
  assert.ok(frame.matrix.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(frame.matrix[0], frame.matrix[1]) - actor.scale) < 1e-8, 'the horizontal flight never compresses or stretches the torso');
  for (let arm = 0; arm < 2; arm++) {
    assert.ok(Math.abs(distance(frame.rig.shoulders[arm], frame.rig.elbows[arm]) - 11 * actor.scale) < .001, 'the upper arm remains human length');
    assert.ok(Math.abs(distance(frame.rig.elbows[arm], frame.rig.hands[arm]) - 10.5 * actor.scale) < .001, 'the forearm remains human length');
  }
  if (actor.pose === 'dropkick') for (let leg = 0; leg < 2; leg++) {
    assert.ok(Math.abs(distance(frame.skeleton.hips[leg], frame.skeleton.knees[leg]) - 11) < .001, 'each airborne thigh has its normal complete length');
    assert.ok(Math.abs(distance(frame.skeleton.knees[leg], frame.skeleton.feet[leg]) - 11) < .001, 'each shin remains attached at its normal complete length');
  }
}
function setup(side, index) {
  const center = { x: 500, y: 416 }, origins = { driver: { x: 500 - side * 180, y: 416 }, victim: { x: 500 + side * 20, y: 416 } };
  const pending = { kind: 'dropkick', start: 1000, end: 5000, launchAt: null, contactAt: null, releaseAt: null };
  const opening = arenaWrestlingMoveTargets(pending, pending.start, center, origins, side);
  const window = { ...pending, launchAt: opening.plannedLaunchAt };
  const launch = arenaWrestlingMoveTargets(window, window.launchAt, center, origins, side);
  origins.launchDriver = { ...launch.driver };
  const victim = fighter((index + 3) % 10, { ...origins.victim, facing: -side, motionImmediate: true });
  const rig = sampleArenaFighterContacts(victim, 1000);
  const chest = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 + victim.scale * 5 };
  origins.target = chest; origins.contactTargets = [{ x: chest.x, y: chest.y - 6 }, { x: chest.x, y: chest.y + 6 }];
  return { center, origins, window, opening, actor: fighter(index, { ...launch.driver, facing: side }) };
}
function apply(actor, frame) {
  Object.assign(actor, { ...frame.driver, y: frame.driver.y - frame.driverHeight, depthY: frame.driver.y, velocityX: frame.driverVelocity.x, velocityY: frame.driverVelocity.y, facing: frame.driverFacing, pose: frame.driverPose, angle: frame.driverAngle, phase: frame.driverPhase, suspension: frame.driverSuspension, dropkickProgress: frame.dropkickProgress, footTargets: frame.footTargets, feetStrength: frame.feetStrength });
}

test('the dropkick turns its torso nearly horizontal with its head behind two real contacting soles', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) for (const step of [16, 50]) {
    const values = setup(side, index), { actor, window, origins, center } = values;
    paint(actor, window.launchAt - step);
    let contactSeen = false, horizontalSeen = false, previous;
    for (let elapsed = window.launchAt; elapsed < window.launchAt + timing.jump; elapsed += step) {
      const frame = arenaWrestlingMoveTargets(window, elapsed, center, origins, side);
      apply(actor, frame); const drawn = paint(actor, elapsed); humanBones(actor, drawn);
      const torso = { x: drawn.rig.head.x - drawn.rig.waist.x, y: drawn.rig.head.y - drawn.rig.waist.y };
      if (frame.dropkickProgress >= .35 && frame.dropkickProgress <= .70) {
        assert.ok(Math.abs(torso.x) > 2 * Math.abs(torso.y), 'the actual painted head and pelvis form a horizontal wrestling dropkick');
        assert.ok(side * torso.x < -40, 'the head stays behind the advancing hips instead of leading a head-first strike');
        horizontalSeen = true;
      }
      if (frame.canContact && frame.feetStrength > .9 && drawn.rig.feet.every((foot, leg) => distance(foot, frame.footTargets[leg]) < 6)) {
        const toeCenter = { x: (drawn.rig.feet[0].x + drawn.rig.feet[1].x) / 2, y: (drawn.rig.feet[0].y + drawn.rig.feet[1].y) / 2 };
        assert.ok(Math.abs(frame.driverAngle) > 1.45);
        assert.ok(side * (toeCenter.x - drawn.rig.head.x) > 65, 'both soles lead the horizontal body into the captured chest');
        contactSeen = true;
      }
      if (previous) {
        for (const key of ['head', 'waist']) assert.ok(distance(drawn.rig[key], previous[key]) < (step === 16 ? 17 : 48), `the pelvis rotation and forward root step remain one connected airborne motion: ${side}/${index}/${step}/${elapsed - window.launchAt}/${key}/${distance(drawn.rig[key], previous[key])}`);
      }
      previous = drawn.rig;
    }
    assert.ok(horizontalSeen && contactSeen, `both actual full-length feet reach during horizontal flight (${side}/${index}/${step}ms)`);
  }
});

test('a missed horizontal dropkick returns to a complete inside two-foot landing without hovering or resetting its pelvis', () => {
  for (const side of [-1, 1]) for (const step of [16, 50]) {
    const values = setup(side, 0), { actor, window, origins, center } = values;
    origins.contactTargets = [{ x: 950, y: 150 }, { x: 950, y: 165 }];
    paint(actor, window.launchAt - step);
    let previous, landed = false;
    for (let elapsed = window.launchAt; elapsed <= values.opening.requiredEndAt + step; elapsed += step) {
      const frame = arenaWrestlingMoveTargets(window, elapsed, center, origins, side);
      apply(actor, frame); const drawn = paint(actor, elapsed); humanBones(actor, drawn);
      assert.equal(frame.contactAt, null); assert.equal(frame.canRelease, false);
      if (previous) assert.ok(distance(drawn.rig.waist, previous.waist) < (step === 16 ? 17 : 45), 'retracting from the kick and returning upright cannot teleport the actual pelvis');
      if (elapsed >= frame.landingAt) {
        assert.equal(frame.driverHeight, 0); assert.equal(Math.abs(frame.driverAngle), 0);
        assert.ok(drawn.rig.feet.every(foot => Math.hypot((foot.x - 500) / 303, (foot.y - 416) / 112) < 1));
        if (actor.pose === 'land') assert.ok(drawn.rig.feet.every(foot => Math.abs(foot.y + actor.scale * 2 - frame.driver.y) < 3), `both painted soles reach the same inside landing within the shoe's pixel outline: ${side}/${step}/${elapsed-window.launchAt}/${JSON.stringify(drawn.rig.feet)}/${frame.driver.y}`);
        landed = true;
      }
      previous = drawn.rig;
    }
    assert.equal(landed, true);
  }
});
