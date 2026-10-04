import type { ArenaPoint } from './arenaLogic';

export type ArenaWrestlingMoveKind = 'clothesline' | 'dropkick' | 'powerbomb' | 'backbodydrop' | 'spinebuster' | 'scoopslam';
export type ArenaWrestlingMoveWindow = {
  kind: ArenaWrestlingMoveKind; start: number; end: number;
  launchAt?: number | null; contactAt?: number | null; releaseAt?: number | null;
  kickAt?: number | null; ankleGripAt?: number | null; dragEndAt?: number;
  plannedLaunchAt?: number; plannedContactAt?: number; counterReadyAt?: number;
};
export type ArenaWrestlingMoveOrigins = {
  driver: ArenaPoint; victim: ArenaPoint; target?: ArenaPoint; contactTargets?: [ArenaPoint, ArenaPoint];
  launchDriver?: ArenaPoint; launchVictim?: ArenaPoint; contactDriver?: ArenaPoint; contactVictim?: ArenaPoint;
  ankles?: [ArenaPoint, ArenaPoint]; ankleDriver?: ArenaPoint; pickupDriver?: ArenaPoint; floorVictim?: ArenaPoint; kickTarget?: ArenaPoint; kickDriver?: ArenaPoint;
  ankleOrbit?: number; ankleFacing?: 1 | -1;
  scoopWaist?: ArenaPoint; scoopFloorWaist?: ArenaPoint; scoopFloorVictim?: ArenaPoint; scoopImpactWaist?: ArenaPoint; scoopHeadImpact?: ArenaPoint;
  powerbombWaist?: ArenaPoint; powerbombFloorWaist?: ArenaPoint; powerbombFloorVictim?: ArenaPoint;
  backBodyWaist?: ArenaPoint; backBodyFloorWaist?: ArenaPoint;
  spineWaist?: ArenaPoint; spineFloorWaist?: ArenaPoint; spineFloorVictim?: ArenaPoint;
};
type Slam = { tuck: number; slump: number };
export type ArenaWrestlingMoveFrame = {
  kind: ArenaWrestlingMoveKind; stage: 'approach' | 'load' | 'attack' | 'contact' | 'lift' | 'turn' | 'spin' | 'fall' | 'land' | 'recover' | 'groggy' | 'ankle-approach' | 'ankle-grip' | 'drag' | 'toss' | 'release';
  active: boolean; side: 1 | -1; canPerform: boolean; missed: boolean; recovered: boolean;
  driver: ArenaPoint; victim: ArenaPoint; driverVelocity: ArenaPoint; victimVelocity: ArenaPoint;
  driverFacing: 1 | -1; victimFacing: 1 | -1;
  driverPose: 'run' | 'guard' | 'grapple' | 'overhead' | 'dropkick' | 'powerbomb' | 'bulldog' | 'backbodydrop' | 'spinebuster' | 'scoopslam' | 'land' | 'recover' | 'trip' | 'drag' | 'throw';
  victimPose: 'run' | 'guard' | 'airborne' | 'roll' | 'stunned' | 'carried' | 'recover';
  driverPhase: number; victimPhase: number; driverHeight: number; victimHeight: number;
  driverAngle: number; victimAngle: number; driverSuspension: number; victimSuspension: number;
  driverJumpTuck: number; victimJumpTuck: number; driverSlam?: Slam; victimSlam?: Slam;
  clotheslineTarget?: ArenaPoint; clotheslineStrength: number; clotheslineInner?: boolean;
  footTargets?: [ArenaPoint, ArenaPoint]; feetStrength: number; dropkickProgress: number;
  gripTargets?: [ArenaPoint, ArenaPoint]; gripStrength: number; gripMode?: 'head' | 'waist' | 'ankle' | 'cradle'; bulldogProgress: number; bulldogHeadlock?: boolean; backBodyProgress: number; backBodyRaise?: number; backBodySupport?: ArenaPoint;
  spinebusterProgress: number; spineLoad: number; spineLift: number; spineDown: number; spineSupport?: ArenaPoint; scoopSlamProgress: number; victimCarryStretch?: number; counterPreparation: number; counterReadyAt: number;
  scoopLoad: number; scoopLift: number; scoopTurn: number; scoopDown: number; scoopRecover?: number; scoopVictim?: boolean; scoopSupport?: ArenaPoint; scoopHeadPivot?: ArenaPoint;
  powerbombLoad: number; powerbombLift: number; powerbombDown: number; powerbombSupport?: ArenaPoint; powerbombVictim?: boolean;
  slamImpact: number; slamImpactAt?: number; victimEyesClosed?: boolean;
  kickAt: number | null; ankleGripAt: number | null; canKick: boolean; canGrabAnkle: boolean;
  frontKick?: number; ankleApproach?: number; ankleThrowProgress?: number; overheadRaise?: number; driverFootTarget?: ArenaPoint; footStrength: number;
  ankleSpin?: { orbit: number; flatness: number; weight: number; gripLimb: 'feet'; gripBoth: true; planar: boolean };
  ankleSpinProgress?: number; ankleAngularVelocity?: number; ankleOrbitVelocity?: number; ankleSpinRaise?: number; pivotTurn?: number; driverYaw?: number;
  dragEndAt?: number; dragGoal?: ArenaPoint; finishSide?: 1 | -1;
  launchAt: number | null; contactAt: number | null; releaseAt: number | null;
  plannedLaunchAt: number; plannedContactAt: number; requiredReleaseAt: number; landingAt: number; floorAt: number; pickupReadyAt: number; requiredEndAt: number;
  canLaunch: boolean; canContact: boolean; canRelease: boolean;
};

export const ARENA_WRESTLING_MOVE_CHANCE = .04;
export const ARENA_WRESTLING_MOVE_TIMING = {
  load: 160, jump: 840, landing: 180, clotheslineFollow: 240, clotheslineFall: 420, groggy: 200,
  bulldogFall: 620, bulldogRecover: 480, backFlip: 1200, slamLift: 420, slamFall: 360, slamKick: 240, ankleReach: 240, ankleThrow: 300,
} as const;
export const ARENA_POWERBOMB_TIMING = { load: 320, lift: 620, hold: 180, slam: 560, recover: 300, groggy: 300, ankleLoad: 520, ankleSpin: 1400, ankleThrow: 0 } as const;
export const ARENA_SCOOP_SLAM_TIMING = { load: 300, lift: 560, turn: 620, slam: 760 } as const;
export const ARENA_SCOOP_RECOVERY_TIMING = { stand: 360, groggy: 240 } as const;
export const ARENA_SCOOP_FINISH_TIMING = { ankleLoad: 520, ankleSpin: 1400, ankleThrow: 0 } as const;
export const ARENA_DRAGGED_ANKLE_THROW_TIMING = { raise: 600, heave: 400 } as const;
export const ARENA_SPINEBUSTER_TIMING = { load: 280, lift: 620, slam: 560, recover: 480, throw: 1000 } as const;
export const ARENA_CLOTHESLINE_FINISH_TIMING = { rise: 480, gripLoad: 160, dragSpeed: 105, throw: 1000 } as const;
export const ARENA_BACK_BODY_DROP_TIMING = { groggy: 520, ankleLoad: 520, ankleSpin: 1150, ankleThrow: 0 } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const blend = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
const curve = (a: ArenaPoint, bend: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => blend(blend(a, bend, p), blend(bend, b, p), p);
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (point: ArenaPoint) => Math.hypot((point.x - 500) / 290, (point.y - 416) / 98) <= 1;
const zero = (): ArenaPoint => ({ x: 0, y: 0 });
const easeVelocity = (age: number, duration: number) => { const p = age / duration; return p > 0 && p < 1 ? 6000 * p * (1 - p) / duration : 0; };

/** The supported waist passes through each key pose without stopping between holds. */
function supportedPath(points: ArenaPoint[], times: number[], age: number): ArenaPoint {
  if (age <= times[0]) return { ...points[0] };
  if (age >= times.at(-1)!) return { ...points.at(-1)! };
  const segment = times.findIndex(time => time > age) - 1, duration = times[segment + 1] - times[segment];
  const p = (age - times[segment]) / duration, p2 = p * p, p3 = p2 * p;
  const tangent = (index: number, coordinate: 'x' | 'y') => index === 0 || index === points.length - 1 ? 0
    : (points[index + 1][coordinate] - points[index - 1][coordinate]) / (times[index + 1] - times[index - 1]);
  const coordinate = (axis: 'x' | 'y') => (2 * p3 - 3 * p2 + 1) * points[segment][axis]
    + (p3 - 2 * p2 + p) * tangent(segment, axis) * duration
    + (-2 * p3 + 3 * p2) * points[segment + 1][axis]
    + (p3 - p2) * tangent(segment + 1, axis) * duration;
  return { x: coordinate('x'), y: coordinate('y') };
}

export function arenaWrestlingMoveOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Wrestling move roll must be 0–999');
  return roll < 40;
}

/** Both ankles stay held while the planted caster lifts and heaves over its back. */
export function arenaAnkleRimThrowTargets(age: number, origins: {
  driver: ArenaPoint; ankles: [ArenaPoint, ArenaPoint]; orbit?: number; facing: 1 | -1; direction: 1 | -1;
}) {
  const timing = ARENA_DRAGGED_ANKLE_THROW_TIMING;
  const raise = ease(age / timing.raise), heaveClock = clamp((age - timing.raise) / timing.heave);
  // The last stroke still has momentum when the hands open.
  const heave = heaveClock * heaveClock * (2 - heaveClock);
  const originalOrbit = origins.orbit ?? (origins.direction === 1 ? Math.PI : 0);
  const downOrbit = originalOrbit + Math.atan2(Math.sin(Math.PI / 2 - originalOrbit), Math.cos(Math.PI / 2 - originalOrbit));
  const exitOrbit = origins.direction === 1 ? 0 : Math.PI;
  const lastTurn = Math.atan2(Math.sin(exitOrbit - downOrbit), Math.cos(exitOrbit - downOrbit));
  const orbit = originalOrbit + (downOrbit - originalOrbit) * raise + lastTurn * heave;
  const midpoint = blend(origins.ankles[0], origins.ankles[1], .5);
  const raised = { x: origins.driver.x + origins.facing * 8, y: origins.driver.y - 132 };
  const backstroke = { x: origins.driver.x + origins.direction * 12, y: origins.driver.y - 115 };
  const support = blend(blend(midpoint, raised, raise), backstroke, heave);
  const angleAt = (phase: number) => Math.atan2(Math.cos(phase), -.45 * Math.sin(phase));
  const difference = Math.atan2(Math.sin(angleAt(orbit) - angleAt(originalOrbit)), Math.cos(angleAt(orbit) - angleAt(originalOrbit))) * raise;
  const axis = { x: origins.ankles[1].x - origins.ankles[0].x, y: origins.ankles[1].y - origins.ankles[0].y };
  const span = { x: (axis.x * Math.cos(difference) - axis.y * Math.sin(difference)) / 2, y: (axis.x * Math.sin(difference) + axis.y * Math.cos(difference)) / 2 };
  const gripTargets: [ArenaPoint, ArenaPoint] = [{ x: support.x - span.x, y: support.y - span.y }, { x: support.x + span.x, y: support.y + span.y }];
  // The caller opens the hands on its first ready frame. Preserve the final
  // heave derivative when that frame samples just beyond the planned end.
  const angularVelocity = age >= timing.raise ? lastTurn * heaveClock * (4 - 3 * heaveClock) / (timing.heave / 1000) : 0;
  return {
    raise, heave, overheadRaise: raise, gripTargets, angularVelocity,
    ankleSpin: { orbit, flatness: 1, weight: raise, gripLimb: 'feet' as const, gripBoth: true as const, planar: false },
    releaseReady: age >= timing.raise + timing.heave,
  };
}

/** Grounded preparation accelerates and brakes before the planted jump or grip. */
function travel(origin: ArenaPoint, goal: ArenaPoint, age: number, cap = 190) {
  const length = distance(origin, goal), ramp = Math.min(.18, Math.sqrt(length / cap));
  const speed = Math.min(cap, length / Math.max(.001, ramp)), cruise = Math.max(0, length / Math.max(1, speed) - ramp), duration = (2 * ramp + cruise) * 1000;
  const t = Math.max(0, age / 1000);
  let moved: number, velocity: number;
  if (t < ramp) { moved = speed * t * t / Math.max(.001, 2 * ramp); velocity = speed * t / Math.max(.001, ramp); }
  else if (t < ramp + cruise) { moved = speed * (ramp / 2 + t - ramp); velocity = speed; }
  else { const b = Math.min(ramp, t - ramp - cruise); moved = speed * (ramp / 2 + cruise + b - b * b / Math.max(.001, 2 * ramp)); velocity = speed * (1 - b / Math.max(.001, ramp)); }
  const direction = length > .001 ? { x: (goal.x - origin.x) / length, y: (goal.y - origin.y) / length } : zero();
  return { point: blend(origin, goal, moved / Math.max(.001, length)), velocity: { x: direction.x * velocity, y: direction.y * velocity }, duration };
}

/** A committed rush keeps its incoming speed until the catcher takes the actual grip. */
function rush(origin: ArenaPoint, goal: ArenaPoint, age: number) {
  const length = distance(origin, goal), ramp = Math.min(.18, Math.sqrt(2 * length / 190));
  const duration = (length / 190 + ramp / 2) * 1000, t = Math.max(0, age / 1000);
  const moved = Math.min(length, t < ramp ? 190 * t * t / Math.max(.001, 2 * ramp) : 190 * (t - ramp / 2));
  const velocity = t * 1000 >= duration ? 0 : 190 * Math.min(1, t / Math.max(.001, ramp));
  const direction = length > .001 ? { x: (goal.x - origin.x) / length, y: (goal.y - origin.y) / length } : zero();
  return { point: blend(origin, goal, moved / Math.max(.001, length)), velocity: { x: direction.x * velocity, y: direction.y * velocity }, duration };
}

/** Contact-gated moves use real roots; an aerial miss always returns to the sand. */
export function arenaWrestlingMoveTargets(window: ArenaWrestlingMoveWindow, elapsed: number, center: ArenaPoint, origins?: ArenaWrestlingMoveOrigins, layoutSide = 1): ArenaWrestlingMoveFrame {
  const kind = window.kind, timing = ARENA_WRESTLING_MOVE_TIMING;
  const dragFinish = kind === 'clothesline' || kind === 'spinebuster';
  const ankleFinish = dragFinish || kind === 'backbodydrop' || kind === 'scoopslam' || kind === 'powerbomb';
  const catching = kind === 'backbodydrop' || kind === 'spinebuster' || kind === 'scoopslam';
  const closeMove = kind === 'powerbomb';
  const ankleSpinFinish = kind === 'backbodydrop' || kind === 'scoopslam' || kind === 'powerbomb';
  const initial = origins ?? {
    driver: { x: center.x - layoutSide * (closeMove ? 30 : catching ? -25 : 180), y: center.y },
    victim: { x: center.x + layoutSide * (closeMove ? 30 : catching ? -200 : 20), y: center.y },
  };
  const side = (Math.abs(initial.victim.x - initial.driver.x) > 1 ? initial.victim.x >= initial.driver.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const gap = distance(initial.driver, initial.victim);
  const closeGap = 24;
  const goal: ArenaPoint = kind === 'dropkick' ? { x: initial.victim.x - side * 144, y: initial.victim.y }
    : closeMove ? { x: Math.abs(initial.victim.x - initial.driver.x) > closeGap ? initial.victim.x - side * closeGap : initial.driver.x, y: initial.victim.y }
    : catching ? { x: initial.driver.x + side * 42, y: initial.driver.y }
    : { x: initial.victim.x - side * 36, y: initial.victim.y };
  const movingOrigin = catching ? initial.victim : initial.driver;
  const run = catching || kind === 'clothesline' ? rush(movingOrigin, goal, elapsed - window.start) : travel(movingOrigin, goal, elapsed - window.start);
  const plannedLaunchAt = window.plannedLaunchAt ?? (kind === 'clothesline' || catching ? window.start + timing.load : window.start + run.duration + timing.load);
  const landingGoal = kind === 'dropkick' ? { x: initial.victim.x - side * 12, y: initial.victim.y } : goal;
  const behind = { x: initial.driver.x - side * 70, y: initial.driver.y };
  const canPerform = inside(initial.driver) && inside(initial.victim) && inside(goal)
    && (closeMove ? inside({ x: initial.victim.x + side * 38, y: initial.victim.y }) : kind === 'dropkick' ? gap >= 170 && inside(landingGoal) : catching ? gap >= 130 && (kind !== 'backbodydrop' || inside(behind)) : gap >= 130 && inside({ x: initial.victim.x + side * 24, y: initial.victim.y }));
  const launchAt = !canPerform || window.launchAt === null ? null : Math.max(window.start, window.launchAt ?? plannedLaunchAt);
  const launch = launchAt ?? plannedLaunchAt;
  const plannedContactAt = window.plannedContactAt === undefined
    ? kind === 'dropkick' ? launch + timing.jump * .67 : closeMove ? launch : launch + run.duration
    : window.plannedContactAt + launch - plannedLaunchAt;
  const contactAt = !canPerform || launchAt === null || window.contactAt === null ? null : Math.max(launchAt, window.contactAt ?? plannedContactAt);
  const contact = contactAt ?? plannedContactAt;
  const runway = distance(initial.launchVictim ?? initial.victim, goal), rushRamp = Math.min(.18, Math.sqrt(2 * runway / 190));
  const halfDistance = runway / 2, rampDistance = 190 * rushRamp / 2;
  const halfRunAt = (halfDistance < rampDistance ? Math.sqrt(2 * halfDistance * rushRamp / 190) : halfDistance / 190 + rushRamp / 2) * 1000;
  const counterReadyAt = window.counterReadyAt === undefined ? launch + halfRunAt : window.counterReadyAt + launch - plannedLaunchAt;
  const scoopTiming = ARENA_SCOOP_SLAM_TIMING, scoopDuration = scoopTiming.load + scoopTiming.lift + scoopTiming.turn + scoopTiming.slam;
  const floorAt = contact + (kind === 'clothesline' ? timing.clotheslineFall : kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING.load + ARENA_POWERBOMB_TIMING.lift + ARENA_POWERBOMB_TIMING.hold + ARENA_POWERBOMB_TIMING.slam : kind === 'backbodydrop' ? timing.backFlip : kind === 'scoopslam' ? scoopDuration : ARENA_SPINEBUSTER_TIMING.load + ARENA_SPINEBUSTER_TIMING.lift + ARENA_SPINEBUSTER_TIMING.slam);
  const pickupReadyAt = floorAt + (kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING.recover + ARENA_POWERBOMB_TIMING.groggy : kind === 'clothesline' ? ARENA_CLOTHESLINE_FINISH_TIMING.rise : kind === 'spinebuster' ? ARENA_SPINEBUSTER_TIMING.recover : kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.groggy : kind === 'scoopslam' ? ARENA_SCOOP_RECOVERY_TIMING.stand + ARENA_SCOOP_RECOVERY_TIMING.groggy : timing.groggy);
  const kickAt = window.kickAt ?? null;
  const ankleGripAt = contactAt === null || window.ankleGripAt === null ? null : Math.max(pickupReadyAt, window.ankleGripAt ?? pickupReadyAt + 240);
  const clotheslineFloor = initial.floorVictim ?? (kind === 'spinebuster' ? initial.spineFloorVictim ?? { x: (initial.contactDriver ?? initial.driver).x - side * 62, y: (initial.contactDriver ?? initial.driver).y } : { x: (initial.contactVictim ?? initial.victim).x + side * 24, y: (initial.contactVictim ?? initial.victim).y });
  const clotheslineHolder = initial.ankleDriver ?? { x: clotheslineFloor.x + side * (kind === 'spinebuster' ? 52 : -118), y: clotheslineFloor.y };
  const dragSide = (kind === 'spinebuster' ? side : -side) as 1 | -1;
  const dragGoal = { x: 500 + dragSide * (303 * Math.sqrt(Math.max(0, 1 - ((clotheslineHolder.y - 416) / 112) ** 2)) - 35), y: clotheslineHolder.y };
  const dragDuration = travel(clotheslineHolder, dragGoal, 0, ARENA_CLOTHESLINE_FINISH_TIMING.dragSpeed).duration;
  const dragStartAt = (ankleGripAt ?? pickupReadyAt + 240) + ARENA_CLOTHESLINE_FINISH_TIMING.gripLoad;
  const dragEndAt = window.dragEndAt ?? dragStartAt + dragDuration;
  const ankleLoad = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.ankleLoad : kind === 'scoopslam' ? ARENA_SCOOP_FINISH_TIMING.ankleLoad : kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING.ankleLoad : 0;
  const ankleThrowDuration = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.ankleThrow : kind === 'scoopslam' ? ARENA_SCOOP_FINISH_TIMING.ankleThrow : kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING.ankleThrow : timing.ankleThrow;
  const dragThrowDuration = kind === 'clothesline' ? ARENA_CLOTHESLINE_FINISH_TIMING.throw : ARENA_SPINEBUSTER_TIMING.throw;
  const spinDuration = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.ankleSpin : kind === 'scoopslam' ? ARENA_SCOOP_FINISH_TIMING.ankleSpin : kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING.ankleSpin : 0;
  const requiredReleaseAt = dragFinish ? dragEndAt + dragThrowDuration : ankleFinish ? (ankleGripAt ?? pickupReadyAt + 240) + ankleLoad + spinDuration + ankleThrowDuration : contact;
  const finishingContact = ankleFinish ? ankleGripAt !== null : true;
  const releaseAt = contactAt === null || !finishingContact || window.releaseAt === null ? null : Math.max(contactAt, window.releaseAt ?? requiredReleaseAt);
  const landingAt = kind === 'dropkick' ? launch + timing.jump : floorAt;
  const requiredEndAt = kind === 'dropkick' ? landingAt + timing.landing
    : requiredReleaseAt + 180;
  const launched = launchAt !== null && elapsed >= launchAt;
  const contacted = contactAt !== null && elapsed >= contactAt;
  const released = releaseAt !== null && elapsed >= releaseAt;
  const target = initial.target ?? { x: initial.victim.x, y: initial.victim.y - (kind === 'dropkick' ? 80 : catching || kind === 'powerbomb' ? 42 : 90) };
  const targets = initial.contactTargets ?? [{ x: target.x, y: target.y - 6 }, { x: target.x, y: target.y + 6 }];
  const frame: ArenaWrestlingMoveFrame = {
    kind, stage: !launched ? elapsed < plannedLaunchAt - timing.load ? 'approach' : 'load' : contacted ? released ? 'release' : 'contact' : 'attack',
    active: elapsed >= window.start && elapsed < Math.max(window.end, requiredEndAt), side, canPerform,
    missed: launched && !contacted && elapsed >= requiredEndAt, recovered: launched && elapsed >= requiredEndAt,
    driver: { ...initial.driver }, victim: { ...initial.victim }, driverVelocity: zero(), victimVelocity: zero(),
    driverFacing: side, victimFacing: side === 1 ? -1 : 1, driverPose: 'guard', victimPose: 'guard', driverPhase: 0, victimPhase: 0,
    driverHeight: 0, victimHeight: 0, driverAngle: 0, victimAngle: 0, driverSuspension: 0, victimSuspension: 0,
    driverJumpTuck: 0, victimJumpTuck: 0, clotheslineStrength: 0, feetStrength: 0, dropkickProgress: 0,
    gripStrength: 0, bulldogProgress: 0, backBodyProgress: 0, spinebusterProgress: 0, spineLoad: 0, spineLift: 0, spineDown: 0, scoopSlamProgress: 0,
    scoopLoad: 0, scoopLift: 0, scoopTurn: 0, scoopDown: 0, powerbombLoad: 0, powerbombLift: 0, powerbombDown: 0, slamImpact: 0, counterPreparation: 0, counterReadyAt,
    kickAt, ankleGripAt, canKick: false, canGrabAnkle: false, footStrength: 0,
    launchAt, contactAt, releaseAt, plannedLaunchAt, plannedContactAt, requiredReleaseAt, landingAt, floorAt, pickupReadyAt, requiredEndAt,
    canLaunch: canPerform && elapsed >= plannedLaunchAt, canContact: launched && !contacted && elapsed >= plannedContactAt - 120 && elapsed < requiredEndAt,
    canRelease: contacted && finishingContact && !released && elapsed >= requiredReleaseAt,
  };
  if (!canPerform) return frame;
  const finishAnkles = () => {
    if (!contacted || elapsed < floorAt) return frame;
    if (elapsed < pickupReadyAt) { frame.stage = kind === 'scoopslam' && (frame.scoopRecover ?? 1) < 1 ? 'recover' : 'groggy'; return frame; }
    const floorSide = Math.sin(frame.victimAngle) < 0 ? -1 : 1;
    if (initial.floorVictim) frame.victim = { ...initial.floorVictim };
    const ankles = initial.ankles ?? [{ x: frame.victim.x - floorSide * 84, y: frame.victim.y - 4 }, { x: frame.victim.x - floorSide * 86, y: frame.victim.y - 13 }];
    const midpoint = blend(ankles[0], ankles[1], .5), ankleGoal = initial.ankleDriver ?? { x: midpoint.x + floorSide * 32, y: frame.victim.y };
    const approach = travel(initial.pickupDriver ?? frame.driver, ankleGoal, elapsed - pickupReadyAt, 160);
    frame.driver = ankleGripAt !== null && elapsed >= ankleGripAt ? { ...(initial.ankleDriver ?? approach.point) } : approach.point;
    frame.driverVelocity = ankleGripAt !== null && elapsed >= ankleGripAt ? zero() : approach.velocity;
    frame.driverFacing = ankleSpinFinish && initial.ankleFacing !== undefined ? initial.ankleFacing : midpoint.x >= frame.driver.x ? 1 : -1;
    const gripAge = ankleGripAt === null ? -1 : elapsed - ankleGripAt;
    const tossing = gripAge >= ankleLoad;
    frame.driverPose = ankleGripAt !== null && tossing ? 'throw' : 'drag';
    frame.driverAngle = 0; frame.driverSlam = undefined;
    frame.gripTargets = ankles; frame.gripMode = 'ankle'; frame.gripStrength = 1;
    frame.ankleApproach = kind === 'scoopslam' || kind === 'backbodydrop' || kind === 'powerbomb' ? ease((elapsed - pickupReadyAt) / timing.ankleReach) : undefined;
    frame.canGrabAnkle = ankleGripAt === null && (frame.ankleApproach === undefined || frame.ankleApproach === 1);
    frame.canRelease = ankleGripAt !== null && elapsed >= requiredReleaseAt && !released;
    if (ankleSpinFinish && ankleGripAt !== null && elapsed >= ankleGripAt) {
      const load = ease(gripAge / ankleLoad), progress = clamp((gripAge - ankleLoad) / spinDuration), ramp = .18;
      const drive = (progress < ramp ? progress * progress / (2 * ramp) : progress - ramp / 2) / (1 - ramp / 2);
      const turn = frame.driverFacing * Math.PI * 2 * drive;
      // Use the wrist-spin's horizontal orbit, with the feet as its anchor.
      // This depth projection circles the body around the planted caster
      // rather than turning it as a vertical wheel. Its quarter-phase release
      // gives the real mass a horizontal tangent at the end of one full turn.
      const orbit = -Math.PI / 2 + turn;
      const radial = { x: Math.cos(orbit), y: .30 + Math.sin(orbit) * .10 };
      const targetAngle = Math.atan2(-radial.x, radial.y);
      const angle = frame.victimAngle + Math.atan2(Math.sin(targetAngle - frame.victimAngle), Math.cos(targetAngle - frame.victimAngle)) * load;
      const width = mix(1, .42 + Math.abs(Math.sin(orbit)) * .58, load);
      const raised = { x: frame.driver.x + Math.cos(orbit) * 18, y: frame.driver.y - 76 + Math.sin(orbit) * 5 };
      const center = blend(midpoint, raised, load);
      const halfSpan = mix(distance(ankles[0], ankles[1]) / 2, 9 * 2.04 / 2, load);
      const axis = { x: Math.cos(angle) * frame.victimFacing * width, y: Math.sin(angle) * frame.victimFacing * width };
      frame.gripTargets = [-1, 1].map(direction => ({ x: center.x + axis.x * halfSpan * direction, y: center.y + axis.y * halfSpan * direction })) as [ArenaPoint, ArenaPoint];
      frame.ankleSpin = { orbit, flatness: 1, weight: load, gripLimb: 'feet', gripBoth: true, planar: true };
      frame.ankleSpinProgress = progress; frame.pivotTurn = turn; frame.driverYaw = turn;
      frame.ankleAngularVelocity = gripAge >= ankleLoad ? frame.driverFacing * Math.PI * 2 / (spinDuration / 1000) * Math.min(1, progress / ramp) / (1 - ramp / 2) : 0;
      frame.ankleOrbitVelocity = frame.ankleAngularVelocity;
      frame.ankleSpinRaise = undefined;
      frame.driverPose = 'grapple'; frame.driverPhase = load; frame.ankleThrowProgress = load;
      frame.victimPose = 'stunned'; frame.victimSlam = { tuck: 0, slump: 1 }; frame.victimHeight = 0;
      frame.victimCarryStretch = undefined;
      frame.stage = released ? 'release' : gripAge < ankleLoad ? 'ankle-grip' : progress < .78 ? 'spin' : 'toss';
      return frame;
    }
    frame.stage = released ? 'release' : ankleGripAt === null ? 'ankle-approach' : gripAge < Math.max(80, ankleLoad) ? 'ankle-grip' : 'toss';
    frame.driverPhase = ankleGripAt !== null ? clamp((gripAge - ankleLoad) / ankleThrowDuration) : clamp((elapsed - pickupReadyAt) / Math.max(1, approach.duration));
    frame.ankleThrowProgress = ankleGripAt !== null && tossing ? frame.driverPhase : undefined;
    if (ankleGripAt !== null && tossing) {
      const toss = ease((gripAge - ankleLoad) / ankleThrowDuration);
      frame.victim.x -= floorSide * 48.96 * toss;
      frame.victimHeight = 34 * toss; frame.victimAngle += floorSide * Math.PI * .13 * toss;
      frame.victimSuspension = toss; frame.victimCarryStretch = kind === 'scoopslam' ? 1 : toss; frame.victimPose = 'carried';
      frame.victimSlam = { tuck: 0, slump: 1 - toss };
    }
    return frame;
  };
  const finishDraggedAnkles = () => {
    if (!contacted || elapsed < pickupReadyAt) return frame;
    const floorSide = frame.victimAngle < 0 ? -1 : 1;
    const ankles = initial.ankles ?? [{ x: clotheslineFloor.x - floorSide * 84, y: clotheslineFloor.y - 4 }, { x: clotheslineFloor.x - floorSide * 86, y: clotheslineFloor.y - 13 }];
    const midpoint = blend(ankles[0], ankles[1], .5), ankleGoal = initial.ankleDriver ?? { x: midpoint.x - side * 32, y: clotheslineFloor.y };
    const approach = travel(initial.pickupDriver ?? frame.driver, ankleGoal, elapsed - pickupReadyAt, 160);
    const gripped = ankleGripAt !== null && elapsed >= ankleGripAt;
    const drag = travel(clotheslineHolder, dragGoal, gripped ? elapsed - dragStartAt : 0, ARENA_CLOTHESLINE_FINISH_TIMING.dragSpeed);
    const displacement = gripped ? { x: drag.point.x - clotheslineHolder.x, y: drag.point.y - clotheslineHolder.y } : zero();
    frame.victim = { x: clotheslineFloor.x + displacement.x, y: clotheslineFloor.y + displacement.y };
    frame.driver = gripped ? drag.point : approach.point; frame.driverVelocity = gripped ? drag.velocity : approach.velocity;
    frame.driverPose = gripped && elapsed >= dragEndAt ? 'overhead' : 'drag';
    frame.driverFacing = kind === 'spinebuster' ? -side as 1 | -1 : side; frame.driverAngle = 0; frame.driverSlam = undefined;
    frame.victimSlam = { tuck: 0, slump: 1 }; frame.victimPose = 'stunned';
    frame.gripTargets = ankles.map(point => ({ x: point.x + displacement.x, y: point.y + displacement.y })) as [ArenaPoint, ArenaPoint];
    frame.gripMode = 'ankle'; frame.gripStrength = 1;
    frame.ankleApproach = ease((elapsed - pickupReadyAt) / timing.ankleReach);
    frame.canGrabAnkle = !gripped && frame.ankleApproach === 1;
    frame.dragEndAt = dragEndAt; frame.dragGoal = dragGoal; frame.finishSide = dragSide;
    frame.driverPhase = gripped && elapsed >= dragEndAt ? clamp((elapsed - dragEndAt) / dragThrowDuration) : frame.ankleApproach;
    frame.stage = released ? 'release' : !gripped ? 'ankle-approach' : elapsed < dragStartAt ? 'ankle-grip' : elapsed < dragEndAt ? 'drag' : 'toss';
    frame.canRelease = gripped && elapsed >= requiredReleaseAt && !released;
    if (gripped && elapsed >= dragEndAt) {
      const throwFrame = arenaAnkleRimThrowTargets(elapsed - dragEndAt, { driver: frame.driver, ankles: frame.gripTargets!, orbit: initial.ankleOrbit, facing: frame.driverFacing, direction: dragSide });
      frame.gripTargets = throwFrame.gripTargets; frame.ankleSpin = throwFrame.ankleSpin;
      frame.ankleAngularVelocity = throwFrame.angularVelocity;
      frame.overheadRaise = throwFrame.overheadRaise;
      frame.ankleThrowProgress = frame.driverPhase;
      frame.victimHeight = 92 * throwFrame.raise + 24 * throwFrame.heave;
      frame.victimSuspension = throwFrame.raise; frame.victimCarryStretch = throwFrame.raise; frame.victimPose = 'carried';
      frame.victimSlam = { tuck: 0, slump: 1 - throwFrame.raise };
    }
    return frame;
  };
  if (kind === 'clothesline') {
    const entry = rush(initial.launchDriver ?? initial.driver, goal, launched ? elapsed - launch : 0);
    const base = contacted ? initial.contactDriver ?? goal : entry.point;
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const fall = ease(age / timing.clotheslineFall), rise = ease((age - timing.clotheslineFall) / ARENA_CLOTHESLINE_FINISH_TIMING.rise);
    frame.driver = { x: base.x + side * 24 * fall, y: base.y };
    frame.driverVelocity = contacted ? zero() : entry.velocity;
    frame.driverPose = contacted ? age < timing.clotheslineFall ? 'bulldog' : rise < 1 ? 'recover' : 'guard' : launched ? 'run' : 'guard';
    frame.driverPhase = contacted ? age < timing.clotheslineFall ? fall : rise : clamp((elapsed - launch) / Math.max(1, run.duration));
    frame.clotheslineTarget = { ...target }; frame.clotheslineInner = true;
    frame.clotheslineStrength = launched ? contacted ? 1 - ease(age / 100) : ease((frame.driverPhase - .55) / .3) : 0;
    frame.canContact = frame.canContact && elapsed - launch >= 320;
    if (contacted) {
      const victimOrigin = initial.contactVictim ?? initial.victim;
      frame.victim = { x: victimOrigin.x + side * 24 * fall, y: victimOrigin.y };
      frame.victimAngle = side * Math.PI * .47 * fall;
      frame.victimPose = fall === 0 ? 'guard' : fall < 1 ? 'roll' : 'stunned';
      frame.victimPhase = fall; frame.bulldogProgress = fall;
      frame.victimSlam = fall > 0 ? { tuck: .2 * Math.sin(fall * Math.PI), slump: fall } : undefined;
      frame.driverAngle = side * Math.PI * .47 * fall * (1 - rise);
      frame.driverSlam = rise < 1 ? { tuck: .2 * Math.sin(fall * Math.PI) * (1 - rise), slump: fall * (1 - rise) } : undefined;
      frame.stage = fall < 1 ? 'fall' : rise < 1 ? 'recover' : 'groggy';
    }
    return finishDraggedAnkles();
  }
  if (kind === 'dropkick') {
    const p = launched ? clamp((elapsed - launch) / timing.jump) : 0;
    const origin = initial.launchDriver ?? goal;
    frame.driver = launched ? blend(origin, landingGoal, ease(p)) : run.point;
    frame.driverVelocity = launched ? { x: (landingGoal.x - origin.x) * 6 * p * (1 - p) / (timing.jump / 1000), y: (landingGoal.y - origin.y) * 6 * p * (1 - p) / (timing.jump / 1000) } : run.velocity;
    frame.driverHeight = 54 * 4 * p * (1 - p);
    frame.driverAngle = -side * Math.PI * .48 * ease(p / .32) * (1 - ease((p - .72) / .28));
    frame.driverPose = !launched ? elapsed < plannedLaunchAt - timing.load ? 'run' : 'guard' : elapsed < landingAt ? 'dropkick' : elapsed < requiredEndAt ? 'land' : 'guard';
    frame.driverPhase = elapsed < landingAt ? p : clamp((elapsed - landingAt) / timing.landing);
    frame.driverSuspension = launched && elapsed < landingAt ? 1 : 0;
    frame.dropkickProgress = p; frame.footTargets = targets;
    frame.feetStrength = launched && elapsed < landingAt ? ease((p - .18) / .2) * (1 - ease((p - .72) / .28)) : 0;
    frame.canContact = launched && !contacted && p >= .38 && p < .72;
    if (elapsed >= landingAt && launched) frame.stage = elapsed < requiredEndAt ? 'land' : 'recover';
    return frame;
  }
  if (kind === 'powerbomb') {
    const power = ARENA_POWERBOMB_TIMING, age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const load = contacted ? ease(age / power.load) : 0;
    const lift = contacted ? ease((age - power.load) / power.lift) : 0;
    const down = contacted ? ease((age - power.load - power.lift - power.hold) / power.slam) : 0;
    const rise = contacted ? ease((elapsed - floorAt) / power.recover) : 0;
    const driverOrigin = initial.contactDriver ?? goal, victimOrigin = initial.contactVictim ?? initial.victim;
    const floorRoot = initial.powerbombFloorVictim ?? { x: driverOrigin.x + side * 62, y: victimOrigin.y };
    frame.driver = contacted ? { ...driverOrigin } : run.point;
    frame.victim = contacted ? blend(victimOrigin, floorRoot, down) : { ...initial.victim };
    frame.driverVelocity = contacted ? zero() : run.velocity;
    frame.driverPose = !launched ? elapsed < plannedLaunchAt - timing.load ? 'run' : 'guard' : contacted && elapsed >= floorAt ? rise < 1 ? 'recover' : 'guard' : 'powerbomb';
    frame.victimPose = !contacted || age === 0 ? 'guard' : down === 1 ? 'stunned' : 'carried';
    frame.driverPhase = contacted ? age < power.load + power.lift + power.hold + power.slam ? clamp(age / (power.load + power.lift + power.hold + power.slam)) : rise : 0;
    frame.victimPhase = down; frame.powerbombLoad = load; frame.powerbombLift = lift; frame.powerbombDown = down;
    frame.powerbombVictim = contacted && age > 0 && elapsed < floorAt;
    frame.victimHeight = 116 * lift * (1 - down); frame.victimAngle = side * Math.PI * .47 * down;
    frame.victimSuspension = lift * (1 - down);
    if (contacted && age > 0 && elapsed < floorAt) frame.victimCarryStretch = Math.max(load, lift) * (1 - down);
    if (down > 0) frame.victimSlam = { tuck: .15 * Math.sin(down * Math.PI), slump: down };
    frame.victimEyesClosed = contacted && elapsed >= floorAt;
    frame.slamImpactAt = floorAt;
    const impactAge = elapsed - floorAt;
    frame.slamImpact = contacted ? ease(impactAge / 28) * (1 - ease((impactAge - 110) / 570)) : 0;
    if (contacted) {
      const start = initial.powerbombWaist ?? { x: victimOrigin.x, y: victimOrigin.y - 42 };
      const gathered = { x: driverOrigin.x + side * 16, y: driverOrigin.y - 45 };
      const raised = { x: driverOrigin.x + side * 10, y: driverOrigin.y - 140 };
      const floor = initial.powerbombFloorWaist ?? { x: floorRoot.x + side * 25, y: floorRoot.y - 19 };
      const lifted = curve(gathered, { x: driverOrigin.x + side * 8, y: driverOrigin.y - 84 }, raised, lift);
      const dropped = curve(raised, { x: driverOrigin.x + side * 46, y: driverOrigin.y - 82 }, floor, down);
      frame.powerbombSupport = { x: start.x + (gathered.x - start.x) * load + lifted.x - gathered.x + dropped.x - raised.x, y: start.y + (gathered.y - start.y) * load + lifted.y - gathered.y + dropped.y - raised.y };
    }
    frame.gripTargets = targets; frame.gripMode = 'waist';
    frame.gripStrength = launched ? contacted ? 1 - ease((down - .45) / .40) : ease((elapsed - launch) / timing.load) : 0;
    frame.canContact = frame.canContact && frame.gripStrength > .95;
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : age < power.load ? 'contact' : lift < 1 ? 'lift' : age < power.load + power.lift + power.hold ? 'turn' : down < 1 ? 'fall' : rise < 1 ? 'recover' : 'groggy';
    return finishAnkles();
  }
  if (kind === 'scoopslam') {
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const liftStart = scoopTiming.load * .7, turnStart = scoopTiming.load + scoopTiming.lift * .8;
    const downStart = scoopTiming.load + scoopTiming.lift + scoopTiming.turn * .9;
    const load = ease(age / scoopTiming.load), lift = ease((age - liftStart) / (scoopTiming.load + scoopTiming.lift - liftStart));
    const turn = ease((age - turnStart) / (scoopTiming.load + scoopTiming.lift + scoopTiming.turn - turnStart));
    const downDuration = scoopDuration - downStart, downClock = clamp((age - downStart) / downDuration);
    const down = ease(downClock), recover = contacted ? ease((elapsed - floorAt) / ARENA_SCOOP_RECOVERY_TIMING.stand) : 0;
    const victimOrigin = initial.contactVictim ?? goal, driverOrigin = initial.contactDriver ?? initial.driver;
    const runner = rush(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0);
    const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
    const preparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
    frame.counterPreparation = preparation;
    const floorRoot = initial.scoopFloorVictim ?? { x: driverOrigin.x + side * 62, y: victimOrigin.y };
    // Receiving feet step into the incoming weight; the hips then carry both
    // bodies through the pivot and follow the back onto the floor.
    frame.driver = { x: driverOrigin.x + side * (8 * load + 8 * turn + 24 * down), y: driverOrigin.y };
    frame.driverVelocity = contacted ? { x: side * (8 * easeVelocity(age, scoopTiming.load)
      + 8 * easeVelocity(age - turnStart, scoopTiming.load + scoopTiming.lift + scoopTiming.turn - turnStart)
      + 24 * easeVelocity(age - downStart, downDuration)), y: 0 } : zero();
    frame.victim = contacted ? blend(victimOrigin, floorRoot, down) : runner.point;
    frame.victimVelocity = contacted ? zero() : runner.velocity;
    frame.driverPose = contacted ? recover === 1 ? 'guard' : 'scoopslam' : preparation > 0 ? 'scoopslam' : 'guard';
    frame.victimPose = !contacted || age === 0 ? launched ? 'run' : 'guard' : down === 1 ? 'stunned' : 'carried';
    frame.driverPhase = contacted ? clamp(age / scoopDuration) : 0;
    frame.victimPhase = down; frame.scoopSlamProgress = frame.driverPhase;
    frame.scoopLoad = load; frame.scoopLift = lift; frame.scoopTurn = turn; frame.scoopDown = down;
    frame.scoopRecover = recover; frame.scoopVictim = contacted && age > 0;
    frame.driverYaw = side * .45 * Math.sin(turn * Math.PI) * (1 - down);
    frame.victimHeight = 56 * lift * (1 - down);
    // The chest and thigh remain cradled beside the hip. This quarter turn
    // lands the complete back rather than inverting onto a lone head pivot.
    frame.victimAngle = side * Math.PI * (.12 * load + .18 * lift + .18 * turn + .02 * down);
    frame.victimSuspension = lift * (1 - down);
    if (contacted && age > 0 && elapsed < floorAt) frame.victimCarryStretch = load;
    frame.victimSlam = contacted && down > 0 ? { tuck: .12 * Math.sin(down * Math.PI), slump: down } : undefined;
    frame.slamImpactAt = floorAt;
    const impactAge = elapsed - frame.slamImpactAt;
    frame.slamImpact = contacted ? ease(impactAge / 28) * (1 - ease((impactAge - 110) / 570)) : 0;
    frame.victimEyesClosed = contacted && elapsed >= frame.slamImpactAt;
    if (contacted) {
      const start = initial.scoopWaist ?? { x: victimOrigin.x, y: victimOrigin.y - 40 };
      const gathered = { x: driverOrigin.x + side * 16, y: driverOrigin.y - 48 };
      const raised = { x: driverOrigin.x + side * 12, y: driverOrigin.y - 72 };
      const turned = { x: driverOrigin.x + side * 38, y: driverOrigin.y - 62 };
      const floor = initial.scoopFloorWaist ?? { x: floorRoot.x + side * 25, y: floorRoot.y - 19 };
      frame.scoopSupport = supportedPath([start, gathered, raised, turned, floor],
        [0, scoopTiming.load, scoopTiming.load + scoopTiming.lift, scoopTiming.load + scoopTiming.lift + scoopTiming.turn, scoopDuration], age);
    }
    frame.gripTargets = targets; frame.gripMode = 'cradle';
    frame.gripStrength = launched ? contacted ? 1 - ease((downClock - .82) / .18) : preparation : 0;
    frame.canContact = frame.canContact && frame.gripStrength > .95;
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : age < scoopTiming.load ? 'contact'
      : lift < 1 ? 'lift' : turn < 1 ? 'turn' : down < 1 ? 'fall' : recover < 1 ? 'recover' : 'groggy';
    return finishAnkles();
  }
  if (kind === 'spinebuster') {
    const runner = catching ? rush(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0) : run;
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const spineTiming = ARENA_SPINEBUSTER_TIMING;
    const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
    const preparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
    const load = contacted ? mix(preparation * .45, 1, ease(age / spineTiming.load)) : preparation * .45;
    const lift = contacted ? ease((age - spineTiming.load) / spineTiming.lift) : 0;
    const slamClock = contacted ? clamp((age - spineTiming.load - spineTiming.lift) / spineTiming.slam) : 0;
    const slam = ease(slamClock ** 1.45);
    const rise = contacted ? ease((elapsed - floorAt) / spineTiming.recover) : 0;
    const victimOrigin = initial.contactVictim ?? (catching ? goal : initial.victim);
    const driverOrigin = initial.contactDriver ?? (catching ? initial.driver : goal);
    const floorRoot = initial.spineFloorVictim ?? { x: driverOrigin.x - side * 62, y: victimOrigin.y };
    frame.driver = catching ? { x: driverOrigin.x + (contacted ? side * 12 * lift - side * 22 * slam : 0), y: driverOrigin.y } : contacted ? { ...driverOrigin } : run.point;
    frame.victim = contacted ? blend(victimOrigin, floorRoot, slam) : runner.point;
    frame.driverVelocity = !catching && !contacted ? run.velocity : zero(); frame.victimVelocity = catching && !contacted ? runner.velocity : zero();
    frame.driverPose = contacted && elapsed >= floorAt ? 'recover' : contacted || preparation > 0 ? kind : 'guard';
    frame.victimPose = contacted ? slam === 1 ? 'stunned' : age < spineTiming.load ? 'guard' : 'carried' : catching && launched ? 'run' : 'guard';
    frame.driverPhase = elapsed >= floorAt && contacted ? rise : load * .25 + lift * .4 + slam * .35;
    frame.victimPhase = slam; frame.spinebusterProgress = frame.driverPhase;
    frame.spineLoad = load; frame.spineLift = lift; frame.spineDown = slam; frame.counterPreparation = preparation;
    frame.victimHeight = 72 * lift * (1 - slam);
    frame.driverAngle = -side * Math.PI * .47 * slam * (1 - rise);
    frame.driverSuspension = slam * (1 - rise);
    if (contacted && slam > 0) frame.driverSlam = { tuck: .16 * Math.sin(slam * Math.PI) * (1 - rise), slump: slam * (1 - rise) };
    frame.victimAngle = -side * Math.PI * (.53 * slam + .23 * Math.sin(slam * Math.PI));
    frame.victimSuspension = lift * (1 - slam);
    if (contacted && age >= spineTiming.load && slam < 1) frame.victimCarryStretch = lift;
    frame.victimSlam = contacted && slam > 0 ? { tuck: .2 * Math.sin(slam * Math.PI), slump: slam } : undefined;
    frame.victimEyesClosed = contacted && elapsed >= floorAt;
    frame.slamImpactAt = floorAt;
    const impactAge = elapsed - floorAt;
    frame.slamImpact = contacted ? ease(impactAge / 28) * (1 - ease((impactAge - 110) / 570)) : 0;
    if (contacted) {
      const start = initial.spineWaist ?? { x: victimOrigin.x, y: victimOrigin.y - 42 };
      const raised = { x: start.x - side * 12, y: start.y - 72 };
      const floor = initial.spineFloorWaist ?? { x: floorRoot.x - side * 25, y: floorRoot.y - 19 };
      frame.spineSupport = slam === 0 ? blend(start, raised, lift)
        : curve(raised, { x: driverOrigin.x - side * 38, y: driverOrigin.y - 79 }, floor, slam);
    }
    const offset = { x: target.x - initial.victim.x, y: target.y - initial.victim.y };
    frame.gripTargets = [{ x: frame.victim.x + offset.x, y: frame.victim.y - frame.victimHeight + offset.y }, { x: frame.victim.x + offset.x + side * 8, y: frame.victim.y - frame.victimHeight + offset.y + 3 }];
    // The receiver releases once both bodies have turned behind its hips.
    // Holding the waist while it crosses the falling shoulder would twist
    // the forearm around its inner joint pole before the floor impact.
    frame.gripMode = 'waist'; frame.gripStrength = contacted ? 1 - ease((slamClock - .30) / .55) : preparation;
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : age < spineTiming.load ? 'contact' : lift < 1 ? 'lift' : slam < 1 ? 'fall' : rise < 1 ? 'recover' : 'groggy';
    return finishDraggedAnkles();
  }
  const runner = rush(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0);
  const flip = contacted ? clamp((elapsed - contactAt!) / timing.backFlip) : 0;
  const raise = ease(flip / .42), over = ease((flip - .34) / .66), descend = ease((flip - .50) / .50);
  const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
  const counterPreparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
  const victimOrigin = initial.contactVictim ?? goal;
  frame.victim = contacted ? blend(victimOrigin, behind, over) : runner.point;
  frame.victimVelocity = contacted ? zero() : runner.velocity;
  frame.counterPreparation = counterPreparation;
  frame.driverPose = counterPreparation > 0 || contacted ? 'backbodydrop' : 'guard'; frame.victimPose = contacted && flip > 0 ? 'airborne' : launched ? 'run' : 'guard';
  frame.driverPhase = flip; frame.victimPhase = flip; frame.backBodyProgress = launched ? .1 * counterPreparation + (1 - .1 * counterPreparation) * flip : 0;
  frame.backBodyRaise = contacted ? raise * (1 - descend) : 0;
  frame.victimHeight = contacted && flip < 1 ? 116 * raise * (1 - descend) : 0;
  frame.victimAngle = -side * Math.PI * .53 * over;
  frame.victimSuspension = contacted ? ease(flip / .20) * (1 - ease((flip - .75) / .25)) : 0; frame.victimJumpTuck = contacted ? Math.sin(Math.PI * flip) ** 2 * .65 : 0;
  if (contacted && flip > .6) frame.victimSlam = { tuck: .2 * Math.sin(Math.PI * clamp((flip - .6) / .4)), slump: ease((flip - .6) / .4) };
  if (contacted && flip === 1) frame.victimPose = 'stunned';
  const offset = { x: target.x - initial.victim.x, y: target.y - initial.victim.y };
  frame.gripTargets = [{ x: frame.victim.x + offset.x, y: frame.victim.y + offset.y }, { x: frame.victim.x + offset.x + side * 8, y: frame.victim.y + offset.y + 3 }];
  frame.gripStrength = launched ? ease(counterPreparation / .60) * (1 - ease((flip - .50) / .14)) : 0; frame.gripMode = 'waist';
  if (contacted) {
    const start = initial.backBodyWaist ?? { x: victimOrigin.x + target.x - initial.victim.x, y: victimOrigin.y + target.y - initial.victim.y };
    const above = { x: initial.driver.x, y: initial.driver.y - 146 };
    const floor = initial.backBodyFloorWaist ?? { x: behind.x - side * 25, y: behind.y - 19 };
    const lifting = curve(start, { x: initial.driver.x + side * 10, y: initial.driver.y - 100 }, above, raise);
    const falling = curve(above, { x: initial.driver.x - side * 38, y: initial.driver.y - 130 }, floor, descend);
    frame.backBodySupport = { x: lifting.x + falling.x - above.x, y: lifting.y + falling.y - above.y };
  }
  frame.canContact = launched && !contacted && counterPreparation >= .60 && elapsed >= plannedContactAt - 120;
  frame.stage = !contacted && counterPreparation === 0 ? 'approach' : !launched ? frame.stage : !contacted ? 'attack' : flip < .5 ? 'lift' : flip < 1 ? 'fall' : 'groggy';
  return finishAnkles();
}
