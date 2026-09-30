import type { Candidate } from './election';

export type RacingIncidentKind = 'blocked' | 'inside' | 'outside' | 'late-start' | 'gust' | 'balance' | 'draft' | 'fatigue' | 'patience' | 'lead-change' | 'rail' | 'last-kick';
export type RacingIncident = {
  kind: RacingIncidentKind;
  actorId: string;
  rivalId: string;
  start: number;
  end: number;
  beforeOrder: string[];
  waitingOrder: string[];
  afterOrder: string[];
};
export type RacingTimeline = { start: number; finish: number; ids: string[]; knots: { at: number; distances: Record<string, number> }[]; incidents: RacingIncident[] };
export const RACING_STORIES: { kind: RacingIncidentKind; title: string; setup: string; action: string; outcome: string }[] = [
  { kind: 'blocked', title: '막힌 길, 열린 틈', setup: '앞말에 길이 막혔습니다. 고삐를 당기며 틈을 기다립니다.', action: '한 박자 기다린 기수가 안쪽 빈 공간으로 파고듭니다.', outcome: '기다린 보람이 있습니다. 안쪽 돌파에 성공했습니다.' },
  { kind: 'inside', title: '짧은 길의 승부', setup: '코너 안쪽에 말 한 마리가 지날 틈이 생겼습니다.', action: '기수가 몸을 낮춥니다. 짧은 코스로 앞말을 따라잡습니다.', outcome: '코너를 짧게 돌아 순위를 끌어올렸습니다.' },
  { kind: 'outside', title: '바깥쪽의 추격자', setup: '말들이 몰린 안쪽을 버리고 바깥으로 크게 나갑니다.', action: '거리는 길어졌지만 앞이 열렸습니다. 보폭을 넓힙니다.', outcome: '자유롭게 달린 바깥 추격이 통했습니다.' },
  { kind: 'late-start', title: '늦은 출발의 만회', setup: '출발 때 잃은 거리를 만회하려고 숨을 고릅니다.', action: '뒤에서 힘을 모았습니다. 바깥쪽으로 길게 가속합니다.', outcome: '늦었다고 끝난 게 아닙니다. 뒤쪽에서 순위를 바꿨습니다.' },
  { kind: 'gust', title: '돌풍을 가른 질주', setup: '맞바람이 불자 선두 말들의 갈기가 크게 흔들립니다.', action: '앞말의 뒤에서 바람을 피하다 옆으로 빠져나옵니다.', outcome: '바람을 버틴 뒤의 가속으로 위치가 달라졌습니다.' },
  { kind: 'balance', title: '아찔한 한 걸음', setup: '코너 진입 때 발이 미끄러집니다. 기수가 중심을 잡습니다.', action: '흔들렸던 보폭을 되찾습니다. 고삐를 다시 앞으로 풉니다.', outcome: '낙마 없이 균형을 회복했습니다. 추격은 계속됩니다.' },
  { kind: 'draft', title: '등 뒤의 숨은 힘', setup: '앞말 바로 뒤에 붙어 힘을 아끼며 달립니다.', action: '바람을 피한 말이 옆으로 빠집니다. 비축한 힘을 씁니다.', outcome: '숨겨 둔 가속이 나왔습니다. 바로 앞말을 넘어섭니다.' },
  { kind: 'fatigue', title: '길어진 보폭의 대가', setup: '계속 선두를 쫓던 말의 보폭이 조금 짧아졌습니다.', action: '잠시 호흡을 고릅니다. 뒤에서 오는 말들이 옆을 지납니다.', outcome: '순위는 내려갔지만 기수가 다시 리듬을 맞춥니다.' },
  { kind: 'patience', title: '참고 기다린 한 수', setup: '기수가 고삐를 잡고 무리한 추월을 참습니다.', action: '앞선 말들이 벌어졌습니다. 지금이 가속할 순간입니다.', outcome: '기다렸다가 한 번에 치고 나왔습니다.' },
  { kind: 'lead-change', title: '나란히, 그리고 앞서', setup: '두 말의 어깨가 나란해졌습니다. 고삐가 동시에 풀립니다.', action: '기수가 더 깊게 엎드립니다. 코끝이 조금씩 앞으로 갑니다.', outcome: '긴 경합 끝에 앞뒤 위치가 바뀌었습니다.' },
  { kind: 'rail', title: '레일 옆의 작은 틈', setup: '레일을 따라 좁은 공간을 조심스럽게 지납니다.', action: '코너를 돌아 빈 직선에 들어갑니다. 짧은 길로 가속합니다.', outcome: '레일 옆의 틈을 지킨 말이 앞말을 따라잡았습니다.' },
  { kind: 'last-kick', title: '남겨 둔 마지막 힘', setup: '뒤쪽 말이 아직 쓰지 않은 힘을 꺼낼 준비를 합니다.', action: '기수가 고삐를 낮추자 말이 보폭을 크게 늘립니다.', outcome: '막판의 한 번 더 힘찬 걸음으로 경합에 뛰어들었습니다.' },
];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
function generator(seed: number) {
  let state = seed >>> 0;
  return (limit: number) => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) % limit; };
}
function normalizedOrder(candidates: Candidate[], order: string[]) {
  const ids = new Set(candidates.map(candidate => candidate.id));
  return [...new Set(order.filter(id => ids.has(id))), ...candidates.filter(candidate => !order.includes(candidate.id)).map(candidate => candidate.id)];
}
function moved(order: string[], id: string, to: number) {
  const next = order.filter(value => value !== id); next.splice(Math.max(0, Math.min(next.length, to)), 0, id); return next;
}

/** Cosmetic story seed chooses incidents and actors, never the supplied finish order. */
export function createRacingIncidents(candidates: Candidate[], order: string[], duration = 44_000, seed = 1): RacingIncident[] {
  const random = generator(seed);
  let positions = normalizedOrder(candidates, order);
  for (let index = positions.length - 1; index > 0; index--) { const other = random(index + 1); [positions[index], positions[other]] = [positions[other], positions[index]]; }
  if (positions.length < 2) return [];
  const kinds = [...RACING_STORIES];
  const result: RacingIncident[] = [];
  let previousActor = '';
  for (let scene = 0; scene < 3; scene++) {
    const templateIndex = random(kinds.length), template = kinds.splice(templateIndex, 1)[0];
    const losing = template.kind === 'fatigue' || template.kind === 'balance';
    const eligible = positions.filter((id, rank) => id !== previousActor && (losing ? rank < positions.length - 1 : rank > 0));
    const fallback = positions.filter((_, rank) => losing ? rank < positions.length - 1 : rank > 0);
    const actorId = (eligible.length ? eligible : fallback)[random((eligible.length ? eligible : fallback).length)];
    const rank = positions.indexOf(actorId);
    const intendedMovement = template.kind === 'draft' || template.kind === 'lead-change' ? 1 : 2 + random(2);
    const movement = Math.min(intendedMovement, losing ? positions.length - rank - 1 : rank);
    const destination = rank + (losing ? movement : -movement);
    const rivalId = positions[template.kind === 'blocked' ? Math.max(0, rank - 1) : destination];
    const beforeOrder = [...positions];
    const waitingOrder = template.kind === 'blocked' ? moved(positions, actorId, Math.min(positions.length - 1, rank + 1)) : [...positions];
    positions = moved(positions, actorId, destination);
    const scale = Math.max(0.25, (duration - 10_500) / 33_500);
    const start = 5500 + (5000 + scene * 8500) * scale;
    result.push({ kind: template.kind, actorId, rivalId, start, end: start + 5500 * scale, beforeOrder, waitingOrder, afterOrder: [...positions] });
    previousActor = actorId;
  }
  return result;
}

/** Smooth rank knots use bounded separation: every horse moves forward, including during a setback. */
export function buildRacingTimeline(candidates: Candidate[], order: string[], duration = 44_000, incidents: RacingIncident[] = []): RacingTimeline {
  const ids = candidates.map(candidate => candidate.id), finishOrder = normalizedOrder(candidates, order);
  const start = 5500, finish = Math.max(start + 1000, duration - 5000), raceLength = finish - start;
  const offsets = (ranking: string[], final = false) => Object.fromEntries(ids.map(id => {
    const rank = ranking.indexOf(id);
    return [id, final ? (ids.length - rank) / Math.max(1, ids.length) * .060 : ((ids.length - 1) / 2 - rank) * .011];
  }));
  const makeKnot = (at: number, ranking: string[], final = false) => {
    const base = clamp((at - start) / raceLength), values = offsets(ranking, final);
    return { at, distances: Object.fromEntries(ids.map(id => [id, base + values[id]])) };
  };
  const firstOrder = incidents[0]?.beforeOrder ?? ids;
  const scale = raceLength / 33_500;
  const knots = [{ at: start, distances: Object.fromEntries(ids.map(id => [id, 0])) }, makeKnot(start + 4500 * scale, firstOrder)];
  for (const incident of incidents) {
    knots.push(makeKnot(incident.start, incident.beforeOrder), makeKnot(incident.start + 1300 * scale, incident.waitingOrder), makeKnot(incident.end, incident.afterOrder));
  }
  if (!incidents.length) knots.push(makeKnot(start + 27_500 * scale, firstOrder));
  // Let the final incident's outcome breathe before the last straight reshuffles the field.
  knots.push(makeKnot(start + 29_500 * scale, incidents[incidents.length - 1]?.afterOrder ?? firstOrder));
  knots.push(makeKnot(finish, finishOrder, true));
  return { start, finish, ids, knots: knots.sort((a, b) => a.at - b.at), incidents };
}

export function readRacingDistance(timeline: RacingTimeline, id: string, elapsed: number): number {
  if (!timeline.ids.includes(id) || elapsed <= timeline.start) return 0;
  const rightIndex = timeline.knots.findIndex(knot => knot.at >= elapsed);
  if (rightIndex < 0) return timeline.knots[timeline.knots.length - 1].distances[id];
  if (rightIndex === 0) return 0;
  const left = timeline.knots[rightIndex - 1], right = timeline.knots[rightIndex];
  const amount = clamp((elapsed - left.at) / Math.max(1, right.at - left.at));
  // Linear base motion plus eased lateral race gaps avoids a stop at each story cut.
  const leftBase = clamp((left.at - timeline.start) / (timeline.finish - timeline.start));
  const rightBase = clamp((right.at - timeline.start) / (timeline.finish - timeline.start));
  return leftBase + (rightBase - leftBase) * amount + (left.distances[id] - leftBase) + ((right.distances[id] - rightBase) - (left.distances[id] - leftBase)) * smooth(amount);
}

export function activeRacingIncident(timeline: RacingTimeline, elapsed: number) { return timeline.incidents.find(incident => elapsed >= incident.start && elapsed < incident.end); }
export function racingIncidentStage(incident: RacingIncident, elapsed: number) { const progress = clamp((elapsed - incident.start) / (incident.end - incident.start)); return progress < .24 ? 'setup' : progress < .82 ? 'action' : 'outcome'; }
export function racingLaneShift(incident: RacingIncident | undefined, id: string, elapsed: number): number {
  if (!incident || incident.actorId !== id) return 0;
  const age = clamp((elapsed - incident.start) / (incident.end - incident.start));
  const move = smooth((age - .24) / .36) * (1 - smooth((age - .83) / .17));
  return ['outside', 'late-start', 'gust', 'draft'].includes(incident.kind) ? move : ['blocked', 'inside', 'rail'].includes(incident.kind) ? -move : 0;
}
