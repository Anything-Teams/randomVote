import type { Candidate } from './election';
import { arenaFinalTechniques, arenaTechniqueTargets, isArenaFinalTechnique } from './arenaTechniques';
export { arenaTechniqueTargets, arenaTechniqueExit, isArenaFinalTechnique } from './arenaTechniques';

export type ArenaTactic = 'team' | 'bait' | 'catch' | 'ram' | 'spin' | 'shove' | 'edge' | 'counter' | 'betrayal' | 'brace' | 'lift' | 'final' | 'armspin' | 'trip' | 'suplex' | 'sidekick';
export type ArenaRound = { id: string; index: number; tactic: ArenaTactic; aggressor: string; helper?: string; victim: string; start: number; impact: number; resolve: number; end: number; final: boolean; exchange?: boolean };
export type ArenaPoint = { x: number; y: number };
export type ArenaMovingBody = ArenaPoint & { facing: number; motorX?: number; motorY?: number };
export type ArenaPodiumPlace = ArenaPoint & { id: string; rank: 1 | 2 | 3; readyAt: number };
export type ArenaRoamingStage = 'approach' | 'contact' | 'sidestep' | 'watch';
export type ArenaBeatStage = 'approach' | 'hold' | 'turn' | 'impact' | 'result';
export type ArenaBeat = { stage: ArenaBeatStage; progress: number; weightProgress: number; liftProgress: number };
export type ArenaActionStage = 'approach' | 'link' | 'joint-attack' | 'resist' | 'betrayal' | 'counter' | 'lift' | 'throw' | 'release';
export type ArenaActionPose = 'guard' | 'grapple' | 'brace' | 'push' | 'lift' | 'dodge' | 'run' | 'throw' | 'trip' | 'suplex' | 'drag' | 'sidekick' | 'stunned';
export type ArenaActionActor = { id: string; role: 'aggressor' | 'victim' | 'helper'; offset: ArenaPoint; pose: ArenaActionPose; phase: number; gripId?: string; badge: string; turn?: number };
export type ArenaAction = { stage: ArenaActionStage; actors: ArenaActionActor[]; attackers: string[]; targetId: string; allies: string[]; liftedId?: string; lift: number; outcome: 'pending' | 'success' | 'resisted' | 'betrayed'; betrayed: boolean };
export const ARENA_MAX_GROUND_SPEED = 165;
export const ARENA_LIFT_HEIGHT = 42;
export type ArenaThrowFrame = ArenaPoint & { groundX: number; groundY: number; height: number; angle: number; phase: number; stage: 'hold' | 'flight' | 'land' | 'roll' | 'recover' | 'walk' | 'stunned' | 'drag' };
export type ArenaChargeState = { stage: 'prepare' | 'charge' | 'dodge' | 'miss'; charge: number; dodge: number; preparation: number; chargeStartsAt: number; dodgeStartsAt: number };
export type ArenaChargeFallFrame = Omit<ArenaThrowFrame, 'stage'> & { stage: 'overrun' | 'fall' | 'land' | 'roll' | 'recover' | 'walk' };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const soloTactics: Exclude<ArenaTactic, 'team' | 'betrayal' | 'final'>[] = ['bait', 'counter', 'brace', 'catch', 'lift'];
const eliminationTactics: ArenaTactic[] = ['bait', 'catch', 'edge', 'shove', 'counter', 'brace', 'lift'];

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

/** Shared by the actors and commentary, so a label describes the visible action. */
export function arenaBeat(round: ArenaRound, elapsed: number): ArenaBeat {
  const progress = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const stage: ArenaBeatStage = elapsed >= round.impact ? round.exchange || elapsed >= round.resolve ? 'result' : 'impact' : progress < .30 ? 'approach' : progress < .52 ? 'hold' : 'turn';
  return { stage, progress, weightProgress: ease((progress - .52) / .20), liftProgress: ease((progress - .72) / .28) };
}

/** A forward lean precedes acceleration; the sidestep happens as the charge arrives. */
export function arenaChargeState(round: ArenaRound, elapsed: number): ArenaChargeState {
  const duration = Math.min(1600, Math.max(1, round.impact - round.start) * .64);
  const chargeStartsAt = round.impact - duration, dodgeStartsAt = chargeStartsAt + duration * .66;
  const t = clamp((elapsed - chargeStartsAt) / duration), ramp = .22;
  const charge = (t < ramp ? t * t / (2 * ramp) : t - ramp / 2) / (1 - ramp / 2);
  return { stage: elapsed < chargeStartsAt ? 'prepare' : t < .66 ? 'charge' : t < .96 ? 'dodge' : 'miss', charge, dodge: ease((t - .66) / .30), preparation: ease((elapsed - chargeStartsAt + 450) / 450), chargeStartsAt, dodgeStartsAt };
}

/** The charging loser runs toward the nearest edge while the opponent moves across its path. */
export function arenaChargeTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const state = arenaChargeState(round, elapsed), side = center.x >= 500 ? 1 : -1;
  const across = center.y >= 430 ? -1 : 1;
  const edgeX = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((center.y - 416) / 112) ** 2));
  const endX = round.exchange ? center.x + side * 86 : edgeX - side * 13;
  return { ...state, side, target: { x: center.x + side * (30 + state.dodge * 23), y: center.y + across * state.dodge * 43 }, charger: { x: mix(center.x - side * 102, endX, state.charge), y: center.y } };
}

/** Both wrestlers travel together toward the rim; the loser never gets lifted. */
export function arenaEdgeTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = center.x >= 500 ? 1 : -1;
  const rim = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((center.y - 416) / 112) ** 2));
  const pressure = ease((p - .48) / .52), shift = Math.sin(ease((p - .28) / .20) * Math.PI * 2) * 3 * (1 - pressure);
  const victimX = mix(center.x + side * 26, rim - side * 3, pressure) + side * shift;
  return { side, pressure, stage: p < .28 ? 'approach' : p < .48 ? 'contest' : p < .9 ? 'push' : 'tip', aggressor: { x: victimX - side * 53, y: center.y }, victim: { x: victimX, y: center.y } };
}

/** The receiver absorbs a charge, steps across it, then lifts from an established grip. */
export function arenaCatchTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = center.x >= 500 ? 1 : -1, charge = ease((p - .18) / .37), turn = ease((p - .60) / .25);
  const receiver = { x: center.x + side * (26 - turn * 8), y: center.y + turn * 10 };
  const charger = { x: mix(center.x - side * 92, center.x - side * 24, charge) + side * turn * 11, y: center.y - turn * 13 };
  return { side, charge, turn, stage: p < .18 ? 'prepare' as const : p < .55 ? 'charge' as const : p < .72 ? 'catch' as const : 'turn' as const, preparation: ease(p / .18), receiver, charger };
}

/** A successful shoulder charge transfers its momentum at contact; neither fighter takes a grip. */
export function arenaRamTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const span = Math.max(1, round.impact - round.start), p = clamp((elapsed - round.start) / span);
  const side = center.x >= 500 ? 1 : -1, charge = ease((p - .32) / .50), impact = ease((p - .82) / .18);
  const approach = Math.max(68, Math.min(122, span * .021));
  return { side, charge, impact, preparation: ease((p - .16) / .16),
    stage: p < .32 ? 'prepare' as const : p < .82 ? 'charge' as const : p < 1 ? 'contact' as const : 'release' as const,
    driver: { x: center.x - side * (approach - charge * (approach - 14) - impact * 10), y: center.y },
    victim: { x: center.x + side * (24 + impact * 18), y: center.y + impact * 3 } };
}

/** The first lift fails before its defender plants, changes the grip and turns once around the vertical axis. */
export function arenaSpinTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = center.x >= 500 ? 1 : -1;
  const lift = ease((p - .26) / .12) * (1 - ease((p - .38) / .06));
  const turnProgress = clamp((p - .52) / .48), ramp = .12;
  // Constant middle speed, eased first/last steps. A complete turn fits inside a normal bout.
  const turn = (turnProgress < ramp ? turnProgress ** 2 / (2 * ramp) : turnProgress > 1 - ramp ? 1 - ramp - (1 - turnProgress) ** 2 / (2 * ramp) : turnProgress - ramp / 2) / (1 - ramp);
  const angle = turn * Math.PI * 2;
  const reversal = ease((p - .38) / .14);
  const turningRadius = Math.min(38, (round.impact - round.start) / 1000 * .48 * (1 - ramp) * 150 / (Math.PI * 2));
  const radius = mix(48, turningRadius, reversal);
  const defender = { x: center.x - side * 22, y: center.y };
  const attacker = { x: defender.x + side * radius * Math.cos(angle), y: defender.y + radius * Math.sin(angle) * .42 };
  return { side, angle, turn, lift, counterLift: ease((p - .54) / .25), defender, attacker,
    stage: p < .18 ? 'approach' as const : p < .26 ? 'grip' as const : p < .38 ? 'lift' as const : p < .44 ? 'plant' as const : p < .52 ? 'reverse' as const : p < 1 ? 'spin' as const : 'release' as const };
}

/** A third fighter bumps a wrestling pair; one catches their footing while the drawn loser is pushed out. */
export function arenaShoveTargets(round: ArenaRound, elapsed: number, center: ArenaPoint) {
  const p = clamp((elapsed - round.start) / Math.max(1, round.impact - round.start));
  const side = center.x >= 500 ? 1 : -1;
  const rim = 500 + side * 303 * Math.sqrt(Math.max(0, 1 - ((center.y - 416) / 112) ** 2));
  const approach = ease((p - .18) / .40), pressure = ease((p - .62) / .38);
  const victimX = mix(center.x + side * 26, rim - side * 3, pressure);
  return { side, pressure, stage: p < .18 ? 'wrestle' as const : p < .58 ? 'approach' as const : p < .76 ? 'contact' as const : 'push' as const,
    aggressor: { x: mix(center.x - side * 91, victimX - side * 53, approach), y: center.y + mix(47, 10, approach) },
    victim: { x: victimX, y: center.y },
    helper: { x: mix(center.x - side * 26, victimX - side * 80, pressure), y: center.y - mix(8, 35, pressure) } };
}

export function arenaExitDirection(round: ArenaRound, origin: ArenaPoint, outIndex: number): number {
  return round.tactic === 'bait' || round.tactic === 'edge' || round.tactic === 'shove' || round.tactic === 'catch' || round.tactic === 'ram' || isArenaFinalTechnique(round) ? origin.x < 500 ? -1 : 1 : round.final ? 1 : outIndex % 2 ? 1 : -1;
}

/** Body contacts and commentary share an actual attack, rather than only an alliance label. */
export function arenaAction(round: ArenaRound, elapsed: number): ArenaAction {
  const beat = arenaBeat(round, elapsed), p = beat.progress, a = round.aggressor, v = round.victim, h = round.helper;
  const post = elapsed >= round.impact, release = round.exchange && post;
  const action: ArenaAction = { stage: release ? 'release' : post ? 'throw' : beat.stage === 'approach' ? 'approach' : beat.stage === 'hold' ? 'link' : 'lift', actors: [], attackers: [a], targetId: v, allies: [], liftedId: v, lift: beat.liftProgress * (round.exchange ? 18 : ARENA_LIFT_HEIGHT), outcome: release ? 'resisted' : elapsed >= round.resolve ? 'success' : 'pending', betrayed: false };
  const actor = (id: string, role: ArenaActionActor['role'], x: number, y: number, pose: ArenaActionPose, phase: number, gripId: string | undefined, badge: string) => ({ id, role, offset: { x, y }, pose, phase, gripId, badge });
  const phase = p >= .52 ? beat.liftProgress : clamp((p - .30) / .22);
  if (isArenaFinalTechnique(round)) {
    const technique = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
    const linked = !!technique.grip;
    action.stage = technique.stage === 'approach' || technique.stage === 'reset' ? 'approach' : linked ? 'link' : post ? 'throw' : 'counter';
    action.lift = technique.lift; action.liftedId = technique.lift > 0 ? v : undefined;
    const ap: ArenaActionPose = technique.stage === 'probe' ? 'push' : technique.stage === 'reset' ? 'guard' : round.tactic === 'armspin' ? technique.stage === 'pivot' ? 'grapple' : post ? 'throw' : 'grapple' : round.tactic === 'trip' ? technique.stage === 'hook' ? 'trip' : post ? 'guard' : 'push' : round.tactic === 'suplex' ? post ? 'drag' : technique.stage === 'lift' || technique.stage === 'arch' ? 'suplex' : 'grapple' : technique.stage === 'first-kick' || technique.stage === 'second-kick' || technique.stage === 'impact' ? 'sidekick' : 'guard';
    const vp: ArenaActionPose = technique.stage === 'reset' ? 'dodge' : technique.stage === 'stunned' || round.tactic === 'suplex' && post ? 'stunned' : 'brace';
    action.actors = [
      { ...actor(a, 'aggressor', technique.aggressor.x - 500, technique.aggressor.y - 416, ap, technique.phase, linked ? v : undefined, '최종 기술'), turn: technique.yaw },
      actor(v, 'victim', technique.victim.x - 500, technique.victim.y - 416, vp, technique.phase, linked ? a : undefined, '기술에 대응'),
    ];
  } else if (round.tactic === 'shove' && h) {
    const shove = arenaShoveTargets(round, elapsed, { x: 675, y: 430 });
    action.stage = release ? 'release' : post ? 'throw' : shove.stage === 'wrestle' ? 'link' : shove.stage === 'approach' ? 'approach' : 'joint-attack';
    action.lift = 0; action.liftedId = undefined;
    action.actors = [actor(a, 'aggressor', -91, 47, p < .58 ? 'guard' : 'push', shove.pressure, p < .58 ? undefined : v, '옆에서 밀기'), actor(v, 'victim', 26, 0, 'brace', shove.pressure, p < .62 ? h : a, '맞잡다가 밀림'), actor(h, 'helper', -26, -8, p < .62 ? 'grapple' : 'dodge', shove.pressure, p < .62 ? v : undefined, '발 고쳐 딛기')];
  } else if (round.tactic === 'ram') {
    const ram = arenaRamTargets(round, elapsed, { x: 500, y: 416 });
    action.stage = release ? 'release' : post ? 'throw' : ram.stage === 'contact' ? 'counter' : 'approach';
    action.lift = ram.impact * (round.exchange ? 12 : 26); action.liftedId = ram.impact > 0 ? v : undefined;
    action.actors = [actor(a, 'aggressor', ram.driver.x - 500, 0, p < .32 ? 'brace' : post ? 'brace' : 'run', ram.charge, undefined, '어깨로 돌진'), actor(v, 'victim', 24 + ram.impact * 18, ram.impact * 3, 'brace', ram.impact, undefined, ram.stage === 'contact' || post ? '충돌에 튀어오름' : '돌진을 막는 선수')];
  } else if (round.tactic === 'spin') {
    const spin = arenaSpinTargets(round, elapsed, { x: 500, y: 416 }), reversed = p >= .44;
    action.stage = release ? 'release' : post ? 'throw' : p < .18 ? 'approach' : p < .26 ? 'link' : p < .44 ? 'resist' : 'counter';
    action.attackers = reversed ? [a] : [v]; action.targetId = reversed ? v : a; action.liftedId = action.targetId;
    action.lift = reversed ? spin.counterLift * (round.exchange ? 18 : ARENA_LIFT_HEIGHT) : spin.lift * 16;
    action.actors = [
      { ...actor(a, 'aggressor', -22, 0, p < .18 ? 'guard' : p < .44 ? 'brace' : p < .54 ? 'grapple' : 'lift', reversed ? spin.counterLift : spin.lift, p >= .18 ? v : undefined, reversed ? '한 바퀴 되치기' : '들기를 버티는 선수'), turn: spin.angle },
      { ...actor(v, 'victim', 26, 0, p < .18 ? 'guard' : p < .44 ? 'lift' : 'brace', reversed ? spin.counterLift : spin.lift, p >= .18 ? a : undefined, reversed ? '역으로 잡힌 선수' : '먼저 들어 올리기'), turn: spin.angle },
    ];
  } else if (round.tactic === 'catch') {
    const catchState = arenaCatchTargets(round, elapsed, { x: 675, y: 430 });
    const caught = p >= .55;
    action.stage = release ? 'release' : post ? 'throw' : catchState.stage === 'prepare' || catchState.stage === 'charge' ? 'approach' : catchState.stage === 'catch' ? 'link' : 'lift';
    action.lift = ease((p - .72) / .28) * (round.exchange ? 14 : ARENA_LIFT_HEIGHT);
    action.actors = [actor(a, 'aggressor', 26, 0, !caught ? 'brace' : p < .72 ? 'grapple' : 'lift', ease((p - .72) / .28), caught ? v : undefined, '돌진 받아 되치기'), actor(v, 'victim', -92 + catchState.charge * 68, 0, catchState.stage === 'prepare' ? 'brace' : caught ? 'brace' : 'run', catchState.charge, caught ? a : undefined, caught ? '몸통이 잡혔다' : '돌진')];
  } else if (round.tactic === 'team' && h) {
    action.stage = release ? 'release' : post ? 'throw' : p < .30 ? 'approach' : p < .52 ? 'link' : 'joint-attack';
    action.attackers = [a, h]; action.allies = [a, h];
    action.actors = [actor(a, 'aggressor', -44, 0, p >= .52 ? 'lift' : 'grapple', phase, v, '함께 공격'), actor(v, 'victim', 0, 0, 'brace', phase, a, release ? '공격 버팀' : '양쪽에 대응'), actor(h, 'helper', 44, 0, p >= .52 ? 'lift' : 'grapple', phase, v, '함께 공격')];
  } else if (round.tactic === 'betrayal' && h) {
    const attack = ease((p - .34) / .24), resist = ease((p - .64) / .12), broken = p >= .76;
    const counter = ease((p - .84) / .16);
    action.stage = release ? 'release' : post ? 'throw' : p < .22 ? 'approach' : p < .34 ? 'link' : p < .64 ? 'joint-attack' : p < .76 ? 'resist' : p < .84 ? 'betrayal' : 'counter';
    action.betrayed = broken; action.allies = [v, h]; action.attackers = broken ? [a] : [v, h]; action.targetId = broken ? v : a;
    action.liftedId = broken ? v : a;
    // The alliance first raises its opponent. That opponent plants a foot and
    // resists before the helper lets go; the counter is an observable new action.
    action.lift = broken ? counter * (round.exchange ? 18 : ARENA_LIFT_HEIGHT) : attack * (1 - resist) * 20;
    action.outcome = release ? 'resisted' : broken ? 'betrayed' : action.stage === 'resist' ? 'resisted' : 'pending';
    action.actors = [
      actor(a, 'aggressor', 0, 0, broken ? p >= .84 ? 'lift' : 'grapple' : 'brace', broken ? counter : resist, v, broken ? '앞에서 역습' : '공동공격 버팀'),
      actor(v, 'victim', -44, 0, broken ? 'brace' : p >= .34 ? 'lift' : 'grapple', broken ? counter : attack, a, broken ? '혼자 대응' : '동맹 공격'),
      actor(h, 'helper', 44 + ease((p - .76) / .15) * 26, ease((p - .76) / .15) * 22, broken ? 'dodge' : p >= .34 ? 'lift' : 'grapple', attack, broken ? undefined : a, broken ? '손 놓음' : '동맹 공격'),
    ];
  } else {
    let ax = -25, ay = 0, vx = 25, vy = 0;
    let ap: ArenaActionPose = p < .30 ? 'guard' : 'grapple', vp: ArenaActionPose = 'brace';
    if (round.tactic === 'bait') {
      const charge = arenaChargeState(round, elapsed);
      ax = -30 - charge.dodge * 23; ay = charge.dodge * 43; vx = 102 - charge.charge * 188;
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
  else if (post && !isArenaFinalTechnique(round)) action.actors.forEach(part => { if (part.id !== v) { part.pose = round.tactic === 'ram' ? 'brace' : round.tactic === 'bait' ? 'dodge' : round.tactic === 'edge' || round.tactic === 'shove' ? part.id === h ? 'dodge' : 'push' : elapsed - round.impact < 350 * (round.resolve - round.impact) / 1100 ? 'throw' : 'guard'; part.gripId = undefined; } });
  if (post && round.tactic === 'spin') action.actors.forEach(part => { part.gripId = undefined; });
  if (action.stage === 'approach' && round.tactic !== 'catch' && round.tactic !== 'shove' && round.tactic !== 'ram') action.actors.forEach(part => { if (round.tactic !== 'bait' || part.pose !== 'brace') part.pose = 'guard'; part.gripId = undefined; });
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
export function arenaPodium(order: string[], duration = 44_000): ArenaPodiumPlace[] {
  const places = [{ x: 500, y: 443 }, { x: 350, y: 470 }, { x: 650, y: 488 }];
  const final = arenaRounds(order, duration).at(-1), unit = duration / 44_000;
  const ready = final ? [final.resolve, final.tactic === 'suplex' ? final.resolve + 650 * unit : final.impact + 2100 * unit, final.resolve + 650 * unit] : [0, 0, 0];
  return order.slice(0, 3).map((id, index) => ({ id, rank: (index + 1) as 1 | 2 | 3, readyAt: ready[index], ...places[index] }));
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

/** A renewed bout stays where the pair already met, with only a small step around another bout. */
export function arenaLocalContact(origin: ArenaPoint, occupied: readonly ArenaPoint[]): ArenaPoint {
  const inside = (point: ArenaPoint) => {
    const radius = Math.hypot((point.x - 500) / 240, (point.y - 416) / 73);
    return radius > 1 ? { x: 500 + (point.x - 500) / radius, y: 416 + (point.y - 416) / radius } : point;
  };
  const anchor = inside({ ...origin });
  const clearance = (point: ArenaPoint) => Math.min(Infinity, ...occupied.map(other => Math.hypot((point.x - other.x) / 108, (point.y - other.y) / 63)));
  if (clearance(anchor) >= 1) return anchor;
  const options = [anchor, ...[-1, 1].flatMap(side => [{ x: anchor.x + side * 42, y: anchor.y }, { x: anchor.x, y: anchor.y + side * 22 }])].map(inside);
  return options.sort((a, b) => clearance(b) - clearance(a))[0];
}

export function arenaApproachSpeed(distance: number): number {
  return 86 + Math.min(36, Math.max(0, distance - 65) * .18);
}

export function arenaRimDistance(origin: ArenaPoint): number {
  const radius = 303 * Math.sqrt(Math.max(0, 1 - ((origin.y - 416) / 112) ** 2));
  return Math.max(0, radius - Math.abs(origin.x - 500));
}

/** The actual encounter chooses its finish; a central pair never walks to a prescribed rim. */
export function arenaContactRound(round: ArenaRound, center: ArenaPoint): ArenaRound {
  if (round.exchange || arenaRimDistance(center) <= 112) return round;
  const tactic = round.tactic === 'bait' || round.tactic === 'shove' ? 'catch' : round.tactic === 'edge' ? 'brace' : round.tactic;
  return tactic === round.tactic ? round : { ...round, tactic, helper: undefined };
}

export function arenaReleaseTarget(origin: ArenaPoint, center: ArenaPoint, role: ArenaActionActor['role'], progress: number): ArenaPoint {
  const amount = ease(progress), away = origin.x >= center.x ? 1 : -1;
  return { x: origin.x + away * amount * 22, y: origin.y + (role === 'victim' ? -1 : 1) * amount * 10 };
}

/** Ranking is supplied by the uniform draw; choreography never redraws a result. */
export function arenaRounds(order: string[], duration = 44_000): ArenaRound[] {
  if (order.length < 2) return [];
  const unit = duration / 44;
  const preliminaries = order.length - 2;
  const spacing = 30.6 * unit / Math.max(1, preliminaries);
  const seed = order.join('|').split('').reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0);
  // A single surprise alliance can occur in a large field. Most eliminations
  // are one-on-one, and short matches never force an alliance into the story.
  // Mix the bonus roll separately: equal-length ids can share the original hash's low bits.
  const surprise = Math.imul(seed ^ seed >>> 16, 0x45d9f3b) >>> 0;
  const bonusAlliance = ((surprise ^ surprise >>> 16) >>> 0) % 16 === 0;
  const allianceAt = preliminaries >= 5 && (seed % 3 === 0 || bonusAlliance) ? 1 + seed % (preliminaries - 2) : -1;
  const rounds = Array.from({ length: preliminaries }, (_, index): ArenaRound => {
    const living = order.slice(0, order.length - index);
    const victim = living.at(-1)!;
    const pool = living.filter(id => id !== victim);
    const aggressor = pool[(seed + index * 7 + index * index) % pool.length];
    const helpers = pool.filter(id => id !== aggressor);
    const possibleHelper = helpers.length ? helpers[((seed >>> 5) + index * 3) % helpers.length] : undefined;
    const planned = eliminationTactics[(seed + index) % eliminationTactics.length];
    const tactic = possibleHelper && index === allianceAt ? (seed % 2 ? 'team' : 'betrayal') : planned === 'shove' && !possibleHelper ? 'edge' : planned === 'lift' && ((seed >>> 3) + index) % 5 === 0 ? 'spin' : planned === 'counter' && ((seed >>> 7) + index) % 6 === 1 ? 'ram' : planned;
    const span = Math.min(5 * unit, spacing);
    const start = 2.6 * unit + (index + 1) * spacing - span;
    const impact = start + span - 1.55 * unit;
    return { id: `arena-${index}`, index, tactic, aggressor, helper: tactic === 'team' || tactic === 'betrayal' || tactic === 'shove' ? possibleHelper : undefined, victim, start, impact, resolve: impact + 1.1 * unit, end: start + span, final: false };
  });
  const finishSeed = ((seed >>> 4) ^ seed) >>> 0;
  const mixedTechnique = Math.imul(seed ^ seed >>> 16, 0x7feb352d) >>> 0;
  const techniqueRoll = Math.imul(mixedTechnique ^ mixedTechnique >>> 15, 0x846ca68b) >>> 0;
  const finalTactic = finishSeed % 11 === 8 ? 'spin' : finishSeed % 13 === 6 ? 'ram' : finishSeed % 12 < 4 ? arenaFinalTechniques[(techniqueRoll ^ techniqueRoll >>> 16) & 3] : finishSeed % 5 === 1 || finishSeed % 5 === 2 ? 'catch' : order.length <= 4 ? seed % 3 === 1 ? 'bait' : seed % 3 === 2 ? 'edge' : 'final' : 'final';
  rounds.push({ id: 'arena-final', index: preliminaries, tactic: finalTactic, aggressor: order[0], victim: order[1], start: 33.2 * unit, impact: (finalTactic === 'suplex' ? 35.3 : 38.2) * unit, resolve: 39.3 * unit, end: duration, final: true });
  return rounds;
}

export function arenaRanks(order: string[], elapsed: number, duration = 44_000): Record<string, number> {
  const ranks: Record<string, number> = {};
  for (const round of arenaRounds(order, duration)) if (elapsed >= round.resolve) {
    ranks[round.victim] = order.indexOf(round.victim) + 1;
    if (round.final) ranks[round.aggressor] = 1;
  }
  return ranks;
}

/** Non-eliminating exchanges keep two- and three-person games active between exits. */
export function arenaExchange(order: string[], elapsed: number, duration = 44_000, reserved: readonly string[] = []): ArenaRound | undefined {
  const ranks = arenaRanks(order, elapsed, duration);
  const living = order.filter(id => !ranks[id] && !reserved.includes(id));
  if (living.length < 2) return undefined;
  const unit = duration / 44;
  const span = 4.8 * unit;
  const epoch = Math.floor(elapsed / span);
  const aggressor = living[0];
  const victim = living[1];
  const tactic = soloTactics[epoch % soloTactics.length];
  return { id: `exchange-${epoch}-${living.join('-')}`, index: epoch, tactic, aggressor, victim, start: epoch * span, impact: epoch * span + 3.2 * unit, resolve: Infinity, end: (epoch + 1) * span, final: false, exchange: true };
}

/** Commentary and the canvas reserve the same next opponents for a physical approach. */
export function arenaFocusRound(order: string[], elapsed: number, duration = 44_000): ArenaRound | undefined {
  const rounds = arenaRounds(order, duration), current = rounds.find(round => elapsed >= round.start && elapsed < round.end);
  if (current) return current;
  const upcoming = rounds.find(round => round.start > elapsed && round.start - elapsed < 2400 * duration / 44_000);
  const reserved = upcoming ? [upcoming.aggressor, upcoming.victim, upcoming.helper].filter((id): id is string => !!id) : [];
  return arenaExchange(order, elapsed, duration, reserved) ?? upcoming;
}

/** Background bouts choose a nearby available opponent and never eliminate anyone. */
export function arenaMiniExchanges(available: readonly (ArenaPoint & { id: string })[], elapsed: number, duration = 44_000): ArenaRound[] {
  const pending = [...available], rounds: ArenaRound[] = [], unit = duration / 44_000;
  const hash = (id: string) => id.split('').reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  pending.sort((a, b) => hash(a.id) - hash(b.id));
  while (pending.length > 1) {
    const a = pending.shift()!;
    let nearest = 0;
    for (let index = 1; index < pending.length; index++) if (Math.hypot(pending[index].x - a.x, pending[index].y - a.y) < Math.hypot(pending[nearest].x - a.x, pending[nearest].y - a.y)) nearest = index;
    const [v] = pending.splice(nearest, 1), seed = hash(a.id + v.id) + Math.floor(elapsed / 800);
    const start = elapsed + (rounds.length * 270 + seed % 150) * unit;
    const tactic = (['brace', 'counter', 'bait'] as ArenaTactic[])[seed % 3];
    rounds.push({ id: 'mini-' + Math.round(elapsed) + '-' + a.id + '-' + v.id, index: seed, tactic, aggressor: a.id, victim: v.id, start, impact: start + 3200 * unit, resolve: Infinity, end: start + 4800 * unit, final: false, exchange: true });
  }
  return rounds;
}

/** The first 40 ms holds the contact. Flight and ground recovery remain separate. */
export function arenaThrow(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1, preparation: { lift: number; angle: number; rotation?: number } = { lift: 0, angle: 0 }): ArenaThrowFrame {
  const ms = age / Math.max(0.001, unit);
  const rotation = preparation.rotation ?? -direction;
  if (ms < 40) return { x: origin.x, y: origin.y - preparation.lift, groundX: origin.x, groundY: origin.y, height: preparation.lift, angle: preparation.angle, phase: clamp(ms / 40), stage: 'hold' };
  if (ms < 880) {
    const p = clamp((ms - 40) / 840);
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
  const action = arenaAction(round, elapsed);
  if (round.tactic === 'betrayal' && elapsed < round.resolve) {
    const details: Partial<Record<ArenaActionStage, string>> = {
      approach: `${v} · ${h}, 동맹을 맺고 ${a}의 양쪽으로 접근합니다.`,
      link: `${v} · ${h}, 같은 상대를 양쪽에서 잡고 함께 공격할 준비를 합니다.`,
      'joint-attack': `${v} · ${h}, ${a}를 함께 밀고 들어 올립니다.`,
      resist: `${a}, 발을 다시 딛고 버텼습니다. 동맹의 공동공격이 막혔습니다.`,
      betrayal: `${h}, 손을 놓고 물러납니다. 함께 공격하던 ${v}가 혼자 남았습니다.`,
      counter: `${a}, 앞에서 ${v}를 다시 붙잡아 되칩니다.`,
      throw: `${a}, 공동공격을 버틴 뒤 역습했습니다. ${v}가 장외로 넘어갑니다.`,
      release: `${v}, 배신 뒤의 역습을 버텨냈습니다. 모두 모래판을 지켰습니다.`,
    };
    return { title: action.stage === 'joint-attack' ? '동맹의 공동공격!' : action.stage === 'resist' ? '버텼다! 동맹 공격이 막혔다' : action.betrayed ? round.exchange && elapsed >= round.impact ? '배신 뒤의 역습도 버텨냈다' : '공동공격 뒤 배신 · 앞에서 역습' : '동맹 결성 · 함께 공격 준비', detail: details[action.stage] ?? '' };
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
    return { title: state.stage === 'prepare' ? '몸을 낮추고 돌진을 기다린다' : state.stage === 'charge' ? '달려든다! 두 팔로 받아낸다' : state.stage === 'catch' ? '붙잡았다! 발을 바꿔 힘을 돌린다' : '돌진의 힘으로 되치기!', detail: state.stage === 'prepare' || state.stage === 'charge' ? `${v}가 몸을 숙이고 돌진합니다. ${a}는 두 팔을 내밀고 중심을 낮춥니다.` : `${a}가 ${v}의 몸통을 붙잡았습니다. 뒤로 한 발 디뎌 충격을 받아낸 뒤, 골반을 돌려 들어 날립니다.` };
  }
  if (round.tactic === 'spin' && elapsed < round.resolve) {
    const spin = arenaSpinTargets(round, elapsed, { x: 500, y: 416 });
    return { title: spin.stage === 'approach' || spin.stage === 'grip' ? '몸통을 잡았다 · 먼저 들어 올린다' : spin.stage === 'lift' || spin.stage === 'plant' ? '들렸다! 발을 내려 버틴다' : spin.stage === 'reverse' ? '손을 바꿔 잡았다 · 역으로 되치기' : '한 바퀴 돌려 장외로!', detail: spin.stage === 'approach' || spin.stage === 'grip' || spin.stage === 'lift' || spin.stage === 'plant' ? `${v}가 ${a}를 들어 올립니다. ${a}는 손을 놓지 않고 한 발을 모래판에 내려 중심을 되찾습니다.` : `${a}가 몸통을 다시 잡고 발을 바꿔 디딥니다. 발을 바꿔 디디며 한 바퀴 돌린 뒤 ${v}를 놓아 장외로 날립니다.` };
  }
  if (round.tactic === 'ram' && elapsed < round.resolve) {
    const ram = arenaRamTargets(round, elapsed, { x: 500, y: 416 });
    return { title: ram.stage === 'prepare' ? '몸을 낮춘다 · 정면 돌진 준비' : ram.stage === 'charge' ? '어깨를 앞으로! 밀고 들어간다' : '정면 충돌! 상대가 튀어올랐다', detail: ram.stage === 'prepare' ? `${a}가 앞발에 체중을 싣고 ${v}의 빈틈을 노립니다.` : ram.stage === 'charge' ? `${a}가 땅을 박차고 가속합니다. ${v}는 발을 딛고 앞에서 막아섭니다.` : `${a}의 어깨가 ${v}의 몸통에 부딪쳤습니다! ${v}의 두 발이 모래판을 떠나 장외로 날아갑니다.` };
  }
  if (round.tactic === 'shove' && elapsed < round.resolve) {
    const shove = arenaShoveTargets(round, elapsed, { x: 675, y: 430 });
    const detail = elapsed >= round.impact ? `${h}가 손을 놓고 발을 고쳐 딛었습니다. ${v}는 경계 아래로 밀려 떨어집니다.` : shove.stage === 'wrestle' || shove.stage === 'approach' ? `${v} · ${h}가 손을 잡고 싸웁니다. ${a}는 둘의 옆으로 접근하며 빈틈을 살핍니다.` : shove.stage === 'contact' ? `${a}가 어깨와 두 손으로 밀었습니다! ${v} · ${h}의 중심이 함께 흔들립니다.` : `${a}가 발을 딛고 밀어붙입니다. ${h}는 손을 풀고 중심을 잡고, ${v}는 한 발씩 경계로 밀립니다.`;
    return { title: shove.stage === 'wrestle' ? '맞잡은 두 선수 · 옆에서 빈틈을 본다' : shove.stage === 'approach' ? '몸싸움 틈으로 다가온다' : shove.stage === 'contact' ? '옆에서 밀었다! 중심이 흔들린다' : elapsed >= round.impact ? '한 명은 버텼다! 다른 한 명은 장외' : '발을 고쳐 딛는다! 경계가 가깝다', detail };
  }
  if (round.exchange && elapsed >= round.impact) return { title: '버텼다! 다시 빈틈을 살핍니다', detail: `${a} · ${v}, 모두 모래판을 지켰습니다. 손을 풀고 다음 빈틈을 봅니다.` };
  if (elapsed >= round.resolve) return { title: round.final ? `${a}, 오늘의 장사!` : `장외! ${v} · ${order.indexOf(round.victim) + 1}위 확정`, detail: round.final ? `${round.tactic === 'bait' ? '마지막 돌진을 피했습니다. 상대가 관성으로 장외에 넘어졌습니다.' : round.tactic === 'edge' ? '끝까지 버티던 상대를 경계 밖으로 밀어냈습니다.' : '버티던 마지막 상대를 뒤집었습니다.'} ${order.length >= 3 ? '1·2·3위 선수들이' : '1·2위 선수들이'} 시상대에서 인사합니다.` : `${v}, 모래판 밖에 착지했습니다. 나머지 선수들의 난투는 계속됩니다.` };
  const titles: Record<ArenaTactic, string> = { team: '협공 · 한 명은 길을 막고, 한 명은 민다', bait: '미끼 · 돌진을 기다렸다가 옆으로 피한다', catch: '돌진을 받아 잡고 되치기', ram: '어깨로 돌진해 상대를 날리기', spin: '들기를 버티고 한 바퀴 되치기', shove: '몸싸움에 끼어 어깨로 밀기', edge: '가장자리 승부 · 발을 딛고 밀어낸다', counter: '역습 · 밀리던 쪽이 중심을 낮춘다', betrayal: '배신 · 등을 맡긴 순간 방향을 바꾼다', brace: '버티기 · 발을 박고 힘을 되돌린다', lift: '들배지기 · 체중을 싣고 들어 올린다', final: '마지막 두 명 · 최후의 버티기', armspin: '팔 잡고 회전 던지기', trip: '발목 걸기 · 굴려 장외로', suplex: '수플렉스 · 기절한 상대 끌기', sidekick: '이단 옆차기 · 발끝 충돌' };
  const details: Record<ArenaTactic, string> = {
    team: `${h}, ${v}의 퇴로를 막습니다. ${a}, 앞에서 함께 밀어냅니다.`,
    bait: `${a}, 틈을 보입니다. ${v}의 돌진을 옆으로 피해 관성을 이용합니다.`,
    catch: `${a}, ${v}의 돌진을 두 팔로 받아냅니다. 몸통을 놓지 않고 발을 돌려 되칩니다.`,
    ram: `${a}, 무게를 낮추고 정면으로 돌진합니다. 어깨가 부딪치며 ${v}가 장외로 날아갑니다.`,
    spin: `${v}가 먼저 들어 올립니다. ${a}는 발을 내려 버틴 뒤 상대를 붙잡고 한 바퀴 돌려 되칩니다.`,
    shove: `${a}, 싸우던 ${v} · ${h}의 옆으로 끼어들어 어깨를 밀어냅니다.`,
    edge: `${a}, 경계 가까이에서 손을 맞잡고 밀어붙입니다. ${v}는 발을 바꿔 딛으며 끝에서 버팁니다.`,
    counter: `${a}, 낮게 파고들어 샅바를 잡습니다. ${v}의 밀기를 되칩니다.`,
    betrayal: `${v} · ${h}, 공동공격 뒤 ${h}가 손을 놓습니다. ${a}가 앞에서 역습합니다.`,
    brace: `${a}, ${v}의 밀기를 두 발로 버텨냅니다. 힘을 반대로 돌립니다.`,
    lift: `${a}, ${v}의 몸통을 잡습니다. 무릎을 굽혀 체중을 싣고 들어 올립니다.`,
    final: `${a} · ${v}, 팽팽한 힘겨루기. 한 번의 중심 이동이 승부를 가릅니다.`,
    armspin: `${a}가 ${v}의 손목을 잡습니다. 발을 바꿔 디디며 회전해 손을 놓아 날립니다.`,
    trip: `${a}가 몸을 맞잡고 ${v}의 발목을 겁니다. 넘어진 상대를 굴려 장외로 보냅니다.`,
    suplex: `${a}가 허리를 잡아 뒤로 넘깁니다. 기절한 ${v}의 발목을 잡고 경계 밖으로 끕니다.`,
    sidekick: `${a}가 첫 차기로 거리를 재고 도약합니다. 두 번째 옆차기가 ${v}의 몸통에 닿아 장외로 날립니다.`,
  };
  return { title: elapsed >= round.impact ? `${titles[round.tactic]} · 중심이 무너졌다!` : titles[round.tactic], detail: details[round.tactic] };
}
