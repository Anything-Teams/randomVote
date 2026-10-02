import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const fighter = overrides => ({ candidate: { id: 'fighter', name: '선수', color: '#ffad72' }, index: 1, x: 500, y: 416, depthY: 416, scale: 2.04, facing: -1, pose: 'carried', angle: Math.PI / 2, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const parts = contacts => [contacts.head, contacts.waist, ...contacts.hands, ...contacts.feet];

test('the carried body unfolds both arms beyond its head and straightens both complete legs', () => {
  for (const side of [-1, 1]) {
    const source = fighter({ angle: side * Math.PI / 2, facing: -side, carryStretch: 0 });
    const stunned = { ...source, pose: 'stunned', carryStretch: undefined, animation: createArenaFighterAnimation() };
    assert.deepEqual(sampleArenaFighterContacts(source, 1000), sampleArenaFighterContacts(stunned, 1000), 'the two-person grip begins in the existing floor pose');
    const body = fighter({ angle: side * Math.PI / 2, facing: -side, carryStretch: 1, y: 304, suspension: 1 });
    drawArenaFighter(ctx, body, 2000);
    const contacts = body.animation.contactPoints, { hips, knees, feet } = body.animation.skeleton;
    assert.ok(contacts.hands.every(point => side * (point.x - contacts.head.x) > 1), 'both wrists extend beyond the head toward the arms holder');
    assert.ok(contacts.feet.every(point => side * (point.x - contacts.waist.x) < -8), 'both ankles extend from the other end of the horizontal body');
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(Math.abs(distance(hips[leg], feet[leg]) - 21.98) < .001);
      assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001);
      assert.ok(Math.abs(distance(knees[leg], feet[leg]) - 11) < .001);
    }
  }
});

test('both helpers can hold the two actual wrists and the two actual ankles above their heads', () => {
  for (const side of [-1, 1]) {
    const victim = fighter({ index: 2, angle: side * Math.PI / 2, facing: -side, carryStretch: 1, y: 279, depthY: 421, suspension: 1 });
    const contacts = sampleArenaFighterContacts(victim, 2000);
    for (const [index, facing, ends, gripMode] of [[1, -side, contacts.hands, 'wrist'], [3, side, contacts.feet, 'ankle']]) {
      const holder = fighter({ index, x: (ends[0].x + ends[1].x) / 2 - facing * 3.5 * 2.04, y: index === 1 ? 412 : 414, facing, pose: 'overhead', overheadRaise: 1, angle: 0, gripMode, gripTarget: ends[0], secondaryGripTarget: ends[1], gripStrength: 1, gripLocked: true });
      drawArenaFighter(ctx, holder, 2000);
      const held = holder.animation.contactPoints;
      assert.ok(distance(held.hands[0], ends[1]) < .001, 'the far hand actually holds the second limb');
      assert.ok(distance(held.hands[1], ends[0]) < .001, 'the near hand actually holds the first limb');
      assert.ok(held.hands.every(point => point.y < held.head.y), 'both actual holds are above the top of the carrier head');
      assert.ok(contacts.waist.y < held.head.y, 'the horizontal body is carried above each helper head');
      assert.ok(holder.animation.feet.every(foot => foot.lift === 0), 'the carrier cannot float to reach the held body');
    }
  }
});

test('the carry skeleton is continuous and independent of frame history during unfolding', () => {
  const animation = createArenaFighterAnimation();
  for (let frame = 0; frame <= 60; frame++) {
    const carryStretch = frame / 60, clock = 1000 + frame * 16;
    const live = fighter({ carryStretch, animation, motionImmediate: false });
    const saved = structuredClone(animation), predicted = sampleArenaFighterContacts(live, clock);
    assert.deepEqual(animation, saved);
    drawArenaFighter(ctx, live, clock);
    assert.deepEqual(animation.contactPoints, predicted);
    const sought = sampleArenaFighterContacts(fighter({ carryStretch }), clock);
    assert.deepEqual(predicted, sought);
  }
  for (const carryStretch of [0, .5, 1]) {
    const a = sampleArenaFighterContacts(fighter({ carryStretch: Math.max(0, carryStretch - .000001) }), 1500);
    const b = sampleArenaFighterContacts(fighter({ carryStretch: Math.min(1, carryStretch + .000001) }), 1500);
    parts(a).forEach((point, index) => assert.ok(distance(point, parts(b)[index]) < .005));
  }
});

test('the helpers rise from their low limb grip without lifting either support heel', () => {
  const low = fighter({ pose: 'overhead', angle: 0, overheadRaise: 0 });
  const drag = { ...low, pose: 'drag', overheadRaise: undefined, animation: createArenaFighterAnimation() };
  assert.deepEqual(sampleArenaFighterContacts(low, 1000), sampleArenaFighterContacts(drag, 1000));
  const animation = createArenaFighterAnimation();
  let previous;
  for (let frame = 0; frame <= 60; frame++) {
    const body = fighter({ pose: 'overhead', angle: 0, overheadRaise: frame / 60, animation, motionImmediate: false });
    drawArenaFighter(ctx, body, 1000 + frame * 16);
    const heels = animation.contactPoints.feet;
    if (previous) heels.forEach((point, leg) => assert.ok(distance(point, previous[leg]) < .001, 'raising the held body cannot slide or lift a planted heel'));
    assert.ok(animation.feet.every(foot => foot.lift === 0));
    previous = structuredClone(heels);
  }
});
