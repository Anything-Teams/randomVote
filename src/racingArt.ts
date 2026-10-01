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

export type RaceHorseMotion = { gait?: 'idle' | 'walk' | 'gallop'; phase?: number; settle?: number; victory?: number; stumble?: number; crouch?: number };

/** A grounded four-beat stride, with the rider's pelvis and boots tied to the saddle. */
export function drawRaceHorse(ctx: CanvasRenderingContext2D, candidate: Candidate, index: number, x: number, y: number, scale: number, clock: number, speed: number, reduced: boolean, cheer = false, lean = 0, motion: RaceHorseMotion = {}) {
  type Point = { x: number; y: number };
  const mix = (a: number, b: number, p: number) => a + (b - a) * p;
  const ease = (value: number) => { const p = clamp(value, 0, 1); return p * p * (3 - 2 * p); };
  const wrap = (value: number) => (value % 1 + 1) % 1;
  const rotate = (point: Point, angle: number): Point => ({ x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) });
  const joint = (a: Point, b: Point, upper: number, lower: number, bend: number): Point => {
    const dx = b.x - a.x, dy = b.y - a.y, raw = Math.hypot(dx, dy);
    const distance = clamp(raw, Math.abs(upper - lower) + .01, upper + lower - .01);
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along)), nx = dx / (raw || 1), ny = dy / (raw || 1);
    return { x: a.x + nx * along + ny * height * bend, y: a.y + ny * along - nx * height * bend };
  };
  const mode = motion.gait ?? (speed > .15 ? 'gallop' : 'idle');
  const settle = reduced ? 1 : clamp(motion.settle ?? 0, 0, 1);
  const activity = reduced || mode === 'idle' ? 0 : 1 - ease(settle);
  const period = mode === 'walk' ? 960 + index % 3 * 34 : 560 + index % 4 * 22;
  const phase = reduced ? 0 : wrap(motion.phase ?? clock / period + index * .193);
  const cycle = phase * Math.PI * 2;
  const effort = mode === 'walk' ? 1 : clamp(speed, .65, 1.4);
  const strideLength = mode === 'walk' ? 18 : 26 * (.90 + effort * .07);
  const stance = mode === 'walk' ? .62 : .20;
  const breath = reduced ? 0 : Math.sin(clock / 960 + index * .83) * .18;
  const stumble = reduced ? 0 : motion.stumble ?? 0, crouch = reduced ? 0 : clamp(motion.crouch ?? 0, 0, 1);
  const bob = mix(breath, .15 + Math.cos((phase - .12) * Math.PI * 2) * (mode === 'walk' ? .30 : 1.15), activity);
  // Give the cannon bones room below the belly, rather than folding four short legs into it.
  const bounce = bob - 12 + activity * (mode === 'walk' ? 2 : 4) + Math.abs(stumble) * 2;
  const pitch = activity * (clamp(lean, -8, 8) * .004 + (mode === 'walk' ? 0 : -.008 + Math.sin(cycle) * .012)) + stumble * .055;
  const bodyPoint = (point: Point): Point => { const p = rotate(point, pitch); return { x: p.x, y: p.y + bounce }; };
  const coat = coats[index % coats.length], dark = ['#583928', '#302e35', '#805632', '#a09b90', '#514a41', '#773e28'][index % 6];
  const legData = [
    { rear: true, far: true, hip: { x: -23, y: -27 }, offset: mode === 'walk' ? .50 : .05, rest: -22 },
    { rear: false, far: true, hip: { x: 18, y: -30.8 }, offset: mode === 'walk' ? .25 : .40, rest: 20 },
    { rear: true, far: false, hip: { x: -21, y: -27 }, offset: mode === 'walk' ? 0 : .18, rest: -19 },
    { rear: false, far: false, hip: { x: 21, y: -30.8 }, offset: mode === 'walk' ? .75 : .54, rest: 24 },
  ].map(data => {
    const p = wrap(phase - data.offset), support = p < stance;
    const swing = clamp((p - stance) / (1 - stance), 0, 1);
    const fold = Math.sin(swing * Math.PI) ** 2;
    const center = data.rear ? data.hip.x - 2 : data.hip.x + 2;
    const travelX = support ? center + strideLength * (.5 - p / stance) : mix(center - strideLength / 2, center + strideLength / 2, ease(swing)) + fold * (data.rear ? 4 : -6);
    const lift = support ? 0 : fold * (mode === 'walk' ? 3 : data.rear ? 9 : 13);
    const hoof = { x: mix(data.rest, travelX, activity), y: -2 - lift * activity };
    const hip = bodyPoint(data.hip);
    const ankle = { x: hoof.x - 1.8, y: hoof.y - 3.8 };
    if (data.rear) {
      // The thigh turns through landing and push-off. The hock always folds backward.
      const thighAngle = mix(.44, support ? mix(.44, -.40, ease(p / stance)) : mix(-.40, .44, ease(swing)) + fold * (mode === 'walk' ? .12 : .5), activity);
      const thighLength = Math.hypot(7, 8);
      const stifle = bodyPoint({ x: data.hip.x + Math.sin(thighAngle) * thighLength, y: data.hip.y + Math.cos(thighAngle) * thighLength });
      return { ...data, hip, knee: stifle, hock: joint(stifle, ankle, 11.5, 13, -1), ankle, hoof };
    }
    // Fore knees flex forward while the hoof gathers back under the chest.
    return { ...data, hip, knee: joint(hip, ankle, 19.1, 19.1, 1), hock: null, ankle, hoof };
  });
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = '#07162455'; ctx.beginPath(); ctx.ellipse(-2, 2.5, 38 + bob * .6, 4.1, 0, 0, Math.PI * 2); ctx.fill();
  const bone = (a: Point, b: Point, width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  const leg = (data: typeof legData[number]) => {
    ctx.globalAlpha = alpha * (data.far ? .86 : 1);
    bone(data.hip, data.knee, 6.2, data.far ? dark : coat);
    if (data.hock) {
      bone(data.knee, data.hock, 4.1, data.far ? dark : coat);
      bone(data.hock, data.ankle, 2.8, data.far ? dark : coat);
    } else bone(data.knee, data.ankle, 3.2, data.far ? dark : coat);
    bone(data.ankle, data.hoof, 2.8, data.far ? dark : coat);
    if (index % 3 === 0) {
      const sock = { x: mix(data.ankle.x, data.hoof.x, .58), y: mix(data.ankle.y, data.hoof.y, .58) };
      bone(sock, data.hoof, 3, '#e4ddc8');
    }
    bone({ x: data.hoof.x - 1.5, y: data.hoof.y }, { x: data.hoof.x + 3.7, y: data.hoof.y }, 3.8, '#17202b');
    ctx.globalAlpha = alpha;
  };
  leg(legData[0]); leg(legData[1]);
  ctx.save(); ctx.translate(0, bounce); ctx.rotate(pitch);
  const wind = reduced ? 0 : activity * (Math.sin(cycle - .45) * 1.7 + 1.5);
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-32, -30); ctx.bezierCurveTo(-43, -28, -43 - wind, -18, -50, -21 + wind); ctx.stroke();
  ctx.strokeStyle = '#271f2080'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-34, -30); ctx.bezierCurveTo(-43, -25, -46, -19, -52, -22 + wind); ctx.stroke();
  const body = ctx.createLinearGradient(0, -43, 0, -14); body.addColorStop(0, coat); body.addColorStop(.48, coat); body.addColorStop(1, dark);
  path(ctx, () => { ctx.moveTo(-35, -29); ctx.bezierCurveTo(-33, -41, -22, -43, -10, -39); ctx.bezierCurveTo(0, -42, 19, -40, 27, -31); ctx.bezierCurveTo(31, -19, 18, -13, 4, -16); ctx.bezierCurveTo(-13, -13, -32, -16, -35, -29); }, body, dark);
  const nod = reduced ? 0 : activity * Math.sin(cycle - .18) * .012;
  ctx.save(); ctx.translate(23, -29); ctx.rotate(nod); ctx.translate(-23, 29);
  path(ctx, () => { ctx.moveTo(13, -24); ctx.bezierCurveTo(23, -36, 19, -45, 30, -53); ctx.lineTo(40, -50); ctx.bezierCurveTo(33, -34, 35, -23, 21, -19); ctx.closePath(); }, coat, dark);
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(21, -32); ctx.bezierCurveTo(24, -42, 25, -50, 31, -54); ctx.stroke();
  path(ctx, () => { ctx.moveTo(29, -54); ctx.lineTo(30, -63); ctx.lineTo(35, -54); ctx.lineTo(38, -52); ctx.lineTo(41, -60); ctx.lineTo(44, -50); ctx.bezierCurveTo(50, -49, 57, -44, 57, -40); ctx.bezierCurveTo(56, -33, 43, -38, 36, -40); ctx.bezierCurveTo(28, -39, 24, -47, 29, -54); }, coat, dark);
  path(ctx, () => { ctx.moveTo(48, -44); ctx.bezierCurveTo(58, -43, 61, -35, 53, -35); ctx.lineTo(45, -39); ctx.closePath(); }, index % 3 === 0 ? '#e5d6bb' : dark);
  if (index % 2 === 0) path(ctx, () => { ctx.moveTo(36, -52); ctx.lineTo(41, -49); ctx.lineTo(45, -39); ctx.lineTo(40, -40); ctx.closePath(); }, '#f4e7ca');
  ctx.fillStyle = '#090f19'; ctx.beginPath(); ctx.arc(41, -47, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(54, -40, 1.4, 1.1);
  ctx.strokeStyle = '#252027'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(52, -45); ctx.lineTo(48, -35); ctx.lineTo(35, -41); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = coat + '88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, -31); ctx.bezierCurveTo(-18, -39, -9, -36, -7, -25); ctx.moveTo(16, -33); ctx.bezierCurveTo(25, -29, 24, -23, 17, -19); ctx.stroke();
  raceBox(ctx, -16, -38, 33, 21, 3, candidate.color, '#192434');
  ctx.fillStyle = '#ffffff77'; ctx.fillRect(-14, -36, 29, 2); raceLabel(ctx, String(index + 1).padStart(2, '0'), -6, -26, 10, '#111e2c', true);
  path(ctx, () => { ctx.moveTo(-11, -40); ctx.bezierCurveTo(-5, -44, 4, -43, 8, -39); ctx.lineTo(7, -36); ctx.lineTo(-10, -36); ctx.closePath(); }, '#2b2430', '#d6b985');
  const pelvis = { x: -3, y: -43 - activity * .55 };
  const shoulder = { x: mix(-2, 11, activity) + crouch * 5 - stumble * 3, y: mix(-59, -53, activity) - activity * Math.sin(cycle + .3) * .35 + crouch * 3 };
  const boot = { x: 5, y: -23 }, knee = joint(pelvis, boot, 12.5, 10.5, 1);
  bone(pelvis, knee, 5.2, '#e3e0d8'); bone(knee, boot, 4.4, '#e3e0d8');
  ctx.strokeStyle = '#b1a07e'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-1, -39); ctx.lineTo(6, -23); ctx.stroke();
  ctx.strokeStyle = '#d3bd8a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(7, -22.5, 4, 1.8, 0, 0, Math.PI * 2); ctx.stroke();
  bone({ x: boot.x - 2, y: boot.y }, { x: boot.x + 5, y: boot.y }, 3.8, '#142135');
  const victory = reduced ? (cheer ? 1 : 0) : ease(clamp(motion.victory ?? (cheer ? 1 : 0), 0, 1));
  const farHand = { x: mix(15, 24, activity), y: mix(-46, -43, activity) };
  const nearHand = { x: mix(mix(16, 25, activity), 13, victory), y: mix(mix(-45, -43, activity), -78, victory) };
  const bridle = rotate({ x: 49 - 23, y: -40 + 29 }, nod);
  ctx.strokeStyle = '#e1c496'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(bridle.x + 23, bridle.y - 29); ctx.quadraticCurveTo(34, -42, farHand.x, farHand.y); ctx.stroke();
  const riderArm = (a: Point, hand: Point, far: boolean) => {
    const distance = Math.hypot(hand.x - a.x, hand.y - a.y), reach = Math.min(1, 24.8 / Math.max(.01, distance));
    hand = { x: a.x + (hand.x - a.x) * reach, y: a.y + (hand.y - a.y) * reach };
    const elbow = joint(a, hand, 13, 12, -1);
    bone(a, elbow, far ? 3.6 : 4.2, candidate.color); bone(elbow, hand, far ? 3.3 : 3.8, candidate.color);
    ctx.fillStyle = '#ecc39e'; ctx.beginPath(); ctx.arc(hand.x, hand.y, 1.8, 0, Math.PI * 2); ctx.fill();
  };
  riderArm({ x: shoulder.x - 2, y: shoulder.y }, farHand, true);
  path(ctx, () => { ctx.moveTo(pelvis.x - 5, pelvis.y - 2); ctx.lineTo(shoulder.x - 5, shoulder.y - 2); ctx.quadraticCurveTo(shoulder.x + 3, shoulder.y - 4, shoulder.x + 6, shoulder.y + 2); ctx.lineTo(pelvis.x + 5, pelvis.y + 3); ctx.closePath(); }, candidate.color, '#243447');
  bone({ x: pelvis.x - 2, y: pelvis.y - 3 }, { x: shoulder.x + 1, y: shoulder.y - 1 }, 2, '#ffffffbb');
  riderArm(shoulder, nearHand, false);
  const head = { x: shoulder.x + 3, y: shoulder.y - 9 };
  bone({ x: shoulder.x + 1, y: shoulder.y - 2 }, { x: head.x - 1, y: head.y + 3 }, 3, '#ecc39e');
  ctx.fillStyle = '#ecc39e'; ctx.beginPath(); ctx.arc(head.x, head.y, 4.7, 0, Math.PI * 2); ctx.fill();
  path(ctx, () => { ctx.moveTo(head.x - 5.5, head.y - 1); ctx.bezierCurveTo(head.x - 6, head.y - 10, head.x + 5, head.y - 11, head.x + 6, head.y - 2); ctx.lineTo(head.x + 9, head.y - 1); ctx.lineTo(head.x - 5.5, head.y - 1); }, candidate.color, '#1b2b3e');
  bone({ x: head.x - 3, y: head.y - 7 }, { x: head.x + 2, y: head.y - 8 }, 1.6, '#ecf3ee');
  ctx.fillStyle = '#15273e'; ctx.fillRect(head.x + .8, head.y - 2, 4.5, 2.2);
  ctx.restore(); leg(legData[2]); leg(legData[3]); ctx.restore();
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
  if (reduced || effort <= .05) return;
  const period = 560 + index % 4 * 22, strength = clamp(effort, .2, 1.4);
  const reach = 13 * (.90 + clamp(effort, .65, 1.4) * .07);
  const horseClock = clock + index * .193 * period;
  for (const [leg, contact] of [.05, .18, .40, .54].entries()) {
    const sinceContact = ((horseClock - contact * period) % period + period) % period;
    for (let particle = 0; particle < 2; particle++) {
      const age = (sinceContact + particle * period) / 590;
      if (age >= 1) continue;
      const origin = [-25, -23, 20, 23][leg] + reach, trail = age * (38 + strength * 8);
      ctx.fillStyle = `rgba(211,187,143,${(1 - age) ** 2 * .24 * strength})`; ctx.beginPath();
      ctx.ellipse(x + (origin - trail) * scale, y + (1 - Math.sin(age * Math.PI) * 5) * scale, (1.1 + age * 5) * scale, (.55 + age * 2.2) * scale, -.1, 0, Math.PI * 2); ctx.fill();
    }
  }
}
