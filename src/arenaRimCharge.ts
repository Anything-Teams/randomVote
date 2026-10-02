import type { ArenaPoint, ArenaRound } from './arenaLogic';

export const ARENA_RIM_CHARGE_DURATION = 2600;
export type ArenaRimChargeOutcome = 'dodge' | 'resist';
export type ArenaRimChargeWindow = { start: number; end: number; outcome: ArenaRimChargeOutcome };
export type ArenaRimChargeOrigins = { charger: ArenaPoint; defender: ArenaPoint };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const pointMix = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: a.x + (b.x - a.x) * clamp(p), y: a.y + (b.y - a.y) * clamp(p) });
const inside = (point: ArenaPoint): ArenaPoint => {
  const r = Math.hypot((point.x - 500) / 280, (point.y - 416) / 82);
  return r <= 1 ? point : { x: 500 + (point.x - 500) / r, y: 416 + (point.y - 416) / r };
};

/** An independent ten-way story roll never participates in the rank draw. */
export function arenaRimChargeOutcome(roll: number): ArenaRimChargeOutcome {
  if (!Number.isInteger(roll) || roll < 0 || roll > 9) throw new RangeError('Charge story roll must be 0–9');
  return roll < 3 ? 'dodge' : 'resist';
}

/** The drawn loser charges; an aligned defender either dodges or plants to fight. */
export function arenaRimChargeTargets(round: ArenaRound, elapsed: number, center: ArenaPoint, origins?: ArenaRimChargeOrigins) {
  const window = round.rimCharge;
  if (!window) return undefined;
  const duration = Math.max(1, window.end - window.start), phase = clamp((elapsed - window.start) / duration);
  const side = (origins ? origins.defender.x >= origins.charger.x : center.x >= 500) ? 1 : -1;
  const pace = Math.min(1, round.timeScale ?? 1), outcome = window.outcome;
  const initialCharger = origins?.charger ?? inside({ x: center.x - side * 108 * pace, y: center.y });
  const initialDefender = origins?.defender ?? inside({ x: center.x + side * 23 * pace, y: center.y });
  const contact = { x: initialDefender.x - side * 35, y: initialDefender.y };
  const rimX = 500 + side * (303 * Math.sqrt(Math.max(0, 1 - ((contact.y - 416) / 112) ** 2)) - 2);
  const canRun = Math.hypot(contact.x - initialCharger.x, contact.y - initialCharger.y) / (duration / 1000 * .56 * .91) <= 165;
  const canReachRim = Math.abs(rimX - contact.x) / (duration / 1000 * .32) <= 165;
  const run = clamp((phase - .12) / .56), drive = (run < .18 ? run * run / .36 : run - .09) / .91;
  const contactAt = window.start + duration * .68;
  const charge = clamp(drive), dodge = outcome === 'dodge' ? ease((phase - .48) / .20) : 0;
  const resistance = outcome === 'resist' ? ease((phase - .64) / .13) : 0;
  const release = ease((phase - .83) / .17);
  let charger = pointMix(initialCharger, contact, charge);
  let defender = { ...initialDefender };
  if (outcome === 'dodge') {
    defender = inside({ x: initialDefender.x - side * 5 * dodge * pace, y: initialDefender.y + (initialDefender.y <= 416 ? 1 : -1) * 50 * dodge * pace });
    if (phase >= .68) {
      charger = pointMix(contact, { x: rimX, y: contact.y }, (phase - .68) / .32);
    }
  } else if (phase >= .68) {
    const press = Math.sin(clamp((phase - .68) / .15) * Math.PI / 2) * 8 * pace;
    charger = inside({ x: contact.x + side * press, y: contact.y + release * 6 * pace });
    defender = inside({ x: initialDefender.x + side * press * .40, y: initialDefender.y + release * 6 * pace });
  }
  const stage = elapsed >= window.end ? 'done' : phase < .12 ? 'approach' : phase < .48 ? 'charge' : outcome === 'dodge' ? phase < .68 ? 'dodge' : 'out' : phase < .68 ? 'charge' : phase < .83 ? 'brace' : 'duel';
  return { active: elapsed >= window.start && elapsed < window.end, stage, phase, side: side as 1 | -1, outcome,
    chargerId: round.victim, defenderId: round.aggressor, charger, defender, contactAt, canRun, canReachRim,
    chargerFacing: side as 1 | -1, defenderFacing: -side as 1 | -1,
    charge, dodge, resistance, grip: outcome === 'resist' && phase >= .68 && elapsed < window.end,
    out: outcome === 'dodge' && elapsed >= window.end, release,
    returnCenter: { x: (charger.x + defender.x) / 2, y: (charger.y + defender.y) / 2 } };
}
