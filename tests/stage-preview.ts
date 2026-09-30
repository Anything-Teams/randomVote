// A development-only visual fixture. Vite's production entry never imports it.
import Phaser from 'phaser';
import { ElectionScene, STAGE_WIDTH, STAGE_HEIGHT, type StageState } from '../src/game/ElectionScene';
import { CANDIDATE_COLORS, createDrama, frameAt, type ElectionEvent, type ElectionResult } from '../src/election';
import { STORY_CATALOG, type StoryKind } from '../src/storyCatalog';

// Exercise the full 16-character input limit in the winner and both story labels.
const longNames: Record<number, string> = { 0: '가나다라마바사아자차카타파하다라', 2: '가나다라마바사아자차카타파하가나', 6: 'WWWWWWWWWWWWWWWW' };
const candidates = CANDIDATE_COLORS.map((color, index) => ({ id: String(index + 1), name: longNames[index] ?? `후보 ${index + 1}`, color }));
const host = document.querySelector<HTMLDivElement>('#stage')!;
let game: Phaser.Game | undefined;
let selectedKind: StoryKind | 'winner' = 'brawl';

function preview(kind: StoryKind | 'winner', freeze = false) {
  selectedKind = kind;
  document.querySelector('#status')!.textContent = '재생 중';
  game?.destroy(true);
  const template = STORY_CATALOG.find(story => story.kind === kind);
  const event: ElectionEvent | undefined = template ? { ...template, progress: 32, actors: kind === 'brawl' || kind === 'alliance' ? ['3', '7'] : ['3'], ...(kind === 'scandal' ? { eliminatedId: '3' } : {}) } : undefined;
  const shares = Object.fromEntries(candidates.map(candidate => [candidate.id, candidate.id === '3' && kind === 'scandal' ? 0 : candidate.id === '1' ? 11.12 : kind === 'scandal' ? 11.11 : 9.875]));
  const sum = Object.values(shares).reduce((total, share) => total + share, 0);
  const percentages = Object.fromEntries(candidates.map(candidate => [candidate.id, shares[candidate.id] / sum * 100]));
  const result: ElectionResult = { candidates, winnerId: '1', totalVotes: 4_000_000, votes: Object.fromEntries(candidates.map(candidate => [candidate.id, Math.round(percentages[candidate.id] * 40_000)])), percentages, events: event ? [event] : [], eliminatedIds: kind === 'scandal' ? ['3'] : [] };
  const drama = createDrama(result);
  const initial = frameAt(drama, 32);
  const state: StageState = { phase: kind === 'winner' ? 'winner' : 'counting', candidates, winnerId: '1', topic: '오늘 커피 쏠 사람은?', percentages: initial.percentages, finalPercentages: percentages, progress: 32, totalVotes: result.totalVotes, preview: false, reducedMotion: false, elapsed: 14_000, cheeringId: '3', events: result.events };
  class PreviewScene extends ElectionScene {
    override create() {
      super.create();
      let began: number | undefined;
      // Use the animation clock so a background tab cannot freeze an unfinished entrance.
      this.events.on(Phaser.Scenes.Events.UPDATE, (time: number) => {
        began ??= time;
        const age = time - began;
        state.progress = kind === 'winner' ? 100 : Math.min(45, 32 + age / 250);
        state.elapsed = kind === 'winner' ? 26_000 + age : 14_000 + age;
        state.percentages = kind === 'winner' ? percentages : frameAt(drama, state.progress).percentages;
      });
      if (freeze) this.time.delayedCall(kind === 'winner' ? 3100 : 1250, () => {
        this.scene.pause();
        document.querySelector('#status')!.textContent = '중간 장면 정지됨';
      });
    }
  }
  const scene = new PreviewScene(() => state);
  game = new Phaser.Game({ type: Phaser.CANVAS, parent: host, width: STAGE_WIDTH, height: STAGE_HEIGHT, pixelArt: true, antialias: false, banner: false, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [scene] });
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
}
document.querySelectorAll<HTMLButtonElement>('button[data-kind]').forEach(button => button.addEventListener('click', () => preview(button.dataset.kind as StoryKind | 'winner')));
document.querySelector('#freeze')!.addEventListener('click', () => preview(selectedKind, true));
new ResizeObserver(() => game?.scale.refresh()).observe(host);
preview('brawl');
