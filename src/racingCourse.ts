import type { Candidate } from './election';

export type RacingCourseStanding = { id: string; distance: number };
export type RacingCoursePosition = { x: number; y: number; angle: number };
const TAU = Math.PI * 2;
const coats = ['#956040', '#4b4144', '#bd8858', '#d4cab6', '#796457', '#ac663f'];
const shadows = ['#583928', '#302e35', '#805632', '#a09b90', '#514a41', '#773e28'];
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const arcTables = new Map<string, { distances: number[]; total: number }>();
function geometry(w: number, h: number) {
  return { cx: w * .49, cy: h * .55, rx: w * .365, ry: h * .29, trackX: Math.min(w * .092, h * .46), trackY: Math.min(h * .115, w * .03) };
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = '800 ' + size + 'px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, border?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(2, w / 3, h / 3)); ctx.fillStyle = color; ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = .7; ctx.stroke(); }
}

function courseAngle(rx: number, ry: number, distance: number) {
  const key = rx + ':' + ry;
  let arc = arcTables.get(key);
  if (!arc) {
    const distances = [0]; let previousX = rx, previousY = 0;
    for (let step = 1; step <= 256; step++) { const theta = step / 256 * TAU, x = Math.cos(theta) * rx, y = Math.sin(theta) * ry; distances.push(distances[step - 1] + Math.hypot(x - previousX, y - previousY)); previousX = x; previousY = y; }
    arc = { distances, total: distances[256] };
    if (arcTables.size >= 24) arcTables.clear();
    arcTables.set(key, arc);
  }
  const progress = ((distance % 1) + 1) % 1, target = progress * arc.total;
  let low = 0, high = 256;
  while (high - low > 1) { const middle = Math.floor((low + high) / 2); if (arc.distances[middle] < target) low = middle; else high = middle; }
  return (low + (target - arc.distances[low]) / Math.max(.0001, arc.distances[high] - arc.distances[low])) / 256 * TAU;
}

/** Zero and one are the same line on the right straight; travel is clockwise. */
export function racingCoursePoint(w: number, h: number, distance: number, laneIndex: number, count: number): RacingCoursePosition {
  const { cx, cy, rx, ry, trackX, trackY } = geometry(w, h);
  const lane = (clamp(laneIndex, 0, Math.max(0, count - 1)) + .5) / Math.max(1, count) - .5;
  const radiusX = rx + lane * trackX * .76, radiusY = ry + lane * trackY * .76;
  // Arc length, rather than angle, keeps the short ends from slowing the field to a crawl.
  const theta = courseAngle(radiusX, radiusY, Number.isFinite(distance) ? distance : 0);
  return { x: cx + Math.cos(theta) * radiusX, y: cy + Math.sin(theta) * radiusY, angle: Math.atan2(Math.cos(theta) * radiusY, -Math.sin(theta) * radiusX) };
}

function courseArchitecture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { cx, cy, rx, ry, trackX, trackY } = geometry(w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#091523'); sky.addColorStop(.5, '#192b35'); sky.addColorStop(1, '#112927'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // Roof, lit concourses, stair aisles and individually colored spectators surround the circuit.
  ctx.fillStyle = '#091725'; ctx.beginPath(); ctx.moveTo(0, h * .02); ctx.lineTo(w * .5, 0); ctx.lineTo(w, h * .045); ctx.lineTo(w, h * .082); ctx.lineTo(0, h * .064); ctx.fill();
  const rows = h < 120 ? 3 : 5, seat = Math.max(3.2, w / 130), rowH = Math.max(2.8, h * .025);
  for (let row = 0; row < rows; row++) {
    const y = h * .073 + row * rowH;
    ctx.fillStyle = row % 2 ? '#273e4d' : '#344b57'; ctx.fillRect(w * .065, y, w * .84, rowH);
    for (let person = 0; person < w * .84 / seat; person++) {
      const px = w * .065 + person * seat, py = y + rowH * .15;
      if (person % 21 < 2) { ctx.fillStyle = '#70858a'; ctx.fillRect(px, y, seat, rowH); continue; }
      ctx.fillStyle = ['#e0b58e', '#bc8a6e', '#e7c5a0'][Math.abs(person + row) % 3]; ctx.fillRect(px, py, seat * .34, rowH * .29);
      ctx.fillStyle = ['#ab7469', '#669cab', '#d4b46d', '#81997c', '#9a88ab'][(person * 3 + row) % 5]; ctx.fillRect(px - seat * .1, py + rowH * .29, seat * .57, rowH * .47);
    }
    ctx.fillStyle = '#9aa89977'; ctx.fillRect(w * .065, y + rowH - .6, w * .84, .7);
  }
  const boardY = h * .073 + rows * rowH + 1, boardH = Math.max(5, h * .025);
  for (let panel = 0; panel < 8; panel++) {
    const bx = w * (.07 + panel * .102); ctx.fillStyle = panel % 2 ? '#a89267' : '#2c5360'; ctx.fillRect(bx, boardY, w * .095, boardH);
    if (h > 150) label(ctx, ['DERBY CLUB', 'NIGHT RACE', 'FULL GALLOP', '1600 M'][panel % 4], bx + w * .0475, boardY + boardH / 2, Math.max(4, boardH * .65), panel % 2 ? '#263b43' : '#d8dfbb');
  }
  // A raised dark lip and pale rail make the track's width legible even at phone sizes.
  ellipse(ctx, cx, cy + trackY * .17, rx + trackX * .62, ry + trackY * .67, '#080f17');
  ellipse(ctx, cx, cy, rx + trackX * .58, ry + trackY * .59, '#e2d0a0');
  const track = ctx.createLinearGradient(0, cy - ry, 0, cy + ry); track.addColorStop(0, '#746049'); track.addColorStop(.5, '#bc9762'); track.addColorStop(1, '#a88455');
  ellipse(ctx, cx, cy, rx + trackX * .49, ry + trackY * .49, track);
  for (let path = 0; path < 8; path++) {
    const depth = path / 7 - .5; ctx.beginPath(); ctx.ellipse(cx, cy, rx + depth * trackX * .83, ry + depth * trackY * .83, 0, 0, TAU); ctx.strokeStyle = path % 2 ? '#e0ba7b28' : '#59432d20'; ctx.lineWidth = .65; ctx.stroke();
  }
  // Fine hoof marks follow the course rather than decorating the infield like an empty plane.
  for (let mark = 0; mark < 280; mark++) {
    const angle = mark * 2.39996, lane = ((mark * 17) % 101 / 100 - .5) * .82;
    const px = cx + Math.cos(angle) * (rx + lane * trackX), py = cy + Math.sin(angle) * (ry + lane * trackY);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(Math.cos(angle) * ry, -Math.sin(angle) * rx)); ctx.fillStyle = mark % 3 ? '#634a3326' : '#e7c58f38'; ctx.fillRect(-1, -.35, 2.1, .7); ctx.restore();
  }
  ellipse(ctx, cx, cy, rx - trackX * .53, ry - trackY * .55, '#c9caa9');
  ellipse(ctx, cx, cy, rx - trackX * .59, ry - trackY * .64, '#285641');
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx - trackX * .6, Math.max(.1, ry - trackY * .65), 0, 0, TAU); ctx.clip();
  for (let stripe = -1; stripe < 14; stripe++) { ctx.fillStyle = stripe % 2 ? '#35674b' : '#2b5a43'; ctx.fillRect(cx - rx + stripe * rx / 6, cy - ry, rx / 6, ry * 2); }
  for (let bed = 0; bed < 22; bed++) { const angle = bed / 22 * TAU; ellipse(ctx, cx + Math.cos(angle) * rx * .66, cy + Math.sin(angle) * ry * .52, w * .007, h * .01, ['#204836', '#628664', '#527653'][bed % 3]); }
  ellipse(ctx, cx - rx * .23, cy + ry * .11, rx * .2, ry * .18, '#aeb58b'); ellipse(ctx, cx - rx * .23, cy + ry * .11, rx * .184, ry * .15, '#284c55');
  ctx.strokeStyle = '#73959577'; ctx.lineWidth = .7; ctx.beginPath(); ctx.ellipse(cx - rx * .23, cy + ry * .11, rx * .13, ry * .09, 0, 0, TAU); ctx.stroke();
  const crest = Math.min(w * .058, h * .085); ctx.strokeStyle = '#c6ce9d66'; ctx.lineWidth = 1; ctx.strokeRect(cx + rx * .08, cy - crest, crest * 2.4, crest * 1.2);
  label(ctx, 'DERBY', cx + rx * .08 + crest * 1.2, cy - crest * .42, Math.max(5, crest * .57), '#d1d5a4');
  if (h > 130) label(ctx, '1600 M · NIGHT CIRCUIT', cx + rx * .15, cy + ry * .55, Math.min(10, w / 65), '#b7c7a2');
  ctx.restore();
  for (const sign of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx + sign * trackX * .53, ry + sign * trackY * .56, 0, 0, TAU); ctx.strokeStyle = sign > 0 ? '#fff0b4' : '#e0e0be'; ctx.lineWidth = Math.max(.8, h * .006); ctx.stroke();
    for (let post = 0; post < 48; post++) { const angle = post / 48 * TAU, px = cx + Math.cos(angle) * (rx + sign * trackX * .55), py = cy + Math.sin(angle) * (ry + sign * trackY * .58); ctx.fillStyle = '#f4e8bd'; ctx.fillRect(px, py - 1.5, .8, 2); }
  }
  // The start and finish share one transverse line on the right straight.
  const lineLeft = cx + rx - trackX * .49, lineWidth = trackX * .98;
  for (let square = 0; square < 10; square++) for (let row = 0; row < 2; row++) { ctx.fillStyle = (square + row) % 2 ? '#1c2b34' : '#eee1b8'; ctx.fillRect(lineLeft + square * lineWidth / 10, cy + row * Math.max(1, h * .009), lineWidth / 10 + .1, Math.max(1, h * .009)); }
  const markerX = cx + rx + trackX * .59; box(ctx, markerX, cy - 5, Math.max(7, w * .017), 10, '#d6bd76'); label(ctx, 'F', markerX + Math.max(7, w * .017) / 2, cy, 7, '#172b32');
  const lights = [[w * .07, h * .25], [w * .92, h * .22], [w * .12, h * .88], [w * .88, h * .9]];
  for (const [lx, ly] of lights) {
    ctx.fillStyle = '#5c7580'; ctx.fillRect(lx - 1, ly - h * .052, 2, h * .052);
    box(ctx, lx - 8, ly - h * .054, 16, Math.max(2, h * .016), '#fff0bc', '#8fa6aa');
    const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.min(w, h) * .33); pool.addColorStop(0, '#f5e5a61c'); pool.addColorStop(1, '#f5e5a600'); ctx.fillStyle = pool; ctx.fillRect(lx - h * .4, ly - h * .4, h * .8, h * .8);
  }
}

let architecture: { width: number; height: number; canvas: HTMLCanvasElement } | undefined;
/** Background is cached at double resolution; the small crowd accents alone animate. */
export function drawRacingCourse(ctx: CanvasRenderingContext2D, w: number, h: number, clock: number, reduced: boolean) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  if (!architecture || architecture.width !== w || architecture.height !== h) {
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(w * 2); canvas.height = Math.ceil(h * 2);
    const base = canvas.getContext('2d');
    if (base) { base.scale(2, 2); courseArchitecture(base, w, h); architecture = { width: w, height: h, canvas }; }
  }
  if (architecture) ctx.drawImage(architecture.canvas, 0, 0, w, h); else courseArchitecture(ctx, w, h);
  for (let flag = 0; flag < 12; flag++) {
    const x = w * (.075 + flag * .076), y = h * .109, wave = reduced ? 0 : Math.sin(clock / (380 + flag * 13) + flag) * .7;
    ctx.strokeStyle = '#d6d1ac'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x, y + h * .028); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = ['#d0ba7b', '#89aca5', '#b899a3'][flag % 3]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.max(2.4, w * .007), y + wave); ctx.lineTo(x + Math.max(2.4, w * .007), y + h * .012 + wave); ctx.lineTo(x, y + h * .011); ctx.fill();
  }
  ctx.restore();
}

function topHorse(ctx: CanvasRenderingContext2D, candidate: Candidate, index: number, x: number, y: number, angle: number, scale: number, clock: number, reduced: boolean, running: boolean) {
  const gait = reduced ? 0 : clock / (95 + index % 5 * 7) + index * 1.91, stride = running ? Math.sin(gait) : 0, breath = reduced || running ? 0 : Math.sin(clock / 680 + index) * .22;
  const coat = coats[index % coats.length], dark = shadows[index % shadows.length];
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle - Math.PI / 2); ctx.scale(scale, scale);
  ellipse(ctx, 1.3, 2.3, 6.8, 14, '#08151b66');
  ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let leg = 0; leg < 4; leg++) { const side = leg % 2 ? 1 : -1, front = leg > 1, swing = running && !reduced ? Math.sin(gait + leg * 1.8) * 3.8 : 0; ctx.beginPath(); ctx.moveTo(side * 3.4, front ? 4 : -6); ctx.lineTo(side * (5.2 + Math.max(0, swing) * .35), (front ? 8 : -3) + swing); ctx.stroke(); }
  ctx.strokeStyle = dark; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(2 + stride, -12, -1 + stride * 1.6, -17); ctx.stroke();
  ellipse(ctx, 0, -1 + breath, 5, 10.5, coat); ellipse(ctx, 1.1, -1 + breath, 2.5, 8.5, dark);
  ellipse(ctx, -.6, 5, 3.1, 6.4, coat); ellipse(ctx, 0, 12, 3.1, 5.3, coat);
  ctx.fillStyle = index % 2 === 0 ? '#ead9ba' : dark; ctx.fillRect(-1, 12, 2, 4.5);
  ctx.fillStyle = dark; ctx.fillRect(-3, 7, 1.5, 3); ctx.fillRect(1.5, 7, 1.5, 3);
  box(ctx, -4.4, -5, 8.8, 8.5, candidate.color, '#172530');
  ctx.strokeStyle = '#eff0d488'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(3, -3); ctx.stroke();
  const crouch = running ? 1 + stride * .4 : -1;
  ctx.fillStyle = '#e7e1cd'; ctx.fillRect(-4.3, -1, 1.5, 5); ctx.fillRect(2.8, -1, 1.5, 5);
  ellipse(ctx, 0, -.6 + crouch, 2.8, 4, candidate.color); ellipse(ctx, 0, 3.1 + crouch, 2.3, 2.2, '#e7b68e'); ellipse(ctx, 0, 4 + crouch, 2.6, 2.4, candidate.color);
  ctx.strokeStyle = '#f1e4b488'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(-1.8, 4 + crouch); ctx.lineTo(1.8, 4 + crouch); ctx.stroke();
  ctx.strokeStyle = '#cbb693'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(-2.3, 2); ctx.lineTo(-2.4, 11); ctx.moveTo(2.3, 2); ctx.lineTo(2.4, 11); ctx.stroke();
  ctx.restore();
}

/** Draw every horse at its actual race distance; labels fan out only when they collide. */
export function drawRacingTopView(ctx: CanvasRenderingContext2D, w: number, h: number, candidates: Candidate[], standings: RacingCourseStanding[], clock: number, reduced: boolean, focusIds: string[] = []) {
  if (w <= 0 || h <= 0 || !candidates.length) return;
  ctx.save();
  const size = clamp(Math.min(w / 700, h / 290), .25, 1.15), positions = candidates.map((candidate, index) => ({ candidate, index, position: racingCoursePoint(w, h, standings.find(standing => standing.id === candidate.id)?.distance ?? 0, index, candidates.length) }));
  for (const { candidate, index, position } of positions) {
    if (!reduced) {
      ctx.save(); ctx.translate(position.x, position.y); ctx.rotate(position.angle - Math.PI / 2); ctx.fillStyle = '#e4c17b35';
      for (let dust = 0; dust < 3; dust++) { const age = (clock / (210 + index * 4) + dust / 3) % 1; ellipse(ctx, Math.sin(index + dust * 2) * age * 3 * size, (-14 - age * 14) * size, (1 + age) * size, size, '#e4c17b35'); }
      ctx.restore();
    }
    topHorse(ctx, candidate, index, position.x, position.y, position.angle, size, clock, reduced, true);
  }
  const font = clamp(Math.min(w / 46, h / 13), 6.4, 10), tagW = font * 1.9, tagH = font * 1.48, occupied: { x: number; y: number }[] = [];
  const byPriority = [...positions].sort((a, b) => Number(focusIds.includes(b.candidate.id)) - Number(focusIds.includes(a.candidate.id)) || a.index - b.index);
  for (const { candidate, index, position } of byPriority) {
    const normal = position.angle - Math.PI / 2, px = position.x + Math.cos(normal) * 10 * size, py = position.y + Math.sin(normal) * 10 * size;
    let tx = clamp(px, tagW / 2 + 2, w - tagW / 2 - 2), ty = clamp(py, tagH / 2 + 2, h - tagH / 2 - 2);
    for (let attempt = 0; attempt < 80; attempt++) {
      const ring = Math.ceil(attempt / 8), direction = attempt % 8 * Math.PI / 4;
      const candidateX = clamp(px + Math.cos(direction) * ring * (tagW + 2), tagW / 2 + 2, w - tagW / 2 - 2), candidateY = clamp(py + Math.sin(direction) * ring * (tagH + 2), tagH / 2 + 2, h - tagH / 2 - 2);
      if (occupied.every(tag => Math.abs(tag.x - candidateX) > tagW + 1 || Math.abs(tag.y - candidateY) > tagH + 1)) { tx = candidateX; ty = candidateY; break; }
    }
    occupied.push({ x: tx, y: ty });
    if (Math.hypot(tx - position.x, ty - position.y) > 5) { ctx.strokeStyle = '#e4dccb80'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(position.x, position.y); ctx.lineTo(tx, ty); ctx.stroke(); }
    const focused = focusIds.includes(candidate.id); box(ctx, tx - tagW / 2, ty - tagH / 2, tagW, tagH, focused ? '#e5cd8d' : '#0c2033ef', focused ? '#fff0c1' : candidate.color); label(ctx, String(index + 1).padStart(2, '0'), tx, ty, font, focused ? '#182b34' : '#f6ebcf');
  }
  ctx.restore();
}

/** A close top view of the right straight. All stalls meet one transverse start line. */
export function drawRacingStartingGate(ctx: CanvasRenderingContext2D, w: number, h: number, candidates: Candidate[], clock: number, reduced: boolean, elapsed: number, preview = false) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  const sand = ctx.createLinearGradient(0, 0, w, h); sand.addColorStop(0, '#715a43'); sand.addColorStop(.5, '#aa895c'); sand.addColorStop(1, '#7b6249'); ctx.fillStyle = sand; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#28543e'; ctx.fillRect(0, 0, w * .057, h); ctx.fillStyle = '#234535'; ctx.fillRect(w * .943, 0, w * .057, h);
  for (let stripe = 0; stripe < 16; stripe++) { const x = w * (.058 + stripe * .055); ctx.strokeStyle = stripe % 2 ? '#5b473225' : '#d3b37c28'; ctx.lineWidth = Math.max(1, w * .002); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * .025, h); ctx.stroke(); }
  for (let grain = 0; grain < 145; grain++) { const px = w * (.07 + (grain * .618033 % 1) * .86), py = (grain * 37.7 % h); ctx.fillStyle = grain % 3 ? '#473b2528' : '#ecd49d29'; ctx.fillRect(px, py, 1.2, .7); }
  const margin = w * .073, width = w - margin * 2, count = Math.max(1, candidates.length), slot = width / count;
  const scale = Math.max(.1, Math.min(slot / 15, h / 86)), frontY = h * .63, tilt = -.045;
  for (const side of [0, 1]) {
    const edge = side ? w * .963 : w * .016;
    for (let seat = 0; seat < 12; seat++) {
      const py = h * (.035 + seat * .057), cheer = reduced ? 0 : Math.sin(clock / 410 + seat * 1.3 + side) * .4;
      ctx.fillStyle = ['#b18777', '#7f9ea9', '#b9ad80', '#82997f'][seat % 4]; ctx.fillRect(edge - w * .007, py + 1.4, w * .014, Math.max(1, h * .015));
      ctx.fillStyle = '#d3af87'; ctx.fillRect(edge - w * .003, py + cheer, Math.max(1, w * .006), Math.max(1, h * .009));
    }
    ctx.fillStyle = '#829794'; ctx.fillRect(edge - w * .009, h * .02, w * .018, Math.max(2, h * .023));
    ctx.fillStyle = '#f3e2b1'; ctx.fillRect(edge - w * .012, h * .025, w * .024, Math.max(1, h * .009));
  }
  // Rails extend beyond the gate, visibly leading down the course rather than into a floating grid.
  for (const rx of [w * .063, w * .937]) {
    ctx.strokeStyle = '#263932'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx + 1, 0); ctx.lineTo(rx + w * .025, h); ctx.stroke();
    ctx.strokeStyle = '#eee5c2'; ctx.lineWidth = Math.max(1.1, w / 230); ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx + w * .025, h); ctx.stroke();
    for (let post = 0; post < 8; post++) { const py = post * h / 7; ctx.fillStyle = '#ecdfb8'; ctx.fillRect(rx + w * .025 * py / h - 1, py, 2, 3); }
  }
  const light = ctx.createLinearGradient(0, 0, w, 0); light.addColorStop(0, '#ffedb61a'); light.addColorStop(.5, '#ffedb600'); light.addColorStop(1, '#d8edfb20'); ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, frontY); ctx.rotate(tilt);
  const left = -width / 2, font = clamp(Math.min(slot * .27, h * .085), 7, 12), gateDepth = 36 * scale;
  box(ctx, left - slot * .025, -gateDepth - font * 1.8, width + slot * .05, Math.max(2, scale * 2.2), '#3e5a69', '#9daea7');
  ctx.strokeStyle = '#eee3bc'; ctx.lineWidth = Math.max(1, h * .009); ctx.beginPath(); ctx.moveTo(left - slot * .1, 1); ctx.lineTo(left + width + slot * .1, 1); ctx.stroke();
  const launch = preview ? 0 : reduced ? Number(elapsed >= 5500) : smooth((elapsed - 5500) / 1150), opened = preview ? 0 : smooth((elapsed - 5500) / 430);
  candidates.forEach((candidate, index) => {
    const sx = left + slot * (index + .5), incoming = preview || reduced ? 1 : smooth((elapsed - index * 55) / 1700);
    const horseY = -17 * scale - (1 - incoming) * Math.min(h * .2, 17 * scale) + launch * h * .82;
    box(ctx, sx - slot * .47, -gateDepth - 4 * scale, slot * .94, gateDepth + 5 * scale, '#132a3b32');
    for (const side of [-1, 1]) {
      const wall = sx + side * slot * .48; ctx.fillStyle = '#152c3d'; ctx.fillRect(wall - 1.3 * scale, -gateDepth, 2.6 * scale, gateDepth + 3 * scale);
      ctx.fillStyle = '#91a5a7'; ctx.fillRect(wall - .6 * scale, -gateDepth, 1.2 * scale, gateDepth + scale);
      for (let bar = 0; bar < 4; bar++) { ctx.strokeStyle = '#d3ddcc66'; ctx.lineWidth = .8 * scale; ctx.beginPath(); ctx.moveTo(wall - 1.1 * scale, -gateDepth + (bar + 1) * gateDepth / 5); ctx.lineTo(wall + 1.1 * scale, -gateDepth + (bar + 1) * gateDepth / 5); ctx.stroke(); }
    }
    topHorse(ctx, candidate, index, sx, horseY, Math.PI / 2, scale, clock, reduced, !preview && elapsed >= 5500);
    // Split front doors pivot sideways together at 5500 ms; no stall has an earlier release.
    for (const side of [-1, 1]) {
      const hingeX = sx + side * slot * .43, tipX = hingeX - side * slot * .42 * (1 - opened), tipY = opened * slot * .31;
      ctx.strokeStyle = '#dae2cb'; ctx.lineWidth = Math.max(.8, scale); ctx.beginPath(); ctx.moveTo(hingeX, 0); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#44646e'; ctx.lineWidth = Math.max(1.5, scale * 2); ctx.beginPath(); ctx.moveTo(hingeX, -1.4 * scale); ctx.lineTo(tipX, tipY - 1.4 * scale); ctx.stroke();
    }
    const signW = Math.min(slot * .84, font * 2.4), signY = -gateDepth - font * .95;
    box(ctx, sx - signW / 2, signY - font * .64, signW, font * 1.28, '#102435', candidate.color); label(ctx, String(index + 1).padStart(2, '0'), sx, signY, font, '#f5e5ba');
    const ready = !preview && elapsed >= 3900, lamp = clamp(scale, .8, 2); ellipse(ctx, sx + signW / 2 + 4, signY, lamp, lamp, ready ? '#d6bf78' : '#8ba49a');
    if (!reduced && elapsed > 5500) for (let particle = 0; particle < 4; particle++) { const age = (clock / 380 + index * .1 + particle / 4) % 1; ellipse(ctx, sx + Math.sin(particle * 2 + index) * age * scale * 4, horseY - (15 + age * 15) * scale, (1 + age) * scale, scale * .6, '#e0bd7929'); }
  });
  if (!candidates.length) label(ctx, '이름을 적으면 출발 준비를 시작해요', 0, -h * .18, Math.max(8, Math.min(14, w / 28)), '#f3e4bf');
  ctx.restore();
}
