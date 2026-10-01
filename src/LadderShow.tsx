import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { randomInt, type Candidate } from './election';
import type { SportsStageProps } from './sports';
import { buildLadderTimeline, ladderFrame, ladderActionPhase, LADDER_START_DELAY, type LadderActorFrame, type LadderActiveEvent, type LadderFrame, type LadderTimeline } from './ladderLogic';
import { createLadderGeometry, drawLadderActor, drawLadderConfetti, drawLadderCrossing, drawLadderEvent, drawLadderName, ladderArtActors, type LadderArtEvent, type LadderGeometry } from './game/ladderArt';
import { drawClaimedLadderTreasure, drawLadderAdventure, drawLadderTreasureReveal } from './game/ladderAdventureArt';
import './ladder.css';

export type LadderShowProps = SportsStageProps & { targetLane: number; onTargetChange?: (lane: number) => void; storySeed?: number };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const poseNames = { idle: '준비', climb: '오르는 중', run: '보물로 달려가기', bridge: '옆길 이동', balance: '중심 잡기', drop: '옆줄로 추락', fall: '옆줄로 추락', hang: '한 손으로 버티기', clamber: '몸 끌어올리기', slide: '앉아서 미끄럼', swing: '줄 타고 건너기', launch: '공중 점프', rotate: '회전 발판', ride: '벨트 이동', transfer: '연결다리 건너기', win: '보물 획득', arrived: '상자 도착' };
const deviceNames = { slide: '미끄럼 통로', swing: '줄타기', launch: '공중 점프', drop: '옆줄 추락·붙잡기', pounce: '뛰어들어 던지기', rotate: '회전 발판', conveyor: '이동 벨트', portal: '열리는 연결다리' };
const interactionNames = { approach: '옆줄로 뛰어들기', grip: '상대를 붙잡기', throw: '들어 던지기', flight: '옆줄로 던져짐', catch: '손끝으로 버티기' };
const contactBeats: Partial<Record<LadderActiveEvent['kind'], string>> = { 'loose-rung': '발판이 돌아간다!', trapdoor: '발판이 열렸다!', wind: '바람이 밀어낸다!', pendulum: '추가 다리를 돌린다!', spring: '발판을 눌렀다!', bird: '새가 문을 열었다!', paint: '페인트가 쏟아졌다!', sticky: '손잡이가 움직인다!', 'rope-tangle': '안전줄을 붙잡았다!', balloon: '풍선이 몸을 띄운다!', 'false-sign': '옆 통로가 열렸다!', bucket: '물이 쏟아졌다!', banana: '발이 미끄러졌다!', zipline: '손잡이를 잡았다!', 'lights-out': '불이 꺼졌다!', 'safety-net': '그물이 튕겨낸다!', 'leap-grapple': '옆줄로 뛰어들어!', 'crumbling-step': '발판이 무너진다!', 'rocket-boots': '부츠가 점화됐다!' };
const standsOnDeck = (actor: LadderActorFrame | undefined) => ['rotate', 'conveyor', 'portal'].includes(actor?.motionType ?? '');
function actorStatus(actor: LadderActorFrame | undefined, preview?: boolean) {
  if (actor?.winner) return '당첨';
  if (actor?.arrived) return `${actor.doorLane! + 1}번 상자`;
  if (preview) return '준비';
  if (actor?.eventStage === 'setup') return '오르는 중';
  if (actor?.eventStage === 'resolve') return standsOnDeck(actor) ? '발 딛고 다시 오르기' : actor.interaction?.role === 'thrower' ? '새 줄에 발 딛기' : '붙잡고 올라가기';
  if (actor?.transferStage === 'catch' && standsOnDeck(actor)) return '새 줄에 두 발 딛기';
  const action = actor?.interaction;
  if (!action) return poseNames[actor?.pose ?? 'idle'];
  if (action.role === 'thrower' && action.stage === 'flight') return '던지고 발 딛기';
  if (action.role === 'thrower' && action.stage === 'catch') return '새 줄에 발 딛기';
  if (action.role === 'victim' && action.stage === 'grip') return '붙잡혀 들리는 중';
  if (action.role === 'victim' && action.stage === 'throw') return '공중에 들림';
  if (action.role === 'victim' && action.stage === 'approach') return '올라가다 상대 발견';
  return interactionNames[action.stage];
}
function storyDetail(story: LadderActiveEvent, actor: LadderActorFrame | undefined, person: Candidate | undefined, partner: Candidate | undefined, catching: boolean) {
  if (story.stage === 'resolve') return story.recoveryText;
  if (story.kind === 'leap-grapple') {
    if (actor?.interaction?.stage === 'grip' && person && partner) return `${person.name}님이 ${partner.name}님을 붙잡았습니다. 발판에서 몸이 들립니다!`;
    if (actor?.interaction?.stage === 'throw' && person && partner) return `${person.name}님이 ${partner.name}님을 반대편 사다리 쪽으로 들어 던집니다!`;
    if (actor?.interaction?.stage === 'flight' && partner) return `${partner.name}님이 옆줄로 떨어집니다. 손잡이를 향해 손을 뻗습니다!`;
  }
  if (catching) return standsOnDeck(actor) ? '새 줄의 받침대에 두 발을 딛었습니다. 다음 손잡이를 잡고 다시 올라갑니다!' : '손끝이 닿았다! 흔들리는 몸을 버티고 발판을 찾아야 합니다.';
  return story.stage === 'setup' ? story.setupText : story.stage === 'action' ? story.actionText : story.recoveryText;
}
function storyAt(event: LadderTimeline['events'][number], elapsed: number): LadderActiveEvent {
  const stage = elapsed < event.action ? 'setup' : elapsed < event.resolve ? 'action' : 'resolve';
  const start = stage === 'setup' ? event.setup : stage === 'action' ? event.action : event.resolve;
  const end = stage === 'setup' ? event.action : stage === 'action' ? event.resolve : event.end;
  const phase = clamp((elapsed - start) / (end - start));
  return { ...event, stage, age: elapsed - event.setup, phase: stage === 'action' ? ladderActionPhase(event.motion.type, phase) : phase };
}
function runningStories(timeline: LadderTimeline | null, elapsed: number): LadderActiveEvent[] {
  return (timeline?.events ?? []).filter(item => elapsed >= item.action && elapsed < item.end)
    .sort((a, b) => a.setup - b.setup).map(event => storyAt(event, elapsed));
}
function currentStory(timeline: LadderTimeline | null, elapsed: number): LadderActiveEvent | undefined {
  const active = runningStories(timeline, elapsed);
  if (active.length) return active[0];
  const previous = timeline?.events.find(item => elapsed >= item.end && elapsed < item.end + 550);
  return previous ? storyAt(previous, elapsed) : undefined;
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
    const actionAt = crossing ? crossing.start + (crossing.end - crossing.start) * .14 : undefined;
    const revealAt = bridge.eventId ? timeline.events.find(event => event.id === bridge.eventId)?.action ?? actionAt : actionAt;
    const event = timeline.events.find(event => event.id === bridge.eventId);
    return { ...bridge, fromLane: event?.fromLane ?? bridge.leftLane, state: (props.preview || !crossing || elapsed < (revealAt ?? crossing.start) ? 'future' : elapsed < crossing.end ? 'active' : 'past') as 'future' | 'active' | 'past' };
  }) ?? [];
  drawLadderAdventure(ctx, geometry, bridges, targetLane, clock, reduced, occupants);
  if (!props.preview && frame?.winnerId) drawLadderTreasureReveal(ctx, geometry, targetLane, clock - (timeline?.paths[frame.winnerId].arrivalAt ?? elapsed), reduced);
  const story = props.preview ? undefined : currentStory(timeline, elapsed);
  const events = props.preview ? [] : runningStories(timeline, elapsed);
  const focused = new Set(events.flatMap(event => event.actors));
  actors.filter(actor => actor.motionType && actor.eventStage !== 'setup').forEach(actor => drawLadderCrossing(ctx, actor, geometry, clock, reduced, actor.id === story?.actorId));
  events.forEach(event => drawLadderEvent(ctx, toArtEvent(event), geometry, clock, reduced, actors.find(actor => actor.id === event.actorId)));
  const ordered = [...actors].sort((a, b) => b.rungProgress - (b.depthOffset ?? 0) - a.rungProgress + (a.depthOffset ?? 0));
  ordered.forEach(actor => drawLadderName(ctx, actor, geometry, focused.has(actor.id), clock, reduced));
  ordered.forEach(actor => drawLadderActor(ctx, actor, geometry, clock, reduced, focused.has(actor.id)));
  const treasureWinner = actors.find(actor => actor.id === frame?.winnerId);
  if (!props.preview && treasureWinner) drawClaimedLadderTreasure(ctx, treasureWinner, geometry, clock, reduced);
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
    return buildLadderTimeline(props.candidates, order, props.duration, props.storySeed ?? seed.current!, props.targetLane);
  }, [ids, orderKey, props.duration, props.preview, props.storySeed, props.targetLane]);
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
  const liveStories = props.preview ? [] : runningStories(timeline, props.elapsed);
  const crossing = frame?.actors.find(actor => actor.id === story?.actorId && actor.motionType && actor.eventStage !== 'setup') ?? frame?.actors.find(actor => actor.motionType && actor.eventStage !== 'setup');
  const spotlight = frame?.actors.find(actor => actor.id === story?.actorId);
  const interaction = spotlight?.interaction, grapple = story?.kind === 'leap-grapple';
  const deckLanding = standsOnDeck(spotlight);
  const storyBeat = !story || props.elapsed >= story.end ? undefined : story.stage === 'setup' || story.stage === 'action' && story.phase < .13 ? 'takeoff' : story.stage === 'resolve' ? 'pull' : interaction?.stage === 'grip' || interaction?.stage === 'throw' || interaction?.stage === 'flight' ? 'grip' : interaction?.stage === 'catch' || spotlight?.transferStage === 'catch' ? 'catch' : 'flight';
  const flightLabel = grapple ? interaction?.stage === 'flight' ? '옆줄로 던져졌다!' : '옆줄로 뛰어들어!' : story?.kind === 'wind' ? '바람에 날려!' : story?.motion.type === 'launch' ? '도약!' : story?.motion.type === 'swing' ? '줄을 타고!' : story?.motion.type === 'drop' ? '손을 뻗어!' : '옆줄로!';
  const beatLabel = storyBeat === 'takeoff' ? (story ? contactBeats[story.kind] : undefined) ?? '발판을 딛고' : storyBeat === 'flight' ? flightLabel : storyBeat === 'grip' ? interaction?.stage === 'flight' ? '옆줄로 던져졌다!' : interaction?.stage === 'throw' ? '들어 던지기!' : '상대를 붙잡았다!' : storyBeat === 'catch' ? deckLanding ? '새 줄에 두 발 딛기' : '손끝으로 버티기' : storyBeat === 'pull' ? deckLanding ? '다시 위로 올라!' : '몸을 끌어올려!' : undefined;
  const partner = props.candidates.find(candidate => candidate.id === story?.partnerId);
  const pastStories = props.preview ? [] : timeline?.events.filter(event => props.elapsed >= event.action).slice(-3) ?? [];
  const roofRunner = !props.preview && timeline?.roofFinish && props.elapsed >= timeline.roofFinish.runStart && props.elapsed < timeline.roofFinish.claimAt ? props.candidates.find(candidate => candidate.id === timeline.roofFinish!.actorId) : undefined;
  const departing = props.elapsed < LADDER_START_DELAY * props.duration / 44_000;
  const title = winner ? `${winner.name} · 황금 보물 획득!` : roofRunner ? `${roofRunner.name} · 옆줄에서 먼저 올라왔다!` : person && story ? `${person.name}${grapple && partner ? ` ↔ ${partner.name}` : ''} · ${story.title}` : props.preview ? '하늘 보물 쟁탈전' : departing ? '구름 위 보물로 출발!' : props.elapsed > 35500 ? '보물상자가 바로 앞!' : '모두 한 칸씩, 위로!';
  const detail = winner ? `${targetLane + 1}번 상자의 황금 보물을 차지한 ${winner.name}님이 당첨됐습니다.` : roofRunner ? `정상에 먼저 발을 딛은 ${roofRunner.name}님이 황금 상자로 달려갑니다! 다른 선수들도 각자의 속도로 계속 올라옵니다.` : story ? storyDetail(story, spotlight, person, partner, storyBeat === 'catch') : props.preview ? '황금 보물 위치를 고르세요. 누가 어떤 길을 갈지는 시작한 뒤에 드러납니다.' : departing ? '손잡이를 움켜쥐고, 구름 위로 올라갑니다.' : props.elapsed > 35500 ? `${targetLane + 1}번 상자에 누가 먼저 닿을까요?` : '서로의 움직임을 살피며 사다리를 오릅니다.';
  const selectDoor = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!props.preview || !props.onTargetChange || !geometryRef.current) return;
    const box = event.currentTarget.getBoundingClientRect(), geometry = geometryRef.current, x = event.clientX - box.left, y = event.clientY - box.top;
    if (y > geometry.top + 10 || x > geometry.width) return;
    let lane = Math.round((x - geometry.left) / geometry.laneGap); lane = clamp(lane, 0, geometry.laneCount - 1);
    if (Math.abs(x - geometry.laneX(lane)) <= geometry.laneGap * .48) props.onTargetChange(lane);
  };
  return <section className={`ladder-show${props.preview ? ' ladder-preview' : ''}${props.paused ? ' ladder-paused' : ''}`} aria-label="사다리 오르기 · 하늘 보물 쟁탈전" style={{ '--ladder-count': Math.max(1, props.candidates.length), '--ladder-columns': Math.min(5, Math.max(1, props.candidates.length)), '--ladder-rows': Math.ceil(Math.max(1, props.candidates.length) / 5) } as CSSProperties}>
    <div className="ladder-stage">
      <header className="ladder-stage-header"><span><i /> SKY CLIMB</span><strong>황금 보물 <b>{targetLane + 1}</b></strong><span className={storyBeat ? `ladder-beat ladder-beat-${storyBeat}` : undefined}>{props.preview ? '보물을 골라요' : frame?.complete ? '쟁탈전 종료' : beatLabel ?? '구름 위 쟁탈전'}</span></header>
      <div className="ladder-canvas-wrap"><canvas ref={canvas} className="ladder-canvas" onClick={selectDoor} aria-label={winner ? `${winner.name} 황금 보물 당첨` : `${Math.max(2, props.candidates.length)}개의 사다리와 ${targetLane + 1}번 황금 보물상자`} />{props.paused && <span className="ladder-pause-label">잠시 멈춤</span>}{winner && !props.preview && <div className="ladder-award" key={winner.id} role="status"><span className="ladder-award-gem" aria-hidden="true" /><small>황금 보물의 주인</small><strong>{winner.name}</strong><span>{targetLane + 1}번 보물상자 획득 · 당첨!</span></div>}</div>
      <div className={`ladder-story${winner ? ' ladder-story-result' : ''}${storyBeat ? ` ladder-story-${storyBeat}` : ''}`} style={story && !winner ? { '--ladder-story-progress': `${clamp((props.elapsed - story.setup) / (story.end - story.setup)) * 100}%` } as CSSProperties : undefined} aria-live="off">
        {story && !winner && <div className="ladder-action-meter" aria-hidden="true"><span /></div>}
        <div className="ladder-story-top"><span>{winner ? '보물 획득 확인' : story ? `사다리 ${story.fromLane + 1} → ${story.toLane + 1} · 현장 중계${liveStories.length > 1 ? ` · ${liveStories.length}곳에서 사건 진행` : ''}` : props.preview ? '구름 위 보물을 향해' : 'LIVE CLIMB'}</span>{story && !winner && <span className="ladder-story-beat">{story.stage === 'resolve' ? '착지 중!' : '지금!'}</span>}</div>
        <strong>{title}</strong><p>{detail}</p>
      </div>
    </div>
    <aside className="ladder-board" aria-label="참가자 현황">
      <header><span>LIVE CREW</span><h2>{winner ? '당첨 확인' : '참가자 현황'}</h2></header>
      <div className="ladder-roster" role="list">{props.candidates.map((candidate, index) => {
        const actor = frame?.actors.find(item => item.id === candidate.id), active = liveStories.some(event => event.actors.includes(candidate.id));
        const state = actorStatus(actor, props.preview);
        return <div key={candidate.id} className={`ladder-person${active ? ' is-story' : ''}${actor?.winner ? ' is-lucky' : ''}${actor?.arrived && !actor.winner ? ' is-arrived' : ''}`} role="listitem" style={{ '--person-color': candidate.color } as CSSProperties} title={`${candidate.name} · ${state}`}>
          <span className="ladder-person-icon">{actor?.winner ? '★' : String(index + 1).padStart(2, '0')}</span><span className="ladder-person-name">{candidate.name}</span><span className="ladder-person-status">{state}</span>
          <span className="ladder-person-floor">{props.preview ? '준비 중' : actor?.arrived ? '보물 발판 도착' : `${Math.max(0, Math.floor((actor?.height ?? 0) * 6))}단 · 사다리 ${Math.round(actor?.lane ?? index) + 1}`}</span>
        </div>;
      })}{!props.candidates.length && <p className="ladder-empty">참가자를 입력해 주세요<br /><small>2~10명이 함께 올라갑니다</small></p>}</div>
      {!props.preview && <div className="ladder-history" aria-label="횡단 현황과 지나온 사건">
        <header>지금 이 길</header>
        <div className="ladder-live-route"><strong>{crossing ? props.candidates[crossing.index]?.name : frame?.complete ? '쟁탈전 종료' : winner ? '보물 주인 확인' : '사다리를 오르는 중'}</strong><span>{crossing ? `${crossing.fromLane! + 1}번 사다리 → ${crossing.toLane! + 1}번 사다리` : frame?.complete ? '모두 보물 발판에 도착했습니다' : winner ? '남은 참가자도 도착하고 있어요' : '손잡이를 딛고 보물을 향해 갑니다'}</span>{crossing?.motionType && <small>{deviceNames[crossing.motionType]}</small>}</div>
        {!!pastStories.length && <ol>{pastStories.map(event => <li key={event.id}><span>{props.elapsed >= event.end ? '착지 완료' : '진행 중'}</span><strong>{props.candidates.find(candidate => candidate.id === event.actorId)?.name}</strong><p>{event.title}</p><small>{event.fromLane + 1}번 → {event.toLane + 1}번 사다리</small></li>)}</ol>}
      </div>}
    </aside>
  </section>;
}
