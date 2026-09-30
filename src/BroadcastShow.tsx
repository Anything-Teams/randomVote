import { useEffect, useRef, useState, type CSSProperties } from 'react';
import GameStage from './GameStage';
import type { DramaFrame, ElectionResult } from './election';
import { newsBeat, SHOW_DURATION, winnerPromise, type ShowPhase } from './show';

type Props = {
  result: ElectionResult;
  frame: DramaFrame;
  phase: ShowPhase;
  topic: string;
  elapsed: number;
  finished: boolean;
  runId: number;
  reducedMotion: boolean;
  onSkip: () => void;
  onReplay: () => void;
  onReset: () => void;
};
const format = new Intl.NumberFormat('ko-KR');
const phases: ShowPhase[] = ['declaration', 'voting', 'counting', 'winner'];

export default function BroadcastShow({ result, frame, phase, topic, elapsed, finished, runId, reducedMotion, onSkip, onReplay, onReset }: Props) {
  const sorted = [...result.candidates].sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]);
  const leader = sorted[0];
  const runner = sorted[1];
  const gap = frame.percentages[leader.id] - frame.percentages[runner.id];
  const beat = newsBeat(phase, result, frame);
  const counting = phase === 'counting' || phase === 'winner';
  const winner = result.candidates.find(candidate => candidate.id === result.winnerId)!;
  const remaining = Math.max(0, Math.ceil((SHOW_DURATION - elapsed) / 1000));
  const voteFraction = Math.max(0, Math.min(1, (elapsed - 6000) / 4200));
  const previousLeader = useRef('');
  const changeSequence = useRef(0);
  const [leadChange, setLeadChange] = useState<{ name: string; title: string; sequence: number } | null>(null);

  useEffect(() => {
    if (phase !== 'counting') { previousLeader.current = ''; setLeadChange(null); return; }
    if (previousLeader.current && previousLeader.current !== leader.id) {
      changeSequence.current += 1;
      setLeadChange({ name: leader.name, title: frame.progress > 80 ? '막판 대역전!' : changeSequence.current % 2 ? '선두 교체!' : '또 다시 역전!', sequence: changeSequence.current });
    }
    previousLeader.current = leader.id;
  }, [phase, leader.id, leader.name, frame.progress]);

  const boardStyle = { '--candidate-count': result.candidates.length, '--compact-count': Math.ceil(result.candidates.length / 2) } as CSSProperties;
  return <div className={`show-layout cinematic-layout phase-${phase}`} style={boardStyle}>
    <section className="broadcast-card cinematic-broadcast" aria-label="픽셀 선거 쇼">
      <div className="broadcast-head"><span className="live-pill"><span /> {finished ? 'ELECTION COMPLETE' : 'LIVE · 특별 개표 방송'}</span><span>PIXEL TV / CH.01</span></div>
      <div className={`stage-screen ${phase === 'counting' && frame.progress > 89 ? 'suspense' : ''}`}>
        <GameStage phase={phase} candidates={result.candidates} winnerId={result.winnerId} topic={topic} percentages={frame.percentages} finalPercentages={result.percentages} progress={frame.progress} totalVotes={result.totalVotes} runId={runId} reducedMotion={reducedMotion} />
        <div className="cinema-hud" aria-hidden="true"><span>{['출마 특별판', '전국 투표 현장', '개표 특보', '당선 세리머니'][phases.indexOf(phase)]}</span><span>{finished ? 'COMPLETE' : `결과까지 00:${String(remaining).padStart(2, '0')}`}</span></div>
        <div key={beat.id} className={`news-lower-third ${beat.urgent ? 'urgent' : ''}`}><span className="news-tag">{beat.tag}</span><div><strong>{beat.title}</strong><span>{phase === 'winner' ? winnerPromise(topic) : beat.detail}</span></div></div>
        {leadChange && phase === 'counting' && <div key={leadChange.sequence} className="lead-change-callout" aria-hidden="true"><span>BREAKING NEWS</span><strong>{leadChange.title}</strong><b>{leadChange.name} 후보 선두 탈환</b></div>}
        <div key={`${runId}-${phase}`} className="scene-wipe" aria-hidden="true" />
        {phase === 'counting' && frame.progress > 89 && frame.progress < 96 && <div className="suspense-vignette" aria-hidden="true" />}
      </div>
      <div className="news-ticker"><span>PIXEL NEWS</span><div><p>{topic}　 ◆　 {beat.detail}　 ◆　 모든 후보 동일 확률　 ◆　 {topic}　 ◆　 {beat.detail}</p></div></div>
      <div className="broadcast-topic"><span>TODAY'S BIG DECISION</span><strong>{topic}</strong></div>
      <div className="timeline" aria-label="진행 단계">{['출마 선언', '투표', '개표', '당선'].map((item, index) => <div key={item} className={`timeline-item ${phases.indexOf(phase) >= index ? 'reached' : ''} ${phases.indexOf(phase) === index ? 'current' : ''}`}><span className="timeline-dot" />{item}</div>)}</div>
      <div className="show-time-track" aria-hidden="true"><span style={{ width: `${elapsed / SHOW_DURATION * 100}%` }} /></div>
    </section>

    <aside className="results-card live-desk" aria-live={finished ? 'polite' : 'off'}>
      <div className="results-top"><span className="mini-label">LIVE ELECTION DESK</span><span className="issue-number">#001</span></div>
      <div className="results-heading"><span className="results-eyebrow">{phase === 'winner' ? 'FINAL RESULT' : phase === 'counting' ? 'COUNTING LIVE' : 'ELECTION SPECIAL'}</span><h2>{phase === 'winner' ? '오늘의 당선자' : phase === 'counting' ? '순간마다 바뀌는 판세' : phase === 'voting' ? '전국 투표 진행 중' : '전원, 전격 출마!'}</h2><p>{phase === 'declaration' ? '신문 1면을 장식한 오늘의 후보들' : phase === 'voting' ? '유권자들이 운명의 한 표를 던집니다.' : phase === 'winner' ? '최종 개표 결과가 확정되었습니다.' : '마지막 투표함이 열릴 때까지 지켜보세요.'}</p></div>
      {counting ? <>
        <div className="count-progress"><div><span>개표율</span><strong>{frame.progress.toFixed(1)}%</strong></div><div className="progress-track"><span style={{ width: `${frame.progress}%` }} /></div><small>집계 {format.format(Math.floor(result.totalVotes * frame.progress / 100))}표</small></div>
        {phase === 'counting' && <div className={`margin-card ${gap < 1 ? 'close-race' : ''}`}><span>{gap < 1 ? '초접전 · 한 표가 운명을 바꿉니다' : `${leader.name} 후보 선두`}</span><strong>{gap.toFixed(1)}<small>%p 차이</small></strong></div>}
        <div className="animated-leaderboard" aria-label="후보별 득표율">
          {result.candidates.map(candidate => {
            const rank = sorted.findIndex(item => item.id === candidate.id);
            const style = { '--rank': rank, '--compact-row': Math.floor(rank / 2), '--compact-column': rank % 2, '--candidate-color': candidate.color } as CSSProperties;
            return <div className={`vote-row moving-row ${rank === 0 ? 'is-leading' : ''} ${phase === 'winner' && candidate.id === winner.id ? 'elected' : ''}`} key={candidate.id} style={style}><div className="vote-info"><span className="rank">{String(rank + 1).padStart(2, '0')}</span><span className="vote-color" style={{ backgroundColor: candidate.color }} /><span className="vote-name">{candidate.name}</span><strong>{frame.percentages[candidate.id].toFixed(1)}%</strong></div><div className="vote-track"><span style={{ width: `${frame.percentages[candidate.id]}%`, backgroundColor: candidate.color }} /></div></div>;
          })}
        </div>
        {phase === 'winner' && <div className="winner-summary"><span>✦ 국민의 선택을 받았습니다</span><strong>{winner.name}</strong><small>{format.format(result.votes[winner.id])}표 · {result.percentages[winner.id].toFixed(1)}%</small><p>{winnerPromise(topic)}</p></div>}
      </> : phase === 'declaration' ? <div className="candidate-roll">{result.candidates.map((candidate, index) => <div key={candidate.id} style={{ animationDelay: `${index * 180}ms` }}><span style={{ backgroundColor: candidate.color }}>{String(index + 1).padStart(2, '0')}</span><strong>{candidate.name}</strong><small>출마 선언</small></div>)}</div> : <div className="voting-desk"><span>전국 투표수</span><strong>{format.format(Math.floor(result.totalVotes * voteFraction))}</strong><div className="ballot-flow" aria-hidden="true"><i /><i /><i /><b>투표함</b></div><p>투표가 끝나면 개표 방송으로 연결됩니다.</p></div>}
      <div className="show-actions">{finished ? <><button type="button" className="start-button" onClick={onReplay}>같은 후보로 다시 뽑기 <span aria-hidden="true">▶</span></button><button type="button" className="secondary-button" onClick={onReset}>후보 수정하기</button></> : <button type="button" className="secondary-button skip-button" onClick={onSkip}>연출 건너뛰고 결과 보기</button>}</div>
    </aside>
  </div>;
}
