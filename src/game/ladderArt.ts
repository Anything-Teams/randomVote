import type { Candidate } from '../election';
import type { LadderActorFrame, LadderFrame, LadderInteraction, LadderTimeline } from '../ladderLogic';

export type LadderPose = 'idle' | 'climb' | 'run' | 'bridge' | 'balance' | 'fall' | 'hang' | 'clamber' | 'drop' | 'slide' | 'swing' | 'launch' | 'rotate' | 'ride' | 'transfer' | 'win' | 'arrived';
type TransferMotion = 'slide' | 'swing' | 'launch' | 'drop' | 'rotate' | 'conveyor' | 'portal' | 'pounce';
type Point = { x: number; y: number };
export type LadderArtActor = { id: string; index: number; lane: number; height: number; rungProgress: number; pose: LadderPose; phase: number; fromLane?: number; toLane?: number; fromRow?: number; toRow?: number; supportRow?: number; gripRow?: number; gripLane?: number; footRow?: number; fallDepth?: number; tilt?: number; eventStage?: string; eventKind?: string; floating?: boolean; motionType?: TransferMotion; motionPhase?: number; actionProgress?: number; transferStage?: 'takeoff' | 'flight' | 'catch' | 'pull'; catchRow?: number; transferProgress?: number; transferRole?: 'primary' | 'partner'; landingRow?: number; pivotLane?: number; pivotRow?: number; depthOffset?: number; interaction?: LadderInteraction; contactTargets?: [Point, Point]; arrived: boolean; doorLane?: number; candidate: Candidate; transition?: { from: LadderArtActor; progress: number; shift: Point; clock: number }; };
export type LadderArtBridge = { id: string; row: number; leftLane: number; rightLane: number; fromRow?: number; toRow?: number; landingRow?: number; pivotLane?: number; pivotRow?: number; motionType?: TransferMotion; state?: 'future' | 'active' | 'past' };
export type LadderArtEvent = { id: string; kind: string; actorId: string; row: number; lane: number; toLane?: number; fromRow?: number; landingRow?: number; motionType?: TransferMotion; pivotLane?: number; pivotRow?: number; phase: number; stage: 'setup' | 'action' | 'recovery'; };
export type LadderGeometry = { width: number; height: number; laneCount: number; rungCount: number; left: number; right: number; top: number; bottom: number; laneGap: number; rungGap: number; scale: number; subdivisions: number; laneX: (lane: number) => number; rowY: (row: number) => number; };
export type LadderRig = { hip: Point; legRoots: [Point, Point]; shoulders: [Point, Point]; elbows: [Point, Point]; hands: [Point, Point]; knees: [Point, Point]; feet: [Point, Point]; head: Point; angle: number; facing: number; scale: number; handContact: [boolean, boolean]; footContact: [boolean, boolean]; };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const wrap = (value: number) => (value % 1 + 1) % 1;
const rotate = (point: Point, angle: number): Point => ({ x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) });
const colors = ['#e7ac81', '#c48b64', '#f2c397', '#a87151'];
const hair = ['#172639', '#50382c', '#754d38', '#253a48'];
export const LADDER_ARM_LENGTH = 6.5;
const ARM_LENGTH = LADDER_ARM_LENGTH, ARM_REACH = ARM_LENGTH * 2 - .1;
const HANDLE_HEIGHT = 35;
const LEG_LENGTH = 6.5, LEG_REACH = LEG_LENGTH * 2 - .1, PELVIS_DROP = 2.4;
function legPole(actor: LadderArtActor, side: number, facing: number) {
  const rear = (side ? 1 : -1) * facing * (actor.arrived ? .25 : .38);
  if (actor.pose === 'run' || actor.pose === 'bridge') return facing;
  if (actor.motionType && ['rotate', 'conveyor', 'portal'].includes(actor.motionType) && actor.eventStage !== 'setup') return facing;
  if (actor.pose === 'clamber' && actor.eventStage === 'resolve' && ['launch', 'swing', 'drop', 'slide'].includes(actor.motionType ?? '')) return mix(facing, rear, ease(actor.phase / .35));
  if (actor.eventStage !== 'action' || !actor.motionType) return rear;
  const p = actor.actionProgress ?? actor.phase;
  const catchAt = ['drop', 'slide'].includes(actor.motionType) ? .64 : .86;
  // Knees fold into the jump, then turn back under the pelvis before the catch.
  // The catch and pull therefore use the same pole instead of flipping a knee.
  const airborne = ease(p / .2) * (actor.motionType === 'pounce' ? 1 - ease((p - (catchAt - .2)) / .2) : 1);
  return mix(rear, facing, airborne);
}

export function ladderActorView(actor: LadderArtActor): 'rear' | 'quarter' | 'front' {
  if (actor.arrived || actor.pose === 'win') return 'front';
  if (actor.pose === 'run' || actor.pose === 'bridge') return 'quarter';
  if (actor.motionType && actor.eventStage !== 'setup') {
    if (actor.eventStage !== 'resolve' || ['rotate', 'conveyor', 'portal'].includes(actor.motionType)) return 'quarter';
  }
  return ['launch', 'swing', 'slide', 'drop', 'transfer', 'ride', 'rotate'].includes(actor.pose) ? 'quarter' : 'rear';
}
function tint(color: string, amount: number) {
  const rgb = Number.parseInt(color.slice(1), 16);
  return '#' + [rgb >>> 16, rgb >>> 8 & 255, rgb & 255].map(value => Math.round(Math.min(255, value * amount)).toString(16).padStart(2, '0')).join('');
}
function joint(a: Point, b: Point, upper: number, lower: number, bend: number): Point {
  const dx = b.x - a.x, dy = b.y - a.y, raw = Math.hypot(dx, dy);
  const distance = clamp(raw, Math.abs(upper - lower) + .001, upper + lower - .001);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { x: a.x + dx / (raw || 1) * along + dy / (raw || 1) * height * bend, y: a.y + dy / (raw || 1) * along - dx / (raw || 1) * height * bend };
}
function reachable(origin: Point, target: Point, length: number): Point {
  const ratio = Math.min(1, length / Math.max(.01, Math.hypot(target.x - origin.x, target.y - origin.y)));
  return { x: mix(origin.x, target.x, ratio), y: mix(origin.y, target.y, ratio) };
}
function armJoint(shoulder: Point, hand: Point, side: number, facing: number, scale: number): Point {
  // Raised arms fold away from the head. As an arm turns through the shoulder's
  // height its elbow moves through depth, avoiding a sudden IK branch flip.
  const raised = clamp((hand.y - shoulder.y) / (4 * scale), -1, 1);
  return joint(shoulder, hand, ARM_LENGTH * scale, ARM_LENGTH * scale, (side ? 1 : -1) * facing * raised);
}
function rectangle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function line(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'square'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, maxWidth?: number) {
  ctx.font = `800 ${size}px "Malgun Gothic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  if (maxWidth) ctx.fillText(value, x, y, maxWidth); else ctx.fillText(value, x, y);
}

export function createLadderGeometry(width: number, height: number, laneCount: number, rungCount = 24): LadderGeometry {
  const count = Math.max(2, laneCount), margin = Math.min(Math.max(0, (width - 1) / 2), clamp(width * .04, 10, 32));
  const laneGap = Math.max(1, width - margin * 2) / (count + .55), left = (width - laneGap * (count - 1)) / 2;
  const top = clamp(height * .27, 36, 130), bottom = Math.max(top + 15, height - clamp(height * .065, 9, 28));
  const rungGap = (bottom - top) / rungCount;
  const scale = Math.max(.12, Math.min(2.05, laneGap / 23, rungGap / 8.2));
  const subdivisions = Math.max(2, Math.ceil(rungGap / (scale * 5.2)));
  return { width, height, laneCount: count, rungCount, left, right: left + laneGap * (count - 1), top, bottom, laneGap, rungGap, scale, subdivisions, laneX: lane => left + laneGap * lane, rowY: row => bottom - row / rungCount * (bottom - top) };
}

/** A fixed suspension is shared by the body, rope and pulley artwork. */
export function ladderSuspension(actor: LadderArtActor, geometry: LadderGeometry) {
  const s = geometry.scale, p = clamp(actor.transferProgress ?? actor.phase);
  const from = { x: geometry.laneX(actor.fromLane ?? actor.lane), y: geometry.rowY(actor.fromRow ?? actor.rungProgress) };
  const to = { x: geometry.laneX(actor.toLane ?? actor.lane), y: geometry.rowY((actor.landingRow ?? actor.fromRow ?? actor.rungProgress) - .8) };
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / length * Math.sign(dx || 1), y: Math.abs(dx) / length };
  const cable = actor.eventKind === 'zipline' || length > geometry.rungGap * 12;
  const sag = cable ? geometry.rungGap * .55 : Math.min(length * .24, geometry.rungGap * 2.4);
  const radius = length * length / (8 * sag) + sag / 2;
  const arc = cable ? sag * Math.sin(p * Math.PI) : Math.sqrt(Math.max(0, radius * radius - ((p - .5) * length) ** 2)) - (radius - sag);
  const floor = { x: mix(from.x, to.x, p) + normal.x * arc, y: mix(from.y, to.y, p) + normal.y * arc };
  const handle = { x: floor.x, y: floor.y - HANDLE_HEIGHT * s };
  const anchor = cable ? { x: handle.x, y: handle.y - 8 * s } : { x: (from.x + to.x) / 2 - normal.x * (radius - sag), y: (from.y + to.y) / 2 - normal.y * (radius - sag) - HANDLE_HEIGHT * s };
  return { floor, handle, anchor, radius, cable, sag, from: { x: from.x, y: from.y - (HANDLE_HEIGHT + 8) * s }, to: { x: to.x, y: to.y - (HANDLE_HEIGHT + 8) * s } };
}

/** Reconstruct pose transitions from timeline boundaries, including a direct final seek. */
export function ladderArtActors(timeline: LadderTimeline, frame: LadderFrame, candidates: Candidate[], elapsed: number, geometry: LadderGeometry, reduced: boolean, readFrame: (time: number) => LadderFrame): LadderArtActor[] {
  const initial = reduced ? readFrame(0) : undefined;
  const adapt = (actor: LadderActorFrame): LadderArtActor => {
    const event = timeline.events.find(item => item.id === actor.eventId);
    const footRow = actor.pose === 'balance' ? actor.eventStage === 'resolve' ? actor.landingRow : actor.fromRow ?? event?.row : undefined;
    const art: LadderArtActor = { ...actor, candidate: candidates[actor.index], gripRow: actor.gripRow ?? actor.supportRow, footRow, eventKind: event?.kind };
    if (art.eventStage === 'setup') { art.pose = 'climb'; art.tilt = 0; }
    if (art.motionType === 'swing' && art.eventStage === 'action') {
      const { floor } = ladderSuspension(art, geometry);
      art.lane = (floor.x - geometry.left) / geometry.laneGap;
      art.rungProgress = (geometry.bottom - floor.y) / geometry.rungGap;
      art.height = art.rungProgress / geometry.rungCount;
    }
    return art;
  };
  const actors = frame.actors.map(current => {
    if (reduced) return adapt(current.arrived ? current : initial!.actors[current.index]);
    const actor = adapt(current), path = timeline.paths[actor.id];
    const boundaries = [path.startAt, path.arrivalAt, ...path.segments.map(segment => segment.start)];
    path.segments.filter(segment => segment.kind === 'bridge').forEach(segment => {
      boundaries.push(segment.start + (segment.end - segment.start) * .14, segment.start + (segment.end - segment.start) * .84);
    });
    timeline.events.filter(event => event.actors.includes(actor.id)).forEach(event => {
      boundaries.push(event.action, event.resolve, event.end);
    });
    const boundary = Math.max(-Infinity, ...boundaries.filter(time => time <= elapsed));
    const next = Math.min(Infinity, ...boundaries.filter(time => time > boundary + .001));
    // Pulling the body onto the rung includes the whole reach of the free arm.
    // A short ordinary crossing must use its full recovery for that turn.
    const duration = actor.eventStage === 'resolve' ? Math.min(350, next - boundary) : Math.min(250, (next - boundary) * .6);
    const continuousPull = actor.pose === 'clamber' && actor.eventStage === 'resolve' && ['swing', 'launch', 'drop', 'slide'].includes(actor.motionType ?? '');
    if (!continuousPull && elapsed >= boundary && elapsed < boundary + duration) {
      const previous = readFrame(Math.max(0, boundary - .001)).actors.find(item => item.id === actor.id)!;
      const previousArt = adapt(previous);
      actor.transition = { from: previousArt, progress: (elapsed - boundary) / duration, clock: boundary, shift: { x: geometry.laneX(actor.lane) - geometry.laneX(previousArt.lane), y: geometry.rowY(actor.rungProgress) - geometry.rowY(previousArt.rungProgress) } };
    }
    return actor;
  });
  actors.forEach(actor => {
    if (actor.interaction?.role !== 'thrower' || actor.eventStage !== 'action' || actor.interaction.phase < .32 || actor.interaction.phase >= .67) return;
    const partner = actors.find(item => item.id === actor.interaction!.partnerId);
    if (!partner) return;
    const victim = rawLadderRig(partner, geometry, elapsed, reduced), direction = Math.sign((actor.toLane ?? actor.lane) - (actor.fromLane ?? actor.lane)) || 1;
    // One hand catches a wrist; the other takes the near side of the belt.
    // These are the actual rendered victim points, rather than an assumed torso.
    actor.contactTargets = [victim.hands[1], { x: victim.hip.x + direction * 5.8 * geometry.scale, y: victim.hip.y - geometry.scale }];
  });
  return actors;
}

/** Hands and soles sample fixed world rungs; no frame cache is needed to seek or pause. */
function rawLadderRig(actor: LadderArtActor, geometry: LadderGeometry, clock: number, reduced = false): LadderRig {
  const scale = geometry.scale, personality = actor.index % 4;
  const rung = geometry.rungGap / geometry.subdivisions / scale, step = actor.rungProgress * geometry.subdivisions;
  const base = { x: geometry.laneX(actor.lane), y: geometry.rowY(actor.rungProgress) + (actor.depthOffset ?? 0) * geometry.rungGap };
  const topOut = actor.pose === 'climb' ? clamp((actor.rungProgress - (geometry.rungCount - 3)) / 3) : 0;
  let angle = 0, facing = actor.pose === 'climb' ? 1 : actor.toLane !== undefined && actor.fromLane !== undefined && actor.toLane < actor.fromLane ? -1 : 1;
  let hip = { x: 0, y: -13 }, hands: [Point, Point] = [{ x: -8, y: -16 }, { x: 8, y: -16 }], feet: [Point, Point] = [{ x: -3.8, y: 0 }, { x: 3.8, y: 0 }];
  let handContact: [boolean, boolean] = [false, false], footContact: [boolean, boolean] = [true, true];
  let anchorAmount: [number, number] = [0, 0];
  let contactAmount = 0;
  const catchY = geometry.rowY(actor.catchRow ?? actor.gripRow ?? (actor.landingRow ?? actor.rungProgress) + 2);
  const catchLane = actor.toLane ?? actor.gripLane ?? actor.lane;
  const catchHands: [Point, Point] = [0, 1].map(side => ({ x: geometry.laneX(catchLane) + (side ? 1 : -1) * facing * 6 * scale, y: catchY })) as [Point, Point];
  const motor = reduced ? 0 : step;
  if (actor.interaction?.role === 'victim' && actor.eventStage === 'action' && actor.interaction.phase < .6) {
    const p = actor.interaction.phase, ready = ease((p - .18) / .14), lift = ease((p - .32) / .28);
    hip = { x: 7 * ready, y: -13 }; angle = 0;
    hands = [{ x: mix(-8, 16, ready), y: mix(-16, -23, ready) }, { x: mix(8, 0, ready), y: mix(-16, -19, ready) }];
    feet = [{ x: mix(-3.8, 1, ready), y: -lift * 4 }, { x: mix(3.8, 6, ready), y: -lift * 7 }];
    footContact = [p <= .32, p <= .32];
  } else if (actor.interaction?.role === 'thrower' && actor.eventStage !== 'setup') {
    const p = actor.interaction.phase;
    if (actor.eventStage === 'resolve') {
      const climb = rawLadderRig({ ...actor, interaction: undefined, motionType: undefined, pose: 'climb', transition: undefined }, geometry, clock, reduced);
      const local = (point: Point): Point => ({ x: (point.x - base.x) / scale, y: (point.y - base.y) / scale });
      hip = local(climb.hip); hands = climb.hands.map(local) as [Point, Point]; feet = climb.feet.map(local) as [Point, Point];
      angle = climb.angle; handContact = climb.handContact; footContact = climb.footContact;
    } else if (p < .32) {
      const flight = clamp(actor.transferProgress ?? p / .32), takeoff = ease(flight / .18), reach = ease((flight - .72) / .28);
      hip = { x: mix(0, 7, reach), y: mix(-13 + (1 - takeoff) * 4, -11.8, reach) }; angle = -.18 * Math.sin(flight * Math.PI) * (1 - reach);
      hands = [{ x: mix(-12, 4, reach), y: mix(-25, -22, reach) }, { x: mix(14, 8, reach), y: mix(-28, -17, reach) }];
      feet = [{ x: mix(-4, 1, reach), y: -Math.sin(flight * Math.PI) * 5 }, { x: mix(8, 6, reach), y: -Math.sin(flight * Math.PI) * 7 }];
      footContact = [false, false];
    } else {
      const lifting = ease((p - .32) / .28), release = ease((p - .6) / .07), settle = ease((p - .67) / .33);
      const climb = rawLadderRig({ ...actor, interaction: undefined, motionType: undefined, pose: 'climb', transition: undefined }, geometry, clock, reduced);
      const local = (point: Point): Point => ({ x: (point.x - base.x) / scale, y: (point.y - base.y) / scale });
      const targetHip = local(climb.hip);
      const extension = ease((p - .54) / .06) * .65;
      hip = { x: mix(7 - 1.1 * ease((p - .32) / .06), targetHip.x, settle), y: mix(-11.8 - lifting * 1.5 - extension, targetHip.y, settle) }; angle = climb.angle * settle;
      hands = [{ x: mix(4, 11, release), y: mix(-22, -23, release) }, { x: mix(8, 13, release), y: mix(-17, -24, release) }];
      feet = [{ x: 1, y: 0 }, { x: 6, y: 0 }];
      hands = hands.map((point, side) => ({ x: mix(point.x, local(climb.hands[side]).x, settle), y: mix(point.y, local(climb.hands[side]).y, settle) })) as [Point, Point];
      feet = feet.map((point, side) => ({ x: mix(point.x, local(climb.feet[side]).x, settle), y: mix(point.y, local(climb.feet[side]).y, settle) })) as [Point, Point];
      contactAmount = ease((p - .32) / .06) * (1 - release);
      handContact = settle > .999999 ? climb.handContact : [false, false]; footContact = settle > .999999 ? climb.footContact : [settle < .000001, settle < .000001];
    }
  } else if (actor.pose === 'climb') {
    hip.y = -15;
    const gripOffset = Math.max(3, Math.ceil(38 / rung));
    hands = [0, 1].map(side => {
      const leading = (side + actor.index % 2) % 2;
      const progress = (motor + leading) / 2, cycle = wrap(progress), start = Math.floor(progress) * 2 - leading;
      const swing = clamp((cycle - .70) / .30);
      const row = Math.min(geometry.rungCount * geometry.subdivisions, start + gripOffset + 2 * ease(swing));
      handContact[side] = cycle < .70;
      return { x: (side ? 1 : -1) * (6 + Math.sin(swing * Math.PI) * 1.3), y: -(row - motor) * rung };
    }) as [Point, Point];
    feet = [0, 1].map(side => {
      const leading = (side + actor.index % 2) % 2;
      const progress = (motor + 1 - leading) / 2, cycle = wrap(progress), start = Math.floor(progress) * 2 - (1 - leading);
      const swing = clamp((cycle - .52) / .48), row = start + 2 + 2 * ease(swing);
      footContact[side] = cycle < .52;
      return { x: (side ? 1 : -1) * (3.6 + Math.sin(swing * Math.PI) * .8), y: -(row - motor) * rung - Math.sin(swing * Math.PI) * .65 };
    }) as [Point, Point];
    const breath = reduced ? 0 : Math.sin((clock + actor.index * 313) / (680 + personality * 70)) * .1;
    const side = actor.index % 2 ? -1 : 1;
    // Shift the pelvis over the planted foot before the opposite arm reaches.
    // Rung targets stay in world space, so the torso's effort never drags a grip.
    const weight = Math.sin(motor * Math.PI) * side;
    hip.x = weight * (.52 + personality * .03); hip.y += Math.sin(motor * Math.PI * 2) * .14 + breath; angle = weight * .019;
    if (topOut > 0) {
      // The ladder ends at the terrace. Push off its edge, plant one foot, then
      // release the supporting hand instead of reaching for rungs in the sky.
      const deckY = (geometry.rowY(geometry.rungCount) - base.y) / scale;
      hands = hands.map((_, side) => {
        const release = ease((topOut - (side ? .25 : .42)) / (side ? .4 : .33));
        handContact[side] = release < .000001;
        return { x: (side ? 1 : -1) * mix(6, 8, release), y: mix(deckY, -12, release) };
      }) as [Point, Point];
      feet[1].y = mix(feet[1].y, deckY, ease(topOut / .42));
      feet[0].y = mix(feet[0].y, deckY, ease((topOut - .38) / .62));
      footContact = [topOut >= 1, topOut >= .42];
      hip.x *= 1 - ease(topOut); angle *= 1 - ease(topOut);
    }
  } else if (actor.motionType && actor.eventStage === 'setup') {
    const climb = rawLadderRig({ ...actor, pose: 'climb', motionType: undefined, interaction: undefined, transition: undefined }, geometry, clock, reduced);
    const local = (point: Point): Point => ({ x: (point.x - base.x) / scale, y: (point.y - base.y) / scale });
    hip = local(climb.hip); hands = climb.hands.map(local) as [Point, Point]; feet = climb.feet.map(local) as [Point, Point];
    angle = climb.angle; handContact = climb.handContact; footContact = climb.footContact;
  } else if (actor.motionType && actor.eventStage !== 'resolve' && actor.pose !== 'clamber') {
    const p = reduced ? .5 : clamp(actor.actionProgress ?? actor.motionPhase ?? actor.phase), pulse = Math.sin(p * Math.PI);
    const catchAt = actor.motionType === 'drop' || actor.motionType === 'slide' ? .64 : .86;
    const flight = clamp(actor.transferProgress ?? p / catchAt), takeoff = ease(flight / .18), land = ease((flight - .76) / .24);
    footContact = [false, false]; handContact = [false, false];
    // The model supplies the moving body's world trajectory. These are joint actions,
    // rather than an extra body translation that could jump at a timeline boundary.
    if (actor.motionType === 'slide') {
      const seated = ease(p / .22) * (1 - ease((p - .72) / .28));
      hip = { x: -1.5 * seated, y: -15 + seated * 11 };
      angle = .11 * seated;
      hands = [{ x: -8 - seated * 2, y: -16 + seated * 7 }, { x: 10, y: -23 + seated * 5 }];
      feet = [{ x: mix(-3.2, 10.5, seated), y: 0 }, { x: mix(3.2, 14, seated), y: -.5 * seated }];
      if (actor.eventKind === 'banana') { hands[0] = { x: -11, y: -18 }; angle = .035 * seated; }
    } else if (actor.motionType === 'swing') {
      const sweep = Math.sin(flight * Math.PI), trail = Math.sin(flight * Math.PI * 2);
      hip = { x: -trail * 1.2, y: -13 + sweep * .25 }; angle = 0;
      hands = [{ x: -5.5, y: -HANDLE_HEIGHT }, { x: 5.5, y: -HANDLE_HEIGHT }];
      // One knee pulls forward while the trailing leg sweeps through the rope arc.
      feet = [{ x: -4 - trail * 3, y: -1.5 - sweep * 2.5 }, { x: 4 - trail * 5, y: -3 - sweep * 3.5 }];
      if (actor.eventKind === 'rope-tangle') feet[0].y -= sweep * 1.5;
      if (actor.eventKind === 'zipline') hip.x = -sweep * .6;
    } else if (actor.motionType === 'launch') {
      const crouch = (1 - takeoff) * 4, tuck = Math.sin(flight * Math.PI) * (1 - land), kick = Math.sin(clamp(flight / .28) * Math.PI) * 2.4;
      hip = { x: -.55 * (1 - takeoff) + pulse * .8, y: -13 + crouch }; angle = -.2 * Math.sin(flight * Math.PI);
      hands = [{ x: mix(-11, -13, takeoff), y: mix(-12, -24, takeoff) }, { x: mix(9, 14, takeoff), y: mix(-14, -28, takeoff) }];
      feet = [{ x: -3.2 - kick + tuck * 4, y: -takeoff * 1.5 - tuck * 6.5 }, { x: mix(3.2, 10, takeoff) - tuck * 3, y: -takeoff * 2 - tuck * 8 }];
      if (actor.eventKind === 'balloon') { hands = [{ x: -4, y: -32 }, { x: 5, y: -31 }]; angle = Math.sin(p * Math.PI) * .055; }
      if (actor.eventKind === 'safety-net') { hands[0] = { x: -12, y: -20 }; hands[1] = { x: 12, y: -20 }; }
      if (actor.eventKind === 'wind') {
        const balance = Math.sin(flight * Math.PI * 2) * Math.sin(flight * Math.PI);
        hands = [{ x: -13, y: -21 - balance * 2 }, { x: 13, y: -24 + balance * 2 }];
        feet[0].y += balance * 1.2; angle += balance * .06;
      }
    } else if (actor.motionType === 'drop') {
      const surprise = ease(flight / .16), scramble = Math.sin(flight * Math.PI * 3) * Math.sin(flight * Math.PI);
      hip = { x: -.5 + scramble * .35, y: -13 }; angle = -.25 * Math.sin(flight * Math.PI);
      hands = [{ x: mix(-11, -14, surprise), y: mix(-24, -28, surprise) }, { x: mix(12, 14, surprise), y: mix(-27, -31, surprise) }];
      feet = [{ x: -5 - surprise * 2, y: -2 - scramble * 2.2 }, { x: 6 + surprise * 3, y: -5 + scramble * 2.2 }];
      if (actor.interaction?.role === 'victim') {
        const release = ease((actor.interaction.phase - .6) / .12);
        hip.x = mix(7, hip.x, release); angle *= release;
        hands = hands.map((point, side) => ({ x: mix(side ? 0 : 16, point.x, release), y: mix(side ? -19 : -23, point.y, release) })) as [Point, Point];
        feet = feet.map((point, side) => ({ x: mix(side ? 6 : 1, point.x, release), y: mix(side ? -7 : -4, point.y, release) })) as [Point, Point];
      }
    } else if (actor.motionType === 'rotate') {
      hip = { x: Math.sin(p * Math.PI * 2) * .45, y: -15 }; angle = -.04 * Math.sin(p * Math.PI * 2);
      feet = [{ x: -3.2, y: 0 }, { x: 3.2, y: 0 }];
      hands = [{ x: -11 - pulse * 2, y: -19 - pulse * 2 }, { x: 11 + pulse * 2, y: -19 + pulse * 2 }];
      footContact = [true, true];
    } else if (actor.motionType === 'conveyor') {
      const tread = Math.sin(p * Math.PI * 4) * .7 * pulse;
      hip = { x: -.4 * pulse, y: -15 + Math.abs(tread) * .2 }; angle = -.045 * pulse;
      feet = [{ x: -3.2, y: -Math.max(0, tread) }, { x: 3.2, y: -Math.max(0, -tread) }];
      footContact = [tread <= 0, tread >= 0];
      hands = [{ x: -8, y: -16 }, { x: 9, y: -17 }];
      if (actor.eventKind === 'sticky') hands[0] = { x: -5.5, y: -27 }; // pulls a sticky glove free
    } else {
      // Walk across the fixed folding bridge after its gates open.
      const steps = Math.abs((actor.lane - (actor.fromLane ?? actor.lane)) * geometry.laneGap / scale) / 18;
      const stride = Math.sin(steps * Math.PI * 2) * pulse;
      hip.y = -14 + Math.abs(stride) * .3;
      feet = [{ x: -3.2 + stride * 3, y: -Math.max(0, stride) * 2 }, { x: 3.2 - stride * 3, y: -Math.max(0, -stride) * 2 }];
      hands = [{ x: -9, y: -17 - stride }, { x: 9, y: -17 + stride }]; angle = pulse * .018;
      if (actor.eventKind === 'lights-out') hands[1] = { x: 7, y: -27 };
    }
    if (['swing', 'launch', 'drop', 'slide'].includes(actor.motionType)) {
      const catchBlend = ease((p - (catchAt - .2)) / .2), hangingHip = (catchY - base.y) / scale + 22;
      hip = { x: mix(hip.x, -1, catchBlend), y: mix(hip.y, hangingHip, catchBlend) };
      feet = feet.map((point, side) => ({ x: mix(point.x, side ? 5 : -4.5, catchBlend), y: mix(point.y, hangingHip + 10 + side * .8, catchBlend) })) as [Point, Point];
      hands[0] = { x: mix(hands[0].x, -9, catchBlend), y: mix(hands[0].y, hangingHip - 7, catchBlend) };
      angle *= 1 - catchBlend; anchorAmount[1] = catchBlend;
      if (p >= catchAt) {
        const age = clamp((p - catchAt) / (1 - catchAt));
        // After absorbing the catch, the free arm searches upward before the
        // torso starts its pull. The second hand continues holding the rung.
        hands[0].y -= ease(age) * 10;
        if (!reduced) {
          const impact = Math.sin(age * Math.PI) * Math.exp(-age * 4), effort = Math.sin(age * Math.PI);
          // The fixed hand absorbs a short downward jolt. Keep it inside arm reach.
          hip.y += impact * 1.4; hip.x += Math.sin(age * Math.PI * 2) * effort * .3;
          hands[0].x -= effort * .8; hands[0].y -= Math.sin(age * Math.PI * 2) * effort * 1.2;
          feet.forEach((foot, side) => {
            const struggle = Math.sin(age * Math.PI * 3 + side * Math.PI) * effort;
            foot.x += struggle * 1.5; foot.y += impact * 1.4 - struggle * 2.2;
          });
        }
      }
    } else {
      const reach = ease((p - .76) / .24);
      const plant = ease((p - .68) / (catchAt - .68));
      const gripY = (catchY - base.y) / scale;
      hip = { x: mix(hip.x, 0, plant), y: mix(hip.y, -15, plant) };
      hands = hands.map((point, side) => ({ x: mix(point.x, side ? 6 : -6, reach), y: mix(point.y, gripY, reach) })) as [Point, Point];
      feet = feet.map((point, side) => ({ x: mix(point.x, side ? 4.2 : -4.2, plant), y: mix(point.y, 0, plant) })) as [Point, Point]; angle *= 1 - plant;
      if (p >= catchAt) footContact = [true, true]; // the stationary receiving deck takes the climber's weight
    }
  } else if (actor.pose === 'run') {
    const distance = Math.abs(actor.lane - (actor.fromLane ?? actor.lane)) * geometry.laneGap / scale;
    const stride = 30, motorDistance = reduced ? 0 : distance;
    feet = [0, 1].map(side => {
      const cycle = wrap(motorDistance / stride + side * .5), swing = clamp((cycle - .42) / .58);
      footContact[side] = cycle < .42;
      return { x: cycle < .42 ? stride * (.21 - cycle) : mix(-stride * .21, stride * .21, ease(swing)), y: -Math.sin(swing * Math.PI) * 4.2 };
    }) as [Point, Point];
    const drive = Math.sin(motorDistance / stride * Math.PI * 2), effort = Math.sin(actor.phase * Math.PI);
    hip = { x: .8 * effort, y: -12 + Math.abs(drive) * .4 };
    hands = [{ x: -7 + drive * 3.2, y: -19 - drive }, { x: 7 - drive * 3.2, y: -19 + drive }];
    angle = .07 * effort * facing;
  } else if (actor.pose === 'bridge') {
    const distance = Math.abs(actor.lane - (actor.fromLane ?? actor.lane)) * geometry.laneGap / scale;
    const stride = 22, motorDistance = reduced ? 0 : distance;
    feet = [0, 1].map(side => {
      const cycle = wrap(motorDistance / stride + side * .5), swing = clamp((cycle - .62) / .38);
      footContact[side] = cycle < .62;
      return { x: cycle < .62 ? stride * (.5 - cycle) : mix(stride * (.5 - .62), stride * .5, ease(swing)), y: -Math.sin(swing * Math.PI) * 2.4 };
    }) as [Point, Point];
    const sway = Math.sin(motorDistance / stride * Math.PI * 2);
    hip.y = -11.8 + Math.abs(sway) * .35; hip.x = .2;
    hands = [{ x: -10, y: -17 + sway * 1.4 }, { x: 12, y: -18 - sway * 1.4 }];
    angle = -.035; facing = actor.toLane! < actor.fromLane! ? -1 : 1;
    if (actor.motionType) footContact = [false, false]; // soles contact the service deck, not a ladder rung
  } else if (actor.pose === 'balance') {
    const plantedDeck = actor.motionType && ['rotate', 'conveyor', 'portal'].includes(actor.motionType);
    const wobble = reduced || plantedDeck ? 0 : Math.sin(actor.phase * Math.PI * 3) * Math.sin(actor.phase * Math.PI);
    hip = { x: wobble * .65, y: -15 + Math.abs(wobble) * .5 }; hands = [{ x: -10, y: -19 - wobble }, { x: 10, y: -19 + wobble }];
    const footY = (geometry.rowY(actor.footRow ?? Math.round(actor.rungProgress * geometry.subdivisions) / geometry.subdivisions) - base.y) / scale;
    feet = [{ x: -3.2, y: footY }, { x: 3.2, y: footY }]; angle = wobble * .045;
    if (actor.eventKind === 'bird' || actor.eventKind === 'paint') hands[1] = { x: 2.5, y: -31 };
    if (actor.eventKind === 'pendulum') hands = [{ x: -7, y: -21 }, { x: 7, y: -21 }];
    if (actor.eventKind === 'false-sign') hands[1] = { x: 12, y: -28 };
  } else if (actor.pose === 'fall') {
    const p = reduced ? .5 : actor.phase;
    const catchAmount = ease((p - .22) / (.555555 - .22));
    const grab = geometry.rowY(actor.gripRow ?? Math.floor(actor.rungProgress) + 2), handY = (grab - base.y) / scale;
    angle = Math.sin(p * Math.PI) * (.19 + personality * .018) * (personality % 2 ? -1 : 1) * (1 - catchAmount);
    hip.y = mix(-13, handY + 20, catchAmount);
    hands = [{ x: mix(-11, -5.8, catchAmount), y: mix(-29, handY, catchAmount) }, { x: mix(12, 8, catchAmount), y: mix(-26, handY + 6, catchAmount) }];
    feet = [{ x: mix(-6, -4, catchAmount), y: mix(-3, -1, catchAmount) }, { x: mix(7, 6, catchAmount), y: mix(-6, -4, catchAmount) }];
    footContact = [false, false];
  } else if (actor.pose === 'hang') {
    const sway = reduced ? 0 : Math.sin(actor.phase * Math.PI * 2) * Math.sin(actor.phase * Math.PI) * .13;
    const grab = geometry.rowY(actor.gripRow ?? actor.supportRow ?? Math.min(24, Math.ceil(actor.rungProgress) + 2));
    const handY = (grab - base.y) / scale;
    hip = { x: Math.sin(sway) * 4, y: handY + 20 }; angle = sway;
    hands = [{ x: -5.8, y: handY }, { x: 8, y: handY + 6 + Math.sin(actor.phase * Math.PI) * 2 }];
    feet = [{ x: -4, y: hip.y + 9 }, { x: 6, y: hip.y + 10 }]; handContact = [true, false]; footContact = [false, false];
    if (actor.floating) {
      const climb = rawLadderRig({ ...actor, pose: 'climb', transition: undefined }, geometry, clock, reduced);
      hip = { x: 0, y: -13 }; angle = 0;
      hands = climb.hands.map(point => ({ x: (point.x - base.x) / scale, y: (point.y - base.y) / scale })) as [Point, Point];
      handContact = climb.handContact;
    }
    if (actor.eventKind === 'rope-tangle') hands[1] = { x: 6, y: -1 };
  } else if (actor.pose === 'clamber') {
    const climb = rawLadderRig({ ...actor, rungProgress: actor.landingRow ?? actor.rungProgress, pose: 'climb', transition: undefined }, geometry, clock, reduced);
    const local = (point: Point): Point => ({ x: (point.x - base.x) / scale, y: (point.y - base.y) / scale });
    if (actor.motionType && ['swing', 'launch', 'drop', 'slide'].includes(actor.motionType)) {
      const p = ease(reduced ? 1 : actor.phase), settle = ease(actor.phase), fromHip = (catchY - base.y) / scale + 22;
      const targetHip = local(climb.hip); hip = { x: mix(-1, targetHip.x, p), y: mix(fromHip, targetHip.y, p) }; angle = climb.angle * p;
      hands = climb.hands.map(local) as [Point, Point];
      // The free arm reaches up from its hanging position while the catching
      // arm holds the rung. It must not visit that second grip first.
      hands[0] = { x: mix(-9 * facing, hands[0].x, settle), y: mix(fromHip - 17, hands[0].y, settle) };
      feet = [{ x: -4.5, y: hip.y + 10 }, { x: 5, y: hip.y + 10.8 }];
      handContact = [false, false]; footContact = [false, false];
      anchorAmount = [0, 1 - settle];
      const targetFeet = climb.feet.map(local) as [Point, Point];
      const plant = ease((actor.phase - .14) / .72);
      if (!reduced) {
        const effort = Math.sin(actor.phase * Math.PI) * (1 - settle), kneeDrive = Math.sin(clamp(actor.phase / .6) * Math.PI);
        hip.x += effort * .45; hip.y -= effort * .55;
        // The free knee searches upward before its boot takes the body's weight.
        feet[1].x += kneeDrive * 1.7; feet[1].y -= kneeDrive * 3.2;
        feet[0].x -= effort * .7; feet[0].y -= Math.sin(actor.phase * Math.PI * 2) * effort * .8;
      }
      feet = feet.map((point, side) => ({ x: mix(point.x, targetFeet[side].x, side ? plant : settle), y: mix(point.y, targetFeet[side].y, side ? plant : settle) })) as [Point, Point];
      if (settle > .9999999) { handContact = climb.handContact; footContact = climb.footContact; }
    } else {
      hip = local(climb.hip); angle = climb.angle;
      hands = climb.hands.map(local) as [Point, Point]; feet = climb.feet.map(local) as [Point, Point];
      handContact = climb.handContact; footContact = climb.footContact;
    }
  } else if (actor.pose === 'win') {
    const breath = reduced ? 0 : Math.sin(clock / (650 + personality * 70)) * .18;
    const triumph = reduced ? 0 : Math.sin(clock / (520 + personality * 40)) * .32;
    hip.y = -15 + breath; hands = [{ x: -7, y: -11 }, { x: 6 + triumph, y: -39 + breath }]; angle = 0;
  } else {
    const breath = reduced ? 0 : Math.sin((clock + actor.index * 433) / (650 + personality * 60)) * .12;
    hip.y = (actor.arrived ? -15 : hip.y) + breath;
    hands = [{ x: -8, y: -12 }, { x: 8, y: -12 }];
  }
  angle += actor.motionType === 'swing' ? 0 : (actor.tilt ?? 0) * .5;
  const toWorld = (point: Point) => { const p = rotate({ x: point.x * facing, y: point.y }, angle); return { x: base.x + p.x * scale, y: base.y + p.y * scale }; };
  const hipWorld = toWorld(hip);
  const shoulderRise = actor.pose === 'climb' ? mix(12, 10, ease(topOut)) : 10;
  const shoulders = [{ x: hip.x - 4.2, y: hip.y - shoulderRise }, { x: hip.x + 4.2, y: hip.y - shoulderRise }].map(toWorld) as [Point, Point];
  if (actor.pose === 'win') shoulders[1].y -= 2 * scale; // a raised shoulder supports the treasure above the helmet
  let handWorld = hands.map(toWorld) as [Point, Point];
  let footWorld = feet.map(point => ({ x: base.x + point.x * facing * scale, y: base.y + point.y * scale })) as [Point, Point];
  if (actor.floating && (actor.pose === 'hang' || actor.pose === 'clamber')) {
    const climb = rawLadderRig({ ...actor, pose: 'climb', transition: undefined }, geometry, clock, reduced);
    handWorld = climb.hands; handContact = climb.handContact;
  }
  if (actor.pose === 'climb' || actor.pose === 'clamber' && actor.interaction?.role !== 'thrower' || actor.interaction?.role === 'thrower' && actor.eventStage === 'resolve') {
    // Contact markers lie on actual rails and decorative rungs, independent of torso sway.
    handWorld = hands.map(point => ({ x: base.x + point.x * scale, y: base.y + point.y * scale })) as [Point, Point];
  }
  if (!actor.floating && !actor.motionType && actor.pose === 'hang') {
    const grab = geometry.rowY(actor.gripRow ?? actor.supportRow ?? Math.min(24, Math.ceil(actor.rungProgress) + 2));
    handWorld[0] = { x: geometry.laneX(actor.lane) - 6 * scale, y: grab };
  }
  handWorld = handWorld.map((point, side) => {
    const amount = anchorAmount[side];
    if (amount > 0) handContact[side] = amount > .999999;
    return { x: mix(point.x, catchHands[side].x, amount), y: mix(point.y, catchHands[side].y, amount) };
  }) as [Point, Point];
  if (actor.contactTargets && contactAmount > 0) {
    handWorld = handWorld.map((point, side) => ({ x: mix(point.x, actor.contactTargets![side].x, contactAmount), y: mix(point.y, actor.contactTargets![side].y, contactAmount) })) as [Point, Point];
  }
  const handsReached = handWorld.map((point, side) => {
    const target = reachable(shoulders[side], point, ARM_REACH * scale);
    if (Math.hypot(target.x - point.x, target.y - point.y) > .001) handContact[side] = false;
    return target;
  }) as [Point, Point];
  const legRoots = [-1, 1].map(side => toWorld({ x: hip.x + side * (actor.pose === 'run' ? .6 : 2.6), y: hip.y + PELVIS_DROP })) as [Point, Point];
  footWorld = footWorld.map((point, side) => {
    const target = reachable(legRoots[side], point, LEG_REACH * scale);
    if (Math.hypot(target.x - point.x, target.y - point.y) > .001) footContact[side] = false;
    return target;
  }) as [Point, Point];
  const elbows = handsReached.map((point, side) => armJoint(shoulders[side], point, side, facing, scale)) as [Point, Point];
  const knees = footWorld.map((point, side) => joint(legRoots[side], point, LEG_LENGTH * scale, LEG_LENGTH * scale, legPole(actor, side, facing))) as [Point, Point];
  return { hip: hipWorld, legRoots, shoulders, elbows, hands: handsReached, knees, feet: footWorld, head: toWorld({ x: hip.x, y: hip.y - 17.5 }), angle, facing, scale, handContact, footContact };
}

export function sampleLadderRig(actor: LadderArtActor, geometry: LadderGeometry, clock: number, reduced = false): LadderRig {
  const current = rawLadderRig(actor, geometry, clock, reduced), transition = reduced ? undefined : actor.transition;
  if (!transition || transition.progress >= 1) return current;
  const previous = rawLadderRig({ ...transition.from, transition: undefined }, geometry, transition.clock, false), p = ease(transition.progress);
  const move = (a: Point, b: Point): Point => ({ x: mix(a.x + transition.shift.x, b.x, p), y: mix(a.y + transition.shift.y, b.y, p) });
  // Turning changes which arm is in front, but each hand keeps its own world-space path.
  const side = (index: number) => index;
  const hip = move(previous.hip, current.hip), head = move(previous.head, current.head), angle = mix(previous.angle, current.angle, p);
  const shoulders = current.shoulders.map((point, index) => move(previous.shoulders[side(index)], point)) as [Point, Point];
  const fixedHand = current.hands.map((point, index) => current.handContact[index] && previous.handContact[side(index)] && Math.hypot(previous.hands[side(index)].x - point.x, previous.hands[side(index)].y - point.y) < .001);
  const hands = current.hands.map((point, index) => reachable(shoulders[index], fixedHand[index] ? point : move(previous.hands[side(index)], point), ARM_REACH * current.scale)) as [Point, Point];
  const legRoots = current.legRoots.map((point, index) => move(previous.legRoots[index], point)) as [Point, Point];
  const feet = current.feet.map((point, index) => {
    const foot = move(previous.feet[side(index)], point), from = previous.feet[side(index)];
    if (Math.hypot(from.x + transition.shift.x - point.x, from.y + transition.shift.y - point.y) > current.scale * .8) foot.y -= Math.sin(p * Math.PI) * current.scale * 1.2;
    return reachable(legRoots[index], foot, LEG_REACH * current.scale);
  }) as [Point, Point];
  const elbowFacing = mix(previous.facing, current.facing, p);
  const elbows = hands.map((point, index) => armJoint(shoulders[index], point, index, elbowFacing, current.scale)) as [Point, Point];
  const knees = feet.map((point, index) => joint(legRoots[index], point, LEG_LENGTH * current.scale, LEG_LENGTH * current.scale, mix(legPole(transition.from, index, previous.facing), legPole(actor, index, current.facing), p))) as [Point, Point];
  const same = (a: Point, b: Point) => Math.hypot(a.x + transition.shift.x - b.x, a.y + transition.shift.y - b.y) < .001;
  return { ...current, hip, legRoots, head, angle, shoulders, hands, elbows, knees, feet, handContact: current.handContact.map((contact, index) => contact && (fixedHand[index] || same(previous.hands[side(index)], current.hands[index]))) as [boolean, boolean], footContact: current.footContact.map((contact, index) => contact && same(previous.feet[side(index)], current.feet[index])) as [boolean, boolean] };
}

/** A separate clothed climbing rig; all exposed parts share the same skin palette. */
export function drawLadderActor(ctx: CanvasRenderingContext2D, actor: LadderArtActor, geometry: LadderGeometry, clock: number, reduced = false, focused = false) {
  const rig = sampleLadderRig(actor, geometry, clock, reduced), s = rig.scale;
  const skin = colors[actor.index % colors.length], shade = tint(skin, .79), light = tint(skin, 1.12), uniform = actor.candidate.color;
  if (focused) { rectangle(ctx, rig.head.x - 4 * s, rig.head.y - 11 * s, 8 * s, 1.2 * s, '#f4d58c'); }
  rig.feet.forEach((foot, side) => {
    line(ctx, rig.legRoots[side], rig.knees[side], 4.4 * s, tint(uniform, side ? .72 : .59));
    line(ctx, rig.knees[side], foot, 3.9 * s, '#283e50');
    rectangle(ctx, foot.x - 2.4 * s, foot.y - 1.3 * s, 5.4 * s, 1.5 * s, '#152734');
    rectangle(ctx, foot.x - 2.4 * s, foot.y - .1 * s, 5.4 * s, .7 * s, '#d9d6bc');
  });
  const arm = (side: number) => {
    line(ctx, rig.shoulders[side], rig.elbows[side], 4.2 * s, uniform);
    line(ctx, rig.elbows[side], rig.hands[side], 3.6 * s, skin);
    rectangle(ctx, rig.hands[side].x - 1.7 * s, rig.hands[side].y - 1.5 * s, 3.4 * s, 2.7 * s, skin);
    rectangle(ctx, rig.hands[side].x - .7 * s, rig.hands[side].y - 1.4 * s, 1.7 * s, .7 * s, light);
  };
  const farArm = rig.facing > 0 ? 0 : 1, nearArm = 1 - farArm;
  const view = ladderActorView(actor), pulling = actor.pose === 'clamber' && actor.eventStage === 'resolve' && ['swing', 'launch', 'drop', 'slide'].includes(actor.motionType ?? '');
  const previousView = pulling ? 'quarter' : actor.transition ? ladderActorView(actor.transition.from) : view;
  const turning = pulling ? ease(actor.phase / .35) : actor.transition ? ease(actor.transition.progress) : 1;
  const rear = mix(previousView === 'rear' ? 1 : 0, view === 'rear' ? 1 : 0, turning);
  const quarter = mix(previousView === 'quarter' ? 1 : 0, view === 'quarter' ? 1 : 0, turning);
  const opacity = ctx.globalAlpha;
  arm(farArm);
  if (rear > .5) arm(nearArm);
  const torso = (back: boolean, alpha: number) => {
  if (alpha < .001) return;
  ctx.save(); ctx.globalAlpha = opacity * alpha; ctx.translate(rig.hip.x, rig.hip.y); ctx.rotate(rig.angle); ctx.scale(s * (1 - quarter * .12), s);
  rectangle(ctx, -5.5, .5, 11, 2.7, tint(uniform, .63));
  rectangle(ctx, -6.2, -12, 12.4, 13, uniform);
  rectangle(ctx, -5.1, -10.5, 3.4, 1.6, tint(uniform, 1.12)); rectangle(ctx, 3.6, -9, 2.5, 8, tint(uniform, .72));
  rectangle(ctx, -6.2, -1, 12.4, 2, '#1c3646');
  if (back) {
    // A broad shoulder yoke and shaded back replace front suspenders, badge and
    // buckle. Airborne poses keep this same camera direction through landing.
    rectangle(ctx, -5.4, -11.3, 10.8, 2.2, tint(uniform, .77));
    rectangle(ctx, -4.6, -8.8, 9.2, 5.8, tint(uniform, .94));
    rectangle(ctx, -.5, -8.4, 1, 5.7, tint(uniform, .85));
    rectangle(ctx, -3.6, -2.7, 7.2, .8, tint(uniform, .76));
    rectangle(ctx, -1.2, -.8, 2.4, 1.5, '#344750');
  } else { rectangle(ctx, -3.4, -10, 6.8, 1.2, '#f1eadc'); rectangle(ctx, -.9, -.7, 1.8, 1.2, '#ddc387'); }
  ctx.restore();
  };
  torso(true, rear); torso(false, 1 - rear);
  const headWidth = [8.5, 9, 8, 9.5][actor.index % 4];
  const head = (back: boolean, alpha: number) => {
  if (alpha < .001) return;
  ctx.save(); ctx.globalAlpha = opacity * alpha; ctx.translate(rig.head.x, rig.head.y); ctx.rotate(rig.angle * .5); ctx.scale((back ? 1 : rig.facing) * s, s);
  if (back) {
    rectangle(ctx, -1.6, 2.4, 3.2, 3.5, shade); // only the nape is exposed
    rectangle(ctx, -headWidth / 2, -3.8, headWidth, 7.2, hair[actor.index % 4]);
    rectangle(ctx, -headWidth / 2 + .7, .5, headWidth - 1.4, 2.6, tint(hair[actor.index % 4], .75));
    rectangle(ctx, -headWidth / 2 - .6, -.1, .8, 1.8, shade); rectangle(ctx, headWidth / 2 - .2, -.1, .8, 1.8, shade);
    rectangle(ctx, -headWidth / 2 - .8, -7, headWidth + 1.6, 5.2, '#d4bc7d');
    rectangle(ctx, -headWidth / 2 + .2, -6.4, headWidth - .4, 3.5, '#ead38f');
    rectangle(ctx, -.7, -6.4, 1.4, 4.4, '#b8a36e'); // rear helmet seam
    rectangle(ctx, -headWidth / 2 - 1.2, -2.6, headWidth + 2.4, 1, '#80714e');
  } else {
    rectangle(ctx, -2, 2.9, 4, 3, skin); rectangle(ctx, -headWidth / 2, -4, headWidth, 8, skin);
    rectangle(ctx, -headWidth / 2 + 1.1, -3, headWidth - 3, 1.3, light); rectangle(ctx, headWidth / 2 - 1.5, -2, 1.5, 5.6, shade);
    rectangle(ctx, -headWidth / 2 - .6, -5, headWidth + 1.2, 2.4, hair[actor.index % 4]);
    rectangle(ctx, -headWidth / 2 - 1, -7, headWidth + 2, 3.2, '#ead38f'); rectangle(ctx, -headWidth / 2 - 1.7, -4.1, headWidth + 3.4, 1.1, '#6f6149');
    rectangle(ctx, -2, -6.2, 2.4, .7, '#fff5d0');
    // Both eyes remain visible in a three-quarter turn. The facial plane and
    // helmet brim shift together instead of deleting half of a front face.
    rectangle(ctx, -2.7 + quarter * 1.2, -.7, 1.2, 1.3, '#172d3d'); rectangle(ctx, 1.8 + quarter * .5, -.7, 1.2, 1.3, '#172d3d');
    rectangle(ctx, -.9 + quarter, 2.4, 2.3, actor.pose === 'fall' || actor.pose === 'hang' ? 1.6 : .8, '#694e3a');
    if (quarter > .01) {
      rectangle(ctx, -headWidth / 2, -2.5, 1.2, 4.8, hair[actor.index % 4]);
      rectangle(ctx, headWidth / 2, -4.1, quarter * 1.3, 1.1, '#6f6149');
    }
  }
  ctx.restore();
  };
  head(true, rear); head(false, 1 - rear);
  if (rear <= .5) arm(nearArm);
}

export function drawLadderName(ctx: CanvasRenderingContext2D, actor: LadderArtActor, geometry: LadderGeometry, focused = false, clock = 0, reduced = true) {
  if (geometry.height < 175 || geometry.laneGap < 24 && !focused) return;
  const rig = sampleLadderRig(actor, geometry, clock, reduced), width = clamp(geometry.laneGap - 3, 20, focused ? 94 : 72);
  let name = actor.candidate.name; ctx.font = `800 ${focused ? 10 : 9}px "Malgun Gothic", sans-serif`;
  while (ctx.measureText(name).width > width - 8 && Array.from(name).length > 1) name = Array.from(name).slice(0, -1).join('');
  const x = clamp(rig.hip.x, width / 2 + 3, geometry.width - width / 2 - 3), y = Math.min(geometry.height - 12, Math.max(rig.feet[0].y, rig.feet[1].y) + 6);
  rectangle(ctx, x - width / 2, y - 3, width, 12, '#112b3bda'); rectangle(ctx, x - width / 2, y + 8, width, 1.3, actor.candidate.color);
  label(ctx, name, x, y + 3, focused ? 10 : 9, '#f4e9d5');
}

/** Devices occupy the complete route, so the body visibly lands on another rail. */
export function drawLadderCrossing(ctx: CanvasRenderingContext2D, actor: LadderArtActor, geometry: LadderGeometry, clock: number, reduced: boolean, _focused = false) {
  if (actor.eventStage === 'setup') return;
  if (!actor.motionType || actor.fromLane === undefined || actor.toLane === undefined || actor.fromLane === actor.toLane) return;
  const s = geometry.scale, from = { x: geometry.laneX(actor.fromLane), y: geometry.rowY(actor.fromRow ?? actor.rungProgress) };
  const to = { x: geometry.laneX(actor.toLane), y: geometry.rowY(actor.landingRow ?? actor.toRow ?? actor.fromRow ?? actor.rungProgress) };
  const p = clamp(actor.transferProgress ?? actor.motionPhase ?? actor.phase), rig = sampleLadderRig(actor, geometry, clock, reduced);
  const floor = { x: geometry.laneX(actor.lane), y: geometry.rowY(actor.rungProgress) + (actor.depthOffset ?? 0) * geometry.rungGap };
  const stroke = (a: Point, b: Point, width: number, color: string) => line(ctx, a, b, Math.max(.6, width * s), color);
  const plate = (point: Point, color: string) => { rectangle(ctx, point.x - 8 * s, point.y, 16 * s, 2.5 * s, '#112936'); rectangle(ctx, point.x - 8 * s, point.y - s, 16 * s, 1.8 * s, color); };
  const rope = (a: Point, b: Point, bow: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(.6, .9 * s); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2 + bow * s, (a.y + b.y) / 2 + Math.abs(bow) * .35 * s, b.x, b.y); ctx.stroke();
  };
  ctx.save();
  // The mechanism and real contacts show what happened. A destination arrow
  // would announce the route before the action has carried the body there.
  if (actor.motionType === 'pounce') {
    // The other climber is the obstacle: no travelling cradle or rope disguises
    // the leap, the two grips, or the throw's release.
    plate(from, '#c8b780');
    if (actor.interaction?.stage === 'grip' || actor.interaction?.stage === 'throw') {
      const phase = actor.interaction.phase;
      if (!reduced && phase > .38 && phase < .44 && actor.contactTargets) {
        actor.contactTargets.forEach((target, side) => {
          const age = (phase - .38) / .06, offset = (2 + age * 4) * s;
          stroke({ x: target.x + (side ? 1 : -1) * offset, y: target.y - offset }, { x: target.x + (side ? 1 : -1) * (offset + s), y: target.y - offset - s }, .65, '#ead09b');
        });
      }
    }
  } else if (actor.motionType === 'drop') {
    const hinge = { x: from.x - 6 * s, y: from.y };
    if (!actor.interaction) { ctx.save(); ctx.translate(hinge.x, hinge.y); ctx.rotate(actor.eventStage === 'setup' ? -.04 : Math.min(1.35, p * 2)); rectangle(ctx, 0, -s, 12 * s, 2 * s, '#b6a17b'); ctx.restore(); }
    const hookY = geometry.rowY(actor.catchRow ?? (actor.landingRow ?? actor.rungProgress) + 2);
    stroke({ x: to.x - 6 * s, y: hookY }, { x: to.x + 6 * s, y: hookY }, 1.8, '#c3d7b1');
  } else if (actor.motionType === 'slide') {
    const direction = Math.sign(to.x - from.x), normal = { x: -(to.y - from.y), y: to.x - from.x }, length = Math.max(1, Math.hypot(normal.x, normal.y));
    stroke(from, to, 7.5, '#152d3c'); stroke(from, to, 4.8, '#709b9f'); stroke(from, to, 1.5, '#adc9bd');
    for (const side of [-1, 1]) stroke({ x: from.x + normal.x / length * 4.5 * s * side, y: from.y + normal.y / length * 4.5 * s * side }, { x: to.x + normal.x / length * 4.5 * s * side, y: to.y + normal.y / length * 4.5 * s * side }, 1, '#b9cbc0');
    for (let i = 1; i < 7; i++) stroke({ x: mix(from.x, to.x, i / 7) - direction * 2 * s, y: mix(from.y, to.y, i / 7) - 2 * s }, { x: mix(from.x, to.x, i / 7) + direction * 2 * s, y: mix(from.y, to.y, i / 7) - 2 * s }, .5, '#e4dca674');
    plate(to, '#e1b975');
  } else if (actor.motionType === 'swing') {
    const suspension = ladderSuspension(actor, geometry), pivot = suspension.anchor;
    if (suspension.cable) {
      ctx.strokeStyle = '#a5c1b7'; ctx.lineWidth = Math.max(.6, s);
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, { x, y } = ladderSuspension({ ...actor, transferProgress: t }, geometry).anchor;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Two rollers straddle the fixed cable; the short strap hangs from their
      // common axle instead of making the wire look like a second handhold.
      for (const offset of [-2.8, 2.8]) {
        ctx.fillStyle = '#213b4c'; ctx.beginPath(); ctx.ellipse(pivot.x + offset * s, pivot.y - s, 2.2 * s, 2.2 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d4c69c'; ctx.lineWidth = Math.max(.5, .8 * s); ctx.stroke();
      }
      stroke({ x: pivot.x - 4 * s, y: pivot.y + s }, { x: pivot.x + 4 * s, y: pivot.y + s }, 1.2, '#a8bab2');
    } else {
      stroke({ x: pivot.x - 5 * s, y: pivot.y }, { x: pivot.x + 5 * s, y: pivot.y }, 3, '#a48568');
    }
    const released = actor.eventStage === 'resolve' || (actor.actionProgress ?? actor.phase) >= .66;
    const grip = released ? suspension.handle : { x: (rig.hands[0].x + rig.hands[1].x) / 2, y: (rig.hands[0].y + rig.hands[1].y) / 2 };
    rope(pivot, grip, 0, '#ddcfa1');
    stroke({ x: grip.x - 5.5 * s, y: grip.y }, { x: grip.x + 5.5 * s, y: grip.y }, 2, '#bea27b');
    plate(from, '#b4c3a8'); plate(to, '#e3c780');
  } else if (actor.motionType === 'launch') {
    const compression = actor.eventStage === 'setup' ? ease(actor.phase) * 2 : (1 - ease(p / .2)) * 2;
    const plateY = from.y + compression * s;
    if (actor.eventKind !== 'wind') {
      ctx.strokeStyle = '#c2d2cd'; ctx.lineWidth = Math.max(.6, s * .8); ctx.beginPath(); ctx.moveTo(from.x, from.y + 6 * s);
      for (let coil = 0; coil < 7; coil++) ctx.lineTo(from.x + (coil % 2 ? -3 : 3) * s, mix(from.y + 6 * s, plateY + s, coil / 6)); ctx.stroke();
      plate({ x: from.x, y: plateY }, '#efbc68');
      if (!reduced && p > .06 && p < .35) { ctx.strokeStyle = '#ecd09180'; ctx.lineWidth = s; ctx.beginPath(); ctx.ellipse(from.x, from.y, (p - .06) * 30 * s, (p - .06) * 10 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else plate(from, '#acc7b3');
    plate(to, '#b9d0a8');
  } else if (actor.motionType === 'rotate') {
    const pivot = { x: mix(from.x, to.x, .5), y: mix(from.y, to.y, .5) + 12 * s };
    stroke({ x: from.x, y: from.y + 5 * s }, { x: to.x, y: to.y + 5 * s }, 3, '#263e50');
    const crank = { x: pivot.x + Math.cos(Math.PI * (1 - p)) * 7 * s, y: pivot.y - Math.sin(Math.PI * p) * 7 * s };
    ctx.fillStyle = '#455d68'; ctx.beginPath(); ctx.ellipse(pivot.x, pivot.y, 8.4 * s, 8.4 * s, 0, 0, Math.PI * 2); ctx.fill();
    stroke(pivot, crank, 2.6, '#b4a17e');
    stroke(crank, { x: floor.x, y: floor.y + 3 * s }, 1.8, '#98b0af');
    ctx.fillStyle = '#eed7a4'; ctx.beginPath(); ctx.ellipse(pivot.x, pivot.y, 2 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
    // The crank moves the supported deck; each sole remains on its upper face.
    rectangle(ctx, floor.x - 8 * s, floor.y, 16 * s, 3 * s, '#796b61'); rectangle(ctx, floor.x - 8 * s, floor.y - s, 16 * s, s, '#d8c397');
    for (const foot of rig.feet) stroke({ x: foot.x, y: foot.y }, { x: foot.x, y: floor.y + 2 * s }, .7, '#d4c499');
  } else if (actor.motionType === 'conveyor') {
    stroke(from, to, 4.3, '#132b3a'); stroke(from, to, 2.5, '#607e85');
    const length = Math.abs(to.x - from.x), teeth = Math.max(4, Math.ceil(length / (7 * s))), direction = Math.sign(to.x - from.x);
    for (let i = 0; i < teeth; i++) { const t = wrap(i / teeth + (reduced ? 0 : p / teeth * 4)); const xx = mix(from.x, to.x, t); stroke({ x: xx - 1.5 * s * direction, y: mix(from.y, to.y, t) - s }, { x: xx + 1.5 * s * direction, y: mix(from.y, to.y, t) - s }, 1, '#cebd8e'); }
    for (const point of [from, to]) { ctx.strokeStyle = '#d1ba81'; ctx.lineWidth = Math.max(.6, s); ctx.beginPath(); ctx.ellipse(point.x, point.y + s, 3 * s, 3 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
  } else {
    // The path stays fixed in the world. Nothing carries a box along the route.
    stroke(from, to, 4.6, '#233d4d'); stroke(from, to, 2.8, '#b4b494');
    const boards = Math.max(4, Math.ceil(Math.abs(to.x - from.x) / (7 * s)));
    for (let i = 0; i <= boards; i++) {
      const t = i / boards, x = mix(from.x, to.x, t), y = mix(from.y, to.y, t);
      stroke({ x, y: y - 2 * s }, { x, y: y + 2 * s }, .65, '#637b79');
    }
    for (const point of [from, to]) {
      stroke({ x: point.x - 7 * s, y: point.y }, { x: point.x - 7 * s, y: point.y - 28 * s }, 1.4, '#a3b8aa');
      stroke({ x: point.x + 7 * s, y: point.y }, { x: point.x + 7 * s, y: point.y - 28 * s }, 1.4, '#a3b8aa');
      stroke({ x: point.x - 7 * s, y: point.y - 28 * s }, { x: point.x + 7 * s, y: point.y - 28 * s }, 2, '#ddc894');
    }
  }
  if (!reduced && ['launch', 'swing', 'drop', 'pounce'].includes(actor.motionType)) {
    const action = clamp(actor.actionProgress ?? actor.motionPhase ?? actor.phase), catchAt = actor.motionType === 'drop' || actor.motionType === 'slide' ? .64 : .86;
    if (actor.transferStage === 'flight' && p > .12 && p < .88 && (!actor.interaction || actor.interaction.stage === 'approach' || actor.interaction.stage === 'flight')) {
      const dx = to.x - from.x, arc = actor.motionType === 'launch' ? -4.6 : actor.motionType === 'pounce' ? -3 : actor.motionType === 'swing' ? 4.6 : 0;
      const dy = to.y - from.y + arc * geometry.rungGap * Math.PI * Math.cos(p * Math.PI);
      const length = Math.max(1, Math.hypot(dx, dy)), vx = dx / length, vy = dy / length;
      const amount = Math.sin(p * Math.PI);
      for (let streak = 0; streak < 2; streak++) {
        const offset = (streak ? 1 : -1) * 8 * s;
        const tip = { x: rig.hip.x - vx * 9 * s - vy * offset, y: rig.hip.y - vy * 9 * s + vx * offset };
        stroke({ x: tip.x - vx * (4 + streak * 2) * amount * s, y: tip.y - vy * (4 + streak * 2) * amount * s }, tip, .65, '#d2d7b968');
      }
    }
    if (actor.transferStage === 'catch') {
      const age = clamp((action - catchAt) / (1 - catchAt));
      if (age < .34) {
        const hand = rig.hands[1], spread = (2 + age * 10) * s;
        for (let chip = 0; chip < 3; chip++) {
          const direction = -Math.PI * .9 + chip * Math.PI * .4;
          const x = hand.x + Math.cos(direction) * spread, y = hand.y + Math.sin(direction) * spread;
          rectangle(ctx, x, y, s, s, age < .14 ? '#f2dda5' : '#c8c9a582');
        }
      }
    }
    if (actor.motionType === 'launch' && actor.transferStage === 'flight' && action < .22) {
      const age = clamp(action / .22), direction = Math.sign(to.x - from.x);
      for (let particle = 0; particle < 4; particle++) {
        const x = from.x - direction * (2 + particle * 1.8 + age * (3 + particle)) * s;
        const y = from.y - Math.sin(age * Math.PI) * (1.2 + particle * .7) * s + age * s;
        rectangle(ctx, x, y, (1 - age * .55) * s, (1 - age * .55) * s, '#c9bd9385');
      }
    }
  }
  ctx.restore();
}

export function drawLadderScenery(ctx: CanvasRenderingContext2D, geometry: LadderGeometry, bridges: LadderArtBridge[], targetLane: number, clock: number, reduced: boolean, doorOccupants: Set<number>, preview = false) {
  const { width: w, height: h, top, bottom, laneGap, left, right, scale: s } = geometry;
  const time = reduced ? 0 : clock;
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#122339'); sky.addColorStop(.58, '#294955'); sky.addColorStop(1, '#527579');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  rectangle(ctx, w * .09, h * .095, clamp(h * .055, 4, 26), clamp(h * .055, 4, 26), '#e6d398');
  for (let cloud = 0; cloud < 7; cloud++) {
    const x = wrap(cloud * .187 + time / (125000 + cloud * 7500)) * (w + 130) - 65, y = h * (.06 + cloud % 3 * .058);
    rectangle(ctx, x, y, 35 + cloud % 3 * 16, 4, '#bdc8ba25'); rectangle(ctx, x + 9, y - 3, 23 + cloud % 2 * 17, 3, '#d6d5bd18');
  }
  for (let depth = 0; depth < 3; depth++) {
    const buildings = Math.ceil(w / (34 + depth * 18));
    for (let i = -1; i <= buildings; i++) {
      const bw = 32 + depth * 18, x = i * bw + depth * 11, bh = h * (.12 + (i * 13 + depth * 7 + 99) % 11 / 40), y = h - bh;
      rectangle(ctx, x, y, bw - 3, bh, ['#23404d', '#1d3543', '#172e3b'][depth]);
      rectangle(ctx, x + bw * .36, y - 6 - i % 3 * 4, bw * .21, 9, '#243c47');
      for (let row = 0; row < bh / 8; row++) for (let column = 0; column < bw / 7 - 1; column++) {
        if ((row * 3 + column * 7 + i * 11 + 200) % 5 < 2) rectangle(ctx, x + 4 + column * 7, y + 5 + row * 8, 2, 2, (row + column) % 2 ? '#d8b96f70' : '#83b5c25c');
      }
    }
  }
  const outer = Math.min(laneGap * .57, 48), towerLeft = Math.max(2, left - outer), towerRight = Math.min(w - 2, right + outer);
  // Offset structure, illuminated service shafts and façade bays make the course
  // read as a building in depth rather than lines on a flat rectangle.
  rectangle(ctx, towerLeft + 7, top + 4, towerRight - towerLeft, bottom - top + 9, '#0f2738b5');
  rectangle(ctx, towerLeft, top - 5, towerRight - towerLeft, bottom - top + 7, '#203a49');
  const facade = ctx.createLinearGradient(towerLeft, 0, towerRight, 0); facade.addColorStop(0, '#334e5a'); facade.addColorStop(.5, '#1c3444'); facade.addColorStop(1, '#314d55');
  ctx.fillStyle = facade; ctx.fillRect(towerLeft + 3, top, towerRight - towerLeft - 6, bottom - top);
  rectangle(ctx, towerLeft + 2, top, 3, bottom - top, '#94aead');
  rectangle(ctx, towerRight - 5, top, 3, bottom - top, '#4a7482');
  for (let lane = 0; lane < geometry.laneCount; lane++) {
    const x = geometry.laneX(lane), shaft = Math.max(8, 17 * s);
    rectangle(ctx, x - shaft / 2 - 3 * s, top + 2, shaft + 6 * s, bottom - top - 3, '#102b3b9c');
    rectangle(ctx, x - shaft / 2 - 3 * s, top + 2, Math.max(.5, s * .5), bottom - top - 3, '#80bbb64a');
    for (let floor = 1; floor < 6; floor++) {
      const yy = geometry.rowY(floor * 4);
      rectangle(ctx, x - 10 * s, yy - 2 * s, 3 * s, 1.1 * s, '#b8cf9a');
      rectangle(ctx, x + 7 * s, yy - 2 * s, 3 * s, 1.1 * s, '#b8cf9a');
    }
  }
  for (let floor = 0; floor <= 6; floor++) {
    const y = geometry.rowY(floor * 4);
    rectangle(ctx, towerLeft, y, towerRight - towerLeft, 3, '#608086'); rectangle(ctx, towerLeft, y + 3, towerRight - towerLeft, 2, '#102938');
    if (outer > 12 && floor > 0 && floor < 6) label(ctx, `${floor}F`, towerLeft + 8, y - 6, clamp(s * 4.5, 5, 8), '#97b5b1');
    for (let lane = 0; lane < geometry.laneCount - 1; lane++) {
      const x = geometry.laneX(lane) + laneGap / 2, ww = Math.max(3, laneGap * .38);
      rectangle(ctx, x - ww / 2, y - geometry.rungGap * 3.4, ww, Math.max(3, geometry.rungGap * 2.4), '#122b3c');
      rectangle(ctx, x - ww / 2 + 1, y - geometry.rungGap * 3.4 + 1, ww - 2, 2, '#79a6b040');
      rectangle(ctx, x - ww / 2 + ww * .63, y - geometry.rungGap * 3.4, 1, geometry.rungGap * 2.4, '#7097a34c');
      rectangle(ctx, x - ww / 2 + 2, y - geometry.rungGap * 1.6, Math.max(1, ww - 4), Math.max(.5, s * .6), '#4e737d');
      if ((floor + lane) % 3 === 0) rectangle(ctx, x - ww / 2 + 3, y - geometry.rungGap * 3.15, Math.max(2, ww * .3), Math.max(2, geometry.rungGap * .75), '#d1bf6f2b');
    }
    line(ctx, { x: towerLeft + 2, y: y }, { x: towerLeft + 2 + Math.min(16, outer), y: y - geometry.rungGap * 4 }, 1, '#6a93945c');
    line(ctx, { x: towerRight - 2, y }, { x: towerRight - 2 - Math.min(16, outer), y: y - geometry.rungGap * 4 }, 1, '#6a93945c');
  }
  const railHalf = 6 * s, rungThickness = Math.max(.8, s * 1.2);
  for (let lane = 0; lane < geometry.laneCount; lane++) {
    const x = geometry.laneX(lane);
    line(ctx, { x: x - railHalf - 1, y: top }, { x: x - railHalf - 1, y: bottom }, Math.max(1.6, 2.5 * s), '#102c3a');
    line(ctx, { x: x + railHalf + 1, y: top }, { x: x + railHalf + 1, y: bottom }, Math.max(1.6, 2.5 * s), '#102c3a');
    line(ctx, { x: x - railHalf, y: top }, { x: x - railHalf, y: bottom }, Math.max(1, 1.3 * s), '#93b8b6');
    line(ctx, { x: x + railHalf, y: top }, { x: x + railHalf, y: bottom }, Math.max(1, 1.3 * s), '#7ca4a6');
    for (let row = 0; row <= geometry.rungCount * geometry.subdivisions; row++) {
      const y = geometry.rowY(row / geometry.subdivisions);
      line(ctx, { x: x - railHalf, y }, { x: x + railHalf, y }, rungThickness, '#718e92');
      rectangle(ctx, x - railHalf, y - rungThickness / 2, railHalf * 2, .55, '#cae0cbaa');
      if (row % (geometry.subdivisions * 4) === 0) {
        rectangle(ctx, x - railHalf - 3 * s, y - 1.5 * s, 2 * s, 3 * s, '#587f8c');
        rectangle(ctx, x + railHalf + s, y - 1.5 * s, 2 * s, 3 * s, '#587f8c');
      }
    }
    const pulleyY = top - 5; rectangle(ctx, x - 4 * s, pulleyY - 3 * s, 8 * s, 5 * s, '#536e79');
    rectangle(ctx, x - 1 * s, pulleyY - 2 * s, 2 * s, 3 * s, '#c5b47b');
  }
  bridges.forEach(bridge => {
    const x = geometry.laneX(bridge.leftLane), xx = geometry.laneX(bridge.rightLane), y = geometry.rowY(bridge.row);
    if (bridge.state === 'future') return;
    if (bridge.motionType === 'swing' || bridge.motionType === 'launch' || bridge.motionType === 'drop') {
      const destinationY = geometry.rowY(bridge.landingRow ?? bridge.toRow ?? bridge.row);
      for (const xx of [x, geometry.laneX(bridge.rightLane)]) {
        rectangle(ctx, xx - 7 * s, y, 14 * s, 2 * s, '#536e77');
        rectangle(ctx, xx - 6 * s, y - s, 12 * s, s, bridge.motionType === 'launch' ? '#dcb579' : '#9fb9ad');
        if (Math.abs(destinationY - y) > 1) rectangle(ctx, xx - 6 * s, destinationY - s, 12 * s, s, '#aabf9a');
      }
      if (bridge.motionType === 'swing') {
        const pivotX = geometry.laneX(bridge.pivotLane ?? (bridge.leftLane + bridge.rightLane) / 2), pivotY = geometry.rowY(bridge.pivotRow ?? bridge.row + 3);
        rectangle(ctx, pivotX - 4 * s, pivotY - s, 8 * s, 2 * s, '#8da59e');
      }
      if (bridge.state === 'past') for (let point = 1; point < 9; point++) {
        const progress = point / 9, xx = mix(x, geometry.laneX(bridge.rightLane), progress);
        const yy = mix(y, destinationY, progress) + (bridge.motionType === 'swing' ? 1 : bridge.motionType === 'launch' ? -1 : 0) * Math.sin(progress * Math.PI) * geometry.rungGap * 2;
        rectangle(ctx, xx - .5, yy, 1, 1, '#a3b9ad58');
      }
      return;
    }
    ctx.save(); ctx.globalAlpha = bridge.state === 'past' ? .5 : .85;
    const color = bridge.motionType === 'rotate' ? '#9ea9c0' : bridge.motionType === 'conveyor' ? '#95aa8c' : bridge.motionType === 'portal' ? '#8fb6bd' : '#c9b385';
    line(ctx, { x, y: y + 2 }, { x: xx, y: y + 2 }, Math.max(3, 3.4 * s), '#162f3c');
    line(ctx, { x, y }, { x: xx, y }, Math.max(.8, 1.15 * s), color);
    for (let bolt = 0; bolt <= 4; bolt++) rectangle(ctx, mix(x, xx, bolt / 4) - .5, y - .5, 1, 1, '#cdd0b5');
    line(ctx, { x: x + 1, y: y + 2 }, { x: mix(x, xx, .5), y: y + Math.min(10, geometry.rungGap * .7) }, 1, '#628c91');
    line(ctx, { x: mix(x, xx, .5), y: y + Math.min(10, geometry.rungGap * .7) }, { x: xx - 1, y: y + 2 }, 1, '#628c91');
    const center = mix(x, xx, .5);
    if (bridge.motionType === 'rotate') { rectangle(ctx, center - 2 * s, y + s, 4 * s, 3 * s, '#a49884'); rectangle(ctx, center - s, y + 1.5 * s, 2 * s, s, '#e1c99c'); }
    if (bridge.motionType === 'conveyor') for (let tooth = 1; tooth < 6; tooth++) rectangle(ctx, mix(x, xx, tooth / 6) - s, y - s, 2 * s, .7 * s, '#bac69e');
    if (bridge.motionType === 'portal') { rectangle(ctx, center - 5 * s, y - 6 * s, 10 * s, 3 * s, '#577b89'); rectangle(ctx, center - 3 * s, y - 5 * s, 6 * s, s, '#c6bc92'); }
    ctx.restore();
  });
  // Crane, roof equipment and the gold destination remain part of the complete course.
  const craneX = towerRight - Math.min(14, outer / 2), craneY = Math.max(8, top - 55 * s);
  line(ctx, { x: craneX, y: top - 4 }, { x: craneX, y: craneY }, 3, '#ba9358');
  line(ctx, { x: Math.max(2, craneX - 55 * s), y: craneY }, { x: Math.min(w - 2, craneX + 20 * s), y: craneY }, 3, '#bda16d');
  for (let brace = 0; brace < 5; brace++) line(ctx, { x: craneX - brace * 10 * s, y: craneY - 1 }, { x: craneX - (brace + .6) * 10 * s, y: craneY + 4 * s }, 1, '#e0c381');
  line(ctx, { x: craneX - 31 * s, y: craneY + 3 }, { x: craneX - 31 * s, y: top - 12 * s }, 1, '#abc0bd');
  rectangle(ctx, towerLeft, top - 4, towerRight - towerLeft, 5, '#bfc6ae');
  rectangle(ctx, towerLeft, top + 1, towerRight - towerLeft, 2, '#526e73');
  for (let fixture = 0; fixture < geometry.laneCount; fixture++) {
    const xx = geometry.laneX(fixture);
    rectangle(ctx, xx - 3 * s, top + 3 * s, 6 * s, 1.5 * s, '#e5d093');
    if (h > 250) { ctx.fillStyle = '#dae0b70b'; ctx.beginPath(); ctx.moveTo(xx - 3 * s, top + 4 * s); ctx.lineTo(xx - 15 * s, top + 4 * geometry.rungGap); ctx.lineTo(xx + 15 * s, top + 4 * geometry.rungGap); ctx.lineTo(xx + 3 * s, top + 4 * s); ctx.fill(); }
  }
  for (let lane = 0; lane < geometry.laneCount; lane++) {
    const x = geometry.laneX(lane), chosen = lane === targetLane, doorWidth = Math.max(11, Math.min(laneGap * .66, 20 * s)), doorHeight = Math.max(14, 34 * s);
    rectangle(ctx, x - doorWidth / 2 - 3, top - doorHeight - 2, doorWidth + 6, doorHeight + 3, chosen ? '#5c5238' : '#3a5560');
    rectangle(ctx, x - doorWidth / 2, top - doorHeight, doorWidth, doorHeight, chosen ? '#f1d18c' : '#758f8e');
    rectangle(ctx, x - doorWidth / 2 + 2, top - doorHeight + 2, doorWidth - 4, doorHeight - 3, doorOccupants.has(lane) ? '#284636' : chosen ? '#53473b' : '#213c4b');
    rectangle(ctx, x + doorWidth / 2 - 4, top - doorHeight * .4, Math.max(1, s), Math.max(1, s * 2), '#efd392');
    const numberY = top - doorHeight - Math.max(7, s * 5);
    label(ctx, String(lane + 1).padStart(2, '0'), x, numberY, clamp(s * 8, 7, 12), chosen ? '#ffe59b' : '#acc9c7');
    if (chosen) {
      rectangle(ctx, x - doorWidth / 2 - 4, top - doorHeight - 3, doorWidth + 8, 2, '#ffdf8c');
      rectangle(ctx, x - doorWidth / 2 - 4, top - doorHeight - 3, 2, doorHeight + 8, '#ffdf8c');
      rectangle(ctx, x + doorWidth / 2 + 2, top - doorHeight - 3, 2, doorHeight + 8, '#ffdf8c');
      rectangle(ctx, x - doorWidth / 2 - 4, top + 3, doorWidth + 8, 2, '#ffdf8c');
      const glow = reduced ? .6 : .55 + Math.sin(time / 750) * .12;
      ctx.globalAlpha = glow; rectangle(ctx, x - doorWidth / 2 - 7, top + 6, doorWidth + 14, 2, '#ffdf8c'); ctx.globalAlpha = 1;
    }
  }
  rectangle(ctx, towerLeft - 3, bottom + 2, towerRight - towerLeft + 6, 6, '#8e977e');
  for (let stripe = 0; stripe < (towerRight - towerLeft) / 8; stripe++) rectangle(ctx, towerLeft + stripe * 8, bottom + 3, 4, 2, stripe % 2 ? '#243944' : '#d7bc77');
  for (let person = 0; person < Math.min(24, Math.floor(w / 18)); person++) {
    const x = 9 + person * (w - 18) / Math.max(1, Math.min(24, Math.floor(w / 18)) - 1), y = h - 4;
    rectangle(ctx, x - 1, y - 4, 2, 2, colors[person % 4]); rectangle(ctx, x - 2, y - 2, 4, 3, ['#9b6c66', '#a1bfa0', '#b6ab7e'][person % 3]);
  }
  if (preview && geometry.laneCount === 2 && w > 190) label(ctx, '옥상 행운문을 선택하세요', w / 2, bottom + 14, clamp(w / 40, 8, 12), '#dbe3c7', w - 20);
}

export function drawLadderEvent(ctx: CanvasRenderingContext2D, event: LadderArtEvent, geometry: LadderGeometry, clock: number, reduced: boolean, actor?: LadderArtActor) {
  const x = geometry.laneX(event.lane), y = geometry.rowY(event.row), s = geometry.scale, p = reduced ? .5 : event.phase;
  const direction = (event.toLane ?? event.lane + 1) < event.lane ? -1 : 1;
  const active = event.stage === 'action', recovery = event.stage === 'recovery', tone = recovery ? '#9ad5b8' : '#f5c16c';
  const rig = actor ? sampleLadderRig(actor, geometry, clock, reduced) : undefined;
  const at = (xx: number, yy: number): Point => ({ x: x + xx * s, y: y + yy * s });
  const rect = (xx: number, yy: number, w: number, h: number, color: string) => rectangle(ctx, x + xx * s, y + yy * s, w * s, h * s, color);
  const stroke = (a: Point, b: Point, width: number, color: string) => line(ctx, a, b, Math.max(.6, width * s), color);
  const pulse = active ? Math.sin(p * Math.PI) : 0;
  ctx.save();
  rectangle(ctx, x - 8 * s, y + 2 * s, 16 * s, .9 * s, tone);
  if (event.kind === 'wind') {
    const fan = at(-direction * 19, -26);
    const aim = active && rig ? { x: rig.hip.x, y: rig.hip.y - 4 * s } : at(direction * 12, -24);
    const angle = Math.atan2(aim.y - fan.y, aim.x - fan.x);
    ctx.save(); ctx.translate(fan.x, fan.y); ctx.rotate(angle);
    rectangle(ctx, -7 * s, -6 * s, 9 * s, 12 * s, '#405966');
    ctx.fillStyle = '#223f50'; ctx.beginPath(); ctx.ellipse(2 * s, 0, 4.5 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(2 * s, 0); ctx.scale(.5, 1); ctx.rotate(reduced ? .3 : clock / (active ? 80 : 510));
    for (let blade = 0; blade < 3; blade++) { ctx.rotate(Math.PI * 2 / 3); rectangle(ctx, 0, -1.4 * s, 6.5 * s, 2.8 * s, '#a3bec0'); } ctx.restore();
    ctx.strokeStyle = '#d2d9bf'; ctx.lineWidth = Math.max(.6, .8 * s); ctx.beginPath(); ctx.ellipse(2 * s, 0, 4.5 * s, 8 * s, 0, 0, Math.PI * 2); ctx.stroke();
    for (const grille of [-3, 0, 3]) stroke({ x: 2 * s + grille * s, y: -6 * s }, { x: 2 * s + grille * s, y: 6 * s }, .45, '#b8c9be');
    ctx.restore();
    rect(-direction * 19 - 2, -18, 4, 8, '#607786'); rect(-direction * 19 - 4, -10, 8, 2, '#e0b277');
    if (active && !reduced && rig) for (let gust = 0; gust < 5; gust++) {
      const travel = wrap(clock / 430 + gust * .19), spread = (gust - 2) * 3 * s;
      const dx = aim.x - fan.x, dy = aim.y - fan.y, length = Math.max(1, Math.hypot(dx, dy));
      const offset = { x: -dy / length * spread, y: dx / length * spread };
      stroke({ x: fan.x + dx * travel + offset.x, y: fan.y + dy * travel + offset.y }, { x: fan.x + dx * Math.min(1, travel + .16) + offset.x, y: fan.y + dy * Math.min(1, travel + .16) + offset.y }, .85, '#d9eee0a0');
    }
  } else if (event.kind === 'loose-rung' || event.kind === 'trapdoor') {
    rect(-7, -1.5, 14, 3, '#203a49');
    const openAngle = event.kind === 'trapdoor' ? 1.48 : .65;
    const rotation = active ? ease(Math.min(1, p * 1.8)) * openAngle : recovery ? (1 - ease(p)) * openAngle : -.025;
    ctx.save(); ctx.translate(x - 7 * s, y); ctx.rotate(rotation); rectangle(ctx, 0, -1.2 * s, 14 * s, 2.4 * s, '#d2a56a'); rectangle(ctx, 4 * s, -1.2 * s, 1.2 * s, 2.4 * s, '#523e36'); ctx.restore();
    if (active) for (let bit = 0; bit < 4; bit++) rect((bit - 2) * 2, p * p * (6 + bit * 4), 1.3, 1.3, '#bc9268');
  } else if (event.kind === 'pendulum') {
    const anchor = { x: geometry.laneX(event.pivotLane ?? (event.lane + (event.toLane ?? event.lane)) / 2), y: y + 12 * s };
    const swing = active ? Math.sin(p * Math.PI * 2 - Math.PI / 2) * .72 : 0;
    const bob = { x: anchor.x + Math.sin(swing) * 17 * s, y: anchor.y + Math.cos(swing) * 17 * s };
    stroke(anchor, bob, 1.2, '#b7bda6'); rectangle(ctx, bob.x - 5 * s, bob.y - 5 * s, 10 * s, 10 * s, '#ad9382'); rectangle(ctx, bob.x - 3 * s, bob.y - 4 * s, 5 * s, 2 * s, '#dac7a4'); rectangle(ctx, bob.x - 5 * s, bob.y + 3 * s, 10 * s, 2 * s, '#645254');
    rectangle(ctx, anchor.x - 4 * s, anchor.y - 2 * s, 8 * s, 3 * s, '#63828a');
  } else if (event.kind === 'crumbling-step') {
    if (active) for (let bit = 0; bit < 8; bit++) {
      const age = clamp(p * 1.8 - bit * .04), xx = x + (bit - 3.5) * 2 * s + direction * age * 8 * s;
      rectangle(ctx, xx, y + age * age * (24 + bit * 3) * s, (1.4 + bit % 2) * s, 1.4 * s, bit % 2 ? '#dfbb86' : '#8d6e5c');
    }
    if (active && p < .3) { rect(-7, -1, 14, 2, '#bc9268'); stroke(at(-2, -2), at(1, 2), .8, '#253c48'); }
  } else if (event.kind === 'rocket-boots') {
    if (active && rig && p < .72) for (const foot of rig.feet) {
      const boost = Math.sin(clamp(p / .72) * Math.PI), flutter = reduced ? 1 : .8 + Math.sin(clock / 37) * .2;
      ctx.fillStyle = '#ec9366'; ctx.beginPath(); ctx.moveTo(foot.x - 2 * s, foot.y + s); ctx.lineTo(foot.x, foot.y + (3 + boost * 10 * flutter) * s); ctx.lineTo(foot.x + 2 * s, foot.y + s); ctx.fill();
      rectangle(ctx, foot.x - s, foot.y + s, 2 * s, (2 + boost * 4) * s, '#ffe4a2');
    }
  } else if (event.kind === 'spring') {
    const compression = active ? (1 - ease(p / .2)) * 2 : recovery ? 0 : ease(p) * 2, footY = y + compression * s;
    ctx.strokeStyle = '#c6d5c4'; ctx.lineWidth = Math.max(.8, s); ctx.beginPath(); ctx.moveTo(x, y + 7 * s);
    for (let coil = 0; coil < 8; coil++) ctx.lineTo(x + (coil % 2 ? -4 : 4) * s, mix(y + 6 * s, footY + 1.5 * s, coil / 7)); ctx.stroke();
    rectangle(ctx, x - 8 * s, footY - s, 16 * s, 2 * s, '#ecc778'); rect(-6, 7, 12, 2, '#728997');
  } else if (event.kind === 'bird') {
    const fly = active ? ease(p) * 25 : recovery ? 32 + p * 20 : 0, bx = x + (8 + fly) * s, by = y - (33 + Math.sin(p * Math.PI) * 13) * s;
    rectangle(ctx, bx - 3 * s, by, 7 * s, 3 * s, '#e6ead7'); rectangle(ctx, bx + 2 * s, by - 2 * s, 3 * s, 3 * s, '#e6ead7'); rectangle(ctx, bx + 5 * s, by - s, 2 * s, s, '#d6bb6f'); rectangle(ctx, bx + 3 * s, by - s, s, s, '#132e3c');
    const flap = reduced ? -2 : Math.sin(clock / 95) * 4; stroke({ x: bx - s, y: by + s }, { x: bx - 5 * s, y: by + flap * s }, 2, '#adbec0');
    if (active) rect(4 + p * 12, -24 + p * 10, 1.8, .7, '#edeed3');
  } else if (event.kind === 'paint' || event.kind === 'bucket') {
    const watery = event.kind === 'bucket', liquid = watery ? '#9bd9dd' : '#d898b7';
    ctx.save(); ctx.translate(x + 9 * s, y - 43 * s); ctx.rotate(active ? -.8 : recovery ? -.8 * (1 - p) : -.1);
    rectangle(ctx, -4 * s, -3 * s, 8 * s, 7 * s, watery ? '#96a7aa' : '#c38a72'); rectangle(ctx, -4 * s, -3 * s, 8 * s, 1.3 * s, '#e2ccb1');
    ctx.strokeStyle = '#c0cfbd'; ctx.lineWidth = Math.max(.5, s * .7); ctx.beginPath(); ctx.moveTo(-4 * s, -3 * s); ctx.quadraticCurveTo(0, -9 * s, 4 * s, -3 * s); ctx.stroke(); ctx.restore();
    if (active) for (let drop = 0; drop < 13; drop++) {
      const age = reduced ? (drop % 5) / 5 : wrap(clock / 850 + drop * .113), xx = 7 + Math.sin(drop * 2.3) * 6;
      rect(xx, -39 + age * 42, watery ? .8 : 1.2, 1.8 + drop % 2, liquid);
    }
    if (recovery) for (let puddle = 0; puddle < 5; puddle++) rect(-7 + puddle * 3, 1, 2.4, .7, liquid);
  } else if (event.kind === 'sticky') {
    const grip = rig?.hands[0] ?? at(-6, -22), other = rig?.hip ?? at(0, -13);
    rectangle(ctx, grip.x - 2.2 * s, grip.y - 1.3 * s, 4.4 * s, 2.4 * s, '#b0c96b');
    if (active) { ctx.strokeStyle = '#c1d986'; ctx.lineWidth = Math.max(.5, s * .7); ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.quadraticCurveTo(grip.x + 3 * s, other.y - 5 * s, other.x - 3 * s, other.y - 7 * s); ctx.stroke(); }
    rect(-11, -27, 4, 3, '#77904e'); rect(-10, -30, 2, 3, '#d4d89b');
  } else if (event.kind === 'rope-tangle') {
    // This story uses the connected safety rope, held at the actual handle.
    // Show the first grip there rather than adding a second rope at the boots.
    if (active && rig && p < .16) for (const hand of rig.hands) rectangle(ctx, hand.x - 2.2 * s, hand.y - 2.2 * s, 4.4 * s, .7 * s, '#f1d8a3');
  } else if (event.kind === 'balloon') {
    const anchor = rig?.hip ?? at(0, -13), bx = anchor.x + (8 + pulse * 6 + (recovery ? p * 17 : 0)) * s, by = anchor.y - (42 + pulse * 8 + (recovery ? p * 22 : 0)) * s;
    ctx.fillStyle = '#d58d78'; ctx.beginPath(); ctx.ellipse(bx, by, 9 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
    rectangle(ctx, bx - 4 * s, by - 7 * s, 3 * s, 7 * s, '#efb597'); rectangle(ctx, bx - s, by + 11 * s, 2 * s, 2 * s, '#e6c792');
    stroke({ x: bx, y: by + 13 * s }, anchor, .8, '#e4cc96');
  } else if (event.kind === 'false-sign') {
    const sign = at(13, -30); ctx.save(); ctx.translate(sign.x, sign.y); ctx.rotate(active ? Math.sin(p * Math.PI * 2) * .2 : 0);
    ctx.scale(direction, 1);
    rectangle(ctx, -8 * s, -4 * s, 16 * s, 8 * s, '#d6c58d'); rectangle(ctx, -6 * s, -.7 * s, 9 * s, 1.4 * s, recovery ? '#315e51' : '#ad6454');
    ctx.fillStyle = recovery ? '#315e51' : '#ad6454'; ctx.beginPath(); ctx.moveTo(5 * s, 0); ctx.lineTo(1 * s, -2.4 * s); ctx.lineTo(1 * s, 2.4 * s); ctx.fill(); ctx.restore();
    stroke(at(13, -26), at(13, -15), 1.3, '#587885');
  } else if (event.kind === 'banana') {
    ctx.strokeStyle = '#f2d16e'; ctx.lineWidth = Math.max(1.2, s * 1.8); ctx.beginPath(); ctx.moveTo(x - 4 * s, y - s); ctx.quadraticCurveTo(x + s, y + 3 * s, x + 5 * s, y - 2 * s); ctx.stroke();
    stroke(at(0, -1), at(-3, -4), 1.2, '#f2d16e'); stroke(at(0, -1), at(3, -4), 1.2, '#f2d16e'); rect(0, -4, 1, 1, '#8e7252');
  } else if (event.kind === 'zipline') {
    // Cable, trolley and grip are drawn together by drawLadderCrossing.
    if (active && rig) for (let streak = 0; streak < 3; streak++) {
      const hand = rig.hands[0], yy = hand.y + (5 + streak * 4) * s;
      stroke({ x: hand.x - direction * 13 * s, y: yy }, { x: hand.x - direction * 20 * s, y: yy }, .7, '#b8d2c68a');
    }
  } else if (event.kind === 'lights-out') {
    const lamp = rig?.hands[1] ?? at(10, -30), endX = geometry.laneX(event.toLane ?? event.lane);
    if (active) rectangle(ctx, Math.min(x, endX) - 13 * s, y - 44 * s, Math.abs(x - endX) + 26 * s, 49 * s, '#071b2d9c');
    rectangle(ctx, lamp.x - 2 * s, lamp.y - 3 * s, 4 * s, 7 * s, '#405b64'); rectangle(ctx, lamp.x - s, lamp.y - 2 * s, 2 * s, 3 * s, active ? '#e8ab65' : '#e8df9d');
    ctx.fillStyle = '#f0b66624'; ctx.beginPath(); ctx.moveTo(lamp.x, lamp.y); ctx.lineTo(lamp.x + 20 * s, lamp.y - 8 * s); ctx.lineTo(lamp.x + 20 * s, lamp.y + 12 * s); ctx.fill();
  } else if (event.kind === 'safety-net') {
    const netY = y + 2 * s, sag = active ? (1 - ease(p / .25)) * 4 * s : event.stage === 'setup' ? ease(p) * 4 * s : 1.5 * s;
    ctx.strokeStyle = '#a6c9c1'; ctx.lineWidth = Math.max(.6, s * .65);
    for (let thread = 0; thread < 6; thread++) { const xx = x + (thread - 2.5) * 4 * s; ctx.beginPath(); ctx.moveTo(xx, netY - 5 * s); ctx.lineTo(xx, netY + 4 * s + sag); ctx.stroke(); }
    for (let thread = 0; thread < 4; thread++) { ctx.beginPath(); ctx.moveTo(x - 11 * s, netY + thread * 2 * s); ctx.quadraticCurveTo(x, netY + thread * 2 * s + sag, x + 11 * s, netY + thread * 2 * s); ctx.stroke(); }
    stroke(at(-11, -2), { x: x - 11 * s, y: netY - 5 * s }, .9, '#d6c99c'); stroke(at(11, -2), { x: x + 11 * s, y: netY - 5 * s }, .9, '#d6c99c');
  }
  ctx.restore();
}

export function drawLadderConfetti(ctx: CanvasRenderingContext2D, geometry: LadderGeometry, elapsed: number, reduced: boolean) {
  if (reduced) return;
  for (let i = 0; i < 38; i++) {
    const fall = wrap(elapsed / (2500 + i % 5 * 360) + i * .113), x = wrap(i * .618 + Math.sin(fall * 6 + i) * .035) * geometry.width;
    rectangle(ctx, x, fall * geometry.height, 2 + i % 2, 2, ['#efd082', '#94cbb9', '#e99c82', '#97b8d4'][i % 4]);
  }
}
