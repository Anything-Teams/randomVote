import type { ArenaPoint, ArenaRound } from './arenaLogic';

export type ArenaPairRushOutcome = 'double-out' | 'counter-throw';
/** The shared heave rises clearly above the two supports before gravity takes over. */
export const ARENA_PAIR_THROW_UPWARD = 500;
/** Leave enough time for the support hands to follow the heave and return to guard. */
export const ARENA_PAIR_THROW_FOLLOW_THROUGH = 560;
type RushRound = ArenaRound & { rushOutcome?: ArenaPairRushOutcome; rushLaunchAt?: number | null; pairPickupAt?: number | null };
export type ArenaPairRushCast = {
  aggressor: string; victim: string; helper: string;
  secondaryVictim?: string; rushOutcome: ArenaPairRushOutcome;
};
/** A linked attack hands the real impact roots to the existing shared lift. */
export type ArenaPairCarryOrigins = { victim: ArenaPoint; pair: [ArenaPoint, ArenaPoint]; direction: ArenaPoint; facing?: 1 | -1; pickup?: { victim: ArenaPoint; pair: [ArenaPoint, ArenaPoint]; waist: ArenaPoint } };
export type ArenaPairRushFrame = {
  phase: number; side: number; outcome: ArenaPairRushOutcome;
  stage: 'wrestle' | 'charge' | 'contact' | 'scoop' | 'push' | 'rebound' | 'groggy' | 'grip' | 'load' | 'lift' | 'overhead' | 'toss' | 'release';
  aggressor: ArenaPoint; helper: ArenaPoint; victim: ArenaPoint;
  chargerId: string; pairIds: [string, string];
  chargerFacing: 1 | -1; chargeDirection: ArenaPoint;
  pushDirection: ArenaPoint; pushDistance: number; pushSpeed: number; victimExit?: ArenaPoint; helperExit?: ArenaPoint;
  chargerPose?: 'scoop' | 'push'; scoopFacing?: 1 | -1; scoopStroke: number; pushStroke: number;
  chargeStrength: number; pressure: number; rebound: number; groggy: number;
  launchAt: number | null; waitingForGrip: boolean; contactAt: number; requiredImpactAt: number;
  plannedPickupAt: number; pickupAt: number | null; waitingForPickup: boolean; canPickup: boolean;
  contactPoint: ArenaPoint; postContactDuration: number;
  impactStrength: number; victimRecoil: number; helperRecoil: number; reboundHeight: number;
  lift: number; victimAngle: number; victimSuspension: number;
  victimCarryStretch: number; overhead: number;
  pairLoad: number; pairLift: number; pairBackload: number; pairHeave: number; throwShift: number;
  victimLift: number; helperLift: number; helperAngle: number; helperSuspension: number;
  victimPose: 'brace' | 'bow' | 'stunned' | 'carried' | 'airborne' | undefined;
  helperPose?: 'airborne' | 'brace'; carrierDrive: number;
  grip: 'pair' | 'arms-legs' | undefined;
  carrierPose?: 'drag' | 'grapple' | 'overhead' | 'pairlift';
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
function carrierGround(origin: ArenaPoint, age: number, target: (at: number) => ArenaPoint, duration: number = ARENA_PAIR_COUNTER_TIMING.release): ArenaPoint {
  const end = Math.max(0, Math.min(duration, age));
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
  rebound: 520, fallStart: 200, grip: 1000, load: 1300, lift: 1900,
  overhead: 1900, toss: 2200, release: 2600,
} as const;
export const ARENA_PAIR_CONTACT_RADIUS = 22;
export const ARENA_PAIR_PUSH_SPEED = 95;

/** Continue the incoming shoulder drive to the same face of the sand ellipse. */
function forwardRim(origin: ArenaPoint, direction: ArenaPoint) {
  const dx = direction.x / 303, dy = direction.y / 112, x = (origin.x - 500) / 303, y = (origin.y - 416) / 112;
  const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - 1;
  const distance = Math.max(0, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / Math.max(.000001, 2 * a) - 10);
  return { distance, exit: { x: origin.x + direction.x * (distance + 90), y: origin.y + direction.y * (distance + 90) } };
}

/** Both pushed roots share the same forward motion; each loses footing at its own edge. */
export function arenaPairPushFlight(age: number, origin: ArenaPoint, landing: ArenaPoint, side = 1, unit = 1, preparation: { speed?: number; angle?: number } = {}) {
  const ms = Math.max(0, age / Math.max(.001, unit));
  const dx = landing.x - origin.x, dy = landing.y - origin.y, distance = Math.max(.001, Math.hypot(dx, dy));
  const direction = { x: dx / distance, y: dy / distance };
  const duration = Math.max(1100, distance * 1000 / 90), seconds = duration / 1000;
  const speed = Math.min(118, Math.max(0, (preparation.speed ?? ARENA_PAIR_PUSH_SPEED) * unit));
  const progress = clamp(ms / duration);
  const travel = distance * (3 * progress ** 2 - 2 * progress ** 3) + speed * seconds * (progress ** 3 - 2 * progress ** 2 + progress);
  const rim = forwardRim(origin, direction).distance + 10;
  let low = 0, high = 1;
  for (let step = 0; step < 28; step++) {
    const p = (low + high) / 2, at = distance * (3 * p ** 2 - 2 * p ** 3) + speed * seconds * (p ** 3 - 2 * p ** 2 + p);
    if (at < rim) low = p; else high = p;
  }
  const edgeAt = high * duration, fall = clamp((ms - edgeAt) / Math.max(1, duration - edgeAt));
  const timing = { duration: duration * unit, edgeAt: edgeAt * unit };
  const groundX = origin.x + direction.x * travel, groundY = origin.y + direction.y * travel;
  const initialAngle = preparation.angle ?? 0;
  if (ms < duration) return { ...timing, x: groundX, y: groundY, groundX, groundY, height: 0, angle: mix(initialAngle, side * Math.PI * .83, ease(fall)), phase: fall, stage: ms < edgeAt ? 'overrun' as const : 'fall' as const };
  if (ms < duration + 220) return { ...timing, ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: side * Math.PI * (.83 + (ms - duration) / 220 * .06), phase: (ms - duration) / 220, stage: 'land' as const };
  if (ms < duration + 720) {
    const p = (ms - duration - 220) / 500;
    return { ...timing, ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: side * mix(Math.PI * .89, Math.PI * 2, ease(p)), phase: p, stage: 'roll' as const };
  }
  return { ...timing, ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: clamp((ms - duration - 720) / 500), stage: ms < duration + 1220 ? 'recover' as const : 'walk' as const };
}

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
  const contact = carryOrigins?.victim ?? arenaPairRushContact(center, origin, side);
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
  const plannedPickupAt = contactAt + ARENA_PAIR_COUNTER_TIMING.grip;
  const pickupAt = outcome !== 'counter-throw' || launchAt === null || round.pairPickupAt === null ? null : Math.max(plannedPickupAt, round.pairPickupAt ?? plannedPickupAt);
  const afterPickup = ARENA_PAIR_COUNTER_TIMING.release - ARENA_PAIR_COUNTER_TIMING.grip;
  const requiredImpactAt = outcome === 'counter-throw' ? pickupAt === null ? Math.max(contactAt + postContactDuration, elapsed + afterPickup) : pickupAt + afterPickup : contactAt + postContactDuration;
  const released = launchAt !== null && (outcome !== 'counter-throw' || pickupAt !== null) && elapsed >= (outcome === 'counter-throw' ? requiredImpactAt : round.impact);
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
    chargerFacing, chargeDirection, pushDirection: chargeDirection, pushDistance: 0, pushSpeed: 0,
    scoopStroke: 0, pushStroke: 0,
    chargeStrength, pressure: 0, rebound: 0, groggy: 0, lift: 0,
    launchAt, waitingForGrip, contactAt, requiredImpactAt, contactPoint: contact, postContactDuration, impactStrength, victimRecoil: 0, helperRecoil: 0, reboundHeight: 0,
    plannedPickupAt, pickupAt, waitingForPickup: outcome === 'counter-throw' && !waitingForGrip && elapsed >= plannedPickupAt && pickupAt === null,
    canPickup: outcome === 'counter-throw' && !waitingForGrip && elapsed >= plannedPickupAt && pickupAt === null,
    victimCarryStretch: 0, overhead: 0, victimLift: 0, helperLift: 0, helperAngle: 0, helperSuspension: 0, carrierDrive: 0,
    pairLoad: 0, pairLift: 0, pairBackload: 0, pairHeave: 0, throwShift: 0,
    victimAngle: 0, victimSuspension: 0, victimPose: undefined, grip: released ? undefined : 'pair',
  };
  if (outcome === 'double-out') {
    const victimStart = carryOrigins?.pair[0] ?? { x: center.x + side * 22, y: center.y + 14 };
    const helperStart = carryOrigins?.pair[1] ?? { x: center.x - side * 22, y: center.y - 14 };
    const victimRim = forwardRim(victimStart, chargeDirection), helperRim = forwardRim(helperStart, chargeDirection);
    const pushDistance = Math.min(victimRim.distance, helperRim.distance, forwardRim(contact, chargeDirection).distance);
    const pushDuration = round.rushPushDuration ?? Math.max(700 * unit, pushDistance * 1000 / (ARENA_PAIR_PUSH_SPEED * .9));
    const progress = clamp(impactAge / pushDuration), shove = drive(progress);
    // Shoulder contact breaks the pair's footing. The charger then drives
    // through both bodies with planted steps, never lifting either wrestler.
    frame.pushDistance = pushDistance * shove;
    frame.pushSpeed = pushDistance * 1000 / (pushDuration * .9);
    frame.victim = { x: victimStart.x + chargeDirection.x * frame.pushDistance, y: victimStart.y + chargeDirection.y * frame.pushDistance };
    frame.helper = { x: helperStart.x + chargeDirection.x * frame.pushDistance, y: helperStart.y + chargeDirection.y * frame.pushDistance };
    // Keep the original two-body offsets through free motion as well. Their
    // feet cross the same rim at different instants, without converging onto it.
    const exitDistance = Math.max(victimRim.distance, helperRim.distance) - pushDistance + 90;
    frame.victimExit = { x: victimStart.x + chargeDirection.x * (pushDistance + exitDistance), y: victimStart.y + chargeDirection.y * (pushDistance + exitDistance) };
    frame.helperExit = { x: helperStart.x + chargeDirection.x * (pushDistance + exitDistance), y: helperStart.y + chargeDirection.y * (pushDistance + exitDistance) };
    frame.requiredImpactAt = contactAt + pushDuration;
    frame.postContactDuration = pushDuration;
    frame.aggressor = impactAge < 0 ? { x: mix(origin.x, contact.x, approach), y: mix(origin.y, contact.y, approach) }
      : { x: contact.x + chargeDirection.x * frame.pushDistance, y: contact.y + chargeDirection.y * frame.pushDistance };
    frame.chargerPose = impactAge >= 0 ? 'push' : undefined;
    frame.scoopFacing = chargerFacing;
    frame.pushStroke = shove;
    frame.pressure = shove;
    frame.victimAngle = -side * (.42 * impactDeflect + .20 * ease(progress / .22));
    frame.helperAngle = -side * (.32 * impactDeflect + .16 * ease(progress / .26));
    frame.victimPose = impactAge >= 0 ? 'brace' : undefined;
    frame.helperPose = impactAge >= 0 ? 'brace' : undefined;
    frame.victimRecoil = -side * impactDeflect * .42;
    frame.helperRecoil = -side * impactDeflect * .32;
    frame.grip = waitingForGrip || elapsed < frame.requiredImpactAt ? 'pair' : undefined;
    frame.stage = waitingForGrip ? 'wrestle' : elapsed >= frame.requiredImpactAt ? 'release' : elapsed < contactAt ? 'charge' : progress < .08 ? 'contact' : 'push';
    return frame;
  }
  const timing = ARENA_PAIR_COUNTER_TIMING;
  const age = impactAge;
  const reboundProgress = clamp(age / timing.rebound), rebound = ease(reboundProgress);
  const fallen = ease((age - timing.fallStart) / (timing.rebound - timing.fallStart));
  const pickupAge = pickupAt === null ? -1 : elapsed - pickupAt;
  const loadDuration = timing.load - timing.grip, riseDuration = timing.lift - timing.load;
  const backDuration = timing.toss - timing.lift, heaveDuration = timing.release - timing.toss;
  const load = ease(pickupAge / loadDuration), lifted = ease((pickupAge - loadDuration) / riseDuration);
  const backload = ease((pickupAge - loadDuration - riseDuration) / backDuration);
  const tossed = drive((pickupAge - loadDuration - riseDuration - backDuration) / heaveDuration);
  const stretch = lifted, throwShift = side * (-6 * backload * (1 - tossed) + 18 * tossed);
  // The collision deflects the runner visibly sideways before the body
  // settles. Helpers go to that landing instead of resetting a prone body.
  const pace = 1, deflection = { x: -chargeDirection.x * 30 - chargeDirection.y * 10 * side, y: -chargeDirection.y * 30 + chargeDirection.x * 10 * side };
  const fallenPoint = { x: contact.x + deflection.x, y: contact.y + deflection.y };
  const chargerX = (carryOrigins ? contact.x : mix(origin.x, contact.x, approach)) + deflection.x * rebound;
  const chargerY = (carryOrigins ? contact.y : mix(origin.y, contact.y, approach)) + deflection.y * rebound;
  // Keep the grounded landing marker until four real support contacts are
  // recorded. The Scene aligns the painted pelvis from the saved waist;
  // lifting never manufactures a fixed sprite-pivot compensation step.
  const pickup = carryOrigins?.pickup;
  const heldPoint = pickup && pickupAge >= 0 ? pickup.victim : fallenPoint;
  frame.victim = { x: age < timing.rebound ? chargerX : heldPoint.x + throwShift, y: age < timing.rebound ? chargerY : heldPoint.y };
  // The former opponents stop wrestling, go to opposite ends of the stunned
  // charger, and keep those shoulder/ankle holds through the shared lifting stroke.
  // Both carriers approach the landing with normal planted steps, then
  // follow the unfolding limb ends while the horizontal hips rise in place.
  // The rig and its holders share the actual landing depth. An entry from
  // above/below the pair cannot leave holders at the old contact depth.
  const pair: [ArenaPoint, ArenaPoint] = carryOrigins?.pair ?? [{ x: center.x + side * 22, y: center.y + 14 }, { x: center.x - side * 22, y: center.y - 14 }];
  const goals: [ArenaPoint, ArenaPoint] = [{ x: fallenPoint.x + side * 55, y: fallenPoint.y - 12 }, { x: fallenPoint.x - side * 85, y: fallenPoint.y + 5 }];
  const shifts = (after: number) => {
    const back = ease((after - loadDuration - riseDuration) / backDuration), heave = drive((after - loadDuration - riseDuration - backDuration) / heaveDuration);
    return side * (-6 * back * (1 - heave) + 18 * heave);
  };
  const carrier = (slot: 0 | 1) => {
    if (pickup && pickupAge >= 0) return carrierGround(pickup.pair[slot], pickupAge, at => ({ x: pickup.pair[slot].x + shifts(at), y: pickup.pair[slot].y }), afterPickup);
    return carrierGround(pair[slot], age, at => {
      const approach = drive(at / timing.grip), shift = pickupAt === null ? 0 : shifts(at - (pickupAt - contactAt));
      return { x: mix(pair[slot].x, goals[slot].x, approach) + shift, y: mix(pair[slot].y, goals[slot].y, approach) };
    }, Math.max(timing.release, requiredImpactAt - contactAt));
  };
  frame.aggressor = carrier(0); frame.helper = carrier(1);
  frame.rebound = rebound;
  frame.groggy = age >= timing.rebound ? 1 - stretch : 0;
  frame.reboundHeight = age >= 0 && age < timing.rebound ? Math.sin(reboundProgress * Math.PI) ** 2 * 26 * pace : 0;
  frame.lift = 70 * lifted - 6 * backload * (1 - tossed) + 14 * tossed;
  frame.victimCarryStretch = stretch;
  frame.overhead = lifted;
  frame.carrierDrive = lifted;
  frame.pairLoad = load; frame.pairLift = lifted; frame.pairBackload = backload; frame.pairHeave = tossed; frame.throwShift = throwShift;
  frame.victimAngle = side * (mix(rebound * .30, Math.PI * .47, fallen) + stretch * Math.PI * .03);
  frame.victimPose = pickupAge >= 0 ? 'carried' : impactAge >= 0 ? 'stunned' : undefined;
  frame.victimSuspension = age >= timing.grip ? lifted : impactAge >= 0 ? 1 - fallen : 0;
  frame.grip = released ? undefined : age >= timing.grip ? 'arms-legs' : impactAge < 0 ? 'pair' : undefined;
  frame.carrierPose = age < timing.grip ? 'drag' : 'pairlift';
  frame.armsHolderId = round.aggressor; frame.legsHolderId = round.helper;
  frame.stage = waitingForGrip ? 'wrestle' : released ? 'release' : elapsed < contactAt ? 'charge' : age < timing.rebound ? 'rebound' : age < timing.grip ? 'groggy'
    : pickupAge < 40 ? 'grip' : load < 1 ? 'load' : lifted < 1 ? 'lift' : pickupAge < loadDuration + riseDuration + backDuration ? 'overhead' : 'toss';
  return frame;
}

export type ArenaPairRushFlightFrame = ArenaPoint & {
  groundX: number; groundY: number; height: number; angle: number; phase: number;
  stage: 'flight' | 'land' | 'recover' | 'walk';
  pose: 'carried' | 'recover' | 'walk'; carryStretch: number; suspension: number; facing: number;
};

/** Release the held rig with upward velocity, then let constant gravity carry it down. */
export function arenaPairRushFlight(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1, held: { lift: number; angle: number; relax?: boolean; upward?: number } = { lift: 142, angle: direction * Math.PI / 2 }): ArenaPairRushFlightFrame {
  const ms = Math.max(0, age / Math.max(.001, unit));
  if (ms < 880) {
    const phase = clamp(ms / 880), groundX = mix(origin.x, landing.x, phase), groundY = mix(origin.y, landing.y, phase);
    const upward = held.upward ?? 220;
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
