import type { ArenaPoint } from './arenaLogic';
import { ARENA_CHARGE_SPEED, arenaChargeDuration, arenaChargePath } from './arenaCharge';
import { arenaAnkleSwingProjection, arenaAnkleSwingCasterProjection } from './arenaAnkleSwing';
import { arenaOverheadSlamMotion } from './arenaOverheadSlam';
export { arenaAnkleSwingProjection } from './arenaAnkleSwing';

export type ArenaWrestlingMoveKind = 'clothesline' | 'dropkick' | 'powerbomb' | 'backbodydrop' | 'spinebuster' | 'scoopslam';
/** The survivor receives the other player's rush rather than running the slam in. */
export const arenaWrestlingMoveIsCounter = (kind: ArenaWrestlingMoveKind) => kind === 'powerbomb' || kind === 'backbodydrop' || kind === 'spinebuster' || kind === 'scoopslam';
export type ArenaWrestlingMoveWindow = {
  kind: ArenaWrestlingMoveKind; start: number; end: number;
  /** A rare defender ducks under the single extended-arm rush. */
  duck?: boolean;
  launchAt?: number | null; contactAt?: number | null; releaseAt?: number | null;
  kickAt?: number | null; ankleGripAt?: number | null; dragEndAt?: number;
  plannedLaunchAt?: number; plannedContactAt?: number; counterReadyAt?: number;
};
export type ArenaWrestlingMoveOrigins = {
  driver: ArenaPoint; victim: ArenaPoint; target?: ArenaPoint; contactTargets?: [ArenaPoint, ArenaPoint];
  launchDriver?: ArenaPoint; launchVictim?: ArenaPoint; contactDriver?: ArenaPoint; contactVictim?: ArenaPoint; contactDriverVelocity?: ArenaPoint;
  contactDriverHeight?: number; contactDriverAngle?: number; contactFlightProgress?: number;
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
  driverPose: 'run' | 'walk' | 'guard' | 'grapple' | 'overhead' | 'dropkick' | 'powerbomb' | 'bulldog' | 'backbodydrop' | 'spinebuster' | 'scoopslam' | 'land' | 'recover' | 'trip' | 'drag' | 'throw';
  victimPose: 'run' | 'guard' | 'brace' | 'airborne' | 'roll' | 'stunned' | 'carried' | 'recover';
  driverPhase: number; victimPhase: number; driverHeight: number; victimHeight: number;
  driverAngle: number; victimAngle: number; driverSuspension: number; victimSuspension: number;
  driverJumpTuck: number; victimJumpTuck: number; driverSlam?: Slam; victimSlam?: Slam;
  clotheslineTarget?: ArenaPoint; clotheslineArm?: 0 | 1; clotheslineStrength: number; clotheslineInner?: boolean; victimDuck: number;
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
export const ARENA_CLOTHESLINE_JUMP_TIMING = { flight: 640, height: 14, contact: 320 } as const;
export const ARENA_CLOTHESLINE_DUCK_CHANCE = .005;
export const ARENA_CLOTHESLINE_DUCK_TIMING = { start: 120, low: 280, rise: 560, upright: 900, recover: 980 } as const;
export const ARENA_POWERBOMB_TIMING = { load: 320, lift: 620, hold: 180, slam: 560, recover: 300, groggy: 300, ankleLoad: 520, ankleSpin: 1400, ankleThrow: 0 } as const;
export const ARENA_SCOOP_SLAM_TIMING = { load: 300, lift: 560, turn: 620, slam: 760 } as const;
export const ARENA_SCOOP_RECOVERY_TIMING = { stand: 360, groggy: 240 } as const;
export const ARENA_SCOOP_FINISH_TIMING = { ankleLoad: 520, ankleSpin: 1400, ankleThrow: 0 } as const;
export const ARENA_DRAGGED_ANKLE_THROW_PACE = .85;
export const ARENA_DRAGGED_ANKLE_THROW_TIMING = { raise: 600 * ARENA_DRAGGED_ANKLE_THROW_PACE, heave: 400 * ARENA_DRAGGED_ANKLE_THROW_PACE } as const;
export const ARENA_DRAGGED_ANKLE_THROW_FLIGHT = { duration: 560, rise: 12 } as const;
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
function supportedPath(points: ArenaPoint[], times: number[], age: number, impactVelocity?: ArenaPoint): ArenaPoint {
  if (age <= times[0]) return { ...points[0] };
  if (age >= times.at(-1)!) return { ...points.at(-1)! };
  const segment = times.findIndex(time => time > age) - 1, duration = times[segment + 1] - times[segment];
  const p = (age - times[segment]) / duration, p2 = p * p, p3 = p2 * p;
  const tangent = (index: number, coordinate: 'x' | 'y') => index === 0 ? 0 : index === points.length - 1 ? (impactVelocity?.[coordinate] ?? 0) / 1000
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

/** Independent of selecting the move: five of a thousand attempts. */
export function arenaClotheslineDuckOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Clothesline duck roll must be 0–999');
  return roll < ARENA_CLOTHESLINE_DUCK_CHANCE * 1000;
}

/** The rim finish lifts the ankles to the chest and sends the feet out first. */
export function arenaAnkleRimThrowTargets(age: number, origins: {
  driver: ArenaPoint; ankles: [ArenaPoint, ArenaPoint]; orbit?: number; facing: 1 | -1; direction: 1 | -1;
}) {
  const timing = ARENA_DRAGGED_ANKLE_THROW_TIMING;
  const raise = ease(age / timing.raise), heaveClock = Math.max(0, (age - timing.raise) / timing.heave);
  // The last stroke still has momentum when the hands open.
  const heave = heaveClock >= 1 ? 1 : heaveClock * heaveClock * (2 - heaveClock);
  const motionHeave = heaveClock <= 1 ? heave : heaveClock;
  const originalOrbit = origins.orbit ?? (origins.direction === 1 ? Math.PI : 0);
  // Keep the head on the same side as the dragged body. Passing through a
  // vertical hang turned this small rim toss into an overhead somersault.
  const lastTurn = -origins.facing * Math.PI * .13;
  const orbit = originalOrbit + lastTurn * motionHeave;
  const midpoint = blend(origins.ankles[0], origins.ankles[1], .5);
  const raised = { x: origins.driver.x + origins.facing * 34, y: origins.driver.y - 52 };
  const backstroke = { x: origins.driver.x + origins.facing * 10 + origins.direction * 6, y: origins.driver.y - 54 };
  const held = blend(midpoint, raised, raise);
  const support = { x: held.x + (backstroke.x - held.x) * motionHeave, y: held.y + (backstroke.y - held.y) * motionHeave };
  const angleAt = (phase: number) => Math.atan2(Math.cos(phase), -.45 * Math.sin(phase));
  const difference = Math.atan2(Math.sin(angleAt(orbit) - angleAt(originalOrbit)), Math.cos(angleAt(orbit) - angleAt(originalOrbit))) * raise;
  const axis = { x: origins.ankles[1].x - origins.ankles[0].x, y: origins.ankles[1].y - origins.ankles[0].y };
  const span = { x: (axis.x * Math.cos(difference) - axis.y * Math.sin(difference)) / 2, y: (axis.x * Math.sin(difference) + axis.y * Math.cos(difference)) / 2 };
  const gripTargets: [ArenaPoint, ArenaPoint] = [{ x: support.x - span.x, y: support.y - span.y }, { x: support.x + span.x, y: support.y + span.y }];
  // The caller opens the hands on its first ready frame. Preserve the final
  // heave derivative when that frame samples just beyond the planned end.
  const angularVelocity = age >= timing.raise ? lastTurn * (heaveClock <= 1 ? heaveClock * (4 - 3 * heaveClock) : 1) / (timing.heave / 1000) : 0;
  return {
    raise, heave, overheadRaise: 0, gripTargets, angularVelocity,
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

/** Contact-gated moves use real roots; an aerial miss always returns to the sand. */
export function arenaWrestlingMoveTargets(window: ArenaWrestlingMoveWindow, elapsed: number, center: ArenaPoint, origins?: ArenaWrestlingMoveOrigins, layoutSide = 1): ArenaWrestlingMoveFrame {
  const kind = window.kind, timing = ARENA_WRESTLING_MOVE_TIMING;
  const ankleFinish = kind !== 'dropkick';
  const catching = arenaWrestlingMoveIsCounter(kind);
  const initial = origins ?? {
    driver: { x: center.x - layoutSide * (catching ? -25 : 180), y: center.y },
    victim: { x: center.x + layoutSide * (catching ? -200 : 20), y: center.y },
  };
  const side = (Math.abs(initial.victim.x - initial.driver.x) > 1 ? initial.victim.x >= initial.driver.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const gap = distance(initial.driver, initial.victim);
  const goal: ArenaPoint = kind === 'dropkick' ? { x: initial.victim.x - side * 144, y: initial.victim.y }
    : kind === 'clothesline' ? { x: initial.victim.x - side * 126, y: initial.victim.y }
    : catching ? { x: initial.driver.x + side * 42, y: initial.driver.y }
    : { x: initial.victim.x - side * 36, y: initial.victim.y };
  const movingOrigin = catching ? initial.victim : initial.driver;
  const run = arenaChargePath(movingOrigin, goal, elapsed - window.start);
  const plannedLaunchAt = window.plannedLaunchAt ?? (catching ? window.start + timing.load : window.start + run.duration);
  const landingGoal = kind === 'dropkick' ? { x: initial.victim.x - side * 12, y: initial.victim.y } : goal;
  const behind = { x: initial.driver.x - side * 70, y: initial.driver.y };
  const canPerform = inside(initial.driver) && inside(initial.victim) && inside(goal)
    && (kind === 'dropkick' ? gap >= 170 && inside(landingGoal) : catching ? gap >= 130 && (kind !== 'backbodydrop' || inside(behind)) : gap >= 130 && inside({ x: initial.victim.x + side * (kind === 'clothesline' ? 92 : 56), y: initial.victim.y }));
  const launchAt = !canPerform || window.launchAt === null ? null : Math.max(window.start, window.launchAt ?? plannedLaunchAt);
  // A display frame can record takeoff just after the runway was completed.
  // Keep that event gate, but advance the jump from its physical takeoff
  // time so the last fraction of a running stride is not lost to a stop.
  const launch = kind === 'dropkick' || kind === 'clothesline' ? Math.min(launchAt ?? plannedLaunchAt, plannedLaunchAt) : launchAt ?? plannedLaunchAt;
  const plannedContactAt = window.plannedContactAt === undefined
    ? kind === 'dropkick' ? launch + timing.jump * .67 : kind === 'clothesline' ? launch + ARENA_CLOTHESLINE_JUMP_TIMING.contact : launch + run.duration
    : window.plannedContactAt + launch - plannedLaunchAt;
  const contactAt = !canPerform || launchAt === null || window.contactAt === null ? null : Math.max(launchAt, window.contactAt ?? plannedContactAt);
  const contact = contactAt ?? plannedContactAt;
  const runway = distance(initial.launchVictim ?? initial.victim, goal);
  const halfRunAt = arenaChargeDuration(runway / 2) * 1000;
  const counterReadyAt = window.counterReadyAt === undefined ? launch + halfRunAt : window.counterReadyAt + launch - plannedLaunchAt;
  const scoopTiming = ARENA_SCOOP_SLAM_TIMING, scoopDuration = scoopTiming.load + scoopTiming.lift + scoopTiming.turn + scoopTiming.slam;
  const floorAt = contact + (kind === 'clothesline' ? timing.clotheslineFall : kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING.load + ARENA_POWERBOMB_TIMING.lift + ARENA_POWERBOMB_TIMING.hold + ARENA_POWERBOMB_TIMING.slam : kind === 'backbodydrop' ? timing.backFlip : kind === 'scoopslam' ? scoopDuration : ARENA_SPINEBUSTER_TIMING.load + ARENA_SPINEBUSTER_TIMING.lift + ARENA_SPINEBUSTER_TIMING.slam);
  const pickupReadyAt = floorAt + (kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING.recover + ARENA_POWERBOMB_TIMING.groggy : kind === 'clothesline' ? ARENA_CLOTHESLINE_FINISH_TIMING.rise : kind === 'spinebuster' ? ARENA_SPINEBUSTER_TIMING.recover : kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.groggy : kind === 'scoopslam' ? ARENA_SCOOP_RECOVERY_TIMING.stand + ARENA_SCOOP_RECOVERY_TIMING.groggy : timing.groggy);
  const kickAt = window.kickAt ?? null;
  const ankleGripAt = contactAt === null || window.ankleGripAt === null ? null : Math.max(pickupReadyAt, window.ankleGripAt ?? pickupReadyAt + 240);
  const ankleLoad = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.ankleLoad : ARENA_SCOOP_FINISH_TIMING.ankleLoad;
  const spinDuration = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.ankleSpin : ARENA_SCOOP_FINISH_TIMING.ankleSpin;
  const requiredReleaseAt = ankleFinish ? (ankleGripAt ?? pickupReadyAt + 240) + ankleLoad + spinDuration : contact;
  const finishingContact = ankleFinish ? ankleGripAt !== null : true;
  const releaseAt = contactAt === null || !finishingContact || window.releaseAt === null ? null : Math.max(contactAt, window.releaseAt ?? requiredReleaseAt);
  const landingAt = kind === 'dropkick' ? launch + timing.jump : floorAt;
  const requiredEndAt = kind === 'dropkick' ? landingAt + timing.landing
    : requiredReleaseAt + 180;
  const launched = launchAt !== null && elapsed >= launchAt;
  const contacted = contactAt !== null && elapsed >= contactAt;
  const released = releaseAt !== null && elapsed >= releaseAt;
  const target = initial.target ?? { x: initial.victim.x, y: initial.victim.y - (kind === 'dropkick' ? 80 : catching ? 42 : 90) };
  const targets = initial.contactTargets ?? [{ x: target.x, y: target.y - 6 }, { x: target.x, y: target.y + 6 }];
  const frame: ArenaWrestlingMoveFrame = {
    kind, stage: !launched ? elapsed < plannedLaunchAt - timing.load ? 'approach' : 'load' : contacted ? released ? 'release' : 'contact' : 'attack',
    active: elapsed >= window.start && elapsed < Math.max(window.end, requiredEndAt), side, canPerform,
    missed: launched && !contacted && elapsed >= requiredEndAt, recovered: launched && elapsed >= requiredEndAt,
    driver: { ...initial.driver }, victim: { ...initial.victim }, driverVelocity: zero(), victimVelocity: zero(),
    driverFacing: side, victimFacing: side === 1 ? -1 : 1, driverPose: 'guard', victimPose: 'guard', driverPhase: 0, victimPhase: 0,
    driverHeight: 0, victimHeight: 0, driverAngle: 0, victimAngle: 0, driverSuspension: 0, victimSuspension: 0,
    driverJumpTuck: 0, victimJumpTuck: 0, clotheslineStrength: 0, victimDuck: 0, feetStrength: 0, dropkickProgress: 0,
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
    if (elapsed < pickupReadyAt) { frame.stage = frame.driverPose === 'recover' || kind === 'scoopslam' && (frame.scoopRecover ?? 1) < 1 ? 'recover' : 'groggy'; return frame; }
    const floorSide = Math.sin(frame.victimAngle) < 0 ? -1 : 1;
    if (initial.floorVictim) frame.victim = { ...initial.floorVictim };
    const ankles = initial.ankles ?? [{ x: frame.victim.x - floorSide * 84, y: frame.victim.y - 4 }, { x: frame.victim.x - floorSide * 86, y: frame.victim.y - 13 }];
    const pickupSide = kind === 'powerbomb' || kind === 'clothesline' || kind === 'scoopslam' ? -floorSide : floorSide;
    const midpoint = blend(ankles[0], ankles[1], .5), ankleGoal = initial.ankleDriver ?? { x: midpoint.x + pickupSide * 32, y: frame.victim.y };
    const approach = travel(initial.pickupDriver ?? frame.driver, ankleGoal, elapsed - pickupReadyAt, 160);
    frame.driver = ankleGripAt !== null && elapsed >= ankleGripAt ? { ...(initial.ankleDriver ?? approach.point) } : approach.point;
    frame.driverVelocity = ankleGripAt !== null && elapsed >= ankleGripAt ? zero() : approach.velocity;
    const walkingPickup = kind === 'clothesline' || kind === 'scoopslam';
    const arrivedAt = pickupReadyAt + approach.duration;
    const walking = walkingPickup && elapsed < arrivedAt && (ankleGripAt === null || elapsed < ankleGripAt);
    frame.driverFacing = walking ? pickupSide < 0 ? -1 : 1 : initial.ankleFacing ?? (midpoint.x >= frame.driver.x ? 1 : -1);
    const gripAge = ankleGripAt === null ? -1 : elapsed - ankleGripAt;
    frame.driverPose = walking ? 'walk' : 'drag';
    frame.driverAngle = 0; frame.driverSlam = undefined;
    frame.gripMode = 'ankle';
    frame.ankleApproach = walking ? 0 : ease((elapsed - (walkingPickup ? arrivedAt : pickupReadyAt)) / timing.ankleReach);
    frame.gripTargets = walking ? undefined : ankles;
    frame.gripStrength = walkingPickup ? frame.ankleApproach ?? 0 : 1;
    frame.canGrabAnkle = ankleGripAt === null && frame.ankleApproach === 1 && (!(kind === 'powerbomb' || walkingPickup) || elapsed >= arrivedAt);
    frame.canRelease = ankleGripAt !== null && elapsed >= requiredReleaseAt && !released;
    if (ankleGripAt !== null && elapsed >= ankleGripAt) {
      const load = ease(gripAge / ankleLoad), spinAge = released ? Math.min(gripAge, releaseAt! - ankleGripAt!) : gripAge;
      // Begin turning while lifting the ankles, then carry that velocity
      // into the full swing. Loading and rotating are one connected motion.
      const lead = Math.PI * .1, loadSeconds = ankleLoad / 1000;
      const initialVelocity = 2 * lead / loadSeconds, spinSeconds = spinDuration / 1000, rampSeconds = spinSeconds * .18;
      const finalVelocity = (Math.PI * 2 - lead - initialVelocity * rampSeconds / 2) / (spinSeconds - rampSeconds / 2);
      const tailAge = Math.max(0, (spinAge - ankleLoad) / 1000), accelerating = Math.min(tailAge, rampSeconds);
      const rotation = spinAge < ankleLoad ? lead * (spinAge / ankleLoad) ** 2
        : lead + initialVelocity * accelerating + (finalVelocity - initialVelocity) * accelerating ** 2 / (2 * rampSeconds) + finalVelocity * Math.max(0, tailAge - rampSeconds);
      const turn = frame.driverFacing * rotation, progress = clamp(rotation / (Math.PI * 2));
      // Use the wrist-spin's horizontal orbit, with the feet as its anchor.
      // This depth projection circles the body around the planted caster
      // rather than turning it as a vertical wheel. Its quarter-phase release
      // gives the real mass a horizontal tangent at the end of one full turn.
      const orbit = -Math.PI / 2 + turn;
      const projection = arenaAnkleSwingProjection(orbit), targetAngle = projection.angle;
      const angle = frame.victimAngle + Math.atan2(Math.sin(targetAngle - frame.victimAngle), Math.cos(targetAngle - frame.victimAngle)) * load;
      const width = mix(1, projection.width, load);
      const caster = arenaAnkleSwingCasterProjection(orbit);
      // Hold the feet in front of the lower chest while the whole caster
      // follows the same orbit. The arms no longer orbit at neck height.
      const raised = { x: frame.driver.x + caster.front.x * 18, y: frame.driver.y - 60 + caster.front.y * 18 };
      const center = blend(midpoint, raised, load);
      const halfSpan = mix(distance(ankles[0], ankles[1]) / 2, 9 * 2.04 / 2, load);
      const axis = { x: Math.cos(angle) * frame.victimFacing * width, y: Math.sin(angle) * frame.victimFacing * width };
      frame.gripTargets = [-1, 1].map(direction => ({ x: center.x + axis.x * halfSpan * direction, y: center.y + axis.y * halfSpan * direction })) as [ArenaPoint, ArenaPoint];
      frame.ankleSpin = { orbit, flatness: 1, weight: load, gripLimb: 'feet', gripBoth: true, planar: true };
      frame.ankleSpinProgress = progress; frame.pivotTurn = turn; frame.driverYaw = turn;
      frame.ankleAngularVelocity = frame.driverFacing * (spinAge < ankleLoad ? initialVelocity * spinAge / ankleLoad
        : initialVelocity + (finalVelocity - initialVelocity) * Math.min(1, tailAge / rampSeconds));
      frame.ankleOrbitVelocity = frame.ankleAngularVelocity;
      frame.ankleSpinRaise = undefined;
      frame.driverPose = 'grapple'; frame.driverPhase = load; frame.ankleThrowProgress = load;
      frame.victimPose = 'stunned'; frame.victimSlam = { tuck: 0, slump: 1 }; frame.victimHeight = 0;
      frame.victimCarryStretch = undefined;
      frame.stage = released ? 'release' : gripAge < ankleLoad ? 'ankle-grip' : progress < .78 ? 'spin' : 'toss';
      return frame;
    }
    frame.stage = 'ankle-approach';
    frame.driverPhase = clamp((elapsed - pickupReadyAt) / Math.max(1, approach.duration));
    return frame;
  };
  if (kind === 'clothesline') {
    const jump = ARENA_CLOTHESLINE_JUMP_TIMING, origin = initial.launchDriver ?? goal;
    const flightAge = launched ? Math.max(0, elapsed - launch) : 0, flight = clamp(flightAge / jump.flight);
    // The upright shoulder and outstretched arm reach the opponent before
    // the pelvis does. Reserve the remaining pass-through for the impact.
    const landing = { x: initial.victim.x + side * 16, y: initial.victim.y };
    const runway = distance(initial.driver, goal), runDirection = runway > .001 ? { x: (goal.x - initial.driver.x) / runway, y: (goal.y - initial.driver.y) / runway } : { x: side, y: 0 };
    const airborne = (p: number) => {
      const tangent = p * (1 - p) ** 2, tangentVelocity = (1 - p) * (1 - 3 * p), duration = jump.flight / 1000;
      // After a duck has cleared the sweep, complete the missed run on the
      // far side rather than landing alongside the opponent and stopping.
      const missAge = (p - .58) * jump.flight, missDuration = jump.flight * .42;
      const missPass = contactAt === null ? side * 48 * ease(missAge / missDuration) : 0;
      const missVelocity = contactAt === null ? side * 48 * easeVelocity(missAge, missDuration) : 0;
      return { point: { x: mix(origin.x, landing.x, ease(p)) + runDirection.x * ARENA_CHARGE_SPEED * duration * tangent + missPass, y: mix(origin.y, landing.y, ease(p)) + runDirection.y * ARENA_CHARGE_SPEED * duration * tangent },
        velocity: { x: (landing.x - origin.x) * 6 * p * (1 - p) / duration + runDirection.x * ARENA_CHARGE_SPEED * tangentVelocity + missVelocity, y: (landing.y - origin.y) * 6 * p * (1 - p) / duration + runDirection.y * ARENA_CHARGE_SPEED * tangentVelocity },
        height: jump.height * 4 * p * (1 - p), angle: 0 };
    };
    const entry = launched ? airborne(flight) : { point: run.point, velocity: run.velocity, height: 0, angle: 0 };
    const atContact = airborne(clamp((contact - launch) / jump.flight));
    const base = contacted ? initial.contactDriver ?? atContact.point : entry.point;
    const victimOrigin = initial.contactVictim ?? initial.victim;
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const fall = ease(age / timing.clotheslineFall), rise = ease((age - timing.clotheslineFall) / ARENA_CLOTHESLINE_FINISH_TIMING.rise);
    // Bound from the running stride with an upright chest and a horizontal
    // arm at neck height. The collision then tips both complete bodies down.
    const incoming = initial.contactDriverVelocity ?? atContact.velocity;
    const caughtHeight = initial.contactDriverHeight ?? atContact.height, caughtAngle = initial.contactDriverAngle ?? atContact.angle;
    const caughtFlight = initial.contactFlightProgress ?? clamp((contact - launch) / jump.flight);
    const through = { x: victimOrigin.x + side * 92, y: victimOrigin.y };
    const p = clamp(age / timing.clotheslineFall), tangent = p * (1 - p) ** 2, tangentVelocity = (1 - p) * (1 - 3 * p);
    // The arm collision is still on the descending jump. Keep that vertical
    // tangent as well as the forward speed instead of suspending the torso
    // at contact and starting a separate descent from rest.
    const incomingHeightVelocity = 4 * jump.height * (1 - 2 * caughtFlight) / (jump.flight / 1000);
    const fallHeight = Math.max(0, caughtHeight * (1 - fall) + Math.min(0, incomingHeightVelocity) * timing.clotheslineFall / 1000 * tangent);
    frame.driver = contacted ? { x: mix(base.x, through.x, fall) + incoming.x * timing.clotheslineFall / 1000 * tangent,
      y: mix(base.y, through.y, fall) + incoming.y * timing.clotheslineFall / 1000 * tangent } : base;
    frame.driverVelocity = contacted ? { x: (through.x - base.x) * easeVelocity(age, timing.clotheslineFall) + incoming.x * tangentVelocity,
      y: (through.y - base.y) * easeVelocity(age, timing.clotheslineFall) + incoming.y * tangentVelocity } : entry.velocity;
    frame.driverPose = contacted ? age < timing.clotheslineFall ? 'dropkick' : rise < 1 ? 'recover' : 'guard' : launched ? flight < 1 ? 'dropkick' : 'land' : 'run';
    frame.driverPhase = contacted ? age < timing.clotheslineFall ? fall : rise : launched ? flight : clamp((elapsed - window.start) / Math.max(1, run.duration));
    frame.driverHeight = contacted ? fallHeight : entry.height;
    frame.driverAngle = contacted ? mix(caughtAngle, -side * Math.PI * .47, fall) * (1 - rise) : entry.angle * (1 - ease((flight - .8) / .2));
    frame.driverSuspension = launched ? contacted ? 1 - fall : flight < 1 ? 1 : 0 : 0;
    frame.dropkickProgress = contacted ? caughtFlight : flight;
    frame.clotheslineTarget = { ...target }; frame.clotheslineInner = true;
    frame.clotheslineArm = side < 0 ? 0 : 1;
    frame.clotheslineStrength = launched ? contacted ? 1 - ease((age - 160) / 180) : ease((flight - .08) / .24) * (1 - ease((flight - .8) / .2)) : 0;
    frame.canContact = frame.canContact && flightAge >= jump.contact && flight < .86;
    if (window.duck && !contacted) {
      const duck = ARENA_CLOTHESLINE_DUCK_TIMING;
      frame.victimDuck = launched ? ease((flightAge - duck.start) / (duck.low - duck.start)) * (1 - ease((flightAge - duck.rise) / (duck.upright - duck.rise))) : 0;
      frame.victimPose = 'guard'; frame.victimEyesClosed = false;
      // An empty strike retains the upright running bound into its landing.
      frame.driverAngle = 0;
      frame.landingAt = launch + jump.flight;
      frame.requiredEndAt = launch + duck.recover;
      frame.recovered = launched && elapsed >= frame.requiredEndAt;
      frame.missed = frame.recovered; frame.canRelease = false;
      frame.active = elapsed >= window.start && elapsed < Math.max(window.end, frame.requiredEndAt);
      // The empty strike keeps its original jump and momentum. Let the
      // attacker land and the defender stand before resuming their bout.
      if (launched && flight === 1) {
        const settle = clamp((flightAge - jump.flight) / timing.landing);
        frame.driverPose = settle < 1 ? 'land' : 'guard'; frame.driverPhase = settle;
        frame.stage = 'recover';
      }
      return frame;
    }
    if (contacted) {
      frame.victim = { x: victimOrigin.x + side * 24 * fall, y: victimOrigin.y };
      frame.victimAngle = side * Math.PI * .47 * fall;
      frame.victimPose = fall === 0 ? 'guard' : fall < 1 ? 'roll' : 'stunned';
      frame.victimPhase = fall; frame.bulldogProgress = fall;
      frame.victimSlam = fall > 0 ? { tuck: .2 * Math.sin(fall * Math.PI), slump: fall } : undefined;
      frame.victimEyesClosed = elapsed >= floorAt;
      frame.slamImpactAt = floorAt;
      frame.slamImpact = elapsed >= floorAt ? 1 - ease((elapsed - floorAt) / 220) : 0;
      frame.driverSlam = fall > 0 && rise < 1 ? { tuck: .2 * Math.sin(fall * Math.PI) * (1 - rise), slump: fall * (1 - rise) } : undefined;
      frame.stage = fall < 1 ? 'fall' : rise < 1 ? 'recover' : 'groggy';
    }
    return finishAnkles();
  }
  if (kind === 'dropkick') {
    const p = launched ? clamp((elapsed - launch) / timing.jump) : 0;
    const origin = initial.launchDriver ?? goal;
    const runway = distance(initial.driver, goal), incoming = runway > .001 ? { x: (goal.x - initial.driver.x) / runway * ARENA_CHARGE_SPEED, y: (goal.y - initial.driver.y) / runway * ARENA_CHARGE_SPEED } : zero();
    const duration = timing.jump / 1000, tangent = p * (1 - p) ** 2, tangentVelocity = (1 - p) * (1 - 3 * p);
    frame.driver = launched ? { x: mix(origin.x, landingGoal.x, ease(p)) + incoming.x * duration * tangent, y: mix(origin.y, landingGoal.y, ease(p)) + incoming.y * duration * tangent } : run.point;
    frame.driverVelocity = launched ? { x: (landingGoal.x - origin.x) * 6 * p * (1 - p) / duration + incoming.x * tangentVelocity, y: (landingGoal.y - origin.y) * 6 * p * (1 - p) / duration + incoming.y * tangentVelocity } : run.velocity;
    frame.driverHeight = 54 * 4 * p * (1 - p);
    frame.driverAngle = -side * Math.PI * .48 * ease(p / .32) * (1 - ease((p - .72) / .28));
    frame.driverPose = !launched ? 'run' : elapsed < landingAt ? 'dropkick' : elapsed < requiredEndAt ? 'land' : 'guard';
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
    const rise = contacted ? ease((elapsed - floorAt) / power.recover) : 0;
    // Keep the incoming catch clock, then use the original overhead slam's
    // complete body, arm raise, falling rotation and floor relaxation.
    const phase = !contacted ? .20 : age < power.load ? .20 + .14 * clamp(age / power.load)
      : age < power.load + power.lift ? .34 + .30 * clamp((age - power.load) / power.lift)
        : age < power.load + power.lift + power.hold ? .64 + .12 * clamp((age - power.load - power.lift) / power.hold)
          : age < power.load + power.lift + power.hold + power.slam ? .76 + .12 * clamp((age - power.load - power.lift - power.hold) / power.slam)
            : .88 + .06 * clamp((elapsed - floorAt) / power.recover);
    const slam = arenaOverheadSlamMotion(phase, side);
    const lift = contacted ? slam.lift : 0, down = contacted ? slam.slam : 0;
    const driverOrigin = initial.contactDriver ?? initial.driver, victimOrigin = initial.contactVictim ?? goal;
    const runner = arenaChargePath(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0);
    const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
    const preparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
    frame.counterPreparation = preparation;
    frame.driver = contacted ? { ...driverOrigin } : { ...initial.driver };
    frame.victim = contacted ? { x: mix(victimOrigin.x, driverOrigin.x + side * 43, load) + side * (slam.victimOffsetX - 43), y: mix(victimOrigin.y, driverOrigin.y, load) + slam.victimOffsetY } : runner.point;
    frame.driverVelocity = zero(); frame.victimVelocity = contacted ? zero() : runner.velocity;
    frame.driverPose = !contacted ? preparation > 0 ? 'overhead' : 'guard' : elapsed < floorAt ? 'overhead' : 'guard';
    frame.victimPose = !contacted || age === 0 ? launched ? 'run' : 'guard' : elapsed >= floorAt ? 'stunned' : phase >= .34 ? 'airborne' : 'brace';
    frame.driverPhase = contacted ? phase : .20;
    frame.victimPhase = phase; frame.powerbombLoad = load; frame.powerbombLift = lift; frame.powerbombDown = down;
    frame.overheadRaise = elapsed < floorAt || !contacted ? contacted ? slam.overheadRaise : 0 : undefined;
    frame.victimHeight = contacted ? slam.height : 0; frame.victimAngle = contacted ? slam.angle : 0;
    frame.victimSuspension = contacted ? slam.suspension : 0;
    frame.victimSlam = contacted ? slam.victimSlam : undefined;
    frame.victimEyesClosed = contacted && elapsed >= floorAt;
    frame.slamImpactAt = floorAt;
    frame.slamImpact = contacted ? slam.impact : 0;
    const gripping = !contacted || phase < .34 || slam.gripping;
    frame.gripTargets = targets; frame.gripMode = gripping ? 'waist' : undefined;
    frame.gripStrength = contacted ? gripping ? 1 : 0 : ease(preparation / .60);
    frame.canContact = frame.canContact && frame.gripStrength > .95;
    frame.stage = !contacted && preparation === 0 ? 'approach' : !contacted ? 'attack' : age < power.load ? 'contact' : lift < 1 ? 'lift' : age < power.load + power.lift + power.hold ? 'turn' : down < 1 ? 'fall' : rise < 1 ? 'recover' : 'groggy';
    return finishAnkles();
  }
  if (kind === 'scoopslam') {
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const liftStart = scoopTiming.load * .7, turnStart = scoopTiming.load + scoopTiming.lift * .8;
    const downStart = scoopTiming.load + scoopTiming.lift + scoopTiming.turn * .9;
    const load = ease(age / scoopTiming.load), lift = ease((age - liftStart) / (scoopTiming.load + scoopTiming.lift - liftStart));
    const turn = ease((age - turnStart) / (scoopTiming.load + scoopTiming.lift + scoopTiming.turn - turnStart));
    const downDuration = scoopDuration - downStart, downClock = contacted && elapsed >= floorAt ? 1 : clamp((age - downStart) / downDuration);
    // Drive through the last part of the drop. Braking to zero before the
    // back reaches the sand makes a slam look like setting a body down.
    const down = downClock * downClock * (2 - downClock), recover = contacted ? ease((elapsed - floorAt) / ARENA_SCOOP_RECOVERY_TIMING.stand) : 0;
    const impactAge = elapsed - floorAt;
    const recoil = contacted ? ease(impactAge / 50) * (1 - ease((impactAge - 50) / 170)) : 0;
    const victimOrigin = initial.contactVictim ?? goal, driverOrigin = initial.contactDriver ?? initial.driver;
    const runner = arenaChargePath(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0);
    const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
    const preparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
    frame.counterPreparation = preparation;
    const floorRoot = initial.scoopFloorVictim ?? { x: driverOrigin.x + side * 62, y: victimOrigin.y };
    // Receiving feet step into the incoming weight; the hips then carry both
    // bodies through the pivot and follow the back onto the floor.
    frame.driver = { x: driverOrigin.x + side * (8 * load + 8 * turn + 24 * down - 3 * recoil), y: driverOrigin.y };
    frame.driverVelocity = contacted ? { x: side * (8 * easeVelocity(age, scoopTiming.load)
      + 8 * easeVelocity(age - turnStart, scoopTiming.load + scoopTiming.lift + scoopTiming.turn - turnStart)
      + (downClock < 1 ? 24000 * downClock * (4 - 3 * downClock) / downDuration : 0)
      - 3 * (easeVelocity(impactAge, 50) * (1 - ease((impactAge - 50) / 170)) - ease(impactAge / 50) * easeVelocity(impactAge - 50, 170))), y: 0 } : zero();
    frame.victim = contacted ? blend(victimOrigin, floorRoot, down) : runner.point;
    frame.victimVelocity = contacted ? zero() : runner.velocity;
    frame.driverPose = contacted ? recover === 1 ? 'guard' : 'scoopslam' : preparation > 0 ? 'scoopslam' : 'guard';
    frame.victimPose = !contacted || age === 0 ? launched ? 'run' : 'guard' : down === 1 ? 'stunned' : 'carried';
    frame.driverPhase = contacted ? clamp(age / scoopDuration) : 0;
    frame.victimPhase = down; frame.scoopSlamProgress = frame.driverPhase;
    frame.scoopLoad = load; frame.scoopLift = lift; frame.scoopTurn = turn; frame.scoopDown = down;
    frame.scoopRecover = recover; frame.scoopVictim = contacted && age > 0;
    frame.driverYaw = side * .45 * Math.sin(turn * Math.PI) * (1 - down);
    frame.victimHeight = 124 * lift * (1 - down);
    // Stand beneath the received weight and lift the complete cradled body
    // above the head before driving its back down with both support arms.
    frame.victimAngle = side * Math.PI * (.12 * load + .18 * lift + .18 * turn + .02 * down);
    frame.victimSuspension = lift * (1 - down);
    if (contacted && age > 0 && elapsed < floorAt) frame.victimCarryStretch = load;
    frame.victimSlam = contacted && down > 0 ? { tuck: .12 * Math.sin(down * Math.PI), slump: down } : undefined;
    frame.slamImpactAt = floorAt;
    frame.slamImpact = contacted && impactAge >= 0 ? 1 - ease(impactAge / 220) : 0;
    frame.victimEyesClosed = contacted && elapsed >= frame.slamImpactAt;
    if (contacted) {
      const start = initial.scoopWaist ?? { x: victimOrigin.x, y: victimOrigin.y - 40 };
      const gathered = { x: driverOrigin.x + side * 16, y: driverOrigin.y - 48 };
      const raised = { x: driverOrigin.x + side * 6, y: driverOrigin.y - 140 };
      const turned = { x: driverOrigin.x + side * 30, y: driverOrigin.y - 134 };
      const floor = initial.scoopFloorWaist ?? { x: floorRoot.x + side * 25, y: floorRoot.y - 19 };
      const impactVelocity = { x: (floor.x - turned.x) * 2.3 / (scoopTiming.slam / 1000), y: (floor.y - turned.y) * 2.8 / (scoopTiming.slam / 1000) };
      frame.scoopSupport = supportedPath([start, gathered, raised, turned, floor],
        [0, scoopTiming.load, scoopTiming.load + scoopTiming.lift, scoopTiming.load + scoopTiming.lift + scoopTiming.turn, scoopDuration], age, impactVelocity);
    }
    frame.gripTargets = targets; frame.gripMode = 'cradle';
    // Release through the last descent and follow the weight below the chest.
    // The impact clock stays fixed; a tiny last-frame release forced the two
    // supporting elbows back to guard all at once.
    frame.gripStrength = launched ? contacted ? 1 - ease((downClock - .68) / .32) : preparation : 0;
    frame.canContact = frame.canContact && frame.gripStrength > .95;
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : age < scoopTiming.load ? 'contact'
      : lift < 1 ? 'lift' : turn < 1 ? 'turn' : down < 1 ? 'fall' : recover < 1 ? 'recover' : 'groggy';
    return finishAnkles();
  }
  if (kind === 'spinebuster') {
    const runner = catching ? arenaChargePath(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0) : run;
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const spineTiming = ARENA_SPINEBUSTER_TIMING;
    const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
    const preparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
    const load = contacted ? mix(preparation * .45, 1, ease(age / spineTiming.load)) : preparation * .45;
    const liftStart = spineTiming.load * .7, liftEnd = spineTiming.load + spineTiming.lift;
    const slamStart = spineTiming.load + spineTiming.lift * .85;
    const slamDuration = spineTiming.load + spineTiming.lift + spineTiming.slam - slamStart;
    const lift = contacted ? ease((age - liftStart) / (liftEnd - liftStart)) : 0;
    const slamClock = contacted ? elapsed >= floorAt ? 1 : clamp((age - slamStart) / slamDuration) : 0;
    const slam = slamClock * slamClock * (2 - slamClock);
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
      const gathered = { x: start.x - side * 3, y: start.y - 4 };
      frame.spineSupport = supportedPath([start, gathered, raised, floor],
        [0, liftStart, liftEnd, spineTiming.load + spineTiming.lift + spineTiming.slam], age,
        { x: (floor.x - raised.x) * 1.8 / (spineTiming.slam / 1000), y: (floor.y - raised.y) * 2.1 / (spineTiming.slam / 1000) });
    }
    const offset = { x: target.x - initial.victim.x, y: target.y - initial.victim.y };
    frame.gripTargets = [{ x: frame.victim.x + offset.x, y: frame.victim.y - frame.victimHeight + offset.y }, { x: frame.victim.x + offset.x + side * 8, y: frame.victim.y - frame.victimHeight + offset.y + 3 }];
    // The receiver releases once both bodies have turned behind its hips.
    // Holding the waist while it crosses the falling shoulder would twist
    // the forearm around its inner joint pole before the floor impact.
    frame.gripMode = 'waist'; frame.gripStrength = contacted ? 1 - ease((slamClock - .30) / .55) : preparation;
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : age < liftStart ? 'contact' : slamClock === 0 ? 'lift' : slam < 1 ? 'fall' : rise < 1 ? 'recover' : 'groggy';
    return finishAnkles();
  }
  const runner = arenaChargePath(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0);
  const flip = contacted ? clamp((elapsed - contactAt!) / timing.backFlip) : 0;
  const raise = ease(flip / .42), over = ease((flip - .34) / .66), descend = ease((flip - .50) / .50);
  const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
  const counterPreparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
  const victimOrigin = initial.contactVictim ?? goal;
  const driverOrigin = initial.contactDriver ?? initial.driver;
  const caughtBehind = { x: driverOrigin.x - side * 70, y: driverOrigin.y };
  frame.driver = { ...driverOrigin };
  frame.victim = contacted ? blend(victimOrigin, caughtBehind, over) : runner.point;
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
    const above = { x: driverOrigin.x, y: driverOrigin.y - 146 };
    const floor = initial.backBodyFloorWaist ?? { x: caughtBehind.x - side * 25, y: caughtBehind.y - 19 };
    const lifting = curve(start, { x: driverOrigin.x + side * 10, y: driverOrigin.y - 100 }, above, raise);
    const falling = curve(above, { x: driverOrigin.x - side * 38, y: driverOrigin.y - 130 }, floor, descend);
    frame.backBodySupport = { x: lifting.x + falling.x - above.x, y: lifting.y + falling.y - above.y };
  }
  frame.canContact = launched && !contacted && counterPreparation >= .60 && elapsed >= plannedContactAt - 120;
  frame.stage = !contacted && counterPreparation === 0 ? 'approach' : !launched ? frame.stage : !contacted ? 'attack' : flip < .5 ? 'lift' : flip < 1 ? 'fall' : 'groggy';
  return finishAnkles();
}
