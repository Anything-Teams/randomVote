import { readRacingDistance, type RacingIncident, type RacingTimeline } from './racingNarrative';
import type { RacingCamera } from './racingCamera';
import type { RacingEffectPlacement } from './racingEffects';

export type RacingObstacle = { kind: 'hay-jump' | 'puddle'; actorId: string; distance: number; encounter: number; x: number; y: number; scale: number };

/** An obstacle stays at one course distance, even before its story or after the landing. */
export function racingObstacleDistance(timeline: RacingTimeline, incident: RacingIncident) {
  const encounter = incident.start + (incident.end - incident.start) * .5;
  return { encounter, distance: readRacingDistance(timeline, incident.actorId, encounter) };
}

export function placeRacingObstacles(timeline: RacingTimeline, camera: Pick<RacingCamera, 'center' | 'span'>, placements: RacingEffectPlacement[], width: number): RacingObstacle[] {
  return timeline.incidents.flatMap(incident => {
    if (incident.kind !== 'hay-jump' && incident.kind !== 'puddle') return [];
    const actor = placements.find(item => item.id === incident.actorId);
    if (!actor) return [];
    const position = racingObstacleDistance(timeline, incident);
    return [{ kind: incident.kind, actorId: incident.actorId, ...position, x: width * .5 + (position.distance - camera.center) / camera.span * width * .65, y: actor.y, scale: actor.scale }];
  });
}

/** The jump follows the approaching object, so camera size and race pace cannot miss it. */
export function racingObstacleJump(obstacle: RacingObstacle, actor: RacingEffectPlacement): number {
  const relative = (obstacle.x - actor.x) / Math.max(.05, actor.scale);
  const phase = Math.max(0, Math.min(1, (78 - relative) / 140));
  return Math.sin(Math.PI * phase * phase * (3 - 2 * phase));
}

/** Ground objects enter and leave through the canvas edges; their opacity never changes. */
export function drawRacingObstacles(ctx: CanvasRenderingContext2D, obstacles: RacingObstacle[], width: number, elapsed: number, reduced: boolean, layer: 'ground' | 'air') {
  for (const obstacle of obstacles) {
    const { x, y, scale: s, kind } = obstacle;
    if (x + 34 * s < 0 || x - 34 * s > width) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (layer === 'ground') {
      if (kind === 'hay-jump') {
        ctx.fillStyle = '#3c322b55'; ctx.beginPath(); ctx.ellipse(3, 2.2, 20, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#745335'; ctx.fillRect(-14, -13, 28, 13);
        ctx.fillStyle = '#bd9653'; ctx.fillRect(-13, -15, 26, 13);
        ctx.fillStyle = '#d1b06c'; ctx.fillRect(-13, -15, 26, 2);
        ctx.strokeStyle = '#e3c98b'; ctx.lineWidth = .8;
        for (let straw = 0; straw < 10; straw++) { const sx = -11 + straw * 2.4; ctx.beginPath(); ctx.moveTo(sx, -12 + straw % 3); ctx.lineTo(sx + 2, -3 - straw % 2); ctx.stroke(); }
        ctx.fillStyle = '#7a6346'; ctx.fillRect(-7, -15, 1.8, 13); ctx.fillRect(5, -15, 1.8, 13);
      } else {
        ctx.fillStyle = '#3e3e3277'; ctx.beginPath(); ctx.ellipse(0, .5, 31, 5, -.02, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#244c6099'; ctx.beginPath(); ctx.ellipse(0, .4, 28, 4.2, -.02, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6babb8ba'; ctx.beginPath(); ctx.ellipse(2, 0, 23, 2.7, -.02, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#bbd8d1'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(-17, -.6); ctx.lineTo(-3, -1); ctx.moveTo(8, .8); ctx.lineTo(18, .3); ctx.stroke();
      }
    } else if (!reduced && kind === 'puddle') {
      const age = (elapsed - obstacle.encounter - 300) / 450;
      if (age > 0 && age < 1) {
        ctx.globalAlpha *= 1 - age;
        for (let splash = 0; splash < 8; splash++) {
          const direction = splash % 2 ? 1 : -1, reach = 7 + splash * 1.6;
          ctx.fillStyle = '#a5d5dc'; ctx.beginPath(); ctx.ellipse(20 + direction * age * reach, -Math.sin(age * Math.PI) * (4 + splash % 4 * 2), .7, 1.3, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}
