import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { randomInt } from './election';
import type { SportsStageProps } from './sports';
import { activeRacingBump, activeRacingIncident, activeRacingTrick, racingTrickStatus, buildRacingTimeline, createRacingIncidents, racingIncidentStatus, racingIncidentSetback, racingIncidentRecovery, racingBumpRecoveryStart, racingStandings, readRacingTravel, RACING_STORIES, type RacingTimeline, type RacingStanding } from './racingNarrative';
import { drawRaceDust, drawRaceHorse, raceHorseAttachments, drawRaceStadium, raceBox, raceLabel, type RaceHorseMotion } from './racingArt';
import { drawRacingCourse, drawRacingStartingGate, drawRacingTopView } from './racingCourse';
import { createRacingCamera, placeRacingField, racingFocusIds, type RacingCamera } from './racingCamera';
import { combineRacingHorseMotion, drawRacingIncidentEffects, drawRacingTrickEffects, placeRacingDuel, placeRacingTrick, placeRacingBump, racingBumpMotion, racingIncidentMotion, racingTrickMotion } from './racingEffects';
import { drawRacingObstacles, placeRacingObstacles, placeRacingFalls, racingObstacleJump, racingObstacleMotion, racingObstacleStatus } from './racingObstacles';
import { racingGaitPhase } from './racingMotionClock';
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
  const incident = activeRacingIncident(timeline, elapsed) ?? timeline.incidents.find(incident => elapsed >= incident.end && elapsed < incident.end + 1600);
  return incident?.kind === 'hay-jump' || incident?.kind === 'puddle' ? undefined : incident;
}
function viewAt(props: SportsStageProps, timeline: RacingTimeline, elapsed: number): RaceView {
  const phase = phaseAt(elapsed, props.duration, props.preview), standings = racingStandings(timeline, elapsed);
  const leader = props.candidates.find(candidate => candidate.id === standings[0]?.id), incident = phase === 'race' ? displayedIncident(timeline, elapsed) : undefined;
  const template = RACING_STORIES.find(story => story.kind === incident?.kind), actor = props.candidates.find(candidate => candidate.id === incident?.actorId);
  const names: Record<RacePhase, [string, string, string]> = {
    preview: ['출발선에 모이는 경주마', '번호와 기수의 색으로 내 말을 따라가세요. 안쪽은 뒤에서, 바깥쪽은 앞에서 같은 거리를 달립니다.', 'STARTING GATE'],
    paddock: ['출발선 · 마지막 준비', '코너 안쪽은 뒤에, 바깥쪽은 앞에 있는 게이트에 입장합니다. 기수가 고삐와 등자를 확인합니다.', 'GATE LOADING'],
    countdown: ['게이트 오픈 직전', '코너의 거리 차이를 맞춰 준비했습니다. 문이 열리면 한꺼번에 출발합니다.', 'STARTING GATE'],
    race: [(leader?.name ?? '') + ' · 현재 선두', '현장 중계로 선두와 추격마의 실제 간격을 보세요. 우측 상단 지도에서 전체 위치를 확인할 수 있습니다.', 'LIVE RACE'],
    straight: ['마지막 직선 · 끝까지 추격', '선두와 가까운 추격마가 화면에서 달립니다. 코끝이 결승선을 지나는 순간까지 순위가 바뀝니다.', 'FINAL STRAIGHT'],
    photo: ['결승선 통과 · 사진 판정', '말들이 도착 순서대로 결승선을 통과합니다. 통과한 말도 앞으로 달리며 속도를 줄입니다.', 'PHOTO FINISH'],
    winner: [(leader?.name ?? '오늘의 말') + ' · 우승 확정', '전원 한 바퀴 완주. 말은 천천히 멈추고 기수가 한 손을 들어 인사합니다.', 'WINNER’S CIRCLE'],
  };
  let [headline, detail, badge] = names[phase];
  if ((phase === 'race' || phase === 'straight') && standings.length > 1) {
    const runner = props.candidates.find(candidate => candidate.id === standings[1].id), gap = Math.max(0, (standings[0].distance - standings[1].distance) * 1600);
    headline = (leader?.name ?? '선두') + (gap < 3 ? ' · 코끝으로 앞섭니다' : ' · ' + gap.toFixed(1) + 'M 앞서갑니다');
    detail = (runner?.name ?? '2위') + '가 바로 뒤에서 추격합니다. 선두와 ' + gap.toFixed(1) + 'M 차이. ' + (phase === 'straight' ? '결승선까지 보폭을 늘리며 끝까지 맞붙습니다.' : '말의 코끝이 실제로 앞서는 순간 순위가 바뀝니다.');
  }
  if (incident && template && actor) {
    const status = racingIncidentStatus(timeline, incident, elapsed);
    const next = props.candidates.find(candidate => candidate.id === status.nextRivalId);
    const gained = status.beforeRank - status.currentRank, crossed = gained >= 0 ? status.overtakenIds : status.passedByIds;
    const last = props.candidates.find(candidate => candidate.id === crossed.at(-1));
    headline = actor.name + ' · ' + template.title;
    detail = status.stage === 'outcome'
      ? status.beforeRank + '위 → 현재 ' + status.currentRank + '위. ' + (last ? last.name + (gained >= 0 ? ' 앞에 나섰습니다.' : '의 뒤에서 다시 리듬을 찾습니다.') : gained > 0 ? '앞말과의 경합에서 순위를 끌어올렸습니다.' : gained < 0 ? '보폭을 회복하고 앞말을 다시 쫓습니다.' : '같은 순위에서 리듬을 지키며 다음 경합을 준비합니다.')
      : '현재 ' + status.currentRank + '위 · ' + (next ? next.name + '와 경합. ' : last ? last.name + '를 지나 앞으로. ' : '') + template[status.stage];
    badge = status.stage === 'setup' ? '추월 준비 · 앞말을 함께 포착' : status.stage === 'action' ? '실제 추월 중계' : '추월 결과';
    const p = (elapsed - incident.start) / (incident.end - incident.start), rival = props.candidates.find(candidate => candidate.id === incident.rivalId);
    const checked = racingIncidentSetback(incident, incident.actorId, elapsed);
    if (checked > 0 && p < .38) {
      headline = actor.name + ' · 진로를 막혔습니다';
      detail = '현재 ' + status.currentRank + '위. ' + (rival?.name ?? '앞말') + '가 옆 진로를 지킵니다. 고삐를 당겨 속도를 줄이고 틈을 기다립니다.' + (status.passedByIds.length ? ' 그 사이 뒤의 말이 앞으로 나섰습니다.' : ' 앞말과 간격이 벌어집니다.');
      badge = '진로 견제 · 실제 감속';
    } else if (checked > 0 && elapsed < (racingIncidentRecovery(incident, incident.actorId)?.recoveryStart ?? incident.start)) {
      headline = actor.name + ' · 틈을 찾고 보폭을 맞춥니다';
      detail = '현재 ' + status.currentRank + '위. 진로를 옮겨도 벌어진 간격은 남아 있습니다. 기수가 고삐를 정리하고 안정된 보폭부터 되찾습니다.';
      badge = '간격 유지 · 리듬 회복';
    } else if (checked > 0 && p < .70) {
      headline = actor.name + ' · 틈으로 빠져 재가속';
      detail = '현재 ' + status.currentRank + '위. ' + template.action + ' 옆 진로로 빠져 잃은 간격을 좁힙니다.';
      badge = '응수 · 실제 재추격';
    }
  }
  const challenge = phase === 'race' || phase === 'straight' ? timeline.obstacles.find(obstacle => elapsed >= obstacle.encounter - 1450 && elapsed < (obstacle.outcome === 'clear' ? obstacle.impact + 1000 : obstacle.recovered + 450))
    ?? (!incident ? timeline.obstacles.find(obstacle => obstacle.outcome !== 'clear' && elapsed >= obstacle.recovered && elapsed < (obstacle.catchupEnd ?? obstacle.recovered)) : undefined) : undefined;
  let focusId = incident?.actorId;
  if (challenge) {
    const subject = props.candidates.find(candidate => candidate.id === challenge.actorId), status = racingObstacleStatus(timeline, challenge, elapsed);
    const name = subject?.name ?? '경주마', object = challenge.kind === 'hay-jump' ? '건초 장벽' : '물웅덩이';
    const ahead = props.candidates.find(candidate => candidate.id === standings[status.currentRank - 2]?.id);
    const change = status.currentRank > status.beforeRank ? ' · ' + (status.currentRank - status.beforeRank) + '계단 밀렸습니다.' : '';
    headline = name + ' · ' + (status.stage === 'approach' ? object + ' 접근' : status.stage === 'jump' ? '도약!' : status.stage === 'impact' ? challenge.outcome === 'clip' ? '발이 걸려 앞으로 넘어졌습니다' : '미끄러져 주저앉았습니다' : status.stage === 'recover' ? '넘어진 몸을 다시 일으킵니다' : status.stage === 'rhythm' ? '벌어진 간격 뒤에서 리듬을 찾습니다' : status.stage === 'chase' ? status.currentRank === standings.length ? '꼴등에서 다시 추격합니다' : '한 마리씩 다시 따라잡습니다' : '코스 통과');
    detail = '현재 ' + status.currentRank + '위. ' + (status.stage === 'approach' ? '오른쪽에서 ' + object + '이 가까워집니다. 기수가 도약할 보폭을 맞춥니다.'
      : status.stage === 'jump' ? '앞다리를 모아 넘습니다. 착지까지 보폭을 지켜보세요.'
      : status.stage === 'impact' ? (challenge.outcome === 'clip' ? '앞발이 건초에 걸려 무릎을 꿇고 가슴이 땅으로 내려갑니다. 기수도 안장에서 뒤로 미끄러집니다.' : '앞발이 젖은 지면에서 길게 밀립니다. 말이 주저앉고 기수가 몸을 젖혀 버팁니다.') + change
      : status.stage === 'recover' ? (elapsed < challenge.lowest ? '속도가 거의 멈췄습니다. 뒤의 말들이 지나가고 기수가 고삐를 모아 일어날 준비를 합니다.' : '앞발부터 다시 딛고 몸을 일으킵니다. 기수도 안장으로 돌아옵니다.') + change
      : status.stage === 'rhythm' ? '일어섰지만 잃은 거리는 남아 있습니다. 기수가 안장을 바로 잡고 짧은 보폭을 안정시킨 뒤 추격을 준비합니다.'
      : status.stage === 'chase' ? '안정된 보폭에서 조금씩 힘을 보탭니다. ' + (ahead ? ahead.name + '와 ' + Math.max(0, (standings[status.currentRank - 2].distance - standings[status.currentRank - 1].distance) * 1600).toFixed(1) + 'M 차이를 좁힙니다.' : '실제 추월 끝에 선두 경합에 합류합니다.')
      : challenge.outcome === 'clear' ? '장애물을 넘으며 착지로 이어집니다. 네 발의 달리는 리듬을 지킵니다.' : '흔들림을 수습하고 달리는 리듬을 되찾았습니다. 실제 간격만큼 추격이 이어집니다.');
    badge = status.stage === 'impact' || status.stage === 'recover' ? '실제 감속 · 역전 기회' : status.stage === 'rhythm' ? '간격 유지 · 리듬 회복' : status.stage === 'chase' ? '회복 · 재추격' : '코스 장애물';
    focusId = challenge.actorId;
  }
  const trick = phase === 'race' ? activeRacingTrick(timeline, elapsed) : undefined;
  if (trick && (!challenge || !['impact', 'recover'].includes(racingObstacleStatus(timeline, challenge, elapsed).stage))) {
    const striker = props.candidates.find(candidate => candidate.id === trick.actorId)?.name ?? '뒤의 기수';
    const target = props.candidates.find(candidate => candidate.id === trick.targetId)?.name ?? '앞의 기수';
    const status = racingTrickStatus(timeline, trick, elapsed), kick = trick.kind === 'rear-kick';
    headline = status.stage === 'windup' ? striker + (kick ? ' · 뒷발을 모읍니다' : ' · 모래주머니를 꺼냈습니다')
      : status.stage === 'flight' ? striker + (kick ? ' · 뒤로 한 번 차기!' : ' · 앞 기수를 향해 투척!')
      : status.stage === 'stunned' ? target + ' · 기수가 잠깐 멍해졌습니다' : status.stage === 'recover' ? target + ' · 고삐를 정리하며 중심을 되찾습니다' : target + ' · 보폭을 늘려 재추격';
    detail = status.stage === 'windup' ? (kick ? '바로 뒤에서 붙는 말을 보고 뒷발을 모아 견제합니다.' : '뒤의 기수가 고삐를 한 손으로 잡고 작은 모래주머니를 들어 올립니다.')
      : status.stage === 'flight' ? (kick ? '뒷발이 뒤 기수의 등자 쪽에 닿습니다. 뒤의 말이 고삐를 당깁니다.' : '작은 모래주머니가 포물선을 그려 바로 앞 기수의 헬멧으로 날아갑니다.')
      : status.stage === 'stunned' ? '현재 ' + status.currentRank + '위. 별이 빙글빙글! 기수가 고삐를 잡은 채 휘청여 말의 속도도 줄어듭니다.' + (status.currentRank > status.beforeRank ? ' 뒤의 말이 지나가며 순위가 밀렸습니다.' : ' 그 사이 상대와 간격이 벌어집니다.')
      : status.stage === 'recover' ? '현재 ' + status.currentRank + '위. 잃은 간격을 남겨 둔 채 고개를 바로 세우고 말의 리듬을 맞춥니다. 아직 추격에 힘을 싣지 않습니다.'
      : '현재 ' + status.currentRank + '위. 고삐를 천천히 풀고 힘을 보탭니다. 잃은 간격을 꾸준히 좁힙니다.';
    badge = status.stage === 'stunned' ? '기수 일시 기절 · 실제 감속' : status.stage === 'recover' ? '간격 유지 · 중심 회복' : status.stage === 'chase' ? '회복 · 재추격' : kick ? '뒷발차기 견제' : '모래주머니 투척';
    focusId = elapsed < trick.impact ? trick.actorId : trick.targetId;
  }
  const bump = activeRacingBump(timeline, elapsed);
  if (bump && (!challenge || elapsed >= challenge.recovered + 450) && !trick) {
    const defender = props.candidates.find(item => item.id === bump.actorId)?.name ?? '앞말';
    const rival = props.candidates.find(item => item.id === bump.targetId)?.name ?? '추격마';
    headline = defender + ' · ' + (elapsed < bump.impact ? '어깨로 진로를 지킵니다' : elapsed < bump.lowest ? '몸통을 맞대며 견제!' : elapsed < racingBumpRecoveryStart(bump) ? '접촉을 풀고 중심을 잡습니다' : '보폭을 되찾으며 경합');
    detail = elapsed < bump.impact ? rival + '가 옆으로 붙습니다. 앞말도 몸을 기울여 자리를 지킵니다.' : elapsed < bump.lowest ? '두 말의 어깨가 닿습니다. ' + rival + '가 발을 짧게 딛고 중심을 잡는 사이 앞말이 보폭을 이어갑니다.' : elapsed < racingBumpRecoveryStart(bump) ? '접촉으로 벌어진 코끝 간격이 남습니다. 기수가 고삐를 바로 잡고 한 걸음씩 중심을 맞춥니다.' : '안정된 보폭에서 간격을 서서히 좁힙니다. 순위 경쟁이 이어집니다.';
    badge = '몸통 견제 · 실제 접촉'; focusId = bump.actorId;
  }
  const late = timeline.lateFall;
  if (late && elapsed >= late.impact - 450 && elapsed < timeline.finishTimes[late.actorId]) {
    const name = props.candidates.find(candidate => candidate.id === late.actorId)?.name ?? '경주마';
    const rank = standings.find(item => item.id === late.actorId)?.rank;
    headline = name + ' · ' + (elapsed < late.impact ? '결승선 앞 마지막 경합' : elapsed < late.lowest ? '결승선 앞에서 발이 꼬였습니다!' : '몸을 일으켜 결승선으로');
    detail = '현재 ' + rank + '위. ' + (elapsed < late.impact ? '바로 앞 결승선까지 나란히 달립니다. 마지막 한 걸음까지 긴장을 놓을 수 없습니다.' : elapsed < late.lowest ? '앞발이 접히고 몸이 앞으로 고꾸라집니다. 멈춘 사이 뒤의 말들이 결승선을 향해 지나갑니다.' : '기수가 고삐를 모으고 다시 출발합니다. 잃은 거리를 달려 마지막으로 결승선을 통과합니다.');
    badge = elapsed < late.impact ? '결승선 앞 경합' : '막판 발걸림 · 실제 감속'; focusId = late.actorId;
  }
  const trackedId = [...timeline.ids].sort((a, b) => readRacingTravel(timeline, b, elapsed) - readRacingTravel(timeline, a, elapsed))[0];
  const pace = trackedId ? (readRacingTravel(timeline, trackedId, elapsed + 100) - readRacingTravel(timeline, trackedId, elapsed)) * 335 : 1;
  return { phase, standings, headline, detail, focusId, badge, progress: Math.max(0, ...standings.map(standing => standing.distance)), speed: phase === 'race' || phase === 'straight' ? Math.round(clamp(56 * pace, 0, 100)) : 0 };
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
  const placements = placeRacingField(scene.camera, props.candidates, timeline, elapsed, w, h, props.paused || reduced ? 0 : delta, reset || reduced);
  drawRaceStadium(ctx, w, h, clock, reduced, true, false, { center: scene.camera.center, pixelsPerLap: w * .65 / scene.camera.span });
  // Distance follows the nose; individual sprite scales must not change the finish crossing.
  const baseLocations = placements.map(item => ({ ...item, x: item.x - 57 * item.scale }));
  const obstacles = placeRacingObstacles(timeline, scene.camera, placements, w);
  const trick = phase === 'race' ? activeRacingTrick(timeline, elapsed) : undefined;
  const bump = activeRacingBump(timeline, elapsed);
  const locations = placeRacingFalls(placeRacingBump(bump, placeRacingTrick(trick, placeRacingDuel(incident, baseLocations, obstacles, elapsed), elapsed), elapsed, baseLocations, reduced), timeline, elapsed, h, reduced).sort((a, b) => a.y - b.y);
  const motions = new Map(locations.map(item => {
    const own = obstacles.filter(obstacle => obstacle.actorId === item.id);
    const jump = reduced ? 0 : Math.max(0, ...own.map(obstacle => racingObstacleJump(obstacle, item)));
    const late = timeline.lateFall?.actorId === item.id ? racingObstacleMotion(timeline.lateFall, elapsed, reduced) : {};
    const obstacleMotion = own.reduce<RaceHorseMotion>((motion, obstacle) => ({ ...motion, ...racingObstacleMotion(obstacle, elapsed, reduced) }), late);
    return [item.id, combineRacingHorseMotion(racingIncidentMotion(incident, item.id, elapsed, reduced), racingTrickMotion(trick, item.id, elapsed, locations, reduced), racingBumpMotion(bump, item.id, elapsed, locations, reduced), obstacleMotion, { jump: jump * (1 - (obstacleMotion.fall ?? 0)) })];
  }));
  const physicalLocations = locations.map(item => {
    const before = readRacingTravel(timeline, item.id, elapsed - 100), effort = clamp((item.distance - before) * 335, .45, 1.35);
    const pose = raceHorseAttachments(item.index, clock, effort, reduced, { phase: racingGaitPhase(item.index, elapsed), ...motions.get(item.id) });
    const world = (point: { x: number; y: number }) => ({ x: item.x + point.x * item.scale, y: item.y + point.y * item.scale });
    return { ...item, hand: world(pose.hand), helmet: world(pose.helmet), boot: world(pose.boot) };
  });
  if (trick?.kind === 'rear-kick') {
    const actor = motions.get(trick.actorId);
    if (actor) {
      const contact = racingTrickMotion(trick, trick.actorId, elapsed, physicalLocations, reduced);
      actor.kickReach = contact.kickReach; actor.kickX = contact.kickX; actor.kickY = contact.kickY;
    }
  }
  if (phase === 'straight' || phase === 'photo') {
    const finishX = w * .5 + (1 - scene.camera.center) / scene.camera.span * w * .65;
    for (let stripe = h * .42; stripe < h; stripe += 8) for (let column = 0; column < 2; column++) { ctx.fillStyle = (Math.floor(stripe / 8) + column) % 2 ? '#142333' : '#eee4c9'; ctx.fillRect(finishX + column * 5, stripe, 5, 8); }
    ctx.strokeStyle = '#dfd9be'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(finishX, h * .13); ctx.lineTo(finishX, h * .42); ctx.stroke();
    if (phase === 'photo') raceLabel(ctx, 'FINISH · 실제 통과 순서', 14, h * .37, clamp(w / 65, 8, 13), '#f2ddb0');
  }
  // Names belong behind every horse and rider, including when two opponents overlap.
  locations.filter(item => item.x + 62 * item.scale >= 0 && item.x - 58 * item.scale <= w).forEach(item => horseTag(ctx, props.candidates[item.index].name, props.candidates[item.index].color, item.x, item.y - (motions.get(item.id)?.jump ?? 0) * 24 * item.scale, w, h, w < 520 || h < 250));
  drawRacingIncidentEffects(ctx, incident, locations, elapsed, reduced, 'ground');
  const groundObjects = [...obstacles].sort((a, b) => a.y - b.y);
  let nextGroundObject = 0;
  locations.forEach(item => {
    // Course objects share the horses' depth order, including foreground obstacles.
    while (nextGroundObject < groundObjects.length && groundObjects[nextGroundObject].y <= item.y) {
      drawRacingObstacles(ctx, [groundObjects[nextGroundObject++]], w, elapsed, reduced, 'ground');
    }
    const candidate = props.candidates[item.index], before = readRacingTravel(timeline, item.id, elapsed - 100), effort = clamp((item.distance - before) * 335, .45, 1.35);
    const motion = motions.get(item.id)!;
    drawRaceDust(ctx, item.index, item.x, item.y, item.scale, Math.max(0, elapsed - 5500), reduced, effort * (1 - smooth((motion.jump ?? 0) / .35)) * (1 - (motion.fall ?? 0) * .85));
    const standing = standings.find(standing => standing.id === item.id);
    const velocityRatio = standing?.finished ? Math.exp(-(elapsed - standing.finishTime) / 1100) : 1;
    // Invert the renderer's easing so stride shrinks with the continuous run-out velocity.
    const settle = .5 - Math.sin(Math.asin(2 * velocityRatio - 1) / 3);
    // Cadence keeps real time during every event; actual pace changes only the stride length.
    drawRaceHorse(ctx, candidate, item.index, item.x, item.y, item.scale, clock, effort, reduced, false, 0, { settle, phase: racingGaitPhase(item.index, elapsed), ...motion });
  });
  drawRacingObstacles(ctx, groundObjects.slice(nextGroundObject), w, elapsed, reduced, 'ground');
  drawRacingIncidentEffects(ctx, incident, locations, elapsed, reduced, 'air');
  drawRacingTrickEffects(ctx, trick, physicalLocations, elapsed, reduced);
  drawRacingObstacles(ctx, obstacles, w, elapsed, reduced, 'air');
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
export default function RacingShow(props: SportsStageProps & { storySeed?: number }) {
  const key = props.duration + ':' + props.order.join('|') + ':' + props.candidates.map(candidate => candidate.id).join('|') + ':' + props.storySeed;
  const timeline = useMemo(() => buildRacingTimeline(props.candidates, props.order, props.duration, createRacingIncidents(props.candidates, props.order, props.duration, props.storySeed ?? randomInt(0x100000000))), [key]);
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
    let w = 1, h = 1, ratio = 1, hasCanvasSize = false, frame = 0, previous = performance.now(), boardAt = -1000, viewKey = '';
    const scene: RaceScene = { camera: createRacingCamera(), elapsed: null };
    const resize = () => {
      const rect = element.getBoundingClientRect(), nextW = Math.max(1, rect.width), nextH = Math.max(1, rect.height), nextRatio = Math.min(2, window.devicePixelRatio || 1);
      const pixelW = Math.round(nextW * nextRatio), pixelH = Math.round(nextH * nextRatio);
      if (hasCanvasSize && element.width === pixelW && element.height === pixelH && ratio === nextRatio) { w = nextW; h = nextH; return; }
      hasCanvasSize = true; w = nextW; h = nextH; ratio = nextRatio;
      if (element.width !== pixelW) element.width = pixelW;
      if (element.height !== pixelH) element.height = pixelH;
      scene.elapsed = null;
      // A real resize repaints immediately instead of leaving an emptied canvas until the next frame.
      const current = latest.current, plan = latestTimeline.current, now = performance.now();
      const elapsed = current.preview || current.paused ? current.elapsed : Math.min(current.duration, current.elapsed + Math.max(0, now - synchronizedAt.current));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); render(ctx, w, h, current, plan, elapsed, elapsed, reducedMotion, scene, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const animate = (now: number) => {
      const current = latest.current, plan = latestTimeline.current, delta = Math.min(50, Math.max(0, now - previous)); previous = now;
      const elapsed = current.preview || current.paused ? current.elapsed : Math.min(current.duration, current.elapsed + Math.max(0, now - synchronizedAt.current));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h); render(ctx, w, h, current, plan, elapsed, elapsed, reducedMotion, scene, delta);
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
      <div className="racing-canvas-wrap"><canvas ref={canvas} className="racing-canvas" role="img" aria-label={view.headline} /><div className="racing-phase-badge">{props.paused ? <><span className="playback-symbol playback-symbol-pause" aria-hidden="true" /> 일시정지</> : view.badge}</div></div>
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
