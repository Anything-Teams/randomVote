import type { ArenaPoint } from './arenaLogic';

/** Every attacking ground run uses the successful shoulder charge's pace. */
export const ARENA_CHARGE_SPEED = 165;
export const ARENA_CHARGE_RAMP_SECONDS = .16;

/** Distance and instantaneous speed before contact, without braking the rush. */
export function arenaChargeTravel(ageSeconds: number): { distance: number; speed: number } {
  const age = Math.max(0, ageSeconds), ramp = ARENA_CHARGE_RAMP_SECONDS;
  return {
    distance: ARENA_CHARGE_SPEED * (age < ramp ? age * age / (2 * ramp) : age - ramp / 2),
    speed: ARENA_CHARGE_SPEED * Math.min(1, age / ramp),
  };
}

/** Physical seconds needed to cover a runway with the same acceleration. */
export function arenaChargeDuration(distance: number): number {
  const length = Math.max(0, distance), ramp = ARENA_CHARGE_RAMP_SECONDS;
  return length < ARENA_CHARGE_SPEED * ramp / 2
    ? Math.sqrt(2 * length * ramp / ARENA_CHARGE_SPEED)
    : length / ARENA_CHARGE_SPEED + ramp / 2;
}

/** Only planted jumping moves brake at the end of their ground runway. */
export function arenaChargePath(origin: ArenaPoint, goal: ArenaPoint, ageMilliseconds: number, plant = false) {
  const length = Math.hypot(goal.x - origin.x, goal.y - origin.y), age = Math.max(0, ageMilliseconds / 1000);
  let duration = arenaChargeDuration(length), moved: number, speed: number;
  if (plant) {
    const ramp = Math.min(ARENA_CHARGE_RAMP_SECONDS, Math.sqrt(length / ARENA_CHARGE_SPEED));
    const cruise = Math.max(0, length / ARENA_CHARGE_SPEED - ramp);
    duration = 2 * ramp + cruise;
    const peak = ramp > 0 ? Math.min(ARENA_CHARGE_SPEED, length / ramp) : 0;
    if (age < ramp) { moved = peak * age * age / (2 * ramp); speed = peak * age / ramp; }
    else if (age < ramp + cruise) { moved = peak * (ramp / 2 + age - ramp); speed = peak; }
    else {
      const braking = Math.min(ramp, Math.max(0, age - ramp - cruise));
      moved = peak * (ramp / 2 + cruise + braking - braking * braking / Math.max(.001, 2 * ramp));
      speed = peak * (1 - braking / Math.max(.001, ramp));
    }
  } else {
    const travel = arenaChargeTravel(age);
    moved = travel.distance; speed = age > duration ? 0 : travel.speed;
  }
  const progress = length > .001 ? age >= duration ? 1 : Math.min(1, moved / length) : 0;
  const direction = length > .001 ? { x: (goal.x - origin.x) / length, y: (goal.y - origin.y) / length } : { x: 0, y: 0 };
  return {
    point: { x: origin.x + (goal.x - origin.x) * progress, y: origin.y + (goal.y - origin.y) * progress },
    velocity: { x: direction.x * speed, y: direction.y * speed }, duration: duration * 1000,
  };
}
