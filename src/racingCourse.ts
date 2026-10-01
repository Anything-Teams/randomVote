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

function gardenTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number) {
  ellipse(ctx, x + s, y + s * 2.7, s * 4.7, s * 2.1, '#081c266b');
  ctx.fillStyle = '#3a4540'; ctx.fillRect(x - s * .5, y, s, s * 4);
  const colors = ['#193e3e', '#265749', '#35694f', '#467558'];
  for (let leaf = 0; leaf < 9; leaf++) { const px = x + Math.sin(leaf * 2.399 + seed) * s * 2.5, py = y + Math.cos(leaf * 2.399 + seed) * s * 1.6 - s; ctx.fillStyle = colors[leaf % 4]; ctx.fillRect(px - s * 1.7, py - s, s * 3.5, s * 2.5); }
  ctx.fillStyle = '#88a06b80'; ctx.fillRect(x - s * 2, y - s * 2, s * 1.8, s);
}

function facility(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, roof: string) {
  ctx.fillStyle = '#08192375'; ctx.fillRect(x + height * .17, y + height * .28, width, height);
  ctx.fillStyle = '#344849'; ctx.fillRect(x, y, width, height * 1.2);
  ctx.fillStyle = '#536769'; ctx.fillRect(x, y + height * .5, width, height * .35);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 1, y + height * .25); ctx.lineTo(x + width * .08, y - height * .1); ctx.lineTo(x + width * .96, y - height * .1); ctx.lineTo(x + width + 1, y + height * .25); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a8b0a07a'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x + width * .08, y - height * .1); ctx.lineTo(x + width * .96, y - height * .1); ctx.stroke();
  for (let pane = 0; pane < 5; pane++) { ctx.fillStyle = pane % 2 ? '#c9b776' : '#79948b'; ctx.fillRect(x + width * (.1 + pane * .16), y + height * .45, width * .085, height * .25); }
}

function courseArchitecture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { cx, cy, rx, ry, trackX, trackY } = geometry(w, h), detail = h >= 100, pixel = Math.max(.5, Math.min(w / 620, h / 250));
  const ground = ctx.createLinearGradient(0, 0, w, h); ground.addColorStop(0, '#10213b'); ground.addColorStop(.5, '#173334'); ground.addColorStop(1, '#0d222d'); ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
  // Five discrete stadium blocks have stepped terraces, aisles, fascia and a canopy depth.
  for (let block = 0; block < 5; block++) {
    const bx = w * (.09 + block * .16), bw = w * .148, roofY = h * .034, rows = detail ? 5 : 3, rowH = h * .026;
    ctx.fillStyle = '#081423'; ctx.fillRect(bx + w * .008, roofY + h * .02, bw, h * .153);
    for (let row = rows - 1; row >= 0; row--) {
      const py = roofY + h * .03 + row * rowH, inset = (rows - row) * bw * .008;
      ctx.fillStyle = row % 2 ? '#354552' : '#293a4d'; ctx.fillRect(bx + inset, py, bw - inset * 2, rowH);
      for (let person = 0; person < 14; person++) {
        const seatX = bx + bw * (.047 + person * .064), seatY = py + rowH * .15, seed = person + block * 17 + row * 3;
        if (person === 6 || person === 7) { ctx.fillStyle = '#596966'; ctx.fillRect(seatX, py, bw * .06, rowH); continue; }
        ctx.fillStyle = ['#d3ad8a', '#a8866e', '#dfc19b'][seed % 3]; ctx.fillRect(seatX, seatY, bw * .016, rowH * .28);
        ctx.fillStyle = ['#9a8583', '#789da8', '#beaa7e', '#7b9488', '#9f91ae'][seed % 5]; ctx.fillRect(seatX - bw * .004, seatY + rowH * .28, bw * .025, rowH * .45);
        ctx.fillStyle = '#83919270'; ctx.fillRect(seatX - bw * .006, seatY + rowH * .73, bw * .03, rowH * .11);
      }
      ctx.fillStyle = '#96a69c5c'; ctx.fillRect(bx + inset, py + rowH - pixel * .45, bw - inset * 2, pixel * .5);
    }
    ctx.fillStyle = '#172539'; ctx.beginPath(); ctx.moveTo(bx - bw * .025, roofY); ctx.lineTo(bx + bw * .94, roofY - h * .009); ctx.lineTo(bx + bw * 1.03, roofY + h * .022); ctx.lineTo(bx, roofY + h * .03); ctx.fill();
    ctx.strokeStyle = '#769098'; ctx.lineWidth = pixel * .8; ctx.beginPath(); ctx.moveTo(bx, roofY + h * .03); ctx.lineTo(bx + bw * 1.03, roofY + h * .022); ctx.stroke();
    ctx.fillStyle = '#637d8260'; ctx.fillRect(bx + bw * .04, roofY + h * .03, pixel, rows * rowH); ctx.fillRect(bx + bw * .94, roofY + h * .024, pixel, rows * rowH);
    const fasciaY = roofY + h * .036 + rows * rowH; box(ctx, bx + 1, fasciaY, bw - 2, h * .022, block % 2 ? '#b39d74' : '#2b5863');
    if (detail) label(ctx, ['DERBY CLUB', 'NIGHT DERBY', 'FULL GALLOP', 'TOGETHER', '1600 M'][block], bx + bw / 2, fasciaY + h * .011, Math.max(4.3, Math.min(9, bw / 12)), block % 2 ? '#233440' : '#d6ddbd');
  }
  for (const right of [false, true]) {
    const sx = right ? w * .953 : w * .025;
    ctx.fillStyle = '#253745'; ctx.fillRect(sx - w * .019, h * .34, w * .042, h * .37);
    for (let row = 0; row < 12; row++) for (let column = 0; column < 3; column++) { const px = sx + (column - 1) * w * .011, py = h * (.35 + row * .028); ctx.fillStyle = ['#b69d7e', '#7a9aa2', '#aa8a93', '#7d967f'][(row + column) % 4]; ctx.fillRect(px, py, w * .006, h * .012); ctx.fillStyle = '#d6b58f'; ctx.fillRect(px + w * .001, py - h * .006, w * .004, h * .006); }
    ctx.strokeStyle = '#8091938c'; ctx.lineWidth = pixel * .6; ctx.strokeRect(sx - w * .019, h * .34, w * .042, h * .37);
  }
  // Concourse, embankment and the shaded outer retaining wall sit below the pale double rail.
  ellipse(ctx, cx, cy + trackY * .24, rx + trackX * .76, ry + trackY * .87, '#0b1728');
  ellipse(ctx, cx, cy + trackY * .08, rx + trackX * .72, ry + trackY * .77, '#425352');
  ellipse(ctx, cx, cy + trackY * .08, rx + trackX * .61, ry + trackY * .67, '#182d32');
  ellipse(ctx, cx, cy, rx + trackX * .58, ry + trackY * .59, '#bdc1a4');
  const track = ctx.createLinearGradient(0, cy - ry, w * .1, cy + ry); track.addColorStop(0, '#6b5f55'); track.addColorStop(.24, '#928165'); track.addColorStop(.55, '#b79b70'); track.addColorStop(1, '#8b7056');
  ellipse(ctx, cx, cy, rx + trackX * .49, ry + trackY * .49, track);
  for (let path = 0; path < 12; path++) { const depth = path / 11 - .5; ctx.beginPath(); ctx.ellipse(cx, cy, rx + depth * trackX * .9, ry + depth * trackY * .9, 0, 0, TAU); ctx.strokeStyle = path < 3 ? '#3c342a24' : path % 3 ? '#d4b88d20' : '#4d453627'; ctx.lineWidth = Math.max(.5, trackY * .06); ctx.stroke(); }
  for (let mark = 0; mark < (detail ? 640 : 260); mark++) {
    const angle = mark * 2.39996, lane = ((mark * 17) % 101 / 100 - .5) * .87, px = cx + Math.cos(angle) * (rx + lane * trackX), py = cy + Math.sin(angle) * (ry + lane * trackY);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(Math.cos(angle) * ry, -Math.sin(angle) * rx)); ctx.fillStyle = mark % 3 ? '#493f332c' : '#ddc49a45'; ctx.fillRect(-pixel, -pixel * .3, pixel * 2.2, pixel * .6); ctx.restore();
  }
  ellipse(ctx, cx, cy + trackY * .075, rx - trackX * .48, ry - trackY * .51, '#554f3f');
  ellipse(ctx, cx, cy, rx - trackX * .57, ry - trackY * .61, '#718675');
  const turf = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry); turf.addColorStop(0, '#214b43'); turf.addColorStop(.48, '#2b5748'); turf.addColorStop(1, '#183e39');
  ellipse(ctx, cx, cy, rx - trackX * .62, ry - trackY * .68, turf);
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx - trackX * .62, Math.max(.1, ry - trackY * .68), 0, 0, TAU); ctx.clip();
  // Subtle diagonal mowing and irregular grass tufts replace the broad flat rectangles.
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.27);
  for (let stripe = -7; stripe < 8; stripe++) { ctx.fillStyle = stripe % 2 ? '#adc79105' : '#081c260a'; ctx.fillRect(stripe * rx / 7, -ry * 3, rx / 7, ry * 6); }
  ctx.restore();
  for (let blade = 0; blade < (detail ? 1150 : 350); blade++) { const px = cx - rx + (blade * .618033 % 1) * rx * 2, py = cy - ry + (blade * .414214 % 1) * ry * 2; ctx.fillStyle = ['#91ac7433', '#9aaa7630', '#102f3926', '#47735b42'][blade % 4]; ctx.fillRect(px, py, pixel * (blade % 3 + 1) * .55, pixel * .65); }
  // The garden has a stone promenade, clipped flower beds, a fountain and a lit pavilion.
  const walkY = cy + ry * .25; ctx.strokeStyle = '#192f34'; ctx.lineWidth = Math.max(2, h * .022); ctx.beginPath(); ctx.moveTo(cx - rx * .68, walkY); ctx.bezierCurveTo(cx - rx * .2, cy + ry * .54, cx + rx * .4, cy + ry * .08, cx + rx * .66, cy + ry * .28); ctx.stroke();
  ctx.strokeStyle = '#acb091'; ctx.lineWidth = Math.max(1, h * .013); ctx.stroke();
  const poolX = cx - rx * .25, poolY = cy - ry * .09; ellipse(ctx, poolX + pixel, poolY + pixel * 2, rx * .136, ry * .205, '#152e37'); ellipse(ctx, poolX, poolY, rx * .136, ry * .205, '#899588'); ellipse(ctx, poolX, poolY, rx * .119, ry * .174, '#2c5862');
  ellipse(ctx, poolX, poolY, rx * .065, ry * .07, '#75999a'); ctx.fillStyle = '#bcc3ac'; ctx.fillRect(poolX - pixel, poolY - h * .015, pixel * 2, h * .02);
  for (let ripple = 0; ripple < 3; ripple++) { ctx.strokeStyle = '#a6c4ba4b'; ctx.lineWidth = pixel * .6; ctx.beginPath(); ctx.ellipse(poolX, poolY + h * .005, rx * (.039 + ripple * .018), ry * (.05 + ripple * .036), 0, 0, TAU); ctx.stroke(); }
  for (let bed = 0; bed < 16; bed++) { const angle = bed / 16 * TAU, px = cx + Math.cos(angle) * rx * .65, py = cy + Math.sin(angle) * ry * .57; box(ctx, px - w * .005, py - h * .006, w * .012, h * .014, '#1a3d3b', '#52735c'); ctx.fillStyle = ['#a99a77', '#9d8798', '#c4ae87'][bed % 3]; ctx.fillRect(px, py, pixel * 1.3, pixel); }
  for (let tree = 0; tree < 18; tree++) { const angle = tree / 18 * TAU; gardenTree(ctx, cx + Math.cos(angle) * rx * .76, cy + Math.sin(angle) * ry * .64, Math.max(.4, pixel * .7), tree); }
  facility(ctx, cx + rx * .18, cy - ry * .2, rx * .29, ry * .24, '#8b9b91');
  if (detail) label(ctx, 'DERBY GARDEN', cx + rx * .32, cy - ry * .28, Math.max(5, Math.min(10, w / 72)), '#bdc6a4');
  // Maintenance gate and timing board form a recognisable race venue, beyond a decorative oval.
  facility(ctx, cx - rx * .73, cy - ry * .04, rx * .14, ry * .12, '#6c8490');
  box(ctx, cx + rx * .43, cy - ry * .46, rx * .23, ry * .22, '#11243b', '#869893');
  ctx.fillStyle = '#c4b77e'; ctx.fillRect(cx + rx * .46, cy - ry * .425, rx * .17, pixel); ctx.fillStyle = '#527b71'; ctx.fillRect(cx + rx * .46, cy - ry * .365, rx * .13, pixel);
  if (detail) label(ctx, 'NIGHT DERBY', cx + rx * .545, cy - ry * .315, Math.max(4.5, Math.min(8, w / 100)), '#c7c8a8');
  ctx.restore();
  for (const sign of [-1, 1]) {
    for (const level of [0, 1]) { ctx.beginPath(); ctx.ellipse(cx, cy - level * pixel * .8, rx + sign * trackX * .535, ry + sign * trackY * .565, 0, 0, TAU); ctx.strokeStyle = level ? '#e2dfc4' : '#263d42'; ctx.lineWidth = level ? Math.max(.6, pixel * .9) : Math.max(1, pixel * 1.4); ctx.stroke(); }
    for (let post = 0; post < 68; post++) { const angle = post / 68 * TAU, px = cx + Math.cos(angle) * (rx + sign * trackX * .55), py = cy + Math.sin(angle) * (ry + sign * trackY * .58); ctx.fillStyle = '#304b4666'; ctx.fillRect(px + pixel, py + pixel * .7, pixel * 1.5, pixel * .5); ctx.fillStyle = '#cbd0b6'; ctx.fillRect(px, py - pixel * 2.2, pixel * .65, pixel * 2.4); }
  }
  const lineLeft = cx + rx - trackX * .49, lineWidth = trackX * .98, tileH = Math.max(.8, h * .006);
  for (let square = 0; square < 10; square++) for (let row = 0; row < 2; row++) { ctx.fillStyle = (square + row) % 2 ? '#1c2b34' : '#eee1b8'; ctx.fillRect(lineLeft + square * lineWidth / 10, cy + row * tileH, lineWidth / 10 + .1, tileH); }
  const markerX = cx + rx + trackX * .59; box(ctx, markerX, cy - h * .012, Math.max(3, w * .012), h * .024, '#d6bd76'); if (h > 80) label(ctx, 'F', markerX + Math.max(3, w * .012) / 2, cy, Math.min(7, h * .025), '#172b32');
  for (let stall = 0; stall < 10; stall++) { ctx.fillStyle = '#6f9292'; ctx.fillRect(lineLeft + stall * lineWidth / 10, cy - h * .038, lineWidth / 10 * .16, h * .028); }
  const lights = [[w * .074, h * .24], [w * .917, h * .21], [w * .12, h * .9], [w * .88, h * .895]];
  for (const [lx, ly] of lights) {
    ctx.fillStyle = '#07182366'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + w * .043, ly + h * .065); ctx.lineTo(lx + w * .047, ly + h * .068); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#617c87'; ctx.fillRect(lx - pixel * .55, ly - h * .055, pixel * 1.1, h * .055);
    box(ctx, lx - w * .013, ly - h * .058, w * .026, Math.max(1, h * .016), '#354e5b', '#8a9d9d');
    for (let bulb = 0; bulb < 4; bulb++) { ctx.fillStyle = '#efe0af'; ctx.fillRect(lx + (bulb - 1.7) * w * .006, ly - h * .055, w * .0038, Math.max(.8, h * .008)); }
    const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.min(w, h) * .39); pool.addColorStop(0, '#f5e5a622'); pool.addColorStop(1, '#f5e5a600'); ctx.fillStyle = pool; ctx.fillRect(lx - h * .45, ly - h * .45, h * .9, h * .9);
  }
}

const architectures = new Map<string, HTMLCanvasElement>();
/** Background is cached at double resolution; the small crowd accents alone animate. */
export function drawRacingCourse(ctx: CanvasRenderingContext2D, w: number, h: number, clock: number, reduced: boolean) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  const key = w + ':' + h;
  let architecture = architectures.get(key);
  if (!architecture) {
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(w * 2); canvas.height = Math.ceil(h * 2);
    const base = canvas.getContext('2d');
    if (base) { base.scale(2, 2); courseArchitecture(base, w, h); architecture = canvas; architectures.set(key, canvas); }
    if (architectures.size > 4) architectures.delete(architectures.keys().next().value!);
  } else {
    architectures.delete(key); architectures.set(key, architecture);
  }
  if (architecture) ctx.drawImage(architecture, 0, 0, w, h); else courseArchitecture(ctx, w, h);
  const rows = h >= 100 ? 5 : 3;
  for (let block = 0; block < 5; block++) for (let row = Math.max(0, rows - 2); row < rows; row++) for (let person = 0; person < 14; person++) {
    if (person === 6 || person === 7 || (person + row + block) % 3 !== 0) continue;
    const bw = w * .148, x = w * (.09 + block * .16) + bw * (.047 + person * .064), y = h * (.068 + row * .026), seed = person + row * 3 + block * 17;
    const lift = reduced ? .35 : (Math.sin(clock / (360 + seed % 5 * 53) + seed) + 1) * .5;
    ctx.strokeStyle = ['#d3ad8a', '#a8866e', '#dfc19b'][seed % 3]; ctx.lineWidth = Math.max(.45, w * .0011);
    ctx.beginPath(); ctx.moveTo(x, y + h * .005); ctx.lineTo(x - w * .0025, y + h * (.006 - lift * .012)); ctx.moveTo(x + w * .0025, y + h * .005); ctx.lineTo(x + w * .005, y + h * (.006 - lift * .012)); ctx.stroke();
    if (seed % 4 === 0) { ctx.strokeStyle = ['#ceb887', '#86b2ad', '#b794a9'][seed % 3]; ctx.lineWidth = Math.max(.6, h * .003); ctx.beginPath(); ctx.moveTo(x - w * .0025, y - h * lift * .007); ctx.lineTo(x + w * .005, y - h * lift * .007); ctx.stroke(); }
  }
  ctx.restore();
}

function topHorse(ctx: CanvasRenderingContext2D, candidate: Candidate, index: number, x: number, y: number, angle: number, scale: number, clock: number, reduced: boolean, running: boolean) {
  const gait = reduced ? 0 : clock / (95 + index % 5 * 7) + index * 1.91, stride = running ? Math.sin(gait) : 0, breath = reduced || running ? 0 : Math.sin(clock / 680 + index) * .22;
  const coat = coats[index % coats.length], dark = shadows[index % shadows.length];
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle - Math.PI / 2); ctx.scale(scale, scale);
  ellipse(ctx, 1.8, 2.2, 6.8, 14, '#07132166');
  ctx.lineCap = 'round';
  for (let leg = 0; leg < 4; leg++) {
    const side = leg % 2 ? 1 : -1, front = leg > 1, pulse = running && !reduced ? Math.sin(gait + (front ? .2 : 2.9) + side * .65) : 0, fold = Math.max(0, Math.cos(gait + leg * 1.9));
    const rootY = front ? 5.2 : -6.8, kneeX = side * (5 + (running ? fold : 0) * 1.2), kneeY = rootY + pulse * 2.4, hoofX = side * (5.8 - (running ? fold : 0) * .6), hoofY = rootY + 2 + pulse * 6;
    ctx.strokeStyle = dark; ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(side * 3.7, rootY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = leg % 3 === 0 ? '#d2c6af' : coat; ctx.lineWidth = 1.35; ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(hoofX, hoofY); ctx.stroke();
    ctx.strokeStyle = '#172129'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(hoofX - .5, hoofY); ctx.lineTo(hoofX + .5, hoofY + .4); ctx.stroke();
  }
  ctx.strokeStyle = dark; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(2 + stride, -12, -1 + stride * 1.6, -17); ctx.stroke();
  const sway = reduced || !running ? breath : Math.sin(gait + .4) * .32;
  ellipse(ctx, sway, -2, 5.1, 10.2, dark); ellipse(ctx, sway - .5, -2.5, 4.5, 9.6, coat);
  ellipse(ctx, sway, 4.8, 4.3, 5.7, coat); ctx.fillStyle = '#f0d3a424'; ctx.fillRect(-3.2 + sway, -7, 1.5, 4.2);
  ellipse(ctx, sway - .4, 7.8, 2.8, 6, dark); ellipse(ctx, sway - .9, 7.6, 2.4, 6, coat);
  ellipse(ctx, sway - .3, 13, 3, 4.4, coat); ctx.fillStyle = dark; ctx.fillRect(-2.8 + sway, 8.2, 1.1, 3); ctx.fillRect(1.5 + sway, 8.2, 1.1, 3);
  ctx.fillStyle = index % 2 === 0 ? '#e6d7ba' : dark; ctx.fillRect(-1.1 + sway, 12.2, 1.8, 3.8); ctx.fillStyle = dark; ctx.fillRect(-2 + sway, 16, 3.5, 1.1);
  box(ctx, -4.5, -5.3, 9, 8.8, candidate.color, '#18232c'); ctx.fillStyle = '#142332'; ctx.fillRect(-3.6, -4.2, 7.2, 3.7);
  ctx.strokeStyle = '#e0d9bf99'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-3.7, 2.4); ctx.lineTo(3.7, 2.4); ctx.stroke();
  // Knees grip the saddle; boots and stirrups stay attached while the rider folds forward.
  const crouch = running ? .8 + stride * .27 : -.8;
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#d7d9ca'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(side * 1.4, -1.7); ctx.lineTo(side * 4.2, -.3); ctx.lineTo(side * 4.5, 3.3); ctx.stroke();
    ctx.strokeStyle = '#122436'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(side * 4.4, 2.7); ctx.lineTo(side * 5, 4.4); ctx.stroke();
    ctx.strokeStyle = '#b4b69b'; ctx.lineWidth = .6; ctx.strokeRect(side < 0 ? -5.4 : 3.8, 3.7, 1.6, 1.8);
    ctx.strokeStyle = candidate.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(side * 1.9, 1 + crouch); ctx.lineTo(side * 2.8, 5.6); ctx.stroke();
    ctx.strokeStyle = '#d5c098'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(side * 2.8, 5.6); ctx.lineTo(side * 2.3, 12.6); ctx.stroke();
  }
  ellipse(ctx, 0, -.7 + crouch, 2.4, 3.7, candidate.color); ctx.fillStyle = '#f0ebd68f'; ctx.fillRect(-.65, -2.6 + crouch, 1.3, 3.5);
  ellipse(ctx, 0, 3.2 + crouch, 1.8, 1.7, '#dbac87'); ellipse(ctx, 0, 3.9 + crouch, 2.3, 2, candidate.color);
  ctx.strokeStyle = '#f1e4b488'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(-1.6, 3.9 + crouch); ctx.lineTo(1.6, 3.9 + crouch); ctx.stroke();
  ctx.restore();
}

/** Draw every horse at its actual race distance; labels fan out only when they collide. */
export function drawRacingTopView(ctx: CanvasRenderingContext2D, w: number, h: number, candidates: Candidate[], standings: RacingCourseStanding[], clock: number, reduced: boolean, focusIds: string[] = []) {
  if (w <= 0 || h <= 0 || !candidates.length) return;
  ctx.save();
  const size = clamp(Math.min(w / 640, h / 260), .25, 1.15), course = geometry(w, h);
  const positions = candidates.map((candidate, index) => {
    const distance = standings.find(standing => standing.id === candidate.id)?.distance ?? 0;
    const flow = smooth((distance - .018) / .085) * (1 - smooth((distance - .91) / .07));
    const seed = candidate.id.split('').reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 7) % 101 / 101;
    const crowd = Math.max(0, ...standings.filter(standing => standing.id !== candidate.id).map(standing => 1 - smooth(Math.abs(standing.distance - distance) / .025)));
    const roam = clamp(.22 + seed * .40 + Math.sin(distance * TAU * 1.45 + seed * TAU) * .10 + (seed > .5 ? 1 : -1) * crowd * .055, .09, .86);
    const lane = index + (roam * (candidates.length - 1) - index) * flow;
    const position = racingCoursePoint(w, h, distance, index, candidates.length);
    const baseLane = (index + .5) / candidates.length - .5, shift = (lane - index) / candidates.length * .76;
    const theta = Math.atan2((position.y - course.cy) / (course.ry + baseLane * course.trackY * .76), (position.x - course.cx) / (course.rx + baseLane * course.trackX * .76));
    position.x += Math.cos(theta) * course.trackX * shift; position.y += Math.sin(theta) * course.trackY * shift;
    // Lateral room is cosmetic; each nose keeps the original arc-length progress and finish line.
    return { candidate, index, position, running: distance < 1 };
  });
  positions.sort((a, b) => a.position.y - b.position.y);
  for (const { candidate, index, position, running } of positions) {
    const bodyX = position.x - Math.cos(position.angle) * 17.4 * size, bodyY = position.y - Math.sin(position.angle) * 17.4 * size;
    if (!reduced && running) {
      ctx.save(); ctx.translate(bodyX, bodyY); ctx.rotate(position.angle - Math.PI / 2);
      const alpha = ctx.globalAlpha;
      for (let dust = 0; dust < 6; dust++) { const age = ((clock + index * 139 + dust * 103) % 410) / 410, side = dust % 2 ? 1 : -1; ctx.globalAlpha = alpha * (1 - age) * .65; ellipse(ctx, (side * 4 + Math.sin(index + dust * 2) * age * 3) * size, (-7 - age * 20) * size, (.8 + age * 2) * size, (.45 + age) * size, '#dec499'); }
      ctx.globalAlpha = alpha; ctx.strokeStyle = '#b1c4bf38'; ctx.lineWidth = Math.max(.4, size * .5);
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 7 * size, -8 * size); ctx.lineTo(side * 7 * size, -18 * size); ctx.stroke(); }
      ctx.restore();
    }
    topHorse(ctx, candidate, index, bodyX, bodyY, position.angle, size, clock, reduced, running);
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
