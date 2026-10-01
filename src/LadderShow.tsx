import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { randomInt } from './election';
import type { SportsStageProps } from './sports';
import { buildLadderTimeline, ladderFrame, type LadderActiveEvent, type LadderFrame, type LadderTimeline } from './ladderLogic';
import { createLadderGeometry, drawLadderActor, drawLadderConfetti, drawLadderCrossing, drawLadderEvent, drawLadderName, drawLadderScenery, ladderArtActors, type LadderArtEvent, type LadderGeometry } from './game/ladderArt';
import './ladder.css';

export type LadderShowProps = SportsStageProps & { targetLane: number; onTargetChange?: (lane: number) => void; storySeed?: number };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const poseNames = { idle: '준비', climb: '오르는 중', bridge: '옆길 이동', balance: '중심 잡기', drop: '옆줄로 추락', fall: '옆줄로 추락', hang: '한 손으로 버티기', clamber: '몸 끌어올리기', slide: '앉아서 미끄럼', swing: '줄 타고 건너기', launch: '공중 점프', rotate: '회전 발판', ride: '벨트 이동', transfer: '이동실 탑승', win: '당첨', arrived: '문 입장' };
const deviceNames = { slide: '미끄럼 통로', swing: '줄 스윙', launch: '공중 점프', drop: '옆줄 추락·붙잡기', rotate: '회전 발판', conveyor: '이동 벨트', portal: '이동실' };
function currentStory(timeline: LadderTimeline | null, elapsed: number): LadderActiveEvent | undefined {
  if (!timeline) return;
  const event = timeline.events.find(item => elapsed >= item.setup && elapsed < item.end + 550);
  if (!event) return;
  const stage = elapsed < event.action ? 'setup' : elapsed < event.resolve ? 'action' : 'resolve';
  const start = stage === 'setup' ? event.setup : stage === 'action' ? event.action : event.resolve;
  const end = stage === 'setup' ? event.action : stage === 'action' ? event.resolve : event.end;
  return { ...event, stage, age: elapsed - event.setup, phase: clamp((elapsed - start) / (end - start)) };
}
function toArtEvent(event: LadderActiveEvent): LadderArtEvent {
  return { id: event.id, kind: event.kind, actorId: event.actorId, row: event.row, lane: event.fromLane, toLane: event.toLane, fromRow: event.fromRow, landingRow: event.landingRow, motionType: event.motion.type, pivotLane: event.pivotLane, pivotRow: event.pivotRow, phase: event.phase, stage: event.stage === 'resolve' ? 'recovery' : event.stage };
}
function pixelText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, maxWidth: number) {
  ctx.font = `800 ${size}px "Malgun Gothic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y, maxWidth);
}
function render(ctx: CanvasRenderingContext2D, props: LadderShowProps, timeline: LadderTimeline | null, elapsed: number, width: number, height: number, reduced: boolean, visualClock: number): LadderGeometry {
  const laneCount = props.candidates.length < 2 ? 2 : props.candidates.length, targetLane = clamp(props.targetLane, 0, laneCount - 1);
  const geometry = createLadderGeometry(width, height, laneCount);
  ctx.fillStyle = '#1a3343'; ctx.fillRect(0, 0, width, height);
  const frame: LadderFrame | undefined = timeline ? ladderFrame(timeline, props.preview ? 0 : elapsed, targetLane) : undefined;
  const clock = reduced ? 0 : visualClock;
  const actors = timeline && frame ? ladderArtActors(timeline, frame, props.candidates, elapsed, geometry, reduced, time => ladderFrame(timeline, time, targetLane)) : [];
  const occupants = new Set((frame?.actors ?? []).filter(actor => actor.arrived).map(actor => actor.doorLane!));
  const bridges = timeline?.bridges.map(bridge => {
    const crossing = timeline.paths[bridge.actorIds[0]].segments.find(segment => segment.bridgeId === bridge.id);
    return { ...bridge, state: (props.preview || !crossing || elapsed < crossing.start - 600 ? 'future' : elapsed < crossing.end ? 'active' : 'past') as 'future' | 'active' | 'past' };
  }) ?? [];
  drawLadderScenery(ctx, geometry, bridges, targetLane, clock, reduced, occupants, props.preview);
  const story = props.preview ? undefined : currentStory(timeline, elapsed);
  actors.filter(actor => actor.motionType).forEach(actor => drawLadderCrossing(ctx, actor, geometry, clock, reduced, actor.id === story?.actorId));
  if (story) drawLadderEvent(ctx, toArtEvent(story), geometry, clock, reduced, actors.find(actor => actor.id === story.actorId));
  const ordered = [...actors].sort((a, b) => b.rungProgress - (b.depthOffset ?? 0) - a.rungProgress + (a.depthOffset ?? 0));
  ordered.forEach(actor => drawLadderName(ctx, actor, geometry, actor.id === story?.actorId, clock, reduced));
  ordered.forEach(actor => drawLadderActor(ctx, actor, geometry, clock, reduced, actor.id === story?.actorId));
  ctx.globalAlpha = 1;
  if (!props.preview && frame?.winnerId) drawLadderConfetti(ctx, geometry, clock - (timeline?.paths[frame.winnerId].arrivalAt ?? elapsed), reduced);
  if (props.candidates.length < 2) {
    const text = props.candidates.length ? '두 번째 참가자를 기다리고 있어요' : '참가자를 입력하면 도전이 시작돼요';
    ctx.fillStyle = '#112b3dde'; ctx.fillRect(geometry.width * .13, geometry.height * .49, geometry.width * .74, 25);
    pixelText(ctx, text, geometry.width / 2, geometry.height * .49 + 13, clamp(geometry.width / 29, 8, 14), '#e1ddc6', geometry.width * .7);
  }
  return geometry;
}

export default function LadderShow(props: LadderShowProps) {
  const ids = props.candidates.map(candidate => candidate.id).join(','), orderKey = props.order.join(',');
  const seed = useRef<number | null>(null); if (seed.current === null) seed.current = randomInt(0x7fffffff);
  const timeline = useMemo(() => {
    if (props.candidates.length < 2) return null;
    const valid = [...new Set(props.order)].filter(id => props.candidates.some(candidate => candidate.id === id));
    const order = props.preview ? props.candidates.map(candidate => candidate.id) : [...valid, ...props.candidates.map(candidate => candidate.id).filter(id => !valid.includes(id))];
    return buildLadderTimeline(props.candidates, order, props.duration, props.storySeed ?? seed.current!);
  }, [ids, orderKey, props.duration, props.preview, props.storySeed]);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canvas = useRef<HTMLCanvasElement>(null), geometryRef = useRef<LadderGeometry | null>(null), sampledAt = useRef(0);
  const latest = useRef({ props, timeline, reduced }); latest.current = { props, timeline, reduced };
  useLayoutEffect(() => { sampledAt.current = performance.now(); }, [props.elapsed, props.paused, props.preview]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'), changed = () => setReduced(media.matches);
    media.addEventListener('change', changed); return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d'); if (!element || !ctx) return;
    let request = 0, previous = 0, visualClock = 0;
    const draw = (now: number) => {
      const current = latest.current, state = current.props, box = element.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      const delta = previous ? Math.min(50, Math.max(0, now - previous)) : 0; previous = now;
      const width = Math.max(1, Math.round(box.width * ratio)), height = Math.max(1, Math.round(box.height * ratio));
      if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false;
      const interpolation = state.paused || state.preview || current.reduced || state.elapsed >= state.duration ? 0 : Math.min(80, Math.max(0, now - sampledAt.current));
      const elapsed = state.preview ? 0 : clamp(state.elapsed + interpolation, 0, state.duration);
      if (elapsed < state.duration || state.preview) visualClock = elapsed;
      else { visualClock = Math.max(state.duration, visualClock); if (!state.paused && !current.reduced) visualClock += delta; }
      geometryRef.current = render(ctx, state, current.timeline, elapsed, box.width, box.height, current.reduced, visualClock);
      request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw); return () => cancelAnimationFrame(request);
  }, []);
  const targetLane = clamp(props.targetLane, 0, Math.max(2, props.candidates.length) - 1);
  const frame = timeline ? ladderFrame(timeline, props.preview ? 0 : props.elapsed, targetLane) : undefined;
  const story = props.preview ? undefined : currentStory(timeline, props.elapsed), person = props.candidates.find(candidate => candidate.id === story?.actorId), winner = props.candidates.find(candidate => candidate.id === frame?.winnerId);
  const crossing = frame?.actors.find(actor => actor.id === story?.actorId && actor.motionType) ?? frame?.actors.find(actor => actor.motionType && actor.eventStage === 'action') ?? frame?.actors.find(actor => actor.motionType);
  const pastStories = props.preview ? [] : timeline?.events.filter(event => props.elapsed >= event.setup).slice(-3) ?? [];
  const title = winner ? `${winner.name} · ${targetLane + 1}번 문에 입장!` : person && story ? `${person.name} · ${story.title}` : props.preview ? '마천루 사다리 · 옥상 행운문' : props.elapsed < 3000 ? '안전모 확인 · 곧 올라갑니다' : props.elapsed > 35500 ? '옥상 난간 · 마지막 손잡이' : '옆길을 만나면 길이 바뀝니다';
  const detail = winner ? `선택한 ${targetLane + 1}번 행운문에 들어온 ${winner.name}님이 당첨됐습니다.` : story ? story.stage === 'setup' ? story.setupText : story.stage === 'action' ? story.actionText : story.recoveryText : props.preview ? '위쪽 문을 고르세요. 줄을 타고 뛰어 건너가 그 문에 들어온 사람이 당첨됩니다.' : props.elapsed < 3000 ? '발판을 단단히 잡고, 아래에서부터 함께 시작합니다.' : props.elapsed > 35500 ? `${targetLane + 1}번 행운문에는 누가 들어올까요? 문을 열 때까지 지켜보세요.` : '누군가는 줄을 타고, 누군가는 뛰어 건너갑니다. 손을 놓쳐도 옆줄을 잡고 다시 올라갑니다.';
  const selectDoor = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!props.preview || !props.onTargetChange || !geometryRef.current) return;
    const box = event.currentTarget.getBoundingClientRect(), geometry = geometryRef.current, x = event.clientX - box.left, y = event.clientY - box.top;
    if (y > geometry.top + 10 || x > geometry.width) return;
    let lane = Math.round((x - geometry.left) / geometry.laneGap); lane = clamp(lane, 0, geometry.laneCount - 1);
    if (Math.abs(x - geometry.laneX(lane)) <= geometry.laneGap * .48) props.onTargetChange(lane);
  };
  return <section className={`ladder-show${props.preview ? ' ladder-preview' : ''}${props.paused ? ' ladder-paused' : ''}`} aria-label="사다리 오르기 · 옥상 행운문" style={{ '--ladder-count': Math.max(1, props.candidates.length), '--ladder-columns': Math.min(5, Math.max(1, props.candidates.length)), '--ladder-rows': Math.ceil(Math.max(1, props.candidates.length) / 5) } as CSSProperties}>
    <div className="ladder-stage">
      <header className="ladder-stage-header"><span><i /> SKY LADDER</span><strong>선택한 행운문 <b>{targetLane + 1}</b></strong><span>{props.preview ? '문을 골라요' : frame?.complete ? '도전 완료' : '전체 코스'}</span></header>
      <div className="ladder-canvas-wrap"><canvas ref={canvas} className="ladder-canvas" onClick={selectDoor} aria-label={winner ? `${winner.name} 당첨` : `${Math.max(2, props.candidates.length)}개의 사다리와 ${targetLane + 1}번 선택 문`} />{props.paused && <span className="ladder-pause-label">잠시 멈춤</span>}</div>
      <div className={`ladder-story${winner ? ' ladder-story-result' : ''}`} aria-live={winner ? 'polite' : 'off'}>
        <div className="ladder-story-top"><span>{winner ? '행운문 입장 확인' : story ? `사다리 ${story.fromLane + 1} → ${story.toLane + 1} · 현장 중계` : props.preview ? '옥상에서 만나요' : 'LIVE CLIMB'}</span>{story && !winner && <ol aria-label="사건 단계">{(['setup', 'action', 'resolve'] as const).map((stage, index) => <li key={stage} className={story.stage === stage ? 'is-current' : ''}>{['손잡이 확인', story.motion.type === 'launch' ? '공중 점프' : story.motion.type === 'swing' ? '줄 스윙' : story.motion.type === 'drop' ? '옆줄 추락' : '옆줄 이동', '붙잡기·착지'][index]}</li>)}</ol>}</div>
        <strong>{title}</strong><p>{detail}</p>
      </div>
    </div>
    <aside className="ladder-board" aria-label="참가자 현황">
      <header><span>LIVE CREW</span><h2>{winner ? '당첨 확인' : '참가자 현황'}</h2></header>
      <div className="ladder-roster" role="list">{props.candidates.map((candidate, index) => {
        const actor = frame?.actors.find(item => item.id === candidate.id), active = story?.actors.includes(candidate.id);
        const state = actor?.winner ? '당첨' : actor?.arrived ? `${actor.doorLane! + 1}번 입장` : actor?.eventStage === 'setup' ? '손잡이 확인' : actor?.eventStage === 'resolve' ? '붙잡고 올라가기' : props.preview ? '준비' : poseNames[actor?.pose ?? 'idle'];
        return <div key={candidate.id} className={`ladder-person${active ? ' is-story' : ''}${actor?.winner ? ' is-lucky' : ''}${actor?.arrived && !actor.winner ? ' is-arrived' : ''}`} role="listitem" style={{ '--person-color': candidate.color } as CSSProperties} title={`${candidate.name} · ${state}`}>
          <span className="ladder-person-icon">{actor?.winner ? '★' : String(index + 1).padStart(2, '0')}</span><span className="ladder-person-name">{candidate.name}</span><span className="ladder-person-status">{state}</span>
          <span className="ladder-person-floor">{props.preview ? '출발 준비' : actor?.arrived ? '옥상 도착' : `${Math.max(0, Math.floor((actor?.height ?? 0) * 6))}층 · 사다리 ${Math.round(actor?.lane ?? index) + 1}`}</span>
        </div>;
      })}{!props.candidates.length && <p className="ladder-empty">참가자를 입력해 주세요<br /><small>2~10명이 함께 올라갑니다</small></p>}</div>
      {!props.preview && <div className="ladder-history" aria-label="횡단 현황과 지나온 사건">
        <header>지금 이 길</header>
        <div className="ladder-live-route"><strong>{crossing ? props.candidates[crossing.index]?.name : frame?.complete ? '도전 완료' : winner ? '옥상 도착 확인' : '다음 장치를 향해'}</strong><span>{crossing ? `${crossing.fromLane! + 1}번 사다리 → ${crossing.toLane! + 1}번 사다리` : frame?.complete ? '모든 참가자가 도착했습니다' : winner ? '남은 참가자도 도착하고 있어요' : '각자의 손잡이를 딛고 올라갑니다'}</span>{crossing?.motionType && <small>{deviceNames[crossing.motionType]}</small>}</div>
        {!!pastStories.length && <ol>{pastStories.map(event => <li key={event.id}><span>{props.elapsed >= event.end ? '착지 완료' : '진행 중'}</span><strong>{props.candidates.find(candidate => candidate.id === event.actorId)?.name}</strong><p>{event.title}</p><small>{event.fromLane + 1}번 → {event.toLane + 1}번 사다리</small></li>)}</ol>}
      </div>}
    </aside>
  </section>;
}
