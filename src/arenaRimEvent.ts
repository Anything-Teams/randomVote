import type { ArenaPoint, ArenaRound } from './arenaLogic';

export const ARENA_RIM_DURATION = 2200;
export type ArenaRimOutcome = 'out' | 'resist';
export type ArenaRimWindow = { start: number; end: number; outcome: ArenaRimOutcome; contactAt?: number | null };
export type ArenaRimFrame = {
  active: boolean; stage: 'approach' | 'pressure' | 'brace' | 'release' | 'done';
  phase: number; side: 1 | -1; outcome: ArenaRimOutcome;
  aggressor: ArenaPoint; victim: ArenaPoint; returnCenter: ArenaPoint;
  pressure: number; resistance: number; release: number; grip: boolean;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, progress: number) => a + (b - a) * clamp(progress);
const drive = (value: number) => { const p = clamp(value); return (p < .2 ? p * p / .4 : p - .1) / .9; };
const pointMix = (a: ArenaPoint, b: ArenaPoint, progress: number): ArenaPoint => ({ x: mix(a.x, b.x, progress), y: mix(a.y, b.y, progress) });
const inside = (point: ArenaPoint): ArenaPoint => {
  const radius = Math.hypot((point.x - 500) / 282, (point.y - 416) / 82);
  return radius <= 1 ? point : { x: 500 + (point.x - 500) / radius, y: 416 + (point.y - 416) / radius };
};

/** A ten-way cosmetic roll decides whether the rim push works; ranks remain supplied by the draw. */
export function arenaRimOutcome(roll: number): ArenaRimOutcome {
  if (!Number.isInteger(roll) || roll < 0 || roll > 9) throw new RangeError('Rim story roll must be 0–9');
  return roll < 3 ? 'out' : 'resist';
}

/** A planted defender can break a rim push and resume the encounter where it ended. */
export function arenaRimTargets(round: ArenaRound, elapsed: number, center: ArenaPoint, origins?: { aggressor: ArenaPoint; victim: ArenaPoint }): ArenaRimFrame | undefined {
  const window = round.rim;
  if (!window) return undefined;
  const side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const phase = clamp((elapsed - window.start) / Math.max(1, window.end - window.start));
  const pace = Math.min(1, round.timeScale ?? 1);
  const aStart = origins?.aggressor ?? inside({ x: center.x - side * 26, y: center.y });
  const vStart = origins?.victim ?? inside({ x: center.x + side * 26, y: center.y });
  const meeting = { x: (aStart.x + vStart.x) / 2, y: (aStart.y + vStart.y) / 2 };
  const aContact = origins ? inside({ x: meeting.x - side * 25, y: meeting.y }) : inside({ x: aStart.x + side * 4 * pace, y: aStart.y });
  const vContact = origins ? inside({ x: meeting.x + side * 25, y: meeting.y }) : inside({ x: vStart.x - side * 4 * pace, y: vStart.y });
  const approachMs = Math.max(600 * pace, Math.max(Math.hypot(aContact.x - aStart.x, aContact.y - aStart.y), Math.hypot(vContact.x - vStart.x, vContact.y - vStart.y)) * 1500 / 140);
  const approach = ease((elapsed - window.start) / approachMs);
  const contactAt = window.contactAt === null ? Infinity : window.contactAt ?? window.start + (window.end - window.start) * 600 / ARENA_RIM_DURATION;
  const pressurePhase = clamp((elapsed - contactAt) / Math.max(1, window.end - contactAt));
  const pressure = ease(pressurePhase / (700 / 1600));
  const resistance = window.outcome === 'resist' ? ease((pressurePhase - 450 / 1600) / (350 / 1600)) : 0;
  const release = window.outcome === 'resist' ? ease((pressurePhase - 1100 / 1600) / (500 / 1600)) : 0;
  let aggressor: ArenaPoint, victim: ArenaPoint;
  if (window.outcome === 'out') {
    const rim = 500 + side * (303 * Math.sqrt(Math.max(0, 1 - ((vContact.y - 416) / 112) ** 2)) - 3);
    const push = drive(pressurePhase), delta = (rim - vContact.x) * push;
    victim = { x: mix(vStart.x, vContact.x, approach) + delta, y: mix(vStart.y, vContact.y, approach) };
    aggressor = { x: mix(aStart.x, aContact.x, approach) + delta, y: mix(aStart.y, aContact.y, approach) };
  } else {
    // The same two feet move outward under pressure, then step free after
    // the defender plants. Neither survivor is pulled back to an old home.
    const shift = side * (22 * pressure - 6 * release) * pace;
    aggressor = pointMix(aStart, inside({ x: aContact.x + shift - side * 4 * release * pace, y: aContact.y + 6 * release * pace }), approach);
    victim = pointMix(vStart, inside({ x: vContact.x + shift + side * 4 * release * pace, y: vContact.y + 6 * release * pace }), approach);
  }
  const stage = elapsed >= window.end ? 'done' : elapsed < contactAt ? 'approach' : window.outcome === 'out' || pressurePhase < 700 / 1600 ? 'pressure' : pressurePhase < 1100 / 1600 ? 'brace' : 'release';
  return { active: elapsed >= window.start && elapsed < window.end, stage, phase, side, outcome: window.outcome, aggressor, victim,
    returnCenter: { x: (aggressor.x + victim.x) / 2, y: (aggressor.y + victim.y) / 2 },
    pressure, resistance, release, grip: elapsed >= window.start && elapsed < window.end && approach > .75 && release < .2 };
}
