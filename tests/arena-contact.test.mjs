import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaEdgeTargets, arenaEdgeFall, arenaExitDirection, arenaMove, arenaNearbyResponse, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter } = await source('src/game/ArenaFighter.ts');
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const radius = point => (point.x - 500) ** 2 / 303 ** 2 + (point.y - 416) ** 2 / 112 ** 2;
const actor = animation => ({ candidate: { id: 'fighter', name: '선수', color: '#ffad72' }, index: 0, x: 500, y: 425, scale: 2, facing: 1, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, animation });

test('edge pushing keeps both feet grounded at contact, reaches the rim and drops only the drawn loser', () => {
  const order = ['1', '2', '3-4'];
  for (const duration of [40_000, 44_000, 62_000]) {
    const round = arenaRounds(order, duration).at(-1), span = round.impact - round.start;
    assert.equal(round.tactic, 'edge');
    for (const center of [{ x: 325, y: 350 }, { x: 675, y: 350 }, { x: 325, y: 490 }, { x: 675, y: 490 }]) {
      const bodies = arenaEdgeTargets(round, round.start, center);
      const aggressor = { ...bodies.aggressor, facing: bodies.side }, victim = { ...bodies.victim, facing: -bodies.side };
      for (let time = round.start; time < round.impact; time += 16) {
        const targets = arenaEdgeTargets(round, time, center), action = arenaAction(round, time);
        arenaMove(aggressor, targets.aggressor, .016, 128);
        arenaMove(victim, targets.victim, .016, 128);
        assert.ok(radius(targets.aggressor) < 1 && radius(targets.victim) < 1, 'neither fighter is outside before the back step fails');
        assert.ok(Math.abs(Math.hypot(aggressor.x - victim.x, aggressor.y - victim.y) - 53) < .01, 'the two wrestlers travel together while their hands remain connected');
        assert.equal(action.lift, 0);
        assert.equal(action.liftedId, undefined);
      }
      const contact = arenaAction(round, round.start + span * .65);
      assert.equal(contact.actors.find(part => part.id === '1').pose, 'push');
      assert.equal(contact.actors.find(part => part.id === '2').pose, 'brace');
      assert.ok(contact.actors.every(part => part.gripId), 'the push remains a physical contact');
      const end = arenaEdgeTargets(round, round.impact, center), landing = { x: end.side < 0 ? 115 : 885, y: Math.max(436, center.y + 40) };
      assert.equal(arenaExitDirection(round, end.victim, 0), end.side);
      let previous = arenaEdgeFall(0, end.victim, landing, end.side, duration / 44_000);
      for (let age = 16; age < 880; age += 16) {
        const frame = arenaEdgeFall(age * duration / 44_000, end.victim, landing, end.side, duration / 44_000);
        assert.equal(frame.height, 0, 'a shove cannot turn into a high throw');
        assert.ok(frame.y >= end.victim.y);
        assert.ok(Math.hypot(frame.x - previous.x, frame.y - previous.y) < 6, 'there is no release teleport');
        previous = frame;
      }
      assert.ok(radius(arenaEdgeFall(100, end.victim, landing, end.side)) > 1, 'the failed back step crosses the rim first');
    }
    assert.match(arenaStoryState(round, round.impact + 100).action, /뒷발.*경계/);
    const ranks = arenaRanks(order, round.resolve, duration);
    assert.equal(ranks['1'], 1); assert.equal(ranks['2'], 2); assert.equal(ranks[order[2]], 3);
  }
});

test('charge anticipation and the driven run visibly lower and lean the torso without snapping', () => {
  const animation = createArenaFighterAnimation(), fighter = actor(animation);
  drawArenaFighter(ctx, fighter, 0);
  const standing = { ...animation.motion };
  fighter.chargePreparation = 1;
  for (let at = 16; at <= 480; at += 16) drawArenaFighter(ctx, fighter, at);
  assert.ok(animation.motion.crouch > standing.crouch + 4);
  assert.ok(animation.motion.lean > 14, 'the first step has a distinct forward set');
  fighter.pose = 'run'; fighter.chargeStrength = 1;
  let previous = { ...animation.motion };
  for (let at = 496; at <= 1100; at += 16) {
    fighter.velocityX = Math.min(145, (at - 480) * .5);
    fighter.x += fighter.velocityX * .016; fighter.gaitDistance += fighter.velocityX * .016;
    drawArenaFighter(ctx, fighter, at);
    assert.ok(Math.abs(animation.motion.lean - previous.lean) < 3, 'the torso never jumps into its running angle');
    previous = { ...animation.motion };
  }
  assert.ok(animation.motion.lean > 29, 'a charge is clearly distinguishable from an ordinary upright run');
});

test('a changing grip follows the opponent smoothly and a pause freezes hands and feet', () => {
  const animation = createArenaFighterAnimation(), fighter = actor(animation);
  fighter.pose = 'grapple'; fighter.gripTarget = { x: 532, y: 381 }; fighter.secondaryGripTarget = { x: 530, y: 373 };
  drawArenaFighter(ctx, fighter, 0);
  fighter.gripTarget.x += 24; fighter.secondaryGripTarget.x += 24;
  drawArenaFighter(ctx, fighter, 16);
  assert.ok(animation.grip.x > 532 && animation.grip.x < 539, 'hands approach new contact rather than instantly jumping');
  for (let at = 32; at <= 400; at += 16) drawArenaFighter(ctx, fighter, at);
  assert.ok(Math.abs(animation.grip.x - 556) < .2, 'hands still settle on the actual opponent');
  const before = structuredClone(animation);
  drawArenaFighter(ctx, fighter, 400);
  assert.deepEqual(animation.feet, before.feet);
  assert.deepEqual(animation.grip, before.grip);
});

test('an unpaired fighter turns toward nearby fighting and moves out of its path without joining the attack', () => {
  for (const origin of [{ x: 500, y: 450 }, { x: 500, y: 425 }]) {
    const opponent = { x: 500, y: 425 }, response = arenaNearbyResponse(origin, [opponent], 0);
    assert.ok(response);
    assert.equal(response.pose, 'dodge');
    assert.ok(Math.hypot(response.target.x - opponent.x, response.target.y - opponent.y) > Math.hypot(origin.x - opponent.x, origin.y - opponent.y));
    assert.ok(radius(response.target) < 1);
    assert.ok(Math.hypot(response.target.x - origin.x, response.target.y - origin.y) <= 48);
    assert.equal(response.gripId, undefined, 'being aware cannot add an extra attacker');
  }
  const left = arenaNearbyResponse({ x: 540, y: 440 }, [{ x: 445, y: 440 }], 1);
  assert.equal(left.facing, -1, 'a fight immediately behind is watched rather than ignored');
  assert.equal(arenaNearbyResponse({ x: 250, y: 430 }, [{ x: 750, y: 430 }], 0), undefined);
});
