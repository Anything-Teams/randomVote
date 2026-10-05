import type { Candidate } from '../election';
import { arenaAnkleSwingCasterProjection, arenaAnkleSwingProjection } from '../arenaAnkleSwing';
import { arenaAnkleFootHold } from '../arenaAnkleFootHold';

export type ArenaPose = 'idle' | 'guard' | 'walk' | 'run' | 'slide' | 'grapple' | 'brace' | 'push' | 'dodge' | 'lift' | 'throw' | 'pairlift' | 'overhead' | 'scoop' | 'elbow' | 'superman' | 'dropkick' | 'bulldog' | 'backbodydrop' | 'spinebuster' | 'powerbomb' | 'scoopslam' | 'airborne' | 'held' | 'carried' | 'roll' | 'land' | 'recover' | 'cheer' | 'clap' | 'bow' | 'trip' | 'suplex' | 'drag' | 'sidekick' | 'stunned';
type Point = { x: number; y: number };
type Motion = { crouch: number; lean: number; hipX: number; head: number; mouth: number; backX: number; backY: number; frontX: number; frontY: number; spread: number; contact: number; shoulderLift: number; clapTurn: number; cheerTurn: number; applause: number };
export type ArenaCarryStance = Pick<Motion, 'crouch' | 'lean' | 'hipX' | 'head' | 'contact' | 'shoulderLift'>;
type Matrix = [number, number, number, number, number, number];
export type ArenaSpinSuspension = { orbit: number; flatness: number; grips: [Point, Point]; weight?: number; gripLimb?: 'hands' | 'feet'; gripFoot?: 0 | 1; gripBoth?: boolean; planar?: boolean };
export type ArenaSlamProgress = { tuck: number; slump: number };
export type ArenaSpinSnapshot = { origin: Point; matrix: Matrix; motion: Motion; hip: Point; feet: [Point, Point]; hands: Point[]; shoulders?: Point[]; elbows?: Point[]; hips?: Point[]; knees?: Point[]; footAngles?: number[]; orbit: number; front: boolean; phase: number; facing: number; planar?: boolean };
type LandingArms = { at: number; root: Point; shoulders: Point[]; elbows: Point[]; hands: Point[]; angles: [number, number][] };
type FootMemory = { anchor: Point; from: Point; to: Point; ground: Point; lift: number; swinging: boolean; swingStart: number; swingStrength?: number; settleAt: number; settleFrom: Point; settleTo: Point; settleLift: number; replant?: { at: number; from: Point; to: Point } };
export type ArenaFighterAnimation = { ankleRimAngles?: [number, number][]; clock: number | null; signature: string; epoch?: number | string; facing?: number; supportHip?: Point; motion: Motion | null; gait: number; distance: number; moving: boolean; airborne: boolean; feet: [FootMemory, FootMemory] | null; localFeet: [Point, Point] | null; grip?: Point; secondaryGrip?: Point; headGripArms?: { free: [number, number]; held: [number, number]; bend: number }[]; clotheslineAngles?: { free: [number, number]; strike: [number, number] }; supportedGripArms?: { free: [number, number]; held: [number, number]; bend: number; releasing?: boolean; strength?: number }[]; pose?: ArenaPose; landingArms?: LandingArms; ankleReach?: LandingArms; anklePivotArms?: LandingArms; scoopAnkleMotion?: Motion; scoopAnkleReversed?: boolean; pairReach?: { arms: LandingArms; motion: Motion }; carrierReleasing?: boolean; carrierReleaseArcs?: { follow: [number, number]; rest: [number, number] }[]; rig?: { motion: Motion; hip: Point; feet: [Point, Point]; shoulders: Point[]; elbows: Point[]; hands: Point[] }; slamStart?: { motion: Motion; hip: Point; feet: [Point, Point]; shoulders: Point[]; elbows: Point[]; hands: Point[] }; carryStart?: { motion: Motion; hip: Point; feet: [Point, Point]; shoulders: Point[]; elbows: Point[]; hands: Point[] }; slideMotion?: Motion; slideFeet?: [Point, Point]; supermanPlant?: { motion: Motion; feet: [Point, Point] }; supermanMotion?: Motion; supermanFeet?: [Point, Point]; dropkickMotion?: Motion; dropkickFeet?: [Point, Point]; depthStride?: number; pairLegDepth?: number; pivotStep?: number; spinSnapshot?: ArenaSpinSnapshot; contactPoints?: { origin: Point; head: Point; headSides: [Point, Point]; back: Point; shoulders: Point[]; elbows: Point[]; hands: Point[]; waist: Point; feet: Point[] }; skeleton?: { hips: Point[]; knees: Point[]; feet: Point[]; shorts: Point[][]; pelvis: Point[]; footAngles: number[] } };
export type ArenaActor = { candidate: Candidate; index: number; x: number; y: number; depthY?: number; scale: number; facing: number; pose: ArenaPose; angle: number; yaw?: number; pivotTurn?: number; suspension?: number; slamProgress?: ArenaSlamProgress; slamEntry?: boolean; jumpTuck?: number; carryStretch?: number; carrySupport?: 'shoulder' | 'cradle'; carryEntry?: boolean; carryFlight?: number; overheadRaise?: number; pairCarry?: boolean; pairReach?: number; pairLoad?: number; pairLift?: number; pairBackload?: number; pairHeave?: number; carrierDrive?: number; scoopStroke?: number; frontKick?: number; slideProgress?: number; supermanRun?: boolean; supermanLoad?: number; supermanProgress?: number; punchTarget?: Point; punchStrength?: number; punchArm?: 0 | 1; dropkickProgress?: number; footTargets?: [Point, Point]; feetStrength?: number; bulldogProgress?: number; bulldogHeadlock?: boolean; backBodyProgress?: number; backBodyRaise?: number; spinebusterProgress?: number; spineLoad?: number; spineLift?: number; spineDown?: number; spineCarry?: boolean; powerbombVictim?: boolean; powerbombLoad?: number; powerbombLift?: number; powerbombDown?: number; eyesClosed?: boolean; slamImpact?: number; scoopSlamProgress?: number; scoopLoad?: number; scoopLift?: number; scoopTurn?: number; scoopDown?: number; scoopVictim?: boolean; scoopRecover?: number; ankleApproach?: number; ankleThrowProgress?: number; ankleSpinRaise?: number; ankleRimToss?: boolean; carrierRelease?: { hands: [Point, Point]; elbows: [Point, Point]; shoulders: [Point, Point]; progress: number; direction: number; followThrough?: Point; stance?: ArenaCarryStance; sourceAngle?: number; sourceLean?: number }; linkedArm?: 0 | 1; linkedHandTarget?: Point; linkedArmStrength?: number; clotheslineArm?: 0 | 1; clotheslineTarget?: Point; clotheslineStrength?: number; clotheslineInner?: boolean; spinSuspension?: ArenaSpinSuspension; captureRelease?: boolean; spinRelease?: { snapshot: ArenaSpinSnapshot; weight: number }; footTarget?: Point; footStrength?: number; kickLeg?: number; elbowTarget?: Point; elbowStrength?: number; alpha: number; velocityX: number; velocityY: number; gaitDistance: number; phase: number; power?: number; grappleEffort?: number; grappleLiftPreparation?: number; chargePreparation?: number; chargeStrength?: number; gripMode?: 'wrist' | 'waist' | 'ankle' | 'shoulder' | 'head' | 'cradle'; gripLocked?: boolean; gripStrength?: number; gripTarget?: Point; secondaryGripTarget?: Point; animation?: ArenaFighterAnimation; motionEpoch?: number | string; motionImmediate?: boolean };

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
function carriedArm(shoulder: Point, arm: number, stretch: number, armX: number, cradle = false): { elbow: Point; hand: Point } {
  const lowShoulder = { x: shoulder.x, y: -20 }, highShoulder = { x: shoulder.x, y: -26 };
  const lowHand = cradle ? { x: arm ? 11 : -6, y: arm ? -22 : -16 } : { x: arm ? 12 : -11, y: -2 };
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
  const foreshorten = mix(1, .10, depth);
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

/** The two ankle slots keep their material sides as the caster turns with them. */
function ankleCasterPlane(actor: ArenaActor, turn = actor.yaw ?? actor.pivotTurn ?? 0) {
  if (actor.pivotTurn === undefined || actor.gripMode !== 'ankle' || actor.ankleThrowProgress === undefined) return undefined;
  const recover = actor.carrierRelease ? ease((actor.carrierRelease.progress - .24) / .76) : 0;
  const weight = clamp(actor.ankleThrowProgress) * (1 - recover);
  const projection = arenaAnkleSwingCasterProjection(turn - Math.PI / 2);
  return {
    across: { x: -projection.across.x, y: mix(Math.sin(turn) * .42, -actor.facing * projection.across.y, weight) },
    faceDirection: mix(Math.cos(turn), projection.faceDirection, weight),
  };
}

/** Stance feet stay in world space; changing a pose cannot restart the stride. */
function groundedFeet(actor: ArenaActor, state: ArenaFighterAnimation, clock: number, moving: boolean, reset: boolean, spread: number): [Point, Point] {
  const { x, y, facing, scale, index } = actor;
  const scoopLoad = actor.pose === 'scoopslam';
  const powerLoad = actor.pose === 'powerbomb';
  const loaded = scoopLoad || powerLoad || actor.pose === 'pairlift' || actor.pose === 'drag' && actor.gripMode === 'ankle' || actor.ankleThrowProgress !== undefined;
  const comfortable = (leg: number, yaw = actor.yaw ?? 0): Point => {
    const across = ankleCasterPlane(actor, yaw)?.across ?? { x: Math.cos(yaw), y: Math.sin(yaw) * .42 };
    return { x: x + facing * (leg ? 6 : -5) * spread * scale * across.x, y: y + (leg ? 6 : -5) * spread * scale * across.y };
  };
  if (state.airborne && !reset && state.localFeet) {
    state.feet = state.localFeet.map(foot => {
      const memory = makeFoot({ x: x + foot.x * facing * scale, y });
      memory.lift = Math.max(0, -foot.y);
      return memory;
    }) as [FootMemory, FootMemory];
  }
  state.feet ??= [makeFoot(comfortable(0)), makeFoot(comfortable(1))];
  // The torso can start turning during a pickup step. Finish that real heel
  // landing before pivot beats take its foot memory, or the old step can
  // overwrite the new orbit and return the sole to its earlier position.
  if (actor.pivotTurn !== undefined && Math.abs(actor.pivotTurn) > 0 && !state.feet.some(foot => foot.replant)) {
    const direction = Math.sign(actor.pivotTurn), steps = Math.abs(actor.pivotTurn) / (Math.PI * 2) * 8, step = Math.floor(steps), phase = steps - step;
    const leg = step % 2;
    if (state.pivotStep !== step) {
      // Commit the actual landing point; crossing a beat cannot snap a heel to its old target.
      state.feet.forEach(foot => {
        foot.anchor = { ...foot.ground }; foot.swinging = false; foot.lift = 0;
        foot.replant = undefined; foot.settleAt = -Infinity;
      });
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
  // A clipped running step must finish before the body passes its landing
  // point; a longer cycle lowered the pelvis to chase the late support heel.
  // Shorter strides into depth keep both planted heels within leg reach.
  const vertical = Math.abs(vy), cycleLength = mix(mix(30, 22 + charge, running), 13.2, vertical) * (1 + (index % 3 - 1) * .025);
  const distance = reset ? 0 : Math.max(0, actor.gaitDistance - state.distance);
  // Starting halfway through a swing gave the first step only a few frames.
  // Begin with both soles down so acceleration has a full step to unfold.
  if (moving && !state.moving) {
    state.gait = .30;
    state.feet.forEach(foot => {
      // The next stride starts at the sole that actually reached the floor.
      // An earlier idle settling target must not return after a long drag.
      foot.anchor = { ...foot.ground }; foot.swinging = false;
      foot.settleAt = -Infinity; foot.replant = undefined;
    });
  }
  if (moving) state.gait += distance / Math.max(1, scale * cycleLength);
  const stance = mix(.62, .56, running);
  return state.feet.map((foot, leg) => {
    if (moving && !foot.replant) {
      const cycle = (state.gait + leg * .5) % 1;
      if (cycle >= stance) {
        if (!foot.swinging) {
          foot.swinging = true; foot.from = { ...foot.ground }; foot.swingStart = cycle;
          foot.swingStrength = Math.min(1, (1 - cycle) / (1 - stance));
          const ahead = Math.min(((1 - cycle) + stance / 2) * cycleLength * scale, running > .1 ? 12 * scale : Infinity);
          const lane = mix(3, 4.5, running);
          foot.to = { x: x + facing * (leg ? lane : -lane) * scale * Math.cos(actor.yaw ?? 0) + vx * ahead, y: y + vy * ahead };
        }
        const amount = clamp((cycle - foot.swingStart) / Math.max(.001, 1 - foot.swingStart));
        foot.ground = pointMix(foot.from, foot.to, ease(amount));
        foot.lift = Math.sin(amount * Math.PI) * mix(mix(3.6, 5.8 + charge * 1.4, running), mix(2.1, 3.4, running), vertical) * (foot.swingStrength ?? 1);
      } else {
        if (foot.swinging) { foot.anchor = { ...foot.to }; foot.swinging = false; }
        foot.ground = { ...foot.anchor }; foot.lift = 0;
      }
    } else if (!moving) {
      if (!foot.replant && (!loaded || foot.swinging || foot.lift > .05) && (state.moving || state.airborne || !reset && state.pose !== actor.pose && actor.pose === 'recover' && actor.slideProgress !== undefined && foot.lift > .05)) {
        foot.settleAt = clock + leg * (scoopLoad ? 20 : 40); foot.settleFrom = { ...foot.ground }; foot.settleTo = comfortable(leg); foot.settleLift = foot.lift; foot.swinging = false;
      }
      const amount = clamp((clock - foot.settleAt) / (scoopLoad ? 180 : 235));
      if (Number.isFinite(foot.settleAt)) {
        foot.ground = pointMix(foot.settleFrom, foot.settleTo, ease(amount));
        foot.lift = loaded ? foot.settleLift * (1 - ease(amount)) : Math.max(foot.settleLift * (1 - amount), Math.sin(amount * Math.PI) * 1.7);
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
  const free = sampleArenaFighterContacts({ ...actor, ...(actor.pose === 'pairlift' ? { animation: undefined, motionImmediate: true } : {}), gripTarget: undefined, secondaryGripTarget: undefined, gripStrength: 0 }, clock);
  const relative = (point: Point) => ({ x: point.x - actor.x, y: point.y - actor.y });
  const shoulders = sample.shoulders.map(relative), hands = free.hands.map(relative);
  const centers = shoulders.map((shoulder, arm) => ({ x: endpoints[1 - arm].x - shoulder.x, y: endpoints[1 - arm].y - shoulder.y }));
  const joint = actor.gripMode === 'shoulder' || actor.gripMode === 'ankle' || actor.gripMode === 'wrist';
  const radius = (joint ? 20.9 : mix(20.9, 27.3, raise)) * actor.scale;
  const midpoint = pointMix(endpoints[0], endpoints[1], .5), handMidpoint = pointMix(hands[0], hands[1], .5);
  let ground = preferredRoot ? { ...preferredRoot } : { x: midpoint.x - handMidpoint.x, y: midpoint.y - handMidpoint.y };
  if (actor.pose === 'pairlift') ground.y = midpoint.y - handMidpoint.y;
  // The intersection of the two reach disks is convex. Projecting the natural
  // low hand position into it keeps the pickup continuous as the hips rise.
  const frontLimit = actor.pose === 'pairlift' ? Math.min(...centers.map(center => center.x * actor.facing)) - actor.scale * 10 : Infinity;
  for (let pass = 0; pass < 64; pass++) {
    for (const center of centers) ground = reachable(center, ground, radius, joint ? .7 * actor.scale : .04 * actor.scale);
    // Shared pickups are supported in front of each torso. A preferred root
    // must never put a shoulder or ankle behind the lifter's extended elbow.
    if (actor.pose === 'pairlift' && ground.x * actor.facing > frontLimit) ground.x = frontLimit * actor.facing;
  }
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

/** Preserve the actual painted rig when any supported body enters free flight. */
export function arenaReleaseSnapshot(actor: ArenaActor, clock: number): ArenaSpinSnapshot {
  const animation = actor.animation ? structuredClone(actor.animation) : createArenaFighterAnimation();
  drawArenaFighter(contactContext, { ...actor, animation, captureRelease: true }, clock);
  if (!animation.spinSnapshot) throw new Error('A release snapshot requires a painted body');
  return structuredClone(animation.spinSnapshot);
}

/** One skin palette covers every bare body part; motion uses a small, connected skeleton. */
export function drawArenaFighter(ctx: CanvasRenderingContext2D, actor: ArenaActor, clock: number) {
  const { candidate, index, x, y, scale, facing, pose, phase } = actor;
  const spin = actor.spinSuspension, spinWeight = clamp(spin?.weight ?? (spin ? 1 : 0)), released = actor.spinRelease;
  const feetSpin = spin?.gripLimb === 'feet', caughtFoot = spin?.gripFoot ?? 1;
  const slam = actor.slamProgress, tuck = clamp(slam?.tuck ?? 0), slump = clamp(slam?.slump ?? 0);
  const plantedLanding = !!slam && pose === 'land' && Math.abs(actor.angle) < .001 && (actor.suspension ?? 0) === 0;
  const sliding = pose === 'slide', slideRise = pose === 'recover' && actor.slideProgress !== undefined;
  const superman = pose === 'superman', supermanProgress = clamp(actor.supermanProgress ?? phase);
  const dropkick = pose === 'dropkick', dropkickProgress = clamp(actor.dropkickProgress ?? phase);
  const bulldog = pose === 'bulldog';
  const jointOverhead = pose === 'overhead' && (actor.gripMode === 'wrist' || actor.gripMode === 'ankle' || actor.gripMode === 'shoulder');
  const anklePivot = actor.pivotTurn !== undefined && actor.gripMode === 'ankle' && actor.ankleThrowProgress !== undefined && !actor.carrierRelease;
  const ankleRimToss = !!actor.ankleRimToss && pose === 'throw' && actor.pivotTurn === undefined && actor.gripMode === 'ankle' && actor.ankleThrowProgress !== undefined && !actor.carrierRelease;
  const pairLift = pose === 'pairlift', pairRise = clamp(actor.pairLift ?? 0), pairLoad = clamp(actor.pairLoad ?? 0), pairBackload = clamp(actor.pairBackload ?? 0), pairHeave = clamp(actor.pairHeave ?? 0);
  const carrierSettle = ease(actor.carrierRelease?.progress ?? 0);
  // A zero carry progress accompanies the charge before the fighter is caught.
  // It must not turn a grounded runner into a suspended, frozen skeleton.
  const carrying = pose === 'carried' || (actor.carryStretch ?? 0) > 0 || actor.carryStretch !== undefined && pose === 'stunned', stretch = clamp(actor.carryStretch ?? 1);
  const shoulderCarry = carrying && actor.carrySupport === 'shoulder';
  const cradleCarry = carrying && actor.carrySupport === 'cradle';
  const spineCarry = carrying && !!actor.spineCarry;
  const powerbomb = pose === 'powerbomb', powerVictim = carrying && !!actor.powerbombVictim;
  const powerLoad = clamp(actor.powerbombLoad ?? 0), powerLift = clamp(actor.powerbombLift ?? 0), powerDown = clamp(actor.powerbombDown ?? 0);
  const scoopVictim = carrying && !!actor.scoopVictim, scoopDown = clamp(actor.scoopDown ?? 0);
  const carryMorph = powerVictim ? Math.max(powerLoad, powerLift) : scoopVictim ? Math.max(clamp(actor.scoopLoad ?? 0), clamp(actor.scoopLift ?? 0)) : stretch;
  const freeCarry = shoulderCarry && actor.carryFlight !== undefined ? ease(((actor.carryFlight ?? 0) - .06) / .20) * Math.sin(clamp(actor.carryFlight ?? 0) * Math.PI) : 0;
  const releaseWeight = clamp(released?.weight ?? 0);
  const palette = palettes[index % palettes.length], hair = ['#162536', '#4b362e', '#6f493e', '#2b3f49'][index % 4];
  const personality = index % 4, breath = Math.sin((clock + index * 719) / (580 + personality * 65));
  const speed = Math.hypot(actor.velocityX, actor.velocityY), air = !!slam || carrying || superman || dropkick || bulldog && ((actor.suspension ?? 0) > .001 || Math.abs(actor.angle) > .2) || pose === 'elbow' && (actor.suspension ?? 0) > 0 || ['airborne', 'held', 'roll', 'land', 'sidekick', 'stunned'].includes(pose) || pose === 'recover' && !slideRise;
  const state = actor.animation ?? createArenaFighterAnimation();
  const plantedGrip = actor.grappleEffort !== undefined && !!actor.gripTarget;
  const scoopStance = pose === 'scoopslam' && actor.gripMode === 'cradle';
  const moving = speed > (state.moving ? 3 : 8) && !air && !plantedGrip && !pairLift && !scoopStance && !actor.carrierRelease?.stance && actor.ankleThrowProgress === undefined && !sliding, backward = actor.velocityX * facing < -5;
  const signature = candidate.id + ':' + index + ':' + candidate.color;
  const reset = !state.motion || !Number.isFinite(state.motion.clapTurn) || !Number.isFinite(state.motion.cheerTurn) || !Number.isFinite(state.motion.applause) || state.signature !== signature || state.epoch !== actor.motionEpoch || actor.motionImmediate || clock < (state.clock ?? clock) || actor.gaitDistance < state.distance - 1;
  const delta = reset ? 0 : Math.max(0, Math.min(50, clock - (state.clock ?? clock)));
  if (!(anklePivot || ankleRimToss) || reset) state.anklePivotArms = undefined;
  else if (!state.anklePivotArms && state.contactPoints) {
    const source = state.contactPoints;
    state.anklePivotArms = { at: clock - delta, root: { x, y }, shoulders: source.shoulders.map(point => ({ ...point })), elbows: source.elbows.map(point => ({ ...point })), hands: source.hands.map(point => ({ ...point })), angles: source.hands.map((hand, arm) => [Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), Math.atan2(hand.y - source.elbows[arm].y, hand.x - source.elbows[arm].x)]) };
  }
  if (!ankleRimToss || reset) state.ankleRimAngles = undefined;
  if (actor.supermanLoad === undefined || reset) state.supermanPlant = undefined;
  if (actor.supermanLoad !== undefined && !state.supermanPlant) {
    const loaded = !reset && state.motion ? { ...state.motion } : { crouch: 1.6, lean: 5, hipX: 0, head: -.9, mouth: 1, backX: -9, backY: -12, frontX: 13, frontY: -14, spread: 1, contact: 0, shoulderLift: 0, clapTurn: 0, cheerTurn: 0, applause: 0 };
    if (!reset && state.supportHip) { loaded.hipX = state.supportHip.x; loaded.crouch = state.supportHip.y + 20; }
    state.supermanPlant = { motion: loaded, feet: !reset && state.localFeet ? state.localFeet.map(foot => ({ ...foot })) as [Point, Point] : [{ x: -5, y: 0 }, { x: 6, y: 0 }] };
  }
  if (reset || air || slam || actor.gripTarget || state.landingArms && clock - state.landingArms.at >= 180) state.landingArms = undefined;
  if (!reset && !air && !slam && (state.pose === 'land' && pose !== 'land' || state.carrierReleasing && !actor.carrierRelease) && state.contactPoints && !actor.gripTarget) {
    const source = state.contactPoints;
    state.landingArms = { at: clock - delta, root: { ...source.origin }, shoulders: source.shoulders.map(point => ({ ...point })), elbows: source.elbows.map(point => ({ ...point })), hands: source.hands.map(point => ({ ...point })), angles: source.hands.map((hand, arm) => [Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), Math.atan2(hand.y - source.elbows[arm].y, hand.x - source.elbows[arm].x)]) };
  }
  if (actor.ankleApproach === undefined || reset) { state.ankleReach = undefined; state.scoopAnkleMotion = undefined; state.scoopAnkleReversed = undefined; }
  if (actor.ankleApproach !== undefined && !state.ankleReach && !reset && state.contactPoints) {
    const source = state.contactPoints;
    state.ankleReach = { at: clock - delta, root: { ...source.origin }, shoulders: source.shoulders.map(point => ({ ...point })), elbows: source.elbows.map(point => ({ ...point })), hands: source.hands.map(point => ({ ...point })), angles: source.hands.map((hand, arm) => [Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), Math.atan2(hand.y - source.elbows[arm].y, hand.x - source.elbows[arm].x)]) };
    if ((state.pose === 'scoopslam' || (actor.scoopRecover ?? 0) > 0 || state.pose === 'backbodydrop' || state.pose === 'spinebuster' || state.pose === 'powerbomb' || state.pose === 'guard' && (actor.powerbombLift ?? 0) > 0 || state.pose === 'recover' && ((actor.spinebusterProgress ?? 0) > 0 || (actor.powerbombLift ?? 0) > 0 || (actor.bulldogProgress ?? 0) > 0)) && state.motion) {
      // The new resting direction can put the ankles behind the caster.
      // Turn the loaded trunk from its actual world lean before bending down.
      const motion = { ...state.motion }, reversed = state.facing !== undefined && state.facing !== facing;
      if (state.supportHip) { motion.hipX = state.supportHip.x; motion.crouch = state.supportHip.y + 20; }
      if (reversed) for (const key of ['lean', 'hipX', 'head', 'backX', 'frontX'] as const) motion[key] *= -1;
      state.scoopAnkleMotion = motion; state.scoopAnkleReversed = reversed;
    }
  }
  if (actor.pairReach === undefined || reset) state.pairReach = undefined;
  if (actor.pairReach !== undefined && !state.pairReach && !reset && state.contactPoints && state.motion) {
    const source = state.contactPoints, motion = { ...state.motion };
    if (state.supportHip) { motion.hipX = state.supportHip.x; motion.crouch = state.supportHip.y + 20; }
    state.pairReach = { motion, arms: { at: clock - delta, root: { ...source.origin }, shoulders: source.shoulders.map(point => ({ ...point })), elbows: source.elbows.map(point => ({ ...point })), hands: source.hands.map(point => ({ ...point })), angles: source.hands.map((hand, arm) => [Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), Math.atan2(hand.y - source.elbows[arm].y, hand.x - source.elbows[arm].x)]) } };
  }
  if (!slam || reset) state.slamStart = undefined;
  if (slam && actor.slamEntry && !state.slamStart && !reset && state.rig) state.slamStart = structuredClone(state.rig);
  if (!carrying || reset) state.carryStart = undefined;
  if (carrying && actor.carryEntry && !state.carryStart && !reset && state.rig) state.carryStart = structuredClone(state.rig);
  if (reset) { state.feet = null; state.localFeet = null; state.slideMotion = undefined; state.slideFeet = undefined; state.supermanFeet = undefined; state.supermanMotion = undefined; state.dropkickFeet = undefined; state.dropkickMotion = undefined; state.gait = .42 + personality * .015; state.moving = false; state.airborne = false; state.pivotStep = undefined; }
  else if (state.facing !== undefined && state.facing !== facing) {
    // Mirroring the body swaps the projected hips. Keep each world heel paired with its same hip.
    if (state.feet && !state.scoopAnkleMotion) state.feet = [state.feet[1], state.feet[0]];
    if (state.localFeet) state.localFeet = state.scoopAnkleMotion ? state.localFeet.map(foot => ({ x: -foot.x, y: foot.y })) as [Point, Point] : [{ x: -state.localFeet[1].x, y: state.localFeet[1].y }, { x: -state.localFeet[0].x, y: state.localFeet[0].y }];
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
  if (dropkick && (state.pose !== 'dropkick' || !state.dropkickFeet)) {
    state.dropkickMotion = !reset && state.motion ? { ...state.motion } : undefined;
    if (state.dropkickMotion && state.supportHip) { state.dropkickMotion.hipX = state.supportHip.x; state.dropkickMotion.crouch = state.supportHip.y + 20; }
    state.dropkickFeet = state.localFeet?.map(foot => ({ ...foot })) as [Point, Point] | undefined;
    state.dropkickFeet ??= [{ x: -5, y: 0 }, { x: 6, y: 0 }];
  }
  if (sliding && (state.pose !== 'slide' || !state.slideFeet)) {
    state.slideMotion = !reset && state.motion ? { ...state.motion } : undefined;
    if (state.slideMotion && state.supportHip) { state.slideMotion.hipX = state.supportHip.x; state.slideMotion.crouch = state.supportHip.y + 20; }
    state.slideFeet = state.localFeet?.map(foot => ({ ...foot })) as [Point, Point] | undefined;
    state.slideFeet ??= [{ x: -5, y: 0 }, { x: 6, y: 0 }];
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
  if ((pose === 'throw' || pose === 'grapple') && actor.ankleThrowProgress !== undefined) {
      const takeoff = ease(actor.ankleThrowProgress), pickup = { ...target, crouch: 4.5, lean: 52, hipX: 1.5, backX: 6, backY: 4, frontX: 16, frontY: 6, head: breath * 1.1, mouth: 2 };
      for (const key of Object.keys(target) as (keyof Motion)[]) target[key] = mix(pickup[key], target[key], takeoff);
  }
  if (sliding) {
    const slide = ease((actor.slideProgress ?? phase) / .65);
    target.crouch = 16; target.hipX = -2.4; target.lean = -58;
    target.backX = -14; target.backY = -18; target.frontX = 12; target.frontY = -21; target.head = 10.44; target.mouth = 2.1; target.clapTurn = 0;
    const entry = state.slideMotion ?? { ...target, crouch: 1.6, hipX: 0, lean: 5, backX: -9, backY: -12, frontX: 13, frontY: -14, head: -.9 };
    for (const key of Object.keys(target) as (keyof Motion)[]) target[key] = mix(entry[key], target[key], slide);
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
  if (dropkick) {
    const chamber = ease(dropkickProgress / .22), landing = ease((dropkickProgress - .64) / .36);
    target.crouch = mix(1.8, 0, landing); target.hipX = 0; target.lean = 9 * landing; target.head = -target.lean * .20 * (1 - landing);
    target.backX = mix(-11, -5, landing); target.backY = mix(-21, -1, landing); target.frontX = mix(13, 15, landing); target.frontY = mix(-23, 1, landing);
    target.mouth = 2.4; target.contact = 0; target.shoulderLift = 0; target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
    if (state.dropkickMotion) for (const key of Object.keys(target) as (keyof Motion)[]) target[key] = mix(state.dropkickMotion[key], target[key], chamber);
  }
  if (bulldog) {
    const drive = ease(actor.bulldogProgress ?? phase);
    target.crouch = mix(1.8, actor.bulldogHeadlock ? 8 : 3.8, drive); target.hipX = actor.bulldogHeadlock ? -2 * drive : 0;
    target.lean = mix(4, actor.bulldogHeadlock ? -12 : 16, drive); target.head = -target.lean * .2;
    target.backX = -2; target.frontX = 15; target.backY = -24; target.frontY = -25; target.mouth = 2.3; target.shoulderLift = 0; target.clapTurn = 0;
  }
  if (pose === 'backbodydrop') {
    const progress = clamp(actor.backBodyProgress ?? phase), load = ease(progress / .35), drive = ease((progress - .35) / .42), follow = ease((progress - .80) / .20);
    target.crouch = mix(mix(1.8, 6.8, load), .8, drive) + follow * .8; target.hipX = mix(-load * 1.4, .7, drive); target.lean = mix(mix(6, 42, load), -12, drive) + follow * 8;
    target.backX = mix(5, -8, drive); target.frontX = mix(18, 13, drive); target.backY = mix(-13, -25, drive); target.frontY = mix(-14, -27, drive);
    target.head = -target.lean * .25; target.mouth = 2.2; target.clapTurn = 0;
    if (actor.backBodyRaise !== undefined) {
      const raise = clamp(actor.backBodyRaise), released = 1 - clamp(actor.gripStrength ?? 0);
      target.crouch = mix(target.crouch, .8, raise);
      target.lean = mix(target.lean, -4, raise * (1 - released));
      target.hipX = mix(target.hipX, .3, raise * (1 - released));
      target.backX = mix(target.backX, -11, raise * (1 - released)); target.frontX = mix(target.frontX, 11, raise * (1 - released));
      target.backY = mix(target.backY, -48, raise * (1 - released)); target.frontY = mix(target.frontY, -48, raise * (1 - released));
      target.shoulderLift = 6.5 * raise * (1 - released);
      target.head = mix(target.head, 18, raise * (1 - released));
    }
  }
  if (pose === 'spinebuster') {
    const progress = clamp(actor.spinebusterProgress ?? phase), load = actor.spineLoad ?? ease(progress / .25), lift = actor.spineLift ?? ease((progress - .25) / .4), slamDown = actor.spineDown ?? ease((progress - .65) / .35);
    target.crouch = mix(mix(1.2 + personality * .25, 5.8, load), 1.1, lift) + slamDown * 4.4;
    target.hipX = mix(mix(breath * .12, -1.5, load), .5, lift) + slamDown * .8;
    target.lean = mix(mix(2 + personality * .4, 14, load), 3, lift) - slamDown * 13;
    target.backX = mix(mix(-5, 5, load), 9, slamDown); target.frontX = mix(mix(15, 17, load), 20, slamDown);
    target.backY = mix(mix(-12, -20, load), -4, slamDown); target.frontY = mix(mix(-15, -22, load), -2, slamDown);
    const impact = clamp(actor.slamImpact ?? 0);
    target.crouch += impact * .5; target.hipX += impact * .15;
    target.head = -target.lean * mix(.3, .25, load) + impact; target.mouth = mix(1.2, 2.4, load); target.clapTurn = 0;
  }
  if (powerbomb) {
    // Receive the hips with a brief knee load, then stand under the seated
    // opponent. The raised shoulders give normal arms overhead reach.
    target.crouch = mix(mix(1.2 + personality * .25, 4.8, powerLoad), .6, powerLift) + powerDown * 3;
    target.hipX = -1.5 * powerLoad * (1 - powerLift) + powerDown * 1.2;
    target.lean = mix(mix(2 + personality * .4, 13, powerLoad), 0, powerLift) + powerDown * 18;
    target.shoulderLift = powerLift * 9.5 * (1 - powerDown);
    target.backX = mix(-5, -9, powerLift) + powerDown * 14; target.frontX = mix(15, 9, powerLift) + powerDown * 11;
    target.backY = mix(-12, -47, powerLift) + powerDown * 40; target.frontY = mix(-15, -47, powerLift) + powerDown * 42;
    target.head = mix(-target.lean * .3, 10, powerLift) * (1 - powerDown); target.mouth = 2; target.clapTurn = 0;
  }
  if (pose === 'scoopslam') {
    const progress = clamp(actor.scoopSlamProgress ?? phase), gather = actor.scoopLoad ?? ease(progress / .13), rise = actor.scoopLift ?? ease((progress - .08) / .37), turn = actor.scoopTurn ?? ease((progress - .35) / .28), down = actor.scoopDown ?? ease((progress - .55) / .45);
    // Receive the runner across the chest, stand below the complete body,
    // then drive both overhead support arms down through the back-first slam.
    target.crouch = mix(mix(1.2 + personality * .25, 5.2, gather), .9, rise) + down * 7.6;
    target.hipX = mix(breath * .12, -1.8, gather) * (1 - rise) + turn * .8 + down * 2.4;
    target.lean = mix(mix(2 + personality * .4, 17, gather), -2, rise) - Math.sin(turn * Math.PI) * 4 + turn * 4 + down * 27;
    target.backX = mix(mix(mix(-5, 4, gather), -10, rise), 8, down); target.frontX = mix(mix(mix(15, 14, gather), 10, rise), 18, down);
    target.backY = mix(mix(mix(-12, -16, gather), -49, rise), -6, down); target.frontY = mix(mix(mix(-15, -10, gather), -49, rise), -4, down);
    target.head = mix(-target.lean * .2, 9, rise) * (1 - down) + clamp(actor.slamImpact ?? 0); target.mouth = 2.1; target.shoulderLift = rise * 14.4 * (1 - down); target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
    const recover = clamp(actor.scoopRecover ?? 0);
    const standing: Partial<Motion> = { crouch: 1.2 + personality * .25, hipX: breath * .12, lean: 2 + personality * .4, head: -(2 + personality * .4) * .3, backX: -5, frontX: 15, backY: -12, frontY: -15, shoulderLift: 0 };
    for (const key of Object.keys(standing) as (keyof Motion)[]) target[key] = mix(target[key], standing[key]!, recover);
  }
  if (pose === 'stunned') { target.crouch = .4; target.lean = 0; target.hipX = 0; target.head = 0; target.backX = -11; target.backY = -2; target.frontX = 12; target.frontY = -2; target.mouth = .7; }
  if (pose === 'airborne') { target.crouch = 3; target.backX = -18; target.backY = -26; target.frontX = 20; target.frontY = -29; target.mouth = 3; target.head = -3; }
  if (pose === 'land') { target.crouch = 6 * Math.sin(clamp(phase) * Math.PI); target.lean = 9; target.backX = -5; target.backY = -1; target.frontX = 15; target.frontY = 1; target.mouth = 2.5; }
  if (pose === 'recover') { const p = ease(phase); target.crouch = mix(6.5, .4, p); target.lean = mix(12, 0, p); target.backX = mix(-2, -9, p); target.backY = mix(0, -1, p); target.frontX = mix(15, 10, p); target.frontY = mix(1, 0, p); }
  if (slideRise) { const p = ease(phase); target.crouch = mix(16, .4, p); target.hipX = mix(-2.4, 0, p); target.lean = mix(-58, 0, p); target.head = mix(10.44, 0, p); target.backX = mix(-14, -9, p); target.backY = mix(-18, -1, p); target.frontX = mix(12, 10, p); target.frontY = mix(-21, 0, p); }
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
    target.crouch = mix(target.crouch, 2.5 - drive * .3 + Math.abs(Math.sin(gait)) * drive * .2, ready);
    target.lean = mix(target.lean, 15 + drive * 17, ready);
    target.hipX = mix(target.hipX, -1.8 + drive * 2.5, ready);
    target.spread += preparation * (1 - drive) * .30;
    target.head = -target.lean * .65;
    const pump = Math.cos(gait) * drive * 6;
    target.backX = mix(target.backX, -10 - pump, ready); target.backY = mix(target.backY, -13 - drive * 3, ready);
    target.frontX = mix(target.frontX, 14 + pump, ready); target.frontY = mix(target.frontY, -17 - drive * 2, ready);
    target.clapTurn = 0;
  }
  if (pose === 'run' && actor.clotheslineInner) {
    // Open the striking arm behind the running shoulder before sweeping its
    // inner elbow across the neck. The forearm then hooks through contact.
    const reach = clamp(actor.clotheslineStrength ?? 0);
    target.frontX = mix(-18, target.frontX, reach); target.frontY = mix(-24, target.frontY, reach);
  }
  if (actor.linkedArm !== undefined || actor.clotheslineArm !== undefined) { target.lean = 0; target.hipX = 0; target.contact = 0; target.shoulderLift = 0; }
  if (actor.gripMode === 'head') { target.contact = 0; target.shoulderLift = 0; }
  if (actor.gripMode === 'wrist' && pose !== 'overhead') target.shoulderLift = 0;
  if (spin && !feetSpin) {
    target.crouch = mix(3.2, .7, spinWeight); target.hipX = 0; target.lean = 0;
    target.backX = mix(10, -5, spinWeight); target.frontX = mix(20, 5, spinWeight);
    target.backY = target.frontY = mix(-18.5, -37.5, spinWeight);
    target.contact = 1; target.shoulderLift = 0; target.head = -2; target.mouth = 2.3;
  }
  if (feetSpin) {
    // The caught kick becomes a suspended body through the same continuous
    // pose. Its hands protect the chest instead of taking an unseen wrist hold.
    target.crouch = mix(target.crouch, .7, spinWeight); target.hipX *= 1 - spinWeight; target.lean *= 1 - spinWeight;
    target.backX = mix(target.backX, -8, spinWeight); target.frontX = mix(target.frontX, 9, spinWeight);
    target.backY = mix(target.backY, -16, spinWeight); target.frontY = mix(target.frontY, -17, spinWeight);
    target.head = mix(target.head, -2, spinWeight); target.contact = 0; target.shoulderLift = 0;
  }
  if (slam) {
    // The waist lift, tucked back arc and limp floor pose share one timed rig.
    // A pose label change at impact cannot unfold the legs or lift the head.
    const lifted: Partial<Motion> = { crouch: mix(3.2, 5, tuck), lean: mix(-7 + breath * .5, 0, tuck), hipX: mix(-1.2 + breath * .3, 0, tuck), head: mix(breath * 1.1, 0, tuck), mouth: mix(.9, 2, tuck), backX: mix(-1, -8, tuck), backY: mix(-12, -18, tuck), frontX: mix(16, 8, tuck), frontY: mix(-14, -18, tuck), spread: 1 + personality * .035 + (1 - tuck) * .2 };
    const flat: Partial<Motion> = { crouch: .4, lean: 0, hipX: 0, head: 0, mouth: 1, backX: -11, backY: -2, frontX: 12, frontY: -2, spread: 1 + personality * .035 };
    // A head-first Bulldog starts from the standing head hold. The generic
    // waist-lift brace would move the temple out of the carrier's hand as
    // soon as the first falling frame changes its pose label.
    const standing: Partial<Motion> = bulldog ? { ...target } : { crouch: 1.2 + personality * .25, lean: 2 + personality * .4, hipX: breath * .12, head: -(2 + personality * .4) * .3, mouth: 1.2, backX: -5, backY: -12, frontX: 15, frontY: -15, spread: 1 + personality * .035 };
    const source = state.slamStart?.motion ?? (actor.bulldogProgress !== undefined ? standing : lifted);
    for (const key of Object.keys(lifted) as (keyof Motion)[]) target[key] = mix(source[key]!, flat[key]!, slump);
    target.contact = 0; target.shoulderLift = 0; target.clapTurn = actor.bulldogProgress !== undefined ? 1 : 0; target.cheerTurn = 0; target.applause = 0;
  }
  if (carrying) {
    // A shoulder-supported body rests its arms beside the hips. Wrist holds
    // keep their own existing unfolding rig for other carrying techniques.
    const armStretch = shoulderCarry || cradleCarry ? 0 : stretch;
    const armX = Math.min(4.6, (18 + index % 3) * .43 * .58);
    target.crouch = mix(.4, .7, stretch); target.lean = freeCarry * 3; target.hipX = 0; target.head = freeCarry * -4; target.mouth = .7;
    target.backX = mix(-11, -armX, armStretch); target.frontX = mix(12, armX, armStretch); target.backY = target.frontY = mix(-2, -46.8, armStretch);
    target.spread = 1 + personality * .035; target.contact = 0; target.shoulderLift = armStretch * 6; target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
    if (cradleCarry || spineCarry) {
      target.crouch = .5 + stretch * .7; target.lean = -stretch * 3; target.head = -stretch * 5;
      target.backX = -6; target.frontX = 11; target.backY = -16; target.frontY = -22;
    }
    if (scoopVictim) {
      target.crouch = mix(1.2, .4, scoopDown); target.lean = -3 * (1 - scoopDown); target.head = -5 * (1 - scoopDown);
      target.backX = mix(-6, -11, scoopDown); target.frontX = mix(11, 12, scoopDown);
      target.backY = mix(-16, -2, scoopDown); target.frontY = mix(-22, -2, scoopDown);
    }
    if (actor.pairCarry) {
      target.crouch = .4 + stretch * .4;
      target.lean = stretch * (-2 * pairBackload + 5 * pairHeave) + freeCarry * 3;
      target.head = stretch * (pairBackload * -2 + pairHeave * -4) - freeCarry * 4;
    }
    if (powerVictim) {
      target.crouch = mix(1.2, .4, powerDown); target.lean = powerLoad * (1 - powerLift) * 76 * (1 - powerDown);
      target.hipX = 0; target.head = -target.lean * .25; target.shoulderLift = 0;
      target.backX = mix(-6, -11, powerDown); target.frontX = mix(11, 12, powerDown);
      target.backY = mix(-16, -2, powerDown); target.frontY = mix(-22, -2, powerDown);
    }
    if (state.carryStart) for (const key of Object.keys(target) as (keyof Motion)[]) target[key] = mix(state.carryStart.motion[key], target[key], carryMorph);
  }
  if (pairLift) {
    const ankle = actor.gripMode === 'ankle';
    target.crouch = mix(mix(ankle ? 4.5 : 12, 13.5, pairLoad), 2.5, pairRise) + pairBackload * 2.5 - pairHeave * 3;
    target.lean = mix(mix(ankle ? 52 : 26, 44, pairLoad), 8, pairRise) - pairBackload * 5 + pairHeave * 3;
    target.hipX = mix(1.5, -.6, pairRise) - pairBackload * 1.2 + pairHeave * 1.8;
    target.head = mix(breath * 1.1, -target.lean * .3, pairLoad);
    target.backX = mix(6, 14, pairRise); target.frontX = mix(16, 22, pairRise);
    target.backY = mix(4, -15, pairRise); target.frontY = mix(6, -17, pairRise);
    target.shoulderLift = 0; target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0; target.mouth = 2;
  }
  if (pose === 'overhead') {
    const raise = clamp(actor.overheadRaise ?? 1), armX = (18 + index % 3) * .43, waist = actor.gripMode === 'waist', ankle = actor.gripMode === 'ankle';
    target.crouch = mix(waist ? 6 : ankle ? 4.5 : 12, .2, raise); target.lean = mix(waist ? 10 : ankle ? 52 : 26, 0, raise); target.hipX = mix(waist ? 1 : 1.5, 0, raise); target.head = breath * 1.1 * (1 - raise); target.mouth = mix(waist ? 2.4 : 2, 1.8, raise);
    target.backX = mix(6, -armX, raise); target.frontX = mix(waist ? 17 : 16, armX, raise); target.backY = mix(waist ? -20 : 4, -46.5, raise); target.frontY = mix(waist ? -24 : 6, -46.5, raise);
    target.shoulderLift = jointOverhead ? (actor.gripMode === 'shoulder' ? 6.5 : 5.5) * raise : target.shoulderLift * raise;
    if (jointOverhead) target.head = mix(target.head, 30, raise) * (1 - carrierSettle);
    target.clapTurn = 0; target.cheerTurn = 0; target.applause = 0;
    if (actor.carrierDrive !== undefined) {
      const drive = clamp(actor.carrierDrive), load = Math.sin(Math.PI * clamp(drive / .5)) * (1 - raise), follow = actor.gripTarget ? 0 : ease((drive - .86) / .14);
      target.crouch += load * 1.8 + follow * 2.4; target.hipX += -load * .6 + follow * 2.0;
      target.lean += load * 3 + follow * 7; target.head -= follow * 2;
    }
    if (actor.carrierRelease) {
      const progress = clamp(actor.carrierRelease.progress), recover = ease((progress - .24) / .76), heave = Math.sin(Math.PI * clamp(progress / .44));
      // Keep the last support posture at release, follow the upward heave,
      // then finish at the ordinary chest-height guard rather than dropping
      // to the waist and starting a second throw animation.
      target.crouch = mix(.2, 1.2 + personality * .25, recover) + heave * .7;
      target.lean = mix(0, 2 + personality * .4, recover) + heave * 4;
      target.hipX = mix(heave * .6, breath * .12, recover);
      target.head = mix(30, -(2 + personality * .4) * .3, recover);
      target.shoulderLift = (actor.gripMode === 'shoulder' ? 6.5 : 5.5) * (1 - recover);
      target.backX = mix(target.backX, -5, recover); target.frontX = mix(target.frontX, 15, recover);
      target.backY = mix(target.backY, -12, recover); target.frontY = mix(target.frontY, -15, recover);
    }
  }
  if (actor.ankleSpinRaise !== undefined && !actor.carrierRelease) {
    // When the rotating body points below the hands, lift those hands with
    // the shoulders and a standing trunk; neither arm acquires extra reach.
    const raise = clamp(actor.ankleSpinRaise);
    target.crouch = mix(target.crouch, .6, raise); target.lean = mix(target.lean, 0, raise);
    const rimToss = !!actor.ankleRimToss;
    target.hipX = mix(target.hipX, 0, raise); target.shoulderLift = mix(target.shoulderLift, rimToss ? 0 : 8.5, raise);
    target.head = mix(target.head, -2, raise);
  }
  if (anklePivot) {
    // Stand under the ankle weight before turning. Keeping the old grappling
    // lean brought a palm through its own shoulder and reversed the folded
    // elbow as the body crossed the rear half of the swing.
    const load = ease((clamp(actor.ankleThrowProgress!) - .45) / .55);
    target.crouch = mix(target.crouch, .6, load); target.lean = mix(target.lean, 0, load);
    target.hipX = mix(target.hipX, 0, load);
    target.shoulderLift = mix(target.shoulderLift, -1, load); target.head = mix(target.head, -2, load);
  }
  if (actor.carrierRelease?.stance) {
    const source = actor.carrierRelease.stance, progress = clamp(actor.carrierRelease.progress), recover = ease((progress - .24) / .76), heave = Math.sin(Math.PI * clamp(progress / .44));
    target.crouch = mix(source.crouch, 1.2 + personality * .25, recover) + heave * .7;
    target.lean = mix(source.lean, 2 + personality * .4, recover) + heave * 4;
    target.hipX = mix(source.hipX + heave * .6, breath * .12, recover);
    target.head = mix(source.head, -(2 + personality * .4) * .3, recover);
    target.contact = source.contact * (1 - recover); target.shoulderLift = source.shoulderLift * (1 - recover);
    target.backX = mix(target.backX, -5, recover); target.frontX = mix(target.frontX, 15, recover);
    target.backY = mix(target.backY, -12, recover); target.frontY = mix(target.frontY, -15, recover);
  }
  if (pairLift && state.pairReach) {
    const reach = clamp(actor.pairReach ?? 1), source = state.pairReach.motion;
    for (const key of Object.keys(target) as (keyof Motion)[]) target[key] = mix(source[key], target[key], reach);
  }
  if (state.scoopAnkleMotion && actor.ankleApproach !== undefined) {
    const reach = clamp(actor.ankleApproach), source = state.scoopAnkleMotion;
    for (const key of Object.keys(target) as (keyof Motion)[]) target[key] = mix(source[key], target[key], reach);
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
  if (actor.supermanLoad !== undefined && state.supermanPlant) {
    const load = clamp(actor.supermanLoad), source = state.supermanPlant.motion;
    Object.assign(target, { crouch: 4.4, lean: 8, hipX: -1.6, head: -3.5, backX: -16, backY: -17, frontX: 14, frontY: -23, contact: 0, shoulderLift: 0, clapTurn: 0, cheerTurn: 0, applause: 0 });
    (Object.keys(target) as (keyof Motion)[]).forEach(key => { target[key] = mix(source[key], target[key], load); });
  }
  if (reset || slam || carrying || pairLift || state.scoopAnkleMotion || feetSpin || sliding || slideRise || superman || actor.supermanLoad !== undefined || dropkick || bulldog || actor.ankleThrowProgress !== undefined || pose === 'backbodydrop' || powerbomb || pose === 'spinebuster' || pose === 'scoopslam' || pose === 'scoop' || pose === 'trip' && actor.frontKick !== undefined || pose === 'overhead' && actor.overheadRaise !== undefined) state.motion = { ...target };
  else {
    (Object.keys(target) as (keyof Motion)[]).forEach(key => {
      const hand = key === 'backX' || key === 'backY' || key === 'frontX' || key === 'frontY';
      const turn = key === 'clapTurn' || key === 'cheerTurn';
      const amount = 1 - Math.exp(-delta / (air ? 55 : turn ? 180 : pose === 'clap' && hand && state.motion!.applause > .9 ? 45 : 95));
      state.motion![key] = mix(state.motion![key], target[key], amount);
    });
  }
  const motion = { ...state.motion! };
  if (actor.linkedArm !== undefined || actor.clotheslineArm !== undefined) { motion.lean = 0; motion.hipX = 0; motion.contact = 0; motion.shoulderLift = 0; }
  if (released && releaseWeight > 0) (Object.keys(motion) as (keyof Motion)[]).forEach(key => { motion[key] = mix(motion[key], released.snapshot.motion[key], releaseWeight); });
  const hip = released ? pointMix({ x: motion.hipX, y: -20 + motion.crouch }, released.snapshot.hip, releaseWeight) : { x: motion.hipX, y: -20 + motion.crouch };
  if ((powerVictim || scoopVictim) && state.carryStart) Object.assign(hip, pointMix(state.carryStart.hip, hip, carryMorph));
  if (air && !slam && !carrying && !superman && !dropkick && !bulldog && !spin && !released && !reset && state.supportHip) {
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
    const airFeet: [Point, Point] = slam ? [{ x: -5, y: 0 }, { x: 6, y: 0 }].map((foot, leg) => pointMix(pointMix({ x: foot.x * (1 + personality * .035 + (actor.bulldogProgress === undefined ? (1 - tuck) * .2 : 0)), y: 0 }, { x: hip.x + (leg ? 7.3 : -2.4), y: hip.y + (leg ? 17.4 : 18) }, tuck), foot, slump)) as [Point, Point] : pose === 'held' && actor.gripMode === 'wrist' ? [{ x: -5 - trailing * .8, y: -.8 }, { x: 5 + trailing * .8, y: -2.4 }] : pose === 'roll' ? [{ x: 1, y: -12 }, { x: 10, y: -12 }] : pose === 'airborne' || pose === 'sidekick' || pose === 'held' ? [{ x: 1, y: -5 }, { x: 10, y: -1 }] : [{ x: -5, y: 0 }, { x: 6, y: 0 }];
    state.localFeet ??= airFeet;
    if (carrying) airFeet.forEach((foot, leg) => Object.assign(foot, pointMix(pointMix({ x: leg ? 6 : -5, y: 0 }, { x: leg ? 4.5 : -4.5, y: hip.y + (actor.pairCarry ? 20.5 - pairHeave * .5 : 21.98) }, stretch), { x: leg ? 8 : -7, y: hip.y + (leg ? 15 : 18) }, freeCarry * .65)));
    if (state.carryStart) airFeet.forEach((foot, leg) => Object.assign(foot, pointMix(state.carryStart!.feet[leg], { x: leg ? 4.5 : -4.5, y: hip.y + (actor.pairCarry ? 20.5 - pairHeave * .5 : 21.98) }, stretch)));
    if (cradleCarry || spineCarry) airFeet.forEach((foot, leg) => Object.assign(foot, pointMix(foot, { x: (leg ? 4.5 : -4.5) + 3, y: hip.y + (leg ? 18.8 : 19.6) }, stretch * (1 - slump))));
    if (scoopVictim) airFeet.forEach((foot, leg) => {
      const start = state.carryStart?.feet[leg] ?? { x: leg ? 6 : -5, y: 0 };
      const cradled = { x: (leg ? 4.5 : -4.5) + 3, y: hip.y + (leg ? 18.8 : 19.6) };
      Object.assign(foot, pointMix(start, pointMix(cradled, { x: leg ? 6 : -5, y: 0 }, scoopDown), carryMorph));
    });
    if (powerVictim) airFeet.forEach((foot, leg) => {
      const start = state.carryStart?.feet[leg] ?? { x: leg ? 6 : -5, y: 0 };
      const seated = pointMix({ x: hip.x + (leg ? 4.5 : -4.5) + 9, y: hip.y + 13.5 }, { x: leg ? 6 : -5, y: 0 }, powerDown);
      Object.assign(foot, pointMix(start, seated, powerLift));
    });
    if (state.slamStart) airFeet.forEach((foot, leg) => Object.assign(foot, pointMix(state.slamStart!.feet[leg], foot, slump)));
    const amount = reset || slam || carrying || feetSpin ? 1 : 1 - Math.exp(-delta / 60);
    feet = state.localFeet.map((foot, leg) => pointMix(foot, airFeet[leg], amount)) as [Point, Point];
    if (pose === 'sidekick') {
      // Between the two hops the soles really plant; rising knees tuck only after push-off.
      const tuck = ease(((actor.depthY ?? y) - y) / (scale * 6));
      feet = feet.map((foot, leg) => pointMix({ x: leg ? 6 : -5, y: 0 }, foot, tuck)) as [Point, Point];
    }
  } else feet = groundedFeet(actor, state, clock, moving, reset, motion.spread);
  if (actor.supermanLoad !== undefined && state.supermanPlant) {
    // This 180ms plant finishes before takeoff; the ordinary idle foot
    // adjustment lasts 275ms and would leave a running foot in the air.
    feet = state.supermanPlant.feet.map((foot, leg) => pointMix(foot, { x: leg ? 6.5 : -5.5, y: 0 }, clamp(actor.supermanLoad!))) as [Point, Point];
    feet.forEach((foot, leg) => {
      const memory = state.feet![leg], lift = Math.max(0, -foot.y), ground = { x: x + facing * scale * foot.x, y: y + scale * (foot.y + lift) };
      memory.ground = ground; memory.anchor = { ...ground }; memory.from = { ...ground }; memory.to = { ...ground };
      memory.lift = lift; memory.swinging = false; memory.settleAt = -Infinity; memory.replant = undefined;
    });
  }
  if (sliding) {
    const slide = ease((actor.slideProgress ?? phase) / .65);
    feet = state.slideFeet!.map((foot, leg) => pointMix(foot, { x: leg ? 22.4 : -6, y: leg ? 0 : -1 }, slide)) as [Point, Point];
  }
  if (superman) {
    const chamber = ease(supermanProgress / .24), drive = ease((supermanProgress - .24) / .24), landing = ease((supermanProgress - .66) / .34);
    const falseKick = pointMix({ x: hip.x - 6, y: hip.y + 12 }, { x: hip.x - 18, y: hip.y + 10 }, drive);
    const leadKnee = pointMix({ x: hip.x + 12, y: hip.y + 8 }, { x: hip.x + 10, y: hip.y + 15 }, drive);
    feet = [falseKick, leadKnee].map((foot, leg) => pointMix(pointMix(state.supermanFeet![leg], foot, chamber), { x: leg ? 6 : -5, y: 0 }, landing)) as [Point, Point];
  }
  if (dropkick) {
    const chamber = ease(dropkickProgress / .22), strike = ease((dropkickProgress - .20) / .26), landing = ease((dropkickProgress - .64) / .36);
    feet = feet.map((_, leg) => pointMix(pointMix(state.dropkickFeet![leg], pointMix({ x: hip.x + (leg ? 10 : 7), y: hip.y + 7 }, { x: hip.x + (leg ? 3 : -3), y: hip.y + 21.4 }, strike), chamber), { x: leg ? 6 : -5, y: 0 }, landing)) as [Point, Point];
  }
  if (plantedLanding) feet = feet.map(foot => ({ x: foot.x, y: 0 })) as [Point, Point];
  if (actor.jumpTuck !== undefined && air) feet = feet.map((foot, leg) => pointMix(foot, { x: hip.x + (leg ? 7 : -2), y: hip.y + 8 }, clamp(actor.jumpTuck!))) as [Point, Point];
  if (spin) feet = feet.map((foot, leg) => pointMix(foot, feetSpin ? { x: hip.x + (leg ? 4.5 : -4.5) + (spin.gripBoth || leg === caughtFoot ? 0 : -4), y: hip.y + (spin.gripBoth || leg === caughtFoot ? 21.6 : 11.5) } : { x: leg ? 6 : -5, y: hip.y + (leg ? 21.1 : 21.4) }, spinWeight)) as [Point, Point];
  if (released) feet = feet.map((foot, leg) => pointMix(foot, released.snapshot.feet[leg], releaseWeight)) as [Point, Point];
  const frontKick = pose === 'trip' && actor.frontKick !== undefined ? clamp(actor.frontKick) : undefined;
  const targetedLeg = frontKick !== undefined || actor.footTarget && (pose === 'trip' || pose === 'sidekick' || sliding) && (actor.footStrength ?? 1) > .001 ? actor.kickLeg ?? 1 : undefined;
  if (targetedLeg !== undefined && frontKick === undefined) {
    const leg = targetedLeg, root = rotate({ x: actor.footTarget!.x - x, y: actor.footTarget!.y - (feetSpin ? y - 2 * scale : y) }, -actor.angle);
    feet[leg] = pointMix(feet[leg], { x: root.x / (scale * facing), y: root.y / scale + (feetSpin ? 0 : 2) }, clamp(actor.footStrength ?? 1) * (feetSpin ? 1 - spinWeight : 1));
  }
  // The horizontal carried body already has one depth projection. Applying
  // flight yaw as a second compression made the torso and limbs paper thin.
  const yaw = carrying || pairLift || sliding || slideRise || superman || dropkick || bulldog || pose === 'backbodydrop' || spin || released && releaseWeight > 0 ? 0 : actor.yaw ?? 0, turnWidth = .28 + Math.abs(Math.cos(yaw)) * .72;
  const casterPlane = ankleCasterPlane(actor), across = casterPlane?.across ?? { x: Math.cos(yaw), y: Math.sin(yaw) * .42 };
  const front = spin ? Math.sin(spin.orbit + .001) >= 0 : released && releaseWeight > 0 ? released.snapshot.front : (casterPlane?.faceDirection ?? Math.cos(yaw)) >= 0;
  const turningWithAnkles = feetSpin || actor.pivotTurn !== undefined && actor.gripMode === 'ankle';
  const faceDirection = feetSpin ? Math.sin(spin!.orbit) : casterPlane?.faceDirection ?? Math.cos(yaw);
  const frontAlpha = turningWithAnkles ? ease((faceDirection + .25) / .5) : Number(front);
  const hipOffsets = [-4.5, 4.5].map(offset => ({ x: offset * across.x, y: offset * across.y }));
  if (!air) {
    // A turn takes a short replacement step before a heel can pull the pelvis down.
    feet = feet.map((foot, leg) => {
      if (leg === targetedLeg) return foot;
      const memory = state.feet![leg];
      const reach = Math.hypot(foot.x - hip.x - hipOffsets[leg].x, foot.y - hip.y - hipOffsets[leg].y);
      const sharedStance = pairLift || actor.carrierRelease?.stance !== undefined || scoopStance;
      const loadedStance = sharedStance || pose === 'drag' && actor.gripMode === 'ankle' || actor.ankleThrowProgress !== undefined;
      const otherSupport = state.feet![1 - leg], canStep = !loadedStance || !otherSupport.replant && !otherSupport.swinging && otherSupport.lift < .05;
      // A reversal in any direction can leave the material heel behind its
      // support hip. Take a replacement step before the expired stance
      // pulls the pelvis sideways and down into a seated silhouette.
      const replacementBase = sharedStance ? 100 : 135;
      const stepTime = pose === 'run' ? Math.min(.135, 11 * scale / Math.max(1, speed)) : replacementBase / 1000;
      const depthReplacement = sharedStance && Math.abs(foot.y) > 2;
      // A cradled overhead body can move the receiving root into depth.
      // Replant the older heel first; repeatedly servicing leg zero leaves
      // the other supporting foot behind the shadow for the whole turn.
      const scoopPriority = !scoopStance || Math.abs(foot.x - hip.x - hipOffsets[leg].x) > 20.7
        || Math.abs(memory.ground.y - y) >= Math.abs(otherSupport.ground.y - y) - .01;
      if (!reset && canStep && scoopPriority && actor.pivotTurn === undefined && !memory.replant && !memory.swinging && (reach > 20.7 || depthReplacement)) {
        memory.replant = { at: clock, from: { ...memory.ground }, to: { x: x + facing * (leg ? 4 : -4) * scale + actor.velocityX * stepTime, y: y + actor.velocityY * stepTime } };
        memory.settleAt = -Infinity;
        memory.to = { ...memory.replant.to };
      }
      if (!memory.replant) return foot;
      // The shared fall can leave a heel on the far side of the new ankle
      // stance. Give that longer real step its own fixed duration; a 135 ms
      // replacement cannot move a normal sole sixty pixels smoothly.
      const clotheslineStep = (actor.bulldogProgress ?? 0) > 0 && actor.gripMode === 'ankle';
      const replacementTime = clotheslineStep ? Math.max(replacementBase,
        1.5 * Math.hypot(memory.replant.to.x - memory.replant.from.x, memory.replant.to.y - memory.replant.from.y) / 450 * 1000) : replacementBase;
      const p = clamp((clock - memory.replant.at) / replacementTime);
      memory.ground = pointMix(memory.replant.from, memory.replant.to, ease(p));
      memory.lift = Math.sin(p * Math.PI) * (sharedStance ? 2 : 3.2); memory.swinging = true;
      if (p >= 1) {
        const local = { x: (memory.ground.x - x) / (scale * facing), y: (memory.ground.y - y) / scale };
        if (Math.hypot(local.x - hip.x - hipOffsets[leg].x, local.y - hip.y - hipOffsets[leg].y) > 20.7) {
          // A second direction change during the step needs another landing, not a deep squat.
          memory.replant = { at: clock, from: { ...memory.ground }, to: { x: x + facing * (leg ? 4 : -4) * scale + actor.velocityX * stepTime, y: y + actor.velocityY * stepTime } };
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
  if (dropkick && actor.footTargets && (actor.feetStrength ?? 0) > 0) feet = feet.map((foot, leg) => {
    const pelvis = { x: x + hip.x * scale * facing, y: y - 2 * scale + hip.y * scale };
    const root = rotate({ x: actor.footTargets![leg].x - pelvis.x, y: actor.footTargets![leg].y - pelvis.y }, -actor.angle);
    return pointMix(foot, { x: hip.x + root.x / (scale * facing), y: hip.y + root.y / scale }, clamp(actor.feetStrength ?? 0));
  }) as [Point, Point];
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
  // The recovery knee keeps a soft bend while it swings past the body.
  // A planted heel still fixes its world point and is never shortened here.
  feet = feet.map((foot, leg) => air || leg === targetedLeg || state.feet![leg].swinging || state.feet![leg].lift > .05 ? reachable(hips[leg], foot, slam || released?.snapshot.knees ? 22 : carrying ? 21.98 : pose === 'run' ? 20.8 : 21.8) : foot) as [Point, Point];
  if (sliding) feet.forEach((foot, leg) => {
    const memory = state.feet![leg], ground = { x: x + facing * scale * foot.x, y };
    memory.ground = ground; memory.anchor = { ...ground }; memory.from = { ...ground }; memory.to = { ...ground };
    memory.lift = Math.max(0, -foot.y); memory.swinging = false; memory.settleAt = -Infinity; memory.replant = undefined;
  });
  state.localFeet = feet;
  const depthStride = moving ? ease((Math.abs(actor.velocityY) / Math.max(1, speed) - .18) / .55) : 1;
  state.depthStride = reset ? depthStride : mix(state.depthStride ?? depthStride, depthStride, 1 - Math.exp(-delta / 160));
  // A lifted running knee remains readable into depth. Compressing its bend
  // to ten percent made the recovering leg nearly disappear beneath the hips.
  const runningDepth = pose === 'run' && moving ? Math.min(.85, state.depthStride!) : state.depthStride!;
  const supportedPairLegs = pairLift || actor.carrierRelease?.stance !== undefined || pose === 'scoopslam';
  if (supportedPairLegs) state.pairLegDepth = reset ? 0 : mix(state.pairLegDepth ?? state.depthStride!, 0, 1 - Math.exp(-delta / 90));
  else if (reset) state.pairLegDepth = undefined;
  else if (state.pairLegDepth !== undefined) {
    state.pairLegDepth = mix(state.pairLegDepth, runningDepth, 1 - Math.exp(-delta / 90));
    if (Math.abs(state.pairLegDepth - runningDepth) < .001) state.pairLegDepth = undefined;
  }
  const legDepth = state.pairLegDepth ?? runningDepth;
  const knees = feet.map((foot, leg) => frontKick !== undefined && leg === targetedLeg ? pointMix(legKnee(hips[leg], foot, state.depthStride!, yaw), knee(hips[leg], foot, 11, 11, 1), ease(frontKick / .4) * (1 - ease((frontKick - .78) / .22))) : slam ? pointMix(legKnee(hips[leg], foot, 1, yaw), extendingKnee(hips[leg], foot, 1), tuck) : air || sliding ? knee(hips[leg], foot, 11, 11, 1) : legKnee(hips[leg], foot, legDepth, yaw));
  const footAngles = feet.map((foot, leg) => {
    if (slam) return (Math.atan2(foot.y - knees[leg].y, foot.x - knees[leg].x) - Math.PI / 2) * tuck;
    if (pose !== 'run' || !moving || !state.feet?.[leg].swinging) return 0;
    const memory = state.feet[leg], cycle = (state.gait + leg * .5) % 1;
    const recovery = memory.replant ? clamp((clock - memory.replant.at) / 135) : clamp((cycle - memory.swingStart) / Math.max(.001, 1 - memory.swingStart));
    // The trailing toes point down after push-off, then the ankle flexes
    // before its heel lands. A supporting sole always stays flat on the sand.
    return Math.sin((.12 + recovery * .88) * Math.PI) * mix(.48, -.20, ease(recovery)) * ease((speed - 35) / 80);
  });
  if (released?.snapshot.knees && releaseWeight > 0) {
    const source = released.snapshot;
    knees.forEach((joint, leg) => {
      const sourceHip = source.hips?.[leg] ?? { x: source.hip.x + (leg ? 4.5 : -4.5), y: source.hip.y };
      const upper = { x: joint.x - hips[leg].x, y: joint.y - hips[leg].y }, lower = { x: feet[leg].x - joint.x, y: feet[leg].y - joint.y };
      const sourceUpper = { x: source.knees![leg].x - sourceHip.x, y: source.knees![leg].y - sourceHip.y }, sourceLower = { x: source.feet[leg].x - source.knees![leg].x, y: source.feet[leg].y - source.knees![leg].y };
      const blendBone = (from: Point, to: Point) => {
        const angle = Math.atan2(from.y, from.x), end = Math.atan2(to.y, to.x), turn = angle + Math.atan2(Math.sin(end - angle), Math.cos(end - angle)) * releaseWeight;
        const length = mix(Math.hypot(from.x, from.y), Math.hypot(to.x, to.y), releaseWeight);
        return { x: Math.cos(turn) * length, y: Math.sin(turn) * length };
      };
      const thigh = blendBone(upper, sourceUpper), shin = blendBone(lower, sourceLower);
      Object.assign(joint, { x: hips[leg].x + thigh.x, y: hips[leg].y + thigh.y });
      feet[leg] = { x: joint.x + shin.x, y: joint.y + shin.y };
    });
    footAngles.forEach((angle, leg) => { footAngles[leg] = mix(angle, source.footAngles?.[leg] ?? 0, releaseWeight); });
  }
  const footPoint = (leg: number, point: Point) => { const p = rotate(point, footAngles[leg]); return { x: feet[leg].x + p.x, y: feet[leg].y + p.y }; };
  const bodyWidth = 18 + index % 3, shoulderWidth = bodyWidth * .43;
  // A grip turns the chest toward the opponent, bringing the far shoulder forward.
  // The receiving shoulder opens beneath the back before both arms press
  // overhead. Holding the far shoulder forward through this whole lift
  // brought its wrist through the shoulder and folded the elbow completely.
  const cradleShoulder = pose === 'scoopslam' && actor.gripMode === 'cradle' ? 1 - clamp(actor.scoopLoad ?? 0) * (1 - clamp(actor.scoopLift ?? 0)) : 1;
  const shoulderContact = spin || released && releaseWeight > 0 ? 0 : jointOverhead ? motion.contact * (1 - clamp(actor.overheadRaise ?? 1)) : anklePivot ? motion.contact * (1 - clamp(actor.ankleThrowProgress!)) : motion.contact * cradleShoulder;
  const shoulders = [mix(-shoulderWidth, 3.5, shoulderContact), shoulderWidth].map(offset => ({ x: offset * (casterPlane ? across.x : turnWidth), y: -20 - motion.shoulderLift + (casterPlane ? offset * across.y : 0) }));
  if (released?.snapshot.shoulders && releaseWeight > 0) shoulders.forEach((shoulder, arm) => Object.assign(shoulder, pointMix(shoulder, released.snapshot.shoulders![arm], releaseWeight)));
  if (actor.carrierRelease && (!actor.carrierRelease.stance || actor.carrierRelease.followThrough || actor.pivotTurn !== undefined && actor.gripMode === 'ankle')) {
    const source = actor.carrierRelease, weight = 1 - ease(clamp(source.progress));
    shoulders.forEach((shoulder, arm) => {
      const root = rotate({ x: source.shoulders[arm].x - x, y: source.shoulders[arm].y - (y - 2 * scale) }, -actor.angle);
      const local = rotate({ x: root.x / (scale * facing) - hip.x, y: root.y / scale - hip.y }, -lean);
      Object.assign(shoulder, pointMix(shoulder, local, weight));
    });
  }
  if (state.slamStart && (actor.spineDown ?? 0) > 0) shoulders.forEach((shoulder, arm) => Object.assign(shoulder, pointMix(state.slamStart!.shoulders[arm], shoulder, slump)));
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
  if (spin && !feetSpin) hands = [{ x: mix(10, -5, spinWeight), y: mix(-18.5, -37.5, spinWeight) }, { x: mix(20, 5, spinWeight), y: mix(-18.5, -37.5, spinWeight) }];
  if (released) hands = hands.map((hand, arm) => pointMix(hand, released.snapshot.hands[arm], releaseWeight));
  const overheadReach = pose === 'overhead' ? clamp(actor.overheadRaise ?? 1) * (1 - carrierSettle) : pose === 'scoop' ? ease((clamp(actor.scoopStroke ?? phase) - .18) / .54) : 0;
  const armRaise = jointOverhead ? 0 : overheadReach;
  const upperArm = mix(11, 14, armRaise), lowerArm = mix(10.5, 14, armRaise), armReach = mix(21.3, 27.8, armRaise);
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
      return knee(shoulders[arm], hand, upperArm, lowerArm, actor.bulldogProgress !== undefined ? arm === 0 ? -1 : 1 : arm === 0 ? 1 : -1);
    }
    if (!spin && actor.gripMode === 'wrist' && actor.pivotTurn !== undefined) {
      const low = knee(shoulders[arm], hand, 11, 10.5, 1), high = knee(shoulders[arm], hand, 11, 10.5, -1);
      return low.y > high.y ? low : high;
    }
    if (anklePivot) {
      // Open each elbow below and outside the chest while its two normal
      // bones turn smoothly from the actual floor pickup during loading.
      return knee(shoulders[arm], hand, upperArm, lowerArm, arm === 0 ? -1 : 1);
    }
    if (state.scoopAnkleMotion && actor.ankleApproach !== undefined && actor.gripMode === 'ankle' && !reset && state.contactPoints) {
      const choices = [1, -1].map(bend => knee(shoulders[arm], hand, upperArm, lowerArm, bend));
      const world = (joint: Point) => {
        const p = rotate(joint, lean), point = rotate({ x: (hip.x + p.x) * scale * facing, y: (hip.y + p.y) * scale }, actor.angle);
        return { x: x + point.x, y: y - 2 * scale + point.y };
      };
      const previous = state.contactPoints.elbows[arm], first = world(choices[0]), second = world(choices[1]);
      return Math.hypot(first.x - previous.x, first.y - previous.y) <= Math.hypot(second.x - previous.x, second.y - previous.y) ? choices[0] : choices[1];
    }
    if (jointOverhead || actor.ankleThrowProgress !== undefined || pose === 'drag' && actor.gripMode === 'ankle') return knee(shoulders[arm], hand, upperArm, lowerArm, arm === 0 ? 1 : -1);
    return knee(shoulders[arm], hand, upperArm, lowerArm, -Math.cos(Math.PI * (arm === 1 ? motion.clapTurn : motion.cheerTurn)));
  });
  if (carrying) {
    const armX = Math.min(4.6, bodyWidth * .43 * .58);
    hands = shoulders.map((shoulder, arm) => {
      const unfolding = carriedArm(shoulder, arm, shoulderCarry || cradleCarry ? 0 : stretch, armX, cradleCarry || spineCarry);
      if (actor.pairCarry) {
        const folded = { x: arm ? 12 : -10, y: arm ? -7 : -9 }, foldedElbow = knee(shoulder, folded, 11, 10.5, -1);
        const arc = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * stretch;
        const upperAngle = arc(Math.atan2(unfolding.elbow.y - shoulder.y, unfolding.elbow.x - shoulder.x), Math.atan2(foldedElbow.y - shoulder.y, foldedElbow.x - shoulder.x));
        const lowerAngle = arc(Math.atan2(unfolding.hand.y - unfolding.elbow.y, unfolding.hand.x - unfolding.elbow.x), Math.atan2(folded.y - foldedElbow.y, folded.x - foldedElbow.x));
        unfolding.elbow = { x: shoulder.x + Math.cos(upperAngle) * 11, y: shoulder.y + Math.sin(upperAngle) * 11 };
        unfolding.hand = { x: unfolding.elbow.x + Math.cos(lowerAngle) * 10.5, y: unfolding.elbow.y + Math.sin(lowerAngle) * 10.5 };
      }
      elbows[arm] = unfolding.elbow;
      if (freeCarry > 0) {
        const upperAngle = Math.atan2(unfolding.elbow.y - shoulder.y, unfolding.elbow.x - shoulder.x) + freeCarry * (arm ? -.12 : .20);
        const lowerAngle = Math.atan2(unfolding.hand.y - unfolding.elbow.y, unfolding.hand.x - unfolding.elbow.x) + freeCarry * (arm ? .30 : -.35);
        elbows[arm] = { x: shoulder.x + Math.cos(upperAngle) * 11, y: shoulder.y + Math.sin(upperAngle) * 11 };
        return { x: elbows[arm].x + Math.cos(lowerAngle) * 10.5, y: elbows[arm].y + Math.sin(lowerAngle) * 10.5 };
      }
      return unfolding.hand;
    });
  }
  if (state.carryStart) {
    const source = state.carryStart;
    const arc = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * carryMorph;
    hands = hands.map((_, arm) => {
      const restShoulder = { x: shoulders[arm].x, y: -20 }, restHand = scoopVictim ? { x: mix(arm ? 11 : -6, arm ? 12 : -11, scoopDown), y: mix(arm ? -22 : -16, -2, scoopDown) } : powerVictim ? { x: mix(arm ? 11 : -6, arm ? 12 : -11, powerDown), y: mix(arm ? -22 : -16, -2, powerDown) } : cradleCarry || spineCarry ? { x: arm ? 11 : -6, y: arm ? -22 : -16 } : actor.pairCarry ? { x: arm ? 12 : -10, y: arm ? -7 : -9 } : { x: arm ? 12 : -11, y: -2 }, restElbow = knee(restShoulder, restHand, 11, 10.5, -1);
      const upperAngle = arc(Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), Math.atan2(restElbow.y - restShoulder.y, restElbow.x - restShoulder.x));
      const lowerAngle = arc(Math.atan2(source.hands[arm].y - source.elbows[arm].y, source.hands[arm].x - source.elbows[arm].x), Math.atan2(restHand.y - restElbow.y, restHand.x - restElbow.x));
      elbows[arm] = { x: shoulders[arm].x + Math.cos(upperAngle) * upperArm, y: shoulders[arm].y + Math.sin(upperAngle) * upperArm };
      return { x: elbows[arm].x + Math.cos(lowerAngle) * lowerArm, y: elbows[arm].y + Math.sin(lowerAngle) * lowerArm };
    });
  }
  if (!actor.carrierRelease || reset || !state.carrierReleasing) state.carrierReleaseArcs = undefined;
  if (actor.carrierRelease) {
    const source = actor.carrierRelease;
    const lowRimRelease = !!actor.ankleRimToss && pose === 'throw' && actor.pivotTurn === undefined && actor.ankleThrowProgress !== undefined;
    const localDirection = (from: Point, to: Point) => {
      // A falling body can rotate past the shortest-arc boundary. A fixed
      // entry frame keeps its released arm's source angles on the same arc.
      const root = rotate({ x: to.x - from.x, y: to.y - from.y }, -(source.sourceAngle ?? actor.angle));
      const entryLean = source.sourceLean ?? (source.stance ? source.stance.lean * Math.PI / 180 : lean);
      return rotate({ x: root.x / (scale * facing), y: root.y / scale }, -entryLean);
    };
    const progress = clamp(source.progress), release = ease(progress / .30), retract = ease((progress - .30) / .70);
    const unwrap = (start: number, end: number) => start + Math.atan2(Math.sin(end - start), Math.cos(end - start));
    hands = shoulders.map((shoulder, arm) => {
      const upper = localDirection(source.shoulders[arm], source.elbows[arm]), lower = localDirection(source.elbows[arm], source.hands[arm]);
      // In the shared chest carry each helper releases upward in front of
      // their own chest. Sending one helper's follow-through toward the
      // world's exit side bent that supporting arm behind their torso.
      const throwSide = lowRimRelease ? source.direction * facing : source.stance ? 1 : source.direction * facing;
      const through = source.followThrough && localDirection({ x: 0, y: 0 }, source.followThrough);
      const reach = through && Math.hypot(through.x, through.y);
      const followHand = lowRimRelease
        ? { x: shoulder.x + throwSide * (arm ? 17 : 15), y: shoulder.y + (arm ? 9 : 11) }
        : through && reach
        ? { x: shoulder.x + through.x / reach * (arm ? 19.5 : 17.5), y: shoulder.y + through.y / reach * (arm ? 19.5 : 17.5) }
        : { x: shoulder.x + throwSide * (arm ? 16 : 13), y: shoulder.y - (arm ? 12 : 14) };
      const followElbow = lowRimRelease
        ? [1, -1].map(bend => knee(shoulder, followHand, 11, 10.5, bend)).reduce((lower, joint) => joint.y > lower.y ? joint : lower)
        : knee(shoulder, followHand, 11, 10.5, arm ? -1 : 1);
      const restShoulder = { x: shoulder.x, y: -20 }, restHand = { x: arm ? 15 : -5, y: arm ? -15 : -12 };
      const restElbow = knee(restShoulder, restHand, 11, 10.5, -1);
      const sharedRelease = actor.pairLift !== undefined && (actor.gripMode === 'shoulder' || actor.gripMode === 'ankle') && !source.followThrough;
      if (sharedRelease) {
        // A shared heave opens the supported elbow, then brings that same
        // palm back to guard. Interpolating the two bones independently
        // folded the forearm all the way through the upper arm on return.
        const startHand = { x: upper.x + lower.x, y: upper.y + lower.y };
        const follow = { x: followHand.x - shoulder.x, y: followHand.y - shoulder.y };
        const rest = { x: restHand.x - restShoulder.x, y: restHand.y - restShoulder.y };
        const startAngle = Math.atan2(startHand.y, startHand.x), followAngle = unwrap(startAngle, Math.atan2(follow.y, follow.x));
        const restAngle = unwrap(followAngle, Math.atan2(rest.y, rest.x));
        const angle = mix(mix(startAngle, followAngle, release), restAngle, retract);
        const radius = mix(mix(Math.hypot(startHand.x, startHand.y), Math.hypot(follow.x, follow.y), release), Math.hypot(rest.x, rest.y), retract);
        const palm = { x: shoulder.x + Math.cos(angle) * radius, y: shoulder.y + Math.sin(angle) * radius };
        const startSolutions = [1, -1].map(bend => ({ bend, point: knee({ x: 0, y: 0 }, startHand, upperArm, lowerArm, bend) }));
        const bend = startSolutions.reduce((nearest, candidate) => Math.hypot(candidate.point.x - upper.x, candidate.point.y - upper.y) < Math.hypot(nearest.point.x - upper.x, nearest.point.y - upper.y) ? candidate : nearest).bend;
        elbows[arm] = knee(shoulder, palm, upperArm, lowerArm, bend);
        return palm;
      }
      const startUpper = Math.atan2(upper.y, upper.x), startLower = Math.atan2(lower.y, lower.x);
      const arcs = source.followThrough ? state.carrierReleaseArcs?.[arm] : undefined;
      const followUpper = unwrap(arcs?.follow[0] ?? startUpper, Math.atan2(followElbow.y - shoulder.y, followElbow.x - shoulder.x));
      const followLower = unwrap(arcs?.follow[1] ?? startLower, Math.atan2(followHand.y - followElbow.y, followHand.x - followElbow.x));
      const restUpper = unwrap(arcs?.rest[0] ?? followUpper, Math.atan2(restElbow.y - restShoulder.y, restElbow.x - restShoulder.x));
      const restLower = unwrap(arcs?.rest[1] ?? followLower, Math.atan2(restHand.y - restElbow.y, restHand.x - restElbow.x));
      if (source.followThrough) {
        state.carrierReleaseArcs ??= [];
        // Shoulder recovery moves the resting IK endpoint. Keep the same
        // angular branch chosen at release instead of taking a new shortest
        // arc when the forearm crosses the opposite side of its circle.
        state.carrierReleaseArcs[arm] = { follow: [followUpper, followLower], rest: [restUpper, restLower] };
      }
      const upperAngle = mix(mix(startUpper, followUpper, release), restUpper, retract);
      const lowerAngle = mix(mix(startLower, followLower, release), restLower, retract);
      elbows[arm] = { x: shoulder.x + Math.cos(upperAngle) * upperArm, y: shoulder.y + Math.sin(upperAngle) * upperArm };
      return { x: elbows[arm].x + Math.cos(lowerAngle) * lowerArm, y: elbows[arm].y + Math.sin(lowerAngle) * lowerArm };
    });
  }
  if (state.slamStart) {
    const source = state.slamStart;
    const arc = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * slump;
    hands = hands.map((_, arm) => {
      const restShoulder = { x: (actor.spineDown ?? 0) > 0 ? (arm ? shoulderWidth : -shoulderWidth) * turnWidth : shoulders[arm].x, y: -20 }, restHand = { x: arm ? 12 : -11, y: -2 }, restElbow = knee(restShoulder, restHand, 11, 10.5, -1);
      const upperAngle = arc(Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), Math.atan2(restElbow.y - restShoulder.y, restElbow.x - restShoulder.x));
      const lowerAngle = arc(Math.atan2(source.hands[arm].y - source.elbows[arm].y, source.hands[arm].x - source.elbows[arm].x), Math.atan2(restHand.y - restElbow.y, restHand.x - restElbow.x));
      elbows[arm] = { x: shoulders[arm].x + Math.cos(upperAngle) * upperArm, y: shoulders[arm].y + Math.sin(upperAngle) * upperArm };
      return { x: elbows[arm].x + Math.cos(lowerAngle) * lowerArm, y: elbows[arm].y + Math.sin(lowerAngle) * lowerArm };
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
  if (actor.clotheslineTarget && !actor.clotheslineInner && (actor.clotheslineStrength ?? 1) > 0) {
    const arm = actor.clotheslineArm ?? 1, strength = clamp(actor.clotheslineStrength ?? 1);
    const root = rotate({ x: actor.clotheslineTarget.x - x, y: actor.clotheslineTarget.y - (y - 2 * scale) }, -actor.angle);
    const localTarget = rotate({ x: root.x / (scale * facing) - hip.x, y: root.y / scale - hip.y }, -lean);
    // Each runner strikes with their own nearly straight arm. The other arm
    // keeps the running rhythm; neither hand is attached to the teammate.
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
  if (released?.snapshot.elbows && releaseWeight > 0) {
    const source = released.snapshot;
    hands = hands.map((hand, arm) => {
      const fromUpper = Math.atan2(elbows[arm].y - shoulders[arm].y, elbows[arm].x - shoulders[arm].x);
      const fromLower = Math.atan2(hand.y - elbows[arm].y, hand.x - elbows[arm].x);
      const sourceShoulder = source.shoulders?.[arm] ?? { x: shoulders[arm].x, y: -20 - source.motion.shoulderLift };
      const toUpper = Math.atan2(source.elbows![arm].y - sourceShoulder.y, source.elbows![arm].x - sourceShoulder.x);
      const toLower = Math.atan2(source.hands[arm].y - source.elbows![arm].y, source.hands[arm].x - source.elbows![arm].x);
      const upperAngle = fromUpper + Math.atan2(Math.sin(toUpper - fromUpper), Math.cos(toUpper - fromUpper)) * releaseWeight;
      const lowerAngle = fromLower + Math.atan2(Math.sin(toLower - fromLower), Math.cos(toLower - fromLower)) * releaseWeight;
      elbows[arm] = { x: shoulders[arm].x + Math.cos(upperAngle) * upperArm, y: shoulders[arm].y + Math.sin(upperAngle) * upperArm };
      return { x: elbows[arm].x + Math.cos(lowerAngle) * lowerArm, y: elbows[arm].y + Math.sin(lowerAngle) * lowerArm };
    });
  }
  const bodyPoint = (point: Point): Point => { const p = rotate(point, lean); return { x: hip.x + p.x, y: hip.y + p.y }; };
  const torsoPoint = (point: Point): Point => bodyPoint({ x: point.x * turnWidth, y: point.y });
  const shortPanel = (origin: Point, leg: number) => {
    const length = Math.max(.1, Math.hypot(knees[leg].x - origin.x, knees[leg].y - origin.y));
    const direction = { x: (knees[leg].x - origin.x) / length, y: (knees[leg].y - origin.y) / length };
    const normal = { x: direction.y, y: -direction.x };
    const top = { x: origin.x - direction.x * 1.4, y: origin.y - direction.y * 1.4 };
    const cuff = Math.min(6.4, Math.max(.4, length - 1.2));
    const hem = { x: origin.x + direction.x * cuff, y: origin.y + direction.y * cuff };
    const edge = (point: Point, width: number, side: number) => ({ x: point.x + normal.x * width * side, y: point.y + normal.y * width * side });
    return { direction, normal, points: [edge(top, 4.3, -1), edge(top, 4.3, 1), edge(hem, 3.8, 1), edge(hem, 3.8, -1)] };
  };
  const shorts = hips.map(shortPanel);
  const waist = [torsoPoint({ x: -bodyWidth / 2, y: -4.3 }), torsoPoint({ x: bodyWidth / 2, y: -4.3 }), torsoPoint({ x: bodyWidth / 2, y: -1.7 }), torsoPoint({ x: -bodyWidth / 2, y: -1.7 })];
  const crotch = { x: hip.x, y: hip.y + 4 };
  // A deep forward bend can put a rotated belt corner below the unrotated
  // hip. Connecting them in standing order crosses the fabric edges, leaving
  // triangular gaps in a dragger's shorts. Join the same outer fabric points
  // without crossing; the two separate cuffs still follow their own thighs.
  const fabric = [...waist, { x: hip.x + 8.6 * turnWidth, y: hip.y + 3 }, crotch, { x: hip.x - 8.6 * turnWidth, y: hip.y + 3 }].sort((a, b) => a.x - b.x || a.y - b.y);
  const fabricTurn = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const fabricEdge = (points: Point[]) => {
    const edge: Point[] = [];
    points.forEach(point => { while (edge.length >= 2 && fabricTurn(edge[edge.length - 2], edge[edge.length - 1], point) <= 0) edge.pop(); edge.push(point); });
    return edge;
  };
  const yoke = [...fabricEdge(fabric).slice(0, -1), ...fabricEdge([...fabric].reverse()).slice(0, -1)];
  const headWidth = [14, 15, 14, 16][personality], headY = -33 - index % 2 + overheadReach * (jointOverhead ? 7 : 5);
  let rootX = x, rootY = y - 2 * scale, pivotY = 0;
  if (air && pose !== 'sidekick' && pose !== 'held' && !superman && !dropkick) {
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
    const suspension = Math.max(clamp(actor.suspension ?? 0), powerVictim ? 1 - powerDown : scoopVictim ? 1 - scoopDown : 0);
    rootX = mix(x, x - Math.sin(actor.angle) * pivotY * scale, suspension);
    rootY = mix(rootY, y - 2 * scale + Math.cos(actor.angle) * pivotY * scale, suspension);
  }
  let matrix: Matrix = [Math.cos(actor.angle) * scale * facing, Math.sin(actor.angle) * scale * facing, -Math.sin(actor.angle) * scale, Math.cos(actor.angle) * scale, rootX + Math.sin(actor.angle) * scale * pivotY, rootY - Math.cos(actor.angle) * scale * pivotY];
  if (dropkick) {
    // Rotate the airborne torso about its pelvis. The soles extend forward
    // while the head stays behind them; a ground-marker rotation would move
    // the hip out of reach and make both feet miss their captured chest.
    matrix[4] = x + hip.x * scale * facing - matrix[0] * hip.x - matrix[2] * hip.y;
    matrix[5] = y - 2 * scale + hip.y * scale - matrix[1] * hip.x - matrix[3] * hip.y;
  }
  if (spin && feetSpin) {
    const center = pointMix(spin.grips[0], spin.grips[1], .5), flat = clamp(spin.flatness);
    const outward = { x: Math.cos(spin.orbit) * flat, y: mix(1, Math.sin(spin.orbit) * .45, flat) };
    const targetAngle = Math.atan2(outward.x, -outward.y), difference = Math.atan2(Math.sin(targetAngle - actor.angle), Math.cos(targetAngle - actor.angle));
    const bodyAngle = actor.angle + difference * spinWeight;
    // Two palms encircle one ankle. Their separation must not become the
    // width of the victim's torso or shorten either complete leg section.
    matrix = [Math.cos(bodyAngle) * scale * facing, Math.sin(bodyAngle) * scale * facing, -Math.sin(bodyAngle) * scale, Math.cos(bodyAngle) * scale, 0, 0];
    if (spin.planar) {
      // The feet travel around a readable ellipse. Its complete front and
      // back halves keep the held body visible while the actual ankles
      // remain anchored to the two palms.
      const projection = arenaAnkleSwingProjection(spin.orbit);
      const target = projection.angle;
      const turn = actor.angle + Math.atan2(Math.sin(target - actor.angle), Math.cos(target - actor.angle)) * spinWeight;
      const width = mix(1, projection.width, spinWeight), length = mix(1, projection.length, spinWeight);
      matrix = [Math.cos(turn) * scale * facing * width, Math.sin(turn) * scale * facing * width, -Math.sin(turn) * scale * length, Math.cos(turn) * scale * length, 0, 0];
    }
    const anchor = spin.gripBoth ? pointMix(feet[0], feet[1], .5) : feet[caughtFoot];
    matrix[4] = center.x - matrix[0] * anchor.x - matrix[2] * anchor.y;
    matrix[5] = center.y - matrix[1] * anchor.x - matrix[3] * anchor.y;
  } else if (spin) {
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
    if (released.snapshot.elbows) {
      const sourceAngle = Math.atan2(source[1] / facing, source[0] / facing);
      const angle = actor.angle + Math.atan2(Math.sin(sourceAngle - actor.angle), Math.cos(sourceAngle - actor.angle)) * releaseWeight;
      matrix[0] = Math.cos(angle) * scale * facing; matrix[1] = Math.sin(angle) * scale * facing;
      const width = released.snapshot.planar ? mix(1, Math.hypot(source[0], source[1]) / scale, releaseWeight) : 1;
      const length = released.snapshot.planar ? mix(1, Math.hypot(source[2], source[3]) / scale, releaseWeight) : 1;
      matrix[0] *= width; matrix[1] *= width;
      matrix[2] = -Math.sin(angle) * scale * length; matrix[3] = Math.cos(angle) * scale * length;
    }
  }
  if (spin && feetSpin && spin.gripBoth) {
    // During the pickup the two supporting arms do not move as one rigid
    // bar. Each ankle follows its own palm, with normal knees absorbing
    // their changing separation instead of stretching the whole body.
    const hold = arenaAnkleFootHold(matrix, hips, spin.grips);
    if (hold) {
      matrix = hold.matrix; feet = hold.feet;
      feet.forEach((foot, leg) => {
        const previous = state.skeleton?.knees[leg] ?? knees[leg];
        const choices = [1, -1].map(bend => knee(hips[leg], foot, 11, 11, bend));
        knees[leg] = choices.reduce((nearest, candidate) => Math.hypot(candidate.x - previous.x, candidate.y - previous.y) < Math.hypot(nearest.x - previous.x, nearest.y - previous.y) ? candidate : nearest);
        const angle = Math.atan2(foot.y - knees[leg].y, foot.x - knees[leg].x) - Math.PI / 2;
        const from = state.skeleton?.footAngles[leg] ?? footAngles[leg];
        footAngles[leg] = from + Math.atan2(Math.sin(angle - from), Math.cos(angle - from));
        Object.assign(shorts[leg], shortPanel(hips[leg], leg));
      });
      state.localFeet = feet;
    }
  }
  state.skeleton = { hips, knees, feet, footAngles: [...footAngles], shorts: shorts.map(panel => panel.points), pelvis: yoke };
  const worldPoint = (point: Point): Point => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
  const supportedSlam = state.slamStart && (actor.spineDown ?? 0) > 0 && actor.gripMode === 'waist';
  const cradleGrip = pose === 'scoopslam' && actor.gripMode === 'cradle';
  const powerGrip = powerbomb && actor.gripMode === 'waist';
  if ((supportedSlam || cradleGrip || powerGrip) && actor.gripTarget && actor.secondaryGripTarget) {
    const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2], strength = clamp(actor.gripStrength ?? 1);
    const targets = [actor.secondaryGripTarget, actor.gripTarget];
    if (reset) state.supportedGripArms = undefined;
    state.supportedGripArms ??= [];
    hands = hands.map((hand, arm) => {
      const point = targets[arm], dx = point.x - matrix[4], dy = point.y - matrix[5];
      const local = rotate({ x: (matrix[3] * dx - matrix[2] * dy) / determinant - hip.x, y: (-matrix[1] * dx + matrix[0] * dy) / determinant - hip.y }, -lean);
      const shoulder = shoulders[arm], supported = reachable(shoulder, local, upperArm + lowerArm - .02, Math.abs(upperArm - lowerArm) + .02), memory = state.supportedGripArms![arm];
      const unwrap = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
      const freeHand = cradleGrip || powerGrip ? reachable(shoulder, { x: arm ? motion.frontX : motion.backX, y: arm ? motion.frontY : motion.backY }, upperArm + lowerArm - .02, Math.abs(upperArm - lowerArm) + .02) : hand;
      const freeElbow = cradleGrip || powerGrip ? knee(shoulder, freeHand, upperArm, lowerArm, -1) : elbows[arm];
      const free = [Math.atan2(freeElbow.y - shoulder.y, freeElbow.x - shoulder.x), Math.atan2(freeHand.y - freeElbow.y, freeHand.x - freeElbow.x)].map((angle, bone) => memory ? unwrap(memory.free[bone], angle) : angle) as [number, number];
      const releasing = strength < (memory?.strength ?? 1) - 1e-6 || !!memory?.releasing && strength <= (memory.strength ?? 1) + 1e-6;
      const solutions = (memory ? [memory.bend] : [1, -1]).map(bend => {
        const joint = knee(shoulder, supported, upperArm, lowerArm, bend);
        const held = [Math.atan2(joint.y - shoulder.y, joint.x - shoulder.x), Math.atan2(supported.y - joint.y, supported.x - joint.x)].map((angle, bone) => unwrap(memory?.held[bone] ?? free[bone], angle)) as [number, number];
        const resting = releasing && !memory?.releasing ? free.map((angle, bone) => unwrap(held[bone], angle)) as [number, number] : free;
        const upper = mix(resting[0], held[0], strength), lower = mix(resting[1], held[1], strength);
        const elbow = { x: shoulder.x + Math.cos(upper) * upperArm, y: shoulder.y + Math.sin(upper) * upperArm };
        const palm = { x: elbow.x + Math.cos(lower) * lowerArm, y: elbow.y + Math.sin(lower) * lowerArm };
        return { elbow, palm, free: resting, held, bend, world: worldPoint(bodyPoint(elbow)) };
      });
      const first = solutions[0], second = solutions[1] ?? first, previous = !reset ? state.contactPoints?.elbows[arm] : undefined;
      const chosen = previous && Math.hypot(second.world.x - previous.x, second.world.y - previous.y) < Math.hypot(first.world.x - previous.x, first.world.y - previous.y) ? second : first;
      elbows[arm] = chosen.elbow;
      state.supportedGripArms![arm] = { free: chosen.free, held: chosen.held, bend: chosen.bend, releasing, strength };
      return chosen.palm;
    });
  } else state.supportedGripArms = undefined;
  const turningArms = state.anklePivotArms ?? state.pairReach?.arms ?? state.ankleReach ?? state.landingArms;
  if (turningArms) {
    // Grounded turns and the scoop's ankle reach carry the preceding arms
    // through the direction change with complete upper and lower bones.
    const source = turningArms, progress = state.anklePivotArms ? ease(ankleRimToss ? actor.ankleSpinRaise ?? 0 : actor.ankleThrowProgress ?? 1) : state.pairReach ? clamp(actor.pairReach ?? 1) : state.ankleReach ? clamp(actor.ankleApproach ?? 1) : ease((clock - source.at) / 180);
    const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
    const bodyLocal = (point: Point) => {
      const dx = point.x - matrix[4], dy = point.y - matrix[5];
      return rotate({ x: (matrix[3] * dx - matrix[2] * dy) / determinant - hip.x, y: (-matrix[1] * dx + matrix[0] * dy) / determinant - hip.y }, -lean);
    };
    hands = hands.map((hand, arm) => {
      const targetShoulder = worldPoint(bodyPoint(shoulders[arm])), targetElbow = worldPoint(bodyPoint(elbows[arm])), targetHand = worldPoint(bodyPoint(hand));
      const startUpper = Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), startLower = Math.atan2(source.hands[arm].y - source.elbows[arm].y, source.hands[arm].x - source.elbows[arm].x);
      if (state.pairReach) {
        // Reach with one connected palm path. Separate upper/forearm angle
        // blends could close the elbow completely while picking up the body.
        const from = { x: source.hands[arm].x - source.shoulders[arm].x, y: source.hands[arm].y - source.shoulders[arm].y };
        const to = { x: targetHand.x - targetShoulder.x, y: targetHand.y - targetShoulder.y };
        const fromElbow = { x: source.elbows[arm].x - source.shoulders[arm].x, y: source.elbows[arm].y - source.shoulders[arm].y };
        const toElbow = { x: targetElbow.x - targetShoulder.x, y: targetElbow.y - targetShoulder.y };
        const branch = (palm: Point, elbow: Point) => -Math.sign(palm.x * elbow.y - palm.y * elbow.x) || -facing;
        const fromBend = branch(from, fromElbow), toBend = branch(to, toElbow);
        const startAngle = Math.atan2(from.y, from.x), angle = startAngle + Math.atan2(Math.sin(Math.atan2(to.y, to.x) - startAngle), Math.cos(Math.atan2(to.y, to.x) - startAngle)) * progress;
        const reach = mix(Math.hypot(from.x, from.y), Math.hypot(to.x, to.y), progress);
        const radius = fromBend === toBend ? reach : mix(reach, (upperArm + lowerArm - .02) * scale, Math.sin(progress * Math.PI) ** 2);
        const shoulder = pointMix({ x: source.shoulders[arm].x + x - source.root.x, y: source.shoulders[arm].y + y - source.root.y }, targetShoulder, progress);
        const palm = { x: shoulder.x + Math.cos(angle) * radius, y: shoulder.y + Math.sin(angle) * radius };
        const elbow = knee(shoulder, palm, upperArm * scale, lowerArm * scale, progress < .5 ? fromBend : toBend);
        Object.assign(shoulders[arm], bodyLocal(shoulder)); Object.assign(elbows[arm], bodyLocal(elbow));
        return bodyLocal(palm);
      }
      const targetAngles = [Math.atan2(targetElbow.y - targetShoulder.y, targetElbow.x - targetShoulder.x), Math.atan2(targetHand.y - targetElbow.y, targetHand.x - targetElbow.x)];
      targetAngles.forEach((angle, bone) => {
        const previous = source.angles[arm][bone], turn = Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
        const limit = state.scoopAnkleMotion && actor.pivotTurn === undefined && !actor.carrierRelease ? delta / 1000 * 8 : Math.PI;
        source.angles[arm][bone] = previous + Math.max(-limit, Math.min(limit, turn));
      });
      const upperAngle = mix(startUpper, source.angles[arm][0], progress), lowerAngle = mix(startLower, source.angles[arm][1], progress);
      const shoulder = pointMix({ x: source.shoulders[arm].x + x - source.root.x, y: source.shoulders[arm].y + y - source.root.y }, targetShoulder, progress);
      const elbow = { x: shoulder.x + Math.cos(upperAngle) * upperArm * scale, y: shoulder.y + Math.sin(upperAngle) * upperArm * scale };
      const palm = { x: elbow.x + Math.cos(lowerAngle) * lowerArm * scale, y: elbow.y + Math.sin(lowerAngle) * lowerArm * scale };
      Object.assign(shoulders[arm], bodyLocal(shoulder)); Object.assign(elbows[arm], bodyLocal(elbow));
      return bodyLocal(palm);
    });
  }
  if (actor.ankleSpinRaise !== undefined && !actor.carrierRelease && actor.gripMode === 'ankle' && actor.gripTarget && actor.secondaryGripTarget) {
    const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2], targets = [actor.secondaryGripTarget, actor.gripTarget];
    hands = hands.map((_, arm) => {
      const point = targets[arm], dx = point.x - matrix[4], dy = point.y - matrix[5];
      const local = rotate({ x: (matrix[3] * dx - matrix[2] * dy) / determinant - hip.x, y: (-matrix[1] * dx + matrix[0] * dy) / determinant - hip.y }, -lean);
      const shoulder = shoulders[arm], palm = reachable(shoulder, local, upperArm + lowerArm - .02, Math.abs(upperArm - lowerArm) + .02);
      const choices = [1, -1].map(bend => knee(shoulder, palm, upperArm, lowerArm, bend));
      const previous = !reset ? state.contactPoints?.elbows[arm] : undefined;
      // A rising ankle can pass beside its holder's shoulder. Keep the
      // preceding elbow around that small IK circle instead of flipping
      // to the other side as the palm passes above the shoulder.
      const chosen = ankleRimToss ? choices[1] : previous ? choices.reduce((nearest, candidate) => {
        const a = worldPoint(bodyPoint(nearest)), b = worldPoint(bodyPoint(candidate));
        return Math.hypot(b.x - previous.x, b.y - previous.y) < Math.hypot(a.x - previous.x, a.y - previous.y) ? candidate : nearest;
      }) : choices[arm ? 1 : 0];
      if (ankleRimToss && state.anklePivotArms) {
        const source = state.anklePivotArms, progress = ease(actor.ankleSpinRaise!);
        const worldShoulder = worldPoint(bodyPoint(shoulder)), worldElbow = worldPoint(bodyPoint(chosen)), worldPalm = worldPoint(bodyPoint(palm));
        const from: [number, number] = [Math.atan2(source.elbows[arm].y - source.shoulders[arm].y, source.elbows[arm].x - source.shoulders[arm].x), Math.atan2(source.hands[arm].y - source.elbows[arm].y, source.hands[arm].x - source.elbows[arm].x)];
        const raw = [Math.atan2(worldElbow.y - worldShoulder.y, worldElbow.x - worldShoulder.x), Math.atan2(worldPalm.y - worldElbow.y, worldPalm.x - worldElbow.x)];
        const previous = state.ankleRimAngles?.[arm] ?? from;
        const target = raw.map((angle, bone) => previous[bone] + Math.atan2(Math.sin(angle - previous[bone]), Math.cos(angle - previous[bone]))) as [number, number];
        state.ankleRimAngles ??= []; state.ankleRimAngles[arm] = target;
        const upper = mix(from[0], target[0], progress), lower = mix(from[1], target[1], progress);
        const elbow = { x: worldShoulder.x + Math.cos(upper) * upperArm * scale, y: worldShoulder.y + Math.sin(upper) * upperArm * scale };
        const hand = { x: elbow.x + Math.cos(lower) * lowerArm * scale, y: elbow.y + Math.sin(lower) * lowerArm * scale };
        const localPoint = (point: Point) => {
          const dx = point.x - matrix[4], dy = point.y - matrix[5];
          return rotate({ x: (matrix[3] * dx - matrix[2] * dy) / determinant - hip.x, y: (-matrix[1] * dx + matrix[0] * dy) / determinant - hip.y }, -lean);
        };
        elbows[arm] = localPoint(elbow);
        return localPoint(hand);
      }
      elbows[arm] = chosen;
      return palm;
    });
  }
  if (actor.gripMode === 'head' && actor.gripTarget && actor.secondaryGripTarget) {
    const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2], strength = clamp(actor.gripStrength ?? 1);
    const targets = [actor.secondaryGripTarget, actor.gripTarget];
    if (reset) state.headGripArms = undefined;
    state.headGripArms ??= [];
    hands = hands.map((hand, arm) => {
      const point = targets[arm], dx = point.x - matrix[4], dy = point.y - matrix[5];
      const raw = { x: (matrix[3] * dx - matrix[2] * dy) / determinant, y: (-matrix[1] * dx + matrix[0] * dy) / determinant };
      const local = rotate({ x: raw.x - hip.x, y: raw.y - hip.y }, -lean);
      const shoulder = shoulders[arm];
      const supported = reachable(shoulder, local, upperArm + lowerArm - .02, Math.abs(upperArm - lowerArm) + .02);
      // Solve the complete head hold and the complete resting arm separately.
      // A palm lerped through its shoulder collapsed the IK circle and swung
      // the elbow around its inner pole while the two bodies fell.
      const freeHand = state.slamStart || turningArms ? hand : reachable(shoulder, { x: arm ? motion.frontX : motion.backX, y: arm ? motion.frontY : motion.backY }, upperArm + lowerArm - .02, Math.abs(upperArm - lowerArm) + .02);
      const freeElbow = state.slamStart || turningArms ? elbows[arm] : knee(shoulder, freeHand, upperArm, lowerArm, -1);
      const memory = state.headGripArms![arm];
      const unwrap = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
      const rawFree = [Math.atan2(freeElbow.y - shoulder.y, freeElbow.x - shoulder.x), Math.atan2(freeHand.y - freeElbow.y, freeHand.x - freeElbow.x)] as [number, number];
      const free = rawFree.map((angle, bone) => memory ? unwrap(memory.free[bone], angle) : angle) as [number, number];
      const solutions = (memory ? [memory.bend] : [1, -1]).map(bend => {
        const heldElbow = knee(shoulder, supported, upperArm, lowerArm, bend);
        const rawHeld = [Math.atan2(heldElbow.y - shoulder.y, heldElbow.x - shoulder.x), Math.atan2(supported.y - heldElbow.y, supported.x - heldElbow.x)] as [number, number];
        const held = rawHeld.map((angle, bone) => unwrap(memory?.held[bone] ?? free[bone], angle)) as [number, number];
        const upper = mix(free[0], held[0], strength), lower = mix(free[1], held[1], strength);
        const elbow = { x: shoulder.x + Math.cos(upper) * upperArm, y: shoulder.y + Math.sin(upper) * upperArm };
        const palm = { x: elbow.x + Math.cos(lower) * lowerArm, y: elbow.y + Math.sin(lower) * lowerArm };
        return { elbow, palm, world: worldPoint(bodyPoint(elbow)), free, held, bend };
      });
      const first = solutions[0], second = solutions[1] ?? first;
      const previous = !reset ? state.contactPoints?.elbows[arm] : undefined;
      // Keep the same elbow bend as both wrestlers rotate toward the floor.
      // Choosing whichever elbow is highest flips the arm halfway through.
      const chosen = previous
        ? Math.hypot(first.world.x - previous.x, first.world.y - previous.y) <= Math.hypot(second.world.x - previous.x, second.world.y - previous.y) ? first : second
        : actor.bulldogHeadlock && arm === 1
          ? first.world.x * facing >= second.world.x * facing ? first : second
          : first.world.y <= second.world.y ? first : second;
      elbows[arm] = chosen.elbow;
      state.headGripArms![arm] = { free: chosen.free, held: chosen.held, bend: chosen.bend };
      return chosen.palm;
    });
  } else state.headGripArms = undefined;
  if (actor.clotheslineInner && actor.clotheslineTarget && (actor.clotheslineStrength ?? 0) > 0) {
    // The neck meets the inside elbow and the beginning of the forearm.
    // The fist continues past it; a palm target alone reads as a punch.
    const arm = actor.clotheslineArm ?? 1, strength = clamp(actor.clotheslineStrength ?? 0);
    const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
    const dx = actor.clotheslineTarget.x - matrix[4], dy = actor.clotheslineTarget.y - matrix[5];
    const raw = { x: (matrix[3] * dx - matrix[2] * dy) / determinant, y: (-matrix[1] * dx + matrix[0] * dy) / determinant };
    const local = rotate({ x: raw.x - hip.x, y: raw.y - hip.y }, -lean), shoulder = shoulders[arm];
    if (reset) state.clotheslineAngles = undefined;
    const memory = state.clotheslineAngles;
    const unwrap = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
    const rawFree = [Math.atan2(elbows[arm].y - shoulder.y, elbows[arm].x - shoulder.x), Math.atan2(hands[arm].y - elbows[arm].y, hands[arm].x - elbows[arm].x)];
    const free = rawFree.map((angle, bone) => memory ? unwrap(memory.free[bone], angle) : angle) as [number, number];
    const upper = Math.atan2(local.y - shoulder.y, local.x - shoulder.x);
    const strike = [upper, upper + .18].map((angle, bone) => unwrap(memory?.strike[bone] ?? free[bone], angle)) as [number, number];
    const upperAngle = mix(free[0], strike[0], strength), lowerAngle = mix(free[1], strike[1], strength);
    elbows[arm] = { x: shoulder.x + Math.cos(upperAngle) * upperArm, y: shoulder.y + Math.sin(upperAngle) * upperArm };
    hands[arm] = { x: elbows[arm].x + Math.cos(lowerAngle) * lowerArm, y: elbows[arm].y + Math.sin(lowerAngle) * lowerArm };
    state.clotheslineAngles = { free, strike };
  } else state.clotheslineAngles = undefined;
  if (actor.clotheslineInner && !reset && state.contactPoints) {
    // Opening behind the shoulder passes close to the arm's inner radius.
    // Rotate both complete bones from the painted arm instead of allowing
    // the free-hand IK to switch its elbow across the torso in one frame.
    const arm = actor.clotheslineArm ?? 1, previous = state.contactPoints;
    const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
    const localDirection = (from: Point, to: Point) => {
      const dx = to.x - from.x, dy = to.y - from.y;
      return rotate({ x: (matrix[3] * dx - matrix[2] * dy) / determinant, y: (-matrix[1] * dx + matrix[0] * dy) / determinant }, -lean);
    };
    const upper = localDirection(previous.shoulders[arm], previous.elbows[arm]), lower = localDirection(previous.elbows[arm], previous.hands[arm]);
    const turn = (from: Point, to: Point) => {
      const start = Math.atan2(from.y, from.x), target = Math.atan2(to.y, to.x);
      const gap = Math.atan2(Math.sin(target - start), Math.cos(target - start));
      return start + Math.max(-delta * .008, Math.min(delta * .008, gap));
    };
    const upperAngle = turn(upper, { x: elbows[arm].x - shoulders[arm].x, y: elbows[arm].y - shoulders[arm].y });
    const lowerAngle = turn(lower, { x: hands[arm].x - elbows[arm].x, y: hands[arm].y - elbows[arm].y });
    elbows[arm] = { x: shoulders[arm].x + Math.cos(upperAngle) * upperArm, y: shoulders[arm].y + Math.sin(upperAngle) * upperArm };
    hands[arm] = { x: elbows[arm].x + Math.cos(lowerAngle) * lowerArm, y: elbows[arm].y + Math.sin(lowerAngle) * lowerArm };
  }
  const projectedOrigin = spin || released && releaseWeight > 0 ? worldPoint({ x: 0, y: 0 }) : { x, y: y - 2 * scale };
  const origin = { x: projectedOrigin.x, y: projectedOrigin.y + 2 * scale };
  ctx.save(); ctx.globalAlpha = actor.alpha;
  if (pose !== 'airborne') { ctx.fillStyle = '#25302d40'; ctx.beginPath(); ctx.ellipse(origin.x, (actor.depthY ?? y) + 2, 16 * scale, 3.5 * scale, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.transform?.(...matrix);
  const headTop = rotate({ x: 0, y: -12 }, motion.head * Math.PI / 180);
  const headSides = [-1, 1].map(side => { const point = rotate({ x: side * (headWidth / 2 + .5), y: 0 }, motion.head * Math.PI / 180); return worldPoint(torsoPoint({ x: point.x, y: headY + point.y })); }) as [Point, Point];
  // The same two temples keep their contact indices while this ground turn
  // changes the face direction; their painted positions remain unchanged.
  if (state.scoopAnkleReversed) headSides.reverse();
  state.contactPoints = { origin, head: worldPoint(torsoPoint({ x: headTop.x, y: headY + headTop.y })), headSides, back: worldPoint(torsoPoint({ x: 0, y: -18 })), shoulders: shoulders.map(shoulder => worldPoint(bodyPoint(shoulder))), elbows: elbows.map(elbow => worldPoint(bodyPoint(elbow))), hands: hands.map(hand => worldPoint(bodyPoint(hand))), waist: worldPoint(torsoPoint({ x: 0, y: -4 })), feet: feet.map(worldPoint) };
  state.rig = { motion: { ...motion }, hip: { ...hip }, feet: feet.map(foot => ({ ...foot })) as [Point, Point], shoulders: shoulders.map(point => ({ ...point })), elbows: elbows.map(point => ({ ...point })), hands: hands.map(point => ({ ...point })) };
  if (spin || actor.captureRelease) state.spinSnapshot = { origin, matrix: [...matrix], motion: { ...motion }, hip: { ...hip }, feet: feet.map(foot => ({ ...foot })) as [Point, Point], hands: hands.map(hand => ({ ...hand })), ...(actor.captureRelease ? { shoulders: shoulders.map(point => ({ ...point })), elbows: elbows.map(point => ({ ...point })), hips: hips.map(point => ({ ...point })), knees: knees.map(point => ({ ...point })), footAngles: [...footAngles] } : {}), orbit: spin?.orbit ?? actor.angle, front, phase, facing, ...(spin?.planar ? { planar: true } : {}) };
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
  const farLeg = casterPlane ? feet[0].y <= feet[1].y : true;
  leg(farLeg); leg(!farLeg);
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
  const farArm = casterPlane ? worldPoint(bodyPoint(shoulders[0])).y <= worldPoint(bodyPoint(shoulders[1])).y : true;
  const ankleGripTurn = actor.pivotTurn !== undefined && actor.gripMode === 'ankle';
  arm(farArm);
  // Both gripping arms reach in front of the chest. From behind, the back
  // hides them; the nearest shoulder does not make its entire arm visible.
  // Keep the exposed silhouette opaque while the chest overlay fades in.
  if (ankleGripTurn) arm(!farArm);
  ctx.save(); ctx.scale(turnWidth, 1);
  rect(-bodyWidth / 2, -23, bodyWidth, 23, palette.base);
  rect(-bodyWidth / 2 + 2, -21, 5, 2, palette.light); rect(-bodyWidth / 2 + 3, -15, 3, 2, palette.light);
  rect(bodyWidth / 2 - 3, -20, 3, 5, palette.shade); rect(bodyWidth / 2 - 4, -10, 4, 4, palette.shade);
  if (frontAlpha > 0) { ctx.save(); ctx.globalAlpha *= frontAlpha; rect(-3, -14, 6, 1, palette.shade); ctx.restore(); }
  if (frontAlpha < 1) { ctx.save(); ctx.globalAlpha *= 1 - frontAlpha; rect(-bodyWidth / 2 + 3, -18, 3, 5, palette.shade); rect(bodyWidth / 2 - 6, -18, 3, 5, palette.shade); rect(-.6, -17, 1.2, 9, palette.shade); ctx.restore(); }
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
  if (frontAlpha < 1) { ctx.save(); ctx.globalAlpha *= 1 - frontAlpha; rect(-headWidth / 2, -7, headWidth, 11, hair); ctx.restore(); }
  const blink = (clock + index * 917) % (3400 + personality * 230) > 3280 + personality * 230;
  const eyeHeight = actor.eyesClosed !== undefined ? actor.eyesClosed ? .7 : 1.8 : pose === 'stunned' || carrying ? .7 : mix(slam ? mix(1.8, 2.7, tuck) : blink ? .7 : pose === 'airborne' ? 2.7 : 1.8, .7, slump);
  if (frontAlpha > 0) {
    ctx.save(); ctx.globalAlpha *= frontAlpha;
    rect(-3.5, -1, 1.8, eyeHeight, '#172b37'); rect(3, -1, 1.8, eyeHeight, '#172b37');
    const intense = ['push', 'brace', 'lift', 'throw'].includes(pose);
    rect(-4.5, intense ? -3 : -3.5, 3, .8, hair); rect(2.5, intense ? -3.5 : -3, 3, .8, hair);
    rect(-1, 4, 2.7, motion.mouth, palette.deep);
    if (pose === 'cheer' || pose === 'clap') { rect(-2, 3.3, .8, 1.8, palette.deep); rect(1.8, 3.3, .8, 1.8, palette.deep); }
    ctx.restore();
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
  if (!ankleGripTurn || frontAlpha > 0) {
    ctx.save(); if (ankleGripTurn) ctx.globalAlpha *= frontAlpha;
    arm(!farArm); ctx.restore();
  }
  ctx.restore(); ctx.restore();
  state.clock = clock; state.signature = signature; state.epoch = actor.motionEpoch; state.facing = facing; state.distance = actor.gaitDistance; state.moving = moving; state.airborne = air; state.pose = pose; state.carrierReleasing = !!actor.carrierRelease;
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
