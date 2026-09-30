import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { randomInt } from './election';
import type { SportsStageProps } from './sports';
import { activeRacingIncident, buildRacingTimeline, createRacingIncidents, racingIncidentStage, racingLaneShift, readRacingDistance, RACING_STORIES, type RacingTimeline } from './racingNarrative';
import { drawRaceDust, drawRaceHorse, drawRaceStadium, raceBox, raceLabel } from './racingArt';
import './racing.css';

type RacePhase = 'preview' | 'paddock' | 'countdown' | 'race' | 'straight' | 'photo' | 'winner';
type Standing = { id: string; distance: number };
type RaceView = { phase: RacePhase; standings: Standing[]; headline: string; detail: string; focusId?: string; progress: number; speed: number; badge: string };
type RaceCamera = { key: string; ids: string[] };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

function phaseAt(elapsed: number, duration: number, preview: boolean): RacePhase {
  if (preview) return 'preview';
  if (elapsed < 3000) return 'paddock';
  if (elapsed < 5500) return 'countdown';
  if (elapsed < duration - 9000) return 'race';
  if (elapsed < duration - 5000) return 'straight';
  if (elapsed < duration - 2600) return 'photo';
  return 'winner';
}
function finalOrder(props: SportsStageProps) {
  const ids = new Set(props.candidates.map(candidate => candidate.id));
  return [...new Set(props.order.filter(id => ids.has(id))), ...props.candidates.filter(candidate => !props.order.includes(candidate.id)).map(candidate => candidate.id)];
}
function standingsAt(props: SportsStageProps, timeline: RacingTimeline, elapsed: number, phase: RacePhase): Standing[] {
  const values = props.candidates.map(candidate => ({ id: candidate.id, distance: props.preview ? 0 : readRacingDistance(timeline, candidate.id, elapsed) }));
  if (phase === 'winner' || phase === 'photo' || elapsed >= props.duration) return finalOrder(props).map(id => values.find(value => value.id === id)!);
  return values.sort((a, b) => b.distance - a.distance || props.candidates.findIndex(candidate => candidate.id === a.id) - props.candidates.findIndex(candidate => candidate.id === b.id));
}
function displayedIncident(timeline: RacingTimeline, elapsed: number) {
  return activeRacingIncident(timeline, elapsed) ?? timeline.incidents.find(incident => elapsed >= incident.end && elapsed < incident.end + 2000);
}
function viewAt(props: SportsStageProps, timeline: RacingTimeline, elapsed: number): RaceView {
  const phase = phaseAt(elapsed, props.duration, props.preview), standings = standingsAt(props, timeline, elapsed, phase);
  const leader = props.candidates.find(candidate => candidate.id === standings[0]?.id), incident = phase === 'race' ? displayedIncident(timeline, elapsed) : undefined;
  const template = RACING_STORIES.find(story => story.kind === incident?.kind), actor = props.candidates.find(candidate => candidate.id === incident?.actorId);
  const names: Record<RacePhase, [string, string, string]> = {
    preview: ['오늘 밤, 열 마리의 질주', '말의 번호와 기수 색상으로 마지막까지 따라가세요.', '경주마 입장'],
    paddock: ['패독 입장 · 마지막 준비', '안장을 확인합니다. 잠시 후 출발 게이트로 향합니다.', '패독 중계'],
    countdown: ['닫힌 게이트, 높아지는 긴장', '같은 출발선에 섰습니다. 문이 열리면 동시에 달립니다.', 'STARTING GATE'],
    race: [leader?.name + ' · 앞서가는 말', '선두 뒤에서도 순위가 바뀝니다. 코너 안팎의 움직임을 보세요.', elapsed < 18_000 ? 'BACK STRAIGHT' : 'FINAL CORNER'],
    straight: ['마지막 직선 · 끝까지 나란히', '기수가 몸을 낮췄습니다. 남은 힘을 모두 쏟아냅니다.', 'FINAL 200 M'],
    photo: ['사진 판정 · 코끝의 한 순간', '결승선을 통과한 상위 두 말을 확대합니다.', 'PHOTO FINISH'],
    winner: [(leader?.name ?? '오늘의 말') + ' · 우승 확정', '전원 완주. 마지막까지 달린 모든 말에게 박수를!', 'WINNER’S CIRCLE'],
  };
  let [headline, detail, badge] = names[phase];
  if (props.preview) headline = '오늘 밤, ' + (props.candidates.length || '새로운') + '마리의 질주';
  if (incident && template && actor) {
    headline = actor.name + ' · ' + template.title;
    const stage = racingIncidentStage(incident, elapsed), before = incident.beforeOrder.indexOf(actor.id), after = incident.afterOrder.indexOf(actor.id);
    detail = stage === 'outcome' ? (before + 1) + '위 → ' + (after + 1) + '위. ' + template.outcome : template[stage];
    badge = (timeline.incidents.indexOf(incident) + 1) + ' / 3 · ' + (stage === 'setup' ? '경합 포착' : stage === 'action' ? '승부의 움직임' : '순위 변화');
  }
  const trackedId = incident?.actorId ?? leader?.id;
  const pace = trackedId ? (readRacingDistance(timeline, trackedId, elapsed + 100) - readRacingDistance(timeline, trackedId, elapsed)) * 335 : 1;
  return { phase, standings, headline, detail, focusId: incident?.actorId, badge, progress: clamp((elapsed - 5500) / Math.max(1, props.duration - 10500)), speed: phase === 'race' || phase === 'straight' ? Math.round(clamp(56 * pace, 35, 72)) : 0 };
}
function horseTag(ctx: CanvasRenderingContext2D, candidate: SportsStageProps['candidates'][number], index: number, x: number, y: number, scale: number, focused: boolean) {
  const size = clamp(scale * 10, 7, 12), width = size * 2.4, height = size * 1.6;
  raceBox(ctx, x - width / 2, y - 81 * scale, width, height, 3, focused ? '#fae6a5' : '#14263aea', focused ? '#fff1ce' : candidate.color);
  raceLabel(ctx, String(index + 1).padStart(2, '0'), x, y - 81 * scale + height / 2, size, focused ? '#29343b' : '#f4eee0', true);
}
function miniCourse(ctx: CanvasRenderingContext2D, w: number, h: number, props: SportsStageProps, standings: Standing[]) {
  const width = clamp(w * .21, 52, 114), height = clamp(h * .16, 23, 46), compact = h < 150, x = compact ? 8 : w - width - 10, y = compact ? h - height - 8 : 10;
  raceBox(ctx, x, y, width, height, 5, '#0a1d2bba', '#57716c55');
  ctx.strokeStyle = '#b6c5a477'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x + width / 2, y + height / 2, width * .4, height * .34, 0, 0, Math.PI * 2); ctx.stroke();
  props.candidates.forEach((candidate, index) => { const distance = standings.find(standing => standing.id === candidate.id)?.distance ?? 0, angle = Math.PI * .5 - distance * Math.PI * 2; ctx.fillStyle = candidate.color; ctx.beginPath(); ctx.arc(x + width / 2 + Math.cos(angle) * width * .4, y + height / 2 + Math.sin(angle) * height * .34, index === 0 ? 2.2 : 1.7, 0, Math.PI * 2); ctx.fill(); });
}
function render(ctx: CanvasRenderingContext2D, w: number, h: number, props: SportsStageProps, timeline: RacingTimeline, elapsed: number, clock: number, reduced: boolean, camera: RaceCamera) {
  const phase = phaseAt(elapsed, props.duration, props.preview), order = finalOrder(props), standings = standingsAt(props, timeline, elapsed, phase);
  const incident = phase === 'race' ? displayedIncident(timeline, elapsed) : undefined;
  const lineup = phase === 'preview' || phase === 'paddock' || phase === 'countdown';
  drawRaceStadium(ctx, w, h, clock, reduced, !lineup, phase === 'photo');
  if (!props.candidates.length) { raceLabel(ctx, '이름을 적으면 말들이 입장해요', w / 2, h * .81, clamp(w / 35, 9, 18), '#f3e7c2', true); return; }
  if (lineup) {
    const count = props.candidates.length, columns = Math.min(5, count), rows = Math.ceil(count / columns);
    const scale = clamp(Math.min(w / (columns * 114), h / (rows * 118)), .3, 1.3);
    const gateTop = rows > 1 ? .53 : .65;
    props.candidates.forEach((candidate, index) => {
      const row = Math.floor(index / columns), rowCount = Math.min(columns, count - row * columns);
      const x = w / 2 + (index % columns - (rowCount - 1) / 2) * w * .88 / columns, y = h * (gateTop + row * .32) + 28 * scale;
      if (phase === 'countdown') {
        ctx.fillStyle = '#0d2031'; ctx.fillRect(x - 45 * scale, y - 76 * scale, 5 * scale, 76 * scale); ctx.fillRect(x + 48 * scale, y - 76 * scale, 5 * scale, 76 * scale);
        raceBox(ctx, x - 45 * scale, y - 78 * scale, 98 * scale, 13 * scale, 1, '#d4bd81');
      }
      drawRaceHorse(ctx, candidate, index, x, y, scale, clock, 0, reduced);
      horseTag(ctx, candidate, index, x, y, scale, false);
      if (phase === 'countdown') { ctx.strokeStyle = '#759095aa'; ctx.lineWidth = scale; for (let bar = 0; bar < 4; bar++) { ctx.beginPath(); ctx.moveTo(x + (22 + bar * 7) * scale, y - 59 * scale); ctx.lineTo(x + (22 + bar * 7) * scale, y); ctx.stroke(); } }
    });
    if (phase === 'countdown') {
      const digit = Math.max(1, Math.ceil((5500 - elapsed) / 850));
      raceBox(ctx, w * .43, h * .29, w * .14, h * .23, 7, '#0b1c2de5', '#f3d797'); raceLabel(ctx, String(digit), w / 2, h * .41, clamp(h * .18, 20, 62), '#ffe2a2', true);
    }
    return;
  }
  if (phase === 'winner') {
    const winner = props.candidates.find(candidate => candidate.id === order[0])!;
    ctx.fillStyle = '#0a192bca'; ctx.fillRect(0, 0, w, h);
    const age = elapsed - (props.duration - 2600), arrival = reduced ? 1 : smooth(age / 750);
    const scale = clamp(Math.min(w / 270, h / 148), .65, 2.3), y = h * .77;
    const spotlight = ctx.createRadialGradient(w / 2, y - 40 * scale, 1, w / 2, y - 40 * scale, w * .5); spotlight.addColorStop(0, '#edcb8040'); spotlight.addColorStop(1, '#edcb8000'); ctx.fillStyle = spotlight; ctx.fillRect(0, 0, w, h);
    raceBox(ctx, w * .18, y + 3, w * .64, Math.max(19, h * .12), 4, '#d9b867', '#fae3a1');
    drawRaceHorse(ctx, winner, props.candidates.indexOf(winner), w * (.2 + .3 * arrival), y, scale, clock, .08, reduced, true);
    raceLabel(ctx, 'THE WINNER', w / 2, h * .16, clamp(w / 33, 11, 24), '#e8cb87', true);
    raceLabel(ctx, winner.name, w / 2, y + h * .066, clamp(w * .75 / Math.max(10, winner.name.length), 9, 21), '#293239', true);
    if (!reduced) for (let particle = 0; particle < 44; particle++) { const x = (particle * 79 + Math.sin(clock / 500 + particle) * 17) % w, py = (clock / (7 + particle % 4) + particle * 37) % h; ctx.save(); ctx.translate(x, py); ctx.rotate(clock / 460 + particle); ctx.fillStyle = [winner.color, '#f4d897', '#9ebfbd'][particle % 3]; ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }
    return;
  }
  if (phase === 'photo') {
    const scale = clamp(Math.min(w / 240, h / 175), .45, 2.3), finishX = w * .82;
    ctx.fillStyle = '#07182a35'; ctx.fillRect(0, 0, w, h);
    order.slice(0, 2).forEach((id, lane) => {
      const candidate = props.candidates.find(item => item.id === id)!, index = props.candidates.indexOf(candidate);
      const x = finishX - 57 * scale + (lane === 0 ? 2.5 : -2.5), y = h * (.57 + lane * .31);
      drawRaceHorse(ctx, candidate, index, x, y, scale, 1630 + lane * 131, 1, false);
      horseTag(ctx, candidate, index, x, y, scale, lane === 0);
      raceLabel(ctx, String(index + 1).padStart(2, '0') + ' ' + candidate.name, w * .035, Math.min(y + 9, h - 5), clamp(w * .6 / (candidate.name.length + 4), 7, 12), '#f5e5bd');
    });
    const magnifier = clamp(w * .16, 35, 81); ctx.strokeStyle = '#e8ce8c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(finishX, h * .57 - 39 * scale, magnifier * .25, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#edce81'; ctx.lineWidth = 2; ctx.strokeRect(4, 4, w - 8, h - 8);
    raceLabel(ctx, 'FRAME 01 / PHOTO', w * .04, h * .13, clamp(w / 42, 7, 14), '#f2deaa'); return;
  }
  // Hold named actors for an entire story so overtakes stay readable; other cuts follow the front pack.
  const key = incident ? 'story:' + incident.start + ':' + incident.actorId + ':' + incident.rivalId + ':' + incident.kind : phase + ':' + (phase === 'straight' ? 'finish' : Math.floor((elapsed - 5500) / 6500)) + ':' + props.order.join('|');
  if (camera.key !== key) {
    camera.key = key;
    const focused = incident ? [incident.rivalId, incident.actorId] : phase === 'straight' ? [order[0], standings[0].id, order[1]] : standings.slice(0, 2).map(standing => standing.id);
    const anchor = standings.find(value => value.id === incident?.actorId)?.distance ?? standings[0].distance;
    const nearby = [...standings].sort((a, b) => Math.abs(a.distance - anchor) - Math.abs(b.distance - anchor)).map(value => value.id);
    camera.ids = [...new Set([...focused, ...nearby])].slice(0, Math.min(3, props.candidates.length));
  }
  const pack = camera.ids.map(id => ({ candidate: props.candidates.find(candidate => candidate.id === id)!, distance: readRacingDistance(timeline, id, elapsed) })).filter(item => item.candidate);
  const ahead = Math.max(...pack.map(item => item.distance)), behind = Math.min(...pack.map(item => item.distance));
  const span = Math.max(.027, ahead - behind), cameraZoom = incident && !reduced ? 1 + Math.sin(clamp((elapsed - incident.start) / (incident.end - incident.start)) * Math.PI) * .025 : 1;
  const scale = clamp(Math.min(w / 340, h / 139), .37, 1.95) * cameraZoom;
  const launch = smooth((elapsed - 5500) / 1300);
  const storyAge = incident ? clamp((elapsed - incident.start) / (incident.end - incident.start)) : 0;
  if (elapsed < 6600 && !reduced) {
    ctx.save(); ctx.globalAlpha = 1 - smooth((elapsed - 5900) / 700);
    const opened = smooth((elapsed - 5500) / 650), gateX = w * .54;
    for (let panel = 0; panel < 3; panel++) {
      const y = h * (.64 + panel * .1); ctx.strokeStyle = '#cad1be'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gateX, y - 40 * scale); ctx.lineTo(gateX, y + 5); ctx.stroke();
      for (let bar = 0; bar < 3; bar++) { ctx.beginPath(); ctx.moveTo(gateX, y - (13 + bar * 10) * scale); ctx.lineTo(gateX + (1 - opened) * 25 * scale, y - (13 + bar * 10) * scale - opened * 11 * scale); ctx.stroke(); }
    }
    ctx.restore();
  }
  const locations = pack.map((item, lane) => {
    const shift = racingLaneShift(incident, item.candidate.id, elapsed);
    const sameLane = incident?.kind === 'blocked' || incident?.kind === 'draft';
    const baseLane = sameLane && (item.candidate.id === incident?.actorId || item.candidate.id === incident?.rivalId) ? .5 : incident && item.candidate.id === incident.actorId ? .5 : lane === 0 ? .1 : .9;
    const depth = clamp(baseLane + shift * .68, 0, 1.5);
    const stumble = incident?.kind === 'balance' && item.candidate.id === incident.actorId && !reduced ? Math.sin(storyAge * Math.PI * 2) * Math.sin(storyAge * Math.PI) : 0;
    return { ...item, index: props.candidates.indexOf(item.candidate), x: w * .76 - (ahead - item.distance) / span * w * .43 + (1 - launch) * w * -.30, y: h * (.71 + depth * .12) + Math.abs(stumble) * 3 * scale, scale: scale * (.87 + depth * .10), shift: shift + stumble * 7 };
  }).sort((a, b) => a.y - b.y);
  if (phase === 'straight') {
    const leading = locations.find(item => item.candidate.id === standings[0].id) ?? locations[0];
    const approach = clamp((elapsed - (props.duration - 9000)) / 4000);
    const finishX = leading.x + 57 * leading.scale - 2.5 + (1 - approach) * w * .6;
    for (let stripe = Math.floor(h * .43); stripe < h; stripe += 7) for (let column = 0; column < 2; column++) { ctx.fillStyle = (Math.floor(stripe / 7) + column) % 2 ? '#122030' : '#f3e8cc'; ctx.fillRect(finishX + column * 4, stripe, 4, 7); }
    ctx.strokeStyle = '#e1d5ae'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(finishX, h * .11); ctx.lineTo(finishX, h * .44); ctx.stroke();
  }
  locations.forEach(item => {
    const before = readRacingDistance(timeline, item.candidate.id, elapsed - 100), effort = clamp((item.distance - before) * 335, .6, 1.4);
    drawRaceDust(ctx, item.index, item.x, item.y, item.scale, clock, reduced, effort);
    drawRaceHorse(ctx, item.candidate, item.index, item.x, item.y, item.scale, clock, effort, reduced, false, item.shift);
  });
  locations.forEach(item => horseTag(ctx, item.candidate, item.index, item.x, item.y - (item.index % 2) * 8 * item.scale, item.scale, item.candidate.id === incident?.actorId || item.candidate.id === standings[0]?.id));
  miniCourse(ctx, w, h, props, standings);
  if (incident?.kind === 'gust' && !reduced && storyAge < .85) {
    ctx.strokeStyle = '#c2d3d33d'; ctx.lineWidth = 1;
    for (let wind = 0; wind < 9; wind++) { const x = (wind * 91 - clock / 3 % w + w) % w, y = h * (.3 + wind % 4 * .13); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 24, y + 4); ctx.stroke(); }
  }
  if (incident && racingIncidentStage(incident, elapsed) === 'action') {
    const actor = locations.find(item => item.candidate.id === incident.actorId);
    if (actor && !reduced) { ctx.strokeStyle = '#ffe6a888'; ctx.lineWidth = 1; for (let line = 0; line < 3; line++) { const length = 9 + line * 6; ctx.beginPath(); ctx.moveTo(actor.x - 44 * actor.scale - length, actor.y - (24 + line * 6) * actor.scale); ctx.lineTo(actor.x - 44 * actor.scale - length * 2, actor.y - (24 + line * 6) * actor.scale); ctx.stroke(); } }
  }
}

export default function RacingShow(props: SportsStageProps) {
  const key = props.duration + ':' + props.order.join('|') + ':' + props.candidates.map(candidate => candidate.id).join('|');
  const timeline = useMemo(() => buildRacingTimeline(props.candidates, props.order, props.duration, createRacingIncidents(props.candidates, props.order, props.duration, randomInt(0x100000000))), [key]);
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef(props), latestTimeline = useRef(timeline), synchronizedAt = useRef(performance.now()), lastPropElapsed = useRef(props.elapsed), jumpTimer = useRef<number | undefined>(undefined);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [view, setView] = useState(() => viewAt(props, timeline, props.elapsed)), [jumpCut, setJumpCut] = useState(false);
  useLayoutEffect(() => {
    const jumped = Math.abs(props.elapsed - lastPropElapsed.current) > 950;
    latest.current = props; latestTimeline.current = timeline; synchronizedAt.current = performance.now(); lastPropElapsed.current = props.elapsed;
    if (jumped || props.paused || props.preview) setView(viewAt(props, timeline, props.elapsed));
    if (!jumped) return;
    setJumpCut(true); window.clearTimeout(jumpTimer.current); jumpTimer.current = window.setTimeout(() => setJumpCut(false), 120);
  }, [props, timeline]);
  useEffect(() => () => window.clearTimeout(jumpTimer.current), []);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d'); if (!element || !ctx) return;
    let w = 1, h = 1, ratio = 1, frame = 0, previous = performance.now(), clock = 0, boardAt = -1000, viewKey = '';
    const camera: RaceCamera = { key: '', ids: [] };
    const resize = () => { const rect = element.getBoundingClientRect(); w = Math.max(1, rect.width); h = Math.max(1, rect.height); ratio = Math.min(2, window.devicePixelRatio || 1); element.width = Math.round(w * ratio); element.height = Math.round(h * ratio); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const animate = (now: number) => {
      const current = latest.current, plan = latestTimeline.current, delta = Math.min(50, Math.max(0, now - previous)); previous = now;
      if (!current.paused && !reducedMotion) clock += delta;
      const elapsed = current.preview || current.paused ? current.elapsed : Math.min(current.duration, current.elapsed + Math.max(0, now - synchronizedAt.current));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h); render(ctx, w, h, current, plan, elapsed, clock, reducedMotion, camera);
      const incident = displayedIncident(plan, elapsed), phase = phaseAt(elapsed, current.duration, current.preview);
      const immediateKey = phase + ':' + incident?.start + ':' + (incident ? racingIncidentStage(incident, elapsed) : '') + ':' + current.order.join('|') + ':' + current.candidates.map(candidate => candidate.name).join('|');
      if (now - boardAt >= 700 || immediateKey !== viewKey) { boardAt = now; viewKey = immediateKey; setView(viewAt(current, plan, elapsed)); }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate); return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [reducedMotion]);
  const rows = props.candidates.length || 1, finished = view.phase === 'winner';
  const style = { '--racing-count': rows, '--racing-compact-count': Math.ceil(rows / 2), '--racing-progress': view.progress * 100 + '%' } as CSSProperties;
  return <div className={'racing-show racing-phase-' + view.phase + (props.preview ? ' racing-preview' : '') + (jumpCut ? ' racing-jump-cut' : '') + (props.paused ? ' racing-paused' : '')} style={style}>
    <section className="racing-stage" aria-label="경마 경기장">
      <div className="racing-stage-top"><span><i aria-hidden="true" />{props.preview ? 'DERBY NIGHT' : finished ? 'RACE COMPLETE' : 'DERBY LIVE'}</span><span>{view.speed ? view.speed + ' KM/H' : '1,600 M · NIGHT RACE'}</span></div>
      <div className="racing-canvas-wrap"><canvas ref={canvas} className="racing-canvas" role="img" aria-label={view.headline} /><div className="racing-phase-badge">{props.paused ? 'Ⅱ 일시정지' : view.badge}</div></div>
      <div className="racing-commentary" aria-live={finished ? 'polite' : 'off'}><div className="racing-story-kicker">{view.focusId ? 'RACE STORY' : view.phase === 'photo' ? 'OFFICIAL PHOTO' : 'TRACKSIDE COMMENTARY'}</div><strong>{view.headline}</strong><p>{view.detail}</p><div className="racing-distance-meter" aria-hidden="true"><span /></div></div>
    </section>
    <aside className="racing-board" aria-label={finished ? '경마 최종 순위' : '경마 실시간 순위'}>
      <div className="racing-board-heading"><span>{props.preview ? 'RACE CARD' : finished ? 'OFFICIAL RESULT' : 'POSITION TRACKER'}</span><h2>{props.preview ? '오늘의 경주마' : finished ? '전원 완주 · 최종 순위' : '실시간 경합'}</h2></div>
      <ol className="racing-standings">
        {props.candidates.map((candidate, index) => {
          const position = Math.max(0, view.standings.findIndex(standing => standing.id === candidate.id));
          const rowStyle = { '--racing-rank': position, '--racing-column': position % 2, '--racing-row': Math.floor(position / 2), '--racing-color': candidate.color } as CSSProperties;
          return <li className={'racing-horse-row' + (!props.preview && position === 0 ? ' racing-is-leading' : '') + (candidate.id === view.focusId ? ' racing-is-story' : '')} key={candidate.id} style={rowStyle} aria-label={candidate.name + (!props.preview ? ', ' + (position + 1) + '위' : '')} title={candidate.name}>
            <span className="racing-rank">{props.preview ? '—' : String(position + 1).padStart(2, '0')}</span><span className="racing-silk">{String(index + 1).padStart(2, '0')}</span><span className="racing-horse-name">{candidate.name}</span><span className="racing-horse-state">{finished ? position === 0 ? '★' : '완주' : props.preview ? '출전' : candidate.id === view.focusId ? '경합' : position === 0 ? '선두' : '추격'}</span>
          </li>;
        })}
        {!props.candidates.length && <li className="racing-empty">이름을 입력하면<br />나만의 경주마가 등장해요.</li>}
      </ol>
      <p className="racing-board-note">기수의 색과 번호를 따라가세요 · 모두 같은 우승 확률</p>
    </aside>
  </div>;
}
