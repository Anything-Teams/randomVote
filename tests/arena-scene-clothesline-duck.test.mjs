import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the production run, airborne strike, physical neck gate, recovery,
// subsequent ordinary exchange and drawn places. Only scenery is omitted.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const init = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(ranks) && source.includes(init));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'duckTestScenery(ctx, clock,')
  .replace(draw, `duckTestActors = actors; ${draw}`)
  .replace(ranks, `${ranks} duckTestRanks = ranks;`)
  .replace(init, `duckTestInitialize(sim, reset); ${init}`);
source += '\nlet duckTestActors, duckTestRanks; const duckTestScenery = () => {}; let duckTestInitialize = () => {}; export const setInitialize = fn => { duckTestInitialize = fn; }; export const capturedActors = () => duckTestActors; export const capturedRanks = () => duckTestRanks; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capturedActors, capturedRanks, setInitialize } = module.exports;
const noop = () => {};
const context = () => new Proxy({ globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const painted = rig => [rig.head, ...rig.headSides, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const segmentGap = (point, from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, { x: from.x + dx * t, y: from.y + dy * t });
};
function neck(rig) {
  const head = { x: (rig.headSides[0].x + rig.headSides[1].x) / 2, y: (rig.headSides[0].y + rig.headSides[1].y) / 2 };
  const shoulders = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 };
  return { x: head.x + (shoulders.x - head.x) * .65, y: head.y + (shoulders.y - head.y) * .65 };
}

function checkDuck({ mirrored, delta, natural = false }) {
  const order = natural ? ['5', '4', '3', '2', '1'] : ['2', '1'];
  const props = { candidates: [...order].reverse().map(id => ({ id, name: id, color: '#ffad72' })), order, duration: 44000, arenaRushRoll: 7, arenaEscapeSeed: natural ? 15196 : 6280, paused: false, preview: false };
  const planned = arenaRounds(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed).find(round => round.wrestlingMove?.kind === 'clothesline' && round.wrestlingMove.duck);
  assert.ok(planned, 'the real separate cosmetic roll must select the rare solo duck');
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    if (!natural) {
      Object.assign(sim.bodies.get(planned.aggressor), { x: 320, y: 416 });
      Object.assign(sim.bodies.get(planned.victim), { x: 520, y: 416 });
    }
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let running = false, launched = false, duckSeen = false, clearMs = 0, passed = false, landed = false, recovered = false, resumed = false, finished = false, pausedChecked = false;
  let standingTarget, previous, previousWindow, recoveryAt, resumedAt, strikingArm;
  let maxLowering = 0;
  const detail = elapsed => `${natural ? 'natural' : 'controlled'}/${mirrored}/${delta}/${elapsed}`;
  for (let elapsed = 0; elapsed <= 80000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actual = sim.contacts.get(planned.id), round = actual?.round, window = round?.wrestlingMove;
    if (!actual?.started) continue;
    const driver = capturedActors().get(planned.aggressor), victim = capturedActors().get(planned.victim);
    if (Object.keys(capturedRanks()).length === order.length) {
      assert.deepEqual(capturedRanks(), Object.fromEntries(order.map((id, index) => [id, index + 1])));
      finished = true; break;
    }
    assert.equal(round.aggressor, planned.aggressor); assert.equal(round.victim, planned.victim);
    if (!window) {
      assert.ok(duckSeen && passed && landed, 'the selected rare strike must really pass the duck before an ordinary rematch');
      if (!resumed) {
        resumed = true; resumedAt = elapsed;
        assert.ok(recovered || driver.pose === 'guard' && victim.pose === 'guard', 'both actual bodies finish their landing and return upright before the rematch');
        assert.equal(victim.duckProgress ?? 0, 0, 'the resumed opponent cannot retain a hidden duck modifier');
        assert.ok(round.start >= (recoveryAt ?? previousWindow.start), 'the ordinary bout starts after the finite duck recovery');
        assert.ok(round.impact > elapsed + 1000 && round.resolve > round.impact, 'missing the arm cannot immediately launch or rank the opponent');
        assert.equal(sim.exits.has(planned.victim), false); assert.equal(capturedRanks()[planned.victim], undefined);
      }
      if (!sim.exits.has(planned.victim)) assert.equal(capturedRanks()[planned.victim], undefined, 'a rank waits for the actual ordinary finish');
      continue;
    }
    assert.equal(window.kind, 'clothesline'); assert.equal(window.duck, true);
    const frame = arenaWrestlingMoveTargets(window, elapsed, actual.center, actual.wrestlingMoveOrigins, round.contactSide);
    const rig = driver.animation.contactPoints, defended = victim.animation.contactPoints;
    if (driver.clotheslineStrength > .001) {
      const expectedArm = natural ? frame.side < 0 ? 0 : 1 : mirrored ? 0 : 1;
      assert.equal(driver.clotheslineArm, expectedArm, 'the missed strike still uses the left arm running left and the right arm running right');
      strikingArm ??= driver.clotheslineArm;
      assert.equal(driver.clotheslineArm, strikingArm, 'ducking cannot exchange the incoming arm or reset its follow-through');
      if (Math.abs(driver.velocityX) > 80) assert.equal(Math.sign(driver.velocityX), frame.side, 'the selected arm follows the real incoming travel direction');
    }
    assert.ok(painted(rig).concat(painted(defended)).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), 'all real painted joints stay finite');
    assert.equal(window.contactAt, null, `the lowered neckline must avoid the actual physical arm gate: ${detail(elapsed)}`);
    assert.equal(window.ankleGripAt, null); assert.equal(window.releaseAt, null);
    assert.equal(sim.exits.has(planned.aggressor), false); assert.equal(sim.exits.has(planned.victim), false);
    assert.equal(capturedRanks()[planned.victim], undefined);
    assert.ok(!victim.eyesClosed && victim.pose !== 'stunned' && victim.slamProgress === undefined && !victim.spinSuspension, 'a successful duck keeps the opponent awake and unthrown');
    assert.ok(!driver.gripTarget && !driver.secondaryGripTarget && !(driver.gripStrength > 0), 'the missed strike cannot acquire a head or ankle grip');
    running ||= driver.pose === 'run' && Math.hypot(driver.velocityX, driver.velocityY) > 80;
    launched ||= driver.depthY - driver.y > 8 && driver.suspension > .5;
    if (window.launchAt != null) {
      const liveNeck = neck(defended), duck = victim.duckProgress ?? 0;
      if (duck > 0) standingTarget ??= { ...driver.clotheslineTarget };
      if (standingTarget) assert.ok(distance(driver.clotheslineTarget, standingTarget) < 1e-7, 'the incoming arm retains its original standing neck line instead of following the ducked head');
      assert.ok(Math.abs(duck - frame.victimDuck) < 1e-8, 'the real actor receives the helper duck progress');
      duckSeen ||= duck > .9;
      if (standingTarget) maxLowering = Math.max(maxLowering, liveNeck.y - standingTarget.y);
      if (duck > .9 && driver.clotheslineStrength > .75 && Math.abs(rig.elbows[strikingArm].x - liveNeck.x) < 40) {
        const gap = Math.min(segmentGap(liveNeck, rig.shoulders[strikingArm], rig.elbows[strikingArm]), segmentGap(liveNeck, rig.elbows[strikingArm], rig.hands[strikingArm]));
        assert.ok(gap > 8, `the actual lowered neck clears the complete painted striking arm: ${detail(elapsed)}/${gap.toFixed(3)}`);
        assert.ok(liveNeck.y > rig.elbows[strikingArm].y + 8, 'the actual head passes underneath the selected arm rather than sideways through it');
        clearMs += delta;
      }
      passed ||= frame.side * (driver.x - victim.x) > 35;
      landed ||= passed && driver.pose === 'land' && driver.depthY - driver.y < .001;
      if (passed && landed && driver.pose === 'guard' && victim.pose === 'guard' && duck < .001) { recovered = true; recoveryAt ??= elapsed; }
      if (previous) for (const who of ['driver', 'victim']) painted(who === 'driver' ? rig : defended).forEach((point, index) => assert.ok(distance(point, previous[who][index]) < 8 + delta * .9, `the real duck, aerial pass and recovery cannot reset a joint: ${detail(elapsed)}/${who}/${index}/${distance(point, previous[who][index]).toFixed(3)}`));
      for (const actor of [driver, victim]) {
        const body = actor.animation.contactPoints;
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(Math.abs(distance(body.shoulders[arm], body.elbows[arm]) - 11 * actor.scale) < .001, 'both ordinary upper arms stay attached through the duck');
          assert.ok(Math.abs(distance(body.elbows[arm], body.hands[arm]) - 10.5 * actor.scale) < .001, 'the lowered guard retains complete ordinary forearms');
        }
      }
      if (!pausedChecked && !natural && !mirrored && delta === 16 && duck > .99) {
        const before = { driver: structuredClone(painted(rig)), victim: structuredClone(painted(defended)), duck, launchAt: window.launchAt, strikingArm: driver.clotheslineArm };
        for (let repeat = 0; repeat < 3; repeat++) render(ctx, { ...props, paused: true }, elapsed, elapsed, sim, 0, false);
        for (const who of ['driver', 'victim']) {
          const actor = capturedActors().get(who === 'driver' ? planned.aggressor : planned.victim);
          painted(actor.animation.contactPoints).forEach((point, index) => assert.ok(distance(point, before[who][index]) < 1e-7, 'paused repeated drawing cannot advance or flip the held duck or flying strike'));
        }
        assert.equal(capturedActors().get(planned.victim).duckProgress, before.duck);
        assert.equal(capturedActors().get(planned.aggressor).clotheslineArm, before.strikingArm, 'paused drawing preserves the chosen material arm');
        assert.equal(sim.contacts.get(planned.id).round.wrestlingMove.launchAt, before.launchAt);
        pausedChecked = true;
      }
      previous = { driver: structuredClone(painted(rig)), victim: structuredClone(painted(defended)) };
    }
    previousWindow = window;
  }
  assert.ok(running && launched && duckSeen && clearMs >= 32 && maxLowering >= 18 && passed && landed && resumed && finished, JSON.stringify({ running, launched, duckSeen, clearMs, maxLowering, passed, landed, recovered, resumed, resumedAt, finished, natural, mirrored, delta }));
  if (!natural && !mirrored && delta === 16) assert.equal(pausedChecked, true);
}

for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`the rare solo duck visibly clears a real flying arm and preserves the ordinary finish (${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => checkDuck({ mirrored, delta }));
for (const delta of [16, 50]) test(`the rare duck keeps earlier natural fights and the complete drawn order (${delta}ms)`, () => checkDuck({ mirrored: false, delta, natural: true }));
