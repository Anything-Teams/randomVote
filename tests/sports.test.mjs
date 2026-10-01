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
const { createRacingIncidents, buildRacingTimeline, readRacingDistance, readRacingTravel, racingStandings, racingIncidentStatus, racerFinishTime, racingLaneShift, RACING_STORIES } = await import(`data:text/javascript;base64,${Buffer.from(racingCompiled.outputFiles[0].text).toString('base64')}`);
const cameraCompiled = await build({ entryPoints: ['src/racingCamera.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createRacingCamera, racingFocusIds, placeRacingField } = await import(`data:text/javascript;base64,${Buffer.from(cameraCompiled.outputFiles[0].text).toString('base64')}`);
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

test('racing incidents describe real opponents and the displayed rank changes', () => {
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
        const outcome = racingIncidentStatus(timeline, incident, incident.end);
        assert.equal(outcome.currentRank, after + 1);
        assert.equal(outcome.beforeRank, before + 1);
        assert.equal(outcome.afterRank, after + 1);
        assert.equal(outcome.opponentIds.length, Math.abs(after - before));
        assert.ok(outcome.opponentIds.includes(incident.rivalId));
        assert.deepEqual(after < before ? outcome.overtakenIds : outcome.passedByIds, outcome.opponentIds);
        assert.equal(outcome.nextRivalId, undefined);
        for (let elapsed = incident.start; elapsed <= incident.end; elapsed += 100) {
          const live = racingIncidentStatus(timeline, incident, elapsed), ranks = racingStandings(timeline, elapsed);
          const actorRank = ranks.find(standing => standing.id === incident.actorId).rank;
          assert.equal(live.currentRank, actorRank);
          if (live.stage === 'outcome') assert.equal(live.currentRank, live.afterRank, 'outcome caption must wait until its announced position is real');
          for (const id of live.overtakenIds) assert.ok(ranks.find(standing => standing.id === id).rank > actorRank);
          for (const id of live.passedByIds) assert.ok(ranks.find(standing => standing.id === id).rank < actorRank);
        }
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
          assert.ok(Number.isFinite(distance) && distance >= 0 && distance <= 1 && distance >= previous.get(id) - 0.0000001, `invalid or backward lap motion: ${id}, ${elapsed}ms`);
          previous.set(id, distance);
        }
      }
      assert.deepEqual(racingStandings(timeline, 44_000).map(standing => standing.id), order);
    }
  }
});

test('one-lap finish times preserve the drawn rank without a late reshuffle across the line', () => {
  for (let size = 2; size <= 10; size++) {
    const list = participants.slice(0, size);
    for (let seed = 1; seed <= 30; seed++) {
      const ids = list.map(player => player.id), rotation = seed % size;
      const order = [...ids.slice(rotation), ...ids.slice(0, rotation)].reverse();
      const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
      assert.equal(timeline.finish, 39_000);
      assert.equal(racerFinishTime(timeline, order[0]), timeline.finish);
      assert.ok(racerFinishTime(timeline, order.at(-1)) < 41_400);
      for (let rank = 0; rank < order.length; rank++) {
        const id = order[rank], time = racerFinishTime(timeline, id);
        assert.ok(readRacingDistance(timeline, id, time - .001) < 1);
        assert.equal(readRacingDistance(timeline, id, time), 1);
        assert.equal(readRacingDistance(timeline, id, 44_000), 1);
        assert.deepEqual(racingStandings(timeline, time).filter(standing => standing.finished).map(standing => standing.id), order.slice(0, rank + 1));
        if (rank) assert.ok(time > racerFinishTime(timeline, order[rank - 1]));
        assert.ok(Math.abs(readRacingTravel(timeline, id, time + .001) - readRacingTravel(timeline, id, time - .001)) < .00001);
        assert.ok(readRacingTravel(timeline, id, time + 100) > readRacingTravel(timeline, id, time));
        assert.ok(readRacingTravel(timeline, id, time + 200) > readRacingTravel(timeline, id, time + 100));
      }
      assert.deepEqual(racingStandings(timeline, 44_000).map(standing => standing.id), order);
    }
  }
});

test('racing camera includes the live leaders and every real opponent before and throughout each story', () => {
  for (let size = 2; size <= 10; size++) for (let seed = 1; seed <= 20; seed++) {
    const list = participants.slice(0, size), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    for (let elapsed = timeline.start; elapsed <= 41_400; elapsed += 100) {
      const focus = racingFocusIds(timeline, elapsed);
      assert.equal(new Set(focus).size, focus.length);
      for (const id of focus) assert.ok(order.includes(id), `unknown focused horse: ${id}`);
      for (const leader of racingStandings(timeline, elapsed).slice(0, 3)) assert.ok(focus.includes(leader.id), `missing leader at ${elapsed}ms: ${leader.id}`);
    }
    for (const incident of timeline.incidents) {
      const required = [incident.actorId, incident.rivalId, ...racingIncidentStatus(timeline, incident, incident.start).opponentIds];
      for (const elapsed of [incident.start - 1100, incident.start - 100, incident.start, (incident.start + incident.end) / 2, incident.end + 100, incident.end + 1599]) {
        const focus = racingFocusIds(timeline, elapsed);
        for (const id of required) assert.ok(focus.includes(id), `missing story participant: ${size} horses, seed ${seed}, ${elapsed}ms, ${id}`);
      }
    }
  }
});

test('racing camera preserves each horse identity and continuous motion when ranks or focus change', () => {
  let rankChanges = 0;
  for (let size = 2; size <= 10; size++) for (let seed = 1; seed <= 20; seed++) for (const [w, h] of [[960, 540], [320, 180]]) {
    const list = participants.slice(0, size), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed)), camera = createRacingCamera();
    let previous, previousRanks;
    for (let elapsed = timeline.start; elapsed <= 41_400; elapsed += 16) {
      const field = placeRacingField(camera, list, timeline, elapsed, w, h, 16);
      const focus = racingFocusIds(timeline, elapsed), ranks = racingStandings(timeline, elapsed).map(standing => standing.id).join('|');
      assert.deepEqual(field.map(horse => horse.id), list.map(player => player.id));
      if (previousRanks && previousRanks !== ranks) rankChanges++;
      const active = timeline.incidents.find(incident => elapsed >= incident.start && elapsed <= incident.end);
      for (const horse of field) {
        const context = `${size} horses, seed ${seed}, ${w}px, ${elapsed}ms, ${horse.id}`;
        assert.equal(list[horse.index].id, horse.id, `name and color identity changed: ${context}`);
        assert.equal(horse.featured, focus.includes(horse.id));
        assert.equal(horse.distance, readRacingTravel(timeline, horse.id, elapsed));
        assert.ok([horse.x, horse.y, horse.scale].every(Number.isFinite) && horse.scale > 0, context);
        assert.ok(Math.abs(horse.x - (w * .5 + (horse.distance - camera.center) / camera.span * w * .65)) < .000001, `position no longer follows actual travel: ${context}`);
        const bodyRoot = horse.x - 57 * horse.scale;
        // Labels are separately clamped by the renderer; the whole focused horse must fit the camera.
        if (active && horse.featured) assert.ok(horse.x <= w && bodyRoot - 52 * horse.scale >= 0, `story horse outside camera: ${context}, nose=${horse.x}, body=${bodyRoot}`);
        if (previous) {
          const prior = previous[horse.index];
          // Wide framing may begin before a story; rank changes must never teleport a persistent horse.
          assert.ok(Math.abs(horse.x - prior.x) < w * .04, `horizontal cut: ${context}`);
          assert.ok(Math.abs(horse.y - prior.y) < h * .015, `lane cut: ${context}`);
          assert.ok(Math.abs(horse.scale - prior.scale) < .025, `scale cut: ${context}`);
        }
      }
      previous = field; previousRanks = ranks;
    }
    assert.equal(camera.horses.size, list.length, 'no horse is removed when it leaves the leading group');
  }
  assert.ok(rankChanges > 1000, 'the continuity test must exercise actual rank swaps');
});

test('paused racing camera freezes projection, lanes and scales without losing any horse', () => {
  for (let size = 2; size <= 10; size++) for (let seed = 1; seed <= 8; seed++) {
    const list = participants.slice(0, size), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    for (const incident of timeline.incidents) {
      const camera = createRacingCamera(), freezeAt = incident.start + 1700;
      for (let elapsed = timeline.start; elapsed < freezeAt; elapsed += 16) placeRacingField(camera, list, timeline, elapsed, 640, 360, 16);
      const field = placeRacingField(camera, list, timeline, freezeAt, 640, 360, 16);
      const frozen = { center: camera.center, span: camera.span, elapsed: camera.elapsed, horses: [...camera.horses].map(([id, pose]) => [id, { ...pose }]) };
      for (let frame = 0; frame < 120; frame++) assert.deepEqual(placeRacingField(camera, list, timeline, freezeAt, 640, 360, 0), field);
      assert.deepEqual({ center: camera.center, span: camera.span, elapsed: camera.elapsed, horses: [...camera.horses] }, frozen);
    }
  }
});

test('racing camera crosses the finish at actual arrival and keeps each horse moving beyond it', () => {
  for (let size = 2; size <= 10; size++) for (let seed = 1; seed <= 20; seed++) {
    const list = participants.slice(0, size), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed)), camera = createRacingCamera();
    for (let elapsed = timeline.start; elapsed < timeline.finish; elapsed += 16) placeRacingField(camera, list, timeline, elapsed, 960, 540, 16);
    for (const id of order) {
      const field = placeRacingField(camera, list, timeline, racerFinishTime(timeline, id), 960, 540, 16);
      const horse = field.find(item => item.id === id), finishX = 480 + (1 - camera.center) / camera.span * 960 * .65;
      assert.ok(Math.abs(horse.x - finishX) < .000001, `wrong finish crossing: ${size} horses, seed ${seed}, ${id}`);
      const later = placeRacingField(camera, list, timeline, racerFinishTime(timeline, id) + 100, 960, 540, 100).find(item => item.id === id);
      const laterLine = 480 + (1 - camera.center) / camera.span * 960 * .65;
      assert.ok(later.x > laterLine, `horse froze at the finish line: ${size} horses, seed ${seed}, ${id}`);
    }
  }
});
