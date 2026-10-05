import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Run production contact and root support, then inspect every painted frame
// through the complete received lift, apex, descent and recovery.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'slamScenery(ctx, clock,')
  .replace(draw, `slamActors = actors; ${draw}`)
  .replace(initialize, `slamInitialize(sim, reset); ${initialize}`);
source += '\nlet slamActors; const slamScenery = () => {}; let slamInitialize = () => {}; export const setInitialize = fn => { slamInitialize = fn; }; export const actors = () => slamActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, actors, setInitialize } = module.exports;
const noop = () => {};
const context = () => new Proxy({ globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angularGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const bend = (rig, arm) => Math.PI - angularGap(angle(rig.shoulders[arm], rig.elbows[arm]), angle(rig.elbows[arm], rig.hands[arm]));
const bodyPoints = rig => [rig.head, ...rig.headSides, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];

for (const [kind, seed] of [['scoopslam', 40], ['powerbomb', 4]]) for (const mirrored of [false, true]) for (const step of [16, 50]) for (const controlled of [false, true]) {
  test(`${kind}: connected arms and body throughout the received slam (${mirrored ? 'left' : 'right'}, ${step} ms, ${controlled ? 'runway' : 'natural'})`, () => {
    const order = ['2', '1'], duration = 44000;
    const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
    const planned = arenaRounds(order, duration, 7, seed)[0];
    assert.equal(planned.wrestlingMove.kind, kind);
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset) return;
      if (controlled) {
        Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 });
        Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 });
      }
      if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; }
      for (const body of sim.bodies.values()) { body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
    });
    let previous, heldFrames = 0, releaseFrames = 0, floorSeen = false, peakSeen = false, runSeen = false;
    const stages = new Set();
    for (let elapsed = 0; elapsed < 12000; elapsed += step) {
      render(ctx, props, elapsed, elapsed, sim, step, false);
      const contact = sim.contacts.get(planned.id), actual = contact?.round;
      if (!actual?.wrestlingMove) continue;
      const window = actual.wrestlingMove, driver = actors().get(planned.aggressor), victim = actors().get(planned.victim);
      const frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, actual.contactSide);
      if (window.contactAt == null) { runSeen ||= victim.pose === 'run' && Math.hypot(victim.velocityX, victim.velocityY) > 80; continue; }
      if (elapsed > frame.floorAt + 250) break;
      const driverRig = driver.animation.contactPoints, victimRig = victim.animation.contactPoints;
      const detail = `${kind}/${mirrored}/${step}/${controlled}/${elapsed}/${frame.stage}`;
      stages.add(frame.stage);
      floorSeen ||= elapsed >= frame.floorAt;
      peakSeen ||= (kind === 'powerbomb' ? frame.powerbombLift : frame.scoopLift) > .99;
      assert.ok([...bodyPoints(driverRig), ...bodyPoints(victimRig)].every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `complete finite bodies: ${detail}`);
      if (driver.gripStrength > .995 && elapsed > window.contactAt) {
        heldFrames++;
        const targets = kind === 'powerbomb' ? victimRig.waistSides
          : [victimRig.back, { x: victimRig.waist.x + ((victimRig.feet[0].x + victimRig.feet[1].x) / 2 - victimRig.waist.x) * .28, y: victimRig.waist.y + ((victimRig.feet[0].y + victimRig.feet[1].y) / 2 - victimRig.waist.y) * .28 }];
        driverRig.hands.forEach((hand, arm) => assert.ok(distance(hand, targets[arm]) < 8, `both actual palms retain their weight-bearing contacts: ${detail}/${arm}`));
      }
      if (driver.gripStrength < .995 && driver.gripStrength > .005) releaseFrames++;
      for (const [role, actor, rig] of [['caster', driver, driverRig], ['received', victim, victimRig]]) for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) / actor.scale - 11) < .001 && Math.abs(distance(rig.elbows[arm], rig.hands[arm]) / actor.scale - 10.5) < .001, `normal connected upper and lower arm bones: ${detail}/${role}/${arm}`);
        assert.ok(bend(rig, arm) > (role === 'caster' ? .40 : .30), `the forearm cannot fold through its upper arm: ${detail}/${role}/${arm}`);
        if (previous && role === 'caster') {
          const prior = previous.driverRig;
          // Retain the existing Scene's physical displacement limit and add
          // the angular check below to catch a folded arm that stays nearby.
          assert.ok(distance(rig.elbows[arm], prior.elbows[arm]) < 8 + step * .9, `the supporting elbow moves continuously during lift and release (${distance(rig.elbows[arm], prior.elbows[arm])}px): ${detail}/${arm}`);
          for (const bone of [['shoulders', 'elbows'], ['elbows', 'hands']]) assert.ok(angularGap(angle(rig[bone[0]][arm], rig[bone[1]][arm]), angle(prior[bone[0]][arm], prior[bone[1]][arm])) < .08 + step * .025, `a supporting bone cannot reverse its angle in one frame: ${detail}/${arm}/${bone[1]}`);
        }
      }
      const skeleton = victim.animation.skeleton;
      for (let leg = 0; leg < 2; leg++) assert.ok(distance(skeleton.hips[leg], skeleton.knees[leg]) <= 11.02 && distance(skeleton.knees[leg], skeleton.feet[leg]) <= 11.02, `received thighs and shins retain their full normal proportions: ${detail}/${leg}`);
      if (previous) for (const [point, prior] of bodyPoints(victimRig).map((point, index) => [point, bodyPoints(previous.victimRig)[index]])) assert.ok(distance(point, prior) < 8 + step * .9, `the received torso, arms and feet descend as one continuous body: ${detail}`);
      assert.equal(victim.eyesClosed, elapsed >= frame.floorAt, `unconsciousness begins at the sand impact: ${detail}`);
      previous = { driverRig: structuredClone(driverRig), victimRig: structuredClone(victimRig) };
    }
    assert.ok(runSeen && heldFrames > 10 && releaseFrames > 2 && peakSeen && floorSeen && stages.has('lift') && stages.has('fall') && stages.has('recover'), 'the test exercises the complete incoming run, supported lift, release, fall and recovery');
  });
}
