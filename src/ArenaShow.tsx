import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Candidate } from './election';
import type { SportsStageProps } from './sports';
import { arenaAction, arenaApproachSpeed, arenaCatchTargets, arenaChargeFall, arenaChargeTargets, arenaContactRound, arenaLocalContact, arenaEdgeFall, arenaEdgeTargets, arenaExitDirection, arenaFocusRound, arenaGuardTarget, arenaMiniExchanges, arenaMove as move, arenaNarration, arenaNearbyResponse, arenaPodium, arenaRamTargets, arenaRanks, arenaReleaseTarget, arenaRoamingTarget, arenaRounds, arenaShoveTargets, arenaSpinTargets, arenaStartingPoint, arenaThrow, type ArenaPoint, type ArenaPodiumPlace, type ArenaRoamingStage, type ArenaRound } from './arenaLogic';
import { arenaDrawOrder, createArenaFighterAnimation, drawArenaFighter, drawArenaName, type ArenaActor, type ArenaFighterAnimation, type ArenaPose } from './game/ArenaFighter';
import { drawArenaScenery } from './game/arenaArt';
import ArenaStory from './ArenaStory';
import { arenaTechniqueTargets, arenaTechniqueExit, isArenaFinalTechnique } from './arenaTechniques';
import { createArenaCamera, sampleArenaCamera, type ArenaCamera } from './arenaCamera';
import './arena.css';

type Body = ArenaPoint & { gait: number; facing: number; vx: number; vy: number; motorX?: number; motorY?: number; restUntil?: number; animation?: ArenaFighterAnimation; roam?: { key: string; origin: ArenaPoint; target: ArenaPoint; neighborId?: string } };
type Contact = { center: ArenaPoint; side: number; round: ArenaRound; releases?: Map<string, ArenaPoint> };
type Exit = { round: ArenaRound; origin: ArenaPoint; landing: ArenaPoint; side: number; bench: ArenaPoint; lift: number; angle: number; velocity: number; dragOffset?: ArenaPoint };
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
  const signature = `${props.preview}:${props.duration}:${props.order.join(',')}:${props.candidates.map(candidate => candidate.id).join(',')}`;
  const seek = elapsed < sim.elapsed - 150 || elapsed - sim.elapsed > 500;
  const reset = sim.key !== signature || seek;
  if (reset) { sim.key = signature; sim.epoch++; sim.bodies.clear(); sim.contacts.clear(); sim.exits.clear(); sim.minis.clear(); }
  sim.elapsed = elapsed;
  const unit = props.duration / 44_000;
  const rounds = arenaRounds(order, props.duration);
  const ranks = props.preview ? {} : arenaRanks(order, elapsed, props.duration);
  const won = !props.preview && !!rounds.length && elapsed >= rounds.at(-1)!.resolve;
  const podiumPlaces = arenaPodium(order, props.duration), podiumById = new Map(podiumPlaces.map(place => [place.id, place]));
  const upcomingPlan = props.preview || won ? undefined : rounds.find(round => round.start > elapsed && round.start - elapsed < 2400 * unit);
  const focusPlan = props.preview || won ? undefined : arenaFocusRound(order, elapsed, props.duration);
  const upcoming = upcomingPlan ? sim.contacts.get(upcomingPlan.id)?.round ?? upcomingPlan : undefined;
  const exchange = focusPlan ? sim.contacts.get(focusPlan.id)?.round ?? focusPlan : undefined;
  const engaged = new Set(exchange ? [exchange.aggressor, exchange.victim, exchange.helper] : []);
  const preparing = new Set(upcoming ? [upcoming.aggressor, upcoming.victim, upcoming.helper].filter(id => !!id && !engaged.has(id)) : []);
  const living = order.filter(id => !ranks[id]);
  const active = won ? order.filter(id => id === order[0]) : living;
  const before = new Map([...sim.bodies].map(([id, body]) => [id, { x: body.x, y: body.y }]));
  const actors = new Map<string, ChoreographedActor>();
  const effects: (() => void)[] = [];
  const seconds = props.paused || reduced ? 0 : delta / 1000;
  if (!order.length) { drawArenaScenery(ctx, clock, { intensity: .35, reduced }); text(ctx, '참가자를 입력하면 모래판에 모입니다', 500, 392, 28, '#73593e'); return; }
  const makeExit = (round: ArenaRound, origin: ArenaPoint, lift = 0, angle = 0, velocity = 0, direction?: number): Exit => {
    const outIndex = order.length - order.indexOf(round.victim) - 1;
    const side = direction ?? arenaExitDirection(round, origin, outIndex);
    const seat = [...sim.exits.values()].filter(exit => exit.side === side).length;
    const bench = { x: side < 0 ? 38 + seat % 3 * 52 : 962 - seat % 3 * 52, y: 378 + Math.floor(seat / 3) * 161 };
    return { round, origin, landing: { x: side < 0 ? 115 : 885, y: round.tactic === 'bait' || round.tactic === 'edge' || round.tactic === 'shove' ? Math.max(436, origin.y + 40) : 436 }, side, bench, lift, angle, velocity };
  };
  // A direct skip or paused fixture seek creates every eliminated actor as well.
  if (!props.preview) rounds.filter(round => elapsed >= round.resolve).forEach(round => {
    if (sim.exits.has(round.victim)) return;
    const center = arenaLocalContact({ x: 500, y: 425 }, []), actual = arenaContactRound(round, center);
    const exit = makeExit(actual, actual.tactic === 'bait' ? arenaChargeTargets(actual, actual.impact, center).charger : actual.tactic === 'edge' ? arenaEdgeTargets(actual, actual.impact, center).victim : actual.tactic === 'shove' ? arenaShoveTargets(actual, actual.impact, center).victim : { x: 500, y: 425 });
    sim.exits.set(round.victim, exit);
    const settled = elapsed - round.impact >= 2100 * unit;
    const position = settled ? exit.bench : exit.landing;
    sim.bodies.set(round.victim, { ...position, gait: 0, facing: exit.side > 0 ? -1 : 1, vx: 0, vy: 0 });
  });
  // Starting positions only initialize a new body. Live navigation uses current contacts.
  active.forEach(id => {
    if (sim.exits.has(id)) return;
    if (!sim.bodies.has(id)) {
      const start = arenaStartingPoint(props.candidates.findIndex(candidate => candidate.id === id), props.candidates.length);
      sim.bodies.set(id, { ...start, gait: 0, facing: start.x < 500 ? 1 : -1, vx: 0, vy: 0 });
    }
    if (engaged.has(id) || preparing.has(id) || won) sim.bodies.get(id)!.roam = undefined;
  });
  const ambient = won ? [] : active.filter(id => !engaged.has(id) && !preparing.has(id) && !sim.exits.has(id));
  for (const [id, round] of sim.minis) if (props.preview || won || elapsed >= round.end || !ambient.includes(round.aggressor) || !ambient.includes(round.victim)) {
    if (elapsed >= round.end) [round.aggressor, round.victim].forEach(person => { const body = sim.bodies.get(person); if (body) body.restUntil = elapsed + 750 * unit; });
    sim.minis.delete(id); sim.contacts.delete(id);
  }
  const miniParticipants = new Set([...sim.minis.values()].flatMap(round => [round.aggressor, round.victim]));
  if (!props.preview && !won) for (const round of arenaMiniExchanges(ambient.filter(id => !miniParticipants.has(id) && elapsed >= (sim.bodies.get(id)!.restUntil ?? 0)).map(id => ({ id, x: sim.bodies.get(id)!.x, y: sim.bodies.get(id)!.y })), elapsed, props.duration)) {
    sim.minis.set(round.id, round); miniParticipants.add(round.aggressor); miniParticipants.add(round.victim);
  }
  active.forEach(id => {
    if (sim.exits.has(id)) return;
    const index = props.candidates.findIndex(candidate => candidate.id === id), body = sim.bodies.get(id)!;
    const cycle = (elapsed / unit + index * 673) % 5600;
    const roaming = ambient.includes(id) && !miniParticipants.has(id), available = roaming ? ambient.filter(other => other !== id && !miniParticipants.has(other)) : [];
    if (miniParticipants.has(id)) body.roam = undefined;
    const neighborId = body.roam?.neighborId && available.includes(body.roam.neighborId) ? body.roam.neighborId : available.sort((left, right) => {
      const a = sim.bodies.get(left)!, b = sim.bodies.get(right)!;
      return Math.hypot(a.x - body.x, a.y - body.y) - Math.hypot(b.x - body.x, b.y - body.y);
    })[0];
    const neighbor = neighborId ? sim.bodies.get(neighborId) : undefined;
    const aware = roaming && !neighbor && !props.preview ? arenaNearbyResponse(body, active.filter(other => other !== id && (engaged.has(other) || miniParticipants.has(other))).map(other => sim.bodies.get(other)!), index) : undefined;
    const stage: ArenaRoamingStage = props.preview ? 'watch' : cycle < 1600 ? 'approach' : cycle < 3150 ? 'contact' : 'sidestep';
    const key = `${Math.floor((elapsed / unit + index * 673) / 5600)}:${stage}:${neighborId ?? ''}`;
    if (roaming && (!body.roam || body.roam.key !== key)) body.roam = { key, origin: { x: body.x, y: body.y }, neighborId, target: arenaRoamingTarget(body, neighbor, index, stage) };
    // Approach follows the opponent; a sidestep keeps its release anchor and cannot accumulate drift.
    if (roaming && stage === 'approach') body.roam!.target = arenaRoamingTarget(body, neighbor, index, stage);
    if (roaming && !props.preview && (stage === 'contact' || !neighbor)) body.roam!.target = neighbor && Math.hypot(neighbor.x - body.x, neighbor.y - body.y) > 86 ? arenaRoamingTarget(body, neighbor, index, 'approach') : arenaGuardTarget(body.roam!.origin, index, elapsed);
    const target = aware?.target ?? (roaming ? body.roam!.target : body);
    const distance = Math.hypot(target.x - body.x, target.y - body.y);
    if (roaming) move(body, target, seconds, elapsed < (body.restUntil ?? 0) ? 62 : 96);
    const touching = !!neighbor && Math.hypot(neighbor.x - body.x, neighbor.y - body.y) < 83;
    if (touching) body.facing = neighbor.x > body.x ? 1 : -1;
    if (aware) body.facing = aware.facing;
    const pose: ArenaPose = props.preview ? 'guard' : aware ? aware.pose : distance > 12 ? 'walk' : !touching || cycle < 1400 ? 'guard' : cycle < 2650 ? index % 2 ? 'brace' : 'grapple' : cycle < 3650 ? index % 2 ? 'brace' : 'push' : cycle < 4700 ? 'dodge' : 'guard';
    const candidateIndex = props.candidates.findIndex(candidate => candidate.id === id);
    actors.set(id, { candidate: props.candidates[candidateIndex], index: candidateIndex, x: body.x, y: body.y, scale: 2.04, facing: body.facing, pose, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: cycle / 5600, power: .7, gripTarget: touching && neighbor && ['grapple', 'push', 'brace'].includes(pose) ? { x: neighbor.x - body.facing * 17, y: neighbor.y - 62 } : undefined });
    if (!reduced && !props.preview && touching && cycle > 2700 && cycle < 3150) effects.push(() => dust(ctx, body.x + body.facing * 24, body.y, cycle - 2700, .3));
  });
  const liveContactIds = new Set([...sim.minis.keys(), ...(exchange ? [exchange.id] : []), ...(upcoming ? [upcoming.id] : [])]);
  const contactPoint = (round: ArenaRound, origin: ArenaPoint): Contact => {
    const center = arenaLocalContact(origin, [...sim.contacts].filter(([otherId]) => otherId !== round.id && liveContactIds.has(otherId)).map(([, contact]) => contact.center));
    return { center, side: round.index % 2 ? 1 : -1, round: arenaContactRound(round, center) };
  };
  // Future participants approach while the preceding throw is still resolving.
  if (upcoming) {
    const a = sim.bodies.get(upcoming.aggressor), v = sim.bodies.get(upcoming.victim);
    if (a && v && !sim.contacts.has(upcoming.id)) sim.contacts.set(upcoming.id, contactPoint(upcoming, { x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 }));
    const contact = sim.contacts.get(upcoming.id);
    if (contact) {
      const upcoming = contact.round;
      [upcoming.aggressor, upcoming.victim, upcoming.helper].forEach((id, role) => {
        if (!id || !preparing.has(id)) return;
        const body = sim.bodies.get(id), actor = actors.get(id);
        if (!body || !actor) return;
        const plan = arenaAction(upcoming, upcoming.start).actors[role];
        const charge = upcoming.tactic === 'bait' ? arenaChargeTargets(upcoming, upcoming.start, contact.center) : undefined;
        const edge = upcoming.tactic === 'edge' ? arenaEdgeTargets(upcoming, upcoming.start, contact.center) : undefined;
        const caught = upcoming.tactic === 'catch' ? arenaCatchTargets(upcoming, upcoming.start, contact.center) : undefined;
        const spin = upcoming.tactic === 'spin' ? arenaSpinTargets(upcoming, upcoming.start, contact.center) : undefined;
        const ram = upcoming.tactic === 'ram' ? arenaRamTargets(upcoming, upcoming.start, contact.center) : undefined;
        const technique = isArenaFinalTechnique(upcoming) ? arenaTechniqueTargets(upcoming, upcoming.start, contact.center) : undefined;
        const shove = upcoming.tactic === 'shove' ? arenaShoveTargets(upcoming, upcoming.start, contact.center) : undefined;
        const target = arenaGuardTarget(technique ? id === upcoming.victim ? technique.victim : technique.aggressor : charge ? id === upcoming.victim ? charge.charger : charge.target : caught ? id === upcoming.victim ? caught.charger : caught.receiver : spin ? id === upcoming.victim ? spin.attacker : spin.defender : ram ? id === upcoming.victim ? ram.victim : ram.driver : shove ? id === upcoming.victim ? shove.victim : id === upcoming.helper ? shove.helper : shove.aggressor : edge ? id === upcoming.victim ? edge.victim : edge.aggressor : { x: contact.center.x + (plan?.offset.x ?? 0), y: contact.center.y + (plan?.offset.y ?? 0) }, actor.index, elapsed);
        const approachDistance = Math.hypot(target.x - body.x, target.y - body.y);
        if (Math.abs(target.x - body.x) > 8 && Math.hypot(body.motorX ?? 0, body.motorY ?? 0) < 18) body.facing = target.x < body.x ? -1 : 1;
        move(body, target, seconds, arenaApproachSpeed(approachDistance));
        actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
        actor.pose = Math.hypot(target.x - body.x, target.y - body.y) > 8 ? 'walk' : 'guard';
        actor.gripTarget = undefined;
      });
    }
  }
  const encounters = [...(exchange ? [exchange] : []), ...sim.minis.values()];
  for (let exchange of encounters) {
    const a = sim.bodies.get(exchange.aggressor), v = sim.bodies.get(exchange.victim);
    const mini = exchange.id.startsWith('mini-');
    if (a && v && !sim.contacts.has(exchange.id)) sim.contacts.set(exchange.id, contactPoint(exchange, { x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 }));
    const contact = sim.contacts.get(exchange.id);
    if (contact) {
      exchange = contact.round;
      const center = contact.center, action = arenaAction(exchange, elapsed);
      const charge = exchange.tactic === 'bait' ? arenaChargeTargets(exchange, elapsed, center) : undefined;
      const edge = exchange.tactic === 'edge' ? arenaEdgeTargets(exchange, elapsed, center) : undefined;
      const caught = exchange.tactic === 'catch' ? arenaCatchTargets(exchange, elapsed, center) : undefined;
      const spin = exchange.tactic === 'spin' ? arenaSpinTargets(exchange, elapsed, center) : undefined;
      const ram = exchange.tactic === 'ram' ? arenaRamTargets(exchange, elapsed, center) : undefined;
      const technique = isArenaFinalTechnique(exchange) ? arenaTechniqueTargets(exchange, elapsed, center) : undefined;
      const shove = exchange.tactic === 'shove' ? arenaShoveTargets(exchange, elapsed, center) : undefined;
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
        if (action.stage === 'approach') target = arenaGuardTarget(target, actor.index, elapsed);
        if (action.stage === 'release') {
          const origin = contact.releases!.get(part.id) ?? body;
          target = arenaReleaseTarget(origin, center, part.role, (elapsed - exchange.impact) / Math.max(1, exchange.end - exchange.impact));
        }
        // Snapshot seeks can reconstruct the current contact. Live actors have
        // the same bounded acceleration and speed as everyone elsewhere.
        if (reset && elapsed > 300 * unit) { body.x = target.x; body.y = target.y; body.motorX = 0; body.motorY = 0; }
        else if (!(technique && exchange.tactic === 'suplex' && elapsed >= exchange.impact && part.id === exchange.aggressor)) move(body, target, seconds, part.pose === 'run' || spin && spin.turn > 0 ? 165 : action.stage === 'approach' ? arenaApproachSpeed(Math.hypot(target.x - body.x, target.y - body.y)) : 118);
        const opponent = part.gripId ? sim.bodies.get(part.gripId) : undefined;
        const remaining = Math.hypot(target.x - body.x, target.y - body.y);
        const contactDistance = opponent ? Math.hypot(opponent.x - body.x, opponent.y - body.y) : 0;
        if (opponent && remaining < 18 && !spin) body.facing = opponent.x > body.x ? 1 : -1;
        if (spin && remaining < 18) body.facing = part.id === exchange.victim ? -spin.side : spin.side;
        if (ram && (remaining < 18 || ram.stage !== 'prepare')) body.facing = part.id === exchange.victim ? -ram.side : ram.side;
        if (technique && remaining < 18) body.facing = part.id === exchange.victim ? -technique.side : technique.side;
        if (technique && exchange.tactic === 'armspin' && part.id === exchange.victim) body.facing = a!.x > body.x ? 1 : -1;
        if (charge && (remaining < 18 || charge.stage !== 'prepare')) body.facing = part.id === exchange.victim ? charge.side : -charge.side;
        if (caught && (remaining < 18 || caught.stage !== 'prepare')) body.facing = part.id === exchange.victim ? caught.side : -caught.side;
        if (shove && remaining < 18) body.facing = part.id === exchange.victim ? -shove.side : shove.side;
        actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
        const throwing = action.attackers.includes(part.id) && action.liftedId !== part.id && (part.pose === 'lift' || part.pose === 'throw');
        actor.yaw = reduced ? 0 : part.turn ?? (throwing ? .72 * Math.sin(clamp(part.phase) * Math.PI) : 0);
        actor.pivotTurn = !reduced && spin && part.id === exchange.aggressor && spin.turn > 0 ? spin.angle : undefined;
        const establishedGrip = opponent && contactDistance < 86 && action.stage !== 'approach';
        actor.pose = part.pose === 'run' ? 'run' : part.pose === 'dodge' && (charge || shove) ? 'dodge' : establishedGrip ? part.pose : remaining > 9 || opponent && contactDistance > 84 ? 'walk' : part.pose;
        actor.phase = part.pose === 'throw' ? clamp((elapsed - exchange.impact) / (350 * unit)) : part.phase; actor.power = action.stage === 'joint-attack' || action.stage === 'counter' || action.stage === 'lift' ? .85 : .55;
        actor.chargePreparation = ram && part.id === exchange.aggressor ? ram.preparation : part.id === exchange.victim ? charge?.preparation ?? (caught?.stage === 'prepare' ? caught.preparation : 0) : 0;
        actor.chargeStrength = ram && part.id === exchange.aggressor && (ram.stage === 'charge' || ram.stage === 'contact') ? 1 : part.id === exchange.victim && (charge && charge.stage !== 'prepare' || caught?.stage === 'charge') ? 1 : 0;
        actor.gripTarget = undefined; actor.secondaryGripTarget = undefined;
        if (technique) {
          actor.angle = part.id === exchange.victim ? technique.victimAngle : technique.aggressorAngle;
          if (part.id === exchange.aggressor) {
            actor.depthY = body.y; actor.y -= technique.aggressorLift;
            actor.pivotTurn = exchange.tactic === 'armspin' && technique.stage === 'pivot' ? technique.yaw : undefined;
            if (exchange.tactic === 'trip' && technique.stage === 'hook') { const feet = sim.bodies.get(exchange.victim)?.animation?.contactPoints?.feet; actor.footTarget = feet ? [...feet].sort((left, right) => Math.abs(left.x - actor.x) - Math.abs(right.x - actor.x))[0] : { x: v!.x - technique.side * 8, y: v!.y - 2 }; actor.footStrength = technique.contact; actor.kickLeg = 1; }
            if (exchange.tactic === 'sidekick') { actor.footTarget = technique.stage === 'first-kick' ? { x: actor.x + technique.side * 34, y: actor.y - 22 } : sim.bodies.get(exchange.victim)?.animation?.contactPoints?.waist ?? { x: v!.x, y: v!.y - 45 }; actor.footStrength = technique.stage === 'first-kick' ? Math.sin(clamp((technique.phase - .38) / .22) * Math.PI) * .55 : technique.contact; actor.kickLeg = technique.stage === 'first-kick' ? 0 : 1; }
          }
        }
      });
      const lifted = action.liftedId ? actors.get(action.liftedId) : undefined;
      const targetBody = action.liftedId ? sim.bodies.get(action.liftedId) : undefined;
      const connections = targetBody ? action.attackers.every(id => {
        const body = sim.bodies.get(id);
        return body && Math.hypot(body.x - targetBody.x, body.y - targetBody.y) < (ram ? 50 : 86);
      }) : false;
      const heldLift = lifted && connections ? action.lift : 0;
      if (lifted && action.liftedId && !sim.exits.has(action.liftedId)) {
        lifted.y -= heldLift;
        lifted.angle = reduced ? 0 : technique ? technique.victimAngle : ram ? ram.side * .36 * ram.impact : -.22 * clamp(heldLift / 52);
        if (heldLift > 5) lifted.pose = technique && exchange.tactic === 'armspin' ? 'held' : 'airborne';
      }
      action.actors.forEach(part => {
        const actor = actors.get(part.id), other = part.gripId ? actors.get(part.gripId) : undefined;
        if (!actor || !other || actor.pose === 'walk' || actor.pose === 'run' || Math.hypot(other.x - actor.x, other.y - actor.y) > 100) return;
        const nearSide = other.x > actor.x ? -1 : 1;
        actor.gripStrength = ease((88 - Math.hypot(other.x - actor.x, other.y - actor.y)) / 26);
        actor.gripTarget = { x: other.x + nearSide * 17, y: other.y - 44 };
        actor.secondaryGripTarget = { x: other.x + nearSide * 20, y: other.y - 52 };
        if (technique && part.id === exchange.aggressor) {
          const contacts = sim.bodies.get(exchange.victim)?.animation?.contactPoints;
          actor.gripTarget = technique.grip === 'wrist' ? contacts?.hands[1] ?? { x: other.x - technique.side * 24, y: other.y - 62 } : contacts?.waist ?? { x: other.x, y: other.y - 44 };
          actor.secondaryGripTarget = { x: actor.gripTarget.x - technique.side * 6, y: actor.gripTarget.y + 3 };
        }
        if (technique?.grip === 'wrist') {
          const driver = actors.get(exchange.aggressor)!, victim = actors.get(exchange.victim)!;
          actor.gripTarget = { x: (driver.x + victim.x) / 2, y: (driver.y + victim.y) / 2 - 56 };
          actor.secondaryGripTarget = { x: actor.gripTarget.x - actor.facing * 3, y: actor.gripTarget.y + 2 }; actor.gripStrength = 1;
        }
      });
      if (!exchange.exchange && elapsed >= exchange.impact && !sim.exits.has(exchange.victim)) {
        const body = sim.bodies.get(exchange.victim), victim = actors.get(exchange.victim);
        if (body) sim.exits.set(exchange.victim, makeExit(exchange, { x: body.x, y: body.y }, action.liftedId === exchange.victim ? heldLift : 0, victim?.angle ?? 0, body.motorX ?? 0, technique?.side));
      }
      if (!mini) effects.push(() => relationship(ctx, exchange, elapsed, actors, false, sim.bodies));
      else if (!reduced && action.stage === 'lift' && connections) effects.push(() => dust(ctx, center.x, center.y, (elapsed - exchange.start) / unit - 1950, .25));
      if (!reduced && charge && charge.stage !== 'prepare') {
        const launch = arenaChargeTargets(exchange, charge.chargeStartsAt, center).charger;
        effects.push(() => dust(ctx, launch.x - charge.side * 24, launch.y, elapsed - charge.chargeStartsAt, .55));
      }
    }
  }
  for (const [id, exit] of sim.exits) {
    const body = sim.bodies.get(id)!;
    const age = elapsed - exit.round.impact;
    const flight = arenaTechniqueExit(exit.round, age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle }) ?? (exit.round.tactic === 'bait' ? arenaChargeFall(age, exit.origin, exit.landing, exit.side, unit, exit.velocity) : exit.round.tactic === 'edge' || exit.round.tactic === 'shove' ? arenaEdgeFall(age, exit.origin, exit.landing, exit.side, unit) : arenaThrow(age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle, rotation: exit.round.tactic === 'ram' || exit.round.tactic === 'sidekick' ? exit.side : undefined }));
    const index = props.candidates.findIndex(candidate => candidate.id === id);
    let pose: ArenaPose = flight.stage === 'overrun' ? exit.round.tactic === 'edge' || exit.round.tactic === 'shove' ? 'brace' : 'run' : flight.stage === 'fall' || flight.stage === 'flight' || flight.stage === 'roll' || flight.stage === 'hold' && exit.lift > 3 ? 'airborne' : flight.stage === 'land' ? 'land' : flight.stage === 'recover' ? 'recover' : flight.stage === 'hold' ? 'brace' : 'walk';
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
    const actor: ArenaActor = { candidate: props.candidates[index], index, x: body.x, y: body.y, depthY: flight.stage === 'walk' ? body.y : flight.groundY, scale: 2.04, facing: body.facing, pose, angle: reduced ? 0 : flight.stage === 'walk' ? 0 : flight.angle, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: flight.phase, chargePreparation: exit.round.tactic === 'bait' && flight.stage === 'overrun' ? 1 : 0, chargeStrength: exit.round.tactic === 'bait' && flight.stage === 'overrun' ? 1 : 0 };
    actors.set(id, actor);
    if (exit.round.tactic === 'suplex' && (flight.stage === 'drag' || flight.stage === 'stunned')) {
      const driverBody = sim.bodies.get(exit.round.aggressor), driver = actors.get(exit.round.aggressor);
      if (driverBody && driver) {
        const contacts = body.animation?.contactPoints;
        const ankle = contacts ? { x: contacts.feet[1].x - contacts.origin.x, y: contacts.feet[1].y - contacts.origin.y } : { x: exit.side * 47.6, y: -14 };
        exit.dragOffset = { x: ankle.x + exit.side * 32, y: ankle.y + 8 };
        const target = { x: flight.groundX + exit.dragOffset.x, y: flight.groundY + exit.dragOffset.y };
        if (reset || reduced) { driverBody.x = target.x; driverBody.y = target.y; driverBody.motorX = 0; driverBody.motorY = 0; }
        else move(driverBody, target, seconds, 165);
        if (flight.stage === 'drag') { body.x = driverBody.x - exit.dragOffset.x; body.y = driverBody.y - exit.dragOffset.y; }
        actor.x = body.x; actor.y = body.y; actor.depthY = body.y;
        driverBody.facing = -exit.side; driver.x = driverBody.x; driver.y = driverBody.y; driver.facing = driverBody.facing; driver.pose = 'drag'; driver.yaw = 0;
        driver.gripTarget = { x: body.x + ankle.x, y: body.y + ankle.y };
        driver.secondaryGripTarget = { x: driver.gripTarget.x + exit.side * 5, y: driver.gripTarget.y + 2 }; driver.gripStrength = 1;
      }
    }
    if (flight.stage === 'flight') effects.push(() => { ctx.fillStyle = '#27332e40'; ctx.beginPath(); ctx.ellipse(flight.groundX, flight.groundY + 4, 32, 7, 0, 0, Math.PI * 2); ctx.fill(); });
    if (!reduced) effects.push(() => dust(ctx, exit.landing.x, exit.landing.y, age / unit - 880, 1.5));
  }
  if (won) {
    const winnerId = order[0], winner = sim.bodies.get(winnerId)!;
    const winnerPlace = podiumById.get(winnerId)!;
    if (reset || reduced) { winner.x = winnerPlace.x; winner.y = winnerPlace.y; winner.motorX = 0; winner.motorY = 0; }
    else move(winner, winnerPlace, seconds, 126);
    const actor = actors.get(winnerId)!;
    actor.x = winner.x; actor.y = winner.y; actor.facing = winner.facing; actor.pose = Math.hypot(winner.x - winnerPlace.x, winner.y - winnerPlace.y) > 8 ? 'walk' : 'cheer';
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
    const ground = !['airborne', 'held', 'roll', 'land', 'recover', 'sidekick', 'stunned'].includes(actor.pose);
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
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
  drawArenaScenery(ctx, clock, { intensity: exchange?.tactic === 'team' || exchange?.tactic === 'betrayal' ? .8 : .35, reduced });
  effects.forEach(draw => draw());
  // Every name is fixed below its owner and sits behind every fighter.
  for (const actor of actors.values()) drawArenaName(ctx, actor);
  arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));
  const visibleRound = won ? sim.contacts.get(rounds.at(-1)!.id)?.round ?? rounds.at(-1) : exchange ? sim.contacts.get(exchange.id)?.round ?? exchange : undefined;
  if (visibleRound && !won) relationship(ctx, visibleRound, elapsed, actors, true);
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
      const frameKey = frameRound ? [frameRound.id, frameRound.tactic, frameRound.aggressor, frameRound.victim, frameRound.helper, frameRound.impact].join(':') : '';
      if (frameKey !== narrationKey) { narrationKey = frameKey; setVisibleRound(frameRound); }
      request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, []);
  const order = useMemo(() => validOrder(props.candidates, props.order), [props.candidates, props.order]);
  const rounds = useMemo(() => arenaRounds(order, props.duration), [order, props.duration]);
  const ranks = props.preview ? {} : arenaRanks(order, props.elapsed, props.duration);
  const finished = !props.preview && !!rounds.length && props.elapsed >= rounds.at(-1)!.resolve;
  const plannedRound = finished ? rounds.at(-1) : arenaFocusRound(order, props.elapsed, props.duration);
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
