import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Candidate } from './election';
import type { SportsStageProps } from './sports';
import './racing.css';

type RacePhase = 'preview' | 'paddock' | 'countdown' | 'race' | 'straight' | 'photo' | 'winner';
type Standing = { id: string; distance: number };
type RaceView = { phase: RacePhase; standings: Standing[]; headline: string; detail: string };
type RaceCamera = { key: string; ids: string[] };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const coats = ['#935c40', '#453c3e', '#b58055', '#d8cfbc', '#715c51', '#bb7750'];

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
  return [...props.order.filter(id => ids.has(id)), ...props.candidates.filter(candidate => !props.order.includes(candidate.id)).map(candidate => candidate.id)];
}

/** Cosmetic pace never chooses a winner; the supplied order determines the complete finish. */
function distanceAt(index: number, rank: number, count: number, elapsed: number, duration: number) {
  const time = clamp((elapsed - 5500) / Math.max(1, duration - 10500));
  const seed = rank * 1.47 + index * 0.73;
  const late = smooth((time - 0.74) / 0.26);
  const shuffle = Math.sin(time * Math.PI) * (Math.sin(time * Math.PI * 2.35 + seed) * 0.055 + Math.sin(time * Math.PI * 1.15 - seed) * 0.020);
  const startAdvantage = (Math.sin(seed * 1.8) * 0.018) * (1 - late) * smooth(time / 0.15);
  const finishAdvantage = ((count - rank) / Math.max(1, count)) * 0.060 * late;
  return Math.max(0, time + shuffle + startAdvantage + finishAdvantage);
}

function standingsAt(props: SportsStageProps, elapsed: number, phase: RacePhase): Standing[] {
  const order = finalOrder(props);
  const simulationTime = phase === 'photo' ? props.duration - 5000 : elapsed;
  const values = props.candidates.map((candidate, index) => ({ id: candidate.id, distance: props.preview ? 0 : distanceAt(index, order.indexOf(candidate.id), props.candidates.length, simulationTime, props.duration) }));
  if (phase === 'winner' || elapsed >= props.duration) return order.map(id => values.find(value => value.id === id)!);
  return values.sort((a, b) => b.distance - a.distance || props.candidates.findIndex(candidate => candidate.id === a.id) - props.candidates.findIndex(candidate => candidate.id === b.id));
}

function viewAt(props: SportsStageProps, elapsed: number): RaceView {
  const phase = phaseAt(elapsed, props.duration, props.preview);
  const standings = standingsAt(props, elapsed, phase);
  const leader = props.candidates.find(candidate => candidate.id === standings[0]?.id);
  const names: Record<RacePhase, [string, string]> = {
    preview: ['경주마들이 출발을 기다립니다', '말의 번호와 기수 색상으로 마지막까지 따라가세요.'],
    paddock: ['패독 입장 · 출발 준비', '기수들이 마지막으로 안장과 고삐를 확인합니다.'],
    countdown: ['게이트가 열립니다', '모든 말이 같은 출발선에서 준비하고 있습니다.'],
    race: [`${leader?.name ?? '선두'} · 선두권 질주`, '바깥쪽 추격, 안쪽 돌파. 마지막 코너까지 지켜보세요.'],
    straight: ['마지막 직선 · 승부는 지금부터', '고삐를 낮췄습니다. 결승선 앞에서 순위가 뒤집힙니다.'],
    photo: ['사진 판정 · 코끝의 차이', '결승선의 한 순간을 확대합니다. 잠시 후 전 순위가 발표됩니다.'],
    winner: [`${leader?.name ?? '오늘의 말'} · 우승 확정`, '완주를 축하합니다. 모든 말의 최종 순위를 확인하세요.'],
  };
  return { phase, standings, headline: names[phase][0], detail: names[phase][1] };
}

function box(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y); context.lineTo(x + width - r, y); context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r); context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height); context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r); context.quadraticCurveTo(x, y, x + r, y); context.closePath();
  context.fillStyle = fill; context.fill();
  if (stroke) { context.strokeStyle = stroke; context.lineWidth = 1.4; context.stroke(); }
}

function label(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, center = false) {
  context.font = `800 ${size}px "Malgun Gothic", sans-serif`;
  context.fillStyle = color; context.textAlign = center ? 'center' : 'left'; context.textBaseline = 'middle';
  context.fillText(text, x, y);
}

function horse(context: CanvasRenderingContext2D, candidate: Candidate, index: number, x: number, y: number, scale: number, direction: number, clock: number, speed: number, reduced: boolean, cheering = false) {
  context.save(); context.translate(x, y); context.scale(scale * direction, scale);
  const opacity = context.globalAlpha;
  const phase = clock / (122 + index % 4 * 9) + index * 1.61;
  const stride = reduced ? 0 : Math.sin(phase);
  const hop = speed > 0.15 && !reduced ? -Math.abs(Math.sin(phase + 0.5)) * (2.6 + index % 3 * 0.35) : Math.sin(clock / 790 + index) * (reduced ? 0 : 0.4);
  const coat = coats[index % coats.length];
  context.fillStyle = '#142b3430'; context.beginPath(); context.ellipse(0, 3, 35 + hop * 0.6, 5, 0, 0, Math.PI * 2); context.fill();
  const limb = (hip: number, legPhase: number, far: boolean) => {
    const swing = speed > 0.15 && !reduced ? Math.sin(phase + legPhase) : Math.sin(clock / 1350 + index + legPhase) * (reduced ? 0 : 0.06);
    const bend = speed > 0.15 ? Math.max(0, Math.sin(phase + legPhase + 1.2)) * 0.85 : 0.08;
    const kneeX = hip + Math.sin(swing * 0.75) * 12;
    const kneeY = -16 + hop + Math.cos(swing * 0.75) * 11;
    const footX = kneeX + Math.sin(-swing * 0.48 + bend) * 12;
    const footY = kneeY + Math.cos(-swing * 0.48 + bend) * 12;
    context.globalAlpha = opacity * (far ? 0.64 : 1);
    context.strokeStyle = coat; context.lineWidth = 5; context.lineCap = 'round';
    context.beginPath(); context.moveTo(hip, -18 + hop); context.lineTo(kneeX, kneeY); context.lineTo(footX, footY); context.stroke();
    context.strokeStyle = '#2b3038'; context.lineWidth = 4.7; context.beginPath(); context.moveTo(footX - 1.4, footY); context.lineTo(footX + 3, footY); context.stroke();
    context.globalAlpha = opacity;
  };
  limb(-15, Math.PI + 0.5, true); limb(16, 0.45, true);
  context.save(); context.translate(0, hop);
  context.strokeStyle = '#493a35'; context.lineWidth = 4.5; context.beginPath(); context.moveTo(-27, -25); context.bezierCurveTo(-37, -23, -34 - stride * 3, -5, -42, -10 + stride * 6); context.stroke();
  context.fillStyle = coat; context.beginPath(); context.ellipse(-1, -25, 29, 12, 0.02, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.moveTo(12, -22); context.bezierCurveTo(21, -32, 16, -43, 30, -49); context.lineTo(37, -44); context.lineTo(28, -20); context.closePath(); context.fill();
  context.fillStyle = '#483a37'; context.beginPath(); context.moveTo(18, -27); context.lineTo(23, -45); context.lineTo(30, -50); context.lineTo(24, -29); context.fill();
  context.fillStyle = coat; context.beginPath(); context.ellipse(36, -43, 13, 8, 0.35, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.moveTo(27, -48); context.lineTo(27, -58); context.lineTo(32, -49); context.moveTo(35, -48); context.lineTo(38, -57); context.lineTo(40, -46); context.fill();
  context.fillStyle = '#e8d3b7'; context.beginPath(); context.ellipse(45, -39, 6.8, 5.7, 0.4, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#172636'; context.beginPath(); context.arc(37, -44, 1.3, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#334249'; context.lineWidth = 1.25; context.beginPath(); context.moveTo(45, -34); context.lineTo(36, -43); context.lineTo(7, -36); context.stroke();
  box(context, -16, -31, 29, 14, 3, candidate.color, '#233c47');
  label(context, String(index + 1), -2, -23, 9, '#102b36', true);
  const riderHop = reduced ? 0 : Math.sin(phase + 0.7) * speed * 1.3;
  context.save(); context.translate(4, -40 + riderHop);
  context.strokeStyle = '#e7e4d1'; context.lineWidth = 4.5; context.beginPath(); context.moveTo(-2, 1); context.lineTo(-5, 11); context.lineTo(6, 14); context.stroke();
  context.strokeStyle = '#23364c'; context.lineWidth = 3; context.beginPath(); context.moveTo(6, 14); context.lineTo(10, 14); context.stroke();
  context.fillStyle = candidate.color; context.beginPath(); context.ellipse(1, -4, 7.5, 10, -0.55, 0, Math.PI * 2); context.fill();
  context.strokeStyle = candidate.color; context.lineWidth = 4; context.beginPath(); context.moveTo(4, -8);
  if (cheering) { context.lineTo(9, -20 - Math.sin(clock / 240) * (reduced ? 0 : 3)); context.lineTo(15, -25); }
  else { context.lineTo(13, -1); context.lineTo(23, 2); }
  context.stroke();
  context.fillStyle = '#ecc49d'; context.beginPath(); context.arc(8, -17, 5.4, 0, Math.PI * 2); context.fill();
  context.fillStyle = candidate.color; context.beginPath(); context.arc(8, -19, 6.4, Math.PI, Math.PI * 2); context.fill();
  box(context, 2, -21, 15, 3, 1, '#edf2db');
  context.fillStyle = '#243543'; context.fillRect(9, -18, 4, 2);
  context.restore(); context.restore();
  limb(-15, Math.PI, false); limb(16, 0, false);
  context.restore();
}

function track(context: CanvasRenderingContext2D, width: number, height: number, clock: number, reduced: boolean) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#b4d6d7'); sky.addColorStop(0.36, '#d4e4d9'); sky.addColorStop(0.37, '#467e66'); sky.addColorStop(1, '#244f4d');
  context.fillStyle = sky; context.fillRect(0, 0, width, height);
  const standTop = Math.max(20, height * 0.08), standBottom = height * 0.28;
  box(context, width * 0.09, standTop, width * 0.82, Math.max(28, standBottom - standTop), 7, '#233e4a');
  for (let row = 0; row < 3; row++) {
    context.fillStyle = row % 2 ? '#d0d7c3' : '#b8c9bc'; context.fillRect(width * 0.1, standTop + 8 + row * Math.max(7, (standBottom - standTop - 13) / 3), width * 0.8, 3);
    for (let person = 0; person < 27; person++) {
      const x = width * 0.105 + person * width * 0.0295, y = standTop + 5 + row * Math.max(7, (standBottom - standTop - 13) / 3);
      context.fillStyle = ['#f3d07e', '#ed9670', '#78b8b0', '#dee5d4'][person % 4];
      context.fillRect(x, y + (reduced ? 0 : Math.sin(clock / 570 + person * 1.2 + row) * 1.2), Math.max(2, width / 210), 4);
    }
  }
  const cx = width * 0.5, cy = height * 0.61, rx = width * 0.415, ry = height * 0.28;
  context.fillStyle = '#c6aa83'; context.beginPath(); context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#9db57d'; context.beginPath(); context.ellipse(cx, cy, rx * 0.69, ry * 0.57, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#f1eedc'; context.lineWidth = Math.max(2, width / 430);
  for (const ratio of [1, 0.72]) { context.beginPath(); context.ellipse(cx, cy, rx * ratio, ry * (ratio === 1 ? 1 : 0.59), 0, 0, Math.PI * 2); context.stroke(); }
  context.strokeStyle = '#ede0bd55'; context.lineWidth = 1;
  for (let lane = 1; lane < 4; lane++) { context.beginPath(); context.ellipse(cx, cy, rx * (0.73 + lane * 0.065), ry * (0.6 + lane * 0.094), 0, 0, Math.PI * 2); context.stroke(); }
  const boardW = Math.min(185, width * 0.34), boardH = Math.min(40, height * 0.14);
  box(context, cx - boardW / 2, cy - boardH / 2, boardW, boardH, 5, '#183c42', '#d4d8b4');
  label(context, 'PIXEL DERBY', cx, cy - 2, clamp(width / 62, 9, 17), '#f5dc8f', true);
  for (let i = 0; i < 6; i++) {
    const x = width * (0.15 + i * 0.14), y = standTop - 6;
    context.strokeStyle = '#315254'; context.lineWidth = 1; context.beginPath(); context.moveTo(x, y); context.lineTo(x, standTop + 3); context.stroke();
    context.fillStyle = i % 2 ? '#ed9c76' : '#f1d481'; context.fillRect(x, y, 10 + (reduced ? 0 : Math.sin(clock / 570 + i) * 1.2), 5);
  }
  const finishX = cx + rx * 0.28, finishY = cy + ry * 0.88;
  context.save(); context.translate(finishX, finishY); context.rotate(-0.25);
  for (let i = 0; i < 5; i++) { context.fillStyle = i % 2 ? '#1c3541' : '#fff5d7'; context.fillRect(-4, -20 + i * 8, 8, 8); }
  context.restore();
}

function render(context: CanvasRenderingContext2D, width: number, height: number, props: SportsStageProps, elapsed: number, clock: number, reduced: boolean, camera: RaceCamera) {
  const phase = phaseAt(elapsed, props.duration, props.preview);
  const standings = standingsAt(props, reduced ? Math.floor(elapsed / 1600) * 1600 : elapsed, phase);
  const order = finalOrder(props);
  track(context, width, height, clock, reduced);
  if (!props.candidates.length) {
    label(context, '이름을 적으면 말들이 입장해요', width / 2, height * 0.83, clamp(width / 35, 10, 18), '#f7efdb', true);
    return;
  }
  const horseScale = clamp(width / 700, 0.47, 1.3);
  const lineup = phase === 'preview' || phase === 'paddock' || phase === 'countdown';
  const straight = phase === 'straight' || phase === 'photo';
  const winner = props.candidates.find(candidate => candidate.id === order[0])!;
  if (phase === 'winner') {
    context.fillStyle = '#15313de0'; context.fillRect(0, 0, width, height);
    const podiumY = height * 0.69;
    box(context, width * 0.23, podiumY, width * 0.54, Math.max(24, height * 0.14), 7, '#f2d182', '#fff0c3');
    label(context, 'WINNER', width / 2, height * 0.15, clamp(width / 30, 12, 24), '#f2d182', true);
    const heroScale = clamp(Math.min(width / 245, height / 108), 0.9, 2.8);
    horse(context, winner, props.candidates.indexOf(winner), width / 2, podiumY - 3, heroScale, 1, clock, 0.1, reduced, true);
    const nameSize = clamp(width / Math.max(19, winner.name.length * 1.7), 11, 23);
    label(context, winner.name, width / 2, podiumY + Math.max(13, height * 0.068), nameSize, '#203a43', true);
    label(context, '완주한 모든 말에게 박수를!', width / 2, height * 0.93, clamp(width / 42, 9, 15), '#d0e0d6', true);
    if (!reduced) for (let i = 0; i < 38; i++) {
      const x = (i * 83 + Math.sin(clock / 800 + i) * 15) % width, y = (clock / (6 + i % 4) + i * 31) % height;
      context.save(); context.translate(x, y); context.rotate(clock / 650 + i); context.fillStyle = [winner.color, '#f4d17c', '#c6e3d6'][i % 3]; context.fillRect(-2, -1, 4, 2); context.restore();
    }
    return;
  }
  if (straight) {
    const turf = context.createLinearGradient(0, 0, 0, height); turf.addColorStop(0, '#26454c'); turf.addColorStop(0.31, '#658b78'); turf.addColorStop(0.32, '#c6ac88'); turf.addColorStop(1, '#a38b68');
    context.fillStyle = turf; context.fillRect(0, 0, width, height);
    const shownCandidates = phase === 'photo' ? order.slice(0, 2).map(id => props.candidates.find(candidate => candidate.id === id)!) : props.candidates;
    const count = shownCandidates.length;
    const laneSpace = Math.min(height * 0.66 / Math.max(3, count), 42);
    const baseY = height * 0.27 + (height * 0.66 - laneSpace * count) / 2;
    const finishX = width * 0.79;
    for (let lane = 0; lane <= count; lane++) { context.strokeStyle = '#ecdbb258'; context.lineWidth = 1; context.beginPath(); context.moveTo(0, baseY + lane * laneSpace); context.lineTo(width, baseY + lane * laneSpace); context.stroke(); }
    for (let row = 0; row < Math.ceil(height / 8); row++) for (let col = 0; col < 2; col++) { context.fillStyle = (row + col) % 2 ? '#20363d' : '#fff6de'; context.fillRect(finishX + col * 6, row * 8, 6, 8); }
    label(context, phase === 'photo' ? 'PHOTO FINISH' : 'FINAL STRAIGHT', width * 0.06, height * 0.14, clamp(width / 34, 11, 20), '#ffeca8');
    shownCandidates.forEach((candidate, lane) => {
      const index = props.candidates.findIndex(item => item.id === candidate.id);
      const rank = order.indexOf(candidate.id);
      const standing = standings.find(value => value.id === candidate.id)!;
      const scale = phase === 'photo' ? clamp(Math.min(width / 250, height / 180), 0.45, 2.5) : Math.min(horseScale, laneSpace / 42 + 0.24);
      const x = phase === 'photo' ? finishX - 47 * scale + (rank === 0 ? 4 : -4) : clamp(width * 0.09 + (standing.distance - 0.79) / 0.22 * width * 0.7, 22, width - 18);
      const y = phase === 'photo' ? height * (0.53 + lane * 0.34) : baseY + (lane + 0.86) * laneSpace;
      horse(context, candidate, index, x, y, scale, 1, phase === 'photo' ? clock * 0.08 : clock, 1, reduced);
      if (rank < 2) {
        box(context, x - 12, y - 70 * scale, 24, 16, 5, '#ffe19a');
        label(context, String(index + 1).padStart(2, '0'), x, y - 70 * scale + 8, 10, '#17303c', true);
      }
      if (phase === 'photo') label(context, `${rank + 1}위 ${candidate.name}`, width * 0.06, y + 12, clamp(width * 0.68 / (candidate.name.length + 4), 8, 13), '#203945');
    });
    if (phase === 'photo') {
      context.strokeStyle = '#f9d282'; context.lineWidth = 3; context.strokeRect(4, 4, width - 8, height - 8);
    }
    return;
  }
  const cx = width * 0.5, cy = height * 0.61, rx = width * 0.415, ry = height * 0.28;
  const locations = props.candidates.map((candidate, index) => {
    const distance = standings.find(value => value.id === candidate.id)!.distance;
    if (lineup) {
      const columns = Math.min(5, props.candidates.length), row = Math.floor(index / columns), count = Math.min(columns, props.candidates.length - row * columns);
      return { candidate, index, x: cx + (index % columns - (count - 1) / 2) * width * (props.candidates.length > 5 ? 0.17 : 0.165), y: height * (props.candidates.length > 5 ? 0.59 + row * 0.3 : 0.83), direction: 1, scale: horseScale * (props.candidates.length > 5 ? 0.85 : 1) };
    }
    const angle = Math.PI * 0.41 - distance * Math.PI * 2;
    const lane = index % 3 * 0.095;
    const x = cx + Math.cos(angle) * rx * (0.77 + lane), y = cy + Math.sin(angle) * ry * (0.64 + lane * 1.35);
    const depth = (y - cy + ry) / (ry * 2);
    return { candidate, index, x, y, direction: Math.sin(angle) >= 0 ? 1 : -1, scale: horseScale * (0.63 + depth * 0.4) };
  }).sort((a, b) => a.y - b.y);
  locations.forEach(({ candidate, index, x, y, direction, scale }) => {
    if (!lineup && !reduced) for (let dust = 0; dust < 3; dust++) {
      const age = ((clock + index * 89 + dust * 157) % 600) / 600;
      context.fillStyle = `rgba(236,218,180,${(1 - age) * 0.28})`; context.beginPath(); context.ellipse(x - direction * (22 + age * 29) * scale, y + 2 - age * 7, (2 + age * 6) * scale, (1 + age * 2.5) * scale, 0, 0, Math.PI * 2); context.fill();
    }
    horse(context, candidate, index, x, y, scale, direction, clock, lineup ? 0 : 1, reduced);
    const pillX = x - 12, pillY = y - 67 * scale;
    box(context, pillX, pillY, 24, 16, 5, !lineup && candidate.id === standings[0]?.id ? '#ffe19a' : '#edf2e6e8');
    label(context, String(index + 1).padStart(2, '0'), x, pillY + 8, 10, '#244048', true);
  });
  // A held three-horse camera lets the viewer read individual strides and a real overtake.
  const corner = phase === 'race' ? elapsed >= 10500 && elapsed < 17000 ? [10500, 17000, 1] : elapsed >= 23500 && elapsed < 30000 ? [23500, 30000, 2] : undefined : undefined;
  if (corner) {
    const cameraKey = `${corner[2]}:${props.order.join('|')}:${props.candidates.map(candidate => candidate.id).join('|')}`;
    if (camera.key !== cameraKey) { camera.key = cameraKey; camera.ids = standings.slice(0, 3).map(standing => standing.id); }
    const fade = reduced ? 1 : Math.min(smooth((elapsed - corner[0]) / 550), smooth((corner[1] - elapsed) / 550));
    context.save(); context.globalAlpha = fade;
    const field = context.createLinearGradient(0, 0, 0, height); field.addColorStop(0, '#31565d'); field.addColorStop(0.3, '#729d80'); field.addColorStop(0.31, '#d1b68a'); field.addColorStop(1, '#af956e');
    context.fillStyle = field; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#f1edce'; context.lineWidth = 3; context.beginPath(); context.moveTo(0, height * 0.28); context.lineTo(width, height * 0.28); context.stroke();
    for (let post = 0; post < Math.ceil(width / 44) + 1; post++) {
      const x = post * 44 - clock / 15 % 44; context.fillStyle = '#e4e5c6'; context.fillRect(x, height * 0.16, 3, height * 0.13);
      context.fillStyle = '#ebd7ab80'; context.fillRect(x + 14, height * 0.9, 22, 2);
    }
    label(context, `제 ${corner[2]} 코너 · 선두권 중계`, width * 0.64, height * 0.12, clamp(width / 32, 9, 16), '#ffefb6', true);
    const group = camera.ids.map(id => ({ candidate: props.candidates.find(candidate => candidate.id === id)!, standing: standings.find(standing => standing.id === id)! })).filter(item => item.candidate && item.standing);
    const ahead = Math.max(...group.map(item => item.standing.distance));
    const scale = clamp(Math.min(width / 420, height / 165), 0.42, 1.7);
    group.forEach(({ candidate, standing }, lane) => {
      const index = props.candidates.findIndex(item => item.id === candidate.id);
      const x = clamp(width * 0.73 - (ahead - standing.distance) * width * 3.1, width * 0.17, width * 0.78);
      const y = height * (0.48 + lane * 0.205);
      if (!reduced) for (let dust = 0; dust < 4; dust++) {
        const age = ((clock + lane * 97 + dust * 149) % 650) / 650; context.fillStyle = `rgba(245,224,182,${(1 - age) * 0.35})`; context.beginPath(); context.ellipse(x - (24 + age * 43) * scale, y - age * 7, (3 + age * 6) * scale, (1 + age * 3) * scale, 0, 0, Math.PI * 2); context.fill();
      }
      horse(context, candidate, index, x, y, scale, 1, clock, 1, reduced);
      box(context, x - 12, y - 69 * scale, 24, 15, 4, '#f5d789');
      label(context, String(index + 1).padStart(2, '0'), x, y - 69 * scale + 7.5, 10, '#243b42', true);
      label(context, `${standings.findIndex(item => item.id === candidate.id) + 1}위 ${candidate.name}`, width * 0.055, y + 9, clamp(width * 0.45 / (candidate.name.length + 4), 8, 11), '#29434a');
    });
    context.restore();
  }
  if (phase === 'countdown') {
    const digit = Math.max(1, Math.ceil((5500 - elapsed) / 850));
    context.fillStyle = '#19363d65'; context.fillRect(0, 0, width, height);
    label(context, String(digit), width / 2, height * 0.42, clamp(height * 0.3, 30, 94), '#fff1b9', true);
  }
}

export default function RacingShow(props: SportsStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const synchronizedAt = useRef(performance.now());
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [view, setView] = useState(() => viewAt(props, props.elapsed));
  useEffect(() => { latest.current = props; synchronizedAt.current = performance.now(); }, [props]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    let width = 1, height = 1, ratio = 1, frame = 0, previous = performance.now(), clock = 0, boardAt = -1000, viewKey = '';
    let previousStandings: Standing[] = [], calloutUntil = 0, callout = '';
    const camera: RaceCamera = { key: '', ids: [] };
    const resize = () => {
      const rect = element.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height); ratio = Math.min(2, window.devicePixelRatio || 1);
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const animate = (now: number) => {
      const current = latest.current;
      const delta = Math.min(50, Math.max(0, now - previous)); previous = now;
      if (!current.paused && !reducedMotion) clock += delta;
      const elapsed = current.preview || current.paused ? current.elapsed : Math.min(current.duration, current.elapsed + Math.max(0, now - synchronizedAt.current));
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
      render(context, width, height, current, elapsed, clock, reducedMotion, camera);
      const phase = phaseAt(elapsed, current.duration, current.preview);
      const immediateKey = `${phase}:${current.order.join('|')}:${current.candidates.map(candidate => `${candidate.id}:${candidate.name}`).join('|')}`;
      if (now - boardAt >= 1000 || immediateKey !== viewKey) {
        boardAt = now; viewKey = immediateKey;
        const next = viewAt(current, elapsed);
        if (phase === 'race') {
          const mover = next.standings.map((standing, rank) => ({ id: standing.id, gain: previousStandings.findIndex(previous => previous.id === standing.id) - rank })).sort((a, b) => b.gain - a.gain)[0];
          if (!current.paused && elapsed >= calloutUntil && mover?.gain >= 2) {
            callout = `${current.candidates.find(candidate => candidate.id === mover.id)?.name} · 한 번에 ${mover.gain}계단 추월`;
            calloutUntil = elapsed + 2200;
          }
          if (elapsed < calloutUntil) next.headline = callout;
        } else { calloutUntil = 0; callout = ''; }
        previousStandings = next.standings;
        setView(next);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [reducedMotion]);
  const rows = props.candidates.length || 1;
  const style = { '--racing-count': rows, '--racing-compact-count': Math.ceil(rows / 2) } as CSSProperties;
  const finished = view.phase === 'winner';
  return <div className={`racing-show racing-phase-${view.phase} ${props.preview ? 'racing-preview' : ''}`} style={style}>
    <section className="racing-stage" aria-label="경마 경기장">
      <div className="racing-stage-top"><span><i aria-hidden="true" /> {props.preview ? 'PADDOCK PREVIEW' : finished ? 'RACE COMPLETE' : 'LIVE DERBY'}</span><span>1,600M · TURF</span></div>
      <div className="racing-canvas-wrap"><canvas ref={canvas} className="racing-canvas" role="img" aria-label={view.headline} /><div className="racing-phase-badge">{props.paused ? 'Ⅱ 일시정지' : { preview: '말을 만나 보세요', paddock: '출발 준비', countdown: 'STARTING GATE', race: '첫 바퀴', straight: '마지막 직선', photo: '사진 판정', winner: 'WINNER’S CIRCLE' }[view.phase]}</div></div>
      <div className="racing-commentary" aria-live={finished ? 'polite' : 'off'}><strong>{view.headline}</strong><p>{view.detail}</p></div>
    </section>
    <aside className="racing-board" aria-label={finished ? '경마 최종 순위' : '경마 실시간 순위'}>
      <div className="racing-board-heading"><span>{props.preview ? 'MEET THE HORSES' : finished ? 'FINAL RESULT' : 'LIVE POSITIONS'}</span><h2>{props.preview ? '오늘의 경주마' : finished ? '전원 완주 · 최종 순위' : '경기 순위'}</h2></div>
      <ol className="racing-standings">
        {props.candidates.map((candidate, index) => {
          const rank = view.standings.findIndex(standing => standing.id === candidate.id);
          const position = Math.max(0, rank);
          const rowStyle = { '--racing-rank': position, '--racing-column': position % 2, '--racing-row': Math.floor(position / 2), '--racing-color': candidate.color } as CSSProperties;
          return <li className={`racing-horse-row ${!props.preview && position === 0 ? 'racing-is-leading' : ''}`} key={candidate.id} style={rowStyle} aria-label={`${candidate.name}${!props.preview ? `, ${position + 1}위` : ''}`} title={candidate.name}>
            <span className="racing-rank">{props.preview ? '—' : String(position + 1).padStart(2, '0')}</span><span className="racing-silk">{String(index + 1).padStart(2, '0')}</span><span className="racing-horse-name">{candidate.name}</span><span className="racing-horse-state">{finished ? position === 0 ? '★' : '완주' : props.preview ? '출전' : position === 0 ? '선두' : '추격'}</span>
          </li>;
        })}
        {!props.candidates.length && <li className="racing-empty">후보 이름을 입력하면<br />나만의 경주마가 등장해요.</li>}
      </ol>
      <p className="racing-board-note">번호와 기수 색상으로 구분해요 · 모든 말의 우승 확률은 같아요</p>
    </aside>
  </div>;
}
