const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (from: number, to: number, progress: number) => from + (to - from) * clamp(progress);

/** The existing overhead lift, shoulder landing and limp floor recovery. */
export function arenaOverheadSlamMotion(phase: number, side: number) {
  const lift = ease((phase - .34) / .30), drop = clamp((phase - .76) / .12);
  const slam = drop ** 2, turn = ease((phase - .76) / .12);
  const overhead = phase >= .34 && phase < .88;
  return {
    lift, drop, slam, turn,
    height: lift * 100 * (1 - slam),
    angle: side * Math.PI * .53 * turn,
    overheadRaise: lift * (1 - slam),
    suspension: overhead ? 1 - turn : 0,
    victimSlam: phase >= .34 ? { tuck: lift, slump: ease((phase - .88) / .06) } : undefined,
    impact: phase >= .88 && phase < .96 ? 1 - ease((phase - .88) / .08) : 0,
    gripping: phase >= .30 && phase < .76,
    overhead,
    victimOffsetX: mix(43, 12, lift) + slam * 14,
    victimOffsetY: slam * 3,
  };
}
