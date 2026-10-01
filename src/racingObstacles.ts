import { racingObstacleLoss, racingStandings, type RacingIncident, type RacingTimeline, type RacingCourseChallenge } from './racingNarrative';
import type { RaceHorseMotion } from './racingArt';
import type { RacingCamera } from './racingCamera';
import type { RacingEffectPlacement } from './racingEffects';

export type RacingObstacle = RacingCourseChallenge & { x: number; y: number; scale: number };
export type RacingCourseObstacle = Omit<RacingObstacle, 'x' | 'y' | 'scale'>;

/** An obstacle stays at one course distance, even before its story or after the landing. */
export function racingObstacleDistance(timeline: RacingTimeline, incident: RacingIncident) {
  const planned = timeline.obstacles.find(obstacle => obstacle.actorId === incident.actorId && obstacle.kind === incident.kind && obstacle.encounter >= incident.start && obstacle.encounter <= incident.end);
  return planned ?? timeline.obstacles[0];
}

/** Three spaced course challenges give different horses a turn without changing the finish plan. */
export function racingCourseObstacles(timeline: RacingTimeline): RacingCourseObstacle[] {
  return timeline.obstacles;
}

export function racingObstacleStatus(timeline: RacingTimeline, obstacle: RacingCourseChallenge, elapsed: number) {
  const beforeRank = racingStandings(timeline, obstacle.impact).find(item => item.id === obstacle.actorId)?.rank ?? 1;
  const currentRank = racingStandings(timeline, elapsed).find(item => item.id === obstacle.actorId)?.rank ?? 1;
  const scale = (timeline.finish - timeline.start) / 33_500;
  const stage = elapsed < obstacle.encounter ? 'approach' : elapsed < obstacle.impact ? 'jump' : obstacle.outcome === 'clear' ? 'clear'
    : elapsed < obstacle.impact + 750 * scale ? 'impact' : elapsed < obstacle.recovered ? 'recover' : elapsed < (obstacle.catchupEnd ?? obstacle.recovered) ? 'chase' : 'clear';
  return { stage, beforeRank, currentRank, lost: racingObstacleLoss(obstacle, elapsed) };
}

/** Failed landings gather the legs, check the reins, regain balance, then chase the lost ground. */
export function racingObstacleMotion(obstacle: RacingCourseChallenge, elapsed: number, reduced = false): RaceHorseMotion {
  if (reduced || obstacle.outcome === 'clear' || elapsed < obstacle.impact || elapsed >= obstacle.recovered) return {};
  const scale = (obstacle.recovered - obstacle.lowest) / 1500, age = (elapsed - obstacle.impact) / (1100 * scale);
  const ease = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
  const stagger = age < .95 ? Math.sin(Math.PI * ease(age / .95)) : age < 1.6 ? -.38 * Math.sin(Math.PI * ease((age - .95) / .65)) : 0;
  const recovery = ease((elapsed - obstacle.lowest) / Math.max(1, obstacle.recovered - obstacle.lowest));
  const missedStep = Math.sin(Math.PI * ease(Math.min(1, age / 1.1)));
  const fall = ease(age / .38) * (1 - ease((elapsed - obstacle.lowest) / (1100 * scale)));
  const check = Math.max(Math.sin(Math.PI * ease(Math.min(1, age / 1.3))) * .95, fall * .58);
  return { fall, spill: fall, stumble: stagger * .28, check, trip: obstacle.outcome === 'clip' ? missedStep : 0, slip: obstacle.outcome === 'slip' ? missedStep : 0, crouch: Math.sin(Math.PI * recovery) * .9 };
}

/** The collapsed body stays on its course row while passing horses gain real forward distance. */
export function placeRacingFalls<T extends RacingEffectPlacement>(placements: T[], _timeline: RacingTimeline, _elapsed: number, _height: number, _reduced = false): T[] {
  return placements;
}

export function placeRacingObstacles(timeline: RacingTimeline, camera: Pick<RacingCamera, 'center' | 'span'>, placements: RacingEffectPlacement[], width: number): RacingObstacle[] {
  return racingCourseObstacles(timeline).flatMap(obstacle => {
    const actor = placements.find(item => item.id === obstacle.actorId);
    if (!actor) return [];
    return [{ ...obstacle, x: width * .5 + (obstacle.distance - camera.center) / camera.span * width * .65, y: actor.y, scale: actor.scale }];
  });
}

/** The jump follows the approaching object, so camera size and race pace cannot miss it. */
export function racingObstacleJump(obstacle: RacingObstacle, actor: RacingEffectPlacement): number {
  const relative = (obstacle.x - actor.x) / Math.max(.05, actor.scale);
  const phase = Math.max(0, Math.min(1, (78 - relative) / 140));
  const clearance = obstacle.outcome === 'clip' ? .42 : obstacle.outcome === 'slip' ? .68 : 1;
  return Math.sin(Math.PI * phase * phase * (3 - 2 * phase)) * clearance;
}

/** Ground objects enter and leave through the canvas edges; their opacity never changes. */
export function drawRacingObstacles(ctx: CanvasRenderingContext2D, obstacles: RacingObstacle[], width: number, elapsed: number, reduced: boolean, layer: 'ground' | 'air') {
  for (const obstacle of obstacles) {
    const { x, y, scale: s, kind } = obstacle;
    if (x + 34 * s < 0 || x - 34 * s > width) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (layer === 'ground') {
      if (kind === 'hay-jump') {
        const crushed = obstacle.outcome === 'clip' ? Math.max(0, Math.min(1, (elapsed - obstacle.impact) / 350)) : 0;
        ctx.fillStyle = '#3c322b55'; ctx.beginPath(); ctx.ellipse(3, 2.2, 20, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.scale(1 + crushed * .22, 1 - crushed * .5);
        ctx.fillStyle = '#745335'; ctx.fillRect(-14, -13, 28, 13);
        ctx.fillStyle = '#bd9653'; ctx.fillRect(-13, -15, 26, 13);
        ctx.fillStyle = '#d1b06c'; ctx.fillRect(-13, -15, 26, 2);
        ctx.strokeStyle = '#e3c98b'; ctx.lineWidth = .8;
        for (let straw = 0; straw < 10; straw++) { const sx = -11 + straw * 2.4; ctx.beginPath(); ctx.moveTo(sx, -12 + straw % 3); ctx.lineTo(sx + 2, -3 - straw % 2); ctx.stroke(); }
        ctx.fillStyle = '#7a6346'; ctx.fillRect(-7, -15, 1.8, 13); ctx.fillRect(5, -15, 1.8, 13);
        ctx.restore();
      } else {
        ctx.fillStyle = '#3e3e3277'; ctx.beginPath(); ctx.ellipse(0, .5, 31, 5, -.02, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#244c6099'; ctx.beginPath(); ctx.ellipse(0, .4, 28, 4.2, -.02, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6babb8ba'; ctx.beginPath(); ctx.ellipse(2, 0, 23, 2.7, -.02, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#bbd8d1'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(-17, -.6); ctx.lineTo(-3, -1); ctx.moveTo(8, .8); ctx.lineTo(18, .3); ctx.stroke();
        if (obstacle.outcome === 'slip') {
          const skid = Math.max(0, Math.min(1, (elapsed - obstacle.impact) / 650)), fade = 1 - Math.max(0, Math.min(1, (elapsed - obstacle.lowest) / 1600));
          ctx.globalAlpha *= fade; ctx.strokeStyle = '#c6dfe1'; ctx.lineWidth = 1.25;
          for (const row of [-1, 2]) { ctx.beginPath(); ctx.moveTo(7, row); ctx.lineTo(7 + skid * 40, row + 1); ctx.stroke(); }
        }
      }
    } else if (!reduced && (kind === 'puddle' || obstacle.outcome === 'clip')) {
      const age = (elapsed - obstacle.impact) / (obstacle.outcome === 'clear' ? 450 : 850);
      if (age > 0 && age < 1) {
        ctx.globalAlpha *= 1 - age;
        for (let splash = 0; splash < 12; splash++) {
          const direction = splash % 2 ? 1 : -1, reach = 12 + splash * 1.8;
          ctx.fillStyle = kind === 'puddle' ? '#b0e0e6' : '#e3c98b'; ctx.beginPath(); ctx.ellipse(7 + direction * age * reach, -Math.sin(age * Math.PI) * (7 + splash % 4 * 3), kind === 'puddle' ? 1.15 : 1.8, kind === 'puddle' ? 2 : 1.3, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}
