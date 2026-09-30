import { useState, type CSSProperties } from 'react';
import GameStage from './GameStage';
import type { DramaFrame, ElectionResult } from './election';
import { countBeat, COUNT_START, elapsedAtProgress, newsBeat, SHOW_DURATION, winnerPromise, type ShowPhase } from './show';

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
  const [cheeringId, setCheeringId] = useState<string>();
  const hasTally = phase === 'winner' || frame.progress > 0.5;
  const eliminated = new Set(result.events.filter(event => event.eliminatedId && frame.progress >= event.progress).map(event => event.eliminatedId!));
  const sorted = [...result.candidates].filter(candidate => !eliminated.has(candidate.id)).sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]);
  const leader = sorted[0];
  const runner = sorted[1];
  const gap = frame.percentages[leader.id] - frame.percentages[runner.id];
  const countedVotes = Math.floor(result.totalVotes * frame.progress / 100);
  const gapVotes = Math.max(0, Math.round(countedVotes * gap / 100));
  const event = phase === 'counting' ? result.events.find(event => {
    const age = elapsed - elapsedAtProgress(event.progress);
    return age >= 0 && age < 2300;
  }) : undefined;
  const normalBeat = newsBeat(phase, result, frame, elapsed);
  const beat = event ? { id: event.id, tag: event.eliminatedId ? '후보 탈락' : '돌발 사건', title: event.title, detail: event.detail, urgent: true } : normalBeat;
  const boxBeat = countBeat(elapsed);
  const counting = phase === 'counting' || phase === 'winner';
  const winner = result.candidates.find(candidate => candidate.id === result.winnerId)!;
  const finalGap = result.votes[winner.id] - Math.max(...result.candidates.filter(candidate => candidate.id !== winner.id).map(candidate => result.votes[candidate.id]));
  const cheering = result.candidates.find(candidate => candidate.id === cheeringId);
  const cheeringRank = sorted.findIndex(candidate => candidate.id === cheeringId) + 1;
  const remaining = Math.max(0, Math.ceil((SHOW_DURATION - elapsed) / 1000));
  const voteFraction = Math.max(0, Math.min(1, (elapsed - 5000) / (COUNT_START - 5000)));
  const sealed = phase === 'counting' && boxBeat.state === 'sealed';
  const finalSprint = phase === 'counting' && frame.progress >= 90;
  const closeRace = hasTally && gap < 0.12;
  const boardStyle = { '--candidate-count': result.candidates.length, '--compact-count': Math.ceil(result.candidates.length / 2) } as CSSProperties;

  function cheer(id: string) { setCheeringId(previous => previous === id ? undefined : id); }

  return <div className={`show-layout cinematic-layout phase-${phase} ${sealed ? 'box-sealed' : ''} ${event ? `story-active story-${event.kind}` : ''} ${finalSprint ? 'final-sprint' : ''}`} style={boardStyle}>
    <section className="broadcast-card cinematic-broadcast" aria-label="픽셀 선거 쇼">
      <div className="broadcast-head"><span className="live-pill"><span /> {finished ? 'ELECTION COMPLETE' : 'LIVE · 특별 개표 방송'}</span><span>PIXEL TV / CH.01</span></div>
      <div className={`stage-screen ${sealed ? 'suspense' : ''}`}>
        <GameStage phase={phase} candidates={result.candidates} winnerId={result.winnerId} topic={topic} percentages={frame.percentages} progress={frame.progress} totalVotes={result.totalVotes} runId={runId} reducedMotion={reducedMotion} elapsed={elapsed} cheeringId={cheeringId} events={result.events} />
        <div className="cinema-hud" aria-hidden="true"><span>{phase === 'counting' ? event ? '속보 · 개표장 연결' : finalSprint ? '막판 접전 · 마지막 표' : '실시간 개표' : ['출마 특별판', '전국 투표 현장', '개표 특보', '당선 세리머니'][phases.indexOf(phase)]}</span><span>{finished ? 'COMPLETE' : `결과까지 00:${String(remaining).padStart(2, '0')}`}</span></div>
        <div key={beat.id} className={`news-lower-third ${beat.urgent ? 'urgent' : ''}`}><span className="news-tag">{beat.tag}</span><div><strong>{beat.title}</strong><span>{phase === 'winner' ? winnerPromise(topic) : beat.detail}</span></div></div>
        <div key={`${runId}-${phase}`} className="scene-wipe" aria-hidden="true" />
        {sealed && <div className="suspense-vignette" aria-hidden="true" />}
      </div>
      <div className="news-ticker"><span>PIXEL NEWS</span><div><p>{topic}　 ◆　 {beat.detail}　 ◆　 모든 후보 동일 확률　 ◆　 {topic}　 ◆　 {beat.detail}</p></div></div>
      <div className="broadcast-topic"><span>TODAY'S BIG DECISION</span><strong>{topic}</strong></div>
      <div className="timeline" aria-label="진행 단계">{['출마 선언', '투표', '개표', '당선'].map((item, index) => <div key={item} className={`timeline-item ${phases.indexOf(phase) >= index ? 'reached' : ''} ${phases.indexOf(phase) === index ? 'current' : ''}`}><span className="timeline-dot" />{item}</div>)}</div>
      <div className="show-time-track" aria-hidden="true"><span style={{ width: `${elapsed / SHOW_DURATION * 100}%` }} /></div>
    </section>

    <aside className="results-card live-desk" aria-live={finished ? 'polite' : 'off'}>
      <div className="results-top"><span className="mini-label">LIVE ELECTION DESK</span><span className="issue-number">#001</span></div>
      <div className="results-heading"><span className="results-eyebrow">{phase === 'winner' ? 'FINAL RESULT' : phase === 'counting' ? `LIVE COUNT · ${sorted.length}명 경합` : 'ELECTION SPECIAL'}</span><h2>{phase === 'winner' ? '오늘의 당선자' : event ? event.title : phase === 'counting' ? finalSprint ? '마지막 표, 누가 앞설까요?' : '매 순간 달라지는 판세' : phase === 'voting' ? '운명의 표가 쌓이는 중' : '누구를 응원할까요?'}</h2><p>{phase === 'winner' ? '최종 개표 결과가 확정되었습니다.' : event ? event.detail : phase === 'counting' ? `${leader.name} · ${runner.name} 후보가 선두에서 경합합니다.` : '후보를 눌러 응원하세요. 당선 확률은 그대로입니다.'}</p></div>
      {counting ? <>
        <div className="count-progress"><div><span>개표율</span><strong>{frame.progress.toFixed(1)}%</strong></div><div className="progress-track"><span style={{ width: `${frame.progress}%` }} /></div><small>집계 {format.format(countedVotes)}표</small></div>
        {phase === 'counting' && <div className={`margin-card race-margin ${closeRace ? 'close-race' : ''}`}><span>{event ? event.actors.map(id => result.candidates.find(candidate => candidate.id === id)?.name).filter(Boolean).join(' · ') : cheering ? `♥ ${cheering.name} · ${eliminated.has(cheering.id) ? '사건으로 탈락' : hasTally ? `현재 ${cheeringRank}위` : '응원 중'}` : hasTally ? `${leader.name} ↔ ${runner.name}` : '첫 표가 들어오고 있습니다'}</span><strong>{event ? event.eliminatedId ? '탈락!' : '사건 발생' : hasTally ? format.format(gapVotes) : '—'}<small>{!event && hasTally ? '표 차이' : ''}</small></strong></div>}
        <div className="animated-leaderboard live-count-board" aria-label="후보별 실시간 득표율">
          {result.candidates.map((candidate, index) => {
            const rank = sorted.findIndex(item => item.id === candidate.id);
            const dropped = eliminated.has(candidate.id);
            const selected = candidate.id === cheeringId;
            const slot = phase === 'winner' ? [...result.candidates].sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]).findIndex(item => item.id === candidate.id) : index;
            const style = { '--rank': slot, '--compact-row': Math.floor(slot / 2), '--compact-column': slot % 2, '--candidate-color': candidate.color } as CSSProperties;
            return <button type="button" className={`vote-row moving-row ${hasTally && rank === 0 ? 'is-leading' : ''} ${selected ? 'is-cheered' : ''} ${dropped ? 'is-disqualified' : ''} ${event?.actors.includes(candidate.id) ? 'event-actor' : ''} ${phase === 'winner' && candidate.id === winner.id ? 'elected' : ''}`} key={candidate.id} style={style} onClick={() => cheer(candidate.id)} aria-label={`${candidate.name} 응원${dropped ? ' · 탈락' : ''}`} aria-pressed={selected} title={`${candidate.name}${dropped ? ' · 사건으로 탈락' : ' 응원 · 당선 확률은 변하지 않습니다'}`}><span className="vote-info"><span className="rank">{dropped ? '×' : hasTally ? String(rank + 1).padStart(2, '0') : '—'}</span><span className="vote-color" style={{ backgroundColor: candidate.color }} /><span className="vote-name">{selected && <span className="cheer-heart">♥ </span>}{candidate.name}</span><strong>{dropped ? '탈락' : hasTally ? `${frame.percentages[candidate.id].toFixed(2)}%` : '—'}</strong></span><span className="vote-track"><span style={{ width: `${hasTally && !dropped ? frame.percentages[candidate.id] : 0}%`, backgroundColor: candidate.color }} /></span></button>;
          })}
        </div>
        {phase === 'winner' && <div className="winner-summary"><span>{cheeringId === winner.id ? '♥ 응원한 후보가 당선됐어요!' : '✦ 사건 끝에 살아남은 주인공'}</span><strong>{winner.name}</strong><small>{format.format(result.votes[winner.id])}표 · {format.format(finalGap)}표 차</small><p>{winnerPromise(topic)}</p></div>}
      </> : <>
        {phase === 'voting' && <div className="voting-counter"><span>투표함에 모인 표</span><strong>{format.format(Math.floor(result.totalVotes * voteFraction))}</strong></div>}
        <div className="candidate-roll">{result.candidates.map((candidate, index) => <button type="button" key={candidate.id} aria-label={`${candidate.name} 응원`} aria-pressed={candidate.id === cheeringId} className={candidate.id === cheeringId ? 'is-cheered' : ''} style={{ animationDelay: `${index * 80}ms` }} onClick={() => cheer(candidate.id)}><span style={{ backgroundColor: candidate.color }}>{String(index + 1).padStart(2, '0')}</span><strong>{candidate.name}</strong><b aria-hidden="true">{candidate.id === cheeringId ? '♥' : '♡'}</b></button>)}</div>
        <p className="cheer-note">{cheering ? `♥ ${cheering.name} 후보를 지켜봅니다` : '응원할 후보를 눌러 보세요'}</p>
      </>}
      <div className="show-actions">{finished ? <><button type="button" className="start-button" onClick={onReplay}>같은 후보로 다시 뽑기 <span aria-hidden="true">▶</span></button><button type="button" className="secondary-button" onClick={onReset}>후보 수정하기</button></> : <button type="button" className="secondary-button skip-button" onClick={onSkip}>연출 건너뛰고 결과 보기</button>}</div>
    </aside>
  </div>;
}
