import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaMove, arenaRanks, arenaRounds, arenaThrow } = await source('src/arenaLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter } = await source('src/game/ArenaFighter.ts');
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fighter = (pose = 'walk', index = 0) => ({ candidate: { id: 'body', name: '선수', color: '#ffad72' }, index, x: 500, y: 425, scale: 2.04, facing: 1, pose, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, animation: createArenaFighterAnimation() });
const worldFoot = (body, leg) => ({ x: body.x + body.animation.skeleton.feet[leg].x * body.scale * body.facing, y: body.y + body.animation.skeleton.feet[leg].y * body.scale });

test('tumbling legs keep two full connected segments and both knees fold forward together', () => {
  for (const index of [0, 1, 2, 3]) for (const facing of [-1, 1]) for (const pose of ['airborne', 'roll', 'land', 'recover', 'stunned']) for (const angle of [0, .7, 1.5, 2.7, 4.8]) {
    const body = { ...fighter(pose, index), facing, angle, phase: .35 };
    drawArenaFighter(ctx, body, 0);
    const { hips, knees, feet, shorts } = body.animation.skeleton;
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .01);
      assert.ok(Math.abs(distance(knees[leg], feet[leg]) - 11) < .01);
      assert.ok(knees[leg].x >= (hips[leg].x + feet[leg].x) / 2, 'both anatomical knees bend forward during a tumble');
      assert.ok(shorts[leg].every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    }
    assert.ok(Math.abs(knees[1].x - knees[0].x) < 12, 'the folded legs remain parallel instead of bowing away from each other');
    if (pose === 'roll') {
      assert.ok(feet.every((foot, leg) => distance(hips[leg], foot) < 7), 'a floor roll tucks the legs instead of stretching into a cartwheel');
      assert.ok(body.animation.motion.backY <= -22 && body.animation.motion.frontY <= -22, 'arms protect the chest during the floor roll');
    }
  }
});

test('a hooked ankle and an airborne side kick put the rendered foot at the actual world contact', () => {
  for (const facing of [-1, 1]) for (const pose of ['trip', 'sidekick']) {
    const target = { x: 500 + facing * (pose === 'trip' ? 38 : 42), y: pose === 'trip' ? 423 : 383 };
    const body = { ...fighter(pose), facing, y: pose === 'trip' ? 425 : 401, depthY: 425, footTarget: target, footStrength: 1, kickLeg: 1, phase: .8 };
    drawArenaFighter(ctx, body, 0);
    assert.ok(distance(body.animation.contactPoints.feet[1], target) < .001, 'the foot uses the same origin and projection as the body');
  }
});

test('the two side-kick hops have a real planted sole between their airborne poses', () => {
  const body = { ...fighter('sidekick'), depthY: 425, phase: .6, footStrength: 0 };
  for (let at = 0; at <= 160; at += 16) {
    body.y = 425 - 22 * (1 - at / 160);
    drawArenaFighter(ctx, body, at);
  }
  assert.ok(body.animation.skeleton.feet.every(foot => Math.abs(foot.y) < .001), 'both soles come down to the standing plane before the next push-off');
  assert.ok(body.animation.contactPoints.feet.every(foot => Math.abs(foot.y + 2 * body.scale - body.depthY) < .001));
});

// Unlike a single straight path, this reproduces old footholds left behind at an upward turn.
test('sideways, upward and downward direction changes preserve support heels and reachable legs', () => {
  const targets = [{ x: 620, y: 425 }, { x: 620, y: 350 }, { x: 565, y: 440 }, { x: 435, y: 410 }];
  for (const index of [0, 1, 2, 3]) {
    const body = fighter('walk', index), motor = { x: body.x, y: body.y, facing: 1 };
    drawArenaFighter(ctx, body, 0);
    let plantedFrames = 0;
    for (let at = 16; at <= 6000; at += 16) {
      const before = { ...motor };
      arenaMove(motor, targets[Math.floor(at / 1500) % 4], .016, 120);
      body.x = motor.x; body.y = motor.y; body.facing = motor.facing;
      body.velocityX = (motor.x - before.x) / .016; body.velocityY = (motor.y - before.y) / .016;
      body.gaitDistance += distance(before, motor); body.pose = at > 4000 && at < 5000 ? 'grapple' : 'walk';
      drawArenaFighter(ctx, body, at);
      const rig = body.animation.skeleton;
      for (let leg = 0; leg < 2; leg++) {
        assert.ok(distance(rig.hips[leg], rig.knees[leg]) <= 11.01);
        assert.ok(distance(rig.knees[leg], rig.feet[leg]) <= 11.01);
        const memory = body.animation.feet[leg];
        if (!memory.swinging && memory.lift === 0) {
          assert.ok(distance(worldFoot(body, leg), memory.ground) < .001, 'leg reach cannot pull a planted heel away from its world anchor');
          plantedFrames++;
        }
      }
    }
    assert.ok(plantedFrames > 200, 'the test includes many actual supporting steps');
  }
});

test('a sudden sideways-to-upward turn takes a new step instead of collapsing the pelvis', () => {
  for (const index of [0, 1, 2, 3]) {
    const body = fighter('walk', index);
    let previousHip;
    for (let at = 0; at < 6000; at += 16) {
      const velocity = at < 2200 ? [120, 0] : at < 4000 ? [0, -120] : [-100, 80];
      body.velocityX = velocity[0]; body.velocityY = velocity[1];
      body.x += velocity[0] * .016; body.y += velocity[1] * .016;
      if (velocity[0]) body.facing = Math.sign(velocity[0]);
      body.gaitDistance += Math.hypot(...velocity) * .016;
      drawArenaFighter(ctx, body, at);
      const hip = body.animation.supportHip;
      assert.ok(hip.y < -15, `ordinary travel must not turn into a seated pose: ${index}/${at}/${hip.y}`);
      if (previousHip) assert.ok(hip.y - previousHip.y < .7, 'planting a heel cannot abruptly drop the torso');
      previousHip = { ...hip };
    }
  }
});

test('turning toward an opponent swaps hip and foot pairing without crossing the two planted legs', () => {
  for (const pose of ['grapple', 'brace', 'push']) {
    const body = fighter(pose);
    drawArenaFighter(ctx, body, 0);
    const original = body.animation.feet.map(foot => ({ ...foot.ground }));
    const memory = [...body.animation.feet];
    body.facing = -1;
    drawArenaFighter(ctx, body, 16);
    assert.equal(body.animation.feet[0], memory[1]); assert.equal(body.animation.feet[1], memory[0]);
    assert.ok(body.animation.skeleton.feet[0].x < 0 && body.animation.skeleton.feet[1].x > 0, `${pose}: a turn must not make X-shaped legs`);
    assert.ok(distance(worldFoot(body, 0), original[1]) < .001);
    assert.ok(distance(worldFoot(body, 1), original[0]) < .001);
    body.facing = 1;
    drawArenaFighter(ctx, body, 32);
    assert.ok(distance(worldFoot(body, 0), original[0]) < .001);
    assert.ok(distance(worldFoot(body, 1), original[1]) < .001);
  }
});

test('lifting loads the hips, drives upward and follows the release with a visible torso swing', () => {
  const body = fighter('lift'); body.gripTarget = { x: 536, y: 345 };
  drawArenaFighter(ctx, body, 0);
  const load = { ...body.animation.motion }, soles = body.animation.feet.map(foot => ({ ...foot.ground }));
  assert.ok(load.crouch > 6 && load.lean > 10 && load.hipX < -1);
  for (let at = 16; at <= 960; at += 16) {
    body.phase = at / 960;
    drawArenaFighter(ctx, body, at);
    for (let leg = 0; leg < 2; leg++) assert.ok(distance(worldFoot(body, leg), soles[leg]) < .001, 'the lift drives through grounded feet');
  }
  const raised = { ...body.animation.motion };
  assert.ok(raised.crouch < 2 && raised.hipX > 1.9 && raised.lean < -8);
  body.pose = 'throw'; body.gripTarget = undefined;
  for (let age = 16; age <= 352; age += 16) {
    body.phase = Math.min(1, age / 350);
    drawArenaFighter(ctx, body, 960 + age);
    for (let leg = 0; leg < 2; leg++) assert.ok(distance(worldFoot(body, leg), soles[leg]) < .001, 'release follow-through cannot drag the support heels');
  }
  assert.ok(body.animation.motion.lean > 10, 'the shoulders follow the released opponent forward');
  assert.ok(body.animation.motion.hipX > raised.hipX + .9);
  const release = arenaThrow(0, { x: 526, y: 425 }, { x: 885, y: 436 }, 1, 1, { lift: 42, angle: -.18 });
  const leaving = arenaThrow(40, { x: 526, y: 425 }, { x: 885, y: 436 }, 1, 1, { lift: 42, angle: -.18 });
  assert.equal(release.height, 42); assert.equal(leaving.height, release.height);
  assert.equal(leaving.groundX, release.groundX); assert.equal(leaving.angle, release.angle);
  assert.equal(arenaThrow(64, { x: 526, y: 425 }, { x: 885, y: 436 }).stage, 'flight', 'the released body cannot hang in place through the follow-through');
});

test('alliances retain the base stories with a reduced bonus chance and remain one surprise per large field', () => {
  let eligible = 0, before = 0, after = 0;
  for (let variation = 0; variation < 1200; variation++) {
    const order = Array.from({ length: 8 }, (_, i) => `support-${variation}-${i}`);
    const seed = order.join('|').split('').reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0);
    const oldAlliance = seed % 3 === 0, alliances = arenaRounds(order).filter(bout => ['team', 'betrayal'].includes(bout.tactic));
    eligible++; if (oldAlliance) before++; if (alliances.length) after++;
    if (oldAlliance) assert.equal(alliances.length, 1, 'previous rare alliance stories remain available');
    assert.ok(alliances.length <= 1);
    assert.deepEqual(arenaRanks(order, 44000), Object.fromEntries(order.map((id, i) => [id, i + 1])));
    const small = arenaRounds(order.slice(0, 4));
    assert.ok(small.every(bout => !['team', 'betrayal'].includes(bout.tactic)));
  }
  const added = (after - before) / eligible;
  assert.ok(added >= .004 && added <= .02, `the reduced bonus adds about one percentage point, got ${added}`);
  assert.ok(after / eligible < .45, 'alliances cannot become the usual story');
});
