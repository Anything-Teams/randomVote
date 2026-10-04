import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initial = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initial));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'scoopRunScenery(ctx, clock,')
  .replace(draw, `scoopRunActors = actors; ${draw}`)
  .replace(initial, `scoopRunInitialize(sim, reset); ${initial}`);
source += '\nlet scoopRunActors; const scoopRunScenery = () => {}; let scoopRunInitialize = () => {}; export const setInitialize = fn => { scoopRunInitialize = fn; }; export const capturedActors = () => scoopRunActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);


for (const direction of ['right', 'left', 'up', 'down']) test(`scoop entry ${direction}: actual run cycles plant the material heels and normal knees before accepting weight`, () => {
  for (const delta of [16, 50]) {
    const order = ['2', '1'], duration = 44000, seed = 40;
    const planned = arenaRounds(order, duration, 7, seed)[0];
    assert.equal(planned.wrestlingMove?.kind, 'scoopslam');
    const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset) return;
      const roots = direction === 'right' ? [{ x: 320, y: 416 }, { x: 560, y: 416 }]
        : direction === 'left' ? [{ x: 680, y: 416 }, { x: 440, y: 416 }]
        : direction === 'up' ? [{ x: 500, y: 486 }, { x: 500, y: 345 }]
        : [{ x: 500, y: 340 }, { x: 500, y: 482 }];
      Object.assign(sim.bodies.get(planned.aggressor), roots[1]); Object.assign(sim.bodies.get(planned.victim), roots[0]);
      for (const body of sim.bodies.values()) { body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
    });
    let runFrames = 0, supportFrames = 0, receiverSupportFrames = 0, ankleFlexSeen = false, received = false, previous;
    for (let elapsed = 0; elapsed < 6000; elapsed += delta) {
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      const actor = capturedActors().get(planned.victim), contact = sim.contacts.get(planned.id), window = contact?.round?.wrestlingMove;
      assert.equal(window?.kind, 'scoopslam', 'the chosen scoop run cannot be replaced by an unrelated technique');
      assert.ok(actor?.animation?.contactPoints);
      const rig = actor.animation.contactPoints, feet = actor.animation.feet, skeleton = actor.animation.skeleton;
      if (actor.pose === 'run' && Math.hypot(actor.velocityX, actor.velocityY) > 80) {
        runFrames++;
        assert.ok(actor.animation.supportHip.y + 20 < 3.5, 'the actual incoming runner stays above the seated pelvis compression while its material heel bears the weight');
        for (let leg = 0; leg < 2; leg++) {
          const thigh = distance(skeleton.hips[leg], skeleton.knees[leg]), shin = distance(skeleton.knees[leg], skeleton.feet[leg]);
          assert.ok(thigh <= 11.001 && shin <= 11.001 && thigh > 2.5 && shin > 2.5, `the actual running leg has connected normal-length bones in every direction: ${JSON.stringify({ direction, delta, elapsed, leg, thigh, shin, velocity: [actor.velocityX, actor.velocityY], foot: feet[leg], hip: skeleton.hips[leg], knee: skeleton.knees[leg], ankle: skeleton.feet[leg] })}`);
          const foot = feet[leg], angle = skeleton.footAngles[leg];
          ankleFlexSeen ||= Math.abs(angle) > .08;
          if (!foot.swinging && foot.lift < .001) {
            assert.equal(angle, 0, 'the real supporting foot stays flat while the opposite ankle recovers');
            assert.ok(distance(rig.feet[leg], { x: foot.ground.x, y: foot.ground.y - actor.scale * 2 }) < .001);
            if (previous?.running && !previous.feet[leg].swinging && previous.feet[leg].lift < .001) assert.ok(distance(rig.feet[leg], previous.points[leg]) < .001, 'moving the body cannot slide the same material heel over the sand');
            supportFrames++;
          }
        }
      }
      const receiver = capturedActors().get(planned.aggressor), receiverFeet = receiver.animation.feet;
      if (window.contactAt == null && receiver.pose === 'guard' && receiverFeet.some(foot => !foot.swinging && foot.lift < .05)) receiverSupportFrames++;
      previous = { running: actor.pose === 'run', feet: structuredClone(feet), points: structuredClone(rig.feet) };
      if (window.contactAt != null && elapsed >= window.contactAt + 300) {
        const held = receiver.animation.contactPoints, targets = [rig.back, { x: rig.waist.x + ((rig.feet[0].x + rig.feet[1].x) / 2 - rig.waist.x) * .28, y: rig.waist.y + ((rig.feet[0].y + rig.feet[1].y) / 2 - rig.waist.y) * .28 }];
        held.hands.forEach((palm, arm) => assert.ok(distance(palm, targets[arm]) < 8, `the receiving hands accept the actual running body before the lift: ${direction}/${delta}/${arm}`));
        assert.ok(!sim.exits.has(planned.aggressor)); received = true; break;
      }
    }
    assert.ok(runFrames >= (delta === 16 ? 6 : 2) && supportFrames > 2 && receiverSupportFrames > 2 && ankleFlexSeen && received, JSON.stringify({ direction, delta, runFrames, supportFrames, receiverSupportFrames, ankleFlexSeen, received }));
  }
});
