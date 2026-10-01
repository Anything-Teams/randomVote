import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['src/arenaCamera.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaCamera, sampleArenaCamera } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const frame = (elapsed, final, fighters, more = {}) => ({ elapsed, final, fighters, width: 1000, height: 620, delta: 16, ...more });

test('the full melee stays wide and both finalists get a smooth close view', () => {
  const camera = createArenaCamera(), fighters = [{ x: 460, y: 425 }, { x: 540, y: 425 }];
  assert.deepEqual(sampleArenaCamera(camera, frame(0, false, fighters)), { x: 500, y: 310, zoom: 1 });
  let previous = { ...camera };
  for (let elapsed = 16; elapsed <= 1600; elapsed += 16) {
    const current = sampleArenaCamera(camera, frame(elapsed, true, fighters));
    assert.ok(current.zoom - previous.zoom < .016, 'the final cannot snap to a close shot');
    assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) < 3);
    previous = current;
  }
  assert.ok(camera.zoom > 1.38);
});

test('a thrown finalist remains in view while the close camera eases outward', () => {
  const camera = createArenaCamera();
  sampleArenaCamera(camera, frame(0, true, [{ x: 500, y: 425 }, { x: 548, y: 425 }]));
  for (let elapsed = 16; elapsed <= 1120; elapsed += 16) {
    const p = Math.min(1, elapsed / 880), thrown = { x: 548 + 337 * p, y: 425 - Math.sin(Math.PI * p) * 136, angle: p * 2.1 };
    const view = sampleArenaCamera(camera, frame(elapsed, true, [{ x: 500, y: 425 }, thrown]));
    const screen = { x: 500 + (thrown.x - view.x) * view.zoom, y: 310 + (thrown.y - view.y) * view.zoom };
    assert.ok(screen.x > 50 && screen.x < 950, 'flight remains inside the shot');
    assert.ok(screen.y > 100 && screen.y < 590);
    assert.ok(view.x - 500 / view.zoom >= -.001 && view.x + 500 / view.zoom <= 1000.001);
    assert.ok(view.y - 310 / view.zoom >= -.001 && view.y + 310 / view.zoom <= 620.001);
  }
});

test('paused seeks settle on the same framing and the podium returns to the wide stadium', () => {
  const camera = createArenaCamera(), fighters = [{ x: 655, y: 435 }, { x: 705, y: 435 }];
  const sought = sampleArenaCamera(camera, frame(37000, true, fighters));
  assert.equal(sought.zoom, 1.4);
  assert.deepEqual(sampleArenaCamera(camera, frame(37000, true, fighters, { delta: 0 })), sought);
  for (let elapsed = 37016; elapsed <= 41000; elapsed += 16) sampleArenaCamera(camera, frame(elapsed, false, fighters));
  assert.ok(camera.zoom < 1.001 && Math.abs(camera.x - 500) < .5 && Math.abs(camera.y - 310) < .5);
});
