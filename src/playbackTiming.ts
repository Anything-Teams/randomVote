import { randomInt } from './election';
import { SHOW_DURATION } from './show';
import { SPORT_DURATION, type GameMode } from './sports';

export const PLAYBACK_SECONDS = {
  election: { min: SHOW_DURATION / 1000, max: SHOW_DURATION / 1000 },
  racing: { min: SPORT_DURATION / 1000, max: SPORT_DURATION / 1000 },
  arena: { min: 40, max: 62 },
  ladder: { min: SPORT_DURATION / 1000, max: SPORT_DURATION / 1000 },
} as const;

export function basePlaybackDuration(mode: GameMode): number {
  return mode === 'election' ? SHOW_DURATION : SPORT_DURATION;
}

/** This draw has no participant or result input, so duration cannot affect rank. */
export function createPlaybackDuration(mode: GameMode, draw: (limit: number) => number = randomInt): number {
  if (mode !== 'arena') return basePlaybackDuration(mode);
  const range = PLAYBACK_SECONDS[mode];
  const choices = range.max - range.min + 1;
  const offset = draw(choices);
  if (!Number.isInteger(offset) || offset < 0 || offset >= choices) throw new RangeError('Invalid playback duration draw');
  return (range.min + offset) * 1000;
}
