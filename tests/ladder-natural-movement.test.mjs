import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildLadderTimeline, ladderFrame } = await load('src/ladderLogic.ts');
const { createLadderGeometry, ladderArtActors, sampleLadderRig } = await load('src/game/ladderArt.ts');
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

test('roof running plants a fixed-length boot on the terrace without sliding its supporting foot', () => {
  const crew = candidates(5), timeline = buildLadderTimeline(crew, orderFor(5), 44_000, 4, 0), finish = timeline.roofFinish;
  const roof = timeline.paths[finish.actorId].segments.at(-1), geometry = createLadderGeometry(800, 600, 5), deck = geometry.rowY(24), read = time => ladderFrame(timeline, time);
  const at = time => {
    const actor = ladderArtActors(timeline, read(time), crew, time, geometry, false, read).find(actor => actor.id === finish.actorId);
    return sampleLadderRig(actor, geometry, time);
  };
  let contacts = 0;
  for (let time = roof.start + 350; time < roof.end - 200; time += 4) {
    const before = at(time), after = at(time + .5);
    for (const side of [0, 1]) if (before.footContact[side] && after.footContact[side]) {
      assert.ok(Math.abs(before.feet[side].y - deck) < .001, 'the supporting sole touches the actual roof');
      assert.ok(Math.hypot(before.feet[side].x - after.feet[side].x, before.feet[side].y - after.feet[side].y) < .001, 'a planted boot stays fixed while the pelvis travels past it');
      contacts++;
    }
  }
  assert.ok(contacts > 50, 'both supporting phases are sampled across the roof dash');
  const rival = read((roof.start + roof.end) / 2).actors.find(actor => actor.id === finish.otherId);
  assert.ok(rival.rungProgress < 22 && !rival.arrived, 'the rival remains below the terrace during this rare dash');
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
  for (const seed of [6, 11, 14, 36, 37]) {
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
