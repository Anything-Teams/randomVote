import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Candidate } from './election';
import type { SportsStageProps } from './sports';
import './arena.css';

type FighterPose = 'ready' | 'grip' | 'push' | 'dodge' | 'lift' | 'fall' | 'cheer' | 'clap' | 'bow';
type Bout = { index: number; attacker: string; victim: string; start: number; resolve: number; end: number; final: boolean; move: number };
type PlacedFighter = { candidate: Candidate; x: number; y: number; scale: number; facing: number; pose: FighterPose; angle: number; alpha: number; rank?: number; nameVisible?: boolean };
type ArenaMotion = { signature: string; positions: Map<string, { x: number; y: number }>; exits: Map<string, { x: number; y: number; angle: number; scale: number }> };
const W = 1000;
const H = 620;
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const moves = ['들배지기', '밀어내기', '되치기', '몸통 잡기'];
const font = (size: number) => `800 ${size}px "Malgun Gothic", sans-serif`;

function completeOrder(candidates: Candidate[], order: string[]) {
  const ids = new Set(candidates.map(candidate => candidate.id));
  const valid = [...new Set(order)].filter(id => ids.has(id));
  return [...valid, ...candidates.map(candidate => candidate.id).filter(id => !valid.includes(id))];
}

function boutsFor(order: string[], duration: number): Bout[] {
  const n = order.length;
  if (n < 2) return [];
  const unit = (duration || 44_000) / 44;
  const count = n - 2;
  const spacing = 24.4 * unit / Math.max(1, count);
  const bouts = Array.from({ length: count }, (_, index) => {
    const survivors = order.slice(0, n - index - 1);
    const start = 5 * unit + (index + 1) * spacing - Math.min(3.2 * unit, spacing);
    const resolve = start + Math.min(2.2 * unit, spacing * 0.68);
    return { index, attacker: survivors[(index * 3 + 1) % survivors.length], victim: order[n - index - 1], start, resolve, end: Math.min(start + spacing, resolve + 1.4 * unit), final: false, move: index % moves.length };
  });
  bouts.push({ index: count, attacker: order[0], victim: order[1], start: 30 * unit, resolve: 37 * unit, end: duration, final: true, move: 0 });
  return bouts;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#fff2d5', width = 900) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let actual = size;
  ctx.font = font(actual);
  while (ctx.measureText(text).width > width && actual > 8) ctx.font = font(--actual);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, width);
}

function dust(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, strength = 1) {
  if (age < 0 || age > 1000) return;
  const p = age / 1000;
  for (let i = 0; i < 15; i++) {
    const angle = i * 2.399;
    const reach = (25 + i % 5 * 12) * ease(p) * strength;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.fillStyle = i % 3 ? '#e3bf86' : '#fff0c7';
    const size = Math.max(2, (7 + i % 3 * 3) * (1 - p * 0.6));
    ctx.fillRect(Math.round(x + Math.cos(angle) * reach), Math.round(y + Math.sin(angle) * reach * 0.35 - Math.sin(p * Math.PI) * 18), size, size);
  }
  ctx.globalAlpha = 1;
}

function fighter(ctx: CanvasRenderingContext2D, item: PlacedFighter, index: number, time: number) {
  const { x, y, scale, facing, pose, angle, alpha } = item;
  const clock = time + index * 487;
  const pulse = Math.sin(clock / (270 + index % 3 * 45));
  const skin = ['#eab187', '#c68c66', '#f3c99d', '#ad7656'][index % 4];
  const hair = ['#172337', '#47342d', '#715044', '#263747'][index % 4];
  let la = -45, ra = 45, le = 20, re = -20, ll = -7, rl = 7, lean = 0, rise = pulse * 0.4, mouth = 2;
  if (pose === 'grip') { la = -65; ra = 61; le = -8; re = 7; lean = 6 + pulse; ll = -16; rl = 12; }
  if (pose === 'push') { la = -74; ra = 72; le = -5; re = 5; lean = 15 + pulse * 2; ll = -19 + pulse * 10; rl = 20 - pulse * 6; }
  if (pose === 'dodge') { la = -100; ra = 93; le = -25; re = 22; lean = -15; ll = -25; rl = 25; rise = 1; }
  if (pose === 'lift') { la = 144; ra = -137; le = -17; re = 13; lean = -5; ll = -13; rl = 13; rise = -Math.max(0, pulse) * 1.2; }
  if (pose === 'fall') { la = -110; ra = 108; le = 29; re = -31; ll = -33; rl = 37; mouth = 5; }
  if (pose === 'cheer') { la = 147 + pulse * 9; ra = -140 - pulse * 11; le = -17; re = 13; rise = -Math.max(0, Math.sin(clock / 380)) * 4; mouth = 4; }
  if (pose === 'clap') { la = -53 - pulse * 10; ra = 53 + pulse * 10; le = 9; re = -9; lean = pulse; }
  if (pose === 'bow') { la = -4; ra = 3; le = 4; re = -4; lean = 9 + Math.sin(clock / 860) * 3; mouth = 1; }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#31233166';
  ctx.beginPath(); ctx.ellipse(x, y + 3, scale * 18, scale * 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(angle); ctx.scale(scale * facing, scale);
  ctx.translate(0, rise); ctx.rotate(lean * Math.PI / 180);
  const rect = (px: number, py: number, width: number, height: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(px, py, width, height); };
  const limb = (px: number, py: number, upper: number, lower: number, leg: boolean) => {
    ctx.save(); ctx.translate(px, py); ctx.rotate(upper * Math.PI / 180);
    rect(-3, -2, 6, 12, leg ? item.candidate.color : skin);
    ctx.translate(0, 8); ctx.rotate(lower * Math.PI / 180);
    rect(-3, -2, 6, leg ? 12 : 11, skin);
    if (leg) rect(-4, 7, 10, 4, skin); else rect(-3, 7, 6, 5, skin);
    rect(-3, 0, 1, 7, '#81594355');
    ctx.restore();
  };
  limb(-6, -16, ll, Math.max(0, -pulse) * 10, true);
  limb(5, -16, rl, Math.max(0, pulse) * 10, true);
  limb(-11, -37, la, le, false); limb(11, -37, ra, re, false);
  rect(-10, -38, 20, 24, skin); rect(6, -36, 4, 20, '#81594344');
  rect(-11, -21, 22, 5, item.candidate.color);
  rect(-11, -17, 22, 5, item.candidate.color); rect(-2, -21, 4, 8, '#fff0cf');
  rect(-3, -44, 6, 8, skin);
  rect(-8, -59, 16, 18, skin); rect(-10, -56, 2, 7, skin); rect(8, -56, 2, 7, skin);
  rect(-9, -63, 18, 7, hair); rect(-9, -57, 3, 7, hair); rect(6, -57, 3, 5, hair);
  rect(-4, -51, 2, pose === 'fall' ? 3 : 2, '#1a2534'); rect(3, -51, 2, pose === 'fall' ? 3 : 2, '#1a2534');
  rect(-5, -54, 4, 1, hair); rect(2, -54, 4, 1, hair); rect(-1, -46, 3, mouth, '#995544');
  ctx.restore();
  if (item.rank) {
    const beside = x < 140 || x > 860;
    label(ctx, `${item.rank}위`, beside ? x + (x < 500 ? -32 : 32) : x, beside ? y - 36 : y + 4, beside ? 12 : 15, '#f0c48b', 110);
  }
  if (item.nameVisible !== false) label(ctx, item.candidate.name, x, y + (item.rank ? 23 : 8), item.rank ? 12 : 14, item.rank ? '#c7b8a6' : '#fff1d7', item.rank ? 116 : 148);
  else if (!item.rank) {
    ctx.fillStyle = '#17313dcc'; ctx.fillRect(x - 10, y + 6, 20, 19);
    label(ctx, `${index + 1}`, x, y + 8, 12, item.candidate.color, 18);
  }
}

function paint(ctx: CanvasRenderingContext2D, props: SportsStageProps, elapsed: number, clock: number, motion: ArenaMotion, delta: number) {
  const { candidates, preview } = props;
  const order = completeOrder(candidates, props.order);
  const signature = `${preview}:${candidates.map(candidate => candidate.id).join(',')}:${props.order.join(',')}`;
  if (motion.signature !== signature) { motion.signature = signature; motion.positions.clear(); motion.exits.clear(); }
  const bouts = boutsFor(order, props.duration);
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const resolved = preview ? [] : bouts.filter(bout => elapsed >= bout.resolve);
  const eliminated = new Map(resolved.map(bout => [bout.victim, order.indexOf(bout.victim) + 1]));
  const current = preview ? undefined : bouts.find(bout => elapsed >= bout.start && elapsed < bout.end);
  const won = !preview && candidates.length > 1 && elapsed >= bouts.at(-1)!.resolve;
  ctx.fillStyle = '#172b34'; ctx.fillRect(0, 0, W, H);
  const background = ctx.createLinearGradient(0, 0, 0, H); background.addColorStop(0, '#162633'); background.addColorStop(1, '#39444a');
  ctx.fillStyle = background; ctx.fillRect(0, 0, W, H);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 33; i++) {
    const px = 13 + i * 31 + row % 2 * 9; const py = 129 + row * 17;
    ctx.fillStyle = ['#43616b', '#597482', '#946f68'][i % 3]; ctx.fillRect(px, py, 7, 8);
    ctx.fillStyle = '#314a59'; ctx.fillRect(px - 3, py + 7, 13, 9);
  }
  ctx.fillStyle = '#795c49'; ctx.beginPath(); ctx.ellipse(500, 416, 358, 164, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d6ae73'; ctx.beginPath(); ctx.ellipse(500, 392, 345, 157, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff0bc'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(500, 385, 313, 137, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#987340'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(500, 385, 308, 132, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 190; i++) {
    const px = 172 + (i * 113) % 652, py = 253 + (i * 67) % 263;
    if ((px - 500) ** 2 / 312 ** 2 + (py - 385) ** 2 / 132 ** 2 > 1) continue;
    ctx.fillStyle = i % 3 ? '#caa166' : '#e9c48a'; ctx.fillRect(px, py, 3 + i % 2, 2);
  }
  ctx.strokeStyle = '#b78c52'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(456, 399); ctx.lineTo(485, 399); ctx.moveTo(515, 399); ctx.lineTo(544, 399); ctx.stroke();
  const title = preview ? '모래판 난투 · 전원 출전!' : won ? '한 판! 우 승 확 정' : current?.final ? '마지막 두 명 · 최후의 버티기' : '모두 뒤엉킨 모래판 · 장외 난투';
  label(ctx, title, 500, 23, won ? 42 : 30, won ? '#ffdf80' : '#ffedc6');
  if (!candidates.length) {
    label(ctx, '후보를 입력하면 모래판에 모입니다', 500, 320, 28, '#624b36');
    label(ctx, '최대 10명, 한 판에서 동시에 맞붙습니다', 500, 368, 18, '#7c6040');
    return;
  }
  const attacker = current ? byId.get(current.attacker) : undefined;
  const victim = current ? byId.get(current.victim) : undefined;
  if (won) label(ctx, byId.get(order[0])?.name ?? '', 500, 78, 35, '#fff6d8', 580);
  else if (current?.final && attacker && victim) label(ctx, `${attacker.name} · ${victim.name}, 마지막까지 버팁니다`, 500, 71, 22, '#d5e4df', 914);
  else label(ctx, preview ? '색 띠와 번호로 참가자를 구분합니다' : `${candidates.length - eliminated.size}명 생존 · 여러 곳에서 밀고, 버티고, 뒤집습니다`, 500, 70, 19, '#bad3d2');
  const figures: PlacedFighter[] = [];
  const alive = candidates.filter(candidate => !eliminated.has(candidate.id));
  const groupCount = Math.max(1, Math.ceil(alive.length / 3));
  const centers = groupCount === 1 ? [[500, 397]] : groupCount === 2 ? [[346, 394], [654, 405]] : groupCount === 3 ? [[307, 350], [693, 350], [500, 464]] : [[307, 341], [693, 341], [350, 466], [650, 466]];
  const homes = new Map<string, { x: number; y: number }>();
  alive.forEach((candidate, index) => {
    const group = Math.floor(index / 3), slot = index % 3;
    const size = Math.min(3, alive.length - group * 3);
    const center = centers[group];
    const x = center[0] + (slot - (size - 1) / 2) * 57 + Math.sin(clock / 870 + index) * 8;
    const y = center[1] + slot % 2 * 13 + Math.sin(clock / 690 + index * 0.9) * 5;
    const previous = motion.positions.get(candidate.id) ?? { x, y };
    const blend = props.paused ? 0 : 1 - Math.exp(-delta / 240);
    const position = { x: mix(previous.x, x, blend), y: mix(previous.y, y, blend) };
    motion.positions.set(candidate.id, position); homes.set(candidate.id, position);
  });
  candidates.forEach((candidate, index) => {
    const rank = eliminated.get(candidate.id);
    if (rank) {
      const outIndex = resolved.findIndex(bout => bout.victim === candidate.id);
      const side = outIndex % 2;
      const row = Math.floor(outIndex / 2);
      figures.push({ candidate, x: side ? 926 : 74, y: 269 + row * 72, scale: 1.05, facing: side ? -1 : 1, pose: Math.floor((clock + index * 401) / 2300) % 3 ? 'clap' : 'bow', angle: 0, alpha: 0.64, rank, nameVisible: false });
      return;
    }
    if (current && (candidate.id === current.attacker || candidate.id === current.victim)) return;
    if (won && candidate.id === order[0]) return;
    const position = homes.get(candidate.id)!;
    const activeIndex = alive.findIndex(item => item.id === candidate.id);
    const cycle = (clock + Math.floor(activeIndex / 3) * 790 + activeIndex % 3 * 260) % 3800;
    const pose: FighterPose = preview ? index % 3 ? 'ready' : 'clap' : won ? 'clap' : cycle < 500 ? 'ready' : cycle < 1650 ? 'grip' : cycle < 2440 ? index % 3 ? 'push' : 'lift' : cycle < 3100 ? 'dodge' : 'grip';
    figures.push({ candidate, ...position, scale: 2.04, facing: activeIndex % 3 === 2 ? -1 : 1, pose, angle: !preview && !won && cycle > 2440 && cycle < 3100 ? Math.sin((cycle - 2440) / 660 * Math.PI) * (index % 2 ? -0.2 : 0.2) : 0, alpha: 1, nameVisible: preview });
    if (!preview && !won) dust(ctx, position.x, position.y + 2, cycle - 1960, 0.45);
  });
  if (attacker && victim && !won && elapsed < current!.resolve) {
    const action = current!;
    const span = action.resolve - action.start;
    const p = clamp((elapsed - action.start) / span);
    const homeA = homes.get(attacker.id) ?? { x: 438, y: 424 };
    const homeB = homes.get(victim.id) ?? { x: 562, y: 424 };
    const anchorX = action.final ? 500 : clamp((homeA.x + homeB.x) / 2, 288, 707);
    const anchorY = action.final ? 424 : Math.max(homeA.y, homeB.y);
    const attack: PlacedFighter = { candidate: attacker, x: anchorX - 62, y: anchorY, scale: action.final ? 2.85 : 2.04, facing: 1, pose: 'ready', angle: 0, alpha: 1, nameVisible: action.final };
    const defend: PlacedFighter = { candidate: victim, x: anchorX + 62, y: anchorY, scale: action.final ? 2.85 : 2.04, facing: -1, pose: 'ready', angle: 0, alpha: 1, nameVisible: action.final };
    const approach = ease(p / 0.22);
    attack.x = mix(anchorX - 62, anchorX - 28, approach); defend.x = mix(anchorX + 62, anchorX + 28, approach);
    attack.pose = defend.pose = p < 0.19 ? 'ready' : 'grip';
    if (action.final) {
      const tug = Math.sin(p * Math.PI * 6) * Math.sin(p * Math.PI) * 15;
      attack.x += tug; defend.x += tug;
      if (p > 0.64) { const lift = ease((p - 0.64) / 0.22); attack.pose = 'lift'; defend.pose = 'fall'; defend.y -= lift * 105; defend.x = mix(528, 575, lift); defend.angle = lift * -1.55; }
      if (p > 0.89) { const land = ease((p - 0.89) / 0.11); defend.y = mix(319, 439, land); defend.x = mix(575, 874, land); defend.angle = mix(-1.55, -1.8, land); }
    } else if (action.move === 0) {
      const flip = ease((p - 0.45) / 0.39); attack.pose = p > 0.45 ? 'lift' : 'grip'; defend.pose = p > 0.45 ? 'fall' : 'grip';
      defend.x += flip * 119; defend.y -= Math.sin(flip * Math.PI) * 76; defend.angle = -flip * 1.7;
    } else if (action.move === 1) {
      const push = ease((p - 0.32) / 0.6); attack.pose = 'push'; defend.pose = push > 0.65 ? 'fall' : 'grip'; attack.x += push * 70; defend.x += push * 220; defend.angle = -push * 0.85;
    } else if (action.move === 2) {
      const dodge = ease((p - 0.32) / 0.5); attack.pose = 'dodge'; attack.x -= dodge * 45; defend.pose = dodge > 0.5 ? 'fall' : 'push'; defend.x = mix(anchorX + 28, anchorX - 163, dodge); defend.angle = dodge * 1.65; defend.y += dodge * 11;
    } else {
      const turn = ease((p - 0.4) / 0.48); attack.pose = turn > 0.5 ? 'lift' : 'grip'; defend.pose = turn > 0.5 ? 'fall' : 'grip'; attack.x += turn * 22; defend.x += turn * 106; defend.angle = -turn * 1.3; defend.y -= Math.sin(turn * Math.PI) * 46;
    }
    if (!action.final) {
      const exitRight = action.index % 2 === 1;
      const naturalRight = action.move !== 2;
      if (exitRight !== naturalRight) {
        attack.x = anchorX * 2 - attack.x; defend.x = anchorX * 2 - defend.x;
        attack.facing *= -1; defend.facing *= -1; defend.angle *= -1;
      }
      // Cross the ring before the placement appears, then settle on the same side.
      const out = ease((p - 0.81) / 0.19);
      defend.x = mix(defend.x, exitRight ? 912 : 88, out);
      defend.y = mix(defend.y, 436, out);
      if (out > 0) { defend.pose = 'fall'; defend.angle = mix(defend.angle, exitRight ? -1.5 : 1.5, out); }
    }
    figures.push(attack, defend);
    motion.exits.set(victim.id, { x: defend.x, y: defend.y, angle: defend.angle, scale: defend.scale });
    const late = p > 0.9;
    label(ctx, action.final && p < 0.65 ? '팽팽한 힘겨루기… 한 번의 타이밍!' : late ? `${victim.name}, 장외 위기!` : `${moves[action.move]}! 난투 속에서 중심을 빼앗습니다`, 500, 574, 19, '#fff0d2');
    dust(ctx, defend.x, 429, (p - 0.84) * span, action.final ? 1.6 : 1);
  }
  if (current && !won && elapsed >= current.resolve) {
    const age = elapsed - current.resolve;
    const outIndex = resolved.findIndex(bout => bout.victim === current.victim);
    const side = outIndex % 2;
    const entry = figures.find(item => item.candidate.id === current.victim);
    if (entry) {
      const travel = ease(age / 950);
      const start = motion.exits.get(current.victim) ?? { x: side ? 652 : 348, y: 434, scale: 2.04, angle: side ? -1.4 : 1.4 };
      entry.x = mix(start.x, side ? 926 : 74, travel);
      entry.y = mix(start.y, 269 + Math.floor(outIndex / 2) * 72, travel);
      entry.scale = mix(start.scale, 1.05, travel); entry.angle = start.angle * (1 - travel);
      entry.pose = travel < 0.9 ? 'fall' : 'bow'; entry.alpha = mix(1, 0.64, travel);
    }
    if (attacker) {
      const home = homes.get(attacker.id) ?? { x: 476, y: 424 };
      figures.push({ candidate: attacker, ...home, scale: 2.04, facing: 1, pose: age < 500 ? 'cheer' : 'grip', angle: 0, alpha: 1, nameVisible: false });
    }
    label(ctx, `장외! ${byId.get(current.victim)?.name ?? ''} · ${order.indexOf(current.victim) + 1}위 확정`, 500, 116, 23, '#ffdd83', 870);
    dust(ctx, side ? 772 : 228, 435, age, 1.4);
  }
  if (won) {
    const winner = byId.get(order[0])!;
    const age = elapsed - bouts.at(-1)!.resolve;
    const rise = ease((age - 450) / 900);
    const float = Math.sin(clock / 600) * 5;
    const winnerY = 448 - rise * 63 + float;
    figures.push({ candidate: winner, x: 500, y: winnerY, scale: 3.5, facing: 1, pose: 'cheer', angle: 0, alpha: 1 });
    const supporters = [order[1], order.at(-1)].filter((id, index, list): id is string => !!id && list.indexOf(id) === index);
    supporters.forEach(id => {
      const candidate = byId.get(id)!;
      const existing = figures.findIndex(item => item.candidate.id === id);
      const previous = existing >= 0 ? figures[existing] : undefined;
      if (existing >= 0) figures.splice(existing, 1);
      const home = id === order[1] ? motion.exits.get(id) : previous;
      const targetX = supporters.length === 1 ? 500 : id === order[1] ? 573 : 427;
      const arrive = ease(age / 1300);
      figures.push({ candidate, x: mix(home?.x ?? targetX, targetX, arrive), y: mix(home?.y ?? 474, 474 + float * 0.5, arrive), scale: mix(home?.scale ?? 2.25, 2.25, arrive), facing: targetX > 500 ? -1 : 1, pose: age < 500 && id === order[1] ? 'fall' : 'lift', angle: (home?.angle ?? 0) * (1 - arrive), alpha: 1, rank: order.indexOf(id) + 1 });
    });
    label(ctx, '승부 끝! 함께 들어 올리는 오늘의 장사', 500, 570, 22, '#ffeebd');
    dust(ctx, 500, 448, age, 2);
    for (let i = 0; i < 42; i++) {
      const fall = (clock * (0.045 + i % 4 * 0.008) + i * 47) % 510;
      const px = 80 + (i * 131) % 840 + Math.sin(clock / 500 + i) * 12;
      ctx.fillStyle = ['#ffdb6b', '#83d7ca', '#f19c85'][i % 3];
      ctx.fillRect(px, 90 + fall, 6, 4 + i % 3);
    }
  } else if (!current) label(ctx, preview ? '시작하면 모든 참가자가 동시에 맞붙습니다' : '여러 무리가 뒤엉킵니다 · 끝까지 모래판에 남으세요', 500, 573, 19, '#fff0d2');
  figures.sort((a, b) => a.y - b.y).forEach(item => fighter(ctx, item, candidates.findIndex(candidate => candidate.id === item.candidate.id), clock));
}

export default function ArenaShow(props: SportsStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const sampledAt = useRef(0);
  latest.current = props;
  useEffect(() => { sampledAt.current = performance.now(); }, [props.elapsed, props.paused, props.preview]);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, previous = 0, clock = 0;
    const motion: ArenaMotion = { signature: '', positions: new Map(), exits: new Map() };
    const draw = (now: number) => {
      const state = latest.current;
      const delta = previous ? Math.min(50, Math.max(0, now - previous)) : 16;
      previous = now;
      if (!state.paused && !motionPreference.matches) clock += delta;
      const box = element.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(box.width * ratio)), height = Math.max(1, Math.round(box.height * ratio));
      if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#172b34'; ctx.fillRect(0, 0, width, height);
      const scale = Math.min(width / W, height / H);
      ctx.setTransform(scale, 0, 0, scale, (width - W * scale) / 2, (height - H * scale) / 2);
      ctx.imageSmoothingEnabled = false;
      const elapsed = clamp(state.elapsed + (state.paused || state.preview ? 0 : Math.min(80, Math.max(0, now - sampledAt.current))), 0, state.duration);
      paint(ctx, state, elapsed, clock, motion, delta);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  const order = useMemo(() => completeOrder(props.candidates, props.order), [props.candidates, props.order]);
  const bouts = useMemo(() => boutsFor(order, props.duration), [order, props.duration]);
  const finished = !props.preview && !!bouts.length && props.elapsed >= bouts.at(-1)!.resolve;
  const ranks = new Map(props.preview ? [] : bouts.filter(bout => props.elapsed >= bout.resolve).map(bout => [bout.victim, order.indexOf(bout.victim) + 1]));
  if (finished) ranks.set(order[0], 1);
  const alive = props.candidates.length - [...ranks.values()].filter(rank => rank !== 1).length;
  return <section className="arena-show" aria-label="전원 장외 난투 경기">
    <div className="arena-stage">
      <canvas ref={canvas} className="arena-canvas" role="img" aria-label={finished ? `${props.candidates.find(candidate => candidate.id === order[0])?.name} 우승` : '전원이 동시에 싸우는 모래판 장외 난투'} />
      {props.paused && <div className="arena-paused">경기 잠시 멈춤</div>}
    </div>
    <aside className="arena-board" aria-label="난투 생존 및 순위">
      <header className="arena-board-heading"><strong>{finished ? '최종 순위' : '모래판 현황'}</strong><span>{props.preview ? `${props.candidates.length}명 출전` : finished ? '승부 확정' : `${alive}명 생존`}</span></header>
      <div className="arena-roster" role="list" style={{ '--arena-count': Math.max(1, props.candidates.length), '--arena-columns': Math.max(1, Math.min(5, props.candidates.length)), '--arena-rows': Math.max(1, Math.ceil(props.candidates.length / 5)) } as CSSProperties}>
        {(finished ? [...props.candidates].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : props.candidates).map((candidate, index) => {
          const rank = ranks.get(candidate.id);
          return <div key={candidate.id} role="listitem" className={`arena-entry${rank ? rank === 1 ? ' arena-champion' : ' arena-eliminated' : ''}`} style={{ '--arena-color': candidate.color } as CSSProperties} aria-label={`${candidate.name}, ${rank ? `${rank}위 확정` : '생존'}`} title={`${candidate.name} · ${rank ? `${rank}위 확정` : '생존'}`}>
            <span className="arena-number">{rank === 1 ? '★' : rank ?? index + 1}</span>
            <span className="arena-name">{candidate.name}</span>
            <span className="arena-state">{rank === 1 ? '우승' : rank ? `${rank}위` : props.preview ? '준비' : '생존'}</span>
          </div>;
        })}
        {!props.candidates.length && <p className="arena-empty">후보를 입력해 주세요</p>}
      </div>
    </aside>
  </section>;
}
