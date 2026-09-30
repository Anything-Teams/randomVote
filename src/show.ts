import type { DramaFrame, ElectionResult } from './election';

export type ShowPhase = 'declaration' | 'voting' | 'counting' | 'winner';
export const SHOW_DURATION = 30_000;
export const COUNT_START = 9_000;
export const WINNER_START = 26_000;

export function phaseFor(elapsed: number): ShowPhase {
  return elapsed < 5_000 ? 'declaration' : elapsed < COUNT_START ? 'voting' : elapsed < WINNER_START ? 'counting' : 'winner';
}

// Each district is counted in a burst, followed by time to read the new standings.
// The final box remains sealed until the last 2.5 seconds of the count.
const countClock = [[0, 0], [2_200, 32], [5_000, 32], [7_200, 68],
  [14_500, 68], [15_800, 92], [17_000, 100]];

export function countProgress(elapsed: number): number {
  const local = elapsed - COUNT_START;
  if (local <= 0) return 0;
  if (local >= WINNER_START - COUNT_START) return 100;
  const nextIndex = countClock.findIndex(([time]) => time >= local);
  const [previousTime, previousProgress] = countClock[nextIndex - 1];
  const [nextTime, nextProgress] = countClock[nextIndex];
  return previousProgress + (nextProgress - previousProgress) * (local - previousTime) / (nextTime - previousTime);
}

/** The ranking board moves once after each box, rather than following every vote. */
export function settledProgress(elapsed: number): number {
  const local = elapsed - COUNT_START;
  return local < 2_200 ? 0 : local < 7_200 ? 32 : local < 17_000 ? 68 : 100;
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
  if (local < 2_200) return { id: 'first', box: 1, state: 'opening', label: '첫 번째 투표함', location: '중앙광장', detail: '첫 투표함을 열고 초반 판세를 확인합니다.' };
  if (local < 5_000) return { id: 'first', box: 1, state: 'settled', label: '첫 번째 투표함 집계 완료', location: '중앙광장', detail: '초반 선두를 확인하세요. 다음 지역의 표가 곧 도착합니다.' };
  if (local < 7_200) return { id: 'second', box: 2, state: 'opening', label: '두 번째 투표함', location: '강변마을', detail: '강변마을의 표가 도착했습니다. 추격 후보를 지켜보세요.' };
  if (local < 11_000) return { id: 'second', box: 2, state: 'settled', label: '두 번째 투표함 집계 완료', location: '강변마을', detail: '순위가 새로 정리됐습니다. 승부를 가를 마지막 투표함이 남았습니다.' };
  if (local < 14_500) return {
    id: 'last', box: 3, state: 'sealed', label: '마지막 투표함 도착', location: '언덕동',
    detail: '봉인된 마지막 투표함. 이 안의 표가 오늘의 주인공을 결정합니다.',
    secondsUntilReveal: Math.max(1, Math.ceil((14_500 - local) / 1_000)),
  };
  return { id: 'last', box: 3, state: 'revealing', label: '마지막 투표함 개봉', location: '언덕동', detail: '봉인을 풀었습니다. 마지막 한 표까지 확인합니다.' };
}

export type NewsBeat = { id: string; tag: string; title: string; detail: string; urgent: boolean };

export function newsBeat(phase: ShowPhase, result: ElectionResult, frame: DramaFrame, elapsed?: number): NewsBeat {
  const sorted = [...result.candidates].sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]);
  const leader = sorted[0];
  const runner = sorted[1];
  const gap = Math.abs(frame.percentages[leader.id] - frame.percentages[runner.id]);
  if (phase === 'declaration') return { id: 'paper', tag: '호외', title: `${result.candidates.length}명의 후보, 전격 출마!`, detail: '사소한 결정 하나에 전국이 들썩이고 있습니다.', urgent: false };
  if (phase === 'voting') return { id: 'vote', tag: '현장', title: '전국 투표소에 이어지는 행렬', detail: '운명의 한 표가 투표함에 쌓이고 있습니다.', urgent: false };
  if (phase === 'winner') {
    const winner = result.candidates.find(candidate => candidate.id === result.winnerId)!;
    return { id: 'elected', tag: '당선 확정', title: `${winner.name}, 오늘의 주인공으로 당선!`, detail: '국민의 선택을 받아 공약 이행에 나섭니다.', urgent: false };
  }
  // The optional clock preserves the old call signature for previews while
  // letting the live show distinguish a held tally from an unopened box.
  const storyTime = elapsed ?? COUNT_START + (frame.progress < 32 ? 1_000 : frame.progress < 68 ? 6_000 : frame.progress < 92 ? 12_000 : 16_000);
  const beat = countBeat(storyTime);
  if (beat.id === 'first' && beat.state === 'opening') return { id: 'first-opening', tag: '첫 투표함', title: '중앙광장 투표함이 열렸습니다', detail: '첫 번째 지역의 표를 확인합니다. 누구의 이름이 먼저 나올까요?', urgent: false };
  if (beat.id === 'first') return { id: 'first-settled', tag: '초반 판세', title: `${leader.name} 후보, 첫 집계 선두`, detail: `${runner.name} 후보와 ${gap.toFixed(1)}%p 차이. 아직 두 개의 투표함이 남았습니다.`, urgent: false };
  if (beat.id === 'second' && beat.state === 'opening') return { id: 'second-opening', tag: '추격의 시간', title: '강변마을의 표가 도착했습니다', detail: '중하위권 후보에게도 기회가 있습니다. 다음 집계를 지켜보세요.', urgent: false };
  if (beat.id === 'second') return { id: 'second-settled', tag: '새로운 판세', title: `${leader.name} 후보가 앞서고 있습니다`, detail: `${runner.name} 후보와 ${gap.toFixed(1)}%p 차이. 이제 마지막 투표함 하나.`, urgent: false };
  if (beat.state === 'sealed') return { id: 'last-sealed', tag: '마지막 투표함', title: '아직 누구도 안심할 수 없습니다', detail: '언덕동 투표함의 봉인을 곧 해제합니다. 여러분의 후보를 지켜보세요.', urgent: true };
  return { id: 'last-revealing', tag: '최종 집계', title: '마지막 투표함의 봉인이 풀렸습니다', detail: '마지막 표가 들어옵니다. 오늘의 주인공이 곧 결정됩니다.', urgent: true };
}

export function winnerPromise(topic: string): string {
  if (topic.includes('커피')) return '시민들의 선택을 받아 오늘의 커피를 책임집니다.';
  if (topic.includes('점심')) return '오늘의 점심을 책임질 영광스러운 임무를 받았습니다.';
  if (topic.includes('청소')) return '깨끗한 미래를 위한 공약 이행에 나섭니다.';
  if (topic.includes('벌칙')) return '온 국민이 지켜보는 가운데 벌칙을 수행합니다.';
  if (topic.includes('발표')) return '이제 당당하게 마이크 앞으로 나섭니다.';
  return '시민들의 선택을 받아 오늘의 임무를 수행합니다.';
}
