import type { ArenaPoint } from './arenaLogic';
import { ARENA_PAIR_COUNTER_TIMING } from './arenaPairRush';

export type ArenaLinkedRushWindow = {
  start: number; end: number;
  launchAt?: number | null; contactAt?: number;
};
/** Keep these captured roots fixed throughout the preparation and run. */
export type ArenaLinkedRushOrigins = {
  pair: [ArenaPoint, ArenaPoint]; victim: ArenaPoint;
  /** The actual painted neck/upper chest, sampled before the attack starts. */
  neck?: ArenaPoint;
  /** Actual selected shoulder minus its fighter's ground root. */
  shoulderOffsets?: [ArenaPoint, ArenaPoint];
};
export type ArenaLinkedRushFrame = {
  stage: 'approach' | 'link' | 'charge' | 'contact' | 'release';
  active: boolean; released: boolean; canHit: boolean; waitingForLink: boolean;
  pair: [ArenaPoint, ArenaPoint]; victim: ArenaPoint;
  pairFacing: [1 | -1, 1 | -1]; linkedArms: [0 | 1, 0 | 1];
  /** Both selected hands meet here; the joined arms form a transverse bar. */
  linkHands: [ArenaPoint, ArenaPoint]; linkPoint: ArenaPoint; targetNeck: ArenaPoint;
  direction: ArenaPoint; linkStrength: number; chargePreparation: number; chargeStrength: number;
  readyAt: number; launchAt: number | null; contactAt: number; requiredEndAt: number;
  /** Exact roots/direction to inherit in the existing post-contact shared throw. */
  contactPair: [ArenaPoint, ArenaPoint]; contactVictim: ArenaPoint;
};

export const ARENA_LINKED_RUSH_CHANCE = .001;
export const ARENA_LINKED_RUSH_SPEED = 162;
export const ARENA_LINKED_RUSH_MAX_PRELUDE = 7000;
const ARM_HALF_SPAN = 41;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a: ArenaPoint, b: ArenaPoint, p: number): ArenaPoint => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const advance = (point: ArenaPoint, direction: ArenaPoint, amount: number): ArenaPoint => ({ x: point.x + direction.x * amount, y: point.y + direction.y * amount });
const inside = (point: ArenaPoint, rx = 293, ry = 102) => Math.hypot((point.x - 500) / rx, (point.y - 416) / ry) <= 1;

/** Independent cosmetic roll; eligibility never changes the drawn loser. */
export function arenaLinkedRushOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Linked rush roll must be 0–999');
  return roll === 0;
}

/**
 * Two allies walk into a readable side-by-side formation, join one straight
 * arm each, and run the same depthward path. The target remains at its actual
 * root. No physical phase is compressed to fit the surrounding bout window.
 * The Scene verifies the actual rendered hand line against the actual neck
 * before recording contact and handing these roots to the shared throw.
 */
export function arenaLinkedRushTargets(window: ArenaLinkedRushWindow, elapsed: number, center: ArenaPoint,
  origins?: ArenaLinkedRushOrigins, unit = 1): ArenaLinkedRushFrame {
  const initial = origins ?? {
    pair: [{ x: center.x - 80, y: center.y + 66 }, { x: center.x + 80, y: center.y + 66 }] as [ArenaPoint, ArenaPoint],
    victim: { ...center },
  };
  const timeUnit = Math.max(.001, unit), speed = ARENA_LINKED_RUSH_SPEED / 1000;
  const left = initial.pair[0].x <= initial.pair[1].x ? 0 : 1;
  const targetNeck = { ...(initial.neck ?? { x: initial.victim.x, y: initial.victim.y - 84 }) };
  // Upright selected shoulders are horizontal. Captured renderer offsets also
  // account for the real run lean; the scene keeps sampling them during play.
  const shoulderOffsets = initial.shoulderOffsets ?? initial.pair.map((_, index) => ({ x: index === left ? 14.28 : -14.28, y: -84 })) as [ArenaPoint, ArenaPoint];
  const contactFormation = initial.pair.map((_, index) => ({
    x: targetNeck.x + (index === left ? -ARM_HALF_SPAN : ARM_HALF_SPAN) - shoulderOffsets[index].x,
    y: targetNeck.y - shoulderOffsets[index].y,
  })) as [ArenaPoint, ArenaPoint];
  // A horizontal arm bar remains clearly transverse to the body. Choose an
  // actual up/down runway, rather than flattening two linked fighters into a
  // single side-on silhouette or stretching an arm across the arena.
  const options = [1, -1].flatMap(sign => [92, 80, 68].map(runway => {
    const direction = { x: 0, y: sign };
    const formation = contactFormation.map(point => advance(point, direction, -runway)) as [ArenaPoint, ArenaPoint];
    const longest = Math.max(...formation.map((point, index) => distance(point, initial.pair[index])));
    const valid = formation.every(point => inside(point)) && contactFormation.every(point => inside(point));
    return { direction, formation, runway, longest, valid, cost: longest + (92 - runway) * .4 };
  }));
  const plan = options.filter(option => option.valid).sort((a, b) => a.cost - b.cost)[0] ?? options[0];
  // Smoothstep reaches at most 1.5 times its average speed. Sharing the longest
  // approach clock bounds both fighters and brings both to rest before linking.
  const approachDuration = Math.max(320 * timeUnit, plan.longest * 1500 / ARENA_LINKED_RUSH_SPEED);
  const readyAt = window.start + approachDuration;
  const launchAt = window.launchAt === null ? null : Math.max(readyAt, window.launchAt ?? readyAt + 180 * timeUnit);
  const assumedLaunch = launchAt ?? readyAt + 180 * timeUnit;
  const runRamp = 180 * timeUnit;
  const runDuration = Math.max(300 * timeUnit, plan.runway / speed + runRamp / 2);
  const physicalContactAt = assumedLaunch + runDuration;
  const contactAt = window.contactAt !== undefined && window.contactAt >= assumedLaunch ? window.contactAt : physicalContactAt;
  const runTravel = (age: number) => {
    const t = Math.max(0, Math.min(runDuration, age));
    return Math.min(plan.runway, speed * (t < runRamp ? t * t / (2 * runRamp) : t - runRamp / 2));
  };
  const contactTravel = runTravel(contactAt - assumedLaunch);
  const contactPair = plan.formation.map(point => advance(point, plan.direction, contactTravel)) as [ArenaPoint, ArenaPoint];
  const canHit = plan.valid && initial.pair.every(point => inside(point, 303, 112)) && inside(initial.victim, 293, 102)
    && physicalContactAt - window.start <= ARENA_LINKED_RUSH_MAX_PRELUDE;
  const approaching = canHit ? ease((elapsed - window.start) / approachDuration) : 0;
  const running = canHit && launchAt !== null && elapsed >= launchAt;
  const travel = running ? runTravel(Math.min(elapsed, contactAt) - launchAt!) : 0;
  const pair = initial.pair.map((point, index) => running
    ? advance(plan.formation[index], plan.direction, travel)
    : mix(point, plan.formation[index], approaching)) as [ArenaPoint, ArenaPoint];
  const shoulders = pair.map((point, index) => ({ x: point.x + shoulderOffsets[index].x, y: point.y + shoulderOffsets[index].y }));
  const linkPoint = mix(shoulders[0], shoulders[1], .5);
  const linkedArms = initial.pair.map((_, index) => index === left ? 1 : 0) as [0 | 1, 0 | 1];
  // Front-facing actors keep their inner shoulder on the same side even while
  // their ground velocity goes into depth. The renderer owns depthward gait.
  const pairFacing: [1, 1] = [1, 1];
  const linked = canHit ? ease((elapsed - readyAt + 240 * timeUnit) / (240 * timeUnit)) : 0;
  const requiredEndAt = contactAt + ARENA_PAIR_COUNTER_TIMING.release;
  const released = canHit && launchAt !== null && elapsed >= requiredEndAt;
  const stage: ArenaLinkedRushFrame['stage'] = released ? 'release' : !canHit || elapsed < readyAt ? 'approach'
    : !running ? 'link' : elapsed < contactAt ? 'charge' : 'contact';
  return {
    stage, active: canHit && elapsed >= window.start && !released, released, canHit,
    waitingForLink: launchAt === null || elapsed < launchAt,
    pair, victim: { ...initial.victim }, pairFacing, linkedArms,
    linkHands: [{ ...linkPoint }, { ...linkPoint }], linkPoint, targetNeck,
    direction: { ...plan.direction }, linkStrength: linked,
    chargePreparation: linked * (running ? 1 - ease((elapsed - launchAt!) / runRamp) : 1),
    chargeStrength: running && elapsed < contactAt ? ease((elapsed - launchAt!) / runRamp) : 0,
    readyAt, launchAt, contactAt, requiredEndAt, contactPair, contactVictim: { ...initial.victim },
  };
}
