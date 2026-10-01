import type { Candidate } from './election';
import { racingIncidentStatus, racingStandings, readRacingTravel, type RacingTimeline } from './racingNarrative';

export type RacingCamera = { center: number; span: number; elapsed: number | null; key: string; horses: Map<string, { y: number; scale: number }> };
export type RacingPlacement = { id: string; index: number; distance: number; x: number; y: number; scale: number; featured: boolean };
export function createRacingCamera(): RacingCamera { return { center: 0, span: .08, elapsed: null, key: '', horses: new Map() }; }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Keep leaders and every actual overtaking opponent together, before the story starts. */
export function racingFocusIds(timeline: RacingTimeline, elapsed: number): string[] {
  const leaders = racingStandings(timeline, elapsed).slice(0, 3).map(standing => standing.id);
  const straightOpponents = timeline.straight.waves.flatMap(wave => wave.swaps.flatMap(swap =>
    wave.beforeOrder.indexOf(swap.aheadId) < 3 && elapsed >= swap.start - 500 && elapsed < swap.end + 650
      ? [swap.aheadId, swap.behindId] : []));
  const incidentActors = timeline.incidents.filter(item => elapsed >= item.start - 1100 && elapsed < item.end + 1600)
    .flatMap(incident => [incident.actorId, incident.rivalId, ...racingIncidentStatus(timeline, incident, elapsed).opponentIds]);
  return [...new Set([...leaders, ...straightOpponents, ...incidentActors])];
}

/** A fixed distance projection and persistent horses replace rank-based scene cuts. */
export function placeRacingField(camera: RacingCamera, candidates: Candidate[], timeline: RacingTimeline, elapsed: number, w: number, h: number, delta: number, immediate = false): RacingPlacement[] {
  const focus = racingFocusIds(timeline, elapsed);
  const distances = candidates.map(candidate => readRacingTravel(timeline, candidate.id, elapsed));
  const tracked = distances;
  const ahead = Math.max(0, ...tracked), behind = tracked.length ? Math.min(...tracked) : 0;
  const span = Math.max(.067, (ahead - behind) * 1.35 + .016), center = (ahead + behind) / 2;
  const key = timeline.ids.join('|') + ':' + timeline.finishOrder.join('|');
  const reset = immediate || camera.key !== key || camera.elapsed === null || elapsed < camera.elapsed - 150 || elapsed - camera.elapsed > 500;
  const blend = reset ? 1 : 1 - Math.exp(-delta / 650);
  camera.center += (center - camera.center) * blend;
  camera.span += (span - camera.span) * blend;
  camera.key = key; camera.elapsed = elapsed;
  // Ranking changes the camera's subject, never a horse's physical size.
  const scale = clamp(Math.min(w / 600, h / 470), .17, 1.35);
  return candidates.map((candidate, index) => {
    const isFeatured = focus.includes(candidate.id);
    // Each horse keeps its course row while focus only controls the camera and labels.
    const targetY = h * (candidates.length <= 1 ? .79 : .54 + index / (candidates.length - 1) * .36);
    const targetScale = scale;
    let pose = camera.horses.get(candidate.id);
    if (!pose || reset) { pose = { y: targetY, scale: targetScale }; camera.horses.set(candidate.id, pose); }
    const laneBlend = reset ? 1 : 1 - Math.exp(-delta / 550);
    pose.y += (targetY - pose.y) * laneBlend; pose.scale += (targetScale - pose.scale) * laneBlend;
    return { id: candidate.id, index, distance: distances[index], x: w * .5 + (distances[index] - camera.center) / camera.span * w * .65, y: pose.y, scale: pose.scale, featured: isFeatured };
  });
}
