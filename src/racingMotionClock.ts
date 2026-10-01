/** Events change weight and stride length, never the running animation clock. */
export function racingGaitPhase(index: number, elapsed: number): number {
  return Math.max(0, elapsed - 5500) / (560 + index % 4 * 22) + index * .193;
}
