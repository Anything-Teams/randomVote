import type { Candidate } from '../election';

export type ArenaPose = 'idle' | 'guard' | 'walk' | 'run' | 'grapple' | 'brace' | 'push' | 'dodge' | 'lift' | 'throw' | 'airborne' | 'land' | 'recover' | 'cheer' | 'clap' | 'bow';
type Point = { x: number; y: number };
type Motion = { crouch: number; lean: number; hipX: number; head: number; mouth: number; backX: number; backY: number; frontX: number; frontY: number; spread: number; contact: number; shoulderLift: number; clapTurn: number; cheerTurn: number; applause: number };
type FootMemory = { anchor: Point; from: Point; to: Point; ground: Point; lift: number; swinging: boolean; settleAt: number; settleFrom: Point; settleTo: Point; settleLift: number };
export type ArenaFighterAnimation = { clock: number | null; signature: string; epoch?: number | string; motion: Motion | null; gait: number; distance: number; moving: boolean; airborne: boolean; feet: [FootMemory, FootMemory] | null; localFeet: [Point, Point] | null; grip?: Point; secondaryGrip?: Point; pose?: ArenaPose };
export type ArenaActor = { candidate: Candidate; index: number; x: number; y: number; depthY?: number; scale: number; facing: number; pose: ArenaPose; angle: number; alpha: number; velocityX: number; velocityY: number; gaitDistance: number; phase: number; power?: number; gripTarget?: Point; secondaryGripTarget?: Point; animation?: ArenaFighterAnimation; motionEpoch?: number | string; motionImmediate?: boolean };

/** Being lifted changes screen height, while occlusion follows the ground beneath each fighter. */
export function arenaDrawOrder<T extends { y: number; index: number; depthY?: number }>(actors: readonly T[]): T[] {
  return [...actors].sort((a, b) => (a.depthY ?? a.y) - (b.depthY ?? b.y) || a.index - b.index);
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const pointMix = (a: Point, b: Point, p: number): Point => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
const rotate = (point: Point, angle: number): Point => ({ x: Math.cos(angle) * point.x - Math.sin(angle) * point.y, y: Math.sin(angle) * point.x + Math.cos(angle) * point.y });
function shade(color: string, amount: number) {
  const value = Number.parseInt(color.slice(1), 16);
  return '#' + [value >>> 16, value >>> 8 & 255, value & 255].map(channel => Math.round(Math.min(255, channel * amount)).toString(16).padStart(2, '0')).join('');
}
const palettes = ['#e7ac81', '#c48b64', '#f2c397', '#a87151'].map(base => ({ base, light: shade(base, 1.11), shade: shade(base, .84), deep: shade(base, .49) }));
type Palette = typeof palettes[number];

/** The scene owns this state, so replay and seek clear it with the actor's body. */
export function createArenaFighterAnimation(): ArenaFighterAnimation {
  return { clock: null, signature: '', motion: null, gait: .42, distance: 0, moving: false, airborne: false, feet: null, localFeet: null };
}

function knee(a: Point, b: Point, upper: number, lower: number, bend: number): Point {
  const dx = b.x - a.x, dy = b.y - a.y, raw = Math.hypot(dx, dy);
  const length = Math.max(.01, Math.min(upper + lower - .02, raw));
  const along = (upper * upper - lower * lower + length * length) / (2 * length);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const nx = dx / (raw || 1), ny = dy / (raw || 1);
  return { x: a.x + nx * along + ny * height * bend, y: a.y + ny * along - nx * height * bend };
}
function reachable(a: Point, b: Point, length: number): Point {
  const distance = Math.hypot(b.x - a.x, b.y - a.y), amount = Math.min(1, length / Math.max(.01, distance));
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}
function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, palette: Palette) {
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  ctx.fillStyle = palette.base; ctx.fillRect(-1, -width / 2, length + 2, width);
  // Small planes describe the muscle without a continuous glossy edge down every limb.
  ctx.fillStyle = palette.shade; ctx.fillRect(length * .54, width / 2 - 1.5, Math.min(4, length * .34), 1.5);
  ctx.fillStyle = palette.light; ctx.fillRect(length * .18, -width * .28, Math.min(3.3, length * .3), 1.2);
  ctx.restore();
}
function makeFoot(point: Point): FootMemory {
  return { anchor: { ...point }, from: { ...point }, to: { ...point }, ground: { ...point }, lift: 0, swinging: false, settleAt: -Infinity, settleFrom: { ...point }, settleTo: { ...point }, settleLift: 0 };
}

/** Stance feet stay in world space; changing a pose cannot restart the stride. */
function groundedFeet(actor: ArenaActor, state: ArenaFighterAnimation, clock: number, moving: boolean, reset: boolean, spread: number): [Point, Point] {
  const { x, y, facing, scale, index } = actor;
  const comfortable = (leg: number): Point => ({ x: x + facing * (leg ? 6 : -5) * spread * scale, y });
  if (state.airborne && !reset && state.localFeet) {
    state.feet = state.localFeet.map(foot => {
      const memory = makeFoot({ x: x + foot.x * facing * scale, y });
      memory.lift = Math.max(0, -foot.y);
      return memory;
    }) as [FootMemory, FootMemory];
  }
  state.feet ??= [makeFoot(comfortable(0)), makeFoot(comfortable(1))];
  const speed = Math.max(.01, Math.hypot(actor.velocityX, actor.velocityY));
  const vx = actor.velocityX / speed, vy = actor.velocityY / speed;
  const vertical = Math.abs(vy), cycleLength = mix(actor.pose === 'run' ? 34 : 30, 13.2, vertical) * (1 + (index % 3 - 1) * .025);
  const distance = reset ? 0 : Math.max(0, actor.gaitDistance - state.distance);
  if (moving) state.gait += distance / Math.max(1, scale * cycleLength);
  const stance = .62;
  return state.feet.map((foot, leg) => {
    if (moving) {
      const cycle = (state.gait + leg * .5) % 1;
      if (cycle >= stance) {
        if (!foot.swinging) {
          foot.swinging = true; foot.from = { ...foot.ground };
          const ahead = ((1 - cycle) + stance / 2) * cycleLength * scale;
          foot.to = { x: x + facing * (leg ? 3 : -3) * scale + vx * ahead, y: y + vy * ahead };
        }
        const amount = (cycle - stance) / (1 - stance);
        foot.ground = pointMix(foot.from, foot.to, ease(amount));
        foot.lift = Math.sin(amount * Math.PI) * (actor.pose === 'run' ? 5.8 : 3.6);
      } else {
        if (foot.swinging) { foot.anchor = { ...foot.to }; foot.swinging = false; }
        foot.ground = { ...foot.anchor }; foot.lift = 0;
      }
    } else {
      if (state.moving || state.airborne || !reset && state.pose !== actor.pose && Math.hypot(foot.ground.x - comfortable(leg).x, foot.ground.y - y) > scale * 1.4) {
        foot.settleAt = clock + leg * 40; foot.settleFrom = { ...foot.ground }; foot.settleTo = comfortable(leg); foot.settleLift = foot.lift; foot.swinging = false;
      }
      const amount = clamp((clock - foot.settleAt) / 185);
      if (Number.isFinite(foot.settleAt)) {
        foot.ground = pointMix(foot.settleFrom, foot.settleTo, ease(amount));
        foot.lift = Math.max(foot.settleLift * (1 - amount), Math.sin(amount * Math.PI) * 1.7);
        if (amount === 1) { foot.anchor = { ...foot.ground }; foot.settleAt = -Infinity; }
      }
    }
    return { x: (foot.ground.x - x) / (scale * facing), y: (foot.ground.y - y) / scale - foot.lift };
  }) as [Point, Point];
}

/** One skin palette covers every bare body part; motion uses a small, connected skeleton. */
export function drawArenaFighter(ctx: CanvasRenderingContext2D, actor: ArenaActor, clock: number) {
  const { candidate, index, x, y, scale, facing, pose, phase } = actor;
  const palette = palettes[index % palettes.length], hair = ['#162536', '#4b362e', '#6f493e', '#2b3f49'][index % 4];
  const personality = index % 4, breath = Math.sin((clock + index * 719) / (580 + personality * 65));
  const speed = Math.hypot(actor.velocityX, actor.velocityY), air = ['airborne', 'land', 'recover'].includes(pose);
  const moving = speed > 6 && !air, backward = actor.velocityX * facing < -5;
  const state = actor.animation ?? createArenaFighterAnimation();
  const signature = candidate.id + ':' + index + ':' + candidate.color;
  const reset = !state.motion || !Number.isFinite(state.motion.clapTurn) || !Number.isFinite(state.motion.cheerTurn) || !Number.isFinite(state.motion.applause) || state.signature !== signature || state.epoch !== actor.motionEpoch || actor.motionImmediate || clock < (state.clock ?? clock) || actor.gaitDistance < state.distance - 1;
  const delta = reset ? 0 : Math.max(0, Math.min(50, clock - (state.clock ?? clock)));
  if (reset) { state.feet = null; state.localFeet = null; state.gait = .42 + personality * .015; state.moving = false; state.airborne = false; }
  const gait = state.gait * Math.PI * 2, power = clamp(actor.power ?? .6);
  const target: Motion = { crouch: .2 + breath * .2, lean: breath * .7, hipX: breath * .12, head: breath * 1.1, mouth: 1.2, backX: -9, backY: 0, frontX: 10, frontY: 0, spread: 1 + personality * .035, contact: actor.gripTarget ? 1 : 0, shoulderLift: actor.gripTarget ? clamp((y - actor.gripTarget.y - 66) / (scale * 14)) * 3 : 0, clapTurn: ['idle', 'walk', 'run', 'bow', 'clap'].includes(pose) ? 1 : 0, cheerTurn: 0, applause: 0 };
  if (pose === 'guard' || pose === 'grapple') { target.crouch = 1.2 + personality * .25; target.lean = 2 + personality * .4; target.backX = -5; target.backY = -12; target.frontX = 15; target.frontY = -15; target.head = -target.lean * .3; }
  if (pose === 'brace') { target.crouch = 4.2; target.hipX = -1.2; target.lean = -4.5; target.backX = -1; target.backY = -12; target.frontX = 16; target.frontY = -14; target.spread += .22; target.mouth = .9; }
  if (pose === 'push') { target.crouch = 2.7; target.hipX = 1.2; target.lean = 4 + power * 5; target.backX = 7; target.backY = -14; target.frontX = 22; target.frontY = -16; target.mouth = 1.8; }
  if (pose === 'dodge') { target.crouch = 4; target.hipX = -2; target.lean = -8; target.backX = -5; target.backY = -17; target.frontX = 13; target.frontY = -22; target.head = 3; }
  if (pose === 'lift' || pose === 'throw') { const p = ease(phase); target.crouch = mix(5.5, 1.2, p); target.lean = mix(6, -4, p); target.backX = 5; target.backY = mix(-12, -25, p); target.frontX = 17; target.frontY = mix(-14, -28, p); target.mouth = 2; }
  if (pose === 'airborne') { target.crouch = 3; target.backX = -18; target.backY = -26; target.frontX = 20; target.frontY = -29; target.mouth = 3; target.head = -3; }
  if (pose === 'land') { target.crouch = 6 * Math.sin(clamp(phase) * Math.PI); target.lean = 9; target.backX = -5; target.backY = -1; target.frontX = 15; target.frontY = 1; target.mouth = 2.5; }
  if (pose === 'recover') { const p = ease(phase); target.crouch = mix(6.5, .4, p); target.lean = mix(12, 0, p); target.backX = mix(-2, -9, p); target.backY = mix(0, -1, p); target.frontX = mix(15, 10, p); target.frontY = mix(1, 0, p); }
  if (pose === 'cheer') {
    const wave = Math.sin((clock + index * 400) / (430 + personality * 23));
    target.crouch = .7 + (wave + 1) * .55; target.hipX = wave * .3;
    target.backX = -13 - wave * 1.6; target.backY = -31 - wave * 2.1;
    target.frontX = 17 + wave * 1.2; target.frontY = -33 + wave * 1.3;
    target.mouth = 2.6; target.head = -1.5 + breath * .4; target.cheerTurn = 1;
  }
  if (pose === 'clap') {
    const cycle = ((clock + index * 273) % (980 + personality * 72)) / (980 + personality * 72);
    const clap = cycle < .22 ? ease(cycle / .22) : cycle < .32 ? 1 : 1 - ease((cycle - .32) / .28);
    // A short contact hold lets the palms meet before they separate again.
    target.backX = mix(-8, -2.5, clap); target.backY = -12;
    target.frontX = mix(8, 2.5, clap); target.frontY = -12;
    target.crouch = .8 + breath * .12; target.lean = breath * .35;
    target.mouth = 1.8; target.head = -.4 + breath * .3; target.clapTurn = 1; target.applause = 1;
  }
  if (pose === 'bow') {
    const cycle = ((clock + index * 617) % 2400) / 2400;
    const dip = cycle < .48 ? ease(cycle / .32) : 1 - ease((cycle - .48) / .40);
    target.lean = (8 + personality * .4) * dip; target.head = 3 * dip;
    target.crouch = .4 + dip * .8; target.hipX = -dip * .3;
    target.backX = -10; target.frontX = 11; target.backY = -1; target.frontY = -1; target.mouth = .9;
  }
  if (moving) {
    target.crouch = Math.max(target.crouch, pose === 'run' ? 3.2 : 2.2) + Math.abs(Math.sin(gait)) * .65;
    target.hipX += Math.sin(gait) * .45;
    if (pose === 'walk' || pose === 'run') {
      const swing = Math.cos(gait + personality * .07), reach = pose === 'run' ? 7 : 4.5;
      target.lean = backward ? -2 : pose === 'run' ? 5 : 1.2; target.head = -target.lean * .35;
      target.backX = -8 - swing * reach; target.frontX = 9 + swing * reach;
      target.backY = -1 - Math.abs(swing) * 1.5; target.frontY = -1 - Math.abs(swing) * 1.5;
    }
  }
  if (reset) state.motion = { ...target };
  else {
    (Object.keys(target) as (keyof Motion)[]).forEach(key => {
      const hand = key === 'backX' || key === 'backY' || key === 'frontX' || key === 'frontY';
      const turn = key === 'clapTurn' || key === 'cheerTurn';
      const amount = 1 - Math.exp(-delta / (air ? 55 : turn ? 180 : pose === 'clap' && hand && state.motion!.applause > .9 ? 45 : 95));
      state.motion![key] = mix(state.motion![key], target[key], amount);
    });
  }
  const motion = state.motion!, hip = { x: motion.hipX, y: -20 + motion.crouch }, lean = motion.lean * Math.PI / 180;
  let feet: [Point, Point];
  if (air) {
    const airFeet: [Point, Point] = pose === 'airborne' ? [{ x: -6, y: -9 }, { x: 8, y: -6 }] : [{ x: -5, y: 0 }, { x: 6, y: 0 }];
    state.localFeet ??= airFeet;
    const amount = reset ? 1 : 1 - Math.exp(-delta / 60);
    feet = state.localFeet.map((foot, leg) => pointMix(foot, airFeet[leg], amount)) as [Point, Point];
  } else feet = groundedFeet(actor, state, clock, moving, reset, motion.spread);
  const hips = [{ x: hip.x - 4.5, y: hip.y }, { x: hip.x + 4.5, y: hip.y }];
  feet = feet.map((foot, leg) => reachable(hips[leg], foot, 21.8)) as [Point, Point];
  state.localFeet = feet;
  const knees = feet.map((foot, leg) => knee(hips[leg], foot, 11, 11, 1));
  const bodyWidth = 18 + index % 3, shoulderWidth = bodyWidth * .43;
  // A grip turns the chest toward the opponent, bringing the far shoulder forward.
  const shoulders = [{ x: mix(-shoulderWidth, 3.5, motion.contact), y: -20 - motion.shoulderLift }, { x: shoulderWidth, y: -20 - motion.shoulderLift }];
  let hands = [{ x: motion.backX, y: motion.backY }, { x: motion.frontX, y: motion.frontY }];
  if (actor.gripTarget) {
    state.grip = { ...actor.gripTarget };
    state.secondaryGrip = actor.secondaryGripTarget ?? { x: actor.gripTarget.x - facing * scale * 7, y: actor.gripTarget.y + scale * 2 };
  }
  if (!air && state.grip && state.secondaryGrip && motion.contact > .001) {
    const localHand = (point: Point) => {
      const root = rotate({ x: point.x - x, y: point.y - (y - 2 * scale) }, -actor.angle);
      return rotate({ x: root.x / (scale * facing) - hip.x, y: root.y / scale - hip.y }, -lean);
    };
    hands = [pointMix(hands[0], localHand(state.secondaryGrip), motion.contact), pointMix(hands[1], localHand(state.grip), motion.contact)];
  }
  hands = hands.map((hand, arm) => reachable(shoulders[arm], hand, 21.3));
  if (pose === 'clap' && motion.contact < .03 && target.frontX - target.backX < 5.01 && hands[1].x - hands[0].x < 5.4) {
    // Resolve palm contact at the chest; two hands stay distinct and share one height.
    const center = { x: (hands[0].x + hands[1].x) / 2, y: (hands[0].y + hands[1].y) / 2 };
    hands = [{ x: center.x - 2.5, y: center.y }, { x: center.x + 2.5, y: center.y }];
  }
  // Keep applause in front of the chest and raised victory arms outside the head.
  const elbows = hands.map((hand, arm) => knee(shoulders[arm], hand, 11, 10.5, -Math.cos(Math.PI * (arm === 1 ? motion.clapTurn : motion.cheerTurn))));
  const bodyPoint = (point: Point): Point => { const p = rotate(point, lean); return { x: hip.x + p.x, y: hip.y + p.y }; };
  const shorts = hips.map((origin, leg) => {
    const direction = { x: (knees[leg].x - origin.x) / 11, y: (knees[leg].y - origin.y) / 11 };
    const normal = { x: direction.y, y: -direction.x };
    const top = { x: origin.x - direction.x * .75, y: origin.y - direction.y * .75 };
    const hem = { x: origin.x + direction.x * 5.8, y: origin.y + direction.y * 5.8 };
    const edge = (point: Point, width: number, side: number) => ({ x: point.x + normal.x * width * side, y: point.y + normal.y * width * side });
    return { direction, normal, points: [edge(top, 4.1, -1), edge(top, 4.1, 1), edge(hem, 3.8, 1), edge(hem, 3.8, -1)] };
  });
  const waist = [bodyPoint({ x: -bodyWidth / 2, y: -4.3 }), bodyPoint({ x: bodyWidth / 2, y: -4.3 }), bodyPoint({ x: bodyWidth / 2, y: -1.7 }), bodyPoint({ x: -bodyWidth / 2, y: -1.7 })];
  const crotch = { x: hip.x, y: hip.y + 2.6 };
  const yoke = [waist[3], waist[2], { x: hip.x + 7.4, y: hip.y + 1.1 }, crotch, { x: hip.x - 7.4, y: hip.y + 1.1 }];
  const headWidth = [14, 15, 14, 16][personality], headY = -33 - index % 2;
  ctx.save(); ctx.globalAlpha = actor.alpha;
  if (pose !== 'airborne') { ctx.fillStyle = '#25302d40'; ctx.beginPath(); ctx.ellipse(x, y + 2, 16 * scale, 3.5 * scale, 0, 0, Math.PI * 2); ctx.fill(); }
  if (air) {
    const pivotY = -24;
    const bounds: Point[] = [];
    const boundRect = (origin: Point, width: number, height: number, transform = (point: Point) => point) => {
      for (const px of [origin.x, origin.x + width]) for (const py of [origin.y, origin.y + height]) bounds.push(transform({ x: px, y: py }));
    };
    const boundSegment = (a: Point, b: Point, width: number, transform = (point: Point) => point) => {
      const angle = Math.atan2(b.y - a.y, b.x - a.x), length = Math.hypot(b.x - a.x, b.y - a.y);
      boundRect({ x: -1, y: -width / 2 }, length + 2, width, point => {
        const p = rotate(point, angle); return transform({ x: a.x + p.x, y: a.y + p.y });
      });
    };
    feet.forEach((foot, leg) => {
      boundSegment(hips[leg], knees[leg], 7.6); boundSegment(knees[leg], foot, 5.5);
      boundRect({ x: knees[leg].x - 2.8, y: knees[leg].y - 2.8 }, 5.6, 5.6);
      boundRect({ x: foot.x - 3, y: foot.y - 1 }, 9, 3);
    });
    bounds.push(...shorts.flatMap(panel => panel.points), ...waist, ...yoke);
    boundRect({ x: -headWidth / 2 - 1.5, y: -12 }, headWidth + 3, 21, point => {
      const p = rotate(point, motion.head * Math.PI / 180); return bodyPoint({ x: p.x, y: headY + p.y });
    });
    hands.forEach((hand, arm) => {
      boundSegment(shoulders[arm], elbows[arm], 5.6, bodyPoint); boundSegment(elbows[arm], hand, 4.9, bodyPoint);
      boundRect({ x: elbows[arm].x - 2.4, y: elbows[arm].y - 2.4 }, 4.8, 4.8, bodyPoint);
      boundRect({ x: hand.x - 2.5, y: hand.y - 1.7 }, 5, 4, bodyPoint);
    });
    boundRect({ x: -bodyWidth / 2 - 1, y: -23 }, bodyWidth + 2, 28, bodyPoint);
    const lowest = Math.max(...bounds.map(point => Math.sin(actor.angle) * point.x * facing + Math.cos(actor.angle) * (point.y - pivotY)));
    ctx.translate(x, y - lowest * scale); ctx.rotate(actor.angle); ctx.scale(scale * facing, scale); ctx.translate(0, -pivotY);
  } else { ctx.translate(x, y - 2 * scale); ctx.rotate(actor.angle); ctx.scale(scale * facing, scale); }
  const rect = (px: number, py: number, width: number, height: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(px, py, width, height); };
  const leg = (back: boolean) => {
    const index = back ? 0 : 1, ankle = feet[index], joint = knees[index], origin = hips[index];
    segment(ctx, origin, joint, 6.5, palette); segment(ctx, joint, ankle, 5.5, palette);
    rect(joint.x - 2.8, joint.y - 2.8, 5.6, 5.6, palette.base);
    rect(joint.x - 1.5, joint.y - 1.8, 2.2, 1.2, palette.light); rect(joint.x + 1, joint.y + .8, 1.4, 1.4, palette.shade);
    rect(ankle.x - 3, ankle.y - 1, 9, 3, palette.base); rect(ankle.x - 1.8, ankle.y - .5, 2.8, 1, palette.light); rect(ankle.x - 3, ankle.y + 1.3, 9, .7, palette.shade);
  };
  leg(true); leg(false);
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean);
  const arm = (back: boolean, lowerOnly = false) => {
    const index = back ? 0 : 1, shoulder = shoulders[index], elbow = elbows[index], hand = hands[index];
    if (!lowerOnly) {
      segment(ctx, shoulder, elbow, 5.5, palette);
      rect(shoulder.x - 2.8, shoulder.y - 2.8, 5.6, 5.6, palette.base); rect(shoulder.x - 1.7, shoulder.y - 1.8, 2.4, 1.2, palette.light);
    }
    segment(ctx, elbow, hand, 4.9, palette);
    rect(elbow.x - 2.4, elbow.y - 2.4, 4.8, 4.8, palette.base); rect(elbow.x + .5, elbow.y + 1, 1.4, 1.1, palette.shade);
    rect(hand.x - 2.5, hand.y - 1.7, 5, 4, palette.base); rect(hand.x - 1.1, hand.y - 1.1, 2.2, .8, palette.light); rect(hand.x + 1.1, hand.y + 1, 1.1, .9, palette.shade);
  };
  arm(true);
  rect(-bodyWidth / 2, -23, bodyWidth, 23, palette.base);
  rect(-bodyWidth / 2 + 2, -21, 5, 2, palette.light); rect(-bodyWidth / 2 + 3, -15, 3, 2, palette.light);
  rect(bodyWidth / 2 - 3, -20, 3, 5, palette.shade); rect(bodyWidth / 2 - 4, -10, 4, 4, palette.shade);
  rect(-3, -14, 6, 1, palette.shade);
  rect(-2.7, -28, 5.4, 7, palette.base); rect(-1.5, -27.5, 4.2, 1.5, palette.shade); rect(.6, -24.5, 2.1, 2, palette.shade);
  ctx.save(); ctx.translate(0, headY); ctx.rotate(motion.head * Math.PI / 180);
  rect(-headWidth / 2, -8, headWidth, 16, palette.base);
  rect(-headWidth / 2 + 2, -6, headWidth - 6, 2, palette.light); rect(-headWidth / 2 + 1, 2, 2, 2, palette.light);
  rect(headWidth / 2 - 3, -5, 3, 3, palette.shade); rect(headWidth / 2 - 3, 2, 3, 3, palette.shade); rect(-headWidth / 2 + 2, 6, headWidth - 4, 2, palette.shade);
  rect(.5, 1, 1.4, 2, palette.light); rect(1.3, 2, 1.4, 1, palette.shade);
  rect(-headWidth / 2 - 1.5, -3, 1.5, 5, palette.base); rect(headWidth / 2, -3, 1.5, 5, palette.base);
  rect(-headWidth / 2 - 1, -1, .6, 2, palette.shade); rect(headWidth / 2 + .3, -1, .6, 2, palette.shade);
  rect(-headWidth / 2 - 1, -10, headWidth + 2, 4 + personality % 2, hair);
  rect(-headWidth / 2 - 1, -6, 2, personality === 2 ? 6 : 4, hair); rect(headWidth / 2 - 1, -6, 2, personality === 1 ? 6 : 3, hair);
  if (personality === 0) rect(-2, -11, 6, 2, hair);
  if (personality === 2) { rect(-5, -11, 3, 2, hair); rect(2, -12, 3, 3, hair); }
  if (personality === 3) rect(-headWidth / 2, -7, headWidth - 3, 2, hair);
  const blink = (clock + index * 917) % (3400 + personality * 230) > 3280 + personality * 230;
  const eyeHeight = blink ? .7 : pose === 'airborne' ? 2.7 : 1.8;
  rect(-3.5, -1, 1.8, eyeHeight, '#172b37'); rect(3, -1, 1.8, eyeHeight, '#172b37');
  const intense = ['push', 'brace', 'lift', 'throw'].includes(pose);
  rect(-4.5, intense ? -3 : -3.5, 3, .8, hair); rect(2.5, intense ? -3.5 : -3, 3, .8, hair);
  rect(-1, 4, 2.7, motion.mouth, palette.deep);
  if (pose === 'cheer' || pose === 'clap') { rect(-2, 3.3, .8, 1.8, palette.deep); rect(1.8, 3.3, .8, 1.8, palette.deep); }
  ctx.restore(); ctx.restore();
  const fabricShade = shade(candidate.color, .72), fabricLight = shade(candidate.color, 1.1);
  const polygon = (points: Point[], color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); ctx.closePath(); ctx.fill();
  };
  // Both cuffs follow the thighs; the pelvic yoke joins them without a solid crotch block.
  shorts.forEach(panel => {
    polygon(panel.points, candidate.color);
    const [a, b] = panel.points.slice(2), direction = panel.direction;
    polygon([a, b, { x: b.x - direction.x * .9, y: b.y - direction.y * .9 }, { x: a.x - direction.x * .9, y: a.y - direction.y * .9 }], fabricShade);
  });
  polygon(yoke, candidate.color); polygon(waist, fabricShade);
  polygon([bodyPoint({ x: 1, y: -3.7 }), bodyPoint({ x: 3.1, y: -3.7 }), bodyPoint({ x: 3.1, y: -2.4 }), bodyPoint({ x: 1, y: -2.4 })], fabricLight);
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean);
  if (motion.applause > .01) { ctx.save(); ctx.globalAlpha = actor.alpha * motion.applause; arm(true, true); ctx.restore(); }
  arm(false); ctx.restore(); ctx.restore();
  state.clock = clock; state.signature = signature; state.epoch = actor.motionEpoch; state.distance = actor.gaitDistance; state.moving = moving; state.airborne = air; state.pose = pose;
}

export function drawArenaName(ctx: CanvasRenderingContext2D, actor: ArenaActor) {
  const { candidate } = actor;
  const x = actor.x, y = actor.y + 7;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '800 12px "Malgun Gothic", sans-serif';
  const letters = Array.from(candidate.name);
  let label = candidate.name;
  for (let shown = letters.length - 1; ctx.measureText(label).width > 38 && shown >= 2; shown--) {
    const prefix = Math.ceil(shown / 2), suffix = Math.floor(shown / 2);
    label = letters.slice(0, prefix).join('') + '…' + letters.slice(-suffix).join('');
  }
  const width = Math.min(48, Math.ceil(ctx.measureText(label).width) + 10);
  ctx.fillStyle = '#18343deb'; ctx.fillRect(x - width / 2, y, width, 20);
  ctx.fillStyle = candidate.color; ctx.fillRect(x - width / 2, y + 18, width, 2);
  ctx.fillStyle = '#fff1d6'; ctx.fillText(label, x, y + 3);
  ctx.restore();
}
