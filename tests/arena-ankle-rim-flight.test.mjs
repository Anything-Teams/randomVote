import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/arenaAnkleRimFlight.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaAnkleRimFlightSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const point = (root, angle, length) => ({ x: root.x + Math.cos(angle) * length, y: root.y + Math.sin(angle) * length });
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const direction = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const turn = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const project = (matrix, p) => ({ x: matrix[0] * p.x + matrix[2] * p.y + matrix[4], y: matrix[1] * p.x + matrix[3] * p.y + matrix[5] });
function release(mirrored = false) {
  const hips = [{ x: -4.5, y: -19.6 }, { x: 4.5, y: -19.6 }], shoulders = [{ x: -8, y: -23 }, { x: 8, y: -23 }];
  const knees = hips.map((hip, leg) => point(hip, 1.46 + leg * .02, 11));
  const feet = knees.map((knee, leg) => point(knee, 1.67 + leg * .02, 11));
  const elbows = shoulders.map((shoulder, arm) => point(shoulder, arm ? 2.1 : .9, 11));
  const hands = elbows.map((elbow, arm) => point(elbow, arm ? .8 : 2.2, 10.5));
  return {
    origin: { x: mirrored ? 250 : 750, y: 400 }, matrix: [0, -2.04, mirrored ? -2.04 : 2.04, 0, mirrored ? 250 : 750, 400],
    motion: { crouch: .4, lean: 0, hipX: 0, head: -2, mouth: 2, backX: -5, backY: -12, frontX: 15, frontY: -15, spread: 1, contact: 0, shoulderLift: 0, clapTurn: 0, cheerTurn: 0, applause: 0 },
    hip: { x: 0, y: -19.6 }, hips, knees, feet, shoulders, elbows, hands, footAngles: [0, 0], orbit: mirrored ? Math.PI : 0, front: true, phase: 1, facing: mirrored ? -1 : 1,
  };
}

test('a low rim flight starts from the exact immutable release and keeps the torso and mass basis fixed', () => {
  for (const mirrored of [false, true]) {
    const saved = release(mirrored), original = structuredClone(saved);
    assert.strictEqual(arenaAnkleRimFlightSnapshot(saved, 0), saved);
    assert.strictEqual(arenaAnkleRimFlightSnapshot(saved, -50), saved);
    for (const age of [1, 16, 50, 150, 300, 650, 1200]) {
      const free = arenaAnkleRimFlightSnapshot(saved, age);
      for (const key of ['origin', 'matrix', 'motion', 'hip', 'hips', 'shoulders', 'orbit', 'facing']) assert.deepEqual(free[key], original[key], 'the helper cannot move the waist, head, torso or release trajectory');
      assert.deepEqual(arenaAnkleRimFlightSnapshot(saved, age), free, 'pause and seeking keep the same relaxed pose');
    }
    assert.deepEqual(saved, original, 'sampling must not change the saved release used by following frames');
    const incomplete = { ...saved, knees: undefined };
    assert.strictEqual(arenaAnkleRimFlightSnapshot(incomplete, 500), incomplete, 'a legacy snapshot without a complete leg rig is preserved');
  }
});

test('free legs and arms soften gradually while preserving every bone and a common knee bend', () => {
  for (const mirrored of [false, true]) for (const step of [16, 50]) {
    const saved = release(mirrored);
    let previous = saved, softened = false;
    for (let age = step; age <= 1300; age += step) {
      const free = arenaAnkleRimFlightSnapshot(saved, age), bendChanges = [];
      for (let limb = 0; limb < 2; limb++) {
        for (const [a, b, length] of [[free.hips[limb], free.knees[limb], 11], [free.knees[limb], free.feet[limb], 11], [free.shoulders[limb], free.elbows[limb], 11], [free.elbows[limb], free.hands[limb], 10.5]]) assert.ok(Math.abs(distance(a, b) - length) < 1e-10, 'relaxation cannot stretch or shrink a limb');
        const before = turn(direction(saved.hips[limb], saved.knees[limb]), direction(saved.knees[limb], saved.feet[limb]));
        const after = turn(direction(free.hips[limb], free.knees[limb]), direction(free.knees[limb], free.feet[limb]));
        bendChanges.push(after - before);
        for (const [rootKey, jointKey] of [['hips', 'knees'], ['knees', 'feet'], ['shoulders', 'elbows'], ['elbows', 'hands']]) assert.ok(Math.abs(turn(direction(saved[rootKey][limb], saved[jointKey][limb]), direction(free[rootKey][limb], free[jointKey][limb]))) <= .23, 'free limbs cannot become a kick or a large second action');
        for (const key of ['knees', 'feet', 'elbows', 'hands']) {
          const current = project(free.matrix, free[key][limb]), prior = project(previous.matrix, previous[key][limb]);
          assert.ok(distance(current, prior) < 2.5, 'a free limb cannot jump between playback frames');
          softened ||= distance(project(saved.matrix, saved[key][limb]), current) > 2;
        }
      }
      assert.ok(bendChanges[0] * bendChanges[1] > 0, 'both unconscious knees relax in the same anatomical direction');
      previous = free;
    }
    assert.ok(softened, 'the airborne silhouette really loosens after leaving the palms');
  }
});
