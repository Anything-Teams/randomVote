import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaTechniqueTargets } = await source('src/arenaTechniques.ts');
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const round = { id: 'suplex-body', index: 0, aggressor: '1', victim: '2', tactic: 'suplex', start: 33_200, impact: 35_300, resolve: 39_300, end: 44_000, final: true };
const span = round.impact - round.start;
const noop = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const fighter = overrides => ({ candidate: { id: '2', name: '선수', color: '#ffad72' }, index: 1, scale: 2.04, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, power: .55, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function victimAt(phase, side, animation) {
  const time = round.start + span * phase, frame = arenaTechniqueTargets({ ...round, contactSide: side }, time, { x: 500, y: 416 });
  return { time, frame, actor: fighter({ x: frame.victim.x, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -side, pose: frame.victimPose ?? 'brace', phase, angle: frame.victimAngle, suspension: frame.victimSuspension, slamProgress: frame.victimSlam, ...(animation ? { animation, motionImmediate: false } : {}) }) };
}
function parts(contacts) { return [contacts.head, contacts.waist, ...contacts.shoulders, ...contacts.hands, ...contacts.feet]; }

test('the suplex body reaches the sand before it relaxes into a still floor silhouette', () => {
  for (const side of [-1, 1]) {
    const high = victimAt(.70, side), impact = victimAt(.88, side), flat = victimAt(.95, side);
    const highPoints = sampleArenaFighterContacts(high.actor, high.time), impactPoints = sampleArenaFighterContacts(impact.actor, impact.time), flatPoints = sampleArenaFighterContacts(flat.actor, flat.time);
    assert.ok(highPoints.shoulders.every(point => point.y < high.frame.victim.y - 14), 'the held shoulders visibly clear the sand before the drop');
    assert.ok(Math.max(...impactPoints.shoulders.map(point => point.y)) > impact.frame.victim.y - 12, 'the falling shoulder reaches the sand before the limbs go limp');
    assert.equal(impact.actor.slamProgress.slump, 0, 'the impact first preserves the tucked landing body');
    assert.equal(flat.actor.slamProgress.slump, 1);
    assert.ok(flatPoints.head.y > flat.frame.victim.y - 48 && flatPoints.waist.y > flat.frame.victim.y - 48, 'both head and waist remain low beside the sand');
    assert.ok(Math.abs(flatPoints.head.y - flatPoints.waist.y) < 14, 'the head cannot stand upright over a supposedly unconscious body');
    drawArenaFighter(noop, flat.actor, flat.time); const painted = structuredClone(flat.actor.animation);
    drawArenaFighter(noop, flat.actor, flat.time);
    assert.deepEqual(flat.actor.animation, painted, 'paused unconscious limbs cannot drift');
  }
});

test('the pure suplex rig stays continuous at every lift, landing and slump boundary', () => {
  for (const side of [-1, 1]) for (const phase of [.34, .56, .70, .82, .88, .94, 1]) {
    const before = victimAt(phase - .001 / span, side), after = victimAt(phase + .001 / span, side);
    const a = parts(sampleArenaFighterContacts(before.actor, before.time)), b = parts(sampleArenaFighterContacts(after.actor, after.time));
    a.forEach((point, index) => assert.ok(distance(point, b[index]) < .005, `side ${side}, phase ${phase}, body point ${index} cannot pop when the action label changes`));
  }
});

test('a running and directly sought suplex paint the same bones without advancing contact prediction', () => {
  for (const side of [-1, 1]) {
    const animation = createArenaFighterAnimation();
    for (let time = round.start + span * .34; time <= round.impact; time += 16) {
      const phase = (time - round.start) / span, live = victimAt(phase, side, animation), seek = victimAt(phase, side);
      const saved = structuredClone(animation), predicted = sampleArenaFighterContacts(live.actor, time);
      assert.deepEqual(animation, saved);
      drawArenaFighter(noop, live.actor, time);
      assert.deepEqual(predicted, animation.contactPoints);
      const sought = sampleArenaFighterContacts(seek.actor, time);
      parts(sought).forEach((point, index) => assert.ok(distance(point, parts(predicted)[index]) < 1e-8, 'the elbow, head and foot positions cannot depend on frame history'));
    }
  }
});
