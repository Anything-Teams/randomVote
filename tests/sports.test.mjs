import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/sports.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createSportsOrder } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const arenaCompiled = await build({ entryPoints: ['src/arenaLogic.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaRounds, arenaRanks, arenaThrow, arenaExchange, arenaBeat, arenaAction, arenaFocusRound, arenaMiniExchanges, arenaContactPoint, arenaStartingPoint, arenaPodium, arenaRoamingTarget, arenaGuardTarget, arenaReleaseTarget, arenaMove, ARENA_MAX_GROUND_SPEED } = await import(`data:text/javascript;base64,${Buffer.from(arenaCompiled.outputFiles[0].text).toString('base64')}`);
const fighterCompiled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaDrawOrder } = await import(`data:text/javascript;base64,${Buffer.from(fighterCompiled.outputFiles[0].text).toString('base64')}`);
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

test('lifting and throwing preserve hand occlusion until a fighter actually crosses another ground depth', () => {
  const origin = { x: 500, y: 425 }, landing = { x: 885, y: 425 };
  const attacker = Object.freeze({ id: 'attacker', index: 0, y: 425, depthY: 425 });
  const stages = new Set();
  let largestHeight = 0;
  const samples = [...new Set([...Array.from({ length: 139 }, (_, index) => index * 16), 119, 120, 879, 880, 1099, 1100, 1599, 1600, 2099, 2100])];
  for (const lift of [0, 52]) for (const age of samples) {
    const frame = arenaThrow(age, origin, landing, 1, 1, { lift, angle: lift ? -.22 : 0 });
    stages.add(frame.stage); largestHeight = Math.max(largestHeight, frame.height);
    const victim = Object.freeze({ id: 'victim', index: 1, y: frame.y, depthY: frame.groundY });
    // This deliberately reverses the input: contact depth determines occlusion, not input or airtime.
    const input = Object.freeze([victim, attacker]);
    assert.deepEqual(arenaDrawOrder(input).map(actor => actor.id), ['attacker', 'victim'], `hand/body layers flipped at ${age}ms (${frame.stage}, lift ${lift})`);
    assert.deepEqual(input, [victim, attacker], 'rendering must leave actor storage untouched');
  }
  assert.ok(largestHeight > 130, 'the regression must include an actual high throw');
  assert.deepEqual([...stages], ['hold', 'flight', 'land', 'roll', 'recover', 'walk']);

  const bystander = { id: 'bystander', index: 0, y: 450 };
  const movingOrder = age => {
    const frame = arenaThrow(age, { x: 500, y: 415 }, { x: 885, y: 465 }, 1, 1, { lift: 52, angle: -.22 });
    return arenaDrawOrder([{ id: 'victim', index: 1, y: frame.y, depthY: frame.groundY }, bystander]).map(actor => actor.id);
  };
  assert.deepEqual(movingOrder(100), ['victim', 'bystander'], 'a held fighter stays behind the nearer spectator');
  assert.deepEqual(movingOrder(700), ['bystander', 'victim'], 'crossing the spectator on the ground must bring the fighter forward even while airborne');
  assert.deepEqual(movingOrder(2100), ['bystander', 'victim'], 'recovery must retain the landing depth');
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

test('alliances physically attack together before resistance, betrayal and a front counter', () => {
  const base = { id: 'story', index: 0, aggressor: 'attacker', helper: 'helper', victim: 'target', start: 1000, impact: 5000, resolve: 6100, end: 6600, final: false };
  const team = { ...base, tactic: 'team' }, betrayal = { ...base, tactic: 'betrayal' };
  const joint = arenaAction(team, 4500);
  assert.deepEqual(joint.attackers, ['attacker', 'helper']);
  assert.equal(joint.targetId, 'target');
  const left = joint.actors.find(actor => actor.id === 'attacker'), right = joint.actors.find(actor => actor.id === 'helper');
  assert.ok(left.offset.x < 0 && right.offset.x > 0, 'the allies surround the same opponent');
  assert.equal(left.gripId, 'target'); assert.equal(right.gripId, 'target');
  assert.equal(left.pose, 'lift'); assert.equal(right.pose, 'lift');
  assert.ok(joint.lift > 10);

  const firstAttack = arenaAction(betrayal, 3200);
  assert.equal(firstAttack.stage, 'joint-attack');
  assert.deepEqual(firstAttack.attackers, ['target', 'helper']);
  assert.equal(firstAttack.targetId, 'attacker');
  assert.equal(firstAttack.liftedId, 'attacker');
  assert.ok(firstAttack.lift > 10, 'the alliance actually lifts its opponent before it breaks');
  assert.equal(firstAttack.actors.find(actor => actor.id === 'helper').gripId, 'attacker');
  const alliance = arenaStoryState(betrayal, 3200);
  assert.deepEqual(alliance.left, ['target', 'helper']);
  assert.deepEqual(alliance.right, ['attacker']);
  assert.match(alliance.action, /양쪽에서.*함께 들어/);

  const resisting = arenaAction(betrayal, 3950);
  assert.equal(resisting.stage, 'resist');
  assert.equal(resisting.betrayed, false);
  assert.ok(resisting.lift < firstAttack.lift);
  assert.equal(resisting.actors.find(actor => actor.id === 'helper').gripId, 'attacker');
  const released = arenaAction(betrayal, 4250);
  assert.equal(released.stage, 'betrayal');
  assert.equal(released.actors.find(actor => actor.id === 'helper').gripId, undefined);
  assert.equal(released.lift, 0, 'letting go alone is not an automatic rear throw');
  const broken = arenaStoryState(betrayal, 4250);
  assert.equal(broken.relation, '×');
  assert.match(broken.action, /손을 놓습니다/);
  const counter = arenaAction(betrayal, 4800);
  assert.equal(counter.stage, 'counter');
  assert.equal(counter.liftedId, 'target');
  assert.equal(counter.actors.find(actor => actor.id === 'attacker').gripId, 'target');
  assert.ok(counter.lift > 20);
  assert.equal(arenaBeat(team, 5000).stage, 'impact');
  assert.equal(arenaBeat(team, 6100).stage, 'result');
  assert.match(arenaStoryState(team, 6100).action, /장외에 착지/);

  const failed = { ...team, exchange: true, resolve: Infinity };
  assert.equal(arenaAction(failed, 5600).outcome, 'resisted');
  assert.equal(arenaAction(failed, 5600).lift, 0);
  assert.match(arenaStoryState(failed, 5600).action, /공동공격 실패/);
  assert.doesNotMatch(arenaStoryState(failed, 5600).action, /장외|우승/);
  const survived = { ...betrayal, exchange: true, resolve: Infinity };
  assert.match(arenaStoryState(survived, 5600).action, /역습도 버텼/);
});

test('arena approach and release share a capped motor and remain anchored to the current encounter', () => {
  for (const requested of [94, 105, 165, 190, 300, 330]) {
    const body = { x: 220, y: 350, facing: 1 }, target = { x: 720, y: 470 };
    for (let frame = 0; frame < 420; frame++) {
      const before = { ...body };
      arenaMove(body, target, .016, requested);
      assert.ok(Math.hypot(body.x - before.x, body.y - before.y) <= Math.min(requested, ARENA_MAX_GROUND_SPEED) * .016 + 1e-6);
      const frozen = { ...body }; arenaMove(body, target, 0, requested); assert.deepEqual(body, frozen);
    }
    assert.ok(Math.hypot(body.x - target.x, body.y - target.y) < 1, 'approach must walk to its target');
  }
  const origin = { x: 590, y: 444 }, center = { x: 550, y: 430 };
  let previous = arenaReleaseTarget(origin, center, 'helper', 0);
  assert.deepEqual(previous, origin);
  for (let step = 1; step <= 100; step++) {
    const current = arenaReleaseTarget(origin, center, 'helper', step / 100);
    assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) < .5);
    assert.ok(Math.hypot(current.x - origin.x, current.y - origin.y) < 25);
    previous = current;
  }
  assert.deepEqual(arenaReleaseTarget({ x: origin.x - 73, y: origin.y + 9 }, { x: center.x - 73, y: center.y + 9 }, 'helper', 1), { x: previous.x - 73, y: previous.y + 9 });
  const guard = Array.from({ length: 24 }, (_, step) => arenaGuardTarget(origin, 3, step * 100));
  assert.ok(Math.max(...guard.map(point => point.x)) - Math.min(...guard.map(point => point.x)) > 6, 'a solitary guard keeps searching on its feet');
  assert.ok(guard.every(point => Math.hypot(point.x - origin.x, point.y - origin.y) < 6));
});

test('focus reserves physical approach and uses living actors without changing the draw', () => {
  for (const duration of [40_000, 62_000]) for (let size = 2; size <= 10; size++) {
    const order = participants.slice(0, size).map(player => player.id).reverse();
    const rounds = arenaRounds(order, duration), original = [...order];
    for (let elapsed = 0; elapsed < rounds.at(-1).resolve; elapsed += 160) {
      const round = arenaFocusRound(order, elapsed, duration);
      if (!round) continue;
      const ranks = arenaRanks(order, elapsed, duration);
      for (const part of arenaAction(round, elapsed).actors) assert.ok(order.includes(part.id) && !ranks[part.id] || part.id === round.victim && elapsed >= round.impact);
      if (elapsed < round.start) assert.equal(arenaAction(round, elapsed).lift, 0, 'early arrival waits in an active guard instead of attacking ahead of time');
    }
    assert.ok(rounds.filter(round => round.tactic === 'team' || round.tactic === 'betrayal').length <= 1);
    if (size < 7) assert.ok(rounds.every(round => round.tactic !== 'team' && round.tactic !== 'betrayal'));
    assert.ok(!['team', 'betrayal'].includes(arenaExchange(order, 1000, duration)?.tactic));
    assert.deepEqual(arenaRanks(order, duration, duration), Object.fromEntries(order.map((id, index) => [id, index + 1])));
    assert.deepEqual(order, original);
  }
});

test('alliance attacks are a sparse surprise and never repeat in background exchanges', () => {
  let allianceGames = 0, largeGames = 0;
  for (let size = 2; size <= 10; size++) for (let variation = 0; variation < 60; variation++) {
    const order = Array.from({ length: size }, (_, index) => `field-${variation}-${index}`);
    const rounds = arenaRounds(order), alliances = rounds.filter(round => ['team', 'betrayal'].includes(round.tactic));
    assert.ok(alliances.length <= 1, `repeated alliance in a ${size}-person match`);
    if (size < 7) assert.equal(alliances.length, 0, 'small matches use individual tactics');
    else { largeGames++; if (alliances.length) allianceGames++; }
    for (let elapsed = 0; elapsed < 39_000; elapsed += 1200) {
      const exchange = arenaExchange(order, elapsed);
      if (exchange) {
        assert.ok(!['team', 'betrayal'].includes(exchange.tactic));
        assert.equal(exchange.helper, undefined, 'a background bout is always a duel');
      }
    }
  }
  assert.ok(allianceGames > 0 && allianceGames < largeGames / 2, 'alliances stay available without becoming the default story');
});

test('background mini exchanges engage every available pair independently and never eliminate spectators', () => {
  for (let size = 2; size <= 10; size++) {
    const available = participants.slice(0, size).map((person, index) => ({ id: person.id, ...arenaStartingPoint(index, size) }));
    const before = structuredClone(available), rounds = arenaMiniExchanges(available, 12_000);
    assert.equal(rounds.length, Math.floor(size / 2));
    assert.equal(new Set(rounds.flatMap(round => [round.aggressor, round.victim])).size, rounds.length * 2);
    assert.equal(new Set(rounds.map(round => round.start)).size, rounds.length, 'each pair starts on its own beat');
    assert.deepEqual(arenaMiniExchanges(available, 12_000), rounds);
    for (const round of rounds) {
      assert.ok(round.exchange && !round.final && round.resolve === Infinity);
      assert.notEqual(round.aggressor, round.victim);
      const bodies = new Map([round.aggressor, round.victim].map(id => [id, { ...available.find(person => person.id === id), facing: 1 }]));
      const originalA = bodies.get(round.aggressor), originalV = bodies.get(round.victim);
      const center = { x: (originalA.x + originalV.x) / 2, y: (originalA.y + originalV.y) / 2 };
      const seen = new Set(), poses = new Set();
      let actualContact = false;
      for (let time = round.start; time < round.end; time += 16) {
        const action = arenaAction(round, time); seen.add(action.stage);
        for (const part of action.actors) {
          poses.add(part.pose);
          const body = bodies.get(part.id), previous = { ...body };
          arenaMove(body, { x: center.x + part.offset.x, y: center.y + part.offset.y }, .016, 165);
          assert.ok(Math.hypot(body.x - previous.x, body.y - previous.y) <= ARENA_MAX_GROUND_SPEED * .016 + 1e-6);
        }
        const attacker = bodies.get(round.aggressor), defender = bodies.get(round.victim);
        if (action.actors.some(part => part.gripId) && Math.hypot(attacker.x - defender.x, attacker.y - defender.y) < 86) actualContact = true;
      }
      assert.ok(seen.has('approach') && seen.has('link') && seen.has('lift') && seen.has('release'), 'mini fights contain contact and a response, rather than only an idle loop');
      if (round.tactic === 'bait') assert.ok(poses.has('dodge') && poses.has('run'), 'a feint has an actual charge and a sidestep');
      else assert.ok(actualContact && poses.has('brace') && poses.has('lift'), 'a background pair reaches contact, blocks and counters');
      assert.equal(arenaAction(round, round.impact + 1000).outcome, 'resisted');
      assert.equal(arenaAction(round, round.impact + 1000).lift, 0);
    }
    assert.deepEqual(available, before);
    const reserved = new Set(available.slice(0, 3).map(person => person.id));
    const outside = arenaMiniExchanges(available.filter(person => !reserved.has(person.id)), 20_000);
    for (const round of outside) assert.ok(!reserved.has(round.aggressor) && !reserved.has(round.victim), 'the main event cannot also move someone in a background pair');
  }
});

test('simultaneous duels reserve separate contacts instead of forming an accidental alliance pileup', () => {
  for (const origin of [{ x: 500, y: 440 }, { x: 575, y: 425 }, { x: 400, y: 410 }]) {
    const occupied = [];
    for (let pair = 0; pair < 5; pair++) {
      const center = arenaContactPoint(origin, occupied);
      for (const other of occupied) assert.ok(Math.hypot((center.x - other.x) / 180, (center.y - other.y) / 95) >= .99, 'independent pairs must have distinct physical room');
      assert.ok((center.x - 500) ** 2 / 303 ** 2 + (center.y - 416) ** 2 / 112 ** 2 < 1, 'the contact stays on the sand');
      occupied.push(center);
    }
  }
});

test('arena awards the actual top three in fixed rank positions and waits for runner-up recovery', () => {
  for (const duration of [40_000, 44_000, 62_000]) for (let size = 2; size <= 10; size++) for (let rotation = 0; rotation < size; rotation++) {
    const ids = participants.slice(0, size).map(player => player.id);
    const order = [...ids.slice(rotation), ...ids.slice(0, rotation)].reverse(), original = [...order];
    const places = arenaPodium(order, duration), final = arenaRounds(order, duration).at(-1);
    assert.deepEqual(places.map(place => place.id), order.slice(0, 3));
    assert.deepEqual(places.map(place => place.rank), size === 2 ? [1, 2] : [1, 2, 3]);
    assert.equal(places[0].x, 500);
    assert.ok(places[1].x < places[0].x && places[1].y > places[0].y);
    if (size >= 3) assert.ok(places[2].x > places[0].x && places[2].y > places[1].y);
    if (size >= 4) assert.ok(!places.some(place => place.id === order.at(-1)), 'last place must remain at the bench');
    const recovery = arenaThrow(places[1].readyAt - final.impact, { x: 500, y: 425 }, { x: 885, y: 436 }, 1, duration / 44_000);
    assert.equal(recovery.stage, 'walk', 'runner-up must land and recover before walking to the podium');
    for (const place of places) assert.ok(place.readyAt >= final.resolve && place.readyAt < duration);
    assert.deepEqual(order, original);
  }
});

test('arena podium walks stay continuous and a pause freezes their motor state', () => {
  for (let size = 2; size <= 10; size++) {
    const order = participants.slice(0, size).map(player => player.id).reverse();
    for (const place of arenaPodium(order)) {
      const origin = place.rank === 1 ? { x: 615, y: 465 } : place.rank === 2 ? { x: 885, y: 436 } : { x: 38, y: 378 };
      const body = { ...origin, facing: -1, motorX: 0, motorY: 0 }, speed = place.rank === 1 ? 126 : 190;
      let walked = 0;
      for (let frame = 0; frame < 420; frame++) {
        const before = { ...body };
        arenaMove(body, place, .016, speed);
        const step = Math.hypot(body.x - before.x, body.y - before.y);
        assert.ok(step <= speed * .016 + .000001, 'podium movement must follow its walking speed');
        walked += step;
        const paused = { ...body };
        for (let pauseFrame = 0; pauseFrame < 3; pauseFrame++) arenaMove(body, place, 0, speed);
        assert.deepEqual(body, paused);
      }
      assert.ok(Math.hypot(body.x - place.x, body.y - place.y) < 1, `${place.rank}th podium place was not reached`);
      assert.ok(walked >= Math.hypot(origin.x - place.x, origin.y - place.y) - 1, 'the path must be walked, not reconstructed midway');
    }
  }
});

test('fighters released from an exchange keep their current contact instead of returning to a starting home', () => {
  for (let size = 2; size <= 10; size++) for (let index = 0; index < size; index++) {
    const home = arenaStartingPoint(index, size), contact = { x: 490 + index * 3, y: 430 }, opponent = { x: 610 + index * 3, y: 430 };
    for (const stage of ['watch', 'contact']) assert.deepEqual(arenaRoamingTarget(contact, opponent, index, stage), contact);
    assert.deepEqual(arenaRoamingTarget(contact, undefined, index, 'approach'), contact);
    const next = arenaRoamingTarget(contact, opponent, index, 'approach');
    assert.ok(next.x > contact.x && next.y === contact.y, 'next approach must follow the live opponent');
    assert.ok(Math.hypot(next.x - home.x, next.y - home.y) > 10, 'next approach must not select a fixed home');
    const sidestep = arenaRoamingTarget(contact, opponent, index, 'sidestep');
    assert.ok(Math.hypot(sidestep.x - contact.x, sidestep.y - contact.y) <= 18, 'one sidestep remains anchored at the current encounter');
    const translated = arenaRoamingTarget({ x: contact.x - 40, y: contact.y - 15 }, { x: opponent.x - 40, y: opponent.y - 15 }, index, 'approach');
    assert.deepEqual(translated, { x: next.x - 40, y: next.y - 15 }, 'navigation must follow moved participants, not their original field slots');
  }
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

test('racing combines track tactics, pace changes and visible course obstacles', () => {
  const allowed = new Set(['blocked', 'inside', 'outside', 'chase', 'gust', 'balance', 'draft', 'fatigue', 'patience', 'lead-change', 'rail', 'last-kick', 'hay-jump', 'puddle']);
  assert.deepEqual(new Set(RACING_STORIES.map(story => story.kind)), allowed);
  for (let size = 2; size <= 10; size++) for (let seed = 0; seed < 100; seed++) {
    const list = participants.slice(0, size), order = list.map(player => player.id).reverse();
    const incidents = createRacingIncidents(list, order, 44_000, seed);
    assert.equal(incidents.length, 3, 'obstacles share the natural race story pacing');
    for (const incident of incidents) assert.ok(allowed.has(incident.kind), `unexpected race event: ${incident.kind}`);
  }
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

test('the final straight keeps field gaps and separates rank crossings instead of merging a reversed field', () => {
  const gap = .005;
  for (let size = 2; size <= 10; size++) {
    const list = participants.slice(0, size), ids = list.map(player => player.id), order = [...ids].reverse();
    const timeline = buildRacingTimeline(list, order, 44_000);
    const baselineSpeed = 1000 / (timeline.finish - timeline.start);
    assert.deepEqual(racingStandings(timeline, timeline.straight.start).map(standing => standing.id), ids);
    let previousOrder = ids, previousDistances = ids.map(id => readRacingDistance(timeline, id, timeline.straight.start));
    const crossings = new Set();
    for (let elapsed = timeline.straight.start + 16; elapsed <= timeline.finish; elapsed += 16) {
      const currentOrder = racingStandings(timeline, elapsed).map(standing => standing.id);
      const distances = ids.map(id => readRacingDistance(timeline, id, elapsed));
      if (size >= 3) assert.ok(Math.max(...distances) - Math.min(...distances) >= (size - 2) * gap - .000001, `${size} horses crowded into one point at ${elapsed}ms`);
      let changed = 0;
      for (let left = 0; left < size; left++) for (let right = left + 1; right < size; right++) {
        if ((previousOrder.indexOf(ids[left]) - previousOrder.indexOf(ids[right])) * (currentOrder.indexOf(ids[left]) - currentOrder.indexOf(ids[right])) < 0) {
          changed++; crossings.add(`${ids[left]}|${ids[right]}`);
        }
      }
      assert.ok(changed <= 2, `${changed} rank pairs crossed together at ${elapsed}ms`);
      for (let index = 0; index < size; index++) {
        const speed = (distances[index] - previousDistances[index]) / .016;
        assert.ok(speed > baselineSpeed * .15 && speed < baselineSpeed * 1.9, `unreadable straight speed: ${size} horses/${ids[index]}/${elapsed}ms, ${speed}`);
      }
      previousOrder = currentOrder; previousDistances = distances;
    }
    assert.equal(crossings.size, size * (size - 1) / 2, 'every required reversal must be visibly crossed, not assigned at the finish');
    assert.deepEqual(previousOrder, order);
  }
});

test('seeded final duels preserve the chosen result, incident outcomes and positive movement', () => {
  for (let size = 2; size <= 10; size++) for (let seed = 1; seed <= 30; seed++) {
    const list = participants.slice(0, size), ids = list.map(player => player.id), rotation = seed % size;
    const order = [...ids.slice(rotation), ...ids.slice(0, rotation)].reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    const before = timeline.incidents.at(-1).afterOrder;
    assert.deepEqual(racingStandings(timeline, timeline.straight.start).map(standing => standing.id), before);
    let previous = racingStandings(timeline, timeline.straight.start), last = timeline.straight.start;
    for (let elapsed = last + 16; elapsed <= timeline.finish; elapsed += 16) {
      const current = racingStandings(timeline, elapsed);
      for (const standing of current) assert.ok(standing.distance > previous.find(horse => horse.id === standing.id).distance, `backward final duel: ${size}/${seed}/${standing.id}/${elapsed}`);
      let changed = 0;
      for (let left = 0; left < size; left++) for (let right = left + 1; right < size; right++) {
        const a = ids[left], b = ids[right];
        if ((previous.findIndex(horse => horse.id === a) - previous.findIndex(horse => horse.id === b)) * (current.findIndex(horse => horse.id === a) - current.findIndex(horse => horse.id === b)) < 0) changed++;
      }
      assert.ok(changed <= 2, `mass final reshuffle: ${size}/${seed}/${elapsed}: ${changed}`);
      previous = current;
    }
    assert.deepEqual(previous.map(horse => horse.id), order);
    assert.deepEqual(racingStandings(timeline, 44_000).map(horse => horse.id), order);
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

test('racing camera follows both final-straight rivals from preparation through the crossing result', () => {
  let checkedSwaps = 0;
  for (let size = 2; size <= 10; size++) for (let seed = 0; seed <= 20; seed++) {
    const list = participants.slice(0, size), order = list.map(player => player.id).reverse();
    const incidents = seed ? createRacingIncidents(list, order, 44_000, seed) : [];
    const timeline = buildRacingTimeline(list, order, 44_000, incidents);
    for (const wave of timeline.straight.waves) for (const swap of wave.swaps) {
      if (wave.beforeOrder.indexOf(swap.aheadId) >= 3) continue;
      checkedSwaps++;
      const samples = [swap.start - 500, swap.start - .001, swap.start, (swap.start + swap.end) / 2, swap.end, swap.end + 649.999];
      for (let elapsed = swap.start - 500; elapsed < swap.end + 650; elapsed += 50) samples.push(elapsed);
      for (const elapsed of samples) {
        const focus = racingFocusIds(timeline, elapsed);
        for (const id of [swap.aheadId, swap.behindId]) assert.ok(focus.includes(id), `missing final rival: ${size} horses/seed ${seed}/${elapsed}ms/${id}`);
        for (const leader of racingStandings(timeline, elapsed).slice(0, 3)) assert.ok(focus.includes(leader.id), 'following a challenger must retain the live leaders');
        assert.equal(new Set(focus).size, focus.length);
      }
    }
  }
  assert.ok(checkedSwaps > 100, 'the framing test must include actual top-three duels');
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
      const fixedScale = Math.max(.17, Math.min(1.35, w / 600, h / 470));
      assert.ok(field.every(horse => horse.scale === fixedScale), 'rank and focus must not resize any horse');
      if (previousRanks && previousRanks !== ranks) rankChanges++;
      const active = timeline.incidents.find(incident => elapsed >= incident.start && elapsed <= incident.end);
      const straightDuel = timeline.straight.waves.some(wave => wave.swaps.some(swap => wave.beforeOrder.indexOf(swap.aheadId) < 3 && elapsed >= swap.start && elapsed < swap.end + 650));
      for (const horse of field) {
        const context = `${size} horses, seed ${seed}, ${w}px, ${elapsed}ms, ${horse.id}`;
        assert.equal(list[horse.index].id, horse.id, `name and color identity changed: ${context}`);
        assert.equal(horse.featured, focus.includes(horse.id));
        assert.equal(horse.distance, readRacingTravel(timeline, horse.id, elapsed));
        assert.ok([horse.x, horse.y, horse.scale].every(Number.isFinite) && horse.scale > 0, context);
        assert.ok(Math.abs(horse.x - (w * .5 + (horse.distance - camera.center) / camera.span * w * .65)) < .000001, `position no longer follows actual travel: ${context}`);
        const bodyRoot = horse.x - 57 * horse.scale;
        // Labels are separately clamped by the renderer; the whole focused horse must fit the camera.
        if ((active || straightDuel) && horse.featured) assert.ok(horse.x <= w && bodyRoot - 52 * horse.scale >= 0, `story horse outside camera: ${context}, nose=${horse.x}, body=${bodyRoot}`);
        if (previous) {
          const prior = previous[horse.index];
          // Wide framing may begin before a story; rank changes must never teleport a persistent horse.
          assert.ok(Math.abs(horse.x - prior.x) < w * .04, `horizontal cut: ${context}`);
          assert.ok(Math.abs(horse.y - prior.y) < h * .015, `lane cut: ${context}`);
          assert.equal(horse.y, prior.y, 'camera focus must preserve a horse’s input-identity lane');
          assert.ok(Math.abs(horse.scale - prior.scale) < .025, `scale cut: ${context}`);
          assert.equal(horse.scale, prior.scale, 'camera focus must preserve a horse’s size');
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
