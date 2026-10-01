import { sampleLadderRig, type LadderArtActor, type LadderArtBridge, type LadderGeometry } from './ladderArt';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
function stroke(c: CanvasRenderingContext2D, x: number, y: number, xx: number, yy: number, width: number, color: string) { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(xx, yy); c.stroke(); }
function text(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string) { c.font = `900 ${size}px "Malgun Gothic", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(value, x, y); }
function gem(c: CanvasRenderingContext2D, x: number, y: number, s: number, gold = false) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = gold ? '#ffe68e' : '#79e8dd'; c.beginPath(); c.moveTo(-7, -3); c.lineTo(-3, -8); c.lineTo(4, -8); c.lineTo(8, -3); c.lineTo(0, 7); c.closePath(); c.fill();
  c.fillStyle = gold ? '#e6a944' : '#399cae'; c.beginPath(); c.moveTo(-7, -3); c.lineTo(8, -3); c.lineTo(0, 7); c.closePath(); c.fill();
  c.fillStyle = gold ? '#fff1b4' : '#d3fff3'; c.beginPath(); c.moveTo(-3, -8); c.lineTo(0, -3); c.lineTo(4, -8); c.closePath(); c.fill();
  stroke(c, 0, -3, 0, 7, .8, gold ? '#ffe290' : '#8eedde'); c.restore();
}
function cloud(c: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  for (const [dx, dy, width, height] of [[0, 0, 62, 8], [11, -7, 36, 8], [23, -12, 17, 6], [-8, 3, 79, 5]]) rect(c, x + dx * scale, y + dy * scale, width * scale, height * scale, color);
}

/** A complete treasure course; its ropes use the exact same world rungs as the rigs. */
export function drawLadderAdventure(c: CanvasRenderingContext2D, g: LadderGeometry, bridges: LadderArtBridge[], target: number, clock: number, reduced: boolean, occupants: Set<number>) {
  const { width: w, height: h, top, bottom, scale: s, laneGap } = g, time = reduced ? 0 : clock;
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#25254b'); sky.addColorStop(.52, '#326681'); sky.addColorStop(1, '#74b3ac'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
  const moon = Math.max(5, Math.min(h * .062, 29)); rect(c, w * .09, h * .075, moon, moon, '#f7db9c'); rect(c, w * .09 + moon * .65, h * .075, moon * .35, moon * .22, '#bda888');
  for (let i = 0; i < 24; i++) { const x = (i * 137 + 41) % w, y = (i * 59 + 7) % Math.max(1, h * .43); rect(c, x, y, i % 6 ? 1 : 2, 1, '#e1e8cb77'); }
  for (let i = 0; i < 9; i++) { const scale = .5 + i % 3 * .5, x = ((i * 143 + time / (170 + i * 9)) % (w + 150)) - 100; cloud(c, x, h * (.22 + i % 4 * .18), scale, i % 2 ? '#d8eee81b' : '#c5e8e929'); }
  // Distant islands keep the climbing course suspended above the clouds.
  for (let i = 0; i < 4; i++) {
    const x = w * (.08 + i * .27), y = h * (.60 + i % 2 * .17), size = clamp(w * .045, 10, 42);
    c.fillStyle = '#25465c66'; c.beginPath(); c.moveTo(x - size, y); c.lineTo(x + size, y); c.lineTo(x + size * .22, y + size * .85); c.lineTo(x - size * .4, y + size * .65); c.closePath(); c.fill(); rect(c, x - size, y - 3, size * 2, 4, '#90b8a166');
  }
  const left = Math.max(2, g.left - laneGap * .37), right = Math.min(w - 2, g.right + laneGap * .37), deck = top + 1;
  // A quiet stone terrace supports the chests and each ladder's anchor.
  rect(c, left, deck, right - left, 3 * s, '#e4d7af');
  rect(c, left + s, deck + 3 * s, right - left - 2 * s, 6 * s, '#6b8490');
  rect(c, left + 3 * s, deck + 9 * s, right - left - 6 * s, 2 * s, '#304c62');
  for (let x = left + 13 * s; x < right; x += 26 * s) stroke(c, x, deck + 3 * s, x, deck + 9 * s, Math.max(.5, s * .6), '#4b697c');
  // Long rope ladders hang freely above the clouds; timber rungs match the IK.
  for (let lane = 0; lane < g.laneCount; lane++) {
    const x = g.laneX(lane), half = 6 * s;
    for (const side of [-1, 1]) { stroke(c, x + side * half, top, x + side * half, bottom, Math.max(1.5, 2.3 * s), '#294d61'); stroke(c, x + side * half, top, x + side * half, bottom, Math.max(.7, 1.25 * s), '#dfc7a1'); }
    for (let row = 0; row <= g.rungCount * g.subdivisions; row++) { const y = g.rowY(row / g.subdivisions); stroke(c, x - half, y, x + half, y, Math.max(.9, 1.5 * s), '#8b6260'); stroke(c, x - half, y - .5, x + half, y - .5, Math.max(.5, .5 * s), '#ecd6ab'); }
    for (let row = 6; row < 24; row += 6) { const y = g.rowY(row), width = 20 * s; rect(c, x - width / 2, y + 2 * s, width, 2 * s, '#6d6864'); rect(c, x - width / 2, y, width, 2 * s, '#c49c69'); }
    const baseWidth = Math.max(11, Math.min(laneGap * .72, 23 * s)); rect(c, x - baseWidth / 2, bottom + 1, baseWidth, 5 * s, '#a69478'); rect(c, x - baseWidth / 2 + 2 * s, bottom + 6 * s, Math.max(3, baseWidth - 4 * s), 3 * s, '#526d71');
  }
  for (const bridge of bridges) {
    if (bridge.state === 'future') continue;
    const y = g.rowY(bridge.row), chosen = bridge.state === 'active';
    for (const lane of [bridge.leftLane, bridge.rightLane]) { const x = g.laneX(lane); rect(c, x - 7 * s, y, 14 * s, 2 * s, chosen ? '#e9bd79' : '#a2b9a1'); rect(c, x - s, y - 2 * s, 2 * s, 2 * s, chosen ? '#ffeab0' : '#568ca2'); }
  }
  for (let lane = 0; lane < g.laneCount; lane++) {
    const x = g.laneX(lane), chosen = lane === target, opened = occupants.has(lane), cs = Math.min(Math.max(.35, s), laneGap / 26), cy = top - 5 * cs;
    if (chosen) { const halo = c.createRadialGradient(x, cy - 9 * cs, 0, x, cy - 9 * cs, 23 * cs); halo.addColorStop(0, '#ffe5a070'); halo.addColorStop(1, '#ffe5a000'); c.fillStyle = halo; c.fillRect(x - 23 * cs, cy - 32 * cs, 46 * cs, 46 * cs); }
    rect(c, x - 10 * cs, cy - 12 * cs, 20 * cs, 11 * cs, '#342f4a'); rect(c, x - 9 * cs, cy - 11 * cs, 18 * cs, 9 * cs, chosen ? '#b87e48' : '#637686');
    const lidY = opened ? cy - 20 * cs : cy - 15 * cs; rect(c, x - 10 * cs, lidY, 20 * cs, 4 * cs, chosen ? '#f1c678' : '#9db8b8');
    for (const side of [-1, 1]) rect(c, x + side * 6 * cs - cs, cy - 11 * cs, 2 * cs, 10 * cs, '#f0d298'); rect(c, x - 2 * cs, cy - 8 * cs, 4 * cs, 4 * cs, '#f2da99');
    if (chosen || opened) gem(c, x, cy - 19 * cs - (reduced ? 0 : Math.sin(time / 500) * cs), cs * .7, chosen);
    text(c, String(lane + 1).padStart(2, '0'), x, cy - 31 * cs, clamp(cs * 8, 7, 12), chosen ? '#fff0ad' : '#bddde0');
    if (chosen) { text(c, '★', x, cy + 2 * cs, Math.max(7, 9 * cs), '#ffe397'); for (let i = 0; i < 3; i++) { const angle = i * 2.1 + time / 1900; rect(c, x + Math.cos(angle) * 15 * cs, cy - 10 * cs + Math.sin(angle) * 13 * cs, 1.5 * cs, 1.5 * cs, '#ffe19c'); } }
  }
  for (let i = 0; i < 4; i++) cloud(c, i * w / 3 - 35 + Math.sin(time / 8000 + i) * 5, h - 2 + i % 2 * 6, Math.max(.7, w / 800), '#c4e6d856');
}

export function drawClaimedLadderTreasure(c: CanvasRenderingContext2D, actor: LadderArtActor, g: LadderGeometry, clock: number, reduced: boolean) {
  const rig = sampleLadderRig(actor, g, clock, reduced), hand = rig.hands[1];
  gem(c, hand.x, hand.y - 3 * g.scale, g.scale * .78, true);
  if (!reduced) for (let i = 0; i < 4; i++) { const angle = clock / 600 + i * Math.PI / 2; rect(c, hand.x + Math.cos(angle) * 13 * g.scale, hand.y - 3 * g.scale + Math.sin(angle) * 12 * g.scale, 1.5 * g.scale, 1.5 * g.scale, '#fff0a6'); }
}

export function drawLadderTreasureReveal(c: CanvasRenderingContext2D, g: LadderGeometry, target: number, age: number, reduced: boolean) {
  const x = g.laneX(target), y = g.top - 12 * g.scale, reveal = reduced ? 1 : clamp(age / 450, 0, 1);
  c.save(); c.globalAlpha = reveal;
  const glow = c.createRadialGradient(x, y, 0, x, y, g.height * .5); glow.addColorStop(0, '#ffdf9140'); glow.addColorStop(1, '#ffeab000'); c.fillStyle = glow; c.fillRect(0, 0, g.width, g.height);
  for (let i = 0; i < 10; i++) { const a = i * Math.PI * .2 + (reduced ? 0 : age / 11000); c.fillStyle = '#ffe4a018'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * g.height * .7, y + Math.sin(a) * g.height * .7); c.lineTo(x + Math.cos(a + .045) * g.height * .7, y + Math.sin(a + .045) * g.height * .7); c.closePath(); c.fill(); }
  if (!reduced && age < 1800) for (let i = 0; i < 26; i++) { const t = Math.max(0, age - i % 4 * 40) / 1000, vx = (i % 9 - 4) * 30, vy = -45 - i % 5 * 18; c.globalAlpha = clamp(1 - age / 1800, 0, 1); rect(c, x + vx * t, y + vy * t + 100 * t * t, Math.max(2, g.scale * 3), Math.max(2, g.scale * 2), i % 3 ? '#ffe2a1' : '#8ae6d6'); }
  c.restore();
}
