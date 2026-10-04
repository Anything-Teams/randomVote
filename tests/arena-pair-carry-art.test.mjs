import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts, arenaCarryHolderPoint } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const rushBundle = await build({ entryPoints: ['src/arenaPairRush.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaPairRushTargets, ARENA_PAIR_COUNTER_TIMING } = await import(`data:text/javascript;base64,${Buffer.from(rushBundle.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'charger', name: '돌진한 선수', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'carried', angle: Math.PI * .47, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, carryStretch: 0, suspension: 0, motionEpoch: 'carry-regression', motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const parts = contacts => [contacts.head, contacts.waist, ...contacts.shoulders, ...contacts.elbows, ...contacts.hands, ...contacts.feet];
const smooth = value => value * value * (3 - 2 * value);

function paint(actor, clock) {
  let matrix, current = [1, 0, 0, 1, 0, 0];
  const stack = [], painted = [];
  const compose = ([a, b, c, d, e, f]) => {
    const [p, q, r, s, x, y] = current;
    current = [p * a + r * b, q * a + s * b, p * c + r * d, q * c + s * d, p * e + r * f + x, q * e + s * f + y];
  };
  const world = (x, y) => ({ x: current[0] * x + current[2] * y + current[4], y: current[1] * x + current[3] * y + current[5] });
  const ctx = {
    save: () => stack.push([...current]), restore: () => { current = stack.pop(); },
    translate: (x, y) => compose([1, 0, 0, 1, x, y]), scale: (x, y) => compose([x, 0, 0, y, 0, 0]),
    rotate: angle => compose([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]),
    transform: (...values) => { matrix = values; compose(values); },
    fillRect: (x, y, width, height) => { for (const px of [x, x + width]) for (const py of [y, y + height]) painted.push(world(px, py)); },
    moveTo: (x, y) => painted.push(world(x, y)), lineTo: (x, y) => painted.push(world(x, y)),
    beginPath() {}, ellipse() {}, fill() {}, closePath() {},
  };
  drawArenaFighter(ctx, actor, clock);
  const [a, b, c, d, e, f] = matrix, determinant = a * d - b * c;
  const local = point => ({ x: (d * (point.x - e) - c * (point.y - f)) / determinant, y: (-b * (point.x - e) + a * (point.y - f)) / determinant });
  const toWorld = point => ({ x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f });
  return { contacts: actor.animation.contactPoints, local, matrix, toWorld, painted };
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

test('the held and flying fighter keeps adult body width and complete world-space limbs throughout unfolding', () => {
  for (const facing of [-1, 1]) for (const side of [-1, 1]) for (let index = 0; index < 10; index++) for (const carryStretch of [0, .25, .5, .75, 1]) for (const suspension of [0, 1]) {
    const actor = fighter({ index, facing, carryStretch, suspension, angle: side * Math.PI * (.47 + .03 * carryStretch), y: suspension ? 274 : 416, motionImmediate: true });
    const { contacts, matrix, toWorld } = paint(actor, 1500);
    assert.ok(Math.abs(Math.hypot(matrix[0], matrix[1]) - actor.scale) < 1e-8, 'turning onto the back cannot compress the torso, face or limb thickness');
    assert.ok(Math.abs(Math.hypot(matrix[2], matrix[3]) - actor.scale) < 1e-8);
    for (let arm = 0; arm < 2; arm++) {
      assert.ok(Math.abs(distance(contacts.shoulders[arm], contacts.elbows[arm]) - 11 * actor.scale) < .001);
      assert.ok(Math.abs(distance(contacts.elbows[arm], contacts.hands[arm]) - 10.5 * actor.scale) < .001, 'flight retains the visible forearm rather than flattening its world projection');
    }
    const { hips, knees, feet } = actor.animation.skeleton;
    assert.ok(Math.abs(distance(toWorld(hips[0]), toWorld(hips[1])) - 9 * actor.scale) < .001, 'the two hips retain the same human width when the body is horizontal');
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(Math.abs(distance(toWorld(hips[leg]), toWorld(knees[leg])) - 11 * actor.scale) < .001);
      assert.ok(Math.abs(distance(toWorld(knees[leg]), toWorld(feet[leg])) - 11 * actor.scale) < .001);
    }
  }
});

test('the complete carried silhouette stays above the floor after restoring its original thickness', () => {
  for (const facing of [-1, 1]) for (const side of [-1, 1]) for (let index = 0; index < 10; index++) for (const carryStretch of [0, .15, .35, .55, .75, 1]) {
    const actor = fighter({ index, facing, carryStretch, angle: side * Math.PI * (.47 + .03 * carryStretch), motionImmediate: true });
    const { painted } = paint(actor, 1500);
    assert.ok(painted.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    assert.ok(Math.max(...painted.map(point => point.y)) <= actor.y + actor.scale, 'all painted limbs, shorts and facial rectangles respect the same floor bounds');
  }
});

test('both carried elbows finish on the outside of their arm lines and raised carriers keep the same natural bend', () => {
  for (const facing of [-1, 1]) for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    for (const pose of ['carried', 'overhead']) {
      const actor = fighter({ index, facing, pose, angle: pose === 'carried' ? side * Math.PI / 2 : 0, carryStretch: pose === 'carried' ? 1 : undefined, suspension: pose === 'carried' ? 1 : 0, overheadRaise: pose === 'overhead' ? 1 : undefined, gripMode: pose === 'overhead' ? 'wrist' : undefined, motionImmediate: true });
      const { contacts, local } = paint(actor, 1500);
      for (let arm = 0; arm < 2; arm++) {
        const shoulder = local(contacts.shoulders[arm]), elbow = local(contacts.elbows[arm]), hand = local(contacts.hands[arm]);
        const cross = (hand.x - shoulder.x) * (elbow.y - shoulder.y) - (hand.y - shoulder.y) * (elbow.x - shoulder.x);
        assert.ok((arm ? cross : -cross) > 0, `${pose}/${index}/${arm}: the elbow cannot fold across the other arm or through the head`);
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

test('an ankle pickup starts from the same actual drag skeleton before either support heel rises', () => {
  for (const facing of [-1, 1]) for (let index = 0; index < 10; index++) {
    const actor = fighter({ index, facing, pose: 'drag', angle: 0, carryStretch: undefined, gripMode: 'ankle', gripTarget: { x: 520, y: 421 }, secondaryGripTarget: { x: 520, y: 411 }, gripStrength: 1, gripLocked: true, motionImmediate: true });
    const low = sampleArenaFighterContacts(actor, 1000);
    const raised = sampleArenaFighterContacts({ ...actor, pose: 'overhead', overheadRaise: 0 }, 1000);
    parts(low).forEach((point, part) => assert.ok(distance(point, parts(raised)[part]) < .001, 'a pose name change cannot lift the shoulders away from the held ankles'));
    low.feet.forEach((point, leg) => assert.ok(distance(point, raised.feet[leg]) < .001));
  }
});

test('sampled holder placement keeps four actual limb holds throughout the full-width lift with complete arms', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) for (let frame = 0; frame <= 50; frame++) {
    const raise = frame / 50, victim = fighter({ index, facing: -side, carryStretch: raise, suspension: raise, y: 416 - raise * 142, angle: side * Math.PI * (.47 + .03 * raise), motionImmediate: true });
    const held = sampleArenaFighterContacts(victim, 1000 + frame * 16);
    for (const gripMode of ['wrist', 'ankle']) {
      const endpoints = gripMode === 'wrist' ? held.hands : held.feet;
      const holder = fighter({ index: (index + 3) % 10, facing: gripMode === 'wrist' ? -side : side, pose: 'overhead', angle: 0, carryStretch: undefined, suspension: 0, overheadRaise: raise, gripMode, motionImmediate: true });
      const saved = structuredClone(holder.animation), ground = arenaCarryHolderPoint(holder, endpoints, 1000 + frame * 16);
      assert.deepEqual(holder.animation, saved, 'placement sampling does not advance the live foot motor');
      Object.assign(holder, ground, { depthY: ground.y, gripTarget: endpoints[0], secondaryGripTarget: endpoints[1], gripStrength: 1, gripLocked: true });
      const { contacts, local } = paint(holder, 1000 + frame * 16);
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(distance(contacts.hands[arm], endpoints[1 - arm]) < .001, `${side}/${index}/${raise}/${gripMode}/${arm}: both actual hands stay on the full-width limb ends`);
        const shoulder = local(contacts.shoulders[arm]), elbow = local(contacts.elbows[arm]), hand = local(contacts.hands[arm]);
        assert.ok(Math.abs(distance(shoulder, elbow) - (11 + raise * 3)) < .001);
        assert.ok(Math.abs(distance(elbow, hand) - (10.5 + raise * 3.5)) < .001);
        if (raise === 1) {
          const ux = shoulder.x - elbow.x, uy = shoulder.y - elbow.y, vx = hand.x - elbow.x, vy = hand.y - elbow.y;
          assert.ok(Math.acos((ux * vx + uy * vy) / (distance(shoulder, elbow) * distance(elbow, hand))) > 145 * Math.PI / 180);
        }
      }
      contacts.feet.forEach(foot => assert.ok(Math.abs(foot.y - (holder.y - 2 * holder.scale)) < .001, 'an overhead lift keeps both real soles planted on the same rendered ground plane'));
    }
  }
});

test('a nearby preferred ground stays within normal step speed while the synchronized full-width body rises', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const round = { id: 'projection', index: 0, tactic: 'double-shove', aggressor: 'arms', helper: 'legs', victim: 'victim', rushOutcome: 'counter-throw', start: 0, impact: ARENA_PAIR_COUNTER_TIMING.release, resolve: 3300, end: 3300, rushLaunchAt: 0, rushContactAt: 0, contactSide: side, timeScale: 1, final: false };
    const previous = [undefined, undefined];
    for (let age = ARENA_PAIR_COUNTER_TIMING.grip; age < ARENA_PAIR_COUNTER_TIMING.release; age += 16) {
      const motion = arenaPairRushTargets(round, age, { x: 500, y: 416 }, { x: 500, y: 416 });
      const victim = fighter({ index, x: motion.victim.x, y: motion.victim.y - motion.lift, angle: motion.victimAngle, facing: motion.chargerFacing, carryStretch: motion.victimCarryStretch, suspension: motion.victimSuspension, motionImmediate: true });
      const held = sampleArenaFighterContacts(victim, age);
      for (let end = 0; end < 2; end++) {
        const endpoints = end ? held.feet : held.hands;
        const holder = fighter({ index: (index + 3) % 10, facing: end ? side : -side, pose: 'overhead', angle: 0, carryStretch: undefined, overheadRaise: motion.overhead, carrierDrive: motion.carrierDrive, gripMode: end ? 'ankle' : 'wrist', motionImmediate: true });
        const ground = arenaCarryHolderPoint(holder, endpoints, age, previous[end]);
        if (previous[end]) assert.ok(distance(ground, previous[end]) / .016 < 165, `${side}/${index}/${age}/${end}: anatomical grip preservation cannot force a faster than normal ground step`);
        Object.assign(holder, ground, { gripTarget: endpoints[0], secondaryGripTarget: endpoints[1], gripStrength: 1, gripLocked: true });
        const actual = sampleArenaFighterContacts(holder, age);
        actual.hands.forEach((hand, arm) => assert.ok(distance(hand, endpoints[1 - arm]) < .001));
        previous[end] = ground;
      }
    }
  }
});

test('an upright escape landing plants both real soles while the slam rig returns to standing perspective', () => {
  for (const facing of [-1, 1]) for (let index = 0; index < 10; index++) for (const yaw of [-.5, 0, .5]) {
    const actor = fighter({ index, facing, yaw, pose: 'land', angle: 0, suspension: 0, carryStretch: undefined, slamProgress: { tuck: 0, slump: 0 }, motionImmediate: true });
    for (let frame = 0; frame <= 60; frame++) {
      actor.slamProgress.slump = frame / 60; actor.phase = frame / 60;
      const { contacts, local } = paint(actor, 1000 + frame * 16);
      for (const sole of contacts.feet) assert.ok(Math.abs(sole.y - (actor.y - 2 * actor.scale)) < 1e-8, 'both planted feet share the actual floor, including asymmetric leg rays');
      const { hips, knees, feet } = actor.animation.skeleton;
      for (let leg = 0; leg < 2; leg++) {
        assert.ok(distance(hips[leg], feet[leg]) <= 21.7 + 1e-8, 'pelvis positioning brings the fixed-length leg into reach before knee projection');
        for (const length of [distance(hips[leg], knees[leg]), distance(knees[leg], feet[leg])]) assert.ok(length >= 7 && length <= 11.005, 'the standing perspective keeps a normal thigh and shin');
      }
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(local(contacts.shoulders[arm]), local(contacts.elbows[arm])) - 11) < .001);
        assert.ok(Math.abs(distance(local(contacts.elbows[arm]), local(contacts.hands[arm])) - 10.5) < .001);
      }
    }
  }
});
