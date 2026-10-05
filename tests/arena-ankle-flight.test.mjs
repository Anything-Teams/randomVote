import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/arenaAnkleFlight.ts', 'src/game/ArenaFighter.ts'], bundle: true, platform: 'node', format: 'esm', write: false, outdir: 'out' });
const [{ arenaAnkleFlightSnapshot }, { arenaReleaseSnapshot, createArenaFighterAnimation }] = await Promise.all(bundle.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)));
const project = (matrix, p) => ({ x: matrix[0] * p.x + matrix[2] * p.y + matrix[4], y: matrix[1] * p.x + matrix[3] * p.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const waist = snapshot => { const lean = snapshot.motion.lean * Math.PI / 180; return { x: snapshot.hip.x + Math.sin(lean) * 4, y: snapshot.hip.y - Math.cos(lean) * 4 }; };
function release(orbit, facing) {
  return arenaReleaseSnapshot({ candidate: { id: '1', name: '선수', color: '#ec8360' }, index: 2, x: 480, y: 385, depthY: 416, scale: 2.04, facing, pose: 'stunned', angle: -.65, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 1, animation: createArenaFighterAnimation(), spinSuspension: { orbit, flatness: 1, weight: 1, gripLimb: 'feet', gripBoth: true, planar: true, grips: [{ x: 490, y: 325 }, { x: 510, y: 325 }] } }, 4000);
}
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

test('a full ankle flight starts at the exact immutable release and leaves unrelated flights unchanged', () => {
  const saved = freeze(release(Math.PI / 2, 1)), original = structuredClone(saved);
  for (const age of [0, -1, NaN, Infinity]) assert.strictEqual(arenaAnkleFlightSnapshot(saved, age, 2.04), saved);
  for (const scale of [0, -1, NaN, Infinity]) assert.strictEqual(arenaAnkleFlightSnapshot(saved, 200, scale), saved);
  const ordinary = { ...saved, planar: undefined };
  assert.strictEqual(arenaAnkleFlightSnapshot(ordinary, 500, 2.04), ordinary, 'ordinary throws and low rim throws keep their existing full proportions');
  const singular = { ...saved, matrix: [0, 0, 0, 0, 500, 300] };
  assert.strictEqual(arenaAnkleFlightSnapshot(singular, 500, 2.04), singular);
  for (const age of [1, 16, 50, 150, 300, 700, 1800]) {
    const frame = arenaAnkleFlightSnapshot(saved, age, 2.04);
    assert.deepEqual(arenaAnkleFlightSnapshot(saved, age, 2.04), frame, 'pause and direct seek use the same pure physical frame');
  }
  assert.deepEqual(saved, original, 'sampling cannot overwrite the actual release used by the flight');
});

test('normal proportions return around the same leaned waist for both material facings and every release angle', () => {
  for (const facing of [-1, 1]) for (let step = 0; step < 16; step++) {
    const saved = release(step * Math.PI / 8, facing), mass = project(saved.matrix, waist(saved));
    for (const age of [1, 16, 50, 150, 299, 300, 700, 1800]) {
      const frame = arenaAnkleFlightSnapshot(saved, age, 2.04);
      assert.ok(distance(project(frame.matrix, waist(frame)), mass) < 1e-8, 'foreshortening disappears around the actual leaned waist rather than pulling the body away from its ballistic mass');
      assert.ok(frame.matrix.every(Number.isFinite));
      assert.equal(Math.sign(frame.matrix[0] * frame.matrix[3] - frame.matrix[1] * frame.matrix[2]), Math.sign(saved.matrix[0] * saved.matrix[3] - saved.matrix[1] * saved.matrix[2]), 'expansion keeps the material facing without folding or flipping the body');
      if (age >= 300) {
        assert.ok(Math.abs(Math.hypot(frame.matrix[0], frame.matrix[1]) - 2.04) < 1e-8 && Math.abs(Math.hypot(frame.matrix[2], frame.matrix[3]) - 2.04) < 1e-8, 'a released complete body cannot stay half length or paper thin');
        assert.ok(Math.abs(frame.matrix[0] * frame.matrix[2] + frame.matrix[1] * frame.matrix[3]) < 1e-8, 'a restored body has two perpendicular physical axes');
      }
      for (const key of ['origin', 'hip', 'hips', 'shoulders', 'motion', 'front', 'facing', 'orbit', 'phase']) assert.deepEqual(frame[key], saved[key], 'pixel restoration cannot restart a pose, move its torso or swap material limbs');
      for (let limb = 0; limb < 2; limb++) for (const [root, end, length] of [[frame.hips[limb], frame.knees[limb], 11], [frame.knees[limb], frame.feet[limb], 11], [frame.shoulders[limb], frame.elbows[limb], 11], [frame.elbows[limb], frame.hands[limb], 10.5]]) assert.ok(Math.abs(distance(root, end) - length) < 1e-8, 'free unconscious limbs retain their complete anatomical bones');
    }
  }
});

test('a free airborne limb unfolds continuously while the same complete body restores its dimensions', () => {
  for (const delta of [16, 50]) for (const facing of [-1, 1]) {
    const saved = release(Math.PI / 2, facing); let previous = saved;
    for (let age = delta; age <= 1600; age += delta) {
      const current = arenaAnkleFlightSnapshot(saved, age, 2.04);
      const points = snapshot => [...snapshot.feet, ...snapshot.hands, ...snapshot.knees, ...snapshot.elbows].map(point => project(snapshot.matrix, point));
      points(current).forEach((point, i) => assert.ok(distance(point, points(previous)[i]) < delta * .27 + .5, 'size recovery and small joint relaxation cannot suddenly jump the painted free limbs'));
      previous = current;
    }
  }
});
