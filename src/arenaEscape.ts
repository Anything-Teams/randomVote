import type { ArenaPoint, ArenaRound } from './arenaLogic';

export const ARENA_ESCAPE_DURATION = 3800;
export const ARENA_ESCAPE_RELEASE_DURATION = 650;
export type ArenaEscapeWindow = { start: number; end: number; runnerId: string; chaserId?: string; side: 1 | -1; ungripped?: boolean; outcome?: 'rejoin' | 'separate'; releasedUntil?: number };
export type ArenaEscapeStage = 'approach' | 'grip' | 'break' | 'flee' | 'chase' | 'rejoin' | 'separate' | 'done';
export type ArenaEscapeFrame = {
  active: boolean;
  stage: ArenaEscapeStage;
  phase: number;
  runnerId: string;
  chaserId: string;
  runner: ArenaPoint;
  chaser: ArenaPoint;
  returnCenter: ArenaPoint;
  grip: boolean;
  release: number;
  separated: boolean;
  released: boolean;
  releasedUntil: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, phase: number) => a + (b - a) * clamp(phase);
const pointMix = (a: ArenaPoint, b: ArenaPoint, phase: number): ArenaPoint => ({ x: mix(a.x, b.x, phase), y: mix(a.y, b.y, phase) });
const inside = (point: ArenaPoint): ArenaPoint => {
  const radius = Math.hypot((point.x - 500) / 274, (point.y - 416) / 84);
  return radius <= 1 ? point : { x: 500 + (point.x - 500) / radius, y: 416 + (point.y - 416) / radius };
};
// A brief acceleration and braking ramp leaves most of a running stroke at a steady speed.
const cruise = (value: number) => {
  const p = clamp(value), ramp = .12;
  return (p < ramp ? p * p / (2 * ramp) : p > 1 - ramp ? 1 - ramp - (1 - p) ** 2 / (2 * ramp) : p - ramp / 2) / (1 - ramp);
};

/** A reversible integer mix keeps the cosmetic roll independent of the ranking. */
export function arenaEscapeRoll(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x7feb352d) >>> 0;
  value = Math.imul(value ^ value >>> 15, 0x846ca68b) >>> 0;
  return (value ^ value >>> 16) >>> 0;
}

/** A finite escape has no exit or ranking effect. Its route remains at the live encounter. */
export function arenaEscapeTargets(round: ArenaRound, elapsed: number, center: ArenaPoint): ArenaEscapeFrame | undefined {
  const escape = round.escape;
  if (!escape) return undefined;
  const runnerId = escape.runnerId, chaserId = escape.chaserId ?? (runnerId === round.victim ? round.aggressor : round.victim);
  const separated = escape.outcome === 'separate', releasedUntil = escape.releasedUntil ?? escape.end;
  const facing = round.contactSide ?? (center.x >= 500 ? 1 : -1), direction = runnerId === round.victim ? facing : -facing;
  const unit = round.timeScale ?? 1, pace = Math.min(1, unit), distance = 120 * pace, bend = escape.side * 14 * pace;
  const runnerGrip = inside({ x: center.x + direction * 25, y: center.y });
  const chaserGrip = inside({ x: center.x - direction * 25, y: center.y });
  const releasePoint = inside({ x: runnerGrip.x + direction * 10 * pace, y: runnerGrip.y + bend * .35 });
  // Near the rim the route bends along the available sand, rather than taking a new fixed home.
  const ray = [0, .65, -.65, 1.2, -1.2, 1.75, -1.75].map(angle => {
    const candidate = inside({ x: releasePoint.x + direction * Math.cos(angle) * distance, y: releasePoint.y + Math.sin(angle) * distance * .32 });
    return { candidate, distance: Math.hypot(candidate.x - releasePoint.x, candidate.y - releasePoint.y) };
  }).sort((a, b) => b.distance - a.distance)[0].candidate;
  const dx = ray.x - releasePoint.x, dy = ray.y - releasePoint.y;
  const far = inside({ x: ray.x, y: ray.y + bend });
  const turn = separated ? inside({ x: far.x + dx * .04, y: far.y + bend * .2 }) : far;
  // A successful escape keeps both people apart. The pursuer gives up and
  // changes direction instead of moving both bodies back to another grip.
  const endRunner = separated ? inside({ x: far.x + dx * .08, y: far.y + bend * .4 }) : far;
  const endChaser = separated ? inside({ x: chaserGrip.x - dx * .10, y: chaserGrip.y - bend }) : inside({ x: endRunner.x - direction * 50, y: endRunner.y });
  const returnCenter = { x: (endRunner.x + endChaser.x) / 2, y: (endRunner.y + endChaser.y) / 2 };
  const chaserFar = inside({ x: chaserGrip.x + dx * .32, y: chaserGrip.y + dy * .32 + bend * .2 });
  const chaserTurn = inside({ x: chaserGrip.x + dx * .57, y: chaserGrip.y + dy * .50 + bend * .25 });
  const duration = Math.max(1, escape.end - escape.start), age = clamp((elapsed - escape.start) / duration) * ARENA_ESCAPE_DURATION;
  let stage: ArenaEscapeStage, phase: number, runner: ArenaPoint, chaser: ArenaPoint, grip = false, release = 1;
  if (age < 1200) {
    stage = 'approach'; phase = age / 1200;
    runner = pointMix(inside({ x: runnerGrip.x + direction * 20 * pace, y: runnerGrip.y }), runnerGrip, ease(phase));
    chaser = pointMix(inside({ x: chaserGrip.x - direction * 20 * pace, y: chaserGrip.y }), chaserGrip, ease(phase));
    release = 0;
  } else if (age < 1440) {
    stage = 'grip'; phase = (age - 1200) / 240; runner = runnerGrip; chaser = chaserGrip; grip = true; release = 0;
  } else if (age < 1620) {
    stage = 'break'; phase = (age - 1440) / 180; release = ease(phase);
    runner = pointMix(runnerGrip, releasePoint, release); chaser = chaserGrip; grip = phase < .24;
  } else if (age < 2520) {
    stage = 'flee'; phase = (age - 1620) / 900;
    runner = pointMix(releasePoint, far, cruise(phase)); chaser = pointMix(chaserGrip, chaserFar, cruise(phase));
  } else if (age < 2840) {
    stage = 'chase'; phase = (age - 2520) / 320;
    runner = pointMix(far, turn, cruise(phase)); chaser = pointMix(chaserFar, chaserTurn, cruise(phase));
  } else {
    phase = (age - 2840) / 960; stage = elapsed >= escape.end ? 'done' : separated ? 'separate' : 'rejoin';
    runner = pointMix(turn, endRunner, ease(phase)); chaser = pointMix(chaserTurn, endChaser, ease(phase));
    grip = !separated && stage !== 'done' && phase > .92;
  }
  return { active: elapsed >= escape.start && elapsed < escape.end, stage, phase, runnerId, chaserId, runner, chaser, returnCenter, grip, release, separated, released: separated && elapsed >= escape.end && elapsed < releasedUntil, releasedUntil };
}
