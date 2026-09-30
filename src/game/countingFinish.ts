import { WINNER_START } from '../show';

export const COUNT_FINISH_START = WINNER_START - 4000;
// The greatest possible graph marker is 252 + 520 + 3 = 775.
// Keep the line and the short braking step to its right, within the tally column.
export const COUNT_FINISH_LINE_X = 779;
export const COUNT_FINISH_END_X = COUNT_FINISH_LINE_X + 6;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function countingFinishAt(startX: number, rank: number, count: number, elapsed: number) {
  const crossAt = WINNER_START - 900 + rank / Math.max(1, count - 1) * 650;
  const travel = clamp((elapsed - COUNT_FINISH_START) / (crossAt - COUNT_FINISH_START));
  const travelEase = travel < 0.18 ? travel * travel / 0.36 / 0.91 : (travel - 0.09) / 0.91;
  const age = elapsed - crossAt;
  const brake = clamp(age / 500);
  const line = COUNT_FINISH_LINE_X + 3;
  return { x: startX + (line - startX) * travelEase + (1 - Math.pow(1 - brake, 3)) * 3, age };
}

/** 32 local pixels cover the head lean and the furthest hand in the finish poses. */
export function countingFinishScale(originalScale: number, labelLeft: number) {
  return Math.min(originalScale, Math.max(0.1, (labelLeft - COUNT_FINISH_END_X - 8) / 32));
}
