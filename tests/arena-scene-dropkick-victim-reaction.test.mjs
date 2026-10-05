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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'dropkickReactionAuditScenery(ctx, clock,')
  .replace(draw, `dropkickReactionAuditActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.captureStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.captureEnd(); });`)
  .replace(initial, `dropkickReactionAuditInitialize(sim, reset); ${initial}`);
source += '\nlet dropkickReactionAuditActors; const dropkickReactionAuditScenery = () => {}; let dropkickReactionAuditInitialize = () => {}; export const setInitialize = fn => { dropkickReactionAuditInitialize = fn; }; export const capturedActors = () => dropkickReactionAuditActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capturedActors, setInitialize } = module.exports;
const noop = () => {};
function context() {
  const target = { measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), captureStart: noop, captureEnd: noop };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const direction = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const turn = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const opening = (shoulder, elbow, palm) => Math.PI - Math.abs(turn(direction(shoulder, elbow), direction(elbow, palm)));
const points = rig => [rig.head, rig.waist, ...rig.headSides, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`dropkick: the hit body releases at its genuine chest contact and its normal limbs react during the first 100 ms (${mirrored ? 'mirrored' : 'ordinary'}, ${delta} ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = 15, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, 'dropkick');
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  // The starting ground layout is the only input adjustment. The real
  // chest-contact gate, snapshot, knockback arc and landing remain intact.
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: 320, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: 520, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let previous, releaseAt, initialUpper, initialKnees, earlyFrames = 0, flightFrames = 0, landingFrames = 0, contactSeen = false;
  for (let elapsed = 0; elapsed < 16000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actors = capturedActors(), victim = actors.get(planned.victim), attacker = actors.get(planned.aggressor), exit = sim.exits.get(planned.victim);
    const contact = sim.contacts.get(planned.id), actual = contact?.round;
    assert.equal(actual?.wrestlingMove?.kind, 'dropkick', 'the selected actual kick never falls back to an unrelated finish');
    const rig = victim.animation.contactPoints, local = victim.animation.rig, skeleton = victim.animation.skeleton;
    if (exit) {
      const first = releaseAt === undefined;
      releaseAt ??= elapsed;
      const age = elapsed - releaseAt, detail = `${mirrored}/${delta}ms/${age}ms`;
      if (first) {
        assert.equal(actual.wrestlingMove.contactAt, elapsed, 'actual sole-to-chest contact opens the immediate knockback');
        const frame = arenaWrestlingMoveTargets(actual.wrestlingMove, elapsed, contact.center, contact.wrestlingMoveOrigins, actual.contactSide);
        attacker.animation.contactPoints.feet.forEach((foot, leg) => assert.ok(distance(foot, frame.footTargets[leg]) < 7, 'both real soles hit their separate actual chest targets'));
        assert.ok(previous && points(rig).every((point, slot) => distance(point, points(previous)[slot]) < 2), 'the impact preserves the incoming head, chest, elbows, palms and both feet');
        const source = exit.spinSnapshot;
        initialUpper = source.elbows.map((elbow, arm) => direction(source.shoulders[arm], elbow));
        initialKnees = source.knees.map((knee, leg) => opening(source.hips[leg], knee, source.feet[leg]));
        contactSeen = true;
      }
      if (victim.pose === 'airborne') {
        assert.equal(victim.dropkickReaction, true, 'only this chest knockback uses the early articulated release');
        flightFrames++;
      } else if (victim.pose === 'land') {
        assert.equal(victim.dropkickReaction, false, 'landing uses its ordinary connected body without restarting the reaction');
        landingFrames++;
      }
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - victim.scale * 11) < .001 && Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - victim.scale * 10.5) < .001, `both reacting arm sections keep their complete normal length: ${detail}`);
        assert.ok(opening(rig.shoulders[arm], rig.elbows[arm], rig.hands[arm]) > Math.PI / 12, `the reacting elbow never folds the forearm through the upper arm: ${detail}`);
      }
      for (let leg = 0; leg < 2; leg++) assert.ok(distance(skeleton.hips[leg], skeleton.knees[leg]) <= 11.001 && distance(skeleton.knees[leg], skeleton.feet[leg]) <= 11.001, `the knees react with normal connected leg sections: ${detail}`);
      if (age >= 80 && age <= 140) {
        for (let arm = 0; arm < 2; arm++) assert.ok(Math.abs(turn(initialUpper[arm], direction(local.shoulders[arm], local.elbows[arm]))) > Math.PI / 120, `both shoulders visibly release the impact brace during the first 100 ms instead of remaining frozen: arm ${arm}, ${detail}`);
        assert.ok(skeleton.knees.some((knee, leg) => Math.abs(opening(skeleton.hips[leg], knee, skeleton.feet[leg]) - initialKnees[leg]) > Math.PI / 180), `a struck body loosens its knees as the hips recoil: ${detail}`);
        earlyFrames++;
      }
      if (previous) points(rig).forEach((point, slot) => assert.ok(distance(point, points(previous)[slot]) < 8 + delta * .9, `flight and the first landing keep each material joint on its continuous path: part ${slot}, ${detail}`));
      if (age >= 1050) break;
    }
    previous = structuredClone(rig);
  }
  assert.ok(contactSeen && earlyFrames >= (delta === 16 ? 3 : 1) && flightFrames >= (delta === 16 ? 50 : 17) && landingFrames >= (delta === 16 ? 9 : 3), 'the complete actual impact, early limb recoil, free flight and landing are exercised');
});
