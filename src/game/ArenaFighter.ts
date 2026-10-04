import type { Candidate } from '../election';

export type ArenaPose = 'idle' | 'guard' | 'walk' | 'run' | 'slide' | 'grapple' | 'brace' | 'push' | 'dodge' | 'lift' | 'throw' | 'overhead' | 'scoop' | 'elbow' | 'superman' | 'airborne' | 'held' | 'carried' | 'roll' | 'land' | 'recover' | 'cheer' | 'clap' | 'bow' | 'trip' | 'suplex' | 'drag' | 'sidekick' | 'stunned';
type Point = { x: number; y: number };
type Motion = { crouch: number; lean: number; hipX: number; head: number; mouth: number; backX: number; backY: number; frontX: number; frontY: number; spread: number; contact: number; shoulderLift: number; clapTurn: number; cheerTurn: number; applause: number };
type Matrix = [number, number, number, number, number, number];
export type ArenaSpinSuspension = { orbit: number; flatness: number; grips: [Point, Point]; weight?: number };
export type ArenaSlamProgress = { tuck: number; slump: number };
export type ArenaSpinSnapshot = { origin: Point; matrix: Matrix; motion: Motion; hip: Point; feet: [Point, Point]; hands: Point[]; orbit: number; front: boolean; phase: number; facing: number };
type FootMemory = { anchor: Point; from: Point; to: Point; ground: Point; lift: number; swinging: boolean; swingStart: number; swingStrength?: number; settleAt: number; settleFrom: Point; settleTo: Point; settleLift: number; replant?: { at: number; from: Point; to: Point } };
export type ArenaFighterAnimation = { clock: number | null; signature: string; epoch?: number | string; facing?: number; supportHip?: Point; motion: Motion | null; gait: number; distance: number; moving: boolean; airborne: boolean; feet: [FootMemory, FootMemory] | null; localFeet: [Point, Point] | null; grip?: Point; secondaryGrip?: Point; pose?: ArenaPose; supermanMotion?: Motion; supermanFeet?: [Point, Point]; depthStride?: number; pivotStep?: number; spinSnapshot?: ArenaSpinSnapshot; contactPoints?: { origin: Point; head: Point; shoulders: Point[]; elbows: Point[]; hands: Point[]; waist: Point; feet: Point[] }; skeleton?: { hips: Point[]; knees: Point[]; feet: Point[]; shorts: Point[][]; pelvis: Point[] } };
export type ArenaActor = { candidate: Candidate; index: number; x: number; y: number; depthY?: number; scale: number; facing: number; pose: ArenaPose; angle: number; yaw?: number; pivotTurn?: number; suspension?: number; slamProgress?: ArenaSlamProgress; jumpTuck?: number; carryStretch?: number; overheadRaise?: number; carrierDrive?: number; scoopStroke?: number; frontKick?: number; slideProgress?: number; supermanProgress?: number; punchTarget?: Point; punchStrength?: number; punchArm?: 0 | 1; linkedArm?: 0 | 1; linkedHandTarget?: Point; linkedArmStrength?: number; spinSuspension?: ArenaSpinSuspension; spinRelease?: { snapshot: ArenaSpinSnapshot; weight: number }; footTarget?: Point; footStrength?: number; kickLeg?: number; elbowTarget?: Point; elbowStrength?: number; alpha: number; velocityX: number; velocityY: number; gaitDistance: number; phase: number; power?: number; grappleEffort?: number; grappleLiftPreparation?: number; chargePreparation?: number; chargeStrength?: number; gripMode?: 'wrist' | 'waist' | 'ankle'; gripLocked?: boolean; gripStrength?: number; gripTarget?: Point; secondaryGripTarget?: Point; animation?: ArenaFighterAnimation; motionEpoch?: number | string; motionImmediate?: boolean };

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
  const length = Math.max(Math.abs(upper - lower) + .02, Math.min(upper + lower - .02, raw));
  const along = (upper * upper - lower * lower + length * length) / (2 * length);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const nx = dx / (raw || 1), ny = dy / (raw || 1);
  return { x: a.x + nx * along + ny * height * bend, y: a.y + ny * along - nx * height * bend };
}
function reachable(a: Point, b: Point, length: number, minimum = 0): Point {
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
  const reach = Math.max(minimum, Math.min(length, distance));
  if (distance < .001) return minimum ? { x: a.x, y: a.y + minimum } : { ...a };
  return { x: a.x + dx / distance * reach, y: a.y + dy / distance * reach };
}

/** Unfold the free carried arms around the shoulders with two complete bones. */
function carriedArm(shoulder: Point, arm: number, stretch: number, armX: number): { elbow: Point; hand: Point } {
  const lowShoulder = { x: shoulder.x, y: -20 }, highShoulder = { x: shoulder.x, y: -26 };
  const lowHand = { x: arm ? 12 : -11, y: -2 };
  const highHand = reachable(highShoulder, { x: arm ? armX : -armX, y: -46.8 }, 21.3, .52);
  const lowElbow = knee(lowShoulder, lowHand, 11, 10.5, -1);
  const highElbow = knee(highShoulder, highHand, 11, 10.5, arm ? -1 : 1);
  const startUpper = Math.atan2(lowElbow.y - lowShoulder.y, lowElbow.x - lowShoulder.x);
  const endUpper = Math.atan2(highElbow.y - highShoulder.y, highElbow.x - highShoulder.x);
  const startLower = Math.atan2(lowHand.y - lowElbow.y, lowHand.x - lowElbow.x);
  const endLower = Math.atan2(highHand.y - highElbow.y, highHand.x - highElbow.x);
  const outsideSweep = (start: number, end: number) => (end - start + Math.PI * 2) % (Math.PI * 2);
  // Both wrists sweep together so one helper can hold them throughout the
  // pickup. Switching IK solutions midway
  // snapped an elbow through the head as its hand crossed the shoulder.
  // Use steady angular travel, keeping the broad arm arc from doubling its
  // speed at the middle of the floor pickup.
  // Bound the inverse easing slope at the two endpoints as well as at normal
  // playback steps. A tiny seek must not jump an elbow around the shoulder.
  const inverse = (value: number) => .5 - Math.sin(Math.asin(1 - 2 * value) / 3);
  const inset = .0001, start = inverse(inset), linear = (inverse(mix(inset, 1 - inset, stretch)) - start) / (1 - 2 * start), progress = mix(stretch, linear, .9);
  const upperAngle = startUpper + outsideSweep(startUpper, endUpper) * progress;
  const lowerAngle = startLower + outsideSweep(startLower, endLower) * progress;
  const elbow = { x: shoulder.x + Math.cos(upperAngle) * 11, y: shoulder.y + Math.sin(upperAngle) * 11 };
  return { elbow, hand: { x: elbow.x + Math.cos(lowerAngle) * 10.5, y: elbow.y + Math.sin(lowerAngle) * 10.5 } };
}
/** Knees bend forward into depth. Their full 3D bend must not appear as sideways bowing. */
function legKnee(hip: Point, foot: Point, depth: number, yaw: number): Point {
  const joint = knee(hip, foot, 11, 11, 1);
  const middle = pointMix(hip, foot, .5), bend = { x: joint.x - middle.x, y: joint.y - middle.y };
  const foreshorten = mix(.30, .10, depth);
  return { x: middle.x + bend.x * foreshorten * Math.cos(yaw), y: middle.y + bend.y * foreshorten };
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
  return { anchor: { ...point }, from: { ...point }, to: { ...point }, ground: { ...point }, lift: 0, swinging: false, swingStart: .62, settleAt: -Infinity, settleFrom: { ...point }, settleTo: { ...point }, settleLift: 0 };
}

/** Stance feet stay in world space; changing a pose cannot restart the stride. */
function groundedFeet(actor: ArenaActor, state: ArenaFighterAnimation, clock: number, moving: boolean, reset: boolean, spread: number): [Point, Point] {
  const { x, y, facing, scale, index } = actor;
  const comfortable = (leg: number, yaw = actor.yaw ?? 0): Point => ({ x: x + facing * (leg ? 6 : -5) * spread * scale * Math.cos(yaw), y: y + (leg ? 6 : -5) * spread * scale * Math.sin(yaw) * .42 });
  if (state.airborne && !reset && state.localFeet) {
    state.feet = state.localFeet.map(foot => {
      const memory = makeFoot({ x: x + foot.x * facing * scale, y });
      memory.lift = Math.max(0, -foot.y);
      return memory;
    }) as [FootMemory, FootMemory];
  }
  state.feet ??= [makeFoot(comfortable(0)), makeFoot(comfortable(1))];
  if (actor.pivotTurn !== undefined && Math.abs(actor.pivotTurn) > 0) {
    const direction = Math.sign(actor.pivotTurn), steps = Math.abs(actor.pivotTurn) / (Math.PI * 2) * 8, step = Math.floor(steps), phase = steps - step;
    const leg = step % 2;
    if (state.pivotStep !== step) {
      // Commit the actual landing point; crossing a beat cannot snap a heel to its old target.
      state.feet.forEach(foot => { if (foot.swinging) foot.anchor = { ...foot.ground }; foot.swinging = false; foot.lift = 0; });
      const foot = state.feet[leg]; foot.from = { ...foot.ground }; foot.to = comfortable(leg, (step + 1) * direction * Math.PI / 4); foot.swinging = true;
      state.pivotStep = step;
    }
    const foot = state.feet[leg]; foot.ground = pointMix(foot.from, foot.to, ease(phase)); foot.lift = Math.sin(phase * Math.PI) * 1.5;
    if (phase >= 1) { foot.anchor = { ...foot.to }; foot.swinging = false; }
    return state.feet.map(foot => ({ x: (foot.ground.x - x) / (scale * facing), y: (foot.ground.y - y) / scale - foot.lift })) as [Point, Point];
  }
  state.pivotStep = undefined;
  const speed = Math.max(.01, Math.hypot(actor.velocityX, actor.velocityY));
  const vx = actor.velocityX / speed, vy = actor.velocityY / speed;
  const running = actor.pose === 'run' ? ease((speed - 35) / 80) : 0;
  const charge = clamp(actor.chargeStrength ?? 0);
  // Shorter strides into depth keep both planted heels within leg reach.
  const vertical = Math.abs(vy), cycleLength = mix(mix(30, 34 + charge * 5, running), 13.2, vertical) * (1 + (index % 3 - 1) * .025);
  const distance = reset ? 0 : Math.max(0, actor.gaitDistance - state.distance);
  // Starting halfway through a swing gave the first step only a few frames.
  // Begin with both soles down so acceleration has a full step to unfold.
  if (moving && !state.moving) {
    state.gait = .30;
    state.feet.forEach(foot => { foot.swinging = false; });
  }
  if (moving) state.gait += distance / Math.max(1, scale * cycleLength);
  const stance = .62;
  return state.feet.map((foot, leg) => {
    if (moving) {
      const cycle = (state.gait + leg * .5) % 1;
      if (cycle >= stance) {
        if (!foot.swinging) {
          foot.swinging = true; foot.from = { ...foot.ground }; foot.swingStart = cycle;
          foot.swingStrength = Math.min(1, (1 - cycle) / (1 - stance));
          const ahead = ((1 - cycle) + stance / 2) * cycleLength * scale;
          foot.to = { x: x + facing * (leg ? 3 : -3) * scale + vx * ahead, y: y + vy * ahead };
        }
        const amount = clamp((cycle - foot.swingStart) / Math.max(.001, 1 - foot.swingStart));
        foot.ground = pointMix(foot.from, foot.to, ease(amount));
        foot.lift = Math.sin(amount * Math.PI) * mix(mix(3.6, 5.8 + charge * 1.4, running), 2.1, vertical) * (foot.swingStrength ?? 1);
      } else {
        if (foot.swinging) { foot.anchor = { ...foot.to }; foot.swinging = false; }
        foot.ground = { ...foot.anchor }; foot.lift = 0;
      }
    } else {
      if (state.moving || state.airborne || !reset && state.pose !== actor.pose && (Math.hypot(foot.ground.x - comfortable(leg).x, foot.ground.y - y) > scale * 1.4 || actor.pose === 'recover' && actor.slideProgress !== undefined && foot.lift > .05)) {
        foot.settleAt = clock + leg * 40; foot.settleFrom = { ...foot.ground }; foot.settleTo = comfortable(leg); foot.settleLift = foot.lift; foot.swinging = false;
      }
      const amount = clamp((clock - foot.settleAt) / 235);
      if (Number.isFinite(foot.settleAt)) {
        foot.ground = pointMix(foot.settleFrom, foot.settleTo, ease(amount));
        foot.lift = Math.max(foot.settleLift * (1 - amount), Math.sin(amount * Math.PI) * 1.7);
        if (amount === 1) { foot.anchor = { ...foot.ground }; foot.settleAt = -Infinity; }
      }
    }
    return { x: (foot.ground.x - x) / (scale * facing), y: (foot.ground.y - y) / scale - foot.lift };
  }) as [Point, Point];
}

/** Meet between the chests, not between the feet of a body leaning out from a held wrist. */
export function arenaWristGripPoint(first: ArenaActor, second: ArenaActor, clock: number): Point {
  const a = sampleArenaFighterContacts(first, clock).shoulders[1], b = sampleArenaFighterContacts(second, clock).shoulders[1];
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), reach = 21.3 * Math.min(first.scale, second.scale);
  const clearance = Math.sqrt(Math.max(0, reach ** 2 - (distance / 2) ** 2));
  // Use the overlap of the two actual shoulder-reach circles. A downward bias keeps
  // the shared wrist below the faces without stretching either fixed-length arm.
  const normal = { x: -dy / Math.max(.01, distance), y: dx / Math.max(.01, distance) };
  if (normal.y < 0) { normal.x *= -1; normal.y *= -1; }
  const bias = Math.min(12, clearance * .8);
  return { x: (a.x + b.x) / 2 + normal.x * bias, y: (a.y + b.y) / 2 + normal.y * bias };
}

/** Join the horizontal arms only when both real shoulders are within reach. */
export function arenaLinkedHandPoint(first: ArenaActor, second: ArenaActor, clock: number): Point | null {
  const a = sampleArenaFighterContacts(first, clock).shoulders[first.linkedArm ?? 1], b = sampleArenaFighterContacts(second, clock).shoulders[second.linkedArm ?? 1];
  const reachA = 21.3 * first.scale, reachB = 21.3 * second.scale, span = Math.hypot(b.x - a.x, b.y - a.y);
  if (span > reachA + reachB || span < .52 * Math.max(first.scale, second.scale)) return null;
  const fraction = Math.max(0, Math.min(1, (span + reachA - reachB) / (2 * span)));
  return pointMix(a, b, fraction);
}
/** Equal leg bones can reach full extension before changing their visible bend. */
function extendingKnee(a: Point, b: Point, bend: number): Point {
  const dx = b.x - a.x, dy = b.y - a.y, raw = Math.max(.01, Math.hypot(dx, dy)), along = Math.min(22, raw) / 2;
  const height = Math.sqrt(Math.max(0, 121 - along * along));
  return { x: a.x + dx / raw * along + dy / raw * height * bend, y: a.y + dy / raw * along - dx / raw * height * bend };
}

function spinAxes(orbit: number, flatness: number, facing: number, weight: number) {
  const flat = clamp(flatness), radial = { x: Math.cos(orbit) * flat, y: mix(1, .30 + Math.sin(orbit) * .10, flat) };
  const length = Math.hypot(radial.x, radial.y), width = .42 + Math.abs(Math.sin(orbit)) * .58;
  return {
    across: pointMix({ x: facing, y: 0 }, { x: radial.y / length * facing * width, y: -radial.x / length * facing * width }, weight),
    outward: pointMix({ x: 0, y: 1 }, radial, weight),
  };
}

/** Both planted hands remain within reach while the held body circles outside them. */
export function arenaSpinGripPair(driver: ArenaActor, orbit: number, _clock: number, weight = 1): [Point, Point] {
  const axes = spinAxes(orbit, .94, -driver.facing, clamp(weight));
  const center = { x: driver.x + Math.cos(orbit) * 18, y: driver.y - driver.scale * 37.3 + Math.sin(orbit) * 5 * clamp(weight) };
  return [-5, 5].map(offset => ({ x: center.x + axes.across.x * offset * driver.scale, y: center.y + axes.across.y * offset * driver.scale })) as [Point, Point];
}

const contactContext = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(name => [name, () => {}])) as unknown as CanvasRenderingContext2D;

/** Predict the exact current pose without advancing the scene's animation or painting pixels. */
export function sampleArenaFighterContacts(actor: ArenaActor, clock: number) {
  const animation = actor.animation ? structuredClone(actor.animation) : createArenaFighterAnimation();
  drawArenaFighter(contactContext, { ...actor, animation }, clock);
  return animation.contactPoints!;
}

/** Stand under two painted limb ends without shortening either lifting arm. */
export function arenaCarryHolderPoint(actor: ArenaActor, endpoints: readonly Point[], clock: number, preferredRoot?: Point): Point {
  if (endpoints.length !== 2) throw new RangeError('A shared lift needs two painted limb endpoints');
  const raise = actor.pose === 'overhead' ? clamp(actor.overheadRaise ?? 1) : 0;
  const sample = sampleArenaFighterContacts({ ...actor, gripTarget: endpoints[0], secondaryGripTarget: endpoints[1], gripStrength: 1, gripLocked: true }, clock);
  const free = sampleArenaFighterContacts({ ...actor, gripTarget: undefined, secondaryGripTarget: undefined, gripStrength: 0 }, clock);
  const relative = (point: Point) => ({ x: point.x - actor.x, y: point.y - actor.y });
  const shoulders = sample.shoulders.map(relative), hands = free.hands.map(relative);
  const centers = shoulders.map((shoulder, arm) => ({ x: endpoints[1 - arm].x - shoulder.x, y: endpoints[1 - arm].y - shoulder.y }));
  const radius = mix(20.9, 27.3, raise) * actor.scale;
  const midpoint = pointMix(endpoints[0], endpoints[1], .5), handMidpoint = pointMix(hands[0], hands[1], .5);
  let ground = preferredRoot ? { ...preferredRoot } : { x: midpoint.x - handMidpoint.x, y: midpoint.y - handMidpoint.y };
  // The intersection of the two reach disks is convex. Projecting the natural
  // low hand position into it keeps the pickup continuous as the hips rise.
  for (let pass = 0; pass < 16; pass++) for (const center of centers) ground = reachable(center, ground, radius);
  const dx = centers[1].x - centers[0].x, dy = centers[1].y - centers[0].y, separation = Math.hypot(dx, dy);
  if (!preferredRoot && separation > .001 && separation <= radius * 2) {
    let normal = { x: -dy / separation, y: dx / separation };
    if (normal.y < 0) normal = { x: -normal.x, y: -normal.y };
    const clearance = Math.sqrt(Math.max(0, radius * radius - separation * separation / 4)), center = pointMix(centers[0], centers[1], .5);
    const extended = { x: center.x + normal.x * clearance, y: center.y + normal.y * clearance };
    // Finish with both elbows broadly open. Keep the lower pickup on its own
    // side of the chest, rather than flipping IK branches at shoulder height.
    ground = pointMix(ground, extended, ease((raise - .65) / .35));
  }
  return ground;
}

/** Capture the painted hand-origin rig, including projection, without advancing live state. */
export function arenaSpinSnapshot(actor: ArenaActor, clock: number): ArenaSpinSnapshot {
  if (!actor.spinSuspension) throw new Error('A spin snapshot requires spinSuspension on the held actor');
  const animation = actor.animation ? structuredClone(actor.animation) : createArenaFighterAnimation();
  drawArenaFighter(contactContext, { ...actor, animation }, clock);
  if (!animation.spinSnapshot) throw new Error('A spin snapshot requires spinSuspension on the held actor');
  return structuredClone(animation.spinSnapshot);
}

/** One skin palette covers every bare body part; motion uses a small, connected skeleton. */
export function drawArenaFighter(ctx: CanvasRenderingContext2D, actor: ArenaActor, clock: number) {
  const { candidate, index, x, y, scale, facing, pose, phase } = actor;
  const spin = actor.spinSuspension, spinWeight = clamp(spin?.weight ?? (spin ? 1 : 0)), released = actor.spinRelease;
  const slam = actor.slamProgress, tuck = clamp(slam?.tuck ?? 0), slump = clamp(slam?.slump ?? 0);
  const plantedLanding = !!slam && pose === 'land' && Math.abs(actor.angle) < .001 && (actor.suspension ?? 0) === 0;
  const sliding = pose === 'slide', slideRise = pose === 'recover' && actor.slideProgress !== undefined;
  const superman = pose === 'superman', supermanProgress = clamp(actor.supermanProgress ?? phase);
  const jointOverhead = pose === 'overhead' && (actor.gripMode === 'wrist' || actor.gripMode === 'ankle');
  // A zero carry progress accompanies the charge before the fighter is caught.
  // It must not turn a grounded runner into a suspended, frozen skeleton.
  const carrying = pose === 'carried' || (actor.carryStretch ?? 0) > 0 || actor.carryStretch !== undefined && pose === 'stunned', stretch = clamp(actor.carryStretch ?? 1);
  const releaseWeight = clamp(released?.weight ?? 0);
  const palette = palettes[index % palettes.length], hair = ['#162536', '#4b362e', '#6f493e', '#2b3f49'][index % 4];
  const personality = index % 4, breath = Math.sin((clock + index * 719) / (580 + personality * 65));
  const speed = Math.hypot(actor.velocityX, actor.velocityY), air = !!slam || carrying || superman || pose === 'elbow' && (actor.suspension ?? 0) > 0 || ['airborne', 'held', 'roll', 'land', 'sidekick', 'stunned'].includes(pose) || pose === 'recover' && !slideRise;
  const state = actor.animation ?? createArenaFighterAnimation();
  const plantedGrip = actor.grappleEffort !== undefined && !!actor.gripTarget;
  const moving = speed > (state.moving ? 3 : 8) && !air && !plantedGrip && !sliding, backward = actor.velocityX * facing < -5;
  const signature = candidate.id + ':' + index + ':' + candidate.color;
  const reset = !state.motion || !Number.isFinite(state.motion.clapTurn) || !Number.isFinite(state.motion.cheerTurn) || !Number.isFinite(state.motion.applause) || state.signature !== signature || state.epoch !== actor.motionEpoch || actor.motionImmediate || clock < (state.clock ?? clock) || actor.gaitDistance < state.distance - 1;
  const delta = reset ? 0 : Math.max(0, Math.min(50, clock - (state.clock ?? clock)));
  if (reset) { state.feet = null; state.localFeet = null; state.supermanFeet = undefined; state.supermanMotion = undefined; state.gait = .42 + personality * .015; state.moving = false; state.airborne = false; state.pivotStep = undefined; }
  else if (state.facing !== undefined && state.facing !== facing) {
    // Mirroring the body swaps the projected hips. Keep each world heel paired with its same hip.
    if (state.feet) state.feet = [state.feet[1], state.feet[0]];
    if (state.localFeet) state.localFeet = [{ x: -state.localFeet[1].x, y: state.localFeet[1].y }, { x: -state.localFeet[0].x, y: state.localFeet[0].y }];
    if (state.supportHip) state.supportHip.x *= -1;
    state.gait += .5;
  }
  if (superman && (state.pose !== 'superman' || !state.supermanFeet)) {
    // The planted load becomes the launch pose without swapping either heel
    // to a generic airborne footprint on the first jumping frame.
    state.supermanMotion = !reset && state.motion ? { ...state.motion } : undefined;
    if (state.supermanMotion && state.supportHip) { state.supermanMotion.hipX = state.supportHip.x; state.supermanMotion.crouch = state.supportHip.y + 20; }
    state.supermanFeet = state.localFeet?.map(foot => ({ ...foot })) as [Point, Point] | undefined;
    state.supermanFeet ??= [{ x: -5, y: 0 }, { x: 6, y: 0 }];
  }
  const gait = state.gait * Math.PI * 2, power = clamp(actor.power ?? .6);
  const target: Motion = { crouch: .2 + breath * .2, lean: breath * .7, hipX: breath * .12, head: breath * 1.1, mouth: 1.2, backX: -9, backY: 0, frontX: 10, frontY: 0, spread: 1 + personality * .035, contact: actor.gripTarget ? clamp(actor.gripStrength ?? 1) : 0, shoulderLift: actor.gripTarget ? clamp((y - actor.gripTarget.y - 66) / (scale * 14)) * 3 : 0, clapTurn: ['idle', 'walk', 'run', 'bow', 'clap'].includes(pose) ? 1 : 0, cheerTurn: 0, applause: 0 };
  if (pose === 'guard' || pose === 'grapple') { target.crouch = 1.2 + personality * .25; target.lean = 2 + personality * .4; target.backX = -5; target.backY = -12; target.frontX = 15; target.frontY = -15; target.head = -target.lean * .3; }
  if (pose === 'grapple') { target.crouch = 3.1 + breath * .35; target.hipX = Math.sin(clock / 420 + index) * .55; target.lean = 6 + breath * .8; target.spread += .16; }
  if (pose === 'brace') { target.crouch = 3.2; target.hipX = -1.2 + breath * .3; target.lean = -7 + breath * .5; target.backX = -1; target.backY = -12; target.frontX = 16; target.frontY = -14; target.spread += .20; target.mouth = .9; }
  if ((pose === 'grapple' || pose === 'brace') && actor.grappleEffort !== undefined) {
    const effort = clamp(actor.grappleEffort), resisting = pose === 'brace';
    target.crouch += effort * 1.8; target.hipX += effort * (resisting ? -.7 : .7);
    target.lean += effort * (resisting ? -2.5 : 4); target.spread += effort * .08;
    target.head = mix(target.head, -target.lean * .3, effort); target.mouth += effort * .5;
    if (!resisting && actor.grappleLiftPreparation !== undefined) {
      const load = clamp(actor.grappleLiftPreparation);
      target.crouch = mix(target.crouch, 6, load); target.hipX = mix(target.hipX, 1, load); target.lean = mix(target.lean, 10, load);
      target.backX = mix(target.backX, 6, load); target.frontX = mix(target.frontX, 17, load);
      target.backY = mix(target.backY, -20, load); target.frontY = mix(target.frontY, -24, load);
      target.head = mix(target.head, breath * 1.1, load); target.mouth = mix(target.mouth, 2.4, load);
      target.spread = mix(target.spread, 1 + personality * .035, load);
      target.shoulderLift *= 1 - load;
    }
  }
  if (pose === 'push') { target.crouch = 2.8 + breath * .2; target.hipX = 1.2; target.lean = 10 + power * 5; target.backX = 7; target.backY = -14; target.frontX = 22; target.frontY = -16; target.spread += .16; target.mouth = 1.8; }
  if (pose === 'dodge') { target.crouch = 2.7; target.hipX = -2; target.lean = -14; target.backX = -5; target.backY = -17; target.frontX = 13; target.frontY = -22; target.head = 6; }
  if (pose === 'lift') {
    const drive = ease((phase - .16) / .76);
    target.crouch = mix(6.4, 1.2, drive); target.hipX = mix(-1.4, 2.1, drive); target.lean = mix(11, -10, drive);
    target.backX = 5; target.backY = mix(-12, -25, drive); target.frontX = 17; target.frontY = mix(-14, -28, drive); target.mouth = 2;
  }
  if (pose === 'throw') {
    const follow = ease(phase);
    target.crouch = mix(1.2, 3.7, follow); target.hipX = mix(2.1, 3.6, follow); target.lean = mix(-10, 18, follow);
    target.backX = mix(5, 12, follow); target.backY = mix(-25, -13, follow); target.frontX = mix(17, 24, follow); target.frontY = mix(-28, -15, follow); target.head = -target.lean * .3; target.mouth = 2;
  }
  if (sliding) {
    const slide = ease((actor.slideProgress ?? phase) / .65);
    target.crouch = mix(1.6, 11.4, slide); target.hipX = mix(0, -3.2, slide); target.lean = mix(5, -24, slide);
    target.backX = mix(-9, -15, slide); target.backY = mix(-12, -19, slide); target.frontX = mix(13, 10, slide); target.frontY = mix(-14, -21, slide); target.head = -target.lean * .18; target.mouth = 2.1; target.clapTurn = 0;
  }
  if (pose === 'trip') { target.crouch = 3.8; target.lean = 13; target.hipX = 1; target.backX = 4; target.backY = -15; target.frontX = 19; target.frontY = -17; }
  if (pose === 'trip' && actor.frontKick !== undefined) {
    const kick = clamp(actor.frontKick), raised = ease(kick / .4) * (1 - ease((kick - .78) / .22)), extension = ease((kick - .4) / .22) * (1 - ease((kick - .62) / .16));
    target.crouch = 3.8 - raised * 1.8; target.lean = 13 - raised * 18 + extension * 5; target.hipX = 1 - raised * 1.5 + extension * .8;
    target.backX = mix(4, -13, raised); target.frontX = mix(19, 9, raised); target.backY = mix(-15, -21, raised); target.frontY = mix(-17, -23, raised); target.head = -target.lean * .25;
    target.contact *= 1 - raised;
  }
  if (pose === 'suplex') { const arch = ease((phase - .56) / .34); target.crouch = mix(6, 2, ease((phase - .34) / .22)) + arch * 6; target.lean = mix(10, -35, arch); target.hipX = mix(1, -3, arch); target.backX = 6; target.backY = mix(-20, -29, arch); target.frontX = 17; target.frontY = mix(-24, -31, arch); target.mouth = 2.4; }
  if (pose === 'drag') { const ankle = actor.gripMode === 'ankle'; target.crouch = ankle ? 4.5 : 12; target.lean = ankle ? 52 : 26; target.hipX = 1.5; target.backX = 6; target.backY = 4; target.frontX = 16; target.frontY = 6; target.mouth = 2; }
  if (pose === 'held') { target.crouch = actor.gripMode === 'wrist' ? .7 : 1.6; target.lean = actor.gripMode === 'wrist' ? 0 : 3; target.backX = -10; target.backY = -17; target.frontX = 12; target.frontY = -12; target.mouth = 2; }
  if (pose === 'roll') { target.crouch = 5; target.lean = 20; target.backX = 2; target.backY = -22; target.frontX = 11; target.frontY = -22; target.head = 4; target.mouth = 2; }
  if (pose === 'sidekick') { target.crouch = 2; target.lean = -8; target.backX = -10; target.backY = -21; target.frontX = 13; target.frontY = -24; target.mouth = 2.3; }
  if (pose === 'elbow') { target.crouch = 1.6; target.lean = 0; target.head = -3; target.backX = -11; target.backY = -20; target.frontX = 5; target.frontY = -34; target.mouth = 2.1; target.contact = 0; target.shoulderLift = 0; target.clapTurn = 0; }
  if (superman) {
    const wind = ease(supermanProgress / .24), strike = ease((supermanProgress - .24) / .24), landing = ease((supermanProgress - .68) / .32);
    target.crouch = mix(mix(2.2, .8, wind), 0, landing); target.hipX = mix(mix(0, 1.4, strike), 0, landing);
    target.lean = mix(mix(5, 18, strike), 9, landing); target.head = -target.lean * .3 * (1 - landing);
    target.backX = mix(-10, -5, landing); target.backY = mix(-22, -1, landing);
    target.frontX = mix(mix(10, 30, strike), 15, landing); target.frontY = mix(mix(-24, -25, strike), 1, landing);
    target.mouth = mix(2.5, 2, landing); target.contact = 0; target.shoulderLift = 0; target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
    if (state.supermanMotion) for (const key of Object.keys(target) as (keyof Motion)[]) target[key] = mix(state.supermanMotion[key], target[key], wind);
  }
  if (pose === 'stunned') { target.crouch = .4; target.lean = 0; target.hipX = 0; target.head = 0; target.backX = -11; target.backY = -2; target.frontX = 12; target.frontY = -2; target.mouth = .7; }
  if (pose === 'airborne') { target.crouch = 3; target.backX = -18; target.backY = -26; target.frontX = 20; target.frontY = -29; target.mouth = 3; target.head = -3; }
  if (pose === 'land') { target.crouch = 6 * Math.sin(clamp(phase) * Math.PI); target.lean = 9; target.backX = -5; target.backY = -1; target.frontX = 15; target.frontY = 1; target.mouth = 2.5; }
  if (pose === 'recover') { const p = ease(phase); target.crouch = mix(6.5, .4, p); target.lean = mix(12, 0, p); target.backX = mix(-2, -9, p); target.backY = mix(0, -1, p); target.frontX = mix(15, 10, p); target.frontY = mix(1, 0, p); }
  if (slideRise) { const p = ease(phase); target.crouch = mix(11.4, .4, p); target.hipX = mix(-3.2, 0, p); target.lean = mix(-24, 0, p); target.head = mix(4.32, 0, p); target.backX = mix(-15, -9, p); target.backY = mix(-19, -1, p); target.frontX = 10; target.frontY = mix(-21, 0, p); }
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
    const activity = ease(speed / 120), running = pose === 'run' ? ease((speed - 35) / 80) : 0;
    target.crouch = mix(target.crouch, Math.max(target.crouch, 1.0 + running * 1.1) + Math.abs(Math.sin(gait)) * .35, activity);
    const depth = Math.abs(actor.velocityY) / Math.max(1, speed);
    target.crouch = Math.max(target.crouch, 1.8 * ease(depth) + Math.abs(Math.sin(gait)) * .2);
    target.hipX += Math.sin(gait) * .45 * activity;
    if (pose === 'walk' || pose === 'run') {
      const swing = Math.cos(gait + personality * .07), reach = mix(4.5, 7, running) * activity;
      target.lean = mix(target.lean, backward ? -2 : mix(1.2, 5, running), activity); target.head = -target.lean * .35;
      target.backX = -8 - swing * reach; target.frontX = 9 + swing * reach;
      target.backY = -1 - Math.abs(swing) * 1.5 * activity; target.frontY = -1 - Math.abs(swing) * 1.5 * activity;
    }
  }
  const preparation = clamp(actor.chargePreparation ?? 0), charge = clamp(actor.chargeStrength ?? 0);
  if (preparation || charge) {
    const drive = ease(speed / 115) * charge, ready = Math.max(preparation, charge);
    target.crouch = mix(target.crouch, 6.2 - drive * .8 + Math.abs(Math.sin(gait)) * drive * .55, ready);
    target.lean = mix(target.lean, 15 + drive * 17, ready);
    target.hipX = mix(target.hipX, -1.8 + drive * 2.5, ready);
    target.spread += preparation * (1 - drive) * .30;
    target.head = -target.lean * .65;
    const pump = Math.cos(gait) * drive * 6;
    target.backX = mix(target.backX, -10 - pump, ready); target.backY = mix(target.backY, -13 - drive * 3, ready);
    target.frontX = mix(target.frontX, 14 + pump, ready); target.frontY = mix(target.frontY, -17 - drive * 2, ready);
    target.clapTurn = 0;
  }
  if (actor.linkedArm !== undefined) { target.lean = 0; target.hipX = 0; target.contact = 0; target.shoulderLift = 0; }
  if (actor.gripMode === 'wrist' && pose !== 'overhead') target.shoulderLift = 0;
  if (spin) {
    target.crouch = mix(3.2, .7, spinWeight); target.hipX = 0; target.lean = 0;
    target.backX = mix(10, -5, spinWeight); target.frontX = mix(20, 5, spinWeight);
    target.backY = target.frontY = mix(-18.5, -37.5, spinWeight);
    target.contact = 1; target.shoulderLift = 0; target.head = -2; target.mouth = 2.3;
  }
  if (slam) {
    // The waist lift, tucked back arc and limp floor pose share one timed rig.
    // A pose label change at impact cannot unfold the legs or lift the head.
    const lifted: Partial<Motion> = { crouch: mix(3.2, 5, tuck), lean: mix(-7 + breath * .5, 0, tuck), hipX: mix(-1.2 + breath * .3, 0, tuck), head: mix(breath * 1.1, 0, tuck), mouth: mix(.9, 2, tuck), backX: mix(-1, -8, tuck), backY: mix(-12, -18, tuck), frontX: mix(16, 8, tuck), frontY: mix(-14, -18, tuck), spread: 1 + personality * .035 + (1 - tuck) * .2 };
    const flat: Partial<Motion> = { crouch: .4, lean: 0, hipX: 0, head: 0, mouth: 1, backX: -11, backY: -2, frontX: 12, frontY: -2, spread: 1 + personality * .035 };
    for (const key of Object.keys(lifted) as (keyof Motion)[]) target[key] = mix(lifted[key]!, flat[key]!, slump);
    target.contact = 0; target.shoulderLift = 0; target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
  }
  if (carrying) {
    // The helpers hold two wrists and two ankles, with no generic airborne tuck.
    const armX = Math.min(4.6, (18 + index % 3) * .43 * .58);
    target.crouch = mix(.4, .7, stretch); target.lean = 0; target.hipX = 0; target.head = 0; target.mouth = .7;
    target.backX = mix(-11, -armX, stretch); target.frontX = mix(12, armX, stretch); target.backY = target.frontY = mix(-2, -46.8, stretch);
    target.spread = 1 + personality * .035; target.contact = 0; target.shoulderLift = stretch * 6; target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
  }
  if (pose === 'overhead') {
    const raise = clamp(actor.overheadRaise ?? 1), armX = (18 + index % 3) * .43, waist = actor.gripMode === 'waist', ankle = actor.gripMode === 'ankle';
    target.crouch = mix(waist ? 6 : ankle ? 4.5 : 12, .2, raise); target.lean = mix(waist ? 10 : ankle ? 52 : 26, 0, raise); target.hipX = mix(waist ? 1 : 1.5, 0, raise); target.head = breath * 1.1 * (1 - raise); target.mouth = mix(waist ? 2.4 : 2, 1.8, raise);
    target.backX = mix(6, -armX, raise); target.frontX = mix(waist ? 17 : 16, armX, raise); target.backY = mix(waist ? -20 : 4, -46.5, raise); target.frontY = mix(waist ? -24 : 6, -46.5, raise);
    target.shoulderLift = jointOverhead ? 3.5 * raise : target.shoulderLift * raise;
    target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
    if (actor.carrierDrive !== undefined) {
      const drive = clamp(actor.carrierDrive), load = Math.sin(Math.PI * clamp(drive / .5)) * (1 - raise), follow = actor.gripTarget ? 0 : ease((drive - .86) / .14);
      target.crouch += load * 1.8 + follow * 2.4; target.hipX += -load * .6 + follow * 2.0;
      target.lean += load * 3 + follow * 7; target.head -= follow * 2;
    }
  }
  if (actor.jumpTuck !== undefined && air) {
    const tuck = clamp(actor.jumpTuck);
    target.crouch += tuck * 1.6; target.lean -= tuck * 6;
    target.backX = mix(target.backX, -15, tuck); target.frontX = mix(target.frontX, 15, tuck);
    target.backY = mix(target.backY, -30, tuck); target.frontY = mix(target.frontY, -29, tuck);
  }
  if (pose === 'scoop') {
    const stroke = clamp(actor.scoopStroke ?? phase), rise = ease((stroke - .18) / .54), follow = ease((stroke - .80) / .20);
    target.crouch = mix(8.5, .9, rise) + follow * 2.2; target.hipX = mix(-2, 2, rise) + follow * 1.5; target.lean = mix(14, -8, rise) + follow * 28;
    target.backX = mix(-7, -6, rise) + follow * 20; target.frontX = mix(10, 12, rise) + follow * 12;
    target.backY = mix(3, -42, rise) + follow * 18; target.frontY = mix(4, -42, rise) + follow * 16;
    target.head = -target.lean * .3; target.mouth = 2.4; target.shoulderLift = rise * 2;
    target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
  }
  if (reset || slam || carrying || slideRise || superman || pose === 'scoop' || pose === 'trip' && actor.frontKick !== undefined || pose === 'overhead' && actor.overheadRaise !== undefined) state.motion = { ...target };
  else {
    (Object.keys(target) as (keyof Motion)[]).forEach(key => {
      const hand = key === 'backX' || key === 'backY' || key === 'frontX' || key === 'frontY';
      const turn = key === 'clapTurn' || key === 'cheerTurn';
      const amount = 1 - Math.exp(-delta / (air ? 55 : turn ? 180 : pose === 'clap' && hand && state.motion!.applause > .9 ? 45 : 95));
      state.motion![key] = mix(state.motion![key], target[key], amount);
    });
  }
  const motion = { ...state.motion! };
  if (actor.linkedArm !== undefined) { motion.lean = 0; motion.hipX = 0; motion.contact = 0; motion.shoulderLift = 0; }
  if (released && releaseWeight > 0) (Object.keys(motion) as (keyof Motion)[]).forEach(key => { motion[key] = mix(motion[key], released.snapshot.motion[key], releaseWeight); });
  const hip = released ? pointMix({ x: motion.hipX, y: -20 + motion.crouch }, released.snapshot.hip, releaseWeight) : { x: motion.hipX, y: -20 + motion.crouch };
  if (air && !slam && !carrying && !superman && !spin && !released && !reset && state.supportHip) {
    // A released support heel cannot instantly undo the pelvis height it held.
    // Continue that height through the first falling frame before relaxing it.
    const follow = 1 - Math.exp(-delta / 110);
    Object.assign(hip, pointMix(state.supportHip, hip, follow));
  }
  const lean = motion.lean * Math.PI / 180;
  let feet: [Point, Point];
  if (air) {
    // Both knees fold in the same anatomical direction; a tumble rotates the complete skeleton.
    const trailing = Math.sin(phase * Math.PI * 3 + index * .6);
    const airFeet: [Point, Point] = slam ? [{ x: -5, y: 0 }, { x: 6, y: 0 }].map((foot, leg) => pointMix(pointMix({ x: foot.x * (1 + personality * .035 + (1 - tuck) * .2), y: 0 }, { x: hip.x + (leg ? 7.3 : -2.4), y: hip.y + (leg ? 17.4 : 18) }, tuck), foot, slump)) as [Point, Point] : pose === 'held' && actor.gripMode === 'wrist' ? [{ x: -5 - trailing * .8, y: -.8 }, { x: 5 + trailing * .8, y: -2.4 }] : pose === 'roll' ? [{ x: 1, y: -12 }, { x: 10, y: -12 }] : pose === 'airborne' || pose === 'sidekick' || pose === 'held' ? [{ x: 1, y: -5 }, { x: 10, y: -1 }] : [{ x: -5, y: 0 }, { x: 6, y: 0 }];
    state.localFeet ??= airFeet;
    if (carrying) airFeet.forEach((foot, leg) => Object.assign(foot, pointMix({ x: leg ? 6 : -5, y: 0 }, { x: leg ? 4.5 : -4.5, y: hip.y + 21.98 }, stretch)));
    const amount = reset || slam || carrying ? 1 : 1 - Math.exp(-delta / 60);
    feet = state.localFeet.map((foot, leg) => pointMix(foot, airFeet[leg], amount)) as [Point, Point];
    if (pose === 'sidekick') {
      // Between the two hops the soles really plant; rising knees tuck only after push-off.
      const tuck = ease(((actor.depthY ?? y) - y) / (scale * 6));
      feet = feet.map((foot, leg) => pointMix({ x: leg ? 6 : -5, y: 0 }, foot, tuck)) as [Point, Point];
    }
  } else feet = groundedFeet(actor, state, clock, moving, reset, motion.spread);
  if (sliding) {
    const slide = ease((actor.slideProgress ?? phase) / .65);
    feet = [pointMix({ x: -5, y: 0 }, { x: -6, y: -1 }, slide), pointMix({ x: 6, y: 0 }, { x: 20, y: 0 }, slide)];
  }
  if (superman) {
    const chamber = ease(supermanProgress / .24), drive = ease((supermanProgress - .24) / .24), landing = ease((supermanProgress - .66) / .34);
    const falseKick = pointMix({ x: hip.x - 6, y: hip.y + 12 }, { x: hip.x - 18, y: hip.y + 10 }, drive);
    const leadKnee = pointMix({ x: hip.x + 12, y: hip.y + 8 }, { x: hip.x + 10, y: hip.y + 15 }, drive);
    feet = [falseKick, leadKnee].map((foot, leg) => pointMix(pointMix(state.supermanFeet![leg], foot, chamber), { x: leg ? 6 : -5, y: 0 }, landing)) as [Point, Point];
  }
  if (plantedLanding) feet = feet.map(foot => ({ x: foot.x, y: 0 })) as [Point, Point];
  if (actor.jumpTuck !== undefined && air) feet = feet.map((foot, leg) => pointMix(foot, { x: hip.x + (leg ? 7 : -2), y: hip.y + 8 }, clamp(actor.jumpTuck!))) as [Point, Point];
  if (spin) feet = feet.map((foot, leg) => pointMix(foot, { x: leg ? 6 : -5, y: hip.y + (leg ? 21.1 : 21.4) }, spinWeight)) as [Point, Point];
  if (released) feet = feet.map((foot, leg) => pointMix(foot, released.snapshot.feet[leg], releaseWeight)) as [Point, Point];
  const frontKick = pose === 'trip' && actor.frontKick !== undefined ? clamp(actor.frontKick) : undefined;
  const targetedLeg = frontKick !== undefined || actor.footTarget && (pose === 'trip' || pose === 'sidekick' || sliding) && (actor.footStrength ?? 1) > .001 ? actor.kickLeg ?? 1 : undefined;
  if (targetedLeg !== undefined && frontKick === undefined) {
    const leg = targetedLeg, root = rotate({ x: actor.footTarget!.x - x, y: actor.footTarget!.y - y }, -actor.angle);
    feet[leg] = pointMix(feet[leg], { x: root.x / (scale * facing), y: root.y / scale + 2 }, clamp(actor.footStrength ?? 1));
  }
  // The horizontal carried body already has one depth projection. Applying
  // flight yaw as a second compression made the torso and limbs paper thin.
  const yaw = carrying || sliding || slideRise || superman || spin || released && releaseWeight > 0 ? 0 : actor.yaw ?? 0, turnWidth = .28 + Math.abs(Math.cos(yaw)) * .72;
  const front = spin ? Math.sin(spin.orbit + .001) >= 0 : released && releaseWeight > 0 ? released.snapshot.front : Math.cos(yaw) >= 0;
  const hipOffsets = [-4.5, 4.5].map(offset => ({ x: offset * Math.cos(yaw), y: offset * Math.sin(yaw) * .42 }));
  if (!air) {
    // A turn takes a short replacement step before a heel can pull the pelvis down.
    feet = feet.map((foot, leg) => {
      if (leg === targetedLeg) return foot;
      const memory = state.feet![leg];
      const reach = Math.hypot(foot.x - hip.x - hipOffsets[leg].x, foot.y - hip.y - hipOffsets[leg].y);
      if (!reset && actor.pivotTurn === undefined && !memory.replant && !memory.swinging && reach > 20.7) {
        memory.replant = { at: clock, from: { ...memory.ground }, to: { x: x + facing * (leg ? 4 : -4) * scale + actor.velocityX * .135, y: y + actor.velocityY * .135 } };
        memory.to = { ...memory.replant.to };
      }
      if (!memory.replant) return foot;
      const p = clamp((clock - memory.replant.at) / 135);
      memory.ground = pointMix(memory.replant.from, memory.replant.to, ease(p));
      memory.lift = Math.sin(p * Math.PI) * 3.2; memory.swinging = true;
      if (p >= 1) {
        const local = { x: (memory.ground.x - x) / (scale * facing), y: (memory.ground.y - y) / scale };
        if (Math.hypot(local.x - hip.x - hipOffsets[leg].x, local.y - hip.y - hipOffsets[leg].y) > 20.7) {
          // A second direction change during the step needs another landing, not a deep squat.
          memory.replant = { at: clock, from: { ...memory.ground }, to: { x: x + facing * (leg ? 4 : -4) * scale + actor.velocityX * .135, y: y + actor.velocityY * .135 } };
          memory.to = { ...memory.replant.to };
        } else { memory.anchor = { ...memory.ground }; memory.to = { ...memory.ground }; memory.swinging = false; memory.lift = 0; memory.replant = undefined; }
      }
      return { x: (memory.ground.x - x) / (scale * facing), y: (memory.ground.y - y) / scale - memory.lift };
    }) as [Point, Point];
    // Only a supporting heel fixes the pelvis. The other leg is free to take its step.
    const support = feet.map((_, leg) => leg).filter(leg => leg !== targetedLeg && !state.feet![leg].swinging && state.feet![leg].lift < .05);
    const reach = 21.7;
    const lowX = Math.max(-Infinity, ...support.map(leg => feet[leg].x - hipOffsets[leg].x - reach));
    const highX = Math.min(Infinity, ...support.map(leg => feet[leg].x - hipOffsets[leg].x + reach));
    const follow = reset ? 1 : 1 - Math.exp(-delta / 110);
    hip.x = Math.max(lowX, Math.min(highX, mix(state.supportHip?.x ?? hip.x, hip.x, follow)));
    const lowestHip = Math.max(-Infinity, ...support.map(leg => feet[leg].y - hipOffsets[leg].y - Math.sqrt(Math.max(0, reach ** 2 - (feet[leg].x - hip.x - hipOffsets[leg].x) ** 2))));
    hip.y = Math.max(lowestHip, mix(state.supportHip?.y ?? hip.y, hip.y, follow));
  }
  if (plantedLanding) {
    // A landing has two support soles, even while the slam rig unfolds into
    // its standing perspective. Move the pelvis into reach before solving
    // the knees; extending each foot along a different leg ray lifted one
    // sole after floor normalization chose the other as its lowest point.
    const reach = 21.7;
    const lowX = Math.max(...feet.map((foot, leg) => foot.x - hipOffsets[leg].x - reach));
    const highX = Math.min(...feet.map((foot, leg) => foot.x - hipOffsets[leg].x + reach));
    hip.x = Math.max(lowX, Math.min(highX, hip.x));
    hip.y = Math.max(hip.y, ...feet.map((foot, leg) => foot.y - hipOffsets[leg].y - Math.sqrt(Math.max(0, reach ** 2 - (foot.x - hip.x - hipOffsets[leg].x) ** 2))));
  }
  state.supportHip = { ...hip };
  const hips = hipOffsets.map(offset => ({ x: hip.x + offset.x, y: hip.y + offset.y }));
  if (frontKick !== undefined) {
    const leg = targetedLeg!, rest = { ...feet[leg] }, chamber = { x: hips[leg].x + 6, y: hips[leg].y + 2 };
    let contact = { x: hips[leg].x + 20.5, y: hips[leg].y + 5 };
    if (actor.footTarget) {
      const root = rotate({ x: actor.footTarget.x - x, y: actor.footTarget.y - (y - 2 * scale) }, -actor.angle);
      contact = { x: root.x / (scale * facing), y: root.y / scale };
    }
    feet[leg] = frontKick < .4 ? pointMix(rest, chamber, ease(frontKick / .4)) : frontKick < .62 ? pointMix(chamber, contact, ease((frontKick - .4) / .22)) : frontKick < .78 ? pointMix(contact, chamber, ease((frontKick - .62) / .16)) : pointMix(chamber, rest, ease((frontKick - .78) / .22));
  }
  if (slam && !plantedLanding && slump > 0 && slump < 1) feet = feet.map((foot, leg) => {
    const length = Math.hypot(foot.x - hips[leg].x, foot.y - hips[leg].y);
    const extension = Math.sin(Math.PI * slump), reach = mix(length, 22, extension);
    return { x: hips[leg].x + (foot.x - hips[leg].x) / length * reach, y: hips[leg].y + (foot.y - hips[leg].y) / length * reach };
  }) as [Point, Point];
  feet = feet.map((foot, leg) => air || leg === targetedLeg || state.feet![leg].swinging || state.feet![leg].lift > .05 ? reachable(hips[leg], foot, slam ? 22 : carrying ? 21.98 : 21.8) : foot) as [Point, Point];
  if (sliding) feet.forEach((foot, leg) => {
    const memory = state.feet![leg], ground = { x: x + facing * scale * foot.x, y };
    memory.ground = ground; memory.anchor = { ...ground }; memory.from = { ...ground }; memory.to = { ...ground };
    memory.lift = Math.max(0, -foot.y); memory.swinging = false; memory.settleAt = -Infinity; memory.replant = undefined;
  });
  state.localFeet = feet;
  const depthStride = moving ? ease((Math.abs(actor.velocityY) / Math.max(1, speed) - .18) / .55) : 1;
  state.depthStride = reset ? depthStride : mix(state.depthStride ?? depthStride, depthStride, 1 - Math.exp(-delta / 160));
  const knees = feet.map((foot, leg) => frontKick !== undefined && leg === targetedLeg ? pointMix(legKnee(hips[leg], foot, state.depthStride!, yaw), knee(hips[leg], foot, 11, 11, 1), ease(frontKick / .4) * (1 - ease((frontKick - .78) / .22))) : slam ? pointMix(legKnee(hips[leg], foot, 1, yaw), extendingKnee(hips[leg], foot, 1), tuck) : air || sliding ? knee(hips[leg], foot, 11, 11, 1) : legKnee(hips[leg], foot, state.depthStride!, yaw));
  const footAngles = feet.map((foot, leg) => slam ? (Math.atan2(foot.y - knees[leg].y, foot.x - knees[leg].x) - Math.PI / 2) * tuck : 0);
  const footPoint = (leg: number, point: Point) => { const p = rotate(point, footAngles[leg]); return { x: feet[leg].x + p.x, y: feet[leg].y + p.y }; };
  const bodyWidth = 18 + index % 3, shoulderWidth = bodyWidth * .43;
  // A grip turns the chest toward the opponent, bringing the far shoulder forward.
  const shoulderContact = spin || released && releaseWeight > 0 ? 0 : jointOverhead ? motion.contact * (1 - clamp(actor.overheadRaise ?? 1)) : motion.contact;
  const shoulders = [{ x: mix(-shoulderWidth, 3.5, shoulderContact) * turnWidth, y: -20 - motion.shoulderLift }, { x: shoulderWidth * turnWidth, y: -20 - motion.shoulderLift }];
  let hands = [{ x: motion.backX, y: motion.backY }, { x: motion.frontX, y: motion.frontY }];
  if (actor.gripTarget) {
    const secondary = actor.secondaryGripTarget ?? { x: actor.gripTarget.x - facing * scale * 7, y: actor.gripTarget.y + scale * 2 };
    const follow = reset || actor.gripLocked ? 1 : 1 - Math.exp(-delta / 65);
    state.grip = state.grip ? pointMix(state.grip, actor.gripTarget, follow) : { ...actor.gripTarget };
    state.secondaryGrip = state.secondaryGrip ? pointMix(state.secondaryGrip, secondary, follow) : { ...secondary };
  }
  if (!spin && (!air || pose === 'held') && state.grip && state.secondaryGrip && motion.contact > .001) {
    const localHand = (point: Point) => {
      const root = rotate({ x: point.x - x, y: point.y - (y - 2 * scale) }, -actor.angle);
      return rotate({ x: root.x / (scale * facing) - hip.x, y: root.y / scale - hip.y }, -lean);
    };
    hands = [pose === 'held' && actor.gripMode === 'wrist' ? hands[0] : pointMix(hands[0], localHand(state.secondaryGrip), motion.contact), pointMix(hands[1], localHand(state.grip), motion.contact)];
  }
  if (spin) hands = [{ x: mix(10, -5, spinWeight), y: mix(-18.5, -37.5, spinWeight) }, { x: mix(20, 5, spinWeight), y: mix(-18.5, -37.5, spinWeight) }];
  if (released) hands = hands.map((hand, arm) => pointMix(hand, released.snapshot.hands[arm], releaseWeight));
  const overheadReach = pose === 'overhead' ? clamp(actor.overheadRaise ?? 1) : pose === 'scoop' ? ease((clamp(actor.scoopStroke ?? phase) - .18) / .54) : 0;
  const upperArm = mix(11, 14, overheadReach), lowerArm = mix(10.5, 14, overheadReach), armReach = mix(21.3, 27.8, overheadReach);
  hands = hands.map((hand, arm) => reachable(shoulders[arm], hand, armReach, Math.abs(upperArm - lowerArm) + .02));
  if (pose === 'clap' && motion.contact < .03 && target.frontX - target.backX < 5.01 && hands[1].x - hands[0].x < 5.4) {
    // Resolve palm contact at the chest; two hands stay distinct and share one height.
    const center = { x: (hands[0].x + hands[1].x) / 2, y: (hands[0].y + hands[1].y) / 2 };
    hands = [{ x: center.x - 2.5, y: center.y }, { x: center.x + 2.5, y: center.y }];
  }
  // Keep applause in front of the chest and raised victory arms outside the head.
  const elbows = hands.map((hand, arm) => {
    if (slam) {
      // A body being dropped protects its chest with tucked elbows. Letting
      // either joint bend outside the shoulder made that arm hit the floor
      // first when the slam direction reversed, holding the back above it.
      return knee(shoulders[arm], hand, upperArm, lowerArm, arm === 0 ? 1 : -1);
    }
    if (!spin && actor.gripMode === 'wrist' && actor.pivotTurn !== undefined) {
      const low = knee(shoulders[arm], hand, 11, 10.5, 1), high = knee(shoulders[arm], hand, 11, 10.5, -1);
      return low.y > high.y ? low : high;
    }
    if (jointOverhead || pose === 'drag' && actor.gripMode === 'ankle') return knee(shoulders[arm], hand, upperArm, lowerArm, arm === 0 ? 1 : -1);
    return knee(shoulders[arm], hand, upperArm, lowerArm, -Math.cos(Math.PI * (arm === 1 ? motion.clapTurn : motion.cheerTurn)));
  });
  if (carrying) {
    const armX = Math.min(4.6, bodyWidth * .43 * .58);
    hands = shoulders.map((shoulder, arm) => {
      const unfolding = carriedArm(shoulder, arm, stretch, armX);
      elbows[arm] = unfolding.elbow;
      return unfolding.hand;
    });
  }
  if (pose === 'elbow' && actor.elbowTarget && (actor.elbowStrength ?? 0) > 0) {
    const strength = clamp(actor.elbowStrength ?? 0);
    const root = rotate({ x: actor.elbowTarget.x - x, y: actor.elbowTarget.y - (y - 2 * scale) }, -actor.angle);
    const localTarget = rotate({ x: root.x / (scale * facing) - hip.x, y: root.y / scale - hip.y }, -lean);
    const strike = reachable(shoulders[1], localTarget, upperArm);
    elbows[1] = pointMix(elbows[1], strike, strength);
    // Fold the forearm back from the contact so the elbow, rather than the
    // palm, hits the head. Both connected arm sections keep their own length.
    const dx = hands[1].x - elbows[1].x, dy = hands[1].y - elbows[1].y;
    const direction = pointMix({ x: dx, y: dy }, { x: -lowerArm * .38, y: -lowerArm * .925 }, strength);
    const length = Math.max(.001, Math.hypot(direction.x, direction.y));
    hands[1] = { x: elbows[1].x + direction.x / length * lowerArm, y: elbows[1].y + direction.y / length * lowerArm };
  }
  if (actor.linkedHandTarget && (actor.linkedArmStrength ?? 1) > 0) {
    const arm = actor.linkedArm ?? 1, strength = clamp(actor.linkedArmStrength ?? 1);
    const root = rotate({ x: actor.linkedHandTarget.x - x, y: actor.linkedHandTarget.y - (y - 2 * scale) }, -actor.angle);
    const localTarget = rotate({ x: root.x / (scale * facing) - hip.x, y: root.y / scale - hip.y }, -lean);
    hands[arm] = reachable(shoulders[arm], pointMix(hands[arm], localTarget, strength), upperArm + lowerArm - .02, Math.abs(upperArm - lowerArm) + .02);
    elbows[arm] = knee(shoulders[arm], hands[arm], upperArm, lowerArm, arm ? -1 : 1);
  }
  if (superman && actor.punchTarget && (actor.punchStrength ?? 0) > 0) {
    const arm = actor.punchArm ?? 1, strength = clamp(actor.punchStrength ?? 0);
    const root = rotate({ x: actor.punchTarget.x - x, y: actor.punchTarget.y - (y - 2 * scale) }, -actor.angle);
    const localTarget = rotate({ x: root.x / (scale * facing) - hip.x, y: root.y / scale - hip.y }, -lean);
    hands[arm] = reachable(shoulders[arm], pointMix(hands[arm], localTarget, strength), upperArm + lowerArm - .02, Math.abs(upperArm - lowerArm) + .02);
    elbows[arm] = knee(shoulders[arm], hands[arm], upperArm, lowerArm, -1);
  }
  const bodyPoint = (point: Point): Point => { const p = rotate(point, lean); return { x: hip.x + p.x, y: hip.y + p.y }; };
  const torsoPoint = (point: Point): Point => bodyPoint({ x: point.x * turnWidth, y: point.y });
  const shorts = hips.map((origin, leg) => {
    const length = Math.max(.1, Math.hypot(knees[leg].x - origin.x, knees[leg].y - origin.y));
    const direction = { x: (knees[leg].x - origin.x) / length, y: (knees[leg].y - origin.y) / length };
    const normal = { x: direction.y, y: -direction.x };
    const top = { x: origin.x - direction.x * 1.4, y: origin.y - direction.y * 1.4 };
    const hem = { x: origin.x + direction.x * 6.4, y: origin.y + direction.y * 6.4 };
    const edge = (point: Point, width: number, side: number) => ({ x: point.x + normal.x * width * side, y: point.y + normal.y * width * side });
    return { direction, normal, points: [edge(top, 4.3, -1), edge(top, 4.3, 1), edge(hem, 3.8, 1), edge(hem, 3.8, -1)] };
  });
  const waist = [torsoPoint({ x: -bodyWidth / 2, y: -4.3 }), torsoPoint({ x: bodyWidth / 2, y: -4.3 }), torsoPoint({ x: bodyWidth / 2, y: -1.7 }), torsoPoint({ x: -bodyWidth / 2, y: -1.7 })];
  const crotch = { x: hip.x, y: hip.y + 4 };
  const yoke = [waist[0], waist[1], waist[2], { x: hip.x + 8.6 * turnWidth, y: hip.y + 3 }, crotch, { x: hip.x - 8.6 * turnWidth, y: hip.y + 3 }, waist[3]];
  state.skeleton = { hips, knees, feet, shorts: shorts.map(panel => panel.points), pelvis: yoke };
  const headWidth = [14, 15, 14, 16][personality], headY = -33 - index % 2 + overheadReach * 5;
  let rootX = x, rootY = y - 2 * scale, pivotY = 0;
  if (air && pose !== 'sidekick' && pose !== 'held' && !superman) {
    pivotY = -24;
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
      boundRect({ x: -3, y: -1 }, 9, 3, point => footPoint(leg, point));
    });
    bounds.push(...shorts.flatMap(panel => panel.points), ...waist, ...yoke);
    boundRect({ x: -headWidth / 2 - 1.5, y: -12 }, headWidth + 3, 21, point => {
      const p = rotate(point, motion.head * Math.PI / 180); return torsoPoint({ x: p.x, y: headY + p.y });
    });
    hands.forEach((hand, arm) => {
      boundSegment(shoulders[arm], elbows[arm], 5.6, bodyPoint); boundSegment(elbows[arm], hand, 4.9, bodyPoint);
      boundRect({ x: elbows[arm].x - 2.4, y: elbows[arm].y - 2.4 }, 4.8, 4.8, bodyPoint);
      boundRect({ x: hand.x - 2.5, y: hand.y - 1.7 }, 5, 4, bodyPoint);
    });
    boundRect({ x: -bodyWidth / 2 - 1, y: -23 }, bodyWidth + 2, 28, torsoPoint);
    const lowest = Math.max(...bounds.map(point => Math.sin(actor.angle) * point.x * facing + Math.cos(actor.angle) * (point.y - pivotY)));
    rootY = y - lowest * scale;
    // A released wrist starts in the same transform as the held body, then eases
    // toward the floor-aware flight pivot before landing. The scene supplies a
    // pure phase weight, so pause and direct seek produce the same geometry.
    const suspension = clamp(actor.suspension ?? 0);
    rootX = mix(x, x - Math.sin(actor.angle) * pivotY * scale, suspension);
    rootY = mix(rootY, y - 2 * scale + Math.cos(actor.angle) * pivotY * scale, suspension);
  }
  let matrix: Matrix = [Math.cos(actor.angle) * scale * facing, Math.sin(actor.angle) * scale * facing, -Math.sin(actor.angle) * scale, Math.cos(actor.angle) * scale, rootX + Math.sin(actor.angle) * scale * pivotY, rootY - Math.cos(actor.angle) * scale * pivotY];
  if (spin) {
    const center = pointMix(spin.grips[0], spin.grips[1], .5), across = { x: (spin.grips[1].x - spin.grips[0].x) / 10, y: (spin.grips[1].y - spin.grips[0].y) / 10 };
    const outward = spinAxes(spin.orbit, spin.flatness, facing, spinWeight).outward;
    const down = { x: outward.x * scale, y: outward.y * scale }, c = Math.cos(lean), s = Math.sin(lean);
    matrix = [across.x * c - down.x * s, across.y * c - down.y * s, across.x * s + down.x * c, across.y * s + down.y * c, 0, 0];
    const handCenter = pointMix(hands[0], hands[1], .5);
    matrix[4] = center.x - matrix[0] * hip.x - matrix[2] * hip.y - across.x * handCenter.x - down.x * handCenter.y;
    matrix[5] = center.y - matrix[1] * hip.x - matrix[3] * hip.y - across.y * handCenter.x - down.y * handCenter.y;
  } else if (released && releaseWeight > 0) {
    const source = released.snapshot.matrix, dx = x - released.snapshot.origin.x, dy = y - released.snapshot.origin.y;
    matrix = matrix.map((value, index) => mix(value, source[index] + (index === 4 ? dx : index === 5 ? dy : 0), releaseWeight)) as Matrix;
  }
  const worldPoint = (point: Point): Point => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
  const projectedOrigin = spin || released && releaseWeight > 0 ? worldPoint({ x: 0, y: 0 }) : { x, y: y - 2 * scale };
  const origin = { x: projectedOrigin.x, y: projectedOrigin.y + 2 * scale };
  ctx.save(); ctx.globalAlpha = actor.alpha;
  if (pose !== 'airborne') { ctx.fillStyle = '#25302d40'; ctx.beginPath(); ctx.ellipse(origin.x, (actor.depthY ?? y) + 2, 16 * scale, 3.5 * scale, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.transform?.(...matrix);
  const headTop = rotate({ x: 0, y: -12 }, motion.head * Math.PI / 180);
  state.contactPoints = { origin, head: worldPoint(torsoPoint({ x: headTop.x, y: headY + headTop.y })), shoulders: shoulders.map(shoulder => worldPoint(bodyPoint(shoulder))), elbows: elbows.map(elbow => worldPoint(bodyPoint(elbow))), hands: hands.map(hand => worldPoint(bodyPoint(hand))), waist: worldPoint(torsoPoint({ x: 0, y: -4 })), feet: feet.map(worldPoint) };
  if (spin) state.spinSnapshot = { origin, matrix: [...matrix], motion: { ...motion }, hip: { ...hip }, feet: feet.map(foot => ({ ...foot })) as [Point, Point], hands: hands.map(hand => ({ ...hand })), orbit: spin.orbit, front, phase, facing };
  const rect = (px: number, py: number, width: number, height: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(px, py, width, height); };
  const leg = (back: boolean, lowerOnly = false) => {
    const index = back ? 0 : 1, ankle = feet[index], joint = knees[index], origin = hips[index];
    if (!lowerOnly) segment(ctx, origin, joint, 6.5, palette);
    segment(ctx, joint, ankle, 5.5, palette);
    rect(joint.x - 2.8, joint.y - 2.8, 5.6, 5.6, palette.base);
    rect(joint.x - 1.5, joint.y - 1.8, 2.2, 1.2, palette.light); rect(joint.x + 1, joint.y + .8, 1.4, 1.4, palette.shade);
    ctx.save(); ctx.translate(ankle.x, ankle.y); ctx.rotate(footAngles[index]);
    rect(-3, -1, 9, 3, palette.base); rect(-1.8, -.5, 2.8, 1, palette.light); rect(-3, 1.3, 9, .7, palette.shade); ctx.restore();
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
  ctx.save(); ctx.scale(turnWidth, 1);
  rect(-bodyWidth / 2, -23, bodyWidth, 23, palette.base);
  rect(-bodyWidth / 2 + 2, -21, 5, 2, palette.light); rect(-bodyWidth / 2 + 3, -15, 3, 2, palette.light);
  rect(bodyWidth / 2 - 3, -20, 3, 5, palette.shade); rect(bodyWidth / 2 - 4, -10, 4, 4, palette.shade);
  if (front) rect(-3, -14, 6, 1, palette.shade);
  else { rect(-bodyWidth / 2 + 3, -18, 3, 5, palette.shade); rect(bodyWidth / 2 - 6, -18, 3, 5, palette.shade); rect(-.6, -17, 1.2, 9, palette.shade); }
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
  if (!front) rect(-headWidth / 2, -7, headWidth, 11, hair);
  const blink = (clock + index * 917) % (3400 + personality * 230) > 3280 + personality * 230;
  const eyeHeight = pose === 'stunned' || carrying ? .7 : mix(slam ? mix(1.8, 2.7, tuck) : blink ? .7 : pose === 'airborne' ? 2.7 : 1.8, .7, slump);
  if (front) {
    rect(-3.5, -1, 1.8, eyeHeight, '#172b37'); rect(3, -1, 1.8, eyeHeight, '#172b37');
    const intense = ['push', 'brace', 'lift', 'throw'].includes(pose);
    rect(-4.5, intense ? -3 : -3.5, 3, .8, hair); rect(2.5, intense ? -3.5 : -3, 3, .8, hair);
    rect(-1, 4, 2.7, motion.mouth, palette.deep);
    if (pose === 'cheer' || pose === 'clap') { rect(-2, 3.3, .8, 1.8, palette.deep); rect(1.8, 3.3, .8, 1.8, palette.deep); }
  }
  ctx.restore(); ctx.restore(); ctx.restore();
  const fabricShade = shade(candidate.color, .72), fabricLight = shade(candidate.color, 1.1);
  const polygon = (points: Point[], color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
    points.slice(1).forEach(point => ctx.lineTo(Math.round(point.x), Math.round(point.y))); ctx.closePath(); ctx.fill();
  };
  // Both cuffs follow the thighs; the pelvic yoke joins them without a solid crotch block.
  shorts.forEach(panel => {
    polygon(panel.points, candidate.color);
    const [a, b] = panel.points.slice(2), direction = panel.direction;
    polygon([a, b, { x: b.x - direction.x * .9, y: b.y - direction.y * .9 }, { x: a.x - direction.x * .9, y: a.y - direction.y * .9 }], fabricShade);
  });
  polygon(yoke, candidate.color); polygon(waist, fabricShade);
  polygon([torsoPoint({ x: 1, y: -3.7 }), torsoPoint({ x: 3.1, y: -3.7 }), torsoPoint({ x: 3.1, y: -2.4 }), torsoPoint({ x: 1, y: -2.4 })], fabricLight);
  if (slam) leg(false, true);
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean);
  if (motion.applause > .01) { ctx.save(); ctx.globalAlpha = actor.alpha * motion.applause; arm(true, true); ctx.restore(); }
  arm(false); ctx.restore(); ctx.restore();
  state.clock = clock; state.signature = signature; state.epoch = actor.motionEpoch; state.facing = facing; state.distance = actor.gaitDistance; state.moving = moving; state.airborne = air; state.pose = pose;
}

export function drawArenaName(ctx: CanvasRenderingContext2D, actor: ArenaActor) {
  const { candidate } = actor;
  const origin = actor.spinSuspension || actor.spinRelease && actor.spinRelease.weight > 0 ? actor.animation?.contactPoints?.origin : undefined;
  const x = origin?.x ?? actor.x, y = (origin?.y ?? actor.y) + 7;
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
