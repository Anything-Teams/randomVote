import type { ArenaPoint, ArenaRound } from './arenaLogic';

export type ArenaPairRushOutcome = 'double-out' | 'counter-throw';
type RushRound = ArenaRound & { rushOutcome?: ArenaPairRushOutcome };
export type ArenaPairRushCast = {
  aggressor: string; victim: string; helper: string;
  secondaryVictim?: string; rushOutcome: ArenaPairRushOutcome;
};
export type ArenaPairRushFrame = {
  phase: number; side: number; outcome: ArenaPairRushOutcome;
  stage: 'wrestle' | 'charge' | 'contact' | 'push' | 'rebound' | 'groggy' | 'grip' | 'lift' | 'toss' | 'release';
  aggressor: ArenaPoint; helper: ArenaPoint; victim: ArenaPoint;
  chargerId: string; pairIds: [string, string];
  chargeStrength: number; pressure: number; rebound: number; groggy: number;
  lift: number; victimAngle: number; victimSuspension: number;
  victimPose: 'brace' | 'bow' | 'stunned' | undefined;
  grip: 'pair' | 'arms-legs' | undefined;
  carrierPose?: 'drag' | 'grapple';
  armsHolderId?: string; legsHolderId?: string;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);

/** The caller draws this independent ten-way story roll once per run. */
export function arenaPairRushOutcome(roll: number): ArenaPairRushOutcome {
  if (!Number.isInteger(roll) || roll < 0 || roll > 9) throw new RangeError('Rush story roll must be 0–9');
  return roll < 3 ? 'double-out' : 'counter-throw';
}

/** Cast the same story around the already drawn losers; no finish order is changed. */
export function arenaPairRushCast(living: readonly string[], roll: number, selector = 0): ArenaPairRushCast {
  if (living.length < 3 || new Set(living).size !== living.length) throw new RangeError('A pair rush needs three distinct living fighters');
  const rushOutcome = arenaPairRushOutcome(roll), victim = living.at(-1)!;
  const pool = living.slice(0, rushOutcome === 'double-out' ? -2 : -1);
  const slot = (selector >>> 0) % pool.length, aggressor = pool[slot];
  if (rushOutcome === 'double-out') {
    const helper = living.at(-2)!;
    return { aggressor, victim, helper, secondaryVictim: helper, rushOutcome };
  }
  const helpers = pool.filter(id => id !== aggressor);
  return { aggressor, victim, helper: helpers[((selector >>> 5) + 1) % helpers.length], rushOutcome };
}

/** A rushing third fighter either breaks the pair's footing or is caught by both. */
export function arenaPairRushTargets(round: RushRound, elapsed: number, center: ArenaPoint): ArenaPairRushFrame {
  if (!round.helper) throw new RangeError('A pair rush needs its second wrestler');
  const phase = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const outcome = round.rushOutcome ?? (round.secondaryVictim ? 'double-out' : 'counter-throw');
  const side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const released = elapsed >= round.impact;
  const approach = ease((phase - .15) / .23);
  const chargeStrength = phase >= .15 && phase < .44 ? Math.sin(clamp((phase - .15) / .29) * Math.PI) : 0;
  const frame: ArenaPairRushFrame = {
    phase, side, outcome, stage: 'wrestle',
    aggressor: { x: center.x, y: center.y }, helper: { x: center.x, y: center.y }, victim: { x: center.x, y: center.y },
    chargerId: outcome === 'double-out' ? round.aggressor : round.victim,
    pairIds: outcome === 'double-out' ? [round.victim, round.helper] : [round.aggressor, round.helper],
    chargeStrength, pressure: 0, rebound: 0, groggy: 0, lift: 0,
    victimAngle: 0, victimSuspension: 0, victimPose: undefined, grip: released ? undefined : 'pair',
  };
  if (outcome === 'double-out') {
    const pressure = ease((phase - .49) / .51);
    const rimAt = (y: number) => 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((y - 416) / 112) ** 2));
    const victimY = center.y + 14, helperY = center.y - 14;
    frame.victim = { x: mix(center.x + side * 22, rimAt(victimY) - side * 3, pressure), y: victimY };
    frame.helper = { x: mix(center.x - side * 22, rimAt(helperY) - side * 3, pressure), y: helperY };
    const rearX = side > 0 ? Math.min(frame.victim.x, frame.helper.x) : Math.max(frame.victim.x, frame.helper.x);
    frame.aggressor = { x: mix(center.x - side * 90, rearX - side * 53, approach), y: center.y + mix(43, 5, approach) };
    frame.pressure = pressure;
    frame.stage = released ? 'release' : phase < .15 ? 'wrestle' : phase < .38 ? 'charge' : phase < .49 ? 'contact' : 'push';
    return frame;
  }
  const rebound = ease((phase - .44) / .08), fallen = ease((phase - .52) / .08), reach = ease((phase - .62) / .12), arrive = ease((phase - .52) / .22);
  const lifted = ease((phase - .74) / .16), tossed = ease((phase - .90) / .10);
  const chargerX = center.x - side * (mix(90, 53, approach) + rebound * 18);
  const carriedX = center.x - side * 40 + side * tossed * 20;
  frame.victim = { x: mix(chargerX, carriedX, reach), y: center.y + mix(43, 5, approach) * (1 - reach) };
  // The former opponents stop wrestling, go to opposite ends of the stunned
  // charger, and keep those arm/ankle holds through the shared lifting stroke.
  frame.aggressor = { x: mix(center.x + side * 22, carriedX + side * 24, arrive), y: center.y + mix(14, 2, arrive) };
  frame.helper = { x: mix(center.x - side * 22, carriedX - side * 70, arrive), y: center.y + mix(-14, -6, arrive) };
  frame.rebound = rebound;
  frame.groggy = rebound * (1 - reach);
  frame.lift = lifted * 48;
  frame.victimAngle = side * mix(rebound * .22, Math.PI * .47, fallen);
  frame.victimPose = phase >= .52 ? 'stunned' : 'brace';
  frame.victimSuspension = phase >= .52 && phase < .56 ? 1 - ease((phase - .52) / .04) : 0;
  frame.grip = released ? undefined : phase >= .62 ? 'arms-legs' : phase < .44 ? 'pair' : undefined;
  frame.carrierPose = phase < .84 ? 'drag' : 'grapple';
  frame.armsHolderId = round.aggressor; frame.legsHolderId = round.helper;
  frame.stage = released ? 'release' : phase < .15 ? 'wrestle' : phase < .38 ? 'charge' : phase < .44 ? 'contact' : phase < .52 ? 'rebound' : phase < .62 ? 'groggy' : phase < .74 ? 'grip' : phase < .90 ? 'lift' : 'toss';
  return frame;
}
