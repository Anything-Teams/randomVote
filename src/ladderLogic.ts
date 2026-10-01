import type { Candidate } from './election';

export const LADDER_DURATION = 44_000;
export const LADDER_RUNGS = 24;
export const LADDER_ROOF_STEAL_CHANCE = .05;
export type LadderEventKind = 'loose-rung' | 'trapdoor' | 'wind' | 'pendulum' | 'spring' | 'bird' | 'paint' | 'sticky' | 'rope-tangle' | 'balloon' | 'false-sign' | 'bucket' | 'banana' | 'zipline' | 'lights-out' | 'safety-net' | 'leap-grapple' | 'crumbling-step' | 'rocket-boots';
export type LadderMotionType = 'slide' | 'drop' | 'swing' | 'launch' | 'rotate' | 'conveyor' | 'portal' | 'pounce';
export type LadderPose = 'idle' | 'climb' | 'bridge' | 'balance' | 'fall' | 'hang' | 'clamber' | 'win' | 'arrived' | 'slide' | 'drop' | 'swing' | 'launch' | 'rotate' | 'ride' | 'transfer' | 'run';
export type LadderEventStage = 'setup' | 'action' | 'resolve';
export type LadderTransferStage = 'takeoff' | 'flight' | 'catch' | 'pull';
export type LadderInteraction = { kind: 'throw'; role: 'thrower' | 'victim'; phase: number; stage: 'approach' | 'grip' | 'throw' | 'flight' | 'catch'; partnerId: string };
export type LadderMotion = { type: LadderMotionType; fallRows: number; laneSwing: number; tilt: number; bounce: number };
export type LadderStory = { kind: LadderEventKind; title: string; setupText: string; actionText: string; recoveryText: string; prop: string; motion: LadderMotion };
export type LadderBridge = { id: string; row: number; start: number; end: number; leftLane: number; rightLane: number; actorIds: [string, string]; motionType: LadderMotionType; partnerMotionType: LadderMotionType; motion: LadderMotion; mechanism: string; fromRow: number; toRow: number; landingRow: number; partnerLandingRow: number; pivotLane: number; pivotRow: number; eventId?: string };
export type LadderEvent = LadderStory & { id: string; actorId: string; partnerId: string; actors: string[]; setup: number; action: number; resolve: number; end: number; row: number; fromLane: number; toLane: number; fromRow: number; toRow: number; landingRow: number; partnerLandingRow: number; bridgeId: string; pivotLane: number; pivotRow: number };
export type LadderActiveEvent = LadderEvent & { stage: LadderEventStage; phase: number; age: number };
export type LadderWave = { id: string; index: number; row: number; start: number; end: number; bridgeIds: string[]; eventId?: string };
export type LadderPathSegment = { id: string; kind: 'climb' | 'bridge' | 'event' | 'roof'; start: number; end: number; fromLane: number; toLane: number; fromRow: number; toRow: number; bridgeId?: string; eventId?: string; transferRole?: 'primary' | 'partner' };
export type LadderPath = { id: string; index: number; startLane: number; doorLane: number; startAt: number; arrivalAt: number; segments: LadderPathSegment[] };
export type LadderRoofFinish = { actorId: string; otherId: string; targetLane: number; entryLane: number; runStart: number; claimAt: number };
export type LadderTimeline = { duration: number; laneCount: number; rungCount: number; ids: string[]; doorOrder: string[]; ladderOrder: string[]; bridges: LadderBridge[]; waves: LadderWave[]; paths: Record<string, LadderPath>; events: LadderEvent[]; roofFinish?: LadderRoofFinish };
export type LadderActorFrame = { id: string; index: number; lane: number; height: number; rungProgress: number; pose: LadderPose; phase: number; fromLane?: number; toLane?: number; fromRow?: number; toRow?: number; bridgeId?: string; eventId?: string; eventStage?: LadderEventStage; supportRow?: number; fallDepth?: number; tilt: number; arrived: boolean; doorLane?: number; winner: boolean; motionType?: LadderMotionType; motionPhase?: number; actionProgress?: number; transferProgress?: number; transferStage?: LadderTransferStage; transferRole?: 'primary' | 'partner'; gripLane?: number; gripRow?: number; catchRow?: number; landingRow?: number; pivotLane?: number; pivotRow?: number; depthOffset?: number; interaction?: LadderInteraction };
export type LadderFrame = { elapsed: number; actors: LadderActorFrame[]; activeEvents: LadderActiveEvent[]; winnerId?: string; complete: boolean };

const motion = (type: LadderMotionType, fallRows = 0, laneSwing = 0, tilt = 0, bounce = 0): LadderMotion => ({ type, fallRows, laneSwing, tilt, bounce });
export const LADDER_STORIES: readonly LadderStory[] = [
  { kind: 'loose-rung', title: '발판이 돌아간다!', setupText: '밟은 발판이 옆 사다리를 향해 돌아갑니다.', actionText: '회전 발판을 잡고 옆 줄로 건너갑니다!', recoveryText: '다른 사다리에 두 발을 올리고 다시 위로 갑니다.', prop: 'broken-rung', motion: motion('rotate', 0, 0, .25) },
  { kind: 'trapdoor', title: '옆으로 열린 함정문', setupText: '발밑 함정문이 옆 사다리를 향해 열립니다.', actionText: '옆으로 떨어지며 다른 사다리 손잡이를 낚아챕니다!', recoveryText: '매달린 몸을 끌어올려 새 줄에서 계속 올라갑니다.', prop: 'hatch', motion: motion('drop', 3, 0, -.23) },
  { kind: 'wind', title: '돌풍에 날아갔다!', setupText: '선풍기가 돌아가며 갑자기 강한 옆바람이 몰아칩니다.', actionText: '몸이 바람에 날려 옆 사다리를 향해 솟구칩니다!', recoveryText: '옆 사다리를 간신히 잡고 몸을 끌어올립니다.', prop: 'fan', motion: motion('launch', 0, 0, .24, 4.6) },
  { kind: 'pendulum', title: '추가 돌린 회전다리', setupText: '커다란 추가 연결 다리를 돌리기 시작합니다.', actionText: '도는 다리를 따라 옆 사다리에 손을 뻗습니다!', recoveryText: '새 줄의 발판에 발을 고정하고 다시 올라갑니다.', prop: 'pendulum', motion: motion('rotate', 0, 0, -.28) },
  { kind: 'spring', title: '옆으로 쏘는 발사판', setupText: '발판 아래 용수철이 옆 사다리를 향해 눌립니다.', actionText: '통! 몸이 높이 뜨며 옆 줄로 뛰어넘습니다!', recoveryText: '다른 사다리를 잡고 두 발을 다시 올립니다.', prop: 'spring', motion: motion('launch', 0, 0, .15, 4.6) },
  { kind: 'bird', title: '새가 바꾼 안내문', setupText: '새가 안내 화살표를 옆문 쪽으로 돌렸습니다.', actionText: '열린 통로를 지나 다른 사다리로 건너갑니다!', recoveryText: '새 줄에서 새를 올려다보고 다시 출발합니다.', prop: 'bird', motion: motion('portal') },
  { kind: 'paint', title: '페인트에 미끄러졌다!', setupText: '발판에 페인트가 쏟아져 발이 밀립니다.', actionText: '옆 줄로 떨어지며 새 손잡이를 붙잡습니다!', recoveryText: '몸을 끌어올린 뒤 페인트를 털어냅니다.', prop: 'paint-can', motion: motion('drop', 3, 0, -.18) },
  { kind: 'sticky', title: '손잡이가 움직인다', setupText: '붙잡은 손잡이가 이동 벨트에 붙어 있습니다.', actionText: '벨트가 사람을 옆 사다리로 데려갑니다!', recoveryText: '벨트에서 내려 다른 줄의 발판을 딛습니다.', prop: 'glue', motion: motion('conveyor') },
  { kind: 'rope-tangle', title: '옆 줄로 이어진 안전줄', setupText: '꼬인 줄을 풀자 옆 사다리까지 줄이 연결됩니다.', actionText: '줄 끝을 잡고 크게 그네를 타 옆 줄로 넘어갑니다!', recoveryText: '새 사다리에 발을 대고 안전줄을 정리합니다.', prop: 'rope', motion: motion('swing', 4.6, 0, -.22) },
  { kind: 'balloon', title: '풍선의 옆 줄 여행', setupText: '풍선이 옆 사다리 방향으로 안전벨트를 당깁니다.', actionText: '풍선에 몸이 높이 뜨며 다른 줄로 넘어갑니다!', recoveryText: '다른 사다리를 잡고 풍선 줄을 놓습니다.', prop: 'balloon', motion: motion('launch', 0, 0, -.1, 4.6) },
  { kind: 'false-sign', title: '화살표가 길을 바꿨다', setupText: '안내 화살표가 옆 통로를 가리킵니다.', actionText: '유도문이 열려 다른 사다리로 건너갑니다!', recoveryText: '새 줄의 문을 빠져나와 다시 올라갑니다.', prop: 'sign', motion: motion('portal') },
  { kind: 'bucket', title: '물벼락에 발이 헛디뎠다', setupText: '물통이 쏟아지며 발판에서 발이 밀립니다.', actionText: '옆 사다리로 떨어져 손잡이를 낚아챕니다!', recoveryText: '새 손잡이를 잡고 몸을 다시 올립니다.', prop: 'water-bucket', motion: motion('drop', 3, 0, -.17) },
  { kind: 'banana', title: '껍질이 바꾼 사다리', setupText: '노란 껍질에 발이 밀리며 옆으로 기울어집니다.', actionText: '옆 줄 아래로 떨어지다가 새 손잡이를 붙잡습니다!', recoveryText: '다른 사다리에서 몸을 끌어올려 중심을 되찾습니다.', prop: 'banana', motion: motion('drop', 3, 0, .22) },
  { kind: 'zipline', title: '옆 사다리로 집라인', setupText: '옆 줄까지 연결된 도르래 손잡이를 잡습니다.', actionText: '도르래가 케이블을 따라 미끄러집니다. 옆 줄로 손을 뻗습니다!', recoveryText: '새 줄에 발을 고정하고 도르래를 놓습니다.', prop: 'pulley', motion: motion('swing', 4.6, 0, -.2) },
  { kind: 'lights-out', title: '비상등 이동 발판', setupText: '불이 꺼지고 옆 줄로 가는 비상 발판이 켜집니다.', actionText: '빛나는 이동 발판을 타고 다른 사다리로 갑니다!', recoveryText: '옆 줄에서 다시 켜진 불빛을 확인합니다.', prop: 'lamp', motion: motion('conveyor') },
  { kind: 'safety-net', title: '그물이 옆으로 튕긴다', setupText: '옆 사다리를 향해 탄력 있는 그물이 펼쳐집니다.', actionText: '그물의 탄력으로 높이 뛰어 다른 줄을 잡습니다!', recoveryText: '옆 사다리에서 두 발을 올리고 위를 바라봅니다.', prop: 'net', motion: motion('launch', 0, 0, .1, 4.6) },
  { kind: 'crumbling-step', title: '발판이 와르르!', setupText: '발을 딛는 순간 발판에 금이 갑니다.', actionText: '부서진 발판 사이로 떨어지며 옆 줄 손잡이를 잡습니다!', recoveryText: '흔들리는 발을 고정하고 부스러기를 털어냅니다.', prop: 'crumbles', motion: motion('drop', 3, 0, -.18) },
  { kind: 'rocket-boots', title: '신발에서 불꽃이!', setupText: '신발 밑에서 작은 불꽃이 튑니다.', actionText: '추진 신발이 점화됐습니다! 옆 사다리로 날아갑니다!', recoveryText: '불꽃이 꺼지자 손잡이를 잡고 발을 올립니다.', prop: 'boost-boots', motion: motion('launch', 0, 0, .12, 4.6) },
  { kind: 'leap-grapple', title: '옆줄 습격! 잡고 던지기', setupText: '옆줄을 올려다보더니 발판을 박차고 뛰어듭니다.', actionText: '올라가던 상대를 붙잡아 반대쪽 사다리로 던집니다!', recoveryText: '던져진 사람은 옆줄 손잡이를 낚아채고 다시 올라갑니다.', prop: 'grapple', motion: motion('pounce', 3, 0, .18, 3) },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
function seeded(seed: number) { let value = seed >>> 0; return () => { value = (value + 0x6d2b79f5) >>> 0; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffled<T>(items: readonly T[], random: () => number): T[] { const result = [...items]; for (let index = result.length - 1; index > 0; index--) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
const mechanismNames: Record<LadderMotionType, string> = { slide: '미끄럼 통로', drop: '옆 줄 낙하 손잡이', swing: '로프 그네', launch: '발사 발판', rotate: '회전다리', conveyor: '이동 벨트', portal: '유도문 통로', pounce: '옆줄 습격·잡고 던지기' };
const actionPoses: Record<LadderMotionType, LadderPose> = { slide: 'slide', drop: 'drop', swing: 'swing', launch: 'launch', rotate: 'rotate', conveyor: 'ride', portal: 'transfer', pounce: 'launch' };
function bridgeMotion(type: LadderMotionType): LadderMotion { return type === 'swing' ? motion(type, 4.6, 0, .2) : type === 'launch' ? motion(type, 0, 0, .15, 4.6) : type === 'drop' ? motion(type, 3, 0, .22) : type === 'rotate' ? motion(type, 0, 0, .23) : motion(type); }
const partnerMotion = (type: LadderMotionType): LadderMotionType => type === 'pounce' ? 'drop' : type === 'launch' ? 'swing' : 'launch';
const spotlightTiming = { setup: 450, action: 1850, pull: 1150 };
const spotlightActionDuration = (type: LadderMotionType, distance = 1) => type === 'pounce' ? 2300 : Math.max(spotlightTiming.action, 1550 + distance * 120);
const spotlightDuration = (type: LadderMotionType, distance = 1) => spotlightTiming.setup + spotlightActionDuration(type, distance) + spotlightTiming.pull;
const normalTransferDuration = (type: LadderMotionType, laneCount: number, distance = 1) => {
  const base: Record<LadderMotionType, number> = { slide: 1250, drop: 1250, launch: 1350, swing: 1450, rotate: 1400, conveyor: 1350, portal: 1350, pounce: 1450 };
  return base[type] + 200 * clamp((10 - laneCount) / 8, 0, 1) + (distance - 1) * 250;
};
function flightProgress(type: LadderMotionType, value: number) {
  const t = clamp(value, 0, 1);
  // A falling body accelerates away from its loose foothold. A leap pushes off
  // promptly, then slows into the catching hand; ropes speed up through the arc.
  if (type === 'drop' || type === 'slide') return t < 1 / 3 ? 1.8 * t * t : 1.2 * t - .2;
  if (type === 'launch') return 1 - (1 - t) * (1 - t) * (1 + 1.25 * t);
  return smooth(t);
}

/** Destinations are already uniformly drawn. Every route change below conserves that draw. */
export function buildLadderTimeline(candidates: readonly Candidate[], order: readonly string[], duration = LADDER_DURATION, storySeed = 1, finishTarget?: number): LadderTimeline {
  if (!Number.isFinite(duration) || duration < 20_000) throw new RangeError('Ladder duration must be at least 20 seconds');
  const ids = candidates.map(candidate => candidate.id), laneCount = ids.length;
  if (laneCount > 10 || new Set(ids).size !== laneCount) throw new RangeError('Ladder supports up to 10 unique participants');
  const doorOrder = order.length ? [...order] : [...ids];
  if (doorOrder.length !== laneCount || new Set(doorOrder).size !== laneCount || doorOrder.some(id => !ids.includes(id))) throw new RangeError('Every destination must contain one participant');
  if (finishTarget !== undefined && laneCount && (!Number.isInteger(finishTarget) || finishTarget < 0 || finishTarget >= laneCount)) throw new RangeError('Select an existing treasure');
  const ladderOrder = [...doorOrder], finishRandom = seeded(storySeed ^ 0x726f6f66);
  let roofFinish: LadderRoofFinish | undefined;
  if (laneCount > 1 && finishTarget !== undefined && finishRandom() < LADDER_ROOF_STEAL_CHANCE) {
    const adjacent = [finishTarget - 1, finishTarget + 1].filter(lane => lane >= 0 && lane < laneCount);
    const entryLane = adjacent[Math.floor(finishRandom() * adjacent.length)];
    roofFinish = { actorId: doorOrder[finishTarget], otherId: doorOrder[entryLane], targetLane: finishTarget, entryLane, runStart: 0, claimAt: 0 };
    [ladderOrder[finishTarget], ladderOrder[entryLane]] = [ladderOrder[entryLane], ladderOrder[finishTarget]];
  }
  const timeline: LadderTimeline = { duration, laneCount, rungCount: LADDER_RUNGS, ids, doorOrder, ladderOrder, bridges: [], waves: [], paths: Object.create(null) as Record<string, LadderPath>, events: [], roofFinish };
  if (!laneCount) return timeline;
  const unit = duration / LADDER_DURATION, random = seeded(storySeed), occupants = [...ids], pairWaves: { leftLane: number; rightLane: number; actors: [string, string] }[][] = [];
  const addPairs = (lanes: [number, number][]) => {
    if (!lanes.length) return;
    const wave = lanes.map(([leftLane, rightLane]) => ({ leftLane, rightLane, actors: [occupants[leftLane], occupants[rightLane]] as [string, string] }));
    lanes.forEach(([left, right]) => { [occupants[left], occupants[right]] = [occupants[right], occupants[left]]; }); pairWaves.push(wave);
  };
  const addWave = (lanes: number[]) => addPairs(lanes.map(left => [left, left + 1]));
  // Everyone takes at least two real crossings; sorting continues from this weave.
  if (laneCount > 1) {
    if (laneCount > 2) {
      const distance = 2 + Math.floor(random() * (laneCount - 2)), left = Math.floor(random() * (laneCount - distance));
      addPairs([[left, left + distance]]);
    }
    for (const parity of [0, 1, 0]) addWave(Array.from({ length: Math.floor((laneCount - parity) / 2) }, (_, index) => parity + index * 2));
    if (laneCount === 2) { addWave([0]); addWave([0]); }
    const ranks = new Map(ladderOrder.map((id, index) => [id, index]));
    for (let pass = 0; pass < laneCount; pass++) {
      const lanes: number[] = [];
      for (let lane = pass % 2; lane + 1 < laneCount; lane += 2) if (ranks.get(occupants[lane])! > ranks.get(occupants[lane + 1])!) lanes.push(lane);
      addWave(lanes);
    }
  }
  if (occupants.some((id, index) => id !== ladderOrder[index])) throw new Error('Ladder bridge permutation is incomplete');
  const normalTypes: LadderMotionType[] = ['swing', 'launch', 'drop', 'rotate', 'conveyor', 'slide', 'portal'];
  pairWaves.forEach((pairs, index) => {
    // Leave room below for a rope swing and above for a body-height leap.
    const row = pairWaves.length === 1 ? 12 : Math.round(6 + index * 14 / Math.max(1, pairWaves.length - 1));
    const wave: LadderWave = { id: 'wave-' + index, index, row, start: 0, end: 0, bridgeIds: [] };
    pairs.forEach(({ leftLane, rightLane, actors }) => {
      const type = rightLane - leftLane > 1 ? random() < .5 ? 'launch' : 'swing' : normalTypes[Math.floor(random() * normalTypes.length)];
      const bridge: LadderBridge = { id: 'bridge-' + index + '-' + leftLane, row, start: 0, end: 0, leftLane, rightLane, actorIds: actors, motionType: type, partnerMotionType: partnerMotion(type), motion: bridgeMotion(type), mechanism: rightLane - leftLane > 1 ? '여러 줄을 가로지르는 ' + mechanismNames[type] : mechanismNames[type], fromRow: row, toRow: row, landingRow: row, partnerLandingRow: row, pivotLane: (leftLane + rightLane) / 2, pivotRow: row + 3 };
      timeline.bridges.push(bridge); wave.bridgeIds.push(bridge.id);
    }); timeline.waves.push(wave);
  });
  const count = Math.min(pairWaves.length, 5);
  const required = shuffled(['swing', 'launch', 'drop', 'pounce'] as LadderMotionType[], random);
  const stories = required.map(type => {
    const choices = LADDER_STORIES.filter(story => story.motion.type === type);
    return choices[Math.floor(random() * choices.length)];
  });
  if (count > 4) stories.push(shuffled(LADDER_STORIES.filter(story => ['rotate', 'conveyor', 'slide', 'portal'].includes(story.motion.type)), random)[0]);
  const firstEventWave = timeline.waves[Math.floor(.5 * timeline.waves.length / count)];
  if (firstEventWave && timeline.bridges.some(bridge => firstEventWave.bridgeIds.includes(bridge.id) && bridge.rightLane - bridge.leftLane > 1)) {
    const airborne = stories.findIndex(story => story.motion.type === 'launch' || story.motion.type === 'swing');
    [stories[0], stories[airborne]] = [stories[airborne], stories[0]];
  }
  for (let index = 0; index < count; index++) {
    const wave = timeline.waves[Math.floor((index + .5) * timeline.waves.length / count)], choices = timeline.bridges.filter(bridge => wave.bridgeIds.includes(bridge.id));
    const bridge = choices[Math.floor(random() * choices.length)], actorId = bridge.actorIds[Math.floor(random() * 2)], partnerId = bridge.actorIds.find(id => id !== actorId)!;
    const fromLane = actorId === bridge.actorIds[0] ? bridge.leftLane : bridge.rightLane, toLane = fromLane === bridge.leftLane ? bridge.rightLane : bridge.leftLane;
    const story = stories[index];
    const event: LadderEvent = { ...story, motion: { ...story.motion }, id: 'event-' + index + '-' + story.kind, actorId, partnerId, actors: [actorId, partnerId], setup: 0, action: 0, resolve: 0, end: 0, row: wave.row, fromLane, toLane, fromRow: wave.row, toRow: wave.row, landingRow: wave.row, partnerLandingRow: wave.row, bridgeId: bridge.id, pivotLane: bridge.pivotLane, pivotRow: bridge.pivotRow };
    bridge.eventId = event.id; bridge.motionType = story.motion.type; bridge.partnerMotionType = story.kind === 'wind' ? 'drop' : partnerMotion(story.motion.type); bridge.motion = { ...story.motion }; bridge.mechanism = bridge.rightLane - bridge.leftLane > 1 ? '여러 줄을 가로지르는 ' + mechanismNames[story.motion.type] : mechanismNames[story.motion.type]; wave.eventId = event.id; timeline.events.push(event);
  }
  // Each actor has its own landing. A leap may land higher if the next actual
  // crossing leaves a rung to climb; a drop always catches the other ladder lower.
  for (const bridge of timeline.bridges) {
    const event = timeline.events.find(item => item.id === bridge.eventId);
    const primary = event?.actorId ?? bridge.actorIds[0], partner = event?.partnerId ?? bridge.actorIds[1];
    const landing = (id: string, type: LadderMotionType) => {
      const next = timeline.bridges.find(item => item.row > bridge.row && item.actorIds.includes(id));
      if (type === 'drop' || type === 'slide') return bridge.row - 3;
      if (type === 'launch' && (!next || next.row - bridge.row >= 2)) return bridge.row + 1;
      return bridge.row;
    };
    bridge.landingRow = landing(primary, bridge.motionType); bridge.toRow = bridge.landingRow;
    bridge.partnerLandingRow = landing(partner, bridge.partnerMotionType);
    if (event) { event.landingRow = bridge.landingRow; event.toRow = bridge.landingRow; event.partnerLandingRow = bridge.partnerLandingRow; }
  }
  const waveDuration = (wave: LadderWave) => Math.max(...timeline.bridges.filter(bridge => wave.bridgeIds.includes(bridge.id)).map(bridge =>
    bridge.eventId ? spotlightDuration(bridge.motionType, bridge.rightLane - bridge.leftLane) * unit : (normalTransferDuration(bridge.motionType, laneCount, bridge.rightLane - bridge.leftLane) + bridge.leftLane % 3 * 45) * unit));
  const lastWaveEnd = 39_500 * unit;
  const transferBudget = timeline.waves.reduce((sum, wave) => sum + waveDuration(wave), 0);
  let previousHeight = 0, previousDrop = 0;
  const climbWeights = timeline.waves.map(wave => {
    const weight = Math.max(0, wave.row - previousHeight) + previousDrop;
    previousHeight = wave.row;
    previousDrop = Math.max(0, ...timeline.bridges.filter(bridge => wave.bridgeIds.includes(bridge.id)).map(bridge => bridge.fromRow - Math.min(bridge.landingRow, bridge.partnerLandingRow)));
    return weight;
  });
  const totalWeight = climbWeights.reduce((sum, weight) => sum + weight, 0), climbPerRow = totalWeight ? (lastWaveEnd - 3000 * unit - transferBudget) / totalWeight : 0;
  if (climbPerRow < 0) throw new Error('Ladder transfers exceed the route time budget');
  let cursor = 3000 * unit;
  for (const wave of timeline.waves) {
    wave.start = cursor + climbWeights[wave.index] * climbPerRow; wave.end = wave.start + waveDuration(wave);
    for (const bridge of timeline.bridges.filter(item => wave.bridgeIds.includes(item.id))) {
      bridge.start = wave.start + (bridge.eventId ? 0 : bridge.leftLane % 3 * 45 * unit);
      bridge.end = bridge.start + (bridge.eventId ? spotlightDuration(bridge.motionType, bridge.rightLane - bridge.leftLane) * unit : normalTransferDuration(bridge.motionType, laneCount, bridge.rightLane - bridge.leftLane) * unit);
      const event = timeline.events.find(item => item.id === bridge.eventId);
      if (event) { event.setup = bridge.start; event.action = bridge.start + spotlightTiming.setup * unit; event.resolve = event.action + spotlightActionDuration(bridge.motionType, bridge.rightLane - bridge.leftLane) * unit; event.end = bridge.end; }
    }
    cursor = wave.end;
  }
  // The wave plan only proves the permutation and the total budget. Actual
  // devices run on pair-specific clocks, constrained by those two people's
  // previous landing and next departure, rather than firing a whole row at once.
  const originalTimes = new Map(timeline.bridges.map(bridge => [bridge.id, { start: bridge.start, end: bridge.end, duration: bridge.end - bridge.start }]));
  const dependencies = new Map<string, { id: string; previous?: string; gap: number }[]>();
  const landingFor = (bridge: LadderBridge, id: string) => {
    const event = timeline.events.find(item => item.id === bridge.eventId);
    return id === (event?.actorId ?? bridge.actorIds[0]) ? bridge.landingRow : bridge.partnerLandingRow;
  };
  for (let index = 0; index < laneCount; index++) {
    const id = ids[index], own = timeline.bridges.filter(bridge => bridge.actorIds.includes(id));
    own.forEach((bridge, ownIndex) => {
      const previous = own[ownIndex - 1];
      const rows = bridge.fromRow - (previous ? landingFor(previous, id) : 0);
      const gap = Math.max(260 * unit, rows * 120 * unit);
      const items = dependencies.get(bridge.id) ?? [];
      items.push({ id, previous: previous?.id, gap }); dependencies.set(bridge.id, items);
    });
  }
  const remainingWork = new Map<string, number>();
  const finalClimbTails = new Map<string, number>();
  const roofDuration = (id: string) => roofFinish ? id === roofFinish.actorId ? 1300 * unit : id === roofFinish.otherId ? 1400 * unit : 0 : 0;
  for (const id of ids) {
    const last = timeline.bridges.filter(bridge => bridge.actorIds.includes(id)).at(-1);
    if (!last) continue;
    const finishDelay = id === roofFinish?.actorId ? 1000 * unit + roofDuration(roofFinish.otherId) : 0;
    const climb = Math.max(600 * unit, (LADDER_RUNGS - landingFor(last, id)) * 300 * unit) + roofDuration(id) + finishDelay;
    finalClimbTails.set(last.id, Math.max(finalClimbTails.get(last.id) ?? 0, climb));
  }
  const arrivalHeadroom = 1700 * unit;
  for (const bridge of [...timeline.bridges].reverse()) {
    const original = originalTimes.get(bridge.id)!;
    let tail = Math.max(0, (finalClimbTails.get(bridge.id) ?? 0) - arrivalHeadroom);
    for (const next of timeline.bridges) for (const dependency of dependencies.get(next.id)!) {
      if (dependency.previous === bridge.id) tail = Math.max(tail, dependency.gap + remainingWork.get(next.id)!);
    }
    remainingWork.set(bridge.id, original.duration + tail);
  }
  const pairOrders = timeline.waves.map(wave => {
    const pairs = timeline.bridges.filter(bridge => wave.bridgeIds.includes(bridge.id));
    const rank = new Map(shuffled(pairs, random).map((bridge, index) => [bridge.id, index]));
    return [...pairs].sort((a, b) => remainingWork.get(b.id)! - remainingWork.get(a.id)! || rank.get(a.id)! - rank.get(b.id)!);
  });
  const schedule = (climbScale: number, strategy = 0) => {
    const times = new Map<string, { start: number; end: number }>();
    for (const pairs of pairOrders) {
      const firingTimes: { start: number; action: number }[] = [];
      const earliest = (bridge: LadderBridge) => Math.max(...dependencies.get(bridge.id)!.map(dependency => (dependency.previous ? times.get(dependency.previous)!.end : (3000 + ids.indexOf(dependency.id) % 4 * 45) * unit) + dependency.gap * climbScale));
      const ordered = strategy === 1 ? [...pairs].sort((a, b) => earliest(a) - earliest(b)) : strategy === 2 ? [...pairs].sort((a, b) => earliest(b) + remainingWork.get(b.id)! - earliest(a) - remainingWork.get(a.id)!) : strategy === 3 ? [...pairs].reverse() : pairs;
      for (const bridge of ordered) {
        let start = earliest(bridge);
        // Two people may act together because they are interacting. Distinct
        // pairs always get visibly different preparation and firing times.
        const duration = originalTimes.get(bridge.id)!.duration;
        const setup = bridge.eventId ? spotlightTiming.setup * unit : duration * .14;
        for (;;) {
          const conflict = firingTimes.find(time => Math.abs(start - time.start) < 450 * unit - .001 || Math.abs(start + setup - time.action) < 400 * unit - .001);
          if (conflict === undefined) break;
          start = Math.max(conflict.start + 450 * unit, conflict.action + 400 * unit - setup);
        }
        const end = start + duration;
        times.set(bridge.id, { start, end }); firingTimes.push({ start, action: start + setup });
      }
    }
    // Reserve the final hand-over-hand climb before filling the device budget.
    // Actors that leave their last device lower down need to depart sooner.
    return { times, end: Math.max(3000 * unit, ...[...times].map(([id, time]) => time.end + Math.max(0, (finalClimbTails.get(id) ?? 0) - arrivalHeadroom))) };
  };
  let strategy = 0;
  if (schedule(1).end > lastWaveEnd + .01) {
    strategy = [0, 1, 2, 3].reduce((best, candidate) => schedule(1, candidate).end < schedule(1, best).end ? candidate : best, 0);
  }
  if (schedule(1, strategy).end > lastWaveEnd + .01) throw new Error('Independent ladder paths exceed the route time budget');
  let low = 1, high = 8;
  for (let step = 0; step < 18; step++) {
    const scale = (low + high) / 2;
    if (schedule(scale, strategy).end > lastWaveEnd) high = scale; else low = scale;
  }
  const independent = schedule(low, strategy).times;
  for (const bridge of timeline.bridges) {
    const time = independent.get(bridge.id)!; bridge.start = time.start; bridge.end = time.end;
    const event = timeline.events.find(item => item.id === bridge.eventId);
    if (event) {
      event.setup = bridge.start; event.action = bridge.start + spotlightTiming.setup * unit;
      event.resolve = event.action + spotlightActionDuration(bridge.motionType, bridge.rightLane - bridge.leftLane) * unit; event.end = bridge.end;
    }
  }
  for (const wave of timeline.waves) {
    const pairs = timeline.bridges.filter(bridge => wave.bridgeIds.includes(bridge.id));
    wave.start = Math.min(...pairs.map(bridge => bridge.start)); wave.end = Math.max(...pairs.map(bridge => bridge.end));
  }
  for (let index = 0; index < laneCount; index++) {
    const id = ids[index], startAt = (3000 + index % 4 * 45) * unit;
    const ownBridges = timeline.bridges.filter(item => item.actorIds.includes(id)), last = ownBridges.at(-1);
    const finalClimbMinimum = last ? Math.max(600 * unit, (LADDER_RUNGS - landingFor(last, id)) * 300 * unit) : 0, runDuration = roofDuration(id);
    const ordinaryArrival = (39_500 + random() * 1700) * unit;
    const arrivalAt = Math.max(id === roofFinish?.actorId ? 38_000 * unit : ordinaryArrival, last ? last.end + finalClimbMinimum + runDuration : 0);
    const path: LadderPath = { id, index, startLane: index, doorLane: doorOrder.indexOf(id), startAt, arrivalAt, segments: [] };
    let lane = index, row = 0, at = startAt;
    const append = (kind: LadderPathSegment['kind'], start: number, end: number, nextLane: number, nextRow: number, extra: Partial<LadderPathSegment> = {}) => {
      if (end <= start) return;
      path.segments.push({ id: 'path-' + index + '-' + path.segments.length, kind, start, end, fromLane: lane, toLane: nextLane, fromRow: row, toRow: nextRow, ...extra }); lane = nextLane; row = nextRow;
    };
    // Unrelated waves are deliberately absent: climbing runs until this actor's
    // own next device, and resumes as soon as that device releases them.
    for (const bridge of ownBridges) {
      append('climb', at, bridge.start, lane, bridge.fromRow);
      const event = timeline.events.find(item => item.id === bridge.eventId), nextLane = lane === bridge.leftLane ? bridge.rightLane : bridge.leftLane;
      const role = event ? id === event.actorId ? 'primary' : 'partner' : id === bridge.actorIds[0] ? 'primary' : 'partner';
      append(event ? 'event' : 'bridge', bridge.start, bridge.end, nextLane, role === 'primary' ? bridge.landingRow : bridge.partnerLandingRow, { bridgeId: bridge.id, eventId: event?.id, transferRole: role });
      at = bridge.end;
    }
    append('climb', at, arrivalAt - runDuration, lane, LADDER_RUNGS);
    if (runDuration) append('roof', arrivalAt - runDuration, arrivalAt, path.doorLane, LADDER_RUNGS);
    if (lane !== path.doorLane) throw new Error('Participant path does not reach its assigned door');
    timeline.paths[id] = path;
  }
  if (roofFinish) {
    const winner = timeline.paths[roofFinish.actorId], other = timeline.paths[roofFinish.otherId], roof = winner.segments.at(-1)!;
    roofFinish.runStart = roof.start; roofFinish.claimAt = winner.arrivalAt;
    // The runner gets the gold while the climber on that ladder is still below
    // the edge. The climber then crosses the terrace to their original chest.
    const otherRoof = other.segments.at(-1)!, otherClimb = other.segments.at(-2)!;
    otherRoof.start = Math.max(otherRoof.start, winner.arrivalAt + 1000 * unit);
    otherClimb.end = otherRoof.start; otherRoof.end = otherRoof.start + roofDuration(other.id); other.arrivalAt = otherRoof.end;
    // Hold below the edge while the nearby runner grabs the gold. Without this
    // pause the terrace's top-out pose would make both look already arrived.
    const holdRow = Math.max(otherClimb.fromRow, LADDER_RUNGS - 2.6);
    const riseStart = otherRoof.start - (LADDER_RUNGS - holdRow) * 300 * unit;
    const approachEnd = Math.min(riseStart, Math.max(roof.start, otherClimb.start + (holdRow - otherClimb.fromRow) * 300 * unit));
    other.segments.splice(other.segments.length - 2, 1,
      { ...otherClimb, end: approachEnd, toRow: holdRow },
      { ...otherClimb, id: otherClimb.id + '-wait', start: approachEnd, end: riseStart, fromRow: holdRow, toRow: holdRow },
      { ...otherClimb, id: otherClimb.id + '-edge', start: riseStart, fromRow: holdRow });
  }
  return timeline;
}

function activeEvent(event: LadderEvent, elapsed: number): LadderActiveEvent {
  const stage: LadderEventStage = elapsed < event.action ? 'setup' : elapsed < event.resolve ? 'action' : 'resolve';
  const start = stage === 'setup' ? event.setup : stage === 'action' ? event.action : event.resolve, end = stage === 'setup' ? event.action : stage === 'action' ? event.resolve : event.end;
  return { ...event, stage, phase: clamp((elapsed - start) / (end - start), 0, 1), age: elapsed - event.setup };
}

function transferFrame(timeline: LadderTimeline, segment: LadderPathSegment, elapsed: number) {
  const bridge = timeline.bridges.find(item => item.id === segment.bridgeId)!, event = timeline.events.find(item => item.id === segment.eventId);
  const duration = segment.end - segment.start, setup = event?.action ?? segment.start + duration * .14, resolve = event?.resolve ?? segment.end - duration * .16;
  const stage: LadderEventStage = elapsed < setup ? 'setup' : elapsed < resolve ? 'action' : 'resolve';
  const stageStart = stage === 'setup' ? segment.start : stage === 'action' ? setup : resolve, stageEnd = stage === 'setup' ? setup : stage === 'action' ? resolve : segment.end;
  const phase = clamp((elapsed - stageStart) / (stageEnd - stageStart), 0, 1), role = segment.transferRole ?? 'primary';
  const type = role === 'partner' ? bridge.partnerMotionType : bridge.motionType, landingRow = segment.toRow;
  const catchRow = Math.min(LADDER_RUNGS, landingRow + 2);
  const airborne = ['drop', 'slide', 'swing', 'launch', 'pounce'].includes(type);
  const catchRoot = landingRow - (type === 'drop' || type === 'slide' ? 1.2 : airborne ? .8 : 0);
  if (bridge.motionType === 'pounce') {
    const thrower = role === 'primary', actionPhase = stage === 'setup' ? 0 : stage === 'resolve' ? 1 : phase;
    const interactionStage: LadderInteraction['stage'] = actionPhase < .32 ? 'approach' : actionPhase < .48 ? 'grip' : actionPhase < .6 ? 'throw' : actionPhase < .9 ? 'flight' : 'catch';
    const interaction: LadderInteraction = { kind: 'throw', role: thrower ? 'thrower' : 'victim', phase: actionPhase, stage: interactionStage, partnerId: thrower ? event!.partnerId : event!.actorId };
    let progress = 0, row = segment.fromRow, pose: LadderPose = 'balance';
    let transferStage: LadderTransferStage = 'takeoff';
    if (stage === 'action') {
      if (thrower) {
        progress = flightProgress('launch', phase / .32);
        row += 3 * Math.sin(progress * Math.PI);
        pose = phase < .32 ? 'launch' : phase < .6 ? 'balance' : 'clamber';
        transferStage = phase < .9 ? 'flight' : 'catch';
      } else {
        if (phase >= .32 && phase < .48) row += .5 * smooth((phase - .32) / .16);
        else if (phase >= .48 && phase < .6) row += .5 + .4 * smooth((phase - .48) / .12);
        else if (phase >= .6) {
          // Release gives the thrown body horizontal momentum immediately.
          // Gravity bends its height into a parabola; it does not accelerate
          // sideways as if an invisible rail were dragging it toward the catch.
          progress = clamp((phase - .6) / .3, 0, 1);
          row += .9 + progress - (1 + segment.fromRow + .9 - catchRoot) * progress * progress;
        }
        pose = phase < .32 ? 'balance' : phase < .9 ? 'drop' : 'hang';
        transferStage = phase < .32 ? 'takeoff' : phase < .9 ? 'flight' : 'catch';
      }
    } else if (stage === 'resolve') {
      progress = 1;
      row = thrower ? landingRow : catchRoot + (landingRow - catchRoot) * smooth(phase);
      pose = 'clamber'; transferStage = 'pull';
    }
    const lane = segment.fromLane + (segment.toLane - segment.fromLane) * progress;
    const gripLane = stage === 'setup' ? segment.fromLane : stage === 'resolve' || transferStage === 'catch' ? segment.toLane : undefined;
    const gripRow = gripLane === undefined ? undefined : stage === 'setup' ? Math.min(LADDER_RUNGS, segment.fromRow + 2) : catchRow;
    const actionProgress = stage === 'setup' ? 0 : stage === 'resolve' ? 1 : thrower ? phase : phase < .6 ? 0 : phase < .9 ? (phase - .6) / .3 * .64 : .64 + (phase - .9) / .1 * .36;
    return { lane, row, pose, phase, stage, type, progress, role, transferStage, actionProgress, gripLane, gripRow, catchRow, landingRow, depthOffset: 0, tilt: bridge.motion.tilt * Math.sin(progress * Math.PI) * Math.sign(segment.toLane - segment.fromLane), pivotLane: bridge.pivotLane, pivotRow: bridge.pivotRow, interaction };
  }
  const delay = role === 'partner' ? .08 : 0, flightEnd = type === 'drop' || type === 'slide' ? .64 : .86;
  const flight = clamp((phase - delay) / (flightEnd - delay), 0, 1);
  const progress = stage === 'setup' ? 0 : stage === 'resolve' ? 1 : flightProgress(type, flight);
  let row = segment.fromRow, pose: LadderPose = 'balance';
  let transferStage: LadderTransferStage = stage === 'setup' ? 'takeoff' : stage === 'resolve' ? 'pull' : phase < flightEnd ? 'flight' : 'catch';
  if (stage === 'action') {
    pose = actionPoses[type];
    row += (catchRoot - row) * progress;
    if (type === 'drop' || type === 'slide') {
      // The body lands on no deck: it falls sideways, catches a fixed hand rung,
      // hangs below it, and only reaches the foot rung during the pull.
      if (phase >= flightEnd) pose = 'hang';
    } else if (type === 'swing') row -= 4.6 * Math.sin(progress * Math.PI);
    else if (type === 'launch') row += 4.6 * Math.sin(progress * Math.PI);
    else if (type === 'rotate') row -= .7 * Math.sin(progress * Math.PI);
    if (phase >= flightEnd && type !== 'drop' && type !== 'slide') pose = airborne ? 'hang' : 'balance';
  } else if (stage === 'resolve') {
    row = catchRoot + (landingRow - catchRoot) * smooth(phase);
    pose = 'clamber';
  }
  const lane = segment.fromLane + (segment.toLane - segment.fromLane) * progress;
  const gripLane = stage === 'setup' ? segment.fromLane : stage === 'resolve' || transferStage === 'catch' ? segment.toLane : undefined;
  const gripRow = gripLane === undefined ? undefined : stage === 'setup' ? Math.min(LADDER_RUNGS, segment.fromRow + 2) : catchRow;
  return { lane, row, pose, phase, stage, type, progress, role, transferStage, actionProgress: stage === 'setup' ? 0 : stage === 'resolve' ? 1 : phase, gripLane, gripRow, catchRow, landingRow, depthOffset: 0, tilt: bridge.motion.tilt * Math.sin(progress * Math.PI) * Math.sign(segment.toLane - segment.fromLane), pivotLane: bridge.pivotLane, pivotRow: bridge.pivotRow, interaction: undefined };
}

/** Only elapsed time determines every route, including a direct skip and backward seek. */
export function ladderFrame(timeline: LadderTimeline, elapsed: number, targetLane = 0): LadderFrame {
  const time = clamp(Number.isFinite(elapsed) ? elapsed : 0, 0, timeline.duration);
  if (timeline.laneCount && (!Number.isInteger(targetLane) || targetLane < 0 || targetLane >= timeline.laneCount)) throw new RangeError('Select an existing destination');
  const activeEvents = timeline.events.filter(event => time >= event.setup && time < event.end).map(event => activeEvent(event, time));
  const actors = timeline.ids.map(id => {
    const path = timeline.paths[id], arrived = time >= path.arrivalAt;
    const base: LadderActorFrame = { id, index: path.index, lane: path.startLane, height: 0, rungProgress: 0, pose: 'idle', phase: 0, tilt: 0, arrived, winner: false };
    if (arrived) return { ...base, lane: path.doorLane, height: 1, rungProgress: LADDER_RUNGS, pose: path.doorLane === targetLane ? 'win' as const : 'arrived' as const, doorLane: path.doorLane, winner: path.doorLane === targetLane, supportRow: LADDER_RUNGS, gripLane: path.doorLane, gripRow: LADDER_RUNGS };
    const segment = path.segments.find(part => time >= part.start && time < part.end);
    if (!segment) return base;
    if (segment.kind === 'roof') {
      const phase = clamp((time - segment.start) / (segment.end - segment.start), 0, 1);
      return { ...base, lane: segment.fromLane + (segment.toLane - segment.fromLane) * smooth(phase), height: 1, rungProgress: LADDER_RUNGS, pose: 'run' as const, phase, fromLane: segment.fromLane, toLane: segment.toLane, fromRow: LADDER_RUNGS, toRow: LADDER_RUNGS, supportRow: LADDER_RUNGS };
    }
    if (segment.kind === 'bridge' || segment.kind === 'event') {
      const transfer = transferFrame(timeline, segment, time);
      return { ...base, lane: transfer.lane, height: transfer.row / LADDER_RUNGS, rungProgress: transfer.row, pose: transfer.pose, phase: transfer.phase, fromLane: segment.fromLane, toLane: segment.toLane, fromRow: segment.fromRow, toRow: segment.toRow, bridgeId: segment.bridgeId, eventId: segment.eventId, eventStage: transfer.stage, supportRow: transfer.gripRow, gripLane: transfer.gripLane, gripRow: transfer.gripRow, catchRow: transfer.catchRow, fallDepth: Math.max(0, segment.fromRow - transfer.row), tilt: transfer.tilt, motionType: transfer.type, motionPhase: transfer.phase, actionProgress: transfer.actionProgress, transferStage: transfer.transferStage, transferProgress: transfer.progress, transferRole: transfer.role, landingRow: transfer.landingRow, pivotLane: transfer.pivotLane, pivotRow: transfer.pivotRow, depthOffset: transfer.depthOffset, interaction: transfer.interaction };
    }
    const phase = clamp((time - segment.start) / (segment.end - segment.start), 0, 1);
    // Each hand-over-hand stroke gathers speed, then briefly carries the body's
    // weight. The positive derivative keeps even the planted part moving upward.
    const cycles = Math.max(1, Math.round((segment.toRow - segment.fromRow) / 1.5));
    const offset = path.index * .71, angle = cycles * Math.PI * 2;
    const pulse = (Math.sin(angle * phase + offset) - Math.sin(offset)) * .28 / angle;
    const rhythm = phase + .52 * Math.sin((path.index + 1) * 1.6) * phase * (1 - phase) + pulse;
    const row = segment.fromRow + (segment.toRow - segment.fromRow) * rhythm;
    return { ...base, lane: segment.fromLane, height: row / LADDER_RUNGS, rungProgress: row, pose: 'climb' as const, phase, supportRow: Math.min(LADDER_RUNGS, Math.ceil(row) + 2), gripLane: segment.fromLane, gripRow: Math.min(LADDER_RUNGS, Math.ceil(row) + 2) };
  });
  return { elapsed: time, actors, activeEvents, winnerId: actors.find(actor => actor.winner)?.id, complete: actors.every(actor => actor.arrived) };
}
