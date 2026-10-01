import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildRacingTimeline, createRacingIncidents, readRacingDistance, RACING_STORIES } = await source('src/racingNarrative.ts');
const { createRacingCamera, placeRacingField } = await source('src/racingCamera.ts');
const { racingIncidentMotion } = await source('src/racingEffects.ts');
const players = Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: `선수 ${index}`, color: '#abcdef' }));

test('a reversed ten-horse field overtakes gradually without a late speed surge', () => {
  for (let count = 2; count <= 10; count++) for (let seed = 0; seed <= 20; seed++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, seed ? createRacingIncidents(list, order, 44_000, seed) : []);
    assert.equal(timeline.finish, 39_000, 'extending duels must preserve one lap and the result time');
    assert.ok(timeline.finish - timeline.straight.start >= 7000);
    const pace = 1 / (timeline.finish - timeline.start);
    for (const player of list) for (let at = timeline.straight.start; at < timeline.finish - 16; at += 16) {
      const speed = (readRacingDistance(timeline, player.id, at + 16) - readRacingDistance(timeline, player.id, at)) / 16;
      assert.ok(speed >= pace * .5 && speed <= pace * 1.5, `sudden late surge: ${count}/${seed}/${player.id}/${at}: ${speed / pace}`);
    }
  }
});

test('the camera keeps every named horse visible throughout the live race on small and large screens', () => {
  for (const [width, height] of [[320, 180], [960, 540]]) for (let count = 2; count <= 10; count++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, count));
    const camera = createRacingCamera();
    for (let at = timeline.start; at <= 41_000; at += 16) {
      for (const horse of placeRacingField(camera, list, timeline, at, width, height, 16)) {
        assert.ok(horse.x <= width && horse.x - 109 * horse.scale >= 0, `offscreen horse: ${width}/${count}/${horse.id}/${at}`);
      }
    }
  }
});

test('racing tactics and obstacle jumps animate the correct bodies smoothly without attacks', () => {
  const base = { actorId: '0', rivalId: '1', start: 10_000, end: 15_500, beforeOrder: ['1', '0'], waitingOrder: ['1', '0'], afterOrder: ['0', '1'] };
  for (const { kind } of RACING_STORIES) {
    const incident = { ...base, kind };
    let activeFrames = 0;
    for (const id of ['0', '1', '2']) {
      let previous = {};
      for (let at = incident.start - 16; at <= incident.end + 16; at += 16) {
        const motion = racingIncidentMotion(incident, id, at);
        assert.deepEqual(racingIncidentMotion(incident, id, at), motion, 'pause and seek must reproduce the same pose');
        assert.deepEqual(racingIncidentMotion(incident, id, at, true), {});
        if (!['hay-jump', 'puddle'].includes(kind)) assert.equal(motion.jump, undefined, 'only a visible course obstacle asks a horse to leap');
        assert.equal(motion.kick, undefined, 'horses race through gaps instead of attacking rivals');
        if (id === '2' || id === '1' && kind !== 'gust') assert.deepEqual(motion, {});
        for (const key of new Set([...Object.keys(previous), ...Object.keys(motion)])) {
          const current = motion[key] ?? 0, prior = previous[key] ?? 0;
          assert.ok(Number.isFinite(current) && Math.abs(current) <= 1);
          assert.ok(Math.abs(current - prior) < .08, `body action popped: ${kind}/${id}/${at}/${key}`);
          if (current > .2) activeFrames++;
        }
        previous = motion;
      }
    }
    assert.ok(activeFrames > 20, `${kind} must visibly change a body`);
    assert.deepEqual(racingIncidentMotion(incident, '0', incident.start - 1), {});
    assert.deepEqual(racingIncidentMotion(incident, '0', incident.end + 1), {});
  }
});
