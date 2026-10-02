import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/ladderLogic.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { buildLadderTimeline, ladderFrame, LADDER_CALM_FINISH_CHANCE, LADDER_ROOF_STEAL_CHANCE } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const participants = count => Array.from({ length: count }, (_, index) => ({ id: String(index + 1), name: `참가자 ${index + 1}`, color: '#83c7de' }));

test('some story seeds reach the treasure through a real uninterrupted final climb', () => {
  assert.equal(LADDER_CALM_FINISH_CHANCE, .35);
  assert.equal(LADDER_ROOF_STEAL_CHANCE, .06);
  for (const count of [2, 5, 10]) {
    const people = participants(count), order = people.map(person => person.id).reverse();
    let calm = 0, regular = 0;
    for (let seed = 0; seed < 80; seed++) {
      const timeline = buildLadderTimeline(people, order, 44_000, seed, 0);
      assert.deepEqual(timeline.doorOrder, order);
      assert.equal(ladderFrame(timeline, 44_000, 0).winnerId, order[0], 'a quieter story cannot redraw its chosen person');
      assert.ok(ladderFrame(timeline, 44_000, 0).complete, 'every person still finishes within the existing 44 seconds');
      if (!timeline.calmFinish) { regular++; continue; }
      calm++;
      assert.equal(timeline.roofFinish, undefined, 'a calm ending cannot contain a hidden interception');
      const path = timeline.paths[order[0]], final = path.segments.at(-1);
      assert.equal(final.kind, 'climb');
      assert.ok(final.toRow - final.fromRow >= 6 - 1e-9, 'the final approach genuinely leaves several uneventful rungs');
      assert.equal(final.fromLane, 0); assert.equal(final.toLane, 0);
      let previousRow = final.fromRow;
      for (const fraction of [.2, .5, .8, .95, .999]) {
        const time = final.start + (final.end - final.start) * fraction;
        const frame = ladderFrame(timeline, time, 0), actor = frame.actors.find(person => person.id === path.id);
        assert.equal(actor.lane, 0);
        assert.equal(actor.pose, 'climb');
        assert.equal(actor.interaction, undefined);
        assert.equal(actor.eventId, undefined);
        assert.equal(frame.winnerId, undefined, 'the claim stays unrevealed until actual arrival');
        assert.ok(actor.rungProgress > previousRow); previousRow = actor.rungProgress;
      }
      assert.equal(ladderFrame(timeline, path.arrivalAt, 0).winnerId, path.id);
    }
    assert.ok(calm >= 4 && regular >= 4, 'multiple games show a clear approach, while other endings still occur');
  }
});

test('a longer clear ascent uses one continuous clock and still completes within 44 seconds', () => {
  const people = participants(2), order = people.map(person => person.id).reverse();
  const timeline = buildLadderTimeline(people, order, 44_000, 3, 0);
  assert.equal(timeline.calmFinish, true);
  assert.deepEqual(timeline, buildLadderTimeline(people, order, 44_000, 3, 0), 'story-clock fitting is deterministic');
  assert.ok(Math.abs(Math.max(...Object.values(timeline.paths).map(path => path.arrivalAt)) - 43_700) < 1e-9);
  assert.equal(ladderFrame(timeline, 44_000, 0).winnerId, order[0]);
  for (const path of Object.values(timeline.paths)) {
    assert.ok(path.arrivalAt < 44_000);
    assert.ok(path.segments.filter(segment => segment.kind === 'climb').every(segment => segment.toRow > segment.fromRow));
    const climbs = path.segments.filter(segment => segment.kind === 'climb'), final = climbs.at(-1), previous = climbs.at(-2);
    const speed = segment => (segment.toRow - segment.fromRow) / (segment.end - segment.start);
    assert.ok(Math.abs(speed(final) / speed(previous) - 1) < .001, 'the last ascent keeps the same motor instead of adding a late burst');
    for (const boundary of path.segments.flatMap(segment => [segment.start, segment.end])) {
      const before = ladderFrame(timeline, boundary - .001, 0).actors.find(actor => actor.id === path.id);
      const after = ladderFrame(timeline, boundary + .001, 0).actors.find(actor => actor.id === path.id);
      assert.ok(Math.abs(before.rungProgress - after.rungProgress) < .01 && Math.abs(before.lane - after.lane) < .01, 'the shared clock preserves continuous device contacts and landings');
    }
  }
});
