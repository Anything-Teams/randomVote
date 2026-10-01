import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildLadderTimeline, ladderFrame, LADDER_STORIES, LADDER_RUNGS } = await load('src/ladderLogic.ts');
const { createSportsOrder } = await load('src/sports.ts');
const { createLadderGeometry, ladderArtActors, sampleLadderRig } = await load('src/game/ladderArt.ts');
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

test('2–10 participants follow adjacent, unambiguous bridges to distinct doors', () => {
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
        assert.equal(bridge.rightLane, bridge.leftLane + 1);
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
    const targetDuration = 1350 + 400 * (10 - count) / 8;
    const crossings = Object.values(timeline.paths).flatMap(path => path.segments.filter(segment => segment.kind === 'bridge'));
    assert.ok(crossings.every(segment => Math.abs(segment.end - segment.start - targetDuration) < 1e-6));
    for (const bridge of timeline.bridges) {
      assert.ok(bridge.motionType && bridge.mechanism && bridge.start < bridge.end);
      assert.ok(['drop', 'swing', 'launch', 'rotate', 'conveyor', 'portal'].includes(bridge.motionType));
      for (const id of bridge.actorIds) {
        const segment = timeline.paths[id].segments.find(part => part.bridgeId === bridge.id);
        const event = timeline.events.find(item => item.id === segment.eventId);
        const sampleAt = event ? event.action + (event.resolve - event.action) * .35 : segment.start + (segment.end - segment.start) * .4;
        const middle = ladderFrame(timeline, sampleAt, 0).actors.find(actor => actor.id === id);
        assert.equal(middle.motionType, segment.transferRole === 'primary' ? bridge.motionType : bridge.partnerMotionType);
        assert.equal(middle.depthOffset, 0, 'both actors follow actual motion rather than a displaced service deck');
        assert.equal(segment.start, bridge.start);
        assert.equal(segment.end, bridge.end);
        assert.ok(middle.transferProgress > 0 && middle.transferProgress < 1);
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

test('sixteen readable event kinds vary independently of the destination draw', () => {
  assert.equal(LADDER_STORIES.length, 16);
  assert.equal(new Set(LADDER_STORIES.map(story => story.kind)).size, 16);
  const seen = new Set(), order = participants.map(candidate => candidate.id).reverse();
  for (let seed = 0; seed < 160; seed++) {
    const timeline = buildLadderTimeline(participants, order, 44_000, seed);
    assert.ok(timeline.events.length === 3 || timeline.events.length === 4);
    assert.equal(new Set(timeline.events.map(event => event.kind)).size, timeline.events.length);
    for (let index = 0; index < timeline.events.length; index++) {
      const event = timeline.events[index]; seen.add(event.kind);
      assert.ok(order.includes(event.actorId) && event.actors.includes(event.actorId));
      assert.ok(Math.abs(event.action - event.setup - 250) < 1e-6);
      assert.ok(Math.abs(event.resolve - event.action - 2500) < 1e-6);
      assert.ok(Math.abs(event.end - event.resolve - 1250) < 1e-6);
      assert.ok(event.title && event.setupText && event.actionText && event.recoveryText && event.prop);
      if (index) assert.ok(event.setup > timeline.events[index - 1].end);
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
      assert.ok(landed.rungProgress < event.landingRow, 'the caught body still needs to pull itself onto the target foot rung');
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
  assert.equal(seen.size, 16);
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
        assert.ok(pointDistance(previous.rig.hip, current.rig.hip) < Math.max(4, geometry.rungGap), `${event.kind} body jumps within the mechanism`);
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
      assert.ok(hipDistance > 12 * geometry.scale, bridge.id + ' bodies occupy the same place');
      assert.ok(headDistance > 9 * geometry.scale, bridge.id + ' heads occupy the same place');
      if (Math.abs(primary.actor.lane - partner.actor.lane) < .35) closeCrossing = true;
      largestArc = Math.max(largestArc, Math.abs(partner.actor.rungProgress - partner.actor.fromRow));
    }
    assert.ok(closeCrossing, 'the actors really pass each other');
    assert.ok(largestArc > 3.8, 'the partner uses a body-height physical leap or swing');
    assert.ok(partnerPoses.has('swing') || partnerPoses.has('launch'));
    for (const id of bridge.actorIds) {
      const segment = timeline.paths[id].segments.find(part => part.bridgeId === bridge.id);
      const type = segment.transferRole === 'primary' ? bridge.motionType : bridge.partnerMotionType;
      const catchAt = action + (resolve - action) * (type === 'drop' ? .64 : .86);
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
        assert.ok(climb, 'a nonparticipant continues climbing during the event');
        const start = Math.max(climb.start, event.setup), end = Math.min(climb.end, event.end);
        if (end - start > 100) {
          const before = ladderFrame(timeline, start + .001, 0).actors.find(actor => actor.id === id);
          const after = ladderFrame(timeline, end - .001, 0).actors.find(actor => actor.id === id);
          assert.ok(after.rungProgress > before.rungProgress);
        }
      }
      const wave = timeline.waves.find(item => item.eventId === event.id);
      for (const bridge of timeline.bridges.filter(item => wave.bridgeIds.includes(item.id) && !item.eventId)) {
        assert.ok(bridge.end < event.end - 1000, 'the ordinary pair leaves before the spotlight event ends');
        for (const id of bridge.actorIds) {
          const current = ladderFrame(timeline, bridge.end + 500, 0).actors.find(actor => actor.id === id);
          assert.equal(current.pose, 'climb');
          assert.ok(current.rungProgress > timeline.paths[id].segments.find(segment => segment.bridgeId === bridge.id).toRow);
        }
      }
    }
    const motions = new Set(timeline.events.map(event => event.motion.type));
    for (const type of ['swing', 'launch', 'drop']) assert.ok(motions.has(type), 'every run visibly includes ' + type);
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
