import type { ArenaPoint } from './arenaLogic';

export type ArenaPassingTripWindow = {
  start: number; end: number; passerId: string; hookAt?: number;
  /** null awaits two real toe grips; a timestamp begins the short loading stroke. */
  launchAt?: number | null;
};
export type ArenaPassingTripOrigins = {
  passer: ArenaPoint; victim: ArenaPoint; opponent: ArenaPoint;
  /** The nearer painted ankle at the instant the passer joins the scene. */
  standingAnkle?: ArenaPoint;
  /** The fallen body's painted toes, frozen when its fall settles. */
  fallenFeet?: readonly [ArenaPoint, ArenaPoint];
  /** Current carried-rig toes; avoids a second guessed body transform. */
  heldFeet?: readonly [ArenaPoint, ArenaPoint];
};
export type ArenaPassingTripFrame = {
  active: boolean; phase: number; side: 1 | -1;
  stage: 'approach' | 'hook' | 'fall' | 'ankle-approach' | 'grip' | 'lift' | 'toss' | 'release';
  passer: ArenaPoint; victim: ArenaPoint; opponent: ArenaPoint;
  passerFacing: 1 | -1; opponentFacing: 1 | -1;
  passerVelocity: ArenaPoint; passerPose: 'walk' | 'trip'; passerFootTarget: ArenaPoint; footStrength: number;
  victimAngle: number; victimSuspension: number; victimPose: 'brace' | 'stunned' | 'carried';
  victimCarryStretch?: number; victimSlam?: { tuck: number; slump: number };
  lift: number; opponentPose: 'drag' | 'overhead'; overheadRaise: number;
  grip: boolean; gripStrength: number; ankleTargets: [ArenaPoint, ArenaPoint];
  pickupPoint: ArenaPoint; hookAt: number; fallAt: number; fallenAt: number; gripAt: number;
  launchedAt: number | null; tossAt: number | null; requiredImpactAt: number;
  releaseVelocity: ArenaPoint;
  canHook: boolean; pickupReachable: boolean; waitingForGrip: boolean;
};

export const ARENA_PASSING_TRIP_CHANCE = 1 / 1000;
/** Milliseconds after a real ankle hook; these never stretch with the bout. */
export const ARENA_PASSING_TRIP_TIMING = { hook: 130, fall: 350, approach: 550, grip: 300, lift: 750, toss: 270 } as const;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const ease = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const blend = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const inSand = (point: ArenaPoint) => Math.hypot((point.x - 500) / 278, (point.y - 416) / 80) <= 1 + 1e-9;

/** The caller consumes one independent cosmetic roll per eligible bout. */
export function arenaPassingTripOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Passing trip story roll must be 0–999');
  return roll === 0;
}

/** Put both shoulders under the actual toe midpoint as the same grip rises. */
export function arenaPassingTripAnkleHolder(feet: readonly ArenaPoint[], side: number, raise: number, bodyScale = 2.04): ArenaPoint {
  if (feet.length !== 2) throw new RangeError('An ankle throw needs both painted feet');
  const amount = clamp(raise), ratio = bodyScale / 2.04;
  return { x: (feet[0].x + feet[1].x) / 2 - side * 32 * ratio * (1 - amount), y: (feet[0].y + feet[1].y) / 2 + mix(24, 124, amount) * ratio };
}

/** Find the distance to the safe ellipse along the current walking line. */
function runway(origin: ArenaPoint, direction: ArenaPoint): number {
  const ox = (origin.x - 500) / 278, oy = (origin.y - 416) / 80;
  const dx = direction.x / 278, dy = direction.y / 80;
  const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), c = ox * ox + oy * oy - 1;
  return Math.max(0, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a));
}

/** Integrate acceleration, steady walking and braking without a stop at the hook. */
function walking(age: number, speed: number, acceleration: number, maxDistance: number) {
  if (maxDistance < 1e-9) return { distance: 0, speed: 0 };
  const ramp = acceleration / 1000, brake = ramp;
  speed = Math.min(speed, maxDistance / Math.max(.001, ramp));
  const accelerationDistance = speed * ramp / 2;
  const cruiseDistance = Math.max(0, maxDistance - accelerationDistance - speed * brake / 2);
  const cruiseEnd = ramp + cruiseDistance / speed, seconds = Math.max(0, age / 1000);
  if (seconds < ramp) return { distance: speed * seconds * seconds / (2 * ramp), speed: speed * seconds / ramp };
  if (seconds < cruiseEnd) return { distance: accelerationDistance + speed * (seconds - ramp), speed };
  const t = Math.min(brake, Math.max(0, seconds - cruiseEnd));
  return { distance: Math.min(maxDistance, accelerationDistance + cruiseDistance + speed * (t - t * t / (2 * brake))), speed: speed * (1 - t / brake) };
}

/** A real passer trips the drawn loser, continues past, and leaves the ankle throw to the duel opponent. */
export function arenaPassingTripTargets(window: ArenaPassingTripWindow, elapsed: number, center: ArenaPoint, origins?: ArenaPassingTripOrigins, layoutSide = 1, unit = 1): ArenaPassingTripFrame {
  // Anatomical endpoints do not shrink with a short game. Keep the real
  // loading/lifting stroke long enough for the holder's feet to follow them.
  const side = (layoutSide < 0 ? -1 : 1) as 1 | -1, scale = 1, pace = Math.max(.001, Math.min(1, unit));
  const initial = origins ?? { passer: { x: center.x + side * 76, y: center.y + 12 }, victim: { x: center.x + side * 24, y: center.y }, opponent: { x: center.x - side * 24, y: center.y } };
  const passSide = initial.passer.x >= initial.victim.x ? 1 : -1;
  const contact = { x: initial.victim.x + passSide * 30, y: initial.victim.y + 12 };
  const toContact = { x: contact.x - initial.passer.x, y: contact.y - initial.passer.y }, approachDistance = Math.hypot(toContact.x, toContact.y);
  const direction = approachDistance > .001 ? { x: toContact.x / approachDistance, y: toContact.y / approachDistance } : { x: -passSide, y: 0 };
  const passSpeed = 130, acceleration = 180 * scale;
  const approachMs = approachDistance < passSpeed * acceleration / 2000 ? Math.sqrt(2 * approachDistance * acceleration / passSpeed * 1000) : approachDistance * 1000 / passSpeed + acceleration / 2;
  // A painted sole can reach the ankle before the walker's root reaches its
  // passing mark. The Scene's verified contact is the authoritative clock.
  const hookAt = Math.max(window.start, window.hookAt ?? window.start + approachMs);
  const availableRunway = runway(initial.passer, direction), naturalDistance = passSpeed * Math.max(0, window.end - window.start) / 1000;
  const walkingDistance = Math.min(availableRunway, Math.max(approachDistance + 80 * pace, naturalDistance));
  const walk = walking(elapsed - window.start, passSpeed, acceleration, walkingDistance);
  const passer = { x: initial.passer.x + direction.x * walk.distance, y: initial.passer.y + direction.y * walk.distance };
  const fallAt = hookAt + ARENA_PASSING_TRIP_TIMING.hook * scale, fallenAt = fallAt + ARENA_PASSING_TRIP_TIMING.fall * scale;
  const fallen = ease((elapsed - fallAt) / (fallenAt - fallAt));
  const fallenPoint = { x: initial.victim.x + side * 10 * pace, y: initial.victim.y + 3 * pace };
  const floorFeet = initial.fallenFeet ?? [{ x: fallenPoint.x - side * 47.8, y: fallenPoint.y - 20.3 }, { x: fallenPoint.x - side * 49.9, y: fallenPoint.y - 42.7 }];
  const pickupPoint = arenaPassingTripAnkleHolder(floorFeet, side, 0);
  const pickupDistance = distance(initial.opponent, pickupPoint);
  // A slow walk can reach the painted toes; a far opponent gets more time,
  // rather than being snapped to a convenient lifting mark.
  const pickupMs = Math.max(ARENA_PASSING_TRIP_TIMING.approach * scale, pickupDistance * 1500 / 140);
  const gripAt = fallenAt + pickupMs;
  const loadedFrom = Math.max(gripAt, window.launchAt ?? gripAt);
  const minimumLaunch = gripAt + ARENA_PASSING_TRIP_TIMING.grip * scale;
  const launchedAt = window.launchAt === null ? null : loadedFrom + ARENA_PASSING_TRIP_TIMING.grip * scale;
  const tossAt = launchedAt === null ? null : launchedAt + ARENA_PASSING_TRIP_TIMING.lift * scale;
  const requiredImpactAt = (tossAt ?? minimumLaunch + ARENA_PASSING_TRIP_TIMING.lift * scale) + ARENA_PASSING_TRIP_TIMING.toss * scale;
  const released = launchedAt !== null && elapsed >= requiredImpactAt;
  const raised = launchedAt === null ? 0 : ease((elapsed - launchedAt) / (ARENA_PASSING_TRIP_TIMING.lift * scale));
  // Loading the grip does not unfold or relocate a body lying on the sand.
  // Its joints extend only as the same two ankles leave the floor.
  const stretch = raised;
  const toss = tossAt === null ? 0 : clamp((elapsed - tossAt) / (ARENA_PASSING_TRIP_TIMING.toss * scale));
  // End the throwing stroke with momentum. Smoothstep would stop the body
  // just before release and require the flight to kick it forward again.
  const tossDrive = toss < .2 ? toss * toss / .36 : (toss - .1) / .9;
  const victim = blend(initial.victim, fallenPoint, fallen);
  // Carrying changes the rig's suspension pivot by 48.96 world pixels.
  // Cancel that internal shift so the same ankles rise above their pickup.
  victim.x += side * (24 * pace * tossDrive - 48.96 * raised);
  const lift = 142 * raised + 8 * pace * tossDrive;
  // Supplied contacts are the renderer's authoritative endpoints. The fallback
  // merely schedules approach; a Scene must confirm both hands before launch.
  const ankleTargets = initial.heldFeet?.map(foot => ({ ...foot })) ?? floorFeet.map((foot, leg) => ({ x: foot.x + side * ((leg ? -4.53 : -6.65) * stretch + 24 * pace * tossDrive), y: foot.y + (leg ? 26.7 : 13.54) * stretch + 7.29 * raised - lift }));
  const holder = arenaPassingTripAnkleHolder(ankleTargets, side, raised);
  const opponent = elapsed < gripAt ? blend(initial.opponent, pickupPoint, ease((elapsed - fallenAt) / pickupMs)) : holder;
  const age = elapsed - hookAt;
  const hookStroke = elapsed < hookAt ? ease((elapsed - hookAt + 100 * scale) / (100 * scale)) : 1 - ease(age / (130 * scale));
  const footStrength = elapsed >= hookAt - 100 * scale && elapsed < fallAt ? hookStroke : 0;
  const stage = elapsed < hookAt ? 'approach' : elapsed < fallAt ? 'hook' : elapsed < fallenAt ? 'fall' : elapsed < gripAt ? 'ankle-approach' : launchedAt === null || elapsed < launchedAt ? 'grip' : elapsed < tossAt! ? 'lift' : !released ? 'toss' : 'release';
  const victimAngle = side * Math.PI * (.47 * fallen + .03 * stretch);
  return {
    active: elapsed >= window.start && elapsed < window.end, phase: clamp((elapsed - window.start) / Math.max(1, window.end - window.start)), side, stage,
    passer, victim, opponent, passerFacing: direction.x >= 0 ? 1 : -1, opponentFacing: side,
    passerVelocity: { x: direction.x * walk.speed, y: direction.y * walk.speed }, passerPose: footStrength > 0 ? 'trip' : 'walk',
    passerFootTarget: initial.standingAnkle ? { ...initial.standingAnkle } : { x: initial.victim.x + passSide * 8, y: initial.victim.y }, footStrength,
    victimAngle, victimSuspension: elapsed < fallenAt ? 1 - fallen : raised,
    victimPose: elapsed < fallAt ? 'brace' : elapsed < gripAt ? 'stunned' : 'carried', victimCarryStretch: elapsed >= fallenAt ? stretch : undefined,
    victimSlam: elapsed >= fallAt && elapsed < fallenAt ? { tuck: 0, slump: fallen } : undefined,
    lift, opponentPose: elapsed < launchedAt! || launchedAt === null ? 'drag' : 'overhead', overheadRaise: raised,
    grip: elapsed >= gripAt && !released, gripStrength: elapsed >= gripAt && !released ? ease((elapsed - gripAt) / (100 * scale)) : 0,
    ankleTargets: ankleTargets as [ArenaPoint, ArenaPoint],
    pickupPoint, hookAt, fallAt, fallenAt, gripAt, launchedAt, tossAt, requiredImpactAt,
    releaseVelocity: { x: side * 24 * pace * 1000 / (270 * scale * .9), y: -8 * pace * 1000 / (270 * scale * .9) },
    canHook: inSand(initial.passer) && approachDistance <= 90 && availableRunway >= approachDistance + 36,
    pickupReachable: inSand(initial.opponent) && inSand(pickupPoint) && requiredImpactAt <= window.end && requiredImpactAt - window.start <= 3500,
    waitingForGrip: launchedAt === null,
  };
}
