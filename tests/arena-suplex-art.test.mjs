import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaTechniqueTargets, arenaTechniqueExit } = await source('src/arenaTechniques.ts');
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const round = { id: 'suplex-body', index: 0, aggressor: '1', victim: '2', tactic: 'suplex', start: 33_200, impact: 35_300, resolve: 39_300, end: 44_000, final: true };
const span = round.impact - round.start;
const noop = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const fighter = overrides => ({ candidate: { id: '2', name: '선수', color: '#ffad72' }, index: 1, scale: 2.04, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, power: .55, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function victimAt(phase, side, animation) {
  const time = round.start + span * phase, frame = arenaTechniqueTargets({ ...round, contactSide: side }, time, { x: 500, y: 416 });
  return { time, frame, actor: fighter({ x: frame.victim.x, y: frame.victim.y - frame.lift, depthY: frame.victim.y, facing: -side, pose: frame.victimPose ?? 'brace', phase, angle: frame.victimAngle, suspension: frame.victimSuspension, slamProgress: frame.victimSlam, grappleEffort: frame.victimEffort, ...(animation ? { animation, motionImmediate: false } : {}) }) };
}
function parts(contacts) { return [contacts.head, contacts.waist, ...contacts.shoulders, ...contacts.hands, ...contacts.feet]; }

function contestAt(phase, side, index = 1) {
  const { time, frame, actor: victim } = victimAt(phase, side);
  victim.index = index;
  const waist = sampleArenaFighterContacts(victim, time).waist;
  const driver = fighter({ index: (index + 1) % 10, candidate: { id: '1', name: '메치는 선수', color: '#ffad72' }, x: frame.aggressor.x, y: frame.aggressor.y, depthY: frame.aggressor.y, facing: side, pose: frame.aggressorPose ?? 'grapple', phase, angle: frame.aggressorAngle, grappleEffort: frame.aggressorEffort, grappleLiftPreparation: frame.aggressorLiftPreparation, overheadRaise: frame.aggressorOverheadRaise, gripMode: 'waist', gripTarget: waist, secondaryGripTarget: { x: waist.x - side * 6, y: waist.y + 3 }, gripStrength: 1, gripLocked: true });
  drawArenaFighter(noop, victim, time); drawArenaFighter(noop, driver, time);
  return { time, frame, victim, driver };
}

test('the suplex contest presses against a grounded waist before the full lift, keeping complete adult limbs', () => {
  for (const side of [-1, 1]) for (const index of [0, 4, 9]) {
    const moments = [.200001, .27, .339999].map(phase => contestAt(phase, side, index));
    assert.ok(moments[1].frame.aggressorEffort > .99 && moments[1].frame.victimEffort > .89, 'both opponents visibly resist at the middle of the contest');
    assert.ok(moments[0].frame.aggressorEffort < .00001 && moments[2].frame.aggressorEffort < .00001, 'the effort rises and relaxes before the lift');
    for (const { frame, victim, driver } of moments) {
      assert.equal(frame.lift, 0, 'the resisted waist grip cannot lift the victim early');
      assert.equal(frame.grip, 'waist'); assert.equal(driver.pose, 'grapple'); assert.equal(victim.pose, 'brace');
      const waist = victim.animation.contactPoints.waist, hands = driver.animation.contactPoints.hands;
      assert.ok(Math.min(...hands.map(hand => distance(hand, waist))) < 5, `the lift begins with an actual hand-to-waist grip (side ${side}, body ${index}, phase ${frame.phase})`);
      for (const actor of [driver, victim]) {
        const { contactPoints, skeleton } = actor.animation;
        assert.equal(actor.y, actor.depthY);
        assert.ok(contactPoints.feet.every(foot => Math.abs(foot.y - (actor.depthY - 2 * actor.scale)) < .001), 'both feet keep their soles on the sand throughout the resistance');
        for (let leg = 0; leg < 2; leg++) {
          assert.ok(distance(skeleton.hips[leg], skeleton.feet[leg]) > 14, 'the thigh and shin do not fold into a short crouched silhouette');
          for (const length of [distance(skeleton.hips[leg], skeleton.knees[leg]), distance(skeleton.knees[leg], skeleton.feet[leg])]) assert.ok(length >= 7 && length <= 11.001, `grounded leg segments retain their normal projected length (${length.toFixed(3)})`);
        }
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(Math.abs(distance(contactPoints.shoulders[arm], contactPoints.elbows[arm]) - 11 * actor.scale) < .005, 'the gripping upper arm keeps its adult length');
          assert.ok(Math.abs(distance(contactPoints.elbows[arm], contactPoints.hands[arm]) - 10.5 * actor.scale) < .005, 'the connected forearm cannot shrink while gripping');
        }
      }
    }
    assert.ok(distance(moments[0].frame.aggressor, moments[2].frame.aggressor) < 10 && distance(moments[0].frame.victim, moments[2].frame.victim) < 10, 'the contest shifts weight nearby rather than resetting either root');
  }
});

test('both suplex bodies keep continuous roots, hands and feet at the resistance and lift boundaries', () => {
  for (const side of [-1, 1]) for (const phase of [.20, .34]) {
    const before = contestAt(phase - .001 / span, side), after = contestAt(phase + .001 / span, side);
    for (const role of ['driver', 'victim']) {
      assert.ok(distance(before[role], after[role]) < .005, `${role} cannot reset its root at phase ${phase}`);
      const a = parts(before[role].animation.contactPoints), b = parts(after[role].animation.contactPoints);
      a.forEach((point, index) => assert.ok(distance(point, b[index]) < .005, `${role}, side ${side}, phase ${phase}, painted point ${index} cannot jump when resistance becomes lifting (${distance(point, b[index]).toFixed(3)}px)`));
    }
  }
});

test('the slammed body is dragged toward its foot ends instead of pulling the driver across its head', () => {
  for (const side of [-1, 1]) for (const center of [{ x: 360, y: 400 }, { x: 640, y: 440 }]) {
    const frame = arenaTechniqueTargets({ ...round, contactSide: side }, round.impact, center);
    const actor = fighter({ x: frame.victim.x, y: frame.victim.y, depthY: frame.victim.y, facing: -side, pose: 'stunned', phase: 1, angle: frame.victimAngle, suspension: 0, slamProgress: frame.victimSlam });
    const contacts = sampleArenaFighterContacts(actor, round.impact), foot = contacts.feet[1];
    assert.equal(frame.exitDirection, -side);
    assert.ok(frame.exitDirection * (foot.x - contacts.head.x) > 100, 'the chosen rim is beyond the feet, not beyond the head');
    const driverX = foot.x + frame.exitDirection * 32;
    assert.ok(frame.exitDirection * (driverX - foot.x) > 0, 'the dragging fighter stands outside the foot ends');
    assert.ok(frame.exitDirection * (driverX - contacts.head.x) > 132, 'the driver does not share the unconscious torso silhouette');
    const landing = { x: frame.exitDirection < 0 ? 115 : 885, y: 436 }, preparation = { lift: 0, angle: frame.victimAngle };
    const before = arenaTechniqueExit(round, 900, frame.victim, landing, frame.exitDirection, 1, preparation), after = arenaTechniqueExit(round, 1200, frame.victim, landing, frame.exitDirection, 1, preparation);
    assert.ok(frame.exitDirection * (after.groundX - before.groundX) > 0, 'the ankle grip pulls in the same direction as the feet');
  }
});

test('both raised suplex legs hang below the pelvis with relaxed forward knees instead of collapsing into the shorts', () => {
  for (const side of [-1, 1]) for (const phase of [.64, .70, .76, .82]) {
    const { actor, time } = victimAt(phase, side);
    drawArenaFighter(noop, actor, time);
    const { hips, knees, feet } = actor.animation.skeleton;
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(distance(hips[leg], feet[leg]) > 17, 'the full lower leg remains visible beneath the lifted pelvis');
      assert.ok(knees[leg].y > hips[leg].y + 7, 'the held thigh hangs down rather than folding horizontally into the waistband');
      assert.ok(feet[leg].y > knees[leg].y + 7, 'the relaxed shin continues below its connected knee');
      assert.ok(knees[leg].x > feet[leg].x + 3, 'both knees bend naturally forward with the ankle behind them');
      assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001 && Math.abs(distance(knees[leg], feet[leg]) - 11) < .001, 'neither complete limb section can shrink while held');
    }
    assert.ok(feet[1].x - feet[0].x > 9, 'the two visible ankles remain separated rather than stacking into one foot');
  }
});

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
  for (const side of [-1, 1]) for (const phase of [.34, .56, .70, .82, .88, .91, .94, 1]) {
    const before = victimAt(phase - .001 / span, side), after = victimAt(phase + .001 / span, side);
    const a = parts(sampleArenaFighterContacts(before.actor, before.time)), b = parts(sampleArenaFighterContacts(after.actor, after.time));
    a.forEach((point, index) => assert.ok(distance(point, b[index]) < .005, `side ${side}, phase ${phase}, body point ${index} cannot pop when the action label changes`));
  }
});

test('both suplex legs unfold through full extension without collapsing either connected bone', () => {
  for (const side of [-1, 1]) for (let step = 0; step <= 60; step++) {
    const phase = .88 + step / 1000, { actor, time } = victimAt(phase, side);
    drawArenaFighter(noop, actor, time);
    const { hips, knees, feet } = actor.animation.skeleton;
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001, 'the upper leg cannot shrink as the bent knee turns');
      assert.ok(Math.abs(distance(knees[leg], feet[leg]) - 11) < .001, 'the shin and ankle remain connected at their actual length');
    }
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
