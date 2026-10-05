import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { drawArenaFighter, createArenaFighterAnimation } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const actor = values => ({ candidate: { id: 'run', name: '달리는 선수', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'run', angle: 0, phase: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, animation: createArenaFighterAnimation(), ...values });
function paint(body, clock) {
  const noop = () => {}, rotations = [], ctx = new Proxy({ rotate(angle) { rotations.push(angle); } }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
  drawArenaFighter(ctx, body, clock);
  const skeleton = structuredClone(body.animation.skeleton), contacts = structuredClone(body.animation.contactPoints), feet = structuredClone(body.animation.feet);
  for (let leg = 0; leg < 2; leg++) {
    const thigh = distance(skeleton.hips[leg], skeleton.knees[leg]), shin = distance(skeleton.knees[leg], skeleton.feet[leg]);
    const depth = Math.max(Math.abs(body.velocityY) / Math.max(1, Math.hypot(body.velocityX, body.velocityY)), body.animation.depthStride ?? 0);
    const minimum = depth > .5 ? 2.5 : 6;
    assert.ok(thigh <= 11.001 && shin <= 11.001 && thigh > minimum && shin > minimum, `depth projection may shorten the visible bend but neither normal leg bone stretches or collapses: ${JSON.stringify({ clock, leg, thigh, shin, vx: body.velocityX, vy: body.velocityY, foot: feet[leg], hip: skeleton.hips[leg], knee: skeleton.knees[leg], ankle: skeleton.feet[leg] })}`);
    assert.ok(Number.isFinite(skeleton.footAngles[leg]) && Math.abs(skeleton.footAngles[leg]) < .35, 'ankle flex is small rather than a detached spinning foot');
    assert.ok(rotations.some(angle => Math.abs(angle - skeleton.footAngles[leg]) < 1e-8), 'the actual painted foot uses the recorded ankle angle');
  }
  return { skeleton, contacts, feet };
}

test('running recovery flexes the ankles while actual support heels stay fixed in four directions', () => {
  for (const [vx, vy] of [[190, 0], [-190, 0], [0, -190], [0, 190], [134, -134], [-134, 134]]) for (const facing of vx ? [Math.sign(vx)] : [-1, 1]) for (const step of [16, 50]) {
    const body = actor({ facing, velocityX: vx, velocityY: vy });
    let previous, toePointFrames = 0, heelReachFrames = 0, plantedFrames = 0, maxDepthLift = 0;
    for (let clock = 0; clock <= 1600; clock += step) {
      body.x = 500 + vx * clock / 1000; body.y = 416 + vy * clock / 1000; body.depthY = body.y; body.gaitDistance = Math.hypot(vx, vy) * clock / 1000;
      const frame = paint(body, clock);
      frame.feet.forEach((foot, leg) => {
        const angle = frame.skeleton.footAngles[leg];
        if (angle > .08) toePointFrames++;
        if (angle < -.025) heelReachFrames++;
        if (!foot.swinging && foot.lift < .001) {
          assert.equal(angle, 0, 'a real supporting sole remains flat');
          assert.ok(distance(frame.contacts.feet[leg], { x: foot.ground.x, y: foot.ground.y - body.scale * 2 }) < .001, 'normal leg reach does not drag a planted heel with the moving torso');
          if (previous && !previous.feet[leg].swinging && previous.feet[leg].lift < .001) assert.ok(distance(frame.contacts.feet[leg], previous.contacts.feet[leg]) < .001, 'the same material support heel stays at its world planting point');
          plantedFrames++;
        }
        if (vy && !vx) maxDepthLift = Math.max(maxDepthLift, foot.lift);
      });
      previous = frame;
    }
    assert.ok(toePointFrames > 2 && heelReachFrames > 1 && plantedFrames > 5, `the run exercises push-off, foot recovery, heel preparation and actual support: ${JSON.stringify({ vx, vy, facing, step, toePointFrames, heelReachFrames, plantedFrames })}`);
    if (vy && !vx) assert.ok(maxDepthLift > 2.1, 'even at 20fps, running into depth lifts its recovery foot higher than the walking step');
  }
});

test('a full rushing run uses a brief support compression rather than a sustained seated stance', () => {
  for (const [vx, vy] of [[165, 0], [-165, 0], [0, -165], [0, 165]]) for (const facing of vx ? [Math.sign(vx)] : [-1, 1]) for (const step of [16, 50]) {
    const body = actor({ facing, velocityX: vx, velocityY: vy, chargeStrength: 1 });
    let previous, supportFrames = 0;
    for (let clock = 0; clock <= 1200; clock += step) {
      body.x = 500 + vx * clock / 1000; body.y = 416 + vy * clock / 1000; body.depthY = body.y; body.gaitDistance = Math.hypot(vx, vy) * clock / 1000;
      const frame = paint(body, clock);
      assert.ok(body.animation.motion.crouch <= 3.41, 'the rushing pelvis does not remain lowered into the former 6px sitting posture');
      assert.ok(body.animation.supportHip.y + 20 < 3.5, `the actual painted pelvis stays above the seated compression even when its support heel approaches full reach: ${JSON.stringify({ vx, vy, step, clock, hip: body.animation.supportHip })}`);
      for (let leg = 0; leg < 2; leg++) {
        const hip = frame.skeleton.hips[leg], joint = frame.skeleton.knees[leg], foot = frame.skeleton.feet[leg];
        const upper = { x: hip.x - joint.x, y: hip.y - joint.y }, lower = { x: foot.x - joint.x, y: foot.y - joint.y };
        const cosine = (upper.x * lower.x + upper.y * lower.y) / (Math.hypot(upper.x, upper.y) * Math.hypot(lower.x, lower.y));
        if (!vy) assert.ok(Math.acos(Math.max(-1, Math.min(1, cosine))) < Math.PI * .86, 'a side-on rushing knee remains softly bent instead of repeatedly locking straight');
        const hem = frame.skeleton.shorts[leg].slice(2, 4);
        assert.ok(hem.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), 'the moving trouser cuffs stay connected to finite thigh geometry');
      }
      for (let leg = 0; leg < 2; leg++) if (!frame.feet[leg].swinging && frame.feet[leg].lift < .001) {
        assert.equal(frame.skeleton.footAngles[leg], 0);
        if (previous && !previous.feet[leg].swinging && previous.feet[leg].lift < .001) assert.ok(distance(frame.contacts.feet[leg], previous.contacts.feet[leg]) < .001, 'the rush pushes against its same material support heel');
        supportFrames++;
      }
      previous = frame;
    }
    assert.ok(supportFrames > 5, 'the rushing action includes normal weight-bearing steps');
  }
});

test('the final running feet enter the scoop preparation without stretching or reverting to an earlier plant', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const body = actor({ facing, velocityX: facing * 190 });
    let frame;
    for (let clock = 0; clock <= 640; clock += step) {
      body.x = 500 + facing * 190 * clock / 1000; body.gaitDistance = 190 * clock / 1000;
      frame = paint(body, clock);
    }
    const stop = { x: body.x, y: body.y }, before = frame;
    Object.assign(body, { pose: 'scoopslam', velocityX: 0, scoopLoad: 0, scoopLift: 0, scoopTurn: 0, scoopDown: 0 });
    for (let elapsed = step; elapsed <= 320; elapsed += step) {
      body.scoopLoad = Math.min(1, elapsed / 300);
      const next = paint(body, 640 + elapsed);
      assert.equal(body.animation.moving, false);
      next.contacts.feet.forEach((foot, leg) => {
        assert.ok(distance(foot, frame.contacts.feet[leg]) < 8 + step * .4, 'deceleration plants the real last running foot without a new distant stride');
        assert.ok(Math.abs(foot.x - stop.x) < 55, 'the receiving stance stays within normal reach of the stopped pelvis');
      });
      frame = next;
    }
    assert.ok(before.feet.some(foot => foot.swinging), 'the fixture exercises a real unfinished running step');
    assert.ok(frame.feet.every(foot => foot.lift < .001), 'both recovery feet reach the sand for the planted scoop load');
  }
});

test('a charge keeps full-height supporting legs through acceleration, braking and reversals in every heading', () => {
  const headings = [[165, 0], [-165, 0], [0, 165], [0, -165], [117, 117], [-117, 117], [117, -117], [-117, -117]];
  for (const [vx, vy] of headings) for (const step of [16, 50]) {
    const body = actor({ pose: 'guard', facing: vx < 0 ? -1 : 1 });
    let previousClock = 0, supportFrames = 0, turns = 0;
    for (let clock = 0; clock <= 3500; clock += step) {
      const amount = clock < 400 ? 0 : clock < 1000 ? (clock - 400) / 600 : clock < 1400 ? 1
        : clock < 1700 ? (1700 - clock) / 300 : clock < 1900 ? 0 : clock < 2400 ? -(clock - 1900) / 500
          : clock < 3000 ? -1 : 0;
      const sideTurn = clock >= 3000 ? (clock - 3000) / 500 : 0;
      body.pose = clock < 400 ? 'guard' : 'run';
      body.chargePreparation = clock < 400 ? clock / 400 : 0;
      body.chargeStrength = clock < 400 ? 0 : 1;
      body.velocityX = vx * amount - vy * sideTurn; body.velocityY = vy * amount + vx * sideTurn;
      body.x += body.velocityX * (clock - previousClock) / 1000;
      body.y += body.velocityY * (clock - previousClock) / 1000;
      body.depthY = body.y;
      body.gaitDistance += Math.hypot(body.velocityX, body.velocityY) * (clock - previousClock) / 1000;
      if (Math.abs(body.velocityX) > 5) body.facing = Math.sign(body.velocityX);
      const frame = paint(body, clock);
      const detail = `${vx}/${vy}/${step}ms/${clock}ms`;
      assert.ok(body.animation.supportHip.y + 20 < 4, `the actual support pelvis remains upright when a stopped or reversed charge resumes: ${detail}/${body.animation.supportHip.y + 20}`);
      for (let leg = 0; leg < 2; leg++) if (!frame.feet[leg].swinging && frame.feet[leg].lift < .001) {
        supportFrames++;
        assert.equal(frame.skeleton.footAngles[leg], 0, 'a braking support sole stays flat');
        const heel = { x: frame.feet[leg].ground.x, y: frame.feet[leg].ground.y - body.scale * 2 };
        assert.ok(distance(frame.contacts.feet[leg], heel) < .001, 'changing direction does not move a material supporting heel');
      }
      if (clock >= 1900 && clock < 2400) turns++;
      previousClock = clock;
    }
    assert.ok(supportFrames > 10 && turns > 5, `the regression includes real material support and a restarted reverse charge: ${vx}/${vy}/${step}ms`);
  }
});
