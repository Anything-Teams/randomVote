import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual Scene and painted rig; only the static scenery is skipped.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
const rankRead = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
assert.ok(source.includes(rankRead));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'wrestlingTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} wrestlingTestRanks = ranks;`)
  .replace(draw, 'wrestlingTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.surpriseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.surpriseEnd(); });');
const initAnchor = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(initAnchor));
source = source.replace(initAnchor, 'wrestlingTestInitialize(sim, props, elapsed, reset); ' + initAnchor);
source += '\nlet wrestlingTestActors, wrestlingTestRanks; const wrestlingTestScenery = () => {}; let wrestlingTestInitialize = () => {}; export const setInitialize = fn => { wrestlingTestInitialize = fn; }; export const capturedActors = () => wrestlingTestActors; export const capturedRanks = () => wrestlingTestRanks; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capturedActors, capturedRanks, setInitialize } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const order = ['2', '1'];
const duration = 44000, rushRoll = 7;

function context() {
  let matrix = identity(), stack = [], currentId;
  const records = new Map();
  const target = {
    globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; target.globalAlpha = saved.alpha; } },
    transform(...next) { matrix = multiply(matrix, next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    fillRect(x, y, width, height) {
      if (!currentId || target.globalAlpha <= 0) return;
      const record = records.get(currentId);
      const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }].map(point => project(matrix, point));
      record.rectangles.push(corners);
      if (width >= 14 && width <= 16 && height === 16) record.headSkin = corners.map(point => project(inverse(record.sceneMatrix), point));
      if (width === 9 && height === 3) record.shoes.push(corners.map(point => project(inverse(record.sceneMatrix), point)));
    },
    ellipse(x, y, radiusX, radiusY) { if (currentId) records.get(currentId).shadow = { x, y, radiusX, radiusY }; },
    surpriseStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix], rectangles: [], shoes: [] }); },
    surpriseEnd() { currentId = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

const seeds = { clothesline: 19, dropkick: 15, powerbomb: 4, backbodydrop: 16, spinebuster: 11, scoopslam: 40 };
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;
const points = rig => [rig.origin, rig.head, rig.waist, ...rig.hands, ...rig.feet];
// `origin` changes from a nominal ground marker to the projected pivot when a
// snapshot is released; continuity concerns the painted body and joints.
const paintedPoints = rig => [rig.head, ...rig.headSides, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const inverse = matrix => {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  assert.ok(Math.abs(determinant) > 1e-6, 'the actual spin transform remains invertible');
  return [matrix[3] / determinant, -matrix[1] / determinant, -matrix[2] / determinant, matrix[0] / determinant,
    (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant, (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant];
};
const cradleTargets = rig => [rig.back, { x: rig.waist.x + ((rig.feet[0].x + rig.feet[1].x) / 2 - rig.waist.x) * .28, y: rig.waist.y + ((rig.feet[0].y + rig.feet[1].y) / 2 - rig.waist.y) * .28 }];
const segmentGap = (point, from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, { x: from.x + dx * t, y: from.y + dy * t });
};
function polygonGap(a, b) {
  const cross = (from, to, point) => (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
  const edges = quad => quad.map((point, index) => [point, quad[(index + 1) % quad.length]]);
  const aEdges = edges(a), bEdges = edges(b);
  const inside = (point, boundary) => {
    const sides = boundary.map(([from, to]) => cross(from, to, point));
    return sides.every(side => side >= 0) || sides.every(side => side <= 0);
  };
  if (inside(a[0], bEdges) || inside(b[0], aEdges)) return 0;
  let gap = Infinity;
  for (const [from, to] of aEdges) for (const [left, right] of bEdges) {
    const boundsOverlap = Math.max(Math.min(from.x, to.x), Math.min(left.x, right.x)) <= Math.min(Math.max(from.x, to.x), Math.max(left.x, right.x))
      && Math.max(Math.min(from.y, to.y), Math.min(left.y, right.y)) <= Math.min(Math.max(from.y, to.y), Math.max(left.y, right.y));
    if (boundsOverlap && cross(from, to, left) * cross(from, to, right) <= 0 && cross(left, right, from) * cross(left, right, to) <= 0) return 0;
    gap = Math.min(gap, segmentGap(from, left, right), segmentGap(to, left, right), segmentGap(left, from, to), segmentGap(right, from, to));
  }
  return gap;
}
function roots(kind) {
  return ['powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'].includes(kind) ? { driver: { x: 525, y: 416 }, victim: { x: 300, y: 416 } }
      : { driver: { x: 320, y: 416 }, victim: { x: 520, y: 416 } };
}
function game(kind, { mirrored = false, controlled = true, frameDelta = 16 } = {}) {
  const seed = seeds[kind], props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const planned = arenaRounds(order, duration, rushRoll, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  // Change only the actual starting layout, before the production Scene samples
  // any contact. No clocks, grips, outcomes or motion are supplied by the test.
  setInitialize((current, _props, _elapsed, reset) => {
    if (current !== sim || !reset) return;
    if (controlled) {
      const initial = roots(kind);
      Object.assign(sim.bodies.get(planned.aggressor), initial.driver);
      Object.assign(sim.bodies.get(planned.victim), initial.victim);
    }
    if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; }
    for (const body of sim.bodies.values()) { body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
  });
  return { sim, ctx, planned, step(elapsed, paused = false) {
    ctx.records.clear(); render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : frameDelta, false);
    return capturedActors();
  } };
}

for (const kind of Object.keys(seeds)) for (const mirrored of [false, true]) test(`${kind} uses real painted contact, a continuous finish and the drawn ranks (${mirrored ? 'mirrored' : 'ordinary'})`, () => {
  for (const frameDelta of [16, 50]) {
    const scene = game(kind, { mirrored, frameDelta });
    let contactSeen = false, releaseSeen = false, finalSeen = false, fallbackSeen = false, attackerJumped = false, attackerLanded = false, distantLandingSeen = false;
    let actualContactAt, anklesSeen = false, ankleFrames = 0, previousRig, previousDriverRig, previousDriverFacing, previousDriverLeftArms, previousSpinMatrix, previousSpinWeight, previousTurn, spinFrames = 0, fullTurnSeen = false, runSeen = false, floorSeen = false;
    const scoopStages = new Set();
    const clotheslineStages = new Set();
    let sharedFallSeen = false, standingBeforeGrip = false, oppositeHeadDirectionMs = 0, casterPassedVictim = false;
    let counterGuardSeen = false, counterPrepareSeen = false;
    let overlapLiftTurnFrames = 0, overheadFrames = 0, scoopSupportFrames = 0, scoopFloatingMs = 0, scoopOverheadSeen = false, scoopImpactSeen = false, pivotFrames = 0, tangentFrames = 0;
    let spineOverlapFrames = 0, spinePause = 0, maxSpinePause = 0;
    const spinFinish = kind !== 'dropkick';
    const detail = (elapsed, frame) => `${kind}/${mirrored}/${frameDelta}ms/${elapsed}/${frame?.stage}`;
    for (let elapsed = 0; elapsed <= 20000; elapsed += frameDelta) {
      const actors = scene.step(elapsed), contact = scene.sim.contacts.get(scene.planned.id), actual = contact?.round;
      const driver = actors.get(scene.planned.aggressor), victim = actors.get(scene.planned.victim), exit = scene.sim.exits.get(scene.planned.victim);
      if (capturedRanks()[scene.planned.victim]) {
        assert.deepEqual(capturedRanks(), { '1': 2, '2': 1 }); finalSeen = true; break;
      }
      assert.ok(driver && victim && driver.animation?.contactPoints && victim.animation?.contactPoints);
      const paintedDriver = driver.animation.contactPoints, paintedVictim = victim.animation.contactPoints;
      assert.ok(points(paintedDriver).concat(points(paintedVictim)).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
      assert.ok(!scene.sim.exits.has(scene.planned.aggressor), 'the inside surviving caster can never become a new elimination');
      if (!actual?.wrestlingMove) {
        fallbackSeen ||= contactSeen;
        assert.fail(`${kind} must exercise its complete selected technique instead of only an ordinary fallback`);
        previousRig = structuredClone(paintedVictim); continue;
      }
      const window = actual.wrestlingMove, frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, actual.contactSide);
      assert.ok(inside(scene.sim.bodies.get(actual.aggressor)), `caster stays inside: ${detail(elapsed, frame)}`);
      if ((kind === 'powerbomb' || kind === 'scoopslam' || kind === 'clothesline' || kind === 'spinebuster' || (kind === 'backbodydrop' && elapsed >= frame.pickupReadyAt)) && window.launchAt != null && (!exit || spinFinish && elapsed - exit.launchedAt <= 750) && previousDriverRig) {
        const cap = 8 + frameDelta * .9;
        // Before the spin plane begins, turning toward the ankles relabels
        // both ordinary hip/heel pairs. Compare the same physical soles.
        const relabeled = driver.facing !== previousDriverFacing && driver.gripMode === 'ankle' && driver.pivotTurn === undefined;
        // The left strike's near arm 0 returns to the ordinary near slot 1.
        // Compare that same physical arm through the handoff, too.
        const armsRelabeled = driver.animation.clotheslineLeftArms !== previousDriverLeftArms;
        const priorDriver = { ...previousDriverRig,
          feet: relabeled ? [...previousDriverRig.feet].reverse() : previousDriverRig.feet,
          shoulders: armsRelabeled ? [...previousDriverRig.shoulders].reverse() : previousDriverRig.shoulders,
          elbows: armsRelabeled ? [...previousDriverRig.elbows].reverse() : previousDriverRig.elbows,
          hands: armsRelabeled ? [...previousDriverRig.hands].reverse() : previousDriverRig.hands,
        };
        for (const [point, prior] of paintedPoints(paintedDriver).map((point, index) => [point, paintedPoints(priorDriver)[index]])) assert.ok(distance(point, prior) < cap, `receiving the back or reaching for the ankles cannot reverse a caster joint by ${distance(point, prior).toFixed(2)}px in one frame: ${detail(elapsed, frame)}/joint${paintedPoints(paintedDriver).indexOf(point)}`);
      }
      if (kind !== 'dropkick' && window.contactAt != null && !exit && previousRig) {
        const cap = 8 + frameDelta * .9;
        // A full revolution has genuine angular travel. Compare the painted
        // skeleton in its actual consecutive transforms, while preserving the
        // ordinary displacement cap for the fall and the low pickup entry.
        const rigidSpin = spinFinish && frame.ankleSpin?.weight === 1 && previousSpinWeight === 1 && previousSpinMatrix;
        const spinTransform = rigidSpin ? multiply(victim.animation.spinSnapshot.matrix, inverse(previousSpinMatrix)) : undefined;
        for (const [point, prior] of paintedPoints(paintedVictim).map((point, index) => [point, paintedPoints(previousRig)[index]])) {
          const expected = spinTransform ? project(spinTransform, prior) : prior;
          assert.ok(distance(point, expected) < (spinTransform ? 3 : cap), `a fall, pickup or supported rotation cannot reset its painted skeleton (gap ${distance(point, expected).toFixed(2)}px): ${detail(elapsed, frame)}`);
        }
      }
      if (spinFinish && frame.ankleSpin && !exit) {
        assert.equal(driver.pivotTurn, frame.pivotTurn, 'the actual caster follows the recorded full-turn clock');
        assert.equal(victim.spinSuspension.gripBoth, true, 'both real foot ends are supported throughout the rotation');
        if (frame.ankleSpin.weight === 1) {
          assert.ok(paintedVictim.head.y <= Math.max(driver.depthY, victim.depthY) + 3, 'the crown clears its actual sand depth while the normal body passes in front of the supporting hands');
          for (let arm = 0; arm < 2; arm++) {
            assert.ok(Math.abs(distance(paintedDriver.shoulders[arm], paintedDriver.elbows[arm]) - 11 * driver.scale) < .001 && Math.abs(distance(paintedDriver.elbows[arm], paintedDriver.hands[arm]) - 10.5 * driver.scale) < .001, 'raising the ankle support keeps both complete normal arm sections');
          }
          const matrix = victim.animation.spinSnapshot.matrix;
          const paintedAngle = Math.atan2(matrix[1] * victim.facing, matrix[0] * victim.facing);
          const radial = { x: Math.cos(frame.ankleSpin.orbit), y: -.50 * Math.sin(frame.ankleSpin.orbit) };
          const expectedAngle = Math.atan2(-radial.x, radial.y);
          assert.ok(Math.abs(Math.atan2(Math.sin(paintedAngle - expectedAngle), Math.cos(paintedAngle - expectedAngle))) < 1e-8, 'the actual body circles the ankle support instead of resetting its orbital angle');
          assert.equal(frame.ankleSpin.planar, true, 'the ankle swing crosses both halves of the horizontal plane');
          const width = Math.hypot(matrix[0], matrix[1]) / victim.scale, depth = Math.hypot(matrix[2], matrix[3]) / victim.scale;
          assert.ok(Math.abs(width - (.42 + Math.abs(Math.sin(frame.ankleSpin.orbit)) * .58)) < 1e-8 && width >= .42 - 1e-8, 'depth turns retain full visible body width of the existing wrist spin');
          assert.ok(Math.abs(depth - Math.hypot(radial.x, radial.y)) < 1e-8 && depth >= .50 - 1e-8, 'the complete rotating body retains at least half its length at every depth phase');
          const skeleton = victim.animation.skeleton;
          for (let leg = 0; leg < 2; leg++) {
            assert.ok(distance(skeleton.hips[leg], skeleton.knees[leg]) <= 11.001 && distance(skeleton.knees[leg], skeleton.feet[leg]) <= 11.001, 'both supported legs keep complete normal bones during the full revolution');
          }
        }
        if (previousTurn !== undefined) assert.ok(Math.abs(driver.pivotTurn - previousTurn) <= Math.PI * 2 * frameDelta / ((kind === 'backbodydrop' ? 1150 : 1400) * .91) + 1e-8, 'the real rotation accelerates continuously and retains its release momentum without an angular reset');
        previousTurn = driver.pivotTurn;
        if (frame.stage === 'spin') spinFrames++;
        if (Math.abs(Math.abs(driver.pivotTurn) - Math.PI * 2) < 1e-8) fullTurnSeen = true;
      }
      if (window.contactAt == null) {
        assert.equal(exit, undefined, 'a planned collision cannot create a premature exit');
        assert.equal(capturedRanks()[actual.victim], undefined);
        if (kind === 'clothesline') runSeen ||= driver.pose === 'run' && Math.hypot(driver.velocityX, driver.velocityY) > 80;
        if (['powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'].includes(kind) && window.launchAt != null) {
          assert.ok(distance(frame.driver, contact.wrestlingMoveOrigins.driver) < .001, 'the receiver waits in place while the drawn loser runs toward the waist catch');
          runSeen ||= victim.pose === 'run' && Math.hypot(victim.velocityX, victim.velocityY) > 80;
          if (kind === 'backbodydrop' && frame.counterPreparation === 0 && elapsed > window.launchAt) {
            counterGuardSeen = true;
            assert.equal(driver.pose, 'guard'); assert.equal(driver.gripStrength ?? 0, 0); assert.equal(driver.backBodyProgress, 0);
          } else if (kind === 'backbodydrop' && frame.counterPreparation > 0) {
            counterPrepareSeen = true;
            assert.equal(driver.pose, 'backbodydrop'); assert.ok(driver.backBodyProgress > 0);
          }
        }
      }
      floorSeen ||= window.contactAt != null && elapsed >= frame.floorAt && frame.victimHeight < .001 && frame.victimSlam?.slump === 1;
      if (window.contactAt === elapsed) {
        actualContactAt = elapsed; contactSeen = true;
        if (kind === 'clothesline') {
          assert.ok(runSeen && elapsed - window.launchAt >= 320, 'the solo clothesline accelerates in a real run before striking');
          assert.ok(distance(frame.driver, contact.wrestlingMoveOrigins.launchDriver) > 70);
          const arm = frame.side < 0 ? 0 : 1;
          assert.equal(driver.clotheslineArm, arm, 'the actual directional strike uses its matching left or right arm');
          const insideForearm = { x: paintedDriver.elbows[arm].x + (paintedDriver.hands[arm].x - paintedDriver.elbows[arm].x) * .25, y: paintedDriver.elbows[arm].y + (paintedDriver.hands[arm].y - paintedDriver.elbows[arm].y) * .25 };
          assert.ok(segmentGap(contact.wrestlingMoveOrigins.target, paintedDriver.elbows[arm], insideForearm) < 8, `the actual inside elbow, rather than the fist, reaches the neck: ${detail(elapsed, frame)}`);
          assert.ok(distance(contact.wrestlingMoveOrigins.target, paintedDriver.hands[arm]) > 12, 'the striking fist extends beyond the neck');
          assert.equal(driver.clotheslineInner, true);
        }
        else if (kind === 'dropkick') {
          paintedDriver.feet.forEach((foot, leg) => assert.ok(distance(foot, frame.footTargets[leg]) < 7, `both real soles reach the chest: ${detail(elapsed, frame)}`));
          assert.ok(Math.abs(driver.angle) > 1.45, 'the wrestler kicks from an almost horizontal airborne body');
          assert.ok(Math.abs(paintedDriver.head.x - paintedDriver.waist.x) > Math.abs(paintedDriver.head.y - paintedDriver.waist.y) * 2, 'the actual head and hips are laid out horizontally');
          assert.ok((driver.depthY ?? scene.sim.bodies.get(actual.aggressor).y) - driver.y > 20, 'the two-foot strike takes place in the actual jump');
        } else if (kind === 'powerbomb') {
          assert.ok(runSeen, 'the actual opponent runs into the planted powerbomb receiver before the lift');
          assert.ok(distance(frame.victim, contact.wrestlingMoveOrigins.launchVictim) > 70, 'the incoming opponent covers a visible runway before the powerbomb catch');
          const targets = [{ x: paintedVictim.waist.x - frame.side * 6, y: paintedVictim.waist.y + 3 }, paintedVictim.waist];
          paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, targets[arm]) < 8, `both hands receive the actual waist before the overhead slam: ${detail(elapsed, frame)}`));
        }
        else if (kind === 'scoopslam') paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, cradleTargets(paintedVictim)[arm]) < 7, `the scoop accepts the actual back and thigh in separate hands: ${detail(elapsed, frame)}`));
        else assert.ok(paintedDriver.hands.some(hand => distance(hand, paintedVictim.waist) < 7), `receiver touches the real incoming waist (gap ${Math.min(...paintedDriver.hands.map(hand => distance(hand, paintedVictim.waist))).toFixed(2)}px): ${detail(elapsed, frame)}`);
      }
      if (kind === 'dropkick') {
        attackerJumped ||= frame.driverHeight > 20;
        if (window.launchAt != null && elapsed >= frame.landingAt && frame.driverHeight === 0) attackerLanded = true;
      }
      if (kind === 'powerbomb' && contactSeen && frame.gripMode === 'waist' && frame.gripStrength > .95) {
        const targets = [{ x: paintedVictim.waist.x - frame.side * 6, y: paintedVictim.waist.y + 3 }, paintedVictim.waist];
        paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, targets[arm]) < 8, `both actual waist contacts remain attached through the existing overhead lift: ${detail(elapsed, frame)}`));
        if (frame.powerbombLift === 1 && frame.powerbombDown === 0) {
          overheadFrames++;
          assert.ok(paintedVictim.waist.y < paintedDriver.head.y - 2, "the raised hips clear the caster's actual crown");
          assert.equal(victim.powerbombVictim, undefined); assert.equal(victim.pose, 'airborne'); assert.equal(driver.pose, 'overhead'); assert.equal(Math.abs(frame.victimAngle), 0);
        }
      }
      if ((kind === 'backbodydrop' || kind === 'spinebuster' || kind === 'scoopslam') && contactSeen && frame.gripMode === 'waist' && frame.gripStrength > .95) {
        assert.ok(paintedDriver.hands.some(hand => distance(hand, paintedVictim.waist) < 8), `the received waist remains supported while the catcher still holds it: ${detail(elapsed, frame)}`);
        if (kind === 'backbodydrop' && frame.backBodyRaise === 1) {
          overheadFrames++;
          assert.ok(paintedVictim.waist.y < paintedDriver.head.y - 2, 'the received waist is visibly raised above the catcher\'s actual head before turning over');
          assert.ok(frame.victimHeight > 105, 'the lifted body does not begin its flip at chest height');
        }
      }
      if (kind === 'scoopslam' && contactSeen && elapsed >= frame.floorAt && !frame.ankleSpin && !exit) {
        pivotFrames++;
        assert.ok(Math.abs(frame.victimAngle - frame.side * Math.PI / 2) < 1e-8, 'the quarter-turn lands on the complete back instead of inverting onto the crown');
        assert.equal(victim.pose, 'stunned'); assert.equal(victim.carryStretch, undefined, 'the supported carry ends at the actual back landing');
        assert.ok(distance(paintedVictim.waist, contact.wrestlingMoveOrigins.scoopFloorWaist) < 1, 'the back support fixes its actual floor point until the caster reaches the ankles');
        assert.ok(paintedVictim.headSides.every(point => point.y < contact.wrestlingMoveOrigins.scoopFloorVictim.y + 1), 'the flat landed skull remains above the actual sand plane');
      }
      if (kind === 'scoopslam' && contactSeen && frame.gripMode === 'cradle' && !exit) {
        scoopStages.add(frame.stage);
        if (frame.scoopLift > 0 && frame.scoopTurn > 0 && frame.scoopDown === 0 && frame.gripStrength > .95) overlapLiftTurnFrames++;
        if (frame.gripStrength > .95) paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, cradleTargets(paintedVictim)[arm]) < 8, `normal arms support the actual back and thigh through the load, rise and turn (gap ${distance(hand, cradleTargets(paintedVictim)[arm]).toFixed(2)}px): ${detail(elapsed, frame)}`));
        if (frame.scoopLift > .2 && frame.scoopDown === 0) {
          assert.equal(victim.carrySupport, 'cradle');
          if (frame.scoopLift < .7) assert.ok(distance(paintedVictim.waist, paintedDriver.waist) < 65, 'the received hips stay against the caster before the overhead lift');
        }
        scoopOverheadSeen ||= frame.scoopDown === 0 && paintedVictim.waist.y < paintedDriver.head.y - 2;
        if (frame.scoopLift === 1 && frame.scoopDown < .1) {
          scoopSupportFrames++;
          const paint = scene.ctx.records.get(driver.candidate.id);
          assert.equal(paint.shoes.length, 2, 'both actual shoe silhouettes are captured through the overhead turn');
          const shadow = paint.shadow;
          assert.ok(shadow && shadow.radiusX > 0 && shadow.radiusY > 0, 'the grounded scoop paints its real sand shadow');
          assert.ok(driver.animation.feet.some(foot => !foot.swinging && foot.lift < .05), 'the highest lift retains one actual planted support heel');
          const visibleSupport = paint.shoes.some(quad => {
            const normalized = quad.map(point => ({ x: (point.x - shadow.x) / shadow.radiusX, y: (point.y - shadow.y) / shadow.radiusY }));
            return normalized.some((point, index) => segmentGap({ x: 0, y: 0 }, point, normalized[(index + 1) % normalized.length]) <= 1);
          });
          // A short replacement step can cross the projected shadow boundary.
          // The complete overhead turn must never sustain two floating shoes.
          scoopFloatingMs = visibleSupport ? 0 : scoopFloatingMs + frameDelta;
          assert.ok(scoopFloatingMs <= 80, `both actual shoes cannot float clear of their painted sand shadow during the overhead turn: ${detail(elapsed, frame)}`);
          const skeleton = driver.animation.skeleton;
          for (let leg = 0; leg < 2; leg++) assert.ok(distance(skeleton.hips[leg], skeleton.knees[leg]) <= 11.02 && distance(skeleton.knees[leg], skeleton.feet[leg]) <= 11.02, 'standing under the overhead scoop keeps both connected normal legs');
        }
      }
      if (kind === 'scoopslam' && contactSeen && !exit && victim.slamImpact > .8) {
        scoopImpactSeen = true;
        assert.equal(victim.pose, 'stunned', 'the real floor impact ends the supported scoop before the ankle pickup');
        assert.equal(victim.eyesClosed, true, 'the visible impact leaves the opponent unconscious');
      }
      if (kind === 'clothesline' && contactSeen && !exit) {
        clotheslineStages.add(frame.stage);
        if (frame.stage === 'fall') {
          casterPassedVictim ||= frame.side * (driver.x - victim.x) > 12 && frame.side * (paintedDriver.waist.x - paintedVictim.waist.x) > 12;
        }
        if (frame.stage === 'fall' && Math.abs(frame.driverAngle) > 1 && Math.abs(frame.victimAngle) > 1) {
          sharedFallSeen = true;
          assert.ok(driver.slamProgress.slump > .6 && victim.slamProgress.slump > .6, 'both painted bodies take the same fall');
        }
        if (frame.stage === 'fall') {
          const driverSkin = scene.ctx.records.get(driver.candidate.id).headSkin;
          const victimSkin = scene.ctx.records.get(victim.candidate.id).headSkin;
          assert.ok(driverSkin && victimSkin, 'both actual painted head rectangles are captured during the shared fall');
          const driverHeadX = driverSkin.reduce((sum, point) => sum + point.x, 0) / driverSkin.length;
          const victimHeadX = victimSkin.reduce((sum, point) => sum + point.x, 0) / victimSkin.length;
          if (elapsed - window.contactAt >= 240 && driver.angle * victim.angle < -.5
            && (driverHeadX - paintedDriver.waist.x) * (victimHeadX - paintedVictim.waist.x) < -100) oppositeHeadDirectionMs += frameDelta;
        }
        if (driver.pose === 'recover') {
          clotheslineStages.add('recover');
          assert.equal(victim.pose, 'stunned'); assert.equal(frame.victimHeight, 0);
        }
        if (frame.stage === 'ankle-approach') {
          standingBeforeGrip = true; assert.equal(frame.driverAngle, 0); assert.equal(frame.driverSlam, undefined);
          assert.ok(elapsed - window.contactAt >= 900, 'the shared fall and the attacker\'s rise complete before the ankle approach');
        }
      }
      if (kind === 'spinebuster' && contactSeen) {
        assert.equal(window.kickAt, null, 'receiving the rush ends with the actual ankle grab and full revolution');
        if (frame.gripMode === 'ankle') assert.ok(window.contactAt != null && elapsed >= frame.pickupReadyAt, 'the received weight, lift, floor slam and stun precede the ankle approach');
        if (frame.spineLift > .5 && frame.spineDown > 0 && frame.spineDown < .8) spineOverlapFrames++;
        if (frame.spineLift > .85 && elapsed < frame.floorAt - 80 && previousRig) {
          spinePause = distance(paintedVictim.waist, previousRig.waist) < .5 ? spinePause + frameDelta : 0;
          maxSpinePause = Math.max(maxSpinePause, spinePause);
          assert.ok(maxSpinePause <= 80, 'the actual supported hips flow from the lift into the slam without a held peak pause');
        }
      }
      if (['clothesline', 'powerbomb', 'backbodydrop', 'scoopslam', 'spinebuster'].includes(kind)) {
        if (window.ankleGripAt == null) assert.equal(exit, undefined, 'the slam does not replace actual two-toe pickup');
        if (window.ankleGripAt != null && !exit) {
          anklesSeen = true; ankleFrames++;
          assert.ok(floorSeen, 'the opponent lies at the actual slam point before its ankles can be picked up');
          if (kind === 'scoopslam') {
            assert.equal(frame.ankleApproach, 1, 'the caster finishes its normal arm reach before establishing an actual ankle hold');
            assert.ok(window.ankleGripAt - window.contactAt >= 1780 + 200 + 240, 'the supported load, lift, turn, floor landing and reaching hand each finish before the ankle grab');
            assert.equal(frame.requiredReleaseAt, window.ankleGripAt + 1920);
            if (elapsed - window.ankleGripAt < 520) {
              assert.equal(frame.victimHeight, 0);
              if (elapsed > window.ankleGripAt) assert.ok(Math.abs(driver.pivotTurn) > 0, 'taking the actual ankle weight flows directly into the beginning of the turn');
            }
          }
          paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, paintedVictim.feet[driver.ankleGripReversed ? 1 - arm : arm]) < 8, `both painted toes stay in the palms for the complete preflight stroke (gap ${distance(hand, paintedVictim.feet[driver.ankleGripReversed ? 1 - arm : arm]).toFixed(2)}px): ${detail(elapsed, frame)}`));
        }
      }
      if (exit && !releaseSeen) {
        releaseSeen = true;
        assert.ok(contactSeen && actualContactAt <= elapsed, 'the actual hit precedes the only exit');
        if (['clothesline', 'powerbomb', 'backbodydrop', 'scoopslam', 'spinebuster'].includes(kind)) assert.ok(anklesSeen && ankleFrames >= (frameDelta === 16 ? 8 : 4), 'the actual two-ankle grab persists through the load and complete revolution');
        if (spinFinish) {
          assert.equal(frame.requiredReleaseAt, window.ankleGripAt + (kind === 'backbodydrop' ? 1670 : 1920), 'the actual ankle grip owns the load and complete revolution, with no separate throw pause');
          assert.ok(spinFrames >= (frameDelta === 16 ? 55 : 17), 'the actual caster visibly completes one full revolution before release');
          const releaseTurn = Math.abs(frame.pivotTurn), lateTurn = Math.abs(frame.ankleOrbitVelocity) * frameDelta / 1000;
          assert.ok(releaseTurn >= Math.PI * 2 - 1e-8 && releaseTurn <= Math.PI * 2 + lateTurn + 1e-8, 'the full turn continues only through the actual hand-opening frame');
          fullTurnSeen = true;
          assert.ok(elapsed - frame.requiredReleaseAt < frameDelta, 'release occurs on the first frame that finishes the full revolution');
          assert.ok(Math.abs(frame.ankleAngularVelocity) > 4.4, 'the full revolution releases while it still carries forceful angular momentum');
          assert.ok(exit.spinFlight && Math.hypot(exit.spinFlight.velocity.x, exit.spinFlight.velocity.y) > 50, 'the exit inherits the real final mass velocity');
          assert.ok(Math.abs(exit.spinFlight.velocity.x) > Math.abs(exit.spinFlight.velocity.y) * 3, 'the actual final body motion exits left or right instead of downward');
          assert.ok(!inside(exit.landing), 'the inherited tangent carries the body beyond the actual rim');
          const outward = Math.sign(exit.spinFlight.velocity.x);
          const rimHalfWidth = 303 * Math.sqrt(Math.max(0, 1 - ((exit.landing.y - 416) / 112) ** 2));
          assert.ok((exit.landing.x - 500) * outward - rimHalfWidth >= 180, 'the full-turn throw travels well beyond the rim instead of leaving only its root outside');
        }
        if (previousRig) {
          const cap = 15 + frameDelta * .5;
          const spinningRelease = spinFinish && previousSpinWeight === 1 && previousSpinMatrix;
          const transport = spinningRelease ? multiply(exit.spinSnapshot.matrix, inverse(previousSpinMatrix)) : undefined;
          if (transport) {
            const speed = Math.hypot(exit.spinFlight.velocity.x, exit.spinFlight.velocity.y);
            assert.ok(distance(paintedVictim.waist, previousRig.waist) < speed * frameDelta / 1000 * 1.15 + 2, 'the real release mass cannot teleport under its rotating silhouette');
            const priorAngle = Math.atan2(previousSpinMatrix[1] * victim.facing, previousSpinMatrix[0] * victim.facing);
            const currentAngle = Math.atan2(exit.spinSnapshot.matrix[1] * victim.facing, exit.spinSnapshot.matrix[0] * victim.facing);
            const angularStep = Math.abs(Math.atan2(Math.sin(currentAngle - priorAngle), Math.cos(currentAngle - priorAngle)));
            assert.ok(angularStep <= Math.abs(frame.ankleOrbitVelocity) * frameDelta / 1000 / .50 + 1e-8, 'the release turns only by the elapsed visible orbital motion');
          }
          for (const [point, prior] of paintedPoints(paintedVictim).map((point, index) => [point, paintedPoints(previousRig)[index]])) {
            const expected = transport ? project(transport, prior) : prior;
            assert.ok(distance(point, expected) < (transport ? 3 : cap), `release cannot reset its actually rotating skeleton (gap ${distance(point, expected).toFixed(2)}px): ${detail(elapsed, frame)}`);
          }
        }
        assert.equal(exit.round.victim, scene.planned.victim);
      }
      if (spinFinish && exit && elapsed > exit.launchedAt && elapsed - exit.launchedAt <= 100 && previousRig) {
        tangentFrames++;
        assert.equal(victim.pose, 'airborne', 'the released body immediately enters free flight without a hold stage');
        const moved = { x: paintedVictim.waist.x - previousRig.waist.x, y: paintedVictim.waist.y - previousRig.waist.y }, velocity = exit.spinFlight.velocity;
        assert.ok(moved.x * velocity.x + moved.y * velocity.y > 0, 'the first free frame continues the measured release tangent');
        assert.ok((moved.x * velocity.x + moved.y * velocity.y) / (Math.hypot(moved.x, moved.y) * Math.hypot(velocity.x, velocity.y)) > .85, 'free flight does not change to an unrelated straight throw direction');
      }
      if (spinFinish && exit && elapsed - exit.launchedAt >= exit.spinFlight.duration && elapsed - exit.launchedAt < exit.spinFlight.duration + frameDelta) {
        const outward = Math.sign(exit.spinFlight.velocity.x);
        assert.ok(paintedPoints(paintedVictim).every(point => (point.x - 500) * outward > 303 + 24), 'at the real landing, the whole head, trunk, arms and feet clear the widest edge of the sand');
        distantLandingSeen = true;
      }
      previousRig = structuredClone(paintedVictim); previousDriverRig = structuredClone(paintedDriver); previousDriverFacing = driver.facing;
      previousDriverLeftArms = driver.animation.clotheslineLeftArms;
      previousSpinMatrix = victim.animation.spinSnapshot?.matrix ? [...victim.animation.spinSnapshot.matrix] : undefined;
      previousSpinWeight = victim.spinSuspension?.weight;
    }
    assert.ok(contactSeen && finalSeen, JSON.stringify({ kind, mirrored, frameDelta, contactSeen, releaseSeen, finalSeen, anklesSeen, fallbackSeen }));
    assert.equal(fallbackSeen, false, 'a connected finishing technique cannot replace its floor pickup with a rematch');
    assert.ok(releaseSeen, 'a contacted finishing technique must complete its real release');
    if (kind === 'backbodydrop' || kind === 'spinebuster' || kind === 'scoopslam') assert.ok(runSeen, 'the incoming opponent has a visible actual run before the receiver catches');
    if (kind === 'backbodydrop') assert.ok(counterGuardSeen && counterPrepareSeen, 'the receiver stays normal through the first half of the real run, then visibly prepares the counter');
    if (kind === 'backbodydrop' || kind === 'powerbomb') assert.ok(overheadFrames >= 1, 'the real waist visibly clears the receiver\'s head before the flip');
    if (spinFinish) assert.ok(fullTurnSeen && tangentFrames >= 1 && distantLandingSeen, 'one full rotation, its immediate tangent flight and the completely outside landing all occur in the actual painted Scene');
    if (kind === 'dropkick') assert.ok(attackerJumped && attackerLanded, 'the attacking jump returns to the sand while only the hit loser exits');
    if (kind === 'spinebuster') assert.ok(spineOverlapFrames >= (frameDelta === 16 ? 6 : 2), 'the received weight starts descending while the continuous lift is still completing');
    if (kind === 'scoopslam') {
      assert.ok(['contact', 'lift', 'turn', 'fall', 'groggy'].every(stage => scoopStages.has(stage)), 'a scoop visibly receives the weight, rises, turns and lands before the ankle finish');
      assert.ok(overlapLiftTurnFrames >= (frameDelta === 16 ? 6 : 2), 'the back and thigh stay supported as the rising body flows directly into its turn');
      assert.ok(pivotFrames >= (frameDelta === 16 ? 12 : 4), 'the actual back landing and stunned recovery have a visible floor beat before the ankle finish');
      assert.ok(scoopOverheadSeen && scoopImpactSeen, 'the real supported waist clears the caster crown and lands with a visible unconscious impact');
      assert.ok(scoopSupportFrames > 0, 'the actual highest lift exercises its planted heel support');
    }
    if (kind === 'clothesline') assert.ok(casterPassedVictim && oppositeHeadDirectionMs >= 80 && sharedFallSeen && standingBeforeGrip && ['fall', 'recover', 'ankle-approach', 'ankle-grip', 'spin', 'toss'].every(stage => clotheslineStages.has(stage)), 'the flying caster passes the opponent and their painted bodies fall in opposite orientations before the rise, ankle pickup, full turn and throw');
  }
});

for (const kind of Object.keys(seeds).filter(kind => kind !== 'dropkick')) for (const mirrored of [false, true]) for (const frameDelta of [16, 50]) test(`${kind}: natural ankle pickup flows into its full swing (${mirrored ? 'mirrored' : 'ordinary'}, ${frameDelta}ms)`, () => {
  const scene = game(kind, { controlled: false, mirrored, frameDelta });
  let firstTurnAt, fullyRaisedIdle = 0, previousTurn, heldFrames = 0, released = false, completed = false;
  for (let elapsed = 0; elapsed < 25000; elapsed += frameDelta) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(scene.planned.id), window = contact?.round.wrestlingMove;
    assert.equal(window?.kind, kind, 'the real encounter completes its selected slam without an ordinary fallback');
    const driver = actors.get(scene.planned.aggressor), victim = actors.get(scene.planned.victim), exit = scene.sim.exits.get(scene.planned.victim);
    if (capturedRanks()[scene.planned.victim]) { assert.deepEqual(capturedRanks(), { '1': 2, '2': 1 }); completed = true; break; }
    const frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, contact.round.contactSide);
    if (window.ankleGripAt != null && !exit) {
      heldFrames++;
      assert.ok(window.ankleGripAt >= frame.pickupReadyAt, 'the actual floor recovery and hand approach precede the two-foot contact');
      const palms = driver.animation.contactPoints, rig = victim.animation.contactPoints, weight = victim.spinSuspension?.weight;
      for (let limb = 0; limb < 2; limb++) {
        assert.ok(distance(palms.hands[limb], rig.feet[driver.ankleGripReversed ? 1 - limb : limb]) < 1, `${elapsed}: each live palm stays on its own foot while the lift and turn overlap`);
        assert.ok(Math.abs(distance(palms.shoulders[limb], palms.elbows[limb]) - 11 * driver.scale) < .001);
        assert.ok(Math.abs(distance(palms.elbows[limb], palms.hands[limb]) - 10.5 * driver.scale) < .001);
        const skeleton = victim.animation.skeleton;
        assert.ok(Math.abs(distance(skeleton.hips[limb], skeleton.knees[limb]) - 11) < .02);
        assert.ok(Math.abs(distance(skeleton.knees[limb], skeleton.feet[limb]) - 11) < .02);
      }
      const turn = Math.abs(driver.pivotTurn);
      if (firstTurnAt === undefined && turn > .01) {
        firstTurnAt = elapsed;
        assert.ok(weight < 1, `${elapsed}: the actual caster begins turning while it is still raising the ankle weight`);
        assert.ok(elapsed - window.ankleGripAt <= 200 + frameDelta, 'the visible turn starts promptly after the real grip instead of waiting through a separate preparation pause');
      }
      if (weight >= .9) {
        fullyRaisedIdle = previousTurn !== undefined && turn - previousTurn < .0001 ? fullyRaisedIdle + frameDelta : 0;
        assert.ok(fullyRaisedIdle <= 80, 'the raised opponent cannot remain motionless before the full swing starts');
      }
      previousTurn = turn;
    }
    if (exit && !released) {
      assert.ok(firstTurnAt !== undefined && heldFrames >= 8, 'the real two-foot pickup and overlapping turn occur before release');
      assert.ok(Math.abs(driver.pivotTurn) >= Math.PI * 2 - 1e-8, 'the actual caster finishes one complete revolution');
      assert.ok(elapsed >= frame.requiredReleaseAt && elapsed - frame.requiredReleaseAt < frameDelta, 'the hands open on the first completed-turn frame');
      assert.ok(exit.spinFlight && Math.abs(exit.spinFlight.velocity.x) > 50 && Math.abs(exit.spinFlight.velocity.x) > Math.abs(exit.spinFlight.velocity.y) * 3, 'the real release continues its lateral tangent momentum');
      released = true;
    }
  }
  assert.ok(released && completed, 'the overlapping pickup, whole turn, free flight and original drawn result complete');
});

test('natural production starting layouts either complete the selected move or resume an ordinary bout with the same finalists', () => {
  for (const kind of Object.keys(seeds)) {
    const scene = game(kind, { controlled: false, frameDelta: 50 });
    let contacted = false, declined = false, finished = false;
    let dropkickRun = false, previousRoot, dropkickPause = 0, maxDropkickPause = 0, launchSpeed;
    for (let elapsed = 0; elapsed < 25000; elapsed += 50) {
      const actors = scene.step(elapsed);
      const actual = scene.sim.contacts.get(scene.planned.id)?.round;
      contacted ||= actual?.wrestlingMove?.contactAt != null;
      declined ||= !!actual && !actual.wrestlingMove;
      if (capturedRanks()['1']) { assert.deepEqual(capturedRanks(), { '1': 2, '2': 1 }); finished = true; break; }
      assert.ok(!scene.sim.exits.has('2'));
      if (kind === 'dropkick') {
        const driver = actors.get(scene.planned.aggressor), root = { x: driver.x, y: driver.depthY ?? driver.y };
        dropkickRun ||= driver.pose === 'run' && Math.hypot(driver.velocityX, driver.velocityY) > 80;
        if (dropkickRun && !(driver.suspension > 0) && actual?.wrestlingMove?.contactAt == null && previousRoot) {
          dropkickPause = distance(root, previousRoot) < .5 ? dropkickPause + 50 : 0;
          maxDropkickPause = Math.max(maxDropkickPause, dropkickPause);
        }
        if (driver.pose === 'dropkick' && launchSpeed === undefined) launchSpeed = Math.hypot(driver.velocityX, driver.velocityY);
        previousRoot = root;
      }
    }
    assert.ok(finished && (contacted || declined), JSON.stringify({ kind, contacted, declined, finished }));
    if (kind === 'dropkick') {
      assert.ok(contacted && !declined && dropkickRun && maxDropkickPause <= 100, 'the natural wrestler runs directly into the two-foot jump without a preparation standstill');
      assert.ok(launchSpeed > 100, 'the actual jump inherits a running launch speed');
    }
  }
});
