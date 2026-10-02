import type { ArenaPoint, ArenaRound } from './arenaLogic';

export type ArenaPairRushOutcome = 'double-out' | 'counter-throw';
type RushRound = ArenaRound & { rushOutcome?: ArenaPairRushOutcome; rushLaunchAt?: number | null };
export type ArenaPairRushCast = {
  aggressor: string; victim: string; helper: string;
  secondaryVictim?: string; rushOutcome: ArenaPairRushOutcome;
};
export type ArenaPairRushFrame = {
  phase: number; side: number; outcome: ArenaPairRushOutcome;
  stage: 'wrestle' | 'charge' | 'contact' | 'scoop' | 'push' | 'rebound' | 'groggy' | 'grip' | 'lift' | 'overhead' | 'toss' | 'release';
  aggressor: ArenaPoint; helper: ArenaPoint; victim: ArenaPoint;
  chargerId: string; pairIds: [string, string];
  chargerFacing: 1 | -1; chargeDirection: ArenaPoint;
  chargerPose?: 'scoop' | 'push'; scoopFacing?: 1 | -1; scoopStroke: number; pushStroke: number;
  chargeStrength: number; pressure: number; rebound: number; groggy: number;
  launchAt: number | null; waitingForGrip: boolean; contactAt: number; requiredImpactAt: number;
  impactStrength: number; victimRecoil: number; helperRecoil: number; reboundHeight: number;
  lift: number; victimAngle: number; victimSuspension: number;
  victimCarryStretch: number; overhead: number;
  victimLift: number; helperLift: number; helperAngle: number; helperSuspension: number;
  victimPose: 'brace' | 'bow' | 'stunned' | 'carried' | 'airborne' | undefined;
  helperPose?: 'airborne' | 'brace'; carrierDrive: number;
  grip: 'pair' | 'arms-legs' | undefined;
  carrierPose?: 'drag' | 'grapple' | 'overhead';
  armsHolderId?: string; legsHolderId?: string;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
/** Accelerate into a collision/release without easing back to a stop first. */
const drive = (value: number, ramp = .2) => {
  const p = clamp(value);
  return (p < ramp ? p * p / (2 * ramp) : p - ramp / 2) / (1 - ramp / 2);
};

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
  const origin = chargerOrigin ?? { x: center.x - side * 220, y: center.y + 43 };
  const contact = { x: center.x - side * (outcome === 'double-out' ? 36 : 53), y: center.y + 5 };
  // Start where the third fighter actually stands. A longer runway receives
  // more time rather than moving the fighter backwards to a staging mark.
  const distance = Math.hypot(contact.x - origin.x, contact.y - origin.y);
  // The rim side describes the wrestling/throw layout, not the direction a
  // fighter runs. An actual origin may be on either side or above the pair.
  const chargeDirection = distance > .001 ? { x: (contact.x - origin.x) / distance, y: (contact.y - origin.y) / distance } : { x: side, y: 0 };
  const chargerFacing: 1 | -1 = Math.abs(chargeDirection.x) > .001 ? chargeDirection.x > 0 ? 1 : -1 : side > 0 ? 1 : -1;
  const preparation = .04, unit = Math.max(.001, round.timeScale ?? 1);
  // null explicitly reserves the real charger at their current position
  // until both wrestlers have established the actual two-way grip.
  const launchAt = round.rushLaunchAt === null ? null : Math.max(round.start, round.rushLaunchAt ?? round.start + preparation * span);
  const waitingForGrip = launchAt === null || elapsed < launchAt;
  const runDuration = Math.max(160 * unit, distance * 1000 / (162 * .9));
  const earliestContact = (launchAt ?? round.start + preparation * span) + runDuration;
  const contactAt = Math.max(earliestContact, round.rushContactAt ?? earliestContact);
  const requiredImpactAt = contactAt + (outcome === 'counter-throw' ? 4000 : 1800);
  const contactPhase = (contactAt - round.start) / span;
  const launchPhase = ((launchAt ?? round.impact) - round.start) / span;
  const released = launchAt !== null && elapsed >= round.impact;
  const runProgress = launchAt === null ? 0 : clamp((elapsed - launchAt) / Math.max(1, contactAt - launchAt));
  const approach = drive(runProgress);
  const beat = launchAt === null ? 0 : phase <= contactPhase ? phase / contactPhase * .44 : .44 + (phase - contactPhase) / Math.max(.001, 1 - contactPhase) * .56;
  const impactAge = launchAt === null ? -1 : elapsed - contactAt;
  const impactStrength = impactAge >= 0 ? 1 - ease(impactAge / (240 * unit)) : 0;
  const impactDeflect = impactAge >= 0 ? ease(impactAge / (45 * unit)) * impactStrength : 0;
  const chargeStrength = !waitingForGrip && elapsed < contactAt ? .55 + .45 * ease(runProgress / .2) : 0;
  const frame: ArenaPairRushFrame = {
    phase, side, outcome, stage: 'wrestle',
    aggressor: { x: center.x, y: center.y }, helper: { x: center.x, y: center.y }, victim: { x: center.x, y: center.y },
    chargerId: outcome === 'double-out' ? round.aggressor : round.victim,
    pairIds: outcome === 'double-out' ? [round.victim, round.helper] : [round.aggressor, round.helper],
    chargerFacing, chargeDirection,
    scoopStroke: 0, pushStroke: 0,
    chargeStrength, pressure: 0, rebound: 0, groggy: 0, lift: 0,
    launchAt, waitingForGrip, contactAt, requiredImpactAt, impactStrength, victimRecoil: 0, helperRecoil: 0, reboundHeight: 0,
    victimCarryStretch: 0, overhead: 0, victimLift: 0, helperLift: 0, helperAngle: 0, helperSuspension: 0, carrierDrive: 0,
    victimAngle: 0, victimSuspension: 0, victimPose: undefined, grip: released ? undefined : 'pair',
  };
  if (outcome === 'double-out') {
    const progress = clamp(impactAge / Math.max(1, round.impact - contactAt));
    const shove = drive((progress - .08) / .92), shock = ease(impactAge / (110 * unit));
    const victimY = center.y + 14, helperY = center.y - 14;
    const rimAt = (y: number) => 500 + side * (303 * Math.sqrt(Math.max(0, 1 - ((y - 416) / 112) ** 2)) - 10);
    const victimStart = center.x + side * 22, helperStart = center.x - side * 22;
    // Shoulder contact breaks the pair's footing. The charger then drives
    // through both bodies with planted steps, never lifting either wrestler.
    frame.victim = { x: victimStart + side * shock * 8 + (rimAt(victimY) - victimStart - side * 8) * shove, y: victimY };
    frame.helper = { x: helperStart + side * shock * 6 + (rimAt(helperY) - helperStart - side * 6) * shove, y: helperY };
    const rearX = side > 0 ? Math.min(frame.victim.x, frame.helper.x) : Math.max(frame.victim.x, frame.helper.x);
    frame.aggressor = { x: impactAge < 0 ? mix(origin.x, contact.x, approach) : rearX - side * 14, y: mix(origin.y, contact.y, approach) };
    frame.chargerPose = impactAge >= 0 ? 'push' : undefined;
    frame.scoopFacing = side > 0 ? 1 : -1;
    frame.pushStroke = shove;
    frame.pressure = shove;
    frame.victimAngle = -side * (.42 * impactDeflect + .20 * ease(progress / .22));
    frame.helperAngle = -side * (.32 * impactDeflect + .16 * ease(progress / .26));
    frame.victimPose = impactAge >= 0 ? 'brace' : undefined;
    frame.helperPose = impactAge >= 0 ? 'brace' : undefined;
    frame.victimRecoil = -side * impactDeflect * .42;
    frame.helperRecoil = -side * impactDeflect * .32;
    frame.grip = impactAge < 0 ? 'pair' : undefined;
    frame.stage = waitingForGrip ? 'wrestle' : released ? 'release' : phase < launchPhase ? 'wrestle' : phase < contactPhase ? 'charge' : progress < .08 ? 'contact' : 'push';
    return frame;
  }
  const reboundProgress = clamp(impactAge / (650 * unit)), rebound = ease(reboundProgress);
  const fallen = ease((impactAge - 420 * unit) / (480 * unit)), arrive = drive((beat - .44) / .18);
  const stretch = ease((beat - .62) / .16), lifted = ease((beat - .78) / .14), tossed = drive((beat - .96) / .04);
  // The collision deflects the runner visibly sideways before the body
  // settles. Helpers go to that landing instead of resetting a prone body.
  const pace = Math.min(1, unit), deflection = { x: (-chargeDirection.x * 48 - chargeDirection.y * 20 * side) * pace, y: (-chargeDirection.y * 48 + chargeDirection.x * 20 * side) * pace };
  const fallenPoint = { x: contact.x + deflection.x, y: contact.y + deflection.y };
  const chargerX = mix(origin.x, contact.x, approach) + deflection.x * rebound;
  const chargerY = mix(origin.y, contact.y, approach) + deflection.y * rebound;
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
  // Follow the painted wrists/ankles from the prone grip into the raised
  // body. At the peak both shoulders sit beneath their endpoint midpoint,
  // letting both human-length arms extend rather than folding one elbow.
  const lowCarry = stretch * (1 - lifted);
  frame.aggressor.x -= side * 20 * lowCarry;
  frame.aggressor.y += 4 * lowCarry + 6 * lifted;
  frame.helper.x += side * 18 * lowCarry;
  frame.helper.y += 8 * lowCarry + 4 * lifted;
  frame.rebound = rebound;
  frame.groggy = impactAge >= 650 * unit ? 1 - stretch : 0;
  frame.reboundHeight = impactAge >= 0 && impactAge < 650 * unit ? Math.sin(reboundProgress * Math.PI) ** 2 * 26 * pace : 0;
  frame.lift = lifted * 142;
  frame.victimCarryStretch = stretch;
  frame.overhead = lifted;
  frame.carrierDrive = lifted;
  frame.victimAngle = side * (mix(rebound * .30, Math.PI * .47, fallen) + stretch * Math.PI * .03);
  frame.victimPose = beat >= .62 ? 'carried' : impactAge >= 0 ? 'stunned' : undefined;
  frame.victimSuspension = beat >= .62 ? lifted : impactAge >= 0 ? 1 - ease((impactAge - 420 * unit) / (480 * unit)) : 0;
  frame.grip = released ? undefined : beat >= .62 ? 'arms-legs' : beat < .44 ? 'pair' : undefined;
  frame.carrierPose = beat < .62 ? 'drag' : 'overhead';
  frame.armsHolderId = round.aggressor; frame.legsHolderId = round.helper;
  frame.stage = waitingForGrip ? 'wrestle' : released ? 'release' : phase < launchPhase ? 'wrestle' : phase < contactPhase ? 'charge' : impactAge < 650 * unit ? 'rebound' : beat < .62 ? 'groggy' : beat < .78 ? 'grip' : beat < .92 ? 'lift' : beat < .96 ? 'overhead' : 'toss';
  return frame;
}

export type ArenaPairRushFlightFrame = ArenaPoint & {
  groundX: number; groundY: number; height: number; angle: number; phase: number;
  stage: 'flight' | 'land' | 'recover' | 'walk';
  pose: 'carried' | 'recover' | 'walk'; carryStretch: number; suspension: number; facing: number;
};

/** Release the held rig with upward velocity, then let constant gravity carry it down. */
export function arenaPairRushFlight(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1, held = { lift: 142, angle: direction * Math.PI / 2 }): ArenaPairRushFlightFrame {
  const ms = Math.max(0, age / Math.max(.001, unit));
  if (ms < 880) {
    const phase = clamp(ms / 880), groundX = mix(origin.x, landing.x, phase), groundY = mix(origin.y, landing.y, phase);
    const upward = 220;
    const height = held.lift + upward * phase - (held.lift + upward) * phase ** 2;
    return { x: groundX, y: groundY - height, groundX, groundY, height, angle: held.angle, phase, stage: 'flight', pose: 'carried', carryStretch: 1, suspension: 1 - ease((phase - .70) / .30), facing: -direction };
  }
  if (ms < 1100) {
    const phase = clamp((ms - 880) / 220);
    return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: held.angle, phase, stage: 'land', pose: 'carried', carryStretch: 1 - ease(phase), suspension: 0, facing: -direction };
  }
  if (ms < 1600) {
    const phase = clamp((ms - 1100) / 500);
    return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: held.angle * (1 - ease(phase)), phase, stage: 'recover', pose: 'recover', carryStretch: 0, suspension: 0, facing: -direction };
  }
  return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: 1, stage: 'walk', pose: 'walk', carryStretch: 0, suspension: 0, facing: -direction };
}
