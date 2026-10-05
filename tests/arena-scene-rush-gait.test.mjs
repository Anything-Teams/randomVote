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
  .replace(draw, `scoopRunActors = actors; scoopRunCapture(actors, reduced ? 0 : clock); ${draw}`)
  .replace(initial, `scoopRunInitialize(sim, reset); ${initial}`);
source += '\nlet scoopRunActors; const scoopRunScenery = () => {}; let scoopRunInitialize = () => {}, scoopRunCapture = () => {}; export const setInitialize = fn => { scoopRunInitialize = fn; }; export const setCapture = fn => { scoopRunCapture = fn; }; export const capturedActors = () => scoopRunActors; export { render, createArenaCamera, arenaRounds, drawArenaFighter };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capturedActors, setInitialize, setCapture, drawArenaFighter } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Select the real incoming fighter from the live contact, independently of its
// charge flags. Ambient movement, escaped survivors and award runs are excluded.
function attackingRuns(sim, actors, elapsed) {
  const runs = new Map();
  const add = (id, route) => {
    const actor = actors.get(id);
    if (!actor || sim.exits.has(id) || actor.pose !== 'run' || Math.abs(actor.angle) > .001
      || (actor.suspension ?? 0) > .001 || actor.slamProgress || (actor.carryStretch ?? 0) > 0) return;
    runs.set(id, route);
  };
  const active = (window, before) => window && elapsed >= window.start && elapsed < window.end
    && (before == null || elapsed < before);
  for (const contact of sim.contacts.values()) {
    const round = contact.round;
    if (contact.wrestlingMoveOrigins && active(round.wrestlingMove, round.wrestlingMove?.contactAt)) {
      const counter = ['powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'].includes(round.wrestlingMove.kind);
      add(counter ? round.victim : round.aggressor, round.wrestlingMove.kind);
    } else if (contact.supermanPunchOrigins && active(round.supermanPunch, round.supermanPunch?.hitAt)) {
      add(round.aggressor, 'supermanPunch');
    } else if (contact.slideTripOrigins && active(round.slideTrip, round.slideTrip?.hookAt)) {
      add(round.aggressor, 'slideTrip');
    } else if (contact.kickCatchOrigins && active(round.kickCatch, round.kickCatch?.catchAt)) {
      add(round.victim, 'kickCatch');
    } else if (contact.linkedRushOrigins && active(round.linkedRush, round.linkedRush?.contactAt)) {
      add(round.aggressor, 'linkedRush'); add(round.helper, 'linkedRush');
    } else if (contact.pairDodgeOrigins && !contact.pairDodgeFinished && active(round.pairDodge)) {
      add(round.victim, 'pairDodge');
    } else if (contact.rimChargeOrigins && !contact.rimChargeFinished && active(round.rimCharge)) {
      add(round.victim, 'rimCharge');
    } else if (round.rushOutcome && !round.linkedRush && contact.started
      && elapsed >= round.start && elapsed < (round.rushContactAt ?? round.impact)) {
      add(round.rushOutcome === 'double-out' ? round.aggressor : round.victim, round.rushOutcome);
    } else if (contact.started && !round.wrestlingMove && !round.kickCatch && !round.supermanPunch
      && !round.slideTrip && !round.linkedRush && !round.passingTrip && elapsed >= round.start
      && elapsed < (round.chargeSetup?.contactAt ?? round.impact)) {
      if (round.tactic === 'ram') add(round.aggressor, 'ram');
      if (round.tactic === 'bait' || round.tactic === 'catch') add(round.victim, round.tactic);
    }
  }
  return runs;
}

const observedCharges = new Set();

const cases = [
  ...Object.entries({ clothesline: 19, dropkick: 15, powerbomb: 4, backbodydrop: 16, spinebuster: 11, scoopslam: 40, suplex: 42, elbow: 12 })
    .map(([name, seed]) => ({ name, seed, order: ['2', '1'], rush: 7 })),
  { name: 'superman', seed: 1119, order: ['1', '3', '2', '4', '5'], rush: 7, route: 'supermanPunch' },
  { name: 'sliding charge', seed: 46, order: ['1', '3', '2', '4', '5'], rush: 7, route: 'slideTrip' },
  { name: 'linked clothesline', seed: 865, order: ['1', '3', '2', '4', '5'], rush: 7, route: 'linkedRush' },
  { name: 'kick catch', seed: 17, order: ['1', '3', '2', '4', '5'], candidates: ['4', '1', '2', '5', '3'], rush: 7, route: 'kickCatch' },
  ...Array.from({ length: 10 }, (_, seed) => ({ name: 'pair and outer charge ' + seed, seed, order: ['1', '2', '3', '4', '5'], rush: seed })),
];

for (const fixture of cases) test(`${fixture.name}: attacking runs share the shoulder charge while all running frames retain normal supported legs`, () => {
  for (const delta of [16, 50]) {
    const { seed, order, rush } = fixture, duration = 44000;
    const candidates = (fixture.candidates ?? ['1', '2', '3', '4', '5'])
      .filter(id => order.includes(id)).map(id => ({ id, name: id, color: '#ffad72' }));
    const props = { candidates, order, duration, arenaRushRoll: rush, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
    const ctx = context();
    setInitialize(() => {});
    let runningFrames = 0, stoppedRunFrames = 0, supportFrames = 0, specialRunSeen = false, chargeFrames = 0;
    let elapsedNow = 0, references = new Map();
    setCapture((actors, clock) => {
      references = new Map();
      for (const [id, route] of attackingRuns(sim, actors, elapsedNow)) {
        const incoming = actors.get(id);
        // Paint the ram posture from the same actual pre-frame rig and runway.
        // Special striking arms may change the arms, but cannot change the run's
        // trunk, pelvis, material heels, knees or trouser geometry.
        const reference = { ...incoming, animation: structuredClone(incoming.animation),
          chargeStrength: 1, chargePreparation: 0, linkedArm: undefined, linkedHandTarget: undefined,
          clotheslineArm: undefined, clotheslineTarget: undefined, clotheslineInner: undefined };
        drawArenaFighter(ctx, reference, clock);
        references.set(id, { route, animation: reference.animation });
      }
    });
    for (let elapsed = 0; elapsed < 16000; elapsed += delta) {
      elapsedNow = elapsed;
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      const actors = capturedActors();
      for (const [id, reference] of references) {
        const incoming = actors.get(id), actual = incoming.animation, baseline = reference.animation;
        const detail = `${fixture.name}/${reference.route}/${delta}ms/${elapsed}ms/${id}`;
        chargeFrames++; observedCharges.add(reference.route);
        assert.equal(incoming.chargeStrength, 1, `the attacking ground run uses the shoulder charge: ${detail}`);
        assert.equal(incoming.chargePreparation, 0, `the run cannot retain a planted preparation pose: ${detail}`);
        const motionParts = ['crouch', 'lean', 'hipX', 'head', 'spread'];
        if (!incoming.clotheslineInner && incoming.clotheslineArm === undefined && incoming.linkedArm === undefined) {
          motionParts.push('backX', 'backY', 'frontX', 'frontY');
        }
        for (const part of motionParts) {
          assert.ok(Math.abs(actual.motion[part] - baseline.motion[part]) < 1e-8,
            `the actual ${part} matches the reference shoulder run: ${detail}/${actual.motion[part]}/${baseline.motion[part]}`);
        }
        assert.ok(distance(actual.supportHip, baseline.supportHip) < 1e-8, `the pelvis uses the same supported charge gait: ${detail}`);
        for (const part of ['hips', 'knees', 'feet']) actual.skeleton[part].forEach((point, leg) => {
          assert.ok(distance(point, baseline.skeleton[part][leg]) < 1e-8, `the actual ${part} matches the reference charge skeleton: ${detail}/${leg}`);
        });
        assert.deepEqual(actual.skeleton.shorts, baseline.skeleton.shorts, `the moving trouser pixels share the charge's thigh geometry: ${detail}`);
      }
      if (fixture.route) for (const contact of sim.contacts.values()) {
        if (!contact.round[fixture.route] || !contact[fixture.route + 'Origins']) continue;
        const window = contact.round[fixture.route];
        const hitAt = window.contactAt ?? window.hitAt ?? window.hookAt ?? window.catchAt;
        if (hitAt != null && elapsed > hitAt) continue;
        specialRunSeen ||= [contact.round.aggressor, contact.round.victim, contact.round.helper].some(id => {
          const actor = actors.get(id);
          return actor?.pose === 'run' && Math.hypot(actor.velocityX, actor.velocityY) > 35;
        });
      }
      for (const actor of actors.values()) {
        if (actor.pose !== 'run') continue;
        const animation = actor.animation, skeleton = animation.skeleton;
        const speed = Math.hypot(actor.velocityX, actor.velocityY);
        const detail = `${fixture.name}/${delta}ms/${elapsed}ms/${actor.candidate.id}/${speed.toFixed(2)}px/s`;
        runningFrames++;
        if (speed < 35) stoppedRunFrames++;
        assert.ok(animation.supportHip.y + 20 < 4, `the painted pelvis cannot chase an expired sideways support heel into a squat: ${detail}/${animation.supportHip.y + 20}`);
        for (let leg = 0; leg < 2; leg++) {
          const hip = skeleton.hips[leg], joint = skeleton.knees[leg], foot = skeleton.feet[leg], memory = animation.feet[leg];
          const upper = distance(hip, joint), lower = distance(joint, foot);
          assert.ok(upper <= 11.05 && lower <= 11.05 && upper > 2.5 && lower > 2.5, `both normal leg bones remain connected during the real charge: ${detail}/${leg}/${upper}/${lower}`);
          assert.ok(Math.abs(skeleton.footAngles[leg]) < .35, `replacement steps use modest ankle flex: ${detail}`);
          if (!memory.swinging && memory.lift < .05) {
            supportFrames++;
            assert.equal(skeleton.footAngles[leg], 0, 'a supporting sole stays flat while the body passes it');
            const heel = { x: memory.ground.x, y: memory.ground.y - actor.scale * 2 };
            assert.ok(distance(animation.contactPoints.feet[leg], heel) < .001, `the actual painted support foot stays on its material heel: ${detail}`);
          }
          assert.ok(skeleton.shorts[leg].every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `the cuff remains attached to finite thigh geometry: ${detail}`);
        }
      }
    }
    assert.ok(runningFrames >= 4 && supportFrames > 4, `the natural sequence actually exercises running and material support: ${fixture.name}/${delta}/${runningFrames}/${supportFrames}/${stoppedRunFrames}`);
    if (fixture.route) assert.ok(specialRunSeen, `the selected ${fixture.route} actually uses its participants' running approach rather than an unrelated runner`);
    if (fixture.route || ['clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'].includes(fixture.name)
      || fixture.name.startsWith('pair and outer charge')) assert.ok(chargeFrames > 0, `the fixture verifies its real attacking run against the ram rig: ${fixture.name}/${delta}`);
  }
});

test('the charge comparison covers the natural wrestling counters, jumping attacks and both pair-rush outcomes', () => {
  for (const route of ['clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam',
    'supermanPunch', 'slideTrip', 'linkedRush', 'kickCatch', 'double-out', 'counter-throw']) {
    assert.ok(observedCharges.has(route), `the actual ${route} incoming run was compared with the shoulder charge`);
  }
});
