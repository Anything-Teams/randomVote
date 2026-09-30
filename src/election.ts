import { STORY_CATALOG, type StoryKind } from './storyCatalog';

export type { StoryKind } from './storyCatalog';
export type Candidate = { id: string; name: string; color: string };
export type ElectionEvent = {
  id: string;
  progress: number;
  kind: StoryKind;
  actors: string[];
  title: string;
  detail: string;
  prop: string;
  eliminatedId?: string;
};
export type ElectionResult = {
  candidates: Candidate[];
  winnerId: string;
  totalVotes: number;
  votes: Record<string, number>;
  percentages: Record<string, number>;
  events: ElectionEvent[];
  eliminatedIds: string[];
};
export type DramaFrame = { progress: number; percentages: Record<string, number> };

export const MAX_CANDIDATES = 10;
export const CANDIDATE_COLORS = ['#ff7654', '#56c5c0', '#f5c665', '#a3a7ed', '#ee91bd', '#83bb76', '#e5a86a', '#80b6ed', '#c890e0', '#bed16e'];

function shuffle<T>(list: T[]): T[] {
  const shuffled = [...list];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const next = randomInt(index + 1);
    [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
  }
  return shuffled;
}

/** Rejection sampling keeps every candidate's chance equal, even when the length is not a power of two. */
export function randomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError('Invalid random range');
  }
  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % maxExclusive;
}

export function createElection(candidates: Candidate[]): ElectionResult {
  if (candidates.length < 2 || candidates.length > MAX_CANDIDATES) throw new RangeError('Candidates must number 2–10');
  const winnerIndex = randomInt(candidates.length);
  const winnerId = candidates[winnerIndex].id;
  const events: ElectionEvent[] = [];
  const usedTemplates = new Set<string>();
  let active = [...candidates];
  const ordinaryKinds: StoryKind[] = ['brawl', 'mishap', 'alliance', 'blackout', 'comeback'];
  function addEvent(progress: number, kind: StoryKind) {
    const templates = STORY_CATALOG.filter(template => template.kind === kind && !usedTemplates.has(template.id));
    const template = templates[randomInt(templates.length)];
    usedTemplates.add(template.id);
    let actors: string[];
    let eliminatedId: string | undefined;
    if (kind === 'scandal') {
      const removable = active.filter(candidate => candidate.id !== winnerId);
      eliminatedId = removable[randomInt(removable.length)].id;
      actors = [eliminatedId];
      active = active.filter(candidate => candidate.id !== eliminatedId);
    } else {
      const count = kind === 'brawl' || kind === 'alliance' ? 2 : 1;
      actors = shuffle(active).slice(0, count).map(candidate => candidate.id);
    }
    events.push({ ...template, progress, actors, ...(eliminatedId ? { eliminatedId } : {}) });
  }
  const firstKind = ordinaryKinds[randomInt(ordinaryKinds.length)];
  addEvent(32, firstKind);
  if (active.length >= 3 && randomInt(100) < 55) addEvent(58, 'scandal');
  else {
    const otherKinds = ordinaryKinds.filter(kind => kind !== firstKind);
    addEvent(58, otherKinds[randomInt(otherKinds.length)]);
  }
  if (candidates.length >= 4 && active.length > 2 && randomInt(100) < 25) addEvent(78, 'scandal');
  else addEvent(78, randomInt(2) === 0 ? 'comeback' : 'alliance');
  const eliminatedIds = events.flatMap(event => event.eliminatedId ? [event.eliminatedId] : []);
  const weights = Object.fromEntries(active.map(candidate => [candidate.id, 10_000 + randomInt(201)]));
  // The close final tally is presentation data; the first unbiased draw above
  // remains the sole decision of who wins, including runs with withdrawals.
  weights[winnerId] = Math.max(...active.filter(candidate => candidate.id !== winnerId).map(candidate => weights[candidate.id])) + 1 + randomInt(3);
  const totalVotes = 1_200_000 + randomInt(8_800_001);
  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const votes: Record<string, number> = Object.fromEntries(candidates.map(candidate => [candidate.id, 0]));
  let allocated = 0;
  active.forEach(candidate => {
    const count = Math.floor((weights[candidate.id] / weightTotal) * totalVotes);
    votes[candidate.id] = count;
    allocated += count;
  });
  votes[winnerId] += totalVotes - allocated;
  const percentages = Object.fromEntries(candidates.map(candidate => [candidate.id, (votes[candidate.id] / totalVotes) * 100]));
  return { candidates, winnerId, totalVotes, votes, percentages, events, eliminatedIds };
}

/** Presentation frames are calculated only after the unbiased winner has been chosen. */
export function createDrama(result: ElectionResult): DramaFrame[] {
  const { candidates, winnerId, percentages, events } = result;
  const promote = (order: Candidate[], ids: string[]) => [
    ...ids.flatMap(id => { const candidate = order.find(item => item.id === id); return candidate ? [candidate] : []; }),
    ...order.filter(candidate => !ids.includes(candidate.id)),
  ];
  const frame = (progress: number, order: Candidate[], spread: number, tight = false): DramaFrame => {
    const average = 100 / order.length;
    const step = spread / (tight ? Math.min(2, order.length - 1) : order.length - 1);
    const values = Object.fromEntries(candidates.map(candidate => [candidate.id, 0]));
    order.forEach((candidate, rank) => { values[candidate.id] = average + ((order.length - 1) / 2 - rank) * step; });
    return { progress, percentages: values };
  };
  const applyEvent = (order: Candidate[], event: ElectionEvent | undefined, last: boolean): Candidate[] => {
    if (!event) return order;
    const previousLeader = order[0].id;
    let next: Candidate[];
    if (event.eliminatedId) next = order.filter(candidate => candidate.id !== event.eliminatedId);
    else if (event.kind === 'brawl') {
      const loser = order.find(candidate => candidate.id === event.actors[0]);
      next = promote(order.filter(candidate => candidate.id !== loser?.id), [event.actors[1]]);
      if (loser) next.push(loser);
    } else if (event.kind === 'mishap' || event.kind === 'blackout') {
      const affected = order.find(candidate => candidate.id === event.actors[0]);
      next = order.filter(candidate => candidate.id !== affected?.id);
      if (affected) next.push(affected);
    } else next = promote(order, event.kind === 'alliance' ? event.actors : [event.actors[0]]);
    // Avoid revealing the final choice through a new winner lead in the third
    // scene. The comeback can still bring that candidate up into second place.
    if (last && next[0].id === winnerId && previousLeader !== winnerId) {
      const rival = next.find(candidate => candidate.id !== winnerId)!;
      next = promote(next, [rival.id, winnerId]);
    }
    return next;
  };
  let order = shuffle(candidates);
  const firstEvent = events.find(event => event.progress === 32);
  if (firstEvent && ['brawl', 'mishap', 'blackout'].includes(firstEvent.kind)) order = promote(order, [firstEvent.actors[0]]);
  else if (firstEvent && order[0].id === firstEvent.actors[0]) order = [...order.slice(1), order[0]];
  const frames: DramaFrame[] = [frame(0, order, 1.8), frame(12, order, 1.65), frame(28, order, 1.45), frame(32, order, 1.4)];
  order = applyEvent(order, firstEvent, false);
  frames.push(frame(45, order, 1.2), frame(58, order, 0.95));
  order = applyEvent(order, events.find(event => event.progress === 58), false);
  frames.push(frame(62, order, 0.85), frame(64, order, 0.78), frame(78, order, 0.65));
  order = applyEvent(order, events.find(event => event.progress === 78), true);
  frames.push(frame(82, order, 0.48));
  if (order[0].id === winnerId) {
    const rivals = order.filter(candidate => candidate.id !== winnerId);
    order = promote(order, [rivals[randomInt(rivals.length)].id]);
  }
  // Keep the same three contenders together through the last few percent.
  const other = order.find(candidate => candidate.id !== order[0].id && candidate.id !== winnerId);
  order = promote(order, [order[0].id, ...(other ? [other.id] : []), winnerId]);
  frames.push(frame(90, order, 0.08, true), frame(95, order, 0.04, true));
  order = promote(order, [winnerId]);
  frames.push(frame(96, order, 0.08, true), frame(98, order, 0.06, true),
    { progress: 99.2, percentages: { ...percentages } }, { progress: 100, percentages: { ...percentages } });
  return frames;
}

export function frameAt(frames: DramaFrame[], progress: number): DramaFrame {
  const bounded = Math.max(0, Math.min(100, progress));
  const nextIndex = frames.findIndex(frame => frame.progress >= bounded);
  if (nextIndex <= 0) return frames[0];
  const previous = frames[nextIndex - 1];
  const next = frames[nextIndex];
  if (bounded === next.progress) return next;
  const rawFraction = (bounded - previous.progress) / (next.progress - previous.progress);
  const fraction = rawFraction * rawFraction * (3 - 2 * rawFraction);
  const ids = Object.keys(next.percentages);
  const values = Object.fromEntries(ids.map(id => [id, previous.percentages[id] + (next.percentages[id] - previous.percentages[id]) * fraction]));
  const oldLeader = ids.reduce((leader, id) => previous.percentages[id] > previous.percentages[leader] ? id : leader);
  const newLeader = ids.reduce((leader, id) => next.percentages[id] > next.percentages[leader] ? id : leader);
  if (oldLeader !== newLeader) {
    const outsiders = ids.filter(id => id !== oldLeader && id !== newLeader);
    const outsiderMax = Math.max(0, ...outsiders.map(id => values[id]));
    const pairMax = Math.max(values[oldLeader], values[newLeader]);
    if (outsiderMax > pairMax) {
      // A story beat has one visible takeover; other ranks can rise and fall
      // without an accidental chain of momentary leaders during interpolation.
      const transfer = outsiderMax - pairMax + 0.000001;
      const pool = outsiders.reduce((sum, id) => sum + values[id], 0);
      values[newLeader] += transfer;
      values[oldLeader] += transfer;
      outsiders.forEach(id => { values[id] *= (pool - transfer * 2) / pool; });
    }
  }
  return { progress: bounded, percentages: values };
}
