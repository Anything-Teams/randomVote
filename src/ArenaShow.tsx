import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Candidate } from './election';
import type { SportsStageProps } from './sports';
import { arenaAction, arenaActionWords, arenaApproachSpeed, arenaCatchTargets, arenaChargeFall, arenaChargeTargets, arenaContactRound, arenaDoubleShoveTargets, arenaEliminatedIds, arenaFaceOpponent, arenaInsidePoint, arenaLocalContact, arenaEdgeFall, arenaEdgeTargets, arenaExitDirection, arenaFocusRound, arenaGuardTarget, arenaMiniExchanges, arenaMove as move, arenaNarration, arenaNearbyResponse, arenaPodium, arenaRamTargets, arenaRanks, arenaReleaseTarget, arenaRoamingTarget, arenaRounds, arenaShoveTargets, arenaSpinTargets, arenaStartingPoint, arenaThrow, type ArenaPoint, type ArenaPodiumPlace, type ArenaRoamingStage, type ArenaRound } from './arenaLogic';
import { arenaDrawOrder, arenaSpinGripPair, arenaSpinSnapshot, arenaWristGripPoint, createArenaFighterAnimation, drawArenaFighter, drawArenaName, sampleArenaFighterContacts, type ArenaActor, type ArenaFighterAnimation, type ArenaPose, type ArenaSpinSnapshot } from './game/ArenaFighter';
import { drawArenaScenery } from './game/arenaArt';
import ArenaStory from './ArenaStory';
import { arenaTechniqueTargets, arenaTechniqueExit, arenaTechniqueReactionAt, arenaFloorExitTiming, isArenaFloorDrag, isArenaFinalTechnique } from './arenaTechniques';
import { arenaPairRushFlight, arenaPairRushTargets } from './arenaPairRush';
import { arenaEscapeTargets } from './arenaEscape';
import { arenaRecoveryTargets } from './arenaRecovery';
import { arenaAnklePickup } from './arenaPickup';
import { arenaRimTargets } from './arenaRimEvent';
import { arenaRimChargeTargets, type ArenaRimChargeOrigins } from './arenaRimCharge';
import { createArenaCamera, sampleArenaCamera, type ArenaCamera } from './arenaCamera';
import './arena.css';

type Body = ArenaPoint & { gait: number; facing: number; vx: number; vy: number; motorX?: number; motorY?: number; restUntil?: number; animation?: ArenaFighterAnimation; roam?: { key: string; origin: ArenaPoint; target: ArenaPoint; neighborId?: string } };
type Contact = { center: ArenaPoint; side: number; round: ArenaRound; started?: boolean; metAt?: number; committed?: boolean; chargerOrigin?: ArenaPoint; escapeFinished?: boolean; recoveryFinished?: boolean; rimFinished?: boolean; rimOrigins?: { aggressor: ArenaPoint; victim: ArenaPoint }; rimChargeOrigins?: ArenaRimChargeOrigins; rimChargeFinished?: boolean; sidekickLaunched?: boolean; elbowFall?: ArenaPoint; elbowApproachOrigin?: ArenaPoint; releases?: Map<string, ArenaPoint> };
type Exit = { round: ArenaRound; origin: ArenaPoint; landing: ArenaPoint; side: number; bench: ArenaPoint; lift: number; angle: number; velocity: number; launchedAt?: number; dragOffset?: ArenaPoint; driverStop?: ArenaPoint; spinSnapshot?: ArenaSpinSnapshot };
type Simulation = { key: string; elapsed: number; epoch: number; camera: ArenaCamera; bodies: Map<string, Body>; contacts: Map<string, Contact>; exits: Map<string, Exit>; minis: Map<string, ArenaRound> };
type ChoreographedActor = ArenaActor;
const W = 1000, H = 620;
const clamp = (p: number, low = 0, high = 1) => Math.max(low, Math.min(high, p));
const ease = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };

function validOrder(candidates: Candidate[], supplied: string[]) {
  const ids = new Set(candidates.map(candidate => candidate.id));
  const order = [...new Set(supplied)].filter(id => ids.has(id));
  return [...order, ...candidates.map(candidate => candidate.id).filter(id => !order.includes(id))];
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

function relationship(ctx: CanvasRenderingContext2D, round: ArenaRound, elapsed: number, actors: Map<string, ChoreographedActor>, labels = false, bodies?: Map<string, Body>) {
  if (round.tactic !== 'team' && round.tactic !== 'betrayal' || elapsed >= round.resolve || elapsed - round.impact > 420) return;
  const action = arenaAction(round, elapsed), tone = action.betrayed ? '#fa8c7a' : '#84ded1';
  const ground = (id: string) => bodies?.get(id) ?? actors.get(id);
  ctx.save();
  if (!labels) {
    for (const part of action.actors) {
      const point = ground(part.id);
      if (!point) continue;
      ctx.strokeStyle = part.id === action.targetId ? '#fff0b2' : tone; ctx.lineWidth = 2; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.ellipse(point.x, point.y + 3, 31, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const link = (fromId: string, toId: string, broken = false) => {
      const from = ground(fromId), to = ground(toId);
      if (!from || !to || Math.hypot(from.x - to.x, from.y - to.y) > (broken ? 185 : 125)) return;
      const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2 + 6;
      ctx.globalAlpha = .9; ctx.strokeStyle = tone; ctx.lineWidth = 3; ctx.setLineDash(broken ? [7, 10] : []);
      ctx.beginPath(); ctx.moveTo(from.x, from.y + 6); ctx.lineTo(to.x, to.y + 6); ctx.stroke(); ctx.setLineDash([]);
      if (broken) { ctx.beginPath(); ctx.moveTo(midX - 6, midY - 7); ctx.lineTo(midX + 6, midY + 7); ctx.moveTo(midX + 6, midY - 7); ctx.lineTo(midX - 6, midY + 7); ctx.stroke(); }
      else if (action.stage === 'joint-attack' || action.stage === 'counter') { const direction = Math.sign(to.x - from.x); ctx.beginPath(); ctx.moveTo(midX - direction * 6, midY - 5); ctx.lineTo(midX, midY); ctx.lineTo(midX - direction * 6, midY + 5); ctx.stroke(); }
    };
    if (action.betrayed && round.helper) link(round.helper, round.victim, true);
    action.attackers.forEach(id => link(id, action.targetId));
  } else {
    action.actors.forEach(part => {
      const actor = actors.get(part.id);
      if (!actor) return;
      const x = actor.x, y = actor.y - 143 - (part.id === action.targetId ? 32 : 0), value = String(actor.index + 1) + ' · ' + part.badge;
      ctx.font = '800 13px "Malgun Gothic", sans-serif';
      const width = Math.max(69, ctx.measureText(value).width + 14);
      ctx.globalAlpha = .94; ctx.fillStyle = '#172b32'; ctx.fillRect(x - width / 2, y, width, 23);
      ctx.strokeStyle = part.id === action.targetId ? '#fff0b2' : tone; ctx.lineWidth = 1; ctx.strokeRect(x - width / 2, y, width, 23);
      text(ctx, value, x, y + 4, 13, part.id === action.targetId ? '#fff0b2' : tone, width - 8);
    });
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, props: SportsStageProps, elapsed: number, clock: number, sim: Simulation, delta: number, reduced: boolean) {
  const order = validOrder(props.candidates, props.order);
  const signature = `${props.preview}:${props.duration}:${props.arenaRushRoll}:${props.arenaEscapeSeed}:${props.order.join(',')}:${props.candidates.map(candidate => candidate.id).join(',')}`;
  const seek = elapsed < sim.elapsed - 150 || elapsed - sim.elapsed > 500;
  const reset = sim.key !== signature || seek;
  if (reset) { sim.key = signature; sim.epoch++; sim.bodies.clear(); sim.contacts.clear(); sim.exits.clear(); sim.minis.clear(); }
  sim.elapsed = elapsed;
  const rounds = arenaRounds(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed);
  const unit = rounds[0]?.timeScale ?? props.duration / 44_000;
  const ranks = props.preview ? {} : arenaRanks(order, elapsed, props.duration, props.arenaRushRoll, props.arenaEscapeSeed);
  const won = !props.preview && !!rounds.length && elapsed >= rounds.at(-1)!.resolve;
  const podiumPlaces = arenaPodium(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed), podiumById = new Map(podiumPlaces.map(place => [place.id, place]));
  const releasedIds = new Set(rounds.filter(round => round.escape?.outcome === 'separate' && elapsed >= round.escape.end && elapsed < round.start).flatMap(round => [round.escape!.runnerId, round.escape!.chaserId! ]));
  const upcomingPlan = props.preview || won ? undefined : rounds.find(round => {
    const entry = round.recovery?.start ?? round.escape?.start ?? round.rimCharge?.start ?? round.rim?.start ?? round.start;
    return entry > elapsed && entry - elapsed < 2400 * unit && ![round.aggressor, round.victim].some(id => releasedIds.has(id));
  });
  const focusPlan = props.preview || won ? undefined : arenaFocusRound(order, elapsed, props.duration, props.arenaRushRoll, props.arenaEscapeSeed);
  const upcoming = upcomingPlan ? sim.contacts.get(upcomingPlan.id)?.round ?? upcomingPlan : undefined;
  const exchange = focusPlan ? sim.contacts.get(focusPlan.id)?.round ?? focusPlan : undefined;
  const focusEscape = exchange?.escape ? arenaEscapeTargets(exchange, elapsed, { x: 500, y: 416 }) : undefined;
  const engaged = new Set(focusEscape?.released ? [] : focusEscape?.active ? [focusEscape.runnerId, focusEscape.chaserId] : exchange ? [exchange.aggressor, exchange.victim, exchange.helper] : []);
  const preparing = new Set(upcoming ? [upcoming.aggressor, upcoming.victim, upcoming.helper].filter(id => !!id && !engaged.has(id)) : []);
  const living = order.filter(id => !ranks[id]);
  const active = won ? order.filter(id => id === order[0]) : living;
  const before = new Map([...sim.bodies].map(([id, body]) => [id, { x: body.x, y: body.y }]));
  const actors = new Map<string, ChoreographedActor>();
  const words = new Map<string, string>();
  const effects: (() => void)[] = [];
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
  // A direct skip or paused fixture seek creates every eliminated actor as well.
  if (!props.preview) rounds.filter(round => elapsed >= round.resolve).forEach(round => arenaEliminatedIds(round).forEach(id => {
    if (sim.exits.has(id)) return;
    const center = arenaLocalContact({ x: 500, y: 425 }, []), actual = arenaContactRound(round, center);
    const rush = actual.rushOutcome ? arenaPairRushTargets(actual, actual.impact, center) : undefined;
    const double = actual.tactic === 'double-shove' ? rush ?? arenaDoubleShoveTargets(actual, actual.impact, center) : undefined;
    const technique = isArenaFinalTechnique(actual) ? arenaTechniqueTargets(actual, actual.impact, center) : undefined;
    const exitRound = id === round.victim ? actual : { ...actual, victim: id, secondaryVictim: undefined };
    const lift = rush?.outcome === 'double-out' ? id === actual.victim ? rush.victimLift : rush.helperLift : rush?.lift ?? technique?.lift ?? 0;
    const angle = rush ? id === actual.helper ? rush.helperAngle : rush.victimAngle : technique?.victimAngle ?? 0;
    const exit = makeExit(exitRound, double ? id === round.victim ? double.victim : double.helper : technique?.victim ?? (actual.tactic === 'bait' ? arenaChargeTargets(actual, actual.impact, center).charger : actual.tactic === 'edge' ? arenaEdgeTargets(actual, actual.impact, center).victim : actual.tactic === 'shove' ? arenaShoveTargets(actual, actual.impact, center).victim : { x: 500, y: 425 }), lift, angle, 0, technique?.exitDirection);
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
  if (!props.preview && !won) for (const round of arenaMiniExchanges(ambient.filter(id => !releasedIds.has(id) && !miniParticipants.has(id) && elapsed >= (sim.bodies.get(id)!.restUntil ?? 0)).map(id => ({ id, x: sim.bodies.get(id)!.x, y: sim.bodies.get(id)!.y })), elapsed, props.duration, rounds)) {
    sim.minis.set(round.id, round); miniParticipants.add(round.aggressor); miniParticipants.add(round.victim);
  }
  for (const id of miniParticipants) preparing.delete(id);
  active.forEach(id => {
    if (sim.exits.has(id)) return;
    const index = props.candidates.findIndex(candidate => candidate.id === id), body = sim.bodies.get(id)!;
    const cycle = (elapsed / unit + index * 673) % 5600;
    const roaming = ambient.includes(id) && !miniParticipants.has(id) && !preparing.has(id), available = roaming ? ambient.filter(other => other !== id && !miniParticipants.has(other) && !preparing.has(other)) : [];
    if (miniParticipants.has(id)) body.roam = undefined;
    const nextBout = rounds.find(round => round.end > elapsed && [round.aggressor, round.victim, round.helper].includes(id));
    const opponentId = nextBout && !nextBout.helper ? nextBout.aggressor === id ? nextBout.victim : nextBout.aggressor : undefined;
    const partnerBout = opponentId ? rounds.find(round => round.end > elapsed && [round.aggressor, round.victim, round.helper].includes(opponentId)) : undefined;
    const neighborId = !releasedIds.has(id) && opponentId && !releasedIds.has(opponentId) && partnerBout?.id === nextBout?.id && available.includes(opponentId) ? opponentId : undefined;
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
    const aggressor = sim.bodies.get(round.aggressor), victim = sim.bodies.get(round.victim);
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
      [upcoming.aggressor, upcoming.victim, upcoming.helper].forEach((id, role) => {
        if (!id || !preparing.has(id)) return;
        const body = sim.bodies.get(id), actor = actors.get(id);
        if (!body || !actor) return;
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
        const shove = upcoming.tactic === 'double-shove' ? arenaDoubleShoveTargets(upcoming, upcoming.start, contact.center) : upcoming.tactic === 'shove' ? arenaShoveTargets(upcoming, upcoming.start, contact.center) : undefined;
        const target = arenaGuardTarget(technique ? id === upcoming.victim ? technique.victim : technique.aggressor : charge ? id === upcoming.victim ? charge.charger : charge.target : caught ? id === upcoming.victim ? caught.charger : caught.receiver : spin ? id === upcoming.victim ? spin.attacker : spin.defender : ram ? id === upcoming.victim ? ram.victim : ram.driver : shove ? id === upcoming.victim ? shove.victim : id === upcoming.helper ? shove.helper : shove.aggressor : edge ? id === upcoming.victim ? edge.victim : edge.aggressor : { x: contact.center.x + (plan?.offset.x ?? 0), y: contact.center.y + (plan?.offset.y ?? 0) }, actor.index, elapsed);
        const approachDistance = Math.hypot(target.x - body.x, target.y - body.y);
        move(body, target, seconds, arenaApproachSpeed(approachDistance));
        const opponent = sim.bodies.get(plan?.gripId ?? (id === upcoming.victim ? upcoming.aggressor : upcoming.victim));
        if (opponent) arenaFaceOpponent(body, opponent);
        actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
        const touching = opponent && Math.hypot(opponent.x - body.x, opponent.y - body.y) < 88 && !charge && !caught && !ram;
        actor.pose = touching ? id === upcoming.victim ? 'brace' : 'grapple' : Math.hypot(target.x - body.x, target.y - body.y) > 8 ? 'walk' : 'guard';
        actor.gripTarget = touching ? { x: opponent.x - body.facing * 17, y: opponent.y - 44 } : undefined;
        if (touching && contact.metAt === undefined) contact.metAt = elapsed;
      });
    }
  }
  const encounters = [...(exchange ? [exchange] : []), ...sim.minis.values()];
  for (let exchange of encounters) {
    const a = sim.bodies.get(exchange.aggressor), v = sim.bodies.get(exchange.victim);
    const mini = exchange.id.startsWith('mini-');
    if (a && v && !sim.contacts.has(exchange.id)) sim.contacts.set(exchange.id, contactPoint(exchange, encounterOrigin(exchange, a, v)));
    const contact = sim.contacts.get(exchange.id);
    if (contact) {
      if (!contact.started && elapsed >= exchange.start) {
        if (contact.round.tactic === 'edge' && !contact.round.rim && !reset) contact.round = { ...contact.round, pushContactAt: null };
        if (contact.round.chargeSetup && !contact.round.rimCharge && a && v) contact.round = arenaContactRound(contact.round, contact.center, { aggressor: a, victim: v });
        if (contact.round.rushOutcome) {
          const chargerId = contact.round.rushOutcome === 'counter-throw' ? contact.round.victim : contact.round.aggressor;
          const charger = sim.bodies.get(chargerId)!;
          contact.chargerOrigin = { x: charger.x, y: charger.y };
          contact.round = { ...contact.round, rushLaunchAt: reset && elapsed > 300 * unit ? undefined : null, rushContactAt: undefined };
        }
        contact.started = true;
      }
      exchange = contact.round;
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
      if (exchange.rushOutcome && exchange.helper && exchange.rushLaunchAt === null) {
        const firstId = exchange.rushOutcome === 'counter-throw' ? exchange.aggressor : exchange.victim;
        if (pairHasGrip(firstId, exchange.helper)) {
          const first = sim.bodies.get(firstId)!, second = sim.bodies.get(exchange.helper)!;
          contact.center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
          contact.round = { ...contact.round, rushLaunchAt: elapsed, contactSide: first.x >= second.x ? 1 : -1 };
          const chargerId = exchange.rushOutcome === 'counter-throw' ? exchange.victim : exchange.aggressor, charger = sim.bodies.get(chargerId)!;
          contact.chargerOrigin = { x: charger.x, y: charger.y };
          const rush = arenaPairRushTargets(contact.round, elapsed, contact.center, contact.chargerOrigin);
          contact.round = { ...contact.round, rushContactAt: rush.contactAt }; exchange = contact.round;
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
      if (exchange.recovery) {
        const recovery = arenaRecoveryTargets(exchange, elapsed, contact.center)!;
        if (recovery.active) {
          const target = actors.get(exchange.victim)!, thrower = actors.get(exchange.aggressor)!;
          const connected = Math.hypot(a!.x - v!.x, a!.y - v!.y) < 86;
          for (const [body, actor, point] of [[a!, thrower, recovery.thrower], [v!, target, recovery.receiver]] as const) {
            if (reset && elapsed > 300 * unit || actor === target && recovery.airborne) { body.x = point.x; body.y = point.y; body.motorX = 0; body.motorY = 0; }
            else move(body, point, seconds, arenaApproachSpeed(Math.hypot(point.x - body.x, point.y - body.y)));
            actor.x = body.x; actor.y = body.y; actor.phase = recovery.phase;
            body.facing = actor === thrower ? recovery.side : -recovery.side; actor.facing = body.facing;
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripStrength = 0;
            actor.pose = recovery.stage === 'approach' ? Math.hypot(point.x - body.x, point.y - body.y) > 8 ? 'walk' : 'guard' : recovery.stage === 'hold' ? actor === thrower ? 'grapple' : 'brace' : actor === thrower ? recovery.grip ? 'lift' : recovery.throwPhase < 1 ? 'throw' : 'guard' : recovery.airborne ? 'airborne' : recovery.stage === 'land' ? 'land' : 'guard';
          }
          if (connected && recovery.height > 0 && recovery.grip || recovery.airborne) { target.depthY = v!.y; target.y -= recovery.height; target.angle = recovery.angle; target.pose = recovery.airborne ? 'airborne' : 'held'; target.suspension = 1; }
          if (recovery.stage === 'land') { target.angle = recovery.angle; target.phase = recovery.landingPhase; effects.push(() => dust(ctx, target.x, target.y, recovery.landingPhase * 200, .7)); }
          if (connected && recovery.grip) {
            prepareContactActor(target);
            const waist = sampleArenaFighterContacts(target, reduced ? 0 : clock).waist;
            thrower.gripTarget = waist; thrower.secondaryGripTarget = { x: waist.x - thrower.facing * 6, y: waist.y + 3 }; thrower.gripStrength = 1; thrower.gripLocked = true; thrower.gripMode = 'waist';
          }
          if (recovery.airborne) words.set(exchange.victim, '공중 한 바퀴!');
          else if (recovery.stage === 'land' || recovery.stage === 'release') words.set(exchange.victim, '착지! 살았다!');
          continue;
        }
        if (!contact.recoveryFinished && elapsed >= exchange.recovery.end) {
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
      const center = contact.center, action = arenaAction(exchange, elapsed);
      const charge = exchange.tactic === 'bait' ? arenaChargeTargets(exchange, elapsed, center) : undefined;
      const edge = exchange.tactic === 'edge' ? arenaEdgeTargets(exchange, elapsed, center) : undefined;
      const caught = exchange.tactic === 'catch' ? arenaCatchTargets(exchange, elapsed, center) : undefined;
      const spin = exchange.tactic === 'spin' ? arenaSpinTargets(exchange, elapsed, center) : undefined;
      const ram = exchange.tactic === 'ram' ? arenaRamTargets(exchange, elapsed, center) : undefined;
      const technique = isArenaFinalTechnique(exchange) ? arenaTechniqueTargets(exchange, elapsed, center) : undefined;
      if (technique && exchange.tactic === 'elbow' && technique.phase >= .55 && !contact.elbowFall) {
        contact.elbowFall = reset ? { ...technique.victim } : { x: v!.x, y: v!.y };
      }
      const elbowPickup = technique?.victimFloorRig && contact.elbowFall && actors.has(exchange.victim) ? arenaAnklePickup(contact.elbowFall, sampleArenaFighterContacts({ ...actors.get(exchange.victim)!, ...technique.victimFloorRig, ...contact.elbowFall, facing: -technique.side, depthY: contact.elbowFall.y, animation: undefined, motionImmediate: true }, reduced ? 0 : clock).feet, technique.side) : undefined;
      const rush = exchange.rushOutcome ? arenaPairRushTargets(exchange, elapsed, center, contact.chargerOrigin) : undefined;
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
        if (rush?.grip === 'pair' && rush.pairIds.includes(part.id)) target = { ...target, y: center.y + (part.id === rush.pairIds[0] ? 6 : -6) };
        if (technique && exchange.tactic === 'elbow' && contact.elbowFall) {
          if (part.id === exchange.victim) target = contact.elbowFall;
          else if (elbowPickup) {
            contact.elbowApproachOrigin ??= reset ? { x: center.x - technique.side * 12, y: center.y } : { x: body.x, y: body.y };
            const p = ease((technique.phase - .67) / .17), from = contact.elbowApproachOrigin;
            target = arenaInsidePoint({ x: from.x + (elbowPickup.holder.x - from.x) * p, y: from.y + (elbowPickup.holder.y - from.y) * p + Math.sin(p * Math.PI) * 22 }, 8);
          }
        }
        if (action.stage === 'approach' && !rush) target = arenaGuardTarget(target, actor.index, elapsed);
        if (action.stage === 'release') {
          const origin = contact.releases!.get(part.id) ?? body;
          target = arenaReleaseTarget(origin, center, part.role, (elapsed - exchange.impact) / Math.max(1, exchange.end - exchange.impact));
        }
        // Snapshot seeks can reconstruct the current contact. Live actors have
        // the same bounded acceleration and speed as everyone elsewhere.
        if (technique && exchange.tactic === 'elbow' && part.id === exchange.victim && contact.elbowFall) {
          body.x = contact.elbowFall.x; body.y = contact.elbowFall.y; body.motorX = 0; body.motorY = 0;
        }
        else if (rush && part.id === rush.chargerId && ['charge', 'wrestle', 'rebound', 'groggy'].includes(rush.stage)) {
          // The rush model already integrates acceleration from this body's
          // actual origin. A second ground motor would brake before contact,
          // especially on vertical runs, and postpone the visible collision.
          body.motorX = seconds ? (target.x - body.x) / seconds : 0; body.motorY = seconds ? (target.y - body.y) / seconds : 0;
          body.x = target.x; body.y = target.y;
        }
        else if (reset && elapsed > 300 * unit) { body.x = target.x; body.y = target.y; body.motorX = 0; body.motorY = 0; }
        else if (!(technique && isArenaFloorDrag(exchange) && elapsed >= exchange.impact && part.id === exchange.aggressor)) move(body, target, seconds, part.pose === 'run' || spin && spin.turn > 0 || elbowPickup && part.id === exchange.aggressor ? 165 : action.stage === 'approach' ? arenaApproachSpeed(Math.hypot(target.x - body.x, target.y - body.y)) : 118);
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
        if (technique) {
          actor.angle = part.id === exchange.victim ? technique.victimAngle : technique.aggressorAngle;
          if (part.id === exchange.victim && technique.victimPose) actor.pose = technique.victimPose;
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
            actor.facing = ['wrestle', 'charge', 'contact'].includes(rush.stage) ? rush.chargerFacing : -rush.side;
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
          if (rush.outcome === 'counter-throw' && rush.stage === 'release' && !charging && elapsed - exchange.impact < 350 * unit) {
            actor.pose = 'overhead'; actor.overheadRaise = 1; actor.carrierDrive = .86 + .14 * ease((elapsed - exchange.impact) / (350 * unit));
            actor.gripTarget = undefined; actor.secondaryGripTarget = undefined; actor.gripLocked = false;
          }
        }
      });
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
      const heldLift = lifted && connections ? action.lift : 0;
      if (lifted && action.liftedId && !sim.exits.has(action.liftedId)) {
        lifted.y -= heldLift;
        lifted.angle = reduced ? 0 : rush ? rush.victimAngle : technique ? technique.victimAngle : ram ? ram.side * .36 * ram.impact : -.22 * clamp(heldLift / 52);
        if (rush?.outcome === 'counter-throw') lifted.pose = 'carried';
        else if (technique?.victimPose) lifted.pose = technique.victimPose;
        else if (heldLift > 5) lifted.pose = spin && action.liftedId === exchange.victim || technique && exchange.tactic === 'armspin' ? 'held' : 'airborne';
      }
      action.actors.forEach(part => {
        const actor = actors.get(part.id), other = part.gripId ? actors.get(part.gripId) : undefined;
        if (!actor || !other || actor.pose === 'walk' || actor.pose === 'run' || Math.hypot(other.x - actor.x, other.y - actor.y) > 100) return;
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
      if (technique && exchange.tactic === 'elbow' && technique.elbowContact > 0) {
        const striker = actors.get(exchange.aggressor)!, target = actors.get(exchange.victim)!;
        prepareContactActor(target); striker.elbowTarget = sampleArenaFighterContacts(target, reduced ? 0 : clock).head;
      }
      if (rush?.grip === 'pair') {
        for (const id of rush.pairIds) {
          const holder = actors.get(id)!, partner = actors.get(rush.pairIds.find(other => other !== id)!)!;
          if (Math.hypot(holder.x - partner.x, holder.y - partner.y) >= 70) continue;
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
        }
      }
      if (rush?.outcome === 'double-out' && (rush.stage === 'contact' || rush.stage === 'push')) {
        const driver = actors.get(rush.chargerId)!;
        const points = rush.pairIds.map(id => {
          const actor = actors.get(id)!; prepareContactActor(actor);
          const shoulders = sampleArenaFighterContacts(actor, reduced ? 0 : clock).shoulders;
          return { x: (shoulders[0].x + shoulders[1].x) / 2, y: (shoulders[0].y + shoulders[1].y) / 2 };
        });
        driver.gripTarget = points[0]; driver.secondaryGripTarget = points[1]; driver.gripStrength = 1; driver.gripLocked = true;
      }
      if (rush?.grip === 'arms-legs') {
        const victim = actors.get(exchange.victim)!;
        prepareContactActor(victim);
        const contacts = sampleArenaFighterContacts(victim, reduced ? 0 : clock);
        for (const [id, points] of [[rush.armsHolderId!, contacts.hands], [rush.legsHolderId!, contacts.feet]] as const) {
          const holder = actors.get(id)!;
          holder.pose = rush.carrierPose ?? 'grapple'; holder.gripMode = id === rush.legsHolderId ? 'ankle' : 'wrist';
          holder.overheadRaise = rush.overhead;
          holder.carrierDrive = rush.carrierDrive;
          holder.gripTarget = points[0]; holder.secondaryGripTarget = points[1];
          holder.gripStrength = 1; holder.gripLocked = true;
        }
        victim.depthY = Math.max(sim.bodies.get(rush.armsHolderId!)!.y, sim.bodies.get(rush.legsHolderId!)!.y) + 6;
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
      const pair = rush ? rush.pairIds.map(id => sim.bodies.get(id)!) : [a, v];
      if (contact.metAt === undefined && elapsed < exchange.impact && pair[0] && pair[1] && Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) < 88) {
        contact.metAt = elapsed;
        const continuation = exchange.prepares ? sim.contacts.get(exchange.prepares) : undefined;
        if (continuation) continuation.metAt ??= elapsed;
      }
      const contactPhase = technique ? .08 : .30;
      if (!contact.committed && contact.metAt !== undefined && !rush && !exchange.prepares && !charge && !caught && !ram && elapsed >= exchange.start) {
        contact.committed = true;
        if (elapsed < exchange.start + (exchange.impact - exchange.start) * contactPhase) contact.round = { ...contact.round, start: (elapsed - contactPhase * exchange.impact) / (1 - contactPhase) };
      }
      if (!exchange.exchange && !['trip', 'sidekick'].includes(exchange.tactic) && elapsed >= exchange.impact) arenaEliminatedIds(exchange).forEach(id => {
        if (sim.exits.has(id)) return;
        const body = sim.bodies.get(id), victim = actors.get(id), exitRound = id === exchange.victim ? exchange : { ...exchange, victim: id, secondaryVictim: undefined };
        const launchLift = rush?.outcome === 'double-out' && victim && body ? Math.max(0, (victim.depthY ?? body.y) - victim.y) : action.liftedId === id ? heldLift : 0;
        if (body) sim.exits.set(id, makeExit(exitRound, { x: body.x, y: body.y }, launchLift, victim?.angle ?? 0, body.motorX ?? 0, technique?.exitDirection));
      });
      if (!mini) effects.push(() => relationship(ctx, exchange, elapsed, actors, false, sim.bodies));
      if (rush && elapsed >= rush.contactAt && elapsed - rush.contactAt < 320 * unit) {
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
      if (technique && exchange.tactic === 'elbow' && (technique.elbowImpact > 0 || technique.stage === 'groggy')) {
        const victim = actors.get(exchange.victim)!;
        effects.push(() => {
          const head = sampleArenaFighterContacts(victim, reduced ? 0 : clock).head;
          if (technique.elbowImpact > 0) clash(ctx, head, (1 - technique.elbowImpact) * 260);
          for (let index = 0; index < 3; index++) {
            const angle = (reduced ? 0 : clock / 180) + index * Math.PI * 2 / 3;
            const x = head.x + Math.cos(angle) * 20, y = head.y - 15 + Math.sin(angle) * 6;
            ctx.fillStyle = '#ffe58b'; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(x - 1, y - 3, 2, 6);
          }
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
    const stagger = doubleRush && id === exit.round.helper ? 70 * unit : 0;
    const age = Math.max(0, elapsed - launchedAt - stagger) + (exit.round.tactic === 'sidekick' ? 40 * unit : 0);
    const pairFlight = exit.round.rushOutcome === 'counter-throw' ? arenaPairRushFlight(age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle }) : undefined;
    const floorTiming = isArenaFloorDrag(exit.round) ? arenaFloorExitTiming(exit.round, unit) : undefined;
    const flight = pairFlight ?? arenaTechniqueExit(exit.round, age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle }) ?? (exit.round.tactic === 'bait' ? arenaChargeFall(age, exit.origin, exit.landing, exit.side, unit, exit.velocity) : exit.round.tactic === 'edge' || exit.round.tactic === 'shove' || exit.round.tactic === 'double-shove' && exit.round.rushOutcome !== 'counter-throw' ? arenaEdgeFall(age, exit.origin, exit.landing, exit.side, unit) : arenaThrow(age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle, immediate: ['spin', 'armspin'].includes(exit.round.tactic) || !!exit.round.rushOutcome, rotation: exit.round.tactic === 'ram' || exit.round.tactic === 'sidekick' ? exit.side : undefined }));
    const index = props.candidates.findIndex(candidate => candidate.id === id);
    let pose: ArenaPose = flight.stage === 'overrun' ? exit.round.tactic === 'edge' || exit.round.tactic === 'shove' || exit.round.tactic === 'double-shove' ? 'brace' : 'run' : flight.stage === 'fall' || flight.stage === 'flight' || flight.stage === 'rim-toss' || flight.stage === 'roll' || flight.stage === 'hold' && exit.lift > 3 ? 'airborne' : flight.stage === 'land' ? 'land' : flight.stage === 'recover' ? 'recover' : flight.stage === 'hold' ? 'brace' : 'walk';
    if (flight.stage === 'stunned' || flight.stage === 'drag') pose = 'stunned';
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
    const actor: ArenaActor = { candidate: props.candidates[index], index, x: body.x, y: body.y, depthY: flight.stage === 'walk' ? body.y : flight.groundY, scale: 2.04, facing: body.facing, pose, angle: reduced ? 0 : flight.stage === 'walk' ? 0 : flight.angle, yaw: reduced ? 0 : 'yaw' in flight ? flight.yaw : 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: flight.phase, chargePreparation: exit.round.tactic === 'bait' && flight.stage === 'overrun' ? 1 : 0, chargeStrength: exit.round.tactic === 'bait' && flight.stage === 'overrun' ? 1 : 0 };
    if (pairFlight && flight.stage !== 'walk') {
      actor.pose = pairFlight.pose; actor.suspension = pairFlight.suspension; actor.facing = pairFlight.facing; actor.carryStretch = pairFlight.carryStretch;
    }
    if (exit.round.tactic === 'suplex' && (flight.stage === 'stunned' || flight.stage === 'drag')) actor.slamProgress = { tuck: 1, slump: 1 };
    if (exit.spinSnapshot) actor.spinRelease = { snapshot: exit.spinSnapshot, weight: flight.stage === 'hold' ? 1 : flight.stage === 'flight' ? 1 - ease(flight.phase) : 0 };
    actors.set(id, actor);
    if (floorTiming && (flight.stage === 'drag' || flight.stage === 'stunned' || age >= floorTiming.dragUntil && elapsed < exit.round.resolve)) {
      const driverBody = sim.bodies.get(exit.round.aggressor), driver = actors.get(exit.round.aggressor);
      if (driverBody && driver) {
        prepareContactActor(actor);
        const contacts = sampleArenaFighterContacts({ ...actor, pose: 'stunned', angle: reduced ? 0 : exit.angle }, reduced ? 0 : clock);
        const pickup = arenaAnklePickup({ x: actor.x, y: actor.y }, contacts.feet, exit.side);
        exit.dragOffset = pickup.offset;
        const afterToss = age >= floorTiming.dragUntil, rimFrame = afterToss ? arenaTechniqueExit(exit.round, floorTiming.dragUntil, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle }) : undefined;
        const target = arenaInsidePoint(afterToss ? exit.driverStop ?? { x: rimFrame!.groundX + exit.dragOffset.x, y: rimFrame!.groundY + exit.dragOffset.y } : { x: flight.groundX + exit.dragOffset.x, y: flight.groundY + exit.dragOffset.y });
        if (reset || reduced || flight.stage === 'drag') { driverBody.x = target.x; driverBody.y = target.y; driverBody.motorX = 0; driverBody.motorY = 0; }
        else move(driverBody, target, seconds, 165);
        if (flight.stage === 'drag') exit.driverStop = { x: driverBody.x, y: driverBody.y };
        actor.x = body.x; actor.y = body.y; actor.depthY = flight.groundY;
        const pickupDistance = Math.hypot(driverBody.x - target.x, driverBody.y - target.y);
        driverBody.facing = afterToss ? exit.side : -exit.side; driver.x = driverBody.x; driver.y = driverBody.y; driver.facing = driverBody.facing; driver.pose = afterToss ? age < floorTiming.dragUntil + 350 * unit ? 'throw' : 'guard' : pickupDistance < 40 ? 'drag' : 'walk'; driver.yaw = 0;
        prepareContactActor(driver);
        const hands = !afterToss && pickupDistance < 10 ? sampleArenaFighterContacts({ ...driver, gripMode: 'ankle', gripTarget: contacts.feet[0], secondaryGripTarget: contacts.feet[1], gripStrength: 1, gripLocked: true }, reduced ? 0 : clock).hands : undefined;
        const ready = !!hands && contacts.feet.every((foot, index) => Math.hypot(foot.x - hands[1 - index].x, foot.y - hands[1 - index].y) < 5);
        if (afterToss) { driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0; driver.gripLocked = false; driver.phase = clamp((age - floorTiming.dragUntil) / (350 * unit)); if (age < floorTiming.dragUntil + 350 * unit) words.set(exit.round.aggressor, '던지기!'); }
        else if (pickupDistance < 40) { driver.gripTarget = { x: body.x + pickup.feet[0].x, y: body.y + pickup.feet[0].y }; driver.secondaryGripTarget = { x: body.x + pickup.feet[1].x, y: body.y + pickup.feet[1].y }; driver.gripStrength = 1; driver.gripMode = 'ankle'; driver.gripLocked = ready; }
        else { driver.gripTarget = undefined; driver.secondaryGripTarget = undefined; driver.gripStrength = 0; driver.gripLocked = false; }
      }
    }
    if (flight.stage === 'flight' || flight.stage === 'rim-toss') effects.push(() => { ctx.fillStyle = '#27332e40'; ctx.beginPath(); ctx.ellipse(flight.groundX, flight.groundY + 4, 32, 7, 0, 0, Math.PI * 2); ctx.fill(); });
    // Landing dust belongs to a real floor contact, never to a delayed drag or toss.
    if (!reduced && ['land', 'roll', 'recover'].includes(flight.stage)) {
      const landingAge = (age - (floorTiming?.tossUntil ?? 880 * unit)) / unit;
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
  const finalRound = rounds.at(-1);
  const camera = sampleArenaCamera(sim.camera, { elapsed, final: !props.preview && !!finalRound && elapsed >= finalRound.start && elapsed < finalRound.resolve, fighters: order.slice(0, 2).map(id => actors.get(id)!).filter(Boolean), width: W, height: H, delta: props.paused ? 0 : delta, immediate: reset || reduced });
  ctx.save(); ctx.translate(W / 2 + collisionShake, H / 2 + collisionShake * .35); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
  drawArenaScenery(ctx, clock, { intensity: exchange?.tactic === 'team' || exchange?.tactic === 'betrayal' ? .8 : .35, reduced });
  effects.forEach(draw => draw());
  // Every name is fixed below its owner and sits behind every fighter.
  for (const actor of actors.values()) drawArenaName(ctx, actor);
  arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));
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
    if (!actor || actor.pose === 'walk' || sim.exits.has(id) && !(word === '구르기!' && actor.pose === 'roll')) continue;
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
  const [visibleRound, setVisibleRound] = useState<ArenaRound>();
  useEffect(() => { sampledAt.current = performance.now(); }, [props.elapsed, props.paused, props.preview]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    const sim: Simulation = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let request = 0, previous = 0, clock = 0, narrationKey = '';
    const draw = (now: number) => {
      const state = latest.current, delta = previous ? Math.min(50, Math.max(0, now - previous)) : 16;
      previous = now; if (!state.paused && !media.matches) clock += delta;
      const box = element.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(box.width * ratio)), height = Math.max(1, Math.round(box.height * ratio));
      if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#172b34'; ctx.fillRect(0, 0, width, height);
      const scale = Math.min(width / W, height / H);
      ctx.setTransform(scale, 0, 0, scale, (width - W * scale) / 2, (height - H * scale) / 2); ctx.imageSmoothingEnabled = false;
      const elapsed = clamp(state.elapsed + (state.paused || state.preview ? 0 : Math.min(80, Math.max(0, now - sampledAt.current))), 0, state.duration);
      const frameRound = render(ctx, state, elapsed, clock, sim, state.paused ? 0 : delta, media.matches);
      const frameKey = frameRound ? [frameRound.id, frameRound.tactic, frameRound.aggressor, frameRound.victim, frameRound.helper, frameRound.rushOutcome, frameRound.rushLaunchAt, frameRound.rushContactAt, frameRound.pushContactAt, frameRound.sidekickLaunchAt, frameRound.rim?.contactAt, frameRound.rim?.outcome, frameRound.rim?.start, frameRound.rim?.end, frameRound.rimCharge?.outcome, frameRound.rimCharge?.start, frameRound.rimCharge?.end, frameRound.start, frameRound.impact, state.arenaEscapeSeed, frameRound.escape?.ungripped].join(':') : '';
      if (frameKey !== narrationKey) { narrationKey = frameKey; setVisibleRound(frameRound); }
      request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, []);
  const order = useMemo(() => validOrder(props.candidates, props.order), [props.candidates, props.order]);
  const rounds = useMemo(() => arenaRounds(order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed), [order, props.duration, props.arenaRushRoll, props.arenaEscapeSeed]);
  const ranks = props.preview ? {} : arenaRanks(order, props.elapsed, props.duration, props.arenaRushRoll, props.arenaEscapeSeed);
  const finished = !props.preview && !!rounds.length && props.elapsed >= rounds.at(-1)!.resolve;
  const plannedRound = finished ? rounds.at(-1) : arenaFocusRound(order, props.elapsed, props.duration, props.arenaRushRoll, props.arenaEscapeSeed);
  const round = visibleRound?.id === plannedRound?.id ? visibleRound : plannedRound;
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
