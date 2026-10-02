import type { ArenaPoint, ArenaRound } from './arenaLogic';

export type ArenaPairRushOutcome = 'double-out' | 'counter-throw';
type RushRound = ArenaRound & { rushOutcome?: ArenaPairRushOutcome };
export type ArenaPairRushCast = {
  aggressor: string; victim: string; helper: string;
  secondaryVictim?: string; rushOutcome: ArenaPairRushOutcome;
};
export type ArenaPairRushFrame = {
  phase: number; side: number; outcome: ArenaPairRushOutcome;
  stage: 'wrestle' | 'charge' | 'contact' | 'push' | 'rebound' | 'groggy' | 'grip' | 'lift' | 'overhead' | 'toss' | 'release';
  aggressor: ArenaPoint; helper: ArenaPoint; victim: ArenaPoint;
  chargerId: string; pairIds: [string, string];
  chargerFacing: 1 | -1; chargeDirection: ArenaPoint;
  chargeStrength: number; pressure: number; rebound: number; groggy: number;
  contactAt: number; impactStrength: number; victimRecoil: number; helperRecoil: number;
  lift: number; victimAngle: number; victimSuspension: number;
  victimCarryStretch: number; overhead: number;
  victimPose: 'brace' | 'bow' | 'stunned' | 'carried' | undefined;
  grip: 'pair' | 'arms-legs' | undefined;
  carrierPose?: 'drag' | 'grapple' | 'overhead';
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
export function arenaPairRushTargets(round: RushRound, elapsed: number, center: ArenaPoint, chargerOrigin?: ArenaPoint): ArenaPairRushFrame {
  if (!round.helper) throw new RangeError('A pair rush needs its second wrestler');
  const span = Math.max(1, round.impact - round.start);
  const phase = clamp((elapsed - round.start) / span);
  const outcome = round.rushOutcome ?? (round.secondaryVictim ? 'double-out' : 'counter-throw');
  const side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const released = elapsed >= round.impact;
  const origin = chargerOrigin ?? { x: center.x - side * 220, y: center.y + 43 };
  const contact = { x: center.x - side * (outcome === 'double-out' ? 75 : 53), y: center.y + 5 };
  // Start where the third fighter actually stands. A longer runway receives
  // more time rather than moving the fighter backwards to a staging mark.
  const distance = Math.hypot(contact.x - origin.x, contact.y - origin.y);
  // The rim side describes the wrestling/throw layout, not the direction a
  // fighter runs. An actual origin may be on either side or above the pair.
  const chargeDirection = distance > .001 ? { x: (contact.x - origin.x) / distance, y: (contact.y - origin.y) / distance } : { x: side, y: 0 };
  const chargerFacing: 1 | -1 = Math.abs(chargeDirection.x) > .001 ? chargeDirection.x > 0 ? 1 : -1 : side > 0 ? 1 : -1;
  const contactPhase = round.rushContactAt !== undefined ? (round.rushContactAt - round.start) / span : Math.max(.42, .06 + distance * 1500 / (165 * span));
  const contactAt = round.start + span * contactPhase;
  const approach = ease((phase - .06) / Math.max(.001, contactPhase - .06));
  const beat = phase <= contactPhase ? phase / contactPhase * .44 : .44 + (phase - contactPhase) / Math.max(.001, 1 - contactPhase) * .56;
  const impactAge = elapsed - contactAt;
  const impactStrength = impactAge >= 0 && impactAge < span * .06 ? Math.sin(impactAge / (span * .06) * Math.PI) : 0;
  const chargeStrength = phase >= .06 && phase < contactPhase ? Math.sin(clamp((phase - .06) / Math.max(.001, contactPhase - .06)) * Math.PI) : 0;
  const frame: ArenaPairRushFrame = {
    phase, side, outcome, stage: 'wrestle',
    aggressor: { x: center.x, y: center.y }, helper: { x: center.x, y: center.y }, victim: { x: center.x, y: center.y },
    chargerId: outcome === 'double-out' ? round.aggressor : round.victim,
    pairIds: outcome === 'double-out' ? [round.victim, round.helper] : [round.aggressor, round.helper],
    chargerFacing, chargeDirection,
    chargeStrength, pressure: 0, rebound: 0, groggy: 0, lift: 0,
    contactAt, impactStrength, victimRecoil: 0, helperRecoil: 0,
    victimCarryStretch: 0, overhead: 0,
    victimAngle: 0, victimSuspension: 0, victimPose: undefined, grip: released ? undefined : 'pair',
  };
  if (outcome === 'double-out') {
    const pressure = ease((beat - .49) / .51);
    const victimPush = ease((beat - .46) / .54), helperPush = ease((beat - .49) / .51);
    const rimAt = (y: number) => 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((y - 416) / 112) ** 2));
    const victimY = center.y + 14, helperY = center.y - 14;
    frame.victim = { x: mix(center.x + side * 22, rimAt(victimY) - side * 3, victimPush), y: victimY };
    frame.helper = { x: mix(center.x - side * 22, rimAt(helperY) - side * 3, helperPush), y: helperY };
    const rearX = side > 0 ? Math.min(frame.victim.x, frame.helper.x) : Math.max(frame.victim.x, frame.helper.x);
    frame.aggressor = { x: mix(origin.x, rearX - side * 53, approach), y: mix(origin.y, center.y + 5, approach) };
    frame.pressure = pressure;
    frame.victimRecoil = -side * impactStrength * .20;
    frame.helperRecoil = -side * impactStrength * .14;
    frame.stage = released ? 'release' : phase < .06 ? 'wrestle' : phase < contactPhase ? 'charge' : beat < .49 ? 'contact' : 'push';
    return frame;
  }
  const rebound = ease((beat - .44) / .08), fallen = ease((beat - .52) / .08), arrive = ease((beat - .44) / .24);
  const stretch = ease((beat - .62) / .16), lifted = ease((beat - .78) / .14), tossed = ease((beat - .96) / .04);
  // A blocked runner recoils along the incoming path, then stays where they
  // actually fell. Holders approach that body instead of sliding it back to
  // a horizontal staging position when the approach was diagonal or vertical.
  const fallenPoint = { x: contact.x - chargeDirection.x * 18, y: contact.y - chargeDirection.y * 18 };
  const chargerX = mix(origin.x, contact.x, approach) - chargeDirection.x * rebound * 18;
  const chargerY = mix(origin.y, contact.y, approach) - chargeDirection.y * rebound * 18;
  const carriedX = fallenPoint.x + side * tossed * 20;
  frame.victim = { x: mix(chargerX, carriedX, stretch), y: mix(chargerY, fallenPoint.y, stretch) };
  // The former opponents stop wrestling, go to opposite ends of the stunned
  // charger, and keep those arm/ankle holds through the shared lifting stroke.
  // Floor-aware rotation initially shifts the stretched skeleton about 48px
  // toward its toes. Both carriers follow that offset as the body leaves the
  // sand, rather than stretching their arms beyond their anatomical reach.
  const carrierShiftY = fallenPoint.y - contact.y;
  frame.aggressor = { x: mix(center.x + side * 22, carriedX + side * (mix(24, 121, stretch) + lifted * 29.54), arrive), y: center.y + mix(14, mix(10, -4, lifted) + carrierShiftY, arrive) };
  frame.helper = { x: mix(center.x - side * 22, carriedX - side * (mix(85, 89, stretch) - lifted * 67.54), arrive), y: center.y + mix(-14, mix(6, -2, lifted) + carrierShiftY, arrive) };
  frame.rebound = rebound;
  frame.groggy = rebound * (1 - stretch);
  frame.lift = lifted * 142;
  frame.victimCarryStretch = stretch;
  frame.overhead = lifted;
  frame.victimAngle = side * (mix(rebound * .22, Math.PI * .47, fallen) + stretch * Math.PI * .03);
  frame.victimPose = beat >= .62 ? 'carried' : beat >= .52 ? 'stunned' : phase < contactPhase ? undefined : 'brace';
  frame.victimSuspension = beat >= .62 ? lifted : beat >= .52 && beat < .56 ? 1 - ease((beat - .52) / .04) : 0;
  frame.grip = released ? undefined : beat >= .62 ? 'arms-legs' : beat < .44 ? 'pair' : undefined;
  frame.carrierPose = beat < .62 ? 'drag' : 'overhead';
  frame.armsHolderId = round.aggressor; frame.legsHolderId = round.helper;
  frame.stage = released ? 'release' : phase < .06 ? 'wrestle' : phase < contactPhase ? 'charge' : beat < .46 ? 'contact' : beat < .52 ? 'rebound' : beat < .62 ? 'groggy' : beat < .78 ? 'grip' : beat < .92 ? 'lift' : beat < .96 ? 'overhead' : 'toss';
  return frame;
}
