import type { Candidate } from './election';
import { activeRacingIncident, racingIncidentStatus, racingStandings, readRacingTravel, type RacingTimeline } from './racingNarrative';

export type RacingCamera = { center: number; span: number; elapsed: number | null; key: string; horses: Map<string, { y: number; scale: number }> };
export type RacingPlacement = { id: string; index: number; distance: number; x: number; y: number; scale: number; featured: boolean };
export function createRacingCamera(): RacingCamera { return { center: 0, span: .08, elapsed: null, key: '', horses: new Map() }; }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Keep leaders and every actual overtaking opponent together, before the story starts. */
export function racingFocusIds(timeline: RacingTimeline, elapsed: number): string[] {
  const leaders = racingStandings(timeline, elapsed).slice(0, 3).map(standing => standing.id);
  const incident = activeRacingIncident(timeline, elapsed)
    ?? timeline.incidents.find(item => elapsed >= item.end && elapsed < item.end + 1600)
    ?? timeline.incidents.find(item => item.start > elapsed && item.start - elapsed <= 1100);
  if (!incident) return leaders;
  const status = racingIncidentStatus(timeline, incident, elapsed);
  return [...new Set([...leaders, incident.actorId, incident.rivalId, ...status.opponentIds])];
}

/** A fixed distance projection and persistent horses replace rank-based scene cuts. */
export function placeRacingField(camera: RacingCamera, candidates: Candidate[], timeline: RacingTimeline, elapsed: number, w: number, h: number, delta: number, immediate = false): RacingPlacement[] {
  const focus = racingFocusIds(timeline, elapsed), featured = candidates.filter(candidate => focus.includes(candidate.id));
  const distances = candidates.map(candidate => readRacingTravel(timeline, candidate.id, elapsed));
  const tracked = candidates.flatMap((candidate, index) => focus.includes(candidate.id) ? [distances[index]] : []);
  const ahead = Math.max(0, ...tracked), behind = tracked.length ? Math.min(...tracked) : 0;
  const span = Math.max(.067, (ahead - behind) * 1.35 + .016), center = (ahead + behind) / 2;
  const key = timeline.ids.join('|') + ':' + timeline.finishOrder.join('|');
  const reset = immediate || camera.key !== key || camera.elapsed === null || elapsed < camera.elapsed - 150 || elapsed - camera.elapsed > 500;
  const blend = reset ? 1 : 1 - Math.exp(-delta / 650);
  camera.center += (center - camera.center) * blend;
  camera.span += (span - camera.span) * blend;
  camera.key = key; camera.elapsed = elapsed;
  const scale = clamp(Math.min(w / 430, h * .48 / Math.max(180, featured.length * 78)), .17, 1.6);
  return candidates.map((candidate, index) => {
    const slot = featured.findIndex(item => item.id === candidate.id), isFeatured = slot >= 0;
    const targetY = h * (isFeatured ? featured.length <= 1 ? .79 : .54 + slot / (featured.length - 1) * .36 : .46 + (index + .5) / candidates.length * .16);
    const targetScale = scale * (isFeatured ? 1 : .58);
    let pose = camera.horses.get(candidate.id);
    if (!pose || reset) { pose = { y: targetY, scale: targetScale }; camera.horses.set(candidate.id, pose); }
    const laneBlend = reset ? 1 : 1 - Math.exp(-delta / 550);
    pose.y += (targetY - pose.y) * laneBlend; pose.scale += (targetScale - pose.scale) * laneBlend;
    return { id: candidate.id, index, distance: distances[index], x: w * .5 + (distances[index] - camera.center) / camera.span * w * .65, y: pose.y, scale: pose.scale, featured: isFeatured };
  });
}
