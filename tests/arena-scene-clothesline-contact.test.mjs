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
const props = { candidates: ['1', '2', '3', '4', '5'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration: 44000, arenaRushRoll: 7, arenaEscapeSeed: 83, paused: false, preview: false };
const planned = arenaRounds(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed).find(round => round.wrestlingMove?.kind === 'clothesline');
assert.ok(planned);

for (const mirrored of [false, true]) for (const step of [16, 50]) test(`a natural clothesline reaches the live neck and completes its knockout and drag throw (${mirrored ? 'mirrored' : 'ordinary'}, ${step}ms)`, () => {
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
  // Mirror only the real initial layout; keep every earlier fight and contact.
  setInitialize((current, reset) => {
    if (current !== sim || !reset || !mirrored) return;
    for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; }
  });
  let ran = false, contactSeen = false, knockoutSeen = false, dragged = false, released = false, finished = false, stoppedAt;
  let dragOrigin, dragDistance = 0;
  for (let elapsed = 0; elapsed <= 70000; elapsed += step) {
    render(ctx, props, elapsed, elapsed, sim, step, false);
    const actual = sim.contacts.get(planned.id), round = actual?.round, window = round?.wrestlingMove;
    if (!actual?.started) continue;
    assert.equal(window?.kind, 'clothesline', 'the selected running strike must reach the actual victim rather than silently fall back after a stalled approach');
    const frame = arenaWrestlingMoveTargets(window, elapsed, actual.center, actual.wrestlingMoveOrigins, round.contactSide);
    const driver = capturedActors().get(round.aggressor), victim = capturedActors().get(round.victim);
    assert.ok(driver && victim);
    ran ||= driver.pose === 'run' && Math.hypot(driver.velocityX, driver.velocityY) > 80;
    if (window.contactAt == null && ran && elapsed >= window.plannedContactAt && Math.hypot(frame.driverVelocity.x, frame.driverVelocity.y) < 1) {
      stoppedAt ??= elapsed;
      assert.ok(elapsed - stoppedAt < 400, `the runner cannot wait motionless in front of an unreachable stale neck (${elapsed}ms, seed 83)`);
    }
    if (window.contactAt === elapsed) {
      contactSeen = true;
      assert.ok(ran, 'the strike follows a visible actual run');
      const driverRig = driver.animation.contactPoints, victimRig = victim.animation.contactPoints;
      const liveNeck = { x: victimRig.head.x, y: victimRig.head.y + victim.scale * 20 };
      const insideForearm = { x: driverRig.elbows[1].x + (driverRig.hands[1].x - driverRig.elbows[1].x) * .25, y: driverRig.elbows[1].y + (driverRig.hands[1].y - driverRig.elbows[1].y) * .25 };
      const neckGap = segmentGap(liveNeck, driverRig.elbows[1], insideForearm);
      assert.ok(neckGap < 8, `the painted inside elbow reaches the victim's current neck (${neckGap.toFixed(2)}px at ${elapsed}ms)`);
      assert.ok(distance(liveNeck, driverRig.hands[1]) > 12, 'the fist extends beyond the neck instead of punching it');
    }
    if (window.contactAt != null && elapsed >= frame.floorAt && !sim.exits.has(round.victim)) knockoutSeen ||= victim.pose === 'stunned' && frame.victimSlam?.slump === 1;
    if (frame.stage === 'drag') {
      dragOrigin ??= { x: driver.x, y: driver.y };
      dragDistance = Math.max(dragDistance, distance(dragOrigin, driver));
      dragged ||= dragDistance > 35 && driver.gripMode === 'ankle' && driver.gripStrength > .95;
    }
    if (sim.exits.has(round.victim)) released = true;
    else assert.equal(capturedRanks()[round.victim], undefined, 'the drawn rank cannot eliminate the victim before the actual held throw');
    if (Object.keys(capturedRanks()).length === order.length) { finished = true; break; }
  }
  assert.ok(contactSeen && knockoutSeen && dragged && released && finished, 'the same running strike must proceed through knockout, actual dragging, release and all drawn ranks');
  assert.deepEqual(capturedRanks(), { '1': 5, '2': 4, '3': 3, '4': 2, '5': 1 });
});
