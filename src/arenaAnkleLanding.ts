/** A short sand-impact reaction after the thrown body reaches the ground. */
export type ArenaAnkleLanding = {
  bounce: number;
  rotation: number;
  shake: number;
  impact: number;
  dust: number;
  dustProgress: number;
};

export const ARENA_ANKLE_LANDING_TIMING = { recoil: 150, impact: 180, dust: 450 } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Sample actual time since contact; negative time has no landing reaction. */
export function arenaAnkleLanding(ageMs: number, direction: number): ArenaAnkleLanding {
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { bounce: 0, rotation: 0, shake: 0, impact: 0, dust: 0, dustProgress: 0 };
  }
  const timing = ARENA_ANKLE_LANDING_TIMING;
  const side = Number.isFinite(direction) ? Math.sign(direction) : 0;
  const recoil = clamp(ageMs / timing.recoil);
  // One soft rebound returns to the same resting position with zero speed.
  const pulse = ageMs > 0 && ageMs < timing.recoil ? Math.sin(Math.PI * recoil) ** 2 : 0;
  const shake = ageMs > 0 && ageMs < timing.recoil
    ? side * 4.5 * Math.sin(Math.PI * 6 * recoil) * (1 - recoil) ** 2
    : 0;
  const dustAge = clamp(ageMs / timing.dust);
  return {
    bounce: 7 * pulse,
    rotation: pulse > 0 ? side * .10 * pulse : 0,
    shake,
    impact: (1 - clamp(ageMs / timing.impact)) ** 3,
    dust: (1 - dustAge) ** 2,
    // The first 180 ms cover most of the expanding sand cloud.
    dustProgress: 1 - (1 - dustAge) ** 3,
  };
}
