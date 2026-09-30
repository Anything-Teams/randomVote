import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/election.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { CANDIDATE_COLORS, MAX_CANDIDATES, randomInt, createElection, createDrama, frameAt } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const compiledShow = await build({ entryPoints: ['src/show.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { countProgress, elapsedAtProgress, countBeat, raceMoment, phaseFor, COUNT_START, WINNER_START, SHOW_DURATION } = await import(`data:text/javascript;base64,${Buffer.from(compiledShow.outputFiles[0].text).toString('base64')}`);
const compiledCatalog = await build({ entryPoints: ['src/storyCatalog.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { STORY_CATALOG } = await import(`data:text/javascript;base64,${Buffer.from(compiledCatalog.outputFiles[0].text).toString('base64')}`);
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
  assert.ok(values.every(value => Number.isFinite(value) && value >= 0));
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

test('every draw preserves one winner, exact totals, and a narrow survivor finish', () => {
  for (let size = 2; size <= MAX_CANDIDATES; size++) {
    for (let draw = 0; draw < 120; draw++) {
      const result = createElection(candidates.slice(0, size));
      const counts = Object.values(result.votes);
      assert.equal(counts.reduce((sum, count) => sum + count, 0), result.totalVotes);
      assert.equal(counts.filter(count => count === Math.max(...counts)).length, 1);
      assert.equal(result.votes[result.winnerId], Math.max(...counts));
      assert.ok(result.totalVotes >= 1_200_000 && result.totalVotes <= 10_000_000);
      assertDistribution(result.percentages, size);
      assert.ok(result.eliminatedIds.length <= size - 2);
      assert.equal(new Set(result.eliminatedIds).size, result.eliminatedIds.length);
      assert.ok(!result.eliminatedIds.includes(result.winnerId));
      for (const candidate of result.candidates) {
        assert.equal(result.votes[candidate.id] === 0, result.eliminatedIds.includes(candidate.id));
      }
      const shares = Object.values(result.percentages).filter(share => share > 0);
      assert.ok(Math.max(...shares) - Math.min(...shares) < 2);
      const survivorCounts = counts.filter(count => count > 0).sort((a, b) => b - a);
      const gap = survivorCounts[0] - survivorCounts[1];
      assert.ok(gap > 0 && gap <= Math.ceil(result.totalVotes * 3 / (shares.length * 10000)) + shares.length);
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

test('live drama follows incidents, keeps survivor sums, and limits visible lead changes', () => {
  for (let size = 2; size <= MAX_CANDIDATES; size++) {
    const list = candidates.slice(0, size);
    for (let winnerIndex = 0; winnerIndex < size; winnerIndex++) {
      const result = withRandomSamples([winnerIndex], () => createElection(list));
      const original = structuredClone(result);
      const frames = createDrama(result);
      assert.ok(frames.every((frame, index) => index === 0 || frame.progress > frames[index - 1].progress));
      for (const frame of frames) assertDistribution(frame.percentages, size);
      const sampledLeaders = [];
      const changes = [];
      for (let progress = 0; progress <= 100; progress += 0.1) {
        const frame = frameAt(frames, progress);
        assertDistribution(frame.percentages, size);
        sampledLeaders.push(ranking(frame.percentages)[0]);
        if (sampledLeaders.length === 1 || sampledLeaders.at(-1) !== sampledLeaders.at(-2)) changes.push({ progress, leader: sampledLeaders.at(-1) });
        for (const event of result.events.filter(event => event.eliminatedId)) {
          if (progress >= event.progress + 4 - 0.0000001) assert.equal(frame.percentages[event.eliminatedId], 0);
          else assert.ok(frame.percentages[event.eliminatedId] > 0);
        }
      }
      const leadChanges = sampledLeaders.filter((leader, index) => index > 0 && leader !== sampledLeaders[index - 1]).length;
      assert.ok(leadChanges >= 1 && leadChanges <= 4, `unexpected ${leadChanges} changes for ${size} candidates: ${JSON.stringify({ changes, events: result.events })}`);
      for (let progress = 90; progress <= 98; progress += 0.1) {
        const shares = Object.values(frameAt(frames, progress).percentages).filter(share => share > 0).sort((a, b) => b - a);
        assert.ok(shares[0] - shares[Math.min(2, shares.length - 1)] <= 0.120001);
      }
      assert.notEqual(ranking(frameAt(frames, 95).percentages)[0], result.winnerId);
      assert.equal(ranking(frameAt(frames, 96).percentages)[0], result.winnerId);
      assert.deepEqual(frameAt(frames, 100).percentages, result.percentages);
      assert.deepEqual(result, original);
    }
  }
});

test('sixty unique incident templates cover all six kinds without repeats in a run', () => {
  assert.equal(STORY_CATALOG.length, 60);
  assert.equal(new Set(STORY_CATALOG.map(story => story.id)).size, 60);
  assert.equal(new Set(STORY_CATALOG.map(story => story.title)).size, 60);
  for (const kind of ['brawl', 'scandal', 'comeback', 'mishap', 'alliance', 'blackout']) {
    assert.equal(STORY_CATALOG.filter(story => story.kind === kind).length, 10);
  }
  for (const [index, kind] of ['brawl', 'mishap', 'alliance', 'blackout', 'comeback'].entries()) {
    const result = withRandomSamples([0, index], () => createElection(candidates));
    assert.equal(result.events[0].kind, kind);
    assert.deepEqual(result.events.map(event => event.progress), [32, 58, 78]);
    assert.equal(new Set(result.events.map(event => event.id)).size, 3);
    for (const event of result.events) {
      assert.ok(event.actors.every(id => result.candidates.some(candidate => candidate.id === id)));
      assert.ok(event.title && event.detail && event.prop);
    }
  }
});

test('withdrawal chances respect their exact probability boundaries and keep two survivors', () => {
  for (const firstChance of [54, 55]) {
    for (const secondChance of [24, 25]) {
      const samples = Array(160).fill(99);
      samples[0] = 0;
      samples[1] = 0;
      samples[candidates.length + 2] = firstChance;
      samples[firstChance < 55 ? candidates.length + 5 : candidates.length * 2 + 4] = secondChance;
      const result = withRandomSamples(samples, () => createElection(candidates));
      assert.equal(result.events[1].kind === 'scandal', firstChance < 55);
      assert.equal(result.events[2].kind === 'scandal', secondChance < 25);
      assert.equal(result.eliminatedIds.length, Number(firstChance < 55) + Number(secondChance < 25));
      assert.ok(!result.eliminatedIds.includes(result.winnerId));
    }
  }
  for (const size of [2, 3, 4]) {
    const result = withRandomSamples(Array(160).fill(0), () => createElection(candidates.slice(0, size)));
    assert.equal(result.eliminatedIds.length, size - 2);
  }
});

test('the thirty second live count pauses briefly at tallies and the final seal', () => {
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
  for (let local = 3500; local <= 4200; local += 50) assert.equal(countProgress(COUNT_START + local), 28);
  for (let local = 8600; local <= 9300; local += 50) assert.equal(countProgress(COUNT_START + local), 64);
  for (let local = 12500; local <= 13400; local += 50) assert.equal(countProgress(COUNT_START + local), 90);
  assert.equal(countBeat(COUNT_START).state, 'opening');
  assert.equal(countBeat(COUNT_START + 3500).state, 'settled');
  assert.equal(countBeat(COUNT_START + 4200).box, 2);
  assert.equal(countBeat(COUNT_START + 8600).state, 'settled');
  assert.equal(countBeat(COUNT_START + 12500).state, 'sealed');
  assert.equal(countBeat(COUNT_START + 12500).secondsUntilReveal, 1);
  assert.equal(countBeat(COUNT_START + 13400).state, 'revealing');
  assert.equal(countProgress(SHOW_DURATION), 100);
});

test('progress inverse returns the first hold edge and keeps incident scenes readable', () => {
  for (let progress = 0; progress <= 100; progress += 0.5) {
    assert.ok(Math.abs(countProgress(elapsedAtProgress(progress)) - progress) < 0.0001);
  }
  assert.equal(elapsedAtProgress(28), COUNT_START + 3500);
  assert.equal(elapsedAtProgress(64), COUNT_START + 8600);
  assert.equal(elapsedAtProgress(90), COUNT_START + 12500);
  assert.ok(elapsedAtProgress(58) - elapsedAtProgress(32) > 2500);
  assert.ok(elapsedAtProgress(78) - elapsedAtProgress(58) > 2500);
});

test('race moments report actual counted-vote gaps and exclude withdrawn candidates', () => {
  const result = withRandomSamples(Array(160).fill(0), () => createElection(candidates));
  const frames = createDrama(result);
  const final = raceMoment(result, frameAt(frames, 100), frameAt(frames, 90));
  assert.equal(final.leader.id, result.winnerId);
  assert.equal(final.gapVotes, result.votes[final.leader.id] - result.votes[final.runner.id]);
  assert.equal(final.countedVotes, result.totalVotes);
  assert.ok(!result.eliminatedIds.includes(final.runner.id));
  assert.ok(final.leaderChanged);
  assert.ok(final.placesGained > 0);
});

test('invalid candidate counts are rejected', () => {
  assert.throws(() => createElection(candidates.slice(0, 1)), RangeError);
  assert.throws(() => createElection([...candidates, candidates[0]]), RangeError);
});
