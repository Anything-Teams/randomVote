import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/election.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { CANDIDATE_COLORS, MAX_CANDIDATES, randomInt, createElection, createDrama, frameAt } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const compiledShow = await build({ entryPoints: ['src/show.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { countProgress, phaseFor, SHOW_DURATION } = await import(`data:text/javascript;base64,${Buffer.from(compiledShow.outputFiles[0].text).toString('base64')}`);
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

test('all candidates lead, surge from lower ranks, and keep the decided close finish', () => {
  for (let size = 2; size <= MAX_CANDIDATES; size++) {
    const list = candidates.slice(0, size);
    for (let winnerIndex = 0; winnerIndex < size; winnerIndex++) {
      const result = withRandomSamples([winnerIndex], () => createElection(list));
      const original = structuredClone(result);
      const frames = createDrama(result);
      const leaders = frames.map(frame => ranking(frame.percentages)[0]);
      assert.notEqual(leaders[0], result.winnerId);
      assert.notEqual(leaders.at(-2), result.winnerId);
      assert.equal(leaders.at(-1), result.winnerId);
      assert.equal(new Set(leaders).size, size);
      assert.ok(leaders.filter((leader, index) => index > 0 && leader !== leaders[index - 1]).length >= (size === 2 ? 3 : 6));
      for (const candidate of list) {
        const positions = frames.slice(0, -1).map(frame => ranking(frame.percentages).indexOf(candidate.id));
        assert.ok(positions.includes(0));
        assert.ok(positions.some(rank => rank >= Math.ceil(size / 2)));
      }
      for (let index = 1; index < frames.length - 1; index++) {
        const previousPosition = ranking(frames[index - 1].percentages).indexOf(leaders[index]);
        assert.ok(previousPosition >= Math.ceil(size / 2));
      }
      for (const frame of frames) assertDistribution(frame.percentages, size);
      const sampledLeaders = [];
      for (let progress = 0; progress <= 100; progress += 0.5) {
        const frame = frameAt(frames, progress);
        assertDistribution(frame.percentages, size);
        sampledLeaders.push(ranking(frame.percentages)[0]);
      }
      assert.equal(new Set(sampledLeaders).size, size);
      assert.ok(sampledLeaders.filter((leader, index) => index > 0 && leader !== sampledLeaders[index - 1]).length >= (size === 2 ? 3 : 6));
      assert.deepEqual(frameAt(frames, 100).percentages, result.percentages);
      assert.deepEqual(result, original);
    }
  }
});

test('the show keeps counting forward, pauses for the final box, and completes in 28 seconds', () => {
  let previous = 0;
  for (let elapsed = 0; elapsed <= SHOW_DURATION; elapsed += 50) {
    const progress = countProgress(elapsed);
    assert.ok(progress >= previous && progress >= 0 && progress <= 100);
    previous = progress;
  }
  assert.equal(phaseFor(0), 'declaration');
  assert.equal(phaseFor(6500), 'voting');
  assert.equal(phaseFor(15000), 'counting');
  assert.equal(phaseFor(23500), 'winner');
  assert.ok(countProgress(22300) - countProgress(21300) < 1);
  assert.equal(countProgress(SHOW_DURATION), 100);
});

test('invalid candidate counts are rejected', () => {
  assert.throws(() => createElection(candidates.slice(0, 1)), RangeError);
  assert.throws(() => createElection([...candidates, candidates[0]]), RangeError);
});
