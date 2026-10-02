import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAnklePickup } = await source('src/arenaPickup.ts');
const { arenaTechniqueTargets } = await source('src/arenaTechniques.ts');
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const places = [{ x: 360, y: 390 }, { x: 500, y: 416 }, { x: 640, y: 442 }];
const clock = 7990;
const body = (index, overrides) => ({ candidate: { id: String(index), name: '선수', color: '#ffad72' }, index, scale: 2.04, angle: 0, alpha: 1, facing: 1, pose: 'guard', velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 1, power: .55, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
function floorBody(tactic, side, index, place) {
  const round = { id: tactic, index: 0, tactic, aggressor: 'holder', victim: 'fallen', start: 0, impact: 6300, resolve: 10400, end: 11000, final: false, contactSide: side };
  const frame = arenaTechniqueTargets(round, tactic === 'suplex' ? round.impact : round.impact * .70, { x: 500, y: 416 });
  const rig = tactic === 'elbow' ? frame.victimFloorRig : { pose: 'stunned', angle: frame.victimAngle, suspension: 0, phase: 1, slamProgress: frame.victimSlam };
  return body(index, { ...place, depthY: place.y, facing: -side, ...rig });
}
function painted(actor) {
  let transform;
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
  ctx.transform = (...matrix) => { transform = matrix; };
  drawArenaFighter(ctx, actor, clock);
  return { contacts: actor.animation.contactPoints, drawingOrigin: { x: transform[4], y: transform[5] } };
}

test('an ankle pickup places the real hands on both painted toe ends without confusing the rotated drawing origin with the ground anchor', () => {
  for (const tactic of ['suplex', 'elbow']) for (const side of [-1, 1]) for (let index = 0; index < 10; index++) for (const place of places) {
    const victim = floorBody(tactic, side, index, place), { contacts, drawingOrigin } = painted(victim);
    const footSide = tactic === 'suplex' ? -side : side, pickup = arenaAnklePickup(victim, contacts.feet, footSide);
    assert.ok(Math.abs(drawingOrigin.y - victim.y) > 4, 'the painted rotated skeleton has a different origin from the grounded body');
    const holder = body((index + 1) % 10, { ...pickup.holder, depthY: pickup.holder.y, facing: -footSide, pose: 'drag', phase: .5, gripMode: 'ankle', gripStrength: 1, gripLocked: true, gripTarget: contacts.feet[0], secondaryGripTarget: contacts.feet[1] });
    const held = sampleArenaFighterContacts(holder, clock);
    for (let hand = 0; hand < 2; hand++) {
      const gap = distance(held.hands[1 - hand], contacts.feet[hand]);
      assert.ok(gap < 2.05, `${tactic}/${side}/${index}/${hand}: the holder must touch the actual toe endpoint (gap ${gap.toFixed(2)}px)`);
    }
    assert.ok(footSide * (holder.x - (contacts.feet[0].x + contacts.feet[1].x) / 2) > 25, 'the holder is beyond the feet instead of over the fallen torso');
    const anchored = { x: pickup.holder.x - pickup.offset.x, y: pickup.holder.y - pickup.offset.y };
    assert.ok(distance(anchored, victim) < 1e-8, 'taking the ankle grip cannot reposition the grounded body');
    assert.ok(Math.abs(pickup.offset.y - (pickup.holder.y - drawingOrigin.y)) > 4, 'the ankle grip uses the body anchor rather than the lower rotated drawing origin');
    assert.ok(Math.abs(contacts.head.y - contacts.waist.y) < 20, 'the unconscious head and waist stay in a low floor silhouette');
  }
});

test('dragging the holder translates the ground body and both real feet equally without sinking or building up a vertical offset', () => {
  for (const tactic of ['suplex', 'elbow']) for (const side of [-1, 1]) for (let index = 0; index < 10; index++) for (const place of places) {
    const victim = floorBody(tactic, side, index, place), contacts = sampleArenaFighterContacts(victim, clock);
    const footSide = tactic === 'suplex' ? -side : side, pickup = arenaAnklePickup(victim, contacts.feet, footSide);
    for (const shift of [{ x: 0, y: 0 }, { x: footSide * 17, y: 0 }, { x: footSide * 51, y: 8 }, { x: footSide * 90, y: -7 }]) {
      const holder = { x: pickup.holder.x + shift.x, y: pickup.holder.y + shift.y };
      const ground = { x: holder.x - pickup.offset.x, y: holder.y - pickup.offset.y };
      const translated = { ...victim, ...ground, depthY: ground.y, animation: createArenaFighterAnimation() };
      const moved = sampleArenaFighterContacts(translated, clock);
      assert.ok(distance(ground, { x: victim.x + shift.x, y: victim.y + shift.y }) < 1e-8);
      for (let foot = 0; foot < 2; foot++) {
        assert.ok(distance(moved.feet[foot], { x: contacts.feet[foot].x + shift.x, y: contacts.feet[foot].y + shift.y }) < 1e-8, 'the actual toe follows the same X/Y translation as the ground body');
        const fromAnchor = { x: ground.x + pickup.feet[foot].x, y: ground.y + pickup.feet[foot].y };
        assert.ok(distance(fromAnchor, moved.feet[foot]) < 1e-8, 'stored toe offsets still reach the painted feet after a pull');
        assert.ok(Math.abs((moved.feet[foot].y - ground.y) - (contacts.feet[foot].y - victim.y)) < 1e-8, 'dragging cannot bury the original foot silhouette in the sand');
      }
      assert.ok(Math.abs((moved.head.y - ground.y) - (contacts.head.y - victim.y)) < 1e-8);
      assert.ok(Math.abs((moved.waist.y - ground.y) - (contacts.waist.y - victim.y)) < 1e-8);
      const repeated = arenaAnklePickup(ground, moved.feet, footSide);
      assert.ok(distance(repeated.offset, pickup.offset) < 1e-8, 'resampling a real grip cannot accumulate a new sinking offset');
    }
  }
});
