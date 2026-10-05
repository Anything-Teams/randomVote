import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const bundle = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { arenaWrestlingMoveTargets } = await source('src/arenaWrestlingMoves.ts');
const { arenaAnkleSwingProjection, arenaAnkleSwingBasis } = await source('src/arenaAnkleSwing.ts');
const center = { x: 500, y: 416 };
const midpoint = frame => ({ x: (frame.gripTargets[0].x + frame.gripTargets[1].x) / 2, y: (frame.gripTargets[0].y + frame.gripTargets[1].y) / 2 });

test('every ankle swing keeps moving through a late 16 or 50ms actual release frame', () => {
  for (const kind of ['backbodydrop', 'powerbomb', 'scoopslam']) for (const side of [-1, 1]) for (const step of [16, 50]) {
    const initial = { driver: { x: 500 + side * 25, y: 416 }, victim: { x: 500 - side * 200, y: 416 }, ankles: [{ x: 490, y: 409 }, { x: 485, y: 398 }], ankleDriver: center, ankleFacing: side };
    const window = { kind, start: 0, end: 12000, launchAt: 160, contactAt: 1500, ankleGripAt: 5000, releaseAt: null };
    const nominal = arenaWrestlingMoveTargets(window, 5000, center, initial, side).requiredReleaseAt;
    const releaseAt = nominal + step, before = arenaWrestlingMoveTargets(window, releaseAt - 1, center, initial, side), current = arenaWrestlingMoveTargets(window, releaseAt, center, initial, side);
    assert.equal(current.ankleSpinProgress, 1, 'the completed presentation step stays bounded');
    assert.ok(Math.abs(current.pivotTurn) > Math.PI * 2, 'the still-held body continues beyond the nominal final angle');
    assert.ok(Math.abs((current.ankleSpin.orbit - before.ankleSpin.orbit) * 1000 - current.ankleOrbitVelocity) < 1e-8, 'the last actual frame carries the same angular velocity the flight inherits');
    assert.ok(Math.hypot(midpoint(current).x - midpoint(before).x, midpoint(current).y - midpoint(before).y) > .02, 'the hands never stop while the foot ends are still attached');
    const actual = { ...window, releaseAt };
    assert.equal(arenaWrestlingMoveTargets(actual, releaseAt + step, center, initial, side).ankleSpin.orbit, current.ankleSpin.orbit, 'opening the hands records the real last angle instead of snapping to exactly one revolution');
  }
});

test('the horizontal ankle ellipse passes in front and behind with a recognizable complete body', () => {
  const depth = [], projectedSides = [];
  for (let phase = 0; phase <= Math.PI * 2; phase += Math.PI / 16) {
    const projection = arenaAnkleSwingProjection(phase), basis = arenaAnkleSwingBasis(phase, 2.04, -1);
    depth.push(Math.hypot(basis[2], basis[3]) / 2.04); projectedSides.push(projection.radial.y);
    assert.ok(Math.abs(basis[0] * basis[3] - basis[1] * basis[2]) > .7, 'the actual ankle transform never collapses a body to a line');
  }
  assert.ok(Math.min(...depth) >= .5 - 1e-12 && Math.max(...depth) <= 1 + 1e-12, 'the front and back crossings retain at least half the recognizable body length');
  assert.ok(Math.min(...projectedSides) <= -.5 && Math.max(...projectedSides) >= .5, 'the held body actually crosses both sides of the caster instead of only rocking above its hands');
});
