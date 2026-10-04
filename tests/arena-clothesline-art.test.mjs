import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts', 'src/arenaLinkedRush.ts'], bundle: true, format: 'esm', platform: 'node', write: false, outdir: 'out' });
const modules = await Promise.all(bundled.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)));
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = modules[0];
const { arenaLinkedRushTargets } = modules[1];
const actor = values => ({ candidate: { id: 'a', name: 'a', color: '#ffad72' }, index: 0, x: 500, y: 416, scale: 2.04, facing: 1, pose: 'run', angle: 0, alpha: 1, velocityX: 0, velocityY: -162, gaitDistance: 0, phase: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));

test('two separate clothesline arms reach the actual neck and upper chest with complete ordinary bones', () => {
  for (const entry of [-1, 1]) for (const reversed of [false, true]) for (let index = 0; index < 10; index++) {
    const victim = actor({ pose: 'guard', index: (index + 2) % 10, velocityY: 0 });
    const victimRig = sampleArenaFighterContacts(victim, 1000), neck = { x: victimRig.head.x, y: victimRig.head.y + 20 * victim.scale };
    const origins = { pair: reversed ? [{ x: 590, y: 416 - entry * 66 }, { x: 410, y: 416 - entry * 66 }] : [{ x: 410, y: 416 - entry * 66 }, { x: 590, y: 416 - entry * 66 }], victim: { x: 500, y: 416 }, neck };
    const window = { start: 1000, end: 9000 }, initial = arenaLinkedRushTargets(window, 1000, origins.victim, origins);
    const pair = origins.pair.map((point, member) => actor({ index: (index + member) % 10, ...point, clotheslineArm: initial.clotheslineArms[member] }));
    origins.shoulderOffsets = pair.map(runner => {
      const shoulder = sampleArenaFighterContacts(runner, 1000).shoulders[runner.clotheslineArm];
      return { x: shoulder.x - runner.x, y: shoulder.y - runner.y };
    });
    const plan = arenaLinkedRushTargets(window, 1000, origins.victim, origins), hit = arenaLinkedRushTargets(window, plan.contactAt, origins.victim, origins);
    pair.forEach((runner, member) => {
      Object.assign(runner, hit.pair[member], { clotheslineTarget: hit.strikeHands[member], clotheslineStrength: 1, velocityY: hit.direction.y * 162 });
      drawArenaFighter(ctx, runner, hit.contactAt);
      const rig = runner.animation.contactPoints, arm = runner.clotheslineArm;
      assert.ok(distance(rig.hands[arm], hit.strikeTargets[member]) < 1e-8, 'each painted arm reaches its own distinct neck/chest point');
      assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * runner.scale) < .001);
      assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * runner.scale) < .001);
      assert.ok(distance(rig.shoulders[arm], rig.hands[arm]) > 40, 'the striking arm is nearly straight across the upper body');
      assert.ok(distance(rig.hands[1 - arm], rig.hands[arm]) > 25, 'the free arm stays available for running balance');
      assert.equal(runner.linkedArm, undefined);
      assert.equal(runner.linkedHandTarget, undefined);
    });
    assert.ok(distance(pair[0].animation.contactPoints.hands[pair[0].clotheslineArm], pair[1].animation.contactPoints.hands[pair[1].clotheslineArm]) > 12, 'the two palms cannot form a hand-holding rope');
  }
});

test('a clothesline preserves alternating running steps and free-arm movement while the other arm stays extended', () => {
  for (const direction of [-1, 1]) for (const clotheslineArm of [0, 1]) {
    const runner = actor({ x: 450, y: 416, clotheslineArm, clotheslineStrength: 1, motionImmediate: false, velocityY: direction * 162 });
    let previous = [false, false], swings = [0, 0];
    const freeHands = [];
    for (let frame = 0; frame <= 100; frame++) {
      runner.y += direction * 162 * .016; runner.gaitDistance += 162 * .016;
      const shoulder = sampleArenaFighterContacts({ ...runner, clotheslineTarget: undefined }, 1000 + frame * 16).shoulders[clotheslineArm];
      runner.clotheslineTarget = { x: shoulder.x + (clotheslineArm ? 41 : -41), y: shoulder.y };
      drawArenaFighter(ctx, runner, 1000 + frame * 16);
      const rig = runner.animation.contactPoints;
      assert.ok(distance(rig.hands[clotheslineArm], runner.clotheslineTarget) < .001);
      assert.equal(runner.animation.airborne, false);
      for (let leg = 0; leg < 2; leg++) {
        if (runner.animation.feet[leg].swinging && !previous[leg]) swings[leg]++;
        previous[leg] = runner.animation.feet[leg].swinging;
      }
      freeHands.push({ x: rig.hands[1 - clotheslineArm].x - runner.x, y: rig.hands[1 - clotheslineArm].y - runner.y });
    }
    assert.ok(swings.every(count => count >= 3), 'both soles keep taking normal depthward running steps');
    assert.ok(Math.max(...freeHands.map(point => point.x)) - Math.min(...freeHands.map(point => point.x)) > 12, 'the non-striking arm moves with the gait instead of freezing beside the torso');
  }
});
