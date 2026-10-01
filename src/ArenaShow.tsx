import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Candidate } from './election';
import type { SportsStageProps } from './sports';
import { arenaBeat, arenaExchange, arenaNarration, arenaRanks, arenaRounds, arenaStartingPoint, arenaThrow, type ArenaPoint, type ArenaRound } from './arenaLogic';
import { createArenaFighterAnimation, drawArenaFighter, type ArenaActor, type ArenaFighterAnimation, type ArenaPose } from './game/ArenaFighter';
import { drawArenaScenery } from './game/arenaArt';
import ArenaStory from './ArenaStory';
import './arena.css';

type Body = ArenaPoint & { gait: number; facing: number; vx: number; vy: number; motorX?: number; motorY?: number; animation?: ArenaFighterAnimation };
type Contact = { center: ArenaPoint; side: number };
type Exit = { round: ArenaRound; origin: ArenaPoint; landing: ArenaPoint; side: number; bench: ArenaPoint; lift: number; angle: number };
type Simulation = { key: string; elapsed: number; epoch: number; bodies: Map<string, Body>; contacts: Map<string, Contact>; exits: Map<string, Exit> };
type ChoreographedActor = ArenaActor;
const W = 1000, H = 620;
const clamp = (p: number, low = 0, high = 1) => Math.max(low, Math.min(high, p));
const ease = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };

function validOrder(candidates: Candidate[], supplied: string[]) {
  const ids = new Set(candidates.map(candidate => candidate.id));
  const order = [...new Set(supplied)].filter(id => ids.has(id));
  return [...order, ...candidates.map(candidate => candidate.id).filter(id => !order.includes(id))];
}

function move(body: Body, target: ArenaPoint, seconds: number, speed = 116) {
  if (seconds <= 0) return;
  const dx = target.x - body.x, dy = target.y - body.y;
  const distance = Math.hypot(dx, dy);
  const acceleration = speed * 5.8, brake = speed * 7;
  const wantedSpeed = Math.min(speed, Math.sqrt(2 * brake * Math.max(0, distance - .6)));
  const wantedX = distance > .01 ? dx / distance * wantedSpeed : 0, wantedY = distance > .01 ? dy / distance * wantedSpeed : 0;
  const changeX = wantedX - (body.motorX ?? 0), changeY = wantedY - (body.motorY ?? 0);
  const change = Math.hypot(changeX, changeY), limit = Math.min(1, acceleration * seconds / Math.max(.001, change));
  body.motorX = (body.motorX ?? 0) + changeX * limit; body.motorY = (body.motorY ?? 0) + changeY * limit;
  const travelX = body.motorX * seconds, travelY = body.motorY * seconds;
  if (distance < Math.hypot(travelX, travelY) && dx * travelX + dy * travelY > 0) { body.x = target.x; body.y = target.y; body.motorX = 0; body.motorY = 0; }
  else { body.x += travelX; body.y += travelY; }
  if (Math.abs(body.motorX) > 25) body.facing = body.motorX < 0 ? -1 : 1;
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

function relationship(ctx: CanvasRenderingContext2D, round: ArenaRound, elapsed: number, actors: Map<string, ChoreographedActor>, labels = false, bodies?: Map<string, Body>) {
  if (round.tactic !== 'team' && round.tactic !== 'betrayal' || elapsed >= round.resolve || elapsed - round.impact > 420) return;
  const beat = arenaBeat(round, elapsed), a = actors.get(round.aggressor), v = actors.get(round.victim), h = round.helper ? actors.get(round.helper) : undefined;
  if (!a || !v || !h) return;
  const broken = round.tactic === 'betrayal' && beat.progress >= .52;
  const tone = broken ? '#fa8c7a' : '#84ded1';
  ctx.save();
  if (!labels) {
    const ground = (actor: ChoreographedActor) => bodies?.get(actor.candidate.id) ?? actor;
    for (const actor of [a, v, h]) {
      const point = ground(actor);
      ctx.strokeStyle = actor === v ? '#fff0b2' : tone; ctx.lineWidth = 2; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.ellipse(point.x, point.y + 3, 31, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const links = round.tactic === 'team' ? [a, h] : [h];
    for (const actor of links) {
      const from = ground(actor), to = ground(v);
      ctx.globalAlpha = .9; ctx.strokeStyle = tone; ctx.lineWidth = 3;
      const dx = to.x - from.x, length = Math.hypot(dx, to.y - from.y);
      if (length > 120) continue;
      if (broken) ctx.setLineDash([7, 10]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y + 6); ctx.lineTo(to.x, to.y + 6); ctx.stroke();
      ctx.setLineDash([]);
      const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2 + 6;
      if (broken) { ctx.beginPath(); ctx.moveTo(midX - 6, midY - 7); ctx.lineTo(midX + 6, midY + 7); ctx.moveTo(midX + 6, midY - 7); ctx.lineTo(midX - 6, midY + 7); ctx.stroke(); }
      else if (round.tactic === 'team') { ctx.beginPath(); ctx.moveTo(midX - Math.sign(dx) * 6, midY - 5); ctx.lineTo(midX, midY); ctx.lineTo(midX - Math.sign(dx) * 6, midY + 5); ctx.stroke(); }
    }
  } else {
    const badges = round.tactic === 'team' ? beat.stage === 'approach' ? ['왼쪽 접근', '위험 감지', '오른쪽 접근'] : ['함께 잡기', '양쪽에서 잡힘', '함께 잡기'] : [beat.progress < .52 ? '빈틈 기다림' : '틈으로 공격', broken ? '지지 잃음' : beat.stage === 'approach' ? '손 내밈' : '동맹', broken ? '손 놓음' : beat.stage === 'approach' ? '다가감' : '동맹'];
    [a, v, h].forEach((actor, index) => {
      const x = actor.x, y = actor.y - 143 - (index === 1 ? 32 : 0), value = `${actor.index + 1} · ${badges[index]}`;
      ctx.font = '800 13px "Malgun Gothic", sans-serif';
      const width = Math.max(69, ctx.measureText(value).width + 14);
      ctx.globalAlpha = .94; ctx.fillStyle = '#172b32'; ctx.fillRect(x - width / 2, y, width, 23);
      ctx.strokeStyle = index === 1 ? '#fff0b2' : tone; ctx.lineWidth = 1; ctx.strokeRect(x - width / 2, y, width, 23);
      text(ctx, value, x, y + 4, 13, index === 1 ? '#fff0b2' : tone, width - 10);
    });
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, props: SportsStageProps, elapsed: number, clock: number, sim: Simulation, delta: number, reduced: boolean) {
  const order = validOrder(props.candidates, props.order);
  const signature = `${props.preview}:${props.order.join(',')}:${props.candidates.map(candidate => candidate.id).join(',')}`;
  const seek = elapsed < sim.elapsed - 150 || elapsed - sim.elapsed > 500;
  const reset = sim.key !== signature || seek;
  if (reset) { sim.key = signature; sim.epoch++; sim.bodies.clear(); sim.contacts.clear(); sim.exits.clear(); }
  sim.elapsed = elapsed;
  const unit = props.duration / 44_000;
  const rounds = arenaRounds(order, props.duration);
  const ranks = props.preview ? {} : arenaRanks(order, elapsed, props.duration);
  const current = props.preview ? undefined : rounds.find(round => elapsed >= round.start && elapsed < round.end);
  const won = !props.preview && !!rounds.length && elapsed >= rounds.at(-1)!.resolve;
  const exchange = props.preview || won ? undefined : current ?? arenaExchange(order, elapsed, props.duration);
  const engaged = new Set(exchange ? [exchange.aggressor, exchange.victim, exchange.helper] : []);
  const upcoming = props.preview || won ? undefined : rounds.find(round => round.start > elapsed && round.start - elapsed < 900 * unit);
  const preparing = new Set(upcoming ? [upcoming.aggressor, upcoming.victim, upcoming.helper].filter(id => !!id && !engaged.has(id)) : []);
  const living = order.filter(id => !ranks[id]);
  const active = won ? order.filter(id => id === order[0]) : living;
  const before = new Map([...sim.bodies].map(([id, body]) => [id, { x: body.x, y: body.y }]));
  const actors = new Map<string, ChoreographedActor>();
  const seconds = props.paused || reduced ? 0 : delta / 1000;
  drawArenaScenery(ctx, clock, { intensity: exchange?.tactic === 'team' || exchange?.tactic === 'betrayal' ? .8 : .35, reduced });
  if (!order.length) { text(ctx, '참가자를 입력하면 모래판에 모입니다', 500, 392, 28, '#73593e'); return; }
  const makeExit = (round: ArenaRound, origin: ArenaPoint, lift = 0, angle = 0): Exit => {
    const outIndex = order.length - order.indexOf(round.victim) - 1;
    const side = round.final ? 1 : round.tactic === 'bait' ? -1 : outIndex % 2 ? 1 : -1;
    const seat = [...sim.exits.values()].filter(exit => exit.side === side).length;
    const bench = { x: side < 0 ? 38 + seat % 3 * 52 : 962 - seat % 3 * 52, y: 378 + Math.floor(seat / 3) * 161 };
    return { round, origin, landing: { x: side < 0 ? 115 : 885, y: 436 }, side, bench, lift, angle };
  };
  // A direct skip or paused fixture seek creates every eliminated actor as well.
  if (!props.preview) rounds.filter(round => elapsed >= round.resolve).forEach(round => {
    if (sim.exits.has(round.victim)) return;
    const exit = makeExit(round, { x: 500, y: 425 });
    sim.exits.set(round.victim, exit);
    const settled = elapsed - round.impact >= 2100 * unit;
    const position = settled ? exit.bench : exit.landing;
    sim.bodies.set(round.victim, { ...position, gait: 0, facing: exit.side > 0 ? -1 : 1, vx: 0, vy: 0 });
  });
  const homes = new Map(props.candidates.map((candidate, index) => [candidate.id, arenaStartingPoint(index, props.candidates.length)]));
  const ambient = active.filter(id => !engaged.has(id) && !preparing.has(id));
  active.forEach(id => {
    if (sim.exits.has(id)) return;
    const index = props.candidates.findIndex(candidate => candidate.id === id), home = homes.get(id)!;
    const cycle = (elapsed / unit + index * 673) % 5600;
    const neighborId = ambient.filter(other => other !== id).sort((left, right) => {
      const a = homes.get(left)!, b = homes.get(right)!;
      return Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y);
    })[0];
    const neighborHome = neighborId ? homes.get(neighborId)! : home;
    const dx = neighborHome.x - home.x, dy = neighborHome.y - home.y, gap = Math.hypot(dx, dy);
    const approach = props.preview || elapsed < 500 * unit ? 0 : Math.max(0, gap / 2 - 30) * ease((cycle - 600) / 1000);
    const sidestep = cycle > 3650 && cycle < 4700 ? Math.sin((cycle - 3650) / 1050 * Math.PI) * 18 : 0;
    const target = { x: home.x + dx / Math.max(1, gap) * approach + dy / Math.max(1, gap) * sidestep, y: home.y + dy / Math.max(1, gap) * approach - dx / Math.max(1, gap) * sidestep * .5 };
    const body = sim.bodies.get(id) ?? { ...home, gait: 0, facing: home.x < 500 ? 1 : -1, vx: 0, vy: 0 };
    sim.bodies.set(id, body);
    const distance = Math.hypot(target.x - body.x, target.y - body.y);
    if (!engaged.has(id) && !preparing.has(id) && !won) move(body, target, seconds, 105);
    const neighbor = neighborId ? sim.bodies.get(neighborId) : undefined;
    const touching = !!neighbor && Math.hypot(neighbor.x - body.x, neighbor.y - body.y) < 83;
    if (touching) body.facing = neighbor.x > body.x ? 1 : -1;
    const pose: ArenaPose = props.preview ? 'guard' : distance > 12 ? 'walk' : !touching || cycle < 1400 ? 'guard' : cycle < 2650 ? index % 2 ? 'brace' : 'grapple' : cycle < 3650 ? index % 2 ? 'brace' : 'push' : cycle < 4700 ? 'dodge' : 'guard';
    const candidateIndex = props.candidates.findIndex(candidate => candidate.id === id);
    actors.set(id, { candidate: props.candidates[candidateIndex], index: candidateIndex, x: body.x, y: body.y, scale: 2.04, facing: body.facing, pose, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: cycle / 5600, power: .7, nameVisible: false, gripTarget: touching && neighbor && ['grapple', 'push', 'brace'].includes(pose) ? { x: neighbor.x - body.facing * 17, y: neighbor.y - 62 } : undefined });
    if (!reduced && !props.preview && touching && cycle > 2700 && cycle < 3150) dust(ctx, body.x + body.facing * 24, body.y, cycle - 2700, .3);
  });
  // Future participants approach while the preceding throw is still resolving.
  if (upcoming) {
    const a = sim.bodies.get(upcoming.aggressor), v = sim.bodies.get(upcoming.victim);
    if (a && v && !sim.contacts.has(upcoming.id)) sim.contacts.set(upcoming.id, { center: { x: clamp((a.x + v.x) / 2, 315, 685), y: clamp(Math.max(a.y, v.y), 390, 465) }, side: upcoming.index % 2 ? 1 : -1 });
    const contact = sim.contacts.get(upcoming.id);
    if (contact) [upcoming.aggressor, upcoming.victim, upcoming.helper].forEach((id, role) => {
      if (!id || !preparing.has(id)) return;
      const body = sim.bodies.get(id), actor = actors.get(id);
      if (!body || !actor) return;
      const offsets = upcoming.tactic === 'team' ? [-52, 0, 52] : upcoming.tactic === 'betrayal' ? [-98, 0, 52] : [-29, 29, 82];
      const target = { x: contact.center.x + offsets[role], y: contact.center.y };
      move(body, target, seconds, 300);
      actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
      actor.pose = Math.hypot(target.x - body.x, target.y - body.y) > 100 ? 'run' : 'walk';
      actor.gripTarget = undefined;
    });
  }
  if (exchange) {
    const a = sim.bodies.get(exchange.aggressor), v = sim.bodies.get(exchange.victim);
    if (a && v && !sim.contacts.has(exchange.id)) sim.contacts.set(exchange.id, { center: { x: clamp((a.x + v.x) / 2, 315, 685), y: clamp(Math.max(a.y, v.y), 390, 465) }, side: exchange.index % 2 ? 1 : -1 });
    const contact = sim.contacts.get(exchange.id);
    const beat = arenaBeat(exchange, elapsed), p = beat.progress;
    if (contact) {
      const center = contact.center;
      const ids = [exchange.aggressor, exchange.victim, exchange.helper].filter((id): id is string => !!id);
      ids.forEach((id, role) => {
        const body = sim.bodies.get(id), actor = actors.get(id);
        if (!body || !actor || sim.exits.has(id)) return;
        const target = { x: center.x + (role === 0 ? -29 : role === 1 ? 29 : 82), y: center.y };
        let pose: ArenaPose = beat.stage === 'approach' ? 'guard' : role === 1 ? 'brace' : 'grapple';
        if (exchange.tactic === 'team') {
          target.x = center.x + (role === 0 ? -52 : role === 1 ? 0 : 52);
          pose = beat.stage === 'turn' ? role === 1 ? 'brace' : 'lift' : role === 1 ? 'brace' : 'grapple';
        }
        if (exchange.tactic === 'betrayal') {
          const entry = ease((p - .52) / .20), release = ease((p - .52) / .16);
          target.x = center.x + (role === 0 ? -98 + entry * 46 : role === 1 ? 0 : 52 + release * 42);
          target.y += role === 2 ? release * 32 : 0;
          pose = role === 0 ? p < .52 ? 'guard' : 'lift' : role === 2 ? p < .52 ? 'grapple' : 'dodge' : 'brace';
        }
        if (exchange.tactic === 'bait') {
          const dodge = ease((p - .52) / .22), charge = ease((p - .32) / .68);
          target.x = center.x + (role === 0 ? -30 - dodge * 23 : 102 - charge * 188);
          target.y += role === 0 ? dodge * 43 : -charge * 12;
          pose = role === 0 ? p < .52 ? 'guard' : 'dodge' : p < .30 ? 'guard' : 'run';
        }
        if (exchange.tactic === 'counter' || exchange.tactic === 'brace') {
          const press = Math.sin(clamp((p - .30) / .22) * Math.PI / 2) * 12;
          target.x -= p < .52 ? press : press * (1 - beat.weightProgress);
          pose = p < .52 ? role === 0 ? 'brace' : 'push' : role === 0 ? 'lift' : 'brace';
        }
        if (exchange.tactic === 'lift' || exchange.final) {
          pose = p < .52 ? 'grapple' : role === 0 ? 'lift' : 'brace';
          const struggle = p > .30 && p < .52 ? Math.sin((p - .30) * Math.PI * 9) * 4 : 0;
          target.x += struggle;
        }
        if (exchange.exchange && elapsed >= exchange.impact) {
          const release = ease((elapsed - exchange.impact) / (1.6 * 1000 * unit));
          target.x += (role === 0 ? -1 : 1) * release * 47; target.y += role === 0 ? release * 16 : -release * 12;
          pose = 'guard';
        } else if (elapsed >= exchange.impact && role !== 1) pose = elapsed - exchange.impact < 350 * unit ? 'throw' : 'guard';
        // Only an explicit seek may reconstruct a pose. Live actors accelerate and brake on their feet.
        if (reset && elapsed > 300 * unit) { body.x = target.x; body.y = target.y; body.motorX = 0; body.motorY = 0; }
        else move(body, target, seconds, beat.stage === 'approach' ? 330 : pose === 'run' ? 255 : 170);
        const remaining = Math.hypot(target.x - body.x, target.y - body.y);
        const opponent = sim.bodies.get(role === 1 && exchange.tactic === 'betrayal' && p < .52 ? exchange.helper! : role === 1 ? exchange.aggressor : exchange.victim);
        const contactDistance = opponent ? Math.hypot(opponent.x - body.x, opponent.y - body.y) : Infinity;
        if (remaining < 14 && opponent) body.facing = opponent.x > body.x ? 1 : -1;
        actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
        actor.pose = remaining > 14 || (['grapple', 'lift', 'push'].includes(pose) && contactDistance > 90) ? remaining > 100 ? 'run' : 'walk' : pose;
        actor.phase = p >= .52 ? beat.liftProgress : clamp((p - .30) / .22); actor.power = .35 + beat.weightProgress * .65;
      });
      const victim = actors.get(exchange.victim), attacker = actors.get(exchange.aggressor), helper = exchange.helper ? actors.get(exchange.helper) : undefined;
      const connected = !!victim && !!attacker && Math.hypot(attacker.x - victim.x, attacker.y - victim.y) < 86;
      const bothConnected = exchange.tactic !== 'team' || !!helper && !!victim && Math.hypot(helper.x - victim.x, helper.y - victim.y) < 86;
      const lifting = exchange.tactic !== 'bait' && connected && bothConnected;
      const heldLift = lifting ? beat.liftProgress * (exchange.exchange ? 22 : 52) : 0;
      const releaseLift = exchange.exchange && elapsed >= exchange.impact ? 1 - ease((elapsed - exchange.impact) / (380 * unit)) : 1;
      if (victim && !sim.exits.has(exchange.victim)) {
        victim.y -= heldLift * releaseLift;
        victim.angle = lifting && !reduced ? -.22 * beat.liftProgress * releaseLift : 0;
        if (heldLift * releaseLift > 5) victim.pose = 'airborne';
      }
      ids.forEach((id, role) => {
        const actor = actors.get(id);
        if (!actor || actor.pose === 'walk' || actor.pose === 'run' || elapsed - exchange.impact > 120 * unit) return;
        const allyContact = exchange.tactic === 'betrayal' && p < .52;
        const other = role === 1 ? allyContact ? helper : attacker : victim;
        const disconnected = role === 2 && exchange.tactic === 'betrayal' && p >= .52 || role === 0 && allyContact || exchange.tactic === 'bait';
        if (!other || disconnected || Math.hypot(other.x - actor.x, other.y - actor.y) > 100) return;
        const nearSide = other.x > actor.x ? -1 : 1;
        actor.gripTarget = { x: other.x + nearSide * 17, y: other.y - 44 };
        actor.secondaryGripTarget = { x: other.x + nearSide * 20, y: other.y - 52 };
      });
      if (!exchange.exchange && elapsed >= exchange.impact && !sim.exits.has(exchange.victim)) {
        const body = sim.bodies.get(exchange.victim);
        if (body) sim.exits.set(exchange.victim, makeExit(exchange, { x: body.x, y: body.y }, heldLift, victim?.angle ?? 0));
      }
      relationship(ctx, exchange, elapsed, actors, false, sim.bodies);
    }
  }
  for (const [id, exit] of sim.exits) {
    const body = sim.bodies.get(id)!;
    const age = elapsed - exit.round.impact;
    const flight = arenaThrow(age, exit.origin, exit.landing, exit.side, unit, { lift: exit.lift, angle: exit.angle });
    const index = props.candidates.findIndex(candidate => candidate.id === id);
    let pose: ArenaPose = flight.stage === 'flight' || flight.stage === 'roll' || flight.stage === 'hold' && exit.lift > 3 ? 'airborne' : flight.stage === 'land' ? 'land' : flight.stage === 'recover' ? 'recover' : flight.stage === 'hold' ? 'brace' : 'walk';
    const toCelebration = won && (id === order[1] || id === order.at(-1)) && elapsed - rounds.at(-1)!.resolve >= 2100 * unit;
    if (flight.stage === 'walk') {
      if (!toCelebration) move(body, exit.bench, seconds, 94);
      if (Math.hypot(exit.bench.x - body.x, exit.bench.y - body.y) < 4) {
        body.facing = exit.side < 0 ? 1 : -1;
        pose = Math.floor((clock + index * 617) / 2400) % 3 ? 'clap' : 'bow';
      }
    }
    else { body.x = flight.x; body.y = reduced && flight.stage === 'flight' ? flight.groundY - flight.height * .28 : flight.y; }
    const actor: ArenaActor = { candidate: props.candidates[index], index, x: body.x, y: body.y, scale: 2.04, facing: body.facing, pose, angle: reduced ? 0 : flight.stage === 'walk' ? 0 : flight.angle, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: flight.phase, rank: ranks[id], nameVisible: false };
    actors.set(id, actor);
    if (flight.stage === 'flight') { ctx.fillStyle = '#27332e40'; ctx.beginPath(); ctx.ellipse(flight.groundX, flight.groundY + 4, 32, 7, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!reduced) dust(ctx, exit.landing.x, exit.landing.y, age / unit - 880, 1.5);
  }
  if (won) {
    const winnerId = order[0], winner = sim.bodies.get(winnerId)!;
    const age = elapsed - rounds.at(-1)!.resolve;
    if (reset || reduced) { winner.x = 500; winner.y = 443; }
    else move(winner, { x: 500, y: 443 }, seconds, 126);
    const actor = actors.get(winnerId)!;
    actor.x = winner.x; actor.y = winner.y; actor.facing = winner.facing; actor.pose = Math.hypot(winner.x - 500, winner.y - 443) > 8 ? 'walk' : 'cheer'; actor.nameVisible = true;
    const supporters = [order[1], order.at(-1)].filter((id, index, list): id is string => !!id && list.indexOf(id) === index);
    supporters.forEach((id, index) => {
      const body = sim.bodies.get(id), actor = actors.get(id);
      if (!body || !actor || !reduced && age < 2100 * unit) return;
      const x = supporters.length === 1 ? 565 : index ? 565 : 435;
      if (reduced) { body.x = x; body.y = 470; }
      else move(body, { x, y: 470 }, seconds, 190);
      const distance = Math.hypot(body.x - x, body.y - 470);
      if (distance < 8) body.facing = x < 500 ? 1 : -1;
      actor.x = body.x; actor.y = body.y; actor.angle = 0; actor.facing = body.facing;
      actor.pose = distance < 8 ? index ? 'clap' : 'cheer' : distance > 100 ? 'run' : 'walk'; actor.phase = index ? .65 : .9;
    });
    actor.scale = 2.04;
    if (!reduced) for (let i = 0; i < 38; i++) { const fall = (clock * (.04 + i % 4 * .007) + i * 47) % 420; ctx.fillStyle = ['#ffda72', '#85cec3', '#e9a185'][i % 3]; ctx.fillRect(120 + i * 131 % 760, 130 + fall, 5, 4); }
  }
  for (const [id, actor] of actors) {
    const body = sim.bodies.get(id)!;
    const previous = before.get(id) ?? body;
    const ground = actor.pose !== 'airborne' && actor.pose !== 'land' && actor.pose !== 'recover';
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
  [...actors.values()].sort((a, b) => a.y - b.y).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));
  if (exchange && !won) relationship(ctx, exchange, elapsed, actors, true);
}

export default function ArenaShow(props: SportsStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef(props), sampledAt = useRef(0);
  latest.current = props;
  useEffect(() => { sampledAt.current = performance.now(); }, [props.elapsed, props.paused, props.preview]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    const sim: Simulation = { key: '', elapsed: 0, epoch: 0, bodies: new Map(), contacts: new Map(), exits: new Map() };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let request = 0, previous = 0, clock = 0;
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
      render(ctx, state, elapsed, clock, sim, state.paused ? 0 : delta, media.matches);
      request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, []);
  const order = useMemo(() => validOrder(props.candidates, props.order), [props.candidates, props.order]);
  const rounds = useMemo(() => arenaRounds(order, props.duration), [order, props.duration]);
  const ranks = props.preview ? {} : arenaRanks(order, props.elapsed, props.duration);
  const finished = !props.preview && !!rounds.length && props.elapsed >= rounds.at(-1)!.resolve;
  const round = rounds.find(item => props.elapsed >= item.start && props.elapsed < item.end);
  const narration = arenaNarration(props.preview ? undefined : finished ? rounds.at(-1) : round ?? arenaExchange(order, props.elapsed, props.duration), props.candidates, order, props.elapsed, props.preview);
  const alive = props.candidates.length - Object.values(ranks).filter(rank => rank !== 1).length;
  return <section className="arena-show" aria-label="전원 동시 장외 난투">
    <div className="arena-stage">
      <canvas ref={canvas} className="arena-canvas" aria-label={finished ? `${props.candidates.find(candidate => candidate.id === order[0])?.name} 우승` : '여러 무리가 동시에 붙고 밀고 뒤집는 장외 난투'} />
      <ArenaStory round={props.preview ? undefined : finished ? rounds.at(-1) : round ?? arenaExchange(order, props.elapsed, props.duration)} candidates={props.candidates} elapsed={props.elapsed} preview={props.preview} finished={finished} title={narration.title} detail={narration.detail} />
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
