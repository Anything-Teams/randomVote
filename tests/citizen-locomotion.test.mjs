import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/game/citizenLocomotion.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { advanceCountingRunner, countingRunnerTarget, citizenStride, citizenLegAngles } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

test('counting runners never retreat as shares change or the remaining-candidate average changes', () => {
  for (let count = 2; count <= 10; count++) {
    const runner = { x: 284, velocity: 0 };
    let previousX = runner.x, previousVelocity = 0;
    for (let frame = 0; frame <= 3200; frame++) {
      const progress = Math.min(96, frame / 32), average = 100 / Math.max(2, count - Math.floor(frame / 1200));
      const share = average + Math.sin(frame / 57) * 1.9;
      advanceCountingRunner(runner, countingRunnerTarget(progress, share, average), .016);
      assert.ok(runner.x >= previousX && runner.x <= 753);
      assert.ok(runner.velocity >= 0 && runner.velocity <= 150);
      assert.ok(Math.abs(runner.velocity - previousVelocity) <= 180 * .016 + 1e-8);
      previousX = runner.x; previousVelocity = runner.velocity;
    }
  }
});

test('a falling share retains forward momentum and settles with bounded deceleration', () => {
  const runner = { x: 284, velocity: 0 };
  for (let frame = 0; frame < 60; frame++) advanceCountingRunner(runner, 650, .016);
  assert.ok(runner.velocity > 100);
  for (let frame = 0; frame < 300; frame++) {
    const previousX = runner.x, previousVelocity = runner.velocity;
    advanceCountingRunner(runner, 300, .016);
    assert.ok(runner.x >= previousX && runner.x <= 650);
    assert.ok(Math.abs(runner.velocity - previousVelocity) <= 180 * .016 + 1e-8);
  }
  assert.ok(Math.abs(runner.x - 650) < 1e-6);
  assert.equal(runner.velocity, 0);
});

function legEndpoint(angles, hip, lean, bob) {
  const upper = angles.upper * Math.PI / 180, lower = (angles.upper + angles.lower) * Math.PI / 180;
  const local = { x: hip.x - Math.sin(upper) * 7 - Math.sin(lower) * 6.5, y: hip.y + Math.cos(upper) * 7 + Math.cos(lower) * 6.5 };
  const angle = lean * Math.PI / 180;
  return { x: local.x * Math.cos(angle) - local.y * Math.sin(angle), y: local.x * Math.sin(angle) + local.y * Math.cos(angle) + bob };
}

test('planted feet hold the floor while the counting runner advances, including tilted bodies', () => {
  for (const running of [false, true]) for (let index = 0; index < 4; index++) {
    let previous;
    for (let distance = 24; distance < 144; distance += .04) {
      const stride = citizenStride(distance, index, running), lean = running ? 5.5 : 2;
      const feet = stride.feet.map((foot, leg) => {
        const hip = { x: leg ? 4 : -5, y: -14 }, target = { x: hip.x + foot.x, y: foot.y };
        const endpoint = legEndpoint(citizenLegAngles(target, hip, lean, stride.bounce), hip, lean, stride.bounce);
        assert.ok(Math.hypot(endpoint.x - target.x, endpoint.y - target.y) < .05, `leg cannot reach its planted point: ${running}, ${index}`);
        return { ...endpoint, x: endpoint.x + distance, planted: foot.planted };
      });
      if (previous) feet.forEach((foot, leg) => {
        if (foot.planted && previous[leg].planted) assert.ok(Math.abs(foot.x - previous[leg].x) < .001, 'support foot slides over floor');
      });
      previous = feet;
    }
  }
});

test('the walk-to-run transition keeps both feet continuous as speed rises', () => {
  for (let index = 0; index < 4; index++) {
    let previous;
    for (let frame = 0; frame <= 1000; frame++) {
      const stride = citizenStride(24 + frame * .05, index, Math.min(1, frame / 200));
      if (previous) stride.feet.forEach((foot, leg) => assert.ok(Math.hypot(foot.x - previous.feet[leg].x, foot.y - previous.feet[leg].y) < .25));
      previous = stride;
    }
  }
});
