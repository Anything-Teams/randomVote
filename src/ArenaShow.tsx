import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Candidate } from './election';
import type { SportsStageProps } from './sports';
import { arenaAction, arenaActionWords, arenaApproachSpeed, arenaCatchTargets, arenaChargeFall, arenaChargeTargets, arenaContactRound, arenaDoubleShoveTargets, arenaEliminatedIds, arenaFaceOpponent, arenaInsidePoint, arenaLocalContact, arenaEdgeFall, arenaEdgeTargets, arenaExitDirection, arenaGuardTarget, arenaMiniExchanges, arenaMove as move, arenaNarration, arenaNearbyResponse, arenaPodium, arenaRamTargets, arenaReleaseTarget, arenaRoamingTarget, arenaRounds, arenaShoveTargets, arenaSpinTargets, arenaStartingPoint, arenaThrow, type ArenaPoint, type ArenaPodiumPlace, type ArenaRoamingStage, type ArenaRound } from './arenaLogic';
import { arenaCarryHolderPoint, arenaDrawOrder, arenaReleaseSnapshot, arenaSpinGripPair, arenaSpinSnapshot, arenaWristGripPoint, createArenaFighterAnimation, drawArenaFighter as paintArenaFighter, drawArenaName, sampleArenaFighterContacts, type ArenaActor, type ArenaFighterAnimation, type ArenaPose, type ArenaSpinSnapshot } from './game/ArenaFighter';
import { drawArenaScenery } from './game/arenaArt';
import ArenaStory from './ArenaStory';
import { arenaTechniqueTargets, arenaTechniqueExit, arenaTechniqueReactionAt, arenaFloorExitTiming, isArenaFloorDrag, isArenaFinalTechnique } from './arenaTechniques';
import { ARENA_PAIR_COUNTER_TIMING, ARENA_PAIR_THROW_UPWARD, ARENA_PAIR_THROW_FOLLOW_THROUGH, ARENA_PAIR_PUSH_SPEED, arenaPairPushFlight, arenaPairRushFlight, arenaPairRushTargets, type ArenaPairCarryOrigins } from './arenaPairRush';
import { arenaEscapeTargets } from './arenaEscape';
import { arenaRecoveryTargets } from './arenaRecovery';
import { arenaAnklePickup } from './arenaPickup';
import { arenaRimTargets } from './arenaRimEvent';
import { arenaRimChargeTargets, type ArenaRimChargeOrigins } from './arenaRimCharge';
import { arenaPairDodgeTargets, arenaPairDodgeCanExit, type ArenaPairDodgeOrigins } from './arenaPairDodge';
import { arenaPassingTripTargets, arenaPassingTripAnkleHolder, type ArenaPassingTripOrigins } from './arenaPassingTrip';
import { arenaSlideTripTargets, type ArenaSlideTripOrigins } from './arenaSlideTrip';
import { arenaLinkedRushTargets, type ArenaLinkedRushOrigins } from './arenaLinkedRush';
import { arenaSupermanPunchTargets, type ArenaSupermanPunchOrigins } from './arenaSupermanPunch';
import { ARENA_KICK_CATCH_TIMING, arenaKickCatchTargets, type ArenaKickCatchOrigins } from './arenaKickCatch';
import { arenaAnkleRimThrowTargets, arenaWrestlingMoveTargets, type ArenaWrestlingMoveOrigins } from './arenaWrestlingMoves';
import { arenaAnkleSwingBasis, arenaAnkleSwingProjection } from './arenaAnkleSwing';
import { arenaAnkleRimFlightSnapshot } from './arenaAnkleRimFlight';
import { createArenaCamera, sampleArenaCamera, type ArenaCamera } from './arenaCamera';
import { presentArenaCanvasFrame } from './arenaCanvasFrame';
import './arena.css';

type Body = ArenaPoint & { gait: number; facing: number; vx: number; vy: number; motorX?: number; motorY?: number; restUntil?: number; separatedFrom?: string; animation?: ArenaFighterAnimation; roam?: { key: string; origin: ArenaPoint; target: ArenaPoint; neighborId?: string } };
type Contact = { center: ArenaPoint; side: number; round: ArenaRound; started?: boolean; metAt?: number; committed?: boolean; chargerOrigin?: ArenaPoint; pairDodgeOrigins?: ArenaPairDodgeOrigins; supermanPunchOrigins?: ArenaSupermanPunchOrigins; kickCatchOrigins?: ArenaKickCatchOrigins; wrestlingMoveOrigins?: ArenaWrestlingMoveOrigins; wrestlingHeadOffset?: ArenaPoint; wrestlingCradleOffset?: ArenaPoint; wrestlingSpinSample?: { at: number; waist: ArenaPoint }; slideTripOrigins?: ArenaSlideTripOrigins; linkedRushOrigins?: ArenaLinkedRushOrigins; pairCarryOrigins?: ArenaPairCarryOrigins; linkedRelease?: { at: number; hands: [ArenaPoint, ArenaPoint]; roots: [ArenaPoint, ArenaPoint]; arms: [0 | 1, 0 | 1]; facings: [number, number] }; pairReachAt?: Map<string, number>; pairGripMap?: Map<string, [number, number]>; pairArmRelease?: Map<string, { hands: [ArenaPoint, ArenaPoint]; elbows: [ArenaPoint, ArenaPoint]; shoulders: [ArenaPoint, ArenaPoint]; root: ArenaPoint; facing: number; stance?: NonNullable<ArenaActor['carrierRelease']>['stance'] }>; pairDodgeFinished?: boolean; passingTripOrigins?: ArenaPassingTripOrigins; passingTripDeclined?: boolean; escapeFinished?: boolean; recoveryFinished?: boolean; recoveryRelease?: { thrower: ArenaPoint; receiver: ArenaPoint; height: number; snapshot?: ArenaSpinSnapshot }; rimFinished?: boolean; rimOrigins?: { aggressor: ArenaPoint; victim: ArenaPoint }; rimChargeOrigins?: ArenaRimChargeOrigins; rimChargeFinished?: boolean; sidekickLaunched?: boolean; elbowFall?: ArenaPoint; elbowApproachOrigin?: ArenaPoint; releases?: Map<string, ArenaPoint> };
type Exit = { floorThrow?: { driver: ArenaPoint; ankles: [ArenaPoint, ArenaPoint]; orbit: number; facing: 1 | -1 }; floorArms?: { hands: [ArenaPoint, ArenaPoint]; elbows: [ArenaPoint, ArenaPoint]; shoulders: [ArenaPoint, ArenaPoint]; root: ArenaPoint; stance?: NonNullable<ArenaActor['carrierRelease']>['stance'] }; round: ArenaRound; origin: ArenaPoint; landing: ArenaPoint; side: number; bench: ArenaPoint; lift: number; angle: number; velocity: number; heldFacing?: number; launchedAt?: number; dodgeFall?: { center: ArenaPoint; origins: ArenaPairDodgeOrigins }; dragOffset?: ArenaPoint; driverStop?: ArenaPoint; pushRelease?: { hands: [ArenaPoint, ArenaPoint]; elbows: [ArenaPoint, ArenaPoint]; shoulders: [ArenaPoint, ArenaPoint]; root: ArenaPoint; angle: number; lean: number }; spinSnapshot?: ArenaSpinSnapshot; spinFlight?: { velocity: ArenaPoint; angularVelocity: number; center: ArenaPoint; planarOrbit?: number; duration: number; gravity: number } };
type Simulation = { key: string; elapsed: number; epoch: number; camera: ArenaCamera; bodies: Map<string, Body>; contacts: Map<string, Contact>; exits: Map<string, Exit>; minis: Map<string, ArenaRound> };
type ChoreographedActor = ArenaActor & { rearExitCutoff?: number };
const W = 1000, H = 620;
const clamp = (p: number, low = 0, high = 1) => Math.max(low, Math.min(high, p));
const ease = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };

/** A rear rim fall disappears behind the sand ledge, rather than falling onto it. */
function drawArenaFighter(ctx: CanvasRenderingContext2D, actor: ChoreographedActor, clock: number) {
  if (actor.rearExitCutoff === undefined) { paintArenaFighter(ctx, actor, clock); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, actor.rearExitCutoff); ctx.clip();
  paintArenaFighter(ctx, actor, clock); ctx.restore();
}

function validOrder(candidates: Candidate[], supplied: string[]) {
  const ids = new Set(candidates.map(candidate => candidate.id));
  const order = [...new Set(supplied)].filter(id => ids.has(id));
  return [...order, ...candidates.map(candidate => candidate.id).filter(id => !order.includes(id))];
}

function sceneSignature(props: SportsStageProps) {
  return `${props.preview}:${props.duration}:${props.arenaRushRoll}:${props.arenaEscapeSeed}:${props.order.join(',')}:${props.candidates.map(candidate => candidate.id).join(',')}`;
}

function sceneParticipants(round: ArenaRound, elapsed = -Infinity) {
  if (round.recovery && elapsed < round.recovery.end) return [round.recovery.throwerId ?? round.aggressor, round.victim];
  return [round.aggressor, round.victim, round.helper, round.pairDodge && elapsed < round.pairDodge.end ? round.pairDodge.partnerId : undefined, round.passingTrip?.joined ? round.passingTrip.passerId : undefined].filter((id): id is string => !!id);
}

const sceneTimed = (round: ArenaRound) => !!round.floorFinish || !!round.rushOutcome || !!round.pairDodge || !!round.passingTrip || !!round.slideTrip || !!round.supermanPunch || !!round.kickCatch || !!round.wrestlingMove || !!round.rimPush || ['catch', 'ram'].includes(round.tactic) && round.chargeSetup?.contactAt !== undefined || round.tactic === 'elbow' && round.elbowGripAt !== undefined;

/** Later planned eliminations cannot pass an unfinished physical encounter. */
function resolvedRounds(rounds: ArenaRound[], elapsed: number): ArenaRound[] {
  const pending = rounds.findIndex(round => elapsed < round.resolve);
  return pending < 0 ? rounds : rounds.slice(0, pending);
}

/** A contact-triggered throw also resolves the scene and roster at its actual time. */
function resolvedRanks(order: string[], rounds: ArenaRound[], elapsed: number): Record<string, number> {
  const ranks: Record<string, number> = {};
  for (const round of resolvedRounds(rounds, elapsed)) {
    ranks[round.victim] = order.indexOf(round.victim) + 1;
    if (round.secondaryVictim) ranks[round.secondaryVictim] = order.indexOf(round.secondaryVictim) + 1;
    if (round.final) ranks[round.aggressor] = 1;
  }
  return ranks;
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = '#fff1d5', width = 850) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `800 ${size}px "Malgun Gothic", sans-serif`; ctx.fillStyle = color; ctx.fillText(value, x, y, width);
}

function dust(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, strength = 1) {
  if (age < 0 || age > 680) return;
  const p = age / 680;
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.399, distance = (18 + i % 5 * 11) * ease(p) * strength;
    ctx.globalAlpha = (1 - p) * .72; ctx.fillStyle = i % 3 ? '#e7c995' : '#fff2cc';
    ctx.fillRect(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * .25 - Math.sin(p * Math.PI) * 15, 5 + i % 4 * 2, 4);
  }
  ctx.globalAlpha = 1;
}

function clash(ctx: CanvasRenderingContext2D, point: ArenaPoint, age: number, strength = 1) {
  if (age < 0 || age > 320) return;
  const p = age / 320;
  ctx.save(); ctx.globalAlpha = (1 - p) ** 2;
  for (let ray = 0; ray < 10; ray++) {
    const angle = ray * Math.PI / 5, distance = (12 + p * 29) * strength;
    ctx.save(); ctx.translate(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance * .7); ctx.rotate(angle);
    ctx.fillStyle = ray % 2 ? '#fff1c8' : '#ffcd68'; ctx.fillRect(0, -2 * strength, (9 + (1 - p) * 8) * strength, 4 * strength); ctx.restore();
  }
  ctx.restore();
}

function podium(ctx: CanvasRenderingContext2D, places: ArenaPodiumPlace[], alpha: number) {
  const colors = ['#d7b258', '#afbdc4', '#ba8860'];
  ctx.save(); ctx.globalAlpha = alpha;
  for (const place of [...places].sort((a, b) => b.rank - a.rank)) {
    const left = place.x - 66, top = place.y, tone = colors[place.rank - 1];
    ctx.fillStyle = '#172a31'; ctx.fillRect(left - 3, top + 7, 138, 551 - top);
    ctx.fillStyle = tone; ctx.fillRect(left, top, 132, 7);
    ctx.fillStyle = '#32434a'; ctx.fillRect(left, top + 7, 132, 542 - top);
    ctx.fillStyle = tone; ctx.fillRect(left, top + 7, 3, 542 - top);
    ctx.fillStyle = '#ffffff25'; ctx.fillRect(left + 2, top + 1, 128, 1);
    text(ctx, `${place.rank}위`, place.x, 524, 22, tone, 100);
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, props: SportsStageProps, elapsed: number, clock: number, sim: Simulation, delta: number, reduced: boolean) {
  const order = validOrder(props.candidates, props.order);
  const signature = sceneSignature(props);
  const seek = elapsed < sim.elapsed - 150 || elapsed - sim.elapsed > 500;
  const reset = sim.key !== signature || seek;
  if (reset) { sim.key = signature; sim.epoch++; sim.bodies.clear(); sim.contacts.clear(); sim.exits.clear(); sim.minis.clear(); }
  sim.elapsed = elapsed;
  if (!reset && !props.preview) for (const contact of sim.contacts.values()) {
    const round = contact.round;
    if (round.floorFinish && round.floorFinish.releaseAt == null && elapsed >= round.impact) {
      const resolve = Math.max(round.resolve, elapsed + 2100 * (round.timeScale ?? props.duration / 44_000));
      if (resolve > round.resolve) { contact.round = { ...round, resolve, end: Math.max(round.end, resolve) }; const exit = sim.exits.get(round.victim); if (exit) exit.round = contact.round; }
      continue;
    }
    if (round.wrestlingMove && elapsed >= round.wrestlingMove.start && !sim.exits.has(round.victim)) {
      const resolve = Math.max(round.resolve, elapsed + (round.wrestlingMove.contactAt == null ? 2600 : 1800) + 1100 * (round.timeScale ?? props.duration / 44_000));
      if (resolve > round.resolve) contact.round = { ...round, resolve, end: Math.max(round.end, resolve) };
      continue;
    }
    if (round.kickCatch && elapsed >= round.kickCatch.start && round.kickCatch.catchAt == null && !sim.exits.has(round.victim)) {
      const resolve = Math.max(round.resolve, elapsed + ARENA_KICK_CATCH_TIMING.load + ARENA_KICK_CATCH_TIMING.spin + 1100 * (round.timeScale ?? props.duration / 44_000));
      if (resolve > round.resolve) contact.round = { ...round, resolve, end: Math.max(round.end, resolve) };
      continue;
    }
    if (round.tactic === 'elbow' && round.elbowGripAt === null && elapsed >= round.start && !sim.exits.has(round.victim)) {
      const resolve = Math.max(round.resolve, elapsed + 2800 * (round.timeScale ?? props.duration / 44_000));
      if (resolve > round.resolve) contact.round = { ...round, resolve, end: Math.max(round.end, resolve) };
      continue;
    }
    if (['catch', 'ram'].includes(round.tactic) && round.chargeSetup?.contactAt === null && elapsed >= round.start && !sim.exits.has(round.victim)) {
      const load = round.tactic === 'ram' ? 0 : round.chargeSetup.loadDuration ?? 180;
      const turn = round.tactic === 'ram' ? 0 : round.chargeSetup.turnDuration ?? 300;
      const resolve = Math.max(round.resolve, elapsed + load + turn + 1100 * (round.timeScale ?? props.duration / 44_000));
      if (resolve > round.resolve) contact.round = { ...round, resolve, end: Math.max(round.end, resolve) };
      continue;
    }
    if (!round.rushOutcome || round.linkedRush || round.rushLaunchAt !== null || elapsed < round.start || sim.exits.has(round.victim)) continue;
    // The original finish is only a plan. Until the pair has actually taken
    // hold, reserve the complete post-contact throw instead of launching or
    // removing the waiting runner at that nominal deadline.
    const resolve = Math.max(round.resolve, elapsed + ARENA_PAIR_COUNTER_TIMING.release + 1100 * (round.timeScale ?? props.duration / 44_000));
    if (resolve > round.resolve) contact.round = { ...round, resolve, end: Math.max(round.end, resolve) };
  }
  const rounds = arenaRounds(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed).map(round => {
    const actual = sim.contacts.get(round.id)?.round;
    return sceneTimed(round) || sceneTimed(actual ?? round) ? actual ?? round : round;
  });
  const unit = rounds[0]?.timeScale ?? props.duration / 44_000;
  const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);
  const won = !props.preview && !!rounds.length && resolvedRounds(rounds, elapsed).length === rounds.length;
  const podiumPlaces = arenaPodium(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed), podiumById = new Map(podiumPlaces.map(place => [place.id, place]));
  const releasedIds = new Set(rounds.filter(round => round.escape?.outcome === 'separate' && elapsed >= round.escape.end && elapsed < round.start).flatMap(round => [round.escape!.runnerId, round.escape!.chaserId! ]));
  const upcomingPlan = props.preview || won ? undefined : rounds.find(round => {
    const entry = round.wrestlingMove?.start ?? round.kickCatch?.start ?? round.supermanPunch?.start ?? round.linkedRush?.start ?? round.slideTrip?.start ?? round.pairDodge?.start ?? round.passingTrip?.start ?? round.recovery?.start ?? round.escape?.start ?? round.rimCharge?.start ?? round.rim?.start ?? round.start;
    return entry > elapsed && entry - elapsed < 2400 * unit && ![round.aggressor, round.victim].some(id => releasedIds.has(id));
  });
  const focusPlan = props.preview || won ? undefined : rounds.find(round => elapsed < round.resolve);
  const upcoming = upcomingPlan ? sim.contacts.get(upcomingPlan.id)?.round ?? upcomingPlan : undefined;
  const exchange = focusPlan ? sim.contacts.get(focusPlan.id)?.round ?? focusPlan : undefined;
  const focusEscape = exchange?.escape ? arenaEscapeTargets(exchange, elapsed, { x: 500, y: 416 }) : undefined;
  const engaged = new Set(focusEscape?.released ? [] : focusEscape?.active ? [focusEscape.runnerId, focusEscape.chaserId] : exchange ? sceneParticipants(exchange, elapsed) : []);
  const preparing = new Set(upcoming ? sceneParticipants(upcoming).filter(id => !engaged.has(id)) : []);
  const living = order.filter(id => !ranks[id]);
  const active = won ? order.filter(id => id === order[0]) : living;
  const before = new Map([...sim.bodies].map(([id, body]) => [id, { x: body.x, y: body.y }]));
  const actors = new Map<string, ChoreographedActor>();
  const words = new Map<string, string>();
  const effects: (() => void)[] = [];
  const overlays: (() => void)[] = [];
  const elbowKnockouts = new Set<string>();
  let collisionShake = 0;
  const seconds = props.paused || reduced ? 0 : delta / 1000;
  const prepareContactActor = (actor: ArenaActor) => {
    const body = sim.bodies.get(actor.candidate.id);
    if (!body) return;
    const previous = before.get(actor.candidate.id) ?? body;
    const ground = !['airborne', 'held', 'carried', 'roll', 'land', 'recover', 'sidekick', 'stunned', 'elbow'].includes(actor.pose);
    actor.velocityX = reduced ? 0 : seconds ? (body.x - previous.x) / seconds : body.vx;
    actor.velocityY = reduced ? 0 : seconds ? (body.y - previous.y) / seconds : body.vy;
    actor.gaitDistance = body.gait + (seconds && ground ? Math.hypot(body.x - previous.x, body.y - previous.y) : 0);
    actor.motionEpoch = sim.epoch; actor.motionImmediate = reset || reduced;
    body.animation ??= createArenaFighterAnimation(); actor.animation = body.animation;
  };
  const pairHasGrip = (firstId: string, secondId: string) => {
    const first = sim.bodies.get(firstId), second = sim.bodies.get(secondId);
    const left = first?.animation?.contactPoints, right = second?.animation?.contactPoints;
    return !!first && !!second && !!left && !!right && Math.hypot(first.x - second.x, first.y - second.y) < 70 && Math.abs(first.y - second.y) < 34
      && left.hands.some(hand => Math.hypot(hand.x - right.waist.x, hand.y - right.waist.y) < 16)
      && right.hands.some(hand => Math.hypot(hand.x - left.waist.x, hand.y - left.waist.y) < 16);
  };
  const pushHasContact = (driverId: string, defenderId: string) => {
    const driver = sim.bodies.get(driverId), defender = sim.bodies.get(defenderId), palms = driver?.animation?.contactPoints?.hands, contacts = defender?.animation?.contactPoints;
    return !!driver && !!defender && !!palms && !!contacts && Math.hypot(driver.x - defender.x, driver.y - defender.y) < 72
      && palms.some(hand => [...contacts.shoulders, contacts.waist].some(point => Math.hypot(hand.x - point.x, hand.y - point.y) < 10));
  };
  if (!order.length) { drawArenaScenery(ctx, clock, { intensity: .35, reduced }); text(ctx, '참가자를 입력하면 모래판에 모입니다', 500, 392, 28, '#73593e'); return; }
  const makeExit = (round: ArenaRound, origin: ArenaPoint, lift = 0, angle = 0, velocity = 0, direction?: number): Exit => {
    const outIndex = order.length - order.indexOf(round.victim) - 1;
    const side = direction ?? arenaExitDirection(round, origin, outIndex);
    const seat = [...sim.exits.values()].filter(exit => exit.side === side).length;
    const bench = { x: side < 0 ? 38 + seat % 3 * 52 : 962 - seat % 3 * 52, y: 378 + Math.floor(seat / 3) * 161 };
    return { round, origin, landing: { x: side < 0 ? 115 : 885, y: round.tactic === 'bait' || round.tactic === 'edge' || round.tactic === 'shove' || round.tactic === 'double-shove' ? Math.max(436, origin.y + 40) : 436 }, side, bench, lift, angle, velocity };
  };
  const releaseSpin = (exit: Exit, victim: ArenaActor, driver: ArenaActor, orbit: number, orbital: number, planar: boolean, priorHands: readonly ArenaPoint[], span = 1) => {
    const rig = sampleArenaFighterContacts(victim, reduced ? 0 : clock), palms = sampleArenaFighterContacts(driver, reduced ? 0 : clock).hands;
    const center = { x: (rig.feet[0].x + rig.feet[1].x) / 2, y: (rig.feet[0].y + rig.feet[1].y) / 2 };
    const centerVelocity = { x: ((palms[0].x + palms[1].x) - (priorHands[0].x + priorHands[1].x)) * 500 / span, y: ((palms[0].y + palms[1].y) - (priorHands[0].y + priorHands[1].y)) * 500 / span };
    const offset = { x: rig.waist.x - center.x, y: rig.waist.y - center.y };
    const angular = planar ? arenaAnkleSwingProjection(orbit).angleDerivative * orbital : orbital * .45 / (Math.cos(orbit) ** 2 + .45 ** 2 * Math.sin(orbit) ** 2);
    let velocity = { x: centerVelocity.x - angular * offset.y, y: centerVelocity.y + angular * offset.x };
    if (planar) {
      const matrix = exit.spinSnapshot!.matrix, determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
      const local = { x: (matrix[3] * offset.x - matrix[2] * offset.y) / determinant, y: (-matrix[1] * offset.x + matrix[0] * offset.y) / determinant };
      const step = .0001, before = arenaAnkleSwingBasis(orbit - step, victim.scale, victim.facing), after = arenaAnkleSwingBasis(orbit + step, victim.scale, victim.facing);
      velocity = { x: ((after[0] - before[0]) * local.x + (after[2] - before[2]) * local.y) / (2 * step) * orbital + centerVelocity.x,
        y: ((after[1] - before[1]) * local.x + (after[3] - before[3]) * local.y) / (2 * step) * orbital + centerVelocity.y };
    }
    // The planted rim throw drives upward as the ankles leave the palms.
    // Keep the sideways stroke and give the body a full ballistic arc.
    if (exit.floorThrow) velocity.y = Math.min(velocity.y, -300);
    exit.angle = Math.atan2(exit.spinSnapshot!.matrix[1] * victim.facing, exit.spinSnapshot!.matrix[0] * victim.facing);
    // Once the palms open, the mass keeps the measured horizontal momentum.
    // Its landing clock follows that momentum rather than pulling it to a target.
    const direction = Math.sign(velocity.x) || exit.side;
    const groundY = Math.max(436, exit.origin.y + 40);
    const rimX = 500 + direction * (303 * Math.sqrt(Math.max(0, 1 - ((groundY - 416) / 112) ** 2)) + 65);
    const range = Math.max(65, (rimX - exit.origin.x) * direction);
    const duration = Math.max(650, range / Math.max(1, Math.abs(velocity.x)) * 1000);
    const seconds = duration / 1000;
    exit.landing = { x: exit.origin.x + velocity.x * seconds, y: groundY };
    const gravity = 2 * (groundY - (exit.origin.y - exit.lift) - velocity.y * seconds) / (seconds * seconds);
    exit.spinFlight = { velocity, angularVelocity: angular, center: rig.waist, planarOrbit: planar ? orbit : undefined, duration, gravity };
  };
  const spinFollowThrough = (exit: Exit) => {
    const velocity = exit.spinFlight?.velocity, speed = velocity && Math.hypot(velocity.x, velocity.y);
    return velocity && speed && speed > .001 ? { x: velocity.x / speed, y: velocity.y / speed } : undefined;
  };
  // A direct skip or paused fixture seek creates every eliminated actor as well.
  if (!props.preview) resolvedRounds(rounds, elapsed).forEach(round => arenaEliminatedIds(round).forEach(id => {
    if (sim.exits.has(id)) return;
    const center = arenaLocalContact({ x: 500, y: 425 }, []), actual = arenaContactRound(round, center);
    const rush = actual.rushOutcome ? arenaPairRushTargets(actual, actual.impact, center) : undefined;
    const double = actual.tactic === 'double-shove' ? rush ?? arenaDoubleShoveTargets(actual, actual.impact, center) : undefined;
    const technique = isArenaFinalTechnique(actual) ? arenaTechniqueTargets(actual, actual.impact, center) : undefined;
    const exitRound = id === round.victim ? actual : { ...actual, victim: id, secondaryVictim: undefined };
    const lift = rush?.outcome === 'double-out' ? id === actual.victim ? rush.victimLift : rush.helperLift : rush?.lift ?? technique?.lift ?? 0;
    const angle = rush ? id === actual.helper ? rush.helperAngle : rush.victimAngle : technique?.victimAngle ?? 0;
    const exit = makeExit(exitRound, double ? id === round.victim ? double.victim : double.helper : technique?.victim ?? (actual.tactic === 'bait' ? arenaChargeTargets(actual, actual.impact, center).charger : actual.tactic === 'edge' ? arenaEdgeTargets(actual, actual.impact, center).victim : actual.tactic === 'shove' ? arenaShoveTargets(actual, actual.impact, center).victim : { x: 500, y: 425 }), lift, angle, 0, rush?.outcome === 'counter-throw' ? rush.side : technique?.exitDirection);
    if (rush?.outcome === 'counter-throw') exit.heldFacing = -rush.side;
    if (rush?.outcome === 'double-out') {
      const landing = id === actual.victim ? rush.victimExit : rush.helperExit;
      if (landing) exit.landing = landing;
    }
    if (actual.tactic === 'trip' || actual.tactic === 'sidekick') exit.launchedAt = arenaTechniqueReactionAt(actual);
    sim.exits.set(id, exit);
    const settled = elapsed - round.impact >= 2100 * unit;
    const position = settled ? exit.bench : exit.landing;
    sim.bodies.set(id, { ...position, gait: 0, facing: exit.side > 0 ? -1 : 1, vx: 0, vy: 0 });
  }));
  // Starting positions only initialize a new body. Live navigation uses current contacts.
  active.forEach(id => {
    if (sim.exits.has(id)) return;
    if (!sim.bodies.has(id)) {
      const start = arenaStartingPoint(props.candidates.findIndex(candidate => candidate.id === id), props.candidates.length);
      sim.bodies.set(id, { ...start, gait: 0, facing: start.x < 500 ? 1 : -1, vx: 0, vy: 0 });
    }
    if (engaged.has(id) || preparing.has(id) || won) sim.bodies.get(id)!.roam = undefined;
  });
  const ambient = won ? [] : active.filter(id => !engaged.has(id) && !sim.exits.has(id));
  for (const [id, round] of sim.minis) if (props.preview || won || elapsed >= round.end || !ambient.includes(round.aggressor) || !ambient.includes(round.victim)) {
    if (elapsed >= round.end && !round.prepares) [round.aggressor, round.victim].forEach(person => { const body = sim.bodies.get(person); if (body) body.restUntil = elapsed + 750 * unit; });
    sim.minis.delete(id); if (!round.prepares) sim.contacts.delete(id);
  }
  const miniParticipants = new Set([...sim.minis.values()].flatMap(round => [round.aggressor, round.victim]));
  if (!props.preview && !won) for (const round of arenaMiniExchanges(ambient.filter(id => !releasedIds.has(id) && !miniParticipants.has(id) && elapsed >= (sim.bodies.get(id)!.restUntil ?? 0)).map(id => ({ id, x: sim.bodies.get(id)!.x, y: sim.bodies.get(id)!.y })), elapsed, props.duration, rounds).filter(round => sim.bodies.get(round.aggressor)?.separatedFrom !== round.victim && sim.bodies.get(round.victim)?.separatedFrom !== round.aggressor)) {
    sim.minis.set(round.id, round); miniParticipants.add(round.aggressor); miniParticipants.add(round.victim);
  }
  for (const id of miniParticipants) preparing.delete(id);
  active.forEach(id => {
    if (sim.exits.has(id)) return;
    const index = props.candidates.findIndex(candidate => candidate.id === id), body = sim.bodies.get(id)!;
    const cycle = (elapsed / unit + index * 673) % 5600;
    const roaming = ambient.includes(id) && !miniParticipants.has(id) && !preparing.has(id), available = roaming ? ambient.filter(other => other !== id && !miniParticipants.has(other) && !preparing.has(other)) : [];
    if (miniParticipants.has(id)) body.roam = undefined;
    const nextBout = rounds.find(round => round.end > elapsed && sceneParticipants(round, elapsed).includes(id));
    const opponentId = nextBout && !nextBout.helper ? nextBout.aggressor === id ? nextBout.victim : nextBout.aggressor : undefined;
    const partnerBout = opponentId ? rounds.find(round => round.end > elapsed && sceneParticipants(round, elapsed).includes(opponentId)) : undefined;
    const neighborId = !releasedIds.has(id) && opponentId && body.separatedFrom !== opponentId && sim.bodies.get(opponentId)?.separatedFrom !== id && !releasedIds.has(opponentId) && partnerBout?.id === nextBout?.id && available.includes(opponentId) ? opponentId : undefined;
    const neighbor = neighborId ? sim.bodies.get(neighborId) : undefined;
    const freelyReleased = releasedIds.has(id);
    const aware = roaming && !freelyReleased && !neighbor && !props.preview ? arenaNearbyResponse(body, active.filter(other => other !== id && (engaged.has(other) || miniParticipants.has(other))).map(other => sim.bodies.get(other)!), index) : undefined;
    const stage: ArenaRoamingStage = props.preview ? 'watch' : cycle < 1600 ? 'approach' : cycle < 3150 ? 'contact' : 'sidestep';
    const key = freelyReleased ? `released:${exchange?.id}` : `${Math.floor((elapsed / unit + index * 673) / 5600)}:${stage}:${neighborId ?? ''}`;
    if (roaming && (!body.roam || body.roam.key !== key)) body.roam = { key, origin: { x: body.x, y: body.y }, neighborId, target: freelyReleased ? arenaInsidePoint({ x: body.x + body.facing * 28, y: body.y + (index % 2 ? 1 : -1) * 13 }, 16) : arenaRoamingTarget(body, neighbor, index, stage) };
    // Approach follows the opponent; a sidestep keeps its release anchor and cannot accumulate drift.
    if (roaming && !freelyReleased && stage === 'approach') body.roam!.target = arenaRoamingTarget(body, neighbor, index, stage);
    if (roaming && !freelyReleased && !props.preview && (stage === 'contact' || !neighbor)) {
      const origin = body.roam!.origin;
      body.roam!.target = !neighbor ? arenaInsidePoint({ x: origin.x + (index % 2 ? 1 : -1) * 24, y: origin.y + (index % 3 ? 1 : -1) * 10 }, 16) : Math.hypot(neighbor.x - body.x, neighbor.y - body.y) > 86 ? arenaRoamingTarget(body, neighbor, index, 'approach') : arenaGuardTarget(origin, index, elapsed);
    }
    const target = aware?.target ?? (roaming ? body.roam!.target : body);
    const distance = Math.hypot(target.x - body.x, target.y - body.y);
    if (roaming) move(body, target, seconds, elapsed < (body.restUntil ?? 0) ? 62 : 96);
    const touching = !!neighbor && Math.hypot(neighbor.x - body.x, neighbor.y - body.y) < 83;
    if (touching) body.facing = neighbor.x > body.x ? 1 : -1;
    if (aware) body.facing = aware.facing;
    const pose: ArenaPose = props.preview ? 'guard' : aware ? aware.pose : distance > 12 ? 'walk' : 'guard';
    const candidateIndex = props.candidates.findIndex(candidate => candidate.id === id);
    actors.set(id, { candidate: props.candidates[candidateIndex], index: candidateIndex, x: body.x, y: body.y, scale: 2.04, facing: body.facing, pose, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: cycle / 5600, power: .7, gripTarget: touching && neighbor && ['grapple', 'push', 'brace'].includes(pose) ? { x: neighbor.x - body.facing * 17, y: neighbor.y - 62 } : undefined });
    if (!reduced && !props.preview && touching && cycle > 2700 && cycle < 3150) effects.push(() => dust(ctx, body.x + body.facing * 24, body.y, cycle - 2700, .3));
  });
  const liveContactIds = new Set([...sim.minis.keys(), ...(exchange ? [exchange.id] : []), ...(upcoming ? [upcoming.id] : [])]);
  const contactPoint = (round: ArenaRound, origin: ArenaPoint): Contact => {
    const prepared = [...sim.contacts.values()].find(contact => contact.round.prepares === round.id);
    const continuation = round.prepares ? sim.contacts.get(round.prepares) : undefined;
    const center = prepared?.center ?? continuation?.center ?? arenaLocalContact(origin, [...sim.contacts].filter(([otherId]) => otherId !== round.id && liveContactIds.has(otherId)).map(([, contact]) => contact.center));
    const aggressor = sim.bodies.get(round.recovery && elapsed < round.recovery.end ? round.recovery.throwerId ?? round.aggressor : round.aggressor), victim = sim.bodies.get(round.victim);
    let actual = arenaContactRound(round, center, aggressor && victim ? { aggressor, victim } : undefined);
    if (actual.rushOutcome && actual.helper) {
      const first = sim.bodies.get(actual.rushOutcome === 'counter-throw' ? actual.aggressor : actual.victim), second = sim.bodies.get(actual.helper);
      if (first && second) actual = { ...actual, contactSide: first.x >= second.x ? 1 : -1 };
    }
    if (round.escape && elapsed < round.escape.end) {
      const runner = sim.bodies.get(round.escape.runnerId), chaser = sim.bodies.get(round.escape.chaserId!);
      if (runner && chaser) actual = { ...actual, contactSide: round.escape.runnerId === round.victim ? runner.x >= chaser.x ? 1 : -1 : chaser.x >= runner.x ? 1 : -1 };
    }
    const chargerId = actual.rushOutcome === 'counter-throw' ? actual.victim : actual.aggressor;
    const charger = actual.rushOutcome ? sim.bodies.get(chargerId) : undefined;
    return { center, chargerOrigin: charger ? { x: charger.x, y: charger.y } : undefined, metAt: prepared?.metAt ?? continuation?.metAt, side: round.index % 2 ? 1 : -1, round: actual };
  };
  const encounterOrigin = (round: ArenaRound, aggressor: ArenaPoint, victim: ArenaPoint) => {
    if (round.recovery && elapsed < round.recovery.end) {
      const thrower = sim.bodies.get(round.recovery.throwerId ?? round.aggressor);
      if (thrower) return { x: (thrower.x + victim.x) / 2, y: (thrower.y + victim.y) / 2 };
    }
    if (round.pairDodge) {
      const partner = sim.bodies.get(round.pairDodge.partnerId);
      if (partner) return { x: (aggressor.x + partner.x) / 2, y: (aggressor.y + partner.y) / 2 };
    }
    if (round.escape && elapsed < round.escape.end) {
      const runner = sim.bodies.get(round.escape.runnerId), chaser = sim.bodies.get(round.escape.chaserId!);
      if (runner && chaser) return { x: (runner.x + chaser.x) / 2, y: (runner.y + chaser.y) / 2 };
    }
    if (round.rushOutcome && round.helper) {
      const pairIds = round.rushOutcome === 'counter-throw' ? [round.aggressor, round.helper] : [round.victim, round.helper];
      const pair = pairIds.map(id => sim.bodies.get(id)!).filter(Boolean);
      if (pair.length === 2) return { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
    }
    const partner = round.secondaryVictim && sim.bodies.get(round.secondaryVictim);
    return partner ? { x: (victim.x + partner.x) / 2, y: (victim.y + partner.y) / 2 } : { x: (aggressor.x + victim.x) / 2, y: (aggressor.y + victim.y) / 2 };
  };
  // Future participants approach while the preceding throw is still resolving.
  if (upcoming) {
    const a = sim.bodies.get(upcoming.aggressor), v = sim.bodies.get(upcoming.victim);
    if (a && v && !sim.contacts.has(upcoming.id)) sim.contacts.set(upcoming.id, contactPoint(upcoming, encounterOrigin(upcoming, a, v)));
    const contact = sim.contacts.get(upcoming.id);
    if (contact) {
      const upcoming = contact.round;
      sceneParticipants(upcoming).forEach((id, role) => {
        if (!id || !preparing.has(id)) return;
        const body = sim.bodies.get(id), actor = actors.get(id);
        if (!body || !actor) return;
        if (upcoming.wrestlingMove || upcoming.supermanPunch || upcoming.kickCatch || upcoming.slideTrip || upcoming.linkedRush) {
          actor.pose = 'guard'; actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
          arenaFaceOpponent(body, sim.bodies.get(upcoming.victim === id ? upcoming.aggressor : upcoming.victim)!); actor.facing = body.facing;
          return;
        }
        if (upcoming.pairDodge) {
          if (id === upcoming.victim) { actor.pose = 'brace'; return; }
          const side = upcoming.contactSide ?? 1, first = id === upcoming.aggressor;
          move(body, { x: contact.center.x + (first ? 1 : -1) * side * 22, y: contact.center.y + (first ? 6 : -6) }, seconds, 165);
          const other = sim.bodies.get(first ? upcoming.pairDodge.partnerId : upcoming.aggressor)!;
          arenaFaceOpponent(body, other); actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
          const touching = Math.hypot(body.x - other.x, body.y - other.y) < 70 && Math.abs(body.y - other.y) < 24;
          actor.pose = touching ? 'grapple' : 'walk';
          actor.gripTarget = touching ? { x: other.x, y: other.y - 46 } : undefined; actor.gripStrength = touching ? .9 : 0;
          return;
        }
        if (upcoming.rimCharge) {
          actor.pose = 'guard';
          const opponent = sim.bodies.get(id === upcoming.victim ? upcoming.aggressor : upcoming.victim);
          if (opponent) arenaFaceOpponent(body, opponent);
          actor.facing = body.facing;
          return;
        }
        if (upcoming.rushOutcome && id === (upcoming.rushOutcome === 'counter-throw' ? upcoming.victim : upcoming.aggressor)) {
          actor.pose = 'guard'; arenaFaceOpponent(body, contact.center); actor.facing = body.facing;
          return;
        }
        const plan = arenaAction(upcoming, upcoming.start).actors[role];
        const charge = upcoming.tactic === 'bait' ? arenaChargeTargets(upcoming, upcoming.start, contact.center) : undefined;
        const edge = upcoming.tactic === 'edge' ? arenaEdgeTargets(upcoming, upcoming.start, contact.center) : undefined;
        const caught = upcoming.tactic === 'catch' ? arenaCatchTargets(upcoming, upcoming.start, contact.center) : undefined;
        const spin = upcoming.tactic === 'spin' ? arenaSpinTargets(upcoming, upcoming.start, contact.center) : undefined;
        const ram = upcoming.tactic === 'ram' ? arenaRamTargets(upcoming, upcoming.start, contact.center) : undefined;
        const technique = isArenaFinalTechnique(upcoming) ? arenaTechniqueTargets(upcoming, upcoming.start, contact.center) : undefined;
        const upcomingRush = upcoming.rushOutcome ? arenaPairRushTargets(upcoming, upcoming.start, contact.center, contact.chargerOrigin) : undefined;
        const shove = upcoming.tactic === 'double-shove' ? upcomingRush ?? arenaDoubleShoveTargets(upcoming, upcoming.start, contact.center) : upcoming.tactic === 'shove' ? arenaShoveTargets(upcoming, upcoming.start, contact.center) : undefined;
        const target = arenaGuardTarget(technique ? id === upcoming.victim ? technique.victim : technique.aggressor : charge ? id === upcoming.victim ? charge.charger : charge.target : caught ? id === upcoming.victim ? caught.charger : caught.receiver : spin ? id === upcoming.victim ? spin.attacker : spin.defender : ram ? id === upcoming.victim ? ram.victim : ram.driver : shove ? id === upcoming.victim ? shove.victim : id === upcoming.helper ? shove.helper : shove.aggressor : edge ? id === upcoming.victim ? edge.victim : edge.aggressor : { x: contact.center.x + (plan?.offset.x ?? 0), y: contact.center.y + (plan?.offset.y ?? 0) }, actor.index, elapsed);
        const approachDistance = Math.hypot(target.x - body.x, target.y - body.y);
        move(body, target, seconds, arenaApproachSpeed(approachDistance));
        const opponent = sim.bodies.get(plan?.gripId ?? (id === upcoming.victim ? upcoming.aggressor : upcoming.victim));
        if (opponent) arenaFaceOpponent(body, opponent);
        actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
        const touching = opponent && Math.hypot(opponent.x - body.x, opponent.y - body.y) < 88 && Math.abs(opponent.y - body.y) < 24 && !charge && !caught && !ram;
        actor.pose = touching ? id === upcoming.victim ? 'brace' : 'grapple' : Math.hypot(target.x - body.x, target.y - body.y) > 8 ? 'walk' : 'guard';
        actor.gripTarget = touching ? { x: opponent.x - body.facing * 17, y: opponent.y - 44 } : undefined;
        if (touching && contact.metAt === undefined) contact.metAt = elapsed;
      });
    }
  }
  const encounters = [...(exchange ? [exchange] : []), ...sim.minis.values()];
  for (let exchange of encounters) {
    const a = sim.bodies.get(exchange.aggressor), v = sim.bodies.get(exchange.victim);
    if (a && v && !sim.contacts.has(exchange.id)) sim.contacts.set(exchange.id, contactPoint(exchange, encounterOrigin(exchange, a, v)));
    const contact = sim.contacts.get(exchange.id);
    if (contact) {
      if (!contact.started && elapsed >= exchange.start) {
        if (contact.round.tactic === 'edge' && !contact.round.rim && !reset) contact.round = { ...contact.round, pushContactAt: null };
        if (contact.round.chargeSetup && !contact.round.rimCharge && a && v) contact.round = arenaContactRound(contact.round, contact.center, { aggressor: a, victim: v });
        if (contact.round.rushOutcome && !contact.round.linkedRush) {
          const chargerId = contact.round.rushOutcome === 'counter-throw' ? contact.round.victim : contact.round.aggressor;
          const charger = sim.bodies.get(chargerId)!;
          contact.chargerOrigin = { x: charger.x, y: charger.y };
          contact.round = { ...contact.round, rushLaunchAt: reset && elapsed > 300 * unit ? undefined : null, rushContactAt: undefined };
        }
        contact.started = true;
      }
      exchange = contact.round;
      if (exchange.wrestlingMove && a && v && elapsed >= exchange.wrestlingMove.start) {
        const driver = actors.get(exchange.aggressor)!, victim = actors.get(exchange.victim);
        const fallback = () => {
          const impact = elapsed + 3200 * unit;
          contact.round = arenaContactRound({ ...exchange, wrestlingMove: undefined, start: elapsed, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit }, contact.center, { aggressor: a, victim: v });
          exchange = contact.round; contact.metAt = undefined; contact.committed = false;
        };
        if (!contact.wrestlingMoveOrigins && victim) {
          victim.pose = 'guard'; victim.gripTarget = undefined; victim.secondaryGripTarget = undefined; prepareContactActor(victim);
          const rig = sampleArenaFighterContacts(victim, reduced ? 0 : clock), kind = exchange.wrestlingMove.kind;
          const target = kind === 'clothesline' ? { x: rig.head.x, y: rig.head.y + victim.scale * 20 }
            : kind === 'dropkick' ? { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 + victim.scale * 5 } : rig.waist;
          const thigh = { x: rig.waist.x + ((rig.feet[0].x + rig.feet[1].x) / 2 - rig.waist.x) * .28, y: rig.waist.y + ((rig.feet[0].y + rig.feet[1].y) / 2 - rig.waist.y) * .28 };
          const contactTargets: [ArenaPoint, ArenaPoint] = kind === 'scoopslam' ? [rig.back, thigh] : [{ x: target.x, y: target.y - 6 }, { x: target.x, y: target.y + 6 }];
          const origins: ArenaWrestlingMoveOrigins = { driver: { x: a.x, y: a.y }, victim: { x: v.x, y: v.y }, target, contactTargets };
          const window = { ...exchange.wrestlingMove, start: elapsed };
          const initial = arenaWrestlingMoveTargets(window, elapsed, contact.center, origins, exchange.contactSide);
          if (!initial.canPerform) fallback();
          else {
            contact.wrestlingMoveOrigins = origins;
            contact.round = { ...exchange, wrestlingMove: { ...window, plannedLaunchAt: initial.plannedLaunchAt, plannedContactAt: initial.plannedContactAt, counterReadyAt: initial.counterReadyAt } }; exchange = contact.round;
          }
        }
        if (exchange.wrestlingMove && contact.wrestlingMoveOrigins) {
          let window = exchange.wrestlingMove, frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, exchange.contactSide);
          const spinFinish = window.kind !== 'dropkick';
          const update = (patch: Partial<typeof window>) => {
            window = { ...window, ...patch };
            contact.round = { ...exchange, wrestlingMove: window }; exchange = contact.round;
            frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, exchange.contactSide);
          };
          if (window.launchAt === null && frame.canLaunch) {
            contact.wrestlingMoveOrigins.launchDriver = { ...frame.driver }; contact.wrestlingMoveOrigins.launchVictim = { ...frame.victim };
            update({ launchAt: elapsed });
          }
          if (frame.gripMode === 'ankle' && !contact.wrestlingMoveOrigins.pickupDriver) {
            contact.wrestlingMoveOrigins.pickupDriver = { x: a.x, y: a.y };
            contact.wrestlingMoveOrigins.floorVictim = { x: v.x, y: v.y };
            if (spinFinish) contact.wrestlingMoveOrigins.ankleFacing = frame.side === 1 ? -1 : 1;
            update({});
          }
          const apply = () => {
            for (const [actor, body, point, pose, phase, height, angle, suspension, slam, tuck, velocity] of [
              [driver, a, frame.driver, frame.driverPose, frame.driverPhase, frame.driverHeight, frame.driverAngle, frame.driverSuspension, frame.driverSlam, frame.driverJumpTuck, frame.driverVelocity],
              [victim, v, frame.victim, frame.victimPose, frame.victimPhase, frame.victimHeight, frame.victimAngle, frame.victimSuspension, frame.victimSlam, frame.victimJumpTuck, frame.victimVelocity],
            ] as const) {
              if (!actor || actor === victim && sim.exits.has(exchange.victim)) continue;
              const settledOffset = window.kind === 'scoopslam' ? contact.wrestlingCradleOffset : undefined;
              const offset = actor === driver && frame.gripStrength === 0 && !contact.wrestlingMoveOrigins!.pickupDriver ? settledOffset : undefined;
              body.x = point.x + (offset?.x ?? 0); body.y = point.y + (offset?.y ?? 0); body.facing = actor === driver ? frame.driverFacing : frame.victimFacing;
              body.motorX = velocity.x; body.motorY = velocity.y;
              actor.x = body.x; actor.y = body.y - height; actor.depthY = body.y; actor.facing = body.facing;
              actor.pose = pose; actor.phase = phase; actor.angle = angle; actor.suspension = suspension; actor.slamProgress = slam; actor.jumpTuck = tuck;
              actor.slamImpact = frame.slamImpact;
              if (actor === victim) {
                actor.eyesClosed = frame.victimEyesClosed;
                actor.carryStretch = frame.victimCarryStretch; actor.carrySupport = frame.victimCarryStretch !== undefined ? window.kind === 'scoopslam' && frame.gripMode !== 'ankle' ? 'cradle' : 'shoulder' : undefined;
                actor.carryEntry = (window.kind === 'scoopslam' || window.kind === 'powerbomb') && frame.gripMode !== 'ankle';
                actor.scoopVictim = frame.scoopVictim; actor.scoopLoad = frame.scoopLoad; actor.scoopLift = frame.scoopLift; actor.scoopTurn = frame.scoopTurn; actor.scoopDown = frame.scoopDown; actor.scoopRecover = frame.scoopRecover;
                actor.powerbombVictim = frame.powerbombVictim; actor.powerbombLoad = frame.powerbombLoad; actor.powerbombLift = frame.powerbombLift; actor.powerbombDown = frame.powerbombDown;
                actor.spineCarry = window.kind === 'spinebuster' && frame.victimCarryStretch !== undefined && frame.gripMode === 'waist';
                if (actor.spineCarry) actor.carryEntry = true;
                actor.bulldogProgress = window.kind === 'clothesline' && frame.gripMode !== 'ankle' ? frame.bulldogProgress : undefined;
                actor.slamEntry = slam !== undefined && frame.gripMode !== 'ankle';
              }
              if (actor === driver && (window.kind === 'clothesline' || window.kind === 'spinebuster')) actor.slamEntry = slam !== undefined;
              actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
              prepareContactActor(actor);
            }
            driver.clotheslineArm = window.kind === 'clothesline' && frame.clotheslineStrength > .001 ? 1 : undefined;
            driver.clotheslineTarget = frame.clotheslineTarget; driver.clotheslineStrength = frame.clotheslineStrength;
            driver.clotheslineInner = frame.clotheslineInner;
            if (window.kind === 'clothesline' && window.contactAt != null && frame.clotheslineStrength > 0 && victim) {
              const rig = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
              const head = { x: (rig.headSides[0].x + rig.headSides[1].x) / 2, y: (rig.headSides[0].y + rig.headSides[1].y) / 2 };
              const shoulders = { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 };
              driver.clotheslineTarget = { x: head.x + (shoulders.x - head.x) * .65, y: head.y + (shoulders.y - head.y) * .65 };
            }
            driver.dropkickProgress = frame.dropkickProgress; driver.footTargets = frame.footTargets; driver.feetStrength = frame.feetStrength;
            driver.bulldogProgress = frame.bulldogProgress; driver.backBodyProgress = frame.backBodyProgress;
            driver.backBodyRaise = frame.backBodyRaise;
            driver.powerbombLoad = frame.powerbombLoad; driver.powerbombLift = frame.powerbombLift; driver.powerbombDown = frame.powerbombDown;
            driver.bulldogHeadlock = frame.bulldogHeadlock;
            driver.spinebusterProgress = frame.spinebusterProgress; driver.scoopSlamProgress = frame.scoopSlamProgress;
            driver.spineLoad = frame.spineLoad; driver.spineLift = frame.spineLift; driver.spineDown = frame.spineDown;
            driver.overheadRaise = frame.overheadRaise; driver.scoopRecover = frame.scoopRecover;
            driver.scoopLoad = frame.scoopLoad; driver.scoopLift = frame.scoopLift; driver.scoopTurn = frame.scoopTurn; driver.scoopDown = frame.scoopDown;
            driver.ankleThrowProgress = frame.ankleThrowProgress; driver.ankleSpinRaise = frame.ankleSpinRaise;
            driver.ankleApproach = frame.ankleApproach;
            driver.pivotTurn = frame.pivotTurn; driver.yaw = frame.driverYaw;
            const spinExit = spinFinish ? sim.exits.get(exchange.victim) : undefined, armRelease = contact.pairArmRelease?.get(exchange.aggressor);
            if (spinExit && armRelease) {
              const translated = (points: [ArenaPoint, ArenaPoint]) => points.map(point => ({ x: point.x + driver.x - armRelease.root.x, y: point.y + driver.y - armRelease.root.y })) as [ArenaPoint, ArenaPoint];
              const followThrough = spinFollowThrough(spinExit);
              driver.carrierRelease = { hands: translated(armRelease.hands), elbows: translated(armRelease.elbows), shoulders: translated(armRelease.shoulders), progress: clamp((elapsed - spinExit.launchedAt!) / 650), direction: Math.sign(followThrough?.x ?? 0) || driver.facing, followThrough, stance: armRelease.stance };
            }
            driver.frontKick = frame.frontKick; driver.footTarget = frame.driverFootTarget; driver.footStrength = frame.footStrength; driver.kickLeg = 1;
            const waistSupport = frame.gripMode === 'cradle' ? frame.scoopSupport : frame.gripMode === 'waist' ? frame.powerbombSupport ?? frame.backBodySupport ?? frame.spineSupport : undefined;
            if (waistSupport && victim && !sim.exits.has(exchange.victim)) {
              const rig = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
              const offset = { x: waistSupport.x - rig.waist.x, y: waistSupport.y - rig.waist.y };
              v.x += offset.x; v.y += offset.y;
              victim.x += offset.x; victim.y += offset.y; victim.depthY = v.y;
            }
            if (frame.ankleSpin && frame.gripTargets && victim && !sim.exits.has(exchange.victim)) {
              if (!frame.ankleSpin.planar) { driver.ankleSpinRaise = frame.ankleSpin.weight; victim.pose = 'stunned'; victim.suspension = 0; victim.carryStretch = undefined; victim.carrySupport = undefined; victim.slamProgress = { tuck: 0, slump: 1 }; }
              driver.gripTarget = frame.gripTargets[1]; driver.secondaryGripTarget = frame.gripTargets[0];
              driver.gripStrength = 1; driver.gripLocked = true; driver.gripMode = 'ankle';
              prepareContactActor(driver);
              let palms = sampleArenaFighterContacts(driver, reduced ? 0 : clock).hands;
              if (!frame.ankleSpin.planar) for (let attempt = 0; attempt < 2; attempt++) {
                victim.spinSuspension = { ...frame.ankleSpin, grips: [palms[0], palms[1]] };
                const feet = sampleArenaFighterContacts(victim, reduced ? 0 : clock).feet;
                const center = { x: (frame.gripTargets[0].x + frame.gripTargets[1].x) / 2, y: (frame.gripTargets[0].y + frame.gripTargets[1].y) / 2 };
                const half = { x: (feet[1].x - feet[0].x) / 2, y: (feet[1].y - feet[0].y) / 2 };
                driver.gripTarget = { x: center.x + half.x, y: center.y + half.y }; driver.secondaryGripTarget = { x: center.x - half.x, y: center.y - half.y };
                palms = sampleArenaFighterContacts(driver, reduced ? 0 : clock).hands;
              }
              victim.spinSuspension = { ...frame.ankleSpin, grips: [palms[0], palms[1]] };
              victim.eyesClosed = true;
              const snapshot = arenaSpinSnapshot(victim, reduced ? 0 : clock);
              const depthY = frame.ankleSpin.planar ? a.y + Math.sin(frame.ankleSpin.orbit) * 112 * .20 * frame.ankleSpin.weight : a.y;
              victim.x = snapshot.origin.x; victim.y = snapshot.origin.y; victim.depthY = depthY;
              v.x = snapshot.origin.x; v.y = depthY; v.motorX = 0; v.motorY = 0;
              contact.wrestlingSpinSample = { at: elapsed, waist: sampleArenaFighterContacts(victim, reduced ? 0 : clock).waist };
              return;
            }
            if (frame.gripTargets && victim && !sim.exits.has(exchange.victim)) {
              const rig = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
              const thigh = { x: rig.waist.x + ((rig.feet[0].x + rig.feet[1].x) / 2 - rig.waist.x) * .28, y: rig.waist.y + ((rig.feet[0].y + rig.feet[1].y) / 2 - rig.waist.y) * .28 };
              const targets = frame.gripMode === 'head' ? rig.headSides : frame.gripMode === 'ankle' ? rig.feet : frame.gripMode === 'cradle' ? [rig.back, thigh] : [rig.waist, { x: rig.waist.x + frame.side * 6, y: rig.waist.y + 3 }];
              driver.gripTarget = targets[1]; driver.secondaryGripTarget = targets[0]; driver.gripStrength = frame.gripStrength; driver.gripLocked = true;
              driver.gripMode = frame.gripMode;
              // A fixed root gap is not a grip: the live chest and thigh can
              // sit beyond normal arm reach after a diagonal run. Step the
              // receiver into both reach disks before recording contact.
              const receiving = window.contactAt === null && frame.canContact && (frame.gripMode === 'cradle' || frame.gripMode === 'waist');
              if (receiving || frame.gripMode === 'ankle' && window.ankleGripAt != null || (frame.gripMode === 'head' || frame.gripMode === 'cradle') && window.contactAt != null && frame.gripStrength > 0) {
                const prior = before.get(exchange.aggressor) ?? a;
                let goal = { x: a.x, y: a.y };
                for (let attempt = 0; attempt < 3; attempt++) {
                  const predicted = { ...driver, ...goal, velocityX: seconds ? (goal.x - prior.x) / seconds : 0, velocityY: seconds ? (goal.y - prior.y) / seconds : 0 };
                  goal = arenaCarryHolderPoint(predicted, [targets[1], targets[0]], reduced ? 0 : clock, goal);
                }
                const distance = Math.hypot(goal.x - prior.x, goal.y - prior.y), step = reset ? 1 : Math.min(1, (frame.gripMode === 'head' ? 240 : 165) * seconds / Math.max(.001, distance));
                const inside = arenaInsidePoint({ x: prior.x + (goal.x - prior.x) * step, y: prior.y + (goal.y - prior.y) * step }, 12);
                a.x = inside.x; a.y = inside.y;
                a.motorX = seconds ? (a.x - prior.x) / seconds : 0; a.motorY = seconds ? (a.y - prior.y) / seconds : 0;
                driver.x = a.x; driver.y = a.y; driver.depthY = a.y;
                if (frame.gripMode === 'head') contact.wrestlingHeadOffset = { x: a.x - frame.driver.x, y: a.y - frame.driver.y };
                if (frame.gripMode === 'cradle') contact.wrestlingCradleOffset = { x: a.x - frame.driver.x, y: a.y - frame.driver.y };
              }
            }
            prepareContactActor(driver);
          };
          apply();
          if (window.contactAt === null && victim && !sim.exits.has(exchange.victim) && (window.kind === 'clothesline' || window.kind === 'dropkick')) {
            // The preceding bout can leave a lean in the live rig. Aim at the
            // current neck/chest after this frame's pose settles, rather than
            // at the point captured before the victim changed into its guard.
            const rig = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
            const target = window.kind === 'clothesline' ? { x: rig.head.x, y: rig.head.y + victim.scale * 20 }
              : { x: (rig.shoulders[0].x + rig.shoulders[1].x) / 2, y: (rig.shoulders[0].y + rig.shoulders[1].y) / 2 + victim.scale * 5 };
            contact.wrestlingMoveOrigins.target = target;
            contact.wrestlingMoveOrigins.contactTargets = [{ x: target.x, y: target.y - 6 }, { x: target.x, y: target.y + 6 }];
            update({}); apply();
          }
          const ankleApproach = spinFinish && frame.gripMode === 'ankle' && window.ankleGripAt === null;
          if ((frame.frontKick !== undefined || frame.canGrabAnkle || ankleApproach) && victim && !sim.exits.has(exchange.victim)) {
            const rig = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
            if (frame.frontKick !== undefined) {
              contact.wrestlingMoveOrigins.kickTarget = rig.waist;
              const origin = contact.wrestlingMoveOrigins.contactDriver ?? contact.wrestlingMoveOrigins.driver;
              const facing = rig.waist.x >= origin.x ? 1 : -1;
              contact.wrestlingMoveOrigins.kickDriver = { x: rig.waist.x - facing * 24, y: v.y };
            }
            if (frame.canGrabAnkle || ankleApproach) {
              contact.wrestlingMoveOrigins.ankles = [rig.feet[0], rig.feet[1]];
              const pickup = arenaAnklePickup({ x: v.x, y: v.y }, rig.feet, frame.side);
              const predicted = { ...driver, ...pickup.holder, pose: 'drag' as const, facing: contact.wrestlingMoveOrigins.ankleFacing ?? -frame.side, gripMode: 'ankle' as const, gripTarget: rig.feet[1], secondaryGripTarget: rig.feet[0], gripStrength: 1, gripLocked: true, animation: undefined, motionImmediate: true };
              contact.wrestlingMoveOrigins.ankleDriver = arenaInsidePoint(arenaCarryHolderPoint(predicted, [rig.feet[1], rig.feet[0]], reduced ? 0 : clock, pickup.holder), 12);
            }
            update({}); apply();
            const attacking = sampleArenaFighterContacts(driver, reduced ? 0 : clock);
            if (frame.canKick && Math.hypot(attacking.feet[1].x - rig.waist.x, attacking.feet[1].y - rig.waist.y) < 7) update({ kickAt: elapsed });
            if (frame.canGrabAnkle && attacking.hands.every((hand, arm) => Math.hypot(hand.x - rig.feet[arm].x, hand.y - rig.feet[arm].y) < 7)) {
              contact.wrestlingMoveOrigins.ankleDriver = { x: a.x, y: a.y };
              if (spinFinish) {
                const midpoint = { x: (rig.feet[0].x + rig.feet[1].x) / 2, y: (rig.feet[0].y + rig.feet[1].y) / 2 };
                contact.wrestlingMoveOrigins.ankleOrbit = Math.atan2((rig.head.y - midpoint.y) / .45, rig.head.x - midpoint.x);
                contact.wrestlingMoveOrigins.ankleFacing ??= driver.facing < 0 ? -1 : 1;
              }
              update({ ankleGripAt: elapsed });
            }
            apply();
          }
          if (frame.canContact && victim && !sim.exits.has(exchange.victim)) {
            const attacking = sampleArenaFighterContacts(driver, reduced ? 0 : clock), defending = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
            const pointGap = (one: ArenaPoint, two: ArenaPoint) => Math.hypot(one.x - two.x, one.y - two.y);
            const segmentGap = (point: ArenaPoint, from: ArenaPoint, to: ArenaPoint) => {
              const dx = to.x - from.x, dy = to.y - from.y, along = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / Math.max(.001, dx * dx + dy * dy));
              return Math.hypot(point.x - from.x - dx * along, point.y - from.y - dy * along);
            };
            const innerArm = { x: attacking.elbows[1].x + (attacking.hands[1].x - attacking.elbows[1].x) * .25, y: attacking.elbows[1].y + (attacking.hands[1].y - attacking.elbows[1].y) * .25 };
            const touched = window.kind === 'clothesline' ? frame.clotheslineStrength > .75 && segmentGap(contact.wrestlingMoveOrigins.target!, attacking.elbows[1], innerArm) < 8 && pointGap(contact.wrestlingMoveOrigins.target!, attacking.hands[1]) > 12
              : window.kind === 'dropkick' ? frame.feetStrength > .9 && attacking.feet.every((foot, leg) => pointGap(foot, frame.footTargets![leg]) < 7)
                : window.kind === 'powerbomb' ? attacking.hands.every((hand, arm) => pointGap(hand, arm === 0 ? defending.waist : { x: defending.waist.x + frame.side * 6, y: defending.waist.y + 3 }) < 7)
                  : window.kind === 'scoopslam' ? attacking.hands.every((hand, arm) => pointGap(hand, arm === 0 ? defending.back : { x: defending.waist.x + ((defending.feet[0].x + defending.feet[1].x) / 2 - defending.waist.x) * .28, y: defending.waist.y + ((defending.feet[0].y + defending.feet[1].y) / 2 - defending.waist.y) * .28 }) < 6)
                    : attacking.hands.some(hand => pointGap(hand, defending.waist) < 6);
            if (touched) {
              contact.wrestlingMoveOrigins.contactDriver = { x: a.x, y: a.y }; contact.wrestlingMoveOrigins.contactVictim = { x: v.x, y: v.y };
              if (window.kind === 'clothesline') {
                contact.wrestlingMoveOrigins.contactDriverVelocity = { ...frame.driverVelocity };
                contact.wrestlingMoveOrigins.contactDriverHeight = frame.driverHeight;
                contact.wrestlingMoveOrigins.contactDriverAngle = frame.driverAngle;
                contact.wrestlingMoveOrigins.contactFlightProgress = frame.dropkickProgress;
              }
              if (window.kind === 'scoopslam') {
                contact.wrestlingMoveOrigins.scoopWaist = { ...defending.waist };
                const floor = arenaInsidePoint({ x: a.x + frame.side * 62, y: v.y }, 12);
                contact.wrestlingMoveOrigins.scoopFloorVictim = floor;
                const flat = sampleArenaFighterContacts({ ...victim, ...floor, pose: 'stunned', angle: frame.side * Math.PI / 2, suspension: 0, slamProgress: { tuck: 0, slump: 1 }, carryStretch: undefined, carrySupport: undefined, scoopVictim: false, animation: undefined, motionImmediate: true }, reduced ? 0 : clock);
                contact.wrestlingMoveOrigins.scoopFloorWaist = flat.waist;

              }
              if (window.kind === 'powerbomb') {
                contact.wrestlingMoveOrigins.powerbombWaist = { ...defending.waist };
                const floor = arenaInsidePoint({ x: a.x + frame.side * 62, y: v.y }, 12);
                contact.wrestlingMoveOrigins.powerbombFloorVictim = floor;
                const flat = sampleArenaFighterContacts({ ...victim, ...floor, pose: 'stunned', angle: frame.side * Math.PI * .47, suspension: 0, slamProgress: { tuck: 0, slump: 1 }, powerbombVictim: false, carryStretch: undefined, animation: undefined, motionImmediate: true }, reduced ? 0 : clock);
                contact.wrestlingMoveOrigins.powerbombFloorWaist = flat.waist;
              }
              if (window.kind === 'backbodydrop') {
                contact.wrestlingMoveOrigins.backBodyWaist = { ...defending.waist };
                const floor = { x: a.x - frame.side * 70, y: v.y };
                const flat = sampleArenaFighterContacts({ ...victim, ...floor, pose: 'stunned', angle: -frame.side * Math.PI * .53, suspension: 0, slamProgress: { tuck: 0, slump: 1 }, jumpTuck: 0, animation: undefined, motionImmediate: true }, reduced ? 0 : clock);
                contact.wrestlingMoveOrigins.backBodyFloorWaist = flat.waist;
              }
              if (window.kind === 'spinebuster') {
                contact.wrestlingMoveOrigins.spineWaist = { ...defending.waist };
                const floor = arenaInsidePoint({ x: a.x - frame.side * 62, y: v.y }, 12);
                contact.wrestlingMoveOrigins.spineFloorVictim = floor;
                const flat = sampleArenaFighterContacts({ ...victim, ...floor, pose: 'stunned', angle: -frame.side * Math.PI * .53, suspension: 0, slamProgress: { tuck: 0, slump: 1 }, carryStretch: undefined, spineCarry: false, animation: undefined, motionImmediate: true }, reduced ? 0 : clock);
                contact.wrestlingMoveOrigins.spineFloorWaist = flat.waist;
              }
              update({ contactAt: elapsed }); apply();
              const impact = frame.requiredReleaseAt;
              contact.round = { ...exchange, impact, resolve: Math.max(impact + 1100 * unit, frame.requiredEndAt), end: Math.max(impact + 1100 * unit, frame.requiredEndAt) }; exchange = contact.round;
              if (!reduced) effects.push(() => clash(ctx, contact.wrestlingMoveOrigins!.target!, 0, 1.1));
            }
          }
          if (frame.slamImpactAt !== undefined && victim) {
            const impactAge = elapsed - frame.slamImpactAt;
            if (impactAge >= 0 && impactAge < 680 && !reduced) {
              const scoop = window.kind === 'scoopslam';
              const impactPoint = scoop ? { x: contact.wrestlingMoveOrigins.scoopFloorWaist?.x ?? victim.x, y: contact.wrestlingMoveOrigins.scoopFloorVictim?.y ?? frame.victim.y } : { x: victim.x, y: frame.victim.y };
              effects.push(() => { dust(ctx, impactPoint.x, impactPoint.y, impactAge, scoop ? 2.6 : 1.8); if (scoop && impactAge < 200) clash(ctx, impactPoint, impactAge * 1.6, .95); });
              collisionShake = Math.sin(impactAge * .10) * (scoop ? 5.5 : 4) * frame.slamImpact;
            }
          }
          if (frame.canRelease && victim && !sim.exits.has(exchange.victim)) {
            update({ releaseAt: elapsed }); apply();
            if (frame.ankleSpin) {
              const rig = sampleArenaFighterContacts(driver, reduced ? 0 : clock);
              contact.pairArmRelease ??= new Map();
              const state = driver.animation;
              contact.pairArmRelease.set(exchange.aggressor, { hands: [rig.hands[0], rig.hands[1]], elbows: [rig.elbows[0], rig.elbows[1]], shoulders: [rig.shoulders[0], rig.shoulders[1]], root: { x: a.x, y: a.y }, facing: driver.facing, stance: state?.motion ? { crouch: (state.supportHip?.y ?? state.motion.crouch - 20) + 20, hipX: state.supportHip?.x ?? state.motion.hipX, lean: state.motion.lean, head: state.motion.head, shoulderLift: state.motion.shoulderLift, contact: state.motion.contact } : undefined });
            }
            const side = frame.finishSide ?? (frame.gripMode === 'ankle' ? victim.x >= driver.x ? 1 : -1 : window.kind === 'backbodydrop' ? -frame.side : frame.side);
            const lift = Math.max(0, (victim.depthY ?? v.y) - victim.y);
            const exit = makeExit(exchange, { x: victim.x, y: victim.y + lift }, lift, victim.angle, 0, side);
            exit.spinSnapshot = arenaReleaseSnapshot(victim, reduced ? 0 : clock);
            if (frame.ankleSpin) {
              const prior = arenaWrestlingMoveTargets(window, elapsed - 1, contact.center, contact.wrestlingMoveOrigins, exchange.contactSide);
              const targetBefore = (actual: ArenaPoint, arm: number) => ({ x: actual.x + prior.gripTargets![arm].x - frame.gripTargets![arm].x, y: actual.y + prior.gripTargets![arm].y - frame.gripTargets![arm].y });
              const priorDriver = { ...driver, pose: prior.driverPose, phase: prior.driverPhase, overheadRaise: prior.overheadRaise, ankleThrowProgress: prior.ankleThrowProgress, ankleSpinRaise: frame.ankleSpin.planar ? prior.ankleSpinRaise : prior.ankleSpin?.weight, gripTarget: targetBefore(driver.gripTarget!, 1), secondaryGripTarget: targetBefore(driver.secondaryGripTarget!, 0) };
              const priorHands = sampleArenaFighterContacts(priorDriver, reduced ? 0 : clock).hands;
              releaseSpin(exit, victim, driver, frame.ankleSpin.orbit, frame.ankleOrbitVelocity ?? frame.ankleAngularVelocity ?? 0, !!frame.ankleSpin.planar, priorHands);

            }
            exit.launchedAt = elapsed; exit.heldFacing = victim.facing; sim.exits.set(exchange.victim, exit);
            driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0; driver.gripLocked = false;
            const releasedArms = contact.pairArmRelease?.get(exchange.aggressor);
            if (releasedArms) { const followThrough = spinFollowThrough(exit); driver.carrierRelease = { ...releasedArms, progress: 0, direction: Math.sign(followThrough?.x ?? 0) || driver.facing, followThrough }; }
            const resolve = Math.max(elapsed + Math.max(1100 * unit, (exit.spinFlight?.duration ?? 0) + 560), frame.requiredEndAt);
            contact.round = { ...exchange, wrestlingMove: { ...window, end: resolve }, impact: elapsed, resolve, end: resolve }; exchange = contact.round;
          }
          if (frame.missed && !sim.exits.has(exchange.victim)) fallback();
          else if (frame.recovered && window.contactAt === null && !sim.exits.has(exchange.victim)) fallback();
          arenaActionWords(exchange, elapsed).forEach(word => words.set(word.id, word.word));
          if (frame.stage === 'groggy' || frame.stage === 'ankle-approach') words.set(exchange.victim, '기절!');
          continue;
        }
      }
      if (exchange.kickCatch && a && v && elapsed >= exchange.kickCatch.start) {
        const catcher = actors.get(exchange.aggressor)!, kicker = actors.get(exchange.victim);
        if (sim.exits.has(exchange.victim)) {
          catcher.pose = 'throw'; catcher.phase = clamp((elapsed - exchange.impact) / 350);
          catcher.gripTarget = undefined; catcher.secondaryGripTarget = undefined; catcher.gripStrength = 0;
          if (elapsed - exchange.impact < 450) words.set(exchange.aggressor, '던지기!');
          continue;
        }
        if (!kicker) continue;
        if (!contact.kickCatchOrigins) {
          const side = v.x >= a.x ? 1 : -1;
          catcher.pose = 'guard'; catcher.facing = side; catcher.gripTarget = undefined; catcher.secondaryGripTarget = undefined;
          prepareContactActor(catcher);
          const hands = sampleArenaFighterContacts(catcher, reduced ? 0 : clock).hands;
          const origins: ArenaKickCatchOrigins = { catcher: { x: a.x, y: a.y }, kicker: { x: v.x, y: v.y }, kickTarget: { x: (hands[0].x + hands[1].x) / 2, y: (hands[0].y + hands[1].y) / 2 }, kickLeg: 1 };
          const window = { ...exchange.kickCatch, start: elapsed };
          const initial = arenaKickCatchTargets(window, elapsed, contact.center, origins, side);
          if (!initial.canPerform) {
            contact.round = { ...exchange, kickCatch: undefined, tactic: 'brace' }; exchange = contact.round;
          } else {
            contact.kickCatchOrigins = origins;
            contact.round = { ...exchange, contactSide: side, kickCatch: { ...window, plannedLaunchAt: initial.plannedLaunchAt } }; exchange = contact.round;
          }
        }
        if (exchange.kickCatch && contact.kickCatchOrigins) {
          let window = exchange.kickCatch, frame = arenaKickCatchTargets(window, elapsed, contact.center, contact.kickCatchOrigins, exchange.contactSide);
          if (window.launchAt === null && frame.canLaunch) {
            contact.kickCatchOrigins.launchOrigin = { ...frame.kicker };
            window = { ...window, launchAt: elapsed };
            contact.round = { ...exchange, kickCatch: window }; exchange = contact.round;
            frame = arenaKickCatchTargets(window, elapsed, contact.center, contact.kickCatchOrigins, exchange.contactSide);
          }
          a.x = frame.catcher.x; a.y = frame.catcher.y; a.facing = frame.catcherFacing;
          v.x = frame.kicker.x; v.y = frame.kicker.y; v.facing = frame.kickerFacing;
          catcher.x = a.x; catcher.y = a.y; catcher.facing = a.facing; catcher.pose = frame.catcherPose;
          catcher.pivotTurn = frame.pivotTurn; catcher.phase = frame.spinProgress;
          catcher.gripTarget = undefined; catcher.secondaryGripTarget = undefined; catcher.gripStrength = 0;
          kicker.x = v.x; kicker.y = v.y - frame.kickerHeight; kicker.depthY = v.y; kicker.facing = v.facing;
          kicker.pose = frame.kickerPose; kicker.phase = frame.kickerPhase; kicker.angle = frame.kickerAngle; kicker.suspension = frame.kickerSuspension;
          kicker.footTarget = frame.footTarget; kicker.footStrength = frame.footStrength; kicker.kickLeg = frame.kickLeg;
          kicker.gripTarget = undefined; kicker.secondaryGripTarget = undefined; kicker.gripStrength = 0;
          prepareContactActor(catcher); prepareContactActor(kicker);
          if (frame.canCatch) {
            const foot = sampleArenaFighterContacts(kicker, reduced ? 0 : clock).feet[frame.kickLeg];
            const target = foot;
            catcher.pose = 'grapple'; catcher.gripTarget = { x: target.x, y: target.y + 3 }; catcher.secondaryGripTarget = { x: target.x, y: target.y - 3 };
            catcher.gripMode = 'ankle'; catcher.gripStrength = 1; catcher.gripLocked = true;
            const palms = sampleArenaFighterContacts(catcher, reduced ? 0 : clock).hands;
            if (palms.every(hand => Math.hypot(hand.x - foot.x, hand.y - foot.y) < 8)) {
              contact.kickCatchOrigins.caughtFoot = { ...foot };
              contact.kickCatchOrigins.caughtKicker = { x: v.x, y: v.y };
              contact.kickCatchOrigins.caughtCatcher = { x: a.x, y: a.y };
              contact.kickCatchOrigins.caughtHeight = frame.kickerHeight;
              window = { ...window, catchAt: elapsed };
              frame = arenaKickCatchTargets(window, elapsed, contact.center, contact.kickCatchOrigins, exchange.contactSide);
              const impact = frame.releaseAt!;
              contact.round = { ...exchange, kickCatch: { ...window, end: impact + 1100 * unit }, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit }; exchange = contact.round;
            }
          }
          if (frame.spin) {
            catcher.pose = frame.catcherPose; catcher.pivotTurn = frame.pivotTurn;
            catcher.gripTarget = frame.gripTargets[1]; catcher.secondaryGripTarget = frame.gripTargets[0];
            catcher.gripMode = 'ankle'; catcher.gripStrength = 1; catcher.gripLocked = true;
            // Preserve the caught sidekick rig at weight zero, then pivot the
            // supported body by its ankle without changing its limb lengths.
            kicker.pose = 'sidekick'; kicker.footTarget = contact.kickCatchOrigins.caughtFoot!; kicker.footStrength = 1;
            kicker.spinSuspension = { ...frame.spin, grips: frame.gripTargets };
            const snapshot = arenaSpinSnapshot(kicker, reduced ? 0 : clock);
            const depthY = a.y + Math.sin(frame.spin.orbit) * 112 * .20 * frame.spin.weight;
            kicker.x = snapshot.origin.x; kicker.y = snapshot.origin.y; kicker.depthY = depthY;
            v.x = snapshot.origin.x; v.y = depthY; v.motorX = 0; v.motorY = 0;
            if (frame.releaseAt !== null && elapsed >= frame.releaseAt) {
              const lift = Math.max(0, depthY - snapshot.origin.y);
              const exit = makeExit(exchange, { x: snapshot.origin.x, y: snapshot.origin.y + lift }, lift, 0, 0, frame.side);
              exit.spinSnapshot = snapshot; exit.launchedAt = frame.releaseAt; exit.heldFacing = kicker.facing;
              sim.exits.set(exchange.victim, exit);
            }
          } else if (window.launchAt != null && elapsed >= frame.landingAt + ARENA_KICK_CATCH_TIMING.land + ARENA_KICK_CATCH_TIMING.recover) {
            const impact = elapsed + 3000 * unit;
            contact.round = { ...exchange, kickCatch: undefined, tactic: 'brace', start: elapsed, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit }; exchange = contact.round;
          }
          words.set(exchange.victim, frame.stage === 'approach' ? '돌진!' : frame.stage === 'load' || frame.stage === 'jump' ? '도약!' : frame.stage === 'kick' ? '옆차기!' : frame.spin ? '잡혔다!' : '착지!');
          if (frame.spin) words.set(exchange.aggressor, frame.stage === 'catch' ? '킥 캐치!' : frame.stage === 'release' ? '던지기!' : '회전!');
          continue;
        }
      }
      if (exchange.supermanPunch && a && v && elapsed >= exchange.supermanPunch.start) {
        const driver = actors.get(exchange.aggressor)!, victim = actors.get(exchange.victim);
        if (!contact.supermanPunchOrigins) {
          if (!victim) continue;
          const side = v.x >= a.x ? 1 : -1;
          victim.pose = 'guard'; victim.facing = -side; v.facing = -side;
          victim.gripTarget = undefined; victim.secondaryGripTarget = undefined; victim.gripStrength = 0;
          prepareContactActor(victim);
          const head = sampleArenaFighterContacts(victim, reduced ? 0 : clock).head;
          const origins: ArenaSupermanPunchOrigins = { driver: { x: a.x, y: a.y }, victim: { x: v.x, y: v.y }, target: { x: head.x, y: head.y + victim.scale * 10 } };
          const window = { ...exchange.supermanPunch, start: elapsed };
          const initial = arenaSupermanPunchTargets(window, elapsed, contact.center, origins, side);
          if (!initial.canPerform) {
            contact.round = { ...exchange, supermanPunch: undefined };
            continue;
          }
          contact.supermanPunchOrigins = origins;
          contact.round = { ...exchange, contactSide: side, supermanPunch: { ...window, plannedLaunchAt: initial.plannedLaunchAt } }; exchange = contact.round;
        }
        let window = exchange.supermanPunch!, frame = arenaSupermanPunchTargets(window, elapsed, contact.center, contact.supermanPunchOrigins, exchange.contactSide);
        const plantedForPunch = a.animation?.pose === 'guard' && a.animation.feet?.every(foot => foot.lift < .12 && !foot.swinging)
          && a.animation.contactPoints?.feet.every(foot => Math.abs(foot.y - (a.y - 2 * driver.scale)) < .5);
        if (window.launchAt === null && frame.canLaunch && (reset || plantedForPunch)) {
          contact.supermanPunchOrigins.launchOrigin = { ...frame.driver };
          window = { ...window, launchAt: elapsed };
          contact.round = { ...exchange, supermanPunch: window }; exchange = contact.round;
          frame = arenaSupermanPunchTargets(window, elapsed, contact.center, contact.supermanPunchOrigins, exchange.contactSide);
        }
        a.x = frame.driver.x; a.y = frame.driver.y; a.facing = frame.driverFacing; a.motorX = frame.driverVelocity.x; a.motorY = frame.driverVelocity.y;
        driver.x = a.x; driver.y = a.y - frame.height; driver.depthY = a.y; driver.facing = a.facing;
        driver.pose = frame.driverPose; driver.phase = frame.stage === 'land' ? frame.landProgress : frame.driverPhase; driver.angle = 0; driver.yaw = 0;
        driver.supermanRun = frame.stage === 'approach'; driver.supermanLoad = frame.stage === 'load' ? frame.loadProgress : undefined;
        driver.supermanProgress = frame.driverPhase; driver.punchTarget = frame.punchTarget; driver.punchStrength = frame.punchStrength;
        driver.suspension = frame.suspension; driver.chargePreparation = frame.loadProgress * .4;
        driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0;
        prepareContactActor(driver);
        driver.velocityX = frame.driverVelocity.x; driver.velocityY = frame.driverVelocity.y;
        if (victim && !sim.exits.has(exchange.victim)) {
          victim.x = frame.victim.x; victim.y = frame.victim.y; victim.depthY = frame.victim.y;
          victim.pose = 'guard'; victim.facing = -frame.side; victim.angle = 0;
          victim.gripTarget = undefined; victim.secondaryGripTarget = undefined; victim.gripStrength = 0;
          v.x = frame.victim.x; v.y = frame.victim.y; v.facing = victim.facing;
          prepareContactActor(victim);
          if (window.hitAt === null && frame.canHit) {
            const fist = sampleArenaFighterContacts(driver, reduced ? 0 : clock).hands[1];
            const head = sampleArenaFighterContacts(victim, reduced ? 0 : clock).head;
            const target = { x: head.x, y: head.y + victim.scale * 10 };
            if (Math.hypot(fist.x - target.x, fist.y - target.y) < 5) {
              window = { ...window, hitAt: elapsed, end: elapsed + 1100 * unit };
              contact.round = { ...exchange, supermanPunch: window, impact: elapsed, resolve: window.end, end: window.end }; exchange = contact.round;
              const exit = makeExit(exchange, { x: v.x, y: v.y }, 0, 0, 0, frame.side);
              exit.launchedAt = elapsed; exit.heldFacing = victim.facing; sim.exits.set(exchange.victim, exit);
            driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0; driver.gripLocked = false;
            const releasedArms = contact.pairArmRelease?.get(exchange.aggressor);
            if (releasedArms) driver.carrierRelease = { ...releasedArms, progress: 0, direction: driver.facing };
              if (!reduced) effects.push(() => clash(ctx, target, 0, 1.3));
            }
          }
          if (window.hitAt === null && window.launchAt != null && elapsed >= frame.landingAt) {
            // A miss finishes the jump on the sand, then resumes the ordinary
            // exchange rather than suspending a fighter or inventing a hit.
            const impact = elapsed + 3000 * unit;
            contact.round = { ...exchange, supermanPunch: undefined, start: elapsed, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
          }
        }
        words.set(exchange.aggressor, frame.stage === 'approach' ? '돌진!' : frame.stage === 'load' ? '도약 준비!' : frame.stage === 'jump' ? '도약!' : frame.stage === 'punch' ? '슈퍼맨 펀치!' : '착지!');
        if (window.hitAt != null) words.set(exchange.victim, '장외로!');
        if (!reduced && frame.stage === 'load') effects.push(() => dust(ctx, a.x, a.y, (elapsed - frame.plannedLaunchAt + 180), .3));
        continue;
      }
      if (exchange.slideTrip && a && v && elapsed >= exchange.slideTrip.start) {
        const driver = actors.get(exchange.aggressor)!, victim = actors.get(exchange.victim);
        if (sim.exits.has(exchange.victim)) {
          const frame = arenaSlideTripTargets(exchange.slideTrip, elapsed, contact.center, contact.slideTripOrigins, exchange.contactSide);
          driver.pose = 'trip'; driver.frontKick = frame.frontKick; driver.phase = frame.driverPhase;
          driver.footTarget = undefined; driver.footStrength = 0; driver.gripTarget = undefined; driver.secondaryGripTarget = undefined;
          continue;
        }
        if (!victim) continue;
        if (!contact.slideTripOrigins) {
          victim.pose = 'guard'; prepareContactActor(victim);
          const side = v.x >= a.x ? 1 : -1, feet = sampleArenaFighterContacts(victim, reduced ? 0 : clock).feet;
          const ankle = [...feet].sort((first, second) => Math.hypot(first.x - a.x, first.y - a.y) - Math.hypot(second.x - a.x, second.y - a.y))[0];
          const origins: ArenaSlideTripOrigins = { driver: { x: a.x, y: a.y }, victim: { x: v.x, y: v.y }, standingAnkle: ankle };
          const initial = arenaSlideTripTargets({ ...exchange.slideTrip, start: elapsed }, elapsed, contact.center, origins, side);
          if (!initial.canPerform) {
            // A running slide needs a real runway. A close opponent stays in
            // the normal trip exchange instead of stepping backwards first.
            contact.round = { ...exchange, slideTrip: undefined }; continue;
          }
          contact.slideTripOrigins = origins;
          contact.round = { ...exchange, contactSide: side, slideTrip: { ...exchange.slideTrip, start: elapsed, plannedLaunchAt: initial.plannedLaunchAt, plannedPassAt: initial.plannedHookAt } }; exchange = contact.round;
        }
        let window = exchange.slideTrip!, frame = arenaSlideTripTargets(window, elapsed, contact.center, contact.slideTripOrigins, exchange.contactSide);
        a.x = frame.driver.x; a.y = frame.driver.y; a.facing = frame.driverFacing;
        if (window.launchAt === null && frame.canLaunch) {
          contact.slideTripOrigins.slideOrigin = { x: a.x, y: a.y };
          window = { ...window, launchAt: elapsed }; contact.round = { ...exchange, slideTrip: window }; exchange = contact.round;
          frame = arenaSlideTripTargets(window, elapsed, contact.center, contact.slideTripOrigins, exchange.contactSide);
        }
        if (window.evade && frame.canJump) {
          window = { ...window, jumpAt: elapsed }; contact.round = { ...exchange, slideTrip: window }; exchange = contact.round;
          frame = arenaSlideTripTargets(window, elapsed, contact.center, contact.slideTripOrigins, exchange.contactSide);
        }
        driver.x = a.x; driver.y = a.y; driver.facing = a.facing; driver.angle = 0; driver.pose = frame.driverPose;
        driver.slideProgress = frame.slideProgress; driver.phase = frame.driverPhase; driver.frontKick = frame.frontKick;
        driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0;
        driver.footTarget = frame.driverFootTarget; driver.footStrength = frame.footStrength; driver.kickLeg = 1;
        v.x = frame.victim.x; v.y = frame.victim.y;
        victim.x = v.x; victim.y = v.y - frame.victimHeight; victim.depthY = v.y; victim.facing = -frame.side; victim.pose = frame.victimPose;
        victim.angle = frame.victimAngle; victim.suspension = frame.victimSuspension; victim.slamProgress = frame.victimSlam;
        if (window.evade) { victim.jumpTuck = frame.victimJumpTuck; victim.phase = frame.victimPhase; }
        victim.gripTarget = undefined; victim.secondaryGripTarget = undefined; victim.gripStrength = 0;
        prepareContactActor(driver); prepareContactActor(victim);
        if (window.evade) {
          if (frame.canPass) {
            const driverFeet = sampleArenaFighterContacts(driver, reduced ? 0 : clock).feet;
            const victimFeet = sampleArenaFighterContacts(victim, reduced ? 0 : clock).feet;
            const ankle = contact.slideTripOrigins.standingAnkle!;
            if (driverFeet.some(foot => Math.hypot(foot.x - ankle.x, foot.y - ankle.y) < 8) && victimFeet.every(foot => foot.y < ankle.y - 16)) {
              window = { ...window, passAt: elapsed }; contact.round = { ...exchange, slideTrip: window }; exchange = contact.round;
            }
          }
          if (frame.recovered) {
            // The missed tackle ends on the sand. The same drawn opponents
            // decide the place through the following ordinary exchange.
            const impact = elapsed + 3200 * unit;
            contact.round = { ...exchange, slideTrip: undefined, start: elapsed, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
          }
          if (frame.stage === 'approach' || frame.driverPose === 'slide') words.set(exchange.aggressor, frame.stage === 'approach' ? '돌진!' : '슬라이딩!');
          if (frame.stage === 'jump' || frame.stage === 'pass') words.set(exchange.victim, '두 발 점프!');
          else if (frame.stage === 'land') words.set(exchange.victim, '착지!');
          if (!reduced && frame.driverPose === 'slide') effects.push(() => dust(ctx, driver.x - frame.side * 20, driver.y, (elapsed - (window.launchAt ?? elapsed)) % 420, .5));
          continue;
        }
        if (window.hookAt === null && frame.canHook) {
          const feet = sampleArenaFighterContacts(driver, reduced ? 0 : clock).feet, ankle = contact.slideTripOrigins.standingAnkle!;
          if (feet.some(foot => Math.hypot(foot.x - ankle.x, foot.y - ankle.y) < 8)) {
            contact.slideTripOrigins.hookDriver = { x: a.x, y: a.y }; contact.slideTripOrigins.hookVictim = { x: v.x, y: v.y };
            window = { ...window, hookAt: elapsed }; contact.round = { ...exchange, slideTrip: window }; exchange = contact.round;
          }
        }
        if (frame.canKick) {
          const waist = sampleArenaFighterContacts(victim, reduced ? 0 : clock).waist;
          contact.slideTripOrigins.kickTarget = waist; driver.footTarget = waist;
          if ((frame.frontKick ?? 0) >= .615) {
            const feet = sampleArenaFighterContacts(driver, reduced ? 0 : clock).feet;
            if (feet.some(foot => Math.hypot(foot.x - waist.x, foot.y - waist.y) < 8)) {
              window = { ...window, kickAt: elapsed, end: elapsed + 1100 * unit };
              contact.round = { ...exchange, slideTrip: window, impact: elapsed, resolve: window.end, end: window.end }; exchange = contact.round;
              const exit = makeExit(exchange, { x: v.x, y: v.y }, 0, victim.angle, 0, frame.side);
              exit.launchedAt = elapsed; sim.exits.set(exchange.victim, exit);
              if (!reduced) effects.push(() => clash(ctx, waist, 0, .9));
            }
          }
        }
        else if (frame.stage === 'rise') contact.slideTripOrigins.kickTarget = sampleArenaFighterContacts(victim, reduced ? 0 : clock).waist;
        if (frame.stage !== 'rise') words.set(exchange.aggressor, frame.stage === 'approach' ? '돌진!' : frame.stage === 'slide' || frame.stage === 'hook' ? '슬라이딩!' : frame.stage === 'kick' ? '발차기!' : '발걸기!');
        if (!reduced && frame.driverPose === 'slide') effects.push(() => dust(ctx, driver.x - frame.side * 20, driver.y, (elapsed - (window.launchAt ?? elapsed)) % 420, .5));
        continue;
      }
      if (exchange.linkedRush && exchange.helper && a && v && !contact.pairCarryOrigins && elapsed >= exchange.linkedRush.start) {
        const pairIds = [exchange.aggressor, exchange.helper], pair = pairIds.map(id => sim.bodies.get(id)!);
        const target = actors.get(exchange.victim)!;
        target.pose = 'guard'; target.gripTarget = undefined; target.secondaryGripTarget = undefined; target.gripStrength = 0;
        prepareContactActor(target);
        if (!contact.linkedRushOrigins) {
          const head = sampleArenaFighterContacts(target, reduced ? 0 : clock).head;
          const origins: ArenaLinkedRushOrigins = { pair: [{ x: pair[0].x, y: pair[0].y }, { x: pair[1].x, y: pair[1].y }], victim: { x: v.x, y: v.y }, neck: { x: head.x, y: head.y + target.scale * 20 } };
          const left = pair[0].x <= pair[1].x ? 0 : 1;
          origins.strikeTargets = pair.map((_, index) => ({ x: head.x + (index === left ? -4 : 4) * target.scale, y: origins.neck!.y + (index === left ? 0 : 3) * target.scale })) as [ArenaPoint, ArenaPoint];
          const initial = arenaLinkedRushTargets(exchange.linkedRush, elapsed, contact.center, origins, unit);
          origins.shoulderOffsets = pairIds.map((id, index) => {
            const actor = { ...actors.get(id)!, pose: 'run' as const, facing: initial.pairFacing[index], clotheslineArm: initial.clotheslineArms[index], animation: undefined, motionImmediate: true };
            const shoulder = sampleArenaFighterContacts(actor, reduced ? 0 : clock).shoulders[actor.clotheslineArm];
            return { x: shoulder.x - actor.x, y: shoulder.y - actor.y };
          }) as [ArenaPoint, ArenaPoint];
          const frame = arenaLinkedRushTargets(exchange.linkedRush, elapsed, contact.center, origins, unit);
          if (!frame.canHit) {
            contact.round = { ...exchange, linkedRush: undefined, rushLaunchAt: null, rushContactAt: undefined }; exchange = contact.round;
            contact.chargerOrigin = { x: v.x, y: v.y };
          } else contact.linkedRushOrigins = origins;
        }
        if (contact.linkedRushOrigins) {
          let window = exchange.linkedRush!, frame = arenaLinkedRushTargets(window, elapsed, contact.center, contact.linkedRushOrigins, unit);
          for (const [index, id] of pairIds.entries()) {
            const body = pair[index], actor = actors.get(id)!;
            body.x = frame.pair[index].x; body.y = frame.pair[index].y; body.facing = frame.pairFacing[index];
            actor.x = body.x; actor.y = body.y; actor.facing = body.facing; actor.angle = 0;
            actor.pose = frame.stage === 'charge' ? 'run' : frame.stage === 'approach' && elapsed < frame.readyAt ? 'walk' : 'guard';
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
            actor.clotheslineArm = frame.clotheslineArms[index]; actor.clotheslineStrength = frame.strikeStrength; actor.clotheslineTarget = frame.strikeHands[index];
            // Each runner extends a separate arm across the target's upper body.
            // Depthward gait keeps its actual shoulder and forearm at that height.
            actor.chargePreparation = 0; actor.chargeStrength = 0;
            prepareContactActor(actor);
          }
          const first = actors.get(pairIds[0])!, second = actors.get(pairIds[1])!;
          const firstRig = sampleArenaFighterContacts(first, reduced ? 0 : clock), secondRig = sampleArenaFighterContacts(second, reduced ? 0 : clock);
          const arms = [first.clotheslineArm!, second.clotheslineArm!] as [0 | 1, 0 | 1];
          const hands = [firstRig.hands[arms[0]], secondRig.hands[arms[1]]];
          if (window.launchAt === null && elapsed >= frame.readyAt && frame.strikeStrength > .98 && hands.every((hand, index) => Math.hypot(hand.x - frame.strikeHands[index].x, hand.y - frame.strikeHands[index].y) < 4)) {
            window = { ...window, launchAt: elapsed };
            frame = arenaLinkedRushTargets(window, elapsed, contact.center, contact.linkedRushOrigins, unit);
            contact.round = { ...exchange, linkedRush: window, impact: frame.requiredEndAt, resolve: frame.requiredEndAt + 1100 * unit, end: frame.requiredEndAt + 1100 * unit }; exchange = contact.round;
          }
          const neckHead = sampleArenaFighterContacts(target, reduced ? 0 : clock).head;
          const neck = { x: neckHead.x, y: neckHead.y + target.scale * 20 };
          const strikes = contact.linkedRushOrigins.strikeTargets!.map(point => ({ x: neck.x + point.x - contact.linkedRushOrigins!.neck!.x, y: neck.y + point.y - contact.linkedRushOrigins!.neck!.y }));
          const forearms = [firstRig, secondRig].map((rig, index) => ({ elbow: rig.elbows[arms[index]], hand: hands[index] }));
          const actualHits = forearms.every(({ elbow, hand }, index) => {
            const point = strikes[index], dx = hand.x - elbow.x, dy = hand.y - elbow.y, length = dx * dx + dy * dy;
            const along = clamp(((point.x - elbow.x) * dx + (point.y - elbow.y) * dy) / Math.max(.001, length));
            return Math.hypot(point.x - elbow.x - along * dx, point.y - elbow.y - along * dy) < 8;
          });
          // Both independently extended forearms touch the actual neck/chest.
          // Those exact roots then enter the existing groggy fall and shared lift.
          if (window.launchAt != null && elapsed >= window.launchAt + 180 && actualHits) {
            contact.pairCarryOrigins = { victim: { x: v.x, y: v.y }, pair: [{ x: pair[0].x, y: pair[0].y }, { x: pair[1].x, y: pair[1].y }], direction: frame.direction, facing: target.facing < 0 ? -1 : 1 };
            contact.linkedRelease = { at: elapsed, hands: [{ ...hands[0] }, { ...hands[1] }], roots: contact.pairCarryOrigins.pair, arms, facings: [first.facing, second.facing] };
            contact.center = { x: v.x, y: v.y }; contact.chargerOrigin = { x: v.x, y: v.y };
            const side = pair[0].x >= pair[1].x ? 1 : -1, impact = elapsed + ARENA_PAIR_COUNTER_TIMING.release;
            contact.round = { ...exchange, contactSide: side, linkedRush: { ...window, contactAt: elapsed, end: impact }, rushLaunchAt: window.launchAt, rushContactAt: elapsed, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit }; exchange = contact.round;
            if (!reduced) effects.push(() => clash(ctx, neck, 0, 1.2));
          } else {
            for (const id of pairIds) words.set(id, window.launchAt == null ? '팔 뻗기!' : '돌진!');
            continue;
          }
        }
      }
      if (exchange.passingTrip && a && v && elapsed >= exchange.passingTrip.start && !contact.passingTripDeclined) {
        if (!contact.passingTripOrigins && !reset) {
          const side = v.x >= a.x ? 1 : -1;
          for (const [id, body, other, sign] of [[exchange.aggressor, a, v, -1], [exchange.victim, v, a, 1]] as const) {
            const actor = actors.get(id)!;
            move(body, { x: contact.center.x + side * sign * 22, y: contact.center.y + sign * 6 }, seconds, 165);
            arenaFaceOpponent(body, other); actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
            actor.pose = Math.hypot(body.x - other.x, body.y - other.y) < 70 ? 'grapple' : 'walk';
            actor.gripTarget = { x: other.x, y: other.y - 46 }; actor.secondaryGripTarget = { x: other.x - body.facing * 6, y: other.y - 43 }; actor.gripMode = 'waist'; actor.gripStrength = 1;
          }
          if (pairHasGrip(exchange.aggressor, exchange.victim)) {
            const nearby = active.filter(id => id !== exchange.aggressor && id !== exchange.victim && !sim.exits.has(id) && !miniParticipants.has(id) && !preparing.has(id))
              .map(id => ({ id, body: sim.bodies.get(id)! })).filter(({ body }) => Math.hypot(body.x - v.x, body.y - v.y) < 95)
              .sort((first, second) => Math.hypot(first.body.x - v.x, first.body.y - v.y) - Math.hypot(second.body.x - v.x, second.body.y - v.y));
            const passer = nearby[0];
            if (passer) {
              const victim = actors.get(exchange.victim)!; prepareContactActor(victim);
              const ankle = sampleArenaFighterContacts(victim, reduced ? 0 : clock).feet.reduce((near, foot) => Math.hypot(foot.x - passer.body.x, foot.y - passer.body.y) < Math.hypot(near.x - passer.body.x, near.y - passer.body.y) ? foot : near);
              const origins = { passer: { x: passer.body.x, y: passer.body.y }, victim: { x: v.x, y: v.y }, opponent: { x: a.x, y: a.y }, standingAnkle: ankle };
              const window = { ...exchange.passingTrip!, start: elapsed, passerId: passer.id, launchAt: null, joined: true };
              const frame = arenaPassingTripTargets(window, elapsed, contact.center, origins, side, unit);
              if (frame.canHook && frame.pickupReachable) {
                contact.passingTripOrigins = origins;
                const impact = Math.max(exchange.impact, frame.requiredImpactAt + 700 * unit);
                contact.round = { ...exchange, contactSide: side, passingTrip: window, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
                exchange = contact.round; sim.minis.delete(passer.id); passer.body.roam = undefined;
              }
            }
            if (!contact.passingTripOrigins) {
              contact.passingTripDeclined = true;
              contact.round = { ...exchange, passingTrip: undefined }; exchange = contact.round;
            }
          }
          if (!contact.passingTripOrigins && !contact.passingTripDeclined) continue;
        }
        if (contact.passingTripOrigins || reset && elapsed < exchange.impact) {
          let window = exchange.passingTrip!;
          let frame = arenaPassingTripTargets(window, elapsed, contact.center, contact.passingTripOrigins, exchange.contactSide, unit);
          const passer = actors.get(window.passerId)!, passerBody = sim.bodies.get(window.passerId)!;
          const victim = actors.get(exchange.victim)!, opponent = actors.get(exchange.aggressor)!;
          if (passer && passerBody) {
            passerBody.x = frame.passer.x; passerBody.y = frame.passer.y;
            passer.x = passerBody.x; passer.y = passerBody.y; passer.facing = frame.passerFacing; passer.pose = frame.passerPose;
            passer.gripTarget = undefined; passer.secondaryGripTarget = undefined; passer.gripStrength = 0;
            passer.footTarget = frame.passerFootTarget; passer.footStrength = frame.footStrength; passer.kickLeg = 1;
            passer.phase = frame.footStrength;
            if (frame.footStrength > .75 && !window.hookAt) {
              prepareContactActor(passer);
              const feet = sampleArenaFighterContacts(passer, reduced ? 0 : clock).feet;
              const touched = feet.some(foot => Math.hypot(foot.x - frame.passerFootTarget.x, foot.y - frame.passerFootTarget.y) < 8);
              if (touched) {
                contact.round = { ...exchange, passingTrip: { ...window, hookAt: elapsed } }; exchange = contact.round; window = exchange.passingTrip!;
                frame = arenaPassingTripTargets(window, elapsed, contact.center, contact.passingTripOrigins, exchange.contactSide, unit);
              }
            }
          }
          if (sim.exits.has(exchange.victim)) {
            opponent.pose = 'overhead'; opponent.overheadRaise = 1; opponent.carrierDrive = 1;
            opponent.gripTarget = undefined; opponent.secondaryGripTarget = undefined; opponent.gripStrength = 0;
            continue;
          }
          if (!window.hookAt && !reset && elapsed >= frame.fallAt) {
            contact.passingTripDeclined = true;
            contact.round = { ...exchange, passingTrip: undefined }; exchange = contact.round;
          } else {
            v.x = frame.victim.x; v.y = frame.victim.y;
            victim.x = v.x; victim.depthY = v.y; victim.y = v.y - frame.lift; victim.facing = -frame.side;
            victim.pose = frame.victimPose; victim.angle = frame.victimAngle; victim.suspension = frame.victimSuspension; victim.slamProgress = frame.victimSlam;
            victim.carryStretch = frame.victimPose === 'carried' ? frame.victimCarryStretch : undefined;
            victim.gripTarget = undefined; victim.secondaryGripTarget = undefined; victim.gripStrength = 0;
            prepareContactActor(victim);
            const feet = sampleArenaFighterContacts(victim, reduced ? 0 : clock).feet;
            if (contact.passingTripOrigins && elapsed >= frame.fallenAt && !contact.passingTripOrigins.fallenFeet) contact.passingTripOrigins.fallenFeet = feet as [ArenaPoint, ArenaPoint];
            const orderedFeet = [...feet].sort((first, second) => second.y - first.y);
            const target = frame.grip ? arenaPassingTripAnkleHolder(orderedFeet, frame.side, frame.overheadRaise) : frame.opponent;
            if (reset) { a.x = target.x; a.y = target.y; }
            else move(a, target, seconds, 165);
            opponent.x = a.x; opponent.y = a.y; opponent.facing = frame.opponentFacing; opponent.angle = 0;
            opponent.pose = frame.grip ? frame.opponentPose : Math.hypot(a.x - target.x, a.y - target.y) > 8 ? 'walk' : 'drag';
            opponent.overheadRaise = frame.overheadRaise; opponent.carrierDrive = frame.overheadRaise;
            opponent.gripMode = 'ankle'; opponent.gripStrength = frame.gripStrength; opponent.gripLocked = frame.grip;
            opponent.gripTarget = frame.grip ? orderedFeet[0] : undefined; opponent.secondaryGripTarget = frame.grip ? orderedFeet[1] : undefined;
            if (frame.grip && window.launchAt === null) {
              prepareContactActor(opponent);
              const hands = sampleArenaFighterContacts(opponent, reduced ? 0 : clock).hands;
              if (orderedFeet.every((foot, index) => Math.hypot(foot.x - hands[1 - index].x, foot.y - hands[1 - index].y) < 4)) {
                window = { ...window, launchAt: elapsed };
                frame = arenaPassingTripTargets(window, elapsed, contact.center, contact.passingTripOrigins, exchange.contactSide, unit);
                window.end = frame.requiredImpactAt + 1100 * unit;
                contact.round = { ...exchange, passingTrip: window, impact: frame.requiredImpactAt, resolve: window.end, end: window.end }; exchange = contact.round;
              }
            }
            if (frame.stage === 'hook') words.set(window.passerId, '발걸기!');
            if (frame.stage === 'fall') words.set(exchange.victim, '넘어진다!');
            if (frame.grip) words.set(exchange.aggressor, frame.stage === 'toss' ? '던지기!' : '발끝 잡기!');
            if (frame.stage === 'release' && !sim.exits.has(exchange.victim)) {
              const exit = makeExit(exchange, { x: victim.x, y: victim.y + frame.lift }, frame.lift, victim.angle, frame.releaseVelocity.x, frame.side);
              exit.heldFacing = victim.facing; exit.launchedAt = frame.requiredImpactAt; sim.exits.set(exchange.victim, exit);
            }
            continue;
          }
        }
      }
      if (exchange.pairDodge && elapsed >= exchange.pairDodge.start && a && v && !contact.pairDodgeFinished) {
        const partner = sim.bodies.get(exchange.pairDodge.partnerId)!;
        if (elapsed >= exchange.pairDodge.start && !contact.pairDodgeOrigins && !reset) {
          contact.round = { ...exchange, pairDodge: { ...exchange.pairDodge, launchAt: null } }; exchange = contact.round;
        }
        const window = exchange.pairDodge!;
        const pairIds = [exchange.aggressor, window.partnerId];
        if (window.launchAt === null) {
          const side = a.x >= partner.x ? 1 : -1;
          for (const [index, id] of pairIds.entries()) {
            const body = sim.bodies.get(id)!, actor = actors.get(id)!, other = index ? a : partner;
            move(body, { x: contact.center.x + (index ? -1 : 1) * side * 22, y: contact.center.y + (index ? -6 : 6) }, seconds, 165);
            arenaFaceOpponent(body, other); actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
            const meeting = Math.hypot(body.x - other.x, body.y - other.y) < 70 && Math.abs(body.y - other.y) < 24;
            actor.pose = meeting ? 'grapple' : 'walk';
            actor.gripTarget = meeting ? { x: other.x, y: other.y - 46 } : undefined; actor.secondaryGripTarget = meeting ? { x: other.x - body.facing * 6, y: other.y - 43 } : undefined; actor.gripStrength = meeting ? 1 : 0; actor.gripMode = 'waist';
          }
          const charger = actors.get(exchange.victim)!;
          charger.pose = 'brace'; charger.chargePreparation = .9; charger.facing = contact.center.x >= v.x ? 1 : -1;
          if (pairHasGrip(pairIds[0], pairIds[1])) {
            contact.center = { x: (a.x + partner.x) / 2, y: (a.y + partner.y) / 2 };
            contact.pairDodgeOrigins = { charger: { x: v.x, y: v.y }, pair: [{ x: a.x, y: a.y }, { x: partner.x, y: partner.y }] };
            const outcome = window.allowOut && arenaPairDodgeCanExit(contact.center, contact.pairDodgeOrigins.charger) ? 'out' : 'escape';
            let actualWindow = { ...window, outcome, launchAt: elapsed } as NonNullable<ArenaRound['pairDodge']>;
            const dodge = arenaPairDodgeTargets(actualWindow, elapsed, contact.center, contact.pairDodgeOrigins, unit);
            actualWindow = { ...actualWindow, contactAt: dodge.contactAt, end: dodge.requiredEndAt };
            const span = exchange.impact - exchange.start;
            const impact = outcome === 'out' ? dodge.outAt! : dodge.requiredEndAt + span;
            contact.round = { ...exchange, pairDodge: actualWindow, start: outcome === 'out' ? window.start : dodge.requiredEndAt, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
            exchange = contact.round;
          } else continue;
        }
        const dodge = arenaPairDodgeTargets(exchange.pairDodge!, elapsed, contact.center, contact.pairDodgeOrigins, unit);
        if (elapsed < exchange.pairDodge!.end || exchange.pairDodge!.outcome === 'out') {
          for (const [index, id] of pairIds.entries()) {
            const body = sim.bodies.get(id)!, actor = actors.get(id)!;
            const point = dodge.pair[index];
            if (reset || dodge.stage !== 'wrestle') { body.x = point.x; body.y = point.y; }
            actor.x = body.x; actor.depthY = body.y; actor.y = body.y - dodge.jumpHeight[index];
            actor.pose = dodge.jumpHeight[index] > .1 ? 'airborne' : dodge.stage === 'land' ? 'land' : 'guard';
            actor.angle = dodge.pairAngle[index]; actor.jumpTuck = dodge.jumpTuck[index]; actor.suspension = dodge.jumpHeight[index] > .1 ? 1 : 0;
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
            if (dodge.stage === 'wrestle') {
              const other = sim.bodies.get(pairIds[1 - index])!;
              actor.pose = 'grapple'; actor.facing = other.x >= actor.x ? 1 : -1;
              actor.gripTarget = { x: other.x, y: other.y - 46 }; actor.gripStrength = 1;
            }
            if (dodge.jumpHeight[index] > 1) words.set(id, '점프 회피!');
          }
          const charger = actors.get(exchange.victim)!;
          if (!sim.exits.has(exchange.victim)) {
            v.x = dodge.charger.x; v.y = dodge.charger.y;
            charger.x = v.x; charger.depthY = v.y; charger.y = v.y - dodge.chargerHeight;
            charger.facing = dodge.chargerFacing; charger.angle = dodge.chargerAngle;
            charger.pose = elapsed < dodge.runAt || Math.hypot(dodge.charger.x - (contact.pairDodgeOrigins?.charger.x ?? dodge.charger.x), dodge.charger.y - (contact.pairDodgeOrigins?.charger.y ?? dodge.charger.y)) < 1 ? 'brace' : dodge.stage === 'recover' || dodge.stage === 'release' ? 'guard' : 'run';
            charger.chargePreparation = dodge.chargePreparation; charger.chargeStrength = dodge.chargeStrength;
            charger.gripTarget = undefined; charger.secondaryGripTarget = undefined; charger.gripStrength = 0;
            if (charger.pose === 'run') words.set(exchange.victim, '돌진!');
            if (exchange.pairDodge!.outcome === 'out' && dodge.outAt !== undefined && elapsed >= dodge.outAt) {
              const exit = makeExit(exchange, { x: v.x, y: v.y }, 0, dodge.chargerAngle, dodge.chargeDirection.x * 162, dodge.chargerFacing);
              exit.launchedAt = dodge.outAt; exit.dodgeFall = { center: contact.center, origins: contact.pairDodgeOrigins! };
              exit.landing = { ...dodge.charger }; sim.exits.set(exchange.victim, exit);
            }
          }
          continue;
        }
        contact.pairDodgeFinished = true;
        contact.center = { x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 };
        contact.round = arenaContactRound(contact.round, contact.center, { aggressor: a, victim: v }); exchange = contact.round;
        contact.started = false; contact.metAt = undefined; contact.committed = false;
      }
      if (exchange.rimCharge && a && v) {
        if (!contact.rimChargeOrigins && elapsed >= exchange.rimCharge.start) {
          const origins = { charger: { x: v.x, y: v.y }, defender: { x: a.x, y: a.y } };
          const planned = arenaRimChargeTargets(exchange, elapsed, contact.center, origins)!;
          const rimX = 500 + planned.side * 303 * Math.sqrt(Math.max(0, 1 - ((a.y - 416) / 112) ** 2));
          const separation = Math.abs(a.x - v.x);
          const viable = Math.abs(rimX - a.x) <= 95 && Math.abs(a.y - v.y) <= 22 && separation >= 86 && separation <= 215 && planned.canRun && planned.canReachRim;
          if (reset && elapsed > 300 * unit || viable) {
            contact.rimChargeOrigins = reset && !viable ? undefined : origins;
            if (planned.outcome === 'dodge') contact.round = { ...contact.round, tactic: 'bait', chargeSetup: { charger: origins.charger, receiver: origins.defender, side: planned.side } };
          } else {
            contact.round = { ...contact.round, start: Math.min(contact.round.start, exchange.rimCharge.start), rimCharge: undefined, tactic: contact.round.tactic === 'bait' ? 'brace' : contact.round.tactic, chargeSetup: undefined };
          }
          exchange = contact.round;
        }
        const charge = arenaRimChargeTargets(exchange, elapsed, contact.center, contact.rimChargeOrigins);
        if (charge?.active) {
          const driver = actors.get(exchange.victim)!, defender = actors.get(exchange.aggressor)!;
          for (const [body, actor, point, facing] of [[v, driver, charge.charger, charge.chargerFacing], [a, defender, charge.defender, charge.defenderFacing]] as const) {
            body.x = point.x; body.y = point.y; body.motorX = 0; body.motorY = 0; body.roam = undefined; body.facing = facing;
            actor.x = point.x; actor.y = point.y; actor.facing = facing; actor.angle = 0; actor.yaw = 0;
            actor.pose = actor === driver ? charge.stage === 'approach' ? 'brace' : charge.stage === 'brace' || charge.stage === 'duel' ? 'grapple' : 'run' : charge.dodge > 0 ? 'dodge' : charge.grip ? 'brace' : 'guard';
            actor.phase = charge.resistance; actor.chargePreparation = actor === driver && charge.stage === 'approach' ? charge.phase / .12 : 0; actor.chargeStrength = actor === driver && charge.stage !== 'approach' && !charge.grip ? 1 : 0;
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0; actor.gripLocked = false;
          }
          if (charge.grip) {
            contact.metAt ??= elapsed;
            for (const [holder, other] of [[driver, defender], [defender, driver]] as const) {
              prepareContactActor(other);
              const waist = sampleArenaFighterContacts(other, reduced ? 0 : clock).waist;
              holder.gripTarget = waist; holder.secondaryGripTarget = { x: waist.x - holder.facing * 6, y: waist.y + 3 }; holder.gripStrength = 1; holder.gripLocked = true; holder.gripMode = 'waist';
            }
            const age = elapsed - charge.contactAt;
            if (!reduced) effects.push(() => clash(ctx, { x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 - 47 }, age, 1.2));
          }
          arenaActionWords(exchange, elapsed).forEach(word => words.set(word.id, word.word));
          continue;
        }
        if (charge && !contact.rimChargeFinished && elapsed >= exchange.rimCharge!.end) {
          contact.rimChargeFinished = true;
          if (reset) for (const [body, point] of [[v, charge.charger], [a, charge.defender]] as const) { body.x = point.x; body.y = point.y; body.motorX = 0; body.motorY = 0; }
          if (charge.outcome === 'resist') {
            contact.center = { x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 };
            contact.round = arenaContactRound(contact.round, contact.center, { aggressor: a, victim: v }); exchange = contact.round; contact.committed = false;
          }
        }
      }
      if (exchange.pushContactAt === null && pushHasContact(exchange.aggressor, exchange.victim)) {
        contact.round = { ...contact.round, pushContactAt: elapsed }; exchange = contact.round;
      }
      if (exchange.rushOutcome && !exchange.linkedRush && exchange.helper && exchange.rushLaunchAt === null) {
        const firstId = exchange.rushOutcome === 'counter-throw' ? exchange.aggressor : exchange.victim;
        if (pairHasGrip(firstId, exchange.helper)) {
          const first = sim.bodies.get(firstId)!, second = sim.bodies.get(exchange.helper)!;
          contact.center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
          contact.round = { ...contact.round, rushLaunchAt: elapsed, contactSide: first.x >= second.x ? 1 : -1 };
          const chargerId = exchange.rushOutcome === 'counter-throw' ? exchange.victim : exchange.aggressor, charger = sim.bodies.get(chargerId)!;
          contact.chargerOrigin = { x: charger.x, y: charger.y };
          const rush = arenaPairRushTargets(contact.round, elapsed, contact.center, contact.chargerOrigin);
          const impact = rush.requiredImpactAt;
          contact.round = { ...contact.round, rushContactAt: rush.contactAt, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
          exchange = contact.round;
        }
      }
      if (exchange.tactic === 'sidekick' && !contact.sidekickLaunched && elapsed >= exchange.start) {
        if (reset && elapsed > 300 * unit) contact.sidekickLaunched = true;
        else if (a && v && Math.hypot(a.x - v.x, a.y - v.y) < 86) {
          contact.sidekickLaunched = true; contact.metAt ??= elapsed;
          contact.round = { ...contact.round, sidekickLaunchAt: elapsed };
        } else if (contact.round.sidekickLaunchAt !== Infinity) contact.round = { ...contact.round, sidekickLaunchAt: Infinity };
        exchange = contact.round;
      }
      if (exchange.rim) {
        if (!contact.rimOrigins && elapsed >= exchange.rim.start && a && v && !reset) {
          contact.rimOrigins = { aggressor: { x: a.x, y: a.y }, victim: { x: v.x, y: v.y } };
          contact.round = { ...contact.round, rim: { ...exchange.rim, contactAt: null } }; exchange = contact.round;
        }
        if (exchange.rim!.contactAt === null && pushHasContact(exchange.aggressor, exchange.victim)) {
          contact.round = { ...contact.round, rim: { ...exchange.rim!, contactAt: elapsed } }; exchange = contact.round;
        }
        const rim = arenaRimTargets(exchange, elapsed, contact.center, contact.rimOrigins)!;
        if (rim.active && a && v) {
          const driver = actors.get(exchange.aggressor)!, defender = actors.get(exchange.victim)!;
          for (const [body, actor, point, facing] of [[a, driver, rim.aggressor, rim.side], [v, defender, rim.victim, -rim.side]] as const) {
            // This path already moves both planted bodies together. A second
            // motor would leave the defender behind the hands during a push.
            body.x = point.x; body.y = point.y; body.motorX = 0; body.motorY = 0; body.facing = facing; body.roam = undefined;
            actor.x = point.x; actor.y = point.y; actor.facing = facing;
            const touching = Math.hypot(a.x - v.x, a.y - v.y) < 72;
            actor.pose = rim.stage === 'approach' ? touching ? actor === driver ? 'push' : 'brace' : 'walk' : rim.stage === 'release' ? 'guard' : actor === driver ? 'push' : 'brace';
            actor.phase = rim.pressure; actor.power = .8 + rim.resistance * .2; actor.angle = 0; actor.yaw = 0;
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0; actor.gripLocked = false;
          }
          if (rim.grip && Math.hypot(a.x - v.x, a.y - v.y) < 92) {
            contact.metAt ??= elapsed;
            prepareContactActor(defender);
            const shoulders = sampleArenaFighterContacts(defender, reduced ? 0 : clock).shoulders;
            driver.gripTarget = shoulders[0]; driver.secondaryGripTarget = shoulders[1]; driver.gripStrength = 1; driver.gripLocked = exchange.rim!.contactAt !== null;
          }
          if (rim.stage === 'pressure') words.set(exchange.aggressor, '밀어내기!');
          else if (rim.stage === 'brace' || rim.stage === 'release') words.set(exchange.victim, '버텼다!');
          if (!reduced && rim.pressure > 0 && rim.release < .6) effects.push(() => dust(ctx, defender.x, defender.y, (elapsed - exchange.rim!.start) / unit % 550, .4 + rim.resistance * .4));
          continue;
        }
        if (!contact.rimFinished && elapsed >= exchange.rim!.end && exchange.rim!.outcome === 'resist') {
          contact.rimFinished = true;
          contact.center = { x: (a!.x + v!.x) / 2, y: (a!.y + v!.y) / 2 };
          if (reset) {
            contact.center = rim.returnCenter;
            for (const [body, point] of [[a!, rim.aggressor], [v!, rim.victim]] as const) { body.x = point.x; body.y = point.y; body.motorX = 0; body.motorY = 0; }
          }
          contact.round = arenaContactRound(contact.round, contact.center, { aggressor: a!, victim: v! }); exchange = contact.round;
          contact.metAt = undefined; contact.committed = false;
        }
      }
      let ordinaryRecoveryPrelude = false;
      if (exchange.recovery) {
        const recovery = arenaRecoveryTargets(exchange, elapsed, contact.center)!;
        if (recovery.active) {
          const throwerId = exchange.recovery.throwerId ?? exchange.aggressor;
          const throwerBody = sim.bodies.get(throwerId)!;
          const target = actors.get(exchange.victim)!, thrower = actors.get(throwerId)!;
          const overheadEscape = recovery.kind === 'overhead-escape';
          if (!overheadEscape && elapsed < recovery.throwAt) {
            // Reuse the deciding throw's complete approach, grip, lift and
            // painted rig. Survival is revealed only after the same release.
            ordinaryRecoveryPrelude = true;
            exchange = { ...exchange, recovery: undefined, tactic: 'lift', aggressor: throwerId, start: exchange.recovery!.start, impact: recovery.throwAt, resolve: recovery.throwAt + 1100 * unit, end: recovery.throwAt + 1100 * unit };
          } else {
          if (!overheadEscape && !contact.recoveryRelease) {
            const painted = v!.animation?.contactPoints?.origin;
            contact.recoveryRelease = { thrower: { x: throwerBody.x, y: throwerBody.y }, receiver: { x: v!.x, y: v!.y }, height: painted ? Math.max(0, v!.y - painted.y) : 42, snapshot: v!.animation?.spinSnapshot && structuredClone(v!.animation.spinSnapshot) };
          }
          if (!overheadEscape && contact.recoveryRelease) {
            const held = contact.recoveryRelease, initial = arenaRecoveryTargets(exchange, recovery.throwAt, contact.center)!;
            if (recovery.stage === 'somersault') {
              recovery.receiver.x += held.receiver.x - initial.receiver.x; recovery.receiver.y += held.receiver.y - initial.receiver.y;
              recovery.height += (held.height - 42) * (1 - ease(recovery.flightPhase));
            }
            recovery.thrower.x += (held.thrower.x - initial.thrower.x) * (1 - ease((elapsed - recovery.throwAt - 1100 * unit) / (1000 * unit)));
            recovery.thrower.y += (held.thrower.y - initial.thrower.y) * (1 - ease((elapsed - recovery.throwAt - 1100 * unit) / (1000 * unit)));
          }
          const connected = Math.hypot(throwerBody.x - v!.x, throwerBody.y - v!.y) < 86;
          for (const [body, actor, point] of [[throwerBody, thrower, recovery.thrower], [v!, target, recovery.receiver]] as const) {
            if (reset && elapsed > 300 * unit || actor === target && recovery.airborne) { body.x = point.x; body.y = point.y; body.motorX = 0; body.motorY = 0; }
            else move(body, point, seconds, arenaApproachSpeed(Math.hypot(point.x - body.x, point.y - body.y)));
            actor.x = body.x; actor.y = body.y; actor.phase = recovery.phase;
            body.facing = actor === thrower ? recovery.side : -recovery.side; actor.facing = body.facing;
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
            actor.pose = recovery.stage === 'approach' ? Math.hypot(point.x - body.x, point.y - body.y) > 8 ? 'walk' : 'guard' : recovery.stage === 'hold' ? actor === thrower ? 'grapple' : 'brace' : actor === thrower ? recovery.grip ? 'lift' : recovery.throwPhase < 1 ? 'throw' : 'guard' : recovery.airborne ? 'airborne' : recovery.stage === 'land' ? 'land' : 'guard';
            if (recovery.stage === 'separate' || recovery.stage === 'release') {
              const moving = Math.hypot(body.x - (before.get(actor.candidate.id)?.x ?? body.x), body.y - (before.get(actor.candidate.id)?.y ?? body.y)) > .2;
              actor.pose = moving ? actor === target ? 'run' : 'walk' : 'guard';
              body.facing = actor === target ? recovery.receiver.x >= recovery.thrower.x ? 1 : -1 : recovery.receiver.x >= body.x ? 1 : -1;
              actor.facing = body.facing;
            }
            if (overheadEscape && !['approach', 'separate', 'release'].includes(recovery.stage)) {
              actor.pose = actor === thrower ? recovery.throwerPose as ArenaPose : recovery.receiverPose as ArenaPose;
              if (actor === thrower) { actor.overheadRaise = recovery.overheadRaise; actor.grappleEffort = recovery.throwerEffort; actor.grappleLiftPreparation = recovery.liftPreparation; actor.angle = -recovery.side * .12 * (recovery.throwerBalance ?? 0); }
              else { actor.slamProgress = recovery.receiverSlam; actor.jumpTuck = recovery.jumpTuck; actor.suspension = recovery.suspension; actor.grappleEffort = recovery.receiverEffort; }
            }
          }
          if (connected && recovery.height > 0 && recovery.grip || recovery.airborne) { target.depthY = v!.y; target.y -= recovery.height; target.angle = recovery.angle; target.pose = overheadEscape ? recovery.receiverPose as ArenaPose : recovery.airborne ? 'airborne' : 'held'; target.suspension = overheadEscape ? recovery.suspension : 1; }
          if (recovery.stage === 'land') { target.angle = recovery.angle; target.phase = recovery.landingPhase; effects.push(() => dust(ctx, target.x, target.y, recovery.landingPhase * 200, .7)); }
          if (connected && recovery.grip) {
            prepareContactActor(target);
            const waist = sampleArenaFighterContacts(target, reduced ? 0 : clock).waist;
            thrower.gripTarget = waist; thrower.secondaryGripTarget = { x: waist.x - thrower.facing * 6, y: waist.y + 3 }; thrower.gripStrength = 1; thrower.gripLocked = true; thrower.gripMode = 'waist';
          }
          if (recovery.airborne) words.set(exchange.victim, overheadEscape ? '점프 탈출!' : '공중 한 바퀴!');
          else if (recovery.stage === 'land' || recovery.stage === 'release') words.set(exchange.victim, '착지! 살았다!');
          else if (recovery.stage === 'separate') words.set(exchange.victim, '거리 벌리기!');
          if (!overheadEscape && (recovery.stage === 'lift' && recovery.height > .01 || ['somersault', 'land'].includes(recovery.stage))) words.set(throwerId, '던지기!');
          if (!overheadEscape && recovery.airborne && contact.recoveryRelease?.snapshot) target.spinRelease = { snapshot: contact.recoveryRelease.snapshot, weight: 1 - ease((recovery.flightPhase - .06) / .20) };
          continue;
          }
        }
        if (!ordinaryRecoveryPrelude && !contact.recoveryFinished && elapsed >= exchange.recovery!.end) {
          const oldThrower = exchange.recovery!.throwerId;
          if (oldThrower && oldThrower !== exchange.aggressor) {
            v!.separatedFrom = oldThrower; v!.roam = undefined;
            const former = sim.bodies.get(oldThrower);
            if (former) { former.separatedFrom = exchange.victim; former.roam = undefined; former.restUntil = elapsed + 800 * unit; }
          }
          contact.recoveryFinished = true; contact.center = arenaLocalContact({ x: (a!.x + v!.x) / 2, y: (a!.y + v!.y) / 2 }, []);
          contact.round = arenaContactRound(contact.round, contact.center, { aggressor: a!, victim: v! }); exchange = contact.round; contact.metAt = undefined; contact.committed = false;
        }
      }
      if (exchange.escape) {
        const escape = arenaEscapeTargets(exchange, elapsed, contact.center)!;
        if (escape.active) {
          const running = ['flee', 'chase', 'rejoin', 'separate'].includes(escape.stage);
          for (const id of [escape.runnerId, escape.chaserId]) {
            const body = sim.bodies.get(id), actor = actors.get(id);
            if (!body || !actor) continue;
            const target = id === escape.runnerId ? escape.runner : escape.chaser;
            body.roam = undefined;
            if (reset && elapsed > 300 * unit) { body.x = target.x; body.y = target.y; body.motorX = 0; body.motorY = 0; }
            else move(body, target, seconds, running ? 148 : arenaApproachSpeed(Math.hypot(target.x - body.x, target.y - body.y)));
            const other = sim.bodies.get(id === escape.runnerId ? escape.chaserId : escape.runnerId)!;
            if (escape.separated && running) body.facing = id === escape.runnerId ? escape.runnerFacing : escape.chaserFacing;
            else if (running && Math.abs(target.x - body.x) > 4) body.facing = Math.sign(target.x - body.x);
            else arenaFaceOpponent(body, other);
            actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
            const touching = Math.hypot(body.x - other.x, body.y - other.y) < 88;
            actor.pose = escape.grip && touching ? 'grapple' : Math.hypot(target.x - body.x, target.y - body.y) > 6 ? running ? 'run' : 'walk' : 'guard';
            actor.phase = escape.phase; actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
            if (escape.grip && touching) {
              if (contact.metAt === undefined) contact.metAt = elapsed;
              actor.gripTarget = { x: other.x - body.facing * 17, y: other.y - 44 };
              actor.secondaryGripTarget = { x: other.x - body.facing * 20, y: other.y - 52 }; actor.gripStrength = 1; actor.gripMode = 'wrist';
            }
          }
          if (['grip', 'break', 'flee', 'chase', 'rejoin', 'separate'].includes(escape.stage)) {
            const ungripped = contact.metAt === undefined;
            if (contact.round.escape!.ungripped !== ungripped) contact.round = { ...contact.round, escape: { ...contact.round.escape!, ungripped } };
          }
          if (['break', 'flee'].includes(escape.stage)) words.set(escape.runnerId, contact.metAt === undefined ? '피해서 도망!' : '빠져나간다!');
          else if (escape.stage === 'chase') words.set(escape.chaserId, '쫓아간다!');
          else if (escape.stage === 'separate') words.set(escape.runnerId, '완전히 빠져나왔다!');
          continue;
        }
        if (escape.released) {
          for (const id of [escape.runnerId, escape.chaserId]) {
            const body = sim.bodies.get(id), actor = actors.get(id), point = id === escape.runnerId ? escape.runner : escape.chaser;
            if (body && actor) {
              body.x = point.x; body.y = point.y; body.motorX = 0; body.motorY = 0; body.roam = undefined;
              body.facing = id === escape.runnerId ? escape.runnerFacing : escape.chaserFacing;
              actor.x = point.x; actor.y = point.y; actor.facing = body.facing; actor.pose = id === escape.runnerId ? 'run' : 'guard';
              actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
            }
          }
          continue;
        }
        if (!contact.escapeFinished && elapsed >= exchange.escape.end) {
          contact.escapeFinished = true;
          contact.center = escape.separated && a && v ? arenaLocalContact(encounterOrigin(exchange, a, v), []) : escape.returnCenter;
          contact.round = a && v ? arenaContactRound(contact.round, contact.center, { aggressor: a, victim: v }) : contact.round;
          exchange = contact.round; contact.metAt = undefined; contact.committed = false;
        }
      }
      if (exchange.tactic === 'suplex' && !exchange.exchange && elapsed < exchange.impact) {
        const nominalGripAt = exchange.start + (exchange.impact - exchange.start) * .20;
        if (exchange.suplexGripAt === undefined) {
          exchange = { ...exchange, suplexGripAt: reset && elapsed >= nominalGripAt ? nominalGripAt : null };
          contact.round = exchange;
        }
        const driverHands = a?.animation?.contactPoints?.hands, waist = v?.animation?.contactPoints?.waist;
        if (exchange.suplexGripAt === null && elapsed >= nominalGripAt && a && v && driverHands && waist && Math.hypot(a.x - v.x, a.y - v.y) < 86 && driverHands.some(hand => Math.hypot(hand.x - waist.x, hand.y - waist.y) < 6)) {
          exchange = { ...exchange, suplexGripAt: elapsed }; contact.round = exchange;
        }
      }
      if (exchange.tactic === 'catch' && exchange.chargeSetup?.contactAt === undefined && exchange.chargeSetup) {
        const span = Math.max(1, exchange.impact - exchange.start);
        const contactAt = reset && elapsed >= exchange.start + span * .55 ? exchange.start + span * .55 : null;
        contact.round = { ...exchange, chargeSetup: { ...exchange.chargeSetup, contactAt, loadDuration: Math.max(180, span * .12), turnDuration: Math.max(300, span * .28) } };
        exchange = contact.round;
      }
      if (exchange.tactic === 'ram' && exchange.chargeSetup && exchange.chargeSetup.contactAt === undefined) {
        contact.round = { ...exchange, chargeSetup: { ...exchange.chargeSetup, contactAt: reset && elapsed >= exchange.impact ? exchange.impact : null } };
        exchange = contact.round;
      }
      if (exchange.rushOutcome === 'counter-throw' && exchange.pairPickupAt === undefined && !reset && !props.paused && !sim.exits.has(exchange.victim)) {
        contact.round = { ...exchange, pairPickupAt: null }; exchange = contact.round;
      }
      if (exchange.rushOutcome) {
        const shared = arenaPairRushTargets(exchange, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
        if (shared.launchAt !== null && Math.abs(exchange.impact - shared.requiredImpactAt) > .001) {
          const impact = shared.requiredImpactAt;
          contact.round = { ...exchange, rushLaunchAt: shared.launchAt, rushContactAt: shared.contactAt, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit }; exchange = contact.round;
        }
      }
      const center = contact.center;
      const waitingForCatch = exchange.tactic === 'catch' && exchange.chargeSetup?.contactAt === null;
      const waitingForRam = exchange.tactic === 'ram' && exchange.chargeSetup?.contactAt === null;
      // A slow frame can arrive after the planned finish while the incoming
      // fighter is still approaching. Keep receiving the real body first.
      const action = arenaAction(exchange, waitingForCatch || waitingForRam ? Math.min(elapsed, exchange.impact - .001) : elapsed);
      const charge = exchange.tactic === 'bait' ? arenaChargeTargets(exchange, elapsed, center) : undefined;
      const edge = exchange.tactic === 'edge' ? arenaEdgeTargets(exchange, elapsed, center) : undefined;
      const caught = exchange.tactic === 'catch' ? arenaCatchTargets(exchange, elapsed, center) : undefined;
      const spin = exchange.tactic === 'spin' ? arenaSpinTargets(exchange, elapsed, center) : undefined;
      const ram = exchange.tactic === 'ram' ? arenaRamTargets(exchange, elapsed, center) : undefined;
      const technique = isArenaFinalTechnique(exchange) ? arenaTechniqueTargets(exchange, elapsed, center) : undefined;
      if (exchange.tactic === 'elbow' && exchange.elbowGripAt === undefined && !reset) {
        contact.round = { ...exchange, elbowGripAt: null }; exchange = contact.round;
      }
      if (technique && exchange.tactic === 'elbow' && technique.phase >= .55 && !contact.elbowFall) {
        contact.elbowFall = reset ? { ...technique.victim } : { x: v!.x, y: v!.y };
      }
      const elbowPickup = technique?.victimFloorRig && contact.elbowFall && actors.has(exchange.victim) ? arenaAnklePickup(contact.elbowFall, sampleArenaFighterContacts({ ...actors.get(exchange.victim)!, ...technique.victimFloorRig, ...contact.elbowFall, facing: -technique.side, depthY: contact.elbowFall.y, animation: undefined, motionImmediate: true }, reduced ? 0 : clock).feet, technique.side) : undefined;
      let incomingRush = exchange.rushOutcome ? arenaPairRushTargets(exchange, elapsed, center, contact.chargerOrigin, contact.pairCarryOrigins) : undefined;
      if (incomingRush?.outcome === 'double-out' && !incomingRush.waitingForGrip && elapsed >= incomingRush.contactAt && !contact.pairCarryOrigins) {
        const pair = incomingRush.pairIds.map(id => { const body = sim.bodies.get(id)!; return { x: body.x, y: body.y }; }) as [ArenaPoint, ArenaPoint];
        contact.pairCarryOrigins = { victim: { ...incomingRush.contactPoint }, pair, direction: { x: -incomingRush.chargeDirection.x, y: -incomingRush.chargeDirection.y }, facing: incomingRush.chargerFacing };
        incomingRush = arenaPairRushTargets(exchange, elapsed, center, contact.chargerOrigin, contact.pairCarryOrigins);
        const impact = incomingRush.requiredImpactAt;
        contact.round = { ...exchange, rushPushDuration: incomingRush.postContactDuration, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
        exchange = contact.round;
      }
      const rush = incomingRush;
      const shove = exchange.tactic === 'double-shove' ? rush ?? arenaDoubleShoveTargets(exchange, elapsed, center) : exchange.tactic === 'shove' ? arenaShoveTargets(exchange, elapsed, center) : undefined;
      arenaActionWords(exchange, elapsed).forEach(word => words.set(word.id, word.word));
      const ids = action.actors.map(part => part.id);
      if (action.stage === 'release' && !contact.releases) {
        const ending = reset ? arenaAction(exchange, exchange.impact - .001) : undefined;
        const endingCharge = reset && charge ? arenaChargeTargets(exchange, exchange.impact - .001, center) : undefined;
        const endingCatch = reset && caught ? arenaCatchTargets(exchange, exchange.impact - .001, center) : undefined;
        contact.releases = new Map(ids.map(id => {
          const offset = ending?.actors.find(part => part.id === id)?.offset, body = sim.bodies.get(id)!;
          return [id, endingCharge ? id === exchange.victim ? endingCharge.charger : endingCharge.target : endingCatch ? id === exchange.victim ? endingCatch.charger : endingCatch.receiver : reset && offset ? { x: center.x + offset.x, y: center.y + offset.y } : { x: body.x, y: body.y }];
        }));
      }
      action.actors.forEach(part => {
        const body = sim.bodies.get(part.id), actor = actors.get(part.id);
        if (!body || !actor || sim.exits.has(part.id)) return;
        let target = technique ? part.id === exchange.victim ? technique.victim : technique.aggressor : charge ? part.id === exchange.victim ? charge.charger : charge.target : caught ? part.id === exchange.victim ? caught.charger : caught.receiver : spin ? part.id === exchange.victim ? spin.attacker : spin.defender : ram ? part.id === exchange.victim ? ram.victim : ram.driver : shove ? part.id === exchange.victim ? shove.victim : part.id === exchange.helper ? shove.helper : shove.aggressor : edge ? part.id === exchange.victim ? edge.victim : edge.aggressor : { x: center.x + part.offset.x, y: center.y + part.offset.y };
        if (rush?.grip === 'pair' && (rush.waitingForGrip || elapsed < rush.contactAt) && rush.pairIds.includes(part.id)) target = { ...target, y: center.y + (part.id === rush.pairIds[0] ? 6 : -6) };
        if (rush?.outcome === 'counter-throw' && !rush.waitingForGrip && rush.pairIds.includes(part.id) && rush.grip !== 'arms-legs' && elapsed >= rush.contactAt && elapsed < exchange.impact) {
          // Approach the actual grounded shoulders and feet before taking hold. The normal
          // motor still governs each planted step.
          const gripFrame = arenaPairRushTargets(exchange, rush.contactAt + ARENA_PAIR_COUNTER_TIMING.grip, center, contact.chargerOrigin, contact.pairCarryOrigins);
          const victim = actors.get(exchange.victim)!;
          const held = { ...victim, ...gripFrame.victim, y: gripFrame.victim.y - gripFrame.lift, depthY: gripFrame.victim.y, pose: gripFrame.victimPose!, angle: gripFrame.victimAngle, facing: rush.chargerFacing, suspension: gripFrame.victimSuspension, carryStretch: gripFrame.victimCarryStretch, carrySupport: 'shoulder' as const, pairCarry: true, pairLoad: gripFrame.pairLoad, pairLift: gripFrame.pairLift, pairBackload: gripFrame.pairBackload, pairHeave: gripFrame.pairHeave, animation: undefined, motionImmediate: true };
          const contacts = sampleArenaFighterContacts(held, reduced ? 0 : clock);
          const legs = part.id === rush.legsHolderId;
          const endpoints = [...(legs ? contacts.feet : contacts.shoulders)].sort((first, second) => second.y - first.y);
          const holder = { ...actor, ...target, pose: gripFrame.carrierPose!, pairLoad: gripFrame.pairLoad, pairLift: gripFrame.pairLift, pairBackload: gripFrame.pairBackload, pairHeave: gripFrame.pairHeave, overheadRaise: gripFrame.overhead, carrierDrive: gripFrame.carrierDrive, facing: legs ? rush.side : -rush.side, gripMode: legs ? 'ankle' as const : 'shoulder' as const, animation: undefined, motionImmediate: true };
          target = arenaCarryHolderPoint(holder, endpoints, reduced ? 0 : clock, target);
        }

        if (technique && exchange.tactic === 'elbow' && contact.elbowFall) {
          if (part.id === exchange.victim) target = contact.elbowFall;
          else if (elbowPickup) {
            // The existing motor supplies normal acceleration from the actual
            // landing root. Moving this goal slowly would delay the first step.
            // At a tapered rim, clipping the guessed holder point alone can
            // leave one ankle out of reach. Project the real two-foot pickup
            // onto a reachable planted stance before approaching it.
            const feet = elbowPickup.feet.map(foot => ({ x: contact.elbowFall!.x + foot.x, y: contact.elbowFall!.y + foot.y }));
            const holder = { ...actor, ...elbowPickup.holder, pose: 'drag' as const, facing: -technique.side, gripMode: 'ankle' as const, gripTarget: feet[0], secondaryGripTarget: feet[1], gripStrength: 1, gripLocked: true, animation: undefined, motionImmediate: true };
            target = arenaInsidePoint(arenaCarryHolderPoint(holder, feet, reduced ? 0 : clock, arenaInsidePoint(elbowPickup.holder, 8)), 8);
          }
        }
        if (action.stage === 'approach' && !rush && !ram) target = arenaGuardTarget(target, actor.index, elapsed);
        if (action.stage === 'release') {
          const origin = contact.releases!.get(part.id) ?? body;
          target = arenaReleaseTarget(origin, center, part.role, (elapsed - exchange.impact) / Math.max(1, exchange.end - exchange.impact));
        }
        // Snapshot seeks can reconstruct the current contact. Live actors have
        // the same bounded acceleration and speed as everyone elsewhere.
        if (technique && exchange.tactic === 'elbow' && part.id === exchange.victim && contact.elbowFall) {
          body.x = contact.elbowFall.x; body.y = contact.elbowFall.y; body.motorX = 0; body.motorY = 0;
        }
        else if (ram && ram.stage !== 'release') {
          body.motorX = seconds ? (target.x - body.x) / seconds : 0; body.motorY = seconds ? (target.y - body.y) / seconds : 0;
          body.x = target.x; body.y = target.y;
        }
        else if (rush && part.id === rush.chargerId && ['charge', 'wrestle', 'rebound', 'groggy'].includes(rush.stage)) {
          // The rush model already integrates acceleration from this body's
          // actual origin. A second ground motor would brake before contact,
          // especially on vertical runs, and postpone the visible collision.
          body.motorX = seconds ? (target.x - body.x) / seconds : 0; body.motorY = seconds ? (target.y - body.y) / seconds : 0;
          body.x = target.x; body.y = target.y;
        }
        else if (rush?.outcome === 'double-out' && contact.pairCarryOrigins && elapsed >= rush.contactAt) {
          // One translated group preserves the two actual root offsets. Three
          // independent ground motors would compress the wrestling pair.
          body.motorX = seconds ? (target.x - body.x) / seconds : 0; body.motorY = seconds ? (target.y - body.y) / seconds : 0;
          body.x = target.x; body.y = target.y;
        }
        else if (rush && contact.pairCarryOrigins && exchange.linkedRush?.contactAt === elapsed && rush.pairIds.includes(part.id)) { /* The linked run already supplied this impact frame's ground step. */ }
        else if (rush?.grip === 'arms-legs' && rush.pairIds.includes(part.id)) { /* Held endpoint projection below supplies this frame's planted step. */ }
        else if (reset && elapsed > 300 * unit) { body.x = target.x; body.y = target.y; body.motorX = 0; body.motorY = 0; }
        else if (!(technique && isArenaFloorDrag(exchange) && elapsed >= exchange.impact && part.id === exchange.aggressor)) move(body, target, seconds, part.pose === 'run' || rush?.outcome === 'counter-throw' && rush.pairIds.includes(part.id) && elapsed >= rush.contactAt || spin && spin.turn > 0 || elbowPickup && part.id === exchange.aggressor ? 165 : action.stage === 'approach' ? arenaApproachSpeed(Math.hypot(target.x - body.x, target.y - body.y)) : 118);
        const opponent = part.gripId ? sim.bodies.get(part.gripId) : undefined;
        const facingOpponent = opponent ?? sim.bodies.get(part.id === exchange.victim ? exchange.aggressor : exchange.victim);
        const remaining = Math.hypot(target.x - body.x, target.y - body.y);
        const contactDistance = opponent ? Math.hypot(opponent.x - body.x, opponent.y - body.y) : 0;
        if (facingOpponent && !spin && !technique) arenaFaceOpponent(body, facingOpponent);
        if (technique && (technique.stage === 'approach' || technique.stage === 'probe' || technique.stage === 'reset') && facingOpponent) arenaFaceOpponent(body, facingOpponent);
        if (spin && remaining < 18) body.facing = part.id === exchange.victim ? -spin.side : spin.side;
        if (ram && ram.stage !== 'prepare') body.facing = part.id === exchange.victim ? -ram.side : ram.side;
        if (technique && remaining < 18 && !['approach', 'probe', 'reset'].includes(technique.stage)) body.facing = part.id === exchange.victim ? -technique.side : technique.side;
        if (technique && exchange.tactic === 'armspin' && part.id === exchange.victim) body.facing = -technique.side;
        if (technique?.aggressorFacing !== undefined && part.id === exchange.aggressor) body.facing = technique.aggressorFacing;
        if (charge && charge.stage !== 'prepare') body.facing = part.id === exchange.victim ? charge.side : -charge.side;
        if (caught && caught.stage !== 'prepare') body.facing = part.id === exchange.victim ? caught.side : -caught.side;
        if (shove && remaining < 18) body.facing = part.id === exchange.victim || part.id === exchange.secondaryVictim ? -shove.side : shove.side;
        if (rush?.grip === 'pair' && rush.pairIds.includes(part.id)) {
          const partner = sim.bodies.get(rush.pairIds.find(id => id !== part.id)!);
          if (partner) arenaFaceOpponent(body, partner);
        }
        actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
        const throwing = action.attackers.includes(part.id) && action.liftedId !== part.id && (part.pose === 'lift' || part.pose === 'throw');
        actor.yaw = reduced ? 0 : part.turn ?? (throwing ? .72 * Math.sin(clamp(part.phase) * Math.PI) : 0);
        actor.pivotTurn = !reduced && spin && part.id === exchange.aggressor && spin.turn > 0 ? spin.angle : undefined;
        const establishedGrip = opponent && contactDistance < 86 && action.stage !== 'approach';
        actor.pose = part.pose === 'run' ? 'run' : part.pose === 'dodge' && (charge || shove) ? 'dodge' : establishedGrip ? part.pose : remaining > 9 || opponent && contactDistance > 84 ? 'walk' : part.pose;
        actor.phase = part.pose === 'throw' ? clamp((elapsed - exchange.impact) / (350 * unit)) : part.phase; actor.power = action.stage === 'joint-attack' || action.stage === 'counter' || action.stage === 'lift' ? .85 : .55;
        actor.chargePreparation = ram && part.id === exchange.aggressor ? ram.preparation : part.id === exchange.victim ? charge?.preparation ?? (caught?.stage === 'prepare' ? caught.preparation : 0) : 0;
        actor.chargeStrength = ram && part.id === exchange.aggressor && (ram.stage === 'charge' || ram.stage === 'contact') ? 1 : part.id === exchange.victim && (charge && charge.stage !== 'prepare' || caught?.stage === 'charge') ? 1 : 0;
        actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripLocked = false;
        actor.gripMode = technique?.grip ?? (spin ? 'waist' : undefined);
        if (caught) {
          actor.angle = part.id === exchange.victim ? caught.chargerAngle : caught.receiverAngle;
          if (part.id === exchange.aggressor) { actor.pose = caught.gripStrength > 0 ? caught.turn > 0 ? 'lift' : 'grapple' : 'brace'; actor.grappleEffort = caught.load * .65; actor.grappleLiftPreparation = caught.load * (1 - caught.turn); actor.gripMode = 'waist'; }
          else if (part.id === exchange.victim && caught.gripStrength > 0) { actor.pose = 'held'; actor.suspension = 1; }
        }
        if (technique) {
          actor.grappleEffort = part.id === exchange.victim ? technique.victimEffort : technique.aggressorEffort;
          actor.grappleLiftPreparation = part.id === exchange.aggressor ? technique.aggressorLiftPreparation : undefined;
          actor.angle = part.id === exchange.victim ? technique.victimAngle : technique.aggressorAngle;
          if (part.id === exchange.victim && technique.victimPose) actor.pose = technique.victimPose;
          if (exchange.tripCounter && technique.stage === 'probe') actor.pose = part.id === exchange.victim ? 'push' : 'brace';
          if (part.id === exchange.victim && (exchange.tactic === 'trip' || exchange.tactic === 'suplex')) actor.suspension = technique.victimSuspension;
          if (part.id === exchange.victim && exchange.tactic === 'suplex') actor.slamProgress = technique.victimSlam;
          if (part.id === exchange.victim && exchange.tactic === 'elbow') { actor.suspension = technique.victimSuspension; actor.gripMode = technique.victimGrip; }
          if (part.id === exchange.aggressor) {
            if (technique.aggressorPose) actor.pose = technique.aggressorPose;
            actor.overheadRaise = technique.aggressorOverheadRaise;
            actor.depthY = body.y; actor.y -= technique.aggressorLift;
            if (exchange.tactic === 'elbow') {
              actor.suspension = technique.aggressorSuspension;
              if (technique.aggressorLift > 1 && !technique.aggressorPose) actor.pose = 'held';
              actor.elbowStrength = technique.elbowContact;
              actor.elbowTarget = sim.bodies.get(exchange.victim)?.animation?.contactPoints?.head;
              if (elbowPickup && technique.phase < .90) actor.pose = Math.hypot(body.x - elbowPickup.holder.x, body.y - elbowPickup.holder.y) > 40 ? 'walk' : 'drag';
            }
            actor.pivotTurn = exchange.tactic === 'armspin' && technique.stage === 'pivot' ? technique.yaw : undefined;
            if (exchange.tactic === 'trip' && (technique.stage === 'hook' || technique.stage === 'kick')) {
              const contacts = sim.bodies.get(exchange.victim)?.animation?.contactPoints;
              actor.footTarget = technique.stage === 'kick' ? contacts?.waist ?? { x: v!.x, y: v!.y - 44 } : contacts?.feet ? [...contacts.feet].sort((left, right) => Math.abs(left.x - actor.x) - Math.abs(right.x - actor.x))[0] : { x: v!.x - technique.side * 8, y: v!.y - 2 };
              actor.footStrength = technique.contact; actor.kickLeg = 1;
              actor.frontKick = technique.frontKick;
            }
            if (exchange.tactic === 'sidekick') { actor.footTarget = sim.bodies.get(exchange.victim)?.animation?.contactPoints?.waist ?? { x: v!.x, y: v!.y - 45 }; actor.footStrength = technique.contact; actor.kickLeg = 1; }
          }
        }
        if (rush) {
          const charging = part.id === rush.chargerId;
          actor.chargeStrength = charging ? rush.chargeStrength : 0;
          actor.chargePreparation = charging && rush.stage === 'wrestle' ? ease(rush.phase / .15) : 0;
          if (charging && ['wrestle', 'charge', 'contact'].includes(rush.stage)) { if (rush.stage === 'charge') actor.pose = 'run'; body.facing = rush.chargerFacing; actor.facing = body.facing; }
          if (rush.outcome === 'counter-throw' && part.id === exchange.victim) {
            actor.angle = rush.victimAngle; actor.suspension = rush.victimSuspension;
            actor.carrySupport = 'shoulder'; actor.pairCarry = true; actor.carryEntry = true;
            actor.pairLoad = rush.pairLoad; actor.pairLift = rush.pairLift; actor.pairBackload = rush.pairBackload; actor.pairHeave = rush.pairHeave;
            actor.facing = rush.chargerFacing;
            actor.carryStretch = rush.victimCarryStretch > 0 || rush.victimPose === 'carried' ? rush.victimCarryStretch : undefined;
            if (rush.victimPose) actor.pose = rush.victimPose;
            if (rush.reboundHeight > 0) { actor.depthY = body.y; actor.y -= rush.reboundHeight; }
          }
          if (rush.outcome === 'double-out') {
            if (charging && rush.chargerPose) { actor.pose = rush.chargerPose; actor.phase = rush.pushStroke; actor.power = 1; actor.facing = rush.scoopFacing ?? actor.facing; actor.yaw = 0; }
            if (part.id === exchange.victim || part.id === exchange.helper) {
              const primary = part.id === exchange.victim;
              actor.depthY = body.y; actor.y -= primary ? rush.victimLift : rush.helperLift;
              actor.angle = primary ? rush.victimAngle : rush.helperAngle;
              actor.suspension = primary ? rush.victimSuspension : rush.helperSuspension;
              const pose = primary ? rush.victimPose : rush.helperPose;
              if (pose) actor.pose = pose;
              else if (rush.stage === 'contact' || rush.stage === 'push') { actor.pose = 'brace'; actor.phase = rush.pressure; actor.power = .95; }
            }
          }
          if (rush.outcome === 'counter-throw' && rush.stage === 'release' && !charging) {
            contact.pairArmRelease ??= new Map();
            if (!contact.pairArmRelease.has(part.id) && body.animation?.contactPoints && body.animation.pose === 'pairlift') {
              const prior = before.get(part.id) ?? body;
              contact.pairArmRelease.set(part.id, { hands: body.animation.contactPoints.hands.map(hand => ({ ...hand })) as [ArenaPoint, ArenaPoint], elbows: body.animation.contactPoints.elbows.map(point => ({ ...point })) as [ArenaPoint, ArenaPoint], shoulders: body.animation.contactPoints.shoulders.map(point => ({ ...point })) as [ArenaPoint, ArenaPoint], root: { ...prior }, facing: body.animation.facing ?? body.facing, stance: body.animation.motion ? { crouch: (body.animation.supportHip?.y ?? body.animation.motion.crouch - 20) + 20, hipX: body.animation.supportHip?.x ?? body.animation.motion.hipX, lean: body.animation.motion.lean, head: body.animation.motion.head, shoulderLift: body.animation.motion.shoulderLift, contact: body.animation.motion.contact } : undefined });
            }
            if (!contact.pairArmRelease.has(part.id)) {
              // A paused seek has no preceding painted frame. Reconstruct the
              // same last shoulder/ankle supports before releasing either arm.
              const heldFrame = arenaPairRushTargets(exchange, exchange.impact - .001, center, contact.chargerOrigin, contact.pairCarryOrigins);
              const sourceVictim = { ...actors.get(exchange.victim)!, ...heldFrame.victim, y: heldFrame.victim.y - heldFrame.lift, pose: 'carried' as const, facing: heldFrame.chargerFacing, angle: heldFrame.victimAngle, suspension: heldFrame.victimSuspension, carryStretch: heldFrame.victimCarryStretch, carrySupport: 'shoulder' as const, pairCarry: true, pairLoad: heldFrame.pairLoad, pairLift: heldFrame.pairLift, pairBackload: heldFrame.pairBackload, pairHeave: heldFrame.pairHeave, animation: undefined, motionImmediate: true };
              const endpoints = sampleArenaFighterContacts(sourceVictim, reduced ? 0 : clock);
              const legs = part.id === heldFrame.legsHolderId, ordered = [...(legs ? endpoints.feet : endpoints.shoulders)].sort((first, second) => second.y - first.y);
              const sourceHolder = { ...actor, ...(legs ? heldFrame.helper : heldFrame.aggressor), pose: 'pairlift' as const, pairLoad: 1, pairLift: 1, pairBackload: 1, pairHeave: 1, angle: 0, facing: legs ? heldFrame.side : -heldFrame.side, overheadRaise: heldFrame.overhead, carrierDrive: heldFrame.carrierDrive, gripMode: legs ? 'ankle' as const : 'shoulder' as const, gripTarget: ordered[0], secondaryGripTarget: ordered[1], gripStrength: 1, gripLocked: true, animation: undefined, motionImmediate: true };
              Object.assign(sourceHolder, arenaCarryHolderPoint(sourceHolder, ordered, reduced ? 0 : clock, sourceHolder));
              const joints = sampleArenaFighterContacts(sourceHolder, reduced ? 0 : clock);
              contact.pairArmRelease.set(part.id, { hands: joints.hands as [ArenaPoint, ArenaPoint], elbows: joints.elbows as [ArenaPoint, ArenaPoint], shoulders: joints.shoulders as [ArenaPoint, ArenaPoint], root: { x: sourceHolder.x, y: sourceHolder.y }, facing: sourceHolder.facing });
            }
            const releasedArms = contact.pairArmRelease.get(part.id);
            const followThrough = clamp((elapsed - exchange.impact) / (ARENA_PAIR_THROW_FOLLOW_THROUGH * unit));
            actor.pose = followThrough < 1 ? 'pairlift' : 'guard'; actor.pairLoad = 1; actor.pairLift = 1; actor.pairBackload = 1; actor.pairHeave = 1;
            actor.gripMode = part.id === rush.armsHolderId ? 'shoulder' : 'ankle';
            if (releasedArms) {
              actor.facing = releasedArms.facing; body.facing = releasedArms.facing;
              actor.carrierRelease = { hands: releasedArms.hands.map(hand => ({ x: hand.x + actor.x - releasedArms.root.x, y: hand.y + actor.y - releasedArms.root.y })) as [ArenaPoint, ArenaPoint], elbows: releasedArms.elbows.map(point => ({ x: point.x + actor.x - releasedArms.root.x, y: point.y + actor.y - releasedArms.root.y })) as [ArenaPoint, ArenaPoint], shoulders: releasedArms.shoulders.map(point => ({ x: point.x + actor.x - releasedArms.root.x, y: point.y + actor.y - releasedArms.root.y })) as [ArenaPoint, ArenaPoint], progress: followThrough, direction: rush.side, stance: releasedArms.stance };
            }
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0; actor.gripLocked = false;
          }
        }
      });
      if (exchange.linkedRush && contact.linkedRelease && elapsed - contact.linkedRelease.at < 180) {
        const release = contact.linkedRelease, age = elapsed - release.at;
        // Read the two separate forearm impacts, then lower the arms smoothly
        // while the allies approach the fallen body for their existing grips.
        for (const [index, id] of [exchange.aggressor, exchange.helper!].entries()) {
          const actor = actors.get(id)!, body = sim.bodies.get(id)!;
          actor.clotheslineArm = release.arms[index]; actor.clotheslineStrength = 1 - ease((age - 45) / 135);
          actor.clotheslineTarget = { x: release.hands[index].x + actor.x - release.roots[index].x, y: release.hands[index].y + actor.y - release.roots[index].y };
          actor.facing = release.facings[index]; body.facing = release.facings[index];
          if (age < 45) actor.pose = 'run';
        }
      }
      const lifted = action.liftedId ? actors.get(action.liftedId) : undefined;
      const targetBody = action.liftedId ? sim.bodies.get(action.liftedId) : undefined;
      const connections = targetBody ? action.attackers.every(id => {
        const body = sim.bodies.get(id);
        if (!body) return false;
        if (elbowPickup) {
          if (Math.hypot(body.x - elbowPickup.holder.x, body.y - elbowPickup.holder.y) >= 14) return false;
          const driver = actors.get(id)!, victim = actors.get(exchange.victim)!;
          prepareContactActor(driver); prepareContactActor(victim);
          const feet = sampleArenaFighterContacts(victim, reduced ? 0 : clock).feet;
          const hands = sampleArenaFighterContacts({ ...driver, pose: 'drag', facing: -technique!.side, gripMode: 'ankle', gripTarget: feet[0], secondaryGripTarget: feet[1], gripStrength: 1, gripLocked: true }, reduced ? 0 : clock).hands;
          return feet.every((foot, index) => Math.hypot(foot.x - hands[1 - index].x, foot.y - hands[1 - index].y) < 5);
        }
        return Math.hypot(body.x - targetBody.x, body.y - targetBody.y) < (rush?.grip === 'arms-legs' ? 160 : ram ? 50 : 86);
      }) : false;
      const heldLift = lifted && rush?.outcome === 'counter-throw' ? rush.lift : lifted && connections ? caught ? caught.height : action.lift : 0;
      if (ordinaryRecoveryPrelude && heldLift > .01) words.set(exchange.aggressor, '던지기!');
      if (lifted && action.liftedId && !sim.exits.has(action.liftedId)) {
        lifted.y -= heldLift;
        lifted.angle = reduced ? 0 : caught ? caught.chargerAngle : rush ? rush.victimAngle : technique ? technique.victimAngle : ram ? ram.side * .36 * ram.impact : -.22 * clamp(heldLift / 52);
        if (rush?.outcome === 'counter-throw') lifted.pose = rush.victimPose ?? 'stunned';
        else if (technique?.victimPose) lifted.pose = technique.victimPose;
        else if (heldLift > 5) lifted.pose = spin && action.liftedId === exchange.victim || technique && exchange.tactic === 'armspin' ? 'held' : 'airborne';
      }
      action.actors.forEach(part => {
        const actor = actors.get(part.id), other = part.gripId ? actors.get(part.gripId) : undefined;
        if (!actor || !other || actor.pose === 'walk' || actor.pose === 'run') return;
        const groundGap = Math.hypot(other.x - actor.x, (other.depthY ?? other.y) - (actor.depthY ?? actor.y));
        const groundDepth = Math.abs((other.depthY ?? other.y) - (actor.depthY ?? actor.y));
        if (!technique && !spin && (groundGap > 82 || groundDepth > 18)) return;
        if (groundGap > 100) return;
        const nearSide = other.x > actor.x ? -1 : 1;
        actor.gripStrength = ease((88 - Math.hypot(other.x - actor.x, other.y - actor.y)) / 26);
        actor.gripTarget = { x: other.x + nearSide * 17, y: other.y - 44 };
        actor.secondaryGripTarget = { x: other.x + nearSide * 20, y: other.y - 52 };
        prepareContactActor(actor); prepareContactActor(other);
        if (technique && part.id === exchange.aggressor) {
          const contacts = sampleArenaFighterContacts(other, reduced ? 0 : clock);
          actor.gripTarget = technique.grip === 'wrist' ? contacts.hands[1] : technique.grip === 'ankle' ? contacts.feet[0] : contacts.waist;
          actor.secondaryGripTarget = technique.grip === 'ankle' ? contacts.feet[1] : { x: actor.gripTarget.x - technique.side * 6, y: actor.gripTarget.y + 3 };
          actor.gripLocked = true;
        }
        if (technique?.victimGrip && part.id === exchange.victim) {
          const contacts = sampleArenaFighterContacts(other, reduced ? 0 : clock);
          actor.gripTarget = contacts.waist; actor.secondaryGripTarget = { x: contacts.waist.x - actor.facing * 6, y: contacts.waist.y + 3 };
          actor.gripStrength = 1; actor.gripLocked = true; actor.gripMode = 'waist';
        }
        if (technique?.grip === 'wrist' || spin && spin.turn > 0) {
          const driver = actors.get(exchange.aggressor)!, victim = actors.get(exchange.victim)!;
          [driver, victim].forEach(prepareContactActor);
          actor.gripTarget = technique?.grip === 'wrist' ? arenaWristGripPoint(driver, victim, reduced ? 0 : clock) : { x: (driver.x + victim.x) / 2, y: (driver.y + victim.y) / 2 - 48 };
          actor.secondaryGripTarget = { x: actor.gripTarget.x - actor.facing * 3, y: actor.gripTarget.y + 2 }; actor.gripStrength = 1; actor.gripLocked = true;
        }
        if (spin && action.attackers.includes(part.id)) {
          actor.gripTarget = sampleArenaFighterContacts(other, reduced ? 0 : clock).waist;
          actor.secondaryGripTarget = { x: actor.gripTarget.x - actor.facing * 6, y: actor.gripTarget.y + 3 }; actor.gripLocked = true;
        }
      });
      if (caught && a && v && (waitingForCatch || elapsed < exchange.impact)) {
        const receiver = actors.get(exchange.aggressor)!, charger = actors.get(exchange.victim)!;
        const gap = Math.hypot(a.x - v.x, a.y - v.y), depth = Math.abs(a.y - v.y);
        if (gap < 60 && depth < 18) {
          prepareContactActor(charger); prepareContactActor(receiver);
          const waist = sampleArenaFighterContacts(charger, reduced ? 0 : clock).waist;
          receiver.gripTarget = waist; receiver.secondaryGripTarget = { x: waist.x - receiver.facing * 6, y: waist.y + 3 };
          receiver.gripStrength = caught.gripStrength || ease((60 - gap) / 18); receiver.gripLocked = true; receiver.gripMode = 'waist';
          if (exchange.chargeSetup?.contactAt === null) {
            const hands = sampleArenaFighterContacts(receiver, reduced ? 0 : clock).hands;
            if (hands.every((hand, arm) => Math.hypot(hand.x - (arm ? waist.x : receiver.secondaryGripTarget!.x), hand.y - (arm ? waist.y : receiver.secondaryGripTarget!.y)) < 7)) {
              const span = Math.max(1, exchange.impact - exchange.start), loadDuration = Math.max(180, span * .12), turnDuration = Math.max(300, span * .28);
              const impact = elapsed + loadDuration + turnDuration;
              contact.round = { ...exchange, chargeSetup: { ...exchange.chargeSetup, contactAt: elapsed, contactCharger: { x: v.x, y: v.y }, contactReceiver: { x: a.x, y: a.y }, loadDuration, turnDuration }, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
              exchange = contact.round;
            }
          }
        }
      }
      if (ram && waitingForRam && ram.stage === 'charge' && a && v) {
        const driver = actors.get(exchange.aggressor)!, victim = actors.get(exchange.victim)!;
        prepareContactActor(driver); prepareContactActor(victim);
        const striker = sampleArenaFighterContacts(driver, reduced ? 0 : clock), receiver = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
        const chest = { x: (receiver.shoulders[0].x + receiver.shoulders[1].x) / 2, y: (receiver.shoulders[0].y + receiver.shoulders[1].y) / 2 + victim.scale * 9 };
        if (Math.hypot(striker.shoulders[1].x - chest.x, striker.shoulders[1].y - chest.y) < 12) {
          const impact = elapsed;
          contact.round = { ...exchange, chargeSetup: { ...exchange.chargeSetup!, contactAt: impact, contactCharger: { x: a.x, y: a.y }, contactReceiver: { x: v.x, y: v.y } }, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit };
          exchange = contact.round;
          const exit = makeExit(exchange, { x: v.x, y: v.y }, 0, victim.angle, 0, ram.side);
          exit.launchedAt = impact; sim.exits.set(exchange.victim, exit);
          effects.push(() => { clash(ctx, chest, 0, 1.3); if (!reduced) dust(ctx, chest.x, v.y, 0, 1.3); });
        }
      }
      if (technique && exchange.tactic === 'elbow' && technique.elbowContact > 0) {
        const striker = actors.get(exchange.aggressor)!, target = actors.get(exchange.victim)!;
        prepareContactActor(target); striker.elbowTarget = sampleArenaFighterContacts(target, reduced ? 0 : clock).head;
      }
      if (rush?.grip === 'pair') {
        for (const id of rush.pairIds) {
          const holder = actors.get(id), partner = actors.get(rush.pairIds.find(other => other !== id)!);
          if (!holder || !partner || sim.exits.has(id) || Math.hypot(holder.x - partner.x, holder.y - partner.y) >= 70) continue;
          prepareContactActor(partner);
          const waist = sampleArenaFighterContacts(partner, reduced ? 0 : clock).waist;
          holder.pose = 'grapple'; holder.gripMode = 'waist'; holder.gripTarget = waist;
          holder.secondaryGripTarget = { x: waist.x - holder.facing * 6, y: waist.y + 3 }; holder.gripStrength = 1; holder.gripLocked = true;
        }
      }
      if (elbowPickup && technique?.grip === 'ankle') {
        const driver = actors.get(exchange.aggressor)!, target = actors.get(exchange.victim)!;
        driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0; driver.gripLocked = false;
        if (connections || Math.hypot(driver.x - elbowPickup.holder.x, driver.y - elbowPickup.holder.y) < 40) {
          prepareContactActor(target);
          const feet = sampleArenaFighterContacts(target, reduced ? 0 : clock).feet;
          driver.pose = 'drag'; driver.facing = -technique.side; driver.gripMode = 'ankle'; driver.gripTarget = feet[0]; driver.secondaryGripTarget = feet[1]; driver.gripStrength = 1; driver.gripLocked = connections;
          if (exchange.elbowGripAt === null && technique.phase >= .67) {
            prepareContactActor(driver);
            const hands = sampleArenaFighterContacts(driver, reduced ? 0 : clock).hands;
            if (feet.every((foot, leg) => Math.hypot(foot.x - hands[1 - leg].x, foot.y - hands[1 - leg].y) < 5)) {
              driver.gripLocked = true;
              const remaining = exchange.resolve - exchange.impact;
              contact.round = { ...exchange, elbowGripAt: elapsed, impact: elapsed, resolve: elapsed + remaining, end: elapsed + remaining }; exchange = contact.round;
            }
          }
        }
      }
      if (rush?.outcome === 'double-out' && (rush.stage === 'contact' || rush.stage === 'push')) {
        const driver = actors.get(rush.chargerId)!;
        const pair = rush.pairIds.map(id => actors.get(id)!);
        // A runner pushes the near wrestler, who is still holding the other.
        // Reaching past one whole torso to put a hand on the distant wrestler
        // breaks normal arm reach on a horizontal or diagonal approach.
        const near = [...pair].sort((left, right) => Math.hypot(left.x - driver.x, left.y - driver.y) - Math.hypot(right.x - driver.x, right.y - driver.y))[0];
        driver.facing = near.x >= driver.x ? 1 : -1;
        sim.bodies.get(rush.chargerId)!.facing = driver.facing;
        prepareContactActor(near);
        const shoulders = sampleArenaFighterContacts(near, reduced ? 0 : clock).shoulders;
        driver.gripTarget = shoulders[0]; driver.secondaryGripTarget = shoulders[1]; driver.gripStrength = 1; driver.gripLocked = true;
        for (let index = 0; index < pair.length; index++) {
          const actor = pair[index], other = pair[1 - index]; prepareContactActor(other);
          const shoulders = sampleArenaFighterContacts(other, reduced ? 0 : clock).shoulders;
          actor.gripTarget = shoulders[0]; actor.secondaryGripTarget = shoulders[1];
          actor.gripStrength = 1; actor.gripLocked = true; actor.gripMode = 'shoulder';
        }
      }
      if (rush?.grip === 'arms-legs') {
        const victim = actors.get(exchange.victim)!, victimBody = sim.bodies.get(exchange.victim)!;
        prepareContactActor(victim);
        if (!contact.pairCarryOrigins?.pickup) {
          // Save the fallen body's painted waist. A grounded sprite has a
          // different pivot from a supported one, so its model root alone
          // cannot describe a continuous pickup.
          const floor = reset && rush.pickupAt !== null ? arenaPairRushTargets({ ...exchange, pairPickupAt: null }, rush.plannedPickupAt, center, contact.chargerOrigin, contact.pairCarryOrigins) : rush;
          const floorActor = reset ? { ...victim, ...floor.victim, pose: 'stunned' as const, angle: floor.victimAngle, suspension: 0, carryStretch: undefined, pairCarry: false, animation: undefined, motionImmediate: true } : victim;
          const waist = sampleArenaFighterContacts(floorActor, reduced ? 0 : clock).waist;
          const pair = rush.pairIds.map(id => { const body = sim.bodies.get(id)!; return { x: body.x, y: body.y }; }) as [ArenaPoint, ArenaPoint];
          contact.pairCarryOrigins = { ...(contact.pairCarryOrigins ?? { victim: { ...rush.contactPoint }, pair, direction: { x: -rush.chargeDirection.x, y: -rush.chargeDirection.y }, facing: rush.chargerFacing }), pickup: { victim: { ...floor.victim }, pair, waist: { ...waist } } };
        }
        const pickup = contact.pairCarryOrigins.pickup!;
        // Align the same anatomical point throughout load, lift and heave.
        // Do not replace the impact point or snap to a fixed sprite offset.
        let contacts = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
        const dx = pickup.waist.x + rush.throwShift - contacts.waist.x, dy = pickup.waist.y - rush.lift - contacts.waist.y;
        victim.x += dx; victim.y += dy; victimBody.x = victim.x; victimBody.y = victim.y + rush.lift;
        contacts = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
        contact.pairGripMap ??= new Map(); contact.pairReachAt ??= new Map();
        let ready = true;
        for (const [id, endpoints] of [[rush.armsHolderId!, contacts.shoulders], [rush.legsHolderId!, contacts.feet]] as const) {
          const holder = actors.get(id)!, body = sim.bodies.get(id)!, prior = before.get(id) ?? body;
          holder.pose = 'pairlift'; holder.gripMode = id === rush.legsHolderId ? 'ankle' : 'shoulder';
          holder.facing = id === rush.armsHolderId ? -rush.side : rush.side;
          holder.pairLoad = rush.pairLoad; holder.pairLift = rush.pairLift; holder.pairBackload = rush.pairBackload; holder.pairHeave = rush.pairHeave;
          if (!contact.pairGripMap.has(id)) contact.pairGripMap.set(id, endpoints[0].y <= endpoints[1].y ? [0, 1] : [1, 0]);
          const [back, front] = contact.pairGripMap.get(id)!, ordered = [endpoints[front], endpoints[back]];
          holder.gripTarget = ordered[0]; holder.secondaryGripTarget = ordered[1]; holder.gripStrength = 1; holder.gripLocked = true;
          prepareContactActor(holder);
          let goal = arenaCarryHolderPoint({ ...holder, animation: undefined, motionImmediate: true }, ordered, reduced ? 0 : clock, { x: body.x, y: body.y });
          const approaching = rush.waitingForPickup && Math.hypot(goal.x - prior.x, goal.y - prior.y) > 30 && !contact.pairReachAt.has(id);
          if (approaching) { holder.pose = 'walk'; holder.gripTarget = undefined; holder.secondaryGripTarget = undefined; holder.gripStrength = 0; holder.gripLocked = false; ready = false; }
          else if (rush.waitingForPickup) {
            if (!contact.pairReachAt.has(id)) contact.pairReachAt.set(id, elapsed);
            holder.pairReach = ease((elapsed - contact.pairReachAt.get(id)!) / 180);
            if (holder.pairReach < 1) ready = false;
          }
          if (!approaching) for (let attempt = 0; attempt < 3; attempt++) {
            const predicted = { ...holder, ...goal, velocityX: seconds ? (goal.x - prior.x) / seconds : 0, velocityY: seconds ? (goal.y - prior.y) / seconds : 0, gaitDistance: body.gait + Math.hypot(goal.x - prior.x, goal.y - prior.y) };
            goal = arenaCarryHolderPoint(predicted, ordered, reduced ? 0 : clock, goal);
          }
          const distance = Math.hypot(goal.x - prior.x, goal.y - prior.y), step = reset ? 1 : Math.min(1, 165 * seconds / Math.max(.001, distance));
          body.x = prior.x + (goal.x - prior.x) * step; body.y = prior.y + (goal.y - prior.y) * step;
          body.motorX = seconds ? (body.x - prior.x) / seconds : 0; body.motorY = seconds ? (body.y - prior.y) / seconds : 0;
          holder.x = body.x; holder.y = body.y; prepareContactActor(holder);
          const hands = sampleArenaFighterContacts(holder, reduced ? 0 : clock).hands;
          if (Math.hypot(hands[1].x - ordered[0].x, hands[1].y - ordered[0].y) > 5 || Math.hypot(hands[0].x - ordered[1].x, hands[0].y - ordered[1].y) > 5) ready = false;
        }
        if (rush.waitingForPickup && ready) {
          pickup.pair = rush.pairIds.map(id => { const body = sim.bodies.get(id)!; return { x: body.x, y: body.y }; }) as [ArenaPoint, ArenaPoint];
          const impact = elapsed + ARENA_PAIR_COUNTER_TIMING.release - ARENA_PAIR_COUNTER_TIMING.grip;
          contact.round = { ...exchange, pairPickupAt: elapsed, impact, resolve: impact + 1100 * unit, end: impact + 1100 * unit }; exchange = contact.round;
        }
        victim.depthY = victimBody.y;
        victim.captureRelease = true;
      }
      if (technique && ['trip', 'sidekick'].includes(exchange.tactic) && elapsed >= technique.kickReactionAt && !sim.exits.has(exchange.victim)) {
        const victim = actors.get(exchange.victim)!, body = sim.bodies.get(exchange.victim)!;
        const launch = arenaTechniqueTargets(exchange, technique.kickReactionAt, center);
        const lift = Math.max(0, (victim.depthY ?? body.y) - victim.y);
        const exit = makeExit(exchange, { x: body.x, y: body.y }, lift, launch.victimAngle, body.motorX ?? 0, technique.side);
        exit.launchedAt = technique.kickReactionAt; sim.exits.set(exchange.victim, exit);
      }
      if (technique?.spin && !sim.exits.has(exchange.victim)) {
        const driver = actors.get(exchange.aggressor)!, victim = actors.get(exchange.victim)!;
        const body = sim.bodies.get(exchange.victim)!;
        const orbit = reduced ? technique.side < 0 ? Math.PI : 0 : technique.spin.orbit;
        const weight = technique.spin.weight;
        prepareContactActor(driver); prepareContactActor(victim);
        const grips = arenaSpinGripPair(driver, orbit, reduced ? 0 : clock, weight);
        driver.gripTarget = grips[1]; driver.secondaryGripTarget = grips[0];
        driver.gripStrength = 1; driver.gripLocked = true; driver.gripMode = 'wrist';
        if (elapsed < exchange.impact) driver.pose = 'grapple';
        victim.pose = 'held'; victim.facing = -technique.side;
        victim.spinSuspension = { ...technique.spin, orbit, grips };
        const snapshot = arenaSpinSnapshot(victim, reduced ? 0 : clock);
        const groundY = driver.depthY ?? driver.y;
        const depthY = groundY + Math.sin(orbit) * 112 * .20 * weight;
        victim.x = snapshot.origin.x; victim.y = snapshot.origin.y; victim.depthY = depthY;
        body.x = victim.x; body.y = depthY; body.motorX = 0; body.motorY = 0;
        if (!exchange.exchange && elapsed >= exchange.impact) {
          const lift = Math.max(0, depthY - snapshot.origin.y);
          const exit = makeExit(exchange, { x: snapshot.origin.x, y: snapshot.origin.y + lift }, lift, 0, 0, technique.side);
          exit.spinSnapshot = snapshot;
          sim.exits.set(exchange.victim, exit);
        }
      }
      if (ordinaryRecoveryPrelude && actors.has(exchange.victim)) actors.get(exchange.victim)!.captureRelease = true;
      const pair = rush ? rush.pairIds.map(id => sim.bodies.get(id)!) : [a, v];
      if (contact.metAt === undefined && elapsed < exchange.impact && pair[0] && pair[1] && Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) < 88) {
        contact.metAt = elapsed;
        const continuation = exchange.prepares ? sim.contacts.get(exchange.prepares) : undefined;
        if (continuation) continuation.metAt ??= elapsed;
      }
      const contactPhase = technique ? .08 : .30;
      if (!ordinaryRecoveryPrelude && !contact.committed && contact.metAt !== undefined && !rush && !exchange.prepares && !charge && !caught && !ram && elapsed >= exchange.start) {
        contact.committed = true;
        if (elapsed < exchange.start + (exchange.impact - exchange.start) * contactPhase) contact.round = { ...contact.round, start: (elapsed - contactPhase * exchange.impact) / (1 - contactPhase) };
      }
      if (!exchange.exchange && !['trip', 'sidekick'].includes(exchange.tactic) && elapsed >= exchange.impact
        && !waitingForCatch
        && !waitingForRam
        && exchange.elbowGripAt !== null
        && (!rush || !rush.waitingForGrip && elapsed >= rush.requiredImpactAt)) arenaEliminatedIds(exchange).forEach(id => {
        if (sim.exits.has(id)) return;
        const body = sim.bodies.get(id), victim = actors.get(id), exitRound = id === exchange.victim ? exchange : { ...exchange, victim: id, secondaryVictim: undefined };
        const jointThrow = rush?.outcome === 'counter-throw' && id === exchange.victim;
        const heldOrigin = !reset && jointThrow && body?.animation?.pose === 'carried' ? body.animation.contactPoints?.origin : undefined;
        // At release the hands have already opened, so connections is false.
        // Carry the last painted overhead height into the free flight instead
        // of restarting the thrown body from the ground.
        const heldGround = jointThrow && heldOrigin ? before.get(id)?.y ?? body!.y : body?.y;
        const launchLift = jointThrow && body ? heldOrigin ? Math.max(0, heldGround! - heldOrigin.y) : rush.lift : rush?.outcome === 'double-out' && victim && body ? Math.max(0, (victim.depthY ?? body.y) - victim.y) : action.liftedId === id ? heldLift : 0;
        const origin = body && { x: heldOrigin?.x ?? body.x, y: heldGround! };
        if (body && origin) {
          let physicalRound = exitRound;
          if (isArenaFloorDrag(exitRound)) {
            const timing = arenaFloorExitTiming(exitRound, unit);
            physicalRound = { ...exitRound, floorFinish: { dragUntil: timing.dragUntil, throwAt: null, releaseAt: null } };
            contact.round = physicalRound; exchange = physicalRound;
          }
          const exit = makeExit(physicalRound, origin, launchLift, victim?.angle ?? 0, body.motorX ?? 0, jointThrow ? rush.side : technique?.exitDirection);
          if (jointThrow) { exit.heldFacing = victim?.facing ?? -rush.side; if (heldOrigin && body.animation?.spinSnapshot) exit.spinSnapshot = structuredClone(body.animation.spinSnapshot); }
          if (rush?.outcome === 'double-out') {
            exit.landing = { ...(id === exchange.victim ? rush.victimExit! : rush.helperExit!) };
            exit.velocity = rush.pushSpeed;
            exit.heldFacing = body.animation?.facing ?? victim?.facing ?? body.facing;
            body.facing = exit.heldFacing;
            const joints = body.animation?.contactPoints;
            if (joints) exit.pushRelease = { hands: structuredClone(joints.hands) as [ArenaPoint, ArenaPoint], elbows: structuredClone(joints.elbows) as [ArenaPoint, ArenaPoint], shoulders: structuredClone(joints.shoulders) as [ArenaPoint, ArenaPoint], root: { ...(before.get(id) ?? body) }, angle: exit.angle, lean: (body.animation?.motion?.lean ?? 0) * Math.PI / 180 };
          }
          sim.exits.set(id, exit);
        }
      });
      if (rush && !rush.waitingForGrip && rush.pairIds.every(id => actors.has(id)) && actors.has(rush.chargerId) && elapsed >= rush.contactAt && elapsed - rush.contactAt < 320 * unit) {
        const charger = actors.get(rush.chargerId)!, pair = rush.pairIds.map(id => actors.get(id)!);
        const shoulder = sampleArenaFighterContacts(charger, reduced ? 0 : clock).shoulders[1];
        const pairShoulders = pair.map(actor => sampleArenaFighterContacts(actor, reduced ? 0 : clock).shoulders[1]);
        const point = { x: (shoulder.x + (pairShoulders[0].x + pairShoulders[1].x) / 2) / 2, y: (shoulder.y + (pairShoulders[0].y + pairShoulders[1].y) / 2) / 2 };
        const age = (elapsed - rush.contactAt) / unit;
        effects.push(() => { clash(ctx, point, reduced ? 0 : age, 1.5); if (!reduced) dust(ctx, point.x, charger.depthY ?? charger.y, age, 2.8); });
        if (!reduced) collisionShake = Math.sin(age * .12) * 9 * (1 - clamp(age / 220));
      }
      if (rush?.stage === 'rebound' || rush?.stage === 'groggy') {
        const victim = actors.get(exchange.victim)!;
        effects.push(() => {
          const age = (elapsed - rush.contactAt) / unit;
          if (!reduced) dust(ctx, victim.x, victim.depthY ?? v!.y, age, .75);
          if (rush.stage === 'groggy') {
            const head = sampleArenaFighterContacts(victim, reduced ? 0 : clock).head;
            for (let index = 0; index < 3; index++) {
              const angle = (reduced ? 0 : clock / 190) + index * Math.PI * 2 / 3;
              const x = head.x + Math.cos(angle) * 20, y = head.y - 15 + Math.sin(angle) * 6;
              ctx.fillStyle = '#ffe58b'; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(x - 1, y - 3, 2, 6);
            }
          }
        });
      }
      if (technique && exchange.tactic === 'suplex' && technique.slamImpact > 0) {
        const victim = actors.get(exchange.victim)!;
        effects.push(() => {
          dust(ctx, victim.x, victim.depthY ?? v!.y, (1 - technique.slamImpact) * 380, 1.45);
          const head = sampleArenaFighterContacts(victim, reduced ? 0 : clock).head;
          if (head) for (let index = 0; index < 3; index++) {
            const angle = clock / 170 + index * Math.PI * 2 / 3;
            const x = head.x + Math.cos(angle) * 22, y = head.y - 15 + Math.sin(angle) * 7;
            ctx.fillStyle = '#ffe58b'; ctx.fillRect(x - 4, y - 1, 8, 2); ctx.fillRect(x - 1, y - 4, 2, 8);
          }
        });
      }
      if (technique && exchange.tactic === 'elbow' && technique.phase >= .55) {
        elbowKnockouts.add(exchange.victim);
        if (technique.phase < .84) words.set(exchange.victim, '기절!');
        const victim = actors.get(exchange.victim)!;
        if (technique.elbowImpact > 0) effects.push(() => {
          const head = sampleArenaFighterContacts(victim, reduced ? 0 : clock).head;
          clash(ctx, head, (1 - technique.elbowImpact) * 260);
        });
      }
      else if (!reduced && action.stage === 'lift' && connections) effects.push(() => dust(ctx, center.x, center.y, (elapsed - exchange.start) / unit - 1950, .25));
      if (!reduced && charge && charge.stage !== 'prepare') {
        const launch = arenaChargeTargets(exchange, charge.chargeStartsAt, center).charger;
        effects.push(() => dust(ctx, launch.x - charge.side * 24, launch.y, elapsed - charge.chargeStartsAt, .55));
      }
    }
  }
  for (const [id, exit] of sim.exits) {
    const body = sim.bodies.get(id)!;
    const launchedAt = exit.launchedAt ?? exit.round.impact;
    const doubleRush = exit.round.rushOutcome === 'double-out';
    const age = Math.max(0, elapsed - launchedAt) + (exit.round.tactic === 'sidekick' && !exit.round.kickCatch && !exit.round.wrestlingMove ? 40 * unit : 0);
    const pairFlight = exit.round.rushOutcome === 'counter-throw' || exit.round.passingTrip ? arenaPairRushFlight(age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle, relax: exit.round.rushOutcome === 'counter-throw', upward: exit.round.rushOutcome === 'counter-throw' ? ARENA_PAIR_THROW_UPWARD : undefined }) : undefined;
    const dodge = exit.dodgeFall && exit.round.pairDodge ? arenaPairDodgeTargets(exit.round.pairDodge, elapsed, exit.dodgeFall.center, exit.dodgeFall.origins, unit) : undefined;
    const dodgeAge = dodge ? elapsed - dodge.requiredEndAt : 0;
    const dodgeFlight = dodge ? { x: dodge.charger.x, y: dodge.charger.y - dodge.chargerHeight, groundX: dodge.charger.x, groundY: dodge.charger.y, height: dodge.chargerHeight, angle: dodge.chargerAngle * (1 - ease(dodgeAge / (500 * unit))), phase: clamp(age / (650 * unit)), stage: dodgeAge < 0 ? 'fall' as const : dodgeAge < 220 * unit ? 'land' as const : dodgeAge < 720 * unit ? 'recover' as const : 'walk' as const } : undefined;
    const floorTiming = isArenaFloorDrag(exit.round) && !exit.spinFlight ? arenaFloorExitTiming(exit.round, unit) : undefined;
    const pushFlight = doubleRush ? arenaPairPushFlight(age, exit.origin, exit.landing, exit.side, unit, { speed: exit.velocity || ARENA_PAIR_PUSH_SPEED, angle: exit.angle }) : undefined;
    const spinFlight = exit.spinFlight ? (() => {
      const released = exit.spinFlight, duration = released.duration, p = clamp(age / duration), time = Math.min(age, duration) / 1000;
      const x = exit.origin.x + released.velocity.x * time;
      const y = exit.origin.y - exit.lift + released.velocity.y * time + .5 * released.gravity * time * time;
      const groundY = exit.origin.y + (exit.landing.y - exit.origin.y) * p;
      const height = Math.max(0, groundY - y);
      const turn = released.angularVelocity * time * (1 - p / 2), angle = exit.angle + turn;
      return { x, y, groundX: x, groundY, height, angle: age < duration ? angle : angle * (1 - ease((age - duration) / 180)), phase: p,
        stage: age < duration ? 'flight' as const : age < duration + 180 ? 'land' as const : age < duration + 560 ? 'recover' as const : 'walk' as const };
    })() : undefined;
    const flight = spinFlight ?? dodgeFlight ?? pairFlight ?? pushFlight ?? arenaTechniqueExit(exit.round, age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle }) ?? (exit.round.tactic === 'bait' ? arenaChargeFall(age, exit.origin, exit.landing, exit.side, unit, exit.velocity) : exit.round.tactic === 'edge' || exit.round.tactic === 'shove' || exit.round.tactic === 'double-shove' && exit.round.rushOutcome !== 'counter-throw' ? arenaEdgeFall(age, exit.origin, exit.landing, exit.side, unit) : arenaThrow(age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle, immediate: !!exit.round.wrestlingMove || !!exit.round.supermanPunch || ['ram', 'spin', 'armspin'].includes(exit.round.tactic) || !!exit.round.rushOutcome, rotation: exit.round.tactic === 'ram' || exit.round.tactic === 'sidekick' ? exit.side : undefined }));
    const index = props.candidates.findIndex(candidate => candidate.id === id);
    let pose: ArenaPose = flight.stage === 'overrun' ? exit.round.tactic === 'edge' || exit.round.tactic === 'shove' || exit.round.tactic === 'double-shove' ? 'brace' : 'run' : flight.stage === 'fall' || flight.stage === 'flight' || flight.stage === 'rim-toss' || flight.stage === 'roll' || flight.stage === 'hold' && exit.lift > 3 ? 'airborne' : flight.stage === 'land' ? 'land' : flight.stage === 'recover' ? 'recover' : flight.stage === 'hold' ? 'brace' : 'walk';
    if (flight.stage === 'stunned' || flight.stage === 'drag') pose = 'stunned';
    if (exit.round.tactic === 'elbow' && pose === 'stunned') elbowKnockouts.add(id);
    if (flight.stage === 'roll') pose = 'roll';
    const place = podiumById.get(id);
    const toCelebration = won && !!place && elapsed >= place.readyAt && flight.stage === 'walk';
    if (flight.stage === 'walk') {
      if (!toCelebration) move(body, exit.bench, seconds, 94);
      if (Math.hypot(exit.bench.x - body.x, exit.bench.y - body.y) < 4) {
        body.facing = exit.side < 0 ? 1 : -1;
        pose = Math.floor((clock + index * 617) / 2400) % 3 ? 'clap' : 'bow';
      }
    }
    else { body.x = flight.x; body.y = reduced && flight.stage === 'flight' ? flight.groundY - flight.height * .28 : flight.y; }
    const actor: ChoreographedActor = { candidate: props.candidates[index], index, x: body.x, y: body.y, depthY: flight.stage === 'walk' ? body.y : flight.groundY, scale: 2.04, facing: body.facing, pose, angle: reduced ? 0 : flight.stage === 'walk' ? 0 : flight.angle, yaw: reduced ? 0 : 'yaw' in flight ? flight.yaw : 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: flight.phase, chargePreparation: exit.round.tactic === 'bait' && flight.stage === 'overrun' ? 1 : 0, chargeStrength: exit.round.tactic === 'bait' && flight.stage === 'overrun' ? 1 : 0 };
    if (exit.spinFlight && (flight.stage === 'flight' || flight.stage === 'land')) actor.eyesClosed = true;
    if (pushFlight && flight.stage !== 'walk') { actor.facing = exit.heldFacing ?? actor.facing; actor.suspension = 1 - ease((age - 550 * unit) / (250 * unit)); }
    if (pushFlight && exit.pushRelease && flight.stage !== 'walk') {
      const source = exit.pushRelease;
      const translated = (points: [ArenaPoint, ArenaPoint]) => points.map(point => ({ x: point.x + actor.x - source.root.x, y: point.y + actor.y - source.root.y })) as [ArenaPoint, ArenaPoint];
      // Keep the painted arm angles at letting go, then bring both hands in
      // to protect the falling body. A free IK pole must not switch mid-fall.
      actor.carrierRelease = { hands: translated(source.hands), elbows: translated(source.elbows), shoulders: translated(source.shoulders), progress: ease(age / (550 * unit)), direction: actor.facing, sourceAngle: source.angle, sourceLean: source.lean };
    }
    if (dodge?.rearExit && flight.stage !== 'walk') {
      actor.rearExitCutoff = dodge.exitRim!.y + 3;
      actor.scale *= 1 - .16 * dodge.exitProgress * (1 - ease(dodgeAge / (720 * unit)));
      if (dodgeAge < 0) effects.push(() => {
        dust(ctx, dodge.exitRim!.x, dodge.exitRim!.y, age / unit, .7);
        text(ctx, '장외!', dodge.exitRim!.x, dodge.exitRim!.y - 30, 17, '#ffe2a2', 90);
      });
    }
    if (pairFlight && flight.stage !== 'walk') {
      actor.pose = pairFlight.pose; actor.suspension = pairFlight.suspension; actor.facing = exit.heldFacing ?? pairFlight.facing; actor.carryStretch = pairFlight.carryStretch;
      if (exit.round.rushOutcome === 'counter-throw') { actor.carrySupport = 'shoulder'; actor.pairCarry = true; actor.pairLoad = 1; actor.pairLift = 1; actor.pairBackload = 1; actor.pairHeave = 1; actor.carryFlight = flight.stage === 'flight' ? pairFlight.phase : flight.stage === 'land' ? 1 : undefined; }
    }
    if (exit.round.tactic === 'suplex' && (flight.stage === 'stunned' || flight.stage === 'drag')) actor.slamProgress = { tuck: 1, slump: 1 };
    if (exit.spinSnapshot) {
      let snapshot = exit.spinSnapshot;
      if (exit.spinFlight && (flight.stage === 'flight' || flight.stage === 'land')) {
        const rimToss = !!exit.floorThrow;
        if (rimToss) snapshot = arenaAnkleRimFlightSnapshot(snapshot, Math.min(age, exit.spinFlight.duration));
        const source = snapshot.matrix, center = exit.spinFlight.center;
        // Airborne rotation preserves the release silhouette and turns about
        // the same measured waist; depth foreshortening cannot resize it midair.
        const finalTurn = exit.spinFlight.angularVelocity * exit.spinFlight.duration / 2000;
        const turn = flight.stage === 'land' ? finalTurn : flight.angle - exit.angle, c = Math.cos(turn), s = Math.sin(turn);
        snapshot = { ...snapshot, matrix: [c * source[0] - s * source[1], s * source[0] + c * source[1], c * source[2] - s * source[3], s * source[2] + c * source[3], center.x + c * (source[4] - center.x) - s * (source[5] - center.y), center.y + s * (source[4] - center.x) + c * (source[5] - center.y)] };
      }
      const releaseWeight = flight.stage === 'hold' ? 1
        : flight.stage === 'flight' ? exit.spinFlight ? 1 : 1 - ease(exit.round.rushOutcome === 'counter-throw' ? (flight.phase - .06) / .20 : flight.phase)
          : exit.spinFlight && flight.stage === 'land' ? 1 - ease((age - exit.spinFlight.duration) / 180) : 0;
      actor.spinRelease = { snapshot, weight: releaseWeight };
    }
    actors.set(id, actor);
    if (floorTiming && exit.round.floorFinish?.releaseAt == null) {
      const driverBody = sim.bodies.get(exit.round.aggressor), driver = actors.get(exit.round.aggressor), contact = sim.contacts.get(exit.round.id);
      if (driverBody && driver && contact) {
        const finish = exit.round.floorFinish!;
        prepareContactActor(actor);
        const contacts = sampleArenaFighterContacts({ ...actor, pose: 'stunned', angle: reduced ? 0 : exit.angle }, reduced ? 0 : clock);
        const pickup = arenaAnklePickup({ x: actor.x, y: actor.y }, contacts.feet, exit.side);
        exit.dragOffset = pickup.offset;
        const atRim = age >= floorTiming.dragUntil;
        const rimFrame = atRim ? arenaTechniqueExit(exit.round, floorTiming.dragUntil, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle }) : undefined;
        const preferred = arenaInsidePoint(atRim ? exit.driverStop ?? { x: rimFrame!.groundX + pickup.offset.x, y: rimFrame!.groundY + pickup.offset.y } : { x: flight.groundX + pickup.offset.x, y: flight.groundY + pickup.offset.y }, 8);
        const holder = { ...driver, ...preferred, pose: 'drag' as const, facing: -exit.side, yaw: 0, gripMode: 'ankle' as const, gripTarget: contacts.feet[1], secondaryGripTarget: contacts.feet[0], gripStrength: 1, gripLocked: true, animation: undefined, motionImmediate: true };
        // Keep the reachable pickup through the handoff to the shared drag.
        // Re-clipping only its root would separate the palms from the ankles.
        const target = arenaInsidePoint(arenaCarryHolderPoint(holder, [contacts.feet[1], contacts.feet[0]], reduced ? 0 : clock, preferred), 8);
        if (!exit.floorThrow) {
          if (reset || reduced || flight.stage === 'drag') { driverBody.x = target.x; driverBody.y = target.y; driverBody.motorX = 0; driverBody.motorY = 0; }
          else move(driverBody, target, seconds, 165);
          if (flight.stage === 'drag') exit.driverStop = { x: driverBody.x, y: driverBody.y };
        } else { driverBody.x = exit.floorThrow.driver.x; driverBody.y = exit.floorThrow.driver.y; driverBody.motorX = 0; driverBody.motorY = 0; }
        const pickupDistance = Math.hypot(driverBody.x - target.x, driverBody.y - target.y);
        driverBody.facing = -exit.side; driver.x = driverBody.x; driver.y = driverBody.y; driver.depthY = driverBody.y; driver.facing = driverBody.facing; driver.yaw = 0;
        driver.pose = pickupDistance < 40 || exit.floorThrow ? 'drag' : 'walk';
        driver.gripTarget = contacts.feet[1]; driver.secondaryGripTarget = contacts.feet[0]; driver.gripStrength = 1; driver.gripMode = 'ankle'; driver.gripLocked = true;
        // Once the toss begins, keep the preceding throwing rig. Sampling a
        // fresh dragging pose here restarted its arm entry on every frame.
        if (!exit.floorThrow) prepareContactActor(driver);
        const hands = exit.floorThrow ? undefined : sampleArenaFighterContacts(driver, reduced ? 0 : clock).hands;
        const ready = !hands || hands.every((hand, index) => Math.hypot(hand.x - contacts.feet[index].x, hand.y - contacts.feet[index].y) < 5);
        // Reaching is not yet a committed hold. Only painted palm contact
        // can lock the ankle grip or begin the rim throw.
        driver.gripLocked = ready;
        if (atRim && !exit.floorThrow && ready) {
          const midpoint = { x: (contacts.feet[0].x + contacts.feet[1].x) / 2, y: (contacts.feet[0].y + contacts.feet[1].y) / 2 };
          exit.floorThrow = { driver: { x: driver.x, y: driver.y }, ankles: [contacts.feet[0], contacts.feet[1]], orbit: Math.atan2((contacts.head.y - midpoint.y) / .45, contacts.head.x - midpoint.x), facing: driver.facing < 0 ? -1 : 1 };
          contact.round = { ...exit.round, floorFinish: { ...finish, throwAt: elapsed } }; exit.round = contact.round;
        }
        if (exit.floorThrow) {
          const throwAge = elapsed - exit.round.floorFinish!.throwAt!;
          const held = arenaAnkleRimThrowTargets(throwAge, { ...exit.floorThrow, direction: exit.side < 0 ? -1 : 1 });
          driver.pose = 'throw'; driver.ankleRimToss = true; driver.phase = clamp(throwAge / 1000); driver.ankleThrowProgress = driver.phase; driver.ankleSpinRaise = held.raise;
          driver.gripTarget = held.gripTargets[1]; driver.secondaryGripTarget = held.gripTargets[0]; prepareContactActor(driver);
          const palms = sampleArenaFighterContacts(driver, reduced ? 0 : clock).hands;
          actor.pose = 'stunned'; actor.angle = exit.angle; actor.suspension = 0; actor.carryStretch = undefined; actor.slamProgress = { tuck: 0, slump: 1 }; actor.eyesClosed = true;
          actor.spinSuspension = { ...held.ankleSpin, grips: [palms[0], palms[1]] };
          const snapshot = arenaSpinSnapshot(actor, reduced ? 0 : clock);
          actor.x = snapshot.origin.x; actor.y = snapshot.origin.y; actor.depthY = driver.y;
          body.x = actor.x; body.y = driver.y; body.motorX = 0; body.motorY = 0;
          words.set(exit.round.aggressor, '던지기!');
          if (held.releaseReady) {
            const rig = sampleArenaFighterContacts(driver, reduced ? 0 : clock), state = driver.animation;
            exit.floorArms = { hands: [rig.hands[0], rig.hands[1]], elbows: [rig.elbows[0], rig.elbows[1]], shoulders: [rig.shoulders[0], rig.shoulders[1]], root: { x: driver.x, y: driver.y }, stance: state?.motion ? { crouch: (state.supportHip?.y ?? state.motion.crouch - 20) + 20, hipX: state.supportHip?.x ?? state.motion.hipX, lean: state.motion.lean, head: state.motion.head, shoulderLift: state.motion.shoulderLift, contact: state.motion.contact } : undefined };
            exit.spinSnapshot = arenaReleaseSnapshot(actor, reduced ? 0 : clock);
            const prior = arenaAnkleRimThrowTargets(throwAge - 1, { ...exit.floorThrow, direction: exit.side < 0 ? -1 : 1 });
            const priorPhase = clamp((throwAge - 1) / 1000);
            const priorHands = sampleArenaFighterContacts({ ...driver, overheadRaise: prior.overheadRaise, ankleSpinRaise: prior.raise, phase: priorPhase, ankleThrowProgress: priorPhase, gripTarget: prior.gripTargets[1], secondaryGripTarget: prior.gripTargets[0] }, reduced ? 0 : clock).hands;
            exit.origin = { x: snapshot.origin.x, y: driver.y }; exit.lift = Math.max(0, driver.y - snapshot.origin.y); exit.heldFacing = actor.facing;
            releaseSpin(exit, actor, driver, held.ankleSpin.orbit, held.angularVelocity, false, priorHands);
            exit.launchedAt = elapsed;
            contact.round = { ...exit.round, floorFinish: { ...exit.round.floorFinish!, releaseAt: elapsed }, resolve: elapsed + Math.max(1580 * unit, exit.spinFlight!.duration + 560), end: elapsed + Math.max(1580 * unit, exit.spinFlight!.duration + 560) }; exit.round = contact.round;
            actor.spinSuspension = undefined; actor.spinRelease = { snapshot: exit.spinSnapshot, weight: 1 };
            driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0; driver.gripLocked = false;
          }
        }
      }
    }
    if (exit.floorArms && exit.launchedAt !== undefined && elapsed - exit.launchedAt <= 650) {
      const driver = actors.get(exit.round.aggressor), source = exit.floorArms;
      if (driver) {
        driver.pose = 'throw'; driver.ankleRimToss = true; driver.ankleThrowProgress = 1;
        const driverBody = sim.bodies.get(exit.round.aggressor)!; driverBody.x = source.root.x; driverBody.y = source.root.y; driverBody.motorX = 0; driverBody.motorY = 0;
        driver.x = source.root.x; driver.y = source.root.y; driver.depthY = source.root.y; driver.facing = exit.floorThrow!.facing;
        driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0; driver.gripLocked = false;
        const followThrough = spinFollowThrough(exit);
        driver.carrierRelease = { ...source, progress: clamp((elapsed - exit.launchedAt) / 650), direction: Math.sign(followThrough?.x ?? 0) || exit.side, followThrough };
      }
    }
    if (flight.stage === 'flight' || flight.stage === 'rim-toss') effects.push(() => { ctx.fillStyle = '#27332e40'; ctx.beginPath(); ctx.ellipse(flight.groundX, flight.groundY + 4, 32, 7, 0, 0, Math.PI * 2); ctx.fill(); });
    // Landing dust belongs to a real floor contact, never to a delayed drag or toss.
    if (!reduced && ['land', 'roll', 'recover'].includes(flight.stage)) {
      const landingAge = (age - (exit.spinFlight?.duration ?? floorTiming?.tossUntil ?? 880 * unit)) / unit;
      effects.push(() => dust(ctx, exit.landing.x, exit.landing.y, landingAge, 1.5));
    }
  }
  if (won) {
    const winnerId = order[0], winner = sim.bodies.get(winnerId)!;
    const winnerPlace = podiumById.get(winnerId)!;
    const ceremonyReady = reduced || elapsed >= winnerPlace.readyAt;
    if (ceremonyReady && (reset || reduced)) { winner.x = winnerPlace.x; winner.y = winnerPlace.y; winner.motorX = 0; winner.motorY = 0; }
    else if (ceremonyReady) move(winner, winnerPlace, seconds, 126);
    const actor = actors.get(winnerId)!;
    actor.x = winner.x; actor.y = winner.y; actor.facing = winner.facing; actor.pose = ceremonyReady ? Math.hypot(winner.x - winnerPlace.x, winner.y - winnerPlace.y) > 8 ? 'walk' : 'cheer' : 'guard';
    podiumPlaces.slice(1).forEach(place => {
      const body = sim.bodies.get(place.id), actor = actors.get(place.id);
      const exit = sim.exits.get(place.id);
      if (!body || !actor || !exit || !reduced && elapsed < place.readyAt) return;
      if (reset || reduced) { body.x = place.x; body.y = place.y; body.motorX = 0; body.motorY = 0; }
      else move(body, place, seconds, 190);
      const distance = Math.hypot(body.x - place.x, body.y - place.y);
      if (distance < 8) body.facing = place.x < winnerPlace.x ? 1 : -1;
      actor.x = body.x; actor.y = body.y; actor.angle = 0; actor.facing = body.facing;
      actor.pose = distance < 8 ? 'clap' : distance > 100 ? 'run' : 'walk'; actor.phase = place.rank === 2 ? .35 : .78;
    });
    actor.scale = 2.04;
    const settled = podiumPlaces.every(place => {
      const body = sim.bodies.get(place.id);
      return body && Math.hypot(body.x - place.x, body.y - place.y) < 8;
    });
    effects.push(() => podium(ctx, podiumPlaces, settled ? 1 : .38));
    if (!reduced) effects.push(() => { for (let i = 0; i < 38; i++) { const fall = (clock * (.04 + i % 4 * .007) + i * 47) % 420; ctx.fillStyle = ['#ffda72', '#85cec3', '#e9a185'][i % 3]; ctx.fillRect(120 + i * 131 % 760, 130 + fall, 5, 4); } });
  }
  for (const [id, actor] of actors) {
    const body = sim.bodies.get(id)!;
    // Lifted bodies keep their standing depth; throws supply their projected ground depth above.
    actor.depthY ??= body.y;
    const previous = before.get(id) ?? body;
    const ground = !['airborne', 'held', 'carried', 'roll', 'land', 'recover', 'sidekick', 'stunned', 'elbow'].includes(actor.pose);
    const distance = Math.hypot(body.x - previous.x, body.y - previous.y);
    if (seconds && ground) body.gait += distance;
    if (reduced) { body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; }
    else if (seconds) { body.vx = (body.x - previous.x) / seconds; body.vy = (body.y - previous.y) / seconds; }
    actor.velocityX = body.vx;
    actor.velocityY = body.vy;
    actor.gaitDistance = body.gait;
    actor.motionEpoch = sim.epoch;
    actor.motionImmediate = reset || reduced;
    body.animation ??= createArenaFighterAnimation();
    actor.animation = body.animation;
  }
  for (const id of elbowKnockouts) {
    const victim = actors.get(id);
    if (!victim || victim.pose !== 'stunned') continue;
    overlays.push(() => {
      const head = sampleArenaFighterContacts(victim, reduced ? 0 : clock).head;
      for (let index = 0; index < 3; index++) {
        const angle = (reduced ? 0 : clock / 180) + index * Math.PI * 2 / 3;
        const x = head.x + Math.cos(angle) * 24, y = head.y - 18 + Math.sin(angle) * 7;
        ctx.fillStyle = '#ffe58b'; ctx.fillRect(x - 4, y - 1, 8, 2); ctx.fillRect(x - 1, y - 4, 2, 8);
      }
    });
  }
  const camera = sampleArenaCamera(sim.camera, { elapsed, final: !props.preview && !!exchange?.final && elapsed >= exchange.start && elapsed < exchange.resolve, fighters: order.slice(0, 2).map(id => actors.get(id)!).filter(Boolean), width: W, height: H, delta: props.paused ? 0 : delta, immediate: reset || reduced });
  ctx.save(); ctx.translate(W / 2 + collisionShake, H / 2 + collisionShake * .35); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
  drawArenaScenery(ctx, clock, { intensity: exchange?.tactic === 'team' || exchange?.tactic === 'betrayal' ? .8 : .35, reduced });
  effects.forEach(draw => draw());
  // Every name is fixed below its owner and sits behind every fighter.
  for (const actor of actors.values()) drawArenaName(ctx, actor);
  arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));
  overlays.forEach(draw => draw());
  const alerted = new Set<string>();
  if (!props.preview && !won) for (const contact of sim.contacts.values()) {
    if (contact.metAt === undefined) continue;
    const age = elapsed - contact.metAt;
    if (age < 0 || age > 520) continue;
    const pop = reduced ? 1 : .78 + .22 * Math.sin(Math.min(1, age / 180) * Math.PI / 2);
    const meetingPair = contact.round.rushOutcome ? arenaPairRushTargets(contact.round, contact.metAt, contact.center).pairIds : [contact.round.aggressor, contact.round.victim];
    for (const id of meetingPair) {
      if (alerted.has(id)) continue;
      const actor = actors.get(id), head = actor?.animation?.contactPoints?.head;
      if (!actor || !head || sim.exits.has(id)) continue;
      alerted.add(id);
      ctx.save(); ctx.globalAlpha = 1 - ease((age - 330) / 190);
      ctx.translate(head.x, head.y - 38); ctx.scale(pop, pop);
      ctx.fillStyle = '#172b32'; ctx.fillRect(-4, -2, 8, 17); ctx.fillRect(-4, 18, 8, 8);
      ctx.fillStyle = '#ffe17a'; ctx.fillRect(-2, 0, 4, 13); ctx.fillRect(-2, 20, 4, 4); ctx.restore();
    }
  }
  const visibleRound = won ? sim.contacts.get(rounds.at(-1)!.id)?.round ?? rounds.at(-1) : exchange ? sim.contacts.get(exchange.id)?.round ?? exchange : undefined;
  const wordBoxes: { x: number; y: number; width: number }[] = [];
  if (!won) for (const [id, word] of words) {
    const actor = actors.get(id), head = actor?.animation?.contactPoints?.head;
    const callingAlly = ['이리 와!', '도와줘!', '갈게!', '같이 하자!', '좋아!'].includes(word);
    if (!actor || actor.pose === 'walk' && !callingAlly || sim.exits.has(id) && !(word === '구르기!' && actor.pose === 'roll')) continue;
    const x = head?.x ?? actor.x, top = (head?.y ?? actor.y - 120) - 22;
    ctx.save(); ctx.font = '800 14px "Malgun Gothic", sans-serif';
    const width = ctx.measureText(word).width + 8; let y = top;
    while (wordBoxes.some(box => Math.abs(x - box.x) < (width + box.width) / 2 + 3 && Math.abs(y - box.y) < 20)) y -= 21;
    wordBoxes.push({ x, y, width });
    ctx.shadowColor = '#172b32'; ctx.shadowBlur = 3;
    text(ctx, word, x, y + 1, 14, word === '회피!' || word === '막기!' ? '#b5f0e5' : '#ffe2a2', width); ctx.restore();
  }
  ctx.restore();
  return visibleRound;
}

export default function ArenaShow(props: SportsStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef(props), sampledAt = useRef(0);
  latest.current = props;
  const [sceneFrame, setSceneFrame] = useState<{ key: string; round?: ArenaRound; rounds: ArenaRound[] }>();
  useEffect(() => { sampledAt.current = performance.now(); }, [props.elapsed, props.paused, props.preview]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const buffer = document.createElement('canvas');
    const sim: Simulation = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let request = 0, previous = 0, clock = 0, narrationKey = '', lastFrameError = '', timelineEnd = 0, timelineKey = '';
    const draw = (now: number) => {
      const state = latest.current, delta = previous ? Math.min(50, Math.max(0, now - previous)) : 16;
      previous = now; if (!state.paused && !media.matches) clock += delta;
      const box = element.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(box.width * ratio)), height = Math.max(1, Math.round(box.height * ratio));
      const scale = Math.min(width / W, height / H);
      const elapsed = clamp(state.elapsed + (state.paused || state.preview ? 0 : Math.min(80, Math.max(0, now - sampledAt.current))), 0, Math.max(state.duration, state.elapsed + 80));
      const frame = presentArenaCanvasFrame(element, buffer, width, height, ctx => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#172b34'; ctx.fillRect(0, 0, width, height);
        ctx.setTransform(scale, 0, 0, scale, (width - W * scale) / 2, (height - H * scale) / 2); ctx.imageSmoothingEnabled = false;
        return render(ctx, state, elapsed, clock, sim, state.paused ? 0 : delta, media.matches);
      });
      if (!frame.ok) {
        const message = frame.error instanceof Error ? frame.error.message : String(frame.error);
        if (message !== lastFrameError) console.error('Arena frame could not be painted', frame.error);
        lastFrameError = message; sim.key = '';
        request = requestAnimationFrame(draw); return;
      }
      lastFrameError = '';
      const frameRound = frame.value;
      const frameKey = [sim.key, sim.epoch, ...(frameRound ? [frameRound.id, frameRound.tactic, frameRound.aggressor, frameRound.victim, frameRound.helper, frameRound.rushOutcome, frameRound.rushLaunchAt, frameRound.rushContactAt, frameRound.pairPickupAt, frameRound.pushContactAt, frameRound.sidekickLaunchAt, frameRound.suplexGripAt, frameRound.elbowGripAt, frameRound.floorFinish?.dragUntil, frameRound.floorFinish?.throwAt, frameRound.floorFinish?.releaseAt, frameRound.chargeSetup?.contactAt, frameRound.wrestlingMove?.kind, frameRound.wrestlingMove?.launchAt, frameRound.wrestlingMove?.contactAt, frameRound.wrestlingMove?.counterReadyAt, frameRound.wrestlingMove?.dragEndAt, frameRound.wrestlingMove?.releaseAt, frameRound.wrestlingMove?.kickAt, frameRound.wrestlingMove?.ankleGripAt, frameRound.kickCatch?.launchAt, frameRound.kickCatch?.catchAt, frameRound.rimPush, frameRound.supermanPunch?.launchAt, frameRound.supermanPunch?.hitAt, frameRound.slideTrip?.launchAt, frameRound.slideTrip?.hookAt, frameRound.slideTrip?.kickAt, frameRound.slideTrip?.jumpAt, frameRound.slideTrip?.passAt, frameRound.slideTrip?.evade, frameRound.slideTrip?.plannedLaunchAt, frameRound.linkedRush?.launchAt, frameRound.linkedRush?.contactAt, frameRound.pairDodge?.launchAt, frameRound.pairDodge?.contactAt, frameRound.pairDodge?.outcome, frameRound.pairDodge?.end, frameRound.passingTrip?.start, frameRound.passingTrip?.hookAt, frameRound.passingTrip?.launchAt, frameRound.passingTrip?.joined, frameRound.passingTrip?.end, frameRound.rim?.contactAt, frameRound.rim?.outcome, frameRound.rim?.start, frameRound.rim?.end, frameRound.rimCharge?.outcome, frameRound.rimCharge?.start, frameRound.rimCharge?.end, frameRound.start, frameRound.impact, frameRound.resolve, state.arenaEscapeSeed, frameRound.escape?.ungripped] : [])].join(':');
      if (frameKey !== narrationKey) {
        narrationKey = frameKey;
        setSceneFrame({ key: sim.key, round: frameRound, rounds: [...sim.contacts.values()].filter(contact => sceneTimed(contact.round) || contact.slideTripOrigins || contact.kickCatchOrigins || contact.wrestlingMoveOrigins || contact.supermanPunchOrigins).map(contact => contact.round) });
      }
      if (timelineKey !== sim.key) { timelineKey = sim.key; timelineEnd = 0; }
      const actualEnd = Math.max(0, ...[...sim.contacts.values()].map(contact => contact.round.end));
      if (!state.preview && !media.matches && actualEnd > timelineEnd) { timelineEnd = actualEnd; state.onArenaTimelineUpdate?.(actualEnd); }
      request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, []);
  const order = useMemo(() => validOrder(props.candidates, props.order), [props.candidates, props.order]);
  const rounds = useMemo(() => arenaRounds(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed), [order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed]);
  const currentFrame = sceneFrame?.key === sceneSignature(props) ? sceneFrame : undefined;
  const actualRounds = rounds.map(round => currentFrame?.rounds.find(actual => actual.id === round.id) ?? round);
  const ranks = props.preview ? {} : resolvedRanks(order, actualRounds, props.elapsed);
  const finished = !props.preview && !!actualRounds.length && resolvedRounds(actualRounds, props.elapsed).length === actualRounds.length;
  const plannedRound = finished ? actualRounds.at(-1) : actualRounds.find(round => props.elapsed < round.resolve);
  const round = currentFrame && currentFrame.round?.id === plannedRound?.id ? currentFrame.round : plannedRound;
  const narration = arenaNarration(props.preview ? undefined : round, props.candidates, order, props.elapsed, props.preview);
  const alive = props.candidates.length - Object.values(ranks).filter(rank => rank !== 1).length;
  return <section className="arena-show" aria-label="전원 동시 장외 난투">
    <div className="arena-stage">
      <canvas ref={canvas} className="arena-canvas" aria-label={finished ? `${props.candidates.find(candidate => candidate.id === order[0])?.name} 우승` : '여러 무리가 동시에 붙고 밀고 뒤집는 장외 난투'} />
      <ArenaStory round={props.preview ? undefined : round} candidates={props.candidates} elapsed={props.elapsed} preview={props.preview} finished={finished} title={narration.title} detail={narration.detail} />
      {props.paused && <div className="arena-paused">난투 잠시 멈춤</div>}
    </div>
    <aside className="arena-board" aria-label="생존 및 확정 순위">
      <header className="arena-board-heading"><strong>{finished ? '최종 순위' : '모래판 현황'}</strong><span>{props.preview ? `${props.candidates.length}명 출전` : finished ? '승부 확정' : `${alive}명 생존`}</span></header>
      <div className="arena-roster" role="list" style={{ '--arena-count': Math.max(1, props.candidates.length), '--arena-columns': Math.max(1, Math.min(5, props.candidates.length)), '--arena-rows': Math.ceil(Math.max(1, props.candidates.length) / 5) } as CSSProperties}>
        {(finished ? [...props.candidates].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : props.candidates).map(candidate => {
          const rank = ranks[candidate.id], index = props.candidates.findIndex(item => item.id === candidate.id);
          return <div key={candidate.id} role="listitem" className={`arena-entry${rank ? rank === 1 ? ' arena-champion' : ' arena-eliminated' : ''}`} style={{ '--arena-color': candidate.color } as CSSProperties} aria-label={`${candidate.name}, ${rank ? `${rank}위 확정` : '생존'}`} title={`${candidate.name} · ${rank ? `${rank}위 확정` : '생존'}`}>
            <span className="arena-number">{rank === 1 ? '★' : rank ?? index + 1}</span><span className="arena-name">{candidate.name}</span><span className="arena-state">{rank === 1 ? '우승' : rank ? `${rank}위` : props.preview ? '준비' : '생존'}</span>
          </div>;
        })}
        {!props.candidates.length && <p className="arena-empty">참가자를 입력해 주세요</p>}
      </div>
    </aside>
  </section>;
}
