import { MAX_CANDIDATES, randomInt, type Candidate } from './election';

export type GameMode = 'election' | 'racing' | 'arena' | 'ladder';
export const SPORT_DURATION = 44_000;
export type SportsStageProps = {
  candidates: Candidate[];
  order: string[];
  elapsed: number;
  duration: number;
  paused: boolean;
  preview: boolean;
  arenaRushRoll?: number;
};

/** Every complete ranking is equally likely. Cheering never enters the draw. */
export function createSportsOrder(candidates: Candidate[], draw: (limit: number) => number = randomInt): string[] {
  if (candidates.length < 2 || candidates.length > MAX_CANDIDATES || new Set(candidates.map(candidate => candidate.id)).size !== candidates.length) {
    throw new RangeError('Participants must have 2–10 unique IDs');
  }
  const order = candidates.map(candidate => candidate.id);
  for (let index = order.length - 1; index > 0; index--) {
    const other = draw(index + 1);
    if (!Number.isInteger(other) || other < 0 || other > index) throw new RangeError('Invalid random index');
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}
