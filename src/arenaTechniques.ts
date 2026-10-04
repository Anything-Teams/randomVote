import type { ArenaPoint, ArenaRound, ArenaThrowFrame } from './arenaLogic';

export const arenaFinalTechniques = ['armspin', 'trip', 'suplex', 'sidekick', 'elbow'] as const;
export type ArenaFinalTechnique = typeof arenaFinalTechniques[number];
/** The renderer anchors both wrists, then lays the body outward from them. */
export type ArenaArmSpinFrame = { orbit: number; flatness: number; weight: number };
export const isArenaFinalTechnique = (round: ArenaRound): boolean => arenaFinalTechniques.includes(round.tactic as ArenaFinalTechnique);
export const isArenaFloorDrag = (round: ArenaRound): boolean => round.tactic === 'suplex' || round.tactic === 'elbow';
/** Shared physical deadlines after a grounded knockout, in scaled elapsed milliseconds. */
export function arenaFloorExitTiming(round: ArenaRound, unit = round.timeScale ?? 1) {
  const scale = Math.max(.001, unit);
  const finish = Math.max(1100, Math.min(2600, (round.resolve - round.impact) / scale - 1400));
  // The elbow sequence already approaches and takes the actual ankles before
  // this clock starts. Repeating the pickup pause here stopped both bodies.
  const pickup = round.tactic === 'elbow' ? 0 : 900;
  const dragEnd = pickup + finish - 900;
  return { stunnedUntil: pickup * scale, dragUntil: dragEnd * scale, tossUntil: (dragEnd + 880) * scale, landUntil: (dragEnd + 1080) * scale, recoverUntil: (dragEnd + 1580) * scale };
}
/** A single quick jump keeps the airborne kick independent of the bout's introduction. */
export function arenaSidekickWindow(round: ArenaRound) {
  const span = Math.max(1, round.impact - round.start), unit = Math.min(1, round.timeScale ?? 1);
  const duration = Math.min(650 * Math.max(.001, unit), span * .68);
  const start = round.sidekickLaunchAt ?? round.start + Math.min(650 * Math.max(.001, unit), span * .30);
  return { start, end: start + duration, contactAt: start + duration * .50, duration };
}
/** Physical recoil starts at the sole's first full contact, before the ranking reveal. */
export function arenaTechniqueReactionAt(round: ArenaRound): number {
  if (round.tactic === 'sidekick') return arenaSidekickWindow(round).contactAt;
  const fraction = round.tactic === 'trip' ? .80 : 1;
  return round.start + (round.impact - round.start) * fraction;
}
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const ease = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);

/** A short blocked attempt precedes the finishing contact. All targets stay relative to the current pair. */
export function arenaTechniqueTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const span = Math.max(1, round.impact - round.start), rawPhase = clamp((elapsed - round.start) / span);
  let phase = rawPhase;
  if (round.tactic === 'suplex' && round.suplexGripAt !== undefined) {
    const gripAt = round.suplexGripAt;
    if (gripAt === null || elapsed < gripAt) phase = Math.min(rawPhase, .20);
    else {
      const contestSpan = Math.min(span * .14, Math.max(1, (round.impact - gripAt) * .24));
      const loadedAt = gripAt + contestSpan;
      phase = elapsed < loadedAt ? .20 + .14 * clamp((elapsed - gripAt) / contestSpan) : .34 + .66 * clamp((elapsed - loadedAt) / Math.max(1, round.impact - loadedAt));
    }
  }
  const side = round.contactSide ?? (center.x < 500 ? -1 : 1);
  const probe = round.tactic === 'sidekick' ? 0 : Math.sin(clamp((phase - .08) / .20) * Math.PI);
  const frame = {
    stage: phase < .08 ? 'approach' : phase < .20 ? 'probe' : phase < .30 ? 'reset' : 'grip', side, phase,
    aggressor: { x: center.x - side * (24 + probe * (round.tripCounter ? 5 : -7)), y: center.y },
    victim: { x: center.x + side * (24 + probe * (round.tripCounter ? -4 : 5)), y: center.y + probe * 3 },
    lift: 0, victimAngle: 0, aggressorAngle: 0, aggressorLift: 0, yaw: 0, victimSuspension: 0, victimPose: undefined as 'held' | 'stunned' | 'roll' | 'airborne' | 'brace' | undefined,
    grip: phase >= .30 ? 'waist' as 'wrist' | 'waist' | 'ankle' | undefined : phase < .20 && phase >= .08 ? 'waist' : undefined,
    contact: 0,
    spin: undefined as ArenaArmSpinFrame | undefined,
    victimSlam: undefined as { tuck: number; slump: number } | undefined,
    victimFloorRig: undefined as { pose: 'stunned'; phase: number; angle: number; suspension: number } | undefined,
    slamImpact: 0,
    aggressorPose: undefined as 'overhead' | 'elbow' | 'drag' | 'throw' | 'grapple' | undefined,
    aggressorEffort: undefined as number | undefined,
    victimEffort: undefined as number | undefined,
    aggressorLiftPreparation: undefined as number | undefined,
    aggressorOverheadRaise: 0,
    aggressorFacing: undefined as number | undefined,
    victimLift: 0,
    aggressorSuspension: 0,
    victimGrip: undefined as 'waist' | undefined,
    elbowContact: 0,
    elbowImpact: 0,
    kickReactionAt: arenaTechniqueReactionAt(round),
    reactionProgress: 0,
    frontKick: undefined as number | undefined,
    exitDirection: side,
  };
  if (round.tactic === 'suplex' && round.suplexGripAt === null && phase >= .20) {
    frame.grip = 'waist'; frame.stage = 'grip';
    return frame;
  }
  if (round.tactic === 'suplex' && phase >= .20 && phase < .34) {
    const contest = clamp((phase - .20) / .14), load = Math.sin(contest * Math.PI) ** 2;
    const sway = Math.sin(contest * Math.PI * 2) * load * 3, take = ease((phase - .30) / .04);
    frame.aggressor.x = center.x - side * mix(24 - probe * 7, 22, take) + side * sway;
    frame.victim.x = frame.aggressor.x + side * mix(48 - probe * 2, 43, take);
    frame.aggressor.y = center.y + sway * .22;
    frame.victim.y = center.y + probe * 3 * (1 - take) + sway * .22;
    frame.aggressorEffort = load; frame.victimEffort = load * .9;
    frame.aggressorLiftPreparation = take;
    frame.aggressorPose = 'grapple'; frame.victimPose = 'brace'; frame.grip = 'waist'; frame.stage = 'grip';
    return frame;
  }
  if (phase < .30 && round.tactic !== 'sidekick') return frame;
  if (round.tactic === 'armspin') {
    const progress = clamp((phase - .44) / .56), ramp = .24;
    // Integrate a short angular acceleration followed by a steady spin. A
    // smoothstep would brake to a stop just before the hands release.
    const turn = (progress < ramp ? progress ** 2 / (2 * ramp) : progress - ramp / 2) / (1 - ramp / 2);
    const angle = turn === 0 ? 0 : side * turn * Math.PI * 4;
    const orbit = (side < 0 ? Math.PI : 0) + angle;
    const weight = ease((phase - .44) / .18);
    const take = ease((phase - .30) / .14);
    frame.aggressor.x = center.x - side * mix(24, 14, take);
    // These are scene layout targets, not a second lift or a foot-root rotation.
    // The actual suspended skeleton is derived from the two painted hand anchors.
    const radius = mix(48, 112, weight);
    frame.victim = { x: frame.aggressor.x + Math.cos(orbit) * radius, y: center.y + Math.sin(orbit) * radius * .20 - weight * 24 };
    frame.yaw = angle;
    frame.spin = { orbit, flatness: .94, weight };
    frame.victimPose = phase >= .44 ? 'held' : undefined;
    frame.grip = phase >= .30 && elapsed < round.impact ? 'wrist' : undefined;
    frame.stage = phase < .30 ? frame.stage : phase < .44 ? 'wrist' : elapsed < round.impact ? 'pivot' : 'release';
  } else if (round.tactic === 'trip') {
    const hook = ease((phase - .40) / .08), fall = ease((phase - .54) / .10);
    const step = ease((phase - .64) / .08), frontKick = clamp((phase - .72) / (.08 / .62)), recoil = ease((phase - .80) / .20);
    // Fold the knee before extending the shin. Full extension and the first
    // roll share the exact .62 point of this one forward-kick stroke.
    const kick = ease((frontKick - .40) / .22) * (1 - ease((frontKick - .62) / .16));
    frame.frontKick = phase >= .72 ? frontKick : undefined;
    frame.aggressor.x = center.x - side * (24 - hook * 6 - step * 4);
    frame.victim.x = center.x + side * (24 + recoil * 12);
    // The first full sole contact launches the roll. Withdraw promptly so the
    // kicker does not chase the departing body with an attached foot.
    frame.contact = phase < .54 ? hook * (1 - ease((phase - .51) / .03)) : kick;
    frame.reactionProgress = recoil;
    frame.victimAngle = side * Math.PI * (.47 * fall + .08 * recoil);
    frame.victimSuspension = phase >= .54 && phase < .58 ? 1 - ease((phase - .54) / .04) : 0;
    frame.victimPose = phase >= .80 ? 'roll' : phase >= .54 ? 'stunned' : undefined;
    frame.grip = phase >= .30 && phase < .54 ? 'waist' : undefined;
    frame.stage = phase < .40 ? 'grip' : phase < .54 ? 'hook' : phase < .64 ? 'fall' : phase < .72 ? 'stunned' : frontKick < 1 ? 'kick' : 'roll';
  } else if (round.tactic === 'suplex') {
    const lift = ease((phase - .34) / .30), drop = clamp((phase - .76) / .12);
    const slam = drop ** 2, turn = ease((phase - .76) / .12);
    const take = ease((phase - .30) / .04);
    frame.aggressor.x = center.x - side * mix(24, 22, take);
    frame.victim.x = frame.aggressor.x + side * (mix(mix(48, 43, take), 12, lift) + slam * 14);
    frame.victim.y = center.y + slam * 3;
    // Bring the waist above the driver's head, read the raised hold, then
    // accelerate straight down into the shoulder landing without a back arch.
    frame.lift = lift * 100 * (1 - slam);
    frame.victimAngle = side * Math.PI * .53 * turn;
    // After this rotation the feet point to the other side of the body. The
    // driver approaches those feet and pulls outward instead of across the head.
    frame.exitDirection = -side as 1 | -1;
    frame.aggressorPose = phase >= .34 && phase < .88 ? 'overhead' : undefined;
    frame.aggressorOverheadRaise = lift * (1 - slam);
    frame.victimPose = phase >= .88 ? 'stunned' : phase >= .34 ? 'airborne' : undefined;
    if (phase >= .34) frame.victimSlam = { tuck: lift, slump: ease((phase - .88) / .06) };
    frame.victimSuspension = phase >= .34 && phase < .88 ? 1 - turn : 0;
    frame.slamImpact = phase >= .88 && phase < .96 ? 1 - ease((phase - .88) / .08) : 0;
    frame.grip = phase >= .30 && phase < .76 ? 'waist' : undefined;
    frame.stage = phase < .34 ? 'grip' : phase < .64 ? 'lift' : phase < .76 ? 'overhead' : phase < .94 ? 'slam' : elapsed < round.impact ? 'stunned' : 'drag';
  } else if (round.tactic === 'sidekick') {
    const window = arenaSidekickWindow(round), jump = clamp((elapsed - window.start) / window.duration);
    const strike = ease((jump - .22) / .28), recoil = ease((jump - .50) / .50);
    frame.aggressor.x = center.x - side * (24 - ease(jump) * 11 + recoil * 7);
    frame.victim.x = center.x + side * (24 + recoil * 16);
    const arc = Math.sin(jump * Math.PI);
    frame.aggressorLift = arc * 26;
    frame.aggressorAngle = -side * arc * .24;
    frame.yaw = arc * .70;
    frame.contact = strike * (1 - ease((jump - .50) / .12));
    frame.reactionProgress = recoil;
    frame.lift = recoil * 14; frame.victimAngle = side * recoil * .32;
    frame.grip = undefined;
    frame.stage = elapsed < window.start ? 'approach' : jump < .22 ? 'jump' : jump < .50 ? 'kick' : elapsed < window.end ? 'impact' : 'release';
  } else if (round.tactic === 'elbow') {
    const close = ease((phase - .30) / .04);
    const raised = ease((phase - .30) / .15), descend = ease((phase - .55) / .12);
    const fall = ease((phase - .55) / .12);
    // Once the counterattacker has landed, a normal planted step begins at
    // once. Integrate one walking motor rather than easing a moving target.
    const approachAge = Math.max(0, (elapsed - round.start - span * .67) / 1000);
    const approachLength = Math.hypot(102, 6), speed = 165, ramp = .18;
    const cruise = approachLength / speed - ramp;
    const brake = Math.min(ramp, Math.max(0, approachAge - ramp - cruise));
    const walked = approachAge < ramp ? speed * approachAge ** 2 / (2 * ramp)
      : approachAge < ramp + cruise ? speed * (ramp / 2 + approachAge - ramp)
        : speed * (ramp / 2 + cruise + brake - brake ** 2 / (2 * ramp));
    const circle = clamp(walked / approachLength);
    frame.aggressorLift = raised * 44 * (1 - descend);
    frame.aggressorSuspension = raised * (1 - descend);
    frame.aggressor.x = center.x - side * mix(24, 12, close) + side * 102 * circle;
    frame.aggressor.y = center.y + circle * 6;
    frame.aggressorFacing = phase >= .67 ? -side : side;
    frame.victim = { x: center.x + side * mix(24, 22, close), y: center.y };
    frame.victimAngle = -side * Math.PI * .47 * fall;
    frame.victimPose = phase >= .55 ? 'stunned' : undefined;
    // Raising a grounded ankle grip translates the existing fallen silhouette;
    // it must not swap to a suspended pivot and slide the whole body to a hand.
    frame.victimSuspension = phase >= .55 ? 1 - fall : 0;
    if (phase >= .67) frame.victimFloorRig = { pose: 'stunned', phase: 1, angle: -side * Math.PI * .47, suspension: 0 };
    frame.victimGrip = phase >= .30 && phase < .55 ? 'waist' : undefined;
    frame.victimLift = raised * 44;
    frame.grip = (round.elbowGripAt === null ? phase >= .67 : phase >= .84 && elapsed < round.impact) ? 'ankle' : undefined;
    frame.elbowContact = ease((phase - .45) / .10) * (1 - ease((phase - .55) / .06));
    frame.elbowImpact = phase >= .55 && phase < .64 ? 1 - ease((phase - .55) / .09) : 0;
    // Once the lifter falls, keep the entire floor rig grounded. The winner
    // walks to its painted feet, then pulls that same body toward the rim.
    frame.lift = 0;
    const timing = arenaFloorExitTiming(round), age = round.elbowGripAt === null ? 0 : Math.max(0, elapsed - round.impact);
    frame.aggressorPose = phase >= .45 && phase < .61 ? 'elbow' : phase >= .84 ? elapsed >= round.impact && age >= timing.dragUntil ? 'throw' : 'drag' : undefined;
    frame.stage = phase < .45 ? 'lift-counter' : phase < .55 ? 'elbow' : phase < .67 ? 'elbow-impact' : phase < .84 ? 'ankle-approach' : elapsed < round.impact || round.elbowGripAt === null ? 'ankle-grip' : age < timing.dragUntil ? 'drag' : 'release';
  }
  return frame;
}

/** Leave room for the pulling fighter's feet inside the ellipse. Only the opponent crosses it. */
export function arenaSuplexRim(origin: ArenaPoint, direction: number): ArenaPoint {
  const y = Math.max(350, Math.min(472, origin.y));
  const outsideFootAllowance = 303 * Math.sqrt(Math.max(0, 1 - ((y + 8 - 416) / 112) ** 2)) - 32;
  return { x: 500 + direction * Math.max(80, outsideFootAllowance - 80), y };
}

/** A kick rolls the body backwards in its travel direction. A suplex drags to the rim before release. */
export function arenaTechniqueExit(round: ArenaRound, age: number, origin: ArenaPoint, landing: ArenaPoint, direction: number, unit = 1, preparation = { lift: 0, angle: 0 }): ArenaThrowFrame | undefined {
  const ms = Math.max(0, age / Math.max(.001, unit));
  if (round.tactic === 'trip') {
    if (ms < 880) {
      const phase = clamp(ms / 880), groundX = mix(origin.x, landing.x, ease(phase)), groundY = mix(origin.y, landing.y, ease(phase));
      const height = preparation.lift * (1 - ease(phase));
      return { x: groundX, y: groundY - height, groundX, groundY, height, angle: preparation.angle + direction * Math.PI * 2 * ease(phase), yaw: 0, phase, stage: 'roll' };
    }
  } else if (isArenaFloorDrag(round)) {
    const scale = Math.max(.001, unit), timing = arenaFloorExitTiming(round, unit), stunned = timing.stunnedUntil / scale, finish = timing.dragUntil / scale;
    const tossEnd = timing.tossUntil / scale, landEnd = timing.landUntil / scale, recoverEnd = timing.recoverUntil / scale;
    const desired = arenaSuplexRim(origin, direction), ramp = .12;
    // The held body and its driver share this integrated floor path. A far
    // opposite rim must not demand a faster pull than the standing gait.
    const distance = Math.hypot(desired.x - origin.x, desired.y - origin.y);
    const reachable = 165 * (finish - stunned) * scale / 1000 * (1 - ramp);
    const reach = distance ? Math.min(1, reachable / distance) : 1;
    const rim = { x: origin.x + (desired.x - origin.x) * reach, y: origin.y + (desired.y - origin.y) * reach };
    if (ms < stunned) return { ...origin, groundX: origin.x, groundY: origin.y, height: 0, angle: preparation.angle, phase: ms / stunned, stage: 'stunned' };
    if (ms < finish) {
      const phase = clamp((ms - stunned) / (finish - stunned));
      const cruise = (phase < ramp ? phase ** 2 / (2 * ramp) : phase > 1 - ramp ? 1 - ramp - (1 - phase) ** 2 / (2 * ramp) : phase - ramp / 2) / (1 - ramp);
      const groundX = mix(origin.x, rim.x, cruise), groundY = mix(origin.y, rim.y, cruise);
      return { x: groundX, y: groundY, groundX, groundY, height: 0, angle: preparation.angle, phase, stage: 'drag' };
    }
    if (ms < tossEnd) {
      const phase = clamp((ms - finish) / (tossEnd - finish)), groundX = mix(rim.x, landing.x, ease(phase)), groundY = mix(rim.y, landing.y, ease(phase));
      const height = Math.sin(phase * Math.PI) * 42;
      return { x: groundX, y: groundY - height, groundX, groundY, height, angle: preparation.angle + direction * Math.PI * .65 * ease(phase), phase, stage: 'rim-toss' };
    }
    const landedAngle = preparation.angle + direction * Math.PI * .65;
    if (ms < landEnd) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: landedAngle, phase: (ms - tossEnd) / (landEnd - tossEnd), stage: 'land' };
    if (ms < recoverEnd) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: landedAngle * (1 - ease((ms - landEnd) / (recoverEnd - landEnd))), phase: (ms - landEnd) / (recoverEnd - landEnd), stage: 'recover' };
    return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: 1, stage: 'walk' };
  } else return undefined;
  const turn = direction * Math.PI * 2, landedAngle = preparation.angle + turn;
  if (ms < 1100) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: landedAngle, yaw: 0, phase: (ms - 880) / 220, stage: 'land' };
  if (ms < 1600) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: turn + preparation.angle * (1 - ease((ms - 1100) / 500)), yaw: 0, phase: (ms - 1100) / 500, stage: 'recover' };
  return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: turn, yaw: 0, phase: 1, stage: 'walk' };
}
