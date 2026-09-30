export type Candidate = { id: string; name: string; color: string };
export type ElectionResult = {
  candidates: Candidate[];
  winnerId: string;
  totalVotes: number;
  votes: Record<string, number>;
  percentages: Record<string, number>;
};
export type DramaFrame = { progress: number; percentages: Record<string, number> };

export const MAX_CANDIDATES = 10;
export const CANDIDATE_COLORS = ['#ff7654', '#56c5c0', '#f5c665', '#a3a7ed', '#ee91bd', '#83bb76', '#e5a86a', '#80b6ed', '#c890e0', '#bed16e'];

/** Rejection sampling keeps every candidate's chance equal, even when the length is not a power of two. */
export function randomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError('Invalid random range');
  }
  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % maxExclusive;
}

export function createElection(candidates: Candidate[]): ElectionResult {
  if (candidates.length < 2 || candidates.length > MAX_CANDIDATES) throw new RangeError('Candidates must number 2–10');
  const winnerIndex = randomInt(candidates.length);
  const weights = candidates.map(() => 10_000 + randomInt(201));
  // Every candidate finishes close to the average; the selected winner keeps a visible, narrow lead.
  weights[winnerIndex] = Math.max(...weights) + candidates.length * 40 + randomInt(41);
  const totalVotes = 1_200_000 + randomInt(8_800_001);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const votes: Record<string, number> = {};
  let allocated = 0;
  candidates.forEach((candidate, index) => {
    const count = Math.floor((weights[index] / weightTotal) * totalVotes);
    votes[candidate.id] = count;
    allocated += count;
  });
  votes[candidates[winnerIndex].id] += totalVotes - allocated;
  const percentages = Object.fromEntries(candidates.map(candidate => [candidate.id, (votes[candidate.id] / totalVotes) * 100]));
  return { candidates, winnerId: candidates[winnerIndex].id, totalVotes, votes, percentages };
}

/** Presentation frames are calculated only after the unbiased winner has been chosen. */
export function createDrama(result: ElectionResult): DramaFrame[] {
  const { candidates, winnerId, percentages } = result;
  const shuffle = (list: Candidate[]) => {
    const shuffled = [...list];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const next = randomInt(index + 1);
      [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
    }
    return shuffled;
  };
  const openingOrder = shuffle(candidates);
  const challengers = openingOrder.slice(Math.max(1, Math.floor(candidates.length / 2)))
    .filter(candidate => candidate.id !== winnerId);
  const challengerPool = challengers.length ? challengers : openingOrder.filter(candidate => candidate.id !== winnerId);
  const challenger = challengerPool[randomInt(challengerPool.length)];
  // One incoming district drives the comeback. The remaining candidates retain
  // their relative places, so each update has a story the viewer can follow.
  const secondOrder = [challenger, ...openingOrder.filter(candidate => candidate.id !== challenger.id)];
  if (secondOrder.length > 4) {
    const swap = 2 + randomInt(secondOrder.length - 3);
    [secondOrder[swap], secondOrder[swap + 1]] = [secondOrder[swap + 1], secondOrder[swap]];
  }
  const average = 100 / candidates.length;
  const frame = (progress: number, order: Candidate[], spread: number): DramaFrame => ({
      progress,
      percentages: Object.fromEntries(order.map((candidate, rank) => [
        candidate.id,
        average + ((candidates.length - 1) / 2 - rank) * spread / (candidates.length - 1),
      ])),
  });
  const opening = frame(0, openingOrder, 1.8);
  return [
    opening,
    { progress: 32, percentages: { ...opening.percentages } },
    frame(68, secondOrder, 1.5),
    // The opening of the last box first narrows every gap without changing ranks.
    frame(92, secondOrder, 0.6),
    { progress: 100, percentages: { ...percentages } },
  ];
}

export function frameAt(frames: DramaFrame[], progress: number): DramaFrame {
  const bounded = Math.max(0, Math.min(100, progress));
  const nextIndex = frames.findIndex(frame => frame.progress >= bounded);
  if (nextIndex <= 0) return frames[0];
  const previous = frames[nextIndex - 1];
  const next = frames[nextIndex];
  const fraction = (bounded - previous.progress) / (next.progress - previous.progress);
  if (previous.progress === 92 && next.progress === 100) {
    const ids = Object.keys(next.percentages);
    const winnerId = ids.reduce((winner, id) => next.percentages[id] > next.percentages[winner] ? id : winner);
    const winnerShare = Math.max(...Object.values(previous.percentages)) + 0.3;
    const remainingScale = (100 - winnerShare) / (100 - previous.percentages[winnerId]);
    const reveal = Object.fromEntries(ids.map(id => [id,
      id === winnerId ? winnerShare : previous.percentages[id] * remainingScale,
    ]));
    // Keep the other ranks readable during the final comeback. After the winner
    // reaches the front, ease the remaining shares into the exact final tally.
    const finish = Math.pow(fraction, 3);
    const from = finish < 0.8 ? previous.percentages : reveal;
    const to = finish < 0.8 ? reveal : next.percentages;
    const amount = finish < 0.8 ? finish / 0.8 : (finish - 0.8) / 0.2;
    return {
      progress: bounded,
      percentages: Object.fromEntries(ids.map(id => [id, from[id] + (to[id] - from[id]) * amount])),
    };
  }
  return {
    progress: bounded,
    percentages: Object.fromEntries(Object.keys(next.percentages).map(id => [
      id, previous.percentages[id] + (next.percentages[id] - previous.percentages[id]) * fraction,
    ])),
  };
}
