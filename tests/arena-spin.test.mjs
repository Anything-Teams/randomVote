import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaMove, arenaRanks, arenaRounds, arenaSpinTargets, arenaThrow } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter } = await source('src/game/ArenaFighter.ts');
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const round = { id: 'spin', index: 0, tactic: 'spin', aggressor: 'defender', victim: 'attacker', start: 1000, impact: 6000, resolve: 7100, end: 7600, final: false };
const fighter = animation => ({ candidate: { id: 'body', name: '선수', color: '#ffad72' }, index: 0, x: 500, y: 425, scale: 2.04, facing: 1, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, animation });

test('crouching legs bend into depth instead of spreading both knees into an O shape', () => {
  for (const index of [0, 1, 2, 3]) for (const pose of ['guard', 'grapple', 'brace', 'push', 'dodge', 'lift', 'throw']) {
    const animation = createArenaFighterAnimation(), body = { ...fighter(animation), index, pose, phase: .25 };
    for (let at = 0; at <= 600; at += 16) drawArenaFighter(ctx, body, at);
    const { hips, knees, feet } = animation.skeleton;
    for (let leg = 0; leg < 2; leg++) {
      const centerX = (hips[leg].x + feet[leg].x) / 2;
      assert.ok(Math.abs(knees[leg].x - centerX) <= 3.31, `${pose}: knee bend must be foreshortened instead of bulging sideways`);
      assert.ok(distance(hips[leg], knees[leg]) <= 11.01);
      assert.ok(distance(knees[leg], feet[leg]) <= 11.01);
    }
    const projectedWidth = Math.abs(knees[1].x - knees[0].x);
    assert.ok(projectedWidth <= Math.max(Math.abs(hips[1].x - hips[0].x), Math.abs(feet[1].x - feet[0].x)) + 1.4, `${pose}: the two knees do not bow away from their own feet`);
  }
});

test('a defender is briefly lifted, plants fully, changes the grip and then counterthrows the original attacker', () => {
  const at = p => arenaAction(round, round.start + (round.impact - round.start) * p);
  const first = at(.37), planted = at(.44), reversed = at(.51), turning = at(.8), release = at(1);
  assert.equal(first.liftedId, round.aggressor);
  assert.deepEqual(first.attackers, [round.victim]);
  assert.ok(first.lift > 14);
  assert.equal(planted.lift, 0, 'the defender regains the floor before the reverse lift starts');
  assert.equal(reversed.lift, 0);
  assert.equal(turning.liftedId, round.victim);
  assert.deepEqual(turning.attackers, [round.aggressor]);
  assert.ok(turning.actors.every(actor => actor.gripId), 'both bodies remain connected through the turn');
  assert.ok(turning.lift > 11 && turning.lift <= 12, 'a pivot lifts briefly while keeping the waist within hand reach');
  assert.ok(release.actors.every(actor => !actor.gripId), 'the grip is released when the throw starts');
  assert.equal(release.liftedId, round.victim);
  assert.equal(release.lift, 12);
  assert.match(arenaStoryState(round, round.start + 3800).action, /한 바퀴|함께 회전/);
});

test('scheduled waist counters shorten only the revolution by twenty percent and release at its end', () => {
  let finals = 0, preliminaries = 0;
  for (const duration of [44000, 62000]) for (const count of [2, 6]) for (let seed = 0; seed < 80; seed++) {
    const order = Array.from({ length: count }, (_, index) => `quicker-waist-${seed}-${index}`);
    for (const bout of arenaRounds(order, duration, 7, seed).filter(bout => bout.tactic === 'spin')) {
      bout.final ? finals++ : preliminaries++;
      const span = bout.impact - bout.start, preparation = span * bout.spinPreparationFraction;
      const oldSpan = preparation / .52, oldTurnDuration = oldSpan * .48, turnDuration = span - preparation;
      assert.ok(oldSpan / bout.timeScale >= 3100 - 1e-7 && oldSpan / bout.timeScale <= 5000 + 1e-7);
      assert.ok(Math.abs(turnDuration / oldTurnDuration - .80) < 1e-10, 'only the one-turn section is twenty percent shorter');
      assert.ok(Math.abs((bout.resolve - bout.impact) / bout.timeScale - 1100) < 1e-7, 'the flight/landing interval retains its normal pace');
      const original = { ...bout, spinPreparationFraction: undefined, impact: bout.start + oldSpan };
      for (const phase of [.10, .21, .37, .439, .49]) {
        const at = bout.start + oldSpan * phase;
        const before = arenaAction(original, at), after = arenaAction(bout, at);
        assert.equal(after.stage, before.stage, 'the earlier contact/lift/plant beats retain their original timing');
        assert.equal(after.liftedId, before.liftedId); assert.deepEqual(after.attackers, before.attackers);
        assert.ok(Math.abs(after.lift - before.lift) < 1e-7);
        assert.deepEqual(after.actors.map(actor => actor.pose), before.actors.map(actor => actor.pose));
      }
      const target = at => arenaSpinTargets(bout, at, { x: 500, y: 425 });
      assert.ok(target(bout.start + preparation).turn < 1e-20, 'rotation begins after the same preparation time');
      assert.ok(target(bout.impact - 16).turn < 1, 'the turn does not finish early and wait for the throw');
      assert.ok(Math.abs(target(bout.impact).angle - Math.PI * 2) < 1e-8);
      const fastVelocity = (target(bout.impact).angle - target(bout.impact - 16).angle) / 16;
      const oldVelocity = (arenaSpinTargets(original, original.impact, { x: 500, y: 425 }).angle - arenaSpinTargets(original, original.impact - 16, { x: 500, y: 425 }).angle) / 16;
      assert.ok(Math.abs(fastVelocity / oldVelocity - 1.25) < 1e-8);
      assert.ok(arenaAction(bout, bout.impact).actors.every(actor => !actor.gripId), 'both hands release on the completed revolution');
    }
  }
  assert.ok(finals > 0 && preliminaries > 0, 'both final and earlier waist counters are exercised');
});

test('the vertical-axis turn makes one complete local orbit with reachable contact and continuous release', () => {
  for (const span of [2068, 3136, 3450, 5000, 7045]) for (const spinPreparationFraction of [undefined, .52 / .904]) {
    const bout = { ...round, spinPreparationFraction, impact: round.start + span }, center = { x: 500, y: 425 };
    const begin = arenaSpinTargets(bout, bout.start, center);
    const bodies = { defender: { ...begin.defender, facing: 1 }, attacker: { ...begin.attacker, facing: -1 } };
    let prior = begin;
    const signs = new Set();
    for (let at = bout.start; at <= bout.impact; at += 16) {
      const frame = arenaSpinTargets(bout, at, center);
      for (const key of ['defender', 'attacker']) {
        assert.ok(distance(frame[key], prior[key]) < 2.6, 'targets do not teleport around the pivot');
        const before = { ...bodies[key] };
        arenaMove(bodies[key], frame[key], .016, 165);
        assert.ok(distance(before, bodies[key]) <= 165 * .016 + .001);
      }
      assert.ok(distance(bodies.defender, bodies.attacker) < 56, 'the held attacker cannot outrun the defender’s hands');
      if (frame.turn > 0 && frame.turn < 1 && Math.abs(frame.attacker.x - frame.defender.x) > .001 && Math.abs(frame.attacker.y - frame.defender.y) > .001) signs.add(`${Math.sign(frame.attacker.x - frame.defender.x)},${Math.sign(frame.attacker.y - frame.defender.y)}`);
      prior = frame;
    }
    assert.equal(signs.size, 4, 'the body passes through all four quadrants around the defender');
    const end = arenaSpinTargets(bout, bout.impact, center);
    assert.ok(Math.abs(end.angle - Math.PI * 2) < .00001, 'there is exactly one turn');
    const flight = arenaThrow(0, end.attacker, { x: 885, y: 436 }, 1, 1, { lift: 42, angle: -.22 });
    assert.equal(flight.groundX, end.attacker.x);
    assert.equal(flight.groundY, end.attacker.y);
    assert.equal(flight.height, 42, 'release inherits the held height');
  }
});

test('a completed spin keeps angular momentum and releases directly into flight without a contact hold', () => {
  for (const span of [2068, 3450, 5000]) for (const spinPreparationFraction of [undefined, .52 / .904]) {
    const bout = { ...round, spinPreparationFraction, impact: round.start + span }, center = { x: 500, y: 425 };
    const at = time => arenaSpinTargets(bout, time, center);
    const almost = at(bout.impact - 32), last = at(bout.impact - 16), end = at(bout.impact);
    const previousVelocity = (last.angle - almost.angle) / 16, releaseVelocity = (end.angle - last.angle) / 16;
    assert.ok(releaseVelocity > 0);
    assert.ok(Math.abs(releaseVelocity - previousVelocity) < 1e-10, 'the final orbit is not eased down to a stop');
    assert.ok(distance(end.attacker, last.attacker) > .6, 'the body is still travelling at the instant the hands release');
    const preparation = { lift: 12, angle: -.22, immediate: true };
    const landing = { x: 885, y: 436 }, released = arenaThrow(0, end.attacker, landing, 1, 1, preparation), next = arenaThrow(16, end.attacker, landing, 1, 1, preparation);
    assert.equal(released.stage, 'flight'); assert.equal(released.groundX, end.attacker.x); assert.equal(released.groundY, end.attacker.y); assert.equal(released.height, preparation.lift);
    assert.equal(next.stage, 'flight'); assert.ok(distance(released, next) > 1, 'the next frame immediately carries the released body outward');
    const beforeLanding = arenaThrow(879.999, end.attacker, landing, 1, 1, preparation), landed = arenaThrow(880.001, end.attacker, landing, 1, 1, preparation);
    assert.ok(distance(beforeLanding, landed) < .01); assert.ok(Math.abs(beforeLanding.angle - landed.angle) < .001);
    assert.equal(arenaThrow(0, end.attacker, landing).stage, 'hold', 'ordinary stationary throws retain their readable contact beat');
  }
});

test('pivot steps keep a stance heel planted and yaw reveals a back before facing forward again', () => {
  const animation = createArenaFighterAnimation(), body = { ...fighter(animation), pose: 'lift', phase: .8 };
  drawArenaFighter(ctx, body, 0);
  let prior = animation.feet.map(foot => ({ ...foot.ground, swinging: foot.swinging }));
  for (let frame = 1; frame <= 160; frame++) {
    body.yaw = frame / 160 * Math.PI * 2; body.pivotTurn = body.yaw; body.phase = Math.min(1, frame / 85);
    drawArenaFighter(ctx, body, frame * 16);
    const { feet } = animation.skeleton;
    let planted = 0;
    for (let leg = 0; leg < 2; leg++) {
      const memory = animation.feet[leg];
      if (!memory.swinging) {
        const world = { x: body.x + feet[leg].x * body.scale * body.facing, y: body.y + feet[leg].y * body.scale };
        assert.ok(distance(world, memory.ground) < .001);
        assert.ok(memory.lift < .00001, 'the supporting heel has no vertical lift');
        const paintedHeel = animation.contactPoints.feet[leg];
        assert.ok(distance({ x: paintedHeel.x, y: paintedHeel.y + 2 * body.scale }, memory.ground) < .001, 'the painted support heel stays on its actual sand contact');
        if (!prior[leg].swinging) assert.ok(distance(memory.ground, prior[leg]) < .001);
        assert.ok(distance(memory.ground, prior[leg]) < 1.7, 'a pivot landing cannot snap a heel');
        planted++;
      }
      assert.ok(distance(animation.skeleton.knees[leg], animation.skeleton.hips[leg]) <= 11.01);
      assert.ok(distance(memory.ground, prior[leg]) < 1.7, 'pivot swing stays continuous');
      prior[leg] = { ...memory.ground, swinging: memory.swinging };
    }
    assert.ok(planted >= 1, 'every pivot has a support foot on the floor');
  }
  for (let leg = 0; leg < 2; leg++) {
    const memory = animation.feet[leg], paintedHeel = animation.contactPoints.feet[leg];
    // The two planted points can have different screen depths around the pivot.
    assert.ok(memory.lift < .00001, 'both feet finish the turn without hovering');
    assert.ok(distance({ x: paintedHeel.x, y: paintedHeel.y + 2 * body.scale }, memory.ground) < .001, 'each finished heel touches its own projected floor point');
  }
  body.pose = 'throw'; body.pivotTurn = undefined; body.yaw = 0;
  for (let at = 2576; at <= 3000; at += 16) {
    drawArenaFighter(ctx, body, at);
    for (let leg = 0; leg < 2; leg++) {
      assert.ok(distance(animation.feet[leg].ground, prior[leg]) < 1.7, 'releasing and recovering cannot snap the feet');
      prior[leg] = { ...animation.feet[leg].ground };
    }
  }
  const eyesAt = yaw => {
    let eyes = 0;
    drawArenaFighter({ ...ctx, fillRect: () => { if (visual.fillStyle === '#172b37') eyes++; }, get fillStyle() { return visual.fillStyle; }, set fillStyle(value) { visual.fillStyle = value; } }, { ...fighter(createArenaFighterAnimation()), yaw }, 0);
    return eyes;
  };
  const visual = { fillStyle: '' };
  assert.ok(eyesAt(0) > 0);
  assert.equal(eyesAt(Math.PI), 0, 'the back view cannot retain face pixels');
  assert.ok(eyesAt(Math.PI * 2) > 0);
});

test('occasional spin counters preserve drawn places and never add a third fighter', () => {
  let finals = 0, spins = 0;
  for (let variation = 0; variation < 160; variation++) {
    const order = [`a-${variation}`, `b-${variation}`, `c-${variation}`];
    const rounds = arenaRounds(order); finals++;
    const final = rounds.at(-1);
    if (final.tactic === 'spin') spins++;
    for (const bout of rounds.filter(bout => bout.tactic === 'spin')) {
      assert.equal(bout.helper, undefined);
      assert.deepEqual(arenaAction(bout, bout.impact).actors.map(actor => actor.id), [bout.aggressor, bout.victim]);
      assert.equal(arenaAction(bout, bout.impact).liftedId, bout.victim);
    }
    assert.deepEqual(arenaRanks(order, 44000), Object.fromEntries(order.map((id, i) => [id, i + 1])));
  }
  assert.ok(spins >= 5 && spins < finals * .2, 'the counter is an occasional surprise, not every final');
  assert.equal(arenaRounds(['3', '2', '1']).at(-1).tactic, 'spin', 'the development preview has a repeatable three-person counter');
});
