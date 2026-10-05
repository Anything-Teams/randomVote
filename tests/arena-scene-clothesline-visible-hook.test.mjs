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
  .replace(draw, `hookTestActors = actors; ${draw}`)
  .replace(init, `hookTestInitialize(sim, reset); ${init}`);
source += '\nlet hookTestActors; const hookTestScenery = () => {}; let hookTestInitialize = () => {}; export const setInitialize = fn => { hookTestInitialize = fn; }; export const capturedActors = () => hookTestActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capturedActors, setInitialize } = module.exports;
const noop = () => {};
const ctx = new Proxy({ globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segmentGap = (point, from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const p = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, { x: from.x + dx * p, y: from.y + dy * p });
};
const painted = rig => [rig.head, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order: ['2', '1'], duration: 44000, arenaRushRoll: 7, arenaEscapeSeed: 19, paused: false, preview: false };
const planned = arenaRounds(props.order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed)[0];
assert.equal(planned.wrestlingMove?.kind, 'clothesline');


function neck(rig) {
  const head = { x: (rig.headSides[0].x + rig.headSides[1].x) / 2, y: (rig.headSides[0].y + rig.headSides[1].y) / 2 };
  const shoulders = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 };
  return { x: head.x + (shoulders.x - head.x) * .65, y: head.y + (shoulders.y - head.y) * .65 };
}
for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`the extended flying arm meets the neck before its body drives through (${mirrored ? 'mirrored' : 'ordinary'}/${delta}ms)`, () => {
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
  let contactSeen = false, leadingMomentum = false, firstMomentum = false, floorSeen = false, previous, airborneMs = 0;
  let contactWaist, contactRoot, incomingSpeed;
  for (let elapsed = 0; elapsed <= 9000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const contact = sim.contacts.get(planned.id), round = contact?.round, window = round?.wrestlingMove;
    if (!contact?.started) continue;
    assert.equal(window?.kind, 'clothesline', 'the real flying strike must not fall back to an ordinary attack');
    const frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, round.contactSide);
    const driver = capturedActors().get(round.aggressor), victim = capturedActors().get(round.victim);
    const rig = driver.animation.contactPoints, defended = victim.animation.contactPoints;
    if (window.contactAt == null && driver.depthY - driver.y > 8) airborneMs += delta;
    if (window.contactAt === elapsed) {
      const target = neck(defended), elbow = rig.elbows[1], hand = rig.hands[1], shoulder = rig.shoulders[1];
      const upperAngle = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x), forearmAngle = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
      const bend = Math.abs(Math.atan2(Math.sin(forearmAngle - upperAngle), Math.cos(forearmAngle - upperAngle)));
      const upperInside = { x: shoulder.x + (elbow.x - shoulder.x) * .5, y: shoulder.y + (elbow.y - shoulder.y) * .5 };
      const lowerInside = { x: elbow.x + (hand.x - elbow.x) * .45, y: elbow.y + (hand.y - elbow.y) * .45 };
      assert.ok(airborneMs >= 80, 'the actual striker visibly jumps from its running approach');
      assert.ok(bend <= .3, `the extended striking arm must stay nearly straight at contact: ${mirrored}/${delta}/${bend}`);
      assert.ok(Math.min(segmentGap(target, upperInside, elbow), segmentGap(target, elbow, lowerInside)) < 8, 'the actual neckline meets the middle upper arm, inner elbow or beginning of the forearm');
      assert.ok(distance(hand, target) > 12, 'the fist passes the neckline rather than causing the collision');
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
        assert.ok(incomingSpeed > 300 && speed >= incomingSpeed * .85, 'the first actual collision step retains the incoming forward tangent instead of stopping at the neckline');
        firstMomentum = true;
      }
      // Check the carried incoming momentum before the bodies decelerate into
      // their floor poses. The final sand positions remain unchanged.
      if (age >= 96 && age <= 112) {
        assert.ok(frame.side * (rig.waist.x - contactWaist.x) >= Math.max(28, age * .1), 'the collision carries the attacking trunk a full torso width forward from its first contact position before the fall slows');
        assert.ok(frame.side * (rig.waist.x - defended.waist.x) >= 20, 'after first striking in front, the actual attacking trunk passes the opponent during the same early collision beat');
        leadingMomentum = true;
      }
    }
    if (window.contactAt != null && elapsed >= frame.floorAt) {
      assert.ok(frame.side * (driver.x - victim.x) >= 67.9, 'the attacker completes the forward pass before both bodies land');
      assert.ok(driver.angle * victim.angle < -1, 'the two real bodies land in opposite orientations');
      assert.equal(victim.pose, 'stunned'); assert.equal(victim.eyesClosed, true);
      floorSeen = true; break;
    }
    previous = structuredClone(rig);
  }
  assert.ok(contactSeen && firstMomentum && leadingMomentum && floorSeen, 'the same running jump reaches the neck, preserves its incoming motion, drives through the body and completes the floor knockout');
});
