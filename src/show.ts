import { frameAt, type Candidate, type DramaFrame, type ElectionEvent, type ElectionResult } from './election';

export type ShowPhase = 'declaration' | 'voting' | 'counting' | 'winner';
export const SHOW_DURATION = 58_000;
export const COUNT_START = 9_000;
export const WINNER_START = 52_000;
export const STORY_DURATION = 8_400;
export const STORY_RESOLVE_AT = 4_600;

export function phaseFor(elapsed: number): ShowPhase {
  return elapsed < 5_000 ? 'declaration' : elapsed < COUNT_START ? 'voting' : elapsed < WINNER_START ? 'counting' : 'winner';
}

// Each incident pauses the tally until its verdict. The following 3.8 seconds
// visibly apply that incident's result while the aftermath remains on screen.
const countClock = [[0, 0], [3_200, 28], [3_800, 28], [4_500, 32],
  [9_100, 32], [12_900, 45], [15_900, 58], [20_500, 58], [24_300, 62],
  [27_300, 78], [31_900, 78], [35_700, 82], [37_600, 90], [39_000, 90], [43_000, 100]];

export function countProgress(elapsed: number): number {
  const local = elapsed - COUNT_START;
  if (local <= 0) return 0;
  if (local >= WINNER_START - COUNT_START) return 100;
  const nextIndex = countClock.findIndex(([time]) => time >= local);
  const [previousTime, previousProgress] = countClock[nextIndex - 1];
  const [nextTime, nextProgress] = countClock[nextIndex];
  return previousProgress + (nextProgress - previousProgress) * (local - previousTime) / (nextTime - previousTime);
}

/** First arrival time of a progress value, including the start of any hold. */
export function elapsedAtProgress(progress: number): number {
  const bounded = Math.max(0, Math.min(100, progress));
  if (bounded === 0) return COUNT_START;
  const nextIndex = countClock.findIndex(([, value]) => value >= bounded);
  const [nextTime, nextValue] = countClock[nextIndex];
  const [previousTime, previousValue] = countClock[nextIndex - 1];
  return COUNT_START + previousTime + (bounded - previousValue) / (nextValue - previousValue) * (nextTime - previousTime);
}

export type StoryStage = 'announcement' | 'action' | 'verdict' | 'aftermath';
export type StoryBeat = { event: ElectionEvent; index: number; age: number; stage: StoryStage };

export function storyBeat(events: ElectionEvent[], elapsed: number): StoryBeat | undefined {
  const index = events.findIndex(event => {
    const age = elapsed - elapsedAtProgress(event.progress);
    return age >= 0 && age < STORY_DURATION;
  });
  if (index < 0) return undefined;
  const event = events[index];
  const age = elapsed - elapsedAtProgress(event.progress);
  const stage: StoryStage = age < 1_400 ? 'announcement' : age < STORY_RESOLVE_AT ? 'action' : age < 6_400 ? 'verdict' : 'aftermath';
  return { event, index: index + 1, age, stage };
}

export function resolvedEvents(events: ElectionEvent[], elapsed: number): ElectionEvent[] {
  return events.filter(event => elapsed >= elapsedAtProgress(event.progress) + STORY_RESOLVE_AT);
}

export type StoryActorOutcome = {
  id: string;
  name: string;
  color: string;
  beforeRank: number;
  afterRank: number | null;
  label: string;
};
export type StoryOutcome = { eventId: string; title: string; summary: string; actors: StoryActorOutcome[] };

export function storyOutcome(result: ElectionResult, event: ElectionEvent, frames: DramaFrame[]): StoryOutcome {
  const before = frameAt(frames, event.progress);
  const after = frameAt(frames, event.progress <= 32 ? 45 : event.progress <= 58 ? 62 : 82);
  const rank = (frame: DramaFrame, id: string) => {
    const order = [...result.candidates].filter(candidate => frame.percentages[candidate.id] > 0)
      .sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]);
    const index = order.findIndex(candidate => candidate.id === id);
    return index < 0 ? null : index + 1;
  };
  const actors: StoryActorOutcome[] = event.actors.flatMap(id => {
    const candidate = result.candidates.find(item => item.id === id);
    if (!candidate) return [];
    const beforeRank = rank(before, id) ?? 0;
    const afterRank = rank(after, id);
    const label = afterRank === null ? '후보 탈락' : beforeRank === afterRank ? `${afterRank}위 유지` : `${beforeRank}위 → ${afterRank}위`;
    return [{ ...candidate, beforeRank, afterRank, label }];
  });
  const names = actors.map(actor => actor.name).join(' · ');
  const changes = actors.map(actor => `${actor.name} ${actor.label}`).join(' · ');
  const headings = { brawl: '대결 판정', scandal: '후보 탈락', comeback: '추격 결과', mishap: '실수 판정', alliance: '연대 결과', blackout: '정전 후 판세' };
  const title = `${names} ${headings[event.kind]}`;
  const summary = event.eliminatedId ? `${changes}. 남은 후보들의 집계가 이어집니다.` : `${changes}. ${event.kind === 'mishap' || event.kind === 'blackout' ? '후보 자격은 유지됩니다.' : '이 결과가 실시간 판세에 반영됩니다.'}`;
  return { eventId: event.id, title, summary, actors };
}

export type CountingBeat = {
  id: 'first' | 'second' | 'last';
  box: 1 | 2 | 3;
  state: 'opening' | 'settled' | 'sealed' | 'revealing';
  label: string;
  location: string;
  detail: string;
  secondsUntilReveal?: number;
};

export function countBeat(elapsed: number): CountingBeat {
  const local = elapsed - COUNT_START;
  if (local < 3_200) return { id: 'first', box: 1, state: 'opening', label: '첫 번째 투표함', location: '중앙광장', detail: '첫 지역의 표가 들어옵니다. 실시간 득표율을 지켜보세요.' };
  if (local < 3_800) return { id: 'first', box: 1, state: 'settled', label: '첫 번째 투표함 집계 완료', location: '중앙광장', detail: '초반 집계가 끝났습니다. 강변마을의 표가 곧 들어옵니다.' };
  if (local < 12_900) return { id: 'second', box: 2, state: 'opening', label: '두 번째 투표함', location: '강변마을', detail: '강변마을의 표와 후보들의 소식이 함께 들어옵니다.' };
  if (local < 37_600) return { id: 'second', box: 2, state: 'settled', label: '사건이 바꾼 판세', location: '강변마을', detail: '사건의 판정과 새로운 표가 실시간 득표율에 반영됩니다.' };
  if (local < 39_000) return {
    id: 'last', box: 3, state: 'sealed', label: '마지막 투표함 도착', location: '언덕동',
    detail: '봉인된 마지막 투표함. 이 안의 표가 오늘의 주인공을 결정합니다.',
    secondsUntilReveal: Math.max(1, Math.ceil((39_000 - local) / 1_000)),
  };
  return { id: 'last', box: 3, state: 'revealing', label: '마지막 투표함 개봉', location: '언덕동', detail: '봉인을 풀었습니다. 마지막 한 표까지 확인합니다.' };
}

export type NewsBeat = { id: string; tag: string; title: string; detail: string; urgent: boolean };

export type FinalResultGap = {
  winner: Candidate;
  runner: Candidate;
  gapVotes: number;
  winnerVotes: number;
  runnerVotes: number;
};

/** Shared integer tally for the DOM board and the canvas broadcast. */
export function tallyVotes(candidateId: string, percentages: Record<string, number>, progress: number, totalVotes: number, finalVotes?: Record<string, number>): number {
  const bounded = Math.max(0, Math.min(100, progress));
  if (bounded === 0) return 0;
  if (bounded === 100 && finalVotes?.[candidateId] !== undefined) return finalVotes[candidateId];
  const countedVotes = Math.floor(totalVotes * bounded / 100);
  return Math.round(countedVotes * Math.max(0, percentages[candidateId] ?? 0) / 100);
}

/** Final results use the recorded integer votes, never rounded percentages. */
export function finalResultGap(result: ElectionResult): FinalResultGap {
  const winner = result.candidates.find(candidate => candidate.id === result.winnerId)!;
  const runner = [...result.candidates].filter(candidate => candidate.id !== winner.id)
    .sort((a, b) => result.votes[b.id] - result.votes[a.id])[0];
  const winnerVotes = result.votes[winner.id];
  const runnerVotes = result.votes[runner.id];
  return { winner, runner, gapVotes: winnerVotes - runnerVotes, winnerVotes, runnerVotes };
}

export type RaceMoment = {
  leader: Candidate;
  runner: Candidate;
  third?: Candidate;
  gapPoints: number;
  gapVotes: number;
  countedVotes: number;
  close: boolean;
  narrowing: boolean;
  leaderChanged: boolean;
  climber?: Candidate;
  placesGained: number;
};

export function raceMoment(result: ElectionResult, frame: DramaFrame, previousFrame?: DramaFrame): RaceMoment {
  const sorted = [...result.candidates].filter(candidate => frame.percentages[candidate.id] > 0)
    .sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]);
  const [leader, runner, third] = sorted;
  const countedVotes = Math.floor(result.totalVotes * frame.progress / 100);
  const gapPoints = Math.max(0, frame.percentages[leader.id] - frame.percentages[runner.id]);
  const gapVotes = frame.progress >= 100 ? result.votes[leader.id] - result.votes[runner.id]
    : Math.max(0, Math.round(countedVotes * gapPoints / 100));
  const previous = previousFrame ? [...result.candidates].filter(candidate => previousFrame.percentages[candidate.id] > 0)
    .sort((a, b) => previousFrame.percentages[b.id] - previousFrame.percentages[a.id]) : [];
  let climber: Candidate | undefined;
  let placesGained = 0;
  sorted.forEach((candidate, rank) => {
    const oldRank = previous.findIndex(item => item.id === candidate.id);
    const gain = oldRank - rank;
    if (oldRank >= 0 && gain > placesGained) { climber = candidate; placesGained = gain; }
  });
  const previousGap = previousFrame && previous.length > 1 ? previousFrame.percentages[previous[0].id] - previousFrame.percentages[previous[1].id] : gapPoints;
  return { leader, runner, third, gapPoints, gapVotes, countedVotes, close: gapPoints <= 0.12,
    narrowing: gapPoints < previousGap, leaderChanged: previous.length > 0 && previous[0].id !== leader.id, climber, placesGained };
}

export function newsBeat(phase: ShowPhase, result: ElectionResult, frame: DramaFrame, elapsed?: number): NewsBeat {
  const { leader, runner, third, gapVotes, close } = raceMoment(result, frame);
  if (phase === 'declaration') return { id: 'paper', tag: '호외', title: `${result.candidates.length}명의 후보, 전격 출마!`, detail: '사소한 결정 하나에 전국이 들썩이고 있습니다.', urgent: false };
  if (phase === 'voting') return { id: 'vote', tag: '현장', title: '전국 투표소에 이어지는 행렬', detail: '운명의 한 표가 투표함에 쌓이고 있습니다.', urgent: false };
  if (phase === 'winner') {
    const winner = result.candidates.find(candidate => candidate.id === result.winnerId)!;
    return { id: 'elected', tag: '당선 확정', title: `${winner.name}, 오늘의 주인공으로 당선!`, detail: '국민의 선택을 받아 공약 이행에 나섭니다.', urgent: false };
  }
  // The optional clock preserves the old call signature for previews while
  // letting the live show distinguish a held tally from an unopened box.
  const storyTime = elapsed ?? elapsedAtProgress(frame.progress);
  const beat = countBeat(storyTime);
  const gapText = new Intl.NumberFormat('ko-KR').format(gapVotes);
  if (beat.id === 'first') return { id: 'first-box', tag: '초반 판세', title: `${leader.name} 후보 선두 · ${runner.name} 후보 뒤쫓는 중`, detail: `현재 ${gapText}표 차이. ${beat.state === 'settled' ? '첫 집계 완료, 다음 지역의 표를 기다립니다.' : '첫 지역의 집계가 계속됩니다.'}`, urgent: false };
  if (beat.id === 'second' && beat.state === 'opening') return { id: 'second-box', tag: '판세 변화', title: `${leader.name} · ${runner.name}, ${gapText}표 차이`, detail: '표가 들어올 때마다 후보들의 표정이 달라지고 있습니다.', urgent: close };
  if (beat.id === 'second') return { id: 'tight-race', tag: close ? '초접전' : '후속 집계', title: `${leader.name} · ${runner.name}${third ? ` · ${third.name}` : ''}, 마지막까지 접전`, detail: `선두 격차 ${gapText}표. 마지막 투표함에 승부가 걸렸습니다.`, urgent: close };
  if (beat.state === 'sealed') return { id: 'last-sealed', tag: '마지막 투표함', title: '아직 누구도 안심할 수 없습니다', detail: '언덕동 투표함의 봉인을 곧 해제합니다. 여러분의 후보를 지켜보세요.', urgent: true };
  return { id: 'last-revealing', tag: '최종 집계', title: `${leader.name} · ${runner.name}, 단 ${gapText}표 차이`, detail: '마지막 표가 들어옵니다. 오늘의 주인공이 곧 결정됩니다.', urgent: true };
}

export function winnerPromise(topic: string): string {
  if (topic.includes('커피')) return '시민들의 선택을 받아 오늘의 커피를 책임집니다.';
  if (topic.includes('점심')) return '오늘의 점심을 책임질 영광스러운 임무를 받았습니다.';
  if (topic.includes('청소')) return '깨끗한 미래를 위한 공약 이행에 나섭니다.';
  if (topic.includes('벌칙')) return '온 국민이 지켜보는 가운데 벌칙을 수행합니다.';
  if (topic.includes('발표')) return '이제 당당하게 마이크 앞으로 나섭니다.';
  return '시민들의 선택을 받아 오늘의 임무를 수행합니다.';
}
