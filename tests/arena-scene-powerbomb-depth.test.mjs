import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the production floor, live toe contacts and pickup gate. Only the
// starting layout is mirrored; the test never supplies a grip or a clock.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'powerDepthScenery(ctx, clock,')
  .replace(draw, `powerDepthActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.captureStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); });`)
  .replace(initialize, `powerDepthInitialize(sim, reset); ${initialize}`);
source = source.replace('if (actor.scoopSupportActor) drawArenaCradleSupport(ctx, actor.scoopSupportActor);', 'if (actor.scoopSupportActor) { ctx.supportStart(actor.scoopSupportActor); drawArenaCradleSupport(ctx, actor.scoopSupportActor); ctx.supportEnd(actor.scoopSupportActor); }');
source += '\nlet powerDepthActors; const powerDepthScenery = () => {}; let powerDepthInitialize = () => {}; export const setInitialize = fn => { powerDepthInitialize = fn; }; export const capture = () => powerDepthActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, arenaTechniqueTargets, createArenaFighterAnimation, paintArenaFighter as paintReference };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, arenaTechniqueTargets, createArenaFighterAnimation, paintReference, capture, setInitialize } = module.exports;
const noop = () => {};
function context() {
  let support; const target = {
    paints: [], supports: [], measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    captureStart(actor) { this.paints.push(actor.candidate.id); },
    supportStart(actor) { support = { id: actor.candidate.id, after: this.paints.at(-1), rects: 0, before: structuredClone(actor.animation) }; },
    fillRect() { if (support) support.rects++; },
    supportEnd(actor) { assert.deepEqual(actor.animation, support.before, 'painting the foreground forearm cannot reevaluate or advance the live motion'); this.supports.push(support); support = undefined; },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const paintedPoints = rig => [rig.head, ...rig.headSides, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];

const referenceContext = new Proxy({ measureText: value => ({ width: String(value).length * 8 }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const legacyRound = { id: 'existing-overhead-slam', index: 0, aggressor: '2', victim: '1', tactic: 'suplex', start: 0, impact: 1000, resolve: 2000, end: 3000, final: true };

for (const controlled of [false, true]) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`powerbomb: the real incoming receiver uses the existing suplex skeleton and continuous live waist support (${controlled ? 'controlled' : 'natural'}, ${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = 4, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, 'powerbomb');
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    if (controlled) { Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 }); Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 }); }
    if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.animation = undefined; }
  });
  let received = false, floorSeen = false, ankleSeen = false, fullTurnSeen = false, releaseSeen = false, overheadFrames = 0, referenceFrames = 0, supportedFrames = 0, previous, previousFacing;
  const stages = new Set();
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    ctx.paints = []; ctx.supports = [];
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const caster = capture().get(planned.aggressor), victim = capture().get(planned.victim), contact = sim.contacts.get(planned.id), window = contact?.round.wrestlingMove;
    assert.equal(window?.kind, 'powerbomb', 'the incoming counter keeps its selected slam and complete ankle finish');
    if (!contact.wrestlingMoveOrigins) continue;
    const frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, contact.round.contactSide), detail = `${controlled}/${mirrored}/${delta}/${elapsed}`;
    assert.equal(ctx.supports.length, 0, 'the shared overhead motion does not splice a separate wrapping forearm over the body');
    if (window.contactAt == null) continue;
    received = true;
    const rig = caster.animation.contactPoints, body = victim.animation.contactPoints;
    if (!victim.spinSuspension && !sim.exits.has(planned.victim)) {
      for (const actor of [caster, victim]) {
        assert.equal(ctx.paints.filter(id => id === actor.candidate.id).length, 1, 'each torso is painted once throughout the received lift and landing');
        assert.equal(actor.paintDepth, undefined, 'the real overhead motion uses ordinary whole-body depth ordering');
        assert.equal(actor.paintLayer, undefined, 'there is no forced split-body layer left from the seated lift');
        assert.equal(actor.depthY, sim.bodies.get(actor.candidate.id).y, 'the painted ground plane stays attached to the actual simulation body');
      }
      if (previous) {
        const relabeled = caster.facing !== previousFacing && caster.gripMode === 'ankle' && caster.pivotTurn === undefined;
        const priorCaster = relabeled ? { ...previous[0], feet: [...previous[0].feet].reverse() } : previous[0];
        for (const [current, prior] of [[rig, priorCaster], [body, previous[1]]]) paintedPoints(current).forEach((point, index) => {
          assert.ok(distance(point, paintedPoints(prior)[index]) <= 8 + delta * .9, `the complete head, shoulder, elbow, hand and feet stay continuous through lift, support release, landing and foot pickup: ${detail}/${index}/${distance(point, paintedPoints(prior)[index]).toFixed(3)}`);
        });
      }
      previous = [structuredClone(rig), structuredClone(body)]; previousFacing = caster.facing;
      if (elapsed < frame.floorAt) {
        stages.add(frame.stage);
        const legacy = arenaTechniqueTargets({ ...legacyRound, contactSide: frame.side }, frame.victimPhase * legacyRound.impact, { x: 500, y: 416 });
        assert.ok(Math.abs(frame.victimHeight - legacy.lift) < 1e-8, 'the receiver lifts through the original 100px overhead path');
        assert.ok(Math.abs(frame.victimAngle - legacy.victimAngle) < 1e-8, 'the front landing turns through the same original .53π shoulder rotation');
        assert.equal(frame.victimSlam === undefined, legacy.victimSlam === undefined);
        if (frame.victimSlam) for (const key of ['tuck', 'slump']) assert.ok(Math.abs(frame.victimSlam[key] - legacy.victimSlam[key]) < 1e-8, 'the original tuck, impact and limp recovery phases remain the motion source');
        if (caster.pose === 'overhead' && frame.victimPhase >= .34) {
          assert.equal(legacy.aggressorPose, 'overhead'); assert.equal(victim.pose, 'airborne');
          assert.ok(Math.abs(caster.overheadRaise - legacy.aggressorOverheadRaise) < 1e-8);
          assert.equal(victim.slamEntry, false, 'the original deterministic falling rig cannot inherit running arms and feet');
          const actual = victim.animation.skeleton;
          for (let leg = 0; leg < 2; leg++) for (const length of [distance(actual.hips[leg], actual.knees[leg]), distance(actual.knees[leg], actual.feet[leg])]) assert.ok(length >= 11 * .5 && length <= 11.001, `the takeoff retains complete connected projected thigh and shin sections while the actual running heel unfolds: ${detail}/${leg}/${length.toFixed(6)}/phase${frame.victimPhase}`);
          if (frame.victimSlam.tuck === 1) {
            const reference = { ...victim, pose: legacy.victimPose, phase: legacy.phase, angle: legacy.victimAngle, suspension: legacy.victimSuspension, slamProgress: legacy.victimSlam, carryStretch: undefined, carrySupport: undefined, carryEntry: undefined, powerbombVictim: undefined, slamEntry: undefined, animation: createArenaFighterAnimation(), motionImmediate: true };
            paintReference(referenceContext, reference, elapsed);
            const expected = reference.animation.skeleton;
            for (const key of ['hips', 'knees', 'feet', 'pelvis']) actual[key].forEach((point, index) => assert.ok(distance(point, expected[key][index]) < .001, `the actual raised body keeps the existing suplex ${key}, without seated thighs or a different carried skeleton: ${detail}/${key}/${index}`));
            actual.shorts.forEach((panel, leg) => panel.forEach((point, index) => assert.ok(distance(point, expected.shorts[leg][index]) < .001, 'both shorts panels follow the same original hanging and falling thighs')));
            referenceFrames++;
          }
          overheadFrames++;
        }
      } else {
        floorSeen ||= victim.pose === 'stunned' && victim.eyesClosed === true && frame.victimHeight === 0;
        if (frame.victimSlam?.slump === 1) {
          assert.ok(Math.abs(body.head.y - body.waist.y) < 20, 'the unconscious head and trunk lie beside the sand');
          assert.ok(frame.side * (body.head.x - midpoint(body.feet).x) > 90, 'the final shoulder landing leaves the ankles on the correct opposite side for pickup');
        }
      }
      if (frame.gripMode === 'waist' && frame.gripStrength > .995) {
        const targets = [{ x: body.waist.x - frame.side * 6, y: body.waist.y + 3 }, body.waist];
        rig.hands.forEach((hand, arm) => assert.ok(distance(hand, targets[arm]) < 7, `the same actual palms remain attached to the existing suplex waist support while raising the body: ${detail}/${arm}/${distance(hand, targets[arm])}`));
        supportedFrames++;
      }
    }
    if (victim.spinSuspension) {
      assert.ok(floorSeen, 'the actual ground knockout precedes the live foot-end pickup');
      ankleSeen = true;
      rig.hands.forEach((hand, arm) => assert.ok(distance(hand, body.feet[caster.ankleGripReversed ? 1 - arm : arm]) < 1, 'both live hands retain their own actual ankle through the rotation'));
      fullTurnSeen ||= Math.abs(caster.pivotTurn) >= Math.PI * 2 - 1e-8;
    }
    fullTurnSeen ||= Math.abs(caster.pivotTurn ?? 0) >= Math.PI * 2 - 1e-8;
    if (sim.exits.has(planned.victim)) { releaseSeen = true; break; }
  }
  assert.ok(received && floorSeen && ankleSeen && fullTurnSeen && releaseSeen, 'the original overhead slam continues through knockout, toe pickup, one complete revolution and actual release');
  assert.ok(overheadFrames >= (delta === 16 ? 70 : 20) && referenceFrames >= (delta === 16 ? 30 : 10) && supportedFrames >= (delta === 16 ? 50 : 15), 'all continuous lift/hold/descent frames exercise the real original skeleton and physical support');
  assert.ok(stages.has('contact') && stages.has('lift') && stages.has('turn') && stages.has('fall'));
});
