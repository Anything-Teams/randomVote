import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Natural five-player history is important: the victim's resting neck moves
// after its previous fight. Exercise the production Scene and painted joints.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const init = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(ranks) && source.includes(init));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'neckTestScenery(ctx, clock,')
  .replace(draw, `neckTestActors = actors; ${draw}`)
  .replace(ranks, `${ranks} neckTestRanks = ranks;`)
  .replace(init, `neckTestInitialize(sim, reset); ${init}`);
source += '\nlet neckTestActors, neckTestRanks; const neckTestScenery = () => {}; let neckTestInitialize = () => {}; export const setInitialize = fn => { neckTestInitialize = fn; }; export const capturedActors = () => neckTestActors; export const capturedRanks = () => neckTestRanks; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capturedActors, capturedRanks, setInitialize } = module.exports;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segmentGap = (point, from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const p = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, { x: from.x + dx * p, y: from.y + dy * p });
};
const noop = () => {};
const ctx = new Proxy({ globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const order = ['5', '4', '3', '2', '1'];
const props = { candidates: ['1', '2', '3', '4', '5'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration: 44000, arenaRushRoll: 7, arenaEscapeSeed: 31, paused: false, preview: false };
const planned = arenaRounds(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed).find(round => round.wrestlingMove?.kind === 'clothesline');
assert.ok(planned);

for (const mirrored of [false, true]) for (const step of [16, 50]) test(`a natural clothesline reaches the live neck and completes its knockout and full ankle swing (${mirrored ? 'mirrored' : 'ordinary'}, ${step}ms)`, () => {
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
  // Mirror only the real initial layout; keep every earlier fight and contact.
  setInitialize((current, reset) => {
    if (current !== sim || !reset || !mirrored) return;
    for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; }
  });
  let ran = false, contactSeen = false, knockoutSeen = false, released = false, finished = false, stoppedAt;
  let contactRoot, leadingFallMs = 0, checkedEarlyMomentum = false;
  let airborneApproachMs = 0, oppositeFallMs = 0;
  let ankleFrames = 0, spinFrames = 0, previousTurn, strikingArm, previousDriverRig;
  for (let elapsed = 0; elapsed <= 70000; elapsed += step) {
    render(ctx, props, elapsed, elapsed, sim, step, false);
    const actual = sim.contacts.get(planned.id), round = actual?.round, window = round?.wrestlingMove;
    if (!actual?.started) continue;
    assert.equal(window?.kind, 'clothesline', 'the selected running strike must reach the actual victim rather than silently fall back after a stalled approach');
    const frame = arenaWrestlingMoveTargets(window, elapsed, actual.center, actual.wrestlingMoveOrigins, round.contactSide);
    const driver = capturedActors().get(round.aggressor), victim = capturedActors().get(round.victim);
    assert.ok(driver && victim);
    const driverRig = driver.animation.contactPoints;
    if (driver.clotheslineStrength > .001) {
      const expectedArm = frame.side < 0 ? 0 : 1;
      assert.equal(driver.clotheslineArm, expectedArm, 'the leftward run strikes with the left arm and the rightward run with the right arm');
      strikingArm ??= driver.clotheslineArm;
      assert.equal(driver.clotheslineArm, strikingArm, 'the same material arm extends, hits and follows through without exchanging shoulders');
      if (window.contactAt == null && Math.abs(driver.velocityX) > 80) assert.equal(Math.sign(driver.velocityX), frame.side, 'arm selection follows the actual direction of the incoming run');
    }
    if (previousDriverRig && (window.contactAt == null && driver.clotheslineStrength > .001 || window.contactAt != null && elapsed <= frame.floorAt)) {
      for (const joint of ['shoulders', 'elbows', 'hands']) assert.ok(distance(driverRig[joint][strikingArm], previousDriverRig[joint][strikingArm]) < 8 + step * .9, `the selected striking ${joint} cannot jump to the other arm at neck contact or during the fall`);
    }
    ran ||= driver.pose === 'run' && Math.hypot(driver.velocityX, driver.velocityY) > 80;
    // The arm strike is a flying wrestling tackle, not a grounded runner
    // falling only after contact. Measure the drawn elevation before the
    // contact event; a pose name alone does not prove a visible jump.
    if (window.contactAt == null && driver.depthY - driver.y >= 8 && driver.suspension > .5) airborneApproachMs += step;
    if (window.contactAt == null && ran && elapsed >= window.plannedContactAt && Math.hypot(frame.driverVelocity.x, frame.driverVelocity.y) < 1) {
      stoppedAt ??= elapsed;
      assert.ok(elapsed - stoppedAt < 400, `the runner cannot wait motionless in front of an unreachable stale neck (${elapsed}ms, seed 31)`);
    }
    if (window.contactAt === elapsed) {
      contactSeen = true;
      contactRoot = { x: driver.x, y: driver.y };
      assert.ok(ran, 'the strike follows a visible actual run');
      const victimRig = victim.animation.contactPoints;
      const temples = { x: (victimRig.headSides[0].x + victimRig.headSides[1].x) / 2, y: (victimRig.headSides[0].y + victimRig.headSides[1].y) / 2 };
      const shoulders = { x: (victimRig.shoulders[0].x + victimRig.shoulders[1].x) / 2, y: (victimRig.shoulders[0].y + victimRig.shoulders[1].y) / 2 };
      const liveNeck = { x: temples.x + (shoulders.x - temples.x) * .65, y: temples.y + (shoulders.y - temples.y) * .65 };
      const trunkLength = distance(driverRig.head, driverRig.waist);
      assert.ok(airborneApproachMs >= 80, 'the real approach shows at least 80ms of visible flight before the extended arm meets the neck');
      assert.ok(driver.depthY - driver.y >= 8 && driver.suspension > .5, 'the arm collision happens while the actual driver is airborne');
      assert.ok(Math.abs(driverRig.head.y - driverRig.waist.y) / trunkLength >= .9, 'the painted driver stays upright while its arm sweeps across the neckline');
      assert.equal(driver.clotheslineArm, strikingArm);
      const shoulder = driverRig.shoulders[strikingArm], elbow = driverRig.elbows[strikingArm], hand = driverRig.hands[strikingArm];
      const upper = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y }, lower = { x: hand.x - elbow.x, y: hand.y - elbow.y };
      const bend = Math.abs(Math.atan2(upper.x * lower.y - upper.y * lower.x, upper.x * lower.x + upper.y * lower.y));
      const upperInside = { x: shoulder.x + upper.x * .5, y: shoulder.y + upper.y * .5 };
      const lowerInside = { x: elbow.x + lower.x * .45, y: elbow.y + lower.y * .45 };
      const neckGap = Math.min(segmentGap(liveNeck, upperInside, elbow), segmentGap(liveNeck, elbow, lowerInside));
      assert.ok(bend <= .3, 'the arm is extended before the collision, without hooking backward around the neck');
      assert.ok(neckGap < 8, `the painted middle arm reaches the victim's current neck (${neckGap.toFixed(2)}px at ${elapsed}ms)`);
      assert.ok(distance(liveNeck, hand) > 12, 'the selected fist extends beyond the neck instead of punching it');
      assert.ok(frame.side * (driverRig.waist.x - liveNeck.x) <= 3, 'the arm meets the neck before the trunk has passed it');
      assert.ok(driverRig.feet.every(foot => distance(liveNeck, foot) > 14), 'the elbow, rather than dropkick feet, causes the actual neck contact');
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(driverRig.shoulders[arm], driverRig.elbows[arm]) - 11 * driver.scale) < .001, 'the flying strike keeps each painted upper arm attached at its ordinary length');
        assert.ok(Math.abs(distance(driverRig.elbows[arm], driverRig.hands[arm]) - 10.5 * driver.scale) < .001, 'the flying strike keeps each painted forearm at its ordinary length');
      }
    }
    if (window.contactAt != null && elapsed < frame.floorAt) {
      const age = elapsed - window.contactAt, driverRig = driver.animation.contactPoints, victimRig = victim.animation.contactPoints;
      // The extended-arm strike is a running collision: after the arm meets,
      // the caster's trunk passes the opponent instead of settling behind it.
      // Check the live roots and painted hips, not only a planned end point.
      if (frame.side * (driver.x - victim.x) > 12 && frame.side * (driverRig.waist.x - victimRig.waist.x) > 12) leadingFallMs += step;
      const driverHeadward = driverRig.head.x - driverRig.waist.x, victimHeadward = victimRig.head.x - victimRig.waist.x;
      if (age >= 240 && driver.angle * victim.angle < -.5 && driverHeadward * victimHeadward < -100) oppositeFallMs += step;
      if (!checkedEarlyMomentum && age >= 96 && age <= 150) {
        assert.ok(contactRoot, 'the real neck contact anchors the pass-through measurement');
        const advance = frame.side * (driver.x - contactRoot.x);
        assert.ok(advance >= age / 1000 * 100, `the actual caster carries at least 100px/s of its run through the first contact interval instead of stopping (${advance.toFixed(2)}px in ${age}ms)`);
        checkedEarlyMomentum = true;
      }
    }
    if (window.contactAt != null && elapsed >= frame.floorAt && !sim.exits.has(round.victim)) knockoutSeen ||= victim.pose === 'stunned' && frame.victimSlam?.slump === 1;
    if (window.ankleGripAt != null && !sim.exits.has(round.victim)) {
      ankleFrames++;
      assert.ok(knockoutSeen, 'the opponent becomes unconscious on the floor before the real ankle pickup');
      assert.equal(driver.gripMode, 'ankle');
      assert.equal(victim.spinSuspension?.planar, true, 'the selected finish swings the body through the horizontal plane');
      const driverRig = driver.animation.contactPoints, victimRig = victim.animation.contactPoints;
      for (let limb = 0; limb < 2; limb++) {
        assert.ok(distance(driverRig.hands[limb], victimRig.feet[driver.ankleGripReversed ? 1 - limb : limb]) < 1, `${elapsed}: each actual palm supports its own material toe through the complete turn`);
        assert.ok(Math.abs(distance(driverRig.shoulders[limb], driverRig.elbows[limb]) - 11 * driver.scale) < .001);
        assert.ok(Math.abs(distance(driverRig.elbows[limb], driverRig.hands[limb]) - 10.5 * driver.scale) < .001);
        const skeleton = victim.animation.skeleton;
        assert.ok(Math.abs(distance(skeleton.hips[limb], skeleton.knees[limb]) - 11) < .02);
        assert.ok(Math.abs(distance(skeleton.knees[limb], skeleton.feet[limb]) - 11) < .02);
      }
      assert.equal(driver.pivotTurn, frame.pivotTurn, 'the painted caster follows the actual full-turn clock');
      if (previousTurn !== undefined) assert.ok(Math.abs(driver.pivotTurn) >= previousTurn, 'the held rotation does not reverse or reset');
      previousTurn = Math.abs(driver.pivotTurn);
      if (frame.stage === 'spin') spinFrames++;
    }
    if (sim.exits.has(round.victim) && !released) {
      assert.ok(ankleFrames >= (step === 16 ? 8 : 4) && spinFrames >= (step === 16 ? 55 : 17), 'the live foot pickup and complete revolution precede the hand opening');
      assert.ok(Math.abs(driver.pivotTurn) >= Math.PI * 2 - 1e-8, 'the real caster completes one whole circle before releasing');
      assert.equal(frame.requiredReleaseAt, window.ankleGripAt + 1920);
      assert.ok(elapsed - frame.requiredReleaseAt >= 0 && elapsed - frame.requiredReleaseAt < step, 'the palms open on the first completed-turn frame');
      const flight = sim.exits.get(round.victim).spinFlight;
      assert.ok(flight && Math.abs(flight.velocity.x) > 50 && Math.abs(flight.velocity.x) > Math.abs(flight.velocity.y) * 3, 'the actual release continues the lateral swing momentum');
      released = true;
    }
    else if (!released) assert.equal(capturedRanks()[round.victim], undefined, 'the drawn rank cannot eliminate the victim before the actual held throw');
    if (Object.keys(capturedRanks()).length === order.length) { finished = true; break; }
    previousDriverRig = structuredClone(driverRig);
  }
  assert.ok(checkedEarlyMomentum && leadingFallMs >= 80, 'the actual caster keeps running momentum and visibly carries its trunk past the opponent before both hit the floor');
  assert.ok(oppositeFallMs >= 80, 'after the flying arm collision the painted bodies fall in opposite head-to-foot directions for a visible interval');
  assert.ok(contactSeen && knockoutSeen && released && finished, 'the same running strike must proceed through knockout, actual two-toe support, one full revolution, release and all drawn ranks');
  assert.deepEqual(capturedRanks(), { '1': 5, '2': 4, '3': 3, '4': 2, '5': 1 });
});
