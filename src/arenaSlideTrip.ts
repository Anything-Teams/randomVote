import type { ArenaPoint } from './arenaLogic';

export type ArenaSlideTripWindow = {
  start: number; end: number;
  /** null waits for the scene's actual slide launch, ankle contact or kick contact. */
  launchAt?: number | null; hookAt?: number | null; kickAt?: number | null;
  /** A rare defender jumps over the slide, then both resume the deciding bout. */
  evade?: boolean; jumpAt?: number | null; passAt?: number | null;
  plannedLaunchAt?: number; plannedPassAt?: number;
};
export type ArenaSlideTripOrigins = {
  driver: ArenaPoint; victim: ArenaPoint; standingAnkle?: ArenaPoint;
  slideOrigin?: ArenaPoint; hookDriver?: ArenaPoint; hookVictim?: ArenaPoint; kickTarget?: ArenaPoint;
};
export type ArenaSlideTripFrame = {
  active: boolean; side: 1 | -1; stage: 'approach' | 'slide' | 'hook' | 'fall' | 'rise' | 'kick' | 'release' | 'jump' | 'pass' | 'land' | 'recover';
  driver: ArenaPoint; victim: ArenaPoint; driverVelocity: ArenaPoint; driverFacing: 1 | -1;
  driverPose: 'run' | 'slide' | 'recover' | 'trip' | 'guard'; driverPhase: number;
  slideProgress: number; driverFootTarget: ArenaPoint; footStrength: number; frontKick?: number;
  victimPose: 'brace' | 'roll' | 'stunned' | 'airborne' | 'land' | 'guard'; victimAngle: number; victimSuspension: number;
  victimHeight: number; victimJumpTuck: number; victimPhase: number;
  victimSlam?: { tuck: number; slump: number };
  launchAt: number | null; hookAt: number | null; kickAt: number | null;
  plannedLaunchAt: number; plannedHookAt: number; kickReadyAt: number | null;
  requiredImpactAt: number; canLaunch: boolean; canHook: boolean; canKick: boolean;
  canPerform: boolean; startingGap: number;
  plannedJumpAt: number; jumpAt: number | null; passAt: number | null; landingAt: number; requiredEndAt: number;
  canJump: boolean; canPass: boolean; recovered: boolean;
};

export const ARENA_SLIDE_TRIP_CHANCE = .02;
export const ARENA_SLIDE_TRIP_EVADE_CHANCE = .02;
export const ARENA_SLIDE_TRIP_MIN_GAP = 130;
export const ARENA_SLIDE_TRIP_MIN_RUN = 320;
export const ARENA_SLIDE_TRIP_ENTRY_GAP = 124;
export const ARENA_SLIDE_TRIP_JUMP_DURATION = 520;
export const ARENA_SLIDE_TRIP_TIMING = { runRamp: 180, slideRamp: 100, hook: 24, fall: 320, rise: 400, kickWindup: 240, kickRetract: 170 } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const blend = (a: ArenaPoint, b: ArenaPoint, p: number) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function arenaSlideTripOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Sliding trip roll must be 0–999');
  return roll < 20;
}

/** Independent cosmetic branch among running slides with a real runway. */
export function arenaSlideTripEvadeOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Slide jump dodge roll must be 0–999');
  return roll < 20;
}

/** A committed runner carries the same speed into the seated slide. */
function runningEntry(origin: ArenaPoint, goal: ArenaPoint, age: number) {
  const length = distance(origin, goal), speed = 190, ramp = ARENA_SLIDE_TRIP_TIMING.runRamp / 1000;
  const duration = (length / speed + ramp / 2) * 1000, t = Math.max(0, age / 1000);
  const moved = Math.min(length, t < ramp ? speed * t * t / (2 * ramp) : speed * (t - ramp / 2));
  const direction = length > .001 ? { x: (goal.x - origin.x) / length, y: (goal.y - origin.y) / length } : { x: 0, y: 0 };
  const velocity = t * 1000 > duration ? 0 : speed * Math.min(1, t / ramp);
  return { point: blend(origin, goal, moved / Math.max(.001, length)), velocity: { x: direction.x * velocity, y: direction.y * velocity }, duration };
}

/** Ground friction reduces the carried running speed over a visible slide. */
function slidingTravel(origin: ArenaPoint, goal: ArenaPoint, age: number) {
  const length = distance(origin, goal), speed = 190, duration = 2 * length / speed * 1000;
  const p = clamp(age / Math.max(1, duration)), moved = length * (2 * p - p * p);
  const direction = length > .001 ? { x: (goal.x - origin.x) / length, y: (goal.y - origin.y) / length } : { x: 0, y: 0 };
  return { point: blend(origin, goal, moved / Math.max(.001, length)), velocity: { x: direction.x * speed * (1 - p), y: direction.y * speed * (1 - p) }, duration };
}

/** A feet-first slide makes one grounded fall; only the following real kick launches an exit. */
export function arenaSlideTripTargets(window: ArenaSlideTripWindow, elapsed: number, center: ArenaPoint, origins?: ArenaSlideTripOrigins, layoutSide = 1): ArenaSlideTripFrame {
  const initial = origins ?? { driver: { x: center.x - layoutSide * 180, y: center.y + 5 }, victim: { x: center.x + layoutSide * 20, y: center.y } };
  const side = (Math.abs(initial.victim.x - initial.driver.x) > 1 ? initial.victim.x >= initial.driver.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const ankle = initial.standingAnkle ?? { x: initial.victim.x - side * 7, y: initial.victim.y - 4.08 };
  // A short but valid runway keeps its real run rather than backing up. With
  // more room, sit down well before the ankle line and slide the rest of it.
  const entryGap = Math.min(ARENA_SLIDE_TRIP_ENTRY_GAP, Math.max(40.8, side * (ankle.x - initial.driver.x) - 48));
  const staging = { x: ankle.x - side * entryGap, y: initial.victim.y };
  // A nearby runner starts sliding where they stand; the move cannot send them
  // backwards to make room for a cosmetic runway.
  const ahead = side * (staging.x - initial.driver.x) > 0;
  const approachGoal = ahead ? staging : { ...initial.driver };
  const run = runningEntry(initial.driver, approachGoal, elapsed - window.start);
  const plannedLaunchAt = window.plannedLaunchAt ?? window.start + run.duration;
  const startingGap = distance(initial.driver, initial.victim);
  const victimInside = Math.hypot((initial.victim.x - 500) / 290, (initial.victim.y - 416) / 98) <= 1;
  const canPerform = startingGap >= ARENA_SLIDE_TRIP_MIN_GAP && run.duration >= ARENA_SLIDE_TRIP_MIN_RUN && victimInside;
  const launchAt = !canPerform || window.launchAt === null ? null : Math.max(window.start, window.launchAt ?? plannedLaunchAt);
  const slideOrigin = initial.slideOrigin ?? approachGoal;
  const stopping = { x: ankle.x - side * 40.8, y: initial.victim.y };
  const slideGoal = side * (stopping.x - slideOrigin.x) > 0 ? stopping : { ...slideOrigin };
  const slide = slidingTravel(slideOrigin, slideGoal, elapsed - (launchAt ?? elapsed));
  const plannedHookAt = (launchAt ?? plannedLaunchAt) + (window.plannedPassAt === undefined ? slide.duration : window.plannedPassAt - plannedLaunchAt);
  const hookAt = window.hookAt === null || launchAt === null ? null : Math.max(launchAt, window.hookAt ?? plannedHookAt);
  // The contact label overlaps the start of the fall. A real ankle hit does
  // not freeze both fighters before the defender loses balance.
  const landedAt = hookAt === null ? null : hookAt + ARENA_SLIDE_TRIP_TIMING.fall;
  const kickReadyAt = landedAt === null ? null : landedAt + ARENA_SLIDE_TRIP_TIMING.rise;
  const kickAt = window.kickAt === null || kickReadyAt === null ? null : Math.max(kickReadyAt, window.kickAt ?? kickReadyAt + ARENA_SLIDE_TRIP_TIMING.kickWindup);
  const slideProgress = launchAt === null ? 0 : ease((elapsed - launchAt) / 180);
  const hookAge = hookAt === null ? -1 : elapsed - hookAt;
  const fallClock = clamp(hookAge / ARENA_SLIDE_TRIP_TIMING.fall);
  const fall = .25 * fallClock + .75 * ease(fallClock);
  const rise = landedAt === null ? 0 : ease((elapsed - landedAt) / ARENA_SLIDE_TRIP_TIMING.rise);
  const beforeLaunch = launchAt === null || elapsed < launchAt;
  const hooked = hookAt !== null && elapsed >= hookAt;
  const victim = hooked ? { ...(initial.hookVictim ?? initial.victim) } : { ...initial.victim };
  const hookDriver = initial.hookDriver ?? slideGoal;
  // Keep the remaining ground momentum after the actual sole contact, then
  // settle into the same footprint used by the rise and following kick.
  const contactVelocity = hookAt === null ? { x: 0, y: 0 } : slidingTravel(slideOrigin, slideGoal, hookAt - launchAt!).velocity;
  const settleSeconds = .12, settle = clamp(hookAge / (settleSeconds * 1000));
  const carry = { x: contactVelocity.x * settleSeconds / 2, y: contactVelocity.y * settleSeconds / 2 };
  const carried = { x: hookDriver.x + carry.x * (2 * settle - settle * settle), y: hookDriver.y + carry.y * (2 * settle - settle * settle) };
  const settled = { x: hookDriver.x + carry.x, y: hookDriver.y + carry.y };
  const kickStep = initial.kickTarget ? { x: initial.kickTarget.x - side * 48, y: hookDriver.y } : hookDriver;
  const driver = beforeLaunch ? run.point : hooked ? blend(carried, side * (kickStep.x - settled.x) > 0 ? kickStep : settled, rise) : slide.point;
  const inKick = kickReadyAt !== null && elapsed >= kickReadyAt;
  const released = kickAt !== null && elapsed >= kickAt;
  const frontKick = inKick ? released ? mix(.62, 1, ease((elapsed - kickAt!) / ARENA_SLIDE_TRIP_TIMING.kickRetract)) : .62 * ease((elapsed - kickReadyAt) / ARENA_SLIDE_TRIP_TIMING.kickWindup) : undefined;
  const stage = beforeLaunch ? 'approach' : !hooked ? 'slide' : hookAge < ARENA_SLIDE_TRIP_TIMING.hook ? 'hook' : fall < 1 ? 'fall' : !inKick ? 'rise' : released ? 'release' : 'kick';
  const kickTarget = initial.kickTarget ?? { x: victim.x - side * 8, y: victim.y - 13 };
  const plannedJumpAt = Math.max(launchAt ?? plannedLaunchAt, plannedHookAt - 200);
  const jumpAt = window.jumpAt === null || launchAt === null ? null : Math.max(launchAt, window.jumpAt ?? plannedJumpAt);
  const passAt = window.passAt === null || jumpAt === null ? null : Math.max(jumpAt, window.passAt ?? plannedHookAt);
  const landingAt = (jumpAt ?? plannedJumpAt) + ARENA_SLIDE_TRIP_JUMP_DURATION;
  const requiredEndAt = Math.max(landingAt + 160, (passAt ?? plannedHookAt) + 80 + ARENA_SLIDE_TRIP_TIMING.rise + 160);
  if (window.evade) {
    const jumping = jumpAt !== null && elapsed >= jumpAt && elapsed < landingAt;
    const jumpPhase = jumpAt === null ? 0 : clamp((elapsed - jumpAt) / ARENA_SLIDE_TRIP_JUMP_DURATION);
    const jumpHeight = 92 * 4 * jumpPhase * (1 - jumpPhase);
    const recoveryAt = (passAt ?? plannedHookAt) + 80;
    const standProgress = ease((elapsed - recoveryAt) / ARENA_SLIDE_TRIP_TIMING.rise);
    const rising = !beforeLaunch && elapsed >= recoveryAt;
    const landed = jumpAt !== null && elapsed >= landingAt;
    const recovered = landed && elapsed >= requiredEndAt;
    const evadeStage: ArenaSlideTripFrame['stage'] = beforeLaunch ? 'approach' : jumping ? elapsed < (passAt ?? plannedHookAt) ? 'jump' : 'pass' : landed ? elapsed < landingAt + 160 ? 'land' : 'recover' : 'slide';
    return {
      active: elapsed >= window.start && !recovered, side, stage: evadeStage,
      driver: canPerform ? beforeLaunch ? run.point : slide.point : { ...initial.driver }, victim: { ...initial.victim },
      driverVelocity: !canPerform ? { x: 0, y: 0 } : beforeLaunch ? run.velocity : slide.velocity, driverFacing: side,
      driverPose: beforeLaunch ? 'run' : rising ? standProgress < 1 ? 'recover' : 'guard' : 'slide', driverPhase: rising ? standProgress : slideProgress,
      slideProgress, driverFootTarget: ankle, footStrength: !beforeLaunch && !rising ? ease(slideProgress / .75) : 0,
      victimPose: jumping ? 'airborne' : landed ? elapsed < landingAt + 160 ? 'land' : 'guard' : 'brace',
      victimAngle: 0, victimSuspension: jumping ? 1 : 0, victimHeight: jumpHeight,
      victimJumpTuck: jumping ? Math.sin(jumpPhase * Math.PI) ** 2 : 0,
      victimPhase: landed ? clamp((elapsed - landingAt) / 160) : jumpPhase,
      launchAt, hookAt: null, kickAt: null, plannedLaunchAt, plannedHookAt, kickReadyAt: null,
      requiredImpactAt: requiredEndAt, canPerform, startingGap,
      canLaunch: canPerform && elapsed >= plannedLaunchAt, canHook: false, canKick: false,
      plannedJumpAt, jumpAt, passAt, landingAt, requiredEndAt,
      canJump: canPerform && !beforeLaunch && jumpAt === null && elapsed >= plannedJumpAt,
      canPass: canPerform && jumping && passAt === null && elapsed >= plannedHookAt,
      recovered,
    };
  }
  return {
    active: elapsed >= window.start && elapsed < window.end, side, stage, driver: canPerform ? driver : { ...initial.driver }, victim,
    driverVelocity: beforeLaunch ? run.velocity : hooked ? { x: contactVelocity.x * (1 - settle) * (1 - rise), y: contactVelocity.y * (1 - settle) * (1 - rise) } : slide.velocity, driverFacing: side,
    driverPose: beforeLaunch ? 'run' : !hooked || fall < 1 ? 'slide' : !inKick ? 'recover' : 'trip', driverPhase: inKick ? frontKick! : fall >= 1 ? rise : slideProgress,
    slideProgress, driverFootTarget: inKick ? kickTarget : ankle, footStrength: inKick ? 1 : !beforeLaunch && !hooked ? ease(slideProgress / .75) : 0, frontKick,
    victimPose: !hooked ? 'brace' : fall < 1 ? 'roll' : 'stunned', victimAngle: side * Math.PI * .47 * fall, victimSuspension: 0,
    victimHeight: 0, victimJumpTuck: 0, victimPhase: fall,
    victimSlam: hooked ? { tuck: .5 * Math.sin(fall * Math.PI), slump: fall } : undefined,
    launchAt, hookAt, kickAt, plannedLaunchAt, plannedHookAt, kickReadyAt,
    requiredImpactAt: kickAt ?? (kickReadyAt ?? plannedHookAt + ARENA_SLIDE_TRIP_TIMING.fall + ARENA_SLIDE_TRIP_TIMING.rise) + ARENA_SLIDE_TRIP_TIMING.kickWindup,
    canLaunch: canPerform && elapsed >= plannedLaunchAt, canHook: canPerform && !beforeLaunch && !hooked && slideProgress >= .6, canKick: canPerform && inKick && !released,
    canPerform, startingGap, plannedJumpAt, jumpAt: null, passAt: null, landingAt, requiredEndAt, canJump: false, canPass: false, recovered: false,
  };
}
