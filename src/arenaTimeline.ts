import type { ArenaRound } from './arenaLogic';

function delayClocks<T extends object>(value: T, fields: readonly (keyof T)[], delay: number): T {
  const shifted = { ...value };
  for (const field of fields) {
    const time = value[field];
    if (typeof time === 'number' && Number.isFinite(time)) shifted[field] = (time + delay) as T[keyof T];
  }
  return shifted;
}

/** Move a pending bout's clocks together without changing its physical choreography. */
export function arenaDelayRound(round: ArenaRound, delay: number): ArenaRound {
  if (!Number.isFinite(delay)) throw new RangeError('Arena delay must be finite');
  if (delay === 0) return round;
  const shifted = delayClocks(round, [
    'start', 'impact', 'resolve', 'end', 'suplexGripAt', 'elbowGripAt',
    'rushContactAt', 'pairPickupAt', 'rushLaunchAt', 'sidekickLaunchAt', 'pushContactAt',
  ], delay);
  if (round.chargeSetup) shifted.chargeSetup = delayClocks(round.chargeSetup, ['contactAt'], delay);
  // dragUntil is an age relative to impact; the two recorded hand events are absolute.
  if (round.floorFinish) shifted.floorFinish = delayClocks(round.floorFinish, ['throwAt', 'releaseAt'], delay);
  if (round.escape) shifted.escape = delayClocks(round.escape, ['start', 'end', 'releasedUntil'], delay);
  if (round.recovery) shifted.recovery = delayClocks(round.recovery, ['start', 'end', 'throwAt'], delay);
  if (round.rim) shifted.rim = delayClocks(round.rim, ['start', 'end', 'contactAt'], delay);
  if (round.rimCharge) shifted.rimCharge = delayClocks(round.rimCharge, ['start', 'end'], delay);
  if (round.wrestlingMove) shifted.wrestlingMove = delayClocks(round.wrestlingMove, [
    'start', 'end', 'launchAt', 'contactAt', 'releaseAt', 'kickAt', 'ankleGripAt',
    'dragEndAt', 'plannedLaunchAt', 'plannedContactAt', 'counterReadyAt',
  ], delay);
  if (round.kickCatch) shifted.kickCatch = delayClocks(round.kickCatch, ['start', 'end', 'launchAt', 'catchAt', 'plannedLaunchAt'], delay);
  if (round.supermanPunch) shifted.supermanPunch = delayClocks(round.supermanPunch, ['start', 'end', 'launchAt', 'hitAt', 'plannedLaunchAt'], delay);
  if (round.slideTrip) shifted.slideTrip = delayClocks(round.slideTrip, [
    'start', 'end', 'launchAt', 'hookAt', 'kickAt', 'jumpAt', 'passAt', 'plannedLaunchAt', 'plannedPassAt',
  ], delay);
  if (round.linkedRush) shifted.linkedRush = delayClocks(round.linkedRush, ['start', 'end', 'launchAt', 'contactAt'], delay);
  if (round.pairDodge) shifted.pairDodge = delayClocks(round.pairDodge, ['start', 'end', 'launchAt', 'contactAt'], delay);
  if (round.passingTrip) shifted.passingTrip = delayClocks(round.passingTrip, ['start', 'end', 'hookAt', 'launchAt'], delay);
  return shifted;
}
