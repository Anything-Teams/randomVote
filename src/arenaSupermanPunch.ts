import type { ArenaPoint } from './arenaLogic';
import { ARENA_CHARGE_RAMP_SECONDS, arenaChargePath } from './arenaCharge';

export type ArenaSupermanPunchWindow = {
  start: number; end: number;
  /** The Scene records takeoff and the first actual rendered fist contact. */
  launchAt?: number | null; hitAt?: number | null;
  /** The real-origin runway plan keeps narration on the same preparation clock. */
  plannedLaunchAt?: number;
};
export type ArenaSupermanPunchOrigins = {
  driver: ArenaPoint; victim: ArenaPoint;
  /** Painted face/upper chest captured before the attacker starts moving. */
  target?: ArenaPoint;
  launchOrigin?: ArenaPoint; hitDriver?: ArenaPoint;
};
export type ArenaSupermanPunchFrame = {
  active: boolean; canPerform: boolean;
  stage: 'approach' | 'load' | 'jump' | 'punch' | 'land' | 'recover';
  /** Ground roots: the renderer subtracts height from the attacker's y. */
  driver: ArenaPoint; victim: ArenaPoint; driverVelocity: ArenaPoint;
  side: 1 | -1; facing: 1 | -1; driverFacing: 1 | -1;
  driverPose: 'run' | 'superman' | 'land' | 'guard'; driverPhase: number;
  height: number; suspension: number; loadProgress: number; landProgress: number;
  punchProgress: number; punchTarget: ArenaPoint; punchStrength: number;
  launchAt: number | null; hitAt: number | null;
  plannedLaunchAt: number; canLaunch: boolean; canHit: boolean;
  requiredImpactAt: number; landingAt: number;
};

export const ARENA_SUPERMAN_PUNCH_CHANCE = .001;
export const ARENA_SUPERMAN_PUNCH_TIMING = {
  runRamp: ARENA_CHARGE_RAMP_SECONDS * 1000, load: 180, air: 500, extendStart: 120, extendEnd: 240,
  holdEnd: 340, contactStart: 180, contactEnd: 360, land: 180, recover: 180,
} as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(b.x - a.x, b.y - a.y);
const inside = (point: ArenaPoint, rx = 293, ry = 102) => Math.hypot((point.x - 500) / rx, (point.y - 416) / ry) <= 1;

/** Cosmetic selection does not change the drawn loser or finishing order. */
export function arenaSupermanPunchOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Superman punch roll must be 0–999');
  return roll === 0;
}

/**
 * Run, plant, leap and finish a forward punch on a physical clock. A missed
 * punch still lands on time; only actual fist contact may launch the victim.
 * Recorded contact cannot stop the attacker in midair or drag them outside.
 */
export function arenaSupermanPunchTargets(window: ArenaSupermanPunchWindow, elapsed: number, center: ArenaPoint,
  origins?: ArenaSupermanPunchOrigins, layoutSide = 1): ArenaSupermanPunchFrame {
  const initial = origins ?? { driver: { x: center.x - layoutSide * 180, y: center.y + 5 }, victim: { x: center.x + layoutSide * 20, y: center.y } };
  const side = (Math.abs(initial.victim.x - initial.driver.x) > 1 ? initial.victim.x > initial.driver.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const staging = { x: initial.victim.x - side * 110, y: initial.victim.y };
  const ahead = side * (staging.x - initial.driver.x) > 0;
  const approachGoal = ahead ? staging : { ...initial.driver };
  const landing = { x: initial.victim.x - side * 54, y: initial.victim.y };
  const jumpOrigin = initial.launchOrigin ?? approachGoal;
  const jumpLength = distance(jumpOrigin, landing);
  const canPerform = ahead && distance(initial.driver, approachGoal) >= 24 && side * (landing.x - jumpOrigin.x) > 16
    && jumpLength <= 80 && inside(initial.driver, 303, 112) && inside(initial.victim)
    && inside(approachGoal) && inside(jumpOrigin) && inside(landing);
  const run = arenaChargePath(initial.driver, canPerform ? approachGoal : initial.driver, elapsed - window.start, true);
  const plannedLaunchAt = window.plannedLaunchAt ?? window.start + run.duration + ARENA_SUPERMAN_PUNCH_TIMING.load;
  const loadAt = plannedLaunchAt - ARENA_SUPERMAN_PUNCH_TIMING.load;
  // A recorded takeoff already passed the Scene's real-origin plant gate.
  // Story readers use default origins and must still honor that actual clock.
  const launchAt = window.launchAt === null || !canPerform ? null : window.launchAt === undefined ? plannedLaunchAt : Math.max(window.start, window.launchAt);
  const expectedLaunch = launchAt ?? plannedLaunchAt;
  const hitAt = window.hitAt === undefined || window.hitAt === null ? null : Math.max(expectedLaunch, window.hitAt);
  const airAge = launchAt === null ? -1 : Math.max(0, elapsed - launchAt);
  const airborne = launchAt !== null && elapsed >= launchAt && airAge < ARENA_SUPERMAN_PUNCH_TIMING.air;
  const phase = launchAt === null || elapsed < launchAt ? 0 : clamp(airAge / ARENA_SUPERMAN_PUNCH_TIMING.air);
  const jumpProgress = ease(phase);
  const beforeLaunch = launchAt === null || elapsed < launchAt;
  const driver = beforeLaunch ? run.point : mix(jumpOrigin, landing, jumpProgress);
  const height = airborne ? 24 * Math.sin(Math.PI * phase) ** 2 : 0;
  const punchProgress = !airborne ? 0 : airAge < ARENA_SUPERMAN_PUNCH_TIMING.extendEnd
    ? ease((airAge - ARENA_SUPERMAN_PUNCH_TIMING.extendStart) / (ARENA_SUPERMAN_PUNCH_TIMING.extendEnd - ARENA_SUPERMAN_PUNCH_TIMING.extendStart))
    : 1 - ease((airAge - ARENA_SUPERMAN_PUNCH_TIMING.holdEnd) / (ARENA_SUPERMAN_PUNCH_TIMING.air - ARENA_SUPERMAN_PUNCH_TIMING.holdEnd));
  const loadProgress = canPerform && beforeLaunch ? ease((elapsed - loadAt) / ARENA_SUPERMAN_PUNCH_TIMING.load) : 0;
  const landingAt = expectedLaunch + ARENA_SUPERMAN_PUNCH_TIMING.air;
  const landProgress = launchAt !== null ? ease((elapsed - landingAt) / ARENA_SUPERMAN_PUNCH_TIMING.land) : 0;
  const stage: ArenaSupermanPunchFrame['stage'] = beforeLaunch ? elapsed < loadAt ? 'approach' : 'load'
    : airborne ? airAge < ARENA_SUPERMAN_PUNCH_TIMING.extendStart ? 'jump' : 'punch'
      : elapsed < landingAt + ARENA_SUPERMAN_PUNCH_TIMING.land ? 'land' : 'recover';
  const driverPose: ArenaSupermanPunchFrame['driverPose'] = beforeLaunch ? elapsed < loadAt ? 'run' : 'guard'
    : airborne ? 'superman' : stage === 'land' ? 'land' : 'guard';
  const jumpVelocity = airborne ? 6 * phase * (1 - phase) / (ARENA_SUPERMAN_PUNCH_TIMING.air / 1000) : 0;
  const driverVelocity = beforeLaunch ? run.velocity : { x: (landing.x - jumpOrigin.x) * jumpVelocity, y: (landing.y - jumpOrigin.y) * jumpVelocity };
  return {
    active: canPerform && elapsed >= window.start && (launchAt === null || elapsed < landingAt + ARENA_SUPERMAN_PUNCH_TIMING.land + ARENA_SUPERMAN_PUNCH_TIMING.recover),
    canPerform, stage, driver, victim: { ...initial.victim }, driverVelocity,
    side, facing: side, driverFacing: side, driverPose, driverPhase: phase,
    height, suspension: airborne ? Math.sin(Math.PI * phase) : 0, loadProgress, landProgress,
    punchProgress, punchTarget: { ...(initial.target ?? { x: initial.victim.x, y: initial.victim.y - 96 }) }, punchStrength: punchProgress,
    launchAt, hitAt, plannedLaunchAt, canLaunch: canPerform && elapsed >= plannedLaunchAt,
    canHit: canPerform && airborne && hitAt === null && airAge >= ARENA_SUPERMAN_PUNCH_TIMING.contactStart && airAge <= ARENA_SUPERMAN_PUNCH_TIMING.contactEnd,
    requiredImpactAt: hitAt ?? expectedLaunch + ARENA_SUPERMAN_PUNCH_TIMING.extendEnd, landingAt,
  };
}
