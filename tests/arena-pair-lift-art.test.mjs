import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts, arenaCarryHolderPoint } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(name => [name, () => {}]));
const fighter = values => ({ candidate: { id: 'v', name: 'v', color: '#e98d67' }, index: 2, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const points = contacts => [contacts.head, contacts.waist, ...contacts.shoulders, ...contacts.elbows, ...contacts.hands, ...contacts.feet];
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
function paint(actor, clock) { drawArenaFighter(ctx, actor, clock); return structuredClone(actor.animation.contactPoints); }
function bones(actor) {
  const { contactPoints: rig, skeleton } = actor.animation;
  for (let arm = 0; arm < 2; arm++) {
    assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * actor.scale) < .001, 'the supported upper arm keeps its complete adult bone');
    assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - 10.5 * actor.scale) < .001, 'the connected forearm cannot stretch to reach a hold');
  }
  if (actor.pairCarry) for (let leg = 0; leg < 2; leg++) {
    assert.ok(Math.abs(distance(skeleton.hips[leg], skeleton.knees[leg]) - 11) < .001);
    assert.ok(Math.abs(distance(skeleton.knees[leg], skeleton.feet[leg]) - 11) < .001);
  }
  assert.ok(points(rig).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), 'the complete joint rig stays finite');
}
function stance(actor) {
  const { motion, hip } = actor.animation.rig;
  return { crouch: hip.y + 20, hipX: hip.x, lean: motion.lean, head: motion.head, shoulderLift: motion.shoulderLift, contact: motion.contact };
}

for (const side of [-1, 1]) for (const delta of [16, 50]) test(`a shared pickup bends the knees, supports the chest in front, and releases into guard (${side}/${delta}ms)`, () => {
  for (let index = 0; index < 10; index++) {
    const victim = fighter({ index, facing: -side, pose: 'carried', carrySupport: 'shoulder', pairCarry: true, carryStretch: 0, angle: side * Math.PI * .47, suspension: 0 });
    const floor = paint(victim, 1000);
    const casters = ['shoulder', 'ankle'].map((gripMode, slot) => {
      const ends = gripMode === 'shoulder' ? floor.shoulders : floor.feet;
      const actor = fighter({ index: (index + slot + 1) % 10, facing: slot ? side : -side, pose: 'pairlift', gripMode, gripTarget: ends[0], secondaryGripTarget: ends[1], gripStrength: 1, gripLocked: true, pairLoad: 0, pairLift: 0, pairBackload: 0, pairHeave: 0 });
      Object.assign(actor, arenaCarryHolderPoint(actor, ends, 1000));
      actor.pose = 'guard'; actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
      const before = paint(actor, 1000);
      actor.pose = 'pairlift'; actor.pairReach = 0; actor.gripTarget = ends[0]; actor.secondaryGripTarget = ends[1]; actor.gripStrength = 1;
      const first = paint(actor, 1000);
      points(first).forEach((point, part) => assert.ok(distance(point, points(before)[part]) < .001, 'reaching for the prone body starts at the actual standing rig'));
      let prior = first;
      for (let age = delta; age <= 180 + delta; age += delta) {
        actor.pairReach = smooth(age / 180);
        const rig = paint(actor, 1000 + age);
        bones(actor);
        for (const key of ['shoulders', 'elbows', 'hands']) rig[key].forEach((point, arm) => assert.ok(distance(point, prior[key][arm]) < (delta === 16 ? 21 : 49), 'the caster bends and reaches without swapping an elbow branch'));
        prior = rig;
      }
      actor.pairReach = undefined;
      return actor;
    });
    let priorVictim = floor, raised = false, loaded = false, releaseClock;
    for (let age = 0; age <= 900 + delta; age += delta) {
      const load = smooth(age / 160), lift = smooth((age - 160) / 360), backload = smooth((age - 520) / 160), heave = smooth((age - 680) / 220);
      const height = 70 * lift - 6 * backload * (1 - heave) + 14 * heave;
      Object.assign(victim, { y: 416 - height, carryStretch: lift, pairLoad: load, pairLift: lift, pairBackload: backload, pairHeave: heave, suspension: lift, angle: side * Math.PI * (.47 + lift * .03) });
      const predicted = sampleArenaFighterContacts(victim, 1250 + age);
      victim.x += floor.waist.x - predicted.waist.x;
      victim.y += floor.waist.y - height - predicted.waist.y;
      victim.depthY = victim.y + height;
      const held = paint(victim, 1250 + age);
      bones(victim);
      const rootDelta = { x: held.origin.x - priorVictim.origin.x, y: held.origin.y - priorVictim.origin.y };
      points(held).forEach((point, part) => assert.ok(distance(point, { x: points(priorVictim)[part].x + rootDelta.x, y: points(priorVictim)[part].y + rootDelta.y }) < (delta === 16 ? 12 : 32), 'the victim softly folds without turning into a rigid horizontal pole'));
      priorVictim = held; releaseClock = 1250 + age;
      casters.forEach((actor, slot) => {
        const ends = slot ? held.feet : held.shoulders;
        Object.assign(actor, { pairLoad: load, pairLift: lift, pairBackload: backload, pairHeave: heave, gripTarget: ends[0], secondaryGripTarget: ends[1] });
        const beforeRoot = { x: actor.x, y: actor.y };
        Object.assign(actor, arenaCarryHolderPoint(actor, ends, 1250 + age, actor));
        actor.velocityX = (actor.x - beforeRoot.x) * 1000 / delta; actor.velocityY = (actor.y - beforeRoot.y) * 1000 / delta;
        actor.gaitDistance += distance(actor, beforeRoot);
        const rig = paint(actor, 1250 + age);
        bones(actor);
        rig.hands.forEach((hand, arm) => {
          assert.ok(distance(hand, ends[1 - arm]) < .001, `each actual support keeps its painted shoulder or ankle: ${index}/${slot}/${age}`);
          assert.ok((hand.x - rig.shoulders[arm].x) * actor.facing > 16, 'a caster never holds the body behind its shoulder');
          assert.ok((rig.elbows[arm].x - rig.shoulders[arm].x) * actor.facing > -3, 'the upper arm cannot fold backward behind the torso');
        });
        assert.equal(actor.animation.airborne, false); assert.ok(actor.animation.feet.some(foot => foot.lift === 0), `load and heave retain a real supporting sole while the other heel adjusts: ${index}/${slot}/${age}`);
        if (age > 80 && age < 160) { assert.ok(actor.animation.motion.crouch > 10, 'both carriers visibly receive the floor load with bent knees'); loaded = true; }
        if (age > 520 && age < 680) {
          assert.ok(held.waist.y > rig.head.y && held.waist.y < rig.waist.y, 'the victim rests between waist and chest, below the carrier head'); raised = true;
        }
      });
    }
    assert.ok(loaded && raised, 'the full supported load and chest carry are exercised');
    assert.ok(victim.animation.skeleton.feet.every((foot, leg) => distance(foot, victim.animation.skeleton.hips[leg]) < 21), 'the victim retains a small visible knee bend while held');
    for (const actor of casters) {
      const supported = structuredClone(actor.animation.contactPoints), savedStance = stance(actor);
      actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0; actor.gripLocked = false;
      let previous = supported;
      for (let age = 0; age <= 560 + delta; age += delta) {
        actor.carrierRelease = { hands: supported.hands, elbows: supported.elbows, shoulders: supported.shoulders, stance: savedStance, progress: Math.min(1, age / 560), direction: side };
        const rig = paint(actor, releaseClock + age);
        bones(actor);
        if (!age) points(rig).forEach((point, part) => assert.ok(distance(point, points(supported)[part]) < .001, `release starts at every actually supported body and arm point: ${index}/${actor.gripMode}/${part}/${distance(point, points(supported)[part])}`));
        rig.hands.forEach((point, arm) => assert.ok(distance(point, previous.hands[arm]) < (delta === 16 ? 19 : 49), `the palms heave upward and retract continuously to guard: ${index}/${actor.gripMode}/${age}/${arm}/${distance(point, previous.hands[arm])}`));
        previous = rig;
      }
      actor.pose = 'guard'; actor.carrierRelease = undefined;
      const guard = paint(actor, releaseClock + 610);
      guard.hands.forEach((point, arm) => assert.ok(distance(point, previous.hands[arm]) < 2, 'finishing the release cannot start a second throwing arm animation'));
    }
  }
});
