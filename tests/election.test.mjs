import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/election.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { CANDIDATE_COLORS, MAX_CANDIDATES, randomInt, createElection, createDrama, frameAt } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const compiledShow = await build({ entryPoints: ['src/show.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { countProgress, settledProgress, countBeat, phaseFor, COUNT_START, WINNER_START, SHOW_DURATION } = await import(`data:text/javascript;base64,${Buffer.from(compiledShow.outputFiles[0].text).toString('base64')}`);
const candidates = Array.from({ length: MAX_CANDIDATES }, (_, index) => ({ id: String(index), name: `후보 ${index}`, color: CANDIDATE_COLORS[index] }));

function withRandomSamples(samples, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let offset = 0;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues: values => { values[0] = samples[offset] ?? ((offset + 1) * 48_271) >>> 0; offset++; return values; } },
  });
  try { return callback(); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
}

function ranking(percentages) {
  return Object.keys(percentages).sort((a, b) => percentages[b] - percentages[a]);
}

function assertDistribution(percentages, size) {
  const values = Object.values(percentages);
  assert.equal(values.length, size);
  assert.ok(values.every(value => Number.isFinite(value) && value > 0));
  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) < 0.0001);
}

test('ten candidates have distinct colors and unbiased random selection rejects the remainder', () => {
  assert.equal(MAX_CANDIDATES, 10);
  assert.equal(new Set(CANDIDATE_COLORS).size, MAX_CANDIDATES);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const samples = [0xffffffff, ...Array.from({ length: MAX_CANDIDATES }, (_, index) => index)];
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues: values => { values[0] = samples.shift(); return values; } },
  });
  try {
    assert.deepEqual(Array.from({ length: MAX_CANDIDATES }, () => randomInt(MAX_CANDIDATES)), Array.from({ length: MAX_CANDIDATES }, (_, index) => index));
    assert.equal(samples.length, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});

test('every draw has one top-ranked winner, exact vote totals, and a close race for all candidates', () => {
  for (let size = 2; size <= MAX_CANDIDATES; size++) {
    for (let draw = 0; draw < 120; draw++) {
      const result = createElection(candidates.slice(0, size));
      const counts = Object.values(result.votes);
      assert.equal(counts.reduce((sum, count) => sum + count, 0), result.totalVotes);
      assert.equal(counts.filter(count => count === Math.max(...counts)).length, 1);
      assert.equal(result.votes[result.winnerId], Math.max(...counts));
      assert.ok(result.totalVotes >= 1_200_000 && result.totalVotes <= 10_000_000);
      assertDistribution(result.percentages, size);
      const shares = Object.values(result.percentages);
      assert.ok(Math.max(...shares) - Math.min(...shares) < 2);
    }
  }
});

test('every input position can win, including reversed candidate order', () => {
  for (let size = 2; size <= MAX_CANDIDATES; size++) {
    const list = candidates.slice(0, size);
    for (let winnerIndex = 0; winnerIndex < size; winnerIndex++) {
      const result = withRandomSamples([winnerIndex], () => createElection(list));
      assert.equal(result.winnerId, list[winnerIndex].id);
      const reversed = [...list].reverse();
      const reversedResult = withRandomSamples([winnerIndex], () => createElection(reversed));
      assert.equal(reversedResult.winnerId, reversed[winnerIndex].id);
    }
  }
});

test('three boxes create a readable comeback without constantly reshuffling the race', () => {
  for (let size = 2; size <= MAX_CANDIDATES; size++) {
    const list = candidates.slice(0, size);
    for (let winnerIndex = 0; winnerIndex < size; winnerIndex++) {
      const result = withRandomSamples([winnerIndex], () => createElection(list));
      const original = structuredClone(result);
      const frames = createDrama(result);
      const leaders = frames.map(frame => ranking(frame.percentages)[0]);
      assert.deepEqual(frames.map(frame => frame.progress), [0, 32, 68, 92, 100]);
      assert.deepEqual(frames[0].percentages, frames[1].percentages);
      assert.deepEqual(ranking(frames[2].percentages), ranking(frames[3].percentages));
      assert.notEqual(leaders.at(-2), result.winnerId);
      assert.equal(leaders.at(-1), result.winnerId);
      if (size > 2) {
        const earlierPosition = ranking(frames[1].percentages).indexOf(leaders[2]);
        assert.ok(earlierPosition >= Math.floor(size / 2));
      }
      for (const frame of frames) assertDistribution(frame.percentages, size);
      const sampledLeaders = [];
      for (let progress = 0; progress <= 100; progress += 0.5) {
        const frame = frameAt(frames, progress);
        assertDistribution(frame.percentages, size);
        sampledLeaders.push(ranking(frame.percentages)[0]);
      }
      const leadChanges = sampledLeaders.filter((leader, index) => index > 0 && leader !== sampledLeaders[index - 1]).length;
      assert.ok(leadChanges >= 1 && leadChanges <= 2);
      assert.deepEqual(frameAt(frames, 100).percentages, result.percentages);
      assert.deepEqual(result, original);
    }
  }
});

test('any candidate can appear at the front of the opening story', () => {
  const result = withRandomSamples([0], () => createElection(candidates));
  for (let front = 0; front < candidates.length; front++) {
    const samples = [];
    for (let index = candidates.length - 1; index > 0; index--) samples.push(index === front ? 0 : index);
    const frames = withRandomSamples(samples, () => createDrama(result));
    assert.equal(ranking(frames[0].percentages)[0], candidates[front].id);
  }
});

test('the thirty second show holds each tally and seals the last box before revealing it', () => {
  let previous = 0;
  for (let elapsed = 0; elapsed <= SHOW_DURATION; elapsed += 50) {
    const progress = countProgress(elapsed);
    assert.ok(progress >= previous && progress >= 0 && progress <= 100);
    previous = progress;
  }
  assert.equal(SHOW_DURATION, 30_000);
  assert.equal(COUNT_START, 9_000);
  assert.equal(WINNER_START, 26_000);
  assert.equal(phaseFor(0), 'declaration');
  assert.equal(phaseFor(4999), 'declaration');
  assert.equal(phaseFor(5000), 'voting');
  assert.equal(phaseFor(COUNT_START), 'counting');
  assert.equal(phaseFor(15000), 'counting');
  assert.equal(phaseFor(WINNER_START), 'winner');
  for (let local = 2200; local <= 5000; local += 50) assert.equal(countProgress(COUNT_START + local), 32);
  for (let local = 7200; local <= 14500; local += 50) assert.equal(countProgress(COUNT_START + local), 68);
  assert.equal(countProgress(COUNT_START + 15800), 92);
  assert.equal(countBeat(COUNT_START).state, 'opening');
  assert.equal(countBeat(COUNT_START + 2200).state, 'settled');
  assert.equal(countBeat(COUNT_START + 5000).box, 2);
  assert.equal(countBeat(COUNT_START + 7200).state, 'settled');
  assert.equal(countBeat(COUNT_START + 11000).state, 'sealed');
  assert.equal(countBeat(COUNT_START + 11000).secondsUntilReveal, 4);
  assert.equal(countBeat(COUNT_START + 14499).secondsUntilReveal, 1);
  assert.equal(countBeat(COUNT_START + 14500).state, 'revealing');
  assert.equal(countProgress(SHOW_DURATION), 100);
});

test('the ranking board updates only after a complete box is announced', () => {
  const expected = [[0, 2199, 0], [2200, 7199, 32], [7200, 16999, 68], [17000, 21000, 100]];
  for (const [start, end, progress] of expected) {
    assert.equal(settledProgress(COUNT_START + start), progress);
    assert.equal(settledProgress(COUNT_START + end), progress);
  }
});

test('invalid candidate counts are rejected', () => {
  assert.throws(() => createElection(candidates.slice(0, 1)), RangeError);
  assert.throws(() => createElection([...candidates, candidates[0]]), RangeError);
});
