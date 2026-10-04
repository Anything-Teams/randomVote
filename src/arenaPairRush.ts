import type { ArenaPoint, ArenaRound } from './arenaLogic';

export type ArenaPairRushOutcome = 'double-out' | 'counter-throw';
type RushRound = ArenaRound & { rushOutcome?: ArenaPairRushOutcome; rushLaunchAt?: number | null };
export type ArenaPairRushCast = {
  aggressor: string; victim: string; helper: string;
  secondaryVictim?: string; rushOutcome: ArenaPairRushOutcome;
};
/** A linked attack hands the real impact roots to the existing shared lift. */
export type ArenaPairCarryOrigins = { victim: ArenaPoint; pair: [ArenaPoint, ArenaPoint]; direction: ArenaPoint; facing?: 1 | -1 };
export type ArenaPairRushFrame = {
  phase: number; side: number; outcome: ArenaPairRushOutcome;
  stage: 'wrestle' | 'charge' | 'contact' | 'scoop' | 'push' | 'rebound' | 'groggy' | 'grip' | 'lift' | 'overhead' | 'toss' | 'release';
  aggressor: ArenaPoint; helper: ArenaPoint; victim: ArenaPoint;
  chargerId: string; pairIds: [string, string];
  chargerFacing: 1 | -1; chargeDirection: ArenaPoint;
  chargerPose?: 'scoop' | 'push'; scoopFacing?: 1 | -1; scoopStroke: number; pushStroke: number;
  chargeStrength: number; pressure: number; rebound: number; groggy: number;
  launchAt: number | null; waitingForGrip: boolean; contactAt: number; requiredImpactAt: number;
  contactPoint: ArenaPoint; postContactDuration: number;
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

/** Pure replay of normal ground steps; seeking cannot bypass the walking cap. */
function carrierGround(origin: ArenaPoint, age: number, target: (at: number) => ArenaPoint): ArenaPoint {
  const end = Math.max(0, Math.min(ARENA_PAIR_COUNTER_TIMING.release, age));
  let ground = { ...origin };
  for (let at = 0; at < end; at += 8) {
    const next = Math.min(end, at + 8), goal = target(next), dx = goal.x - ground.x, dy = goal.y - ground.y, distance = Math.hypot(dx, dy);
    const amount = Math.min(1, 160 * (next - at) / (1000 * Math.max(.001, distance)));
    ground = { x: ground.x + dx * amount, y: ground.y + dy * amount };
  }
  return ground;
}

/** Real post-contact milliseconds; a long bout never slows down an individual action. */
export const ARENA_PAIR_COUNTER_TIMING = {
  rebound: 400, fallStart: 200, grip: 700, lift: 1900,
  overhead: 1900, toss: 2000, release: 2200,
} as const;
export const ARENA_PAIR_CONTACT_RADIUS = 22;

/** Enter the near face of the wrestling pair, regardless of the eventual throwing side. */
export function arenaPairRushContact(center: ArenaPoint, origin: ArenaPoint, layoutSide = 1): ArenaPoint {
  const first = { x: center.x + layoutSide * 22, y: center.y + 6 };
  const second = { x: center.x - layoutSide * 22, y: center.y - 6 };
  const segment = { x: second.x - first.x, y: second.y - first.y };
  const lengthSquared = segment.x ** 2 + segment.y ** 2;
  const inside = (point: ArenaPoint) => {
    const along = clamp(((point.x - first.x) * segment.x + (point.y - first.y) * segment.y) / lengthSquared);
    return Math.hypot(point.x - first.x - along * segment.x, point.y - first.y - along * segment.y) <= ARENA_PAIR_CONTACT_RADIUS;
  };
  if (inside(origin)) return { ...origin };
  let near = 0, far = 1;
  for (let step = 0; step < 36; step++) {
    const at = (near + far) / 2;
    const point = { x: mix(origin.x, center.x, at), y: mix(origin.y, center.y, at) };
    if (inside(point)) far = at; else near = at;
  }
  return { x: mix(origin.x, center.x, far), y: mix(origin.y, center.y, far) };
}

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
export function arenaPairRushTargets(round: RushRound, elapsed: number, center: ArenaPoint, chargerOrigin?: ArenaPoint, carryOrigins?: ArenaPairCarryOrigins): ArenaPairRushFrame {
  if (!round.helper) throw new RangeError('A pair rush needs its second wrestler');
  const span = Math.max(1, round.impact - round.start);
  const phase = clamp((elapsed - round.start) / span);
  const outcome = round.rushOutcome ?? (round.secondaryVictim ? 'double-out' : 'counter-throw');
  const side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const origin = chargerOrigin ?? { x: center.x - side * 220, y: center.y + 43 };
  const contact = carryOrigins?.victim ?? (outcome === 'counter-throw' ? arenaPairRushContact(center, origin, side) : { x: center.x - side * 36, y: center.y + 5 });
  // Start where the third fighter actually stands. A longer runway receives
  // more time rather than moving the fighter backwards to a staging mark.
  const distance = Math.hypot(contact.x - origin.x, contact.y - origin.y);
  // The rim side describes the wrestling/throw layout, not the direction a
  // fighter runs. An actual origin may be on either side or above the pair.
  const chargeDirection = carryOrigins ? { x: -carryOrigins.direction.x, y: -carryOrigins.direction.y } : distance > .001 ? { x: (contact.x - origin.x) / distance, y: (contact.y - origin.y) / distance } : { x: side, y: 0 };
  const chargerFacing: 1 | -1 = carryOrigins?.facing ?? (Math.abs(chargeDirection.x) > .001 ? chargeDirection.x > 0 ? 1 : -1 : side > 0 ? 1 : -1);
  const preparation = .04, unit = Math.max(.001, round.timeScale ?? 1);
  // null explicitly reserves the real charger at their current position
  // until both wrestlers have established the actual two-way grip.
  const launchAt = round.rushLaunchAt === null ? null : Math.max(round.start, round.rushLaunchAt ?? round.start + preparation * span);
  const waitingForGrip = launchAt === null || elapsed < launchAt;
  const runDuration = outcome === 'counter-throw' && distance < 1 ? 0 : Math.max(160 * unit, distance * 1000 / (162 * .9));
  const earliestContact = (launchAt ?? round.start + preparation * span) + runDuration;
  // The Scene records the real contact from its actual runway. Consumers
  // without that origin must use the recorded instant, not a default runway.
  const contactAt = round.rushContactAt !== undefined && launchAt !== null && round.rushContactAt >= launchAt ? round.rushContactAt : earliestContact;
  const postContactDuration = outcome === 'counter-throw' ? ARENA_PAIR_COUNTER_TIMING.release : 1800;
  const requiredImpactAt = contactAt + postContactDuration;
  const contactPhase = (contactAt - round.start) / span;
  const launchPhase = ((launchAt ?? round.impact) - round.start) / span;
  const released = launchAt !== null && elapsed >= (outcome === 'counter-throw' ? requiredImpactAt : round.impact);
  const runProgress = launchAt === null ? 0 : clamp((elapsed - launchAt) / Math.max(1, contactAt - launchAt));
  const approach = drive(runProgress);
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
    launchAt, waitingForGrip, contactAt, requiredImpactAt, contactPoint: contact, postContactDuration, impactStrength, victimRecoil: 0, helperRecoil: 0, reboundHeight: 0,
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
  const timing = ARENA_PAIR_COUNTER_TIMING;
  const age = impactAge;
  const reboundProgress = clamp(age / timing.rebound), rebound = ease(reboundProgress);
  const fallen = ease((age - timing.fallStart) / (timing.rebound - timing.fallStart));
  const stretch = ease((age - timing.grip) / (timing.lift - timing.grip));
  // Both shoulder and ankle holds rise together in one continuous pull.
  const lifted = ease((age - timing.grip) / (timing.overhead - timing.grip));
  const tossed = drive((age - timing.toss) / (timing.release - timing.toss));
  // The collision deflects the runner visibly sideways before the body
  // settles. Helpers go to that landing instead of resetting a prone body.
  const pace = 1, deflection = { x: -chargeDirection.x * 30 - chargeDirection.y * 10 * side, y: -chargeDirection.y * 30 + chargeDirection.x * 10 * side };
  const fallenPoint = { x: contact.x + deflection.x, y: contact.y + deflection.y };
  const chargerX = (carryOrigins ? contact.x : mix(origin.x, contact.x, approach)) + deflection.x * rebound;
  const chargerY = (carryOrigins ? contact.y : mix(origin.y, contact.y, approach)) + deflection.y * rebound;
  // Keeping the foot-origin marker fixed during suspension slides the entire
  // horizontal rig by its 24-local-pixel pivot. Cancel that marker shift so
  // the actual hips rise above the same patch of sand.
  frame.victim = { x: mix(chargerX, fallenPoint.x, stretch) - side * 48.96 * lifted + side * tossed * 18, y: mix(chargerY, fallenPoint.y, stretch) };
  // The former opponents stop wrestling, go to opposite ends of the stunned
  // charger, and keep those shoulder/ankle holds through the shared lifting stroke.
  // Both carriers approach the landing with normal planted steps, then
  // follow the unfolding limb ends while the horizontal hips rise in place.
  // The rig and its holders share the actual landing depth. An entry from
  // above/below the pair cannot leave holders at the old contact depth.
  const carrierShiftY = fallenPoint.y - center.y - 5;
  const desired = (at: number, legs: boolean) => {
    const unfold = ease((at - timing.grip) / (timing.lift - timing.grip)), rise = ease((at - timing.grip) / (timing.overhead - timing.grip));
    const toss = drive((at - timing.toss) / (timing.release - timing.toss)), approach = drive(at / timing.grip), low = unfold * (1 - rise);
    const bodyX = fallenPoint.x - side * 48.96 * rise + side * toss * 18;
    return legs
      ? { x: mix(center.x - side * 22, bodyX - side * (mix(85, 89, unfold) - rise * 67.54), approach) + side * 18 * low, y: center.y + mix(-14, mix(6, -2, rise) + carrierShiftY, approach) + 8 * low + 4 * rise }
      : { x: mix(center.x + side * 22, bodyX + side * mix(55, 60, rise), approach), y: center.y + mix(14, mix(-7, -9, rise) + carrierShiftY, approach) };
  };
  frame.aggressor = carrierGround(carryOrigins?.pair[0] ?? { x: center.x + side * 22, y: center.y + 14 }, age, at => desired(at, false));
  frame.helper = carrierGround(carryOrigins?.pair[1] ?? { x: center.x - side * 22, y: center.y - 14 }, age, at => desired(at, true));
  frame.rebound = rebound;
  frame.groggy = age >= timing.rebound ? 1 - stretch : 0;
  frame.reboundHeight = age >= 0 && age < timing.rebound ? Math.sin(reboundProgress * Math.PI) ** 2 * 26 * pace : 0;
  frame.lift = lifted * 142;
  frame.victimCarryStretch = stretch;
  frame.overhead = lifted;
  frame.carrierDrive = lifted;
  frame.victimAngle = side * (mix(rebound * .30, Math.PI * .47, fallen) + stretch * Math.PI * .03);
  frame.victimPose = age >= timing.grip ? 'carried' : impactAge >= 0 ? 'stunned' : undefined;
  frame.victimSuspension = age >= timing.grip ? lifted : impactAge >= 0 ? 1 - fallen : 0;
  frame.grip = released ? undefined : age >= timing.grip ? 'arms-legs' : impactAge < 0 ? 'pair' : undefined;
  frame.carrierPose = age < timing.grip ? 'drag' : 'overhead';
  frame.armsHolderId = round.aggressor; frame.legsHolderId = round.helper;
  frame.stage = waitingForGrip ? 'wrestle' : released ? 'release' : phase < launchPhase ? 'wrestle' : phase < contactPhase ? 'charge' : age < timing.rebound ? 'rebound' : age < timing.grip ? 'groggy' : age < timing.grip + 100 ? 'grip' : age < timing.overhead ? 'lift' : age < timing.toss ? 'overhead' : 'toss';
  return frame;
}

export type ArenaPairRushFlightFrame = ArenaPoint & {
  groundX: number; groundY: number; height: number; angle: number; phase: number;
  stage: 'flight' | 'land' | 'recover' | 'walk';
  pose: 'carried' | 'recover' | 'walk'; carryStretch: number; suspension: number; facing: number;
};

/** Release the held rig with upward velocity, then let constant gravity carry it down. */
export function arenaPairRushFlight(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1, held: { lift: number; angle: number; relax?: boolean } = { lift: 142, angle: direction * Math.PI / 2 }): ArenaPairRushFlightFrame {
  const ms = Math.max(0, age / Math.max(.001, unit));
  if (ms < 880) {
    const phase = clamp(ms / 880), groundX = mix(origin.x, landing.x, phase), groundY = mix(origin.y, landing.y, phase);
    const upward = 220;
    const height = held.lift + upward * phase - (held.lift + upward) * phase ** 2;
    return { x: groundX, y: groundY - height, groundX, groundY, height, angle: held.angle + (held.relax ? direction * .12 * Math.sin(phase * Math.PI) * ease((phase - .06) / .20) : 0), phase, stage: 'flight', pose: 'carried', carryStretch: 1, suspension: 1 - ease((phase - .70) / .30), facing: -direction };
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
