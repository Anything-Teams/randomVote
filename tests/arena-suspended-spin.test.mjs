import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, arenaSpinGripPair, arenaSpinSnapshot, sampleArenaFighterContacts, drawArenaFighter, drawArenaName } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const make = (index, props) => ({ candidate: { id: String(index), name: '참가자', color: '#e9a16e' }, index, scale: 2.04, facing: 1, pose: 'grapple', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: .8, motionImmediate: true, animation: createArenaFighterAnimation(), ...props });
const context = () => Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(name => [name, () => {}]));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('the hand-origin spin is independent of the scene foot target and its label follows the painted feet', () => {
  for (const side of [-1, 1]) for (const weight of [0, .4, 1]) for (const turn of [0, .25, .5, .75, 1]) {
    const orbit = (side < 0 ? Math.PI : 0) + side * turn * Math.PI * 2;
    const driver = make(0, { x: 500, y: 416, facing: side });
    const grips = arenaSpinGripPair(driver, orbit, 37_200, weight);
    const victim = make(1, { x: 540, y: 390, facing: -side, pose: 'held', gripMode: 'wrist', spinSuspension: { orbit, flatness: .94, weight, grips } });
    const original = sampleArenaFighterContacts(victim, 37_200);
    const relocated = sampleArenaFighterContacts({ ...victim, x: original.origin.x, y: original.origin.y }, 37_200);
    assert.deepEqual(relocated, original, 'feeding the visible foot root back into the scene cannot move the hand-anchored body a second time');
    const ctx = context(), labels = [];
    ctx.measureText = text => ({ width: [...text].length * 5 });
    ctx.fillText = (...args) => labels.push(args);
    drawArenaFighter(ctx, victim, 37_200); drawArenaName(ctx, victim);
    assert.equal(labels[0][1], original.origin.x);
    assert.equal(labels[0][2], original.origin.y + 10, 'the displayed name follows the actual body rather than the unused orbit layout target');
  }
});

test('the released hand-origin projection travels with the flight root and converges to the unchanged landing rig', () => {
  const driver = make(0, { x: 500, y: 416 });
  const grips = arenaSpinGripPair(driver, 4 * Math.PI, 38_200, 1);
  const held = make(1, { x: 600, y: 392, facing: -1, pose: 'held', gripMode: 'wrist', spinSuspension: { orbit: 4 * Math.PI, flatness: .94, weight: 1, grips } });
  const snapshot = arenaSpinSnapshot(held, 38_200), contacts = sampleArenaFighterContacts(held, 38_200);
  const flight = make(1, { x: snapshot.origin.x + 30, y: snapshot.origin.y - 15, facing: -1, pose: 'airborne', spinRelease: { snapshot, weight: 1 } });
  const translated = sampleArenaFighterContacts(flight, 38_200);
  for (const part of ['head', 'waist']) assert.ok(distance(translated[part], { x: contacts[part].x + 30, y: contacts[part].y - 15 }) < 1e-8);
  for (let arm = 0; arm < 2; arm++) assert.ok(distance(translated.hands[arm], { x: grips[arm].x + 30, y: grips[arm].y - 15 }) < 1e-8);
  const landing = { ...flight, x: 750, y: 510, pose: 'land', angle: -2.6, phase: 0, spinRelease: { snapshot, weight: 0 } };
  assert.deepEqual(sampleArenaFighterContacts(landing, 39_300), sampleArenaFighterContacts({ ...landing, spinRelease: undefined }, 39_300), 'a spent release snapshot cannot alter floor contact or the recovered body');
});

test('the planted driver keeps taking alternating pivot steps during the second revolution in either direction', () => {
  for (const side of [-1, 1]) {
    const driver = make(0, { x: 500, y: 416, facing: side, motionImmediate: false, motionEpoch: 1 });
    const ctx = context(), secondTurn = [[], []];
    for (let step = 0; step <= 240; step++) {
      const turn = step / 240 * Math.PI * 4;
      Object.assign(driver, { yaw: side * turn, pivotTurn: side * turn, phase: step / 240 });
      drawArenaFighter(ctx, driver, 35_400 + step * 12);
      if (turn > Math.PI * 2) driver.animation.contactPoints.feet.forEach((foot, leg) => secondTurn[leg].push({ ...foot }));
    }
    for (const points of secondTurn) {
      const width = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
      assert.ok(width > 10, `side ${side}: both heels must replant after the first full turn`);
    }
    assert.ok(driver.animation.pivotStep >= 16, 'the second circle cannot clamp at the first revolution');
    const saved = structuredClone(driver.animation);
    drawArenaFighter(ctx, driver, 35_400 + 240 * 12);
    assert.deepEqual(driver.animation, saved, 'the final pivot frame remains frozen while paused');
  }
});
