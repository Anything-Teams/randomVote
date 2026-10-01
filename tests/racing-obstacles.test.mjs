import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildRacingTimeline, createRacingIncidents, readRacingDistance, racingStandings, racingObstacleLoss, racingIncidentSetback } = await source('src/racingNarrative.ts');
const { createRacingCamera, placeRacingField } = await source('src/racingCamera.ts');
const { racingObstacleDistance, racingCourseObstacles, placeRacingObstacles, racingObstacleJump, racingObstacleMotion, racingObstacleStatus } = await source('src/racingObstacles.ts');
const { racingTopLegPose, racingGateWalk, racingGateLegPose } = await source('src/racingCourse.ts');
const { racingGroundMarks } = await source('src/racingArt.ts');
const players = Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: `선수 ${index}`, color: '#abcdef' }));

test('course obstacles enter from the right, travel left with the ground, and persist past the story', () => {
  const covered = new Set();
  for (const [width, height] of [[320, 180], [960, 540]]) for (const count of [2, 6, 10]) for (let seed = 0; seed < 20; seed++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const incidents = createRacingIncidents(list, order, 44_000, seed), timeline = buildRacingTimeline(list, order, 44_000, incidents);
    for (const incident of incidents.filter(item => ['hay-jump', 'puddle'].includes(item.kind))) {
      covered.add(incident.kind);
      const camera = createRacingCamera(), expected = racingObstacleDistance(timeline, incident);
      let previous, previousJump = 0, visibleBefore = false, leftAfter = false, beforeStory = false, seenFromRight = false;
      for (let at = timeline.start; at <= incident.end + 2000; at += 16) {
        const field = placeRacingField(camera, list, timeline, at, width, height, 16);
        const obstacle = placeRacingObstacles(timeline, camera, field, width).find(item => item.actorId === incident.actorId);
        assert.equal(obstacle.distance, expected.distance, 'the object must stay fixed on the course');
        assert.equal(obstacle.encounter, expected.encounter);
        const projected = width * .5 + (expected.distance - camera.center) / camera.span * width * .65;
        assert.ok(Math.abs(obstacle.x - projected) < 1e-9, 'ground and obstacles share the camera projection');
        if (previous !== undefined) assert.ok(obstacle.x <= previous + .01, `obstacle moved right: ${count}/${seed}/${at}`);
        if (obstacle.x > width + 34 * obstacle.scale) seenFromRight = true;
        if (at < expected.encounter && obstacle.x < width && obstacle.x > 0) visibleBefore = true;
        if (at < incident.start) beforeStory = true;
        if (at > incident.end && obstacle.x < -34 * obstacle.scale) leftAfter = true;
        const actor = field.find(item => item.id === incident.actorId), body = { ...actor, x: actor.x - 57 * actor.scale };
        const jump = racingObstacleJump(obstacle, body);
        assert.ok(Math.abs(jump - previousJump) < .24, 'the physical jump stays smooth frame to frame');
        previousJump = jump;
        previous = obstacle.x;
      }
      assert.ok(seenFromRight && visibleBefore && beforeStory && leftAfter, 'the complete approach and departure exist outside the story interval');
      const field = placeRacingField(createRacingCamera(), list, timeline, expected.encounter, width, height, 0, true);
      const obstacle = placeRacingObstacles(timeline, { center: (Math.max(...field.map(item => item.distance)) + Math.min(...field.map(item => item.distance))) / 2, span: Math.max(.067, (Math.max(...field.map(item => item.distance)) - Math.min(...field.map(item => item.distance))) * 1.35 + .016) }, field, width).find(item => item.actorId === incident.actorId);
      const actor = field.find(item => item.id === incident.actorId);
      assert.ok(Math.abs(obstacle.x - actor.x) < .001, 'the actor reaches the physical obstacle at the planned encounter');
      const body = { ...actor, x: actor.x - 57 * actor.scale };
      const clearance = obstacle.outcome === 'clip' ? .42 : obstacle.outcome === 'slip' ? .68 : 1;
      assert.ok(racingObstacleJump(obstacle, { ...body, x: obstacle.x - 20 * body.scale }) > .9 * clearance, 'the physical approach determines the takeoff');
      assert.ok(racingObstacleJump(obstacle, { ...body, x: obstacle.x }) > .95 * clearance, 'the failed takeoff remains lower than a successful jump');
      assert.ok(racingObstacleJump(obstacle, { ...body, x: obstacle.x + 20 * body.scale }) > .6 * clearance, 'the rear legs finish the same physical motion');
      assert.equal(racingObstacleJump(obstacle, { ...body, x: obstacle.x - 79 * body.scale }), 0);
      assert.ok(racingObstacleJump(obstacle, { ...body, x: obstacle.x + 63 * body.scale }) < 1e-10);
      assert.equal(readRacingDistance(timeline, incident.actorId, expected.encounter), obstacle.distance);
    }
  }
  assert.deepEqual(covered, new Set(['hay-jump', 'puddle']));
});

test('top-view horse legs stay under the body and stride forwards without lateral flailing', () => {
  for (let index = 0; index < 10; index++) {
    assert.deepEqual(racingTopLegPose(0, index, false, false), racingTopLegPose(9999, index, false, false), 'waiting legs remain planted');
    let previous = racingTopLegPose(0, index, true, false);
    for (let clock = 16; clock < 4000; clock += 16) {
      const current = racingTopLegPose(clock, index, true, false);
      for (const [leg, pose] of current.entries()) {
        assert.ok(pose.root.x * pose.hoof.x > 0, 'each leg stays on its own side of the barrel');
        assert.ok(Math.abs(pose.hoof.x) <= 4.35 && Math.abs(pose.knee.x) <= 3.9, 'knees and hooves do not splay sideways');
        assert.ok(Math.hypot(pose.hoof.x - previous[leg].hoof.x, pose.hoof.y - previous[leg].hoof.y) < 2.5, 'top-view stride remains continuous');
      }
      previous = current;
    }
  }
});

test('rail posts and ground marks retain course distances when the racing camera moves and widens', () => {
  const width = 960, near = { center: .35, pixelsPerLap: width * .65 / .067 }, far = { center: .351, pixelsPerLap: width * .65 / .076 };
  const left = racingGroundMarks(width, near, 46), right = racingGroundMarks(width, far, 46);
  const first = left.find(mark => Math.abs(mark.x - width * .5) < 30), next = right.find(mark => mark.index === first.index);
  assert.equal(next.distance, first.distance, 'a rail post remains at one course location through zoom');
  assert.ok(Math.abs(next.x - (width * .5 + (first.distance - far.center) * far.pixelsPerLap)) < 1e-9);
  assert.ok(next.x < first.x, 'rail posts move left at the same projection as the approaching obstacle');
});

test('gate entry advances by planted steps and lands every last foot before waiting', () => {
  let planted = 0, swung = 0;
  for (let index = 0; index < 10; index++) {
    let previous;
    for (let at = 0; at <= 3000; at += 16) {
      const walk = racingGateWalk(at, index, 44), legs = racingGateLegPose(at, index, 44);
      if (previous) for (let leg = 0; leg < legs.length; leg++) assert.ok(Math.hypot(legs[leg].hoof.x - previous.legs[leg].hoof.x, legs[leg].hoof.y - previous.legs[leg].hoof.y) < 1.8, 'the last steps land without a snap');
      if (previous && walk.distance > previous.distance) for (let leg = 0; leg < legs.length; leg++) {
        if (legs[leg].support && previous.legs[leg].support) {
          const hoof = walk.distance + legs[leg].hoof.y, prior = previous.distance + previous.legs[leg].hoof.y;
          assert.ok(Math.abs(hoof - prior) < 1e-9, 'the planted hoof stays fixed while the body advances');
          planted++;
        } else swung++;
      }
      previous = { ...walk, legs };
    }
    const resting = racingTopLegPose(0, index, false, true), arrived = racingGateLegPose(3000, index, 44);
    assert.equal(racingGateWalk(3000, index, 44).distance, 44);
    assert.ok(arrived.every(leg => leg.support), 'no foot is held in the air after entry');
    for (let leg = 0; leg < arrived.length; leg++) for (const point of ['root', 'knee', 'hoof']) assert.deepEqual(arrived[leg][point], resting[leg][point], 'all four feet reach their standing positions');
    assert.deepEqual(arrived, racingGateLegPose(5400, index, 44), 'standing feet stay planted until the start');
  }
  assert.ok(planted > 1000 && swung > 500, 'both stance and swing are exercised through the complete entry');
});

test('static and reduced-motion gate previews begin with all four feet planted', () => {
  for (let index = 0; index < 10; index++) for (const [preview, reduced] of [[true, false], [false, true]]) {
    const resting = racingTopLegPose(0, index, false, true), initial = racingGateLegPose(0, index, 44, preview, reduced);
    assert.ok(initial.every(leg => leg.support));
    for (let leg = 0; leg < initial.length; leg++) for (const point of ['root', 'knee', 'hoof']) assert.deepEqual(initial[leg][point], resting[leg][point]);
    for (const elapsed of [700, 1400, 3000, 5400]) assert.deepEqual(racingGateLegPose(elapsed, index, 44, preview, reduced), initial, 'preview geometry never captures a half stride');
  }
});

test('every race includes three separated course obstacles on different horses', () => {
  for (const count of [2, 6, 10]) for (let seed = 0; seed < 20; seed++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    const obstacles = racingCourseObstacles(timeline);
    assert.equal(obstacles.length, 3);
    assert.equal(new Set(obstacles.map(obstacle => obstacle.id)).size, 3);
    assert.equal(new Set(obstacles.map(obstacle => obstacle.kind)).size, 2, 'both water and a low hay hurdle are present');
    assert.ok(obstacles.some(obstacle => obstacle.outcome === 'clear') && obstacles.some(obstacle => obstacle.outcome !== 'clear'), 'successes and mistakes both occur');
    for (let index = 1; index < obstacles.length; index++) {
      assert.ok(obstacles[index].encounter - obstacles[index - 1].encounter > 6500, 'challenges leave time for racing duels');
      assert.notEqual(obstacles[index].actorId, obstacles[index - 1].actorId, 'different racers take the next challenge');
    }
    for (const obstacle of obstacles) assert.equal(obstacle.distance, readRacingDistance(timeline, obstacle.actorId, obstacle.encounter));
  }
});

test('course mistakes lose real speed and ranks, then recover without moving the obstacle or changing the result', () => {
  const outcomes = new Set();
  let lostPositions = 0;
  for (const count of [2, 6, 10]) for (let seed = 0; seed < 30; seed++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed)), noCourse = { ...timeline, obstacles: [] };
    for (const obstacle of timeline.obstacles) {
      outcomes.add(obstacle.outcome);
      assert.equal(readRacingDistance(timeline, obstacle.actorId, obstacle.encounter), obstacle.distance, 'the horse actually reaches the fixed obstacle at the encounter');
      if (obstacle.outcome === 'clear') { assert.equal(racingObstacleLoss(obstacle, obstacle.lowest), 0); continue; }
      const at = (obstacle.impact + obstacle.lowest) / 2, recoveryAt = (obstacle.lowest + obstacle.recovered) / 2;
      const speed = (plan, time) => (readRacingDistance(plan, obstacle.actorId, time + 8) - readRacingDistance(plan, obstacle.actorId, time - 8)) / 16;
      assert.ok(speed(timeline, at) < speed(noCourse, at) * .55, 'the checked horse loses forward speed');
      assert.ok(speed(timeline, recoveryAt) > speed(noCourse, recoveryAt), 'recovery earns back the lost ground through acceleration');
      assert.ok(Math.abs(readRacingDistance(noCourse, obstacle.actorId, obstacle.lowest) - readRacingDistance(timeline, obstacle.actorId, obstacle.lowest) - obstacle.loss) < 1e-9);
      const before = racingStandings(timeline, obstacle.impact).find(item => item.id === obstacle.actorId).rank;
      const peak = racingStandings(timeline, obstacle.lowest).find(item => item.id === obstacle.actorId).rank;
      if (peak > before) lostPositions++;
      let previous = readRacingDistance(timeline, obstacle.actorId, obstacle.impact), priorMotion = {};
      for (let elapsed = obstacle.impact; elapsed <= obstacle.recovered + 16; elapsed += 16) {
        const distance = readRacingDistance(timeline, obstacle.actorId, elapsed), status = racingObstacleStatus(timeline, obstacle, elapsed), motion = racingObstacleMotion(obstacle, elapsed);
        assert.ok(distance >= previous - 1e-9, 'a mistake can slow the horse without reversing it');
        assert.equal(status.currentRank, racingStandings(timeline, elapsed).find(item => item.id === obstacle.actorId).rank);
        assert.equal(status.lost, racingObstacleLoss(obstacle, elapsed));
        for (const key of new Set([...Object.keys(priorMotion), ...Object.keys(motion)])) assert.ok(Math.abs((motion[key] ?? 0) - (priorMotion[key] ?? 0)) < .09, 'impact and recovery poses remain continuous');
        assert.deepEqual(racingObstacleMotion(obstacle, elapsed, true), {});
        priorMotion = motion; previous = distance;
      }
      assert.equal(racingObstacleLoss(obstacle, obstacle.recovered), 0);
      assert.deepEqual(racingObstacleMotion(obstacle, obstacle.recovered), {});
    }
    assert.deepEqual(racingStandings(timeline, 44_000).map(item => item.id), order);
  }
  assert.deepEqual(outcomes, new Set(['clear', 'clip', 'slip']));
  assert.ok(lostPositions > 50, 'mistakes cause readable overtakes throughout both small and large fields');
});

test('a guarded lane checks actual travel before the horse escapes and accelerates', () => {
  for (const kind of ['blocked', 'inside', 'outside', 'draft', 'patience', 'lead-change', 'rail', 'chase', 'last-kick']) {
    const incident = { kind, actorId: '0', rivalId: '1', start: 10_500, end: 16_000, beforeOrder: ['1', '0'], waitingOrder: ['1', '0'], afterOrder: ['0', '1'] };
    const timeline = buildRacingTimeline(players.slice(0, 2), ['0', '1'], 44_000, [incident]), unconstrained = { ...timeline, incidents: [], obstacles: [] };
    const checkAt = incident.start + (incident.end - incident.start) * .28, escapeAt = incident.start + (incident.end - incident.start) * .68;
    const speed = (plan, time) => (readRacingDistance(plan, '0', time + 8) - readRacingDistance(plan, '0', time - 8)) / 16;
    assert.ok(racingIncidentSetback(incident, '0', checkAt) > .003);
    assert.ok(speed(timeline, checkAt) < speed(unconstrained, checkAt) * .8, `${kind} must slow actual travel while the reins are checked`);
    assert.ok(speed(timeline, escapeAt) > speed(unconstrained, escapeAt), 'escaping the guarded line creates real acceleration');
    assert.equal(racingIncidentSetback(incident, '0', incident.end), 0);
  }
});
