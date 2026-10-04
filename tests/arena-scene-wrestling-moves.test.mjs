import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual Scene and painted rig; only the static scenery is skipped.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
const rankRead = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
assert.ok(source.includes(rankRead));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'wrestlingTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} wrestlingTestRanks = ranks;`)
  .replace(draw, 'wrestlingTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.surpriseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.surpriseEnd(); });');
const initAnchor = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(initAnchor));
source = source.replace(initAnchor, 'wrestlingTestInitialize(sim, props, elapsed, reset); ' + initAnchor);
source += '\nlet wrestlingTestActors, wrestlingTestRanks; const wrestlingTestScenery = () => {}; let wrestlingTestInitialize = () => {}; export const setInitialize = fn => { wrestlingTestInitialize = fn; }; export const capturedActors = () => wrestlingTestActors; export const capturedRanks = () => wrestlingTestRanks; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capturedActors, capturedRanks, setInitialize } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const order = ['2', '1'];
const duration = 44000, rushRoll = 7;

function context() {
  let matrix = identity(), stack = [], currentId;
  const records = new Map();
  const target = {
    globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; target.globalAlpha = saved.alpha; } },
    transform(...next) { matrix = multiply(matrix, next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    fillRect(x, y, width, height) {
      if (!currentId || target.globalAlpha <= 0) return;
      records.get(currentId).rectangles.push([{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map(point => project(matrix, point)));
    },
    surpriseStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix], rectangles: [] }); },
    surpriseEnd() { currentId = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

const seeds = { clothesline: 19, dropkick: 15, bulldog: 4, backbodydrop: 16, spinebuster: 11, scoopslam: 40 };
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;
const points = rig => [rig.origin, rig.head, rig.waist, ...rig.hands, ...rig.feet];
// `origin` changes from a nominal ground marker to the projected pivot when a
// snapshot is released; continuity concerns the painted body and joints.
const paintedPoints = rig => [rig.head, ...rig.headSides, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const segmentGap = (point, from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, { x: from.x + dx * t, y: from.y + dy * t });
};
function roots(kind) {
  return kind === 'bulldog' || kind === 'scoopslam' ? { driver: { x: 470, y: 416 }, victim: { x: 530, y: 416 } }
    : kind === 'backbodydrop' || kind === 'spinebuster' ? { driver: { x: 525, y: 416 }, victim: { x: 300, y: 416 } }
      : { driver: { x: 320, y: 416 }, victim: { x: 520, y: 416 } };
}
function game(kind, { mirrored = false, controlled = true, frameDelta = 16 } = {}) {
  const seed = seeds[kind], props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const planned = arenaRounds(order, duration, rushRoll, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, kind);
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  // Change only the actual starting layout, before the production Scene samples
  // any contact. No clocks, grips, outcomes or motion are supplied by the test.
  setInitialize((current, _props, _elapsed, reset) => {
    if (current !== sim || !reset) return;
    if (controlled) {
      const initial = roots(kind);
      Object.assign(sim.bodies.get(planned.aggressor), initial.driver);
      Object.assign(sim.bodies.get(planned.victim), initial.victim);
    }
    if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; }
    for (const body of sim.bodies.values()) { body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
  });
  return { sim, ctx, planned, step(elapsed, paused = false) {
    ctx.records.clear(); render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : frameDelta, false);
    return capturedActors();
  } };
}

for (const kind of Object.keys(seeds)) for (const mirrored of [false, true]) test(`${kind} uses real painted contact, a continuous finish and the drawn ranks (${mirrored ? 'mirrored' : 'ordinary'})`, () => {
  for (const frameDelta of [16, 50]) {
    const scene = game(kind, { mirrored, frameDelta });
    let contactSeen = false, releaseSeen = false, finalSeen = false, fallbackSeen = false, attackerJumped = false, attackerLanded = false;
    let actualContactAt, kickSeen = false, anklesSeen = false, ankleFrames = 0, previousRig;
    const detail = (elapsed, frame) => `${kind}/${mirrored}/${frameDelta}ms/${elapsed}/${frame?.stage}`;
    for (let elapsed = 0; elapsed <= 20000; elapsed += frameDelta) {
      const actors = scene.step(elapsed), contact = scene.sim.contacts.get(scene.planned.id), actual = contact?.round;
      const driver = actors.get(scene.planned.aggressor), victim = actors.get(scene.planned.victim), exit = scene.sim.exits.get(scene.planned.victim);
      if (capturedRanks()[scene.planned.victim]) {
        assert.deepEqual(capturedRanks(), { '1': 2, '2': 1 }); finalSeen = true; break;
      }
      assert.ok(driver && victim && driver.animation?.contactPoints && victim.animation?.contactPoints);
      const paintedDriver = driver.animation.contactPoints, paintedVictim = victim.animation.contactPoints;
      assert.ok(points(paintedDriver).concat(points(paintedVictim)).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
      assert.ok(!scene.sim.exits.has(scene.planned.aggressor), 'the inside surviving caster can never become a new elimination');
      if (!actual?.wrestlingMove) {
        fallbackSeen ||= contactSeen;
        assert.ok(kind === 'bulldog', `${kind} must exercise the selected technique instead of only its ordinary fallback`);
        previousRig = structuredClone(paintedVictim); continue;
      }
      const window = actual.wrestlingMove, frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, actual.contactSide);
      assert.ok(inside(scene.sim.bodies.get(actual.aggressor)), `caster stays inside: ${detail(elapsed, frame)}`);
      if (window.contactAt == null) {
        assert.equal(exit, undefined, 'a planned collision cannot create a premature exit');
        assert.equal(capturedRanks()[actual.victim], undefined);
      }
      if (window.contactAt === elapsed) {
        actualContactAt = elapsed; contactSeen = true;
        if (kind === 'clothesline') assert.ok(segmentGap(contact.wrestlingMoveOrigins.target, paintedDriver.elbows[1], paintedDriver.hands[1]) < 8, `actual forearm reaches neck: ${detail(elapsed, frame)}`);
        else if (kind === 'dropkick') {
          paintedDriver.feet.forEach((foot, leg) => assert.ok(distance(foot, frame.footTargets[leg]) < 7, `both real soles reach the chest: ${detail(elapsed, frame)}`));
          assert.ok((driver.depthY ?? scene.sim.bodies.get(actual.aggressor).y) - driver.y > 20, 'the two-foot strike takes place in the actual jump');
        } else if (kind === 'bulldog') paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, paintedVictim.headSides[arm]) < 7, `both hands reach actual painted head sides (gap ${distance(hand, paintedVictim.headSides[arm]).toFixed(2)}px): ${detail(elapsed, frame)}`));
        else assert.ok(paintedDriver.hands.some(hand => distance(hand, paintedVictim.waist) < 7), `receiver touches the real incoming waist (gap ${Math.min(...paintedDriver.hands.map(hand => distance(hand, paintedVictim.waist))).toFixed(2)}px): ${detail(elapsed, frame)}`);
      }
      if (kind === 'dropkick') {
        attackerJumped ||= frame.driverHeight > 20;
        if (window.launchAt != null && elapsed >= frame.landingAt && frame.driverHeight === 0) attackerLanded = true;
      }
      if (kind === 'bulldog' && contactSeen && frame.gripStrength > .95 && frame.stage === 'fall') {
        paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, paintedVictim.headSides[arm]) < 8, `head grip remains attached through the common fall (gap ${distance(hand, paintedVictim.headSides[arm]).toFixed(2)}px): ${detail(elapsed, frame)}`));
      }
      if (kind === 'spinebuster') {
        if (window.kickAt == null) assert.equal(exit, undefined, 'the floor slam must wait for the separate actual kick');
        if (window.kickAt === elapsed) {
          kickSeen = true;
          assert.ok(window.contactAt != null && elapsed - window.contactAt >= 780);
          assert.ok(distance(paintedDriver.feet[1], paintedVictim.waist) < 8, `the final real sole reaches the fallen waist: ${detail(elapsed, frame)}`);
        }
      }
      if (kind === 'scoopslam') {
        if (window.ankleGripAt == null) assert.equal(exit, undefined, 'the slam does not replace actual two-toe pickup');
        if (window.ankleGripAt != null && !exit) {
          anklesSeen = true; ankleFrames++;
          paintedDriver.hands.forEach((hand, arm) => assert.ok(distance(hand, paintedVictim.feet[arm]) < 8, `both painted toes stay in the palms for the complete preflight stroke (gap ${distance(hand, paintedVictim.feet[arm]).toFixed(2)}px): ${detail(elapsed, frame)}`));
        }
      }
      if (exit && !releaseSeen) {
        releaseSeen = true;
        assert.ok(contactSeen && actualContactAt <= elapsed, 'the actual hit precedes the only exit');
        if (kind === 'spinebuster') assert.ok(kickSeen && window.kickAt != null);
        if (kind === 'scoopslam') assert.ok(anklesSeen && ankleFrames >= (frameDelta === 16 ? 8 : 4), 'the grab persists during the complete 300ms throw stroke');
        if (kind === 'backbodydrop') assert.ok(elapsed - actualContactAt >= 680, 'the loser completes the inside flip before being released behind the catcher');
        if (previousRig) {
          const cap = 15 + frameDelta * .5;
          for (const [point, prior] of paintedPoints(paintedVictim).map((point, index) => [point, paintedPoints(previousRig)[index]])) assert.ok(distance(point, prior) < cap, `release cannot reset the current painted body by ${distance(point, prior).toFixed(2)}px: ${detail(elapsed, frame)}`);
        }
        assert.equal(exit.round.victim, scene.planned.victim);
      }
      previousRig = structuredClone(paintedVictim);
    }
    assert.ok(contactSeen && finalSeen, JSON.stringify({ kind, mirrored, frameDelta, contactSeen, releaseSeen, finalSeen, kickSeen, anklesSeen, fallbackSeen }));
    if (kind === 'bulldog') assert.ok(fallbackSeen, 'the common fall recovers into the real deciding bout with the same drawn opponents');
    else assert.ok(releaseSeen, 'a contacted finishing technique must complete its real release');
    if (kind === 'dropkick') assert.ok(attackerJumped && attackerLanded, 'the attacking jump returns to the sand while only the hit loser exits');
  }
});

test('natural production starting layouts either complete the selected move or resume an ordinary bout with the same finalists', () => {
  for (const kind of Object.keys(seeds)) {
    const scene = game(kind, { controlled: false, frameDelta: 50 });
    let contacted = false, declined = false, finished = false;
    for (let elapsed = 0; elapsed < 25000; elapsed += 50) {
      scene.step(elapsed);
      const actual = scene.sim.contacts.get(scene.planned.id)?.round;
      contacted ||= actual?.wrestlingMove?.contactAt != null;
      declined ||= !!actual && !actual.wrestlingMove;
      if (capturedRanks()['1']) { assert.deepEqual(capturedRanks(), { '1': 2, '2': 1 }); finished = true; break; }
      assert.ok(!scene.sim.exits.has('2'));
    }
    assert.ok(finished && (contacted || declined), JSON.stringify({ kind, contacted, declined, finished }));
  }
});
