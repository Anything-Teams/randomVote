import type { Candidate } from './election';
import { RACING_CONTACT_ADVANCE } from './racingFraming';

export type RacingIncidentKind = 'blocked' | 'inside' | 'outside' | 'chase' | 'gust' | 'balance' | 'draft' | 'fatigue' | 'patience' | 'lead-change' | 'rail' | 'last-kick' | 'hay-jump' | 'puddle';
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
export type RacingStraightSwap = { aheadId: string; behindId: string; start: number; end: number };
export type RacingStraightWave = { start: number; end: number; beforeOrder: string[]; swaps: RacingStraightSwap[] };
export type RacingCourseChallenge = { id: string; kind: 'hay-jump' | 'puddle'; actorId: string; distance: number; encounter: number; outcome: 'clear' | 'clip' | 'slip'; impact: number; lowest: number; recovered: number; loss: number; lossCurve?: { at: number; lost: number }[]; catchupStart?: number; catchupEnd?: number };
export type RacingTrick = { id: string; kind: 'rear-kick' | 'beanbag'; actorId: string; targetId: string; start: number; release: number; impact: number; lowest: number; recovered: number; loss: number; lossCurve?: { at: number; lost: number }[] };
export type RacingBump = { actorId: string; targetId: string; start: number; impact: number; lowest: number; end: number; loss: number };
export type RacingLateFall = { actorId: string; impact: number; lowest: number; recovered: number; outcome: 'clip'; approachOrder: string[]; distanceCurve?: { at: number; distance: number }[] };
type RacingStraightMotion = { start: number; distance: number; speed: number; endSpeed: number; finish: number; effortStart: number; effortEnd: number };
export type RacingTimeline = { start: number; finish: number; ids: string[]; finishOrder: string[]; finishTimes: Record<string, number>; knots: { at: number; distances: Record<string, number> }[]; incidents: RacingIncident[]; obstacles: RacingCourseChallenge[]; tricks: RacingTrick[]; bumps: RacingBump[]; lateFall?: RacingLateFall; straight: { start: number; waves: RacingStraightWave[]; motion?: Record<string, RacingStraightMotion> } };
export type RacingStanding = { id: string; distance: number; rank: number; finished: boolean; finishTime: number };
export type RacingIncidentStatus = { stage: 'setup' | 'action' | 'outcome'; beforeRank: number; currentRank: number; afterRank: number; opponentIds: string[]; overtakenIds: string[]; passedByIds: string[]; nextRivalId?: string };
export const RACING_STORIES: { kind: RacingIncidentKind; title: string; setup: string; action: string; outcome: string }[] = [
  { kind: 'hay-jump', title: '건초 장벽을 넘는 한 걸음', setup: '앞쪽 코스의 낮은 건초 장벽이 가까워집니다. 기수가 고삐를 모읍니다.', action: '앞다리를 접고 장벽을 넘습니다. 뒷다리까지 넘긴 뒤 보폭을 되찾습니다.', outcome: '건초 장벽을 넘고 착지했습니다. 추격을 이어갑니다.' },
  { kind: 'puddle', title: '물웅덩이를 넘는 질주', setup: '앞쪽 코스에 고인 물이 가까워집니다. 기수가 도약할 거리를 맞춥니다.', action: '고인 물을 길게 넘습니다. 착지한 발굽 아래 물방울이 튑니다.', outcome: '물을 넘은 말이 발을 단단히 딛고 추격을 이어갑니다.' },
  { kind: 'blocked', title: '길막을 읽고 틈으로', setup: '앞말이 진로를 지킵니다. 뒤의 기수가 고삐를 모아 충돌을 피합니다.', action: '앞말이 라인을 지키자 옆으로 빠집니다. 상대도 고삐를 풀고 다시 가속합니다.', outcome: '막힌 길 옆의 틈을 잡았습니다. 두 말의 추격전이 이어집니다.' },
  { kind: 'inside', title: '짧은 길의 승부', setup: '코너 안쪽에 말 한 마리가 지날 틈이 생겼습니다.', action: '기수가 몸을 낮춥니다. 짧은 코스로 앞말을 따라잡습니다.', outcome: '코너를 짧게 돌아 순위를 끌어올렸습니다.' },
  { kind: 'outside', title: '바깥쪽의 추격자', setup: '말들이 몰린 안쪽을 버리고 바깥으로 크게 나갑니다.', action: '거리는 길어졌지만 앞이 열렸습니다. 보폭을 넓힙니다.', outcome: '자유롭게 달린 바깥 추격이 통했습니다.' },
  { kind: 'chase', title: '뒤에서 시작된 추격', setup: '앞말과 간격이 벌어집니다. 기수가 호흡을 맞추며 힘을 모읍니다.', action: '고삐를 풀고 보폭을 늘립니다. 바깥쪽으로 길게 가속합니다.', outcome: '꾸준히 거리를 좁힌 말이 앞쪽 경합에 합류했습니다.' },
  { kind: 'gust', title: '돌풍을 가른 질주', setup: '맞바람이 불자 선두 말들의 갈기가 크게 흔들립니다.', action: '앞말의 뒤에서 바람을 피하다 옆으로 빠져나옵니다.', outcome: '바람을 버틴 뒤의 가속으로 위치가 달라졌습니다.' },
  { kind: 'balance', title: '아찔한 한 걸음', setup: '코너 진입 때 발이 미끄러집니다. 기수가 중심을 잡습니다.', action: '흔들렸던 보폭을 되찾습니다. 고삐를 다시 앞으로 풉니다.', outcome: '낙마 없이 균형을 회복했습니다. 추격은 계속됩니다.' },
  { kind: 'draft', title: '붙었다 빠지는 추월전', setup: '앞말 뒤에 붙어 고삐를 잠시 모읍니다. 앞의 기수도 뒤를 의식합니다.', action: '옆으로 빠져 가속하자 앞말도 응수합니다. 나란히 보폭을 늘립니다.', outcome: '비축한 힘으로 한 걸음 앞에 나섰습니다. 경합은 계속됩니다.' },
  { kind: 'fatigue', title: '길어진 보폭의 대가', setup: '계속 선두를 쫓던 말의 보폭이 조금 짧아졌습니다.', action: '잠시 호흡을 고릅니다. 뒤에서 오는 말들이 옆을 지납니다.', outcome: '순위는 내려갔지만 기수가 다시 리듬을 맞춥니다.' },
  { kind: 'patience', title: '참고 기다린 한 수', setup: '기수가 고삐를 잡고 무리한 추월을 참습니다.', action: '앞선 말들이 벌어졌습니다. 지금이 가속할 순간입니다.', outcome: '기다렸다가 한 번에 치고 나왔습니다.' },
  { kind: 'lead-change', title: '나란히, 그리고 앞서', setup: '두 말의 어깨가 나란해졌습니다. 고삐가 동시에 풀립니다.', action: '기수가 더 깊게 엎드립니다. 코끝이 조금씩 앞으로 갑니다.', outcome: '긴 경합 끝에 앞뒤 위치가 바뀌었습니다.' },
  { kind: 'rail', title: '레일 옆의 작은 틈', setup: '레일을 따라 좁은 공간을 조심스럽게 지납니다.', action: '코너를 돌아 빈 직선에 들어갑니다. 짧은 길로 가속합니다.', outcome: '레일 옆의 틈을 지킨 말이 앞말을 따라잡았습니다.' },
  { kind: 'last-kick', title: '남겨 둔 마지막 힘', setup: '뒤쪽 말이 아직 쓰지 않은 힘을 꺼낼 준비를 합니다.', action: '기수가 고삐를 낮추자 말이 보폭을 크게 늘립니다.', outcome: '막판의 한 번 더 힘찬 걸음으로 경합에 뛰어들었습니다.' },
];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
// Keep the same physical spacing into the straight; do not squeeze the entire field at the finish.
const RANK_GAP = .005;
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
    const pool = kinds.filter(story => scene === 0 ? ['hay-jump', 'puddle', 'blocked', 'inside', 'outside', 'draft'].includes(story.kind) : scene === 1 ? ['balance', 'gust', 'fatigue', 'patience'].includes(story.kind) : ['chase', 'lead-change', 'rail', 'last-kick'].includes(story.kind));
    const template = pool[random(pool.length)]; kinds.splice(kinds.indexOf(template), 1);
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
    const start = 5500 + (5000 + scene * 7250) * scale;
    result.push({ kind: template.kind, actorId, rivalId, start, end: start + 5500 * scale, beforeOrder, waitingOrder, afterOrder: [...positions] });
    previousActor = actorId;
  }
  return result;
}

function planStraightWaves(straightOrder: string[], finishOrder: string[], straightStart: number, finish: number): RacingStraightWave[] {
  // Adjacent duels retain the other horses' full gaps. A reversed field cannot collapse at one midpoint.
  const ids = straightOrder;
  const positions = [...straightOrder], targetRanks = new Map(finishOrder.map((id, rank) => [id, rank]));
  const waveDuration = (finish - straightStart) / Math.max(1, ids.length), waves: RacingStraightWave[] = [];
  for (let pass = 0; pass < ids.length && positions.some((id, rank) => id !== finishOrder[rank]); pass++) {
    const beforeOrder = [...positions], pairs: { aheadId: string; behindId: string }[] = [];
    for (let rank = pass % 2; rank < positions.length - 1; rank += 2) {
      const aheadId = positions[rank], behindId = positions[rank + 1];
      if (targetRanks.get(aheadId)! < targetRanks.get(behindId)!) continue;
      pairs.push({ aheadId, behindId });
      [positions[rank], positions[rank + 1]] = [behindId, aheadId];
    }
    const at = straightStart + pass * waveDuration, moveDuration = waveDuration * .8;
    const swaps = pairs.map((pair, index) => {
      const start = at + waveDuration * .2 * (pairs.length < 2 ? .5 : index / (pairs.length - 1));
      return { ...pair, start, end: start + moveDuration };
    });
    waves.push({ start: at, end: at + waveDuration, beforeOrder, swaps });
  }
  return waves;
}

/** Smooth rank knots use bounded separation: every horse moves forward, including during a setback. */
export function buildRacingTimeline(candidates: Candidate[], order: string[], duration = 44_000, incidents: RacingIncident[] = []): RacingTimeline {
  const ids = candidates.map(candidate => candidate.id), finishOrder = normalizedOrder(candidates, order);
  const start = 5500, finish = Math.max(start + 1000, duration - 5000), raceLength = finish - start;
  const offsets = (ranking: string[], final = false) => Object.fromEntries(ids.map(id => {
    const rank = ranking.indexOf(id);
    // At the first finish only the winner reaches one complete lap. Others are still approaching.
    return [id, final ? -rank * RANK_GAP : ((ids.length - 1) / 2 - rank) * RANK_GAP];
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
  if (!incidents.length) knots.push(makeKnot(start + 24_500 * scale, firstOrder));
  const straightStart = start + 26_500 * scale, straightOrder = incidents[incidents.length - 1]?.afterOrder ?? firstOrder;
  // Move the field's common origin before the straight, without changing any actual gap.
  knots.push(makeKnot(straightStart, straightOrder, true));
  knots.push(makeKnot(finish, finishOrder, true));
  const waves = planStraightWaves(straightOrder, finishOrder, straightStart, finish);
  const finishStep = Math.min(240 * scale, 2000 / Math.max(1, ids.length - 1));
  const finishTimes = Object.fromEntries(finishOrder.map((id, rank) => [id, finish + rank * finishStep]));
  const timeline: RacingTimeline = { start, finish, ids, finishOrder, finishTimes, knots: knots.sort((a, b) => a.at - b.at), incidents, obstacles: [], tricks: [], bumps: [], straight: { start: straightStart, waves } };
  planCourseChallenges(timeline);
  reconcileCourseChallenges(timeline);
  planFallRecoveries(timeline);
  planRacingTricks(timeline);
  reconcileCourseChallenges(timeline);
  planFallRecoveries(timeline);
  planLateFall(timeline);
  spaceFallPursuits(timeline);
  planStraightMotion(timeline);
  if (timeline.lateFall) planLateFallMotion(timeline);
  planRacingBumps(timeline);
  // A small bump changes the actual crossing clocks. Replan that bump from
  // the adjusted effort if its crossing previously formed a three-horse knot.
  for (let pass = 0; pass < 3 && spaceStraightEfforts(timeline); pass++) {
    timeline.bumps = [];
    planRacingBumps(timeline);
  }
  return timeline;
}

const smoother = (value: number) => { const p = clamp(value); return p ** 3 * (10 - 15 * p + 6 * p * p); };

/** One broad effort carries the actual incoming distance and speed all the way through the line. */
function straightDistance(motion: RacingStraightMotion, elapsed: number) {
  const duration = motion.finish - motion.start, age = Math.max(0, elapsed - motion.start), u = clamp(age / duration);
  const base = motion.distance + motion.speed * age + (motion.endSpeed - motion.speed) * duration * (u ** 3 - u ** 4 / 2);
  const remaining = 1 - motion.distance - duration * (motion.speed + motion.endSpeed) / 2;
  return base + remaining * smoother((age - motion.effortStart) / (motion.effortEnd - motion.effortStart));
}

function planStraightMotion(timeline: RacingTimeline) {
  const start = timeline.straight.start, pace = 1 / (timeline.finish - timeline.start);
  // Capture before installing any profiles: each horse starts from its physical setback, never a rank slot.
  const incoming = timeline.ids.map((id, index) => ({ id, index, distance: readRacingDistance(timeline, id, start), speed: Math.max(0, (readRacingDistance(timeline, id, start) - readRacingDistance(timeline, id, start - 1)))}));
  timeline.straight.motion = Object.fromEntries(incoming.map(({ id, index, distance, speed }) => {
    const finish = timeline.lateFall?.actorId === id ? timeline.finish - 600 * (timeline.finish - timeline.start) / 33500 : timeline.finishTimes[id], duration = finish - start;
    const remaining = 1 - distance - duration * (speed + pace) / 2;
    // Different sustained efforts avoid making a reversed field meet at one shared midpoint.
    const effortStart = remaining > 0 ? duration * (.04 + (index * 7 % 11) * .018) : 0;
    return [id, { start, distance, speed, endSpeed: pace, finish, effortStart, effortEnd: duration }];
  }));

}

/** Spread coincident passes by shifting one broad effort, never adding velocity pulses. */
function spaceStraightEfforts(timeline: RacingTimeline) {
  const motions = timeline.straight.motion;
  if (!motions || timeline.ids.length < 3) return false;
  const crossings = () => {
    const events: { at: number; ids: [string, string] }[] = [];
    let previous = timeline.ids.map(id => readRacingDistance(timeline, id, timeline.straight.start));
    for (let at = timeline.straight.start + 32; at <= timeline.finish; at += 32) {
      const current = timeline.ids.map(id => readRacingDistance(timeline, id, at));
      for (let a = 0; a < current.length; a++) for (let b = a + 1; b < current.length; b++) {
        const initial = previous[a] - previous[b];
        if (initial * (current[a] - current[b]) >= 0) continue;
        let left = at - 32, right = at;
        for (let step = 0; step < 20; step++) {
          const middle = (left + right) / 2;
          if ((readRacingDistance(timeline, timeline.ids[a], middle) - readRacingDistance(timeline, timeline.ids[b], middle)) * initial > 0) left = middle; else right = middle;
        }
        events.push({ at: (left + right) / 2, ids: [timeline.ids[a], timeline.ids[b]] });
      }
      previous = current;
    }
    return events.sort((a, b) => a.at - b.at);
  };
  const score = (events: ReturnType<typeof crossings>) => events.slice(2).reduce((sum, event, index) => sum + Math.max(0, 32 - (event.at - events[index].at)), 0);
  let changed = false;
  for (let pass = 0; pass < 12; pass++) {
    const events = crossings(), cost = score(events), index = events.findIndex((event, at) => at >= 2 && event.at - events[at - 2].at < 32);
    if (index < 0) break;
    const ids = [...new Set(events.slice(index - 2, index + 1).flatMap(event => event.ids))].filter(id => id !== timeline.lateFall?.actorId);
    let best: { id: string; start: number; cost: number } | undefined;
    for (const id of ids) {
      const motion = motions[id], original = motion.effortStart, duration = motion.finish - motion.start;
      for (const offset of [80, -80, 160, -160, 320, -320, 640, -640]) {
        const start = Math.max(0, Math.min(duration * .35, original + offset));
        if (Math.abs(start - original) < .001) continue;
        motion.effortStart = start;
        // A delayed slowdown must still move forward throughout its single effort.
        let forward = true;
        for (let at = motion.start + 32; at < motion.finish; at += 32) if (readRacingDistance(timeline, id, at) < readRacingDistance(timeline, id, at - 1)) { forward = false; break; }
        const next = forward ? score(crossings()) : Infinity;
        if (next < (best?.cost ?? cost) - .001) best = { id, start, cost: next };
      }
      motion.effortStart = original;
    }
    if (!best) break;
    motions[best.id].effortStart = best.start;
    changed = true;
  }
  return changed;
}

function plannedDistance(timeline: RacingTimeline, id: string, elapsed: number): number {
  if (!timeline.ids.includes(id) || elapsed <= timeline.start) return 0;
  if (elapsed >= timeline.finish) {
    const rank = timeline.finishOrder.indexOf(id), finishTime = timeline.finishTimes[id];
    if (rank <= 0 || elapsed >= finishTime) return 1;
    const remaining = 1 - rank * RANK_GAP;
    return remaining + (1 - remaining) * clamp((elapsed - timeline.finish) / (finishTime - timeline.finish));
  }
  if (elapsed >= timeline.straight.start) {
    const wave = timeline.straight.waves.find(item => elapsed < item.end);
    const ranking = wave?.beforeOrder ?? timeline.lateFall?.approachOrder ?? timeline.finishOrder, rank = ranking.indexOf(id);
    const swap = wave?.swaps.find(item => item.aheadId === id || item.behindId === id);
    const change = swap ? (swap.aheadId === id ? -1 : 1) * RANK_GAP * smooth((elapsed - swap.start) / (swap.end - swap.start)) : 0;
    const origin = timeline.lateFall ? RANK_GAP * smooth((elapsed - timeline.straight.start) / 5500) : 0;
    return clamp((elapsed - timeline.start) / (timeline.finish - timeline.start) - rank * RANK_GAP + change + origin);
  }
  const rightIndex = timeline.knots.findIndex(knot => knot.at >= elapsed);
  if (rightIndex < 0) return timeline.knots[timeline.knots.length - 1].distances[id];
  if (rightIndex === 0) return 0;
  const left = timeline.knots[rightIndex - 1], right = timeline.knots[rightIndex];
  const amount = clamp((elapsed - left.at) / Math.max(1, right.at - left.at));
  // Linear base motion plus eased lateral race gaps avoids a stop at each story cut.
  const leftBase = clamp((left.at - timeline.start) / (timeline.finish - timeline.start));
  const rightBase = clamp((right.at - timeline.start) / (timeline.finish - timeline.start));
  return clamp(leftBase + (rightBase - leftBase) * amount + (left.distances[id] - leftBase) + ((right.distances[id] - rightBase) - (left.distances[id] - leftBase)) * smooth(amount));
}

/** A setback changes forward speed, holds the lost ground, then earns it back gradually. */
function setbackLoss(elapsed: number, start: number, lowest: number, end: number, loss: number, recoveryStart = lowest) {
  if (elapsed <= start || elapsed >= end) return 0;
  return loss * (elapsed < lowest ? smooth((elapsed - start) / (lowest - start)) : 1 - smooth((elapsed - recoveryStart) / (end - recoveryStart)));
}

/** Distance and rider poses share the same check, lost-ground hold and pursuit clock. */
export function racingIncidentRecovery(incident: RacingIncident, id: string) {
  const duration = incident.end - incident.start, actor = id === incident.actorId;
  if (!actor && id !== incident.rivalId) return undefined;
  const defensive = ['blocked', 'inside', 'outside', 'draft', 'patience', 'lead-change', 'rail', 'chase', 'last-kick'].includes(incident.kind);
  if (!defensive) return undefined;
  return {
    start: incident.start + duration * (actor ? .18 : .40),
    lowest: incident.start + duration * (actor ? .38 : .64),
    recoveryStart: incident.start + duration * (actor ? .54 : .78),
    end: incident.end,
    loss: actor ? incident.kind === 'blocked' ? .013 : .009 : .004,
  };
}

/** One broad effort follows actual gradual ground recovery, with no repeated crouch pulses. */
export function racingRecoveryEffort(elapsed: number, start: number, end: number) {
  const phase = clamp((elapsed - start) / Math.max(1, end - start));
  return 4 * phase * (1 - phase);
}

export function racingIncidentSetback(incident: RacingIncident, id: string, elapsed: number) {
  const recovery = racingIncidentRecovery(incident, id);
  return recovery ? setbackLoss(elapsed, recovery.start, recovery.lowest, recovery.end, recovery.loss, recovery.recoveryStart) : 0;
}

export function racingObstacleLoss(obstacle: RacingCourseChallenge, elapsed: number) {
  if (obstacle.lossCurve) {
    if (elapsed <= obstacle.impact || elapsed >= obstacle.catchupEnd!) return 0;
    if (elapsed >= obstacle.recovered) return obstacle.loss * (1 - smooth((elapsed - obstacle.catchupStart!) / (obstacle.catchupEnd! - obstacle.catchupStart!)));
    const index = Math.min(obstacle.lossCurve.length - 2, Math.max(0, Math.floor((elapsed - obstacle.impact) / (obstacle.lossCurve[1].at - obstacle.impact))));
    const left = obstacle.lossCurve[index], right = obstacle.lossCurve[index + 1];
    return left.lost + (right.lost - left.lost) * clamp((elapsed - left.at) / (right.at - left.at));
  }
  return setbackLoss(elapsed, obstacle.impact, obstacle.lowest, obstacle.recovered, obstacle.loss);
}

export function readRacingDistance(timeline: RacingTimeline, id: string, elapsed: number): number {
  const late = timeline.lateFall;
  if (late?.actorId === id && late.distanceCurve && elapsed >= late.impact) {
    if (elapsed >= timeline.finishTimes[id]) return 1;
    const index = Math.min(late.distanceCurve.length - 2, Math.max(0, Math.floor((elapsed - late.impact) / 16)));
    const left = late.distanceCurve[index], right = late.distanceCurve[index + 1];
    return left.distance + (right.distance - left.distance) * clamp((elapsed - left.at) / (right.at - left.at));
  }
  const motion = timeline.straight.motion?.[id];
  if (motion && elapsed >= motion.start) return elapsed >= motion.finish ? 1 : straightDistance(motion, elapsed) - timeline.bumps.filter(bump => bump.targetId === id).reduce((sum, bump) => sum + racingBumpLoss(bump, elapsed), 0);
  const lost = timeline.incidents.reduce((sum, incident) => sum + racingIncidentSetback(incident, id, elapsed), 0)
    + timeline.obstacles.filter(obstacle => obstacle.actorId === id).reduce((sum, obstacle) => sum + racingObstacleLoss(obstacle, elapsed), 0)
    + (timeline.tricks ?? []).filter(trick => trick.targetId === id).reduce((sum, trick) => sum + racingTrickLoss(trick, elapsed), 0)
    + (timeline.bumps ?? []).filter(bump => bump.targetId === id).reduce((sum, bump) => sum + racingBumpLoss(bump, elapsed), 0);
  return clamp(plannedDistance(timeline, id, elapsed) - lost);
}

export function racingBumpLoss(bump: RacingBump, elapsed: number) {
  return setbackLoss(elapsed, bump.impact, bump.lowest, bump.end, bump.loss, racingBumpRecoveryStart(bump));
}

export function racingBumpRecoveryStart(bump: RacingBump) {
  return bump.lowest + (bump.end - bump.lowest) * .22;
}

export function activeRacingBump(timeline: RacingTimeline, elapsed: number) {
  return timeline.bumps?.find(bump => elapsed >= bump.start && elapsed < bump.end);
}

/** A returning horse waits for a duel to open instead of passing both fighting noses together. */
function spaceFallPursuits(timeline: RacingTimeline) {
  const recovering = timeline.obstacles.find(item => item.outcome !== 'clear' && item.catchupEnd! > timeline.straight.start);
  if (!recovering) return;
  const scale = (timeline.finish - timeline.start) / 33500;
  const crossings = () => {
    const moments: { at: number; returning: boolean }[] = [];
    const until = Math.min(timeline.finish, timeline.lateFall?.impact ?? Infinity);
    for (let left = timeline.straight.start; left < until; left += 64 * scale) {
      const right = Math.min(until, left + 64 * scale);
      const before = timeline.ids.map(id => readRacingDistance(timeline, id, left));
      const after = timeline.ids.map(id => readRacingDistance(timeline, id, right));
      for (let a = 0; a < timeline.ids.length; a++) for (let b = a + 1; b < timeline.ids.length; b++) {
        if ((before[a] - before[b]) * (after[a] - after[b]) >= 0) continue;
        let low = left, high = right;
        const sign = Math.sign(before[a] - before[b]);
        for (let iteration = 0; iteration <12; iteration++) {
          const middle = (low + high) / 2;
          if (Math.sign(readRacingDistance(timeline, timeline.ids[a], middle) - readRacingDistance(timeline, timeline.ids[b], middle)) === sign) low = middle; else high = middle;
        }
        moments.push({ at: (low + high) / 2, returning: timeline.ids[a] === recovering.actorId || timeline.ids[b] === recovering.actorId });
      }
    }
    moments.sort((a, b) => a.at - b.at);
    return moments.some((item, index) => index > 1 && item.at - moments[index - 2].at < 48 * scale && moments.slice(index - 2, index + 1).some(crossing => crossing.returning));
  };
  const original = recovering.catchupEnd!;
  for (let attempt = 0; attempt <= 24; attempt++) {
    const shift = attempt === 0 ? 0 : Math.ceil(attempt / 2) * 80 * scale * (attempt % 2 ? -1 : 1);
    recovering.catchupEnd = Math.min(timeline.finish - 200 * scale, original + shift);
    if (!crossings()) return;
  }
  recovering.catchupEnd = original;
}

/** A defender makes contact only when an adjacent lane's actual nose catches it. */
function planRacingBumps(timeline: RacingTimeline) {
  if (timeline.ids.length < 2) return;
  const scale = (timeline.finish - timeline.start) / 33500;
  const windows = [[timeline.start + 13300 * scale, timeline.start + 16100 * scale], [timeline.straight.start + 700 * scale, timeline.finish - 2700 * scale]];
  const occupied = (id: string, start: number, end: number) => timeline.obstacles.some(item => item.actorId === id && item.encounter - 1600 * scale < end && item.recovered + 300 * scale > start)
    || timeline.tricks.some(item => [item.actorId, item.targetId].includes(id) && item.start < end && item.recovered > start)
    || timeline.incidents.some(item => ['balance', 'gust', 'fatigue'].includes(item.kind) && [item.actorId, item.rivalId].includes(id) && item.start < end && item.end > start)
    || timeline.lateFall?.actorId === id && timeline.lateFall.impact - 450 * scale < end;
  for (const [from, to] of windows) for (let at = from; at < to; at += 80 * scale) {
    const standings = racingStandings(timeline, at), lead = standings[0].distance;
    for (let index = 0; index < timeline.ids.length - 1; index++) {
      const a = timeline.ids[index], b = timeline.ids[index + 1];
      const difference = (time: number) => readRacingDistance(timeline, a, time) - readRacingDistance(timeline, b, time);
      if (difference(at) * difference(at + 80 * scale) >= 0) continue;
      let left = at, right = at + 80 * scale;
      const initialSign = Math.sign(difference(at));
      for (let iteration = 0; iteration < 28; iteration++) { const middle = (left + right) / 2; if (Math.sign(difference(middle)) === initialSign) left = middle; else right = middle; }
      const impact = (left + right) / 2, start = impact - 1100 * scale, lowest = impact + 350 * scale, end = impact + 1700 * scale;
      const actorId = initialSign > 0 ? a : b, targetId = initialSign > 0 ? b : a;
      if (lead - readRacingDistance(timeline, actorId, impact) > .032 || occupied(a, start, end) || occupied(b, start, end)) continue;
      let minimumSpeed = Infinity;
      for (let sample = impact; sample < lowest; sample += 16 * scale) minimumSpeed = Math.min(minimumSpeed, (readRacingDistance(timeline, targetId, sample + 8) - readRacingDistance(timeline, targetId, sample - 8)) / 16);
      let loss = Math.min(.0012, Math.max(0, minimumSpeed) * (lowest - impact) / 1.5 * .22);
      // Recovery shares the existing acceleration budget, so a bump cannot add a late burst.
      const pace = 1 / (timeline.finish - timeline.start);
      const recoveryStart = racingBumpRecoveryStart({ actorId, targetId, start, impact, lowest, end, loss });
      for (let sample = recoveryStart + 8; sample < end; sample += 8) {
        const speed = (readRacingDistance(timeline, targetId, sample + 8) - readRacingDistance(timeline, targetId, sample - 8)) / 16;
        const p = (sample - recoveryStart) / (end - recoveryStart), gainPerLoss = 6 * p * (1 - p) / (end - recoveryStart);
        loss = Math.min(loss, Math.max(0, pace * 1.47 - speed) / gainPerLoss);
      }
      if (loss < .00025) continue;
      const bump = { actorId, targetId, start, impact, lowest, end, loss }, contactPlan = { ...timeline, bumps: [bump] };
      if ([100, 200, 300].some(age => Math.abs(readRacingDistance(contactPlan, actorId, impact + age * scale) - readRacingDistance(contactPlan, targetId, impact + age * scale)) > .001)) continue;
      timeline.bumps.push(bump); return;
    }
  }
}

/** A rare runner already near the front stays in contention until a visible finish-line misstep. */
function planLateFall(timeline: RacingTimeline) {
  if (timeline.ids.length < 2 || !timeline.incidents.length) return;
  const actorId = timeline.finishOrder.at(-1)!;
  const signature = timeline.incidents.map(item => item.kind + ':' + item.actorId + ':' + item.beforeOrder.join(',')).join('|');
  const hash = signature.split('').reduce((value, character) => (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0, 17);
  if (hash % 8 !== 0) return;
  const ranking = racingStandings(timeline, timeline.straight.start), actor = ranking.find(item => item.id === actorId)!;
  if (actor.rank > 3 || ranking[0].distance - actor.distance > .012) return;
  const scale = (timeline.finish - timeline.start) / 33_500;
  const impact = timeline.finish - 1450 * scale, lowest = timeline.finish + 650 * scale, recovered = timeline.finish + 1350 * scale;
  const approachOrder = [actorId, ...timeline.finishOrder.filter(id => id !== actorId)];
  const beforeOrder = timeline.straight.waves[0]?.beforeOrder ?? timeline.finishOrder;
  timeline.straight.waves = planStraightWaves(beforeOrder, approachOrder, timeline.straight.start, timeline.finish);
  timeline.finishTimes[actorId] = timeline.finish + 2200 * scale;
  const late: RacingLateFall = { actorId, impact, lowest, recovered, outcome: 'clip', approachOrder };
  timeline.lateFall = late;
  planLateFallMotion(timeline);
}

function planLateFallMotion(timeline: RacingTimeline) {
  const late = timeline.lateFall!, { actorId, impact } = late;
  late.distanceCurve = undefined;
  const scale = (timeline.finish - timeline.start) / 33_500;
  const pace = 1 / (timeline.finish - timeline.start), step = 16;
  const initial = readRacingDistance(timeline, actorId, impact);
  const incomingSpeed = Math.max(0, initial - readRacingDistance(timeline, actorId, impact - 1));
  const stoppedDistance = initial + incomingSpeed * 150 * scale;
  let lastPass = late.lowest - 300 * scale;
  for (const id of timeline.ids.filter(id => id !== actorId)) {
    let left = impact, right = timeline.finishTimes[id];
    for (let iteration = 0; iteration < 32; iteration++) {
      const middle = (left + right) / 2;
      if (readRacingDistance(timeline, id, middle) < stoppedDistance) left = middle; else right = middle;
    }
    lastPass = Math.max(lastPass, right);
  }
  const lowest = late.lowest = lastPass + 300 * scale, recovered = late.recovered = lowest + 700 * scale;
  const positions = [{ at: impact, distance: initial }];
  let distance = initial, previous = impact;
  for (let at = impact + step; at < recovered + step; at += step) {
    const current = Math.min(at, recovered), age = (current + previous) / 2;
    const speed = age < lowest ? incomingSpeed * (1 - smooth((age - impact) / (300 * scale))) : pace * smooth((age - lowest) / (recovered - lowest));
    distance += speed * (current - previous); positions.push({ at: current, distance }); previous = current;
    if (current === recovered) break;
  }
  const remaining = 1 - distance;
  const othersFinish = Math.max(...timeline.ids.filter(id => id !== actorId).map(id => timeline.finishTimes[id]));
  const finishTime = Math.max(othersFinish + 240 * scale, recovered + remaining / pace), length = finishTime - recovered;
  timeline.finishTimes[actorId] = finishTime;
  const from = distance;
  const motion: RacingStraightMotion = { start: recovered, distance: from, speed: pace, endSpeed: pace, finish: finishTime, effortStart: 0, effortEnd: length };
  for (let at = recovered + step; at < finishTime + step; at += step) {
    const current = Math.min(at, finishTime), position = straightDistance(motion, current);
    positions.push({ at: current, distance: position });
    if (current === finishTime) break;
  }
  // Resample on one clock so seeking and live playback reproduce the same continuous path.
  late.distanceCurve = Array.from({ length: Math.ceil((finishTime - impact) / step) + 1 }, (_, index) => {
    const at = Math.min(finishTime, impact + index * step);
    let rightIndex = positions.findIndex(point => point.at >= at); if (rightIndex < 1) rightIndex = 1;
    const left = positions[rightIndex - 1], right = positions[rightIndex];
    return { at, distance: left.distance + (right.distance - left.distance) * clamp((at - left.at) / (right.at - left.at)) };
  });
}

/** A fall stops actual forward travel. Standing up does not restore the ground already lost. */
function planFallRecoveries(timeline: RacingTimeline) {
  const scale = (timeline.finish - timeline.start) / 33_500;
  for (const obstacle of timeline.obstacles.filter(item => item.outcome !== 'clear')) {
    const without = { ...timeline, obstacles: timeline.obstacles.filter(item => item !== obstacle) };
    const step = 16 * scale;
    let lost = 0, standingUp = false;
    obstacle.lowest = obstacle.impact + 4500 * scale;
    obstacle.recovered = obstacle.lowest + 1500 * scale;
    obstacle.lossCurve = [{ at: obstacle.impact, lost: 0 }];
    for (let previous = obstacle.impact; previous < obstacle.recovered; ) {
      const at = Math.min(previous + step, obstacle.recovered), middle = (previous + at) / 2;
      const slowdown = .985 * smooth((middle - obstacle.impact) / (300 * scale)) * (1 - smooth((middle - obstacle.lowest) / (obstacle.recovered - obstacle.lowest)));
      lost += Math.max(0, readRacingDistance(without, obstacle.actorId, at) - readRacingDistance(without, obstacle.actorId, previous)) * slowdown;
      obstacle.lossCurve.push({ at, lost });
      const lastOpponent = Math.min(...timeline.ids.filter(id => id !== obstacle.actorId).map(id => readRacingDistance(without, id, at)));
      if (!standingUp && at >= obstacle.impact + 1200 * scale && readRacingDistance(without, obstacle.actorId, at) - lost < lastOpponent - .006) {
        obstacle.lowest = at; obstacle.recovered = at + 1500 * scale; standingUp = true;
      }
      previous = at;
    }
    obstacle.loss = lost;
    obstacle.catchupStart = obstacle.recovered + 1100 * scale;
    const runnerClock = timeline.ids.indexOf(obstacle.actorId);
    obstacle.catchupEnd = obstacle === timeline.obstacles[0] ? Math.min(timeline.finish - 800 * scale, timeline.obstacles[1].encounter + 3500 * scale) : timeline.finish - (950 + runnerClock * 85) * scale;
  }
}


/** Regaining balance restores normal pace, never the distance already lost to a hit. */
export function racingTrickLoss(trick: RacingTrick, elapsed: number) {
  if (elapsed <= trick.impact) return 0;
  if (!trick.lossCurve) return trick.loss * smooth((elapsed - trick.impact) / (trick.lowest - trick.impact));
  if (elapsed >= trick.recovered) return trick.loss;
  const points = trick.lossCurve, step = points[1].at - points[0].at;
  const index = Math.min(points.length - 2, Math.max(0, Math.floor((elapsed - trick.impact) / step)));
  const left = points[index], right = points[index + 1];
  return left.lost + (right.lost - left.lost) * clamp((elapsed - left.at) / (right.at - left.at));
}

export function racingTrickRecoveryStart(trick: RacingTrick) {
  const scale = (trick.lowest - trick.impact) / (trick.kind === 'rear-kick' ? 1350 : 1050);
  return Math.min(trick.lowest + 900 * scale, trick.recovered - 1000 * scale);
}

function planRacingTricks(timeline: RacingTimeline) {
  if (timeline.ids.length < 2) return;
  const scale = (timeline.finish - timeline.start) / 33_500;
  for (const [index, kind] of (['rear-kick', 'beanbag'] as const).entries()) {
    // A two-horse retaliation waits until the first rider is steady, before a fall separates the pair.
    const start = index === 0 ? timeline.start + 1400 * scale : timeline.ids.length === 2 ? timeline.tricks[0].recovered + 120 * scale : (timeline.obstacles[0]?.recovered ?? timeline.start + 12_000 * scale) + 120 * scale;
    const release = start + (index === 0 ? 950 : 450) * scale;
    const impact = start + (index === 0 ? 1850 : 1050) * scale;
    const lowest = impact + (index === 0 ? 1350 : 1050) * scale;
    const nextObstacle = timeline.obstacles[index === 0 || timeline.ids.length === 2 ? 0 : 1];
    const recovered = Math.min(impact + (index === 0 ? 4250 : 3300) * scale, nextObstacle.encounter - 200 * scale);
    const ranking = racingStandings(timeline, impact).map(item => item.id);
    // Avoid asking the same body to fall at a hurdle and receive a trick together.
    const occupied = new Set(timeline.obstacles.filter(item => item.encounter >= impact && item.encounter < recovered || item.outcome !== 'clear' && item.impact < lowest && item.recovered > impact).map(item => item.actorId));
    const pairs = ranking.slice(0, -1).map((ahead, at) => ({ ahead, behind: ranking[at + 1] }));
    const pair = pairs.find(item => !occupied.has(kind === 'rear-kick' ? item.behind : item.ahead)) ?? pairs[0];
    const actorId = kind === 'rear-kick' ? pair.ahead : pair.behind, targetId = kind === 'rear-kick' ? pair.behind : pair.ahead;
    // Bound deceleration by the slowest existing travel over the impact window.
    let minimumSpeed = Infinity;
    for (let at = impact; at < lowest; at += 16 * scale) minimumSpeed = Math.min(minimumSpeed, (readRacingDistance(timeline, targetId, at + 8 * scale) - readRacingDistance(timeline, targetId, at - 8 * scale)) / (16 * scale));
    const loss = Math.min(.017, Math.max(.002, minimumSpeed * (lowest - impact) / 1.5 * .82));
    const trick: RacingTrick = { id: kind + ':' + index, kind, actorId, targetId, start, release, impact, lowest, recovered, loss };
    timeline.tricks.push(trick);
    const without = { ...timeline, tricks: timeline.tricks.filter(item => item !== trick) };
    let lost = 0;
    trick.lossCurve = [{ at: impact, lost: 0 }];
    for (let previous = impact; previous < recovered;) {
      const at = Math.min(recovered, previous + 16 * scale), middle = (previous + at) / 2;
      const slowdown = .82 * smooth((middle - impact) / (180 * scale)) * (1 - smooth((middle - lowest + 500 * scale) / (500 * scale)));
      lost += Math.max(0, readRacingDistance(without, targetId, at) - readRacingDistance(without, targetId, previous)) * slowdown;
      trick.lossCurve.push({ at, lost }); previous = at;
    }
    // The impact slows the horse briefly; steadying the rider does not keep braking it.
    // Retain that actual lost ground after normal pace returns, rather than refunding it.
    const strength = lost > loss ? loss / lost : 1;
    for (const point of trick.lossCurve) point.lost *= strength;
    trick.loss = lost * strength;
  }
}

/** Final course coordinates include every planned trick, so contact cannot drift after a setback. */
function reconcileCourseChallenges(timeline: RacingTimeline) {
  const scale = (timeline.finish - timeline.start) / 33_500;
  for (const obstacle of timeline.obstacles) {
    const without = { ...timeline, obstacles: timeline.obstacles.filter(item => item !== obstacle) };
    obstacle.distance = readRacingDistance(without, obstacle.actorId, obstacle.encounter);
    let left = obstacle.encounter, right = Math.min(timeline.straight.start - 1, left + 1800 * scale);
    for (let iteration = 0; iteration < 32; iteration++) {
      const middle = (left + right) / 2;
      if (readRacingDistance(without, obstacle.actorId, middle) < obstacle.distance + RACING_CONTACT_ADVANCE) left = middle; else right = middle;
    }
    obstacle.impact = (left + right) / 2;
    obstacle.lowest = obstacle.impact + (obstacle.outcome === 'clear' ? 350 : 3300) * scale;
    obstacle.recovered = obstacle.impact + (obstacle.outcome === 'clear' ? 1000 : 5000) * scale;
    if (obstacle.loss && !obstacle.lossCurve) {
      let minimumSpeed = Infinity;
      for (let at = obstacle.impact; at < obstacle.lowest; at += 16 * scale) minimumSpeed = Math.min(minimumSpeed, (readRacingDistance(without, obstacle.actorId, at + 8 * scale) - readRacingDistance(without, obstacle.actorId, at - 8 * scale)) / (16 * scale));
      obstacle.loss = Math.min(obstacle.loss, Math.max(0, minimumSpeed) * (obstacle.lowest - obstacle.impact) / 1.5 * .82);
    }
  }
}

export function activeRacingTrick(timeline: RacingTimeline, elapsed: number) {
  return timeline.tricks?.find(item => elapsed >= item.start && elapsed < item.recovered);
}

export function racingTrickStatus(timeline: RacingTimeline, trick: RacingTrick, elapsed: number) {
  const beforeRank = racingStandings(timeline, trick.impact).find(item => item.id === trick.targetId)?.rank ?? 1;
  const currentRank = racingStandings(timeline, elapsed).find(item => item.id === trick.targetId)?.rank ?? 1;
  const stage = elapsed < trick.release ? 'windup' : elapsed < trick.impact ? 'flight' : elapsed < trick.lowest ? 'stunned' : elapsed < racingTrickRecoveryStart(trick) ? 'recover' : 'chase';
  return { stage, beforeRank, currentRank, lost: racingTrickLoss(trick, elapsed) };
}

/** Build immutable course locations before playback; later reads cannot move an obstacle. */
function planCourseChallenges(timeline: RacingTimeline) {
  if (!timeline.ids.length) return;
  const hash = timeline.incidents.map(item => item.kind + item.actorId).join('|').split('').reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 7);
  const scale = (timeline.finish - timeline.start) / 33_500, first = timeline.incidents[0];
  const firstIsObstacle = first?.kind === 'hay-jump' || first?.kind === 'puddle';
  const encounters = [timeline.ids.length === 2 ? timeline.start + 11_850 * scale : first ? first.start + (first.end - first.start) * .6 : timeline.start + 7750 * scale,
    timeline.start + 18_500 * scale,
    timeline.start + 25_300 * scale];
  const firstKind: RacingCourseChallenge['kind'] = first?.kind === 'hay-jump' || first?.kind === 'puddle' ? first.kind : hash % 2 ? 'puddle' : 'hay-jump';
  let previousActor = '';
  for (const [index, encounter] of encounters.entries()) {
    const story = timeline.incidents.find(item => encounter >= item.start && encounter <= item.end);
    const quiet = timeline.ids.filter(id => id !== previousActor && id !== story?.actorId && id !== story?.rivalId);
    const available = quiet.length ? quiet : timeline.ids.filter(id => id !== previousActor);
    const ranked = racingStandings(timeline, encounter).filter(item => available.includes(item.id));
    const actorId = index === 0 && firstIsObstacle ? first.actorId : ranked[0]?.id ?? timeline.ids[0];
    const kind: RacingCourseChallenge['kind'] = index === 0 ? firstKind : index === 1 ? firstKind === 'puddle' ? 'hay-jump' : 'puddle' : hash % 2 ? 'hay-jump' : 'puddle';
    const failed = index === 0 ? hash % 3 !== 0 : index === 1 ? hash % 3 !== 1 : false;
    const outcome = failed ? kind === 'hay-jump' ? 'clip' : 'slip' : 'clear';
    const distance = readRacingDistance(timeline, actorId, encounter);
    // The front feet trail the nose. Resolve the physical contact from course progress.
    let left = encounter, right = Math.min(timeline.straight.start - 1, encounter + 1800 * scale);
    for (let iteration = 0; iteration < 32; iteration++) {
      const middle = (left + right) / 2;
      if (readRacingDistance(timeline, actorId, middle) < distance + RACING_CONTACT_ADVANCE) left = middle; else right = middle;
    }
    const impact = (left + right) / 2, lowest = impact + (failed ? 3300 : 350) * scale;
    const recovered = impact + (failed ? 5000 : 1000) * scale;
    timeline.obstacles.push({ id: actorId + ':' + encounter, kind, actorId, distance, encounter, outcome, impact, lowest, recovered, loss: failed ? kind === 'hay-jump' ? .014 : .0125 : 0 });
    previousActor = actorId;
  }
}

export function racerFinishTime(timeline: RacingTimeline, id: string): number {
  return timeline.finishTimes[id] ?? Infinity;
}

/** Run-out is separate from lap completion, keeping a moving horse from starting a second lap. */
export function readRacingTravel(timeline: RacingTimeline, id: string, elapsed: number): number {
  const finishTime = racerFinishTime(timeline, id);
  if (!Number.isFinite(finishTime) || elapsed <= finishTime) return readRacingDistance(timeline, id, elapsed);
  const speed = Math.max(0, (readRacingDistance(timeline, id, finishTime) - readRacingDistance(timeline, id, finishTime - 16)) / 16);
  const age = Math.max(0, elapsed - finishTime);
  return 1 + speed * 1100 * (1 - Math.exp(-age / 1100));
}

/** Finished horses retain their actual arrival order even though all lap distances become one. */
export function racingStandings(timeline: RacingTimeline, elapsed: number): RacingStanding[] {
  return timeline.ids.map(id => ({ id, distance: readRacingDistance(timeline, id, elapsed), rank: 0, finished: elapsed >= racerFinishTime(timeline, id), finishTime: racerFinishTime(timeline, id) }))
    .sort((a, b) => a.finished && b.finished ? a.finishTime - b.finishTime : b.distance - a.distance || timeline.ids.indexOf(a.id) - timeline.ids.indexOf(b.id))
    .map((standing, index) => ({ ...standing, rank: index + 1 }));
}

export function racingIncidentStatus(timeline: RacingTimeline, incident: RacingIncident, elapsed: number): RacingIncidentStatus {
  const standings = racingStandings(timeline, elapsed), currentOrder = standings.map(standing => standing.id);
  const beforeOrder = racingStandings(timeline, incident.start).map(standing => standing.id), afterOrder = racingStandings(timeline, incident.end).map(standing => standing.id);
  const before = beforeOrder.indexOf(incident.actorId), after = afterOrder.indexOf(incident.actorId), current = currentOrder.indexOf(incident.actorId);
  const overtakenIds = beforeOrder.filter((id, rank) => rank < before && currentOrder.indexOf(id) > current).reverse();
  const passedByIds = beforeOrder.filter((id, rank) => rank > before && currentOrder.indexOf(id) < current);
  const expected = beforeOrder.filter((id, rank) => id !== incident.actorId && (rank < before) !== (afterOrder.indexOf(id) < after));
  const opponentIds = [...new Set([...expected, ...overtakenIds, ...passedByIds])];
  const crossed = new Set([...overtakenIds, ...passedByIds]), plannedStage = racingIncidentStage(incident, elapsed);
  return { stage: plannedStage === 'outcome' && current !== after ? 'action' : plannedStage, beforeRank: before + 1, currentRank: current + 1, afterRank: after + 1, opponentIds, overtakenIds, passedByIds, nextRivalId: expected.find(id => !crossed.has(id)) ?? (plannedStage !== 'outcome' ? incident.rivalId : undefined) };
}

export function activeRacingIncident(timeline: RacingTimeline, elapsed: number) { return timeline.incidents.find(incident => elapsed >= incident.start && elapsed < incident.end); }
export function racingIncidentStage(incident: RacingIncident, elapsed: number) {
  const progress = clamp((elapsed - incident.start) / (incident.end - incident.start));
  const actionStarts = incident.kind === 'hay-jump' || incident.kind === 'puddle' ? .48 : .24;
  return progress < actionStarts ? 'setup' : progress < .82 ? 'action' : 'outcome';
}
export function racingLaneShift(incident: RacingIncident | undefined, id: string, elapsed: number): number {
  if (!incident || incident.actorId !== id) return 0;
  const age = clamp((elapsed - incident.start) / (incident.end - incident.start));
  const move = smooth((age - .24) / .36) * (1 - smooth((age - .83) / .17));
  return ['outside', 'chase', 'gust', 'draft'].includes(incident.kind) ? move : ['blocked', 'inside', 'rail'].includes(incident.kind) ? -move : 0;
}
