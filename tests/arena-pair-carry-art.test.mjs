import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'charger', name: '돌진한 선수', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'carried', angle: Math.PI * .47, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, carryStretch: 0, suspension: 0, motionEpoch: 'carry-regression', motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const parts = contacts => [contacts.head, contacts.waist, ...contacts.shoulders, ...contacts.elbows, ...contacts.hands, ...contacts.feet];
const smooth = value => value * value * (3 - 2 * value);

function paint(actor, clock) {
  let matrix;
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
  ctx.transform = (...values) => { matrix = values; };
  drawArenaFighter(ctx, actor, clock);
  const [a, b, c, d, e, f] = matrix, determinant = a * d - b * c;
  const local = point => ({ x: (d * (point.x - e) - c * (point.y - f)) / determinant, y: (-b * (point.x - e) + a * (point.y - f)) / determinant });
  return { contacts: actor.animation.contactPoints, local, matrix };
}

test('both carried arms retain their anatomical lengths through every 16ms floor-to-grip unfolding frame', () => {
  for (const side of [-1, 1]) for (const facing of [-1, 1]) for (let index = 0; index < 10; index++) {
    const actor = fighter({ index, facing, angle: side * Math.PI * .47 });
    for (let age = 0; age <= 752; age += 16) {
      const stretch = smooth(Math.min(1, age / 750));
      actor.carryStretch = stretch; actor.angle = side * Math.PI * (.47 + .03 * stretch);
      const { contacts, local } = paint(actor, 1000 + age);
      for (let arm = 0; arm < 2; arm++) {
        const shoulder = local(contacts.shoulders[arm]), elbow = local(contacts.elbows[arm]), hand = local(contacts.hands[arm]);
        assert.ok(Math.abs(distance(shoulder, elbow) - 11) < .001, `${side}/${facing}/${index}/${age}/${arm}: the upper arm cannot lengthen through the shoulder crossing`);
        assert.ok(Math.abs(distance(elbow, hand) - 10.5) < .001, `${side}/${facing}/${index}/${age}/${arm}: the forearm cannot shrink while reaching beyond the head`);
        assert.ok(distance(shoulder, hand) >= .52 - 1e-6, 'unequal arm bones cannot reach inside their anatomical inner radius');
      }
      const { hips, knees, feet } = actor.animation.skeleton;
      for (let leg = 0; leg < 2; leg++) {
        assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001);
        assert.ok(Math.abs(distance(knees[leg], feet[leg]) - 11) < .001, 'straightening the held legs keeps both full connected bone lengths');
      }
    }
  }
});

test('unfolding never snaps the whole floor body when an arm passes its shoulder', () => {
  for (const side of [-1, 1]) for (const facing of [-1, 1]) for (let index = 0; index < 10; index++) {
    const actor = fighter({ index, facing, angle: side * Math.PI * .47, pose: 'stunned', carryStretch: undefined });
    let previous = structuredClone(paint(actor, 984).contacts);
    actor.pose = 'carried'; actor.carryStretch = 0;
    const first = paint(actor, 1000).contacts;
    parts(first).forEach((point, endpoint) => assert.ok(distance(point, parts(previous)[endpoint]) < .001, 'the first hand/foot grip preserves the actual prone skeleton'));
    previous = structuredClone(first);
    for (let age = 16; age <= 752; age += 16) {
      const stretch = smooth(Math.min(1, age / 750));
      actor.carryStretch = stretch; actor.angle = side * Math.PI * (.47 + .03 * stretch);
      const { contacts } = paint(actor, 1000 + age);
      assert.ok(distance(contacts.head, previous.head) < 3, `${side}/${facing}/${index}/${age}: the floor-normalized head cannot jump with the elbow bend`);
      assert.ok(distance(contacts.waist, previous.waist) < 3, 'floor normalization cannot translate the entire torso abruptly');
      contacts.shoulders.forEach((point, arm) => assert.ok(distance(point, previous.shoulders[arm]) < 3));
      contacts.elbows.forEach((point, arm) => assert.ok(distance(point, previous.elbows[arm]) < 5, 'the elbow crosses the shoulder by a continuous outside arc'));
      previous = structuredClone(contacts);
    }
  }
});

test('an established close hand grip clamps its minimum reach without shortening either arm section', () => {
  for (const facing of [-1, 1]) for (let index = 0; index < 10; index++) {
    const actor = fighter({ index, facing, pose: 'overhead', angle: 0, carryStretch: undefined, overheadRaise: 0, gripMode: 'wrist', motionImmediate: true });
    const shoulders = sampleArenaFighterContacts(actor, 1000).shoulders;
    actor.gripTarget = { x: shoulders[1].x + .01 * facing, y: shoulders[1].y };
    actor.secondaryGripTarget = { x: shoulders[0].x - .01 * facing, y: shoulders[0].y };
    actor.gripStrength = 1; actor.gripLocked = true;
    const { contacts, local } = paint(actor, 1000);
    for (let arm = 0; arm < 2; arm++) {
      const shoulder = local(contacts.shoulders[arm]), elbow = local(contacts.elbows[arm]), hand = local(contacts.hands[arm]);
      assert.ok(Math.abs(distance(shoulder, elbow) - 11) < .001);
      assert.ok(Math.abs(distance(elbow, hand) - 10.5) < .001, 'a target beside the shoulder does not make the forearm collapse');
      assert.ok(distance(shoulder, hand) >= .52 - 1e-6);
    }
  }
});
