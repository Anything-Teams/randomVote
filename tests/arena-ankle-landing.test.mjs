import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/arenaAnkleLanding.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaAnkleLanding, ARENA_ANKLE_LANDING_TIMING: timing } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const quiet = { bounce: 0, rotation: 0, shake: 0, impact: 0, dust: 0, dustProgress: 0 };
const effects = ['bounce', 'rotation', 'shake', 'impact', 'dust'];

test('a noncontact or invalid age produces no landing pose, shake, impact or dust', () => {
  for (const age of [-Infinity, -1000, -1, -.001, NaN, Infinity]) {
    for (const direction of [-1, 1, NaN]) assert.deepEqual(arenaAnkleLanding(age, direction), quiet);
  }
  const contact = arenaAnkleLanding(0, 1);
  assert.deepEqual(contact, { ...quiet, impact: 1, dust: 1 });
  for (const age of [450, 451, 5000, Number.MAX_VALUE]) {
    const settled = arenaAnkleLanding(age, 1);
    effects.forEach(field => assert.equal(settled[field], 0, `${field} is finished after settling`));
    assert.equal(settled.dustProgress, 1, 'the cloud keeps its completed expansion while its zero opacity disables painting');
  }
});

test('the ground impact rebounds once in 150 ms and returns with zero endpoint speed', () => {
  assert.equal(timing.recoil, 150);
  assert.equal(arenaAnkleLanding(0, 1).bounce, 0);
  assert.equal(arenaAnkleLanding(75, 1).bounce, 7);
  assert.equal(arenaAnkleLanding(75, 1).rotation, .10);
  assert.equal(arenaAnkleLanding(150, 1).bounce, 0);
  let previous = 0;
  for (let age = 0; age <= 75; age++) {
    const current = arenaAnkleLanding(age, 1).bounce;
    assert.ok(current >= previous && current <= 7, 'one rebound rises continuously to its peak');
    previous = current;
  }
  for (let age = 76; age <= 150; age++) {
    const current = arenaAnkleLanding(age, 1).bounce;
    assert.ok(current <= previous && current >= 0, 'the body settles after that same rebound rather than bouncing again');
    previous = current;
  }
  const epsilon = .001;
  for (const field of ['bounce', 'rotation']) {
    assert.ok(Math.abs(arenaAnkleLanding(epsilon, 1)[field] / epsilon) < .00001, 'the ground reaction begins without a positional impulse');
    assert.ok(Math.abs(arenaAnkleLanding(150 - epsilon, 1)[field] / epsilon) < .00001, 'the final grounded pose has no leftover velocity');
  }
});

test('mirrored landings retain the same mass rebound and reverse only the directional rotation and shake', () => {
  for (let age = 0; age <= 500; age++) {
    const right = arenaAnkleLanding(age, 1), left = arenaAnkleLanding(age, -1);
    for (const field of ['bounce', 'impact', 'dust', 'dustProgress']) assert.equal(left[field], right[field]);
    assert.ok(left.rotation === -right.rotation); assert.ok(left.shake === -right.shake);
    assert.deepEqual(arenaAnkleLanding(age, 17), right, 'direction is normalized instead of multiplying the physical reaction');
    assert.deepEqual(arenaAnkleLanding(age, -17), left);
    for (const direction of [0, NaN, Infinity]) {
      const neutral = arenaAnkleLanding(age, direction);
      assert.equal(Math.abs(neutral.rotation), 0); assert.equal(Math.abs(neutral.shake), 0);
      for (const field of ['bounce', 'impact', 'dust', 'dustProgress']) assert.equal(neutral[field], right[field]);
    }
  }
});

test('impact fades quickly while the sand expands in actual milliseconds and clears within 450 ms', () => {
  assert.equal(timing.impact, 180); assert.equal(timing.dust, 450);
  assert.equal(arenaAnkleLanding(0, 1).impact, 1);
  assert.ok(arenaAnkleLanding(60, 1).impact < .3, 'the contact flash loses most of its strength promptly');
  assert.equal(arenaAnkleLanding(180, 1).impact, 0);
  assert.ok(arenaAnkleLanding(180, 1).dustProgress > .75 && arenaAnkleLanding(180, 1).dustProgress < 1, 'the sand cloud expands rapidly before dissipating');
  assert.ok(arenaAnkleLanding(400, 1).dust < .02);
  let previous = arenaAnkleLanding(0, 1);
  for (let age = 1; age <= 450; age++) {
    const current = arenaAnkleLanding(age, 1);
    assert.ok(current.impact <= previous.impact && current.dust <= previous.dust);
    assert.ok(current.dustProgress >= previous.dustProgress);
    previous = current;
  }
});

test('the brief shake alternates direction with a shrinking envelope and is fully settled by 150 ms', () => {
  assert.equal(arenaAnkleLanding(0, 1).shake, 0); assert.equal(arenaAnkleLanding(150, 1).shake, 0);
  const peaks = [12.5, 37.5, 62.5, 87.5, 112.5, 137.5].map(age => arenaAnkleLanding(age, 1).shake);
  peaks.forEach((value, index) => {
    assert.ok(value * (index % 2 ? -1 : 1) > 0, 'the short sand impact rings in alternating directions');
    if (index) assert.ok(Math.abs(value) < Math.abs(peaks[index - 1]), 'each oscillation loses strength');
  });
  for (const step of [16, 50]) {
    let previous = arenaAnkleLanding(0, 1);
    for (let age = step; age <= 500; age += step) {
      const current = arenaAnkleLanding(age, 1);
      assert.ok(Math.abs(current.bounce - previous.bounce) <= 7);
      assert.ok(Math.abs(current.rotation - previous.rotation) <= .1);
      assert.ok(Math.abs(current.shake - previous.shake) <= 9, 'bounded shake cannot carry a landing into a persistent camera displacement');
      previous = current;
    }
  }
});

test('sampling depends only on the paused or resumed contact age and stays finite and bounded', () => {
  const paused = arenaAnkleLanding(75, -1);
  for (let sample = 0; sample < 20; sample++) {
    arenaAnkleLanding(15 * sample, 1);
    assert.deepEqual(arenaAnkleLanding(75, -1), paused, 'other samples cannot advance a paused landing');
  }
  paused.bounce = -100;
  assert.equal(arenaAnkleLanding(75, -1).bounce, 7, 'callers cannot mutate the later pose through a shared result');
  for (let age = 0; age <= 500; age += .5) {
    const frame = arenaAnkleLanding(age, -1);
    assert.ok(Object.values(frame).every(Number.isFinite));
    assert.ok(frame.bounce >= 0 && frame.bounce <= 7);
    assert.ok(Math.abs(frame.rotation) <= .1 && Math.abs(frame.shake) <= 4.5);
    for (const field of ['impact', 'dust', 'dustProgress']) assert.ok(frame[field] >= 0 && frame[field] <= 1);
  }
});
