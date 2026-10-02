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
  const take = ease((age - 1300) / 550), flight = clamp((age - 1850) / 700);
  const initial = inside({ x: center.x + side * 23, y: center.y });
  const landing = inside({ x: initial.x + side * 82, y: initial.y + 9 });
  const airborne = age >= 1850 && age < 2550;
  const height = age < 1850 ? take * 42 : age < 2550 ? 42 * (1 - flight) + 78 * 4 * flight * (1 - flight) : 0;
  const turn = side * Math.PI * 2 * flight;
  return {
    active: elapsed >= round.recovery.start && elapsed < round.recovery.end,
    stage: age < 1300 ? 'approach' : age < 1850 ? 'lift' : age < 2550 ? 'somersault' : age < 2750 ? 'land' : 'release',
    side, phase: age / ARENA_RECOVERY_DURATION, airborne,
    thrower: inside({ x: center.x - side * 23, y: center.y }),
    receiver: { x: mix(initial.x, landing.x, flight), y: mix(initial.y, landing.y, flight) },
    height, angle: turn, grip: age >= 1300 && age < 1850,
    landingPhase: clamp((age - 2550) / 200), returnCenter: { x: (center.x - side * 23 + landing.x) / 2, y: (center.y + landing.y) / 2 },
  };
}
