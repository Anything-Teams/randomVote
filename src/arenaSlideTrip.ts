import type { ArenaPoint } from './arenaLogic';

export type ArenaSlideTripWindow = {
  start: number; end: number;
  /** null waits for the scene's actual slide launch, ankle contact or kick contact. */
  launchAt?: number | null; hookAt?: number | null; kickAt?: number | null;
};
export type ArenaSlideTripOrigins = {
  driver: ArenaPoint; victim: ArenaPoint; standingAnkle?: ArenaPoint;
  slideOrigin?: ArenaPoint; hookDriver?: ArenaPoint; hookVictim?: ArenaPoint; kickTarget?: ArenaPoint;
};
export type ArenaSlideTripFrame = {
  active: boolean; side: 1 | -1; stage: 'approach' | 'slide' | 'hook' | 'fall' | 'rise' | 'kick' | 'release';
  driver: ArenaPoint; victim: ArenaPoint; driverVelocity: ArenaPoint; driverFacing: 1 | -1;
  driverPose: 'run' | 'slide' | 'recover' | 'trip'; driverPhase: number;
  slideProgress: number; driverFootTarget: ArenaPoint; footStrength: number; frontKick?: number;
  victimPose: 'brace' | 'roll' | 'stunned'; victimAngle: number; victimSuspension: number;
  victimSlam?: { tuck: number; slump: number };
  launchAt: number | null; hookAt: number | null; kickAt: number | null;
  plannedLaunchAt: number; plannedHookAt: number; kickReadyAt: number | null;
  requiredImpactAt: number; canLaunch: boolean; canHook: boolean; canKick: boolean;
};

export const ARENA_SLIDE_TRIP_CHANCE = .02;
export const ARENA_SLIDE_TRIP_TIMING = { runRamp: 180, slideRamp: 100, hook: 80, fall: 320, rise: 400, kickWindup: 240, kickRetract: 170 } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const blend = (a: ArenaPoint, b: ArenaPoint, p: number) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function arenaSlideTripOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Sliding trip roll must be 0–999');
  return roll < 20;
}

/** Accelerate and brake on the real runway without ever stepping backwards. */
function travel(origin: ArenaPoint, goal: ArenaPoint, age: number, cap: number, rampMs: number) {
  const length = distance(origin, goal), ramp = Math.min(rampMs / 1000, Math.sqrt(length / Math.max(1, cap)));
  const speed = Math.min(cap, length / Math.max(.001, ramp)), cruise = Math.max(0, length / Math.max(1, speed) - ramp);
  const seconds = Math.max(0, age / 1000), duration = 2 * ramp + cruise;
  let moved: number, velocity: number;
  if (seconds < ramp) { moved = speed * seconds * seconds / (2 * Math.max(.001, ramp)); velocity = speed * seconds / Math.max(.001, ramp); }
  else if (seconds < ramp + cruise) { moved = speed * ramp / 2 + speed * (seconds - ramp); velocity = speed; }
  else { const braking = Math.min(ramp, seconds - ramp - cruise); moved = speed * (ramp / 2 + cruise + braking - braking * braking / (2 * Math.max(.001, ramp))); velocity = speed * (1 - braking / Math.max(.001, ramp)); }
  const direction = length > .001 ? { x: (goal.x - origin.x) / length, y: (goal.y - origin.y) / length } : { x: 0, y: 0 };
  return { point: blend(origin, goal, moved / Math.max(.001, length)), velocity: { x: direction.x * velocity, y: direction.y * velocity }, duration: duration * 1000 };
}

/** A feet-first slide makes one grounded fall; only the following real kick launches an exit. */
export function arenaSlideTripTargets(window: ArenaSlideTripWindow, elapsed: number, center: ArenaPoint, origins?: ArenaSlideTripOrigins, layoutSide = 1): ArenaSlideTripFrame {
  const initial = origins ?? { driver: { x: center.x - layoutSide * 180, y: center.y + 5 }, victim: { x: center.x + layoutSide * 20, y: center.y } };
  const side = (Math.abs(initial.victim.x - initial.driver.x) > 1 ? initial.victim.x >= initial.driver.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const ankle = initial.standingAnkle ?? { x: initial.victim.x - side * 7, y: initial.victim.y - 4.08 };
  const staging = { x: ankle.x - side * 72, y: initial.victim.y };
  // A nearby runner starts sliding where they stand; the move cannot send them
  // backwards to make room for a cosmetic runway.
  const ahead = side * (staging.x - initial.driver.x) > 0;
  const approachGoal = ahead ? staging : { ...initial.driver };
  const run = travel(initial.driver, approachGoal, elapsed - window.start, 190, ARENA_SLIDE_TRIP_TIMING.runRamp);
  const plannedLaunchAt = window.start + run.duration;
  const launchAt = window.launchAt === null ? null : Math.max(window.start, window.launchAt ?? plannedLaunchAt);
  const slideOrigin = initial.slideOrigin ?? approachGoal;
  const stopping = { x: ankle.x - side * 40.8, y: initial.victim.y };
  const slideGoal = side * (stopping.x - slideOrigin.x) > 0 ? stopping : { ...slideOrigin };
  const slide = travel(slideOrigin, slideGoal, elapsed - (launchAt ?? elapsed), 240, ARENA_SLIDE_TRIP_TIMING.slideRamp);
  const plannedHookAt = (launchAt ?? plannedLaunchAt) + slide.duration;
  const hookAt = window.hookAt === null || launchAt === null ? null : Math.max(launchAt, window.hookAt ?? plannedHookAt);
  const landedAt = hookAt === null ? null : hookAt + ARENA_SLIDE_TRIP_TIMING.hook + ARENA_SLIDE_TRIP_TIMING.fall;
  const kickReadyAt = landedAt === null ? null : landedAt + ARENA_SLIDE_TRIP_TIMING.rise;
  const kickAt = window.kickAt === null || kickReadyAt === null ? null : Math.max(kickReadyAt, window.kickAt ?? kickReadyAt + ARENA_SLIDE_TRIP_TIMING.kickWindup);
  const slideProgress = launchAt === null ? 0 : ease((elapsed - launchAt) / Math.max(160, slide.duration));
  const hookAge = hookAt === null ? -1 : elapsed - hookAt;
  const fall = ease((hookAge - ARENA_SLIDE_TRIP_TIMING.hook) / ARENA_SLIDE_TRIP_TIMING.fall);
  const rise = landedAt === null ? 0 : ease((elapsed - landedAt) / ARENA_SLIDE_TRIP_TIMING.rise);
  const beforeLaunch = launchAt === null || elapsed < launchAt;
  const hooked = hookAt !== null && elapsed >= hookAt;
  const victim = hooked ? { ...(initial.hookVictim ?? initial.victim) } : { ...initial.victim };
  const hookDriver = initial.hookDriver ?? slideGoal;
  const driver = beforeLaunch ? run.point : hooked ? { ...hookDriver } : slide.point;
  const inKick = kickReadyAt !== null && elapsed >= kickReadyAt;
  const released = kickAt !== null && elapsed >= kickAt;
  const frontKick = inKick ? released ? mix(.62, 1, ease((elapsed - kickAt!) / ARENA_SLIDE_TRIP_TIMING.kickRetract)) : .62 * ease((elapsed - kickReadyAt) / ARENA_SLIDE_TRIP_TIMING.kickWindup) : undefined;
  const stage = beforeLaunch ? 'approach' : !hooked ? 'slide' : hookAge < ARENA_SLIDE_TRIP_TIMING.hook ? 'hook' : fall < 1 ? 'fall' : !inKick ? 'rise' : released ? 'release' : 'kick';
  const kickTarget = initial.kickTarget ?? { x: victim.x - side * 8, y: victim.y - 13 };
  return {
    active: elapsed >= window.start && elapsed < window.end, side, stage, driver, victim,
    driverVelocity: beforeLaunch ? run.velocity : hooked ? { x: 0, y: 0 } : slide.velocity, driverFacing: side,
    driverPose: beforeLaunch ? 'run' : !hooked || fall < 1 ? 'slide' : !inKick ? 'recover' : 'trip', driverPhase: inKick ? frontKick! : fall >= 1 ? rise : slideProgress,
    slideProgress, driverFootTarget: inKick ? kickTarget : ankle, footStrength: inKick ? 1 : !beforeLaunch && !hooked ? ease(slideProgress / .75) : 0, frontKick,
    victimPose: !hooked ? 'brace' : fall < 1 ? 'roll' : 'stunned', victimAngle: side * Math.PI * .47 * fall, victimSuspension: 0,
    victimSlam: hooked ? { tuck: .5 * Math.sin(fall * Math.PI), slump: fall } : undefined,
    launchAt, hookAt, kickAt, plannedLaunchAt, plannedHookAt, kickReadyAt,
    requiredImpactAt: kickAt ?? (kickReadyAt ?? plannedHookAt + ARENA_SLIDE_TRIP_TIMING.hook + ARENA_SLIDE_TRIP_TIMING.fall + ARENA_SLIDE_TRIP_TIMING.rise) + ARENA_SLIDE_TRIP_TIMING.kickWindup,
    canLaunch: elapsed >= plannedLaunchAt, canHook: !beforeLaunch && !hooked && slideProgress >= .6, canKick: inKick && !released,
  };
}
