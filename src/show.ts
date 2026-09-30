import type { DramaFrame, ElectionResult } from './election';

export type ShowPhase = 'declaration' | 'voting' | 'counting' | 'winner';
export const SHOW_DURATION = 28_000;
export const COUNT_START = 10_500;
export const WINNER_START = 23_500;

export function phaseFor(elapsed: number): ShowPhase {
  return elapsed < 6_000 ? 'declaration' : elapsed < COUNT_START ? 'voting' : elapsed < WINNER_START ? 'counting' : 'winner';
}

// The last ballot box gets a deliberate pause before the final surge.
const countClock = [[0, 0], [1_300, 10], [3_000, 25], [4_600, 40], [5_600, 49],
  [6_700, 58], [7_800, 68], [8_900, 78], [10_000, 86], [10_800, 93],
  [11_800, 93.6], [12_250, 96], [13_000, 100]];

export function countProgress(elapsed: number): number {
  const local = elapsed - COUNT_START;
  if (local <= 0) return 0;
  if (local >= 13_000) return 100;
  const nextIndex = countClock.findIndex(([time]) => time >= local);
  const [previousTime, previousProgress] = countClock[nextIndex - 1];
  const [nextTime, nextProgress] = countClock[nextIndex];
  return previousProgress + (nextProgress - previousProgress) * (local - previousTime) / (nextTime - previousTime);
}

export type NewsBeat = { id: string; tag: string; title: string; detail: string; urgent: boolean };

export function newsBeat(phase: ShowPhase, result: ElectionResult, frame: DramaFrame): NewsBeat {
  const sorted = [...result.candidates].sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]);
  const leader = sorted[0];
  const runner = sorted[1];
  const gap = Math.abs(frame.percentages[leader.id] - frame.percentages[runner.id]);
  const p = frame.progress;
  if (phase === 'declaration') return { id: 'paper', tag: '호외', title: `${result.candidates.length}명의 후보, 전격 출마!`, detail: '사소한 결정 하나에 전국이 들썩이고 있습니다.', urgent: false };
  if (phase === 'voting') return { id: 'vote', tag: '현장', title: '전국 투표소에 이어지는 행렬', detail: '운명의 한 표가 투표함에 쌓이고 있습니다.', urgent: false };
  if (phase === 'winner') {
    const winner = result.candidates.find(candidate => candidate.id === result.winnerId)!;
    return { id: 'elected', tag: '당선 확정', title: `${winner.name}, 오늘의 주인공으로 당선!`, detail: '국민의 선택을 받아 공약 이행에 나섭니다.', urgent: false };
  }
  if (p < 12) return { id: `early-${leader.id}`, tag: '개표 속보', title: `${leader.name} 후보, 초반 선두`, detail: '모든 후보가 접전입니다. 아직 승부는 알 수 없습니다.', urgent: false };
  if (p < 30) return { id: `chase-${leader.id}`, tag: '맹추격', title: `${leader.name} 후보, 치고 올라옵니다!`, detail: `${runner.name} 후보가 ${gap.toFixed(1)}%p 차이로 뒤쫓습니다.`, urgent: true };
  if (p < 55) return { id: `turn-${leader.id}`, tag: '판세 급변', title: `${leader.name} 후보, 새로운 선두!`, detail: '새 투표함이 열릴 때마다 순위가 뒤집힙니다.', urgent: true };
  if (p < 81) return { id: `close-${leader.id}`, tag: '초접전', title: `${leader.name} 후보 선두 · ${gap.toFixed(1)}%p 차이`, detail: '중하위권까지 맹추격! 누구도 안심할 수 없습니다.', urgent: true };
  if (p < 90) return { id: `last-${leader.id}`, tag: '막판 역전', title: `${leader.name} 후보, 마지막 승부수!`, detail: '이제 남은 투표함은 단 하나입니다.', urgent: true };
  if (p < 96) return { id: 'last-box', tag: '마지막 투표함', title: '모두가 숨을 죽인 순간…', detail: '마지막 표를 확인하고 있습니다. 당선자가 곧 결정됩니다.', urgent: true };
  return { id: 'final', tag: '당선 임박', title: '최종 개표 결과가 들어왔습니다', detail: '오늘의 당선자를 발표합니다!', urgent: true };
}

export function winnerPromise(topic: string): string {
  if (topic.includes('커피')) return '시민들의 선택을 받아 오늘의 커피를 책임집니다.';
  if (topic.includes('점심')) return '오늘의 점심을 책임질 영광스러운 임무를 받았습니다.';
  if (topic.includes('청소')) return '깨끗한 미래를 위한 공약 이행에 나섭니다.';
  if (topic.includes('벌칙')) return '온 국민이 지켜보는 가운데 벌칙을 수행합니다.';
  if (topic.includes('발표')) return '이제 당당하게 마이크 앞으로 나섭니다.';
  return '시민들의 선택을 받아 오늘의 임무를 수행합니다.';
}
