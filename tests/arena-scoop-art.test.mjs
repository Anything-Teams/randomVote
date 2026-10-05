import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const motionBundle = await build({ entryPoints: ['src/arenaWrestlingMoves.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { ARENA_SCOOP_SLAM_TIMING: timing, ARENA_SCOOP_FINISH_TIMING: finishTiming, ARENA_WRESTLING_MOVE_TIMING: commonTiming, arenaWrestlingMoveTargets } = await import(`data:text/javascript;base64,${Buffer.from(motionBundle.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'a', name: 'a', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
function paint(actor, clock) {
  let matrix;
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'ellipse', 'fill', 'closePath', 'fillRect', 'moveTo', 'lineTo'].map(key => [key, () => {}]));
  ctx.transform = (...values) => { matrix = values; };
  drawArenaFighter(ctx, actor, clock);
  return { contacts: structuredClone(actor.animation.contactPoints), rig: structuredClone(actor.animation.rig), skeleton: structuredClone(actor.animation.skeleton), matrix };
}
function humanBones(actor, frame) {
  assert.ok(frame.matrix.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(frame.matrix[0], frame.matrix[1]) - actor.scale) < 1e-8, 'lifting keeps the complete body width');
  for (let arm = 0; arm < 2; arm++) {
    assert.ok(Math.abs(distance(frame.contacts.shoulders[arm], frame.contacts.elbows[arm]) - 11 * actor.scale) < .001, 'the upper arm stays connected and full length');
    assert.ok(Math.abs(distance(frame.contacts.elbows[arm], frame.contacts.hands[arm]) - 10.5 * actor.scale) < .001, 'the forearm stays connected and full length');
  }
  if (actor.animation.airborne && !actor.slamProgress) for (let leg = 0; leg < 2; leg++) {
    assert.ok(Math.abs(distance(frame.skeleton.hips[leg], frame.skeleton.knees[leg]) - 11) < .001);
    assert.ok(Math.abs(distance(frame.skeleton.knees[leg], frame.skeleton.feet[leg]) - 11) < .001);
  }
}

test('a scoop drives a genuine received body above the planted caster before its back-first slam', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ facing });
    paint(actor, 0);
    actor.pose = 'scoopslam';
    let previous;
    const turnAt = timing.load + timing.lift, downAt = turnAt + timing.turn;
    for (let clock = 0; clock <= downAt + timing.slam; clock += step) {
      const model = arenaWrestlingMoveTargets({ kind: 'scoopslam', start: 0, end: 9000, launchAt: 0, contactAt: 0, ankleGripAt: null }, clock, { x: 500, y: 416 }, { driver: { x: 500, y: 416 }, victim: { x: 500 + facing * 200, y: 416 }, contactDriver: { x: 500, y: 416 }, contactVictim: { x: 500 + facing * 42, y: 416 } });
      Object.assign(actor, { scoopLoad: model.scoopLoad, scoopLift: model.scoopLift, scoopTurn: model.scoopTurn, scoopDown: model.scoopDown, scoopRecover: model.scoopRecover, yaw: model.driverYaw });
      const frame = paint(actor, clock);
      humanBones(actor, frame);
      assert.equal(actor.animation.airborne, false);
      assert.ok(actor.animation.feet.every(foot => foot.lift === 0), 'the wrestler drives through planted feet');
      assert.ok(frame.rig.motion.crouch <= 8.51, 'the catcher takes the receiving weight and then lowers its knees only for the back-first slam');
      assert.ok(frame.skeleton.feet.every((foot, leg) => distance(foot, frame.skeleton.hips[leg]) > 11), 'both supporting legs retain space beneath the hips throughout the load');
      assert.ok(frame.rig.motion.lean <= 30, 'the catcher follows the supported back down without diving past the victim');
      if (previous) frame.contacts.hands.forEach((hand, arm) => assert.ok(distance(hand, previous.hands[arm]) < (step === 16 ? 8 : 22), 'both support arms follow the body continuously'));
      previous = frame.contacts;
    }
  }
});

test('a cradled wrestler responds with folded arms and soft knees through pickup and the connected floor landing', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ facing });
    const grounded = paint(actor, 1000);
    Object.assign(actor, { pose: 'carried', carrySupport: 'cradle', carryStretch: 0, carryEntry: true, suspension: 0 });
    const first = paint(actor, 1000);
    grounded.contacts.hands.forEach((hand, arm) => assert.ok(distance(hand, first.contacts.hands[arm]) < 1, 'pickup begins at the actual previous hands within one display pixel'));
    let previous = first;
    for (let elapsed = step; elapsed <= 600 + step; elapsed += step) {
      const progress = smooth(elapsed / 600);
      Object.assign(actor, { carryStretch: progress, angle: -facing * Math.PI * .36 * progress, y: 416 - 56 * progress, suspension: progress });
      const frame = paint(actor, 1000 + elapsed);
      humanBones(actor, frame);
      frame.contacts.hands.forEach((hand, arm) => assert.ok(distance(hand, previous.contacts.hands[arm]) < (step === 16 ? 11 : 28), 'the receiving arms do not flip at lift boundaries'));
      previous = frame;
    }
    const lifted = previous;
    assert.ok(lifted.rig.hands.every(hand => hand.y < lifted.rig.hip.y + 8), 'both arms brace near the upper body instead of dangling beside the hips');
    assert.ok(lifted.skeleton.feet.every((foot, leg) => distance(lifted.skeleton.hips[leg], foot) < 20.5), 'the carried legs have a natural knee bend rather than rigid straight sticks');
    Object.assign(actor, { slamProgress: { tuck: 1, slump: 0 }, slamEntry: true });
    paint(actor, 1650);
    for (let elapsed = step; elapsed <= 320 + step; elapsed += step) {
      const down = smooth(elapsed / 320);
      Object.assign(actor, { angle: -facing * Math.PI * (.36 + .14 * down), y: 360 + 56 * down, slamProgress: { tuck: 1 - down, slump: down } });
      humanBones(actor, paint(actor, 1650 + elapsed));
    }
  }
});

test('a complete scoop carries across the chest, pivots and lands the supported back with a continuous normal rig', () => {
  for (const side of [-1, 1]) for (const step of [16, 50]) {
    const contactAt = 1000, center = { x: 500, y: 416 };
    const driverRoot = { x: 500 - side * 24, y: 416 }, victimRoot = { x: 500 + side * 30, y: 416 };
    const actor = fighter({ index: 1, facing: -side, ...victimRoot });
    const grounded = paint(actor, contactAt);
    const floorRoot = { x: driverRoot.x + side * 62, y: victimRoot.y };
    const flat = sampleArenaFighterContacts({ ...actor, ...floorRoot, pose: 'stunned', angle: side * Math.PI / 2, suspension: 0, slamProgress: { tuck: 0, slump: 1 }, animation: undefined, motionImmediate: true }, contactAt);
    const origins = { driver: driverRoot, victim: { x: driverRoot.x + side * 200, y: victimRoot.y }, contactDriver: driverRoot, contactVictim: victimRoot, scoopWaist: grounded.contacts.waist, scoopFloorVictim: floorRoot, scoopFloorWaist: flat.waist };
    const window = { kind: 'scoopslam', start: 0, end: 12000, launchAt: 800, contactAt, ankleGripAt: null, releaseAt: null };
    const downAt = timing.load + timing.lift + timing.turn, floorAge = downAt + timing.slam;
    const times = [...new Set([0, ...Array.from({ length: Math.ceil(floorAge / step) }, (_, n) => Math.min(floorAge, (n + 1) * step)), timing.load + timing.lift, downAt, floorAge])].sort((a, b) => a - b);
    let previous = grounded, previousAge = 0, liftedSeen = false, turnSeen = false, floorSeen = false;
    for (const age of times) {
      const frame = arenaWrestlingMoveTargets(window, contactAt + age, center, origins, side);
      Object.assign(actor, { x: frame.victim.x, y: frame.victim.y - frame.victimHeight, depthY: frame.victim.y, pose: frame.victimPose, angle: frame.victimAngle, suspension: frame.victimSuspension, phase: frame.victimPhase, carryStretch: frame.victimCarryStretch, carrySupport: frame.victimCarryStretch === undefined ? undefined : 'cradle', carryEntry: true, slamEntry: frame.victimSlam !== undefined, slamProgress: frame.victimSlam, scoopVictim: frame.scoopVictim, scoopLoad: frame.scoopLoad, scoopLift: frame.scoopLift, scoopTurn: frame.scoopTurn, scoopDown: frame.scoopDown, eyesClosed: frame.victimEyesClosed });
      const rig = sampleArenaFighterContacts(actor, contactAt + age);
      const offset = { x: frame.scoopSupport.x - rig.waist.x, y: frame.scoopSupport.y - rig.waist.y };
      actor.x += offset.x; actor.y += offset.y; actor.depthY += offset.y;
      const painted = paint(actor, contactAt + age);
      humanBones(actor, painted);
      assert.ok(Math.abs(frame.victimAngle) <= Math.PI / 2 + 1e-8, 'the cradle rotates into a back-first quarter turn without an inverted head-first wheel');
      if (age > previousAge) for (const point of ['head', 'waist', 'back']) assert.ok(distance(painted.contacts[point], previous.contacts[point]) < 5 + (age - previousAge) * 1.5, 'the supported trunk follows its continuous hip pivot');
      if (age === timing.load + timing.lift) {
        assert.ok(painted.contacts.waist.y < driverRoot.y - 135, 'the complete held waist clears the receiving head rather than stopping at chest height');
        assert.ok(frame.victimHeight > 120 && Math.abs(frame.victimAngle) > Math.PI * .25);
        assert.equal(frame.gripStrength, 1); liftedSeen = true;
      }
      if (age === downAt) {
        assert.ok(Math.abs(frame.victimAngle) > Math.PI * .46);
        assert.ok(painted.contacts.head.y < floorRoot.y - 28, 'the supported head remains above the sand while the chest-height body pivots');
        assert.equal(frame.victimEyesClosed, false); turnSeen = true;
      }
      if (age === floorAge) {
        assert.equal(frame.victimAngle, side * Math.PI / 2);
        assert.equal(frame.victimCarryStretch, undefined, 'floor contact inherits the final slam rig instead of restarting a carried body');
        assert.ok(side * (painted.contacts.head.x - (painted.contacts.feet[0].x + painted.contacts.feet[1].x) / 2) > 110);
        assert.ok(distance(painted.contacts.waist, flat.waist) < .001);
        assert.ok(painted.contacts.back.y <= floorRoot.y && painted.contacts.back.y > floorRoot.y - 28, 'the complete back lies at the same physical sand plane');
        assert.equal(frame.victimEyesClosed, true); assert.equal(frame.victimSlam.slump, 1); assert.equal(frame.canRelease, false); floorSeen = true;
      }
      previous = painted; previousAge = age;
    }
    assert.ok(liftedSeen && turnSeen && floorSeen);
  }
});

test('the scoop ankle reach turns the actual resting arms into the pickup without reversing an elbow in one frame', () => {
  for (const facing of [-1, 1]) for (const turn of [false, true]) for (const step of [16, 50]) {
    const actor = fighter({ facing });
    const rested = paint(actor, 1000);
    const targetFacing = turn ? -facing : facing;
    const targetActor = fighter({ facing: targetFacing, pose: 'drag', gripMode: 'ankle', motionImmediate: true });
    const target = paint(targetActor, 1000).contacts.hands;
    Object.assign(actor, { facing: targetFacing, pose: 'drag', gripMode: 'ankle', gripLocked: true, gripTarget: target[1], secondaryGripTarget: target[0], gripStrength: 1, ankleApproach: 0 });
    const entered = paint(actor, 1000);
    for (let arm = 0; arm < 2; arm++) {
      assert.ok(distance(entered.contacts.hands[arm], rested.contacts.hands[arm]) < .001, 'pickup starts at the previous world-space palm even through a grounded turn');
      assert.ok(distance(entered.contacts.elbows[arm], rested.contacts.elbows[arm]) < .001);
    }
    let previous = entered;
    for (let elapsed = step; elapsed <= 240 + step; elapsed += step) {
      actor.ankleApproach = smooth(elapsed / 240);
      const frame = paint(actor, 1000 + elapsed);
      humanBones(actor, frame);
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(distance(frame.contacts.elbows[arm], previous.contacts.elbows[arm]) < (step === 16 ? 15 : 42), 'the back elbow travels through the reach instead of choosing a mirrored IK branch');
        assert.ok(distance(frame.contacts.hands[arm], previous.contacts.hands[arm]) < (step === 16 ? 15 : 42), JSON.stringify({facing,turn,step,elapsed,arm,gap:distance(frame.contacts.hands[arm],previous.contacts.hands[arm])}));
      }
      previous = frame;
    }
    delete actor.ankleApproach;
    const done = paint(actor, 1280);
    for (let arm = 0; arm < 2; arm++) assert.ok(distance(done.contacts.elbows[arm], previous.contacts.elbows[arm]) < 6, 'finishing the pickup does not restart its elbow bend');
  }
});

test('the reversed scoop finish turns its loaded trunk and keeps each actual support heel through the ankle reach', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ facing, pose: 'scoopslam', scoopLoad: 1, scoopLift: 1, scoopTurn: 1, scoopDown: 1, gripMode: 'cradle', gripStrength: 0 });
    const rested = paint(actor, 1000);
    const targetActor = fighter({ facing: -facing, pose: 'drag', gripMode: 'ankle', motionImmediate: true });
    const target = paint(targetActor, 1000).contacts.hands;
    Object.assign(actor, { facing: -facing, pose: 'drag', gripMode: 'ankle', gripLocked: true, gripTarget: target[1], secondaryGripTarget: target[0], gripStrength: 1, ankleApproach: 0 });
    const points = frame => [frame.contacts.head, frame.contacts.waist, ...frame.contacts.headSides, ...frame.contacts.shoulders, ...frame.contacts.elbows, ...frame.contacts.hands, ...frame.contacts.feet];
    const entered = paint(actor, 1000);
    // The ordinary hips and their heels change labels together on this
    // facing reversal; the physical soles remain at the same world points.
    const relabeled = { ...rested, contacts: { ...rested.contacts, feet: [...rested.contacts.feet].reverse() } };
    points(entered).forEach((point, index) => assert.ok(distance(point, points(relabeled)[index]) < .001, 'turning to the reversed resting ankles begins at the same actual trunk and material limbs'));
    let previous = entered;
    for (let elapsed = step; elapsed <= 240 + step; elapsed += step) {
      actor.ankleApproach = smooth(elapsed / 240);
      const frame = paint(actor, 1000 + elapsed);
      humanBones(actor, frame);
      points(frame).forEach((point, index) => assert.ok(distance(point, points(previous)[index]) < 8 + step * .9, 'the loaded body follows a continuous ground turn before reaching the ankles'));
      previous = frame;
    }
  }
});

test('the complete scoop overlaps the load, rising turn and downward stroke before its connected ankle revolution', () => {
  const duration = Object.values(timing).reduce((sum, value) => sum + value, 0);
  assert.ok(timing.load >= 300 && timing.lift >= 560 && timing.turn >= 460 && timing.slam >= 460);
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const contactAt = 1000, center = { x: 500, y: 416 };
    const origins = { driver: { x: 500 - facing * 30, y: 416 }, victim: { x: 500 + facing * 160, y: 416 }, contactDriver: { x: 500 - facing * 24, y: 416 }, contactVictim: { x: 500 + facing * 30, y: 416 } };
    const window = { kind: 'scoopslam', start: 0, end: 9000, launchAt: 800, contactAt, ankleGripAt: null, releaseAt: null, kickAt: null };
    let overlapFrames = 0, previous;
    for (let age = 0; age <= duration + commonTiming.groggy; age += step) {
      const frame = arenaWrestlingMoveTargets(window, contactAt + age, center, origins, facing);
      assert.equal(frame.canRelease, false, 'a floor slam cannot bypass the actual ankle grip');
      if (age <= timing.load * .7) assert.equal(frame.victimHeight, 0, 'the planted receiving knees bear the initial weight before the body rises');
      if (frame.scoopLoad < 1 && frame.scoopLift > 0 || frame.scoopLift < 1 && frame.scoopTurn > 0 || frame.scoopTurn < 1 && frame.scoopDown > 0) {
        overlapFrames++;
        assert.equal(frame.gripStrength, 1, 'the back and thigh stay supported as one stage flows into the next');
      }
      if (previous) assert.ok(distance(frame.scoopSupport, previous.scoopSupport) < (step === 16 ? 8 : 24), 'the real supported waist follows one continuous gather, lift and lowering arc');
      previous = frame;
      if (age >= duration && frame.scoopRecover < 1) assert.equal(frame.driverPose, 'scoopslam', 'the catcher rises from its actual lowered stance before starting the ankle reach');
    }
    assert.ok(overlapFrames >= (step === 16 ? 12 : 4), 'even at 20fps the body begins the next stage before the previous stage comes to rest');
    const ankleGripAt = arenaWrestlingMoveTargets(window, contactAt + duration, center, origins, facing).pickupReadyAt + commonTiming.ankleReach;
    const held = { ...window, ankleGripAt };
    for (let age = 0; age < finishTiming.ankleLoad; age += step) {
      const frame = arenaWrestlingMoveTargets(held, ankleGripAt + age, center, origins, facing);
      assert.equal(frame.driverPose, 'grapple'); assert.equal(frame.victimHeight, 0);
      if (age === 0) assert.equal(frame.ankleSpinProgress, 0, 'the actual ankle capture begins at its resting orientation');
      else assert.ok(frame.ankleSpinProgress > 0 && frame.ankleSpinProgress < .1, 'weight receiving begins the grounded turn immediately without a stationary load pause');
      assert.equal(frame.canRelease, false, 'the actual two-ankle hold receives the weight while beginning its full turn');
    }
    const release = ankleGripAt + finishTiming.ankleLoad + finishTiming.ankleSpin;
    assert.equal(arenaWrestlingMoveTargets(held, release - 1, center, origins, facing).canRelease, false);
    const ready = arenaWrestlingMoveTargets(held, release, center, origins, facing);
    assert.equal(ready.canRelease, true); assert.equal(ready.ankleThrowProgress, 1); assert.equal(ready.victimHeight, 0);
    assert.ok(Math.abs(Math.abs(ready.pivotTurn) - Math.PI * 2) < 1e-8 && Math.abs(ready.ankleAngularVelocity) > 4.4);
    assert.equal(ready.requiredReleaseAt, release, 'the actual ankle gate releases at the end of its full turn without a second heave pause');
  }
});

test('the actual received scoop keeps both supporting elbows open as the back rises past shoulder height', async () => {
  // Run the production Scene through real contact, including its receiver
  // root correction and material back/thigh targets. Only scenery is skipped.
  const require = createRequire(import.meta.url);
  let source = await readFile('src/ArenaShow.tsx', 'utf8');
  const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
  const initialize = 'const ambient = won ? [] : active.filter';
  assert.ok(source.includes(draw) && source.includes(initialize));
  source = source.replaceAll('drawArenaScenery(ctx, clock,', 'scoopArmScenery(ctx, clock,')
    .replace(draw, `scoopArmActors = actors; ${draw}`)
    .replace(initialize, `scoopArmInitialize(sim, reset); ${initialize}`);
  source += '\nlet scoopArmActors; const scoopArmScenery = () => {}; let scoopArmInitialize = () => {}; export const setInitialize = fn => { scoopArmInitialize = fn; }; export const capturedActors = () => scoopArmActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
  const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
  const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize, arenaWrestlingMoveTargets: sceneTargets } = module.exports;
  const noop = () => {};
  const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
  for (const mirrored of [false, true]) for (const step of [16, 50]) {
    const order = ['2', '1'], duration = 44000, props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: 40, paused: false, preview: false };
    const planned = arenaRounds(order, duration, 7, 40)[0];
    assert.equal(planned.wrestlingMove.kind, 'scoopslam');
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset || !mirrored) return;
      for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
    });
    let previous, supported = 0, shoulderPassage = 0;
    for (let clock = 0; clock < 5000; clock += step) {
      render(ctx, props, clock, clock, sim, step, false);
      const contact = sim.contacts.get(planned.id), window = contact?.round?.wrestlingMove;
      if (window?.contactAt == null) continue;
      const frame = sceneTargets(window, clock, contact.center, contact.wrestlingMoveOrigins, contact.round.contactSide);
      if (frame.scoopDown > 0) break;
      const actors = capturedActors(), driver = actors.get(planned.aggressor), victim = actors.get(planned.victim), held = driver.animation.contactPoints, body = victim.animation.contactPoints;
      const thigh = { x: body.waist.x + ((body.feet[0].x + body.feet[1].x) / 2 - body.waist.x) * .28, y: body.waist.y + ((body.feet[0].y + body.feet[1].y) / 2 - body.waist.y) * .28 };
      if (frame.gripStrength > .95) for (let arm = 0; arm < 2; arm++) {
        const shoulder = held.shoulders[arm], elbow = held.elbows[arm], hand = held.hands[arm];
        const upper = distance(shoulder, elbow), lower = distance(elbow, hand), span = distance(shoulder, hand);
        assert.ok(Math.abs(upper - 11 * driver.scale) < .001 && Math.abs(lower - 10.5 * driver.scale) < .001, 'both supporting arms retain their two complete connected bones');
        const opening = Math.acos(Math.max(-1, Math.min(1, (upper * upper + lower * lower - span * span) / (2 * upper * lower))));
        assert.ok(opening >= Math.PI / 4, `the received back must not fold a support palm into its own shoulder: ${JSON.stringify({ mirrored, step, clock, arm, opening, span })}`);
        assert.ok(distance(hand, arm ? thigh : body.back) < 8, 'opening the elbow keeps the actual palm on the received back or thigh');
        if (previous) assert.ok(distance(elbow, previous.elbows[arm]) < 3 + step * .55, 'the lifting elbow travels continuously around the shoulder without reversing its bend');
        supported++;
      }
      if (frame.scoopLoad === 1 && frame.scoopLift > 0 && frame.scoopLift < 1) shoulderPassage++;
      previous = structuredClone(held);
    }
    assert.ok(supported > 20 && shoulderPassage > 4, 'the real charge contact exercises the complete shoulder-height passage at both playback rates');
  }
});
