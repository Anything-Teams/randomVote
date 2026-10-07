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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'arcTestScenery(ctx, clock,')
  .replace(draw, `arcTestActors = actors; ${draw}`)
  .replace(init, `arcTestInitialize(sim, reset); ${init}`);
source += '\nlet arcTestActors; const arcTestScenery = () => {}; let arcTestInitialize = () => {}; export const setInitialize = fn => { arcTestInitialize = fn; }; export const capturedActors = () => arcTestActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
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

for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`the extended flying neck strike carries forward and down without restarting its fall (${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
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
  let contactRoot, contactWaist, caughtHeight, caughtFlight, caughtNeck, contactAt, previousRig, strikingArm;
  let continuedDescent = false, fartherPass = false, impact = false, fixedTargetDuringFall = false;
  for (let elapsed = 0; elapsed <= 9000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const contact = sim.contacts.get(planned.id), round = contact?.round, window = round?.wrestlingMove;
    if (!contact?.started) continue;
    assert.equal(window?.kind, 'clothesline', 'the actual flying arm strike cannot quietly fall back to an ordinary throw');
    const frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, round.contactSide);
    const driver = capturedActors().get(round.aggressor), victim = capturedActors().get(round.victim);
    const rig = driver.animation.contactPoints, victimRig = victim.animation.contactPoints;
    if (driver.clotheslineStrength > .001) {
      assert.equal(driver.clotheslineArm, mirrored ? 0 : 1, 'leftward and rightward flying strikes use their respective left and right arms');
      strikingArm ??= driver.clotheslineArm;
      assert.equal(driver.clotheslineArm, strikingArm, 'the incoming arm keeps its identity through contact and the descending follow-through');
    }
    if (window.contactAt === elapsed) {
      contactAt = elapsed; contactRoot = { x: driver.x, y: driver.depthY }; contactWaist = { ...rig.waist };
      caughtHeight = frame.driverHeight; caughtFlight = frame.dropkickProgress;
      caughtNeck = { ...contact.wrestlingMoveOrigins.target };
      assert.equal(driver.clotheslineArm, strikingArm);
      const shoulder = rig.shoulders[strikingArm], elbow = rig.elbows[strikingArm], hand = rig.hands[strikingArm];
      const upperInside = { x: shoulder.x + (elbow.x - shoulder.x) * .5, y: shoulder.y + (elbow.y - shoulder.y) * .5 };
      const lowerInside = { x: elbow.x + (hand.x - elbow.x) * .45, y: elbow.y + (hand.y - elbow.y) * .45 };
      const upperAngle = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x), forearmAngle = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
      const bend = Math.abs(Math.atan2(Math.sin(forearmAngle - upperAngle), Math.cos(forearmAngle - upperAngle)));
      assert.ok(bend <= .3, 'the real contact is an extended arm instead of a folded neck hook');
      assert.ok(Math.min(segmentGap(caughtNeck, upperInside, elbow), segmentGap(caughtNeck, elbow, lowerInside)) < 8, 'the actual middle upper arm, elbow or beginning of the forearm meets the live neck');
      assert.ok(distance(contact.wrestlingMoveOrigins.target, hand) > 12, 'the selected hand continues beyond the neck instead of making a fist strike');
      assert.ok(frame.side * (rig.waist.x - caughtNeck.x) <= 1, 'the neck collision precedes the attacking trunk passing its contact point');
      assert.ok(distance(contactRoot, contact.wrestlingMoveOrigins.launchDriver) > 100, 'the airborne wrestler crosses a visible runway before the neck strike');
    }
    if (contactAt != null && elapsed <= frame.floorAt) {
      if (previousRig) for (const [index, point] of painted(rig).entries()) assert.ok(distance(point, painted(previousRig)[index]) < 8 + delta * .9, 'the painted collision cannot teleport an arm, trunk or foot');
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * driver.scale) < .001, 'each real upper arm remains attached at its ordinary length');
        assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * driver.scale) < .001, 'each real forearm retains its ordinary length during the fall');
      }
      if (elapsed - contactAt <= 160) {
        const temples = { x: (victimRig.headSides[0].x + victimRig.headSides[1].x) / 2, y: (victimRig.headSides[0].y + victimRig.headSides[1].y) / 2 };
        const shoulders = { x: (victimRig.shoulders[0].x + victimRig.shoulders[1].x) / 2, y: (victimRig.shoulders[0].y + victimRig.shoulders[1].y) / 2 };
        const neck = { x: temples.x + (shoulders.x - temples.x) * .65, y: temples.y + (shoulders.y - temples.y) * .65 };
        assert.ok(distance(driver.clotheslineTarget, caughtNeck) < 1e-9, 'the striking arm retains its original collision point instead of following the neck from behind');
        if (elapsed - contactAt >= 96) {
          assert.ok(distance(neck, caughtNeck) > 6, 'the opponent actually falls away from the fixed collision point');
          fixedTargetDuringFall = true;
        }
      }
      if (elapsed === contactAt + delta) {
        const incomingDescent = Math.max(0, -4 * 40 * (1 - 2 * caughtFlight) / .64);
        assert.ok(incomingDescent > 20, 'the real arm contact occurs on the descending jump');
        assert.ok(caughtHeight - frame.driverHeight >= incomingDescent * delta / 1000 * .75, 'the first fall frame retains the incoming downward speed instead of hanging at the neck');
        continuedDescent = true;
      }
      fartherPass ||= frame.side * (driver.x - contactRoot.x) >= 65 && frame.side * (rig.waist.x - contactWaist.x) >= 65;
    }
    if (contactAt != null && elapsed >= frame.floorAt) {
      assert.ok(frame.side * (driver.x - victim.x) >= 65, 'the actual attacker lands farther through the opponent rather than stopping at the neck');
      assert.equal(victim.pose, 'stunned'); assert.equal(victim.eyesClosed, true);
      assert.ok(driver.angle * victim.angle < -1, 'the two painted bodies land in opposite orientations');
      assert.ok(victimRig.head.y > rig.elbows[strikingArm].y - 30, 'the struck upper body reaches the sand under the selected striking arm');
      impact = true; break;
    }
    previousRig = structuredClone(rig);
  }
  assert.ok(continuedDescent && fartherPass && fixedTargetDuringFall && impact, 'the same extended neck strike carries its incoming momentum past the fixed collision point through the complete floor impact');
});
