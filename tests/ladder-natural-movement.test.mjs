import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildLadderTimeline, ladderFrame, LADDER_START_DELAY } = await load('src/ladderLogic.ts');
const { createLadderGeometry, ladderArtActors, sampleLadderRig, LADDER_ARM_LENGTH } = await load('src/game/ladderArt.ts');
const { drawLadderAdventure } = await load('src/game/ladderAdventureArt.ts');
const candidates = count => Array.from({ length: count }, (_, index) => ({ id: String(index + 1), name: `참가자 ${index + 1}`, color: '#83c7de' }));
const orderFor = count => ['4', '1', '7', '2', '9', '3', '5', '10', '6', '8'].filter(id => Number(id) <= count);

test('neighbor preparations do not stretch one rung over several seconds or brake toward a rendezvous height', () => {
  for (const [count, seed] of [[5, 12], [10, 4], [5, 4]]) {
    const crew = candidates(count), timeline = buildLadderTimeline(crew, orderFor(count), 44_000, seed);
    for (const path of Object.values(timeline.paths)) {
      for (const segment of path.segments.filter(segment => segment.kind === 'climb' && segment.toRow < 24)) {
        const duration = segment.end - segment.start, rows = segment.toRow - segment.fromRow;
        assert.ok(rows > 0, 'every pre-event ascent continues upward');
        assert.ok(duration / rows < 1800, `a one-rung neighbor approach cannot become a long slow-motion warning (${count}/${seed}/${path.id})`);
        const velocity = fraction => {
          const time = segment.start + duration * fraction;
          return ladderFrame(timeline, time + 1).actors.find(actor => actor.id === path.id).rungProgress - ladderFrame(timeline, time - 1).actors.find(actor => actor.id === path.id).rungProgress;
        };
        assert.ok(velocity(.95) / velocity(.5) > .76, 'the last hand stroke retains the normal climbing cadence');
      }
    }
    const grapple = timeline.events.find(event => event.motion.type === 'pounce');
    const primary = timeline.paths[grapple.actorId].segments.find(segment => segment.eventId === grapple.id);
    const partner = timeline.paths[grapple.partnerId].segments.find(segment => segment.eventId === grapple.id);
    assert.ok(Math.abs(primary.fromRow - partner.fromRow) <= 1.6, 'the actual grab occurs between nearby climbing heights');
    assert.equal(primary.toRow, partner.fromRow, 'the leap reaches the opponent at their actual height');
    assert.equal(ladderFrame(timeline, 44_000).winnerId, orderFor(count)[0]);
  }
});

test('the last ascent keeps the preceding motor cadence and never waits for a fixed reveal', () => {
  for (const [count, seed] of [[2, 19], [5, 12], [10, 4], [7, 19]]) {
    const crew = candidates(count), timeline = buildLadderTimeline(crew, orderFor(count), 44_000, seed);
    for (const path of Object.values(timeline.paths)) {
      const climbs = path.segments.filter(s => s.kind === 'climb'), final = climbs.at(-1), previous = climbs.at(-2);
      assert.equal(final.toRow, 24); assert.equal(final.end, path.arrivalAt);
      if (previous) {
        const rate = s => (s.toRow - s.fromRow) / (s.end - s.start);
        assert.ok(Math.abs(rate(final) / rate(previous) - 1) < .001, 'a few final rungs cannot be stretched into a slow reveal');
      }
      assert.ok(path.arrivalAt < 44_000);
    }
  }
});

test('climbing begins after a brief shared preparation and all staggered starters move by 1.1 seconds', () => {
  assert.equal(LADDER_START_DELAY, 900);
  const crew = candidates(10), timeline = buildLadderTimeline(crew, orderFor(10), 44_000, 4);
  assert.ok(ladderFrame(timeline, LADDER_START_DELAY - 1).actors.every(actor => actor.pose === 'idle'));
  const moving = ladderFrame(timeline, 1100).actors;
  assert.ok(moving.every(actor => actor.pose === 'climb' && actor.rungProgress > 0));
});

test('roof arms rotate from the shoulders with a bent elbow and unchanged limb lengths in both directions', () => {
  const geometry = createLadderGeometry(800, 600, 5), crew = candidates(5);
  for (const direction of [-1, 1]) {
    const samples = [];
    for (let sample = 0; sample <= 80; sample++) {
      const fraction = sample / 80, fromLane = direction > 0 ? 1 : 2, toLane = fromLane + direction;
      const actor = { id: '1', index: 0, candidate: crew[0], fromLane, toLane, lane: fromLane + direction * fraction, rungProgress: 24, height: 1, pose: 'run', phase: .5, arrived: false };
      const rig = sampleLadderRig(actor, geometry, 1000);
      for (const side of [0, 1]) {
        const upper = Math.hypot(rig.elbows[side].x - rig.shoulders[side].x, rig.elbows[side].y - rig.shoulders[side].y) / geometry.scale;
        const lower = Math.hypot(rig.hands[side].x - rig.elbows[side].x, rig.hands[side].y - rig.elbows[side].y) / geometry.scale;
        assert.ok(Math.abs(upper - LADDER_ARM_LENGTH) < .001 && Math.abs(lower - LADDER_ARM_LENGTH) < .001, 'swinging the arm never stretches its segments');
        assert.ok(rig.elbows[side].y > rig.shoulders[side].y, 'the elbow swings below the shoulder');
        assert.ok((rig.hands[side].x - rig.elbows[side].x) * direction > 0, 'the forearm stays folded forward instead of flipping behind the elbow');
      }
      samples.push(rig);
    }
    for (const side of [0, 1]) {
      const rotations = samples.map(rig => (rig.elbows[side].x - rig.shoulders[side].x) / geometry.scale), wristHeights = samples.map(rig => (rig.hands[side].y - rig.shoulders[side].y) / geometry.scale);
      assert.ok(Math.max(...rotations) - Math.min(...rotations) > 5, 'each upper arm actually pivots through the running stride');
      assert.ok(Math.max(...wristHeights) - Math.min(...wristHeights) > 4, 'the bent forearm follows the shoulder swing');
    }
  }
});

test('revealed platform ends match each climber height and source lane', () => {
  const geometry = createLadderGeometry(800, 600, 5), rectangles = [];
  const context = new Proxy({}, { get: (_target, key) => key === 'fillRect' ? (...values) => rectangles.push(values) : ['createLinearGradient', 'createRadialGradient'].includes(key) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  const bridge = { id: 'different-heights', row: 9.3, fromRow: 9.3, partnerFromRow: 5.6, fromLane: 3, leftLane: 2, rightLane: 3, state: 'active' };
  drawLadderAdventure(context, geometry, [bridge], 0, 1000, false, new Set());
  for (const [lane, row] of [[3, 9.3], [2, 5.6]]) assert.ok(rectangles.some(([x, y, width, height]) => Math.abs(x - (geometry.laneX(lane) - 7 * geometry.scale)) < .001 && Math.abs(y - geometry.rowY(row)) < .001 && width === 14 * geometry.scale && height === 2 * geometry.scale), 'each visible departure platform uses the actual source height of its occupant');
});

test('low thrown and falling catches keep the complete rig above the lower foundation', () => {
  const crew = candidates(10), order = crew.map(candidate => candidate.id).reverse();
  let samples = 0;
  for (const seed of [0, 4, 9, 12, 16, 20]) {
    const timeline = buildLadderTimeline(crew, order, 44_000, seed), geometry = createLadderGeometry(800, 600, 10), read = time => ladderFrame(timeline, time);
    for (const event of timeline.events) for (const id of event.actors) {
      for (const time of [event.resolve - 50, event.resolve + 50]) {
        const actor = ladderArtActors(timeline, read(time), crew, time, geometry, false, read).find(actor => actor.id === id);
        if (actor.landingRow > 1.2 || !['hang', 'clamber'].includes(actor.pose)) continue;
        const rig = sampleLadderRig(actor, geometry, time);
        assert.ok(rig.feet.every(foot => foot.y <= geometry.bottom + .001), `a low ${event.kind} catch must not put its boots through the foundation`);
        assert.ok(rig.hip.y < geometry.bottom && rig.head.y < rig.hip.y, 'the full hanging body stays above the floor');
        if (actor.pose === 'hang') assert.ok(rig.handContact[1], 'the low catch still holds its actual receiving rung');
        samples++;
      }
    }
  }
  assert.ok(samples >= 6, 'the regression exercises low catches and the first recovery frames');
});
