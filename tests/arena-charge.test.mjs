import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaChargeState, arenaChargeTargets, arenaChargeFall, arenaExitDirection, arenaMove, arenaRanks, arenaRounds } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter } = await source('src/game/ArenaFighter.ts');
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const ringRadius = point => (point.x - 500) ** 2 / 303 ** 2 + (point.y - 416) ** 2 / 112 ** 2;

test('a two-person final can end with an avoided charge while preserving the drawn winner', () => {
  for (const duration of [40_000, 44_000, 62_000]) {
    const order = ['1', '2'], round = arenaRounds(order, duration).at(-1), span = round.impact - round.start;
    assert.equal(round.tactic, 'bait');
    assert.ok(round.final);
    assert.equal(arenaChargeState(round, round.start + span * .25).stage, 'prepare');
    assert.equal(arenaChargeState(round, round.impact - 1000).stage, 'charge');
    assert.equal(arenaChargeState(round, round.impact - 300).stage, 'dodge');
    const action = arenaAction(round, round.impact - 300);
    assert.equal(action.actors.find(part => part.id === '1').pose, 'dodge');
    assert.equal(action.actors.find(part => part.id === '2').pose, 'run');
    assert.deepEqual(action.attackers, ['2']);
    assert.equal(action.targetId, '1');
    assert.equal(action.lift, 0);
    assert.equal(action.liftedId, undefined);
    assert.notEqual(arenaAction(round, round.impact + 50).actors.find(part => part.id === '1').pose, 'throw');
    assert.match(arenaStoryState(round, round.impact + 50).action, /경계선/);
    assert.deepEqual(arenaRanks(order, round.resolve - .001, duration), {});
    assert.deepEqual(arenaRanks(order, round.resolve, duration), { 1: 1, 2: 2 });
  }
});

test('charges build speed before the sidestep and the target remains on the sand', () => {
  const round = arenaRounds(['1', '2']).at(-1), span = round.impact - round.start;
  for (const center of [{ x: 325, y: 350 }, { x: 675, y: 350 }, { x: 325, y: 490 }, { x: 675, y: 490 }]) {
    let previous = arenaChargeTargets(round, round.start, center);
    for (let at = round.start + 16; at <= round.impact; at += 16) {
      const current = arenaChargeTargets(round, at, center);
      assert.ok(current.side * (current.charger.x - previous.charger.x) >= -1e-8, 'the charger continues forward');
      assert.ok(ringRadius(current.target) < 1, 'the evading winner remains in the arena');
      assert.ok(Math.hypot(current.target.x - previous.target.x, current.target.y - previous.target.y) < 2.65, 'the evasion stays within a natural running speed');
      previous = current;
    }
    const beforeRun = arenaChargeTargets(round, round.start + span * .3, center);
    assert.equal(beforeRun.charge, 0);
    const missed = arenaChargeTargets(round, round.impact, center);
    assert.ok(Math.abs(missed.target.y - missed.charger.y) >= 42, 'the charger visibly passes beside the opponent');
    assert.ok(ringRadius(missed.charger) < 1, 'the charging feet reach the edge before falling');
  }
});

test('a missed charge continues across the edge and falls down without a generic upward throwing arc', () => {
  const round = arenaRounds(['1', '2']).at(-1);
  for (const unit of [40 / 44, 1, 62 / 44]) for (const center of [{ x: 325, y: 350 }, { x: 675, y: 490 }]) {
    const { charger: origin, side } = arenaChargeTargets(round, round.impact, center);
    assert.equal(arenaExitDirection(round, origin, 0), side, 'even the final loser falls through the edge they charged toward');
    const landing = { x: side < 0 ? 115 : 885, y: Math.max(436, origin.y + 40) };
    const velocity = side * 110 / unit;
    let previous = arenaChargeFall(0, origin, landing, side, unit, velocity);
    assert.equal(previous.stage, 'overrun');
    assert.deepEqual({ x: previous.x, y: previous.y }, origin);
    for (let age = 16 * unit; age < 1100 * unit; age += 16 * unit) {
      const frame = arenaChargeFall(age, origin, landing, side, unit, velocity);
      assert.ok(side * (frame.x - previous.x) >= -1e-8, 'momentum carries the loser outwards');
      assert.equal(frame.height, 0, 'there is no lifting or upward throw');
      assert.ok(frame.y >= origin.y - .01, 'the loser falls below the edge instead of popping upward');
      assert.ok(Math.hypot(frame.x - previous.x, frame.y - previous.y) < 6, 'the fall does not jump between positions');
      previous = frame;
    }
    assert.ok(ringRadius(arenaChargeFall(250 * unit, origin, landing, side, unit, velocity)) > 1, 'the feet have passed outside before the drop');
    assert.equal(arenaChargeFall(880 * unit, origin, landing, side, unit, velocity).stage, 'land');
    assert.equal(arenaChargeFall(1100 * unit, origin, landing, side, unit, velocity).stage, 'roll');
    assert.equal(arenaChargeFall(2100 * unit, origin, landing, side, unit, velocity).stage, 'walk');
  }
});

test('running starts with gradual acceleration and the first foot does not jump to the middle of a stride', () => {
  const body = { x: 500, y: 425, facing: 1 }, animation = createArenaFighterAnimation();
  const actor = { candidate: { id: 'runner', name: '돌진 선수', color: '#ffad72' }, index: 0, ...body, scale: 2, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, animation, motionEpoch: 1 };
  drawArenaFighter(ctx, actor, 0);
  const originalFeet = animation.feet.map(foot => ({ ...foot.ground }));
  let speed = 0;
  for (let frame = 1; frame <= 24; frame++) {
    const previous = { ...body };
    arenaMove(body, { x: 1000, y: 425 }, .016, 165);
    const currentSpeed = (body.x - previous.x) / .016;
    assert.ok(currentSpeed >= speed && currentSpeed - speed < 10, 'the start builds momentum over several frames');
    actor.x = body.x; actor.y = body.y; actor.velocityX = currentSpeed; actor.gaitDistance += body.x - previous.x; actor.pose = 'run';
    drawArenaFighter(ctx, actor, frame * 16);
    if (frame === 1) {
      for (let leg = 0; leg < 2; leg++) assert.ok(Math.hypot(animation.feet[leg].ground.x - originalFeet[leg].x, animation.feet[leg].ground.y - originalFeet[leg].y) < .5, 'the first foot stays connected to its planted position');
      assert.ok(animation.feet.every(foot => foot.lift < .2));
    }
    speed = currentSpeed;
  }
  assert.ok(speed > 150, 'the gradual start still reaches a visible run');
  const paused = structuredClone(body);
  arenaMove(body, { x: 1000, y: 425 }, 0, 165);
  assert.deepEqual(body, paused, 'pause freezes momentum and position');
});
