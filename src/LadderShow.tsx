import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { randomInt } from './election';
import type { SportsStageProps } from './sports';
import { buildLadderTimeline, ladderFrame, type LadderActiveEvent, type LadderFrame, type LadderTimeline } from './ladderLogic';
import { createLadderGeometry, drawLadderActor, drawLadderConfetti, drawLadderEvent, drawLadderName, drawLadderScenery, ladderArtActors, sampleLadderRig, type LadderArtActor, type LadderArtEvent, type LadderGeometry } from './game/ladderArt';
import './ladder.css';

export type LadderShowProps = SportsStageProps & { targetLane: number; onTargetChange?: (lane: number) => void };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const poseNames = { idle: '준비', climb: '오르는 중', bridge: '옆길 이동', balance: '중심 잡기', fall: '발 헛디딤', hang: '매달리는 중', clamber: '다시 올라오기', win: '당첨', arrived: '문 입장' };
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
  return { id: event.id, kind: event.kind, actorId: event.actorId, row: event.row, lane: event.fromLane, phase: event.phase, stage: event.stage === 'resolve' ? 'recovery' : event.stage };
}
function pixelText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, maxWidth: number) {
  ctx.font = `800 ${size}px "Malgun Gothic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y, maxWidth);
}
function focusCamera(ctx: CanvasRenderingContext2D, geometry: LadderGeometry, event: LadderActiveEvent | undefined, actor: LadderArtActor | undefined, clock: number, reduced: boolean, targetLane: number, canvasWidth: number) {
  const left = geometry.width + 5, width = canvasWidth - left - 8, height = geometry.height;
  if (width < 90) return;
  ctx.fillStyle = '#162d3cf2'; ctx.fillRect(left, 8, width, height - 16);
  ctx.fillStyle = '#758d8460'; ctx.fillRect(left, 8, width, 1);
  pixelText(ctx, 'ROOFTOP CAM', left + width / 2, 22, 9, '#a4b5b4', width - 10);
  pixelText(ctx, `${targetLane + 1}번 행운문`, left + width / 2, 43, 13, '#f4d487', width - 10);
  const boxY = 61, boxHeight = Math.max(50, Math.min(height - 99, width * 1.1));
  ctx.fillStyle = '#102535'; ctx.fillRect(left + 5, boxY, width - 10, boxHeight);
  if (actor && event) {
    const rig = sampleLadderRig(actor, geometry, clock, reduced);
    const zoom = clamp((width - 25) / Math.max(32, 32 * geometry.scale), 1.4, 3.5);
    ctx.save(); ctx.beginPath(); ctx.rect(left + 6, boxY + 1, width - 12, boxHeight - 2); ctx.clip();
    ctx.translate(left + width / 2, boxY + boxHeight / 2 + 5); ctx.scale(zoom, zoom); ctx.translate(-rig.hip.x, -rig.hip.y + 5 * geometry.scale);
    const laneX = geometry.laneX(actor.lane), rail = 6 * geometry.scale;
    ctx.strokeStyle = '#91aead'; ctx.lineWidth = 1.2 * geometry.scale;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(laneX + rail * side, rig.hip.y - 55 * geometry.scale); ctx.lineTo(laneX + rail * side, rig.hip.y + 48 * geometry.scale); ctx.stroke(); }
    for (let row = Math.max(0, Math.floor(actor.rungProgress) - 5); row <= Math.min(24, Math.ceil(actor.rungProgress) + 7); row += 1 / geometry.subdivisions) {
      ctx.beginPath(); ctx.moveTo(laneX - rail, geometry.rowY(row)); ctx.lineTo(laneX + rail, geometry.rowY(row)); ctx.stroke();
    }
    drawLadderEvent(ctx, toArtEvent(event), geometry, clock, reduced, actor); drawLadderActor(ctx, actor, geometry, clock, reduced, false);
    ctx.restore();
    pixelText(ctx, actor.candidate.name, left + width / 2, boxY + boxHeight + 16, 11, '#f1e6cd', width - 10);
    pixelText(ctx, event.stage === 'setup' ? '위험 감지' : event.stage === 'action' ? '지금 무슨 일이?' : '자세 회복', left + width / 2, boxY + boxHeight + 33, 8, '#a4cbbb', width - 10);
  } else {
    const centerX = left + width / 2, middle = boxY + boxHeight * .54;
    ctx.strokeStyle = '#78949a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(centerX - 11, middle - 25); ctx.lineTo(centerX - 11, middle + 24); ctx.moveTo(centerX + 11, middle - 25); ctx.lineTo(centerX + 11, middle + 24); ctx.stroke();
    for (let rung = -2; rung < 3; rung++) { ctx.beginPath(); ctx.moveTo(centerX - 11, middle + rung * 9); ctx.lineTo(centerX + 11, middle + rung * 9); ctx.stroke(); }
    ctx.fillStyle = '#f3d394'; ctx.fillRect(centerX - 8, middle - 42, 16, 13);
    pixelText(ctx, '선택한 문을 향해', centerX, boxY + boxHeight + 17, 9, '#d7dfd0', width - 10);
    if (height > 210) pixelText(ctx, '길이 바뀌는 순간을 보세요', centerX, boxY + boxHeight + 32, 8, '#93acb0', width - 10);
  }
  if (height > 360) {
    pixelText(ctx, '한 층씩 · 한 번씩', left + width / 2, height - 50, 9, '#c5b989', width - 10);
    pixelText(ctx, '오르기 → 옆길 → 행운문', left + width / 2, height - 34, 8, '#87a5a9', width - 10);
  }
}
function render(ctx: CanvasRenderingContext2D, props: LadderShowProps, timeline: LadderTimeline | null, elapsed: number, width: number, height: number, reduced: boolean, visualClock: number): LadderGeometry {
  const laneCount = props.candidates.length < 2 ? 2 : props.candidates.length, targetLane = clamp(props.targetLane, 0, laneCount - 1);
  const geometry = createLadderGeometry(width > 620 ? width * .76 : width, height, laneCount);
  ctx.fillStyle = '#1a3343'; ctx.fillRect(0, 0, width, height);
  const frame: LadderFrame | undefined = timeline ? ladderFrame(timeline, props.preview ? 0 : elapsed, targetLane) : undefined;
  const clock = reduced ? 0 : visualClock;
  const actors = timeline && frame ? ladderArtActors(timeline, frame, props.candidates, elapsed, geometry, reduced, time => ladderFrame(timeline, time, targetLane)) : [];
  const occupants = new Set((frame?.actors ?? []).filter(actor => actor.arrived).map(actor => actor.doorLane!));
  drawLadderScenery(ctx, geometry, timeline?.bridges ?? [], targetLane, clock, reduced, occupants, props.preview);
  const story = props.preview ? undefined : currentStory(timeline, elapsed);
  if (story) drawLadderEvent(ctx, toArtEvent(story), geometry, clock, reduced, actors.find(actor => actor.id === story.actorId));
  const ordered = [...actors].sort((a, b) => b.rungProgress - a.rungProgress);
  ordered.forEach(actor => drawLadderActor(ctx, actor, geometry, clock, reduced, actor.id === story?.actorId));
  ordered.forEach(actor => drawLadderName(ctx, actor, geometry, actor.id === story?.actorId));
  if (geometry.width < width) focusCamera(ctx, geometry, story, actors.find(actor => actor.id === story?.actorId), clock, reduced, targetLane, width);
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
    return buildLadderTimeline(props.candidates, order, props.duration, seed.current!);
  }, [ids, orderKey, props.duration, props.preview]);
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
  const title = winner ? `${winner.name} · ${targetLane + 1}번 문에 입장!` : person && story ? `${person.name} · ${story.title}` : props.preview ? '마천루 사다리 · 옥상 행운문' : props.elapsed < 3000 ? '안전모 확인 · 곧 올라갑니다' : props.elapsed > 35500 ? '옥상 난간 · 마지막 손잡이' : '옆길을 만나면 길이 바뀝니다';
  const detail = winner ? `선택한 ${targetLane + 1}번 행운문에 들어온 ${winner.name}님이 당첨됐습니다.` : story ? story.stage === 'setup' ? story.setupText : story.stage === 'action' ? story.actionText : story.recoveryText : props.preview ? '위쪽 문을 고르세요. 그 문에 들어온 사람이 당첨됩니다.' : props.elapsed < 3000 ? '발판을 단단히 잡고, 아래에서부터 함께 시작합니다.' : props.elapsed > 35500 ? `${targetLane + 1}번 행운문에는 누가 들어올까요? 문을 열 때까지 지켜보세요.` : '사다리와 옆길을 따라 올라갑니다. 돌발 상황에도 손잡이를 다시 잡습니다.';
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
        <div className="ladder-story-top"><span>{winner ? '행운문 입장 확인' : story ? '돌발 상황 중계' : props.preview ? '옥상에서 만나요' : 'LIVE CLIMB'}</span>{story && !winner && <ol aria-label="사건 단계">{(['setup', 'action', 'resolve'] as const).map((stage, index) => <li key={stage} className={story.stage === stage ? 'is-current' : ''}>{['준비', '발생', '회복'][index]}</li>)}</ol>}</div>
        <strong>{title}</strong><p>{detail}</p>
      </div>
    </div>
    <aside className="ladder-board" aria-label="참가자 현황">
      <header><span>ROOFTOP CREW</span><h2>{winner ? '당첨 확인' : '올라가는 사람들'}</h2><p>{targetLane + 1}번 문에 들어오면 당첨</p></header>
      <div className="ladder-roster" role="list">{props.candidates.map((candidate, index) => {
        const actor = frame?.actors.find(item => item.id === candidate.id), active = story?.actorId === candidate.id;
        const state = actor?.winner ? '당첨' : actor?.arrived ? `${actor.doorLane! + 1}번 입장` : active && story ? story.stage === 'setup' ? '위험 감지' : story.stage === 'action' ? poseNames[actor?.pose ?? 'balance'] : '자세 회복' : props.preview ? '준비' : poseNames[actor?.pose ?? 'idle'];
        return <div key={candidate.id} className={`ladder-person${active ? ' is-story' : ''}${actor?.winner ? ' is-lucky' : ''}${actor?.arrived && !actor.winner ? ' is-arrived' : ''}`} role="listitem" style={{ '--person-color': candidate.color } as CSSProperties} title={`${candidate.name} · ${state}`}>
          <span className="ladder-person-icon">{actor?.winner ? '★' : String(index + 1).padStart(2, '0')}</span><span className="ladder-person-name">{candidate.name}</span><span className="ladder-person-status">{state}</span>
          <span className="ladder-person-floor">{props.preview ? '출발 준비' : actor?.arrived ? '옥상 도착' : `${Math.max(0, Math.floor((actor?.height ?? 0) * 6))}층`}</span>
        </div>;
      })}{!props.candidates.length && <p className="ladder-empty">참가자를 입력해 주세요<br /><small>2~10명이 함께 올라갑니다</small></p>}</div>
      <p className="ladder-board-note">옆길마다 도착 문이 달라집니다.<br />선택한 문을 여는 순간 당첨자를 확인하세요.</p>
    </aside>
  </section>;
}
