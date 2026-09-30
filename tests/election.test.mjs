import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/election.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { CANDIDATE_COLORS, MAX_CANDIDATES, randomInt, createElection, createDrama, frameAt } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const compiledShow = await build({ entryPoints: ['src/show.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { countProgress, elapsedAtProgress, countBeat, storyBeat, resolvedEvents, storyOutcome, finalResultGap, tallyVotes, raceMoment, phaseFor, COUNT_START, WINNER_START, SHOW_DURATION, STORY_DURATION, STORY_RESOLVE_AT } = await import(`data:text/javascript;base64,${Buffer.from(compiledShow.outputFiles[0].text).toString('base64')}`);
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

test('the fifty eight second count pauses incidents until their verdict and then applies the result', () => {
  let previous = 0;
  for (let elapsed = 0; elapsed <= SHOW_DURATION; elapsed += 50) {
    const progress = countProgress(elapsed);
    assert.ok(progress >= previous && progress >= 0 && progress <= 100);
    previous = progress;
  }
  assert.equal(SHOW_DURATION, 58_000);
  assert.equal(COUNT_START, 9_000);
  assert.equal(WINNER_START, 52_000);
  assert.equal(phaseFor(0), 'declaration');
  assert.equal(phaseFor(4999), 'declaration');
  assert.equal(phaseFor(5000), 'voting');
  assert.equal(phaseFor(COUNT_START), 'counting');
  assert.equal(phaseFor(15000), 'counting');
  assert.equal(phaseFor(WINNER_START), 'winner');
  for (const [start, end, value] of [[3200, 3800, 28], [4500, 9100, 32], [15900, 20500, 58], [27300, 31900, 78], [37600, 39000, 90]]) {
    for (let local = start; local <= end; local += 50) assert.equal(countProgress(COUNT_START + local), value);
  }
  assert.equal(countBeat(COUNT_START).state, 'opening');
  assert.equal(countBeat(COUNT_START + 3199).state, 'opening');
  assert.equal(countBeat(COUNT_START + 3200).state, 'settled');
  assert.equal(countBeat(COUNT_START + 3799).box, 1);
  assert.equal(countBeat(COUNT_START + 3800).box, 2);
  assert.equal(countBeat(COUNT_START + 12899).state, 'opening');
  assert.equal(countBeat(COUNT_START + 12900).state, 'settled');
  assert.equal(countBeat(COUNT_START + 37599).state, 'settled');
  assert.equal(countBeat(COUNT_START + 37600).state, 'sealed');
  assert.equal(countBeat(COUNT_START + 37600).secondsUntilReveal, 2);
  assert.equal(countBeat(COUNT_START + 38999).state, 'sealed');
  assert.equal(countBeat(COUNT_START + 39000).state, 'revealing');
  assert.equal(countProgress(SHOW_DURATION), 100);
});

test('progress inverse returns the first hold edge and keeps incident scenes readable', () => {
  for (let progress = 0; progress <= 100; progress += 0.5) {
    assert.ok(Math.abs(countProgress(elapsedAtProgress(progress)) - progress) < 0.0001);
  }
  assert.equal(elapsedAtProgress(28), COUNT_START + 3200);
  assert.equal(elapsedAtProgress(32), 13_500);
  assert.equal(elapsedAtProgress(58), 24_900);
  assert.equal(elapsedAtProgress(78), 36_300);
  assert.equal(elapsedAtProgress(90), COUNT_START + 37600);
  assert.ok(elapsedAtProgress(58) - elapsedAtProgress(32) > STORY_DURATION);
  assert.ok(elapsedAtProgress(78) - elapsedAtProgress(58) > STORY_DURATION);
});

test('each incident has exact announcement, action, verdict, and aftermath boundaries', () => {
  const result = withRandomSamples(Array(160).fill(0), () => createElection(candidates));
  assert.equal(STORY_DURATION, 8400);
  assert.equal(STORY_RESOLVE_AT, 4600);
  for (const [index, event] of result.events.entries()) {
    const start = elapsedAtProgress(event.progress);
    assert.equal(storyBeat(result.events, start - 1), undefined);
    for (const [age, stage] of [[0, 'announcement'], [1399, 'announcement'], [1400, 'action'], [4599, 'action'], [4600, 'verdict'], [6399, 'verdict'], [6400, 'aftermath'], [8399, 'aftermath']]) {
      const beat = storyBeat(result.events, start + age);
      assert.equal(beat.event.id, event.id);
      assert.equal(beat.index, index + 1);
      assert.equal(beat.age, age);
      assert.equal(beat.stage, stage);
    }
    assert.equal(storyBeat(result.events, start + STORY_DURATION), undefined);
    assert.equal(countProgress(start), event.progress);
    assert.equal(countProgress(start + STORY_RESOLVE_AT), event.progress);
    assert.ok(countProgress(start + STORY_RESOLVE_AT + 50) > event.progress);
    assert.equal(countProgress(start + STORY_DURATION), [45, 62, 82][index]);
  }
});

test('a scandal is resolved at the verdict rather than its announcement', () => {
  const result = withRandomSamples(Array(160).fill(0), () => createElection(candidates));
  const frames = createDrama(result);
  for (const event of result.events.filter(event => event.eliminatedId)) {
    const start = elapsedAtProgress(event.progress);
    assert.ok(!resolvedEvents(result.events, start).some(item => item.id === event.id));
    assert.ok(!resolvedEvents(result.events, start + STORY_RESOLVE_AT - 1).some(item => item.id === event.id));
    assert.ok(resolvedEvents(result.events, start + STORY_RESOLVE_AT).some(item => item.id === event.id));
    const verdictFrame = frameAt(frames, countProgress(start + STORY_RESOLVE_AT));
    assert.ok(verdictFrame.percentages[event.eliminatedId] > 0);
    const afterFrame = frameAt(frames, countProgress(start + STORY_DURATION));
    assert.equal(afterFrame.percentages[event.eliminatedId], 0);
  }
});

test('story outcomes describe the real before and after actor ranks', () => {
  for (let firstKind = 0; firstKind < 5; firstKind++) {
    const result = withRandomSamples([0, firstKind], () => createElection(candidates));
    const frames = createDrama(result);
    for (const event of result.events) {
      const outcome = storyOutcome(result, event, frames);
      const beforeOrder = ranking(frameAt(frames, event.progress).percentages).filter(id => frameAt(frames, event.progress).percentages[id] > 0);
      const afterProgress = event.progress === 32 ? 45 : event.progress === 58 ? 62 : 82;
      const afterFrame = frameAt(frames, afterProgress);
      const afterOrder = ranking(afterFrame.percentages).filter(id => afterFrame.percentages[id] > 0);
      assert.equal(outcome.eventId, event.id);
      assert.equal(outcome.actors.length, event.actors.length);
      for (const actor of outcome.actors) {
        assert.equal(actor.beforeRank, beforeOrder.indexOf(actor.id) + 1);
        assert.equal(actor.afterRank, afterOrder.includes(actor.id) ? afterOrder.indexOf(actor.id) + 1 : null);
        assert.equal(actor.name, result.candidates.find(candidate => candidate.id === actor.id).name);
        assert.ok(outcome.title.includes(actor.name) && outcome.summary.includes(actor.name));
        if (actor.afterRank === null) assert.equal(actor.label, '후보 탈락');
        else if (actor.beforeRank === actor.afterRank) assert.equal(actor.label, `${actor.afterRank}위 유지`);
        else assert.equal(actor.label, `${actor.beforeRank}위 → ${actor.afterRank}위`);
      }
    }
    const firstOutcome = storyOutcome(result, result.events[0], frames);
    if (['brawl', 'mishap', 'blackout'].includes(result.events[0].kind)) {
      assert.equal(firstOutcome.actors[0].beforeRank, 1);
      assert.equal(firstOutcome.actors[0].afterRank, candidates.length);
    }
    if (result.events[0].kind === 'brawl') assert.equal(firstOutcome.actors[1].afterRank, 1);
    if (result.events[0].kind === 'comeback' || result.events[0].kind === 'alliance') assert.equal(firstOutcome.actors[0].afterRank, 1);
  }
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

test('live race news uses the same vote-gap rounding as the UI and canvas', () => {
  const totalVotes = 5_755_059;
  const votes = Object.fromEntries(candidates.map(candidate => [candidate.id, candidate.id === '0' ? 575_514 : 575_505]));
  const result = {
    candidates, winnerId: '0', totalVotes, votes,
    percentages: Object.fromEntries(candidates.map(candidate => [candidate.id, votes[candidate.id] / totalVotes * 100])),
    events: [], eliminatedIds: [],
  };
  const leaderShare = 10.880555555555556;
  const runnerShare = 10.684876543209876;
  const frame = { progress: 4, percentages: Object.fromEntries(candidates.map(candidate => [candidate.id,
    candidate.id === '0' ? leaderShare : candidate.id === '1' ? runnerShare : (100 - leaderShare - runnerShare) / 8,
  ])) };
  const live = raceMoment(result, frame);
  assert.equal(live.countedVotes, 230_202);
  assert.equal(live.gapVotes, 450);
  assert.equal(raceMoment(result, { progress: 100, percentages: result.percentages }).gapVotes, 9);
});

test('final gaps preserve 94 vote and single vote finishes despite rounded percentages', () => {
  const list = candidates.slice(0, 4);
  for (const gapVotes of [94, 1]) {
    const votes = { '0': 0, '1': 499_000, '2': 500_000 + gapVotes, '3': 500_000 };
    const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
    const percentages = Object.fromEntries(list.map(candidate => [candidate.id, Number((votes[candidate.id] / totalVotes * 100).toFixed(2))]));
    const result = { candidates: list, winnerId: '2', totalVotes, votes, percentages, events: [], eliminatedIds: ['0'] };
    const final = finalResultGap(result);
    assert.equal(final.winner.id, '2');
    assert.equal(final.runner.id, '3');
    assert.equal(final.winnerVotes, 500_000 + gapVotes);
    assert.equal(final.runnerVotes, 500_000);
    assert.equal(final.gapVotes, gapVotes);
    const estimatedGap = Math.round(totalVotes * (percentages['2'] - percentages['3']) / 100);
    assert.notEqual(estimatedGap, gapVotes);
  }
});

test('candidate tallies share one rounded live count and preserve exact final votes', () => {
  const percentages = { '0': 12.35, '1': 10.880555555555556 };
  const finalVotes = { '0': 123_499, '1': 108_806 };
  assert.equal(tallyVotes('0', percentages, 0, 1_000_000, finalVotes), 0);
  assert.equal(tallyVotes('0', percentages, -1, 1_000_000, finalVotes), 0);
  assert.equal(tallyVotes('0', percentages, 32, 1_000_000), 39_520);
  assert.equal(tallyVotes('1', percentages, 4, 5_755_059), 25_047);
  assert.equal(tallyVotes('0', percentages, 100, 1_000_000, finalVotes), 123_499);
  assert.equal(tallyVotes('0', percentages, 120, 1_000_000, finalVotes), 123_499);
  assert.equal(tallyVotes('0', percentages, 100, 1_000_000), 123_500);
  assert.equal(tallyVotes('missing', percentages, 32, 1_000_000), 0);
  assert.equal(tallyVotes('0', { '0': -2 }, 32, 1_000_000), 0);
});

test('invalid candidate counts are rejected', () => {
  assert.throws(() => createElection(candidates.slice(0, 1)), RangeError);
  assert.throws(() => createElection([...candidates, candidates[0]]), RangeError);
});
