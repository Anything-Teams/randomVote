import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { ElectionScene, STAGE_HEIGHT, STAGE_WIDTH, type StageState } from './game/ElectionScene';
import type { Candidate, ElectionEvent } from './election';
import { SHOW_DURATION, type ShowPhase, type StoryOutcome } from './show';

type Props = {
  phase: ShowPhase;
  candidates: Candidate[];
  winnerId: string;
  topic: string;
  percentages?: Record<string, number>;
  finalPercentages?: Record<string, number>;
  finalVotes?: Record<string, number>;
  progress?: number;
  totalVotes?: number;
  preview?: boolean;
  runId?: number;
  reducedMotion?: boolean;
  elapsed?: number;
  cheeringId?: string;
  events?: ElectionEvent[];
  storyOutcomes?: StoryOutcome[];
  paused?: boolean;
};
const EMPTY_PERCENTAGES: Record<string, number> = {};
const EMPTY_EVENTS: ElectionEvent[] = [];
const EMPTY_OUTCOMES: StoryOutcome[] = [];

export default function GameStage({ phase, candidates, winnerId, topic, percentages = EMPTY_PERCENTAGES, finalPercentages = EMPTY_PERCENTAGES, finalVotes = EMPTY_PERCENTAGES, progress = 0, totalVotes = 0, preview = false, runId = 0, reducedMotion = false, elapsed = 0, cheeringId, events = EMPTY_EVENTS, storyOutcomes = EMPTY_OUTCOMES, paused = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sampledAt = useRef(performance.now());
  const state = useRef<StageState>({ phase, candidates, winnerId, topic, percentages, finalPercentages, finalVotes, progress, totalVotes, preview, reducedMotion, elapsed, cheeringId, events, storyOutcomes, paused });
  useEffect(() => {
    if (state.current.elapsed !== elapsed || state.current.paused !== paused) sampledAt.current = performance.now();
    state.current = { phase, candidates, winnerId, topic, percentages, finalPercentages, finalVotes, progress, totalVotes, preview, reducedMotion, elapsed, cheeringId, events, storyOutcomes, paused };
  }, [phase, candidates, winnerId, topic, percentages, finalPercentages, finalVotes, progress, totalVotes, preview, reducedMotion, elapsed, cheeringId, events, storyOutcomes, paused]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (paused) game.scene.pause('election-show');
    else game.scene.resume('election-show');
  }, [paused]);

  useEffect(() => {
    if (!host.current) return;
    let game: Phaser.Game | undefined;
    const resize = new ResizeObserver(() => game?.scale.refresh());
    const animationFrame = requestAnimationFrame(() => {
      if (!host.current) return;
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host.current,
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        backgroundColor: '#15213b',
        pixelArt: true,
        antialias: false,
        banner: false,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [new ElectionScene(() => {
          const snapshot = state.current;
          // Advance between React's 50 ms samples so action choreography stays at canvas frame rate.
          return snapshot.preview || snapshot.paused || snapshot.elapsed >= SHOW_DURATION ? snapshot
            : { ...snapshot, elapsed: Math.min(SHOW_DURATION, snapshot.elapsed + Math.min(50, performance.now() - sampledAt.current)) };
        })],
      });
      gameRef.current = game;
      resize.observe(host.current);
    });
    return () => { cancelAnimationFrame(animationFrame); resize.disconnect(); game?.destroy(true); gameRef.current = null; };
  }, [runId]);

  const sceneName = phase === 'declaration' ? '신문 속보와 출마 선언' : phase === 'voting' ? '시민들의 투표' : phase === 'counting' ? '초접전 개표 방송' : '당선 세리머니';
  return <div className="game-canvas" ref={host} role="img" aria-label={`픽셀 투표 ${sceneName} 장면`} />;
}
