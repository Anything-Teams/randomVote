import type { ArenaPoint, ArenaRound } from './arenaLogic';
import type { ArenaPose } from './game/ArenaFighter';
import { arenaTechniqueTargets } from './arenaTechniques';

export const ARENA_RECOVERY_THROW_SPAN = 3900;
export const ARENA_RECOVERY_EXIT_DURATION = 2600;
export const ARENA_RECOVERY_DURATION = ARENA_RECOVERY_THROW_SPAN + ARENA_RECOVERY_EXIT_DURATION;
export type ArenaRecoveryWindow = { start: number; end: number; throwAt?: number; kind?: 'overhead-escape'; throwerId?: string };
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const ease = (p: number) => { const t = clamp(p); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const inside = (point: ArenaPoint): ArenaPoint => {
  const radius = Math.hypot((point.x - 500) / 255, (point.y - 416) / 76);
  return radius <= 1 ? point : { x: 500 + (point.x - 500) / radius, y: 416 + (point.y - 416) / radius };
};

function safeLanding(initial: ArenaPoint, side: number) {
  return [0, .50, -.50, .95, -.95, 1.4, -1.4, 1.85, -1.85, Math.PI]
    .map(angle => inside({ x: initial.x + side * Math.cos(angle) * 155, y: initial.y + Math.sin(angle) * 49 + 9 }))
    .sort((a, b) => Math.hypot(b.x - initial.x, b.y - initial.y) - Math.hypot(a.x - initial.x, a.y - initial.y))[0];
}

function separation(landing: ArenaPoint, thrownFrom: ArenaPoint, age: number) {
  const away = { x: landing.x - thrownFrom.x, y: landing.y - thrownFrom.y };
  const length = Math.max(1, Math.hypot(away.x, away.y));
  const departure = [0, .55, -.55, 1.1, -1.1, 1.55, -1.55]
    .map(turn => inside({ x: landing.x + (away.x * Math.cos(turn) - away.y * Math.sin(turn)) / length * 72, y: landing.y + (away.x * Math.sin(turn) + away.y * Math.cos(turn)) / length * 38 }))
    .filter(point => (point.x - landing.x) * away.x + (point.y - landing.y) * away.y >= -1e-8)
    .sort((a, b) => Math.hypot(b.x - thrownFrom.x, b.y - thrownFrom.y) - Math.hypot(a.x - thrownFrom.x, a.y - thrownFrom.y))[0] ?? landing;
  const retreat = inside({ x: thrownFrom.x - away.x / length * 28, y: thrownFrom.y - away.y / length * 14 });
  const phase = ease((age - 1100) / 1000);
  return {
    thrower: { x: mix(thrownFrom.x, retreat.x, phase), y: mix(thrownFrom.y, retreat.y, phase) },
    receiver: { x: mix(landing.x, departure.x, phase), y: mix(landing.y, departure.y, phase) },
    returnCenter: { x: (retreat.x + departure.x) / 2, y: (retreat.y + departure.y) / 2 },
  };
}

/** Keep the raised suplex rig until the held fighter jumps free of the hands. */
function overheadEscape(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const window = round.recovery!, side = round.contactSide ?? (center.x < 500 ? -1 : 1);
  const unit = Math.max(.001, round.timeScale ?? 1), throwAt = window.throwAt ?? window.start + ARENA_RECOVERY_THROW_SPAN * unit;
  const span = Math.max(1, throwAt - window.start), age = (elapsed - throwAt) / unit;
  // The normal suplex's readable .70 overhead hold is the exact release rig.
  const heldRound = { ...round, recovery: undefined, suplexGripAt: undefined, tactic: 'suplex' as const, start: window.start, impact: window.start + span / .70 };
  const lifting = arenaTechniqueTargets(heldRound, Math.min(elapsed, throwAt), center);
  const held = arenaTechniqueTargets(heldRound, throwAt, center);
  const initial = inside(held.victim), landing = safeLanding(initial, side);
  const escaped = separation(landing, held.aggressor, age);
  const flight = clamp(age / 880), landed = age >= 880;
  const balance = age >= 0 && age < 700 ? Math.sin(Math.PI * clamp(age / 700)) ** 2 : 0;
  const landingPhase = clamp((age - 880) / 220), lowerHands = age < 0 ? lifting.aggressorOverheadRaise : 1 - ease(flight / .32);
  const jumping = age >= 0 && !landed;
  const throwerPose: ArenaPose = age < 0 ? lifting.aggressorPose ?? 'grapple' : lowerHands > 0 ? 'overhead' : balance > .05 ? 'brace' : 'guard';
  const receiverPose: ArenaPose = age < 0 ? lifting.victimPose ?? 'brace' : jumping ? 'airborne' : landed && age < 1100 ? 'land' : 'guard';
  return {
    kind: 'overhead-escape' as const,
    active: elapsed >= window.start && elapsed < window.end,
    stage: age < 0 ? lifting.stage === 'overhead' ? 'overhead' : lifting.stage === 'lift' ? 'lift' : lifting.grip ? 'hold' : 'approach' : !landed ? 'jump' : age < 1100 ? 'land' : age < 2100 ? 'separate' : 'release',
    side, phase: age < 0 ? lifting.phase : landingPhase, airborne: jumping,
    thrower: age >= 1100 ? escaped.thrower : inside({ x: (age < 0 ? lifting.aggressor.x : held.aggressor.x) - side * balance * 4, y: age < 0 ? lifting.aggressor.y : held.aggressor.y }),
    receiver: age < 0 ? inside(lifting.victim) : landed ? escaped.receiver : { x: mix(initial.x, landing.x, flight), y: mix(initial.y, landing.y, flight) },
    height: age < 0 ? lifting.lift : !landed ? 100 * (1 - ease(flight)) + 64 * 4 * flight * (1 - flight) : 0,
    angle: jumping ? side * .12 * Math.sin(Math.PI * flight) : 0,
    grip: age < 0 && !!lifting.grip,
    throwAt, flightPhase: flight, throwPhase: clamp(age / 350), liftPhase: age < 0 ? lifting.aggressorOverheadRaise : 1,
    landingPhase, returnCenter: escaped.returnCenter,
    throwerPose,
    overheadRaise: lowerHands,
    receiverPose,
    // Unfold the held feet during descent, before the soles reach the sand.
    // Leaving the suplex tuck at one made the knees contact first at landing.
    receiverSlam: age < 0 ? lifting.victimSlam : { tuck: 1 - ease((flight - .45) / .42), slump: landingPhase },
    suspension: age < 0 ? lifting.victimSuspension : jumping ? 1 - ease((flight - .80) / .20) : 0,
    jumpTuck: jumping ? Math.sin(Math.PI * clamp(flight / .85)) ** 2 : 0,
    throwerBalance: balance,
    throwerEffort: age < 0 ? lifting.aggressorEffort : undefined,
    receiverEffort: age < 0 ? lifting.victimEffort : undefined,
    liftPreparation: age < 0 ? lifting.aggressorLiftPreparation : undefined,
  };
}

/** A rare failed throw is a real airborne somersault and feet-first landing on the sand. */
export function arenaRecoveryTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  if (!round.recovery) return undefined;
  if (round.recovery.kind === 'overhead-escape') return overheadEscape(round, elapsed, center);
  const side = round.contactSide ?? (center.x < 500 ? -1 : 1);
  const unit = Math.max(.001, round.timeScale ?? 1);
  const age = Math.max(0, (elapsed - round.recovery.start) / unit);
  const throwSpan = round.recovery.throwAt === undefined ? ARENA_RECOVERY_THROW_SPAN : (round.recovery.throwAt - round.recovery.start) / unit;
  const progress = clamp(age / Math.max(1, throwSpan)), take = ease((progress - .72) / .28);
  // Match a normal thrown exit: 40ms release hold followed by 840ms flight.
  const throwAge = age - throwSpan, flight = clamp((throwAge - 40) / 840);
  const initial = inside({ x: center.x + side * 23, y: center.y });
  // Choose a full-distance patch of sand, bending along the rim when a
  // straight outward throw cannot provide room for a safe surviving landing.
  const landing = safeLanding(initial, side);
  const landed = throwAge >= 880 - 1e-8, airborne = throwAge >= 0 && !landed;
  const height = throwAge < 0 ? take * 42 : !landed ? 42 * (1 - ease(flight)) + 158 * 4 * flight * (1 - flight) : 0;
  // Most of the rotation happens around the high part of the arc. The last
  // quarter of the descent lets the straightened feet read before contact.
  const turn = side * Math.PI * 2 * ease((flight - .08) / .76);
  const thrownFrom = inside({ x: center.x - side * 23, y: center.y });
  // A survivor uses the landing momentum to leave this opponent behind.
  // Bend along the sand when the rim leaves no straight runway.
  const escaped = separation(landing, thrownFrom, throwAge);
  const thrower = escaped.thrower;
  const receiver = landed ? escaped.receiver : { x: mix(initial.x, landing.x, flight), y: mix(initial.y, landing.y, flight) };
  return {
    kind: undefined,
    active: elapsed >= round.recovery.start && elapsed < round.recovery.end,
    stage: progress < .30 ? 'approach' : progress < .52 ? 'hold' : throwAge < 0 ? 'lift' : !landed ? 'somersault' : throwAge < 1100 ? 'land' : throwAge < 2100 ? 'separate' : 'release',
    side, phase: throwAge < 0 ? take : clamp(throwAge / 350), airborne,
    thrower, receiver,
    height, angle: turn, grip: progress >= .30 && throwAge < 0,
    throwAt: round.recovery.throwAt ?? round.recovery.start + throwSpan * unit,
    flightPhase: flight, throwPhase: clamp(throwAge / 350), liftPhase: take,
    landingPhase: clamp((throwAge - 880) / 220), returnCenter: escaped.returnCenter,
    throwerPose: undefined, overheadRaise: undefined, receiverPose: undefined, receiverSlam: undefined,
    suspension: undefined, jumpTuck: undefined, throwerBalance: undefined,
    throwerEffort: undefined, receiverEffort: undefined, liftPreparation: undefined,
  };
}
