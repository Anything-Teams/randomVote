import type { ArenaPoint } from './arenaLogic';
import { ARENA_CHARGE_SPEED, ARENA_CHARGE_RAMP_SECONDS, arenaChargeDuration, arenaChargeTravel } from './arenaCharge';

export type ArenaPairDodgeWindow = {
  start: number; end: number; outcome: 'escape' | 'out';
  launchAt?: number | null; contactAt?: number;
};
export type ArenaPairDodgeOrigins = { charger: ArenaPoint; pair: [ArenaPoint, ArenaPoint] };
export type ArenaPairDodgeFrame = {
  stage: 'wrestle' | 'charge' | 'jump' | 'pass' | 'land' | 'recover' | 'release';
  active: boolean; released: boolean;
  charger: ArenaPoint; pair: [ArenaPoint, ArenaPoint];
  jumpHeight: [number, number]; jumpTuck: [number, number]; pairAngle: [number, number];
  chargerFacing: 1 | -1; chargeDirection: ArenaPoint;
  launchAt: number | null; runAt: number; contactAt: number; requiredEndAt: number; outAt?: number;
  chargerHeight: number; chargerAngle: number; chargePreparation: number; chargeStrength: number;
  rearExit: boolean; exitRim?: ArenaPoint; exitProgress: number;
};

export const ARENA_PAIR_DODGE_SPEED = ARENA_CHARGE_SPEED;
export const ARENA_PAIR_DODGE_JUMP_DURATION = 550;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const advance = (point: ArenaPoint, direction: ArenaPoint, distance: number): ArenaPoint => ({ x: point.x + direction.x * distance, y: point.y + direction.y * distance });
const heading = (from: ArenaPoint, to: ArenaPoint): ArenaPoint => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return distance > .001 ? { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance } : { x: to.x >= 500 ? 1 : -1, y: 0 };
};
const inside = (point: ArenaPoint): ArenaPoint => {
  const radius = Math.hypot((point.x - 500) / 290, (point.y - 416) / 98);
  return radius <= 1 ? { ...point } : { x: 500 + (point.x - 500) / radius, y: 416 + (point.y - 416) / radius };
};

/** Positive distance to the real sand boundary along the incoming runner's heading. */
function rimDistance(origin: ArenaPoint, direction: ArenaPoint): number {
  const x = (origin.x - 500) / 303, y = (origin.y - 416) / 112;
  const dx = direction.x / 303, dy = direction.y / 112;
  const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - 1;
  return Math.max(0, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a));
}

/** Cosmetic roll: 15% dodge; a third of eligible rim dodges eliminate only the charger. */
export function arenaPairDodgeOutcome(roll: number, nearRim = false): ArenaPairDodgeWindow['outcome'] | undefined {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Pair dodge roll must be 0–999');
  return roll >= 150 ? undefined : nearRim && roll % 3 === 0 ? 'out' : 'escape';
}

export function arenaPairDodgeCanExit(center: ArenaPoint, chargerOrigin: ArenaPoint, maxAfterPair = 150): boolean {
  const direction = heading(chargerOrigin, center);
  const insideSand = Math.hypot((center.x - 500) / 303, (center.y - 416) / 112) < 1;
  return insideSand && rimDistance(center, direction) <= maxAfterPair;
}

/** A real runway, two overlapping hops, then either a planted stop or one rim fall. */
export function arenaPairDodgeTargets(window: ArenaPairDodgeWindow, elapsed: number, center: ArenaPoint, origins?: ArenaPairDodgeOrigins, unit = 1): ArenaPairDodgeFrame {
  const timeUnit = Math.max(.001, unit), speed = ARENA_PAIR_DODGE_SPEED / 1000;
  const initial: ArenaPairDodgeOrigins = origins ?? {
    charger: inside({ x: center.x - (center.x >= 500 ? 1 : -1) * 160, y: center.y + 12 }),
    pair: [{ x: center.x - 22, y: center.y + 6 }, { x: center.x + 22, y: center.y - 6 }],
  };
  const anchor = { x: (initial.pair[0].x + initial.pair[1].x) / 2, y: (initial.pair[0].y + initial.pair[1].y) / 2 };
  const direction = heading(initial.charger, anchor), distance = Math.hypot(anchor.x - initial.charger.x, anchor.y - initial.charger.y);
  const launchAt = window.launchAt === null ? null : Math.max(window.start, window.launchAt ?? window.start + 180 * timeUnit);
  const assumedLaunch = launchAt ?? window.start + 180 * timeUnit;
  const ramp = ARENA_CHARGE_RAMP_SECONDS * 1000;
  const fastest = arenaChargeDuration(distance) * 1000;
  const runDuration = Math.max(160 * timeUnit, fastest);
  const earliestContact = assumedLaunch + Math.max(300 * timeUnit, runDuration);
  const contactAt = window.contactAt !== undefined && window.contactAt >= assumedLaunch ? window.contactAt : earliestContact;
  const available = Math.max(0, contactAt - assumedLaunch);
  const actualRun = Math.min(runDuration, available), runAt = contactAt - actualRun;
  const runRamp = ramp;
  const runSpeed = speed * Math.min(1, distance / Math.max(.001, arenaChargeTravel(actualRun / 1000).distance));
  const runTravel = (age: number) => {
    const t = Math.max(0, Math.min(actualRun, age));
    return Math.min(distance, arenaChargeTravel(t / 1000).distance * runSpeed / speed);
  };
  // A recorded live contact remains the common clock even for narration consumers.
  // With real origins its speed equals the recorded plan and never exceeds the shoulder-charge pace.
  const contactPoint = advance(initial.charger, direction, runTravel(actualRun));
  const forwardToRim = rimDistance(contactPoint, direction);
  const postRamp = 180 * timeUnit;
  const postTravel = (age: number) => {
    const t = Math.max(0, age);
    return t < postRamp ? runSpeed * t + (speed - runSpeed) * t * t / (2 * postRamp) : speed * t - (speed - runSpeed) * postRamp / 2;
  };
  const postTime = (length: number) => {
    const rampDistance = (runSpeed + speed) * postRamp / 2;
    if (length >= rampDistance) return (length + (speed - runSpeed) * postRamp / 2) / speed;
    const acceleration = (speed - runSpeed) / postRamp;
    return acceleration > .000001 ? (Math.sqrt(runSpeed * runSpeed + 2 * acceleration * length) - runSpeed) / acceleration : length / Math.max(.001, runSpeed);
  };
  const stopDistance = Math.min(85, Math.max(0, forwardToRim - 14));
  let accelerationTime = postRamp, brakeTime = 300 * timeUnit, peakSpeed = speed;
  const fullStroke = (runSpeed + speed) * accelerationTime / 2 + speed * brakeTime / 2;
  if (stopDistance < fullStroke) {
    peakSpeed = (2 * stopDistance - runSpeed * accelerationTime) / (accelerationTime + brakeTime);
    if (peakSpeed < runSpeed) { accelerationTime = 0; peakSpeed = runSpeed; brakeTime = 2 * stopDistance / Math.max(.001, runSpeed); }
  }
  const accelerationDistance = (runSpeed + peakSpeed) * accelerationTime / 2;
  const brakeDistance = peakSpeed * brakeTime / 2;
  const cruiseTime = Math.max(0, (stopDistance - accelerationDistance - brakeDistance) / Math.max(.001, peakSpeed));
  const stopDuration = accelerationTime + cruiseTime + brakeTime;
  const stopTravel = (age: number) => {
    const t = Math.max(0, age);
    if (accelerationTime > 0 && t < accelerationTime) return runSpeed * t + (peakSpeed - runSpeed) * t * t / (2 * accelerationTime);
    if (t < accelerationTime + cruiseTime) return accelerationDistance + peakSpeed * (t - accelerationTime);
    const b = Math.max(0, Math.min(brakeTime, t - accelerationTime - cruiseTime));
    return Math.min(stopDistance, accelerationDistance + peakSpeed * cruiseTime + peakSpeed * (b - b * b / Math.max(.001, 2 * brakeTime)));
  };
  const outAt = window.outcome === 'out' ? contactAt + postTime(forwardToRim) : undefined;
  const pairOrder = initial.pair.map(point => (point.x - anchor.x) * direction.x + (point.y - anchor.y) * direction.y);
  const nearIndex = pairOrder[0] <= pairOrder[1] ? 0 : 1;
  const jumpStarts = initial.pair.map((_, index) => Math.max(assumedLaunch, contactAt - (index === nearIndex ? 300 : 260) * timeUnit));
  const jumpDuration = ARENA_PAIR_DODGE_JUMP_DURATION * timeUnit;
  const lastLanding = Math.max(...jumpStarts) + jumpDuration;
  const requiredEndAt = Math.max(lastLanding + 230 * timeUnit, outAt !== undefined ? outAt + 650 * timeUnit : contactAt + stopDuration + 220 * timeUnit);
  const released = launchAt !== null && elapsed >= Math.max(window.end, requiredEndAt);
  const started = launchAt !== null && elapsed >= launchAt;
  const sideways = { x: -direction.y, y: direction.x };
  const landings = initial.pair.map((point, index) => {
    const offset = (point.x - anchor.x) * sideways.x + (point.y - anchor.y) * sideways.y;
    const side = Math.abs(offset) > .1 ? Math.sign(offset) : index === 0 ? -1 : 1;
    return inside(advance(point, sideways, side * 36));
  });
  const jumpPhases = jumpStarts.map(start => started ? clamp((elapsed - start) / jumpDuration) : 0);
  const pair = initial.pair.map((point, index) => mix(point, landings[index], ease(jumpPhases[index]))) as [ArenaPoint, ArenaPoint];
  const jumpHeight = jumpPhases.map((p, index) => (index === nearIndex ? 180 : 186) * 4 * p * (1 - p)) as [number, number];
  const jumpTuck = jumpPhases.map(p => p === 0 || p === 1 ? 0 : Math.sin(Math.PI * p) ** 2) as [number, number];
  const pairAngle = jumpPhases.map((p, index) => p === 0 || p === 1 ? 0 : (index === 0 ? -.12 : .12) * Math.sin(Math.PI * p)) as [number, number];
  const postAge = Math.max(0, elapsed - contactAt);
  let charger = !started ? { ...initial.charger } : elapsed < contactAt ? advance(initial.charger, direction, runTravel(elapsed - runAt)) : advance(contactPoint, direction, window.outcome === 'out' ? postTravel(postAge) : stopTravel(postAge));
  let chargerHeight = 0, chargerAngle = 0, exitProgress = 0;
  const exitRim = outAt !== undefined ? advance(contactPoint, direction, forwardToRim) : undefined;
  const rearExit = outAt !== undefined && direction.y < -.4;
  if (outAt !== undefined && elapsed >= outAt && started) {
    const fall = clamp((elapsed - outAt) / (650 * timeUnit));
    exitProgress = fall;
    const rim = advance(contactPoint, direction, forwardToRim);
    // Carry the incoming velocity beyond the same rim point before settling outside.
    const carried = postTravel(outAt - contactAt + Math.min(elapsed - outAt, 650 * timeUnit)) - forwardToRim;
    charger = advance(rim, direction, carried);
    chargerHeight = 14 * Math.sin(Math.PI * fall) - 76 * fall * fall;
    chargerAngle = (Math.abs(direction.x) > .001 ? Math.sign(direction.x) : 1) * Math.PI * .47 * ease(fall);
  }
  const anyJump = started && jumpPhases.some(p => p > 0 && p < 1);
  const allLanded = started && jumpPhases.every(p => p === 1);
  const stage: ArenaPairDodgeFrame['stage'] = released ? 'release' : !started ? 'wrestle' : anyJump ? elapsed < contactAt ? 'jump' : 'pass' : allLanded ? elapsed < lastLanding + 100 * timeUnit ? 'land' : 'recover' : elapsed < runAt ? 'wrestle' : 'charge';
  const preparation = started && elapsed < runAt ? ease((elapsed - launchAt!) / Math.max(1, runAt - launchAt!)) : 0;
  return { stage, active: elapsed >= window.start && !released, released, charger, pair, jumpHeight, jumpTuck, pairAngle,
    chargerFacing: (Math.abs(direction.x) > .001 ? direction.x > 0 ? 1 : -1 : direction.y >= 0 ? 1 : -1), chargeDirection: direction,
    launchAt, runAt, contactAt, requiredEndAt, outAt, chargerHeight, chargerAngle,
    chargePreparation: preparation, chargeStrength: started && elapsed >= runAt && elapsed < contactAt && distance > 1 ? ease((elapsed - runAt) / Math.max(1, runRamp)) : 0,
    rearExit, exitRim, exitProgress };
}
