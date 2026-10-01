type ArenaSceneryOptions = { intensity?: number; reduced?: boolean };
const WIDTH = 1000, HEIGHT = 620;
const skinTones = ['#d9ab87', '#b58160', '#ecc5a1', '#916749', '#c69772'];
const shirts = ['#4d7983', '#997166', '#959067', '#52677d', '#73917c', '#83748b', '#bc976f', '#6f878b'];
const hairColors = ['#283438', '#473831', '#785746', '#282e34', '#6a635a'];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
let architecture: HTMLCanvasElement | undefined;
let cachedFrame: HTMLCanvasElement | undefined;
let cachedTime = Number.NaN, cachedIntensity = Number.NaN, cachedReduced = false;

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke?: string, thickness = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = thickness; ctx.stroke(); }
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); }
}
function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string) {
  ctx.font = `800 ${size}px "Malgun Gothic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y);
}
function seed(index: number) { let value = Math.imul(index + 97, 1597334677); value ^= value >>> 16; return (value >>> 0) / 0x100000000; }

function drawArchitecture(ctx: CanvasRenderingContext2D) {
  const wall = ctx.createLinearGradient(0, 0, 0, HEIGHT); wall.addColorStop(0, '#122632'); wall.addColorStop(.42, '#334852'); wall.addColorStop(1, '#293b3c');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // Roof girders and side lighting towers frame the scene; the middle is reserved for captions.
  ctx.fillStyle = '#10212d'; ctx.beginPath(); ctx.moveTo(0, 43); ctx.lineTo(220, 23); ctx.lineTo(780, 23); ctx.lineTo(WIDTH, 43); ctx.lineTo(WIDTH, 70); ctx.lineTo(780, 48); ctx.lineTo(220, 48); ctx.lineTo(0, 70); ctx.fill();
  ctx.strokeStyle = '#60757a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 69); ctx.lineTo(220, 47); ctx.lineTo(780, 47); ctx.lineTo(1000, 69); ctx.stroke();
  for (let girder = 0; girder < 8; girder++) {
    const x = 24 + girder * 136; ctx.strokeStyle = '#405c65'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 29); ctx.lineTo(x + 26, 48); ctx.lineTo(x + 52, 27); ctx.stroke();
  }
  for (const x of [31, 969]) {
    panel(ctx, x - 5, 62, 10, 182, '#283e49', '#62777e');
    for (let brace = 0; brace < 5; brace++) { ctx.strokeStyle = '#82928d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 4, 66 + brace * 34); ctx.lineTo(x + 4, 95 + brace * 34); ctx.stroke(); }
    panel(ctx, x - 23, 56, 46, 13, '#203640', '#8b9e9b');
    for (let light = 0; light < 5; light++) panel(ctx, x - 19 + light * 8, 59, 5, 7, '#f5e4b2');
  }
  // Six stepped decks with actual seat backs, walkways and three stair aisles.
  for (let tier = 0; tier < 6; tier++) {
    const y = 112 + tier * 20;
    ctx.fillStyle = tier % 2 ? '#263e48' : '#304852'; ctx.beginPath(); ctx.moveTo(18, y); ctx.quadraticCurveTo(500, y + 13, 982, y); ctx.lineTo(982, y + 20); ctx.quadraticCurveTo(500, y + 33, 18, y + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a9b8d3b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18, y + 19); ctx.quadraticCurveTo(500, y + 32, 982, y + 19); ctx.stroke();
    for (let seat = 0; seat < 60; seat++) {
      const x = 23 + seat * 16, dip = Math.sin(x / 1000 * Math.PI) * 6;
      if ([178, 500, 822].some(stair => Math.abs(x - stair) < 20)) continue;
      panel(ctx, x, y + 8 + dip, 10, 8, seat % 4 === 0 ? '#546c68' : '#435d63');
      panel(ctx, x + 1, y + 14 + dip, 9, 3, '#182e39');
    }
  }
  for (const x of [178, 500, 822]) {
    ctx.fillStyle = '#52605c'; ctx.beginPath(); ctx.moveTo(x - 10, 111); ctx.lineTo(x + 10, 111); ctx.lineTo(x + 22, 243); ctx.lineTo(x - 22, 243); ctx.closePath(); ctx.fill();
    for (let step = 0; step < 12; step++) {
      const y = 121 + step * 10, half = 10 + step * 1.05; panel(ctx, x - half, y, half * 2, 2, '#849085'); panel(ctx, x - half, y + 2, half * 2, 2, '#354a4c');
    }
    ctx.strokeStyle = '#b9c4ac'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, 112); ctx.lineTo(x - 24, 240); ctx.moveTo(x + 12, 112); ctx.lineTo(x + 24, 240); ctx.stroke();
    for (let post = 0; post < 4; post++) { const y = 116 + post * 39, side = 12 + post * 3.8; panel(ctx, x - side, y, 2, 10, '#8b9e95'); panel(ctx, x + side, y, 2, 10, '#8b9e95'); }
  }
  // Arena-side advertising and a steel safety rail sit behind the fighters.
  panel(ctx, 0, 238, 1000, 59, '#172e37');
  const banners = [
    { x: 44, w: 128, color: '#c5ae78', ink: '#283c43', text: '끝까지 버텨라' },
    { x: 210, w: 175, color: '#34585f', ink: '#d5d8b5', text: '모래판 CHAMPIONS' },
    { x: 407, w: 186, color: '#4c5c53', ink: '#d7d2b3', text: 'ARENA LIVE' },
    { x: 615, w: 175, color: '#34585f', ink: '#d5d8b5', text: '온몸으로 한 판' },
    { x: 828, w: 128, color: '#c5ae78', ink: '#283c43', text: '마지막 한 사람' },
  ];
  banners.forEach(banner => {
    panel(ctx, banner.x, 247, banner.w, 27, banner.color, '#c0c1a533'); label(ctx, banner.text, banner.x + banner.w / 2, 260, banner.w < 140 ? 10 : 12, banner.ink);
    for (const offset of [5, banner.w - 7]) { ellipse(ctx, banner.x + offset, 251, 1, 1, '#1b3037'); ellipse(ctx, banner.x + offset, 270, 1, 1, '#1b3037'); }
  });
  ctx.strokeStyle = '#b6c0ad'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 233); ctx.quadraticCurveTo(500, 254, 1000, 233); ctx.stroke();
  ctx.strokeStyle = '#617971'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 244); ctx.quadraticCurveTo(500, 265, 1000, 244); ctx.stroke();
  for (let post = 0; post < 17; post++) { const x = post * 62.5, dip = Math.sin(x / 1000 * Math.PI) * 10; panel(ctx, x, 233 + dip, 3, 23, '#839c91'); }
  // Quiet waiting areas give eliminated players a distinct, readable silhouette.
  for (const left of [true, false]) {
    const x = left ? 10 : 858;
    const floor = ctx.createLinearGradient(0, 286, 0, 610); floor.addColorStop(0, '#344a4b'); floor.addColorStop(1, '#203539');
    ctx.fillStyle = floor; ctx.fillRect(x, 287, 132, 322);
    for (let paving = 0; paving < 7; paving++) panel(ctx, x + 2, 298 + paving * 47, 128, 1, '#69807728');
    panel(ctx, left ? 38 : 882, 291, 80, 39, '#142a31', '#5d797366');
    label(ctx, '대기석', left ? 78 : 922, 310, 13, '#a3b7a4');
    for (let row = 0; row < 2; row++) {
      const benchX = left ? 20 : 864, benchY = 354 + row * 161;
      ellipse(ctx, benchX + 58, benchY + 18, 59, 6, '#11262b66');
      panel(ctx, benchX + 8, benchY + 8, 5, 17, '#203039'); panel(ctx, benchX + 101, benchY + 8, 5, 17, '#203039');
      panel(ctx, benchX, benchY, 116, 8, '#8f7958'); panel(ctx, benchX, benchY + 8, 116, 4, '#554e40');
      panel(ctx, benchX + 2, benchY + 1, 112, 1, '#b69c71');
      for (let slat = 0; slat < 4; slat++) panel(ctx, benchX + 10 + slat * 27, benchY + 2, 1, 5, '#3a4140');
    }
  }
  // The playing surface and boundary retain the existing exact gameplay coordinates.
  ellipse(ctx, 500, 449, 370, 167, '#0d222645');
  ellipse(ctx, 500, 434, 355, 167, '#715942');
  const side = ctx.createLinearGradient(0, 415, 0, 601); side.addColorStop(0, '#a98a60'); side.addColorStop(.65, '#795f42'); side.addColorStop(1, '#544938');
  ctx.beginPath(); ctx.ellipse(500, 416, 345, 158, 0, 0, Math.PI); ctx.lineTo(145, 434); ctx.ellipse(500, 434, 355, 167, 0, Math.PI, 0, true); ctx.closePath(); ctx.fillStyle = side; ctx.fill();
  const sand = ctx.createRadialGradient(450, 353, 35, 500, 416, 440); sand.addColorStop(0, '#e4c492'); sand.addColorStop(.65, '#d7b27d'); sand.addColorStop(1, '#b99565');
  ellipse(ctx, 500, 416, 345, 158, sand, '#efcf9666', 3);
  ctx.save(); ctx.beginPath(); ctx.ellipse(500, 416, 341, 154, 0, 0, Math.PI * 2); ctx.clip();
  // Static sand grain, rake arcs and worn foot trails are cached, so they never shimmer.
  for (let grain = 0; grain < 820; grain++) {
    const angle = seed(grain * 3) * Math.PI * 2, radius = Math.sqrt(seed(grain * 3 + 1));
    const x = 500 + Math.cos(angle) * 338 * radius, y = 416 + Math.sin(angle) * 150 * radius;
    ctx.fillStyle = grain % 3 ? '#7a613e15' : '#fff0bd2a'; ctx.fillRect(x, y, 1 + seed(grain * 3 + 2) * 3, 1);
  }
  ctx.strokeStyle = '#93703f1f'; ctx.lineWidth = 1;
  for (let rake = 0; rake < 9; rake++) { ctx.beginPath(); ctx.ellipse(514, 400, 122 + rake * 17, 40 + rake * 7, -.045, .1, 1.2); ctx.stroke(); }
  for (let trail = 0; trail < 4; trail++) for (let foot = 0; foot < 9; foot++) {
    const x = 283 + trail * 96 + foot * 18, y = 356 + trail % 2 * 85 + Math.sin(foot * .23 + trail) * 26 + foot % 2 * 5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.4 + trail * .25); ellipse(ctx, 0, 0, 5, 2.1, '#94744116', '#f2d69b18'); ctx.restore();
  }
  ctx.globalAlpha = .045; label(ctx, '모래판', 500, 429, 65, '#6f5839'); ctx.restore();
  // Raised rope marks the original ellipse; warm highlight and inset shadow make it tactile.
  ctx.beginPath(); ctx.ellipse(500, 407, 306, 137, 0, 0, Math.PI * 2); ctx.strokeStyle = '#765c4055'; ctx.lineWidth = 12; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(500, 406, 306, 137, 0, 0, Math.PI * 2); ctx.strokeStyle = '#e6cc92'; ctx.lineWidth = 8; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(500, 404.5, 306, 137, 0, 0, Math.PI * 2); ctx.strokeStyle = '#fff0bf88'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(500, 406, 302, 133, 0, 0, Math.PI * 2); ctx.strokeStyle = '#a98049'; ctx.lineWidth = 3; ctx.stroke();
  for (let stitch = 0; stitch < 72; stitch++) {
    const angle = stitch / 72 * Math.PI * 2, x = 500 + Math.cos(angle) * 306, y = 406 + Math.sin(angle) * 137;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(Math.cos(angle) * 137, -Math.sin(angle) * 306)); panel(ctx, -.7, -3.7, 1.4, 7.4, '#a1844a5b'); ctx.restore();
  }
  ctx.strokeStyle = '#d0ae7555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(500, 434, 355, 167, 0, .18, Math.PI - .18); ctx.stroke();
  label(ctx, '모래판 CHAMPIONSHIP', 500, 588, 12, '#d6bc86');
}

function spectator(ctx: CanvasRenderingContext2D, column: number, tier: number, clock: number, intensity: number, reduced: boolean) {
  const index = tier * 61 + column, x = 28 + column * 16;
  if ([178, 500, 822].some(stair => Math.abs(x - stair) < 20)) return;
  const variant = Math.floor(seed(index * 7) * 6), tone = skinTones[Math.floor(seed(index * 7 + 1) * skinTones.length)], shirt = shirts[Math.floor(seed(index * 7 + 2) * shirts.length)], hair = hairColors[index % hairColors.length];
  const cadence = 310 + seed(index * 7 + 3) * 590, phase = clock / cadence + index * 1.89;
  const motion = reduced ? 0 : Math.sin(phase), joy = reduced ? 0 : Math.max(0, Math.sin(clock / (830 + index % 5 * 170) + index)) * intensity;
  const bounce = variant === 2 ? -joy * 1.6 : variant === 5 ? motion * .35 * intensity : 0;
  const y = 114 + tier * 20 + Math.sin(x / 1000 * Math.PI) * 6 + bounce;
  ctx.save(); ctx.translate(x, y);
  // Different skin, hairstyles, jackets and two articulated arms keep the crowd human.
  panel(ctx, -4, 6, 9, 9, shirt); panel(ctx, 3, 8, 2, 7, '#16313c55'); panel(ctx, -3, 14, 7, 2, '#192f39');
  panel(ctx, -2.5, 0, 6, 6, tone); panel(ctx, -2.5, 0, 6, 1.8, hair); if (index % 3 === 0) panel(ctx, -3, 1, 1.5, 3, hair);
  ctx.fillStyle = '#273136'; ctx.fillRect(0, 2.5, 1, 1); if (variant === 2 || variant === 3) ctx.fillRect(0, 4.5, 1.8, 1);
  if (index % 9 === 0) { panel(ctx, -4, -1, 9, 2, shirt); panel(ctx, -2, -2, 5, 2, shirt); }
  const arm = (left: boolean, handX: number, handY: number) => {
    const shoulderX = left ? -4 : 5; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.strokeStyle = shirt; ctx.beginPath(); ctx.moveTo(shoulderX, 8); ctx.lineTo(shoulderX + (handX - shoulderX) * .52, 8 + (handY - 8) * .56); ctx.stroke();
    ctx.strokeStyle = tone; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(shoulderX + (handX - shoulderX) * .5, 8 + (handY - 8) * .54); ctx.lineTo(handX, handY); ctx.stroke();
    panel(ctx, handX - 1, handY - 1, 2, 2, tone);
  };
  if (variant === 0) {
    const clap = reduced ? .35 : (motion + 1) / 2 * intensity; arm(true, -3 + clap * 4, 9); arm(false, 5 - clap * 4, 9);
  } else if (variant === 1) {
    arm(true, -6, 13); const handX = 8 + motion * 2 * intensity; arm(false, handX, -3);
    ctx.strokeStyle = '#c4c4a1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(handX, -3); ctx.lineTo(handX - 1, -14); ctx.stroke();
    ctx.fillStyle = index % 2 ? '#ba9470' : '#79a09a'; ctx.beginPath(); ctx.moveTo(handX - 1, -14); ctx.lineTo(handX + 7 + motion * intensity, -13); ctx.lineTo(handX + 7, -9); ctx.lineTo(handX - .5, -10); ctx.fill();
  } else if (variant === 2) {
    arm(true, -8, 7 - joy * 5); arm(false, 7, 2 - joy * 9);
  } else if (variant === 3) {
    arm(true, -5, -4); arm(false, 7, -4); panel(ctx, -8, -9, 18, 7, index % 2 ? '#bcab82' : '#8aaba4', '#344c51');
    label(ctx, ['힘내!', '끝까지', '와!'][index % 3], 1, -5.5, 4, '#263d44');
  } else if (variant === 4) {
    arm(true, -3, 10); arm(false, 5, 3 + motion * intensity * .5); panel(ctx, 4, -.5, 3, 5, '#23313d'); panel(ctx, 4.6, 0, 1.8, 3, '#becbaf');
  } else {
    arm(true, -5, 13); arm(false, 6, 13); panel(ctx, -3, 16, 2, 3, '#263b42'); panel(ctx, 2, 16, 2, 3, '#263b42');
  }
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, time: number, intensity: number, reduced: boolean) {
  ctx.save(); ctx.drawImage(architecture!, 0, 0);
  for (let tier = 0; tier < 6; tier++) for (let column = 0; column < 60; column++) spectator(ctx, column, tier, time, intensity, reduced);
  // Broad, slow moving floodlight pools lift the arena without washing out the fighters.
  for (const side of [-1, 1]) {
    const sourceX = side < 0 ? 32 : 968, targetX = 500 + side * 145 + (reduced ? 0 : Math.sin(time / 5400 + side) * 15);
    const glow = ctx.createLinearGradient(sourceX, 65, targetX, 445); glow.addColorStop(0, '#e9d7a71c'); glow.addColorStop(.8, '#e9d7a70b'); glow.addColorStop(1, '#e9d7a700');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.moveTo(sourceX - 13, 66); ctx.lineTo(targetX - 116, 510); ctx.quadraticCurveTo(targetX, 531, targetX + 116, 510); ctx.lineTo(sourceX + 13, 66); ctx.closePath(); ctx.fill();
    const halo = ctx.createRadialGradient(sourceX, 64, 2, sourceX, 64, 52); halo.addColorStop(0, '#fff0c850'); halo.addColorStop(1, '#fff0c800'); ctx.fillStyle = halo; ctx.fillRect(sourceX - 52, 12, 104, 104);
  }
  // Side pennants ripple independently; their location never intrudes into the sand pit.
  for (const side of [-1, 1]) {
    const x = side < 0 ? 108 : 892, flutter = reduced ? 0 : Math.sin(time / 630 + side * 2.1) * (1.5 + intensity);
    ctx.strokeStyle = '#859c97'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 202); ctx.lineTo(x, 100); ctx.stroke();
    ctx.fillStyle = side < 0 ? '#b58e66' : '#6f9b98'; ctx.beginPath(); ctx.moveTo(x, 104); ctx.bezierCurveTo(x + side * 14, 101 + flutter, x + side * 32, 107 - flutter, x + side * 46, 103 + flutter); ctx.lineTo(x + side * 44, 128 + flutter); ctx.bezierCurveTo(x + side * 29, 124 - flutter, x + side * 13, 130 + flutter, x, 126); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ede1b5aa'; ctx.fillRect(x + side * 14 - 2, 111 + flutter * .3, 4, 8);
  }
  ctx.restore();
}

/** Fixed 1000×620 scenery; animation uses only the caller's clock and preserves its canvas state. */
export function drawArenaScenery(ctx: CanvasRenderingContext2D, clock: number, options: ArenaSceneryOptions = {}) {
  const reduced = options.reduced ?? false, time = reduced || !Number.isFinite(clock) ? 0 : clock;
  const intensity = reduced ? 0 : clamp(Number.isFinite(options.intensity) ? options.intensity! : .65);
  if (!architecture) {
    architecture = document.createElement('canvas'); architecture.width = WIDTH; architecture.height = HEIGHT;
    const background = architecture.getContext('2d'); if (background) drawArchitecture(background);
  }
  if (!cachedFrame) { cachedFrame = document.createElement('canvas'); cachedFrame.width = WIDTH; cachedFrame.height = HEIGHT; }
  const target = cachedFrame.getContext('2d');
  if (!target) { drawScene(ctx, time, intensity, reduced); return; }
  // A paused or reduced-motion frame requires one bitmap draw, not hundreds of crowd updates.
  if (cachedTime !== time || cachedIntensity !== intensity || cachedReduced !== reduced) {
    drawScene(target, time, intensity, reduced); cachedTime = time; cachedIntensity = intensity; cachedReduced = reduced;
  }
  ctx.save(); ctx.drawImage(cachedFrame, 0, 0); ctx.restore();
}
