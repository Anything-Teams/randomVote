import type { Candidate } from './election';

const coats = ['#956040', '#4b4144', '#bd8858', '#d4cab6', '#796457', '#ac663f'];
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export function raceLabel(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, center = false) {
  ctx.font = `800 ${size}px "Malgun Gothic", sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = center ? 'center' : 'left'; ctx.fillStyle = color; ctx.fillText(value, x, y);
}
export function raceBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, border?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); ctx.fillStyle = color; ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke(); }
}
const path = (ctx: CanvasRenderingContext2D, draw: () => void, fill: string | CanvasGradient | CanvasPattern, stroke?: string) => {
  ctx.beginPath(); draw(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .7; ctx.stroke(); }
};

/** Four independently articulated legs, flexing neck, crouched rider and layered coat shading. */
export function drawRaceHorse(ctx: CanvasRenderingContext2D, candidate: Candidate, index: number, x: number, y: number, scale: number, clock: number, speed: number, reduced: boolean, cheer = false, lean = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const alpha = ctx.globalAlpha, moving = speed > .15;
  const cycle = clock / (100 + index % 5 * 7) + index * 1.91;
  const stride = moving && !reduced ? Math.sin(cycle) : 0;
  const bounce = moving && !reduced ? -Math.abs(Math.sin(cycle)) * (2.8 + index % 3 * .65) : reduced ? 0 : Math.sin(clock / 900 + index) * .5;
  const coat = coats[index % coats.length], dark = ['#583928', '#302e35', '#805632', '#a09b90', '#514a41', '#773e28'][index % 6];
  ctx.fillStyle = '#07162455'; ctx.beginPath(); ctx.ellipse(-2, 3, 39 + bounce, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  const leg = (hip: number, offset: number, rear: boolean, far: boolean) => {
    const swing = moving && !reduced ? Math.sin(cycle + offset) * clamp(speed, .8, 1.15) : 0;
    const folded = moving && !reduced ? Math.max(0, Math.cos(cycle + offset)) : 0;
    const kneeX = hip + swing * (rear ? 15 : 12), kneeY = -27 + bounce + Math.sqrt(Math.max(25, 225 - swing * swing * 120));
    const hoofX = kneeX + (rear ? -swing * 13 : swing * 8) - folded * 11, hoofY = kneeY + 12 - folded * 13;
    ctx.globalAlpha = alpha * (far ? .6 : 1); ctx.lineCap = 'round';
    ctx.strokeStyle = far ? dark : coat; ctx.lineWidth = 6.2; ctx.beginPath(); ctx.moveTo(hip, -24 + bounce); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.lineWidth = 3.7; ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(hoofX, hoofY); ctx.stroke();
    ctx.strokeStyle = index % 3 === 0 ? '#e4ddc8' : dark; ctx.lineWidth = 3.1; ctx.beginPath(); ctx.moveTo(kneeX + (hoofX - kneeX) * .7, kneeY + (hoofY - kneeY) * .7); ctx.lineTo(hoofX, hoofY); ctx.stroke();
    ctx.strokeStyle = '#17202b'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(hoofX - 1, hoofY); ctx.lineTo(hoofX + 4.5, hoofY - 1); ctx.stroke(); ctx.globalAlpha = alpha;
  };
  leg(-22, 2.6, true, true); leg(18, .6, false, true);
  ctx.save(); ctx.translate(0, bounce); ctx.rotate(lean * .018);
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-32, -30); ctx.bezierCurveTo(-45, -28, -37 - stride * 5, -13, -50, -16 + stride * 6); ctx.stroke();
  ctx.strokeStyle = '#271f2080'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-34, -30); ctx.bezierCurveTo(-44, -24, -43, -11, -52, -17 + stride * 6); ctx.stroke();
  const body = ctx.createLinearGradient(0, -43, 0, -14); body.addColorStop(0, coat); body.addColorStop(.48, coat); body.addColorStop(1, dark);
  path(ctx, () => { ctx.moveTo(-35, -29); ctx.bezierCurveTo(-33, -41, -22, -43, -10, -39); ctx.bezierCurveTo(0, -42, 19, -40, 27, -31); ctx.bezierCurveTo(31, -19, 18, -13, 4, -16); ctx.bezierCurveTo(-13, -13, -32, -16, -35, -29); }, body, dark);
  path(ctx, () => { ctx.moveTo(13, -24); ctx.bezierCurveTo(23, -36, 19, -45, 30, -53 + stride * .6); ctx.lineTo(40, -50); ctx.bezierCurveTo(33, -34, 35, -23, 21, -19); ctx.closePath(); }, coat, dark);
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(21, -32); ctx.bezierCurveTo(24, -42, 25, -50, 31, -54); ctx.stroke();
  path(ctx, () => { ctx.moveTo(29, -54); ctx.lineTo(30, -63); ctx.lineTo(35, -54); ctx.lineTo(38, -52); ctx.lineTo(41, -60); ctx.lineTo(44, -50); ctx.bezierCurveTo(50, -49, 57, -44, 57, -40); ctx.bezierCurveTo(56, -33, 43, -38, 36, -40); ctx.bezierCurveTo(28, -39, 24, -47, 29, -54); }, coat, dark);
  path(ctx, () => { ctx.moveTo(48, -44); ctx.bezierCurveTo(58, -43, 61, -35, 53, -35); ctx.lineTo(45, -39); ctx.closePath(); }, index % 3 === 0 ? '#e5d6bb' : dark);
  if (index % 2 === 0) path(ctx, () => { ctx.moveTo(36, -52); ctx.lineTo(41, -49); ctx.lineTo(45, -39); ctx.lineTo(40, -40); ctx.closePath(); }, '#f4e7ca');
  ctx.fillStyle = '#090f19'; ctx.beginPath(); ctx.arc(41, -47, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(54, -40, 1.4, 1.1);
  ctx.strokeStyle = '#252027'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(52, -45); ctx.lineTo(48, -35); ctx.lineTo(24, -37); ctx.lineTo(12, -36); ctx.stroke();
  ctx.strokeStyle = '#efd6ac'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(49, -36); ctx.lineTo(35, -43); ctx.lineTo(8, -32); ctx.stroke();
  ctx.strokeStyle = `${coat}88`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, -31); ctx.bezierCurveTo(-18, -39, -9, -36, -7, -25); ctx.moveTo(16, -33); ctx.bezierCurveTo(25, -29, 24, -23, 17, -19); ctx.stroke();
  raceBox(ctx, -16, -38, 33, 21, 3, candidate.color, '#192434');
  ctx.fillStyle = '#ffffff77'; ctx.fillRect(-14, -36, 29, 2); raceLabel(ctx, String(index + 1).padStart(2, '0'), 0, -26, 10, '#111e2c', true);
  const riderBounce = moving && !reduced ? Math.cos(cycle) * 1.5 : 0;
  ctx.save(); ctx.translate(3, -45 + riderBounce); ctx.rotate(moving ? -.14 - Math.max(0, speed - 1) * .25 + Math.max(0, 1 - speed) * .18 + lean * .015 : .08);
  ctx.strokeStyle = '#e3e0d8'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-12, 10); ctx.lineTo(1, 17); ctx.stroke();
  ctx.strokeStyle = '#142135'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-1, 15); ctx.lineTo(4, 17); ctx.stroke();
  path(ctx, () => { ctx.moveTo(-10, -4); ctx.lineTo(1, -15); ctx.bezierCurveTo(9, -15, 12, -8, 8, -3); ctx.lineTo(-3, 5); ctx.closePath(); }, candidate.color, '#243447');
  ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(4, -12); ctx.stroke();
  ctx.strokeStyle = candidate.color; ctx.lineWidth = 4.3; ctx.beginPath(); ctx.moveTo(5, -10); ctx.lineTo(cheer ? 12 : 16, cheer ? -26 - (reduced ? 0 : Math.sin(clock / 190) * 3) : -2); ctx.lineTo(cheer ? 22 : 25, cheer ? -29 : -4); ctx.stroke();
  ctx.fillStyle = '#ecc39e'; ctx.beginPath(); ctx.arc(14, -19, 5.2, 0, Math.PI * 2); ctx.fill();
  path(ctx, () => { ctx.moveTo(8, -20); ctx.bezierCurveTo(8, -30, 20, -31, 21, -22); ctx.lineTo(24, -21); ctx.lineTo(8, -20); }, candidate.color, '#1b2b3e');
  ctx.strokeStyle = '#ecf3ee'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(10, -26); ctx.lineTo(16, -27); ctx.stroke();
  ctx.fillStyle = '#15273e'; ctx.fillRect(15, -21, 5, 2.4); ctx.restore(); ctx.restore();
  leg(-22, 3.8, true, false); leg(18, 0, false, false);
  ctx.restore();
}

export function drawRaceStadium(ctx: CanvasRenderingContext2D, w: number, h: number, clock: number, reduced: boolean, close = false, finish = false) {
  const scroll = reduced ? 0 : clock * .12;
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#091323'); sky.addColorStop(.3, '#243a54'); sky.addColorStop(.42, '#334c49'); sky.addColorStop(1, '#3b4d34'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const horizon = h * (close ? .36 : .29);
  // Sweeping roof, tiered architecture and hundreds of individually colored spectators.
  ctx.fillStyle = '#0d2030'; ctx.beginPath(); ctx.moveTo(-20, h * .06); ctx.lineTo(w * .42, h * .02); ctx.lineTo(w + 20, h * .09); ctx.lineTo(w + 20, h * .16); ctx.lineTo(0, h * .12); ctx.fill();
  ctx.strokeStyle = '#6f8b9c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, h * .12); ctx.lineTo(w, h * .16); ctx.stroke();
  for (let row = 0; row < 5; row++) {
    const y = h * .145 + row * (horizon - h * .17) / 5;
    ctx.fillStyle = row % 2 ? '#344859' : '#273b4d'; ctx.fillRect(0, y, w, Math.max(3, h * .027));
    const seat = close ? 7 : 5;
    for (let person = -2; person < w / seat + 3; person++) {
      const px = person * seat - (close ? scroll * .06 % seat : 0), bounce = reduced ? 0 : Math.sin(clock / 500 + person * 1.4 + row) * .5;
      ctx.fillStyle = ['#d4a578', '#e3be75', '#889fc9', '#ad7681', '#82ad9c', '#c8d0c4'][(person + row * 3 + 120) % 6];
      ctx.fillRect(px, y + bounce + 1, 2, 2); ctx.fillStyle = ['#435577', '#764451', '#ac895b', '#477a77'][Math.abs(person + row) % 4]; ctx.fillRect(px - .3, y + 3, 3, 3);
    }
    ctx.fillStyle = '#71879688'; ctx.fillRect(0, y + Math.max(6, h * .029), w, 1);
  }
  for (let column = 0; column < 6; column++) { const x = column * w / 5 - (close ? scroll * .025 % (w / 5) : 0); ctx.fillStyle = '#102334'; ctx.fillRect(x, h * .09, Math.max(2, w / 300), horizon - h * .09); }
  const boardY = horizon - h * .014, boardH = Math.max(12, h * .065), boardW = Math.max(70, w * .19);
  const brands = ['DERBY CLUB', 'FULL GALLOP', 'RUN TOGETHER', '1600 M'];
  for (let panel = -1; panel < Math.ceil(w / boardW) + 1; panel++) {
    const x = panel * boardW - (close ? scroll * .13 % boardW : 0); raceBox(ctx, x + 2, boardY, boardW - 4, boardH, 1, panel % 2 ? '#ead9b1' : '#193d50');
    raceLabel(ctx, brands[(panel + 100) % 4], x + boardW / 2, boardY + boardH / 2, clamp(boardW / 13, 5, 12), panel % 2 ? '#29394a' : '#c6dfa4', true);
  }
  // Floodlights leave visible warm pools on the course.
  for (const position of [.08, .89]) {
    const x = w * position; ctx.strokeStyle = '#778993'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, h * .02); ctx.lineTo(x, horizon); ctx.stroke();
    ctx.fillStyle = '#f4e5b4'; ctx.fillRect(x - 10, h * .02, 20, 3);
    const glow = ctx.createRadialGradient(x, h * .03, 1, x, h * .03, h * .5); glow.addColorStop(0, '#fff0bb30'); glow.addColorStop(1, '#fff0bb00'); ctx.fillStyle = glow; ctx.fillRect(x - h * .5, 0, h, h * .6);
  }
  if (close) {
    const ground = ctx.createLinearGradient(0, horizon, 0, h); ground.addColorStop(0, '#77674e'); ground.addColorStop(.3, '#ad9164'); ground.addColorStop(1, '#64543c'); ctx.fillStyle = ground; ctx.fillRect(0, horizon + boardH, w, h);
    for (let row = 0; row < 14; row++) {
      const depth = row / 14, y = horizon + boardH + depth * (h - horizon - boardH), interval = 11 + depth * 37;
      for (let grain = -2; grain < w / interval + 2; grain++) { const x = grain * interval - scroll * (.1 + depth * .72) % interval; ctx.strokeStyle = row % 2 ? '#dbc19625' : '#342e2925'; ctx.lineWidth = 1 + depth; ctx.beginPath(); ctx.moveTo(x, y + Math.sin(grain * 2.1 + row) * 2); ctx.lineTo(x + 3 + depth * 13, y - depth * 2); ctx.stroke(); }
    }
    const rail = horizon + boardH + 4; ctx.strokeStyle = '#ede4cb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, rail); ctx.lineTo(w, rail + h * .024); ctx.stroke();
    for (let post = -1; post < w / 46 + 2; post++) { const x = post * 46 - scroll * .31 % 46; ctx.fillStyle = '#d3d8c8'; ctx.fillRect(x, rail, 2, h * .055); }
    // Fast near-side rail and turf provide parallax without moving the racers off screen.
    ctx.fillStyle = '#284733'; ctx.fillRect(0, h * .97, w, h * .03);
    ctx.strokeStyle = '#eee5ca99'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, h * .94); ctx.lineTo(w, h * .99); ctx.stroke();
    for (let post = -1; post < w / 90 + 2; post++) { const x = post * 90 - scroll * .8 % 90; ctx.fillStyle = '#d2d4be'; ctx.fillRect(x, h * .945, 3, h * .08); }
    if (finish) { const x = w * .82; for (let y = Math.floor(h * .46); y < h; y += 7) for (let col = 0; col < 2; col++) { ctx.fillStyle = (Math.floor(y / 7) + col) % 2 ? '#121f2d' : '#f4e9cd'; ctx.fillRect(x + col * 5, y, 5, 7); } ctx.strokeStyle = '#e4d6b2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, h * .1); ctx.lineTo(x, h * .44); ctx.stroke(); }
  } else {
    const cx = w * .5, cy = h * .66, rx = w * .48, ry = h * .31;
    ctx.fillStyle = '#705e42'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b3996b'; ctx.lineWidth = Math.max(2, h * .04); ctx.beginPath(); ctx.ellipse(cx, cy, rx * .9, ry * .83, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#315443'; ctx.beginPath(); ctx.ellipse(cx, cy, rx * .71, ry * .53, 0, 0, Math.PI * 2); ctx.fill();
    for (let ring = 0; ring < 4; ring++) { ctx.strokeStyle = ring % 2 ? '#63855744' : '#b9a27333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, rx * (.73 + ring * .069), ry * (.57 + ring * .11), 0, 0, Math.PI * 2); ctx.stroke(); }
    for (let dot = 0; dot < 90; dot++) { const angle = dot * .94; ctx.fillStyle = '#c6ab722a'; ctx.fillRect(cx + Math.cos(angle) * rx * (.78 + dot % 4 * .04), cy + Math.sin(angle) * ry * (.65 + dot % 3 * .12), 3, 1); }
    ctx.strokeStyle = '#ece5c9'; ctx.lineWidth = 2; for (const size of [1, .73]) { ctx.beginPath(); ctx.ellipse(cx, cy, rx * size, ry * (size === 1 ? 1 : .56), 0, 0, Math.PI * 2); ctx.stroke(); }
    const screenW = w * .31; raceBox(ctx, cx - screenW / 2, h * .46, screenW, h * .12, 3, '#081d2a', '#8da795'); raceLabel(ctx, 'DERBY NIGHT', cx, h * .52, clamp(w / 47, 8, 19), '#efdda7', true);
    ctx.fillStyle = '#113124'; ctx.fillRect(cx - screenW * .36, h * .59, screenW * .72, 2); ctx.fillRect(cx - screenW * .3, h * .57, 3, h * .06); ctx.fillRect(cx + screenW * .3, h * .57, 3, h * .06);
  }
  const vignette = ctx.createLinearGradient(0, 0, w, 0); vignette.addColorStop(0, '#06132535'); vignette.addColorStop(.16, '#06132500'); vignette.addColorStop(.84, '#06132500'); vignette.addColorStop(1, '#06132545'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
}

export function drawRaceDust(ctx: CanvasRenderingContext2D, index: number, x: number, y: number, scale: number, clock: number, reduced: boolean, effort = 1) {
  if (reduced) return;
  for (let particle = 0; particle < 9; particle++) {
    const age = (clock + index * 111 + particle * 89) % 750 / 750;
    ctx.fillStyle = `rgba(211,187,143,${(1 - age) * .23 * effort})`; ctx.beginPath(); ctx.ellipse(x - (30 + age * (48 + effort * 8)) * scale, y + 2 - age * 11, (1.5 + age * 9) * scale, (.7 + age * 4) * scale, -.1, 0, Math.PI * 2); ctx.fill();
  }
}
