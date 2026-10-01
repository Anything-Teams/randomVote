import type { ArenaPoint, ArenaRound, ArenaThrowFrame } from './arenaLogic';

export const arenaFinalTechniques = ['armspin', 'trip', 'suplex', 'sidekick'] as const;
export type ArenaFinalTechnique = typeof arenaFinalTechniques[number];
export const isArenaFinalTechnique = (round: ArenaRound): boolean => arenaFinalTechniques.includes(round.tactic as ArenaFinalTechnique);
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const ease = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);

/** A short blocked attempt precedes the finishing contact. All targets stay relative to the current pair. */
export function arenaTechniqueTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const phase = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = center.x < 500 ? -1 : 1;
  const probe = Math.sin(clamp((phase - .08) / .20) * Math.PI);
  const frame = {
    stage: phase < .08 ? 'approach' : phase < .20 ? 'probe' : phase < .30 ? 'reset' : 'grip', side, phase,
    aggressor: { x: center.x - side * (24 - probe * 7), y: center.y },
    victim: { x: center.x + side * (24 + probe * 5), y: center.y + probe * 3 },
    lift: 0, victimAngle: 0, aggressorAngle: 0, aggressorLift: 0, yaw: 0,
    grip: phase >= .30 ? 'waist' as 'wrist' | 'waist' | 'ankle' | undefined : phase < .20 && phase >= .08 ? 'waist' : undefined,
    contact: 0,
  };
  if (phase < .30) return frame;
  if (round.tactic === 'armspin') {
    const turn = ease((phase - .48) / .52), angle = turn * Math.PI * 1.5;
    const radius = Math.min(40, Math.max(18, (round.impact - round.start) / 1000 * .52 * 150 / (Math.PI * 1.5 * 1.5)));
    const take = ease((phase - .30) / .18);
    frame.aggressor.x = center.x - side * mix(24, 14, take);
    frame.victim = { x: frame.aggressor.x + side * mix(48, radius, take) * Math.cos(angle), y: center.y + Math.sin(angle) * radius * .42 };
    frame.yaw = angle; frame.lift = ease((phase - .52) / .25) * 22;
    frame.grip = phase >= .30 && elapsed < round.impact ? 'wrist' : undefined;
    frame.stage = phase < .30 ? frame.stage : phase < .48 ? 'wrist' : elapsed < round.impact ? 'pivot' : 'release';
  } else if (round.tactic === 'trip') {
    const hook = ease((phase - .43) / .16), fall = ease((phase - .64) / .36);
    frame.aggressor.x = center.x - side * (24 - hook * 6);
    frame.victim.x = center.x + side * (24 + fall * 15);
    frame.contact = hook * (1 - fall);
    frame.victimAngle = side * Math.PI * .46 * fall;
    frame.lift = Math.sin(fall * Math.PI) * 8;
    frame.grip = phase >= .30 && phase < .74 ? 'waist' : undefined;
    frame.stage = phase < .30 ? frame.stage : phase < .43 ? 'grip' : phase < .64 ? 'hook' : elapsed < round.impact ? 'fall' : 'roll';
  } else if (round.tactic === 'suplex') {
    const lift = ease((phase - .34) / .22), arch = ease((phase - .56) / .34);
    const take = ease((phase - .30) / .04);
    frame.aggressor.x = center.x - side * mix(24, 22, take);
    frame.victim.x = frame.aggressor.x + side * mix(mix(48, 45, take), -38, arch);
    frame.victim.y = center.y + arch * 3;
    frame.lift = lift * 48 * (1 - arch);
    frame.victimAngle = -side * Math.PI * .47 * arch;
    frame.grip = phase >= .30 && phase < .90 ? 'waist' : undefined;
    frame.stage = phase < .30 ? frame.stage : phase < .34 ? 'grip' : phase < .56 ? 'lift' : phase < .90 ? 'arch' : elapsed < round.impact ? 'stunned' : 'drag';
  } else if (round.tactic === 'sidekick') {
    const jump = ease((phase - .38) / .22), strike = ease((phase - .68) / .14), recoil = ease((phase - .82) / .18);
    frame.aggressor.x = center.x - side * (24 - jump * 6 + recoil * 7);
    frame.victim.x = center.x + side * (24 + recoil * 16);
    frame.aggressorLift = Math.sin(jump * Math.PI / 2) * 24 * (1 - recoil);
    frame.contact = strike * (1 - recoil);
    frame.lift = recoil * 24; frame.victimAngle = side * recoil * .32;
    frame.grip = undefined;
    frame.stage = phase < .30 ? frame.stage : phase < .38 ? 'plant' : phase < .60 ? 'first-kick' : phase < .82 ? 'second-kick' : elapsed < round.impact ? 'impact' : 'release';
  }
  return frame;
}

/** Tripping rolls along the floor. A suplex leaves a brief stunned pause before an ankle drag. */
export function arenaTechniqueExit(round: ArenaRound, age: number, origin: ArenaPoint, landing: ArenaPoint, direction: number, unit = 1, preparation = { lift: 0, angle: 0 }): ArenaThrowFrame | undefined {
  const ms = Math.max(0, age / Math.max(.001, unit));
  if (round.tactic === 'trip') {
    if (ms < 880) {
      const phase = clamp(ms / 880), groundX = mix(origin.x, landing.x, ease(phase)), groundY = mix(origin.y, landing.y, ease(phase));
      const height = preparation.lift * (1 - ease(phase));
      return { x: groundX, y: groundY - height, groundX, groundY, height, angle: preparation.angle + direction * Math.PI * 2 * ease(phase), phase, stage: 'roll' };
    }
  } else if (round.tactic === 'suplex') {
    const finish = Math.max(880, (round.resolve - round.impact) / Math.max(.001, unit) - 200);
    if (ms < 300) return { ...origin, groundX: origin.x, groundY: origin.y, height: 0, angle: preparation.angle, phase: ms / 300, stage: 'stunned' };
    if (ms < finish) {
      const phase = clamp((ms - 300) / (finish - 300)), ramp = .12;
      const cruise = (phase < ramp ? phase ** 2 / (2 * ramp) : phase > 1 - ramp ? 1 - ramp - (1 - phase) ** 2 / (2 * ramp) : phase - ramp / 2) / (1 - ramp);
      const groundX = mix(origin.x, landing.x, cruise), groundY = mix(origin.y, landing.y, cruise);
      return { x: groundX, y: groundY, groundX, groundY, height: 0, angle: preparation.angle, phase, stage: 'drag' };
    }
    if (ms < finish + 200) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: preparation.angle, phase: (ms - finish) / 200, stage: 'stunned' };
    if (ms < finish + 700) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: preparation.angle * (1 - ease((ms - finish - 200) / 500)), phase: (ms - finish - 200) / 500, stage: 'recover' };
    return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: 1, stage: 'walk' };
  } else return undefined;
  if (ms < 1100) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: preparation.angle + direction * Math.PI * 2, phase: (ms - 880) / 220, stage: 'land' };
  if (ms < 1600) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: direction * Math.PI * 2 + preparation.angle * (1 - ease((ms - 1100) / 500)), phase: (ms - 1100) / 500, stage: 'recover' };
  return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: direction * Math.PI * 2, phase: 1, stage: 'walk' };
}
