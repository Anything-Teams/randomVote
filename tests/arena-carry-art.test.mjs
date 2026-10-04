import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts, arenaCarryHolderPoint } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rushBundle = await build({ entryPoints: ['src/arenaPairRush.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaPairRushTargets } = await import(`data:text/javascript;base64,${Buffer.from(rushBundle.outputFiles[0].text).toString('base64')}`);
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const fighter = overrides => ({ candidate: { id: 'fighter', name: '선수', color: '#ffad72' }, index: 1, x: 500, y: 416, depthY: 416, scale: 2.04, facing: -1, pose: 'carried', angle: Math.PI / 2, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, motionImmediate: true, animation: createArenaFighterAnimation(), ...overrides });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const parts = contacts => [contacts.head, contacts.waist, ...contacts.hands, ...contacts.feet];
const overheadPlacement = (ends, facing, index = 1, gripMode = 'wrist') => arenaCarryHolderPoint(fighter({ index, facing, pose: 'overhead', overheadRaise: 1, angle: 0, gripMode }), ends, 2000);

test('the shoulder-supported body rests both arms beside its torso and straightens both complete legs', () => {
  for (const side of [-1, 1]) {
    const source = fighter({ angle: side * Math.PI / 2, facing: -side, carryStretch: 0, carrySupport: 'shoulder' });
    const stunned = { ...source, pose: 'stunned', carryStretch: undefined, animation: createArenaFighterAnimation() };
    assert.deepEqual(sampleArenaFighterContacts(source, 1000), sampleArenaFighterContacts(stunned, 1000), 'the two-person grip begins in the existing floor pose');
    const body = fighter({ angle: side * Math.PI / 2, facing: -side, carryStretch: 1, carrySupport: 'shoulder', y: 304, suspension: 1 });
    drawArenaFighter(ctx, body, 2000);
    const contacts = body.animation.contactPoints, { hips, knees, feet } = body.animation.skeleton;
    assert.ok(contacts.hands.every(point => side * (point.x - contacts.head.x) < -45), 'the supported arms rest toward the hips instead of stretching past the head');
    assert.equal(body.animation.motion.shoulderLift, 0, 'the shoulders stay on the torso instead of being pulled into a wrist hold');
    assert.ok(contacts.feet.every(point => side * (point.x - contacts.waist.x) < -8), 'both ankles extend from the other end of the horizontal body');
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(Math.abs(distance(hips[leg], feet[leg]) - 21.98) < .001);
      assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001);
      assert.ok(Math.abs(distance(knees[leg], feet[leg]) - 11) < .001);
    }
  }
});

test('both helpers support the actual shoulders and ankles with grounded raised palms', () => {
  for (const side of [-1, 1]) {
    const victim = fighter({ index: 2, angle: side * Math.PI / 2, facing: -side, carryStretch: 1, carrySupport: 'shoulder', y: 279, depthY: 421, suspension: 1 });
    const contacts = sampleArenaFighterContacts(victim, 2000);
    for (const [index, facing, ends, gripMode] of [[1, -side, contacts.shoulders, 'shoulder'], [3, side, contacts.feet, 'ankle']]) {
      const holder = fighter({ index, ...overheadPlacement(ends, facing, index, gripMode), facing, pose: 'overhead', overheadRaise: 1, angle: 0, gripMode, gripTarget: ends[0], secondaryGripTarget: ends[1], gripStrength: 1, gripLocked: true });
      drawArenaFighter(ctx, holder, 2000);
      const held = holder.animation.contactPoints;
      assert.ok(distance(held.hands[0], ends[1]) < .001, 'the far hand actually holds the second limb');
      assert.ok(distance(held.hands[1], ends[0]) < .001, 'the near hand actually holds the first limb');
      assert.ok(held.hands.every(point => point.y < held.head.y + holder.scale * 10), 'both shoulder-support palms stay above the carrier face');
      assert.ok(contacts.waist.y < held.head.y, 'the shoulder-supported body clears the carrier face');
      assert.ok(holder.animation.feet.every(foot => foot.lift === 0), 'the carrier cannot float to reach the held body');
    }
  }
});

test('the two overhead helpers lift with extended supported arms instead of folding one elbow across the head', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const victim = fighter({ index, angle: side * Math.PI / 2, facing: -side, carryStretch: 1, carrySupport: 'shoulder', y: 279, depthY: 421, suspension: 1 });
    const points = sampleArenaFighterContacts(victim, 2000);
    for (const [facing, ends, gripMode] of [[-side, points.shoulders, 'shoulder'], [side, points.feet, 'ankle']]) {
      const body = fighter({ index: (index + 3) % 10, ...overheadPlacement(ends, facing, index, gripMode), facing, pose: 'overhead', overheadRaise: 1, carrierDrive: 1, angle: 0, carryStretch: undefined, gripMode, gripTarget: ends[0], secondaryGripTarget: ends[1], gripStrength: 1, gripLocked: true });
      Object.assign(body, arenaCarryHolderPoint(body, ends, 2000));
      drawArenaFighter(ctx, body, 2000);
      const contacts = body.animation.contactPoints;
      for (let arm = 0; arm < 2; arm++) {
        const elbow = contacts.elbows[arm], shoulder = contacts.shoulders[arm], hand = contacts.hands[arm];
        const a = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y }, b = { x: hand.x - elbow.x, y: hand.y - elbow.y };
        const angle = Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y))))) * 180 / Math.PI;
        assert.ok(angle > 145, `the supported elbow stays nearly extended instead of overfolding: ${gripMode}, ${index}, ${angle}`);
        assert.ok(distance(hand, ends[1 - arm]) < .001, 'straightening an arm cannot detach its actual limb hold');
        assert.ok(Math.abs(distance(shoulder, elbow) - 11 * body.scale) < .001 && Math.abs(distance(elbow, hand) - 10.5 * body.scale) < .001, 'the extended arm retains its ordinary anatomical lengths');
      }
      assert.ok(body.animation.feet.every(foot => foot.lift === 0), 'body load remains on the support soles while both arms lift');
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

test('zero carry progress keeps the rushing fighter grounded with alternating steps in every direction', () => {
  for (const [vx, vy] of [[0, -165], [0, 165], [-100, -130], [100, 130]]) {
    const animation = createArenaFighterAnimation();
    const body = fighter({ pose: 'run', angle: 0, facing: vx < 0 ? -1 : 1, carryStretch: 0, suspension: 0, velocityX: vx, velocityY: vy, chargeStrength: 1, animation, motionImmediate: false });
    let swings = [0, 0], previous = [false, false], highest = 0;
    for (let frame = 0; frame < 120; frame++) {
      body.x += vx * .016; body.y += vy * .016; body.gaitDistance += Math.hypot(vx, vy) * .016;
      drawArenaFighter(ctx, body, frame * 16);
      assert.equal(animation.airborne, false, 'the carry field cannot freeze a still-running charge into a held pose');
      for (let leg = 0; leg < 2; leg++) {
        const foot = animation.feet[leg];
        if (foot.swinging && !previous[leg]) swings[leg]++;
        highest = Math.max(highest, foot.lift);
        previous[leg] = foot.swinging;
        assert.ok(animation.skeleton.feet[leg].y !== undefined);
      }
    }
    assert.ok(swings.every(count => count >= 3), `both feet take repeated running steps for ${vx}, ${vy}: ${swings}`);
    assert.ok(highest > 1.2, 'vertical running visibly lifts each foot clear of the sand');
  }
});

test('the thrown carry body keeps its thickness when flight yaw crosses an edge-on turn', () => {
  for (const angle of [-2, -Math.PI / 2, 0, Math.PI / 2, 2]) for (const stretch of [.4, .8, 1]) {
    const source = fighter({ pose: 'airborne', angle, carryStretch: stretch, suspension: 1, yaw: 0 });
    const original = sampleArenaFighterContacts(source, 2000);
    for (const yaw of [-Math.PI / 2, Math.PI / 2, Math.PI]) {
      const scales = [], matrices = [], draw = { ...ctx, scale: (x, y) => scales.push([x, y]), transform: (...matrix) => matrices.push(matrix) };
      const flight = { ...source, yaw, animation: createArenaFighterAnimation() };
      drawArenaFighter(draw, flight, 2000);
      assert.deepEqual(flight.animation.contactPoints, original, 'airborne yaw cannot add a second squeeze to the carry projection');
      assert.equal(scales[0][0], 1, 'the torso retains its full width inside the single carry transform');
      assert.ok(Math.hypot(matrices[0][0], matrices[0][1]) >= source.scale * .5 - .000001, 'the held and flying body never collapses below its intended half-depth thickness');
    }
  }
});

test('a released shared body relaxes both arms and knees without changing the release pose or bone lengths', () => {
  for (const side of [-1, 1]) {
    const body = fighter({ facing: -side, angle: side * Math.PI / 2, carryStretch: 1, carrySupport: 'shoulder', suspension: 1 });
    const held = sampleArenaFighterContacts(body, 2000);
    assert.deepEqual(sampleArenaFighterContacts({ ...body, carryFlight: 0 }, 2000), held, 'free flight starts at the exact supported pose');
    assert.deepEqual(sampleArenaFighterContacts({ ...body, carryFlight: .06 }, 2000), held, 'the helpers clear the released body before its limbs relax');
    const animation = createArenaFighterAnimation();
    let previous, middle;
    for (let frame = 0; frame <= 60; frame++) {
      const free = { ...body, animation, carryFlight: frame / 60 };
      drawArenaFighter(ctx, free, 2000 + frame * 16);
      const { rig, skeleton, contactPoints } = animation;
      rig.hands.forEach((hand, arm) => {
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11) < .001);
        assert.ok(Math.abs(distance(rig.elbows[arm], hand) - 10.5) < .001);
      });
      skeleton.feet.forEach((foot, leg) => {
        assert.ok(Math.abs(distance(skeleton.hips[leg], skeleton.knees[leg]) - 11) < .001);
        assert.ok(Math.abs(distance(skeleton.knees[leg], foot) - 11) < .001);
      });
      if (previous) parts(contactPoints).forEach((point, index) => assert.ok(distance(point, parts(previous)[index]) < 4, 'released limbs move continuously through the arc'));
      if (frame === 30) middle = structuredClone(contactPoints);
      previous = structuredClone(contactPoints);
    }
    assert.ok(distance(middle.hands[0], held.hands[0]) > 4 && distance(middle.feet[0], held.feet[0]) > 4, 'the free body visibly bends an arm and knee instead of staying rigid');
  }
});

test('the soccer slide enters from the running rig then reclines deeply over a bent support leg', () => {
  for (const facing of [-1, 1]) {
    const animation = createArenaFighterAnimation();
    const body = fighter({ facing, pose: 'run', angle: 0, animation, motionImmediate: false, velocityX: facing * 145, carryStretch: undefined });
    for (let frame = 0; frame <= 30; frame++) { body.gaitDistance = frame * 145 * .016; drawArenaFighter(ctx, body, 1000 + frame * 16); }
    const running = structuredClone(animation.contactPoints);
    body.pose = 'slide'; body.slideProgress = 0;
    drawArenaFighter(ctx, body, 1480);
    parts(running).forEach((point, index) => assert.ok(distance(point, parts(animation.contactPoints)[index]) < .001, 'the first sliding frame retains the actual running body'));
    for (let frame = 1; frame <= 60; frame++) { body.slideProgress = frame / 60; drawArenaFighter(ctx, body, 1480 + frame * 16); }
    assert.ok(animation.motion.lean < -50 && animation.motion.crouch > 14, 'the torso lies back close to the sand');
    const { hips, knees, feet } = animation.skeleton;
    assert.ok(feet[1].x - hips[1].x > 18, 'the leading foot drives deep into the tackle');
    assert.ok(distance(hips[0], feet[0]) < 10, 'the other leg stays folded as floor support');
    feet.forEach((foot, leg) => {
      assert.ok(Math.abs(distance(hips[leg], knees[leg]) - 11) < .001);
      assert.ok(Math.abs(distance(knees[leg], foot) - 11) < .001);
    });
  }
});

test('a grounded departure turns the landing arms smoothly at normal bone lengths and full body width', () => {
  for (const facing of [-1, 1]) {
    const animation = createArenaFighterAnimation(), matrices = [];
    const body = fighter({ facing, pose: 'land', angle: 0, phase: 1, carryStretch: undefined, suspension: 0, animation, motionImmediate: false });
    const canvas = { ...ctx, transform: (...matrix) => matrices.push(matrix) };
    drawArenaFighter(canvas, body, 2000);
    let prior = structuredClone(animation.contactPoints);
    body.pose = 'run'; body.facing = -facing; body.velocityX = -facing * 145;
    for (let frame = 1; frame <= 20; frame++) {
      body.x += body.velocityX * .016; body.gaitDistance += 145 * .016;
      const saved = structuredClone(animation), predicted = sampleArenaFighterContacts(body, 2000 + frame * 16);
      assert.deepEqual(animation, saved, 'sampling the landing handoff cannot advance its captured angle history');
      drawArenaFighter(canvas, body, 2000 + frame * 16);
      assert.deepEqual(animation.contactPoints, predicted);
      const joints = animation.contactPoints;
      [...joints.shoulders, ...joints.elbows, ...joints.hands].forEach((point, index) => assert.ok(distance(point, [...prior.shoulders, ...prior.elbows, ...prior.hands][index]) < 18.8, 'turning and lowering the hands stays continuous through the complete departure'));
      joints.hands.forEach((hand, arm) => {
        if (animation.landingArms) {
          assert.ok(Math.abs(distance(joints.shoulders[arm], joints.elbows[arm]) - 11 * body.scale) < .001);
          assert.ok(Math.abs(distance(joints.elbows[arm], hand) - 10.5 * body.scale) < .001);
        }
      });
      const matrix = matrices.at(-1);
      assert.ok(Math.abs(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) - body.scale ** 2) < .001, 'the turn preserves full torso thickness');
      prior = structuredClone(joints);
    }
  }
});

test('a lifted elbow hits the supplied head contact with a connected folded forearm', () => {
  for (const facing of [-1, 1]) for (const angle of [-.2, 0, .2]) {
    const body = fighter({ pose: 'elbow', facing, angle, carryStretch: undefined, suspension: 1, y: 370 });
    const shoulder = sampleArenaFighterContacts(body, 2000).shoulders[1];
    body.elbowTarget = { x: shoulder.x + facing * body.scale * 5, y: shoulder.y + body.scale * 8 };
    body.elbowStrength = 1;
    drawArenaFighter(ctx, body, 2000);
    const contacts = body.animation.contactPoints;
    assert.ok(distance(contacts.elbows[1], body.elbowTarget) < .000001, 'the actual elbow reaches the head instead of moving a fist near it');
    assert.ok(distance(contacts.shoulders[1], contacts.elbows[1]) <= 11 * body.scale + .001);
    assert.ok(Math.abs(distance(contacts.elbows[1], contacts.hands[1]) - 10.5 * body.scale) < .001, 'the connected forearm cannot shorten during impact');
    assert.ok(distance(contacts.hands[1], body.elbowTarget) > 18, 'the palm remains folded away from the elbow contact');
  }
});

test('the scoop loads both knees and sweeps both hands above the head before a forward release', () => {
  for (const facing of [-1, 1]) {
    const actor = stroke => fighter({ pose: 'scoop', angle: 0, facing, scoopStroke: stroke, carryStretch: undefined });
    const loaded = actor(0), high = actor(.72), released = actor(1);
    drawArenaFighter(ctx, loaded, 1000); drawArenaFighter(ctx, high, 1400); drawArenaFighter(ctx, released, 1600);
    const from = loaded.animation.contactPoints, up = high.animation.contactPoints;
    assert.ok(loaded.animation.motion.crouch > 8 && high.animation.motion.crouch < 1.1, 'the scoop uses a knee load and complete leg drive');
    assert.ok(from.hands.every(point => point.y > from.waist.y - 10), 'both arms begin low enough to get under the two bodies');
    assert.ok(up.hands.every(point => point.y < up.head.y + 7), 'both arms visibly sweep up beside the head');
    assert.ok(up.hands.every((point, index) => point.y < from.hands[index].y - 55), 'the arm sweep has a readable lifting range');
    assert.ok(released.animation.motion.lean > 18 && released.animation.motion.hipX > high.animation.motion.hipX, 'the pelvis and shoulders carry the release forward');
    const heels = from.feet;
    for (const body of [high, released]) body.animation.contactPoints.feet.forEach((point, leg) => assert.ok(distance(point, heels[leg]) < .001, 'the lifting effort cannot float either support sole'));
  }
});

test('the shared throw keeps all four limb holds through body transfer and release follow-through', () => {
  for (const side of [-1, 1]) for (const carrierDrive of [.8, .9, 1]) {
    const victim = fighter({ index: 2, angle: side * Math.PI / 2, facing: -side, carryStretch: 1, carrySupport: 'shoulder', y: 279, depthY: 421, suspension: 1 });
    const contacts = sampleArenaFighterContacts(victim, 2000);
    for (const [index, facing, ends, gripMode] of [[1, -side, contacts.shoulders, 'shoulder'], [3, side, contacts.feet, 'ankle']]) {
      const body = fighter({ index, ...overheadPlacement(ends, facing, index), facing, pose: 'overhead', overheadRaise: 1, carrierDrive, angle: 0, gripMode, gripTarget: ends[0], secondaryGripTarget: ends[1], gripStrength: 1, gripLocked: true });
      drawArenaFighter(ctx, body, 2000);
      const points = body.animation.contactPoints;
      assert.ok(distance(points.hands[0], ends[1]) < .001 && distance(points.hands[1], ends[0]) < .001, 'neither actual hand can detach from the held shoulder or ankle during the weight transfer');
      assert.ok(body.animation.feet.every(foot => foot.lift === 0));
      if (carrierDrive === 1) {
        const released = { ...body, gripTarget: undefined, secondaryGripTarget: undefined, gripStrength: 0, animation: createArenaFighterAnimation() };
        drawArenaFighter(ctx, released, 2016);
        assert.ok(released.animation.motion.lean > body.animation.motion.lean + 6 && released.animation.motion.hipX >= 2, 'each holder follows the released body through the chest and pelvis');
        assert.ok(released.animation.feet.every(foot => foot.lift === 0), 'release continues through the support legs instead of levitating');
      }
    }
  }
});

test('the front kick chambers its knee, hits with a straightening shin and retracts onto the same stance', () => {
  for (const facing of [-1, 1]) {
    const animation = createArenaFighterAnimation(), target = { x: 500 + facing * 38, y: 402 };
    const body = fighter({ pose: 'trip', angle: 0, facing, carryStretch: undefined, frontKick: 0, kickLeg: 1, footTarget: target, footStrength: 0, animation, motionImmediate: false });
    drawArenaFighter(ctx, body, 1000);
    const support = { ...animation.contactPoints.feet[0] }, rest = { ...animation.contactPoints.feet[1] };
    let raised, strike, retracted;
    for (let frame = 1; frame <= 100; frame++) {
      body.frontKick = frame / 100;
      drawArenaFighter(ctx, body, 1000 + frame * 8);
      assert.ok(distance(animation.contactPoints.feet[0], support) < .001, 'the balancing leg keeps its planted sole through the entire kick');
      if (frame === 40) raised = structuredClone(animation);
      if (frame === 62) strike = structuredClone(animation);
      if (frame === 78) retracted = structuredClone(animation);
    }
    assert.ok(raised.skeleton.knees[1].y < raised.skeleton.hips[1].y - 7, 'the thigh actually lifts its bent knee before the kick');
    assert.ok(raised.skeleton.feet[1].y > raised.skeleton.knees[1].y + 8, 'the shin stays folded below the raised knee in the chamber');
    assert.ok(distance(strike.contactPoints.feet[1], target) < .001, 'the foot reaches the actual fallen opponent at the strike phase');
    assert.ok(distance(strike.skeleton.hips[1], strike.skeleton.feet[1]) > distance(raised.skeleton.hips[1], raised.skeleton.feet[1]) + 10, 'the shin snaps outward instead of a rigid straight leg sliding through the kick');
    assert.ok(retracted.skeleton.knees[1].y < retracted.skeleton.hips[1].y - 7, 'the knee folds again immediately after contact');
    assert.ok(distance(animation.contactPoints.feet[1], rest) < .001, 'the kicking sole returns to its own original stance');
  }
});

test('the joint throw keeps actual shoulder and ankle contact throughout its complete lifting stroke', () => {
  for (const side of [-1, 1]) {
    const round = { id: 'carry-drive', index: 0, aggressor: 'arms', victim: 'victim', helper: 'legs', tactic: 'double-shove', rushOutcome: 'counter-throw', start: 0, impact: 8000, resolve: 9100, end: 10_000, final: false, contactSide: side };
    for (let at = 4500; at < round.impact; at += 32) {
      const motion = arenaPairRushTargets(round, at, { x: 500, y: 416 });
      if (motion.grip !== 'arms-legs') continue;
      const victim = fighter({ pose: 'carried', x: motion.victim.x, y: motion.victim.y - motion.lift, facing: -side, angle: motion.victimAngle, carryStretch: motion.victimCarryStretch, carrySupport: 'shoulder', suspension: motion.victimSuspension });
      const ends = sampleArenaFighterContacts(victim, at);
      for (const [point, facing, pair, gripMode] of [[motion.aggressor, -side, ends.shoulders, 'shoulder'], [motion.helper, side, ends.feet, 'ankle']]) {
        const holder = fighter({ pose: 'overhead', x: point.x, y: point.y, facing, angle: 0, carryStretch: undefined, overheadRaise: motion.overhead, carrierDrive: motion.carrierDrive, gripMode, gripTarget: pair[0], secondaryGripTarget: pair[1], gripStrength: 1, gripLocked: true });
        Object.assign(holder, arenaCarryHolderPoint(holder, pair, at));
        const held = sampleArenaFighterContacts(holder, at);
        assert.ok(distance(held.hands[0], pair[1]) < .001 && distance(held.hands[1], pair[0]) < .001, `the weight transfer keeps all four real holds at ${at}ms`);
      }
    }
  }
});

test('an ankle drag keeps adult standing leg height while the waist bends down to both real foot ends', () => {
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const fallen = fighter({ index, pose: 'stunned', facing: -side, angle: -side * Math.PI * .47, carryStretch: undefined, suspension: 0 });
    const feet = sampleArenaFighterContacts(fallen, 7990).feet;
    const holder = fighter({ index: (index + 1) % 10, x: (feet[0].x + feet[1].x) / 2 + side * 32, y: (feet[0].y + feet[1].y) / 2 + 24, facing: -side, pose: 'drag', angle: 0, carryStretch: undefined, gripMode: 'ankle', gripTarget: feet[0], secondaryGripTarget: feet[1], gripStrength: 1, gripLocked: true });
    drawArenaFighter(ctx, holder, 7990);
    const rig = holder.animation.skeleton, contact = holder.animation.contactPoints;
    assert.ok(holder.animation.motion.crouch < 6 && holder.animation.motion.lean > 45, 'an adult bends at the waist instead of dropping its pelvis almost to the floor');
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(rig.hips[leg].y < -15 && distance(rig.hips[leg], rig.feet[leg]) > 15, 'both standing legs retain their normal visible height');
      assert.equal(holder.animation.feet[leg].lift, 0, 'reaching the toes cannot float the support soles');
      assert.ok(distance(contact.hands[1 - leg], feet[leg]) < .001, 'a taller stance keeps each actual hand on its held foot end');
      assert.ok(Math.abs(distance(contact.shoulders[leg], contact.elbows[leg]) - 11 * holder.scale) < .001 && Math.abs(distance(contact.elbows[leg], contact.hands[leg]) - 10.5 * holder.scale) < .001, 'neither connected arm section can shrink to reach the opponent');
    }
  }
});
