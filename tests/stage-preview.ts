// A development-only visual fixture. Vite's production entry never imports it.
import Phaser from 'phaser';
import { ElectionScene, STAGE_WIDTH, STAGE_HEIGHT, type StageState } from '../src/game/ElectionScene';
import { CANDIDATE_COLORS, createDrama, frameAt, type ElectionEvent, type ElectionResult } from '../src/election';
import { STORY_CATALOG, type StoryKind } from '../src/storyCatalog';
import { countProgress, elapsedAtProgress, phaseFor, storyOutcome, SHOW_DURATION, WINNER_START } from '../src/show';

// Exercise the full 16-character input limit in the winner and both story labels.
const longNames: Record<number, string> = { 0: '가나다라마바사아자차카타파하다라', 2: '가나다라마바사아자차카타파하가나', 6: 'WWWWWWWWWWWWWWWW' };
const candidates = CANDIDATE_COLORS.map((color, index) => ({ id: String(index + 1), name: longNames[index] ?? `후보 ${index + 1}`, color }));
const host = document.querySelector<HTMLDivElement>('#stage')!;
let game: Phaser.Game | undefined;
type PreviewKind = StoryKind | 'winner' | 'voting' | 'counting' | 'finale' | 'last-run';
let selectedKind: PreviewKind = 'brawl';

function preview(kind: PreviewKind, freezeAt?: number, captureAt?: number) {
  selectedKind = kind;
  document.querySelector('#status')!.textContent = '재생 중';
  game?.destroy(true);
  const template = STORY_CATALOG.find(story => story.kind === kind);
  const event: ElectionEvent | undefined = template ? { ...template, progress: 32, actors: kind === 'brawl' || kind === 'alliance' ? ['3', '7'] : ['3'], ...(kind === 'scandal' ? { eliminatedId: '3' } : {}) } : undefined;
  const shares = Object.fromEntries(candidates.map(candidate => [candidate.id, candidate.id === '3' && kind === 'scandal' ? 0 : candidate.id === '1' ? 11.12 : kind === 'scandal' ? 11.11 : 9.875]));
  const sum = Object.values(shares).reduce((total, share) => total + share, 0);
  const totalVotes = 4_000_000;
  const votes = Object.fromEntries(candidates.map(candidate => [candidate.id, Math.round(shares[candidate.id] / sum * totalVotes)]));
  votes['1'] += totalVotes - Object.values(votes).reduce((total, count) => total + count, 0);
  const percentages = Object.fromEntries(candidates.map(candidate => [candidate.id, votes[candidate.id] / totalVotes * 100]));
  const result: ElectionResult = { candidates, winnerId: '1', totalVotes, votes, percentages, events: event ? [event] : [], eliminatedIds: kind === 'scandal' ? ['3'] : [] };
  const drama = createDrama(result);
  const startAt = captureAt ?? (kind === 'voting' ? 5000 : kind === 'counting' ? 14_000 : kind === 'winner' ? WINNER_START : kind === 'last-run' ? WINNER_START - 6000 : kind === 'finale' ? WINNER_START - 1200 : elapsedAtProgress(32));
  const initialProgress = kind === 'voting' ? 0 : countProgress(startAt);
  const initial = frameAt(drama, initialProgress);
  const state: StageState = { phase: kind === 'voting' ? 'voting' : kind === 'winner' ? 'winner' : 'counting', candidates, winnerId: '1', topic: '오늘 커피 쏠 사람은?', percentages: kind === 'winner' || kind === 'voting' ? percentages : initial.percentages, finalPercentages: percentages, finalVotes: result.votes, finishStartPercentages: frameAt(drama, countProgress(WINNER_START - 4000)).percentages, progress: initialProgress, totalVotes: result.totalVotes, preview: false, reducedMotion: false, elapsed: startAt, events: result.events, storyOutcomes: event ? [storyOutcome(result, event, drama)] : [] };
  class PreviewScene extends ElectionScene {
    private began: number | undefined;
    private shownStatus = '';
    override update(time: number, delta: number) {
      this.began ??= time;
      const age = freezeAt === undefined ? time - this.began : Math.min(freezeAt, time - this.began);
      state.elapsed = Math.min(SHOW_DURATION, captureAt ?? startAt + age);
      if (kind === 'finale' || kind === 'last-run') state.phase = phaseFor(state.elapsed);
      state.progress = kind === 'voting' ? 0 : countProgress(state.elapsed);
      state.percentages = kind === 'voting' || state.phase === 'winner' ? percentages : frameAt(drama, state.progress).percentages;
      // Keep the scene's animation clock running after the election clock reaches its end.
      super.update(time, delta);
      if (kind === 'winner' || kind === 'finale' || kind === 'last-run') {
        const status = state.phase === 'counting' ? '마지막 개표 재생 중' : state.elapsed >= SHOW_DURATION ? '당선 완료 · 애니메이션 계속 재생 중' : '당선 연출 재생 중';
        if (status !== this.shownStatus) {
          this.shownStatus = status;
          document.querySelector('#status')!.textContent = status;
        }
      }
      if (freezeAt !== undefined && age >= freezeAt) {
        this.scene.pause();
        document.querySelector('#status')!.textContent = captureAt !== undefined ? `마지막 개표 ${captureAt / 1000}초 장면 정지됨` : `${kind === 'voting' ? '투표소' : kind === 'winner' ? '당선' : kind === 'finale' || kind === 'last-run' ? '마지막 개표 → 당선' : '사건'} ${age / 1000}초 장면 정지됨`;
      }
    }
  }
  const scene = new PreviewScene(() => state);
  game = new Phaser.Game({ type: Phaser.CANVAS, parent: host, width: STAGE_WIDTH, height: STAGE_HEIGHT, pixelArt: true, antialias: false, banner: false, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [scene] });
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
}
document.querySelectorAll<HTMLButtonElement>('button[data-kind]').forEach(button => button.addEventListener('click', () => preview(button.dataset.kind as PreviewKind)));
document.querySelectorAll<HTMLButtonElement>('button[data-freeze]').forEach(button => button.addEventListener('click', () => preview(selectedKind, Number(button.dataset.freeze))));
document.querySelectorAll<HTMLButtonElement>('button[data-capture]').forEach(button => button.addEventListener('click', () => preview('last-run', 800, Number(button.dataset.capture))));
new ResizeObserver(() => game?.scale.refresh()).observe(host);
preview('brawl');
