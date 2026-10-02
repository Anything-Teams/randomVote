import type { ArenaPoint, ArenaRound } from './arenaLogic';

export const ARENA_RECOVERY_THROW_SPAN = 3900;
export const ARENA_RECOVERY_EXIT_DURATION = 1250;
export const ARENA_RECOVERY_DURATION = ARENA_RECOVERY_THROW_SPAN + ARENA_RECOVERY_EXIT_DURATION;
export type ArenaRecoveryWindow = { start: number; end: number; throwAt?: number };
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const ease = (p: number) => { const t = clamp(p); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const inside = (point: ArenaPoint): ArenaPoint => {
  const radius = Math.hypot((point.x - 500) / 255, (point.y - 416) / 76);
  return radius <= 1 ? point : { x: 500 + (point.x - 500) / radius, y: 416 + (point.y - 416) / radius };
};

/** A rare failed throw is a real airborne somersault and feet-first landing on the sand. */
export function arenaRecoveryTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  if (!round.recovery) return undefined;
  const side = round.contactSide ?? (center.x < 500 ? -1 : 1);
  const unit = Math.max(.001, round.timeScale ?? 1);
  const age = Math.max(0, (elapsed - round.recovery.start) / unit);
  const throwSpan = round.recovery.throwAt === undefined ? ARENA_RECOVERY_THROW_SPAN : (round.recovery.throwAt - round.recovery.start) / unit;
  const progress = clamp(age / Math.max(1, throwSpan)), take = ease((progress - .72) / .28);
  // Match a normal thrown exit: 40ms release hold followed by 840ms flight.
  const throwAge = age - throwSpan, flight = clamp((throwAge - 40) / 840);
  const initial = inside({ x: center.x + side * 23, y: center.y });
  // Choose a full-distance patch of sand, bending along the rim when a
  // straight outward throw cannot provide room for a safe surviving landing.
  const landing = [0, .50, -.50, .95, -.95, 1.4, -1.4, 1.85, -1.85, Math.PI]
    .map(angle => inside({ x: initial.x + side * Math.cos(angle) * 155, y: initial.y + Math.sin(angle) * 49 + 9 }))
    .sort((a, b) => Math.hypot(b.x - initial.x, b.y - initial.y) - Math.hypot(a.x - initial.x, a.y - initial.y))[0];
  const landed = throwAge >= 880 - 1e-8, airborne = throwAge >= 0 && !landed;
  const height = throwAge < 0 ? take * 42 : !landed ? 42 * (1 - ease(flight)) + 158 * 4 * flight * (1 - flight) : 0;
  // Most of the rotation happens around the high part of the arc. The last
  // quarter of the descent lets the straightened feet read before contact.
  const turn = side * Math.PI * 2 * ease((flight - .08) / .76);
  return {
    active: elapsed >= round.recovery.start && elapsed < round.recovery.end,
    stage: progress < .30 ? 'approach' : progress < .52 ? 'hold' : throwAge < 0 ? 'lift' : !landed ? 'somersault' : throwAge < 1100 ? 'land' : 'release',
    side, phase: throwAge < 0 ? take : clamp(throwAge / 350), airborne,
    thrower: inside({ x: center.x - side * 23, y: center.y }),
    receiver: { x: mix(initial.x, landing.x, flight), y: mix(initial.y, landing.y, flight) },
    height, angle: turn, grip: progress >= .30 && throwAge < 0,
    throwAt: round.recovery.throwAt ?? round.recovery.start + throwSpan * unit,
    flightPhase: flight, throwPhase: clamp(throwAge / 350), liftPhase: take,
    landingPhase: clamp((throwAge - 880) / 220), returnCenter: { x: (center.x - side * 23 + landing.x) / 2, y: (center.y + landing.y) / 2 },
  };
}
