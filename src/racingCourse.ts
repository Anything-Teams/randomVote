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
const courseSkew = (w: number, h: number) => Math.min(.13, h / Math.max(1, w) * .20);
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = '800 ' + size + 'px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, border?: string) {
  if (w <= 0 || h <= 0) return;
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

/** Outer lanes start farther around the bend so each lane has 1600 metres left. */
export function racingLaneStart(laneIndex: number, count: number) {
  const lane = count <= 1 ? 0 : laneIndex / (count - 1), lap = 1600 + TAU * 11.25 * lane;
  return { lap, advance: 1 - 1600 / lap };
}

export function racingCoursePoint(w: number, h: number, distance: number, laneIndex: number, count: number): RacingCoursePosition {
  const { cx, cy, rx, ry, trackX, trackY } = geometry(w, h);
  const lane = (clamp(laneIndex, -1, Math.max(0, count)) + .5) / Math.max(1, count) - .5;
  const radiusX = rx + lane * trackX * .76, radiusY = ry + lane * trackY * .76;
  // Arc length, rather than angle, keeps the short ends from slowing the field to a crawl.
  const start = racingLaneStart(laneIndex, count);
  const progress = start.advance + (Number.isFinite(distance) ? distance : 0) * 1600 / start.lap;
  const theta = courseAngle(radiusX, radiusY, progress);
  const x = cx + Math.cos(theta) * radiusX, skew = courseSkew(w, h), vx = -Math.sin(theta) * radiusX, vy = Math.cos(theta) * radiusY;
  return { x, y: cy + Math.sin(theta) * radiusY + (x - cx) * skew, angle: Math.atan2(vy + vx * skew, vx) };
}

/** Perspective depth varies by lane, while every close-view gate mouth shares one straight line. */
export function racingStartingLayout(w: number, h: number, count: number) {
  const forwardLength = TAU * 11.25;
  const cross = { x: w * .70, y: h * .29 }, crossLength = Math.hypot(cross.x, cross.y);
  const forward = { x: -cross.y / Math.max(1, crossLength), y: cross.x / Math.max(1, crossLength) };
  const project = (distance: number, index: number, total: number): RacingCoursePosition => {
    const lane = total <= 1 ? .5 : index / (total - 1), arc = distance * 1600 / forwardLength;
    const travel = h * .29 * arc;
    const dx = forward.x * h * .29 - w * .036 * arc, dy = forward.y * h * .29;
    return { x: w * .15 + lane * cross.x + forward.x * travel - w * .018 * arc * arc, y: h * .46 + lane * cross.y + forward.y * travel, angle: Math.atan2(dy, dx) };
  };
  const slots = Array.from({ length: Math.max(1, count) }, (_, index) => project(0, index, count));
  const rail = (index: number) => Array.from({ length: 81 }, (_, step) => project(-.042 + step / 80 * .145, index, 10));
  return { slots, startLine: [project(0, -.85, 10), project(0, 9.85, 10)], innerRail: rail(-.85), outerRail: rail(9.85), slotWidth: w * .65 / Math.max(1, count) };
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
  ctx.save(); ctx.transform(1, courseSkew(w, h), 0, 1, 0, -cx * courseSkew(w, h));
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
  ctx.restore();
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

/** Top projection keeps legs under the barrel, with stride along the direction of travel. */
export function racingTopLegPose(clock: number, index: number, running: boolean | number, reduced: boolean) {
  const period = 560 + index % 4 * 22, phase = reduced ? 0 : (clock / period + index * .193) % 1;
  const activity = reduced ? 0 : typeof running === 'number' ? clamp(running, 0, 1) : Number(running);
  const ease = (value: number) => value * value * (3 - 2 * value);
  return [
    { side: -1, front: false, offset: .05 }, { side: 1, front: false, offset: .18 },
    { side: -1, front: true, offset: .40 }, { side: 1, front: true, offset: .54 },
  ].map(leg => {
    const p = (phase - leg.offset + 1) % 1, support = p < .22, swing = Math.max(0, Math.min(1, (p - .22) / .78));
    const reach = support ? 1 - 2 * ease(p / .22) : -1 + 2 * ease(swing);
    const fold = support ? 0 : Math.sin(swing * Math.PI) ** 2;
    const rootY = leg.front ? 5 : -6.8, restY = leg.front ? 10.1 : -7.3;
    const hoofY = restY + reach * activity * (leg.front ? 5.6 : 4.8);
    return { ...leg, root: { x: leg.side * 3.25, y: rootY }, knee: { x: leg.side * (3.9 - fold * activity * .4), y: rootY + (hoofY - rootY) * .55 }, hoof: { x: leg.side * (4.35 - fold * activity * .65), y: hoofY } };
  });
}

export function racingGateWalk(elapsed: number, index: number, approach: number) {
  const progress = smooth((elapsed - index * 55) / 2000);
  return { distance: approach * progress, progress };
}

/** During stance, hoof retraction exactly cancels the horse's travelled distance. */
export function racingWalkingTopLegPose(distance: number, index: number) {
  const stance = .64, stride = 12, phase = (distance / (stride / stance) + index * .13) % 1;
  return [
    { side: -1, front: false, offset: .5 }, { side: 1, front: false, offset: 0 },
    { side: -1, front: true, offset: .25 }, { side: 1, front: true, offset: .75 },
  ].map(leg => {
    const p = (phase - leg.offset + 1) % 1, support = p < stance;
    const swing = clamp((p - stance) / (1 - stance), 0, 1), fold = support ? 0 : Math.sin(swing * Math.PI) ** 2;
    const rootY = leg.front ? 5 : -6.8, restY = leg.front ? 10.1 : -7.3;
    const hoofY = restY + (support ? stride * (.5 - p / stance) : stride * (smooth(swing) - .5));
    return { ...leg, support, root: { x: leg.side * 3.25, y: rootY }, knee: { x: leg.side * (3.9 - fold * .4), y: rootY + (hoofY - rootY) * .55 }, hoof: { x: leg.side * (4.35 - fold * .65), y: hoofY } };
  });
}

/** Finish the last swing, then place the other feet before waiting in the stall. */
export function racingGateLegPose(elapsed: number, index: number, approach: number, preview = false, reduced = false) {
  const resting = racingTopLegPose(0, index, false, true).map(leg => ({ ...leg, support: true }));
  if (preview || reduced) return resting;
  const walk = racingGateWalk(elapsed, index, approach), walking = racingWalkingTopLegPose(walk.distance, index);
  const arrivedAt = 2000 + index * 55;
  if (elapsed <= arrivedAt) return walking;
  const steps = walking.map((leg, legIndex) => ({ legIndex, support: leg.support })).sort((a, b) => Number(a.support) - Number(b.support));
  return walking.map((leg, legIndex) => {
    const order = steps.findIndex(step => step.legIndex === legIndex), progress = clamp((elapsed - arrivedAt - order * 80) / 160, 0, 1);
    const settle = smooth(progress), lift = Math.sin(progress * Math.PI) ** 2;
    const target = resting[legIndex];
    const blendPoint = (point: { x: number; y: number }, destination: { x: number; y: number }, tuck = 0) => ({ x: point.x + (destination.x - point.x) * settle - leg.side * lift * tuck, y: point.y + (destination.y - point.y) * settle });
    return { ...leg, support: progress >= 1 || (progress <= 0 && leg.support), root: blendPoint(leg.root, target.root), knee: blendPoint(leg.knee, target.knee, .2), hoof: blendPoint(leg.hoof, target.hoof, .35) };
  });
}

function topHorse(ctx: CanvasRenderingContext2D, candidate: Candidate, index: number, x: number, y: number, angle: number, scale: number, clock: number, reduced: boolean, running: boolean | number, gateLegs?: ReturnType<typeof racingGateLegPose>) {
  const activity = reduced ? 0 : typeof running === 'number' ? clamp(running, 0, 1) : Number(running);
  const gait = reduced ? 0 : clock / (95 + index % 5 * 7) + index * 1.91, stride = Math.sin(gait) * activity, breath = reduced ? 0 : Math.sin(clock / 680 + index) * .22 * (1 - activity);
  const coat = coats[index % coats.length], dark = shadows[index % shadows.length];
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle - Math.PI / 2); ctx.scale(scale, scale);
  ellipse(ctx, 1.8, 2.2, 6.8, 14, '#07132166');
  ctx.lineCap = 'round';
  const gallop = racingTopLegPose(clock, index, running, reduced);
  const legs = gateLegs ? gateLegs.map((leg, i) => {
    const blendPoint = (point: { x: number; y: number }, target: { x: number; y: number }) => ({ x: point.x + (target.x - point.x) * activity, y: point.y + (target.y - point.y) * activity });
    return { ...leg, root: blendPoint(leg.root, gallop[i].root), knee: blendPoint(leg.knee, gallop[i].knee), hoof: blendPoint(leg.hoof, gallop[i].hoof) };
  }) : gallop;
  for (const [leg, pose] of legs.entries()) {
    ctx.strokeStyle = dark; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(pose.root.x, pose.root.y); ctx.lineTo(pose.knee.x, pose.knee.y); ctx.stroke();
    ctx.strokeStyle = leg % 3 === 0 ? '#d2c6af' : coat; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(pose.knee.x, pose.knee.y); ctx.lineTo(pose.hoof.x, pose.hoof.y); ctx.stroke();
    ctx.strokeStyle = '#172129'; ctx.lineWidth = 1.45; ctx.beginPath(); ctx.moveTo(pose.hoof.x, pose.hoof.y - .3); ctx.lineTo(pose.hoof.x, pose.hoof.y + .6); ctx.stroke();
  }
  ctx.strokeStyle = dark; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(2 + stride, -12, -1 + stride * 1.6, -17); ctx.stroke();
  const sway = breath + Math.sin(gait + .4) * .32 * activity;
  ellipse(ctx, sway, -2, 5.1, 10.2, dark); ellipse(ctx, sway - .5, -2.5, 4.5, 9.6, coat);
  ellipse(ctx, sway, 4.8, 4.3, 5.7, coat); ctx.fillStyle = '#f0d3a424'; ctx.fillRect(-3.2 + sway, -7, 1.5, 4.2);
  ellipse(ctx, sway - .4, 7.8, 2.8, 6, dark); ellipse(ctx, sway - .9, 7.6, 2.4, 6, coat);
  ellipse(ctx, sway - .3, 13, 3, 4.4, coat); ctx.fillStyle = dark; ctx.fillRect(-2.8 + sway, 8.2, 1.1, 3); ctx.fillRect(1.5 + sway, 8.2, 1.1, 3);
  ctx.fillStyle = index % 2 === 0 ? '#e6d7ba' : dark; ctx.fillRect(-1.1 + sway, 12.2, 1.8, 3.8); ctx.fillStyle = dark; ctx.fillRect(-2 + sway, 16, 3.5, 1.1);
  box(ctx, -4.5, -5.3, 9, 8.8, candidate.color, '#18232c'); ctx.fillStyle = '#142332'; ctx.fillRect(-3.6, -4.2, 7.2, 3.7);
  ctx.strokeStyle = '#e0d9bf99'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-3.7, 2.4); ctx.lineTo(3.7, 2.4); ctx.stroke();
  // Knees grip the saddle; boots and stirrups stay attached while the rider folds forward.
  const crouch = -.8 + activity * (1.6 + stride * .27);
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
export function drawRacingTopView(ctx: CanvasRenderingContext2D, w: number, h: number, candidates: Candidate[], standings: RacingCourseStanding[], clock: number, reduced: boolean, _focusIds: string[] = []) {
  if (w <= 0 || h <= 0 || !candidates.length) return;
  ctx.save();
  const size = clamp(Math.min(w / 640, h / 260), .25, 1.15), course = geometry(w, h);
  const startMarks = candidates.map((_, index) => racingCoursePoint(w, h, 0, index, candidates.length));
  ctx.beginPath(); startMarks.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = '#dddcc6a0'; ctx.lineWidth = Math.max(.6, h * .004); ctx.stroke();
  const positions = candidates.map((candidate, index) => {
    const distance = standings.find(standing => standing.id === candidate.id)?.distance ?? 0;
    const flow = smooth((distance - .018) / .085) * (1 - smooth((distance - .91) / .07));
    const seed = candidate.id.split('').reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 7) % 101 / 101;
    const crowd = Math.max(0, ...standings.filter(standing => standing.id !== candidate.id).map(standing => 1 - smooth(Math.abs(standing.distance - distance) / .025)));
    const roam = clamp(.22 + seed * .40 + Math.sin(distance * TAU * 1.45 + seed * TAU) * .10 + (seed > .5 ? 1 : -1) * crowd * .055, .09, .86);
    const lane = index + (roam * (candidates.length - 1) - index) * flow;
    const position = racingCoursePoint(w, h, distance, index, candidates.length);
    const baseLane = (index + .5) / candidates.length - .5, shift = (lane - index) / candidates.length * .76;
    const skew = courseSkew(w, h), rawY = position.y - (position.x - course.cx) * skew;
    const theta = Math.atan2((rawY - course.cy) / (course.ry + baseLane * course.trackY * .76), (position.x - course.cx) / (course.rx + baseLane * course.trackX * .76));
    const lateralX = Math.cos(theta) * course.trackX * shift;
    position.x += lateralX; position.y += Math.sin(theta) * course.trackY * shift + lateralX * skew;
    // Lateral room is cosmetic; each nose keeps the original arc-length progress and finish line.
    return { candidate, index, position, running: distance < 1 };
  });
  positions.sort((a, b) => a.position.y - b.position.y);
  for (const { candidate, index, position, running } of positions) {
    const bodyX = position.x - Math.cos(position.angle) * 17.4 * size, bodyY = position.y - Math.sin(position.angle) * 17.4 * size;
    if (!reduced && running) {
      ctx.save(); ctx.translate(bodyX, bodyY); ctx.rotate(position.angle - Math.PI / 2);
      const alpha = ctx.globalAlpha;
      for (let dust = 0; dust < 6; dust++) { const age = ((clock + index * 139 + dust * 103) % 410) / 410, side = dust % 2 ? 1 : -1; ctx.globalAlpha = alpha * (1 - age) * smooth(age / .15) * .35; ellipse(ctx, (side * 4 + Math.sin(index + dust * 2) * age * 3) * size, (-7 - age * 20) * size, (.8 + age * 2) * size, (.45 + age) * size, '#dec499'); }
      ctx.globalAlpha = alpha; ctx.strokeStyle = '#b1c4bf38'; ctx.lineWidth = Math.max(.4, size * .5);
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 7 * size, -8 * size); ctx.lineTo(side * 7 * size, -18 * size); ctx.stroke(); }
      ctx.restore();
    }
    topHorse(ctx, candidate, index, bodyX, bodyY, position.angle, size, clock, reduced, running);
  }
  const font = clamp(Math.min(w / 46, h / 13), 6.4, 10), tagW = font * 1.9, tagH = font * 1.48, occupied: { x: number; y: number }[] = [];
  // Stable number placement and coat borders avoid a bright highlight whenever the story changes.
  const byPriority = [...positions].sort((a, b) => a.index - b.index);
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
    box(ctx, tx - tagW / 2, ty - tagH / 2, tagW, tagH, '#0c2033ef', candidate.color); label(ctx, String(index + 1).padStart(2, '0'), tx, ty, font, '#f6ebcf');
  }
  ctx.restore();
}

/** The track line, closed gate doors and horse noses use one shared transverse boundary. */
export function drawRacingStartingGate(ctx: CanvasRenderingContext2D, w: number, h: number, candidates: Candidate[], clock: number, reduced: boolean, elapsed: number, preview = false) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  const sand = ctx.createLinearGradient(0, 0, w, h); sand.addColorStop(0, '#715a43'); sand.addColorStop(.5, '#aa895c'); sand.addColorStop(1, '#7b6249'); ctx.fillStyle = sand; ctx.fillRect(0, 0, w, h);
  const count = Math.max(1, candidates.length), layout = racingStartingLayout(w, h, count), slot = layout.slotWidth;
  const scale = Math.max(.1, Math.min(slot / 15, h / 135)), font = clamp(Math.min(slot * .27, h * .085), 7, 12), gateDepth = 36 * scale;
  const trace = (points: RacingCoursePosition[]) => { ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); };
  trace(layout.innerRail); ctx.lineTo(-w, h * 2); ctx.lineTo(-w, -h); ctx.closePath(); ctx.fillStyle = '#28543e'; ctx.fill();
  trace(layout.outerRail); ctx.lineTo(w * 2, h * 2); ctx.lineTo(w * 2, -h); ctx.closePath(); ctx.fillStyle = '#31464a'; ctx.fill();
  for (let grain = 0; grain < 200; grain++) { const px = w * (grain * .618033 % 1), py = grain * 37.7 % h; ctx.fillStyle = grain % 3 ? '#473b2528' : '#ecd49d29'; ctx.fillRect(px, py, 1.2, .7); }
  // The bend remains visible before and after the stalls, including its inner turf.
  for (const rail of [layout.innerRail, layout.outerRail]) {
    trace(rail); ctx.strokeStyle = '#253a35'; ctx.lineWidth = Math.max(3, w / 210); ctx.stroke();
    trace(rail); ctx.strokeStyle = '#eee5c2'; ctx.lineWidth = Math.max(1.1, w / 350); ctx.stroke();
    rail.filter((_, index) => index % 6 === 0).forEach(point => { ctx.fillStyle = '#ecdfb8'; ctx.fillRect(point.x - 1, point.y - 3, 2, 5); });
  }
  label(ctx, '안쪽 · 잔디', w * .10, h * .09, clamp(w / 75, 8, 12), '#d2dfbb');
  label(ctx, '바깥쪽', w * .89, h * .92, clamp(w / 75, 8, 12), '#d1dfd4');
  const marks = layout.slots;
  trace(layout.startLine); ctx.strokeStyle = '#eee3bc88'; ctx.lineWidth = Math.max(1, h * .009); ctx.stroke();
  const launch = preview ? 0 : reduced ? Number(elapsed >= 5500) : smooth((elapsed - 5500) / 1150), opened = preview ? 0 : smooth((elapsed - 5500) / 430);
  // All front bars follow the start line; perspective places inside stalls farther away.
  candidates.forEach((candidate, index) => {
    const mark = marks[index], approach = Math.min(44, h * .28 / scale);
    const walk = preview || reduced ? { distance: approach, progress: 1 } : racingGateWalk(elapsed, index, approach);
    const travel = -17.4 * scale - (approach - walk.distance) * scale + launch * h * .82;
    ctx.save(); ctx.translate(mark.x, mark.y); ctx.rotate(mark.angle - Math.PI / 2);
    const horseY = travel;
    box(ctx, -slot * .47, -gateDepth - 4 * scale, slot * .94, gateDepth + 5 * scale, '#132a3b32');
    ctx.strokeStyle = '#eee3bc'; ctx.lineWidth = Math.max(1, h * .009); ctx.beginPath(); ctx.moveTo(-slot * .46, 0); ctx.lineTo(slot * .46, 0); ctx.stroke();
    box(ctx, -slot * .48, -gateDepth - font * 1.8, slot * .96, Math.max(2, scale * 2.2), '#3e5a69', '#9daea7');
    for (const side of [-1, 1]) {
      const wall = side * slot * .48; ctx.fillStyle = '#152c3d'; ctx.fillRect(wall - 1.3 * scale, -gateDepth, 2.6 * scale, gateDepth + 3 * scale);
      ctx.fillStyle = '#91a5a7'; ctx.fillRect(wall - .6 * scale, -gateDepth, 1.2 * scale, gateDepth + scale);
      for (let bar = 0; bar < 4; bar++) { ctx.strokeStyle = '#d3ddcc66'; ctx.lineWidth = .8 * scale; ctx.beginPath(); ctx.moveTo(wall - 1.1 * scale, -gateDepth + (bar + 1) * gateDepth / 5); ctx.lineTo(wall + 1.1 * scale, -gateDepth + (bar + 1) * gateDepth / 5); ctx.stroke(); }
    }
    topHorse(ctx, candidate, index, 0, horseY, Math.PI / 2, scale, clock, reduced, launch, racingGateLegPose(elapsed, index, approach, preview, reduced));
    for (const side of [-1, 1]) {
      const hingeX = side * slot * .43, tipX = hingeX - side * slot * .42 * (1 - opened), tipY = opened * slot * .31;
      ctx.strokeStyle = '#dae2cb'; ctx.lineWidth = Math.max(.8, scale); ctx.beginPath(); ctx.moveTo(hingeX, 0); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#44646e'; ctx.lineWidth = Math.max(1.5, scale * 2); ctx.beginPath(); ctx.moveTo(hingeX, -1.4 * scale); ctx.lineTo(tipX, tipY - 1.4 * scale); ctx.stroke();
    }
    const signW = Math.min(slot * .84, font * 2.4), signY = -gateDepth - font * .95;
    box(ctx, -signW / 2, signY - font * .64, signW, font * 1.28, '#102435', candidate.color); label(ctx, String(index + 1).padStart(2, '0'), 0, signY, font, '#f5e5ba');
    const ready = !preview && elapsed >= 3900, lamp = clamp(scale, .8, 2); ellipse(ctx, signW / 2 + 4, signY, lamp, lamp, ready ? '#d6bf78' : '#8ba49a');
    ctx.restore();
  });
  if (!candidates.length) label(ctx, '이름을 적으면 출발 준비를 시작해요', w / 2, h / 2, Math.max(8, Math.min(14, w / 28)), '#f3e4bf');
  ctx.restore();
}
