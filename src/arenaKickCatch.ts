import type { ArenaPoint } from './arenaLogic';

export type ArenaKickCatchWindow = {
  start: number; end: number;
  /** null waits for the actual takeoff / two painted palms on the kicking ankle. */
  launchAt?: number | null; catchAt?: number | null;
  plannedLaunchAt?: number;
};
export type ArenaKickCatchOrigins = {
  catcher: ArenaPoint; kicker: ArenaPoint;
  /** The real palm midpoint the kicking foot approaches, before either grip locks. */
  kickTarget?: ArenaPoint; launchOrigin?: ArenaPoint;
  /** Capture these together at first actual ankle contact. Roots remain ground markers. */
  caughtFoot?: ArenaPoint; caughtKicker?: ArenaPoint; caughtCatcher?: ArenaPoint;
  caughtHeight?: number; kickLeg?: 0 | 1;
};
export type ArenaKickCatchFrame = {
  active: boolean; canPerform: boolean;
  stage: 'approach' | 'load' | 'jump' | 'kick' | 'catch' | 'spin' | 'release' | 'land' | 'recover';
  side: 1 | -1; catcher: ArenaPoint; kicker: ArenaPoint; kickerVelocity: ArenaPoint;
  catcherFacing: 1 | -1; kickerFacing: 1 | -1;
  catcherPose: 'guard' | 'grapple' | 'throw'; kickerPose: 'run' | 'guard' | 'sidekick' | 'held' | 'land';
  kickerPhase: number; kickerHeight: number; kickerAngle: number; kickerSuspension: number;
  kickLeg: 0 | 1; footTarget: ArenaPoint; footStrength: number;
  grip: boolean; gripStrength: number; gripTargets: [ArenaPoint, ArenaPoint];
  /** The foot variant anchors one ankle; the body is placed by the painted rig, not a guessed orbit root. */
  spin?: { orbit: number; flatness: number; weight: number; gripLimb: 'feet'; gripFoot: 0 | 1 };
  pivotTurn: number; turn: number; spinProgress: number; releaseVelocity: ArenaPoint;
  plannedLaunchAt: number; launchAt: number | null; catchAt: number | null;
  canLaunch: boolean; canCatch: boolean; landingAt: number; releaseAt: number | null; requiredImpactAt: number;
};

export const ARENA_KICK_CATCH_CHANCE = .01;
/** Physical milliseconds, independent of the scheduled game duration. */
export const ARENA_KICK_CATCH_TIMING = {
  runRamp: 180, plant: 180, air: 650, catchStart: 180, catchEnd: 410,
  load: 220, spin: 1200, spinRamp: .18, land: 180, recover: 180,
} as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const blend = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (point: ArenaPoint, rx = 293, ry = 102) => Math.hypot((point.x - 500) / rx, (point.y - 416) / ry) <= 1;

/** An independent cosmetic choice; the original aggressor and loser never exchange ranks. */
export function arenaKickCatchOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Kick catch roll must be 0–999');
  return roll < 10;
}

function approach(origin: ArenaPoint, goal: ArenaPoint, age: number) {
  const length = distance(origin, goal), cap = 160;
  const ramp = Math.min(ARENA_KICK_CATCH_TIMING.runRamp / 1000, Math.sqrt(length / cap));
  const speed = Math.min(cap, length / Math.max(.001, ramp)), cruise = Math.max(0, length / Math.max(1, speed) - ramp);
  const seconds = Math.max(0, age / 1000), duration = (ramp * 2 + cruise) * 1000;
  let moved: number, velocity: number;
  if (seconds < ramp) { moved = speed * seconds ** 2 / (2 * Math.max(.001, ramp)); velocity = speed * seconds / Math.max(.001, ramp); }
  else if (seconds < ramp + cruise) { moved = speed * ramp / 2 + speed * (seconds - ramp); velocity = speed; }
  else {
    const braking = Math.min(ramp, seconds - ramp - cruise);
    moved = speed * (ramp / 2 + cruise + braking - braking ** 2 / (2 * Math.max(.001, ramp)));
    velocity = speed * (1 - braking / Math.max(.001, ramp));
  }
  const direction = length > .001 ? { x: (goal.x - origin.x) / length, y: (goal.y - origin.y) / length } : { x: 0, y: 0 };
  return { point: blend(origin, goal, clamp(moved / Math.max(.001, length))), duration,
    velocity: { x: direction.x * velocity, y: direction.y * velocity } };
}

/**
 * The drawn loser starts a real sidekick. Only a recorded ankle catch suspends
 * them; a missed catch lands normally. The survivor plants and turns exactly
 * once, keeping angular momentum through release. Actual palms and the caught
 * foot are authoritative; the renderer reuses its fixed limb spin snapshot.
 */
export function arenaKickCatchTargets(window: ArenaKickCatchWindow, elapsed: number, center: ArenaPoint,
  origins?: ArenaKickCatchOrigins, layoutSide = 1): ArenaKickCatchFrame {
  const initial = origins ?? { catcher: { x: center.x - layoutSide * 24, y: center.y }, kicker: { x: center.x + layoutSide * 160, y: center.y } };
  const side = (Math.abs(initial.kicker.x - initial.catcher.x) > 1 ? initial.kicker.x >= initial.catcher.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const gap = side * (initial.kicker.x - initial.catcher.x), runway = Math.max(0, gap - 96);
  const staging = runway > 0 ? { x: initial.catcher.x + side * 96, y: initial.catcher.y } : { ...initial.kicker };
  const landing = { x: initial.catcher.x + side * 52, y: initial.catcher.y };
  const jumpOrigin = initial.launchOrigin ?? staging;
  const canPerform = gap >= 68 && gap <= 330 && Math.abs(initial.kicker.y - initial.catcher.y) <= 48
    && inside(initial.catcher) && inside(initial.kicker, 303, 112) && inside(staging) && inside(jumpOrigin) && inside(landing)
    && side * (jumpOrigin.x - landing.x) >= 16;
  const run = approach(initial.kicker, canPerform ? staging : initial.kicker, elapsed - window.start);
  const plannedLaunchAt = window.plannedLaunchAt ?? window.start + run.duration + ARENA_KICK_CATCH_TIMING.plant;
  const launchAt = !canPerform || window.launchAt === null ? null : window.launchAt === undefined ? plannedLaunchAt : Math.max(window.start, window.launchAt);
  const expectedLaunch = launchAt ?? plannedLaunchAt, airAge = launchAt === null ? -1 : elapsed - launchAt;
  const phase = clamp(airAge / ARENA_KICK_CATCH_TIMING.air), airborne = launchAt !== null && airAge >= 0 && airAge < ARENA_KICK_CATCH_TIMING.air;
  const catchAt = launchAt !== null && window.catchAt != null && window.catchAt >= launchAt && window.catchAt <= launchAt + ARENA_KICK_CATCH_TIMING.air ? window.catchAt : null;
  const caught = catchAt !== null && elapsed >= catchAt;
  const catchPhase = catchAt === null ? .5 : clamp((catchAt - expectedLaunch) / ARENA_KICK_CATCH_TIMING.air);
  const capturedHeight = initial.caughtHeight ?? Math.sin(catchPhase * Math.PI) * 26;
  const capturedKicker = initial.caughtKicker ?? blend(jumpOrigin, landing, ease(catchPhase));
  const catcher = { ...(caught ? initial.caughtCatcher ?? initial.catcher : initial.catcher) };
  const footTarget = { ...(initial.kickTarget ?? { x: initial.catcher.x + side * 18, y: initial.catcher.y - 76 }) };
  const caughtFoot = initial.caughtFoot ?? footTarget;
  const load = catchAt === null ? 0 : ease((elapsed - catchAt) / ARENA_KICK_CATCH_TIMING.load);
  const spinAt = catchAt === null ? Infinity : catchAt + ARENA_KICK_CATCH_TIMING.load;
  const spinProgress = clamp((elapsed - spinAt) / ARENA_KICK_CATCH_TIMING.spin), ramp = ARENA_KICK_CATCH_TIMING.spinRamp;
  const spinDrive = (spinProgress < ramp ? spinProgress ** 2 / (2 * ramp) : spinProgress - ramp / 2) / (1 - ramp / 2);
  const turn = side * Math.PI * 2 * spinDrive, orbit = (side < 0 ? Math.PI : 0) + turn;
  const releaseAt = catchAt === null ? null : spinAt + ARENA_KICK_CATCH_TIMING.spin;
  const released = releaseAt !== null && elapsed >= releaseAt;
  const gripCenter = blend(caughtFoot, { x: catcher.x + Math.cos(orbit) * 18, y: catcher.y - 76 + Math.sin(orbit) * 5 }, load);
  const gripTargets = [-3, 3].map(offset => ({ x: gripCenter.x - Math.sin(orbit) * offset * load, y: gripCenter.y + Math.cos(orbit) * offset * load })) as [ArenaPoint, ArenaPoint];
  const landingAt = expectedLaunch + ARENA_KICK_CATCH_TIMING.air;
  const beforeLaunch = launchAt === null || elapsed < launchAt;
  const stage: ArenaKickCatchFrame['stage'] = caught ? released ? 'release' : elapsed < catchAt! + 80 ? 'catch' : elapsed < spinAt ? 'load' : 'spin'
    : beforeLaunch ? elapsed < plannedLaunchAt - ARENA_KICK_CATCH_TIMING.plant ? 'approach' : 'load'
      : airborne ? airAge < ARENA_KICK_CATCH_TIMING.catchStart ? 'jump' : 'kick'
        : elapsed < landingAt + ARENA_KICK_CATCH_TIMING.land ? 'land' : 'recover';
  const kicker = caught ? { ...capturedKicker } : beforeLaunch ? run.point : blend(jumpOrigin, landing, ease(phase));
  const kickStrength = airborne && !caught ? ease((airAge - 100) / 160) * (1 - ease((airAge - 410) / 240)) : 0;
  const airVelocity = airborne ? 6 * phase * (1 - phase) / (ARENA_KICK_CATCH_TIMING.air / 1000) : 0;
  const angularSpeed = side * Math.PI * 2 / (ARENA_KICK_CATCH_TIMING.spin / 1000 * (1 - ramp / 2));
  return {
    active: canPerform && elapsed >= window.start && (caught ? !released : launchAt === null || elapsed < landingAt + ARENA_KICK_CATCH_TIMING.land + ARENA_KICK_CATCH_TIMING.recover),
    canPerform, stage, side, catcher, kicker, kickerVelocity: caught ? { x: 0, y: 0 } : beforeLaunch ? run.velocity : { x: (landing.x - jumpOrigin.x) * airVelocity, y: (landing.y - jumpOrigin.y) * airVelocity },
    catcherFacing: side, kickerFacing: -side as 1 | -1,
    catcherPose: !caught ? 'guard' : released ? 'throw' : 'grapple', kickerPose: caught ? 'sidekick' : beforeLaunch ? stage === 'approach' ? 'run' : 'guard' : airborne ? 'sidekick' : stage === 'land' ? 'land' : 'guard',
    kickerPhase: caught ? catchPhase : phase, kickerHeight: caught ? capturedHeight : airborne ? Math.sin(phase * Math.PI) * 26 : 0,
    kickerAngle: caught ? side * .24 * Math.sin(catchPhase * Math.PI) * (1 - load) : side * .24 * Math.sin(phase * Math.PI), kickerSuspension: caught ? Math.sin(catchPhase * Math.PI) + (1 - Math.sin(catchPhase * Math.PI)) * load : airborne ? Math.sin(phase * Math.PI) : 0,
    kickLeg: initial.kickLeg ?? 1, footTarget: caught ? { ...caughtFoot } : footTarget, footStrength: caught ? 1 : kickStrength,
    grip: caught && !released, gripStrength: caught && !released ? 1 : 0, gripTargets,
    spin: caught ? { orbit, flatness: .94, weight: load, gripLimb: 'feet', gripFoot: initial.kickLeg ?? 1 } : undefined,
    pivotTurn: turn, turn, spinProgress,
    releaseVelocity: { x: -Math.sin(orbit) * angularSpeed * 84, y: Math.cos(orbit) * angularSpeed * 84 * .26 },
    plannedLaunchAt, launchAt, catchAt, canLaunch: canPerform && elapsed >= plannedLaunchAt,
    canCatch: canPerform && airborne && catchAt === null && airAge >= ARENA_KICK_CATCH_TIMING.catchStart && airAge <= ARENA_KICK_CATCH_TIMING.catchEnd,
    landingAt, releaseAt, requiredImpactAt: releaseAt ?? expectedLaunch + 325 + ARENA_KICK_CATCH_TIMING.load + ARENA_KICK_CATCH_TIMING.spin,
  };
}
