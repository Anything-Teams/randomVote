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
  const order = shuffle(candidates);
  const frameCount = Math.max(7, candidates.length);
  const lastLeadIndex = (frameCount - 1) % order.length;
  const winnerIndex = order.findIndex(candidate => candidate.id === winnerId);
  // Reserve an opening chase and a final comeback without changing the already chosen winner.
  if (winnerIndex === 0 || winnerIndex === lastLeadIndex) {
    const places = order.map((_, index) => index).filter(index => index !== 0 && index !== lastLeadIndex);
    const replacement = places[randomInt(places.length)];
    [order[winnerIndex], order[replacement]] = [order[replacement], order[winnerIndex]];
  }
  const average = 100 / candidates.length;
  const spread = 1.15 + Math.min(0.65, candidates.length * 0.065);
  // Everyone gets a turn in front while all other ranks are reshuffled at every checkpoint.
  const frames = Array.from({ length: frameCount }, (_, step): DramaFrame => {
    const progress = step / (frameCount - 1) * 94;
    const rankStep = spread * (1 - progress / 220) / (candidates.length - 1);
    const leader = order[step % order.length];
    const nextLeader = order[(step + 1) % order.length];
    const others = shuffle(order.filter(candidate => candidate.id !== leader.id));
    const nextIndex = others.findIndex(candidate => candidate.id === nextLeader.id);
    const lowerHalf = Math.ceil(candidates.length / 2);
    const surgeRank = lowerHalf + randomInt(candidates.length - lowerHalf);
    // The next front-runner starts in the lower half, so a new leader can come from well down the board.
    [others[nextIndex], others[surgeRank - 1]] = [others[surgeRank - 1], others[nextIndex]];
    const ranks = [leader, ...others];
    return {
      progress,
      percentages: Object.fromEntries(ranks.map((candidate, rank) => [
        candidate.id,
        average + ((candidates.length - 1) / 2 - rank) * rankStep,
      ])),
    };
  });
  frames.push({ progress: 100, percentages: { ...percentages } });
  return frames;
}

export function frameAt(frames: DramaFrame[], progress: number): DramaFrame {
  const bounded = Math.max(0, Math.min(100, progress));
  const nextIndex = frames.findIndex(frame => frame.progress >= bounded);
  if (nextIndex <= 0) return frames[0];
  const previous = frames[nextIndex - 1];
  const next = frames[nextIndex];
  const fraction = (bounded - previous.progress) / (next.progress - previous.progress);
  return {
    progress: bounded,
    percentages: Object.fromEntries(Object.keys(next.percentages).map(id => [
      id, previous.percentages[id] + (next.percentages[id] - previous.percentages[id]) * fraction,
    ])),
  };
}
