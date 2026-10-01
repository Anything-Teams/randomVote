import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { randomInt } from './election';
import type { SportsStageProps } from './sports';
import { activeRacingIncident, buildRacingTimeline, createRacingIncidents, racingIncidentStatus, racingLaneShift, racingStandings, readRacingTravel, RACING_STORIES, type RacingTimeline, type RacingStanding } from './racingNarrative';
import { drawRaceDust, drawRaceHorse, drawRaceStadium, raceBox, raceLabel } from './racingArt';
import { drawRacingCourse, drawRacingStartingGate, drawRacingTopView } from './racingCourse';
import { createRacingCamera, placeRacingField, racingFocusIds, type RacingCamera } from './racingCamera';
import { drawRacingIncidentEffects, racingIncidentMotion } from './racingEffects';
import './racing.css';

type RacePhase = 'preview' | 'paddock' | 'countdown' | 'race' | 'straight' | 'photo' | 'winner';
type RaceView = { phase: RacePhase; standings: RacingStanding[]; headline: string; detail: string; focusId?: string; progress: number; speed: number; badge: string };
type RaceScene = { camera: RacingCamera; elapsed: number | null };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
function phaseAt(elapsed: number, duration: number, preview: boolean): RacePhase {
  if (preview) return 'preview';
  if (elapsed < 3000) return 'paddock';
  if (elapsed < 5500) return 'countdown';
  if (elapsed < 5500 + (duration - 10_500) * 26_500 / 33_500) return 'race';
  if (elapsed < duration - 5000) return 'straight';
  if (elapsed < duration - 2600) return 'photo';
  return 'winner';
}
function displayedIncident(timeline: RacingTimeline, elapsed: number) {
  return activeRacingIncident(timeline, elapsed) ?? timeline.incidents.find(incident => elapsed >= incident.end && elapsed < incident.end + 1600);
}
function viewAt(props: SportsStageProps, timeline: RacingTimeline, elapsed: number): RaceView {
  const phase = phaseAt(elapsed, props.duration, props.preview), standings = racingStandings(timeline, elapsed);
  const leader = props.candidates.find(candidate => candidate.id === standings[0]?.id), incident = phase === 'race' ? displayedIncident(timeline, elapsed) : undefined;
  const template = RACING_STORIES.find(story => story.kind === incident?.kind), actor = props.candidates.find(candidate => candidate.id === incident?.actorId);
  const names: Record<RacePhase, [string, string, string]> = {
    preview: ['출발선에 모이는 경주마', '번호와 기수의 색으로 내 말을 따라가세요. 모두 같은 출발선에서 한 바퀴를 달립니다.', 'STARTING GATE'],
    paddock: ['출발선 · 마지막 준비', '말들이 같은 출발선의 게이트에 입장합니다. 기수가 고삐와 등자를 확인합니다.', 'GATE LOADING'],
    countdown: ['게이트 오픈 직전', '나란히 준비했습니다. 문이 열리면 한꺼번에 출발합니다.', 'STARTING GATE'],
    race: [(leader?.name ?? '') + ' · 현재 선두', '현장 중계로 선두와 추격마의 실제 간격을 보세요. 우측 상단 지도에서 전체 위치를 확인할 수 있습니다.', 'LIVE RACE'],
    straight: ['마지막 직선 · 끝까지 추격', '선두 세 말이 같은 화면에서 달립니다. 코끝이 결승선을 지나는 순간까지 순위가 바뀝니다.', 'FINAL STRAIGHT'],
    photo: ['결승선 통과 · 사진 판정', '말들이 도착 순서대로 결승선을 통과합니다. 통과한 말도 앞으로 달리며 속도를 줄입니다.', 'PHOTO FINISH'],
    winner: [(leader?.name ?? '오늘의 말') + ' · 우승 확정', '전원 한 바퀴 완주. 말은 천천히 멈추고 기수가 한 손을 들어 인사합니다.', 'WINNER’S CIRCLE'],
  };
  let [headline, detail, badge] = names[phase];
  if (incident && template && actor) {
    const status = racingIncidentStatus(timeline, incident, elapsed);
    const next = props.candidates.find(candidate => candidate.id === status.nextRivalId);
    const crossed = status.overtakenIds.length ? status.overtakenIds : status.passedByIds;
    const last = props.candidates.find(candidate => candidate.id === crossed.at(-1));
    headline = actor.name + ' · ' + template.title;
    detail = status.stage === 'outcome'
      ? status.beforeRank + '위 → 현재 ' + status.currentRank + '위. ' + (last ? last.name + (status.overtakenIds.length ? ' 앞에 나섰습니다.' : '의 뒤에서 다시 리듬을 찾습니다.') : template.outcome)
      : '현재 ' + status.currentRank + '위 · ' + (next ? next.name + '와 경합. ' : last ? last.name + '를 지나 앞으로. ' : '') + template[status.stage];
    badge = status.stage === 'setup' ? '추월 준비 · 앞말을 함께 포착' : status.stage === 'action' ? '실제 추월 중계' : '추월 결과';
  }
  const pace = leader ? (readRacingTravel(timeline, leader.id, elapsed + 100) - readRacingTravel(timeline, leader.id, elapsed)) * 335 : 1;
  return { phase, standings, headline, detail, focusId: incident?.actorId, badge, progress: Math.max(0, ...standings.map(standing => standing.distance)), speed: phase === 'race' || phase === 'straight' ? Math.round(clamp(56 * pace, 35, 72)) : 0 };
}
function horseTag(ctx: CanvasRenderingContext2D, name: string, color: string, x: number, y: number, canvasWidth: number, canvasHeight: number, compact: boolean) {
  const size = compact ? 7 : 9;
  ctx.font = '800 ' + size + 'px "Malgun Gothic", sans-serif';
  const letters = Array.from(name); let label = name;
  while (ctx.measureText(label).width > (compact ? 47 : 88) && letters.length > 2) { letters.pop(); label = letters.join('') + '…'; }
  const width = ctx.measureText(label).width + 9, height = compact ? 10 : 14, top = Math.min(canvasHeight - height - 2, y + 4);
  x = clamp(x, width / 2 + 2, canvasWidth - width / 2 - 2);
  raceBox(ctx, x - width / 2, top, width, height, 2, '#132b3fe6', color);
  raceLabel(ctx, label, x, top + height / 2, size, '#fff0ce', true);
}
function sideView(ctx: CanvasRenderingContext2D, w: number, h: number, props: SportsStageProps, timeline: RacingTimeline, elapsed: number, clock: number, reduced: boolean, scene: RaceScene, delta: number, reset: boolean) {
  const phase = phaseAt(elapsed, props.duration, props.preview), standings = racingStandings(timeline, elapsed);
  const incident = phase === 'race' ? displayedIncident(timeline, elapsed) : undefined;
  drawRaceStadium(ctx, w, h, clock, reduced, true, false);
  const placements = placeRacingField(scene.camera, props.candidates, timeline, elapsed, w, h, props.paused || reduced ? 0 : delta, reset || reduced);
  // Distance follows the nose; individual sprite scales must not change the finish crossing.
  const locations = placements.map(item => ({ ...item, x: item.x - 57 * item.scale, y: item.y + racingLaneShift(incident, item.id, elapsed) * h * .035 })).sort((a, b) => a.y - b.y);
  if (phase === 'straight' || phase === 'photo') {
    const finishX = w * .5 + (1 - scene.camera.center) / scene.camera.span * w * .65;
    for (let stripe = h * .42; stripe < h; stripe += 8) for (let column = 0; column < 2; column++) { ctx.fillStyle = (Math.floor(stripe / 8) + column) % 2 ? '#142333' : '#eee4c9'; ctx.fillRect(finishX + column * 5, stripe, 5, 8); }
    ctx.strokeStyle = '#dfd9be'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(finishX, h * .13); ctx.lineTo(finishX, h * .42); ctx.stroke();
    if (phase === 'photo') raceLabel(ctx, 'FINISH · 실제 통과 순서', 14, h * .37, clamp(w / 65, 8, 13), '#f2ddb0');
  }
  drawRacingIncidentEffects(ctx, incident, locations, elapsed, reduced, 'ground');
  locations.forEach(item => {
    const candidate = props.candidates[item.index], before = readRacingTravel(timeline, item.id, elapsed - 100), effort = clamp((item.distance - before) * 335, .45, 1.35);
    drawRaceDust(ctx, item.index, item.x, item.y, item.scale, clock, reduced, effort);
    const standing = standings.find(standing => standing.id === item.id);
    const velocityRatio = standing?.finished ? Math.exp(-(elapsed - standing.finishTime) / 1100) : 1;
    // Invert the renderer's easing so stride shrinks with the continuous run-out velocity.
    const settle = .5 - Math.sin(Math.asin(2 * velocityRatio - 1) / 3);
    drawRaceHorse(ctx, candidate, item.index, item.x, item.y, item.scale, clock, effort, reduced, false, 0, { settle, ...racingIncidentMotion(incident, item.id, elapsed, reduced) });
  });
  drawRacingIncidentEffects(ctx, incident, locations, elapsed, reduced, 'air');
  // Fixed ground labels stay readable when another horse passes through the same screen space.
  locations.forEach(item => horseTag(ctx, props.candidates[item.index].name, props.candidates[item.index].color, item.x, item.y, w, h, w < 520 || h < 250));
  // The corner map preserves the full field while the main camera follows the race.
  const mw = Math.min(180, w * .25), mh = Math.min(104, h * .23);
  ctx.save(); ctx.translate(w - mw - 9, 9); drawRacingCourse(ctx, mw, mh, clock, reduced); drawRacingTopView(ctx, mw, mh, props.candidates, standings, clock, reduced, racingFocusIds(timeline, elapsed)); ctx.restore();
}
function render(ctx: CanvasRenderingContext2D, w: number, h: number, props: SportsStageProps, timeline: RacingTimeline, elapsed: number, clock: number, reduced: boolean, scene: RaceScene, delta: number) {
  const phase = phaseAt(elapsed, props.duration, props.preview);
  const reset = scene.elapsed === null || elapsed < scene.elapsed - 150 || elapsed - scene.elapsed > 500;
  scene.elapsed = elapsed;
  if (phase === 'preview' || phase === 'paddock' || phase === 'countdown') {
    drawRacingStartingGate(ctx, w, h, props.candidates, clock, reduced, elapsed, props.preview);
    if (phase === 'countdown') {
      const digit = Math.max(1, Math.ceil((5500 - elapsed) / 850));
      const boxW = clamp(w * .085, 34, 64), boxH = clamp(h * .13, 30, 52), boxY = h * .79;
      raceBox(ctx, (w - boxW) / 2, boxY, boxW, boxH, 5, '#10243cdd', '#d6bb81'); raceLabel(ctx, String(digit), w / 2, boxY + boxH / 2, clamp(h * .08, 20, 38), '#ffe4aa', true);
    }
    return;
  }
  if (phase === 'winner') {
    const id = timeline.finishOrder[0], winner = props.candidates.find(candidate => candidate.id === id);
    drawRaceStadium(ctx, w, h, clock, reduced, true, false);
    ctx.fillStyle = '#08182acc'; ctx.fillRect(0, 0, w, h);
    if (!winner) return;
    const age = elapsed - (props.duration - 2600), arrival = reduced ? 1 : smooth(age / 1100);
    const scale = clamp(Math.min(w / 310, h / 145), .3, 2.1), y = h * .85, x = w * (.24 + .25 * arrival);
    const spotlight = ctx.createRadialGradient(w * .5, y - 42 * scale, 1, w * .5, y - 42 * scale, w * .5); spotlight.addColorStop(0, '#eccb7b35'); spotlight.addColorStop(1, '#eccb7b00'); ctx.fillStyle = spotlight; ctx.fillRect(0, 0, w, h);
    raceBox(ctx, w * .17, y + 5, w * .66, Math.max(16, h * .1), 4, '#c8aa69', '#f1d99b');
    drawRaceHorse(ctx, winner, props.candidates.indexOf(winner), x, y, scale, clock, arrival < 1 ? .25 : 0, reduced, true, 0, { gait: arrival < 1 ? 'walk' : 'idle', phase: (x - w * .24) / scale / (18 / .62), settle: smooth((age - 1100) / 250), victory: smooth((age - 1100) / 650) });
    raceLabel(ctx, 'WINNER’S CIRCLE', w / 2, h * .13, clamp(w / 44, 9, 23), '#e7d092', true);
    raceLabel(ctx, winner.name, w / 2, y + Math.max(16, h * .1) / 2 + 5, clamp(w * .62 / Math.max(10, winner.name.length), 9, 20), '#283440', true);
    if (!reduced) for (let particle = 0; particle < 35; particle++) { const px = (particle * 79 + Math.sin(clock / 1200 + particle) * 9) % w, py = (clock / (16 + particle % 4) + particle * 37) % h; ctx.fillStyle = [winner.color, '#e7cc8c', '#87b8b5'][particle % 3]; ctx.fillRect(px, py, 3, 2); }
    return;
  }
  sideView(ctx, w, h, props, timeline, elapsed, clock, reduced, scene, delta, reset);
  if (elapsed < 6600) {
    ctx.save(); ctx.globalAlpha = reduced ? 0 : 1 - smooth((elapsed - 5500) / 1100); drawRacingStartingGate(ctx, w, h, props.candidates, clock, reduced, elapsed, false); ctx.restore();
  }
}
export default function RacingShow(props: SportsStageProps) {
  const key = props.duration + ':' + props.order.join('|') + ':' + props.candidates.map(candidate => candidate.id).join('|');
  const timeline = useMemo(() => buildRacingTimeline(props.candidates, props.order, props.duration, createRacingIncidents(props.candidates, props.order, props.duration, randomInt(0x100000000))), [key]);
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef(props), latestTimeline = useRef(timeline), synchronizedAt = useRef(performance.now()), lastPropElapsed = useRef(props.elapsed);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [view, setView] = useState(() => viewAt(props, timeline, props.elapsed));
  useLayoutEffect(() => {
    const jumped = Math.abs(props.elapsed - lastPropElapsed.current) > 950;
    latest.current = props; latestTimeline.current = timeline; synchronizedAt.current = performance.now(); lastPropElapsed.current = props.elapsed;
    if (jumped || props.paused || props.preview) setView(viewAt(props, timeline, props.elapsed));
  }, [props, timeline]);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d'); if (!element || !ctx) return;
    let w = 1, h = 1, ratio = 1, frame = 0, previous = performance.now(), clock = 0, boardAt = -1000, viewKey = '';
    const scene: RaceScene = { camera: createRacingCamera(), elapsed: null };
    const resize = () => { const rect = element.getBoundingClientRect(); w = Math.max(1, rect.width); h = Math.max(1, rect.height); ratio = Math.min(2, window.devicePixelRatio || 1); element.width = Math.round(w * ratio); element.height = Math.round(h * ratio); scene.elapsed = null; };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const animate = (now: number) => {
      const current = latest.current, plan = latestTimeline.current, delta = Math.min(50, Math.max(0, now - previous)); previous = now;
      if (!current.paused && !reducedMotion) clock += delta;
      const elapsed = current.preview || current.paused ? current.elapsed : Math.min(current.duration, current.elapsed + Math.max(0, now - synchronizedAt.current));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h); render(ctx, w, h, current, plan, elapsed, clock, reducedMotion, scene, delta);
      const incident = displayedIncident(plan, elapsed), phase = phaseAt(elapsed, current.duration, current.preview);
      const standings = racingStandings(plan, elapsed);
      const immediateKey = phase + ':' + incident?.start + ':' + standings.map(standing => standing.id).join('|') + ':' + current.candidates.map(candidate => candidate.name).join('|');
      if (now - boardAt >= 180 || immediateKey !== viewKey) { boardAt = now; viewKey = immediateKey; setView(viewAt(current, plan, elapsed)); }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate); return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [reducedMotion]);
  const rows = props.candidates.length || 1, finished = view.phase === 'winner';
  const style = { '--racing-count': rows, '--racing-compact-count': Math.ceil(rows / 2), '--racing-progress': view.progress * 100 + '%' } as CSSProperties;
  return <div className={'racing-show racing-phase-' + view.phase + (props.preview ? ' racing-preview' : '') + (props.paused ? ' racing-paused' : '')} style={style}>
    <section className="racing-stage" aria-label="경마 경기장">
      <div className="racing-stage-top"><span><i aria-hidden="true" />{props.preview ? 'DERBY NIGHT' : finished ? 'RACE COMPLETE' : 'DERBY LIVE'}</span><span>{view.speed ? view.speed + ' KM/H' : '1,600 M'}</span></div>
      <div className="racing-canvas-wrap"><canvas ref={canvas} className="racing-canvas" role="img" aria-label={view.headline} /><div className="racing-phase-badge">{props.paused ? 'Ⅱ 일시정지' : view.badge}</div></div>
      <div className="racing-commentary" aria-live={finished ? 'polite' : 'off'}><div className="racing-story-kicker">{view.focusId ? 'RACE STORY' : view.phase === 'photo' ? 'FINISH LINE' : 'TRACKSIDE COMMENTARY'}</div><strong>{view.headline}</strong><p title={view.detail}>{view.detail}</p><div className="racing-distance-meter" aria-hidden="true"><span /></div></div>
    </section>
    <aside className="racing-board" aria-label={finished ? '경마 최종 순위' : '경마 실시간 순위'}>
      <div className="racing-board-heading"><span>{props.preview ? 'RACE CARD' : finished ? 'OFFICIAL RESULT' : 'POSITION TRACKER'}</span><h2>{props.preview ? '오늘의 경주마' : finished ? '전원 완주 · 최종 순위' : '실시간 경합'}</h2></div>
      <ol className="racing-standings">
        {props.candidates.map((candidate, index) => {
          const position = Math.max(0, view.standings.findIndex(standing => standing.id === candidate.id)), crossed = view.standings[position]?.finished;
          const rowStyle = { '--racing-rank': position, '--racing-column': position % 2, '--racing-row': Math.floor(position / 2), '--racing-color': candidate.color } as CSSProperties;
          return <li className={'racing-horse-row' + (!props.preview && position === 0 ? ' racing-is-leading' : '') + (candidate.id === view.focusId ? ' racing-is-story' : '')} key={candidate.id} style={rowStyle} aria-label={candidate.name + (!props.preview ? ', ' + (position + 1) + '위' : '')} title={candidate.name}>
            <span className="racing-rank">{props.preview ? '—' : String(position + 1).padStart(2, '0')}</span><span className="racing-silk">{String(index + 1).padStart(2, '0')}</span><span className="racing-horse-name">{candidate.name}</span><span className="racing-horse-state">{finished ? position === 0 ? '★' : '완주' : props.preview ? '출전' : crossed ? '완주' : candidate.id === view.focusId ? '경합' : position === 0 ? '선두' : '추격'}</span>
          </li>;
        })}
        {!props.candidates.length && <li className="racing-empty">이름을 입력하면<br />나만의 경주마가 등장해요.</li>}
      </ol>
      <p className="racing-board-note">말의 번호와 기수 색을 따라가세요 · 한 바퀴 완주</p>
    </aside>
  </div>;
}
