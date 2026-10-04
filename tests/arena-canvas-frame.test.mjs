import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['src/arenaCanvasFrame.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { presentArenaCanvasFrame } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
function canvas() {
  let width = 0, height = 0, state = 0;
  const ctx = { published: [], globalAlpha: 1, globalCompositeOperation: 'source-over', save() { state++; }, restore() { state--; }, setTransform() {}, drawImage(image) { this.published.push(image); } };
  return { get width() { return width; }, set width(value) { width = value; state = 0; }, get height() { return height; }, set height(value) { height = value; state = 0; }, getContext() { return ctx; }, ctx, state: () => state };
}

test('an interrupted shared throw preserves the complete displayed frame and can recover on the next frame', () => {
  const display = canvas(), buffer = canvas();
  assert.deepEqual(presentArenaCanvasFrame(display, buffer, 1000, 620, () => 'stadium'), { ok: true, value: 'stadium' });
  const failed = presentArenaCanvasFrame(display, buffer, 800, 496, ctx => { ctx.save(); throw new Error('contact unavailable'); });
  assert.equal(failed.ok, false);
  assert.equal(display.ctx.published.length, 1, 'the failed scene never replaces the last visible stadium');
  assert.equal(display.width, 1000, 'even a pending viewport resize must wait for a valid frame');
  assert.equal(buffer.state(), 0, 'an interrupted clip cannot poison later rendering');
  assert.deepEqual(presentArenaCanvasFrame(display, buffer, 800, 496, () => 'next contact'), { ok: true, value: 'next contact' });
  assert.equal(display.ctx.published.length, 2);
  assert.equal(display.width, 800); assert.equal(display.height, 496);
  assert.equal(display.state(), 0); assert.equal(buffer.state(), 0);
});
