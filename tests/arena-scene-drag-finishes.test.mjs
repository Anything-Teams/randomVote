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
const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const bodyHeading = rig => {
  const feet = midpoint(rig.feet);
  return Math.atan2(rig.head.y - feet.y, rig.head.x - feet.x);
};
const angleGap = (one, two) => Math.atan2(Math.sin(one - two), Math.cos(one - two));
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

const seeds = { suplex: 42, elbow: 12 };
const inside = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1;
const points = rig => [rig.origin, rig.head, rig.waist, ...rig.hands, ...rig.feet];
// `origin` changes from a nominal ground marker to the projected pivot when a
// snapshot is released; continuity concerns the painted body and joints.
const paintedPoints = rig => [rig.head, ...rig.headSides, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const inverse = matrix => {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  assert.ok(Math.abs(determinant) > 1e-6, 'the actual spin transform remains invertible');
  return [matrix[3] / determinant, -matrix[1] / determinant, -matrix[2] / determinant, matrix[0] / determinant,
    (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant, (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant];
};
const cradleTargets = rig => [rig.back, { x: rig.waist.x + ((rig.feet[0].x + rig.feet[1].x) / 2 - rig.waist.x) * .28, y: rig.waist.y + ((rig.feet[0].y + rig.feet[1].y) / 2 - rig.waist.y) * .28 }];
const segmentGap = (point, from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy)));
  return distance(point, { x: from.x + dx * t, y: from.y + dy * t });
};
function headQuad(rig, index) {
  const center = midpoint(rig.headSides), width = [14, 15, 14, 16][index % 4];
  // The temples include .5 local units beyond each skin edge. The crown is
  // 12 units above the center; the painted skin rectangle extends 8 units.
  const side = {
    x: (rig.headSides[1].x - center.x) * width / (width + 1),
    y: (rig.headSides[1].y - center.y) * width / (width + 1),
  };
  const up = { x: (rig.head.x - center.x) * 2 / 3, y: (rig.head.y - center.y) * 2 / 3 };
  return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => ({
    x: center.x + side.x * x + up.x * y,
    y: center.y + side.y * x + up.y * y,
  }));
}
function segmentQuadGap(from, to, quad) {
  const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const edges = quad.map((point, index) => [point, quad[(index + 1) % quad.length]]);
  const inside = point => {
    const sides = edges.map(([a, b]) => cross(a, b, point));
    return sides.every(side => side >= 0) || sides.every(side => side <= 0);
  };
  if (inside(from) || inside(to)) return 0;
  let gap = Infinity;
  for (const [a, b] of edges) {
    const overlap = Math.max(Math.min(from.x, to.x), Math.min(a.x, b.x)) <= Math.min(Math.max(from.x, to.x), Math.max(a.x, b.x))
      && Math.max(Math.min(from.y, to.y), Math.min(a.y, b.y)) <= Math.min(Math.max(from.y, to.y), Math.max(a.y, b.y));
    if (overlap && cross(from, to, a) * cross(from, to, b) <= 0 && cross(a, b, from) * cross(a, b, to) <= 0) return 0;
    gap = Math.min(gap, segmentGap(from, a, b), segmentGap(to, a, b), segmentGap(a, from, to), segmentGap(b, from, to));
  }
  return gap;
}
function roots(kind) {
  return ['powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'].includes(kind) ? { driver: { x: 525, y: 416 }, victim: { x: 300, y: 416 } }
      : { driver: { x: 320, y: 416 }, victim: { x: 520, y: 416 } };
}
function game(kind, { mirrored = false, controlled = true, frameDelta = 16, matchDuration = duration } = {}) {
  const seed = seeds[kind], props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration: matchDuration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const planned = arenaRounds(order, matchDuration, rushRoll, seed)[0];
  assert.equal(planned.wrestlingMove?.kind ?? planned.tactic, kind);
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


for (const kind of Object.keys(seeds)) for (const mirrored of [false, true]) test(`${kind} naturally grips and releases a low rim throw (${mirrored ? 'mirror' : 'ordinary'})`, () => {
  for (const frameDelta of [16, 50]) {
    const scene = game(kind, { mirrored, controlled: false, frameDelta });
    let releasedVelocity, tangentFrames = 0, heldAt, releaseAt, gripFrames = 0, landed = false, previous, previousCaster, actualEnd;
    let heldHeading, freeHeading, heldTurn = 0, freeTurn = 0, followFrames = 0, previousFinishing = false;
    let releaseWaistY, minFlightWaistY = Infinity, previousFlightWaistY, rising = false, falling = false;
    for (let elapsed = 0; elapsed < 20000; elapsed += frameDelta) {
      const actors = scene.step(elapsed), round = scene.sim.contacts.get(scene.planned.id)?.round, exit = scene.sim.exits.get(scene.planned.victim);
      const caster = actors.get(scene.planned.aggressor), victim = actors.get(scene.planned.victim);
      if (capturedRanks()[scene.planned.victim]) { assert.deepEqual(capturedRanks(), { '1': 2, '2': 1 }); actualEnd = round.end; landed = true; break; }
      assert.ok(caster && victim);
      const palms = caster.animation.contactPoints, rig = victim.animation.contactPoints;
      assert.ok(paintedPoints(palms).concat(paintedPoints(rig)).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
      if (victim.spinSuspension && !victim.spinSuspension.planar && !exit?.spinFlight) {
        heldAt ??= elapsed; gripFrames++;
        assert.equal(caster.pose, 'throw', 'the held finish uses the grounded low throwing posture');
        const hands = midpoint(palms.hands), head = midpoint(palms.headSides);
        assert.ok(hands.y > head.y + 12, `${kind}/${mirrored}/${frameDelta}/${elapsed}: both hands stay below the thrower's head`);
        assert.ok(palms.hands.every(hand => hand.y > head.y + 8), 'neither supporting palm swings above the head');
        const heading = bodyHeading(rig);
        if (heldHeading !== undefined) heldTurn += Math.abs(angleGap(heading, heldHeading));
        heldHeading = heading;
        assert.ok(heldTurn < .7, 'the held body keeps its feet-first heading instead of turning through a half revolution');
        assert.ok(rig.head.y <= Math.max(caster.depthY ?? caster.y, victim.depthY ?? victim.y) + 3, 'the supported head remains clear of the sand');
        assert.ok(inside(scene.sim.bodies.get(scene.planned.aggressor)), `${kind}/${mirrored}/${frameDelta}/${elapsed}: caster remains inside`);
        for (let arm = 0; arm < 2; arm++) {
          const gap = distance(palms.hands[arm], rig.feet[arm]);
          assert.ok(gap < 1, `${kind}/${mirrored}/${frameDelta}/${elapsed}: actual ankle gap ${gap.toFixed(2)}`);
          assert.ok(Math.abs(distance(palms.shoulders[arm], palms.elbows[arm]) - 11 * caster.scale) < .01);
          assert.ok(Math.abs(distance(palms.elbows[arm], palms.hands[arm]) - 10.5 * caster.scale) < .01);
        }
        const legs = victim.animation.skeleton;
        for (let leg = 0; leg < 2; leg++) {
          assert.ok(Math.abs(distance(legs.hips[leg], legs.knees[leg]) - 11) < .02, 'fitting each held ankle preserves the thigh length');
          assert.ok(Math.abs(distance(legs.knees[leg], legs.feet[leg]) - 11) < .02, 'fitting each held ankle preserves the shin length');
        }
        assert.equal(capturedRanks()[scene.planned.victim], undefined, 'a held body cannot be declared out before the hand release');
      }
      if (exit?.launchedAt != null && (exit.spinFlight || round?.floorFinish?.releaseAt != null)) {
        if (releaseAt === undefined) {
          releaseAt = exit.launchedAt;
          assert.ok(heldAt != null && releaseAt - heldAt >= 1000 - frameDelta, `${kind}: the complete low loading stroke must be visible`);
          assert.ok(Math.hypot(exit.spinFlight.velocity.x, exit.spinFlight.velocity.y) > 20, 'the actual hand release carries real momentum');
          assert.ok(exit.spinFlight.velocity.x * exit.side > 5, 'the actual backward stroke sends the body toward its own outside rim');
          assert.ok(!inside(exit.landing), 'its continuous free path reaches outside the sand');
          releasedVelocity = exit.spinFlight.velocity;
          assert.ok(releasedVelocity.y <= -300 && exit.spinFlight.gravity > 0, 'the low hand stroke throws upward with a real falling acceleration');
          releaseWaistY = rig.waist.y;
          assert.ok(Math.abs(exit.spinFlight.angularVelocity) * exit.spinFlight.duration / 2000 < .65, 'the released body cannot tumble through another large rotation');
          assert.ok(previous && paintedPoints(rig).every((p, i) => distance(p, paintedPoints(previous)[i]) < 10 + frameDelta * .9), 'the release preserves the actually held skeleton');
        }
        if (elapsed - releaseAt <= exit.spinFlight.duration) {
          minFlightWaistY = Math.min(minFlightWaistY, rig.waist.y);
          if (previousFlightWaistY !== undefined) {
            rising ||= rig.waist.y < previousFlightWaistY - .2;
            falling ||= rig.waist.y > previousFlightWaistY + .2;
          }
          previousFlightWaistY = rig.waist.y;
          const heading = bodyHeading(rig);
          if (freeHeading !== undefined) freeTurn += Math.abs(angleGap(heading, freeHeading));
          freeHeading = heading;
          assert.ok(freeTurn < .65, 'the actual painted flight follows a restrained rotation instead of a spinning wheel');
        }
        if (elapsed > releaseAt && elapsed - releaseAt <= 100 && previous) {
          const moved = { x: rig.waist.x - previous.waist.x, y: rig.waist.y - previous.waist.y };
          const alignment = (moved.x * releasedVelocity.x + moved.y * releasedVelocity.y) / (Math.hypot(moved.x, moved.y) * Math.hypot(releasedVelocity.x, releasedVelocity.y));
          assert.ok(alignment > .85, `${kind}/${mirrored}/${frameDelta}: free flight follows the actual released mass tangent (${alignment})`); tangentFrames++;
        }
        if (elapsed - releaseAt < 100) {
          assert.ok(caster.gripTarget == null && caster.secondaryGripTarget == null, 'the hands really open at release');
          assert.ok(inside(scene.sim.bodies.get(scene.planned.aggressor)));
        }
      }
      if (caster.carrierRelease) {
        const age = elapsed - releaseAt;
        assert.ok(age >= 0 && age <= 650);
        assert.ok(Math.abs(caster.carrierRelease.progress - age / 650) < 1e-10, 'the full 650ms follow-through uses the actual opening clock');
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(Math.abs(distance(palms.shoulders[arm], palms.elbows[arm]) - 11 * caster.scale) < .01);
          assert.ok(Math.abs(distance(palms.elbows[arm], palms.hands[arm]) - 10.5 * caster.scale) < .01);
        }
        followFrames++;
      }
      const finishing = !!(victim.spinSuspension || caster.carrierRelease);
      if (finishing) {
        const quad = headQuad(palms, caster.index);
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(segmentQuadGap(palms.shoulders[arm], palms.elbows[arm], quad) > 2.75 * caster.scale, `${kind}/${mirrored}/${frameDelta}/${elapsed}: the full upper-arm thickness stays outside the painted head`);
          assert.ok(segmentQuadGap(palms.elbows[arm], palms.hands[arm], quad) > 2.45 * caster.scale, `${kind}/${mirrored}/${frameDelta}/${elapsed}: the full forearm thickness stays outside the painted head`);
        }
      }
      if (previousCaster && (finishing || previousFinishing)) {
        const limit = 8 + frameDelta * .9;
        const gap = Math.max(...paintedPoints(palms).map((point, index) => distance(point, paintedPoints(previousCaster)[index])));
        assert.ok(gap < limit, `${kind}/${mirrored}/${frameDelta}/${elapsed}: the low loading stroke and hand opening keep continuous caster joints (${gap.toFixed(2)}px)`);
      }
      previous = structuredClone(rig);
      previousCaster = structuredClone(palms);
      previousFinishing = finishing;
    }
    assert.ok(landed && releaseAt != null && gripFrames >= 1000 / frameDelta - 2, `${kind}/${mirrored}/${frameDelta}: natural full finishing action completes`);
    assert.ok(tangentFrames > 0);
    assert.ok(rising && falling && releaseWaistY - minFlightWaistY >= 35, 'the actual released waist visibly rises at least 35px before falling beyond the rim');
    assert.ok(followFrames >= 650 / frameDelta - 2, 'the low release keeps its complete arm follow-through');
    assert.ok(actualEnd >= releaseAt + 1100, 'the declared actual end includes the throw flight and ranking reveal');
  }
});

test('both dragged finishes share the same throw and hand-release clock in a longer match', () => {
  const frameDelta = 50;
  for (const kind of Object.keys(seeds)) {
    const scene = game(kind, { controlled: false, frameDelta, matchDuration: 62000 });
    let heldAt, releaseAt, followFrames = 0;
    for (let elapsed = 0; elapsed < 35000; elapsed += frameDelta) {
      const actors = scene.step(elapsed), round = scene.sim.contacts.get(scene.planned.id)?.round;
      const caster = actors.get(scene.planned.aggressor), victim = actors.get(scene.planned.victim), exit = scene.sim.exits.get(scene.planned.victim);
      if (victim?.spinSuspension && !victim.spinSuspension.planar && releaseAt === undefined) heldAt ??= elapsed;
      if (exit?.spinFlight && exit.launchedAt !== undefined) {
        if (releaseAt === undefined) {
          releaseAt = exit.launchedAt;
          const throwAt = round.wrestlingMove?.dragEndAt ?? round.floorFinish?.throwAt;
          assert.ok(heldAt !== undefined && throwAt !== undefined, `${kind}: the actual supported throw is visible`);
          assert.ok(releaseAt - throwAt >= 1000 && releaseAt - throwAt < 1000 + frameDelta, `${kind}: the same full 1000ms low stroke precedes opening the palms`);
        }
        const age = elapsed - releaseAt;
        if (age > 0 && age <= 650) {
          assert.ok(caster.carrierRelease, `${kind}: releasing the ankles preserves the painted throwing arms`);
          assert.ok(Math.abs(caster.carrierRelease.progress - age / 650) < 1e-10, `${kind}: the same 650ms follow-through applies to every finish`);
          followFrames++;
        }
        if (age > 650) break;
      }
    }
    assert.ok(releaseAt !== undefined && followFrames >= 10, `${kind}: the complete shared throw and follow-through play naturally`);
  }
});


test('a late natural ten-person finish completes on the extended playback clock with the same draw', () => {
  const many = Array.from({ length: 10 }, (_, index) => String(10 - index));
  const props = { candidates: [...many].reverse().map(id => ({ id, name: id, color: '#ffad72' })), order: many, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: 22, paused: false, preview: false };
  const planned = arenaRounds(many, duration, rushRoll, 22);
  assert.equal(planned.at(-1).wrestlingMove?.kind, 'spinebuster');
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize(() => {});
  let playbackEnd = planned.at(-1).end, finished = false, seenFinish = false;
  // This is the same monotonic end update used by App. Stop when that live
  // clock stops, rather than running the Scene past a fixed nominal deadline.
  for (let elapsed = 0; elapsed <= playbackEnd && elapsed < duration + 30000; elapsed += 50) {
    render(ctx, props, elapsed, elapsed, sim, 50, false);
    playbackEnd = Math.max(playbackEnd, ...[...sim.contacts.values()].map(contact => contact.round.end));
    const final = sim.contacts.get(planned.at(-1).id)?.round;
    seenFinish ||= final?.wrestlingMove?.releaseAt != null || !!final && !final.wrestlingMove;
    if (Object.keys(capturedRanks()).length === 10) {
      assert.deepEqual(capturedRanks(), Object.fromEntries(many.map((id, index) => [id, index + 1])));
      assert.ok(elapsed <= playbackEnd, 'physical completion is reachable before App stops its live clock');
      finished = true; break;
    }
    assert.ok([...sim.bodies.values()].every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), 'live delay never replaces the arena with a non-finite actor');
  }
  assert.ok(finished && seenFinish, `actual final must complete within its published live end (${playbackEnd})`);
});
