import type { Candidate } from './election';
import { arenaFinalTechniques, arenaFloorExitTiming, arenaTechniqueExit, arenaTechniqueTargets, isArenaFinalTechnique, isArenaFloorDrag } from './arenaTechniques';
import { arenaPairRushCast, type ArenaPairRushOutcome } from './arenaPairRush';
import { arenaPairRushTargets } from './arenaPairRush';
import { ARENA_ESCAPE_DURATION, ARENA_ESCAPE_RELEASE_DURATION, arenaEscapeRoll, arenaEscapeTargets, type ArenaEscapeWindow } from './arenaEscape';
import { ARENA_RECOVERY_EXIT_DURATION, arenaRecoveryTargets, type ArenaRecoveryWindow } from './arenaRecovery';
import { ARENA_RIM_DURATION, arenaRimOutcome, arenaRimTargets, type ArenaRimWindow } from './arenaRimEvent';
import { ARENA_RIM_CHARGE_DURATION, arenaRimChargeOutcome, arenaRimChargeTargets, type ArenaRimChargeWindow } from './arenaRimCharge';
import { arenaPairDodgeOutcome, arenaPairDodgeTargets, type ArenaPairDodgeWindow } from './arenaPairDodge';
import { arenaPassingTripOutcome, arenaPassingTripTargets, type ArenaPassingTripWindow } from './arenaPassingTrip';
import { arenaSlideTripOutcome, arenaSlideTripEvadeOutcome, arenaSlideTripTargets, type ArenaSlideTripWindow } from './arenaSlideTrip';
import { arenaLinkedRushOutcome, type ArenaLinkedRushWindow } from './arenaLinkedRush';
import { arenaSupermanPunchOutcome, arenaSupermanPunchTargets, type ArenaSupermanPunchWindow } from './arenaSupermanPunch';
import { arenaKickCatchOutcome, arenaKickCatchTargets, type ArenaKickCatchWindow } from './arenaKickCatch';
import { arenaWrestlingMoveTargets, arenaWrestlingMoveOutcome, arenaWrestlingMoveIsCounter, type ArenaWrestlingMoveKind, type ArenaWrestlingMoveWindow } from './arenaWrestlingMoves';
export { arenaTechniqueTargets, arenaTechniqueExit, isArenaFinalTechnique } from './arenaTechniques';

export type ArenaTactic = 'team' | 'bait' | 'catch' | 'ram' | 'spin' | 'shove' | 'double-shove' | 'edge' | 'counter' | 'betrayal' | 'brace' | 'lift' | 'final' | 'armspin' | 'trip' | 'suplex' | 'sidekick' | 'elbow';
export type ArenaChargeSetup = { charger: ArenaPoint; receiver: ArenaPoint; side: 1 | -1; contactAt?: number | null; contactCharger?: ArenaPoint; contactReceiver?: ArenaPoint; loadDuration?: number; turnDuration?: number };
export type ArenaRound = { floorFinish?: { dragUntil: number; throwAt?: number | null; releaseAt?: number | null }; suplexGripAt?: number | null; elbowGripAt?: number | null; id: string; index: number; tactic: ArenaTactic; aggressor: string; helper?: string; victim: string; secondaryVictim?: string; counterSide?: 'front' | 'back'; counterFailed?: boolean; contactSide?: 1 | -1; chargeSetup?: ArenaChargeSetup; rushOutcome?: ArenaPairRushOutcome; rushContactAt?: number; rushPushDuration?: number; pairPickupAt?: number | null; rushLaunchAt?: number | null; sidekickLaunchAt?: number; pushContactAt?: number | null; timeScale?: number; prepares?: string; escape?: ArenaEscapeWindow; recovery?: ArenaRecoveryWindow; rim?: ArenaRimWindow; rimCharge?: ArenaRimChargeWindow; rimPushRoll?: number; rimPush?: boolean; wrestlingMove?: ArenaWrestlingMoveWindow; kickCatch?: ArenaKickCatchWindow; tripCounter?: boolean; supermanPunch?: ArenaSupermanPunchWindow; slideTrip?: ArenaSlideTripWindow; linkedRush?: ArenaLinkedRushWindow; pairDodge?: ArenaPairDodgeWindow & { partnerId: string; allowOut: boolean }; passingTrip?: ArenaPassingTripWindow & { joined?: boolean }; start: number; impact: number; resolve: number; end: number; final: boolean; exchange?: boolean };
export type ArenaPoint = { x: number; y: number };
export type ArenaMovingBody = ArenaPoint & { facing: number; motorX?: number; motorY?: number };
export type ArenaPodiumPlace = ArenaPoint & { id: string; rank: 1 | 2 | 3; readyAt: number };
export type ArenaRoamingStage = 'approach' | 'contact' | 'sidestep' | 'watch';
export type ArenaBeatStage = 'approach' | 'hold' | 'turn' | 'impact' | 'result';
export type ArenaBeat = { stage: ArenaBeatStage; progress: number; weightProgress: number; liftProgress: number };
export type ArenaActionStage = 'approach' | 'link' | 'joint-attack' | 'resist' | 'betrayal' | 'counter' | 'failed-counter' | 'reset' | 'lift' | 'throw' | 'release';
export type ArenaActionPose = 'pairlift' | 'guard' | 'grapple' | 'brace' | 'push' | 'lift' | 'overhead' | 'dodge' | 'run' | 'throw' | 'trip' | 'suplex' | 'drag' | 'sidekick' | 'stunned' | 'elbow';
export type ArenaActionActor = { id: string; role: 'aggressor' | 'victim' | 'helper'; offset: ArenaPoint; pose: ArenaActionPose; phase: number; gripId?: string; badge: string; turn?: number };
export type ArenaAction = { stage: ArenaActionStage; actors: ArenaActionActor[]; attackers: string[]; targetId: string; allies: string[]; liftedId?: string; lift: number; outcome: 'pending' | 'success' | 'resisted' | 'betrayed'; betrayed: boolean };
export const ARENA_MAX_GROUND_SPEED = 165;
export const ARENA_LIFT_HEIGHT = 42;
export const ARENA_RIM_PUSH_CHANCE = .70;
export const ARENA_RIM_PUSH_DISTANCE = 80;
export type ArenaThrowFrame = ArenaPoint & { groundX: number; groundY: number; height: number; angle: number; yaw?: number; phase: number; stage: 'hold' | 'flight' | 'rim-toss' | 'land' | 'roll' | 'recover' | 'walk' | 'stunned' | 'drag' };
export type ArenaChargeState = { stage: 'prepare' | 'charge' | 'dodge' | 'miss'; charge: number; dodge: number; preparation: number; chargeStartsAt: number; dodgeStartsAt: number };
export type ArenaChargeFallFrame = Omit<ArenaThrowFrame, 'stage'> & { stage: 'overrun' | 'fall' | 'land' | 'roll' | 'recover' | 'walk' };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
export const arenaSoloFinalTactics: readonly ArenaTactic[] = ['bait', 'catch', 'ram', 'spin', 'edge', 'counter', 'brace', 'lift', 'final', 'armspin', 'trip', 'suplex', 'sidekick'];
const eliminationTactics: ArenaTactic[] = ['bait', 'catch', 'edge', 'shove', 'counter', 'brace', 'lift', 'armspin', 'trip', 'suplex', 'sidekick'];

/** Shared ground movement keeps acceleration, braking and a zero-delta pause consistent. */
export function arenaMove(body: ArenaMovingBody, target: ArenaPoint, seconds: number, speed = 116): void {
  if (seconds <= 0) return;
  speed = Math.min(ARENA_MAX_GROUND_SPEED, Math.max(0, speed));
  const dx = target.x - body.x, dy = target.y - body.y, distance = Math.hypot(dx, dy);
  const groundDistance = Math.hypot(dx, dy * 2.2);
  const acceleration = speed * 3.4, brake = speed * 4.2;
  const wantedSpeed = Math.min(speed, Math.sqrt(2 * brake * Math.max(0, groundDistance - .6)));
  const wantedX = distance > .01 ? dx / groundDistance * wantedSpeed : 0, wantedY = distance > .01 ? dy / groundDistance * wantedSpeed : 0;
  const changeX = wantedX - (body.motorX ?? 0), changeY = wantedY - (body.motorY ?? 0);
  const change = Math.hypot(changeX, changeY), limit = Math.min(1, acceleration * seconds / Math.max(.001, change));
  body.motorX = (body.motorX ?? 0) + changeX * limit; body.motorY = (body.motorY ?? 0) + changeY * limit;
  const travelX = body.motorX * seconds, travelY = body.motorY * seconds;
  if (distance < Math.hypot(travelX, travelY) && dx * travelX + dy * travelY > 0) { body.x = target.x; body.y = target.y; body.motorX = 0; body.motorY = 0; }
  else { body.x += travelX; body.y += travelY; }
  if (Math.abs(body.motorX) > 25) body.facing = body.motorX < 0 ? -1 : 1;
}

/** Back steps and sidesteps keep the opponent in view instead of following travel direction. */
export function arenaFaceOpponent(body: ArenaMovingBody, opponent: ArenaPoint): void {
  if (Math.abs(opponent.x - body.x) > 8) body.facing = opponent.x < body.x ? -1 : 1;
}

/** Shared by the actors and commentary, so a label describes the visible action. */
export function arenaBeat(round: ArenaRound, elapsed: number): ArenaBeat {
  const progress = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const stage: ArenaBeatStage = elapsed >= round.impact ? round.exchange || elapsed >= round.resolve ? 'result' : 'impact' : progress < .30 ? 'approach' : progress < .52 ? 'hold' : 'turn';
  return { stage, progress, weightProgress: ease((progress - .52) / .20), liftProgress: ease((progress - .72) / .28) };
}

/** A forward lean precedes acceleration; the sidestep happens as the charge arrives. */
export function arenaChargeState(round: ArenaRound, elapsed: number): ArenaChargeState {
  const duration = Math.min(1600, Math.max(1, round.impact - round.start) * .64);
  const chargeStartsAt = round.impact - duration, dodgeStartsAt = chargeStartsAt + duration * .40;
  const t = clamp((elapsed - chargeStartsAt) / duration), ramp = .22;
  const charge = (t < ramp ? t * t / (2 * ramp) : t - ramp / 2) / (1 - ramp / 2);
  return { stage: elapsed < chargeStartsAt ? 'prepare' : t < .40 ? 'charge' : t < .96 ? 'dodge' : 'miss', charge, dodge: ease((t - .40) / .56), preparation: ease((elapsed - chargeStartsAt + 450) / 450), chargeStartsAt, dodgeStartsAt };
}

/** The charging loser runs toward the nearest edge while the opponent moves across its path. */
export function arenaChargeTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  if (round.chargeSetup) {
    const state = arenaChargeState(round, elapsed), { charger, receiver, side } = round.chargeSetup;
    const across = receiver.y >= 416 ? -1 : 1;
    const evade = arenaInsidePoint({ x: receiver.x, y: receiver.y + across * 61 }, 12);
    const rim = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((charger.y - 416) / 112) ** 2));
    const endX = round.exchange ? receiver.x + side * 43 : rim - side * 13;
    return { ...state, side, target: { x: mix(receiver.x, evade.x, state.dodge), y: mix(receiver.y, evade.y, state.dodge) }, charger: { x: mix(charger.x, endX, state.charge), y: charger.y } };
  }
  const state = arenaChargeState(round, elapsed), side = center.x >= 500 ? 1 : -1;
  const across = center.y >= 430 ? -1 : 1;
  const edgeX = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((center.y - 416) / 112) ** 2));
  const endX = round.exchange ? center.x + side * 86 : edgeX - side * 13;
  return { ...state, side, target: { x: center.x + side * (30 + state.dodge * 34), y: center.y + across * state.dodge * 61 }, charger: { x: mix(center.x - side * 102, endX, state.charge), y: center.y } };
}

/** Both wrestlers travel together toward the rim; the loser never gets lifted. */
export function arenaEdgeTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const rim = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((center.y - 416) / 112) ** 2));
  const contactAt = round.pushContactAt === null ? Infinity : round.pushContactAt ?? round.start + (round.impact - round.start) * .48;
  const pressure = ease((elapsed - contactAt) / Math.max(1, round.impact - contactAt)), shift = Math.sin(ease((p - .28) / .20) * Math.PI * 2) * 3 * (1 - pressure);
  const victimX = mix(center.x + side * 26, rim - side * 3, pressure) + side * shift;
  return { side, pressure, stage: p < .28 ? 'approach' : p < .48 ? 'contest' : p < .9 ? 'push' : 'tip', aggressor: { x: victimX - side * 53, y: center.y }, victim: { x: victimX, y: center.y } };
}

/** The receiver absorbs a charge, steps across it, then lifts from an established grip. */
export function arenaCatchTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const span = Math.max(1, round.impact - round.start), p = clamp((elapsed - round.start) / span);
  const side = round.chargeSetup?.side ?? (center.x >= 500 ? 1 : -1);
  const receiverOrigin = round.chargeSetup?.receiver ?? { x: center.x + side * 26, y: center.y };
  const chargerOrigin = round.chargeSetup?.charger ?? { x: center.x - side * 92, y: center.y };
  const charge = ease((p - .18) / .37);
  const contactAt = round.chargeSetup?.contactAt === null ? Infinity : round.chargeSetup?.contactAt ?? round.start + span * .55;
  const connected = elapsed >= contactAt;
  const loadDuration = round.chargeSetup?.loadDuration ?? Math.max(180, span * .12);
  const load = ease((elapsed - contactAt) / loadDuration);
  const turn = ease((elapsed - contactAt - loadDuration) / (round.chargeSetup?.turnDuration ?? Math.max(300, span * .28)));
  const receiveStep = ease((charge - .65) / .35) * 8;
  const caughtReceiver = round.chargeSetup?.contactReceiver ?? { x: receiverOrigin.x - side * 8, y: receiverOrigin.y };
  const caughtCharger = round.chargeSetup?.contactCharger ?? { x: receiverOrigin.x - side * 50, y: receiverOrigin.y };
  // The incoming roots are captured at real contact. First accept their weight,
  // then step across and rotate the supported torso before letting go.
  const receiver = connected ? { x: caughtReceiver.x - side * turn * 8, y: caughtReceiver.y + turn * 10 } : { x: receiverOrigin.x - side * receiveStep, y: receiverOrigin.y };
  const charger = connected ? { x: caughtCharger.x + side * turn * 11, y: caughtCharger.y } : { x: mix(chargerOrigin.x, receiverOrigin.x - side * 50, charge), y: mix(chargerOrigin.y, receiverOrigin.y, charge) };
  return { side, charge, turn, load, gripStrength: connected ? 1 : 0, height: ARENA_LIFT_HEIGHT * turn,
    receiverAngle: -side * turn * .20, chargerAngle: side * turn * .55,
    stage: p < .18 ? 'prepare' as const : !connected ? charge < 1 ? 'charge' as const : 'catch' as const : load < 1 ? 'load' as const : 'turn' as const,
    preparation: ease(p / .18), receiver, charger };
}

/** A successful shoulder charge transfers its momentum at contact; neither fighter takes a grip. */
export function arenaRamTargets(round: ArenaRound, elapsed: number, center: ArenaPoint): { side: number; charge: number; impact: number; preparation: number; stage: 'prepare' | 'charge' | 'contact' | 'release'; driver: ArenaPoint; victim: ArenaPoint } {
  const span = Math.max(1, round.impact - round.start), prepare = Math.min(240, span * .15);
  const side = round.chargeSetup?.side ?? round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const approach = Math.max(68, Math.min(122, span * .021));
  const charger = round.chargeSetup?.charger ?? { x: center.x - side * approach, y: center.y };
  const receiver = round.chargeSetup?.receiver ?? { x: center.x + side * 24, y: center.y };
  const destination = { x: receiver.x - side * 28, y: receiver.y };
  const distance = Math.hypot(destination.x - charger.x, destination.y - charger.y);
  const age = Math.max(0, elapsed - round.start - prepare) / 1000, ramp = .16;
  const traveled = ARENA_MAX_GROUND_SPEED * (age < ramp ? age * age / (2 * ramp) : age - ramp / 2);
  // The run has its own physical pace. The scheduled bout length cannot turn
  // a committed shoulder charge into several seconds of slow walking.
  const charge = clamp(traveled / Math.max(.001, distance));
  const contactAt = round.chargeSetup?.contactAt === null ? Infinity : round.chargeSetup?.contactAt ?? round.impact;
  const impact = elapsed >= contactAt ? 1 : 0;
  const stage = elapsed < round.start + prepare ? 'prepare' as const : !impact ? 'charge' as const : 'release' as const;
  return { side, charge, impact, preparation: ease((elapsed - round.start) / prepare), stage,
    driver: impact && round.chargeSetup?.contactCharger ? { ...round.chargeSetup.contactCharger } : { x: mix(charger.x, destination.x, charge), y: mix(charger.y, destination.y, charge) },
    victim: { ...(round.chargeSetup?.contactReceiver ?? receiver) } };
}

/** The first lift fails before its defender plants, changes the grip and turns once around the vertical axis. */
export function arenaSpinTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const lift = ease((p - .26) / .12) * (1 - ease((p - .38) / .06));
  const turnProgress = clamp((p - .52) / .48), ramp = .12;
  // Accelerate into the orbit and keep angular momentum through release.
  // Braking to zero at the final angle makes the counterthrow hesitate.
  const turn = (turnProgress < ramp ? turnProgress ** 2 / (2 * ramp) : turnProgress - ramp / 2) / (1 - ramp / 2);
  const angle = turn * Math.PI * 2;
  const reversal = ease((p - .38) / .14);
  const turningRadius = Math.min(38, (round.impact - round.start) / 1000 * .48 * (1 - ramp / 2) * 150 / (Math.PI * 2));
  const radius = mix(48, turningRadius, reversal);
  const defender = { x: center.x - side * 22, y: center.y };
  const attacker = { x: defender.x + side * radius * Math.cos(angle), y: defender.y + radius * Math.sin(angle) * .42 };
  return { side, angle, turn, lift, counterLift: ease((p - .54) / .25), defender, attacker,
    stage: p < .18 ? 'approach' as const : p < .26 ? 'grip' as const : p < .38 ? 'lift' as const : p < .44 ? 'plant' as const : p < .52 ? 'reverse' as const : p < 1 ? 'spin' as const : 'release' as const };
}

/** A third fighter bumps a wrestling pair; one catches their footing while the drawn loser is pushed out. */
export function arenaShoveTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const rim = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((center.y - 416) / 112) ** 2));
  const approach = ease((p - .18) / .40), pressure = ease((p - .62) / .38);
  const victimX = mix(center.x + side * 26, rim - side * 3, pressure);
  return { side, pressure, stage: p < .18 ? 'wrestle' as const : p < .58 ? 'approach' as const : p < .76 ? 'contact' as const : 'push' as const,
    aggressor: { x: mix(center.x - side * 91, victimX - side * 53, approach), y: center.y + mix(47, 10, approach) },
    victim: { x: victimX, y: center.y },
    helper: { x: mix(center.x - side * 26, victimX - side * 80, pressure), y: center.y - mix(8, 35, pressure) } };
}

/** A third person's contact passes through the locked pair before both lose their back steps. */
export function arenaDoubleShoveTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start)), side = round.contactSide ?? (center.x >= 500 ? 1 : -1);
  const approach = ease((p - .15) / .30), pressure = ease((p - .49) / .51);
  const rimAt = (y: number) => 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((y - 416) / 112) ** 2));
  const victimY = center.y + 14, helperY = center.y - 14;
  const victim = { x: mix(center.x + side * 22, rimAt(victimY) - side * 3, pressure), y: victimY };
  const helper = { x: mix(center.x - side * 22, rimAt(helperY) - side * 3, pressure), y: helperY };
  const rearX = side > 0 ? Math.min(victim.x, helper.x) : Math.max(victim.x, helper.x);
  return { side, pressure, stage: p < .15 ? 'wrestle' as const : p < .45 ? 'approach' as const : p < .56 ? 'contact' as const : 'push' as const,
    victim, helper, aggressor: { x: mix(center.x - side * 90, rearX - side * 53, approach), y: center.y + mix(43, 5, approach) } };
}

export function arenaExitDirection(round: ArenaRound, origin: ArenaPoint, outIndex: number): number {
  // A shoulder hit keeps the runner's momentum, including when the receiver
  // is still in the opposite half of the arena at the moment of impact.
  if (round.tactic === 'ram') return round.chargeSetup?.side ?? round.contactSide ?? (origin.x < 500 ? -1 : 1);
  return round.tactic === 'bait' || round.tactic === 'edge' || round.tactic === 'shove' || round.tactic === 'double-shove' || round.tactic === 'catch' || isArenaFinalTechnique(round) ? origin.x < 500 ? -1 : 1 : round.final ? 1 : outIndex % 2 ? 1 : -1;
}

/** Body contacts and commentary share an actual attack, rather than only an alliance label. */
export function arenaAction(round: ArenaRound, elapsed: number): ArenaAction {
  const beat = arenaBeat(round, elapsed), p = beat.progress, a = round.aggressor, v = round.victim, h = round.helper;
  const post = elapsed >= round.impact, release = round.exchange && post;
  const action: ArenaAction = { stage: release ? 'release' : post ? 'throw' : beat.stage === 'approach' ? 'approach' : beat.stage === 'hold' ? 'link' : 'lift', actors: [], attackers: [a], targetId: v, allies: [], liftedId: v, lift: beat.liftProgress * (round.exchange ? 18 : ARENA_LIFT_HEIGHT), outcome: release ? 'resisted' : elapsed >= round.resolve ? 'success' : 'pending', betrayed: false };
  const actor = (id: string, role: ArenaActionActor['role'], x: number, y: number, pose: ArenaActionPose, phase: number, gripId: string | undefined, badge: string) => ({ id, role, offset: { x, y }, pose, phase, gripId, badge });
  const phase = p >= .52 ? beat.liftProgress : clamp((p - .30) / .22);
  if (round.wrestlingMove && elapsed >= round.wrestlingMove.start && elapsed < round.resolve) {
    const frame = arenaWrestlingMoveTargets(round.wrestlingMove, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    const reverse = arenaWrestlingMoveIsCounter(round.wrestlingMove.kind);
    action.stage = frame.stage === 'approach' ? 'approach' : frame.gripStrength > 0 ? 'counter' : frame.stage === 'release' ? 'throw' : 'joint-attack';
    action.lift = frame.victimHeight; action.liftedId = frame.victimHeight > 0 ? v : undefined;
    action.attackers = [reverse && frame.contactAt == null ? v : a];
    action.actors = [actor(a, 'aggressor', frame.driver.x - 500, frame.driver.y - 416, frame.driverPose === 'run' ? 'run' : frame.gripStrength > 0 ? 'grapple' : 'guard', frame.driverPhase, frame.gripStrength > 0 ? v : undefined, reverse ? '달려오는 상대 받아내기' : '새 기술 공격'), actor(v, 'victim', frame.victim.x - 500, frame.victim.y - 416, frame.victimPose === 'run' ? 'run' : frame.victimEyesClosed ? 'stunned' : 'brace', frame.victimPhase, undefined, reverse ? '달려오는 선수' : '기술을 받는 선수')];
    return action;
  }
  if (round.kickCatch && elapsed >= round.kickCatch.start && elapsed < round.resolve) {
    const frame = arenaKickCatchTargets(round.kickCatch, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    action.stage = frame.stage === 'approach' ? 'approach' : frame.grip ? 'counter' : frame.stage === 'release' ? 'throw' : 'link';
    action.lift = 0; action.liftedId = frame.grip ? v : undefined;
    action.actors = [actor(a, 'aggressor', frame.catcher.x - 500, frame.catcher.y - 416, frame.catcherPose, frame.spinProgress, frame.grip ? v : undefined, frame.grip ? '발목 잡고 회전' : '옆차기를 지켜봄'), actor(v, 'victim', frame.kicker.x - 500, frame.kicker.y - 416, frame.kickerPose === 'run' ? 'run' : frame.kickerPose === 'sidekick' ? 'sidekick' : 'brace', frame.kickerPhase, undefined, frame.grip ? '옆차기 발목이 잡힘' : '도약해 옆차기')];
    return action;
  }
  if (round.prepares) {
    action.stage = p < .55 ? 'approach' : 'link'; action.lift = 0; action.liftedId = undefined;
    action.actors = [actor(a, 'aggressor', -25, 0, p < .55 ? 'guard' : 'grapple', p, p < .55 ? undefined : v, '다음 대결 접근'), actor(v, 'victim', 25, 0, p < .55 ? 'guard' : 'brace', p, p < .55 ? undefined : a, '같은 상대 맞잡기')];
    return action;
  }
  const rimCharge = arenaRimChargeTargets(round, elapsed, { x: 500, y: 416 });
  if (rimCharge && (elapsed < round.rimCharge!.end || rimCharge.outcome === 'dodge' && elapsed < round.resolve)) {
    const guarding = rimCharge.stage === 'approach', resisting = rimCharge.stage === 'brace' || rimCharge.stage === 'duel';
    action.stage = guarding ? 'approach' : resisting ? 'resist' : rimCharge.stage === 'out' || rimCharge.stage === 'done' ? 'throw' : 'counter';
    action.attackers = [v]; action.targetId = a; action.lift = 0; action.liftedId = undefined; action.outcome = resisting ? 'resisted' : 'pending';
    action.actors = [actor(a, 'aggressor', rimCharge.defender.x - 500, rimCharge.defender.y - 416, guarding ? 'guard' : resisting ? 'brace' : rimCharge.dodge > 0 ? 'dodge' : 'guard', resisting ? rimCharge.resistance : rimCharge.dodge, rimCharge.grip ? v : undefined, resisting ? '돌진을 두 발로 버팀' : '옆으로 돌진 회피'), actor(v, 'victim', rimCharge.charger.x - 500, rimCharge.charger.y - 416, guarding ? 'brace' : resisting ? 'push' : 'run', resisting ? rimCharge.resistance : rimCharge.charge, rimCharge.grip ? a : undefined, resisting ? '막힌 돌진에서 맞잡기' : '현재 위치에서 돌진')];
    return action;
  }
  const rim = arenaRimTargets(round, elapsed, { x: 500, y: 416 });
  if (rim?.active) {
    action.stage = rim.stage === 'approach' ? 'approach' : rim.stage === 'pressure' ? 'joint-attack' : rim.stage === 'brace' ? 'resist' : 'release';
    action.lift = 0; action.liftedId = undefined; action.outcome = rim.resistance > .8 ? 'resisted' : 'pending';
    action.actors = [actor(a, 'aggressor', rim.aggressor.x - 500, rim.aggressor.y - 416, rim.stage === 'approach' || rim.stage === 'release' ? 'guard' : 'push', rim.pressure, rim.grip ? v : undefined, '가장자리 밀기'), actor(v, 'victim', rim.victim.x - 500, rim.victim.y - 416, rim.stage === 'approach' || rim.stage === 'release' ? 'guard' : 'brace', rim.resistance, rim.grip ? a : undefined, rim.resistance > .8 ? '두 발로 버팀' : '밀기에 대응')];
    return action;
  }
  const recovery = arenaRecoveryTargets(round, elapsed, { x: 500, y: 416 });
  if (recovery?.active) {
    const thrower = round.recovery?.throwerId ?? a;
    action.attackers = [thrower];
    action.stage = recovery.stage === 'approach' ? 'approach' : recovery.stage === 'hold' ? 'link' : recovery.stage === 'lift' || recovery.stage === 'overhead' ? 'lift' : recovery.airborne ? 'throw' : 'release';
    action.lift = recovery.grip ? recovery.height : 0; action.liftedId = recovery.grip ? v : undefined; action.outcome = 'pending';
    const throwingPose: ArenaActionPose = recovery.stage === 'approach' || recovery.stage === 'separate' || recovery.stage === 'release' ? 'guard' : recovery.stage === 'hold' ? 'grapple' : recovery.stage === 'overhead' || recovery.kind === 'overhead-escape' && recovery.stage === 'lift' ? 'overhead' : recovery.stage === 'lift' ? 'lift' : 'throw';
    action.actors = [actor(thrower, 'aggressor', recovery.thrower.x - 500, recovery.thrower.y - 416, throwingPose, recovery.grip ? recovery.liftPhase : recovery.throwPhase, recovery.grip ? v : undefined, recovery.stage === 'hold' ? '몸통 맞잡기' : '던지기'), actor(v, 'victim', recovery.receiver.x - 500, recovery.receiver.y - 416, recovery.stage === 'approach' || recovery.stage === 'separate' || recovery.stage === 'release' ? 'guard' : 'brace', recovery.liftPhase, recovery.grip ? thrower : undefined, recovery.grip ? '들기를 버티는 선수' : recovery.kind === 'overhead-escape' ? '점프로 탈출해 착지' : '회전해 착지')];
    return action;
  }
  const escape = arenaEscapeTargets(round, elapsed, { x: 500, y: 416 });
  if (escape?.active) {
    action.stage = escape.stage === 'grip' ? 'link' : escape.stage === 'break' ? 'reset' : escape.stage === 'flee' || escape.stage === 'chase' ? 'release' : 'approach';
    action.attackers = []; action.targetId = escape.runnerId; action.lift = 0; action.liftedId = undefined;
    const pose = (id: string): ArenaActionPose => escape.stage === 'grip' ? id === escape.runnerId ? 'brace' : 'grapple' : escape.stage === 'break' ? id === escape.runnerId ? 'dodge' : 'push' : escape.stage === 'flee' || escape.stage === 'chase' ? 'run' : 'guard';
    action.actors = [escape.runnerId, escape.chaserId].map(id => {
      const point = id === escape.runnerId ? escape.runner : escape.chaser;
      return actor(id, id === escape.runnerId ? 'aggressor' : 'victim', point.x - 500, point.y - 416, pose(id), escape.phase, escape.grip ? id === escape.runnerId ? escape.chaserId : escape.runnerId : undefined, id === escape.runnerId ? '손을 빼고 이탈' : escape.separated ? '추격 포기' : '같은 상대 추격');
    });
    return action;
  }
  if (round.tactic === 'double-shove' && round.rushOutcome && h) {
    const rush = arenaPairRushTargets(round, elapsed, { x: 500, y: 416 });
    const caught = rush.grip === 'arms-legs';
    const counter = rush.outcome === 'counter-throw';
    const rushPost = post && !rush.waitingForGrip && (!counter || elapsed >= rush.requiredImpactAt);
    action.stage = rushPost ? 'throw' : caught ? rush.lift > 0 ? 'joint-attack' : 'link' : rush.stage === 'rebound' || rush.stage === 'groggy' ? 'resist' : rush.stage === 'push' ? 'joint-attack' : 'approach';
    action.attackers = counter ? [a, h] : [a]; action.allies = counter && caught ? [a, h] : [];
    action.targetId = v; action.lift = rush.lift; action.liftedId = rush.lift > 0 ? v : undefined;
    const point = (id: string) => id === a ? rush.aggressor : id === h ? rush.helper : rush.victim;
    const pose = (id: string): ArenaActionPose => id === rush.chargerId ? rush.stage === 'charge' ? 'run' : !counter && rush.chargerPose === 'push' ? 'push' : counter && ['groggy', 'grip', 'load', 'lift', 'overhead', 'toss', 'release'].includes(rush.stage) ? 'stunned' : 'brace' : caught ? counter ? 'pairlift' : rush.lift > 0 ? 'overhead' : 'grapple' : rushPost ? counter ? 'throw' : 'brace' : rush.grip === 'pair' ? 'grapple' : 'brace';
    const grip = (id: string) => caught ? id === v ? undefined : v : rush.grip === 'pair' && rush.pairIds.includes(id) ? rush.pairIds.find(other => other !== id) : undefined;
    action.actors = [actor(a, 'aggressor', point(a).x - 500, point(a).y - 416, pose(a), !counter && rush.chargerPose === 'push' ? rush.pushStroke : rush.phase, grip(a), counter ? '어깨를 받치는 선수' : '충돌로 밀어붙이는 선수'), actor(v, 'victim', point(v).x - 500, point(v).y - 416, pose(v), rush.phase, grip(v), counter ? '돌진 후 기절' : '함께 밀리는 선수'), actor(h, 'helper', point(h).x - 500, point(h).y - 416, pose(h), rush.phase, grip(h), counter ? '다리를 잡는 선수' : '함께 밀리는 선수')];
    return action;
  }
  if (isArenaFinalTechnique(round)) {
    const technique = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
    const linked = !!technique.grip;
    action.stage = technique.stage === 'approach' || technique.stage === 'reset' ? 'approach' : linked ? 'link' : post ? 'throw' : 'counter';
    action.lift = technique.lift; action.liftedId = technique.lift > 0 ? v : undefined;
    const ap: ArenaActionPose = round.tripCounter && technique.stage === 'probe' ? 'brace' : technique.aggressorPose ?? (technique.stage === 'probe' ? 'push' : technique.stage === 'reset' ? 'guard' : round.tactic === 'armspin' ? technique.stage === 'pivot' ? 'grapple' : post ? 'throw' : 'grapple' : round.tactic === 'trip' ? technique.stage === 'hook' || technique.stage === 'kick' ? 'trip' : post || technique.stage === 'fall' || technique.stage === 'stunned' ? 'guard' : 'push' : round.tactic === 'suplex' ? post ? 'drag' : technique.stage === 'slam' || technique.stage === 'stunned' ? 'guard' : 'grapple' : technique.stage === 'jump' || technique.stage === 'kick' || technique.stage === 'impact' ? 'sidekick' : 'guard');
    const vp: ArenaActionPose = round.tripCounter && technique.stage === 'probe' ? 'push' : technique.stage === 'reset' ? 'dodge' : technique.stage === 'stunned' || round.tactic === 'suplex' && post ? 'stunned' : 'brace';
    if (round.tactic === 'elbow') {
      const initialLift = !!technique.victimGrip;
      const floor = post && round.elbowGripAt !== null ? arenaTechniqueExit(round, elapsed - round.impact, { x: 500, y: 416 }, { x: 885, y: 436 }, 1, round.timeScale ?? 1) : undefined;
      const dragging = floor?.stage === 'stunned' || floor?.stage === 'drag';
      const held = floor?.stage === 'hold', raising = held && (!round.floorFinish || round.floorFinish.throwAt != null && elapsed >= round.floorFinish.throwAt);
      action.stage = technique.phase < .30 ? 'approach' : initialLift ? technique.aggressorLift > 0 ? 'lift' : 'link' : floor ? raising ? 'lift' : dragging || held ? 'link' : floor.stage === 'rim-toss' ? 'throw' : 'release' : technique.stage === 'ankle-grip' ? 'link' : 'counter';
      action.attackers = initialLift ? [v] : [a]; action.targetId = initialLift ? a : v;
      // The technique renderer owns the counterattacker's held height.
      action.lift = 0; action.liftedId = undefined;
      const ap: ArenaActionPose = floor ? raising ? 'overhead' : dragging || held ? 'drag' : floor.stage === 'rim-toss' ? 'throw' : 'guard' : technique.aggressorPose ?? 'guard';
      action.actors = [actor(a, 'aggressor', technique.aggressor.x - 500, technique.aggressor.y - 416, ap, floor?.phase ?? technique.phase, (dragging || held || !post && technique.grip) ? v : undefined, floor?.stage === 'drag' ? '발끝 잡아 끌기' : raising ? '발끝을 들어 던질 힘 싣기' : floor?.stage === 'rim-toss' ? '경계에서 던지기' : '들린 뒤 반격'), actor(v, 'victim', technique.victim.x - 500, technique.victim.y - 416, initialLift ? 'lift' : dragging || held || technique.victimPose ? 'stunned' : 'guard', technique.phase, initialLift ? a : undefined, '먼저 들어 올린 선수')];
      return action;
    }
    action.actors = [
      { ...actor(a, 'aggressor', technique.aggressor.x - 500, technique.aggressor.y - 416, ap, technique.phase, linked ? v : undefined, round.final ? '최종 기술' : '기술 공격'), turn: technique.yaw },
      actor(v, 'victim', technique.victim.x - 500, technique.victim.y - 416, vp, technique.phase, linked ? a : undefined, '기술에 대응'),
    ];
  } else if (round.tactic === 'double-shove' && h) {
    const shove = arenaDoubleShoveTargets(round, elapsed, { x: 675, y: 430 });
    action.stage = post ? 'throw' : shove.stage === 'wrestle' ? 'link' : shove.stage === 'approach' ? 'approach' : 'joint-attack';
    action.lift = 0; action.liftedId = undefined; action.targetId = h;
    action.actors = [actor(a, 'aggressor', -90, 43, p < .45 ? 'guard' : 'push', shove.pressure, p < .45 || post ? undefined : h, '두 명을 밀어붙이기'), actor(v, 'victim', 22, 14, 'brace', shove.pressure, post ? undefined : h, '같이 밀리는 선수'), actor(h, 'helper', -22, -14, 'brace', shove.pressure, post ? undefined : v, '같이 밀리는 선수')];
  } else if (round.tactic === 'shove' && h) {
    const shove = arenaShoveTargets(round, elapsed, { x: 675, y: 430 });
    action.stage = release ? 'release' : post ? 'throw' : shove.stage === 'wrestle' ? 'link' : shove.stage === 'approach' ? 'approach' : 'joint-attack';
    action.lift = 0; action.liftedId = undefined;
    action.actors = [actor(a, 'aggressor', -91, 47, p < .58 ? 'guard' : 'push', shove.pressure, p < .58 ? undefined : v, '옆에서 밀기'), actor(v, 'victim', 26, 0, 'brace', shove.pressure, p < .62 ? h : a, '맞잡다가 밀림'), actor(h, 'helper', -26, -8, p < .62 ? 'grapple' : 'dodge', shove.pressure, p < .62 ? v : undefined, '발 고쳐 딛기')];
  } else if (round.tactic === 'ram') {
    const ram = arenaRamTargets(round, elapsed, { x: 500, y: 416 });
    action.stage = release ? 'release' : post ? 'throw' : ram.stage === 'contact' ? 'counter' : 'approach';
    action.lift = 0; action.liftedId = post ? v : undefined;
    action.actors = [actor(a, 'aggressor', ram.driver.x - 500, ram.driver.y - 416, ram.stage === 'prepare' || post ? 'brace' : 'run', ram.charge, undefined, '어깨로 돌진'), actor(v, 'victim', ram.victim.x - 500, ram.victim.y - 416, 'brace', ram.impact, undefined, ram.stage === 'contact' || post ? '충돌에 튀어오름' : '돌진을 막는 선수')];
  } else if (round.tactic === 'spin') {
    const spin = arenaSpinTargets(round, elapsed, { x: 500, y: 416 }), reversed = p >= .44;
    action.stage = release ? 'release' : post ? 'throw' : p < .18 ? 'approach' : p < .26 ? 'link' : p < .44 ? 'resist' : 'counter';
    action.attackers = reversed ? [a] : [v]; action.targetId = reversed ? v : a; action.liftedId = action.targetId;
    action.lift = reversed ? spin.counterLift * (round.exchange ? 7 : 12) : spin.lift * 16;
    action.actors = [
      { ...actor(a, 'aggressor', -22, 0, p < .18 ? 'guard' : p < .44 ? 'brace' : p < .54 ? 'grapple' : 'lift', reversed ? spin.counterLift : spin.lift, p >= .18 ? v : undefined, reversed ? '한 바퀴 되치기' : '들기를 버티는 선수'), turn: spin.angle },
      { ...actor(v, 'victim', 26, 0, p < .18 ? 'guard' : p < .44 ? 'lift' : 'brace', reversed ? spin.counterLift : spin.lift, p >= .18 ? a : undefined, reversed ? '역으로 잡힌 선수' : '먼저 들어 올리기'), turn: spin.angle },
    ];
  } else if (round.tactic === 'catch') {
    const catchState = arenaCatchTargets(round, elapsed, { x: 675, y: 430 });
    const caught = catchState.gripStrength > 0;
    action.stage = release ? 'release' : post ? 'throw' : catchState.stage === 'prepare' || catchState.stage === 'charge' ? 'approach' : catchState.stage === 'catch' || catchState.stage === 'load' ? 'link' : 'lift';
    action.lift = catchState.height * (round.exchange ? 14 / ARENA_LIFT_HEIGHT : 1);
    action.actors = [actor(a, 'aggressor', 26, 0, !caught ? 'brace' : catchState.turn === 0 ? 'grapple' : 'lift', catchState.turn, caught ? v : undefined, '돌진 받아 되치기'), actor(v, 'victim', -92 + catchState.charge * 68, 0, catchState.stage === 'prepare' ? 'brace' : caught ? 'brace' : 'run', catchState.charge, caught ? a : undefined, caught ? '몸통이 잡혔다' : '돌진')];
  } else if (round.tactic === 'team' && h) {
    action.stage = release ? 'release' : post ? 'throw' : p < .30 ? 'approach' : p < .52 ? 'link' : 'joint-attack';
    action.attackers = [a, h]; action.allies = [a, h];
    action.actors = [actor(a, 'aggressor', -44, 0, p >= .52 ? 'lift' : 'grapple', phase, v, '함께 공격'), actor(v, 'victim', 0, 0, 'brace', phase, a, release ? '공격 버팀' : '양쪽에 대응'), actor(h, 'helper', 44, 0, p >= .52 ? 'lift' : 'grapple', phase, v, '함께 공격')];
  } else if (round.tactic === 'betrayal' && h) {
    const q = round.counterFailed ? clamp(p / .62) : p, front = round.counterSide === 'back' ? 1 : -1;
    const attack = ease((q - .34) / .24), resist = ease((q - .64) / .12), broken = q >= .76;
    const counter = ease((q - .84) / .16), retry = ease((p - .80) / .20), reset = !!round.counterFailed && p >= .62 && p < .80;
    action.stage = release ? 'release' : post ? 'throw' : reset ? p < .70 ? 'failed-counter' : 'reset' : round.counterFailed && p >= .80 ? 'lift' : q < .22 ? 'approach' : q < .34 ? 'link' : q < .64 ? 'joint-attack' : q < .76 ? 'resist' : q < .84 ? 'betrayal' : 'counter';
    action.betrayed = broken; action.allies = [v, h]; action.attackers = broken ? [a] : [v, h]; action.targetId = broken ? v : a;
    action.liftedId = broken ? v : a;
    // The alliance first raises its opponent. That opponent plants a foot and
    // resists before the helper lets go; the counter is an observable new action.
    action.lift = round.counterFailed && p >= .62 ? reset ? 10 * (1 - ease((p - .62) / .08)) : retry * (round.exchange ? 18 : ARENA_LIFT_HEIGHT) : broken ? counter * (round.counterFailed ? 10 : round.exchange ? 18 : ARENA_LIFT_HEIGHT) : attack * (1 - resist) * 20;
    action.outcome = release || reset ? 'resisted' : broken ? 'betrayed' : action.stage === 'resist' ? 'resisted' : 'pending';
    const recontact = round.counterFailed ? ease((p - .73) / .10) : 0, phaseAfter = round.counterFailed && p >= .80 ? retry : counter;
    const escaped = reset && p >= .70, grip = escaped ? undefined : broken ? v : round.counterSide === 'back' ? h : v;
    action.actors = [
      actor(a, 'aggressor', -front * recontact * 25, 0, escaped ? 'guard' : broken ? q >= .84 ? reset ? 'grapple' : 'lift' : 'grapple' : 'brace', broken ? phaseAfter : resist, grip, reset ? '역습이 막혔다' : recontact > 0 ? '다시 맞잡기' : broken ? round.counterSide === 'back' ? '뒤쪽으로 역습' : '앞쪽으로 역습' : '공동공격 버팀'),
      actor(v, 'victim', front * mix(44, 25, recontact), escaped ? -Math.sin(clamp((p - .70) / .10) * Math.PI) * 8 : 0, escaped ? 'dodge' : broken ? 'brace' : q >= .34 ? 'lift' : 'grapple', broken ? phaseAfter : attack, escaped ? undefined : a, reset ? '역습을 버텨냄' : broken ? '혼자 대응' : '동맹 공격'),
      actor(h, 'helper', -front * (44 + ease((q - .76) / .15) * 26), ease((q - .76) / .15) * 22, broken ? 'guard' : q >= .34 ? 'lift' : 'grapple', broken ? ease((q - .76) / .15) : attack, broken ? undefined : a, broken ? '한 발 물러남' : '동맹 공격'),
    ].filter(part => !broken || part.id !== h);
  } else {
    let ax = -25, ay = 0, vx = 25, vy = 0;
    let ap: ArenaActionPose = p < .30 ? 'guard' : 'grapple', vp: ArenaActionPose = 'brace';
    if (round.tactic === 'bait') {
      const charge = arenaChargeState(round, elapsed);
      ax = -30 - charge.dodge * 34; ay = charge.dodge * 61; vx = 102 - charge.charge * 188;
      ap = charge.dodge > 0 ? 'dodge' : 'guard'; vp = charge.stage === 'prepare' ? charge.preparation > 0 ? 'brace' : 'guard' : 'run';
      action.lift = 0; action.liftedId = undefined; action.attackers = [v]; action.targetId = a;
    } else if (round.tactic === 'edge') {
      ap = p < .28 ? 'guard' : p < .48 ? 'grapple' : 'push'; vp = p < .28 ? 'guard' : 'brace';
      ax = -27; vx = 26;
      action.lift = 0; action.liftedId = undefined;
    } else if (round.tactic === 'counter' || round.tactic === 'brace') {
      const press = Math.sin(clamp((p - .30) / .22) * Math.PI / 2) * 12;
      const shift = p < .52 ? press : press * (1 - beat.weightProgress); ax -= shift; vx -= shift;
      ap = p < .52 ? 'brace' : 'lift'; vp = p < .52 ? 'push' : 'brace';
    } else { ap = p < .52 ? 'grapple' : 'lift'; }
    if (round.tactic !== 'bait' && round.tactic !== 'edge' && p >= .30 && p < .72) {
      const shift = Math.sin((p - .30) / .42 * Math.PI * 2) * 3.5 * (1 - beat.liftProgress);
      ax += shift; vx += shift;
    }
    action.actors = [actor(a, 'aggressor', ax, ay, ap, phase, round.tactic === 'bait' ? undefined : v, '공격'), actor(v, 'victim', vx, vy, vp, phase, round.tactic === 'bait' ? undefined : a, '대응')];
  }
  if (release) { action.lift *= 1 - ease((elapsed - round.impact) / Math.max(1, (round.end - round.impact) * .24)); action.actors.forEach(part => { part.pose = part.id === action.targetId ? 'dodge' : 'guard'; part.gripId = undefined; }); }
  else if (post && !isArenaFinalTechnique(round)) action.actors.forEach(part => { if (part.id !== v && part.id !== round.secondaryVictim) { part.pose = round.tactic === 'ram' ? 'brace' : round.tactic === 'bait' ? 'dodge' : round.tactic === 'double-shove' ? 'push' : round.tactic === 'edge' || round.tactic === 'shove' ? part.id === h ? 'dodge' : 'push' : elapsed - round.impact < 350 * (round.resolve - round.impact) / 1100 ? 'throw' : 'guard'; part.gripId = undefined; } });
  if (post && round.tactic === 'spin') action.actors.forEach(part => { part.gripId = undefined; });
  if (action.stage === 'approach' && round.tactic !== 'catch' && round.tactic !== 'shove' && round.tactic !== 'double-shove' && round.tactic !== 'ram') action.actors.forEach(part => { if (round.tactic !== 'bait' || part.pose !== 'brace') part.pose = 'guard'; part.gripId = undefined; });
  if (round.contactSide === -1 && !isArenaFinalTechnique(round) && !['bait', 'catch', 'ram', 'spin', 'shove', 'double-shove', 'edge'].includes(round.tactic)) action.actors.forEach(part => { part.offset.x *= -1; });
  return action;
}

/** Even field coverage without left/right starting teams. The ellipse stays inside the sand. */
export function arenaStartingPoint(index: number, count: number): ArenaPoint {
  const total = Math.max(1, Math.floor(count));
  const layouts: Record<number, number[][]> = {
    1: [[500, 425]], 2: [[350, 425], [650, 425]],
    3: [[500, 345], [310, 470], [690, 470]],
    4: [[315, 365], [685, 365], [315, 480], [685, 480]],
  };
  const distributed = [[300, 348], [750, 430], [420, 510], [565, 348], [250, 430], [580, 510], [700, 348], [390, 430], [435, 348], [610, 430]];
  const points = layouts[total] ?? distributed;
  const point = points[Math.max(0, Math.min(points.length - 1, index))];
  return { x: point[0], y: point[1] };
}

/** Ceremony places follow the result, never the side from which someone left the ring. */
export function arenaPodium(order: string[], duration = 44_000, rushRoll = 7, escapeSeed?: number): ArenaPodiumPlace[] {
  const places = [{ x: 500, y: 443 }, { x: 350, y: 470 }, { x: 650, y: 488 }];
  const rounds = arenaRounds(order, duration, rushRoll, escapeSeed), final = rounds.at(-1), unit = final?.timeScale ?? duration / 44_000;
  const recoveryAt = (round: ArenaRound) => isArenaFloorDrag(round) ? round.impact + arenaFloorExitTiming(round, round.timeScale ?? unit).recoverUntil + 1 : round.impact + 2101 * unit;
  const finalReadyAt = final ? Math.max(final.resolve, isArenaFloorDrag(final) ? recoveryAt(final) : 0) : 0;
  return order.slice(0, 3).map((id, index) => {
    const exit = rounds.find(round => arenaEliminatedIds(round).includes(id));
    const recovered = exit ? recoveryAt(exit) : 0;
    const readyAt = final ? Math.max(finalReadyAt + (index === 2 ? 650 * unit : 0), index === 0 ? 0 : recovered) : 0;
    return { id, rank: (index + 1) as 1 | 2 | 3, readyAt, ...places[index] };
  });
}

/** A released fighter continues from this contact, rather than returning to an assigned home. */
export function arenaRoamingTarget(origin: ArenaPoint, opponent: ArenaPoint | undefined, index: number, stage: ArenaRoamingStage): ArenaPoint {
  if (!opponent || stage === 'watch' || stage === 'contact') return { ...origin };
  const dx = opponent.x - origin.x, dy = opponent.y - origin.y, gap = Math.hypot(dx, dy);
  const nx = dx / Math.max(1, gap), ny = dy / Math.max(1, gap);
  const advance = stage === 'approach' ? Math.max(0, gap - 68) : 0;
  const sidestep = stage === 'sidestep' ? (index % 2 ? 1 : -1) * 18 : 0;
  const target = { x: origin.x + nx * advance + ny * sidestep, y: origin.y + ny * advance - nx * sidestep * .65 };
  const rx = (target.x - 500) / 303, ry = (target.y - 416) / 112, radius = Math.hypot(rx, ry);
  if (radius > 1) return { x: 500 + (target.x - 500) / radius, y: 416 + (target.y - 416) / radius };
  return target;
}

/** Small live guard steps stay anchored to the present encounter, never a starting slot. */
export function arenaGuardTarget(origin: ArenaPoint, index: number, elapsed: number): ArenaPoint {
  return { x: origin.x + Math.sin((elapsed + index * 371) / 750) * 5, y: origin.y + Math.sin((elapsed + index * 173) / 590) * 2.3 };
}

/** An unpaired fighter follows nearby action and gives a moving bout room to pass. */
export function arenaNearbyResponse(origin: ArenaPoint, fighting: readonly ArenaPoint[], index: number) {
  const nearest = [...fighting].sort((a, b) => Math.hypot(a.x - origin.x, (a.y - origin.y) * 1.5) - Math.hypot(b.x - origin.x, (b.y - origin.y) * 1.5))[0];
  if (!nearest) return undefined;
  const dx = nearest.x - origin.x, dy = nearest.y - origin.y, gap = Math.hypot(dx, dy);
  if (gap > 220) return undefined;
  const nx = gap < 1 ? index % 2 ? 1 : -1 : dx / gap, ny = dy / Math.max(1, gap);
  const advance = Math.max(-34, Math.min(24, gap - 132)), around = (index % 2 ? 1 : -1) * (gap < 170 ? 25 : 12);
  const target = { x: origin.x + nx * advance + ny * around, y: origin.y + ny * advance - nx * around * .65 };
  const radius = Math.hypot((target.x - 500) / 292, (target.y - 416) / 103);
  if (radius > 1) { target.x = 500 + (target.x - 500) / radius; target.y = 416 + (target.y - 416) / radius; }
  return { target, facing: dx < 0 ? -1 : 1, pose: gap < 100 ? 'dodge' as const : 'guard' as const, threat: nearest };
}

/** Keep the pair's own meeting point, moving only far enough to clear another bout. */
export function arenaLocalContact(origin: ArenaPoint, occupied: readonly ArenaPoint[]): ArenaPoint {
  const inside = (point: ArenaPoint) => {
    const radius = Math.hypot((point.x - 500) / 240, (point.y - 416) / 73);
    return radius > 1 ? { x: 500 + (point.x - 500) / radius, y: 416 + (point.y - 416) / radius } : point;
  };
  const anchor = inside({ ...origin });
  const clearance = (point: ArenaPoint) => Math.min(Infinity, ...occupied.map(other => Math.hypot((point.x - other.x) / 108, (point.y - other.y) / 63)));
  if (clearance(anchor) >= 1) return anchor;
  const options = [anchor, ...[-1, 1].flatMap(side => [
    ...[42, 66, 108].map(shift => ({ x: anchor.x + side * shift, y: anchor.y })),
    ...[22, 44, 66].map(shift => ({ x: anchor.x, y: anchor.y + side * shift })),
  ])].map(inside);
  const open = options.filter(point => clearance(point) >= 1);
  if (open.length) return open.sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y))[0];
  return options.sort((a, b) => clearance(b) - clearance(a))[0];
}

export function arenaApproachSpeed(distance: number): number {
  return 86 + Math.min(36, Math.max(0, distance - 65) * .18);
}

export function arenaRimDistance(origin: ArenaPoint): number {
  const radius = 303 * Math.sqrt(Math.max(0, 1 - ((origin.y - 416) / 112) ** 2));
  return Math.max(0, radius - Math.abs(origin.x - 500));
}

export function arenaInsidePoint(point: ArenaPoint, inset = 24): ArenaPoint {
  const y = Math.max(328 + inset, Math.min(504 - inset, point.y));
  const radius = Math.max(0, 303 * Math.sqrt(Math.max(0, 1 - ((y - 416) / 112) ** 2)) - inset);
  return { x: Math.max(500 - radius, Math.min(500 + radius, point.x)), y };
}

export function arenaEliminatedIds(round: ArenaRound): string[] {
  return round.exchange ? [] : [round.victim, ...(round.secondaryVictim ? [round.secondaryVictim] : [])];
}

/** One physical stage supplies the headline, story and floating action words. */
export function arenaWrestlingPresentation(round: ArenaRound, elapsed: number, names?: { aggressor: string; victim: string }) {
  const window = round.wrestlingMove!;
  const frame = arenaWrestlingMoveTargets(window, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
  const reverse = arenaWrestlingMoveIsCounter(window.kind);
  const a = names?.aggressor ?? (reverse ? '받아낸 선수' : '공격한 선수'), v = names?.victim ?? (reverse ? '달려온 선수' : '상대');
  const labels: Record<ArenaWrestlingMoveKind, string> = { clothesline: '넘어뜨리기', dropkick: '드롭킥', powerbomb: '들어 내려찍기', backbodydrop: '돌진 카운터', spinebuster: '돌진 받아내기', scoopslam: '안아 메치기' };
  const steps = window.kind === 'clothesline' ? ['달려들기', '목에 팔을 감아 지나치기', '머리를 맞대며 함께 넘어짐', '자세 회복', '발목으로 접근', '양발목 잡기', '발끝 잡고 한 바퀴', '회전하며 손 놓기', '상대만 장외']
    : window.kind === 'dropkick' ? ['달려들기', '발 딛고 도약', '두 발 뻗기', '가슴에 실제 접촉', '공격자 착지', '공격자 자세 회복', '상대만 장외']
    : window.kind === 'spinebuster' ? ['상대 돌진', '허리 받아내기', '무게 받아 들기', '뒤로 누우며 메치기', '기절', '발목으로 접근', '두 발목 잡기', '발끝 잡고 한 바퀴', '회전하며 손 놓기', '상대만 장외']
    : window.kind === 'powerbomb' ? ['상대 돌진', '달려온 허리 받아 잡기', '어깨 위로 들어 올리기', '무게를 받쳐 버티기', '등부터 모래에 내려찍기', '자세 회복', '기절', '발목으로 접근', '두 발끝 잡기', '발끝 잡고 한 바퀴', '회전하며 손 놓기', '상대만 장외']
    : window.kind === 'scoopslam' ? ['상대 돌진', '발 딛고 준비', '상체와 허벅지 받치기', '머리 위까지 안아 들기', '높이 받쳐 몸 돌리기', '힘을 실어 등부터 내려찍기', '기절', '발목으로 접근', '두 발끝 잡기', '발끝 잡고 한 바퀴', '회전하며 손 놓기', '상대만 장외']
    : ['거리 좁히기', '발 딛고 준비', labels[window.kind], '머리 위로 들어 넘기기', '모래 위에 넘어졌다', '기절', '발목으로 접근', '두 발끝 잡기', '발끝 잡고 한 바퀴', '회전하며 손 놓기', '상대만 장외'];
  const stage = frame.stage as string;
  let step = Math.max(0, ['approach', 'load', 'attack', 'contact', 'fall', 'groggy', 'ankle-approach', 'ankle-grip', 'toss', 'release'].indexOf(stage));
  let wordId = round.aggressor, word = labels[window.kind] + '!';
  let title = word, detail = '';
  if (stage === 'approach') {
    wordId = reverse ? round.victim : round.aggressor; word = '돌진!';
    title = reverse ? '돌진해 오는 상대를 본다' : '상대를 향해 거리를 좁힌다';
    detail = reverse && frame.counterPreparation === 0 ? `${v}가 달려오는 동안 ${a}는 평소 자세로 모래판에 서 있습니다.` : reverse ? `${v}가 달려오고 ${a}는 발을 고쳐 딛어 받아낼 준비를 합니다.` : `${a}가 지금 선 자리에서 ${v}를 향해 달려갑니다.`;
  } else if (stage === 'load') {
    const counterWaiting = reverse && frame.counterPreparation === 0;
    if (counterWaiting) wordId = round.victim;
    word = reverse || window.kind === 'clothesline' ? '돌진!' : '준비!';
    title = word; detail = counterWaiting ? `${v}가 달려오기 시작합니다. ${a}는 아직 평소 서 있는 자세를 유지합니다.` : reverse ? `${a}가 중심을 낮추고 다가오는 ${v}의 허리를 노립니다.` : `${a}가 발을 딛고 힘을 모읍니다.`;
  } else if ((window.kind === 'clothesline' || window.kind === 'powerbomb' || window.kind === 'scoopslam') && stage === 'recover') {
    word = ''; title = '공격자가 중심을 회복한다';
    detail = `${a}가 모래를 짚고 몸을 일으킵니다. ${v}는 기절한 채 누워 있습니다.`;
  } else if (window.kind === 'spinebuster' && stage === 'recover') {
    wordId = round.victim; word = '기절!'; title = '메친 상대가 모래 위에 쓰러졌다';
    detail = `${v}가 기절한 채 모래 위에 누워 있습니다. ${a}는 모래를 짚고 중심을 회복합니다.`;
  } else if (stage === 'drag') {
    word = '끌기!'; title = '양발목을 잡고 모래판 끝으로';
    detail = `${a}가 ${v}의 양발목을 잡고 발을 고쳐 딛으며 모래판 끝까지 끕니다. ${v}는 모래 위에 누운 채 따라갑니다.`;
  } else if (window.kind === 'spinebuster' && stage === 'lift') {
    word = '들어올리기!'; title = '허리를 받쳐 들어 올린다';
    detail = `${a}가 발을 딛고 ${v}의 허리를 두 손으로 받친 채 다리를 펴 들어 올립니다.`;
  } else if (window.kind === 'backbodydrop' && stage === 'lift') {
    word = '돌진 카운터!'; title = '머리 위로 들어 넘기기!';
    detail = `${a}가 달려온 ${v}를 머리 위로 들어 올립니다. 잡은 몸을 등 뒤로 넘길 때까지 두 발로 버팁니다.`;
  } else if (window.kind === 'scoopslam' && (stage === 'lift' || stage === 'turn')) {
    word = '안아 메치기!'; title = stage === 'lift' ? '머리 위까지 안아 들어 올리기' : '머리 위에서 몸을 돌린다';
    detail = stage === 'lift' ? `${a}가 ${v}의 상체와 허벅지를 받쳐 자기 머리 위까지 안아 올립니다.` : `${a}가 두 발로 무게를 받으며 골반과 상체를 함께 돌립니다. 안긴 ${v}의 몸도 잡은 팔을 따라 돌아갑니다.`;
  } else if (window.kind === 'powerbomb' && (stage === 'lift' || stage === 'turn')) {
    word = '들어올리기!'; title = stage === 'lift' ? '어깨 위로 들어 올리기!' : '어깨 위에서 무게를 받친다';
    detail = `${a}가 두 손으로 ${v}의 허리를 받쳐 어깨 위까지 들어 올립니다. ${v}는 아직 눈을 뜬 채 균형을 잡으려 합니다.`;
  } else if (stage === 'attack' || stage === 'contact' || stage === 'fall') {
    const contact = window.contactAt != null && elapsed >= window.contactAt;
    if (window.kind === 'clothesline') detail = contact ? `${a}의 팔꿈치 안쪽이 ${v}의 목에 감겼습니다. 상대를 지나쳐 부딪친 두 선수가 머리를 맞대며 모래 위로 넘어집니다.` : `${a}가 달려들며 한 팔을 ${v}의 목과 윗가슴 앞으로 뻗습니다.`;
    else if (window.kind === 'dropkick') detail = contact ? `${a}의 두 발바닥이 ${v}의 가슴에 닿았습니다. ${a}는 다리를 거두며 모래판 안에 착지할 준비를 합니다.` : `${a}가 도약해 두 발바닥을 ${v}의 가슴 앞으로 뻗습니다.`;
    else if (window.kind === 'powerbomb') {
      word = stage === 'fall' ? '내려찍기!' : '잡기!'; title = stage === 'fall' ? '등부터 모래에 내려찍기!' : '허리를 두 손으로 감싸 잡는다';
      detail = stage === 'fall' ? `${a}가 어깨 위에 받친 ${v}를 등부터 모래에 내려찍습니다. 몸이 모래에 닿는 순간 ${v}가 기절합니다.` : `${a}가 달려온 ${v}의 허리를 두 손으로 감싸 돌진하던 무게를 받아냅니다.`;
    }
    else if (window.kind === 'backbodydrop') detail = contact ? `${a}가 달려온 ${v}의 허리를 받아 머리 위로 들어 올립니다. 잡은 몸을 등 너머로 넘겨 모래 위에 메칩니다.` : `${a}가 달려오는 ${v}의 허리를 받아 돌진을 되칠 틈을 봅니다.`;
    else if (window.kind === 'spinebuster') {
      word = stage === 'fall' ? '내려찍기!' : '돌진 받아내기!'; title = word;
      detail = stage === 'fall' ? `${a}가 잡은 ${v}의 허리를 놓지 않고 뒤로 누우며 등부터 모래 위에 메칩니다.` : contact ? `${a}가 두 발로 버티며 ${v}의 달려오던 무게를 허리에서 받아냅니다.` : `${a}가 달려오는 ${v}의 허리를 두 손으로 받아냅니다.`;
    } else {
      word = stage === 'fall' ? '메치기!' : '받아내기!'; title = stage === 'fall' ? '몸을 함께 낮추며 등부터 메친다' : '달려오는 상체와 허벅지를 받친다';
      detail = stage === 'fall' ? `${a}가 몸을 돌리며 한쪽 무릎과 상체를 함께 낮춥니다. 안고 있던 ${v}의 등과 어깨가 모래에 닿는 순간 기절합니다.` : contact ? `${a}가 ${v}의 상체와 허벅지를 양팔로 받쳐 달려오던 무게를 받아냅니다.` : `${a}가 달려오는 ${v}를 받아 안을 틈을 봅니다.`;
    }
  } else if (stage === 'groggy') {
    wordId = round.victim; word = '기절!'; title = '모래 위에 쓰러졌다';
    detail = `${v}가 모래 위에 누워 있습니다. ${a}가 일어나 발목 쪽을 살핍니다.`;
  } else if (stage === 'ankle-approach' || stage === 'ankle-grip') {
    word = '다리 잡기!'; title = stage === 'ankle-grip' ? '두 발목을 잡았다!' : '발목으로 다가간다';
    detail = stage === 'ankle-grip' ? `${a}의 양손이 ${v}의 두 발목에 닿았습니다. 발을 딛고 던질 힘을 모읍니다.` : `${a}가 누워 있는 ${v}의 발목까지 걸어갑니다. 아직 잡은 손은 없습니다.`;
  } else if (stage === 'spin') {
    word = '회전!'; title = '발끝 잡고 한 바퀴!';
    detail = `${a}가 ${v}의 두 발끝을 놓지 않고 발을 바꿔 디디며 한 바퀴 돕니다. ${v}의 몸은 잡힌 발끝을 따라 바깥으로 돌아갑니다.`;
  } else if (stage === 'toss' || stage === 'release') {
    word = '던지기!'; title = stage === 'release' ? '손을 놓아 장외로!' : '다리를 잡고 던지기!';
    const spinningFinish = window.kind !== 'dropkick';
    if (spinningFinish) title = stage === 'release' ? '회전 끝에서 바로 장외로!' : '돌던 힘으로 던지기!';
    detail = spinningFinish ? stage === 'release' ? `${a}가 한 바퀴를 마치는 순간 손을 놓았습니다. ${v}는 돌던 힘 그대로 모래판 밖으로 날아갑니다.` : `${a}가 두 발끝을 잡은 채 계속 돕니다. 한 바퀴를 마치는 순간 손을 놓아 ${v}를 날립니다.` : stage === 'release' ? `${a}가 잡은 손을 놓았습니다. ${v}만 모래판 밖으로 날아갑니다.` : `${a}가 잡은 두 발목을 들어 올리고 몸의 힘을 실어 옆으로 넘깁니다. 손은 아직 붙어 있습니다.`;
  } else {
    word = '착지!'; title = '공격자는 모래판에 착지'; detail = `${a}가 모래판 안에 발을 내리고 몸의 중심을 바로잡습니다.`;
  }
  if (reverse && window.contactAt == null && frame.counterPreparation === 0) { wordId = round.victim; word = '돌진!'; title = '상대가 달려온다'; }
  if (window.kind === 'dropkick') step = stage === 'approach' ? 0 : stage === 'load' ? 1 : stage === 'attack' ? 2 : stage === 'contact' ? 3 : stage === 'land' ? 4 : stage === 'recover' ? 5 : 6;
  if (window.kind === 'clothesline') step = stage === 'approach' || stage === 'load' ? 0 : stage === 'attack' ? 1 : stage === 'contact' || stage === 'fall' ? 2 : stage === 'recover' || stage === 'groggy' ? 3 : stage === 'ankle-approach' ? 4 : stage === 'ankle-grip' ? 5 : stage === 'spin' ? 6 : stage === 'toss' ? 7 : 8;
  if (window.kind === 'spinebuster') step = stage === 'approach' ? 0 : stage === 'load' || stage === 'attack' || stage === 'contact' ? 1 : stage === 'lift' ? 2 : stage === 'fall' ? 3 : stage === 'groggy' || stage === 'recover' ? 4 : stage === 'ankle-approach' ? 5 : stage === 'ankle-grip' ? 6 : stage === 'spin' ? 7 : stage === 'toss' ? 8 : 9;
  if (window.kind === 'powerbomb') step = stage === 'approach' || stage === 'load' ? 0 : stage === 'attack' || stage === 'contact' ? 1 : stage === 'lift' ? 2 : stage === 'turn' ? 3 : stage === 'fall' ? 4 : stage === 'recover' ? 5 : stage === 'groggy' ? 6 : stage === 'ankle-approach' ? 7 : stage === 'ankle-grip' ? 8 : stage === 'spin' ? 9 : stage === 'toss' ? 10 : 11;
  if (window.kind === 'scoopslam') step = stage === 'approach' ? 0 : stage === 'load' ? 1 : stage === 'attack' || stage === 'contact' ? 2 : stage === 'lift' ? 3 : stage === 'turn' ? 4 : stage === 'fall' ? 5 : stage === 'groggy' || stage === 'recover' ? 6 : stage === 'ankle-approach' ? 7 : stage === 'ankle-grip' ? 8 : stage === 'spin' ? 9 : stage === 'toss' ? 10 : 11;
  if (window.kind === 'backbodydrop') step = stage === 'lift' ? 3 : stage === 'spin' ? 8 : stage === 'toss' ? 9 : stage === 'release' ? 10 : step;
  // Describe what the bodies have begun doing. The selected finish must not
  // reveal a counter or a slam while its fighters are still running in.
  const performed = window.contactAt != null && elapsed >= window.contactAt
    || window.kind === 'dropkick' && frame.driverPose === 'dropkick';
  if (!performed && ['approach', 'load', 'attack'].includes(stage)) {
    step = 0;
    wordId = reverse ? round.victim : round.aggressor;
    word = frame.driverPose === 'run' || frame.victimPose === 'run' || reverse || window.kind === 'clothesline' ? '돌진!' : '준비!';
    title = word === '돌진!' ? '상대를 향해 돌진!' : '발을 딛고 중심을 잡는다';
    detail = reverse ? `${v}가 ${a}를 향해 달려옵니다.` : `${a}가 ${v} 앞에서 발을 딛고 거리를 좁힙니다.`;
  }
  return { title, detail, word, wordId, label: performed ? labels[window.kind] : word.replace(/!$/, ''), steps, step, reverse, stage };
}

/** Brief words follow the same technique stage as the moving bodies. */
export function arenaActionWords(round: ArenaRound, elapsed: number): { id: string; word: string }[] {
  const unit = round.timeScale ?? (round.final ? round.end / 44000 : round.exchange ? (round.impact - round.start) / 3200 : (round.resolve - round.impact) / 1100);
  if (round.wrestlingMove && elapsed >= round.wrestlingMove.start && elapsed < round.resolve) {
    const beat = arenaWrestlingPresentation(round, elapsed);
    const frame = arenaWrestlingMoveTargets(round.wrestlingMove, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    const runner = frame.victimPose === 'run' ? round.victim : frame.driverPose === 'run' ? round.aggressor : undefined;
    return [...(beat.word || runner === beat.wordId ? [{ id: beat.wordId, word: runner === beat.wordId ? '돌진!' : beat.word }] : []), ...(runner && runner !== beat.wordId ? [{ id: runner, word: '돌진!' }] : []), ...(beat.stage === 'release' ? [{ id: round.victim, word: '장외로!' }] : [])];
  }
  if (round.kickCatch && elapsed >= round.kickCatch.start && elapsed < round.resolve) {
    const frame = arenaKickCatchTargets(round.kickCatch, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    return frame.stage === 'approach' ? [{ id: round.victim, word: '돌진!' }] : frame.stage === 'load' || frame.stage === 'jump' ? [{ id: round.victim, word: '도약!' }] : frame.stage === 'kick' ? [{ id: round.victim, word: '옆차기!' }] : frame.stage === 'catch' ? [{ id: round.aggressor, word: '킥 캐치!' }, { id: round.victim, word: '잡혔다!' }] : frame.stage === 'spin' ? [{ id: round.aggressor, word: '회전!' }] : frame.stage === 'release' ? [{ id: round.aggressor, word: '던지기!' }, { id: round.victim, word: '장외로!' }] : [];
  }
  if (round.supermanPunch && elapsed >= round.supermanPunch.start && elapsed < round.resolve) {
    const punch = arenaSupermanPunchTargets(round.supermanPunch, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    const hit = round.supermanPunch.hitAt != null && elapsed >= round.supermanPunch.hitAt;
    const word = punch.stage === 'approach' ? '돌진!' : punch.stage === 'load' || punch.stage === 'jump' ? '도약!' : punch.stage === 'punch' ? '슈퍼맨 펀치!' : undefined;
    return [...(word ? [{ id: round.aggressor, word }] : []), ...(hit ? [{ id: round.victim, word: '장외로!' }] : [])];
  }
  if (round.slideTrip && elapsed >= round.slideTrip.start && elapsed < round.resolve) {
    const slide = arenaSlideTripTargets(round.slideTrip, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    if (round.slideTrip.evade) return slide.stage === 'approach' ? [{ id: round.aggressor, word: '돌진!' }]
      : slide.stage === 'slide' ? [{ id: round.aggressor, word: '슬라이딩!' }]
      : slide.stage === 'jump' || slide.stage === 'pass' ? [{ id: round.aggressor, word: '슬라이딩!' }, { id: round.victim, word: '두 발 점프!' }]
      : slide.stage === 'land' ? [{ id: round.victim, word: '착지!' }] : [];
    return slide.stage === 'approach' ? [{ id: round.aggressor, word: '돌진!' }] : slide.stage === 'slide' ? [{ id: round.aggressor, word: '슬라이딩!' }] : slide.stage === 'hook' ? [{ id: round.aggressor, word: '발걸기!' }] : slide.stage === 'fall' ? [{ id: round.victim, word: '넘어진다!' }] : slide.stage === 'rise' ? [] : slide.stage === 'kick' ? [{ id: round.aggressor, word: '발차기!' }] : [{ id: round.victim, word: '장외로!' }];
  }
  if (round.linkedRush && round.helper && elapsed >= round.linkedRush.start && elapsed < round.resolve) {
    if (round.linkedRush.launchAt == null || elapsed < round.linkedRush.launchAt) return [{ id: round.aggressor, word: '팔 뻗기!' }, { id: round.helper, word: '함께!' }];
    if (round.rushContactAt === undefined || elapsed < round.rushContactAt) return [{ id: round.aggressor, word: '돌진!' }, { id: round.helper, word: '돌진!' }];
    const shared = arenaPairRushTargets(round, elapsed, { x: 500, y: 416 });
    return shared.stage === 'contact' || shared.stage === 'rebound' ? [{ id: round.victim, word: '목 · 가슴 가격!' }] : shared.stage === 'groggy' ? [{ id: round.victim, word: '기절!' }] : shared.stage === 'grip' ? [{ id: round.aggressor, word: '어깨 잡기!' }, { id: round.helper, word: '발끝 잡기!' }] : shared.stage === 'load' ? [{ id: round.aggressor, word: '하나, 둘!' }, { id: round.helper, word: '같이 들어!' }] : shared.stage === 'lift' || shared.stage === 'overhead' ? [{ id: round.aggressor, word: '함께 들기!' }, { id: round.helper, word: '힘을 모아!' }] : shared.stage === 'toss' || shared.stage === 'release' ? [{ id: round.aggressor, word: '함께 던지기!' }] : [];
  }
  if (round.pairDodge && elapsed >= round.pairDodge.start && (elapsed < round.pairDodge.end || round.pairDodge.outcome === 'out' && elapsed < round.resolve)) {
    const dodge = arenaPairDodgeTargets(round.pairDodge, elapsed, { x: 500, y: 416 }, undefined, unit);
    const pair = [round.aggressor, round.pairDodge.partnerId];
    const running = ['charge', 'jump', 'pass', 'land'].includes(dodge.stage);
    return [...(dodge.jumpHeight.some(height => height > 1) ? pair.map(id => ({ id, word: '점프 회피!' })) : []), ...(running ? [{ id: round.victim, word: '돌진!' }] : round.pairDodge.outcome === 'out' && elapsed >= round.impact ? [{ id: round.victim, word: '멈출 수 없어!' }] : [])];
  }
  if (round.passingTrip?.joined && elapsed >= round.passingTrip.start && elapsed < round.resolve) {
    const trip = arenaPassingTripTargets(round.passingTrip, elapsed, { x: 500, y: 416 }, undefined, round.contactSide, unit);
    return trip.stage === 'hook' ? [{ id: round.passingTrip.passerId, word: '발걸기!' }] : trip.stage === 'fall' ? [{ id: round.victim, word: '넘어진다!' }] : trip.stage === 'grip' || trip.stage === 'lift' ? [{ id: round.aggressor, word: '발끝 잡기!' }] : trip.stage === 'toss' || trip.stage === 'release' ? [{ id: round.aggressor, word: '던지기!' }] : [];
  }
  const rimCharge = arenaRimChargeTargets(round, elapsed, { x: 500, y: 416 });
  if (rimCharge?.active) return rimCharge.stage === 'charge' ? [{ id: rimCharge.chargerId, word: '돌진!' }] : rimCharge.stage === 'dodge' ? [{ id: rimCharge.defenderId, word: '회피!' }, { id: rimCharge.chargerId, word: '돌진!' }] : rimCharge.stage === 'out' ? [{ id: rimCharge.chargerId, word: '멈출 수 없어!' }] : rimCharge.stage === 'brace' ? [{ id: rimCharge.defenderId, word: '버티기!' }] : rimCharge.stage === 'duel' ? [{ id: rimCharge.defenderId, word: '막았다!' }] : [];
  const rim = arenaRimTargets(round, elapsed, { x: 500, y: 416 });
  if (rim?.active) return rim.stage === 'pressure' ? [{ id: round.aggressor, word: '밀기!' }, ...(rim.resistance > .4 ? [{ id: round.victim, word: '버티기!' }] : [])] : rim.stage === 'brace' ? [{ id: round.victim, word: '버텼다!' }] : rim.stage === 'release' ? [{ id: round.victim, word: '밀기 막기!' }] : [];
  const recovery = arenaRecoveryTargets(round, elapsed, { x: 500, y: 416 });
  if (recovery?.active) {
    const thrower = round.recovery?.throwerId ?? round.aggressor;
    if (recovery.stage === 'hold') return [{ id: thrower, word: '맞잡기!' }];
    if ((recovery.stage === 'lift' || recovery.stage === 'overhead') && recovery.height > .01) return [{ id: thrower, word: recovery.kind === 'overhead-escape' ? '들기!' : '던지기!' }];
    if (recovery.stage === 'separate') return [{ id: round.victim, word: '거리 벌리기!' }];
    if (recovery.airborne || recovery.stage === 'land') return [...(recovery.kind !== 'overhead-escape' ? [{ id: thrower, word: '던지기!' }] : []), { id: round.victim, word: recovery.airborne ? recovery.kind === 'overhead-escape' ? '점프 탈출!' : '공중 한 바퀴!' : '착지! 살았다!' }];
    return recovery.stage === 'release' ? [{ id: round.victim, word: '착지! 살았다!' }] : [];
  }
  const escape = arenaEscapeTargets(round, elapsed, { x: 500, y: 416 });
  if (escape?.released) return [{ id: escape.runnerId, word: '도망 성공!' }];
  if (escape?.active && escape.stage === 'separate') return [{ id: escape.runnerId, word: '도망 성공!' }, { id: escape.chaserId, word: '놓쳤다!' }];
  if (escape?.active) return escape.stage === 'grip' ? [{ id: escape.runnerId, word: '맞잡기!' }] : escape.stage === 'break' ? [{ id: escape.runnerId, word: '손 빼기!' }] : escape.stage === 'flee' || escape.stage === 'chase' ? [{ id: escape.runnerId, word: '도망!' }, { id: escape.chaserId, word: '추격!' }] : escape.stage === 'rejoin' ? [{ id: escape.runnerId, word: '방향 전환!' }] : [];
  if (elapsed < round.start || elapsed >= round.resolve) return [];
  const action = arenaAction(round, elapsed), a = round.aggressor, v = round.victim;
  if (round.rushOutcome && round.helper) {
    const rush = arenaPairRushTargets(round, elapsed, { x: 500, y: 416 });
    return rush.stage === 'charge' ? [{ id: rush.chargerId, word: '돌진!' }] : rush.stage === 'contact' ? [{ id: rush.chargerId, word: '충돌!' }] : rush.stage === 'groggy' ? [{ id: rush.chargerId, word: '기절!' }] : rush.stage === 'grip' ? [{ id: round.aggressor, word: '어깨 잡기!' }, { id: round.helper, word: '발끝 잡기!' }] : rush.stage === 'load' ? [{ id: round.aggressor, word: '하나, 둘!' }, { id: round.helper!, word: '같이 들어!' }] : rush.stage === 'lift' || rush.stage === 'overhead' ? [{ id: round.aggressor, word: '함께 들기!' }] : rush.stage === 'toss' || rush.stage === 'release' ? [{ id: round.aggressor, word: rush.outcome === 'double-out' ? '두 명 장외!' : '함께 던지기!' }] : rush.stage === 'push' ? [{ id: rush.chargerId, word: '밀어붙이기!' }] : [];
  }
  if ((round.tactic === 'team' || round.tactic === 'betrayal') && round.helper) {
    const caller = round.tactic === 'team' ? a : v;
    if (action.stage === 'approach') {
      const answering = arenaBeat(round, elapsed).progress >= (round.tactic === 'team' ? .16 : .12);
      return [{ id: answering ? round.helper : caller, word: answering ? '갈게!' : round.tactic === 'team' ? '이리 와!' : '도와줘!' }];
    }
    if (action.stage === 'link') return [{ id: caller, word: '같이 하자!' }, { id: round.helper, word: '좋아!' }];
    if (round.tactic === 'betrayal' && action.stage === 'betrayal') return [{ id: caller, word: '실패다!' }];
  }
  if (round.tactic === 'armspin') {
    const tech = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
    return tech.stage === 'wrist' ? [{ id: a, word: '잡기!' }] : tech.stage === 'pivot' ? [{ id: a, word: '회전!' }] : elapsed >= round.impact && elapsed - round.impact < 350 * unit ? [{ id: a, word: '던지기!' }] : [];
  }
  if (round.tactic === 'trip' || round.tactic === 'suplex') {
    const tech = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
    const reactionAt = round.tactic === 'trip' ? tech.kickReactionAt : round.impact;
    const exit = elapsed >= reactionAt ? arenaTechniqueExit(round, elapsed - reactionAt, { x: 500, y: 416 }, { x: 885, y: 436 }, 1, unit) : undefined;
    if (round.tactic === 'trip') return exit?.stage === 'roll' ? [...(tech.stage === 'kick' ? [{ id: a, word: '발차기!' }] : []), { id: v, word: '구르기!' }] : tech.stage === 'hook' && !exit ? [{ id: a, word: round.tripCounter ? '발걸기 되치기!' : '발걸기!' }] : tech.stage === 'kick' && !exit ? [{ id: a, word: '발차기!' }] : tech.stage === 'fall' && !exit ? [{ id: v, word: '넘어진다!' }] : [];
    if (exit) return exit.stage === 'drag' ? [{ id: a, word: '끌기!' }] : ((exit.stage === 'hold' && (!round.floorFinish || round.floorFinish.throwAt != null && elapsed >= round.floorFinish.throwAt)) || (exit.stage === 'rim-toss' && exit.phase < .40)) ? [{ id: a, word: '던지기!' }] : [];
    return tech.stage === 'lift' ? [{ id: a, word: '들어올리기!' }] : tech.stage === 'overhead' ? [{ id: a, word: '머리 위로!' }] : tech.stage === 'slam' ? [{ id: tech.slamImpact > 0 ? v : a, word: tech.slamImpact > 0 ? '충돌!' : '내리찍기!' }] : tech.stage === 'stunned' ? [{ id: v, word: '기절!' }] : [];
  }
  if (round.tactic === 'elbow') {
    const tech = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
    const exit = round.elbowGripAt !== null && elapsed >= round.impact ? arenaTechniqueExit(round, elapsed - round.impact, { x: 500, y: 416 }, { x: 885, y: 436 }, 1, unit) : undefined;
    if (exit) return exit.stage === 'stunned' ? [{ id: a, word: '발끝 잡기!' }] : exit.stage === 'drag' ? [{ id: a, word: '끌기!' }] : ((exit.stage === 'hold' && (!round.floorFinish || round.floorFinish.throwAt != null && elapsed >= round.floorFinish.throwAt)) || (exit.stage === 'rim-toss' && exit.phase < .40)) ? [{ id: a, word: '던지기!' }] : [];
    return tech.stage === 'lift-counter' ? [{ id: v, word: '들기!' }] : tech.stage === 'elbow' || tech.stage === 'elbow-impact' ? [{ id: a, word: '엘보우!' }] : tech.stage === 'groggy' ? [{ id: v, word: '기절!' }] : tech.stage === 'ankle-approach' ? [{ id: a, word: '발끝으로!' }] : tech.stage === 'ankle-grip' ? [{ id: a, word: '발끝 잡기!' }] : [];
  }
  if (elapsed - round.impact > 480 * unit) return [];
  if (round.tactic === 'bait') {
    const charge = arenaChargeState(round, elapsed);
    return [...(charge.stage !== 'prepare' ? [{ id: v, word: '돌진!' }] : []), ...(charge.dodge > .04 ? [{ id: a, word: '회피!' }] : [])];
  }
  if (round.tactic === 'ram') {
    const ram = arenaRamTargets(round, elapsed, { x: 500, y: 416 });
    return ram.stage === 'charge' || ram.stage === 'contact' || ram.stage === 'release' ? [{ id: a, word: ram.stage === 'charge' ? '돌진!' : '박치기!' }] : [];
  }
  if (round.tactic === 'catch') {
    const caught = arenaCatchTargets(round, elapsed, { x: 500, y: 416 });
    return elapsed >= round.impact ? [{ id: a, word: '던지기!' }] : caught.stage === 'charge' ? [{ id: v, word: '돌진!' }] : caught.stage === 'catch' || caught.stage === 'load' ? [{ id: a, word: '막기!' }] : caught.stage === 'turn' ? [{ id: a, word: '되치기!' }] : [];
  }
  if (round.tactic === 'spin') {
    const spin = arenaSpinTargets(round, elapsed, { x: 500, y: 416 });
    return spin.stage === 'plant' ? [{ id: a, word: '막기!' }] : spin.stage === 'reverse' || spin.stage === 'spin' ? [{ id: a, word: '되치기!' }] : spin.stage === 'release' ? [{ id: a, word: '던지기!' }] : [];
  }
  if (action.stage === 'failed-counter') return [{ id: a, word: '막혔다!' }, { id: v, word: '버티기!' }];
  if (action.stage === 'reset') return [{ id: v, word: '회피!' }];
  if ((round.tactic === 'shove' || round.tactic === 'double-shove' || round.tactic === 'edge') && (action.stage === 'joint-attack' || elapsed >= round.impact)) return [{ id: a, word: '밀기!' }];
  if (round.tactic === 'sidekick') {
    const tech = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
    return tech.stage === 'jump' ? [{ id: a, word: '도약!' }] : tech.stage === 'kick' || tech.stage === 'impact' ? [{ id: a, word: '옆차기!' }] : [];
  }
  if (round.tactic === 'brace' || round.tactic === 'counter') return action.stage === 'approach' ? [] : elapsed >= round.impact ? [{ id: a, word: '던지기!' }] : action.lift > 4 ? [{ id: a, word: '되치기!' }] : [{ id: a, word: '막기!' }];
  return action.actors.filter(part => action.attackers.includes(part.id) && (part.pose === 'lift' && part.phase > .25 || part.pose === 'throw' || part.pose === 'suplex')).map(part => ({ id: part.id, word: '던지기!' }));
}

/** A nearby outward-facing encounter favors a grounded finish over another lift. */
export function arenaRimPushOutcome(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll > 999) throw new RangeError('Rim push roll must be 0–999');
  return roll < 700;
}

/** The actual encounter chooses its finish; a central pair never walks to a prescribed rim. */
export function arenaContactRound(round: ArenaRound, center: ArenaPoint, participants?: { aggressor: ArenaPoint; victim: ArenaPoint }): ArenaRound {
  if (round.rushOutcome) return { ...round, contactSide: center.x >= 500 ? 1 : -1 };
  if (round.wrestlingMove) return { ...round, contactSide: participants ? participants.victim.x >= participants.aggressor.x ? 1 : -1 : center.x >= 500 ? 1 : -1 };
  if (round.rim && (arenaRimDistance(center) > 112 || participants && (participants.victim.x >= participants.aggressor.x ? 1 : -1) !== (center.x >= 500 ? 1 : -1))) {
    // A rim encounter is optional. A central meeting immediately starts its
    // normal bout, while keeping the drawn impact and resolve clocks intact.
    round = { ...round, rim: undefined, start: Math.min(round.start, round.rim.start), tactic: round.tactic === 'edge' ? 'brace' : round.tactic };
  }
  const outward = center.x >= 500 ? 1 : -1;
  const nearRim = arenaRimDistance(center) <= ARENA_RIM_PUSH_DISTANCE && Math.hypot((center.x - 500) / 303, (center.y - 416) / 112) <= 1;
  const protectedStory = round.exchange || round.helper || round.rushOutcome || round.escape || round.recovery || round.rim || round.rimCharge
    || round.wrestlingMove || round.kickCatch || round.supermanPunch || round.linkedRush || round.slideTrip || round.pairDodge || round.passingTrip || round.tripCounter;
  const correctSide = !participants || (participants.victim.x >= participants.aggressor.x ? 1 : -1) === outward;
  if (!protectedStory && nearRim && correctSide && round.rimPushRoll !== undefined && arenaRimPushOutcome(round.rimPushRoll)) {
    round = { ...round, tactic: 'edge', rimPush: true, contactSide: outward, chargeSetup: undefined };
  }
  if (participants) {
    const contactSide = participants.victim.x >= participants.aggressor.x ? 1 : -1;
    const actual: ArenaRound = { ...round, contactSide };
    if (['bait', 'catch', 'ram'].includes(round.tactic)) {
      const charger = round.tactic === 'ram' ? participants.aggressor : participants.victim;
      const receiver = round.tactic === 'ram' ? participants.victim : participants.aggressor;
      const side = receiver.x >= charger.x ? 1 : -1, distance = Math.abs(receiver.x - charger.x);
      const runTime = round.tactic === 'bait' ? Math.min(1600, (round.impact - round.start) * .64) : (round.impact - round.start) * (round.tactic === 'catch' ? .37 : .50);
      const rim = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((charger.y - 416) / 112) ** 2));
      const chargeTravel = round.tactic === 'bait' && !round.exchange ? Math.abs(rim - side * 13 - charger.x) : Math.max(0, distance - 38);
      const clearRun = round.tactic === 'ram'
        ? distance >= 86 && distance <= 560 && Math.abs(receiver.y - charger.y) <= 65
        : distance >= 86 && distance <= 215 && Math.abs(receiver.y - charger.y) <= 22 && chargeTravel / Math.max(.001, runTime / 1000) <= 140;
      const nearEdge = round.tactic !== 'bait' || round.exchange || Math.abs(rim - receiver.x) <= 95;
      if (clearRun && nearEdge) return { ...actual, chargeSetup: { charger: { x: charger.x, y: charger.y }, receiver: { x: receiver.x, y: receiver.y }, side } };
      return { ...actual, tactic: round.tactic === 'ram' ? 'counter' : 'brace', helper: undefined, chargeSetup: undefined };
    }
    if (['edge', 'shove'].includes(round.tactic) && (arenaRimDistance(center) > 112 || contactSide !== (center.x >= 500 ? 1 : -1))) return { ...actual, tactic: 'brace', rimPush: undefined, helper: undefined };
    round = actual;
  }
  if (round.exchange || arenaRimDistance(center) <= 112) return round;
  const tactic = round.tactic === 'bait' || round.tactic === 'shove' ? 'catch' : round.tactic === 'edge' ? 'brace' : round.tactic;
  return tactic === round.tactic ? round : { ...round, tactic, rimPush: undefined, helper: undefined };
}

export function arenaReleaseTarget(origin: ArenaPoint, center: ArenaPoint, role: ArenaActionActor['role'], progress: number): ArenaPoint {
  const amount = ease(progress), away = origin.x >= center.x ? 1 : -1;
  return { x: origin.x + away * amount * 22, y: origin.y + (role === 'victim' ? -1 : 1) * amount * 10 };
}

/** Ranking is supplied by the uniform draw; choreography never redraws a result. */
export function arenaRounds(order: string[], duration = 44_000, rushRoll = 7, escapeSeed?: number): ArenaRound[] {
  if (order.length < 2) return [];
  const preliminaries = order.length - 2;
  const seed = order.join('|').split('').reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0);
  // A single surprise alliance can occur while at least five fighters remain.
  // Slightly reduce the bonus chance and leave the other bouts one-on-one.
  // Mix the bonus roll separately: equal-length ids can share the original hash's low bits.
  const surprise = Math.imul(seed ^ seed >>> 16, 0x45d9f3b) >>> 0;
  const bonusAlliance = ((surprise ^ surprise >>> 16) >>> 0) % 64 === 0;
  const requestedAllianceAt = order.length >= 5 && (seed % 3 === 0 || bonusAlliance) ? seed % (order.length - 4) : -1;
  const rushAt = order.length >= 3 && ((surprise ^ surprise >>> 11) >>> 0) % 4 === 0 ? (seed >>> 9) % Math.max(1, preliminaries) : -1;
  // A third-party rush may consume two places; keep an already eligible alliance
  // on the nearest surviving preliminary instead of silently deleting its story.
  const allianceAt = requestedAllianceAt < 0 ? -1 : Array.from({ length: order.length - 4 }, (_, index) => index)
    .filter(index => index !== rushAt && !(rushRoll < 3 && rushAt >= 0 && index === rushAt + 1))
    .sort((a, b) => Math.abs(a - requestedAllianceAt) - Math.abs(b - requestedAllianceAt) || a - b)[0] ?? -1;
  const rounds: ArenaRound[] = [];
  let escapes = 0, recoveries = 0;
  const append = (round: Omit<ArenaRound, 'start' | 'impact' | 'resolve' | 'end'>, salt: number) => {
    const entry = rounds.at(-1)?.resolve ?? 0, escapeRoll = escapeSeed === undefined ? undefined : arenaEscapeRoll(escapeSeed, round.index);
    // A reversed kick is a cosmetic role change: the loser initiates, the
    // survivor catches. Give it precedence over unrelated rim/escape stories.
    if (round.tactic === 'sidekick' && !round.exchange && !round.helper && !round.rushOutcome && !round.wrestlingMove && !round.supermanPunch && !round.linkedRush && !round.slideTrip && !round.pairDodge && !round.passingTrip && !round.tripCounter
      && arenaKickCatchOutcome(arenaEscapeRoll(escapeSeed ?? seed, round.index + 1207) % 1000)) round = { ...round, kickCatch: { start: 0, end: 0 } };
    const specialStory = !!(round.wrestlingMove || round.kickCatch || round.supermanPunch || round.linkedRush || round.slideTrip || round.pairDodge || round.passingTrip || round.tripCounter);
    const separate = escapeRoll !== undefined && !!(escapeRoll & 16);
    const runnerId = escapeRoll !== undefined && escapeRoll & 4 ? round.aggressor : round.victim;
    const escape: ArenaEscapeWindow | undefined = escapeRoll !== undefined && escapeRoll % 4 === 0 && escapes < 2 && !specialStory && !round.final && !round.helper && !round.rushOutcome && !rounds.at(-1)?.escape
      ? { start: entry, end: entry + ARENA_ESCAPE_DURATION, runnerId, chaserId: runnerId === round.aggressor ? round.victim : round.aggressor, side: escapeRoll & 8 ? -1 : 1, outcome: separate ? 'separate' : 'rejoin', releasedUntil: entry + ARENA_ESCAPE_DURATION + (separate ? ARENA_ESCAPE_RELEASE_DURATION : 0) } : undefined;
    if (escape) escapes++;
    if (escape?.outcome === 'separate') {
      // The elimination still belongs to the same drawn rank. A different
      // survivor meets that loser after the original two have broken contact.
      const alternatives = order.slice(0, order.indexOf(round.victim)).filter(id => id !== round.aggressor);
      if (alternatives.length) round = { ...round, aggressor: alternatives[(escapeRoll! >>> 5) % alternatives.length] };
    }
    const recoveryThrowSpan = round.final ? 5000 : 3100 + salt % 5 * 200;
    const overheadEscape = !specialStory && escapeSeed !== undefined && !escape && !round.helper && !round.rushOutcome && round.tactic === 'suplex' && recoveries < 1
      && arenaEscapeRoll(escapeSeed, round.index + 39) % 100 >= 8 && arenaEscapeRoll(escapeSeed, round.index + 307) % 100 < 2;
    const recovery: ArenaRecoveryWindow | undefined = overheadEscape ? { start: entry, throwAt: entry + recoveryThrowSpan, end: entry + recoveryThrowSpan + ARENA_RECOVERY_EXIT_DURATION, kind: 'overhead-escape' }
      : !specialStory && escapeSeed !== undefined && !escape && !round.helper && !round.rushOutcome && ['lift', 'brace', 'counter', 'final', 'catch', 'spin', 'armspin', 'suplex', 'elbow'].includes(round.tactic) && recoveries < 1 && arenaEscapeRoll(escapeSeed, round.index + 67) % 100 < 5 ? { start: entry, throwAt: entry + recoveryThrowSpan, end: entry + recoveryThrowSpan + ARENA_RECOVERY_EXIT_DURATION } : undefined;
    if (recovery) {
      recoveries++;
      recovery.throwerId = round.aggressor;
      // The survivor of the throw meets another living opponent when possible.
      // The original thrower stays in the prelude; the drawn loser is unchanged.
      const alternatives = order.slice(0, order.indexOf(round.victim)).filter(id => id !== round.aggressor);
      if (alternatives.length) round = { ...round, aggressor: alternatives[arenaEscapeRoll(escapeSeed!, round.index + 337) % alternatives.length] };
    }
    // A separate cosmetic roll changes the story, never the drawn placement.
    if (!specialStory && !round.helper && ['lift', 'suplex', 'final'].includes(round.tactic) && arenaEscapeRoll(escapeSeed ?? seed, round.index + 39) % 100 < 8) round = { ...round, tactic: 'elbow' };
    const rimSeed = escapeSeed ?? seed;
    const rimEligible = !specialStory && !round.final && !round.helper && !round.rushOutcome && !escape && !recovery;
    const rimAttempt = rimEligible && (round.tactic === 'edge' || arenaEscapeRoll(rimSeed, round.index + 101) % 100 < 12);
    const rimOutcome = rimAttempt ? arenaRimOutcome(arenaEscapeRoll(rimSeed, round.index + 149) % 10) : undefined;
    if (rimOutcome === 'out') round = { ...round, tactic: 'edge' };
    else if (rimOutcome === 'resist' && round.tactic === 'edge') round = { ...round, tactic: 'brace' };
    const chargeAttempt = rimEligible && !rimAttempt && !['bait', 'ram'].includes(round.tactic) && arenaEscapeRoll(rimSeed, round.index + 193) % 100 < 12;
    const chargeOutcome = chargeAttempt ? arenaRimChargeOutcome(arenaEscapeRoll(rimSeed, round.index + 239) % 10) : undefined;
    if (chargeOutcome === 'dodge') round = { ...round, tactic: 'bait' };
    const rimCharge: ArenaRimChargeWindow | undefined = chargeOutcome ? { start: entry, end: entry + ARENA_RIM_CHARGE_DURATION, outcome: chargeOutcome } : undefined;
    // Preserve earlier escape, recovery and rare-contact seeds. A new move
    // consumes its own cosmetic trial only in the remaining solo encounters.
    if (!specialStory && !round.exchange && !round.helper && !round.rushOutcome && !escape && !recovery && !rimOutcome && !rimCharge) {
      const choices: [ArenaWrestlingMoveKind, number][] = [['clothesline', 1409], ['dropkick', 1451], ['powerbomb', 1487], ['backbodydrop', 1511], ['spinebuster', 1553], ['scoopslam', 1597]];
      const kind = choices.find(([, offset]) => arenaWrestlingMoveOutcome(arenaEscapeRoll(escapeSeed ?? seed, round.index + offset) % 1000))?.[0];
      if (kind) {
        const fallback: Record<ArenaWrestlingMoveKind, ArenaTactic> = { clothesline: 'ram', dropkick: 'sidekick', powerbomb: 'brace', backbodydrop: 'catch', spinebuster: 'counter', scoopslam: 'lift' };
        round = { ...round, tactic: fallback[kind], wrestlingMove: { kind, start: 0, end: 0 } };
      }
    }
    const pairDodge = round.pairDodge ? { ...round.pairDodge, start: entry, end: entry + 4500, launchAt: undefined } : undefined;
    const passingTrip = round.passingTrip ? { ...round.passingTrip, start: entry, end: entry + 6000, launchAt: undefined } : undefined;
    const slideTrip = round.slideTrip ? { ...round.slideTrip, start: entry, end: entry + 6000, launchAt: null, hookAt: null, kickAt: null, jumpAt: null, passAt: null } : undefined;
    const linkedRush = round.linkedRush ? { ...round.linkedRush, start: entry, end: entry + 9200, launchAt: null, contactAt: undefined } : undefined;
    const supermanPunch = round.supermanPunch ? { ...round.supermanPunch, start: entry, end: entry + 6000, launchAt: null, hitAt: null } : undefined;
    const kickCatch = round.kickCatch ? { ...round.kickCatch, start: entry, end: entry + 6000, launchAt: null, catchAt: null } : undefined;
    const wrestlingMove = round.wrestlingMove ? { ...round.wrestlingMove, start: entry, end: entry + 6000, launchAt: null, contactAt: null, releaseAt: null, kickAt: null, ankleGripAt: null } : undefined;
    const start = pairDodge?.end ?? recovery?.end ?? escape?.releasedUntil ?? escape?.end ?? (chargeOutcome === 'resist' ? rimCharge!.end : rimOutcome === 'resist' ? entry + ARENA_RIM_DURATION : entry);
    const special = isArenaFinalTechnique({ ...round, start: 0, impact: 0, resolve: 0, end: 0 });
    const total = round.final ? round.rushOutcome === 'double-out' ? 11_400 : 10_800 : round.rushOutcome === 'counter-throw' ? 8100 : round.rushOutcome === 'double-out' ? 10100 : round.tactic === 'suplex' || round.tactic === 'elbow' ? 8200 : special ? 5800 : 4200 + salt % 5 * 200;
    const impactSpan = chargeOutcome === 'dodge' ? ARENA_RIM_CHARGE_DURATION : round.rushOutcome === 'counter-throw' ? 7000 : round.rushOutcome === 'double-out' ? 9000 : round.tactic === 'suplex' || round.tactic === 'elbow' ? 4100 : round.tactic === 'sidekick' ? 2300 : round.final ? 5000 : total - 1100;
    const impact = wrestlingMove?.end ?? kickCatch?.end ?? supermanPunch?.end ?? linkedRush?.end ?? slideTrip?.end ?? passingTrip?.end ?? start + impactSpan, resolve = impact + (round.tactic === 'suplex' || round.tactic === 'elbow' ? 4100 : 1100);
    const rim: ArenaRimWindow | undefined = rimOutcome ? { start: entry, end: rimOutcome === 'resist' ? start : impact, outcome: rimOutcome } : undefined;
    rounds.push({ ...round, rimPushRoll: arenaEscapeRoll(escapeSeed ?? seed, round.index + 1301) % 1000, wrestlingMove, kickCatch, supermanPunch, linkedRush, slideTrip, pairDodge, passingTrip, escape, recovery, rim, rimCharge, start, impact, resolve, end: round.final ? start + total : resolve });
  };
  for (let index = 0; index < preliminaries; index++) {
    const living = order.slice(0, order.length - index);
    const victim = living.at(-1)!;
    const pool = living.filter(id => id !== victim);
    const aggressor = pool[(seed + index * 7 + index * index) % pool.length];
    const helpers = pool.filter(id => id !== aggressor);
    const possibleHelper = helpers.length ? helpers[((seed >>> 5) + index * 3) % helpers.length] : undefined;
    const planned = eliminationTactics[(seed + index) % eliminationTactics.length];
    let tactic = possibleHelper && index === allianceAt ? (arenaEscapeRoll(escapeSeed ?? seed, index + 1709) % 2 ? 'team' : 'betrayal') : planned === 'shove' && !possibleHelper ? 'edge' : planned === 'lift' && ((seed >>> 3) + index) % 5 === 0 ? 'spin' : planned === 'counter' && ((seed >>> 7) + index) % 6 === 1 ? 'ram' : planned;
    const solo = !['team', 'betrayal', 'shove'].includes(tactic);
    // This separate cosmetic draw can turn any eligible preliminary into the
    // double clothesline, including a rush slot, without changing its drawn loser.
    if (solo && possibleHelper && arenaLinkedRushOutcome(arenaEscapeRoll(escapeSeed ?? seed, index + 1009) % 1000)) {
      append({ id: `arena-${index}`, index, tactic: 'double-shove', aggressor, helper: possibleHelper, victim, rushOutcome: 'counter-throw', linkedRush: { start: 0, end: 0 }, final: false }, seed + index);
      continue;
    }
    if (index === rushAt) {
      const cast = arenaPairRushCast(living, rushRoll, seed + index * 7), final = cast.rushOutcome === 'double-out' && living.length === 3;
      const dodgeRoll = arenaEscapeRoll(escapeSeed ?? seed, index + 503) % 1000;
      if (cast.rushOutcome === 'counter-throw' && arenaPairDodgeOutcome(dodgeRoll)) {
        append({ id: `arena-${index}`, index, tactic: 'brace', aggressor: cast.aggressor, victim: cast.victim, pairDodge: { start: 0, end: 0, outcome: 'escape', partnerId: cast.helper, allowOut: dodgeRoll % 3 === 0 }, final: false }, seed + index);
        continue;
      }
      append({ id: final ? 'arena-final' : `arena-${index}`, index, tactic: 'double-shove', ...cast, final }, seed + index);
      if (final) break;
      if (cast.secondaryVictim) index++;
      continue;
    }
    const supermanPunch = solo && arenaSupermanPunchOutcome(arenaEscapeRoll(escapeSeed ?? seed, index + 1103) % 1000) ? { start: 0, end: 0 } : undefined;
    const passingTrip = solo && !supermanPunch && possibleHelper && arenaPassingTripOutcome(arenaEscapeRoll(escapeSeed ?? seed, index + 809) % 1000) ? { start: 0, end: 0, passerId: possibleHelper } : undefined;
    const slideTrip = solo && !supermanPunch && !passingTrip && arenaSlideTripOutcome(arenaEscapeRoll(escapeSeed ?? seed, index + 911) % 1000) ? { start: 0, end: 0, evade: arenaSlideTripEvadeOutcome(arenaEscapeRoll(escapeSeed ?? seed, index + 1237) % 1000) } : undefined;
    const tripCounter = solo && !supermanPunch && !passingTrip && !slideTrip && arenaEscapeRoll(escapeSeed ?? seed, index + 701) % 1000 < 10;
    if (supermanPunch) tactic = 'ram';
    else if (passingTrip) tactic = 'lift';
    else if (slideTrip) tactic = 'trip';
    else if (tripCounter) tactic = 'trip';
    const allianceRoll = Math.imul(seed ^ seed >>> 13 ^ index, 0x9e3779b1) >>> 0;
    append({ id: `arena-${index}`, index, tactic, supermanPunch, tripCounter, passingTrip, slideTrip, aggressor, helper: tactic === 'team' || tactic === 'betrayal' || tactic === 'shove' ? possibleHelper : undefined, counterSide: tactic === 'betrayal' ? allianceRoll >>> 9 & 1 ? 'back' : 'front' : undefined, counterFailed: tactic === 'betrayal' ? (allianceRoll >>> 12) % 3 === 1 : undefined, victim, final: false }, seed + index);
  }
  const finishSeed = ((seed >>> 4) ^ seed) >>> 0;
  const mixedTechnique = Math.imul(seed ^ seed >>> 16, 0x7feb352d) >>> 0;
  const techniqueRoll = Math.imul(mixedTechnique ^ mixedTechnique >>> 15, 0x846ca68b) >>> 0;
  const legacyFinalTactic = finishSeed % 11 === 8 ? 'spin' : finishSeed % 13 === 6 ? 'ram' : finishSeed % 12 < 4 ? arenaFinalTechniques[(techniqueRoll ^ techniqueRoll >>> 16) & 3] : finishSeed % 5 === 1 || finishSeed % 5 === 2 ? 'catch' : order.length <= 4 ? seed % 3 === 1 ? 'bait' : seed % 3 === 2 ? 'edge' : 'final' : 'final';
  if (!rounds.at(-1)?.final) {
    // Runtime games supply an independent cosmetic seed. Every ordinary solo
    // technique can therefore occur even with the same two participant ids.
    // Elbow keeps its existing eight-percent conversion rather than a new slot.
    let tactic: ArenaTactic = escapeSeed === undefined ? legacyFinalTactic : arenaSoloFinalTactics[arenaEscapeRoll(escapeSeed, preliminaries + 1717) % arenaSoloFinalTactics.length];
    const supermanPunch = arenaSupermanPunchOutcome(arenaEscapeRoll(escapeSeed ?? seed, preliminaries + 1103) % 1000) ? { start: 0, end: 0 } : undefined;
    const slideTrip = !supermanPunch && arenaSlideTripOutcome(arenaEscapeRoll(escapeSeed ?? seed, preliminaries + 911) % 1000) ? { start: 0, end: 0, evade: arenaSlideTripEvadeOutcome(arenaEscapeRoll(escapeSeed ?? seed, preliminaries + 1237) % 1000) } : undefined;
    const tripCounter = !supermanPunch && !slideTrip && arenaEscapeRoll(escapeSeed ?? seed, preliminaries + 701) % 1000 < 10;
    if (supermanPunch) tactic = 'ram';
    else if (slideTrip || tripCounter) tactic = 'trip';
    append({ id: 'arena-final', index: preliminaries, tactic, supermanPunch, slideTrip, tripCounter, aggressor: order[0], victim: order[1], final: true }, finishSeed);
  }
  const nominalEnd = rounds.at(-1)!.end;
  const timeScale = duration / Math.max(44_000, nominalEnd);
  const scaled = (time: number) => Math.min(duration, time * timeScale);
  return rounds.map(round => ({ ...round,
    wrestlingMove: round.wrestlingMove ? { ...round.wrestlingMove, start: scaled(round.wrestlingMove.start), end: scaled(round.wrestlingMove.end) } : undefined,
    kickCatch: round.kickCatch ? { ...round.kickCatch, start: scaled(round.kickCatch.start), end: scaled(round.kickCatch.end) } : undefined,
    supermanPunch: round.supermanPunch ? { ...round.supermanPunch, start: scaled(round.supermanPunch.start), end: scaled(round.supermanPunch.end) } : undefined,
    linkedRush: round.linkedRush ? { ...round.linkedRush, start: scaled(round.linkedRush.start), end: scaled(round.linkedRush.end) } : undefined,
    slideTrip: round.slideTrip ? { ...round.slideTrip, start: scaled(round.slideTrip.start), end: scaled(round.slideTrip.end) } : undefined,
    pairDodge: round.pairDodge ? { ...round.pairDodge, start: scaled(round.pairDodge.start), end: scaled(round.pairDodge.end) } : undefined,
    passingTrip: round.passingTrip ? { ...round.passingTrip, start: scaled(round.passingTrip.start), end: scaled(round.passingTrip.end) } : undefined,
    escape: round.escape ? { ...round.escape, start: scaled(round.escape.start), end: scaled(round.escape.end), releasedUntil: round.escape.releasedUntil === undefined ? undefined : scaled(round.escape.releasedUntil) } : undefined,
    recovery: round.recovery ? { ...round.recovery, start: scaled(round.recovery.start), end: scaled(round.recovery.end), throwAt: round.recovery.throwAt === undefined ? undefined : scaled(round.recovery.throwAt) } : undefined,
    rim: round.rim ? { ...round.rim, start: scaled(round.rim.start), end: scaled(round.rim.end) } : undefined,
    rimCharge: round.rimCharge ? { ...round.rimCharge, start: scaled(round.rimCharge.start), end: scaled(round.rimCharge.end) } : undefined,
    start: scaled(round.start), impact: scaled(round.impact), resolve: scaled(round.resolve), end: scaled(round.end), timeScale }));
}

/** Short fields finish as soon as their actual bouts and ceremony are complete. */
export function arenaPlaybackEnd(order: string[], duration = 44_000, rushRoll = 7, escapeSeed?: number): number {
  return arenaRounds(order, duration, rushRoll, escapeSeed).at(-1)?.end ?? 0;
}

/** Keep actual contact, running and complete throws at their intended pace. */
export function arenaMinimumDuration(order: string[], rushRoll = 7, escapeSeed?: number): number {
  const scale = arenaRounds(order, 44_000, rushRoll, escapeSeed)[0]?.timeScale ?? 1;
  return Math.ceil(44_000 / scale);
}

export function arenaRanks(order: string[], elapsed: number, duration = 44_000, rushRoll = 7, escapeSeed?: number): Record<string, number> {
  const ranks: Record<string, number> = {};
  for (const round of arenaRounds(order, duration, rushRoll, escapeSeed)) if (elapsed >= round.resolve) {
    ranks[round.victim] = order.indexOf(round.victim) + 1;
    if (round.secondaryVictim) ranks[round.secondaryVictim] = order.indexOf(round.secondaryVictim) + 1;
    if (round.final) ranks[round.aggressor] = 1;
  }
  return ranks;
}

/** Compatibility lookup now returns a real upcoming bout rather than an endless exchange. */
export function arenaExchange(order: string[], elapsed: number, duration = 44_000, reserved: readonly string[] = [], rushRoll = 7, escapeSeed?: number): ArenaRound | undefined {
  return arenaRounds(order, duration, rushRoll, escapeSeed).find(round => elapsed < round.resolve && ![round.aggressor, round.victim, round.helper].some(id => id && reserved.includes(id)));
}

/** Commentary and the canvas reserve the same next opponents for a physical approach. */
export function arenaFocusRound(order: string[], elapsed: number, duration = 44_000, rushRoll = 7, escapeSeed?: number): ArenaRound | undefined {
  return arenaRounds(order, duration, rushRoll, escapeSeed).find(round => elapsed < round.resolve);
}

/** Prepare only partners whose next real appearance is their shared deciding bout. */
export function arenaMiniExchanges(available: readonly (ArenaPoint & { id: string })[], elapsed: number, duration = 44_000, planned: readonly ArenaRound[] = []): ArenaRound[] {
  const ids = new Set(available.map(actor => actor.id)), pending = planned.filter(round => elapsed < (round.wrestlingMove?.start ?? round.kickCatch?.start ?? round.supermanPunch?.start ?? round.linkedRush?.start ?? round.slideTrip?.start ?? round.pairDodge?.start ?? round.passingTrip?.start ?? round.rimCharge?.start ?? round.rim?.start ?? round.recovery?.start ?? round.escape?.start ?? round.start)), used = new Set<string>();
  const next = new Map<string, ArenaRound>();
  pending.forEach(round => [round.aggressor, round.victim, round.helper, round.pairDodge?.partnerId].forEach(id => { if (id && !next.has(id)) next.set(id, round); }));
  return pending.flatMap(round => {
    const unit = round.timeScale ?? duration / 44_000, entry = round.wrestlingMove?.start ?? round.kickCatch?.start ?? round.supermanPunch?.start ?? round.linkedRush?.start ?? round.slideTrip?.start ?? round.pairDodge?.start ?? round.passingTrip?.start ?? round.rimCharge?.start ?? round.rim?.start ?? round.recovery?.start ?? round.escape?.start ?? round.start, start = Math.max(0, entry - 2000 * unit);
    if (round.wrestlingMove || round.kickCatch || round.rimCharge || round.supermanPunch || round.slideTrip || round.linkedRush) return [];
    const pair = round.pairDodge ? [round.aggressor, round.pairDodge.partnerId] : round.rushOutcome ? round.rushOutcome === 'double-out' ? [round.victim, round.helper!] : [round.aggressor, round.helper!] : [round.aggressor, round.victim];
    if (elapsed < start || pair.some(id => !ids.has(id) || used.has(id) || next.get(id)?.id !== round.id)) return [];
    pair.forEach(id => used.add(id));
    return [{ id: `mini-${round.id}`, index: round.index, tactic: 'brace' as const, aggressor: pair[0], victim: pair[1], start, impact: entry, resolve: entry, end: entry, final: false, exchange: true, prepares: round.id, timeScale: unit }];
  });
}

/** Readable contact holds are optional for momentum-driven spin releases. */
export function arenaThrow(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1, preparation: { lift: number; angle: number; rotation?: number; immediate?: boolean } = { lift: 0, angle: 0 }): ArenaThrowFrame {
  const ms = age / Math.max(0.001, unit);
  const rotation = preparation.rotation ?? -direction;
  const hold = preparation.immediate ? 0 : 40;
  if (ms < hold) return { x: origin.x, y: origin.y - preparation.lift, groundX: origin.x, groundY: origin.y, height: preparation.lift, angle: preparation.angle, phase: clamp(ms / hold), stage: 'hold' };
  if (ms < 880) {
    const p = clamp((ms - hold) / (880 - hold));
    const groundX = mix(origin.x, landing.x, p);
    const groundY = mix(origin.y, landing.y, p);
    const height = 132 * 4 * p * (1 - p) + preparation.lift * (1 - ease(p));
    return { x: groundX, y: groundY - height, groundX, groundY, height, angle: mix(preparation.angle, rotation * Math.PI * 0.83, ease(p)), phase: p, stage: 'flight' };
  }
  if (ms < 1100) {
    const p = (ms - 880) / 220;
    return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: rotation * Math.PI * (0.83 + p * 0.06), phase: p, stage: 'land' };
  }
  if (ms < 1600) {
    const p = (ms - 1100) / 500;
    const x = landing.x + direction * Math.sin(p * Math.PI) * 18;
    return { x, y: landing.y, groundX: x, groundY: landing.y, height: 0, angle: rotation * mix(Math.PI * 0.89, Math.PI * 2, ease(p)), phase: p, stage: 'roll' };
  }
  if (ms < 2100) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: (ms - 1600) / 500, stage: 'recover' };
  return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: 1, stage: 'walk' };
}

/** A missed charge carries its current momentum over the edge, without a throwing arc. */
export function arenaChargeFall(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1, velocity = direction * 120): ArenaChargeFallFrame {
  const ms = Math.max(0, age / Math.max(.001, unit));
  if (ms < 880) {
    const fall = clamp((ms - 220) / 660), momentum = direction * Math.min(165, Math.max(55, Math.abs(velocity) * unit));
    const edgeX = origin.x + momentum * .22, tangent = momentum * .66;
    const groundX = ms < 220 ? origin.x + momentum * ms / 1000 : (2 * fall ** 3 - 3 * fall ** 2 + 1) * edgeX + (fall ** 3 - 2 * fall ** 2 + fall) * tangent + (-2 * fall ** 3 + 3 * fall ** 2) * landing.x;
    const groundY = mix(origin.y, landing.y, ease(fall)), height = 0;
    const angle = direction * (ms < 220 ? .1 * ease(ms / 220) : mix(.1, Math.PI * .83, ease(fall)));
    return { x: groundX, y: groundY - height, groundX, groundY, height, angle, phase: ms < 220 ? ms / 220 : fall, stage: ms < 220 ? 'overrun' : 'fall' };
  }
  if (ms < 1100) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: direction * Math.PI * (.83 + (ms - 880) / 220 * .06), phase: (ms - 880) / 220, stage: 'land' };
  if (ms < 1600) {
    const p = (ms - 1100) / 500, x = landing.x + direction * Math.sin(p * Math.PI) * 18;
    return { x, y: landing.y, groundX: x, groundY: landing.y, height: 0, angle: direction * mix(Math.PI * .89, Math.PI * 2, ease(p)), phase: p, stage: 'roll' };
  }
  if (ms < 2100) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: (ms - 1600) / 500, stage: 'recover' };
  return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: 1, stage: 'walk' };
}

/** A pushed wrestler loses the back step at the rim, then drops below the sand. */
export function arenaEdgeFall(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1): ArenaChargeFallFrame {
  const frame = arenaChargeFall(age, origin, landing, direction, unit, direction * 70 / Math.max(.001, unit));
  if (frame.stage === 'overrun') frame.angle = direction * .24 * ease(frame.phase);
  else if (frame.stage === 'fall') frame.angle = direction * mix(.24, Math.PI * .83, ease(frame.phase));
  return frame;
}

export function arenaNarration(round: ArenaRound | undefined, candidates: Candidate[], order: string[], elapsed: number, preview = false) {
  const actor = (id: string | undefined) => {
    const index = candidates.findIndex(candidate => candidate.id === id);
    return index < 0 ? '' : `${index + 1}번 ${candidates[index].name}`;
  };
  if (preview) return { title: '장외 난투 · 모두 함께 맞붙습니다', detail: '색 띠와 번호로 구분합니다. 마지막까지 모래판에 남은 참가자가 우승합니다.' };
  if (!round) return { title: '여러 무리가 동시에 힘겨루기', detail: '접근하고 샅바를 잡고, 상대의 힘을 버티며 다음 빈틈을 엿봅니다.' };
  const a = actor(round.aggressor), v = actor(round.victim), h = actor(round.helper);
  if (round.wrestlingMove && elapsed >= round.wrestlingMove.start && elapsed < round.resolve) {
    const beat = arenaWrestlingPresentation(round, elapsed, { aggressor: a, victim: v });
    return { title: beat.title, detail: beat.detail };
  }
  if (round.kickCatch && elapsed >= round.kickCatch.start && elapsed < round.resolve) {
    const frame = arenaKickCatchTargets(round.kickCatch, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    return frame.stage === 'approach' ? { title: '달려들어 옆차기를 노린다', detail: `${v}가 ${a}를 향해 속도를 붙입니다.` }
      : frame.stage === 'load' || frame.stage === 'jump' ? { title: '도약! 옆차기 준비', detail: `${v}가 모래를 박차고 뛰어올라 한 발을 내밉니다.` }
      : frame.stage === 'kick' ? { title: '옆차기! 잡을 수 있을까?', detail: `${v}의 뻗은 발이 다가옵니다. ${a}가 두 손을 내밀어 반격할 틈을 봅니다.` }
      : frame.stage === 'catch' ? { title: '킥 캐치! 발목을 잡았다', detail: `${a}가 ${v}의 발목을 두 손으로 잡고 몸의 중심을 낮춥니다.` }
      : frame.stage === 'spin' ? { title: '발목을 잡고 한 바퀴!', detail: `${a}가 모래판에 발을 고쳐 딛으며 정확히 한 바퀴 돕니다. ${v}의 몸이 붙잡힌 발을 중심으로 따라갑니다.` }
      : frame.stage === 'release' ? { title: '회전 끝에서 던지기!', detail: `${a}가 회전의 힘을 실어 손을 놓습니다. ${v}만 장외로 날아갑니다.` }
      : { title: '착지하고 다시 자세를 고친다', detail: `${v}가 발을 내리고 다음 공방을 준비합니다.` };
  }
  if (round.supermanPunch && elapsed >= round.supermanPunch.start && elapsed < round.resolve) {
    const punch = arenaSupermanPunchTargets(round.supermanPunch, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    const hit = round.supermanPunch.hitAt != null && elapsed >= round.supermanPunch.hitAt;
    return punch.stage === 'approach' ? { title: '틈을 향해 속도를 붙인다', detail: `${a}가 ${v}의 얼굴 앞을 보며 지금 선 자리에서 달려듭니다.` }
      : punch.stage === 'load' ? { title: '앞발을 딛고 도약 준비!', detail: `${a}가 무릎을 굽혀 모래를 박차고, 한 손을 뒤로 당깁니다.` }
      : punch.stage === 'jump' ? { title: '도약! 한쪽 주먹을 준비한다', detail: `${a}가 무릎을 접고 뛰어오르며 ${v}의 얼굴 앞을 향해 몸을 틉니다.` }
      : punch.stage === 'punch' ? { title: '슈퍼맨 펀치!', detail: hit ? `${a}의 뻗은 주먹이 ${v}의 턱 부근에 닿았습니다! 맞은 선수만 차오른 힘에 밀려 장외로 날아갑니다.` : `${a}가 공중에서 한쪽 주먹을 ${v}의 얼굴 앞으로 뻗습니다.` }
      : punch.stage === 'land' ? { title: '공격자는 두 발로 착지!', detail: hit ? `${a}는 모래판 안에 발을 내립니다. ${v}는 맞은 방향으로 장외로 날아갑니다.` : `${a}가 모래판 안에 두 발을 내려 몸의 중심을 잡습니다.` }
      : { title: hit ? '맞은 선수만 장외로!' : '착지하고 자세를 고친다', detail: hit ? `${v}만 장외로 나갑니다. ${a}는 모래판 안에서 다음 상대를 살핍니다.` : `${a}가 착지한 자리에서 주먹을 거두고 다시 상대를 봅니다.` };
  }
  if (round.slideTrip && elapsed >= round.slideTrip.start && elapsed < round.resolve) {
    const slide = arenaSlideTripTargets(round.slideTrip, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    if (round.slideTrip.evade) return slide.stage === 'approach' ? { title: '거리를 두고 발을 노린다', detail: `${a}가 떨어져 있는 ${v}의 지지발을 보고 달려듭니다.` }
      : slide.stage === 'slide' ? { title: '모래 위로 슬라이딩!', detail: `${a}가 발부터 몸을 낮춰 파고듭니다. ${v}는 다가오는 발을 봅니다.` }
      : slide.stage === 'jump' || slide.stage === 'pass' ? { title: '두 발 점프로 넘겼다!', detail: `${v}가 두 무릎을 접어 뛰어오릅니다. ${a}의 발은 떠 있는 두 발 아래로 지나갑니다.` }
      : slide.stage === 'land' ? { title: '두 발로 모래판 안에 착지!', detail: `${v}가 안쪽에 두 발을 내리고 중심을 잡습니다. ${a}는 미끄러짐을 멈추고 일어섭니다.` }
      : { title: '다시 겨룬다', detail: `${a}와 ${v}가 모래판 안에 남아 다음 공방을 이어갑니다.` };
    return slide.stage === 'approach' ? { title: '지지발을 향해 달려든다', detail: `${a}가 ${v}의 지지발을 보고 발을 박차 속도를 붙입니다.` }
      : slide.stage === 'slide' || slide.stage === 'hook' && round.slideTrip.hookAt == null ? { title: '슬라이딩! 모래 위로 파고든다', detail: `${a}가 발을 앞으로 뻗어 모래 위를 미끄러집니다. ${v}의 지지발에 가까워집니다.` }
      : slide.stage === 'hook' || slide.stage === 'fall' ? { title: '지지발에 걸렸다!', detail: `${a}의 뻗은 발이 ${v}의 발목에 닿았습니다. ${v}가 중심을 잃고 뒤로 넘어집니다.` }
      : slide.stage === 'rise' ? { title: '자세 회복', detail: `${a}가 미끄러지던 힘을 멈추고 손과 발로 몸을 일으킵니다. ${v}는 모래 위에 누워 있습니다.` }
      : slide.stage === 'kick' ? { title: '몸통 발차기!', detail: `${a}가 지지발을 딛고 ${v}의 몸통을 발바닥으로 찹니다.` }
      : { title: '차인 선수만 장외로!', detail: `${v}가 차인 방향으로 모래판 밖으로 나갑니다. ${a}는 안쪽에 발을 딛고 남습니다.` };
  }
  if (round.linkedRush && round.helper && elapsed >= round.linkedRush.start && elapsed < round.resolve) {
    if (round.linkedRush.launchAt == null || elapsed < round.linkedRush.launchAt) return { title: '나란히 팔을 뻗는다', detail: `${a} · ${h}가 나란히 서서 각자 한 팔을 옆으로 뻗습니다. ${v}는 두 사람 앞에서 버팁니다.` };
    if (round.rushContactAt === undefined || elapsed < round.rushContactAt) return { title: '둘이 함께 돌진!', detail: `${a} · ${h}가 발을 맞춰 달립니다. 각자 뻗은 팔로 ${v}의 목과 윗가슴을 향해 들어갑니다.` };
    const shared = arenaPairRushTargets(round, elapsed, { x: 500, y: 416 });
    return shared.stage === 'contact' || shared.stage === 'rebound' ? { title: '두 팔로 목 · 가슴을 가격!', detail: `${v}가 두 선수의 뻗은 팔에 맞아 뒤로 넘어집니다.` }
      : shared.stage === 'groggy' ? { title: '쓰러져 기절! 둘이 다시 붙는다', detail: `${v}가 모래 위에 누워 있습니다. ${a} · ${h}가 양쪽 어깨와 발끝으로 접근합니다.` }
      : shared.stage === 'grip' || shared.stage === 'load' ? { title: '어깨 · 발끝을 나눠 잡았다', detail: `${a}가 양쪽 어깨를, ${h}가 두 발끝을 잡았습니다. ${v}를 함께 들어 올릴 준비를 합니다.` }
      : shared.stage === 'lift' || shared.stage === 'overhead' ? { title: '몸 앞에 함께 들어 올린다!', detail: `${a} · ${h}가 같은 속도로 무릎을 펴며 ${v}를 몸 앞에 들어 올리고 뒤로 살짝 당겨 함께 던질 힘을 모읍니다.` }
      : { title: '함께 던진다! 붙잡힌 선수만 장외', detail: `${a} · ${h}가 손을 놓아 ${v}만 모래판 밖으로 던집니다.` };
  }
  if (round.pairDodge && elapsed >= round.pairDodge.start && (elapsed < round.pairDodge.end || round.pairDodge.outcome === 'out' && elapsed < round.resolve)) {
    const dodge = arenaPairDodgeTargets(round.pairDodge, elapsed, { x: 500, y: 416 }, undefined, round.timeScale);
    const partner = actor(round.pairDodge.partnerId);
    return dodge.stage === 'wrestle' ? { title: '두 선수의 틈으로 돌진을 노린다', detail: `${a} · ${partner}가 맞잡고 싸웁니다. ${v}가 지금 자리에서 빈틈을 봅니다.` }
      : dodge.stage === 'charge' ? { title: '돌진! 두 선수가 동시에 뛴다', detail: `${v}가 달려듭니다. 두 선수는 다가오는 어깨를 보고 함께 점프합니다.` }
      : dodge.jumpHeight.some(height => height > 1) ? { title: '점프 회피! 돌진이 아래로 지나간다', detail: `${a} · ${partner}가 무릎을 접어 피합니다. ${v}는 빈 공간으로 계속 달립니다.` }
      : round.pairDodge.outcome === 'out' && elapsed >= round.impact ? { title: '멈추지 못하고 혼자 장외!', detail: `${a} · ${partner}는 안쪽에 착지했습니다. ${v}는 달리던 힘을 멈추지 못하고 경계를 넘습니다.` }
      : round.pairDodge.outcome === 'out' ? { title: '피했다! 돌진이 빈 공간으로', detail: '피한 두 선수는 안쪽에 착지합니다. 돌진한 선수는 발을 멈추려고 균형을 고칩니다.' }
      : { title: '착지! 피한 자리에서 다시 승부', detail: '세 선수 모두 모래판에 남았습니다. 달리던 선수는 속도를 줄이고, 착지한 선수들은 자세를 고칩니다.' };
  }
  if (round.passingTrip?.joined && elapsed >= round.passingTrip.start && elapsed < round.resolve) {
    const trip = arenaPassingTripTargets(round.passingTrip, elapsed, { x: 500, y: 416 }, undefined, round.contactSide, round.timeScale);
    const passer = actor(round.passingTrip.passerId);
    return trip.stage === 'approach' ? { title: '싸우는 두 선수 옆으로 지나간다', detail: `${passer}가 가까이 지나갑니다. ${a} · ${v}는 상대에게 집중하고 있습니다.` }
      : trip.stage === 'hook' || trip.stage === 'fall' ? { title: '지나가던 선수의 발걸기!', detail: `${passer}의 발에 ${v}의 발목이 걸렸습니다. 중심을 잃고 모래 위에 넘어집니다.` }
      : trip.stage === 'ankle-approach' || trip.stage === 'grip' ? { title: '빈틈! 넘어진 상대의 발끝을 잡는다', detail: `${a}가 두 발끝으로 다가가 양손으로 잡습니다. ${passer}는 그대로 지나갑니다.` }
      : { title: '발끝을 잡고 들어 던진다!', detail: `${a}가 발을 딛고 ${v}를 들어 올려 장외로 던집니다.` };
  }
  const rimCharge = arenaRimChargeTargets(round, elapsed, { x: 500, y: 416 });
  if (rimCharge && (elapsed < round.rimCharge!.end || rimCharge.outcome === 'dodge' && elapsed < round.resolve)) {
    const stage = rimCharge.stage;
    return stage === 'approach' ? { title: '외곽에서 빈틈을 노린다 · 돌진 준비', detail: `${v}가 지금 선 자리에서 몸을 낮춥니다. ${a}는 다가올 돌진을 살피며 발을 고쳐 딛습니다.` }
      : stage === 'charge' ? { title: '발을 박차고 돌진! 상대는 끝까지 본다', detail: `${v}가 ${a}를 향해 가속합니다. ${a}는 뒷발을 박고 가까워지는 어깨를 봅니다.` }
      : stage === 'dodge' ? { title: '지금! 돌진을 옆으로 피했다', detail: `${a}가 옆으로 빠집니다! ${v}의 어깨는 빈 공간을 지나고 발은 계속 앞으로 달립니다.` }
      : stage === 'brace' ? { title: '버틴다! 두 발로 돌진을 받아냈다', detail: `${a}가 발을 넓혀 ${v}의 돌진을 막습니다. 손이 맞닿고 두 사람 모두 모래판에 남았습니다.` }
      : stage === 'duel' ? { title: '돌진이 막혔다 · 그 자리에서 맞잡기', detail: `${v}가 돌진을 멈췄습니다. ${a}와 손을 맞잡은 자리에서 곧바로 다음 공방을 이어갑니다.` }
      : { title: '피했다! 멈추지 못한 돌진이 장외로', detail: `${a}는 모래판 안쪽에 남습니다. ${v}는 달리던 힘을 멈추지 못하고 경계를 넘어 떨어집니다.` };
  }
  const rim = arenaRimTargets(round, elapsed, { x: 500, y: 416 });
  if (rim?.active) return rim.stage === 'approach' ? { title: '가장자리 빈틈을 노린다', detail: `${a}가 ${v}의 앞을 막고 낮게 접근합니다. ${v}는 경계를 살피며 발을 고쳐 딛습니다.` }
    : rim.stage === 'pressure' ? { title: '밀어붙인다! 뒷발이 버텨낼까?', detail: `${a}가 앞발에 힘을 싣고 ${v}를 밀어냅니다. ${v}는 두 발로 모래를 박차며 버팁니다.` }
    : rim.stage === 'brace' ? { title: '버텼다! 두 발을 박고 밀기를 막았다', detail: `${v}가 보폭을 넓혀 버텼습니다. ${a}의 밀기가 멈추고 두 선수 모두 모래판에 남았습니다.` }
    : { title: '밀기가 막혔다! 손을 풀고 다시 붙는다', detail: `${a} · ${v}가 손을 풀고 한 발 물러납니다. 방금 밀린 자리에서 자세를 바꾸며 다음 승부수를 노립니다.` };
  const recoveryThrower = actor(round.recovery?.throwerId ?? round.aggressor);
  const recovery = arenaRecoveryTargets(round, elapsed, { x: 500, y: 416 });
  if (recovery?.active && recovery.kind === 'overhead-escape') return recovery.stage === 'separate' ? { title: '점프 탈출! 원래 상대와 거리를 벌린다', detail: `${v}가 두 발로 착지한 기세로 달려 나갑니다. 자신을 들어 올렸던 ${recoveryThrower}의 손이 닿지 않는 곳으로 빠져나갑니다.` } : recovery.stage === 'overhead' ? { title: '머리 위로 들렸다 · 점프로 벗어날 수 있을까?', detail: `${recoveryThrower}가 ${v}를 높이 들었습니다. 내리찍기 직전 ${v}가 손에서 빠져나갈 틈을 찾습니다.` }
    : recovery.airborne ? { title: '머리 위에서 점프 탈출!', detail: `${v}가 무릎을 모아 손에서 튀어나왔습니다! 뒤로 점프하고, ${recoveryThrower}는 놓친 팔을 내리며 균형을 바로잡습니다.` }
    : recovery.stage === 'land' || recovery.stage === 'release' ? { title: '두 발 착지! 내리찍기를 피했다', detail: `${v}가 모래판 안에 두 발로 착지했습니다. 모두 살아남아 다음 승부를 이어갑니다.` }
    : recovery.stage === 'lift' ? { title: '머리 위로 들어 올린다!', detail: `${recoveryThrower}가 무릎을 펴며 ${v}를 머리 위로 들어 올립니다. 두 발이 모래판을 떠납니다.` }
    : { title: '맞잡고 내리찍을 틈을 노린다', detail: `${recoveryThrower} · ${v}가 몸통을 맞잡고 발을 딛어 힘을 겨룹니다.` };
  if (recovery?.active) return recovery.stage === 'approach' ? { title: '몸통을 노리고 가까이 파고든다', detail: `${recoveryThrower}가 ${v}와 거리를 좁힙니다. 두 선수는 서로를 향해 발을 고쳐 딛습니다.` }
    : recovery.stage === 'hold' || recovery.stage === 'lift' && recovery.height <= .01 ? { title: '맞잡았다 · 두 발로 힘을 겨룬다', detail: `${recoveryThrower}가 ${v}의 몸통을 잡았습니다. 아직 발을 딛고 버티며 들어 올릴 틈을 봅니다.` }
    : recovery.stage === 'lift' ? { title: '던지기! 몸통을 들어 올린다!', detail: `${recoveryThrower}가 무릎을 펴며 ${v}를 들어 올립니다. 붙잡힌 몸의 두 발이 모래판을 떠납니다.` }
    : recovery.airborne ? { title: '공중 한 바퀴! 두 발로 착지를 노린다', detail: `${v}가 놓인 순간 몸을 접어 한 바퀴 회전합니다. 모래판 안쪽을 향해 발을 내립니다.` }
    : recovery.stage === 'separate' ? { title: '살아남았다! 상대와 거리를 벌린다', detail: `${v}가 착지한 기세로 달려 나갑니다. 방금 자신을 던진 ${recoveryThrower}의 손이 닿지 않는 곳까지 거리를 벌립니다.` }
    : { title: '착지! 장외를 피하고 살아남았다', detail: `${v}가 두 발로 모래판 안에 착지했습니다. 거리를 두고 다음 빈틈을 살핍니다.` };
  const escape = arenaEscapeTargets(round, elapsed, { x: 500, y: 416 });
  if (escape?.active || escape?.released) {
    const runner = actor(escape.runnerId), chaser = actor(escape.chaserId);
    if (escape.released || escape.stage === 'separate') return { title: '도망 성공! 첫 공방은 결판 없이 끝났다', detail: `${runner}가 완전히 빠져나갔습니다. ${chaser}의 손이 닿지 않는 거리까지 벌어졌고 두 선수 모두 모래판에 남았습니다.` };
    return escape.stage === 'approach' || escape.stage === 'grip' ? { title: '맞잡았다! 한쪽이 빈틈을 살핀다', detail: `${runner} · ${chaser}가 손을 잡고 힘을 겨룹니다. 발을 바꿔 딛으며 빠져나갈 틈을 봅니다.` }
      : escape.stage === 'break' ? { title: '손을 뺐다! 아직 결판은 아니다', detail: `${runner}가 잡힌 손을 빼고 몸을 틀었습니다. ${chaser}의 손이 허공을 가릅니다.` }
      : escape.stage === 'flee' || escape.stage === 'chase' ? { title: '달아난다! 같은 상대가 추격한다', detail: `${runner}가 모래판 안쪽으로 달아납니다. ${chaser}가 뒤를 쫓고, 두 사람 모두 모래판에 남아 있습니다.` }
      : { title: '방향을 틀었다! 새 위치에서 다시 맞붙는다', detail: `${runner}가 방향을 바꿔 ${chaser}를 마주 봅니다. 방금 놓친 두 사람이 새 접점에서 다시 승부를 겨룹니다.` };
  }
  if (round.tactic === 'elbow' || isArenaFloorDrag(round) && elapsed >= round.impact) {
    const technique = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
    const age = elapsed - round.impact, timing = arenaFloorExitTiming(round);
    if (round.elbowGripAt !== null && elapsed >= round.impact && age < timing.recoverUntil) return age < timing.stunnedUntil ? { title: '쓰러진 상대의 발끝을 붙잡는다', detail: `${a}가 누운 ${v}의 발끝에 다가갑니다. 모래 위에 누운 몸의 두 발끝을 양손으로 붙잡습니다.` }
      : age < timing.dragUntil ? { title: '발끝 잡아 끌기 · 경계가 가까워진다', detail: `${a}가 발을 바꿔 디디며 ${v}를 모래 위로 끕니다. 쓰러진 몸은 경계 쪽으로 따라 움직입니다.` }
      : age < timing.throwUntil || round.floorFinish && round.floorFinish.releaseAt == null ? round.floorFinish && round.floorFinish.throwAt == null ? { title: '모래판 안에 발을 딛고 발끝을 잡는다', detail: `${a}가 경계 안쪽에 멈춰 ${v}의 두 발끝을 단단히 붙잡습니다. 아직 손을 놓지 않았습니다.` } : { title: '끝에서 들어 올려 던지기!', detail: `${a}가 모래판 안에 발을 딛고 두 발끝을 단단히 잡고 몸의 힘을 실어 위쪽으로 던집니다. 몸을 들어 올리는 동안 손은 붙어 있습니다. 손을 놓으면 상대가 포물선을 그리며 경계 밖으로 날아갑니다.` }
      : age < timing.tossUntil ? { title: '끝에서 던졌다! 상대만 장외로', detail: `${a}가 모래판 안에 발을 딛고 잡은 발끝을 놓아 넘깁니다. ${v}만 경계 밖으로 날아갑니다.` }
      : age < timing.landUntil ? { title: '모래판 밖에 착지했다', detail: `${v}가 경계 아래로 떨어졌습니다. ${a}는 모래판 안에서 자세를 고칩니다.` }
      : { title: '넘어진 선수가 다시 몸을 일으킨다', detail: `${v}가 장외에서 몸을 일으킵니다. 자세를 회복한 뒤 시상 자리로 이동합니다.` };
    if (round.tactic === 'elbow' && (elapsed < round.impact || round.elbowGripAt === null)) return technique.stage === 'approach' || technique.stage === 'probe' || technique.stage === 'reset' ? { title: '몸통을 노린다 · 맞잡을 틈을 본다', detail: `${a} · ${v}가 거리를 좁히며 서로의 몸통을 노립니다. 두 선수 모두 모래판에 발을 고쳐 딛습니다.` }
      : technique.stage === 'lift-counter' ? { title: '들렸다! 공중에서 반격을 준비한다', detail: `${v}가 ${a}의 몸통을 잡아 들어 올립니다. ${a}는 팔꿈치를 접어 상대의 머리를 노립니다.` }
      : technique.stage === 'elbow' || technique.stage === 'elbow-impact' ? { title: '머리에 엘보우! 잡은 손이 풀렸다', detail: `${a}의 팔꿈치가 ${v}의 머리에 닿습니다. 손이 풀리고 ${a}는 모래판에 발을 내립니다.` }
      : technique.stage === 'groggy' ? { title: '기절! 상대가 그 자리에 쓰러졌다', detail: `${v}가 충격으로 누웠습니다. ${a}가 착지해 쓰러진 상대를 살핍니다.` }
      : technique.stage === 'ankle-approach' ? { title: '발끝으로 돌아 접근한다', detail: `${a}가 누운 ${v}의 옆으로 돌아 두 발끝에 접근합니다. 쓰러진 몸은 그 자리에 남아 있습니다.` }
      : { title: '두 발끝을 잡았다 · 끌 준비', detail: `${a}가 ${v}의 두 발끝을 양손으로 붙잡았습니다. 발을 딛고 모래 위로 끌 준비를 합니다.` };
  }
  const action = arenaAction(round, elapsed);
  if (round.tactic === 'betrayal' && elapsed < round.resolve) {
    const details: Partial<Record<ArenaActionStage, string>> = {
      approach: `${v} · ${h}, 동맹을 맺고 ${a}의 양쪽으로 접근합니다.`,
      link: `${v} · ${h}, 같은 상대를 양쪽에서 잡고 함께 공격할 준비를 합니다.`,
      'joint-attack': `${v} · ${h}, ${a}를 함께 밀고 들어 올립니다.`,
      resist: `${a}, 발을 다시 딛고 버텼습니다. 동맹의 공동공격이 막혔습니다.`,
      betrayal: `${h}, 손을 놓고 물러납니다. 함께 공격하던 ${v}가 혼자 남았습니다.`,
      counter: `${a}, 앞에서 ${v}를 다시 붙잡아 되칩니다.`,
      'failed-counter': `${a}의 역습도 막혔습니다. ${v}가 발을 딛고 버텨 모두 모래판에 남았습니다.`,
      reset: `${a} · ${v}, 손을 풀고 거리를 바꿔 다시 맞붙습니다.`,
      lift: `${a}가 새 맞잡기에서 중심을 낮췄습니다. 첫 역습 다음의 새로운 승부입니다.`,
      throw: `${a}, 공동공격을 버틴 뒤 역습했습니다. ${v}가 장외로 넘어갑니다.`,
      release: `${v}, 배신 뒤의 역습을 버텨냈습니다. 모두 모래판을 지켰습니다.`,
    };
    if (round.counterSide === 'back') details.counter = `${a}, 뒤쪽의 ${v}를 다시 붙잡아 되칩니다.`;
    return { title: action.stage === 'failed-counter' ? '역습도 막혔다!' : action.stage === 'reset' ? '거리를 바꾸고 다시 맞붙는다' : action.stage === 'joint-attack' ? '동맹의 공동공격!' : action.stage === 'resist' ? '버텼다! 동맹 공격이 막혔다' : action.betrayed ? round.exchange && elapsed >= round.impact ? '배신 뒤의 역습도 버텨냈다' : `공동공격 뒤 배신 · ${round.counterSide === 'back' ? '뒤쪽' : '앞쪽'} 역습` : '동맹 결성 · 함께 공격 준비', detail: details[action.stage] ?? '' };
  }
  if (round.tactic === 'team' && round.exchange && elapsed >= round.impact) return { title: '동맹 공동공격 실패 · 상대가 버텼다!', detail: `${a} · ${h}, 함께 공격했지만 ${v}가 빠져나왔습니다. 동맹은 함께 물러나 다음 빈틈을 봅니다.` };
  if (round.tactic === 'bait' && elapsed < round.resolve) {
    const charge = arenaChargeState(round, elapsed);
    if (round.exchange && elapsed >= round.impact) return { title: '아슬아슬! 돌진을 멈춰 세웠다', detail: `${a}가 옆으로 피했습니다. ${v}는 모래판 끝에서 발을 고쳐 딛고 멈춥니다.` };
    const title = charge.stage === 'prepare' ? '빈틈을 노린다 · 돌진 준비' : charge.stage === 'charge' ? '몸을 낮추고 돌진!' : charge.stage === 'dodge' ? '지금! 옆으로 피한다' : '멈출 수 없다! 장외로 넘어진다';
    const detail = charge.stage === 'prepare' ? `${a}가 빈틈을 보입니다. ${v}는 무게를 낮추고 첫발을 준비합니다.` : charge.stage === 'charge' ? `${v}가 발을 박차고 가속합니다. ${a}는 가까워지는 상대를 끝까지 봅니다.` : charge.stage === 'dodge' ? `${a}가 옆으로 빠집니다! ${v}는 빈 공간을 향해 그대로 달려갑니다.` : `${v}가 돌진의 관성을 이기지 못합니다. 경계를 넘어 모래판 아래로 굴러떨어집니다.`;
    return { title, detail };
  }
  if (round.tactic === 'edge' && elapsed < round.resolve) {
    const edge = arenaEdgeTargets(round, elapsed, { x: 675, y: 490 });
    return { title: edge.stage === 'approach' ? '경계에서 서로를 견제한다' : edge.stage === 'contest' ? '끝에서 맞잡았다 · 뒷발로 버틴다' : edge.stage === 'push' ? '한 발씩 밀린다 · 경계가 가깝다!' : '뒷발이 빠졌다! 아래로 넘어간다', detail: elapsed >= round.impact ? `${v}의 뒷발이 경계를 넘었습니다. 들어 올리지 않고 모래판 아래로 밀려 떨어집니다.` : edge.stage === 'push' || edge.stage === 'tip' ? `${a}가 앞발을 딛고 밀어붙입니다. ${v}는 손을 놓지 않고 발을 바꿔 딛으며 버팁니다.` : `${a} · ${v}, 가장자리에서 거리를 좁힙니다. 손을 맞잡고 몸을 낮춰 서로의 힘을 살핍니다.` };
  }
  if (round.tactic === 'catch' && elapsed < round.resolve) {
    const state = arenaCatchTargets(round, elapsed, { x: 675, y: 430 });
    return { title: state.stage === 'prepare' ? '몸을 낮추고 돌진을 기다린다' : state.gripStrength === 0 ? '달려든다! 두 팔로 받아낸다' : state.stage === 'load' ? '몸통을 받았다! 무게를 받아낸다' : '돌진의 힘으로 되치기!', detail: state.gripStrength === 0 ? `${v}가 몸을 숙이고 돌진합니다. ${a}는 두 팔을 내밀고 중심을 낮춥니다.` : state.stage === 'load' ? `${a}의 두 손이 ${v}의 몸통에 닿았습니다. 발을 딛고 달려온 무게를 받아냅니다.` : `${a}가 ${v}의 몸통을 놓지 않고 발과 골반을 돌립니다. 잡은 몸을 들어 돌진의 힘으로 던집니다.` };
  }
  if (round.tactic === 'spin' && elapsed < round.resolve) {
    const spin = arenaSpinTargets(round, elapsed, { x: 500, y: 416 });
    return { title: spin.stage === 'approach' || spin.stage === 'grip' ? '몸통을 잡았다 · 먼저 들어 올린다' : spin.stage === 'lift' || spin.stage === 'plant' ? '들렸다! 발을 내려 버틴다' : spin.stage === 'reverse' ? '손을 바꿔 잡았다 · 역으로 되치기' : '한 바퀴 돌려 장외로!', detail: spin.stage === 'approach' || spin.stage === 'grip' || spin.stage === 'lift' || spin.stage === 'plant' ? `${v}가 ${a}를 들어 올립니다. ${a}는 손을 놓지 않고 한 발을 모래판에 내려 중심을 되찾습니다.` : `${a}가 몸통을 다시 잡고 발을 바꿔 디딥니다. 발을 바꿔 디디며 한 바퀴 돌린 뒤 ${v}를 놓아 장외로 날립니다.` };
  }
  if (round.tactic === 'ram' && elapsed < round.resolve) {
    const ram = arenaRamTargets(round, elapsed, { x: 500, y: 416 });
    return { title: ram.stage === 'prepare' ? '몸을 낮춘다 · 정면 돌진 준비' : ram.stage === 'charge' ? '어깨를 앞으로! 밀고 들어간다' : '정면 충돌! 상대가 튀어올랐다', detail: ram.stage === 'prepare' ? `${a}가 앞발에 체중을 싣고 ${v}의 빈틈을 노립니다.` : ram.stage === 'charge' ? `${a}가 땅을 박차고 가속합니다. ${v}는 발을 딛고 앞에서 막아섭니다.` : `${a}의 어깨가 ${v}의 몸통에 부딪쳤습니다! ${v}의 두 발이 모래판을 떠나 장외로 날아갑니다.` };
  }
  if (round.rushOutcome && h && elapsed < round.resolve) {
    const rush = arenaPairRushTargets(round, elapsed, { x: 675, y: 430 });
    if (rush.outcome === 'counter-throw') return { title: rush.stage === 'wrestle' ? '두 선수의 힘겨루기' : rush.stage === 'charge' || rush.stage === 'contact' ? '둘을 향해 돌진!' : rush.stage === 'rebound' || rush.stage === 'groggy' ? '돌진이 막혔다! 튕겨 나가 기절' : rush.stage === 'grip' || rush.stage === 'load' ? '한 명은 어깨, 한 명은 다리를 잡았다!' : '둘이 힘을 합쳐 장외로!', detail: rush.stage === 'rebound' || rush.stage === 'groggy' ? `${v}의 돌진을 ${a} · ${h}가 버텼습니다. ${v}가 튕겨 나가 바닥에 쓰러집니다.` : rush.stage === 'grip' || rush.stage === 'load' || rush.stage === 'lift' || rush.stage === 'overhead' || rush.stage === 'toss' || rush.stage === 'release' ? `${a}는 어깨를, ${h}는 다리를 잡았습니다. 싸우던 두 사람이 함께 ${v}를 들어 올려 모래판 밖으로 던집니다.` : `${a} · ${h}가 맞잡고 싸우던 틈을 ${v}가 돌진해 노립니다.` };
    return { title: rush.stage === 'wrestle' ? '가장자리에서 두 선수의 힘겨루기' : rush.stage === 'charge' ? '맞잡은 둘을 향해 돌진!' : rush.stage === 'contact' ? '쾅! 두 사람의 중심이 무너졌다' : rush.stage === 'push' ? '발을 딛고 두 사람을 밀어붙인다!' : '함께 밀린 두 사람만 장외로!', detail: rush.stage === 'wrestle' || rush.stage === 'charge' ? `${v} · ${h}가 맞잡고 싸웁니다. ${a}가 두 사람의 빈틈을 향해 어깨를 낮추고 달려듭니다.` : rush.stage === 'contact' ? `${a}의 어깨가 부딪쳤습니다! ${v} · ${h}가 충격으로 뒤로 젖혀지며 중심을 잃습니다.` : `${a}가 두 발을 모래에 딛고 ${v} · ${h}를 함께 밀어붙입니다. 두 사람만 경계 아래로 떨어지고 ${a}는 모래판 안에 남습니다.` };
  }
  if ((round.tactic === 'shove' || round.tactic === 'double-shove') && elapsed < round.resolve) {
    const shove = round.tactic === 'double-shove' ? arenaDoubleShoveTargets(round, elapsed, { x: 675, y: 430 }) : arenaShoveTargets(round, elapsed, { x: 675, y: 430 });
    if (round.secondaryVictim) return { title: shove.stage === 'wrestle' ? '두 선수의 힘겨루기' : shove.stage === 'approach' ? '옆에서 빈틈을 노린다' : shove.stage === 'contact' ? '맞잡은 두 명을 밀어붙였다!' : elapsed >= round.impact ? '두 선수만 장외로!' : '두 선수가 함께 밀린다!', detail: elapsed >= round.impact ? `${v} · ${h}가 함께 경계 아래로 떨어집니다. ${a}는 모래판 안에 남습니다.` : `${v} · ${h}가 손을 맞잡은 사이 ${a}가 옆에서 밀었습니다. 서로 손을 놓지 못한 두 선수의 뒷발이 함께 밀립니다.` };
    const detail = elapsed >= round.impact ? `${h}가 손을 놓고 발을 고쳐 딛었습니다. ${v}는 경계 아래로 밀려 떨어집니다.` : shove.stage === 'wrestle' || shove.stage === 'approach' ? `${v} · ${h}가 손을 잡고 싸웁니다. ${a}는 둘의 옆으로 접근하며 빈틈을 살핍니다.` : shove.stage === 'contact' ? `${a}가 어깨와 두 손으로 밀었습니다! ${v} · ${h}의 중심이 함께 흔들립니다.` : `${a}가 발을 딛고 밀어붙입니다. ${h}는 손을 풀고 중심을 잡고, ${v}는 한 발씩 경계로 밀립니다.`;
    return { title: shove.stage === 'wrestle' ? '맞잡은 두 선수 · 옆에서 빈틈을 본다' : shove.stage === 'approach' ? '몸싸움 틈으로 다가온다' : shove.stage === 'contact' ? '옆에서 밀었다! 중심이 흔들린다' : elapsed >= round.impact ? '한 명은 버텼다! 다른 한 명은 장외' : '발을 고쳐 딛는다! 경계가 가깝다', detail };
  }
  if (round.exchange && elapsed >= round.impact) return { title: '버텼다! 다시 빈틈을 살핍니다', detail: `${a} · ${v}, 모두 모래판을 지켰습니다. 손을 풀고 다음 빈틈을 봅니다.` };
  if (elapsed >= round.resolve) return { title: round.final ? `${a}, 오늘의 장사!` : `장외! ${v} · ${order.indexOf(round.victim) + 1}위 확정`, detail: round.final ? `${round.tactic === 'bait' ? '마지막 돌진을 피했습니다. 상대가 관성으로 장외에 넘어졌습니다.' : round.tactic === 'edge' ? '끝까지 버티던 상대를 경계 밖으로 밀어냈습니다.' : '버티던 마지막 상대를 뒤집었습니다.'} ${order.length >= 3 ? '1·2·3위 선수들이' : '1·2위 선수들이'} 시상대에서 인사합니다.` : `${v}, 모래판 밖에 착지했습니다. 나머지 선수들의 난투는 계속됩니다.` };
  const titles: Record<ArenaTactic, string> = { team: '협공 · 한 명은 길을 막고, 한 명은 민다', bait: '미끼 · 돌진을 기다렸다가 옆으로 피한다', catch: '돌진을 받아 잡고 되치기', ram: '어깨로 돌진해 상대를 날리기', spin: '들기를 버티고 한 바퀴 되치기', shove: '몸싸움에 끼어 어깨로 밀기', 'double-shove': '맞잡은 두 명을 밀어붙이기', edge: '가장자리 승부 · 발을 딛고 밀어낸다', counter: '역습 · 밀리던 쪽이 중심을 낮춘다', betrayal: '배신 · 등을 맡긴 순간 방향을 바꾼다', brace: '버티기 · 발을 박고 힘을 되돌린다', lift: '들배지기 · 체중을 싣고 들어 올린다', final: '마지막 두 명 · 최후의 버티기', armspin: '팔 잡고 회전 던지기', trip: '발목 걸기 · 굴려 장외로', suplex: '머리 위에서 내리찍기', sidekick: '점프 옆차기 · 발끝 충돌', elbow: '들린 상태에서 엘보우 반격' };
  const details: Record<ArenaTactic, string> = {
    elbow: `${v}가 먼저 들어 올리지만 ${a}가 머리를 팔꿈치로 찍어 반격합니다. 누운 상대의 발끝에 접근해 끌고 간 뒤, 경계에서 상대만 던집니다.`,
    team: `${h}, ${v}의 퇴로를 막습니다. ${a}, 앞에서 함께 밀어냅니다.`,
    bait: `${a}, 틈을 보입니다. ${v}의 돌진을 옆으로 피해 관성을 이용합니다.`,
    catch: `${a}, ${v}의 돌진을 두 팔로 받아냅니다. 몸통을 놓지 않고 발을 돌려 되칩니다.`,
    ram: `${a}, 무게를 낮추고 정면으로 돌진합니다. 어깨가 부딪치며 ${v}가 장외로 날아갑니다.`,
    spin: `${v}가 먼저 들어 올립니다. ${a}는 발을 내려 버틴 뒤 상대를 붙잡고 한 바퀴 돌려 되칩니다.`,
    shove: `${a}, 싸우던 ${v} · ${h}의 옆으로 끼어들어 어깨를 밀어냅니다.`,
    'double-shove': `${a}가 맞잡은 ${v} · ${h}를 함께 밀어냅니다. 두 선수만 경계를 넘고, 미는 선수는 모래판에 남습니다.`,
    edge: `${a}, 경계 가까이에서 손을 맞잡고 밀어붙입니다. ${v}는 발을 바꿔 딛으며 끝에서 버팁니다.`,
    counter: `${a}, 낮게 파고들어 샅바를 잡습니다. ${v}의 밀기를 되칩니다.`,
    betrayal: `${v} · ${h}, 공동공격 뒤 ${h}가 손을 놓습니다. ${a}가 ${round.counterSide === 'back' ? '뒤쪽' : '앞쪽'}으로 역습합니다.`,
    brace: `${a}, ${v}의 밀기를 두 발로 버텨냅니다. 힘을 반대로 돌립니다.`,
    lift: `${a}, ${v}의 몸통을 잡습니다. 무릎을 굽혀 체중을 싣고 들어 올립니다.`,
    final: `${a} · ${v}, 팽팽한 힘겨루기. 한 번의 중심 이동이 승부를 가릅니다.`,
    armspin: `${a}가 ${v}의 두 손목을 잡고 두 바퀴 돌립니다. ${v}의 몸과 다리가 바깥으로 뻗어 공중에 뜬 뒤 손을 놓아 날립니다.`,
    trip: `${a}가 ${v}의 발목을 건 뒤 몸통을 발로 찹니다. ${v}는 차인 방향으로 뒤구르며 장외로 나갑니다.`,
    suplex: `${a}가 허리를 잡아 머리 위로 들어 내리찍습니다. 기절한 ${v}의 발끝을 잡고 끈 뒤, 모래판 안에 남아 상대만 밖으로 넘깁니다.`,
    sidekick: `${a}가 한 번 도약해 몸을 옆으로 틉니다. 공중에서 뻗은 발이 ${v}의 몸통에 닿는 순간 장외로 날립니다.`,
  };
  return { title: elapsed >= round.impact ? `${titles[round.tactic]} · 중심이 무너졌다!` : titles[round.tactic], detail: details[round.tactic] };
}
