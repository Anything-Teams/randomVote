import type { Candidate } from './election';
import { racingIncidentStatus, racingStandings, readRacingTravel, type RacingTimeline } from './racingNarrative';
import { RACING_CAMERA_SPAN, RACING_FOCUS_GAP } from './racingFraming';

export type RacingCamera = { center: number; span: number; lead: number | null; velocity: number; elapsed: number | null; key: string; horses: Map<string, { y: number; scale: number }> };
export type RacingPlacement = { id: string; index: number; distance: number; x: number; y: number; scale: number; featured: boolean };
export function createRacingCamera(): RacingCamera { return { center: 0, span: RACING_CAMERA_SPAN, lead: null, velocity: 0, elapsed: null, key: '', horses: new Map() }; }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Keep nearby leaders and their actual overtaking opponents together. */
export function racingFocusIds(timeline: RacingTimeline, elapsed: number): string[] {
  const standings = racingStandings(timeline, elapsed), leader = Math.max(0, ...timeline.ids.map(id => readRacingTravel(timeline, id, elapsed)));
  const leaders = standings.slice(0, 3).map(standing => standing.id);
  const straightOpponents = timeline.straight.waves.flatMap(wave => wave.swaps.flatMap(swap =>
    wave.beforeOrder.indexOf(swap.aheadId) < 3 && elapsed >= swap.start - 500 && elapsed < swap.end + 650
      ? [swap.aheadId, swap.behindId] : []));
  const incidentActors = timeline.incidents.filter(item => elapsed >= item.start - 1100 && elapsed < item.end + 1600)
    .flatMap(incident => [incident.actorId, incident.rivalId, ...racingIncidentStatus(timeline, incident, elapsed).opponentIds]);
  const courseActors = timeline.obstacles.filter(item => elapsed >= item.encounter - 1600 && elapsed < item.recovered + 500).flatMap(obstacle => {
    const ranked = racingStandings(timeline, elapsed), position = ranked.findIndex(item => item.id === obstacle.actorId);
    return [obstacle.actorId, ...ranked.slice(Math.max(0, position - 1), position + 2).map(item => item.id)];
  });
  const bumpActors = (timeline.bumps ?? []).filter(item => elapsed >= item.start && elapsed < item.end).flatMap(item => [item.actorId, item.targetId]);
  const trickActors = (timeline.tricks ?? []).filter(item => elapsed >= item.start - 500 && elapsed < item.recovered + 500).flatMap(item => [item.actorId, item.targetId]);
  return [...new Set([...leaders, ...straightOpponents, ...incidentActors, ...courseActors, ...trickActors, ...bumpActors])].filter(id => leader - readRacingTravel(timeline, id, elapsed) <= RACING_FOCUS_GAP);
}

/** A fixed distance projection and persistent horses replace rank-based scene cuts. */
export function placeRacingField(camera: RacingCamera, candidates: Candidate[], timeline: RacingTimeline, elapsed: number, w: number, h: number, delta: number, immediate = false): RacingPlacement[] {
  const focus = racingFocusIds(timeline, elapsed);
  const distances = candidates.map(candidate => readRacingTravel(timeline, candidate.id, elapsed));
  const ahead = Math.max(0, ...distances), center = ahead - .014;
  const key = timeline.ids.join('|') + ':' + timeline.finishOrder.join('|');
  const reset = immediate || camera.key !== key || camera.elapsed === null || elapsed < camera.elapsed - 150 || elapsed - camera.elapsed > 500;
  const priorCenter = camera.center;
  // The leading distance is continuous, but its velocity can change when two noses cross.
  // Follow that real motion with a short speed blend instead of changing every sprite's speed at once.
  if (reset) {
    const priorLead = Math.max(0, ...candidates.map(candidate => readRacingTravel(timeline, candidate.id, elapsed - 16)));
    camera.velocity = Math.max(0, (ahead - priorLead) / 16);
  } else if (camera.lead !== null && delta > 0 && elapsed > camera.elapsed!) {
    const speed = Math.max(0, (ahead - camera.lead) / (elapsed - camera.elapsed!));
    const previous = camera.velocity;
    camera.velocity += (speed - camera.velocity) * (1 - Math.exp(-delta / 220));
    camera.center += (previous + camera.velocity) * .5 * delta;
  }
  const blend = reset ? 1 : 1 - Math.exp(-delta / 650);
  camera.center += (center - camera.center) * blend;
  if (!reset) camera.center = Math.max(priorCenter, camera.center);
  camera.span = RACING_CAMERA_SPAN;
  camera.key = key; camera.elapsed = elapsed; camera.lead = ahead;
  // Ranking changes the camera's subject, never a horse's physical size.
  const scale = clamp(Math.min(w / 600, h / 470), .17, 1.35);
  return candidates.map((candidate, index) => {
    const isFeatured = focus.includes(candidate.id);
    // Each horse keeps its course row while focus only controls the camera and labels.
    const fieldDepth = Math.min(h * .36, 34 * scale * Math.max(1, candidates.length - 1));
    const targetY = candidates.length <= 1 ? h * .79 : h * .72 - fieldDepth / 2 + index / (candidates.length - 1) * fieldDepth;
    const targetScale = scale;
    let pose = camera.horses.get(candidate.id);
    if (!pose || reset) { pose = { y: targetY, scale: targetScale }; camera.horses.set(candidate.id, pose); }
    const laneBlend = reset ? 1 : 1 - Math.exp(-delta / 550);
    pose.y += (targetY - pose.y) * laneBlend; pose.scale += (targetScale - pose.scale) * laneBlend;
    return { id: candidate.id, index, distance: distances[index], x: w * .5 + (distances[index] - camera.center) / camera.span * w * .65, y: pose.y, scale: pose.scale, featured: isFeatured };
  });
}
