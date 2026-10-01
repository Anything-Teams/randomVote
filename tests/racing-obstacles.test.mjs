import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildRacingTimeline, createRacingIncidents, readRacingDistance } = await source('src/racingNarrative.ts');
const { createRacingCamera, placeRacingField } = await source('src/racingCamera.ts');
const { racingObstacleDistance, placeRacingObstacles, racingObstacleJump } = await source('src/racingObstacles.ts');
const { racingTopLegPose } = await source('src/racingCourse.ts');
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
      assert.ok(racingObstacleJump(obstacle, { ...body, x: obstacle.x - 20 * body.scale }) > .9, 'front hooves must be airborne when they reach the obstacle');
      assert.ok(racingObstacleJump(obstacle, { ...body, x: obstacle.x }) > .95, 'the body passes over the object at the peak of the jump');
      assert.ok(racingObstacleJump(obstacle, { ...body, x: obstacle.x + 20 * body.scale }) > .6, 'hind hooves clear the object before landing');
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
