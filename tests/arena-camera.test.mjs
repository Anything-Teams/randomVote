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

test('the side landing corridor keeps the throw and both finalists visible at the first impact', () => {
  for (const final of [false, true]) for (const side of [-1, 1]) for (const step of [16, 50]) for (const flightDuration of [650, 1307.5]) {
    const camera = createArenaCamera(), impact = { x: side < 0 ? 0 : 1000, y: 436 };
    const originX = 500 + side * 48;
    sampleArenaCamera(camera, frame(0, final, [{ x: 500, y: 425 }, { x: originX, y: 425 }]));
    let previousTime = 0, view;
    for (let elapsed = step; previousTime < flightDuration;) {
      elapsed = Math.min(elapsed, flightDuration);
      const p = elapsed / flightDuration, thrown = { x: originX + (impact.x - originX) * p, y: 436 - Math.sin(Math.PI * p) * 136 };
      view = sampleArenaCamera(camera, frame(elapsed, final, [{ x: 500, y: 425 }, thrown], { delta: elapsed - previousTime, rimImpact: impact }));
      assert.ok(view.x - 500 / view.zoom >= -96 - 1e-7 && view.x + 500 / view.zoom <= 1096 + 1e-7, 'the shot stays within the actual side corridor');
      if (!final) assert.equal(view.zoom, 1, 'a melee impact keeps the entire sand ring wide');
      previousTime = elapsed; elapsed += step;
    }
    const radius = final || flightDuration > 650 ? 72 : 60;
    for (const x of [impact.x - radius, impact.x + radius]) {
      const screenX = 500 + (x - view.x) * view.zoom;
      assert.ok(screenX >= -1e-7 && screenX <= 1000 + 1e-7, `the landing root and its ${radius}px body margin stay in the shot (${final ? 'final' : 'melee'}, ${side}, ${step}ms, flight ${flightDuration}ms)`);
    }
    if (final) {
      const survivor = 500 + (500 - view.x) * view.zoom;
      assert.ok(survivor > 70 && survivor < 930, 'preparing for the far landing retains the other finalist');
      assert.ok(view.zoom >= 1 && view.zoom <= 1.4, 'the existing final zoom limits stay unchanged');
    }
  }
});

test('the landing allowance and side pan return continuously instead of snapping at the clamp', () => {
  for (const final of [false, true]) for (const side of [-1, 1]) for (const step of [16, 50]) {
    const camera = createArenaCamera(), fighters = [{ x: 500, y: 425 }, { x: side < 0 ? 0 : 1000, y: 436 }];
    let previous = sampleArenaCamera(camera, frame(12000, final, fighters, { rimImpact: fighters[1], immediate: true }));
    const paused = sampleArenaCamera(camera, frame(12000, false, fighters, { delta: 0 }));
    assert.deepEqual(paused, previous, 'a paused frame cannot close the corridor');
    let priorMargin = camera.rimMargin;
    for (let elapsed = 12000 + step; elapsed <= 16000; elapsed += step) {
      const view = sampleArenaCamera(camera, frame(elapsed, false, fighters, { delta: step }));
      assert.ok(Math.abs(view.x - previous.x) < step * .5, 'closing the allowance cannot cause a sudden 96px clamp jump');
      assert.ok(camera.rimMargin >= 0 && camera.rimMargin <= priorMargin && priorMargin - camera.rimMargin < step * .16);
      assert.ok(view.x - 500 / view.zoom >= -camera.rimMargin - 1e-7 && view.x + 500 / view.zoom <= 1000 + camera.rimMargin + 1e-7);
      previous = view; priorMargin = camera.rimMargin;
    }
    assert.ok(camera.rimMargin < .3 && Math.abs(camera.x - 500) < 1 && camera.zoom < 1.001);
  }
});

test('reduced or immediate landing views settle safely and an immediate wide view removes the allowance', () => {
  for (const side of [-1, 1]) {
    const camera = createArenaCamera(), fighters = [{ x: 500, y: 425 }, { x: side < 0 ? 0 : 1000, y: 436 }];
    const atImpact = sampleArenaCamera(camera, frame(23000, true, fighters, { delta: 0, immediate: true, rimImpact: fighters[1] }));
    assert.equal(camera.rimMargin, 96);
    for (const x of [fighters[1].x - 72, fighters[1].x + 72]) assert.ok(500 + (x - atImpact.x) * atImpact.zoom >= 0 && 500 + (x - atImpact.x) * atImpact.zoom <= 1000);
    assert.deepEqual(sampleArenaCamera(camera, frame(23000, true, fighters, { delta: 0, rimImpact: fighters[1] })), atImpact);
    assert.deepEqual(sampleArenaCamera(camera, frame(27000, false, fighters, { delta: 0, immediate: true })), { x: 500, y: 310, zoom: 1 });
    assert.equal(camera.rimMargin, 0);
  }
});

test('side corridors extend wall, paving and rail geometry without stretching the cached stadium', async () => {
  const compiled = await build({ entryPoints: ['src/game/arenaArt.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
  const { drawArenaScenery } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  const commands = [], canvases = [], cachedCommands = [];
  const context = output => new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get(object, key) { return key in object ? object[key] : (...args) => output.push({ key, args }); }, set(object, key, value) { object[key] = value; return true; } });
  const previousDocument = globalThis.document;
  globalThis.document = { createElement(type) { assert.equal(type, 'canvas'); const output = []; cachedCommands.push(output); const ctx = context(output), canvas = { width: 0, height: 0, getContext: () => ctx }; canvases.push(canvas); return canvas; } };
  try {
    const ctx = context(commands);
    drawArenaScenery(ctx, 200, { intensity: .35 });
    assert.deepEqual(canvases.map(canvas => [canvas.width, canvas.height]), [[1000, 620], [1000, 620]], 'architecture and crowd remain at native bitmap resolution');
    assert.deepEqual(commands.filter(command => command.key === 'rect').map(command => command.args), [[-112, 0, 112, 620], [1000, 0, 112, 620]], 'both side corridors also cover the short impact shake');
    assert.ok(commands.some(command => command.key === 'fillRect' && command.args[0] === -112 && command.args[2] === 112));
    assert.ok(commands.some(command => command.key === 'fillRect' && command.args[0] === 1000 && command.args[2] === 112));
    assert.equal(commands.some(command => command.key === 'fillText' || command.key === 'scale'), false, 'the extension paints no enlarged spectators or signs');
    const blit = commands.filter(command => command.key === 'drawImage');
    assert.equal(blit.length, 1); assert.deepEqual(blit[0].args, [canvases[1], 0, 0], 'the central stadium is still drawn once at its original size and coordinates');
    const before = cachedCommands.map(output => output.length);
    drawArenaScenery(ctx, 200, { intensity: .35 });
    assert.deepEqual(cachedCommands.map(output => output.length), before, 'a paused scenery frame reuses both caches');
  } finally { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; }
});
