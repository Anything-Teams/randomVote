import type { ArenaPoint, ArenaRound } from './arenaLogic';

export const ARENA_RECOVERY_DURATION = 3100;
export type ArenaRecoveryWindow = { start: number; end: number };
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
  const age = clamp((elapsed - round.recovery.start) / Math.max(1, round.recovery.end - round.recovery.start)) * ARENA_RECOVERY_DURATION;
  const take = ease((age - 1300) / 550), flight = clamp((age - 1850) / 900);
  const initial = inside({ x: center.x + side * 23, y: center.y });
  // Choose a full-distance patch of sand, bending along the rim when a
  // straight outward throw cannot provide room for a safe surviving landing.
  const landing = [0, .50, -.50, .95, -.95, 1.4, -1.4, 1.85, -1.85, Math.PI]
    .map(angle => inside({ x: initial.x + side * Math.cos(angle) * 155, y: initial.y + Math.sin(angle) * 49 + 9 }))
    .sort((a, b) => Math.hypot(b.x - initial.x, b.y - initial.y) - Math.hypot(a.x - initial.x, a.y - initial.y))[0];
  const airborne = age >= 1850 && age < 2750;
  const height = age < 1850 ? take * 42 : age < 2750 ? 42 * (1 - flight) + 158 * 4 * flight * (1 - flight) : 0;
  // Most of the rotation happens around the high part of the arc. The last
  // quarter of the descent lets the straightened feet read before contact.
  const turn = side * Math.PI * 2 * ease((flight - .08) / .76);
  return {
    active: elapsed >= round.recovery.start && elapsed < round.recovery.end,
    stage: age < 1300 ? 'approach' : age < 1850 ? 'lift' : age < 2750 ? 'somersault' : age < 2950 ? 'land' : 'release',
    side, phase: age / ARENA_RECOVERY_DURATION, airborne,
    thrower: inside({ x: center.x - side * 23, y: center.y }),
    receiver: { x: mix(initial.x, landing.x, flight), y: mix(initial.y, landing.y, flight) },
    height, angle: turn, grip: age >= 1300 && age < 1850,
    landingPhase: clamp((age - 2750) / 200), returnCenter: { x: (center.x - side * 23 + landing.x) / 2, y: (center.y + landing.y) / 2 },
  };
}
