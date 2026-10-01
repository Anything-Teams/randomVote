import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildLadderTimeline, ladderFrame, LADDER_STORIES, LADDER_RUNGS, LADDER_ROOF_STEAL_CHANCE } = await load('src/ladderLogic.ts');
const { createSportsOrder } = await load('src/sports.ts');
const { createLadderGeometry, ladderArtActors, sampleLadderRig, ladderSuspension, drawLadderCrossing, drawLadderActor } = await load('src/game/ladderArt.ts');
const { drawLadderAdventure } = await load('src/game/ladderAdventureArt.ts');
const participants = Array.from({ length: 10 }, (_, index) => ({ id: `person-${index}`, name: `참가자 ${index + 1}`, color: '#83c7de' }));

test('both rendered legs stay proportionate and folded across takeoff, flight, catch and landing', () => {
  const seen = new Set(); let caught = 0, drawn = 0;
  for (const count of [2, 5, 10]) for (const seed of [1, 4, 12]) {
    const candidates = participants.slice(0, count), timeline = buildLadderTimeline(candidates, candidates.map(person => person.id).reverse(), 44_000, seed);
    const geometry = createLadderGeometry(800, 600, count), read = time => ladderFrame(timeline, time, 0);
    const at = (id, time) => {
      const actor = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read).find(item => item.id === id);
      return { actor, rig: sampleLadderRig(actor, geometry, time) };
    };
    for (const bridge of timeline.bridges) {
      const event = timeline.events.find(item => item.id === bridge.eventId), id = event?.actorId ?? bridge.actorIds[0];
      const segment = timeline.paths[id].segments.find(item => item.bridgeId === bridge.id), duration = segment.end - segment.start;
      const action = event?.action ?? segment.start + duration * .14, resolve = event?.resolve ?? segment.start + duration * .84;
      const times = Array.from({ length: 101 }, (_, index) => segment.start + duration * index / 100);
      for (const id of bridge.actorIds) for (const time of times) {
        const { actor, rig } = at(id, time); seen.add(actor.motionType);
        for (const side of [0, 1]) {
          const upper = Math.hypot(rig.knees[side].x - rig.legRoots[side].x, rig.knees[side].y - rig.legRoots[side].y);
          const lower = Math.hypot(rig.feet[side].x - rig.knees[side].x, rig.feet[side].y - rig.knees[side].y);
          assert.ok(upper <= geometry.scale * 7 && lower <= geometry.scale * 7, 'neither thigh nor shin grows longer during a jump or recovery');
          assert.ok(upper + lower <= geometry.scale * 14, 'the airborne legs keep the same proportion as the torso');
          assert.ok(rig.legRoots[side].y > rig.hip.y, 'the trousers connect below the waist rather than drawing thighs from the belt');
          if (actor.eventStage === 'action' && actor.transferStage === 'catch' && actor.pose === 'hang') {
            assert.ok(rig.feet[side].y > rig.hip.y + geometry.scale * 2, 'a hanging boot stays below the pelvis, with the knee folded rather than reaching back to the old body origin');
            assert.ok(rig.feet[side].y - rig.hip.y < geometry.scale * 14, `the catch keeps a folded leg ${count}/${seed}/${bridge.id}/${id}/${time}/${side}: ${(rig.feet[side].y - rig.hip.y) / geometry.scale}`);
            caught++;
          }
        }
        if (!actor.transition && actor.eventStage === 'action' && actor.transferStage === 'flight') {
          const lines = [], context = new Proxy({ lineWidth: 0 }, { get: (target, key) => key === 'moveTo' ? (...args) => { target.start = args; } : key === 'lineTo' ? (...args) => { lines.push([target.start, args]); } : key in target ? target[key] : () => {}, set: (target, key, value) => { target[key] = value; return true; } });
          drawLadderActor(context, actor, geometry, time);
          for (const side of [0, 1]) {
            const [root, knee] = lines[side * 2], [shin, boot] = lines[side * 2 + 1];
            assert.ok(Math.hypot(root[0] - rig.legRoots[side].x, root[1] - rig.legRoots[side].y) < .001 && Math.hypot(knee[0] - shin[0], knee[1] - shin[1]) < .001, 'the actual drawing uses the constrained pelvis and one shared knee');
            assert.ok(Math.hypot(boot[0] - rig.feet[side].x, boot[1] - rig.feet[side].y) < .001);
          }
          drawn++;
        }
      }
      for (const boundary of [segment.start, action, resolve, segment.end]) for (const id of bridge.actorIds) {
        const before = at(id, boundary - .001).rig, after = at(id, boundary + .001).rig;
        for (const part of ['legRoots', 'knees', 'feet']) for (const side of [0, 1]) assert.ok(Math.hypot(before[part][side].x - after[part][side].x, before[part][side].y - after[part][side].y) < geometry.scale * .015, 'each knee and boot follows its own continuous path into the catch and landing');
      }
    }
  }
  assert.ok(caught > 100 && drawn > 100);
  for (const motion of ['launch', 'swing', 'drop', 'slide', 'rotate', 'conveyor', 'portal', 'pounce']) assert.ok(seen.has(motion), 'all actual crossing mechanisms are exercised');
});

test('climbing, jumping and catching keep the rear head and shoulders until the award', () => {
  for (const pose of ['idle', 'climb', 'launch', 'swing', 'drop', 'hang', 'clamber', 'transfer', 'run', 'balance']) {
    const geometry = createLadderGeometry(800, 600, 5), actor = { id: participants[0].id, index: 0, candidate: participants[0], lane: 2, rungProgress: 10, height: 10 / 24, pose, phase: .5, arrived: false };
    const colors = [], context = new Proxy({}, { get: () => () => {}, set: (_, key, value) => { if (key === 'fillStyle') colors.push(value); return true; } });
    drawLadderActor(context, actor, geometry, 1000);
    assert.ok(!colors.includes('#172d3d'), `${pose} cannot show front eyes while the camera looks at the climber's back`);
    assert.ok(!colors.includes('#ddc387') && !colors.includes('#f1eadc'), `${pose} cannot put the front buckle or chest stripe onto the back`);
    const front = [];
    const awardContext = new Proxy({}, { get: () => () => {}, set: (_, key, value) => { if (key === 'fillStyle') front.push(value); return true; } });
    drawLadderActor(awardContext, { ...actor, pose: 'win', arrived: true }, geometry, 1000);
    assert.ok(front.includes('#172d3d'), 'the winner can turn toward the camera for the award');
  }
});

test('deck transfers land with both boots on the receiving floor instead of hanging below it', () => {
  const seen = new Set();
  for (const count of [2, 5, 10]) for (let seed = 0; seed < 16; seed++) {
    const candidates = participants.slice(0, count), timeline = buildLadderTimeline(candidates, candidates.map(person => person.id).reverse(), 44_000, seed);
    const geometry = createLadderGeometry(800, 600, count), read = time => ladderFrame(timeline, time, 0);
    for (const bridge of timeline.bridges.filter(item => ['rotate', 'conveyor', 'portal'].includes(item.motionType))) {
      seen.add(bridge.motionType);
      const event = timeline.events.find(item => item.id === bridge.eventId), id = event?.actorId ?? bridge.actorIds[0];
      const segment = timeline.paths[id].segments.find(item => item.bridgeId === bridge.id), duration = segment.end - segment.start;
      const action = event?.action ?? segment.start + duration * .14, resolve = event?.resolve ?? segment.start + duration * .84;
      const at = phase => {
        const time = action + (resolve - action) * phase;
        const actor = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read).find(item => item.id === id);
        return { actor, rig: sampleLadderRig(actor, geometry, time) };
      };
      const first = at(.90), later = at(.94);
      assert.equal(first.actor.pose, 'balance');
      assert.equal(first.actor.rungProgress, segment.toRow, 'the torso finishes above the receiving deck');
      for (const side of [0, 1]) {
        assert.ok(first.rig.footContact[side] && later.rig.footContact[side], 'both knees can reach the planted soles with the normal leg length');
        assert.ok(Math.abs(first.rig.feet[side].y - geometry.rowY(segment.toRow)) < .001, 'the sole touches the actual receiving floor');
        assert.ok(Math.hypot(first.rig.feet[side].x - later.rig.feet[side].x, first.rig.feet[side].y - later.rig.feet[side].y) < .001, 'the receiving floor holds each boot still while the arms recover');
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['conveyor', 'portal', 'rotate']);
});

test('the treasure terrace is connected to tower columns and a lower foundation without floating terrain chunks', () => {
  const geometry = createLadderGeometry(800, 600, 5), rectangles = [], polygons = [];
  const context = new Proxy({ path: [] }, { get: (target, key) => {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (key === 'fillRect') return (...args) => rectangles.push(args);
    if (key === 'beginPath') return () => { target.path = []; };
    if (key === 'moveTo' || key === 'lineTo') return (x, y) => target.path.push([x, y]);
    if (key === 'fill') return () => polygons.push([...target.path]);
    return () => {};
  }, set: (target, key, value) => { target[key] = value; return true; } });
  drawLadderAdventure(context, geometry, [], 0, 1000, false, new Set());
  const columns = rectangles.filter(([, y, width, height]) => y >= geometry.top && y < geometry.top + 10 * geometry.scale && width < 12 * geometry.scale && y + height > geometry.bottom);
  assert.ok(columns.length >= 2, 'the same columns visibly reach from the terrace down to the base');
  assert.ok(rectangles.some(([, y, width]) => y > geometry.bottom && width > geometry.right - geometry.left), 'all ladders share one lower foundation');
  assert.ok(!polygons.some(points => points.length >= 3 && points.every(([, y]) => y > geometry.top + 10)), 'terrain pieces cannot float separately in the middle of the climbing course');
});

test('the rare adjacent-ladder dash preserves every assigned treasure and the arrival budget', () => {
  assert.equal(LADDER_ROOF_STEAL_CHANCE, .05);
  for (let count = 2; count <= 10; count++) for (const seed of [4, 19, 35, 56, 73]) for (let target = 0; target < count; target++) {
    const candidates = participants.slice(0, count), order = candidates.map(person => person.id).reverse();
    const timeline = buildLadderTimeline(candidates, order, 44_000, seed, target), finish = timeline.roofFinish;
    assert.ok(finish, 'the replay seeds exercise the rare branch');
    assert.equal(finish.actorId, order[target]);
    assert.equal(Math.abs(finish.entryLane - target), 1, 'the runner climbs the neighboring ladder');
    const roof = timeline.paths[finish.actorId].segments.at(-1);
    assert.equal(roof.kind, 'roof');
    assert.equal(roof.fromLane, finish.entryLane);
    assert.equal(roof.toLane, target);
    const middle = ladderFrame(timeline, (roof.start + roof.end) / 2, target);
    assert.equal(middle.actors.find(actor => actor.id === finish.actorId).pose, 'run');
    assert.ok(middle.actors.find(actor => actor.id === finish.otherId).rungProgress < 22, 'the rival is still visibly below the terrace while the runner dashes');
    assert.equal(middle.winnerId, undefined, 'running toward the treasure does not reveal the result before contact');
    assert.equal(ladderFrame(timeline, finish.claimAt, target).winnerId, order[target]);
    for (let selected = 0; selected < count; selected++) assert.equal(ladderFrame(timeline, 44_000, selected).winnerId, order[selected], 'all selected outcomes retain the original uniformly drawn assignment');
    for (const path of Object.values(timeline.paths)) {
      assert.ok(path.arrivalAt <= 41_200.02, 'the extra roof run stays within the existing arrival limit');
      for (const segment of path.segments) {
        assert.ok(segment.end >= segment.start);
        for (const boundary of [segment.start, segment.end]) {
          const before = ladderFrame(timeline, boundary - .001, target).actors.find(actor => actor.id === path.id);
          const after = ladderFrame(timeline, boundary + .001, target).actors.find(actor => actor.id === path.id);
          assert.ok(Math.abs(before.lane - after.lane) < .001 && Math.abs(before.rungProgress - after.rungProgress) < .001, 'the runner, rival pause and edge climb never teleport');
        }
      }
    }
    assert.ok(ladderFrame(timeline, 44_000, target).complete);
  }
  let rare = 0;
  const candidates = participants.slice(0, 5), order = candidates.map(person => person.id);
  for (let seed = 0; seed < 2000; seed++) if (buildLadderTimeline(candidates, order, 44_000, seed, 0).roofFinish) rare++;
  assert.ok(rare >= 60 && rare <= 140, 'the independently seeded 5% branch remains rare across a broad replay sample');
});

test('roof runners lean forward, plant their boots and turn into the award without a limb snap', () => {
  const candidates = participants.slice(0, 5), order = candidates.map(person => person.id).reverse();
  for (const target of [0, 4]) {
    const timeline = buildLadderTimeline(candidates, order, 44_000, 4, target), finish = timeline.roofFinish;
    const geometry = createLadderGeometry(800, 600, 5), read = time => ladderFrame(timeline, time, target);
    const rigAt = (id, time) => {
      const actor = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read).find(item => item.id === id);
      return { actor, rig: sampleLadderRig(actor, geometry, time) };
    };
    const roof = timeline.paths[finish.actorId].segments.at(-1), direction = Math.sign(roof.toLane - roof.fromLane);
    const middle = rigAt(finish.actorId, (roof.start + roof.end) / 2);
    assert.ok((middle.rig.head.x - middle.rig.hip.x) * direction > 0, 'the upper body leans toward the direction of the dash');
    let planted = 0;
    for (let time = roof.start + 300; time < roof.end - 16; time += 16) {
      const { actor, rig } = rigAt(finish.actorId, time), next = rigAt(finish.actorId, time + 1);
      if (actor.transition || next.actor.transition) continue;
      for (const side of [0, 1]) if (rig.footContact[side] && next.rig.footContact[side]) {
        assert.ok(Math.abs(rig.feet[side].y - geometry.top) < .001, 'a planted boot touches the actual terrace');
        assert.ok(Math.hypot(next.rig.feet[side].x - rig.feet[side].x, next.rig.feet[side].y - rig.feet[side].y) < geometry.scale * .015, 'the support boot stays fixed while the pelvis passes it');
        planted++;
      }
    }
    assert.ok(planted > 10);
    for (const boundary of [roof.start, roof.end]) {
      const before = rigAt(finish.actorId, boundary - .001).rig, after = rigAt(finish.actorId, boundary + .001).rig;
      for (const part of ['hands', 'elbows', 'feet']) for (const side of [0, 1]) assert.ok(Math.hypot(after[part][side].x - before[part][side].x, after[part][side].y - before[part][side].y) < geometry.scale * .01, `${part} turn smoothly between the final climb, dash and treasure pose`);
    }
  }
});

test('a thrown climber leaves the grip with momentum and follows gravity rather than a sideways easing rail', () => {
  const candidates = participants.slice(0, 5), timeline = buildLadderTimeline(candidates, candidates.map(person => person.id).reverse(), 44_000, 1);
  const event = timeline.events.find(item => item.motion.type === 'pounce');
  const victimAt = phase => ladderFrame(timeline, event.action + (event.resolve - event.action) * phase, 0).actors.find(actor => actor.id === event.partnerId);
  const samples = [.62, .67, .72, .77, .82].map(victimAt);
  const horizontal = samples.slice(1).map((actor, index) => actor.lane - samples[index].lane);
  assert.ok(horizontal.every(step => Math.abs(step - horizontal[0]) < 1e-8), 'a real throw has horizontal momentum immediately after release');
  const vertical = samples.slice(1).map((actor, index) => actor.rungProgress - samples[index].rungProgress);
  assert.ok(vertical.every((step, index) => index === 0 || step < vertical[index - 1]), 'gravity continuously turns the upward launch into a fall');
});

test('a throw spotlight shows actual contact without a destination arrow or target ring', () => {
  const candidates = participants.slice(0, 5), timeline = buildLadderTimeline(candidates, candidates.map(person => person.id).reverse(), 44_000, 1);
  const event = timeline.events.find(item => item.motion.type === 'pounce'), geometry = createLadderGeometry(800, 600, 5);
  const time = event.action + (event.resolve - event.action) * .2, read = age => ladderFrame(timeline, age, 0);
  const actor = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read).find(item => item.id === event.actorId);
  const touched = [], context = new Proxy({}, { get: (_, key) => (...args) => touched.push([key, args]), set: () => true });
  drawLadderCrossing(context, actor, geometry, time, false, true);
  assert.ok(!touched.some(([key]) => key === 'ellipse'), 'a spotlight cannot mark the future destination');
  let from;
  for (const [key, values] of touched) {
    if (key === 'moveTo') from = values;
    if (key === 'lineTo' && from) assert.ok(Math.hypot(values[0] - from[0], values[1] - from[1]) < geometry.scale * 20, 'a throw uses local momentum streaks rather than a route drawn between ladders');
  }
});

test('the final lifting grips stay within real arm reach before the throw releases', () => {
  const candidates = participants.slice(0, 5), timeline = buildLadderTimeline(candidates, candidates.map(person => person.id).reverse(), 44_000, 1);
  const event = timeline.events.find(item => item.motion.type === 'pounce'), read = time => ladderFrame(timeline, time, 0);
  for (const [width, height] of [[640, 500], [1550, 700], [720, 920]]) {
    const geometry = createLadderGeometry(width, height, 5);
    for (const phase of [.54, .57, .59, .599]) {
      const time = event.action + (event.resolve - event.action) * phase;
      const actors = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read), thrower = actors.find(actor => actor.id === event.actorId);
      const victim = actors.find(actor => actor.id === event.partnerId), a = sampleLadderRig(thrower, geometry, time), b = sampleLadderRig(victim, geometry, time);
      const direction = Math.sign(thrower.toLane - thrower.fromLane), belt = { x: b.hip.x + direction * 5.8 * geometry.scale, y: b.hip.y - geometry.scale };
      assert.ok(Math.hypot(a.hands[0].x - b.hands[1].x, a.hands[0].y - b.hands[1].y) < .01, 'the wrist grip is held until release, including tall canvases');
      assert.ok(Math.hypot(a.hands[1].x - belt.x, a.hands[1].y - belt.y) < .01, 'the other hand holds the near belt rather than reaching through the body');
      for (const side of [0, 1]) assert.ok(Math.hypot(a.hands[side].x - a.shoulders[side].x, a.hands[side].y - a.shoulders[side].y) < geometry.scale * 15, 'the lift uses bent physical arms rather than overstretched reaching');
    }
  }
});

test('a briefly collapsed canvas keeps ladder spacing and treasure glow radii positive', () => {
  for (const count of [2, 5, 10]) for (const width of [1, 8, 19]) {
    const geometry = createLadderGeometry(width, 1, count);
    assert.ok(geometry.laneGap > 0 && geometry.scale > 0, 'initial layout measurements must not create negative drawing radii');
  }
});

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
      if (['pounce', 'rotate', 'conveyor', 'portal'].includes(event.motion.type)) assert.equal(landed.rungProgress, event.landingRow, 'a thrower or stationary receiving deck keeps the body above the target foot level');
      else assert.ok(landed.rungProgress < event.landingRow, 'an airborne climber catches below the target foot rung before pulling up');
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

test('ordinary climbing arms reach from their own shoulders with elbows outside the body', () => {
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const [width, height, count] of [[800, 600, 5], [640, 500, 10], [320, 180, 5]]) {
    const geometry = createLadderGeometry(width, height, count);
    for (const index of [0, 1, 2, 3]) for (const direction of ['up', 'left', 'right']) {
      let previous, reachedAboveHelmet = false;
      for (let sample = 0; sample <= 600; sample++) {
        const row = 4 + sample / 300;
        const actor = {
          id: participants[index].id, index, candidate: participants[index], lane: 2,
          rungProgress: row, height: row / 24, pose: 'climb', phase: 0, arrived: false,
          ...(direction === 'up' ? {} : { eventStage: 'setup', fromLane: 2, toLane: direction === 'left' ? 1 : 3 }),
        };
        const rig = sampleLadderRig(actor, geometry, 1000);
        assert.ok(rig.shoulders[0].x < rig.shoulders[1].x, 'an upcoming left crossing cannot mirror the climbing shoulders');
        assert.ok(rig.hands[0].x < rig.hands[1].x, 'each climbing wrist stays on its own side of the ladder');
        assert.ok(rig.handContact.some(Boolean), 'one arm supports the body while the other reaches');
        for (const side of [0, 1]) {
          const shoulder = rig.shoulders[side], elbow = rig.elbows[side], wrist = rig.hands[side];
          if (wrist.y < shoulder.y) assert.ok(side ? elbow.x > shoulder.x : elbow.x < shoulder.x, 'a raised elbow bends outward instead of crossing the face');
          assert.ok(Math.abs(distance(shoulder, elbow) - distance(elbow, wrist)) < geometry.scale * .01, 'climbing preserves both arm segment lengths');
          reachedAboveHelmet ||= wrist.y < rig.head.y - 6.5 * geometry.scale;
          if (!rig.handContact[side]) continue;
          const rung = (geometry.bottom - wrist.y) / geometry.rungGap * geometry.subdivisions;
          assert.ok(Math.abs(rung - Math.round(rung)) < .0001, 'a supporting hand really holds a visible rung');
          assert.ok(side ? wrist.x > shoulder.x : wrist.x < shoulder.x, 'a supporting wrist reaches from the matching shoulder');
          if (previous?.handContact[side]) assert.ok(distance(previous.hands[side], wrist) < geometry.scale * .001, 'the planted wrist stays fixed while the torso rises');
        }
        previous = rig;
      }
      assert.ok(reachedAboveHelmet, 'a climbing stroke reaches above the helmet rather than paddling at chest height');
    }
  }
});

test('climbing wrists and elbows stay continuous across repeated rung strokes', () => {
  const geometry = createLadderGeometry(640, 500, 5);
  const rigAt = (row, index) => sampleLadderRig({
    id: participants[index].id, index, candidate: participants[index], lane: 2,
    rungProgress: row, height: row / 24, pose: 'climb', phase: 0, arrived: false,
  }, geometry, 1000);
  for (const index of [0, 1]) for (let rung = 8; rung <= 20; rung++) {
    const row = rung / geometry.subdivisions;
    const before = rigAt(row - .00001, index), after = rigAt(row + .00001, index);
    for (const part of ['hands', 'elbows']) for (const side of [0, 1]) {
      assert.ok(Math.hypot(before[part][side].x - after[part][side].x, before[part][side].y - after[part][side].y) < geometry.scale * .005, `${part} cannot flip at a stroke boundary`);
    }
  }
});

test('the final upward climb leaves time for a readable reaching arm', () => {
  const candidates = participants.slice(0, 5), timeline = buildLadderTimeline(candidates, candidates.map(candidate => candidate.id).reverse(), 44_000, 12);
  const geometry = createLadderGeometry(800, 600, 5), read = time => ladderFrame(timeline, time, 0);
  let samples = 0;
  for (const path of Object.values(timeline.paths)) {
    const segment = path.segments.at(-1);
    if (segment?.kind !== 'climb') continue;
    let previous;
    for (let time = segment.start + 300; time < segment.end; time += 16) {
      const actor = ladderArtActors(timeline, read(time), candidates, time, geometry, false, read).find(item => item.id === path.id);
      if (actor.transition || actor.pose !== 'climb') { previous = undefined; continue; }
      const rig = sampleLadderRig(actor, geometry, time);
      if (previous) for (const side of [0, 1]) {
        const step = Math.hypot(rig.hands[side].x - previous.hands[side].x, rig.hands[side].y - previous.hands[side].y);
        assert.ok(step <= geometry.scale * 4.5, 'an upward hand stroke must not become a rapid blur near the treasure');
        samples++;
      }
      previous = rig;
    }
  }
  assert.ok(samples > 10, 'the check covers actual complete arm strokes near arrival');
});

test('climbers use the terrace edge and plant a foot before releasing their last grip', () => {
  const geometry = createLadderGeometry(800, 600, 5), deckY = geometry.rowY(geometry.rungCount);
  for (const index of [0, 1]) {
    let previous;
    for (let sample = 0; sample <= 800; sample++) {
      const row = 20 + sample / 200;
      const rig = sampleLadderRig({ id: participants[index].id, index, candidate: participants[index], lane: 2, rungProgress: row, height: row / 24, pose: 'climb', phase: 0, arrived: false }, geometry, 1000);
      for (const side of [0, 1]) if (rig.handContact[side]) assert.ok(rig.hands[side].y >= deckY - .001, 'a supporting hand cannot grasp a rung above the end of the ladder');
      if (!rig.handContact.some(Boolean)) {
        assert.ok(rig.footContact.some(Boolean), 'a foot must support the climber before both hands leave the terrace');
        for (const side of [0, 1]) if (rig.footContact[side]) assert.ok(Math.abs(rig.feet[side].y - deckY) < .001, 'the planted foot stays on the real terrace');
      }
      if (previous) for (const part of ['hands', 'elbows', 'feet']) for (const side of [0, 1]) assert.ok(Math.hypot(rig[part][side].x - previous[part][side].x, rig[part][side].y - previous[part][side].y) < geometry.scale * .3, 'stepping onto the terrace has no pose snap');
      previous = rig;
    }
    assert.ok(previous.footContact.every(Boolean));
    assert.ok(previous.hands.every((hand, side) => hand.y > previous.shoulders[side].y), 'once on the terrace the arms settle beside the body');
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
