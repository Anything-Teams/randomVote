import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildRacingTimeline, createRacingIncidents, readRacingDistance, readRacingTravel, racingStandings } = await source('src/racingNarrative.ts');
const { createRacingCamera, placeRacingField } = await source('src/racingCamera.ts');
const players = Array.from({ length: 10 }, (_, index) => ({ id: String(index + 1), name: `선수 ${index + 1}`, color: '#abc' }));
const orderIds = ['4', '1', '7', '2', '9', '3', '5', '10', '6', '8'];
const make = (count, seed, reverse = false, duration = 44000) => {
  const list = players.slice(0, count), order = orderIds.filter(id => list.some(item => item.id === id));
  if (reverse) order.reverse();
  return { list, order, timeline: buildRacingTimeline(list, order, duration, createRacingIncidents(list, order, duration, seed)) };
};
const velocity = (timeline, id, at, delta = 16) => (readRacingTravel(timeline, id, at + delta) - readRacingTravel(timeline, id, at)) / delta;

test('each final effort retains incoming physical position and velocity through its actual finish', () => {
  for (const duration of [44000, 60000]) for (const count of [2, 5, 10]) for (const seed of [1, 7, 45]) for (const reverse of [false, true]) {
    const { timeline, order } = make(count, seed, reverse, duration), pace = 1 / (timeline.finish - timeline.start);
    for (const id of order) {
      const start = timeline.straight.start, end = timeline.finishTimes[id];
      assert.ok(Math.abs(readRacingTravel(timeline, id, start + .001) - readRacingTravel(timeline, id, start - .001)) < pace * .003);
      assert.ok(Math.abs(velocity(timeline, id, start) - velocity(timeline, id, start - 16)) < pace * .025, 'entry keeps actual setback speed');
      assert.ok(readRacingDistance(timeline, id, end - .001) < 1);
      assert.equal(readRacingDistance(timeline, id, end), 1);
      for (const delta of [16, 50]) assert.ok(Math.abs(velocity(timeline, id, end, delta) - velocity(timeline, id, end - delta, delta)) < pace * .025, 'crossing carries momentum into run-out');
    }
    assert.deepEqual(racingStandings(timeline, Math.max(...Object.values(timeline.finishTimes))).map(item => item.id), order);
  }
});

test('final effort has one broad speed peak instead of short repeated overtake pulses', () => {
  for (const count of [2, 5, 10]) for (const seed of [1, 7, 45]) {
    const { timeline } = make(count, seed), steady = { ...timeline, bumps: [] }, pace = 1 / (timeline.finish - timeline.start);
    for (const id of timeline.ids.filter(id => id !== timeline.lateFall?.actorId)) {
      let previous, direction = 0, peaks = 0;
      for (let at = timeline.straight.start + 16; at < timeline.finishTimes[id] - 32; at += 16) {
        const speed = velocity(steady, id, at);
        assert.ok(speed > 0 && speed < pace * 2.2);
        if (previous !== undefined) {
          const change = speed - previous;
          assert.ok(Math.abs(change) < pace * .025, 'acceleration spreads across the straight');
          const next = Math.abs(change) > pace * .00001 ? Math.sign(change) : direction;
          if (direction === 1 && next === -1) peaks++;
          direction = next;
        }
        previous = speed;
      }
      assert.ok(peaks <= 1, `repeated speed pulse: ${count}/${seed}/${id}/${peaks}`);
    }
  }
});

test('a late fall retains its lost ground until every opponent passes and returns at normal pace', () => {
  for (const [count, seed] of [[2, 6], [10, 14]]) {
    const { timeline, order } = make(count, seed), fall = timeline.lateFall;
    assert.ok(fall);
    const pace = 1 / (timeline.finish - timeline.start), end = timeline.finishTimes[fall.actorId];
    assert.equal(racingStandings(timeline, fall.impact).find(item => item.id === fall.actorId).rank, 1);
    assert.equal(racingStandings(timeline, fall.lowest).find(item => item.id === fall.actorId).rank, count);
    for (let at = fall.recovered + 16; at < end - 32; at += 16) assert.ok(velocity(timeline, fall.actorId, at) <= pace * 1.01, 'standing up cannot trigger a catch-up burst');
    assert.ok(Math.abs(velocity(timeline, fall.actorId, fall.recovered) - velocity(timeline, fall.actorId, fall.recovered - 16)) < pace * .02);
    assert.ok(readRacingDistance(timeline, fall.actorId, end - .001) < 1);
    assert.deepEqual(racingStandings(timeline, end).map(item => item.id), order);
  }
});

test('the fixed projection follows continuous real travel at 16ms and 50ms with no screen-space jump', () => {
  for (const count of [2, 10]) for (const seed of [7, 45]) for (const delta of [16, 50]) for (const [w, h] of [[960, 540], [320, 180]]) {
    const { timeline, list } = make(count, seed), camera = createRacingCamera(), pace = 1 / (timeline.finish - timeline.start);
    let previous, previousSpeeds;
    for (let at = timeline.straight.start; at < Math.max(...Object.values(timeline.finishTimes)) + 600; at += delta) {
      const field = placeRacingField(camera, list, timeline, at, w, h, delta), speeds = [];
      for (let i = 0; i < field.length; i++) {
        const horse = field[i];
        assert.ok(Math.abs(horse.x - (w * .5 + (readRacingTravel(timeline, horse.id, at) - camera.center) / .075 * w * .65)) < 1e-9);
        if (previous) {
          assert.equal(horse.y, previous[i].y);
          assert.equal(horse.scale, previous[i].scale);
          speeds.push((horse.x - previous[i].x) / delta);
          if (previousSpeeds) assert.ok(Math.abs(speeds[i] - previousSpeeds[i]) < pace * w * .65 / .075 * delta / 140, `projection acceleration ${count}/${seed}/${delta}/${w}/${at}/${horse.id}: ${Math.abs(speeds[i]-previousSpeeds[i])}`);
        }
      }
      if (previous) previousSpeeds = speeds;
      previous = field;
    }
  }
});
