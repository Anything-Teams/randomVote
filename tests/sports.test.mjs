import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/sports.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createSportsOrder } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const arenaCompiled = await build({ entryPoints: ['src/arenaLogic.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaRounds, arenaRanks, arenaThrow, arenaExchange, arenaBeat, arenaStartingPoint } = await import(`data:text/javascript;base64,${Buffer.from(arenaCompiled.outputFiles[0].text).toString('base64')}`);
const storyCompiled = await build({ entryPoints: ['src/arenaStoryLogic.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaStoryState } = await import(`data:text/javascript;base64,${Buffer.from(storyCompiled.outputFiles[0].text).toString('base64')}`);
const timingCompiled = await build({ entryPoints: ['src/playbackTiming.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createPlaybackDuration, basePlaybackDuration, PLAYBACK_SECONDS } = await import(`data:text/javascript;base64,${Buffer.from(timingCompiled.outputFiles[0].text).toString('base64')}`);
const racingCompiled = await build({ entryPoints: ['src/racingNarrative.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createRacingIncidents, buildRacingTimeline, readRacingDistance, racingLaneShift, RACING_STORIES } = await import(`data:text/javascript;base64,${Buffer.from(racingCompiled.outputFiles[0].text).toString('base64')}`);
const participants = Array.from({ length: 10 }, (_, index) => ({ id: `player-${index}`, name: `선수 ${index}`, color: '#f9d56e' }));

test('only arena draws a variable runtime, while election and racing keep their existing length', () => {
  const unused = () => { throw new Error('Fixed modes must not draw a duration'); };
  assert.equal(createPlaybackDuration('election', unused), 58_000);
  assert.equal(createPlaybackDuration('racing', unused), 44_000);
  assert.equal(basePlaybackDuration('arena'), 44_000);
  const range = PLAYBACK_SECONDS.arena, choices = range.max - range.min + 1;
  const durations = Array.from({ length: choices }, (_, offset) => createPlaybackDuration('arena', limit => { assert.equal(limit, choices); return offset; }));
  assert.equal(new Set(durations).size, choices);
  assert.equal(Math.min(...durations), 40_000);
  assert.equal(Math.max(...durations), 62_000);
  assert.throws(() => createPlaybackDuration('arena', () => choices), RangeError);
});

test('every possible draw path gives a distinct ranking with equal chances at each position', () => {
  const results = [];
  function visit(choices, limit) {
    if (limit === 1) {
      let offset = 0;
      results.push(createSportsOrder(participants.slice(0, 5), () => choices[offset++]));
      return;
    }
    for (let choice = 0; choice < limit; choice++) visit([...choices, choice], limit - 1);
  }
  visit([], 5);
  assert.equal(results.length, 120);
  assert.equal(new Set(results.map(order => order.join(','))).size, 120);
  for (let rank = 0; rank < 5; rank++) {
    for (const player of participants.slice(0, 5)) assert.equal(results.filter(order => order[rank] === player.id).length, 24);
  }
});

test('2–10 participants each appear once and input order is left unchanged', () => {
  for (let size = 2; size <= 10; size++) {
    const list = participants.slice(0, size);
    const before = list.map(player => player.id);
    const order = createSportsOrder(list);
    assert.deepEqual([...order].sort(), [...before].sort());
    assert.deepEqual(list.map(player => player.id), before);
  }
  assert.throws(() => createSportsOrder(participants.slice(0, 1)), RangeError);
  assert.throws(() => createSportsOrder([participants[0], participants[0]]), RangeError);
});

test('the production shuffle rejects the extra random range instead of favoring input positions', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const samples = [0xffffffff, 0, 1];
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: values => { values[0] = samples.shift(); return values; } } });
  try {
    assert.deepEqual(createSportsOrder(participants.slice(0, 3)), ['player-2', 'player-1', 'player-0']);
    assert.equal(samples.length, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});

test('arena tactics use living, distinct participants and preserve every drawn rank for 2–10 players', () => {
  for (const duration of [40_000, 44_000, 62_000]) for (let size = 2; size <= 10; size++) {
    for (let rotation = 0; rotation < size; rotation++) {
      const ids = participants.slice(0, size).map(player => player.id);
      const order = [...ids.slice(rotation), ...ids.slice(0, rotation)];
      const rounds = arenaRounds(order, duration);
      const alive = new Set(order);
      assert.equal(rounds.length, size - 1);
      let previousEnd = 0;
      for (const round of rounds) {
        assert.ok(round.start + 0.000001 >= previousEnd, `overlapping rounds for ${size} players: ${round.start} < ${previousEnd}`);
        assert.ok(round.start < round.impact && round.impact < round.resolve && round.resolve <= round.end);
        assert.ok(round.end <= duration);
        assert.ok(alive.has(round.victim) && alive.has(round.aggressor));
        assert.notEqual(round.victim, round.aggressor);
        if (round.helper) {
          assert.ok(alive.has(round.helper));
          assert.notEqual(round.helper, round.victim);
          assert.notEqual(round.helper, round.aggressor);
        }
        const before = arenaRanks(order, round.resolve - 0.01, duration);
        const after = arenaRanks(order, round.resolve, duration);
        assert.equal(before[round.victim], undefined);
        assert.equal(after[round.victim], order.indexOf(round.victim) + 1);
        assert.equal(after[order[0]], round.final ? 1 : undefined);
        alive.delete(round.victim);
        previousEnd = round.end;
      }
      assert.deepEqual(arenaRanks(order, duration, duration), Object.fromEntries(order.map((id, rank) => [id, rank + 1])));
      assert.deepEqual([...alive], [order[0]]);
    }
  }
});

test('arena starts spread across the sand with room between participants for 2–10 players', () => {
  for (let count = 2; count <= 10; count++) {
    const points = Array.from({ length: count }, (_, index) => arenaStartingPoint(index, count));
    for (let index = 0; index < count; index++) {
      const point = points[index];
      assert.ok((point.x - 500) ** 2 / 302 ** 2 + (point.y - 406) ** 2 / 133 ** 2 < 1, `starting outside the boundary: ${count}/${index}`);
      for (let other = index + 1; other < count; other++) assert.ok(Math.hypot(point.x - points[other].x, point.y - points[other].y) >= 80, `crowded starting positions: ${count}/${index}/${other}`);
    }
    assert.ok(points.some(point => point.x < 400) && points.some(point => point.x > 600));
    if (count >= 3) assert.ok(Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) >= 100);
  }
});

test('arena elimination leaves the ground, lands before ranking, and recovers without teleporting', () => {
  for (const direction of [-1, 1]) for (const lift of [0, 52]) {
    const origin = { x: 500, y: 415 }, landing = { x: direction > 0 ? 904 : 96, y: 465 };
    const preparation = { lift, angle: lift ? -.22 : 0 };
    assert.equal(arenaThrow(0, origin, landing, direction, 1, preparation).y, origin.y - lift);
    assert.equal(arenaThrow(0, origin, landing, direction, 1, preparation).angle, preparation.angle);
    const stages = new Set();
    let previous;
    for (let age = 0; age <= 2200; age++) {
      const frame = arenaThrow(age, origin, landing, direction, 1, preparation);
      stages.add(frame.stage);
      assert.ok(Object.values(frame).filter(value => typeof value === 'number').every(Number.isFinite));
      assert.ok(frame.height >= 0);
      assert.ok(Math.abs(frame.y + frame.height - frame.groundY) < 0.001);
      if (frame.stage === 'flight' && age > 120) assert.ok(frame.height > 0);
      if (previous) assert.ok(Math.hypot(frame.x - previous.x, frame.y - previous.y) < 2, `unexpected position jump at ${age}ms`);
      previous = frame;
    }
    assert.deepEqual([...stages], ['hold', 'flight', 'land', 'roll', 'recover', 'walk']);
    assert.equal(arenaThrow(1100, origin, landing, direction, 1, preparation).height, 0);
    assert.equal(arenaThrow(2200, origin, landing, direction, 1, preparation).x, landing.x);
  }
});

test('non-eliminating arena exchanges keep small games active and never reuse eliminated actors', () => {
  for (let size = 2; size <= 10; size++) {
    const order = participants.slice(0, size).map(player => player.id);
    for (let elapsed = 0; elapsed < 44_000; elapsed += 200) {
      const exchange = arenaExchange(order, elapsed);
      const ranks = arenaRanks(order, elapsed);
      if (ranks[order[0]]) { assert.equal(exchange, undefined); continue; }
      assert.ok(exchange?.exchange);
      const actors = [exchange.aggressor, exchange.victim, exchange.helper].filter(Boolean);
      assert.equal(new Set(actors).size, actors.length);
      for (const id of actors) assert.ok(order.includes(id) && !ranks[id]);
      if (size === 2) assert.equal(exchange.helper, undefined);
    }
  }
});

test('arena cooperation and betrayal labels follow contact beats and identify the correct participants', () => {
  const base = { id: 'story', index: 0, aggressor: 'attacker', helper: 'helper', victim: 'target', start: 1000, impact: 5000, resolve: 6100, end: 6600, final: false };
  const team = { ...base, tactic: 'team' };
  const betrayal = { ...base, tactic: 'betrayal' };
  assert.deepEqual(arenaStoryState(team, 2600).left, ['attacker', 'helper']);
  assert.deepEqual(arenaStoryState(team, 2600).right, ['target']);
  const alliance = arenaStoryState(betrayal, 2600);
  assert.deepEqual(alliance.left, ['helper']);
  assert.deepEqual(alliance.right, ['target']);
  assert.equal(alliance.relation, '↔');
  assert.match(alliance.relationLabel, /임시 동맹/);
  assert.equal(arenaBeat(betrayal, 2600).stage, 'hold');
  const broken = arenaStoryState(betrayal, 3800);
  assert.equal(broken.relation, '×');
  assert.equal(broken.leftLabel, '배신한 선수');
  assert.equal(broken.rightLabel, '버려진 선수');
  assert.match(broken.action, /손을 놓습니다/);
  assert.equal(arenaBeat(betrayal, 3800).stage, 'turn');
  assert.equal(arenaBeat(team, 5000).stage, 'impact');
  assert.equal(arenaBeat(team, 6100).stage, 'result');
  assert.match(arenaStoryState(team, 6100).action, /장외에 착지/);
  const survived = arenaStoryState({ ...team, exchange: true, resolve: Infinity }, 5100);
  assert.match(survived.action, /서로 손을 풀고/);
  assert.doesNotMatch(survived.action, /장외|우승/);
});

test('racing incidents describe the displayed rank changes and retain all participants', () => {
  const kinds = new Set();
  for (let size = 2; size <= 10; size++) {
    const list = participants.slice(0, size);
    const order = list.map(player => player.id).reverse();
    for (let seed = 1; seed <= 20; seed++) {
      const incidents = createRacingIncidents(list, order, 44_000, seed);
      const timeline = buildRacingTimeline(list, order, 44_000, incidents);
      assert.equal(new Set(incidents.map(incident => incident.kind)).size, incidents.length);
      const rankedAt = elapsed => [...order].sort((a, b) => readRacingDistance(timeline, b, elapsed) - readRacingDistance(timeline, a, elapsed));
      for (const incident of incidents) {
        kinds.add(incident.kind);
        assert.notEqual(incident.actorId, incident.rivalId);
        for (const snapshot of [incident.beforeOrder, incident.waitingOrder, incident.afterOrder]) assert.deepEqual([...snapshot].sort(), [...order].sort());
        assert.deepEqual(rankedAt(incident.start), incident.beforeOrder);
        assert.deepEqual(rankedAt(incident.start + 1300), incident.waitingOrder);
        assert.deepEqual(rankedAt(incident.end), incident.afterOrder);
        const before = incident.beforeOrder.indexOf(incident.actorId), after = incident.afterOrder.indexOf(incident.actorId);
        assert.ok(incident.kind === 'fatigue' || incident.kind === 'balance' ? after > before : after < before);
        for (const id of order) {
          const shift = racingLaneShift(incident, id, incident.start + 3000);
          assert.ok(shift >= -1 && shift <= 1);
          if (id !== incident.actorId) assert.equal(shift, 0);
        }
      }
      assert.deepEqual(rankedAt(timeline.finish), order);
    }
  }
  assert.deepEqual([...kinds].sort(), RACING_STORIES.map(story => story.kind).sort());
});

test('every racing horse moves forward through stories and converges to the drawn finish order', () => {
  for (let size = 2; size <= 10; size++) {
    const list = participants.slice(0, size);
    for (let seed = 1; seed <= 8; seed++) {
      const order = seed % 2 ? list.map(player => player.id) : list.map(player => player.id).reverse();
      const incidents = createRacingIncidents(list, order, 44_000, seed);
      const timeline = buildRacingTimeline(list, order, 44_000, incidents);
      const previous = new Map(order.map(id => [id, 0]));
      for (let elapsed = 0; elapsed <= 44_000; elapsed += 100) {
        for (const id of order) {
          const distance = readRacingDistance(timeline, id, elapsed);
          assert.ok(Number.isFinite(distance) && distance >= previous.get(id) - 0.0000001, `backward racing motion: ${id}, ${elapsed}ms`);
          previous.set(id, distance);
        }
      }
      assert.deepEqual([...order].sort((a, b) => previous.get(b) - previous.get(a)), order);
    }
  }
});
