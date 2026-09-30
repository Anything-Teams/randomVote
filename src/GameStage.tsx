import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { ElectionScene, STAGE_HEIGHT, STAGE_WIDTH, type StageState } from './game/ElectionScene';
import type { Candidate } from './election';
import type { ShowPhase } from './show';

type Props = {
  phase: ShowPhase;
  candidates: Candidate[];
  winnerId: string;
  topic: string;
  percentages?: Record<string, number>;
  finalPercentages?: Record<string, number>;
  progress?: number;
  totalVotes?: number;
  preview?: boolean;
  runId?: number;
  reducedMotion?: boolean;
  elapsed?: number;
  cheeringId?: string;
};
const EMPTY_PERCENTAGES: Record<string, number> = {};

export default function GameStage({ phase, candidates, winnerId, topic, percentages = EMPTY_PERCENTAGES, finalPercentages = EMPTY_PERCENTAGES, progress = 0, totalVotes = 0, preview = false, runId = 0, reducedMotion = false, elapsed = 0, cheeringId }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<StageState>({ phase, candidates, winnerId, topic, percentages, finalPercentages, progress, totalVotes, preview, reducedMotion, elapsed, cheeringId });
  useEffect(() => {
    state.current = { phase, candidates, winnerId, topic, percentages, finalPercentages, progress, totalVotes, preview, reducedMotion, elapsed, cheeringId };
  }, [phase, candidates, winnerId, topic, percentages, finalPercentages, progress, totalVotes, preview, reducedMotion, elapsed, cheeringId]);

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
        scene: [new ElectionScene(() => state.current)],
      });
      resize.observe(host.current);
    });
    return () => { cancelAnimationFrame(animationFrame); resize.disconnect(); game?.destroy(true); };
  }, [runId]);

  const sceneName = phase === 'declaration' ? '신문 속보와 출마 선언' : phase === 'voting' ? '시민들의 투표' : phase === 'counting' ? '초접전 개표 방송' : '당선 세리머니';
  return <div className="game-canvas" ref={host} role="img" aria-label={`픽셀 선거 ${sceneName} 장면`} />;
}
