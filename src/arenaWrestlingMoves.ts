import type { ArenaPoint } from './arenaLogic';

export type ArenaWrestlingMoveKind = 'clothesline' | 'dropkick' | 'bulldog' | 'backbodydrop' | 'spinebuster' | 'scoopslam';
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
  scoopWaist?: ArenaPoint; scoopFloorWaist?: ArenaPoint; scoopFloorVictim?: ArenaPoint;
};
type Slam = { tuck: number; slump: number };
export type ArenaWrestlingMoveFrame = {
  kind: ArenaWrestlingMoveKind; stage: 'approach' | 'load' | 'attack' | 'contact' | 'lift' | 'turn' | 'fall' | 'land' | 'recover' | 'groggy' | 'ankle-approach' | 'ankle-grip' | 'drag' | 'toss' | 'release';
  active: boolean; side: 1 | -1; canPerform: boolean; missed: boolean; recovered: boolean;
  driver: ArenaPoint; victim: ArenaPoint; driverVelocity: ArenaPoint; victimVelocity: ArenaPoint;
  driverFacing: 1 | -1; victimFacing: 1 | -1;
  driverPose: 'run' | 'guard' | 'dropkick' | 'bulldog' | 'backbodydrop' | 'spinebuster' | 'scoopslam' | 'land' | 'recover' | 'trip' | 'drag' | 'throw';
  victimPose: 'run' | 'guard' | 'airborne' | 'roll' | 'stunned' | 'carried' | 'recover';
  driverPhase: number; victimPhase: number; driverHeight: number; victimHeight: number;
  driverAngle: number; victimAngle: number; driverSuspension: number; victimSuspension: number;
  driverJumpTuck: number; victimJumpTuck: number; driverSlam?: Slam; victimSlam?: Slam;
  clotheslineTarget?: ArenaPoint; clotheslineStrength: number;
  footTargets?: [ArenaPoint, ArenaPoint]; feetStrength: number; dropkickProgress: number;
  gripTargets?: [ArenaPoint, ArenaPoint]; gripStrength: number; gripMode?: 'head' | 'waist' | 'ankle' | 'cradle'; bulldogProgress: number; backBodyProgress: number;
  spinebusterProgress: number; spineLoad: number; spineLift: number; spineDown: number; scoopSlamProgress: number; victimCarryStretch?: number; counterPreparation: number; counterReadyAt: number;
  scoopLoad: number; scoopLift: number; scoopTurn: number; scoopDown: number; scoopSupport?: ArenaPoint;
  kickAt: number | null; ankleGripAt: number | null; canKick: boolean; canGrabAnkle: boolean;
  frontKick?: number; ankleApproach?: number; ankleThrowProgress?: number; driverFootTarget?: ArenaPoint; footStrength: number;
  dragEndAt?: number; dragGoal?: ArenaPoint; finishSide?: 1 | -1;
  launchAt: number | null; contactAt: number | null; releaseAt: number | null;
  plannedLaunchAt: number; plannedContactAt: number; requiredReleaseAt: number; landingAt: number; floorAt: number; pickupReadyAt: number; requiredEndAt: number;
  canLaunch: boolean; canContact: boolean; canRelease: boolean;
};

export const ARENA_WRESTLING_MOVE_CHANCE = .04;
export const ARENA_WRESTLING_MOVE_TIMING = {
  load: 160, jump: 840, landing: 180, clotheslineFollow: 240, clotheslineFall: 420, groggy: 200,
  bulldogFall: 460, bulldogRecover: 480, backFlip: 680, slamLift: 420, slamFall: 360, slamKick: 240, ankleReach: 240, ankleThrow: 300,
} as const;
export const ARENA_SCOOP_SLAM_TIMING = { load: 300, lift: 560, turn: 460, slam: 460 } as const;
export const ARENA_SCOOP_FINISH_TIMING = { ankleLoad: 180, ankleThrow: 480 } as const;
export const ARENA_SPINEBUSTER_TIMING = { load: 280, lift: 620, slam: 560, throw: 480 } as const;
export const ARENA_CLOTHESLINE_FINISH_TIMING = { rise: 480, gripLoad: 160, dragSpeed: 105, throw: 300 } as const;
export const ARENA_BACK_BODY_DROP_TIMING = { groggy: 400, ankleLoad: 160, ankleThrow: 320 } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const blend = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
const curve = (a: ArenaPoint, bend: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => blend(blend(a, bend, p), blend(bend, b, p), p);
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (point: ArenaPoint) => Math.hypot((point.x - 500) / 290, (point.y - 416) / 98) <= 1;
const zero = (): ArenaPoint => ({ x: 0, y: 0 });

export function arenaWrestlingMoveOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Wrestling move roll must be 0–999');
  return roll < 40;
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
  const dragFinish = kind === 'clothesline' || kind === 'spinebuster' || kind === 'bulldog';
  const ankleFinish = dragFinish || kind === 'backbodydrop' || kind === 'scoopslam';
  const catching = kind === 'backbodydrop' || kind === 'spinebuster';
  const closeMove = kind === 'bulldog' || kind === 'scoopslam';
  const initial = origins ?? {
    driver: { x: center.x - layoutSide * (closeMove ? 30 : catching ? -25 : 180), y: center.y },
    victim: { x: center.x + layoutSide * (closeMove ? 30 : catching ? -200 : 20), y: center.y },
  };
  const side = (Math.abs(initial.victim.x - initial.driver.x) > 1 ? initial.victim.x >= initial.driver.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const gap = distance(initial.driver, initial.victim);
  const closeGap = kind === 'bulldog' ? 16 : 24;
  const goal: ArenaPoint = kind === 'dropkick' ? { x: initial.victim.x - side * 144, y: initial.victim.y }
    : closeMove ? { x: Math.abs(initial.victim.x - initial.driver.x) > closeGap ? initial.victim.x - side * closeGap : initial.driver.x, y: initial.victim.y - (kind === 'bulldog' ? 14 : 0) }
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
  const floorAt = contact + (kind === 'clothesline' ? timing.clotheslineFall : kind === 'bulldog' ? timing.bulldogFall : kind === 'backbodydrop' ? timing.backFlip : kind === 'scoopslam' ? scoopDuration : ARENA_SPINEBUSTER_TIMING.load + ARENA_SPINEBUSTER_TIMING.lift + ARENA_SPINEBUSTER_TIMING.slam);
  const pickupReadyAt = floorAt + (kind === 'bulldog' ? timing.bulldogRecover : kind === 'clothesline' ? ARENA_CLOTHESLINE_FINISH_TIMING.rise : kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.groggy : timing.groggy);
  const kickAt = window.kickAt ?? null;
  const ankleGripAt = contactAt === null || window.ankleGripAt === null ? null : Math.max(pickupReadyAt, window.ankleGripAt ?? pickupReadyAt + 240);
  const clotheslineFloor = initial.floorVictim ?? { x: (initial.contactVictim ?? initial.victim).x + side * (kind === 'spinebuster' ? 12 : kind === 'bulldog' ? 38 : 24), y: (initial.contactVictim ?? initial.victim).y };
  const clotheslineHolder = initial.ankleDriver ?? { x: clotheslineFloor.x - side * 118, y: clotheslineFloor.y };
  const dragSide = -side as 1 | -1;
  const dragGoal = { x: 500 + dragSide * (303 * Math.sqrt(Math.max(0, 1 - ((clotheslineHolder.y - 416) / 112) ** 2)) - 35), y: clotheslineHolder.y };
  const dragDuration = travel(clotheslineHolder, dragGoal, 0, ARENA_CLOTHESLINE_FINISH_TIMING.dragSpeed).duration;
  const dragStartAt = (ankleGripAt ?? pickupReadyAt + 240) + ARENA_CLOTHESLINE_FINISH_TIMING.gripLoad;
  const dragEndAt = window.dragEndAt ?? dragStartAt + dragDuration;
  const ankleLoad = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.ankleLoad : kind === 'scoopslam' ? ARENA_SCOOP_FINISH_TIMING.ankleLoad : 0;
  const ankleThrowDuration = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING.ankleThrow : kind === 'scoopslam' ? ARENA_SCOOP_FINISH_TIMING.ankleThrow : timing.ankleThrow;
  const dragThrowDuration = kind === 'clothesline' ? ARENA_CLOTHESLINE_FINISH_TIMING.throw : ARENA_SPINEBUSTER_TIMING.throw;
  const requiredReleaseAt = dragFinish ? dragEndAt + dragThrowDuration : ankleFinish ? (ankleGripAt ?? pickupReadyAt + 240) + ankleLoad + ankleThrowDuration : contact;
  const finishingContact = ankleFinish ? ankleGripAt !== null : true;
  const releaseAt = contactAt === null || !finishingContact || window.releaseAt === null ? null : Math.max(contactAt, window.releaseAt ?? requiredReleaseAt);
  const landingAt = kind === 'dropkick' ? launch + timing.jump : floorAt;
  const requiredEndAt = kind === 'dropkick' ? landingAt + timing.landing
    : requiredReleaseAt + 180;
  const launched = launchAt !== null && elapsed >= launchAt;
  const contacted = contactAt !== null && elapsed >= contactAt;
  const released = releaseAt !== null && elapsed >= releaseAt;
  const target = initial.target ?? { x: initial.victim.x, y: initial.victim.y - (kind === 'dropkick' ? 80 : catching || kind === 'scoopslam' ? 42 : 90) };
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
    scoopLoad: 0, scoopLift: 0, scoopTurn: 0, scoopDown: 0, counterPreparation: 0, counterReadyAt,
    kickAt, ankleGripAt, canKick: false, canGrabAnkle: false, footStrength: 0,
    launchAt, contactAt, releaseAt, plannedLaunchAt, plannedContactAt, requiredReleaseAt, landingAt, floorAt, pickupReadyAt, requiredEndAt,
    canLaunch: canPerform && elapsed >= plannedLaunchAt, canContact: launched && !contacted && elapsed >= plannedContactAt - 120 && elapsed < requiredEndAt,
    canRelease: contacted && finishingContact && !released && elapsed >= requiredReleaseAt,
  };
  if (!canPerform) return frame;
  const finishAnkles = () => {
    if (!contacted || elapsed < floorAt) return frame;
    if (elapsed < pickupReadyAt) { frame.stage = 'groggy'; return frame; }
    const floorSide = frame.victimAngle < 0 ? -1 : 1;
    if (initial.floorVictim) frame.victim = { ...initial.floorVictim };
    const ankles = initial.ankles ?? [{ x: frame.victim.x - floorSide * 84, y: frame.victim.y - 4 }, { x: frame.victim.x - floorSide * 86, y: frame.victim.y - 13 }];
    const midpoint = blend(ankles[0], ankles[1], .5), ankleGoal = initial.ankleDriver ?? { x: midpoint.x + floorSide * 32, y: frame.victim.y };
    const approach = travel(initial.pickupDriver ?? frame.driver, ankleGoal, elapsed - pickupReadyAt, 160);
    frame.driver = ankleGripAt !== null && elapsed >= ankleGripAt ? { ...(initial.ankleDriver ?? approach.point) } : approach.point;
    frame.driverVelocity = ankleGripAt !== null && elapsed >= ankleGripAt ? zero() : approach.velocity;
    frame.driverFacing = midpoint.x >= frame.driver.x ? 1 : -1;
    const gripAge = ankleGripAt === null ? -1 : elapsed - ankleGripAt;
    const tossing = gripAge >= ankleLoad;
    frame.driverPose = ankleGripAt !== null && tossing ? 'throw' : 'drag';
    frame.driverAngle = 0; frame.driverSlam = undefined;
    frame.gripTargets = ankles; frame.gripMode = 'ankle'; frame.gripStrength = 1;
    frame.ankleApproach = kind === 'scoopslam' || kind === 'backbodydrop' ? ease((elapsed - pickupReadyAt) / timing.ankleReach) : undefined;
    frame.canGrabAnkle = ankleGripAt === null && (frame.ankleApproach === undefined || frame.ankleApproach === 1);
    frame.canRelease = ankleGripAt !== null && elapsed >= requiredReleaseAt && !released;
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
    const midpoint = blend(ankles[0], ankles[1], .5), ankleGoal = initial.ankleDriver ?? { x: midpoint.x - floorSide * 32, y: clotheslineFloor.y };
    const approach = travel(initial.pickupDriver ?? frame.driver, ankleGoal, elapsed - pickupReadyAt, 160);
    const gripped = ankleGripAt !== null && elapsed >= ankleGripAt;
    const drag = travel(clotheslineHolder, dragGoal, gripped ? elapsed - dragStartAt : 0, ARENA_CLOTHESLINE_FINISH_TIMING.dragSpeed);
    const displacement = gripped ? { x: drag.point.x - clotheslineHolder.x, y: drag.point.y - clotheslineHolder.y } : zero();
    frame.victim = { x: clotheslineFloor.x + displacement.x, y: clotheslineFloor.y + displacement.y };
    frame.driver = gripped ? drag.point : approach.point; frame.driverVelocity = gripped ? drag.velocity : approach.velocity;
    frame.driverPose = gripped && elapsed >= dragEndAt ? 'throw' : 'drag';
    frame.driverFacing = side; frame.driverAngle = 0; frame.driverSlam = undefined;
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
      const toss = ease(frame.driverPhase);
      frame.ankleThrowProgress = frame.driverPhase;
      frame.victim.x += (-floorSide * 48.96 + dragSide * 18) * toss;
      frame.victimHeight = 34 * toss; frame.victimAngle += floorSide * Math.PI * .13 * toss;
      frame.victimSuspension = toss; frame.victimCarryStretch = toss; frame.victimPose = 'carried';
      frame.victimSlam = { tuck: 0, slump: 1 - toss };
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
    frame.clotheslineTarget = { x: target.x + side * 20, y: target.y };
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
  if (kind === 'bulldog') {
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const falling = ease(age / timing.bulldogFall), rise = ease((age - timing.bulldogFall) / timing.bulldogRecover);
    const driverOrigin = initial.contactDriver ?? goal, victimOrigin = initial.contactVictim ?? initial.victim;
    frame.driver = contacted ? { x: driverOrigin.x + side * 38 * falling, y: driverOrigin.y } : run.point;
    frame.victim = { x: victimOrigin.x + side * 38 * falling, y: victimOrigin.y };
    frame.driverVelocity = contacted ? zero() : run.velocity;
    frame.driverPose = !launched ? elapsed < plannedLaunchAt - timing.load ? 'run' : 'guard' : !contacted || age < timing.bulldogFall ? 'bulldog' : rise < 1 ? 'recover' : 'guard';
    frame.victimPose = !contacted || falling === 0 ? 'guard' : falling < 1 ? 'roll' : 'stunned';
    frame.driverPhase = age < timing.bulldogFall ? falling : rise; frame.victimPhase = falling;
    frame.bulldogProgress = falling;
    frame.driverAngle = side * Math.PI * .47 * falling * (1 - rise); frame.victimAngle = side * Math.PI * .47 * falling;
    if (contacted && falling > 0) { frame.driverSlam = { tuck: .2 * Math.sin(falling * Math.PI) * (1 - rise), slump: falling * (1 - rise) }; frame.victimSlam = { tuck: .2 * Math.sin(falling * Math.PI), slump: falling }; }
    const headReach = ease((elapsed - (plannedLaunchAt - timing.load)) / timing.load);
    frame.gripTargets = targets; frame.gripStrength = contacted ? 1 - ease((falling - .72) / .28) : headReach; frame.gripMode = 'head';
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : falling < 1 ? 'fall' : 'recover';
    frame.canRelease = false;
    return finishDraggedAnkles();
  }
  if (kind === 'scoopslam') {
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const load = ease(age / scoopTiming.load), lift = ease((age - scoopTiming.load) / scoopTiming.lift);
    // The knees finish extending before the supported body turns. This short
    // chest-height hold gives the weight a visible settling beat.
    const turn = ease((age - scoopTiming.load - scoopTiming.lift - scoopTiming.turn * .25) / (scoopTiming.turn * .75));
    const down = ease((age - scoopTiming.load - scoopTiming.lift - scoopTiming.turn) / scoopTiming.slam);
    const victimOrigin = initial.contactVictim ?? initial.victim, driverOrigin = initial.contactDriver ?? goal;
    const floorRoot = initial.scoopFloorVictim ?? { x: driverOrigin.x + side * 62, y: victimOrigin.y };
    frame.driver = contacted ? { ...driverOrigin } : run.point;
    frame.driverVelocity = contacted ? zero() : run.velocity;
    frame.victim = contacted ? blend(victimOrigin, floorRoot, down) : { ...initial.victim };
    frame.driverPose = launched ? 'scoopslam' : elapsed < plannedLaunchAt - timing.load ? 'run' : 'guard';
    frame.victimPose = !contacted || age === 0 ? 'guard' : down === 1 ? 'stunned' : 'carried';
    frame.driverPhase = contacted ? clamp(age / scoopDuration) : 0;
    frame.victimPhase = down; frame.scoopSlamProgress = frame.driverPhase;
    frame.scoopLoad = load; frame.scoopLift = lift; frame.scoopTurn = turn; frame.scoopDown = down;
    frame.victimHeight = 56 * lift * (1 - down);
    // Bring the upper back into the chest before turning; the head and hips
    // trace one connected arc instead of lying flat and rising vertically.
    frame.victimAngle = -side * Math.PI * (.36 * lift + .26 * turn - .12 * down);
    frame.victimSuspension = lift * (1 - down);
    if (contacted && age > 0) frame.victimCarryStretch = lift;
    frame.victimSlam = contacted && down > 0 ? { tuck: .12 * Math.sin(down * Math.PI), slump: down } : undefined;
    if (contacted) {
      const start = initial.scoopWaist ?? { x: victimOrigin.x, y: victimOrigin.y - 40 };
      const gathered = { x: start.x - side * 6, y: start.y };
      const raised = { x: driverOrigin.x + side * 14, y: driverOrigin.y - 72 };
      const turned = { x: driverOrigin.x + side * 22, y: driverOrigin.y - 66 };
      const floor = initial.scoopFloorWaist ?? { x: floorRoot.x - side * 25, y: floorRoot.y - 19 };
      frame.scoopSupport = age < scoopTiming.load ? blend(start, gathered, load)
        : age < scoopTiming.load + scoopTiming.lift ? curve(gathered, { x: driverOrigin.x + side * 9, y: start.y - 12 }, raised, lift)
          : age < scoopTiming.load + scoopTiming.lift + scoopTiming.turn ? curve(raised, { x: driverOrigin.x + side * 5, y: driverOrigin.y - 82 }, turned, turn)
            : curve(turned, { x: floor.x - side * 10, y: turned.y + 10 }, floor, down);
    }
    frame.gripTargets = targets; frame.gripMode = 'cradle';
    frame.gripStrength = launched ? contacted ? 1 - ease((down - .52) / .22) : ease((elapsed - launch) / scoopTiming.load) : 0;
    frame.canContact = frame.canContact && frame.gripStrength > .95;
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : age < scoopTiming.load ? 'contact'
      : lift < 1 ? 'lift' : turn < 1 ? 'turn' : down < 1 ? 'fall' : 'groggy';
    // Follow the supported back all the way onto the sand. Jumping straight
    // to a guard here reversed the receiving arm before the ankle reach.
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
    const slam = contacted ? ease((age - spineTiming.load - spineTiming.lift) / spineTiming.slam) : 0;
    const victimOrigin = initial.contactVictim ?? (catching ? goal : initial.victim);
    const driverOrigin = initial.contactDriver ?? (catching ? initial.driver : goal);
    frame.driver = catching ? { x: driverOrigin.x + (contacted ? side * 12 * lift : 0), y: driverOrigin.y } : contacted ? { ...driverOrigin } : run.point;
    frame.victim = contacted ? { x: victimOrigin.x + side * 12 * slam, y: victimOrigin.y } : runner.point;
    frame.driverVelocity = !catching && !contacted ? run.velocity : zero(); frame.victimVelocity = catching && !contacted ? runner.velocity : zero();
    frame.driverPose = contacted || preparation > 0 ? kind : 'guard';
    frame.victimPose = contacted ? slam === 1 ? 'stunned' : age < spineTiming.load ? 'guard' : 'carried' : catching && launched ? 'run' : 'guard';
    frame.driverPhase = load * .25 + lift * .4 + slam * .35;
    frame.victimPhase = slam; frame.spinebusterProgress = frame.driverPhase;
    frame.spineLoad = load; frame.spineLift = lift; frame.spineDown = slam; frame.counterPreparation = preparation;
    frame.victimHeight = 72 * lift * (1 - slam);
    frame.victimAngle = side * Math.PI * .47 * slam;
    frame.victimSuspension = lift * (1 - slam);
    if (contacted && age >= spineTiming.load && slam < 1) frame.victimCarryStretch = lift;
    frame.victimSlam = contacted && slam > 0 ? { tuck: .2 * Math.sin(slam * Math.PI), slump: slam } : undefined;
    const offset = { x: target.x - initial.victim.x, y: target.y - initial.victim.y };
    frame.gripTargets = [{ x: frame.victim.x + offset.x, y: frame.victim.y - frame.victimHeight + offset.y }, { x: frame.victim.x + offset.x + side * 8, y: frame.victim.y - frame.victimHeight + offset.y + 3 }];
    // Guide the falling waist, then open the hands over the last part of the
    // descent. Dropping a full grip on the exact floor frame reversed the far
    // shoulder and palm in a single draw.
    frame.gripMode = 'waist'; frame.gripStrength = contacted ? 1 - ease((slam - .68) / .30) : preparation;
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : age < spineTiming.load ? 'contact' : lift < 1 ? 'lift' : slam < 1 ? 'fall' : 'groggy';
    return finishDraggedAnkles();
  }
  const runner = rush(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0);
  const flip = contacted ? clamp((elapsed - contactAt!) / timing.backFlip) : 0;
  const preparationAge = contacted ? Math.min(elapsed, contactAt!) : elapsed;
  const counterPreparation = launched ? ease((preparationAge - counterReadyAt) / Math.max(1, plannedContactAt - counterReadyAt)) : 0;
  const victimOrigin = initial.contactVictim ?? goal;
  frame.victim = contacted ? blend(victimOrigin, behind, ease(flip)) : runner.point;
  frame.victimVelocity = contacted ? zero() : runner.velocity;
  frame.counterPreparation = counterPreparation;
  frame.driverPose = counterPreparation > 0 || contacted ? 'backbodydrop' : 'guard'; frame.victimPose = contacted && flip > 0 ? 'airborne' : launched ? 'run' : 'guard';
  frame.driverPhase = flip; frame.victimPhase = flip; frame.backBodyProgress = launched ? .1 * counterPreparation + (1 - .1 * counterPreparation) * flip : 0;
  frame.victimHeight = contacted && flip < 1 ? 64 * Math.sin(Math.PI * flip) : 0;
  frame.victimAngle = -side * Math.PI * .53 * ease(flip);
  frame.victimSuspension = contacted ? ease(flip / .20) * (1 - ease((flip - .75) / .25)) : 0; frame.victimJumpTuck = contacted ? Math.sin(Math.PI * flip) ** 2 * .65 : 0;
  if (contacted && flip > .6) frame.victimSlam = { tuck: .2 * Math.sin(Math.PI * clamp((flip - .6) / .4)), slump: ease((flip - .6) / .4) };
  if (contacted && flip === 1) frame.victimPose = 'stunned';
  const offset = { x: target.x - initial.victim.x, y: target.y - initial.victim.y };
  frame.gripTargets = [{ x: frame.victim.x + offset.x, y: frame.victim.y + offset.y }, { x: frame.victim.x + offset.x + side * 8, y: frame.victim.y + offset.y + 3 }];
  frame.gripStrength = launched ? ease(counterPreparation / .60) * (1 - ease((flip - .32) / .10)) : 0; frame.gripMode = 'waist';
  frame.canContact = launched && !contacted && counterPreparation >= .60 && elapsed >= plannedContactAt - 120;
  frame.stage = !contacted && counterPreparation === 0 ? 'approach' : !launched ? frame.stage : !contacted ? 'attack' : flip < 1 ? 'fall' : 'groggy';
  return finishAnkles();
}
