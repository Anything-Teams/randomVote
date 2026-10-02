import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildRacingTimeline, createRacingIncidents, readRacingDistance, racingStandings, racingIncidentRecovery, racingIncidentSetback, racingTrickRecoveryStart, racingTrickLoss, racingObstacleLoss } = await source('src/racingNarrative.ts');
const { racingIncidentMotion, racingTrickMotion } = await source('src/racingEffects.ts');
const { racingObstacleMotion, racingObstacleStatus } = await source('src/racingObstacles.ts');
const players = Array.from({ length: 10 }, (_, index) => ({ id: `player-${index}`, name: `선수 ${index}`, color: '#abcdef' }));
const pace = (timeline, id, at) => (readRacingDistance(timeline, id, at + 8) - readRacingDistance(timeline, id, at - 8)) / 16;

test('a hit keeps its lost ground while the rider steadies, then earns it back with one continuous pursuit', () => {
  for (const count of [2, 6, 10]) for (const seed of [0, 1, 17]) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    assert.ok(timeline.tricks[1].start >= timeline.tricks[0].recovered, 'the next attack cannot replace an unfinished recovery pose');
    for (const trick of timeline.tricks) {
      const catchup = racingTrickRecoveryStart(trick), without = { ...timeline, tricks: timeline.tricks.filter(item => item !== trick) };
      assert.ok(catchup - trick.lowest >= 750, 'the maximum gap remains readable for at least three quarters of a second');
      for (const at of [trick.lowest, (trick.lowest + catchup) / 2, catchup]) {
        assert.equal(racingTrickLoss(trick, at), trick.loss);
        assert.ok(Math.abs(readRacingDistance(without, trick.targetId, at) - readRacingDistance(timeline, trick.targetId, at) - trick.loss) < 1e-9);
        assert.equal(racingTrickMotion(trick, trick.targetId, at, []).crouch, 0, 'steadying the rider never imitates immediate reacceleration');
      }
      const holdAt = (trick.lowest + catchup) / 2;
      assert.ok(Math.abs(pace(timeline, trick.targetId, holdAt) - pace(without, trick.targetId, holdAt)) < 1e-10, 'the lost gap remains instead of snapping back');
      assert.ok(racingTrickLoss(trick, catchup + (trick.recovered - catchup) * .05) > trick.loss * .98, 'pursuit begins gently');
      const middle = (catchup + trick.recovered) / 2;
      assert.ok(pace(timeline, trick.targetId, middle) > pace(without, trick.targetId, middle));
      assert.ok(racingTrickMotion(trick, trick.targetId, middle, []).crouch > .8);
      assert.equal(racingTrickLoss(trick, trick.recovered), 0);
    }
    assert.equal(timeline.finish, 39_000);
    assert.deepEqual(racingStandings(timeline, 44_000).map(item => item.id), order);
  }
});

test('standing up preserves the trailing gap and an upright rhythm before the actual chase', () => {
  for (const count of [2, 6, 10]) for (const seed of [0, 1, 17]) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    for (const obstacle of timeline.obstacles.filter(item => item.outcome !== 'clear')) {
      const without = { ...timeline, obstacles: timeline.obstacles.filter(item => item !== obstacle) };
      assert.ok(obstacle.catchupStart - obstacle.recovered >= 1100 - 1e-9);
      const holdAt = (obstacle.recovered + obstacle.catchupStart) / 2;
      assert.equal(racingObstacleStatus(timeline, obstacle, holdAt).stage, 'rhythm');
      assert.equal(racingObstacleLoss(obstacle, holdAt), obstacle.loss);
      assert.deepEqual(racingObstacleMotion(obstacle, holdAt), {});
      assert.ok(Math.abs(pace(timeline, obstacle.actorId, holdAt) - pace(without, obstacle.actorId, holdAt)) < 1e-10);
      const chaseAt = (obstacle.catchupStart + obstacle.catchupEnd) / 2;
      assert.ok(racingObstacleMotion(obstacle, chaseAt).crouch > .7);
      assert.ok(pace(timeline, obstacle.actorId, chaseAt) > pace(without, obstacle.actorId, chaseAt));
      assert.equal(racingObstacleLoss(obstacle, obstacle.catchupEnd), 0);
      assert.deepEqual(racingObstacleMotion(obstacle, obstacle.catchupEnd), {});
    }
  }
});

test('a blocked rider and the defending rival hold the gap before a single gradual response', () => {
  const incident = { kind: 'blocked', actorId: 'player-0', rivalId: 'player-1', start: 10_500, end: 16_000, beforeOrder: ['player-1', 'player-0'], waitingOrder: ['player-1', 'player-0'], afterOrder: ['player-0', 'player-1'] };
  for (const id of [incident.actorId, incident.rivalId]) {
    const clock = racingIncidentRecovery(incident, id), holdAt = (clock.lowest + clock.recoveryStart) / 2;
    assert.ok(clock.recoveryStart - clock.lowest >= 750);
    assert.equal(racingIncidentSetback(incident, id, holdAt), clock.loss);
    assert.equal(racingIncidentMotion(incident, id, holdAt).crouch, 0);
    const chaseAt = (clock.recoveryStart + clock.end) / 2;
    assert.ok(racingIncidentMotion(incident, id, chaseAt).crouch >= .85);
    assert.ok(racingIncidentSetback(incident, id, chaseAt) < clock.loss);
  }
});

test('a returning horse does not pass both noses of a final duel in the same frame', () => {
  for (const [count, seed] of [[5, 17], [10, 1]]) {
    const list = players.slice(0, count), ids = list.map(player => player.id), rotation = seed % count;
    const order = [...ids.slice(rotation), ...ids.slice(0, rotation)].reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    let previous = racingStandings(timeline, timeline.straight.start);
    for (let at = timeline.straight.start + 16; at <= timeline.finish; at += 16) {
      const current = racingStandings(timeline, at);
      let changed = 0;
      for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
        if ((previous.findIndex(item => item.id === ids[a]) - previous.findIndex(item => item.id === ids[b])) * (current.findIndex(item => item.id === ids[a]) - current.findIndex(item => item.id === ids[b])) < 0) changed++;
      }
      assert.ok(changed <= 2, 'lost-ground recovery and independent duels must remain individually visible');
      previous = current;
    }
    assert.deepEqual(racingStandings(timeline, 44_000).map(item => item.id), order);
  }
});
