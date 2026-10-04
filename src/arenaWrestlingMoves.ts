import type { ArenaPoint } from './arenaLogic';

export type ArenaWrestlingMoveKind = 'clothesline' | 'dropkick' | 'bulldog' | 'backbodydrop' | 'spinebuster' | 'scoopslam';
export type ArenaWrestlingMoveWindow = {
  kind: ArenaWrestlingMoveKind; start: number; end: number;
  launchAt?: number | null; contactAt?: number | null; releaseAt?: number | null;
  kickAt?: number | null; ankleGripAt?: number | null;
  plannedLaunchAt?: number; plannedContactAt?: number;
};
export type ArenaWrestlingMoveOrigins = {
  driver: ArenaPoint; victim: ArenaPoint; target?: ArenaPoint; contactTargets?: [ArenaPoint, ArenaPoint];
  launchDriver?: ArenaPoint; launchVictim?: ArenaPoint; contactDriver?: ArenaPoint; contactVictim?: ArenaPoint;
  ankles?: [ArenaPoint, ArenaPoint]; ankleDriver?: ArenaPoint; kickTarget?: ArenaPoint; kickDriver?: ArenaPoint;
};
type Slam = { tuck: number; slump: number };
export type ArenaWrestlingMoveFrame = {
  kind: ArenaWrestlingMoveKind; stage: 'approach' | 'load' | 'attack' | 'contact' | 'fall' | 'land' | 'recover' | 'release';
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
  gripTargets?: [ArenaPoint, ArenaPoint]; gripStrength: number; gripMode?: 'head' | 'waist' | 'ankle'; bulldogProgress: number; backBodyProgress: number;
  spinebusterProgress: number; scoopSlamProgress: number; victimCarryStretch?: number;
  kickAt: number | null; ankleGripAt: number | null; canKick: boolean; canGrabAnkle: boolean;
  frontKick?: number; driverFootTarget?: ArenaPoint; footStrength: number;
  launchAt: number | null; contactAt: number | null; releaseAt: number | null;
  plannedLaunchAt: number; plannedContactAt: number; requiredReleaseAt: number; landingAt: number; requiredEndAt: number;
  canLaunch: boolean; canContact: boolean; canRelease: boolean;
};

export const ARENA_WRESTLING_MOVE_CHANCE = .04;
export const ARENA_WRESTLING_MOVE_TIMING = {
  load: 160, jump: 840, landing: 180, clotheslineFollow: 240,
  bulldogFall: 340, bulldogRecover: 420, bulldogVictimRecover: 360, backFlip: 680, slamLift: 420, slamFall: 360, slamKick: 240, ankleThrow: 300,
} as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const blend = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
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
  const catching = kind === 'backbodydrop' || kind === 'spinebuster';
  const closeMove = kind === 'bulldog' || kind === 'scoopslam';
  const initial = origins ?? {
    driver: { x: center.x - layoutSide * (closeMove ? 30 : catching ? -25 : 180), y: center.y },
    victim: { x: center.x + layoutSide * (closeMove ? 30 : catching ? -200 : 20), y: center.y },
  };
  const side = (Math.abs(initial.victim.x - initial.driver.x) > 1 ? initial.victim.x >= initial.driver.x ? 1 : -1 : layoutSide < 0 ? -1 : 1) as 1 | -1;
  const gap = distance(initial.driver, initial.victim);
  const closeGap = kind === 'bulldog' ? 16 : 32;
  const goal: ArenaPoint = kind === 'dropkick' ? { x: initial.victim.x - side * 144, y: initial.victim.y }
    : closeMove ? { x: Math.abs(initial.victim.x - initial.driver.x) > closeGap ? initial.victim.x - side * closeGap : initial.driver.x, y: initial.victim.y - (kind === 'bulldog' ? 14 : 8) }
    : catching ? { x: initial.driver.x + side * 42, y: initial.driver.y }
    : { x: initial.victim.x - side * 36, y: initial.victim.y };
  const movingOrigin = catching ? initial.victim : initial.driver;
  const run = catching || kind === 'clothesline' ? rush(movingOrigin, goal, elapsed - window.start) : travel(movingOrigin, goal, elapsed - window.start);
  const plannedLaunchAt = window.plannedLaunchAt ?? (kind === 'clothesline' || catching ? window.start + timing.load : window.start + run.duration + timing.load);
  const landingGoal = kind === 'dropkick' ? { x: initial.victim.x - side * 12, y: initial.victim.y } : goal;
  const behind = { x: initial.driver.x - side * 70, y: initial.driver.y };
  const canPerform = inside(initial.driver) && inside(initial.victim) && inside(goal)
    && (closeMove ? inside({ x: initial.victim.x + side * 38, y: initial.victim.y }) : kind === 'dropkick' ? gap >= 170 && inside(landingGoal) : catching ? gap >= 130 && (kind !== 'backbodydrop' || inside(behind)) : gap >= 80);
  const launchAt = !canPerform || window.launchAt === null ? null : Math.max(window.start, window.launchAt ?? plannedLaunchAt);
  const launch = launchAt ?? plannedLaunchAt;
  const plannedContactAt = window.plannedContactAt === undefined
    ? kind === 'dropkick' ? launch + timing.jump * .56 : closeMove ? launch : launch + run.duration
    : window.plannedContactAt + launch - plannedLaunchAt;
  const contactAt = !canPerform || launchAt === null || window.contactAt === null ? null : Math.max(launchAt, window.contactAt ?? plannedContactAt);
  const contact = contactAt ?? plannedContactAt;
  const floorAt = contact + timing.slamLift + timing.slamFall;
  const floorVictim = initial.contactVictim ?? goal;
  const floorKickTarget = initial.kickTarget ?? { x: floorVictim.x + side * 4, y: floorVictim.y - 13 };
  const kickFacing = floorKickTarget.x >= (initial.contactDriver ?? initial.driver).x ? 1 : -1;
  const kickGoal = initial.kickDriver ?? { x: floorKickTarget.x - kickFacing * 24, y: floorVictim.y };
  const kickRun = travel(initial.contactDriver ?? initial.driver, kickGoal, elapsed - floorAt, 160);
  const plannedKickAt = floorAt + kickRun.duration + timing.slamKick;
  const kickAt = contactAt === null || window.kickAt === null ? null : Math.max(floorAt, window.kickAt ?? plannedKickAt);
  const ankleGripAt = contactAt === null || window.ankleGripAt === null ? null : Math.max(floorAt, window.ankleGripAt ?? floorAt + 240);
  const requiredReleaseAt = kind === 'backbodydrop' ? contact + timing.backFlip : kind === 'spinebuster' ? kickAt ?? plannedKickAt : kind === 'scoopslam' ? (ankleGripAt ?? floorAt + 240) + timing.ankleThrow : contact;
  const finishingContact = kind === 'spinebuster' ? kickAt !== null : kind === 'scoopslam' ? ankleGripAt !== null : true;
  const releaseAt = contactAt === null || !finishingContact || window.releaseAt === null ? null : Math.max(contactAt, window.releaseAt ?? requiredReleaseAt);
  const landingAt = kind === 'dropkick' ? launch + timing.jump : kind === 'bulldog' ? contact + timing.bulldogFall : kind === 'spinebuster' || kind === 'scoopslam' ? floorAt : requiredReleaseAt;
  const requiredEndAt = kind === 'dropkick' ? landingAt + timing.landing
    : kind === 'bulldog' ? landingAt + timing.bulldogRecover + timing.bulldogVictimRecover + 160
    : kind === 'backbodydrop' || kind === 'spinebuster' || kind === 'scoopslam' ? requiredReleaseAt + 180 : contact + timing.clotheslineFollow + 180;
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
    gripStrength: 0, bulldogProgress: 0, backBodyProgress: 0, spinebusterProgress: 0, scoopSlamProgress: 0,
    kickAt, ankleGripAt, canKick: false, canGrabAnkle: false, footStrength: 0,
    launchAt, contactAt, releaseAt, plannedLaunchAt, plannedContactAt, requiredReleaseAt, landingAt, requiredEndAt,
    canLaunch: canPerform && elapsed >= plannedLaunchAt, canContact: launched && !contacted && elapsed >= plannedContactAt - 120 && elapsed < requiredEndAt,
    canRelease: contacted && !released && kind !== 'bulldog' && elapsed >= requiredReleaseAt,
  };
  if (!canPerform) return frame;
  if (kind === 'clothesline') {
    const entry = rush(initial.launchDriver ?? initial.driver, goal, launched ? elapsed - launch : 0);
    const base = contacted ? initial.contactDriver ?? goal : entry.point;
    const follow = contacted ? ease((elapsed - contactAt!) / timing.clotheslineFollow) : 0;
    frame.driver = { x: base.x + side * 12 * follow, y: base.y };
    frame.driverVelocity = contacted ? zero() : entry.velocity;
    frame.driverPose = launched && !contacted ? 'run' : 'guard';
    frame.driverPhase = contacted ? follow : clamp((elapsed - launch) / Math.max(1, run.duration));
    frame.clotheslineTarget = { x: target.x + side * 20, y: target.y };
    frame.clotheslineStrength = launched ? contacted ? 1 - ease((elapsed - contactAt!) / timing.clotheslineFollow) : ease((frame.driverPhase - .55) / .3) : 0;
    return frame;
  }
  if (kind === 'dropkick') {
    const p = launched ? clamp((elapsed - launch) / timing.jump) : 0;
    const origin = initial.launchDriver ?? goal;
    frame.driver = launched ? blend(origin, landingGoal, ease(p)) : run.point;
    frame.driverVelocity = launched ? { x: (landingGoal.x - origin.x) * 6 * p * (1 - p) / (timing.jump / 1000), y: (landingGoal.y - origin.y) * 6 * p * (1 - p) / (timing.jump / 1000) } : run.velocity;
    frame.driverHeight = 54 * 4 * p * (1 - p);
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
    const victimRise = ease((age - timing.bulldogFall - timing.bulldogRecover) / timing.bulldogVictimRecover);
    const driverOrigin = initial.contactDriver ?? goal, victimOrigin = initial.contactVictim ?? initial.victim;
    frame.driver = contacted ? { x: driverOrigin.x + side * 38 * falling, y: driverOrigin.y } : run.point;
    frame.victim = { x: victimOrigin.x + side * 38 * falling, y: victimOrigin.y };
    frame.driverVelocity = contacted ? zero() : run.velocity;
    frame.driverPose = !launched ? elapsed < plannedLaunchAt - timing.load ? 'run' : 'guard' : !contacted || age < timing.bulldogFall ? 'bulldog' : rise < 1 ? 'recover' : 'guard';
    frame.victimPose = !contacted || falling === 0 ? 'guard' : falling < 1 ? 'roll' : victimRise === 0 ? 'stunned' : victimRise < 1 ? 'recover' : 'guard';
    frame.driverPhase = age < timing.bulldogFall ? falling : rise; frame.victimPhase = victimRise > 0 ? victimRise : falling;
    frame.bulldogProgress = falling;
    frame.driverAngle = side * Math.PI * .47 * falling * (1 - rise); frame.victimAngle = side * Math.PI * .47 * falling * (1 - victimRise);
    if (contacted && falling > 0) { frame.driverSlam = { tuck: .2 * Math.sin(falling * Math.PI) * (1 - rise), slump: falling * (1 - rise) }; frame.victimSlam = { tuck: .2 * Math.sin(falling * Math.PI) * (1 - victimRise), slump: falling * (1 - victimRise) }; }
    frame.gripTargets = targets; frame.gripStrength = launched && rise === 0 ? 1 : 0; frame.gripMode = 'head';
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : falling < 1 ? 'fall' : 'recover';
    frame.canRelease = false;
    return frame;
  }
  if (kind === 'spinebuster' || kind === 'scoopslam') {
    const runner = catching ? rush(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0) : run;
    const age = contacted ? Math.max(0, elapsed - contactAt!) : 0;
    const lift = ease(age / timing.slamLift), slam = ease((age - timing.slamLift) / timing.slamFall);
    const victimOrigin = initial.contactVictim ?? (catching ? goal : initial.victim);
    const driverOrigin = initial.contactDriver ?? (catching ? initial.driver : goal);
    frame.driver = catching ? { ...driverOrigin } : contacted ? { ...driverOrigin } : run.point;
    frame.victim = contacted ? { x: victimOrigin.x + side * (kind === 'scoopslam' ? 36 : 12) * slam - (kind === 'scoopslam' ? side * 48.96 * lift * (1 - slam) : 0), y: victimOrigin.y } : catching ? runner.point : { ...initial.victim };
    frame.driverVelocity = !catching && !contacted ? run.velocity : zero(); frame.victimVelocity = catching && !contacted ? runner.velocity : zero();
    frame.driverPose = contacted ? slam === 1 ? kind === 'spinebuster' ? 'trip' : ankleGripAt !== null && elapsed >= ankleGripAt ? 'throw' : 'drag' : kind : launched ? kind : !catching && elapsed < plannedLaunchAt - timing.load ? 'run' : 'guard';
    frame.victimPose = contacted ? slam === 1 ? 'stunned' : kind === 'scoopslam' ? 'carried' : 'airborne' : catching && launched ? 'run' : 'guard';
    frame.driverPhase = slam === 1 ? kind === 'scoopslam' && ankleGripAt !== null ? clamp((elapsed - ankleGripAt) / timing.ankleThrow) : clamp((elapsed - floorAt) / timing.slamKick) : age < timing.slamLift ? lift * .5 : .5 + slam * .5;
    frame.victimPhase = slam; frame.spinebusterProgress = kind === 'spinebuster' ? frame.driverPhase : 0; frame.scoopSlamProgress = kind === 'scoopslam' ? frame.driverPhase : 0;
    frame.victimHeight = (kind === 'scoopslam' ? 70 : 72) * lift * (1 - slam);
    frame.victimAngle = side * Math.PI * (kind === 'scoopslam' ? .5 * lift : .47 * slam);
    frame.victimSuspension = lift * (1 - slam);
    frame.victimSlam = contacted && slam > 0 ? { tuck: .2 * Math.sin(slam * Math.PI), slump: slam } : undefined;
    if (kind === 'scoopslam' && contacted) frame.victimCarryStretch = lift;
    const offset = { x: target.x - initial.victim.x, y: target.y - initial.victim.y };
    frame.gripTargets = [{ x: frame.victim.x + offset.x, y: frame.victim.y - frame.victimHeight + offset.y }, { x: frame.victim.x + offset.x + side * 8, y: frame.victim.y - frame.victimHeight + offset.y + 3 }];
    frame.gripMode = 'waist'; frame.gripStrength = launched && slam < 1 ? 1 : 0;
    if (kind === 'spinebuster' && contacted && slam === 1) {
      const preparing = elapsed >= floorAt + kickRun.duration;
      frame.driver = kickRun.point; frame.driverVelocity = kickRun.velocity; frame.driverFacing = kickFacing;
      frame.driverPose = preparing ? 'trip' : 'run';
      frame.frontKick = preparing ? .62 * ease((elapsed - floorAt - kickRun.duration) / timing.slamKick) : undefined;
      frame.driverPhase = frame.frontKick ?? clamp((elapsed - floorAt) / Math.max(1, kickRun.duration));
      frame.driverFootTarget = floorKickTarget; frame.footStrength = preparing ? 1 : 0;
      frame.canKick = elapsed >= plannedKickAt && kickAt === null;
      frame.canRelease = kickAt !== null && elapsed >= kickAt && !released;
    }
    if (kind === 'scoopslam' && contacted && slam === 1) {
      const ankles = initial.ankles ?? [{ x: frame.victim.x - side * 84, y: frame.victim.y - 4 }, { x: frame.victim.x - side * 86, y: frame.victim.y - 13 }];
      const midpoint = blend(ankles[0], ankles[1], .5), ankleGoal = initial.ankleDriver ?? { x: midpoint.x + side * 32, y: frame.victim.y };
      const approach = travel(driverOrigin, ankleGoal, elapsed - floorAt, 160);
      frame.driver = ankleGripAt !== null && elapsed >= ankleGripAt ? { ...(initial.ankleDriver ?? approach.point) } : approach.point;
      frame.driverVelocity = ankleGripAt !== null && elapsed >= ankleGripAt ? zero() : approach.velocity;
      frame.driverFacing = midpoint.x >= frame.driver.x ? 1 : -1;
      frame.gripTargets = ankles; frame.gripMode = 'ankle'; frame.gripStrength = 1;
      frame.canGrabAnkle = ankleGripAt === null;
      frame.canRelease = ankleGripAt !== null && elapsed >= requiredReleaseAt && !released;
      if (ankleGripAt !== null && elapsed >= ankleGripAt) {
        const toss = ease((elapsed - ankleGripAt) / timing.ankleThrow);
        // Lift by the connected ankles before release. Compensating the same
        // 24-local-pixel suspension pivot keeps the horizontal hips in place.
        frame.victim.x -= side * 48.96 * toss;
        frame.victimHeight = 34 * toss; frame.victimAngle = side * Math.PI * (.5 + .13 * toss);
        frame.victimSuspension = toss; frame.victimCarryStretch = 1; frame.victimPose = 'carried';
        frame.victimSlam = { tuck: 0, slump: 1 - toss };
      }
    }
    frame.stage = !launched ? frame.stage : !contacted ? 'attack' : released ? 'release' : slam < 1 ? 'fall' : 'contact';
    return frame;
  }
  const runner = rush(initial.launchVictim ?? initial.victim, goal, launched ? elapsed - launch : 0);
  const flip = contacted ? clamp((elapsed - contactAt!) / timing.backFlip) : 0;
  const victimOrigin = initial.contactVictim ?? goal;
  frame.victim = contacted ? blend(victimOrigin, behind, ease(flip)) : runner.point;
  frame.victimVelocity = contacted ? zero() : runner.velocity;
  frame.driverPose = launched ? 'backbodydrop' : 'guard'; frame.victimPose = contacted && flip > 0 ? 'airborne' : launched ? 'run' : 'guard';
  frame.driverPhase = flip; frame.victimPhase = flip; frame.backBodyProgress = launched ? .1 + .9 * flip : 0;
  frame.victimHeight = contacted ? 112 * Math.sin(Math.PI * flip) + 32 * ease(flip) : 0;
  frame.victimAngle = -side * Math.PI * .88 * ease(flip);
  frame.victimSuspension = contacted ? ease(flip / .20) : 0; frame.victimJumpTuck = contacted ? Math.sin(Math.PI * flip) ** 2 * .65 : 0;
  const offset = { x: target.x - initial.victim.x, y: target.y - initial.victim.y };
  frame.gripTargets = [{ x: frame.victim.x + offset.x, y: frame.victim.y + offset.y }, { x: frame.victim.x + offset.x + side * 8, y: frame.victim.y + offset.y + 3 }];
  frame.gripStrength = launched && flip < .55 ? 1 : 0; frame.gripMode = 'waist';
  frame.canContact = launched && !contacted && elapsed >= plannedContactAt - 120;
  return frame;
}
