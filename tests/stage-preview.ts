// A development-only visual fixture. Vite's production entry never imports it.
import Phaser from 'phaser';
import { ElectionScene, STAGE_WIDTH, STAGE_HEIGHT, type StageState } from '../src/game/ElectionScene';
import { CANDIDATE_COLORS, createDrama, frameAt, type ElectionEvent, type ElectionResult } from '../src/election';
import { STORY_CATALOG, type StoryKind } from '../src/storyCatalog';

const candidates = CANDIDATE_COLORS.map((color, index) => ({ id: String(index + 1), name: `후보 ${index + 1}`, color }));
const host = document.querySelector<HTMLDivElement>('#stage')!;
let game: Phaser.Game | undefined;
let timer: number | undefined;
let freezeTimer: number | undefined;
let selectedKind: StoryKind | 'winner' = 'brawl';

function preview(kind: StoryKind | 'winner') {
  selectedKind = kind;
  if (timer) window.clearInterval(timer);
  if (freezeTimer) window.clearTimeout(freezeTimer);
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
  const began = performance.now();
  game = new Phaser.Game({ type: Phaser.CANVAS, parent: host, width: STAGE_WIDTH, height: STAGE_HEIGHT, pixelArt: true, antialias: false, banner: false, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [new ElectionScene(() => state)] });
  timer = window.setInterval(() => {
    const age = performance.now() - began;
    state.progress = kind === 'winner' ? 100 : Math.min(45, 32 + age / 250);
    state.elapsed = kind === 'winner' ? 26_000 + age : 14_000 + age;
    state.percentages = kind === 'winner' ? percentages : frameAt(drama, state.progress).percentages;
  }, 50);
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
}
document.querySelectorAll<HTMLButtonElement>('button[data-kind]').forEach(button => button.addEventListener('click', () => preview(button.dataset.kind as StoryKind | 'winner')));
document.querySelector('#freeze')!.addEventListener('click', () => {
  preview(selectedKind);
  freezeTimer = window.setTimeout(() => {
    if (timer) window.clearInterval(timer);
    game?.scene.pause('election-show');
    document.querySelector('#status')!.textContent = '중간 장면 정지됨';
  }, selectedKind === 'winner' ? 3100 : 1250);
});
new ResizeObserver(() => game?.scale.refresh()).observe(host);
preview('brawl');
