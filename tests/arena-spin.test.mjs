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

test('the vertical-axis turn makes one complete local orbit with reachable contact and continuous release', () => {
  for (const span of [2068, 3136, 3450, 5000, 7045]) {
    const bout = { ...round, impact: round.start + span }, center = { x: 500, y: 425 };
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
      if (frame.turn > 0 && frame.turn < 1) signs.add(`${Math.sign(frame.attacker.x - frame.defender.x)},${Math.sign(frame.attacker.y - frame.defender.y)}`);
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
