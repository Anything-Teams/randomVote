import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { drawArenaFighter, createArenaFighterAnimation, sampleArenaFighterContacts, arenaCarryHolderPoint } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'a', name: '선수', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, phase: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ease = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
const points = rig => [rig.head, ...rig.headSides, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
function paint(actor, clock) {
  const noop = () => {}, eyes = []; let matrix;
  const ctx = new Proxy({ globalAlpha: 1, fillStyle: '', transform(...value) { matrix = value; }, fillRect(_x, _y, width, height) { if (this.fillStyle === '#172b37' && width === 1.8) eyes.push(height); } }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
  drawArenaFighter(ctx, actor, clock);
  const rig = structuredClone(actor.animation.contactPoints), skeleton = structuredClone(actor.animation.skeleton);
  assert.ok(matrix.every(Number.isFinite) && points(rig).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  for (let arm = 0; arm < 2; arm++) {
    assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - actor.scale * 11) < .001);
    assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - actor.scale * 10.5) < .001);
  }
  for (let leg = 0; leg < 2; leg++) {
    const lengths = [distance(skeleton.hips[leg], skeleton.knees[leg]), distance(skeleton.knees[leg], skeleton.feet[leg])];
    assert.ok(lengths.every(value => value > 1 && value <= 11.001));
    if (actor.animation.airborne && !actor.slamProgress) assert.ok(lengths.every(value => Math.abs(value - 11) < .001), 'the seated thigh and shin each keep their ordinary complete bone');
  }
  assert.ok(Math.abs(Math.hypot(matrix[0], matrix[1]) - actor.scale) < .001, 'loading and seating the victim cannot make its body paper thin');
  return { rig, skeleton, eyes, matrix };
}

test('powerbomb accepts the actual standing rig, folds at the hips and seats with bent knees above the shoulders', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ facing: -facing });
    const standing = paint(actor, 1000);
    Object.assign(actor, { pose: 'carried', carrySupport: 'shoulder', carryEntry: true, carryStretch: 0, powerbombVictim: true, powerbombLoad: 0, powerbombLift: 0, powerbombDown: 0, eyesClosed: false });
    const received = paint(actor, 1000);
    points(received.rig).forEach((point, index) => assert.ok(distance(point, points(standing.rig)[index]) < .001, `the initial waist catch cannot replace the painted standing body ${index}: ${JSON.stringify({point,prior:points(standing.rig)[index]})}`));
    let previous = received;
    for (let age = step; age <= 960; age += step) {
      const lift = ease((age - 320) / 620);
      actor.powerbombLoad = ease(age / 320); actor.powerbombLift = lift; actor.carryStretch = lift; actor.y = 416 - 116 * lift; actor.suspension = lift;
      const frame = paint(actor, 1000 + age);
      points(frame.rig).forEach((point, index) => assert.ok(distance(point, points(previous.rig)[index]) < 8 + step * .9, 'the hip fold and seated rise flow without a body or arm reset'));
      assert.ok(frame.eyes.every(height => height === 1.8), 'the supported opponent remains awake before the floor impact');
      previous = frame;
    }
    actor.powerbombLift = 1; actor.carryStretch = 1; actor.y = 300; actor.suspension = 1;
    const seated = paint(actor, 2000);
    assert.ok(Math.abs(actor.animation.motion.lean) < .01, 'the final seated trunk is upright');
    for (let leg = 0; leg < 2; leg++) {
      const hip = seated.skeleton.hips[leg], knee = seated.skeleton.knees[leg], ankle = seated.skeleton.feet[leg];
      assert.ok(knee.x > hip.x + 8 && Math.abs(knee.y - hip.y) < 5, 'the thighs rest forward on the shoulders');
      assert.ok(ankle.y > knee.y + 8, 'the folded knees let both shins hang naturally');
    }
  }
});

test('the powerbomb holder supports both actual waist contacts above its head without stretching its arms', () => {
  for (const facing of [-1, 1]) {
    const actor = fighter({ facing, pose: 'powerbomb', gripMode: 'waist', gripLocked: true, gripStrength: 1, powerbombLoad: 1, powerbombLift: 1, powerbombDown: 0 });
    const endpoints = [{ x: 500 + facing * 10, y: 276 }, { x: 500 + facing * 16, y: 279 }];
    const root = arenaCarryHolderPoint(actor, [endpoints[1], endpoints[0]], 1000, { x: 500, y: 416 });
    Object.assign(actor, root, { secondaryGripTarget: endpoints[0], gripTarget: endpoints[1] });
    const frame = paint(actor, 1000);
    frame.rig.hands.forEach((hand, arm) => assert.ok(distance(hand, endpoints[arm]) < .001, 'both palms support the actual raised waist'));
    assert.ok(Math.abs(actor.animation.motion.lean) < .01 && actor.animation.motion.crouch < 2);
    assert.ok(endpoints[0].y < frame.rig.head.y, 'the victim hips visibly clear the holder head');
  }
});

test('the back-first powerbomb drop closes the eyes on the floor impact and retains its captured seated arms', () => {
  for (const facing of [-1, 1]) for (const step of [16, 50]) {
    const actor = fighter({ facing: -facing, pose: 'carried', y: 300, depthY: 416, suspension: 1, carrySupport: 'shoulder', carryStretch: 1, powerbombVictim: true, powerbombLoad: 1, powerbombLift: 1, powerbombDown: 0, eyesClosed: false });
    paint(actor, 1000);
    let previous;
    for (let age = 0; age <= 560; age += step) {
      const down = ease(age / 560);
      Object.assign(actor, { angle: facing * Math.PI * .47 * down, powerbombDown: down, suspension: 1 - down, y: 300 + 116 * down, carryStretch: 1 - down, slamProgress: age ? { tuck: .15 * Math.sin(down * Math.PI), slump: down } : undefined, slamEntry: age > 0, eyesClosed: false });
      const frame = paint(actor, 1000 + age);
      if (previous) for (const field of ['shoulders', 'elbows', 'hands']) frame.rig[field].forEach((point, arm) => assert.ok(distance(point, previous.rig[field][arm]) < 8 + step * .9, 'the seated protective arm cannot flip while the back approaches the floor'));
      assert.ok(frame.eyes.every(height => height === 1.8)); previous = frame;
    }
    Object.assign(actor, { pose: 'stunned', y: 416, suspension: 0, angle: facing * Math.PI * .47, powerbombVictim: false, carryStretch: undefined, slamProgress: { tuck: 0, slump: 1 }, eyesClosed: true });
    const impact = paint(actor, 1560);
    assert.ok(impact.eyes.every(height => height === .7), 'the opponent becomes unconscious at the actual floor strike');
  }
});
