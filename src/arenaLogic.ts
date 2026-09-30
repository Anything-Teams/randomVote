import type { Candidate } from './election';

export type ArenaTactic = 'team' | 'bait' | 'counter' | 'betrayal' | 'brace' | 'lift' | 'final';
export type ArenaRound = { id: string; index: number; tactic: ArenaTactic; aggressor: string; helper?: string; victim: string; start: number; impact: number; resolve: number; end: number; final: boolean; exchange?: boolean };
export type ArenaPoint = { x: number; y: number };
export type ArenaThrowFrame = ArenaPoint & { groundX: number; groundY: number; height: number; angle: number; phase: number; stage: 'hold' | 'flight' | 'land' | 'roll' | 'recover' | 'walk' };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);
const tactics: ArenaTactic[] = ['team', 'bait', 'counter', 'betrayal', 'brace', 'lift'];

/** Ranking is supplied by the uniform draw; choreography never redraws a result. */
export function arenaRounds(order: string[], duration = 44_000): ArenaRound[] {
  if (order.length < 2) return [];
  const unit = duration / 44;
  const preliminaries = order.length - 2;
  const spacing = 30.6 * unit / Math.max(1, preliminaries);
  const seed = order.join('|').split('').reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0);
  const rounds = Array.from({ length: preliminaries }, (_, index): ArenaRound => {
    const living = order.slice(0, order.length - index);
    const victim = living.at(-1)!;
    const pool = living.filter(id => id !== victim);
    const aggressor = pool[(seed + index * 7 + index * index) % pool.length];
    const helpers = pool.filter(id => id !== aggressor);
    const possibleHelper = helpers.length ? helpers[((seed >>> 5) + index * 3) % helpers.length] : undefined;
    let tactic = tactics[(seed + index) % tactics.length];
    if (!possibleHelper && (tactic === 'team' || tactic === 'betrayal')) tactic = 'counter';
    const span = Math.min(5 * unit, spacing);
    const start = 2.6 * unit + (index + 1) * spacing - span;
    const impact = start + span - 1.55 * unit;
    return { id: `arena-${index}`, index, tactic, aggressor, helper: tactic === 'team' || tactic === 'betrayal' ? possibleHelper : undefined, victim, start, impact, resolve: impact + 1.1 * unit, end: start + span, final: false };
  });
  rounds.push({ id: 'arena-final', index: preliminaries, tactic: 'final', aggressor: order[0], victim: order[1], start: 33.2 * unit, impact: 38.2 * unit, resolve: 39.3 * unit, end: duration, final: true });
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
export function arenaExchange(order: string[], elapsed: number, duration = 44_000): ArenaRound | undefined {
  const ranks = arenaRanks(order, elapsed, duration);
  const living = order.filter(id => !ranks[id]);
  if (living.length < 2) return undefined;
  const unit = duration / 44;
  const span = 4.8 * unit;
  const epoch = Math.floor(elapsed / span);
  const aggressor = living[epoch % living.length];
  const victim = living[(epoch + 1) % living.length];
  const possibleHelper = living.length > 2 ? living[(epoch + 2) % living.length] : undefined;
  let tactic = tactics[epoch % tactics.length];
  if (!possibleHelper && (tactic === 'team' || tactic === 'betrayal')) tactic = epoch % 2 ? 'bait' : 'brace';
  return { id: `exchange-${epoch}`, index: epoch, tactic, aggressor, helper: tactic === 'team' || tactic === 'betrayal' ? possibleHelper : undefined, victim, start: epoch * span, impact: epoch * span + 3.2 * unit, resolve: Infinity, end: (epoch + 1) * span, final: false, exchange: true };
}

/** The first 120 ms holds the contact. Flight and ground recovery remain separate. */
export function arenaThrow(age: number, origin: ArenaPoint, landing: ArenaPoint, direction = 1, unit = 1): ArenaThrowFrame {
  const ms = age / Math.max(0.001, unit);
  if (ms < 120) return { ...origin, groundX: origin.x, groundY: origin.y, height: 0, angle: 0, phase: clamp(ms / 120), stage: 'hold' };
  if (ms < 880) {
    const p = clamp((ms - 120) / 760);
    const groundX = mix(origin.x, landing.x, p);
    const groundY = mix(origin.y, landing.y, p);
    const height = 132 * 4 * p * (1 - p);
    return { x: groundX, y: groundY - height, groundX, groundY, height, angle: direction * -Math.PI * 0.83 * ease(p), phase: p, stage: 'flight' };
  }
  if (ms < 1100) {
    const p = (ms - 880) / 220;
    return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: direction * -Math.PI * (0.83 + p * 0.06), phase: p, stage: 'land' };
  }
  if (ms < 1600) {
    const p = (ms - 1100) / 500;
    const x = landing.x + direction * Math.sin(p * Math.PI) * 18;
    return { x, y: landing.y, groundX: x, groundY: landing.y, height: 0, angle: direction * mix(-Math.PI * 0.89, -Math.PI * 2, ease(p)), phase: p, stage: 'roll' };
  }
  if (ms < 2100) return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: (ms - 1600) / 500, stage: 'recover' };
  return { ...landing, groundX: landing.x, groundY: landing.y, height: 0, angle: 0, phase: 1, stage: 'walk' };
}

export function arenaNarration(round: ArenaRound | undefined, candidates: Candidate[], order: string[], elapsed: number, preview = false) {
  const actor = (id: string | undefined) => {
    const index = candidates.findIndex(candidate => candidate.id === id);
    return index < 0 ? '' : `${index + 1}번 ${candidates[index].name}`;
  };
  if (preview) return { title: '장외 난투 · 모두 함께 맞붙습니다', detail: '색 띠와 번호로 구분합니다. 마지막까지 모래판에 남은 참가자가 우승합니다.' };
  if (!round) return { title: '여러 무리가 동시에 힘겨루기', detail: '접근하고 샅바를 잡고, 상대의 힘을 버티며 다음 빈틈을 엿봅니다.' };
  const a = actor(round.aggressor), v = actor(round.victim), h = actor(round.helper);
  if (round.exchange && elapsed >= round.impact) return { title: '버텼다! 다시 빈틈을 살핍니다', detail: `${a} · ${v}, 모두 모래판을 지켰습니다. 손을 풀고 다음 빈틈을 봅니다.` };
  if (elapsed >= round.resolve) return { title: round.final ? `${a}, 오늘의 장사!` : `장외! ${v} · ${order.indexOf(round.victim) + 1}위 확정`, detail: round.final ? '버티던 마지막 상대를 뒤집었습니다. 함께 우승자를 들어 올립니다.' : `${v}, 모래판 밖에 착지했습니다. 나머지 선수들의 난투는 계속됩니다.` };
  const titles: Record<ArenaTactic, string> = { team: '협공 · 한 명은 길을 막고, 한 명은 민다', bait: '미끼 · 돌진을 기다렸다가 옆으로 피한다', counter: '역습 · 밀리던 쪽이 중심을 낮춘다', betrayal: '배신 · 등을 맡긴 순간 방향을 바꾼다', brace: '버티기 · 발을 박고 힘을 되돌린다', lift: '들배지기 · 체중을 싣고 들어 올린다', final: '마지막 두 명 · 최후의 버티기' };
  const details: Record<ArenaTactic, string> = {
    team: `${h}, ${v}의 퇴로를 막습니다. ${a}, 앞에서 함께 밀어냅니다.`,
    bait: `${a}, 틈을 보입니다. ${v}의 돌진을 옆으로 피해 관성을 이용합니다.`,
    counter: `${a}, 낮게 파고들어 샅바를 잡습니다. ${v}의 밀기를 되칩니다.`,
    betrayal: `${h}, ${v}의 등을 놓습니다. ${a}, 열린 틈으로 밀어냅니다.`,
    brace: `${a}, ${v}의 밀기를 두 발로 버텨냅니다. 힘을 반대로 돌립니다.`,
    lift: `${a}, ${v}의 몸통을 잡습니다. 무릎을 굽혀 체중을 싣고 들어 올립니다.`,
    final: `${a} · ${v}, 팽팽한 힘겨루기. 한 번의 중심 이동이 승부를 가릅니다.`,
  };
  return { title: elapsed >= round.impact ? `${titles[round.tactic]} · 중심이 무너졌다!` : titles[round.tactic], detail: details[round.tactic] };
}
