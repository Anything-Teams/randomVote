import type { Candidate } from './election';

export const LADDER_DURATION = 44_000;
export const LADDER_RUNGS = 24;
export type LadderEventKind = 'loose-rung' | 'trapdoor' | 'wind' | 'pendulum' | 'spring' | 'bird' | 'paint' | 'sticky' | 'rope-tangle' | 'balloon' | 'false-sign' | 'bucket' | 'banana' | 'zipline' | 'lights-out' | 'safety-net';
export type LadderPose = 'idle' | 'climb' | 'bridge' | 'balance' | 'fall' | 'hang' | 'clamber' | 'win' | 'arrived';
export type LadderEventStage = 'setup' | 'action' | 'resolve';
export type LadderMotion = { type: 'fall' | 'swing' | 'boost' | 'dodge' | 'tangle' | 'blackout'; fallRows: number; laneSwing: number; tilt: number; bounce: number };
export type LadderStory = { kind: LadderEventKind; title: string; setupText: string; actionText: string; recoveryText: string; prop: string; motion: LadderMotion };
export type LadderBridge = { id: string; row: number; leftLane: number; rightLane: number; actorIds: [string, string] };
export type LadderEvent = LadderStory & { id: string; actorId: string; actors: string[]; setup: number; action: number; resolve: number; end: number; row: number; fromLane: number; toLane: number; bridgeId?: string };
export type LadderActiveEvent = LadderEvent & { stage: LadderEventStage; phase: number; age: number };
export type LadderPathSegment = { id: string; kind: 'climb' | 'bridge' | 'event'; start: number; end: number; fromLane: number; toLane: number; fromRow: number; toRow: number; bridgeId?: string; eventId?: string };
export type LadderPath = { id: string; index: number; startLane: number; doorLane: number; startAt: number; arrivalAt: number; segments: LadderPathSegment[] };
export type LadderTimeline = { duration: number; laneCount: number; rungCount: number; ids: string[]; doorOrder: string[]; bridges: LadderBridge[]; paths: Record<string, LadderPath>; events: LadderEvent[] };
export type LadderActorFrame = { id: string; index: number; lane: number; height: number; rungProgress: number; pose: LadderPose; phase: number; fromLane?: number; toLane?: number; bridgeId?: string; eventId?: string; eventStage?: LadderEventStage; supportRow?: number; fallDepth?: number; tilt: number; arrived: boolean; doorLane?: number; winner: boolean };
export type LadderFrame = { elapsed: number; actors: LadderActorFrame[]; activeEvents: LadderActiveEvent[]; winnerId?: string; complete: boolean };

const motion = (type: LadderMotion['type'], fallRows = 0, laneSwing = 0, tilt = 0, bounce = 0): LadderMotion => ({ type, fallRows, laneSwing, tilt, bounce });
export const LADDER_STORIES: readonly LadderStory[] = [
  { kind: 'loose-rung', title: '발판이 덜컥!', setupText: '발밑 나무 발판에서 삐걱 소리가 납니다.', actionText: '발판이 빠졌어요! 아래 손잡이를 붙잡습니다.', recoveryText: '두 손으로 몸을 끌어올려 다시 출발합니다.', prop: 'broken-rung', motion: motion('fall', 2, .08, .18) },
  { kind: 'trapdoor', title: '열리는 비밀 발판', setupText: '수상한 발판 위에 조심스럽게 발을 올립니다.', actionText: '발판이 열립니다! 안전줄이 몸을 받아냅니다.', recoveryText: '줄을 타고 올라와 발판을 건너뜁니다.', prop: 'hatch', motion: motion('fall', 3, .1, -.2) },
  { kind: 'wind', title: '옆바람 주의!', setupText: '커다란 선풍기가 이쪽을 향합니다.', actionText: '바람에 몸이 흔들립니다! 팔을 뻗어 버팁니다.', recoveryText: '바람이 잦아들자 중심을 잡고 올라갑니다.', prop: 'fan', motion: motion('swing', .25, .24, .27) },
  { kind: 'pendulum', title: '추가 지나갑니다', setupText: '앞에서 커다란 추가 좌우로 흔들립니다.', actionText: '몸을 낮춰 추를 피하고 사다리를 꼭 잡습니다.', recoveryText: '추가 지나간 틈에 다시 몸을 일으킵니다.', prop: 'pendulum', motion: motion('dodge', .5, .18, -.3) },
  { kind: 'spring', title: '통통 튀는 발판', setupText: '발판 아래 용수철이 눌립니다.', actionText: '용수철이 튕깁니다! 잠깐 위로 솟구칩니다.', recoveryText: '윗 손잡이를 잡고 원래 발판에 내려섭니다.', prop: 'spring', motion: motion('boost', 0, .05, .12, 1.3) },
  { kind: 'bird', title: '새의 깜짝 방문', setupText: '새 한 마리가 손잡이에 내려앉았습니다.', actionText: '날갯짓을 피해 얼굴을 가리고 옆으로 비킵니다.', recoveryText: '새가 날아가자 손잡이를 다시 잡습니다.', prop: 'bird', motion: motion('dodge', .2, .2, .23) },
  { kind: 'paint', title: '페인트 비를 피해라', setupText: '위에서 페인트통이 기울어집니다.', actionText: '페인트가 쏟아집니다! 몸을 옆으로 젖힙니다.', recoveryText: '얼굴을 쓱 닦고 다시 위를 바라봅니다.', prop: 'paint-can', motion: motion('dodge', .25, -.2, -.23) },
  { kind: 'sticky', title: '끈적한 손잡이', setupText: '손잡이에 반짝이는 풀이 묻어 있습니다.', actionText: '손이 붙었어요! 몸을 뒤로 당기며 떼어냅니다.', recoveryText: '손이 떨어졌습니다. 손을 털고 다시 잡습니다.', prop: 'glue', motion: motion('tangle', .35, .07, .2) },
  { kind: 'rope-tangle', title: '안전줄이 꼬였다', setupText: '안전줄이 발목 주변으로 말려듭니다.', actionText: '한 손으로 버티고 다른 손으로 매듭을 풉니다.', recoveryText: '줄이 풀렸습니다. 두 발을 다시 올려놓습니다.', prop: 'rope', motion: motion('tangle', .6, -.07, -.17) },
  { kind: 'balloon', title: '풍선이 당긴다', setupText: '커다란 풍선이 안전벨트에 걸렸습니다.', actionText: '풍선에 몸이 떠오릅니다! 사다리를 놓지 않습니다.', recoveryText: '풍선 줄을 풀고 발판에 가볍게 내려옵니다.', prop: 'balloon', motion: motion('boost', 0, .12, -.12, 1.1) },
  { kind: 'false-sign', title: '수상한 안내판', setupText: '옆을 가리키는 안내판이 빙글 돌아갑니다.', actionText: '잘못된 화살표를 보고 멈칫! 실제 손잡이를 확인합니다.', recoveryText: '올바른 길을 확인하고 다시 올라갑니다.', prop: 'sign', motion: motion('dodge', .1, .18, .18) },
  { kind: 'bucket', title: '물벼락!', setupText: '머리 위 양동이에서 물방울이 떨어집니다.', actionText: '물이 쏟아져 미끄러집니다! 아래 발판을 잡습니다.', recoveryText: '젖은 손을 털고 다시 올라옵니다.', prop: 'water-bucket', motion: motion('fall', 2, -.08, -.16) },
  { kind: 'banana', title: '미끄러운 발판', setupText: '발판에 노란 껍질이 보입니다.', actionText: '발이 미끄러졌어요! 안전 손잡이를 붙잡습니다.', recoveryText: '껍질을 치우고 두 발로 다시 일어섭니다.', prop: 'banana', motion: motion('fall', 2, .09, .2) },
  { kind: 'zipline', title: '안전줄의 그네', setupText: '옆으로 늘어진 안전줄이 팽팽해집니다.', actionText: '줄에 매달려 작게 흔들리며 사다리에 손을 뻗습니다.', recoveryText: '원래 줄을 잡고 발판으로 돌아옵니다.', prop: 'pulley', motion: motion('swing', .6, -.24, -.28) },
  { kind: 'lights-out', title: '불이 잠깐 꺼졌다', setupText: '조명이 깜빡거리고 비상등이 켜집니다.', actionText: '손잡이를 잡은 채 눈을 크게 뜨고 길을 확인합니다.', recoveryText: '조명이 돌아왔습니다. 안도하며 다시 올라갑니다.', prop: 'lamp', motion: motion('blackout') },
  { kind: 'safety-net', title: '그물이 받아줬다', setupText: '사다리 옆 안전그물이 펼쳐집니다.', actionText: '발을 헛디뎠지만 그물이 받아냅니다! 손잡이에 매달립니다.', recoveryText: '그물의 탄력으로 몸을 끌어올립니다.', prop: 'net', motion: motion('fall', 3, -.1, -.18) },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value = (value + 0x6d2b79f5) >>> 0; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; }
  return result;
}

/** Cosmetic stories and bridge layout never draw or change a participant's destination. */
export function buildLadderTimeline(candidates: readonly Candidate[], order: readonly string[], duration = LADDER_DURATION, storySeed = 1): LadderTimeline {
  if (!Number.isFinite(duration) || duration < 20_000) throw new RangeError('Ladder duration must be at least 20 seconds');
  const ids = candidates.map(candidate => candidate.id), laneCount = ids.length;
  if (laneCount > 10 || new Set(ids).size !== laneCount) throw new RangeError('Ladder supports up to 10 unique participants');
  const doorOrder = order.length ? [...order] : [...ids];
  if (doorOrder.length !== laneCount || new Set(doorOrder).size !== laneCount || doorOrder.some(id => !ids.includes(id))) throw new RangeError('Every destination must contain one participant');
  const timeline: LadderTimeline = { duration, laneCount, rungCount: LADDER_RUNGS, ids, doorOrder, bridges: [], paths: Object.create(null) as Record<string, LadderPath>, events: [] };
  if (!laneCount) return timeline;
  const unit = duration / LADDER_DURATION, random = seeded(storySeed);
  // Sparse ladders have much wider crossings; allow a readable walk at either end of the range.
  const bridgeDuration = (750 + 650 * clamp((10 - laneCount) / 8, 0, 1)) * unit;
  const ranks = new Map(doorOrder.map((id, index) => [id, index]));
  const sorting = [...ids], waves: number[][] = [];
  for (let pass = 0; pass < laneCount; pass++) {
    const wave: number[] = [];
    for (let lane = pass % 2; lane + 1 < laneCount; lane += 2) {
      if (ranks.get(sorting[lane])! > ranks.get(sorting[lane + 1])!) { [sorting[lane], sorting[lane + 1]] = [sorting[lane + 1], sorting[lane]]; wave.push(lane); }
    }
    if (wave.length) waves.push(wave);
  }
  if (laneCount > 1 && waves.length <= 8) { const lane = Math.floor(random() * (laneCount - 1)); waves.unshift([lane], [lane]); }
  const occupants = [...ids];
  waves.forEach((wave, index) => {
    const row = waves.length === 1 ? 12 : Math.round(2 + index * 20 / (waves.length - 1));
    wave.forEach(leftLane => {
      const rightLane = leftLane + 1, actorIds: [string, string] = [occupants[leftLane], occupants[rightLane]];
      timeline.bridges.push({ id: `bridge-${index}-${leftLane}`, row, leftLane, rightLane, actorIds });
      [occupants[leftLane], occupants[rightLane]] = [occupants[rightLane], occupants[leftLane]];
    });
  });
  if (occupants.some((id, index) => id !== doorOrder[index])) throw new Error('Ladder bridge permutation is incomplete');
  const eventCount = laneCount > 1 ? 3 + Math.floor(random() * 2) : 0;
  const rows = eventCount === 4 ? [5, 11, 17, 21] : [6, 13, 20];
  const starts = eventCount === 4 ? [8500, 16500, 24500, 32500] : [9000, 20000, 31000];
  const stories = shuffled(LADDER_STORIES, random), actors = shuffled(ids, random);
  for (let index = 0; index < eventCount; index++) {
    const story = stories[index], actorId = actors[index % actors.length], setup = starts[index] * unit;
    timeline.events.push({ ...story, motion: { ...story.motion }, id: `event-${index}-${story.kind}`, actorId, actors: [actorId], setup, action: setup + 700 * unit, resolve: setup + 2500 * unit, end: setup + 4000 * unit, row: rows[index], fromLane: 0, toLane: 0 });
  }
  for (let index = 0; index < laneCount; index++) {
    const id = ids[index], startAt = (3000 + index % 3 * 110) * unit, arrivalAt = (39_500 + random() * 1700) * unit;
    const path: LadderPath = { id, index, startLane: index, doorLane: doorOrder.indexOf(id), startAt, arrivalAt, segments: [] };
    type Operation = { kind: 'climb' | 'bridge'; fromLane: number; toLane: number; fromRow: number; toRow: number; bridgeId?: string };
    let lane = index, row = 0, chunkStart = startAt, pending: Operation[] = [];
    const finishChunk = (end: number) => {
      const budget = Math.max(1, end - chunkStart), crossings = pending.filter(op => op.kind === 'bridge').length;
      const crossingTime = crossings ? Math.min(bridgeDuration, budget * .4 / crossings) : 0;
      const climbRows = pending.reduce((total, op) => total + (op.kind === 'climb' ? op.toRow - op.fromRow : 0), 0);
      const climbTime = budget - crossings * crossingTime;
      let cursor = chunkStart;
      pending.forEach((op, opIndex) => {
        const length = op.kind === 'bridge' ? crossingTime : climbRows ? climbTime * (op.toRow - op.fromRow) / climbRows : climbTime / Math.max(1, pending.length - crossings);
        const segmentEnd = opIndex === pending.length - 1 ? end : cursor + length;
        path.segments.push({ ...op, id: `path-${index}-${path.segments.length}`, start: cursor, end: segmentEnd }); cursor = segmentEnd;
      });
      pending = []; chunkStart = end;
    };
    const checkpoints = [...timeline.bridges.filter(bridge => bridge.actorIds.includes(id)).map(bridge => ({ row: bridge.row, bridge, event: undefined as LadderEvent | undefined })), ...timeline.events.filter(event => event.actorId === id).map(event => ({ row: event.row, bridge: undefined as LadderBridge | undefined, event }))].sort((a, b) => a.row - b.row || Number(!a.bridge) - Number(!b.bridge));
    for (const point of checkpoints) {
      if (point.row > row) pending.push({ kind: 'climb', fromLane: lane, toLane: lane, fromRow: row, toRow: point.row });
      row = point.row;
      if (point.bridge) {
        const bridge = point.bridge, next = lane === bridge.leftLane ? bridge.rightLane : bridge.leftLane;
        pending.push({ kind: 'bridge', fromLane: lane, toLane: next, fromRow: row, toRow: row, bridgeId: bridge.id }); lane = next;
      } else if (point.event) {
        const event = point.event; event.fromLane = lane; event.toLane = lane;
        event.bridgeId = timeline.bridges.find(bridge => bridge.row === row && bridge.actorIds.includes(id))?.id;
        finishChunk(event.setup);
        path.segments.push({ id: `path-${index}-${path.segments.length}`, kind: 'event', start: event.setup, end: event.end, fromLane: lane, toLane: lane, fromRow: row, toRow: row, eventId: event.id }); chunkStart = event.end;
      }
    }
    if (row < LADDER_RUNGS) pending.push({ kind: 'climb', fromLane: lane, toLane: lane, fromRow: row, toRow: LADDER_RUNGS });
    finishChunk(arrivalAt);
    if (lane !== path.doorLane) throw new Error('Participant path does not reach its assigned door');
    timeline.paths[id] = path;
  }
  return timeline;
}

function activeEvent(event: LadderEvent, elapsed: number): LadderActiveEvent {
  const stage: LadderEventStage = elapsed < event.action ? 'setup' : elapsed < event.resolve ? 'action' : 'resolve';
  const start = stage === 'setup' ? event.setup : stage === 'action' ? event.action : event.resolve;
  const end = stage === 'setup' ? event.action : stage === 'action' ? event.resolve : event.end;
  return { ...event, stage, phase: clamp((elapsed - start) / (end - start), 0, 1), age: elapsed - event.setup };
}

function eventPosition(event: LadderEvent, elapsed: number) {
  const active = activeEvent(event, elapsed), { type, fallRows, laneSwing, tilt, bounce } = event.motion;
  let row = event.row, lane = event.fromLane, pose: LadderPose = 'balance', angle = 0, supportRow: number | undefined = Math.min(LADDER_RUNGS, event.row + 2);
  if (active.stage !== 'setup') {
    const actionPhase = clamp((elapsed - event.action) / (event.resolve - event.action), 0, 1), recovery = active.stage === 'resolve' ? smooth(active.phase) : 0;
    if (type === 'fall') {
      const drop = smooth(actionPhase / (5 / 9)); row -= fallRows * drop * (1 - recovery);
      lane += laneSwing * Math.sin(actionPhase * Math.PI) * (1 - recovery);
      angle = tilt * Math.sin(actionPhase * Math.PI) * (1 - recovery);
      pose = active.stage === 'resolve' ? 'clamber' : actionPhase < 5 / 9 ? 'fall' : 'hang';
      supportRow = pose === 'fall' ? undefined : pose === 'hang' ? event.row - fallRows + 2 : Math.min(LADDER_RUNGS, Math.ceil(row) + 2);
    } else {
      const pulse = active.stage === 'resolve' ? 1 - recovery : smooth(actionPhase);
      const sway = active.stage === 'resolve' ? 1 - recovery : Math.sin(actionPhase * Math.PI / 2);
      lane += laneSwing * sway; angle = tilt * sway;
      row += type === 'boost' ? bounce * pulse : -fallRows * pulse;
      pose = type === 'boost' ? active.stage === 'resolve' ? 'clamber' : 'hang' : type === 'tangle' || type === 'swing' ? active.stage === 'resolve' ? 'clamber' : 'hang' : 'balance';
      supportRow = Math.min(LADDER_RUNGS, Math.ceil(row) + 2);
    }
  }
  return { row, lane, pose, angle, supportRow, active };
}

/** Elapsed time is the only animation input, so seeking and pausing cannot alter a route. */
export function ladderFrame(timeline: LadderTimeline, elapsed: number, targetLane = 0): LadderFrame {
  const time = clamp(Number.isFinite(elapsed) ? elapsed : 0, 0, timeline.duration);
  if (timeline.laneCount && (!Number.isInteger(targetLane) || targetLane < 0 || targetLane >= timeline.laneCount)) throw new RangeError('Select an existing destination');
  const activeEvents = timeline.events.filter(event => time >= event.setup && time < event.end).map(event => activeEvent(event, time));
  const actors = timeline.ids.map(id => {
    const path = timeline.paths[id], arrived = time >= path.arrivalAt;
    const base: LadderActorFrame = { id, index: path.index, lane: path.startLane, height: 0, rungProgress: 0, pose: 'idle', phase: 0, tilt: 0, arrived, winner: false };
    if (arrived) return { ...base, lane: path.doorLane, height: 1, rungProgress: LADDER_RUNGS, pose: path.doorLane === targetLane ? 'win' as const : 'arrived' as const, doorLane: path.doorLane, winner: path.doorLane === targetLane, supportRow: LADDER_RUNGS };
    const segment = path.segments.find(part => time >= part.start && time < part.end);
    if (!segment) return base;
    const phase = clamp((time - segment.start) / (segment.end - segment.start), 0, 1);
    if (segment.kind === 'event') {
      const event = timeline.events.find(item => item.id === segment.eventId)!;
      const position = eventPosition(event, time), row = clamp(position.row, 0, LADDER_RUNGS);
      return { ...base, lane: clamp(position.lane, 0, timeline.laneCount - 1), height: row / LADDER_RUNGS, rungProgress: row, pose: position.pose, phase: position.active.phase, fromLane: event.fromLane, toLane: event.toLane, bridgeId: event.bridgeId, eventId: event.id, eventStage: position.active.stage, supportRow: position.supportRow, fallDepth: Math.max(0, event.row - row), tilt: position.angle };
    }
    const travel = segment.kind === 'bridge' ? smooth(phase) : phase;
    const row = segment.fromRow + (segment.toRow - segment.fromRow) * travel;
    return { ...base, lane: segment.fromLane + (segment.toLane - segment.fromLane) * travel, height: row / LADDER_RUNGS, rungProgress: row, pose: segment.kind === 'bridge' ? 'bridge' as const : 'climb' as const, phase, fromLane: segment.fromLane, toLane: segment.toLane, bridgeId: segment.bridgeId, supportRow: Math.min(LADDER_RUNGS, Math.ceil(row) + 2) };
  });
  const winnerId = actors.find(actor => actor.winner)?.id;
  return { elapsed: time, actors, activeEvents, winnerId, complete: actors.every(actor => actor.arrived) };
}
