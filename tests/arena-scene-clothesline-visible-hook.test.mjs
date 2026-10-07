import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Run the real Scene from a running start. Contact, jump time, carried
// momentum and the subsequent floor impact all come from production.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const init = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(init));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'hookTestScenery(ctx, clock,')
  .replace(draw, 'hookTestActors = actors; hookTestSceneMatrix = ctx.captureMatrix(); arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.beginActor(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.endActor(); });')
  .replace(init, `hookTestInitialize(sim, reset); ${init}`);
source += '\nlet hookTestActors, hookTestSceneMatrix; const hookTestScenery = () => {}; let hookTestInitialize = () => {}; export const setInitialize = fn => { hookTestInitialize = fn; }; export const capturedActors = () => hookTestActors; export const capturedSceneMatrix = () => hookTestSceneMatrix; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capturedActors, capturedSceneMatrix, setInitialize } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const inverse = matrix => {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  assert.ok(Math.abs(determinant) > 1e-6);
  return [matrix[3] / determinant, -matrix[1] / determinant, -matrix[2] / determinant, matrix[0] / determinant, (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant, (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant];
};
function context() {
  let matrix = identity(), actorId, stack = [];
  const rectangles = [], target = {
    globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; target.globalAlpha = saved.alpha; } },
    transform(...next) { matrix = multiply(matrix, next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    fillRect(x, y, width, height) {
      if (target.globalAlpha <= 0) return;
      rectangles.push({ owner: actorId, width, height, alpha: target.globalAlpha, corners: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }].map(point => project(matrix, point)) });
    },
    captureMatrix: () => [...matrix], beginActor(actor) { actorId = actor.candidate.id; }, endActor() { actorId = undefined; }, rectangles,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
const ctx = context();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segmentGap = (point, from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const p = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, { x: from.x + dx * p, y: from.y + dy * p });
};
const painted = rig => [rig.head, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const inside = (point, quad) => {
  const sides = quad.map((from, index) => { const to = quad[(index + 1) % quad.length]; return (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x); });
  return sides.every(side => side >= -1e-7) || sides.every(side => side <= 1e-7);
};
function assertVisibleNeckStrike(driver, victim, rig, arm) {
  const world = inverse(capturedSceneMatrix());
  const rectangles = ctx.rectangles.map((rect, index) => ({ ...rect, index, corners: rect.corners.map(point => project(world, point)) }));
  const middle = (from, to) => ({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  const center = rect => middle(rect.corners[0], rect.corners[2]);
  const segments = [
    { width: 13, height: 5.5, center: middle(rig.shoulders[arm], rig.elbows[arm]) },
    { width: 12.5, height: 4.9, center: middle(rig.elbows[arm], rig.hands[arm]) },
  ].map(segment => rectangles.findLast(rect => Math.abs(rect.width - segment.width) < .001 && rect.height === segment.height && distance(center(rect), segment.center) < .001));
  assert.ok(segments.every(Boolean), 'the chosen arm is actually painted as two connected strokes');
  const driverHead = rectangles.find(rect => rect.owner === driver.candidate.id && rect.height === 16 && rect.width >= 14 && rect.width <= 16);
  assert.ok(driverHead && segments.every(segment => segment.index > driverHead.index), 'the striking arm remains visible in front of its own torso and head');
  const driverBody = rectangles.filter(rect => rect.owner === driver.candidate.id), victimBody = rectangles.filter(rect => rect.owner === victim.candidate.id);
  assert.ok(driverBody.length && victimBody.length && driverBody.at(-1).index < victimBody[0].index, 'the complete attacking body is painted behind the opponent regardless of participant input order');
  const freeArm = 1 - arm;
  for (const segment of [
    { width: 13, height: 5.5, center: middle(rig.shoulders[freeArm], rig.elbows[freeArm]) },
    { width: 12.5, height: 4.9, center: middle(rig.elbows[freeArm], rig.hands[freeArm]) },
  ]) {
    const stroke = rectangles.findLast(rect => Math.abs(rect.width - segment.width) < .001 && rect.height === segment.height && distance(center(rect), segment.center) < .001);
    assert.ok(stroke && stroke.index < victimBody[0].index, 'the free arm stays behind the opponent; only the neck-striking arm crosses the foreground');
  }
  const victimNeck = rectangles.find(rect => rect.owner === victim.candidate.id && rect.width === 5.4 && rect.height === 7);
  assert.ok(victimNeck, 'the contact check uses the neck rectangle actually painted for the opponent');
  const bounds = victimNeck.corners;
  let paintedContactPixels = 0, visibleContactPixels = 0;
  for (let x = Math.min(...bounds.map(point => point.x)); x <= Math.max(...bounds.map(point => point.x)); x += .5) for (let y = Math.min(...bounds.map(point => point.y)); y <= Math.max(...bounds.map(point => point.y)); y += .5) {
    const point = { x, y };
    if (!inside(point, bounds)) continue;
    const stroke = segments.find(segment => inside(point, segment.corners));
    if (!stroke) continue;
    paintedContactPixels++;
    const last = rectangles.findLast(rect => rect.alpha > .99 && inside(point, rect.corners));
    if (stroke.index > victimNeck.index && last.index >= stroke.index && last.owner !== victim.candidate.id) visibleContactPixels++;
  }
  assert.ok(paintedContactPixels > 0, 'the selected arm silhouette actually overlaps the painted neck at impact');
  assert.ok(visibleContactPixels > 0, 'the arm-neck impact remains visibly painted instead of being covered by the opponent');
}
function assertPerpendicularNeckStrike(rig, arm) {
  const trunk = { x: rig.head.x - rig.waist.x, y: rig.head.y - rig.waist.y };
  const striking = { x: rig.hands[arm].x - rig.shoulders[arm].x, y: rig.hands[arm].y - rig.shoulders[arm].y };
  const trunkLength = Math.hypot(trunk.x, trunk.y), armLength = Math.hypot(striking.x, striking.y);
  assert.ok(Math.abs(trunk.y) / trunkLength >= .9, 'the real attacking trunk stays upright at the neck strike instead of becoming a sideways diving body');
  assert.ok(Math.abs(striking.y) / armLength <= .2, 'the actual striking arm extends horizontally at neck height instead of aiming diagonally');
  const alignment = Math.abs(trunk.x * striking.x + trunk.y * striking.y) / (trunkLength * armLength);
  assert.ok(alignment <= .3, 'the connected shoulder-to-hand arm is approximately perpendicular to the painted head-to-waist body axis');
}
const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order: ['2', '1'], duration: 44000, arenaRushRoll: 7, arenaEscapeSeed: 19, paused: false, preview: false };
const planned = arenaRounds(props.order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed)[0];
assert.equal(planned.wrestlingMove?.kind, 'clothesline');


function neck(rig) {
  const head = { x: (rig.headSides[0].x + rig.headSides[1].x) / 2, y: (rig.headSides[0].y + rig.headSides[1].y) / 2 };
  const shoulders = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 };
  return { x: head.x + (shoulders.x - head.x) * .65, y: head.y + (shoulders.y - head.y) * .65 };
}
for (const mirrored of [false, true]) for (const delta of [16, 50]) for (const rearStriker of [false, true]) test(`the upright runner stays behind the opponent while its perpendicular arm visibly strikes the neck (${mirrored ? 'mirrored' : 'ordinary'}/${delta}ms/${rearStriker ? 'rear input order' : 'front input order'})`, () => {
  // At a shared ground depth, participant input order decides which full body
  // would ordinarily be painted last. The attacking body must remain behind
  // the opponent in both cases, with only its striking arm above the neckline.
  const runProps = { ...props, candidates: rearStriker ? [...props.candidates].reverse() : props.candidates };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: 320, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: 520, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let contactSeen = false, leadingMomentum = false, firstMomentum = false, floorSeen = false, previous, runningMs = 0;
  let contactWaist, contactRoot, incomingSpeed, strikingArm;
  for (let elapsed = 0; elapsed <= 9000; elapsed += delta) {
    ctx.rectangles.length = 0;
    render(ctx, runProps, elapsed, elapsed, sim, delta, false);
    const contact = sim.contacts.get(planned.id), round = contact?.round, window = round?.wrestlingMove;
    if (!contact?.started) continue;
    assert.equal(window?.kind, 'clothesline', 'the actual running neck strike must not fall back to an ordinary attack');
    const frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, round.contactSide);
    const driver = capturedActors().get(round.aggressor), victim = capturedActors().get(round.victim);
    const rig = driver.animation.contactPoints, defended = victim.animation.contactPoints;
    if (driver.clotheslineStrength > .001) {
      assert.equal(driver.clotheslineArm, mirrored ? 0 : 1, 'the mirrored leftward run uses its left arm; the rightward run uses its right arm');
      strikingArm ??= driver.clotheslineArm;
      assert.equal(driver.clotheslineArm, strikingArm, 'the strike keeps the same arm throughout extension, collision and follow-through');
      if (window.contactAt == null && Math.abs(driver.velocityX) > 80) assert.equal(Math.sign(driver.velocityX), mirrored ? -1 : 1, 'the selected arm belongs to the actual leftward or rightward approach');
    }
    if (window.contactAt == null && driver.pose === 'run' && Math.hypot(driver.velocityX, driver.velocityY) > 80) runningMs += delta;
    if (window.contactAt === elapsed) {
      assert.equal(driver.clotheslineArm, strikingArm);
      const target = neck(defended), elbow = rig.elbows[strikingArm], hand = rig.hands[strikingArm], shoulder = rig.shoulders[strikingArm];
      const upperAngle = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x), forearmAngle = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
      const bend = Math.abs(Math.atan2(Math.sin(forearmAngle - upperAngle), Math.cos(forearmAngle - upperAngle)));
      const upperInside = { x: shoulder.x + (elbow.x - shoulder.x) * .5, y: shoulder.y + (elbow.y - shoulder.y) * .5 };
      const lowerInside = { x: elbow.x + (hand.x - elbow.x) * .45, y: elbow.y + (hand.y - elbow.y) * .45 };
      assert.ok(runningMs >= 80, 'the upright strike follows a visible moving run rather than a static pose at the neckline');
      assert.ok(bend <= .3, `the extended striking arm must stay nearly straight at contact: ${mirrored}/${delta}/${bend}`);
      assert.ok(Math.min(segmentGap(target, upperInside, elbow), segmentGap(target, elbow, lowerInside)) < 8, 'the actual neckline meets the middle upper arm, inner elbow or beginning of the forearm');
      assert.ok(distance(hand, target) > 12, 'the fist passes the neckline rather than causing the collision');
      assertPerpendicularNeckStrike(rig, strikingArm);
      assertVisibleNeckStrike(driver, victim, rig, strikingArm);
      assert.ok(previous && frame.side * (previous.waist.x - target.x) < 0, 'the incoming trunk is still before the neckline immediately before contact');
      assert.ok(frame.side * (rig.waist.x - target.x) <= 1, 'the extended arm hits before the trunk passes the neckline instead of hooking it from behind');
      contactWaist = { ...rig.waist }; contactRoot = { x: driver.x, y: driver.depthY }; incomingSpeed = frame.side * frame.driverVelocity.x;
      contactSeen = true;
    }
    if (window.contactAt != null && elapsed <= frame.floorAt) {
      for (const arm of [0, 1]) {
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * driver.scale) < .001, 'the moving strike has an attached normal upper arm');
        assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * driver.scale) < .001, 'the extended forearm keeps its normal length');
      }
      if (previous) painted(rig).forEach((point, index) => assert.ok(distance(point, painted(previous)[index]) < 8 + delta * .9, 'neck contact cannot teleport the arm, trunk or feet'));
      const age = elapsed - window.contactAt;
      if (age === delta) {
        const speed = frame.side * (driver.x - contactRoot.x) * 1000 / age;
        assert.ok(incomingSpeed > 0 && speed >= incomingSpeed * .85, 'the first actual collision step retains the recorded incoming forward tangent instead of stopping at the neckline');
        firstMomentum = true;
      }
      // Check the carried incoming momentum before the bodies decelerate into
      // their floor poses. The final sand positions remain unchanged.
      if (age >= 96 && age <= 112) {
        assert.ok(frame.side * (rig.waist.x - contactWaist.x) >= Math.max(28, age * .1), 'the collision carries the attacking trunk a full torso width forward from its first contact position before the fall slows');
      }
      // A straight upright body begins farther behind the neckline than the
      // former sideways dive. Its recorded momentum still carries the actual
      // hip beyond the opponent as the same collision develops into the fall.
      if (age >= 160 && elapsed < frame.floorAt && frame.side * (rig.waist.x - defended.waist.x) >= 20) leadingMomentum = true;
    }
    if (window.contactAt != null && elapsed >= frame.floorAt) {
      assert.ok(frame.side * (driver.x - victim.x) >= 67.9, 'the attacker completes the forward pass before both bodies land');
      assert.ok(driver.angle * victim.angle < -1, 'the two real bodies land in opposite orientations');
      assert.equal(victim.pose, 'stunned'); assert.equal(victim.eyesClosed, true);
      floorSeen = true; break;
    }
    previous = structuredClone(rig);
  }
  assert.ok(contactSeen && firstMomentum && leadingMomentum && floorSeen, 'the same upright running strike reaches the neck, preserves its incoming motion, drives through the body and completes the floor knockout');
});
