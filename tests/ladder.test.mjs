import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildLadderTimeline, ladderFrame, LADDER_STORIES, LADDER_RUNGS } = await load('src/ladderLogic.ts');
const { createSportsOrder } = await load('src/sports.ts');
const { createLadderGeometry, ladderArtActors, sampleLadderRig, ladderSuspension, drawLadderCrossing } = await load('src/game/ladderArt.ts');
const participants = Array.from({ length: 10 }, (_, index) => ({ id: `person-${index}`, name: `참가자 ${index + 1}`, color: '#83c7de' }));

test('the actual bridge paths preserve every uniformly drawn door assignment', () => {
  const candidates = participants.slice(0, 5), orders = [];
  function visit(choices, limit) {
    if (limit === 1) { let cursor = 0; orders.push(createSportsOrder(candidates, () => choices[cursor++])); return; }
    for (let choice = 0; choice < limit; choice++) visit([...choices, choice], limit - 1);
  }
  visit([], 5);
  assert.equal(orders.length, 120);
  assert.equal(new Set(orders.map(order => order.join(','))).size, 120);
  for (let goal = 0; goal < candidates.length; goal++) {
    const counts = new Map(candidates.map(candidate => [candidate.id, 0]));
    for (const order of orders) {
      const timeline = buildLadderTimeline(candidates, order, 44_000, 13);
      const frame = ladderFrame(timeline, 44_000, goal);
      assert.equal(frame.winnerId, order[goal]);
      assert.equal(frame.actors.find(actor => actor.winner).doorLane, goal);
      counts.set(frame.winnerId, counts.get(frame.winnerId) + 1);
      for (const actor of frame.actors) assert.equal(order[actor.doorLane], actor.id);
    }
    for (const count of counts.values()) assert.equal(count, 24);
  }
});

test('2–10 participants follow unambiguous physical bridges to distinct doors', () => {
  for (let count = 2; count <= 10; count++) for (let seed = 0; seed < 24; seed++) {
    const candidates = participants.slice(0, count), ids = candidates.map(candidate => candidate.id);
    const order = seed % 2 ? [...ids].reverse() : [...ids.slice(seed % count), ...ids.slice(0, seed % count)];
    const timeline = buildLadderTimeline(candidates, order, 44_000, seed), occupants = [...ids];
    assert.equal(timeline.rungCount, 24);
    const byRow = new Map();
    for (const bridge of timeline.bridges) {
      if (!byRow.has(bridge.row)) byRow.set(bridge.row, []);
      byRow.get(bridge.row).push(bridge);
    }
    for (const [row, bridges] of byRow) {
      assert.ok(row > 0 && row < LADDER_RUNGS);
      const lanes = new Set();
      for (const bridge of bridges) {
        assert.ok(bridge.rightLane > bridge.leftLane && bridge.rightLane < count);
        assert.ok(!lanes.has(bridge.leftLane) && !lanes.has(bridge.rightLane), 'one rung layer has no forks');
        lanes.add(bridge.leftLane); lanes.add(bridge.rightLane);
        assert.deepEqual(bridge.actorIds, [occupants[bridge.leftLane], occupants[bridge.rightLane]]);
        [occupants[bridge.leftLane], occupants[bridge.rightLane]] = [occupants[bridge.rightLane], occupants[bridge.leftLane]];
      }
    }
    assert.deepEqual(occupants, order);
    const final = ladderFrame(timeline, 44_000, seed % count);
    assert.equal(new Set(final.actors.map(actor => actor.doorLane)).size, count);
    assert.equal(final.actors.length, count);
    assert.ok(final.complete && final.actors.every(actor => actor.arrived));
    for (const actor of final.actors) {
      assert.equal(actor.lane, order.indexOf(actor.id));
      assert.equal(actor.rungProgress, 24);
      assert.equal('rank' in actor, false);
      assert.ok(timeline.paths[actor.id].segments.filter(segment => segment.fromLane !== segment.toLane).length >= 2, 'even an unchanged destination takes real lateral routes');
    }
  }
});

test('a chosen door reveals its occupant only after that person actually enters it', () => {
  const order = participants.map(candidate => candidate.id).reverse();
  const timeline = buildLadderTimeline(participants, order, 44_000, 4);
  for (let target = 0; target < 10; target++) {
    const arrival = timeline.paths[order[target]].arrivalAt;
    for (const time of [0, 8500, 20_000, arrival - .01]) {
      const frame = ladderFrame(timeline, time, target);
      assert.equal(frame.winnerId, undefined);
      assert.ok(frame.actors.every(actor => !actor.winner));
      for (const actor of frame.actors.filter(actor => !actor.arrived)) assert.equal(actor.doorLane, undefined);
    }
    const entry = ladderFrame(timeline, arrival, target);
    assert.equal(entry.winnerId, order[target]);
    assert.equal(entry.actors.filter(actor => actor.winner).length, 1);
    assert.equal(entry.actors.find(actor => actor.winner).height, 1);
  }
});

test('movement stays continuous at crossings, falls, catches, recoveries and doors', () => {
  for (let count = 2; count <= 10; count++) for (const seed of [1, 4, 12, 31]) {
    const candidates = participants.slice(0, count), order = candidates.map(candidate => candidate.id).reverse();
    const timeline = buildLadderTimeline(candidates, order, 44_000, seed);
    let previous = ladderFrame(timeline, 0, 0);
    for (let elapsed = 16; elapsed <= 44_000; elapsed += 16) {
      const current = ladderFrame(timeline, elapsed, 0);
      for (let index = 0; index < count; index++) {
        const actor = current.actors[index], before = previous.actors[index];
        assert.equal(actor.id, before.id);
        assert.ok(Math.abs(actor.lane - before.lane) < .12, `horizontal jump ${count}/${seed}/${elapsed}`);
        assert.ok(Math.abs(actor.rungProgress - before.rungProgress) < .36, `vertical jump ${count}/${seed}/${elapsed}`);
        assert.ok(actor.lane >= 0 && actor.lane <= count - 1 && actor.height >= 0 && actor.height < 1.04);
        assert.equal(actor.height, actor.rungProgress / 24);
      }
      previous = current;
    }
    for (const path of Object.values(timeline.paths)) for (const segment of path.segments) {
      for (const boundary of [segment.start, segment.end]) {
        const left = ladderFrame(timeline, boundary - .001, 0).actors.find(actor => actor.id === path.id);
        const right = ladderFrame(timeline, boundary + .001, 0).actors.find(actor => actor.id === path.id);
        assert.ok(Math.abs(left.lane - right.lane) < .001);
        assert.ok(Math.abs(left.rungProgress - right.rungProgress) < .001);
      }
    }
  }
});

test('every crossing has a readable mechanism, while arrivals and trap appointments stay fixed', () => {
  for (let count = 2; count <= 10; count++) {
    const candidates = participants.slice(0, count), order = candidates.map(candidate => candidate.id);
    const timeline = buildLadderTimeline(candidates, order, 44_000, 7);
    const crossings = Object.values(timeline.paths).flatMap(path => path.segments.filter(segment => segment.kind === 'bridge'));
    assert.ok(crossings.every(segment => {
      const distance = Math.abs(segment.toLane - segment.fromLane);
      return segment.end - segment.start >= 1100 && segment.end - segment.start <= 1650 + (distance - 1) * 250;
    }));
    for (const bridge of timeline.bridges) {
      assert.ok(bridge.motionType && bridge.mechanism && bridge.start < bridge.end);
      assert.ok(['slide', 'drop', 'swing', 'launch', 'rotate', 'conveyor', 'portal', 'pounce'].includes(bridge.motionType));
      for (const id of bridge.actorIds) {
        const segment = timeline.paths[id].segments.find(part => part.bridgeId === bridge.id);
        const event = timeline.events.find(item => item.id === segment.eventId);
        const sampleAt = event ? event.action + (event.resolve - event.action) * .35 : segment.start + (segment.end - segment.start) * .4;
        const middle = ladderFrame(timeline, sampleAt, 0).actors.find(actor => actor.id === id);
        assert.equal(middle.motionType, segment.transferRole === 'primary' ? bridge.motionType : bridge.partnerMotionType);
        assert.equal(middle.depthOffset, 0, 'both actors follow actual motion rather than a displaced service deck');
        assert.equal(segment.start, bridge.start);
        assert.equal(segment.end, bridge.end);
        if (bridge.motionType === 'pounce') assert.ok(middle.interaction, 'a grapple is an actual paired interaction');
        else assert.ok(middle.transferProgress > 0 && middle.transferProgress < 1);
      }
    }
    for (const path of Object.values(timeline.paths)) {
      assert.ok(path.arrivalAt >= 39_500 && path.arrivalAt <= 41_200);
      assert.equal(path.segments.at(-1).end, path.arrivalAt);
    }
    for (const event of timeline.events) {
      const segment = timeline.paths[event.actorId].segments.find(part => part.eventId === event.id);
      assert.equal(segment.start, event.setup);
      assert.equal(segment.end, event.end);
    }
    assert.equal(ladderFrame(timeline, 44_000, count - 1).winnerId, order[count - 1]);
  }
});

test('nineteen readable event kinds vary independently of the destination draw', () => {
  assert.equal(LADDER_STORIES.length, 19);
  assert.equal(new Set(LADDER_STORIES.map(story => story.kind)).size, 19);
  const seen = new Set(), order = participants.map(candidate => candidate.id).reverse();
  for (let seed = 0; seed < 160; seed++) {
    const timeline = buildLadderTimeline(participants, order, 44_000, seed);
    assert.ok(timeline.events.length === 4 || timeline.events.length === 5);
    assert.equal(new Set(timeline.events.map(event => event.kind)).size, timeline.events.length);
    for (let index = 0; index < timeline.events.length; index++) {
      const event = timeline.events[index]; seen.add(event.kind);
      assert.ok(order.includes(event.actorId) && event.actors.includes(event.actorId));
      assert.ok(event.action - event.setup >= 400 && event.action - event.setup <= 500, 'a short readable anticipation precedes the danger');
      const actionDuration = event.resolve - event.action;
      if (event.motion.type === 'pounce') assert.ok(actionDuration >= 2200 && actionDuration <= 2400, 'the paired grab and throw remain readable');
      else assert.ok(actionDuration >= 1750 && actionDuration <= (Math.abs(event.toLane - event.fromLane) > 1 ? 2700 : 1900), 'the flight and catch remain readable over their real distance');
      assert.ok(event.end - event.resolve >= 1000 && event.end - event.resolve <= 1200, 'the climber has time to pull their body onto the rung');
      assert.ok(event.title && event.setupText && event.actionText && event.recoveryText && event.prop);
      for (const other of timeline.events.slice(0, index).filter(other => other.actors.some(id => event.actors.includes(id)))) {
        assert.ok(event.setup >= other.end || other.setup >= event.end, 'one person never enters two events at once');
      }
      const start = ladderFrame(timeline, event.setup, 0).actors.find(actor => actor.id === event.actorId);
      const end = ladderFrame(timeline, event.end, 0).actors.find(actor => actor.id === event.actorId);
      assert.equal(start.lane, event.fromLane);
      assert.equal(start.rungProgress, event.row);
      assert.ok(Math.abs(end.lane - event.toLane) < 1e-8);
      assert.ok(Math.abs(end.rungProgress - event.toRow) < 1e-8);
      assert.notEqual(event.fromLane, event.toLane);
      assert.equal(event.actors.length, 2);
      assert.equal(new Set(event.actors).size, 2);
      assert.ok(event.actors.includes(event.partnerId));
      const landed = ladderFrame(timeline, event.resolve, 0).actors.find(actor => actor.id === event.actorId);
      const partner = ladderFrame(timeline, event.resolve, 0).actors.find(actor => actor.id === event.partnerId);
      assert.equal(landed.lane, event.toLane);
      assert.equal(partner.lane, event.fromLane);
      if (event.motion.type === 'pounce') assert.equal(landed.rungProgress, event.landingRow, 'the thrower keeps their feet planted after throwing');
      else assert.ok(landed.rungProgress < event.landingRow, 'the caught body still needs to pull itself onto the target foot rung');
      assert.ok(partner.rungProgress < event.partnerLandingRow);
      for (const id of event.actors) {
        const segments = timeline.paths[id].segments, eventIndex = segments.findIndex(segment => segment.eventId === event.id);
        assert.equal(segments[eventIndex + 1].fromLane, segments[eventIndex].toLane);
        assert.equal(segments[eventIndex + 1].fromRow, segments[eventIndex].toRow);
        assert.equal(segments[eventIndex + 1].kind, 'climb');
        assert.equal(segments[eventIndex + 1].start, segments[eventIndex].end);
      }
      for (const [time, stage] of [[event.setup + 100, 'setup'], [event.action + 100, 'action'], [event.resolve + 100, 'resolve']]) {
        assert.equal(ladderFrame(timeline, time, 0).activeEvents.find(active => active.id === event.id).stage, stage);
      }
      if (event.motion.type === 'drop') {
        const falling = ladderFrame(timeline, event.action + 400, 0).actors.find(actor => actor.id === event.actorId);
        const hanging = ladderFrame(timeline, event.resolve - 100, 0).actors.find(actor => actor.id === event.actorId);
        const recovering = ladderFrame(timeline, event.resolve + 500, 0).actors.find(actor => actor.id === event.actorId);
        assert.equal(falling.pose, 'drop');
        assert.equal(hanging.pose, 'hang');
        assert.equal(hanging.transferStage, 'catch');
        assert.equal(hanging.lane, event.toLane);
        assert.equal(hanging.gripRow, event.landingRow + 2);
        assert.ok(hanging.rungProgress < event.landingRow);
        assert.equal(recovering.pose, 'clamber');
        assert.ok(recovering.rungProgress > hanging.rungProgress && recovering.rungProgress < event.landingRow);
        assert.equal(recovering.lane, event.toLane);
        assert.ok(event.toRow < event.fromRow, 'the fall catches a lower rung of the other ladder');
      }

    }
    assert.equal(ladderFrame(timeline, 44_000, 7).winnerId, order[7]);
  }
  // Shorter casts have enough timeline room for the optional mechanism story;
  // the ten-person cast reserves that room for its longer physical paths.
  for (const count of [4, 6]) for (let seed = 0; seed < 48; seed++) {
    const candidates = participants.slice(0, count), order = candidates.map(candidate => candidate.id).reverse();
    const timeline = buildLadderTimeline(candidates, order, 44_000, seed);
    timeline.events.forEach(event => seen.add(event.kind));
    assert.equal(ladderFrame(timeline, 44_000, count - 1).winnerId, order[count - 1]);
  }
  assert.equal(seen.size, 19);
});

test('frames are pure for pause, backward seek and direct result skip', () => {
  const input = participants.slice(0, 3), order = input.map(candidate => candidate.id).reverse();
  const snapshot = structuredClone({ input, order }), timeline = buildLadderTimeline(input, order, 44_000, 7);
  const before = ladderFrame(timeline, 23_456, 1), final = ladderFrame(timeline, 44_000, 1);
  assert.deepEqual(ladderFrame(timeline, 23_456, 1), before);
  assert.deepEqual(ladderFrame(timeline, 44_000, 1), final);
  assert.equal(final.winnerId, order[1]);
  assert.equal(final.actors.filter(actor => actor.arrived).length, 3);
  assert.deepEqual({ input, order }, snapshot);
  assert.deepEqual(ladderFrame(timeline, -200, 1), ladderFrame(timeline, 0, 1));
  assert.deepEqual(ladderFrame(timeline, 80_000, 1), final);
});

test('the drawn body stays continuous from a lateral mechanism into the destination ladder', () => {
  const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // Turning changes front/back limb indices. Match the actual two contact locations.
  const pairDistance = (a, b) => Math.min(Math.max(pointDistance(a[0], b[0]), pointDistance(a[1], b[1])), Math.max(pointDistance(a[0], b[1]), pointDistance(a[1], b[0])));
  const covered = new Set();
  for (const count of [2, 10]) for (const height of [90, 150, 500]) for (const seed of [1, 4, 12, 31]) {
    const candidates = participants.slice(0, count), timeline = buildLadderTimeline(candidates, candidates.map(candidate => candidate.id).reverse(), 44_000, seed);
    const geometry = createLadderGeometry(640, height, count), read = time => ladderFrame(timeline, time, 0);
    const rigAt = (id, time) => {
      const actors = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read);
      const actor = actors.find(item => item.id === id);
      return { actor, rig: sampleLadderRig(actor, geometry, time) };
    };
    for (const event of timeline.events) {
      covered.add(event.motion.type);
      const boundaries = [event.setup, event.action, event.resolve, event.end];
      for (const boundary of boundaries) {
        const before = rigAt(event.actorId, boundary - .001).rig, after = rigAt(event.actorId, boundary + .001).rig;
        assert.ok(pointDistance(before.hip, after.hip) < .01, `${event.kind} body jumps at ${boundary}`);
        assert.ok(pointDistance(before.head, after.head) < .01, `${event.kind} head jumps at ${boundary}`);
        assert.ok(pairDistance(before.feet, after.feet) < .01, `${event.kind} feet jump at ${boundary}`);
      }
      let previous = rigAt(event.actorId, event.action);
      for (let time = event.action + 16; time < event.end; time += 16) {
        const current = rigAt(event.actorId, time);
        const motionStep = event.motion.type === 'pounce' ? Math.max(4, geometry.rungGap, geometry.laneGap * .05) : Math.max(4, geometry.rungGap);
        assert.ok(pointDistance(previous.rig.hip, current.rig.hip) < motionStep, `${event.kind} body jumps within the mechanism`);
        for (const part of ['hands', 'feet']) for (const side of [0, 1]) {
          const contact = (part === 'hands' ? current.rig.handContact : current.rig.footContact)[side];
          if (!contact || !['climb', 'hang', 'clamber'].includes(current.actor.pose)) continue;
          const point = current.rig[part][side], row = (geometry.bottom - point.y) / geometry.rungGap;
          const error = Math.abs(row - Math.round(row * geometry.subdivisions) / geometry.subdivisions) * geometry.rungGap;
          assert.ok(error < .01, `${event.kind} ${part} contact misses a rung by ${error}px`);
        }
        previous = current;
      }
      const time = event.resolve + 750;
      assert.deepEqual(rigAt(event.actorId, time), rigAt(event.actorId, time), 'paused and direct-seek rigs are identical');
    }
  }
  for (const type of ['drop', 'launch', 'swing']) assert.ok(covered.has(type));
});

test('each hand follows its own arm through turns and settles without a late snap', () => {
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const count of [2, 5, 10]) for (const seed of [1, 4, 12, 31]) {
    const candidates = participants.slice(0, count);
    const timeline = buildLadderTimeline(candidates, candidates.map(candidate => candidate.id).reverse(), 44_000, seed);
    const geometry = createLadderGeometry(800, 600, count);
    const read = time => ladderFrame(timeline, time, 0);
    const rigAt = (id, time) => {
      const actor = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read).find(item => item.id === id);
      return sampleLadderRig(actor, geometry, time);
    };
    for (const bridge of timeline.bridges) for (const id of bridge.actorIds) {
      const before = rigAt(id, bridge.start - 8), after = rigAt(id, bridge.start + 8);
      for (const side of [0, 1]) assert.ok(distance(before.hands[side], after.hands[side]) < 2, 'a turn does not swap hands across the body');
      const event = timeline.events.find(item => item.id === bridge.eventId);
      const resolve = event?.resolve ?? bridge.end - (bridge.end - bridge.start) * .16;
      for (let time = resolve + 16; time < bridge.end; time += 16) {
        const previous = rigAt(id, time - 16), current = rigAt(id, time);
        for (const side of [0, 1]) assert.ok(distance(previous.hands[side], current.hands[side]) < 9.5, `recovery hand jumps: ${count}/${seed}/${bridge.id}/${id}/${side}/${time}: ${distance(previous.hands[side], current.hands[side])}px`);
      }
    }
  }
});

test('climbing cadences visibly differ while every individual segment moves strictly forward', () => {
  const candidates = participants.slice(0, 4), timeline = buildLadderTimeline(candidates, candidates.map(candidate => candidate.id), 44_000, 7);
  const firstWave = timeline.waves[0];
  const midpoint = (Math.max(...Object.values(timeline.paths).map(path => path.startAt)) + firstWave.start) / 2;
  const rows = ladderFrame(timeline, midpoint, 0).actors.map(actor => actor.rungProgress);
  assert.ok(Math.max(...rows) - Math.min(...rows) > .4, 'different effort curves are visible even on the first short climb');
  for (const path of Object.values(timeline.paths)) for (const segment of path.segments.filter(part => part.kind === 'climb')) {
    let previous = segment.fromRow;
    for (let step = 0; step < 100; step++) {
      const time = segment.start + (segment.end - segment.start) * step / 100;
      const current = ladderFrame(timeline, time, 0).actors.find(actor => actor.id === path.id).rungProgress;
      assert.ok(current >= previous - 1e-8);
      previous = current;
    }
    assert.ok(Math.abs(ladderFrame(timeline, segment.end - .001, 0).actors.find(actor => actor.id === path.id).rungProgress - segment.toRow) < .001);
  }
});

test('the danger has distinct acceleration while climbers keep their own hand-over-hand rhythm', () => {
  const candidates = participants, order = candidates.map(candidate => candidate.id);
  const timeline = buildLadderTimeline(candidates, order, 44_000, 1);
  const progressAt = (event, fraction) => {
    const flightEnd = event.motion.type === 'drop' ? .64 : .86;
    const time = event.action + (event.resolve - event.action) * flightEnd * fraction;
    return ladderFrame(timeline, time, 0).actors.find(actor => actor.id === event.actorId).transferProgress;
  };
  const drop = timeline.events.find(event => event.motion.type === 'drop');
  const launch = timeline.events.find(event => event.motion.type === 'launch');
  assert.ok(progressAt(drop, .25) < .15, 'the loose foothold releases before gravity gains speed');
  assert.ok(progressAt(drop, .75) > .65, 'the falling body accelerates across to the new hand grip');
  assert.ok(progressAt(launch, .25) > .2, 'the jump pushes away promptly');
  assert.ok(progressAt(launch, .85) > .9, 'the leap slows into the catching hand');
  for (const event of timeline.events) {
    const limit = event.motion.type === 'pounce' ? 4100 : Math.abs(event.toLane - event.fromLane) > 1 ? 4400 : 3600;
    assert.ok(event.end - event.setup < limit, 'spotlights keep the danger readable over their actual travel distance');
    for (const id of event.actors) {
      const segment = timeline.paths[id].segments.find(part => part.eventId === event.id);
      assert.equal(segment.end, event.end);
      assert.equal(timeline.paths[id].segments.find(part => part.start === event.end).kind, 'climb');
    }
  }
  for (const path of Object.values(timeline.paths)) {
    const climb = path.segments.find(segment => segment.kind === 'climb' && segment.toRow - segment.fromRow > 4);
    const velocities = Array.from({ length: 80 }, (_, index) => {
      const time = climb.start + (climb.end - climb.start) * (index + .5) / 80;
      const before = ladderFrame(timeline, time - 1, 0).actors.find(actor => actor.id === path.id);
      const after = ladderFrame(timeline, time + 1, 0).actors.find(actor => actor.id === path.id);
      return after.rungProgress - before.rungProgress;
    });
    assert.ok(Math.min(...velocities) > 0, 'even the planted grip keeps climbing');
    assert.ok(Math.max(...velocities) / Math.min(...velocities) > 1.5, 'each climber visibly gathers and releases effort');
  }
});

test('each multiplayer route can cross several ladders instead of moving only to the next column', () => {
  const distances = new Set();
  for (const count of [3, 4, 10]) for (let seed = 0; seed < 40; seed++) {
    const candidates = participants.slice(0, count), order = candidates.map(candidate => candidate.id).reverse();
    const timeline = buildLadderTimeline(candidates, order, 44_000, seed);
    const long = timeline.bridges.find(bridge => bridge.rightLane - bridge.leftLane >= 2);
    assert.ok(long, 'there is always a real nonadjacent route');
    assert.ok(long.row <= 8, 'a broad airborne route has room beneath the roof');
    assert.ok(long.motionType === 'launch' || long.motionType === 'swing', 'a long route is physically airborne');
    if (count === 10) distances.add(long.rightLane - long.leftLane);
    for (const id of long.actorIds) {
      const segment = timeline.paths[id].segments.find(part => part.bridgeId === long.id);
      assert.ok(Math.abs(segment.toLane - segment.fromLane) >= 2);
      const event = timeline.events.find(item => item.id === segment.eventId), duration = segment.end - segment.start;
      const action = event?.action ?? segment.start + duration * .14, resolve = event?.resolve ?? segment.start + duration * .84;
      const middle = ladderFrame(timeline, action + (resolve - action) * .4, 0).actors.find(actor => actor.id === id);
      assert.ok(middle.lane > long.leftLane && middle.lane < long.rightLane, 'the body passes through the intervening columns rather than teleporting');
    }
    assert.equal(ladderFrame(timeline, 44_000).winnerId, order[0]);
  }
  assert.ok(distances.size >= 5, 'the longer destinations vary with each story seed');
});

test('a jump really grabs and throws the other climber before both take their assigned paths', () => {
  for (const count of [2, 4, 10]) for (const seed of [1, 4, 12]) {
    const candidates = participants.slice(0, count), order = candidates.map(candidate => candidate.id).reverse();
    const timeline = buildLadderTimeline(candidates, order, 44_000, seed);
    const event = timeline.events.find(item => item.motion.type === 'pounce');
    assert.ok(event, 'every multiplayer climb contains an actual grab and throw');
    const read = time => ladderFrame(timeline, time, 0);
    const at = phase => read(event.action + (event.resolve - event.action) * phase);
    for (const [phase, stage] of [[.16, 'approach'], [.4, 'grip'], [.54, 'throw'], [.75, 'flight'], [.95, 'catch']]) {
      const frame = at(phase), thrower = frame.actors.find(actor => actor.id === event.actorId), victim = frame.actors.find(actor => actor.id === event.partnerId);
      assert.equal(thrower.interaction.stage, stage);
      assert.equal(victim.interaction.stage, stage);
      assert.equal(thrower.interaction.partnerId, victim.id);
      assert.equal(victim.interaction.partnerId, thrower.id);
      assert.equal(thrower.interaction.role, 'thrower');
      assert.equal(victim.interaction.role, 'victim');
      if (stage === 'grip' || stage === 'throw') {
        assert.equal(thrower.lane, event.toLane);
        assert.equal(victim.lane, event.toLane, 'the target is physically within reach before being thrown');
        assert.ok(victim.rungProgress > event.row, 'the victim is lifted before release');
      }
      if (stage === 'flight') {
        assert.ok(victim.lane > Math.min(event.fromLane, event.toLane) && victim.lane < Math.max(event.fromLane, event.toLane));
        assert.equal(thrower.lane, event.toLane, 'the thrower stays on the new ladder instead of following the thrown body');
      }
      if (stage === 'catch') {
        assert.equal(victim.lane, event.fromLane);
        assert.equal(victim.pose, 'hang');
        assert.equal(victim.gripRow, event.partnerLandingRow + 2);
      }
    }
    for (const phase of [.32, .48, .6, .9]) {
      const time = event.action + (event.resolve - event.action) * phase;
      for (const id of event.actors) {
        const before = read(time - .001).actors.find(actor => actor.id === id), after = read(time + .001).actors.find(actor => actor.id === id);
        assert.ok(Math.abs(before.lane - after.lane) < .001, 'the body never teleports into or out of contact');
        assert.ok(Math.abs(before.rungProgress - after.rungProgress) < .001);
      }
    }
    const geometry = createLadderGeometry(640, 500, count);
    for (const phase of [.32, .48, .6, .9]) {
      const time = event.action + (event.resolve - event.action) * phase;
      const rigsAt = sampleTime => ladderArtActors(timeline, read(sampleTime), candidates, sampleTime, geometry, false, read).filter(actor => event.actors.includes(actor.id)).map(actor => ({ id: actor.id, rig: sampleLadderRig(actor, geometry, sampleTime) }));
      const before = rigsAt(time - .001), after = rigsAt(time + .001);
      for (const sample of before) {
        const next = after.find(item => item.id === sample.id).rig;
        for (const part of ['hip', 'head']) assert.ok(Math.hypot(sample.rig[part].x - next[part].x, sample.rig[part].y - next[part].y) < .01, `${sample.id} ${part} jumps inside the grab and throw`);
        for (const part of ['hands', 'feet']) for (const side of [0, 1]) assert.ok(Math.hypot(sample.rig[part][side].x - next[part][side].x, sample.rig[part][side].y - next[part][side].y) < .01, `${sample.id} ${part} jumps inside the grab and throw`);
      }
    }
    for (const phase of [.4, .54]) {
      const time = event.action + (event.resolve - event.action) * phase;
      const actors = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read);
      const thrower = actors.find(actor => actor.id === event.actorId), victim = actors.find(actor => actor.id === event.partnerId);
      const throwerRig = sampleLadderRig(thrower, geometry, time), victimRig = sampleLadderRig(victim, geometry, time);
      const direction = Math.sign(thrower.toLane - thrower.fromLane);
      const belt = { x: victimRig.hip.x + direction * 5.8 * geometry.scale, y: victimRig.hip.y - geometry.scale };
      assert.ok(Math.hypot(throwerRig.hands[0].x - victimRig.hands[1].x, throwerRig.hands[0].y - victimRig.hands[1].y) < .01, 'the grabbing hand holds the actual other wrist');
      assert.ok(Math.hypot(throwerRig.hands[1].x - belt.x, throwerRig.hands[1].y - belt.y) < .01, 'the lifting hand holds the actual other belt');
      for (const side of [0, 1]) {
        assert.ok(Math.hypot(throwerRig.shoulders[side].x - throwerRig.elbows[side].x, throwerRig.shoulders[side].y - throwerRig.elbows[side].y) <= 7.6 * geometry.scale, 'a grabbing upper arm has a physical length');
        assert.ok(Math.hypot(throwerRig.hands[side].x - throwerRig.elbows[side].x, throwerRig.hands[side].y - throwerRig.elbows[side].y) <= 7.6 * geometry.scale, 'a grabbing forearm does not stretch to reach the other person');
      }
    }
    assert.equal(read(44_000).winnerId, order[0], 'the choreography preserves the previously drawn destination');
  }
  const wind = LADDER_STORIES.find(story => story.kind === 'wind');
  assert.equal(wind.motion.type, 'launch', 'wind physically blows the person through the air');
  assert.ok(![wind.setupText, wind.actionText, wind.recoveryText].some(text => /안전줄|그네|매달려/.test(text)), 'wind does not claim a rope swing');
  const seenWind = [];
  for (let seed = 0; seed < 30; seed++) {
    const timeline = buildLadderTimeline(participants, participants.map(candidate => candidate.id), 44_000, seed);
    for (const event of timeline.events.filter(item => item.kind === 'wind')) {
      const bridge = timeline.bridges.find(item => item.id === event.bridgeId);
      assert.equal(bridge.motionType, 'launch');
      assert.equal(bridge.partnerMotionType, 'drop', 'both wind-blown bodies fly freely without a rope');
      seenWind.push(event.id);
    }
  }
  assert.ok(seenWind.length > 0);
});

test('both sides of every transfer use physical arcs, keep body separation and catch without a jump', () => {
  const candidates = participants, timeline = buildLadderTimeline(candidates, candidates.map(candidate => candidate.id), 44_000, 1);
  const geometry = createLadderGeometry(640, 500, 10), read = time => ladderFrame(timeline, time, 0);
  const rigAt = (id, time) => {
    const actors = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read);
    const actor = actors.find(item => item.id === id);
    return { actor, rig: sampleLadderRig(actor, geometry, time) };
  };
  for (const bridge of timeline.bridges) {
    const event = timeline.events.find(item => item.id === bridge.eventId), duration = bridge.end - bridge.start;
    const action = event?.action ?? bridge.start + duration * .14, resolve = event?.resolve ?? bridge.start + duration * .84;
    const primaryId = event?.actorId ?? bridge.actorIds[0], partnerId = event?.partnerId ?? bridge.actorIds[1];
    let closeCrossing = false, largestArc = 0;
    const partnerPoses = new Set();
    for (let time = action; time < resolve; time += 16) {
      const primary = rigAt(primaryId, time), partner = rigAt(partnerId, time);
      partnerPoses.add(partner.actor.pose);
      assert.notEqual(partner.actor.pose, 'bridge', 'the partner also swings or leaps through the air');
      assert.equal(primary.actor.depthOffset, 0);
      assert.equal(partner.actor.depthOffset, 0);
      const hipDistance = Math.hypot(primary.rig.hip.x - partner.rig.hip.x, primary.rig.hip.y - partner.rig.hip.y);
      const headDistance = Math.hypot(primary.rig.head.x - partner.rig.head.x, primary.rig.head.y - partner.rig.head.y);
      const deliberateContact = primary.actor.interaction && primary.actor.interaction.phase >= .18 && primary.actor.interaction.phase < .67;
      if (!deliberateContact) {
        assert.ok(hipDistance > 12 * geometry.scale, bridge.id + ' bodies occupy the same place outside a deliberate grab');
        assert.ok(headDistance > 9 * geometry.scale, bridge.id + ' heads occupy the same place outside a deliberate grab');
      }
      if (Math.abs(primary.actor.lane - partner.actor.lane) < .35) closeCrossing = true;
      largestArc = Math.max(largestArc, Math.abs(partner.actor.rungProgress - partner.actor.fromRow));
    }
    assert.ok(closeCrossing, 'the actors really pass each other');
    assert.ok(largestArc > (bridge.partnerMotionType === 'swing' ? .4 : 3.8), 'the partner follows the height of its actual leap, cable or thrown fall');
    assert.ok(partnerPoses.has('swing') || partnerPoses.has('launch') || ((bridge.motionType === 'pounce' || event?.kind === 'wind') && partnerPoses.has('drop')));
    for (const id of bridge.actorIds) {
      const segment = timeline.paths[id].segments.find(part => part.bridgeId === bridge.id);
      const type = segment.transferRole === 'primary' ? bridge.motionType : bridge.partnerMotionType;
      const catchAt = action + (resolve - action) * (bridge.motionType === 'pounce' ? .9 : type === 'drop' ? .64 : .86);
      const before = rigAt(id, catchAt - .001).rig, after = rigAt(id, catchAt + .001).rig;
      assert.ok(Math.hypot(before.hip.x - after.hip.x, before.hip.y - after.hip.y) < .01, type + ' body jumps when grabbing the destination ladder');
      assert.ok(Math.hypot(before.head.x - after.head.x, before.head.y - after.head.y) < .01, type + ' head jumps when grabbing the destination ladder');
      if (['drop', 'swing', 'launch'].includes(type)) {
        const caught = rigAt(id, catchAt + 1).rig;
        const held = rigAt(id, resolve - 1).rig;
        assert.ok(caught.handContact[1] && held.handContact[1], 'the catching hand really holds a reachable rung');
        assert.ok(Math.hypot(caught.hands[1].x - held.hands[1].x, caught.hands[1].y - held.hands[1].y) < .01, 'the fixed hand does not slide while the body hangs');
      }
    }
  }
});

test('unrelated events never stop climbers or prolong another pair crossing', () => {
  for (const count of [3, 4, 10]) for (const seed of [1, 4, 12]) {
    const candidates = participants.slice(0, count), timeline = buildLadderTimeline(candidates, candidates.map(candidate => candidate.id).reverse(), 44_000, seed);
    for (const path of Object.values(timeline.paths)) {
      assert.ok(path.segments.every(segment => segment.kind !== 'hold'));
      for (let index = 0; index < path.segments.length - 1; index++) {
        assert.equal(path.segments[index].end, path.segments[index + 1].start);
        const segment = path.segments[index];
        if (segment.kind === 'climb') assert.ok(segment.toRow > segment.fromRow, 'climb never represents an idle wait');
      }
    }
    for (const event of timeline.events) {
      for (const id of timeline.ids.filter(id => !event.actors.includes(id))) {
        const path = timeline.paths[id];
        const climb = path.segments.find(segment => segment.kind === 'climb' && segment.start < event.end && segment.end > event.setup);
        if (!climb) {
          assert.ok(path.segments.some(segment => segment.kind !== 'climb' && segment.eventId !== event.id && segment.start < event.end && segment.end > event.setup), 'a nonparticipant acts on their own device during an unrelated event');
          continue;
        }
        const start = Math.max(climb.start, event.setup), end = Math.min(climb.end, event.end);
        if (end - start > 100) {
          const before = ladderFrame(timeline, start + .001, 0).actors.find(actor => actor.id === id);
          const after = ladderFrame(timeline, end - .001, 0).actors.find(actor => actor.id === id);
          assert.ok(after.rungProgress > before.rungProgress);
        }
      }
      const wave = timeline.waves.find(item => item.eventId === event.id);
      for (const bridge of timeline.bridges.filter(item => wave.bridgeIds.includes(item.id) && !item.eventId)) {
        assert.ok(bridge.end - bridge.start < event.end - event.setup, 'an ordinary pair has its own shorter mechanism clock');
        for (const id of bridge.actorIds) {
          const path = timeline.paths[id], index = path.segments.findIndex(segment => segment.bridgeId === bridge.id), climb = path.segments[index + 1];
          assert.equal(climb.kind, 'climb');
          const current = ladderFrame(timeline, climb.start + Math.min(500, (climb.end - climb.start) / 2), 0).actors.find(actor => actor.id === id);
          assert.equal(current.pose, 'climb');
          assert.ok(current.rungProgress > timeline.paths[id].segments.find(segment => segment.bridgeId === bridge.id).toRow);
        }
      }
    }
    const motions = new Set(timeline.events.map(event => event.motion.type));
    for (const type of ['swing', 'launch', 'drop', 'pounce']) assert.ok(motions.has(type), 'every run visibly includes ' + type);
  }
});

test('preview handles empty lists and invalid paths are rejected', () => {
  assert.deepEqual(ladderFrame(buildLadderTimeline([], []), 0, 0).actors, []);
  const single = buildLadderTimeline(participants.slice(0, 1), []);
  assert.equal(single.events.length, 0);
  assert.equal(ladderFrame(single, 44_000, 0).winnerId, participants[0].id);
  assert.throws(() => buildLadderTimeline(participants.slice(0, 2), ['person-0', 'person-0']), RangeError);
  assert.throws(() => buildLadderTimeline(participants.slice(0, 2), ['person-0', 'missing']), RangeError);
  assert.throws(() => buildLadderTimeline(participants.slice(0, 2), [], 0), RangeError);
  assert.throws(() => ladderFrame(buildLadderTimeline(participants.slice(0, 2), []), 0, 2), RangeError);
});

test('different pairs prepare and fire independently while their own climbs retain enough time', () => {
  for (const count of [4, 6, 10]) for (const seed of [0, 1, 4, 16, 25, 106]) {
    const candidates = participants.slice(0, count), ids = candidates.map(candidate => candidate.id);
    const order = [...ids.slice(seed % count), ...ids.slice(0, seed % count)];
    const timeline = buildLadderTimeline(candidates, order, 44_000, seed);
    for (const wave of timeline.waves) {
      const pairs = timeline.bridges.filter(bridge => wave.bridgeIds.includes(bridge.id));
      const actionAt = bridge => timeline.events.find(event => event.id === bridge.eventId)?.action ?? bridge.start + (bridge.end - bridge.start) * .14;
      for (let index = 0; index < pairs.length; index++) for (const other of pairs.slice(index + 1)) {
        assert.ok(Math.abs(pairs[index].start - other.start) >= 449.99, 'unrelated pairs do not prepare on a shared row trigger');
        assert.ok(Math.abs(actionAt(pairs[index]) - actionAt(other)) >= 399.99, 'unrelated pairs do not leap on a shared firing trigger');
      }
    }
    for (const path of Object.values(timeline.paths)) for (const segment of path.segments.filter(segment => segment.kind === 'climb')) {
      assert.ok(segment.end - segment.start >= 259.99, 'each transition allows an actual climb rather than a 100 ms dash');
      assert.ok((segment.end - segment.start) / (segment.toRow - segment.fromRow) >= 119.99, 'the available time grows with the actual vertical distance');
    }
    assert.equal(ladderFrame(timeline, 44_000).winnerId, order[0]);
  }
  // These uniform draw permutations have busy paths that exceeded the former
  // 38.5-second device envelope once independent pair firing was introduced.
  for (const [seed, positions] of [[279, [6, 2, 4, 8, 7, 9, 0, 5, 1, 3]], [749, [6, 8, 9, 7, 0, 1, 4, 3, 2, 5]]]) {
    const order = positions.map(index => participants[index].id), timeline = buildLadderTimeline(participants, order, 44_000, seed);
    assert.equal(ladderFrame(timeline, 44_000).winnerId, order[0]);
    assert.ok(Object.values(timeline.paths).every(path => path.arrivalAt >= 39_500 && path.arrivalAt <= 41_200));
  }
});


test('rope swings retain a fixed anchor and length, while long routes follow a cable', () => {
  const g = createLadderGeometry(640, 500, 10), candidate = participants[0];
  const actor = { id: candidate.id, candidate, index: 0, lane: 2, height: .5, rungProgress: 12, pose: 'swing', phase: .5, fromLane: 2, toLane: 3, fromRow: 12, landingRow: 12, arrived: false, motionType: 'swing', eventStage: 'action' };
  let anchor;
  for (let step = 0; step <= 100; step++) {
    const sample = ladderSuspension({ ...actor, transferProgress: step / 100 }, g);
    assert.equal(sample.cable, false);
    anchor ??= sample.anchor;
    assert.deepEqual(sample.anchor, anchor, 'a rope never moves its attachment to follow the person');
    assert.ok(Math.abs(Math.hypot(sample.handle.x - anchor.x, sample.handle.y - anchor.y) - sample.radius) < 1e-6, 'the rope never stretches');
    const cable = ladderSuspension({ ...actor, toLane: 8, transferProgress: step / 100 }, g);
    assert.equal(cable.cable, true);
    assert.ok(Math.abs(cable.handle.y - cable.anchor.y - 8 * g.scale) < 1e-6, 'a trolley keeps its short hanging strap');
  }
  const touched = [];
  const context = new Proxy({}, { get: (_, key) => (...args) => touched.push([key, args]), set: (_, key, value) => { touched.push([key, value]); return true; } });
  drawLadderCrossing(context, { ...actor, eventStage: 'setup' }, g, 0, false);
  assert.deepEqual(touched, [], 'the next mechanism cannot be seen before the action');
});
