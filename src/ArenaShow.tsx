import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Candidate } from './election';
import type { SportsStageProps } from './sports';
import { arenaExchange, arenaNarration, arenaRanks, arenaRounds, arenaThrow, type ArenaPoint, type ArenaRound } from './arenaLogic';
import { drawArenaFighter, type ArenaActor, type ArenaPose } from './game/ArenaFighter';
import './arena.css';

type Body = ArenaPoint & { gait: number; facing: number; vx: number; vy: number };
type Contact = { center: ArenaPoint; side: number };
type Exit = { round: ArenaRound; origin: ArenaPoint; landing: ArenaPoint; side: number; bench: ArenaPoint };
type Simulation = { key: string; elapsed: number; bodies: Map<string, Body>; contacts: Map<string, Contact>; exits: Map<string, Exit> };
const W = 1000, H = 620;
const clamp = (p: number, low = 0, high = 1) => Math.max(low, Math.min(high, p));
const ease = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };
const colors = ['#e4b17c', '#96b9bc', '#bd9690'];

function validOrder(candidates: Candidate[], supplied: string[]) {
  const ids = new Set(candidates.map(candidate => candidate.id));
  const order = [...new Set(supplied)].filter(id => ids.has(id));
  return [...order, ...candidates.map(candidate => candidate.id).filter(id => !order.includes(id))];
}

function move(body: Body, target: ArenaPoint, seconds: number, speed = 116) {
  const dx = target.x - body.x, dy = target.y - body.y;
  const distance = Math.hypot(dx, dy);
  if (Math.abs(dx) > 3) body.facing = dx < 0 ? -1 : 1;
  const travel = Math.min(distance, speed * seconds);
  if (distance > 0.01) { body.x += dx / distance * travel; body.y += dy / distance * travel; }
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

function scenery(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H); gradient.addColorStop(0, '#152932'); gradient.addColorStop(1, '#42504c');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 34; i++) {
    const x = 7 + i * 30 + row % 2 * 9, y = 148 + row * 19;
    ctx.fillStyle = colors[(i + row) % 3]; ctx.fillRect(x, y, 7, 8); ctx.fillStyle = '#456068'; ctx.fillRect(x - 3, y + 7, 13, 9);
  }
  ctx.fillStyle = '#7b6248'; ctx.beginPath(); ctx.ellipse(500, 434, 355, 167, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8b17b'; ctx.beginPath(); ctx.ellipse(500, 416, 345, 158, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff0c0'; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(500, 406, 306, 137, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#a98049'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(500, 406, 302, 133, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 210; i++) {
    const x = 182 + i * 113 % 636, y = 278 + i * 67 % 257;
    if ((x - 500) ** 2 / 304 ** 2 + (y - 406) ** 2 / 134 ** 2 < 1) { ctx.fillStyle = i % 3 ? '#c8a066' : '#e9c891'; ctx.fillRect(x, y, 3 + i % 2, 2); }
  }
  ctx.fillStyle = '#263e43';
  for (const side of [0, 1]) for (let row = 0; row < 2; row++) ctx.fillRect(side ? 864 : 20, 354 + row * 161, 116, 8);
  text(ctx, '장외', 78, 222, 16, '#c6b39a', 90); text(ctx, '장외', 922, 222, 16, '#c6b39a', 90);
}

function render(ctx: CanvasRenderingContext2D, props: SportsStageProps, elapsed: number, clock: number, sim: Simulation, delta: number, reduced: boolean) {
  const order = validOrder(props.candidates, props.order);
  const signature = `${props.preview}:${props.order.join(',')}:${props.candidates.map(candidate => candidate.id).join(',')}`;
  const seek = elapsed < sim.elapsed - 150 || elapsed - sim.elapsed > 500;
  if (sim.key !== signature || seek) { sim.key = signature; sim.bodies.clear(); sim.contacts.clear(); sim.exits.clear(); }
  sim.elapsed = elapsed;
  const unit = props.duration / 44_000;
  const rounds = arenaRounds(order, props.duration);
  const ranks = props.preview ? {} : arenaRanks(order, elapsed, props.duration);
  const current = props.preview ? undefined : rounds.find(round => elapsed >= round.start && elapsed < round.end);
  const won = !props.preview && !!rounds.length && elapsed >= rounds.at(-1)!.resolve;
  const exchange = props.preview || won ? undefined : current ?? arenaExchange(order, elapsed, props.duration);
  const engaged = new Set(exchange ? [exchange.aggressor, exchange.victim, exchange.helper] : []);
  const living = order.filter(id => !ranks[id]);
  const active = won ? order.filter(id => id === order[0]) : living;
  const before = new Map([...sim.bodies].map(([id, body]) => [id, { x: body.x, y: body.y }]));
  const actors = new Map<string, ArenaActor>();
  const seconds = props.paused ? 0 : delta / 1000;
  scenery(ctx);
  if (!order.length) { text(ctx, '참가자를 입력하면 모래판에 모입니다', 500, 392, 28, '#73593e'); return; }
  const makeExit = (round: ArenaRound, origin: ArenaPoint) => {
    const outIndex = order.length - order.indexOf(round.victim) - 1;
    const side = round.final ? 1 : round.tactic === 'bait' ? -1 : outIndex % 2 ? 1 : -1;
    const seat = [...sim.exits.values()].filter(exit => exit.side === side).length;
    const bench = { x: side < 0 ? 38 + seat % 3 * 52 : 962 - seat % 3 * 52, y: 332 + Math.floor(seat / 3) * 161 };
    return { round, origin, landing: { x: side < 0 ? 115 : 885, y: 436 }, side, bench };
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
  const groupCount = Math.max(1, Math.ceil(active.length / 3));
  const centers = groupCount === 1 ? [[500, 421]] : groupCount === 2 ? [[344, 402], [656, 427]] : groupCount === 3 ? [[306, 388], [694, 388], [500, 482]] : [[307, 384], [693, 384], [346, 480], [654, 480]];
  const epoch = Math.floor(elapsed / (5.6 * 1000 * unit));
  const rotated = [...active.slice(epoch % active.length), ...active.slice(0, epoch % active.length)];
  active.forEach(id => {
    if (sim.exits.has(id)) return;
    const index = rotated.indexOf(id), group = Math.floor(index / 3), slot = index % 3;
    const count = Math.min(3, active.length - group * 3);
    const cycle = (elapsed / unit + group * 811) % 5600;
    const center = centers[group];
    const flank = cycle > 3650 && cycle < 4700 ? Math.sin((cycle - 3650) / 1050 * Math.PI) * (slot ? 24 : -24) : 0;
    const target = { x: center[0] + (slot - (count - 1) / 2) * 58 + flank, y: center[1] + slot % 2 * 10 };
    const body = sim.bodies.get(id) ?? { ...target, gait: 0, facing: slot === 0 ? 1 : -1, vx: 0, vy: 0 };
    sim.bodies.set(id, body);
    const distance = Math.hypot(target.x - body.x, target.y - body.y);
    if (!engaged.has(id) && !won) move(body, target, seconds, 105);
    const pose: ArenaPose = props.preview ? 'guard' : distance > 18 ? 'walk' : cycle < 1400 ? 'guard' : cycle < 2650 ? slot ? 'brace' : 'grapple' : cycle < 3650 ? slot ? 'brace' : 'push' : cycle < 4700 ? slot ? 'dodge' : 'grapple' : 'guard';
    const candidateIndex = props.candidates.findIndex(candidate => candidate.id === id);
    actors.set(id, { candidate: props.candidates[candidateIndex], index: candidateIndex, x: body.x, y: body.y, scale: 2.04, facing: body.facing, pose, angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: body.gait, phase: cycle / 5600, power: .7, nameVisible: false });
    if (!reduced && !props.preview && distance < 18 && cycle > 2700 && cycle < 3150) dust(ctx, body.x + body.facing * 24, body.y, cycle - 2700, .3);
  });
  if (exchange) {
    const a = sim.bodies.get(exchange.aggressor), v = sim.bodies.get(exchange.victim);
    if (a && v && !sim.contacts.has(exchange.id)) sim.contacts.set(exchange.id, { center: { x: clamp((a.x + v.x) / 2, 315, 685), y: clamp(Math.max(a.y, v.y), 390, 465) }, side: exchange.index % 2 ? 1 : -1 });
    const contact = sim.contacts.get(exchange.id);
    const elapsedAge = elapsed - exchange.start;
    const buildup = exchange.impact - exchange.start;
    const p = clamp(elapsedAge / buildup);
    if (contact) {
      const center = contact.center;
      const ids = [exchange.aggressor, exchange.victim, exchange.helper].filter((id): id is string => !!id);
      ids.forEach((id, role) => {
        const body = sim.bodies.get(id), actor = actors.get(id);
        if (!body || !actor || sim.exits.has(id)) return;
        let target = { x: center.x + (role === 0 ? -30 : role === 1 ? 30 : 84), y: center.y + (role === 2 ? -8 : 0) };
        let pose: ArenaPose = p < .28 ? 'guard' : role === 1 ? 'brace' : 'grapple';
        if (exchange.tactic === 'team') { target.x = center.x + (role === 0 ? -47 : role === 1 ? 9 : 63); pose = p > .4 ? role === 1 ? 'brace' : 'push' : 'grapple'; }
        if (exchange.tactic === 'bait') { const dodge = ease((p - .53) / .3); target.x = center.x + (role === 0 ? -30 - dodge * 48 : 84 - dodge * 176); target.y += role === 0 ? dodge * 46 : 0; pose = p > .52 ? role === 0 ? 'dodge' : 'run' : 'guard'; }
        if (exchange.tactic === 'counter') { target.x += (role === 0 ? -1 : -1) * Math.sin(p * Math.PI) * 30; pose = p < .63 ? role === 0 ? 'brace' : 'push' : role === 0 ? 'lift' : 'grapple'; }
        if (exchange.tactic === 'betrayal') { target.x = center.x + (role === 0 ? -58 : role === 1 ? 0 : 54); if (role === 2 && p > .56) { target.y += 47; target.x -= 34; pose = 'dodge'; } else pose = role === 0 && p > .56 ? 'push' : 'grapple'; }
        if (exchange.tactic === 'brace') { target.x -= Math.sin(p * Math.PI) * (role === 0 ? 3 : 16); pose = p < .65 ? role === 0 ? 'brace' : 'push' : role === 0 ? 'push' : 'brace'; }
        if (exchange.tactic === 'lift' || exchange.final) { pose = p < .62 ? 'grapple' : role === 0 ? 'lift' : 'brace'; if (exchange.final) target.x += Math.sin(p * Math.PI * 4) * 13; }
        if (exchange.exchange && elapsed >= exchange.impact) { const release = ease((elapsed - exchange.impact) / (1.6 * 1000 * unit)); target.x += (role === 0 ? -1 : 1) * release * 47; target.y += role === 0 ? release * 16 : -release * 12; pose = 'guard'; }
        const remaining = Math.hypot(target.x - body.x, target.y - body.y);
        // Approach on feet; the story never teleports its actors to a new duel position.
        move(body, target, seconds, p < .32 ? 214 : pose === 'run' ? 190 : 102);
        body.facing = role === 0 ? 1 : -1;
        actor.x = body.x; actor.y = body.y; actor.facing = body.facing;
        actor.pose = remaining > 32 || (pose === 'lift' && remaining > 3) ? p < .32 && remaining > 100 ? 'run' : 'walk' : pose;
        actor.phase = p > .62 ? (p - .62) / .38 : p; actor.power = p > .4 ? 1 : .3;
      });
      if (!exchange.exchange && elapsed >= exchange.impact && !sim.exits.has(exchange.victim)) {
        const body = sim.bodies.get(exchange.victim);
        if (body) {
          sim.exits.set(exchange.victim, makeExit(exchange, { x: body.x, y: body.y }));
        }
      }
    }
  }
  for (const [id, exit] of sim.exits) {
    const body = sim.bodies.get(id)!;
    const age = elapsed - exit.round.impact;
    const flight = arenaThrow(age, exit.origin, exit.landing, exit.side, unit);
    const index = props.candidates.findIndex(candidate => candidate.id === id);
    let pose: ArenaPose = flight.stage === 'flight' || flight.stage === 'roll' ? 'airborne' : flight.stage === 'land' ? 'land' : flight.stage === 'recover' ? 'recover' : flight.stage === 'hold' ? 'brace' : 'walk';
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
    move(winner, { x: 500, y: 443 }, seconds, 126);
    const actor = actors.get(winnerId)!;
    actor.x = winner.x; actor.y = winner.y; actor.facing = winner.facing; actor.pose = Math.hypot(winner.x - 500, winner.y - 443) > 8 ? 'walk' : 'cheer'; actor.nameVisible = true;
    const supporters = [order[1], order.at(-1)].filter((id, index, list): id is string => !!id && list.indexOf(id) === index);
    supporters.forEach((id, index) => {
      const body = sim.bodies.get(id), actor = actors.get(id);
      if (!body || !actor || age < 2100 * unit) return;
      const x = supporters.length === 1 ? 500 : index ? 559 : 441;
      move(body, { x, y: 513 }, seconds, 190);
      const distance = Math.hypot(body.x - x, body.y - 513);
      actor.x = body.x; actor.y = body.y; actor.angle = 0; actor.pose = distance < 8 ? 'lift' : distance > 100 ? 'run' : 'walk'; actor.phase = 1;
    });
    const ready = Math.min(...supporters.map((id, index) => { const body = sim.bodies.get(id)!; const x = supporters.length === 1 ? 500 : index ? 559 : 441; return clamp(1 - Math.hypot(body.x - x, body.y - 513) / 80); }));
    actor.y -= ready * 33; actor.scale = 2.04 + ready * .66;
    if (!reduced) for (let i = 0; i < 38; i++) { const fall = (clock * (.04 + i % 4 * .007) + i * 47) % 420; ctx.fillStyle = ['#ffda72', '#85cec3', '#e9a185'][i % 3]; ctx.fillRect(120 + i * 131 % 760, 130 + fall, 5, 4); }
  }
  for (const [id, actor] of actors) {
    const body = sim.bodies.get(id)!;
    const previous = before.get(id) ?? body;
    const ground = actor.pose !== 'airborne' && actor.pose !== 'land' && actor.pose !== 'recover';
    const distance = Math.hypot(body.x - previous.x, body.y - previous.y);
    if (seconds && ground) body.gait += distance;
    if (seconds) { body.vx = (body.x - previous.x) / seconds; body.vy = (body.y - previous.y) / seconds; }
    actor.velocityX = body.vx;
    actor.velocityY = body.vy;
    actor.gaitDistance = body.gait;
  }
  [...actors.values()].sort((a, b) => a.y - b.y).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));
}

export default function ArenaShow(props: SportsStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef(props), sampledAt = useRef(0);
  latest.current = props;
  useEffect(() => { sampledAt.current = performance.now(); }, [props.elapsed, props.paused, props.preview]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    const sim: Simulation = { key: '', elapsed: 0, bodies: new Map(), contacts: new Map(), exits: new Map() };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let request = 0, previous = 0, clock = 0;
    const draw = (now: number) => {
      const state = latest.current, delta = previous ? Math.min(50, Math.max(0, now - previous)) : 16;
      previous = now; if (!state.paused) clock += delta;
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
      <div className={`arena-callout${finished ? ' arena-callout-winner' : ''}`}><strong>{narration.title}</strong><span>{narration.detail}</span></div>
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
