import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import GameStage from './GameStage';
import type { DramaFrame, ElectionEvent, ElectionResult } from './election';
import { countBeat, COUNT_START, finalResultGap, newsBeat, resolvedEvents, STORY_RESOLVE_AT, storyBeat, storyOutcome, tallyVotes, winnerPromise, type ShowPhase, type StoryActorOutcome } from './show';

type Props = {
  result: ElectionResult;
  frame: DramaFrame;
  drama: DramaFrame[];
  phase: ShowPhase;
  topic: string;
  elapsed: number;
  finished: boolean;
  runId: number;
  reducedMotion: boolean;
  paused: boolean;
  onPause: () => void;
  onSkip: () => void;
  onReplay: () => void;
  onReset: () => void;
};
const format = new Intl.NumberFormat('ko-KR');
const phases: ShowPhase[] = ['declaration', 'voting', 'counting', 'winner'];
const storyStages = ['announcement', 'action', 'verdict', 'aftermath'] as const;
const stageLabels = ['사건 포착', '현장 연결', '판정 공개', '판세 반영'];
const kindLabels = { brawl: '몸싸움', scandal: '비리 적발', comeback: '깜짝 추격', mishap: '돌발 실수', alliance: '후보 연합', blackout: '방송 사고' };

function RankChanges({ actors }: { actors: StoryActorOutcome[] }) {
  return <div className="incident-rank-changes">{actors.map(actor => <div key={actor.id} className={actor.afterRank === null ? 'is-out' : actor.afterRank < actor.beforeRank ? 'is-up' : actor.afterRank > actor.beforeRank ? 'is-down' : ''}>
    <span><i style={{ backgroundColor: actor.color }} />{actor.name}</span><strong>{actor.label}</strong>
  </div>)}</div>;
}

export default function BroadcastShow({ result, frame, drama, phase, topic, elapsed, finished, runId, reducedMotion, paused, onPause, onSkip, onReplay, onReset }: Props) {
  const [reviewed, setReviewed] = useState<ElectionEvent>();
  const board = useRef<HTMLDivElement>(null);
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const resumeAfterReview = useRef(false);
  const outcomes = useMemo(() => result.events.map(event => storyOutcome(result, event, drama)), [result, drama]);
  const history = resolvedEvents(result.events, elapsed);
  const cue = phase === 'counting' ? storyBeat(result.events, elapsed) : undefined;
  const event = cue?.event;
  const outcome = event ? outcomes.find(item => item.eventId === event.id) : undefined;
  const judged = cue !== undefined && cue.age >= STORY_RESOLVE_AT;
  const eliminated = new Set(history.flatMap(event => event.eliminatedId ? [event.eliminatedId] : []));
  const sorted = [...result.candidates].filter(candidate => !eliminated.has(candidate.id)).sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]);
  const [leader, runner] = sorted;
  const hasTally = phase === 'winner' || frame.progress > 0.5;
  const gap = frame.percentages[leader.id] - frame.percentages[runner.id];
  const countedVotes = Math.floor(result.totalVotes * frame.progress / 100);
  const gapVotes = Math.max(0, Math.round(countedVotes * gap / 100));
  const normalBeat = newsBeat(phase, result, frame, elapsed);
  const beat = event ? {
    id: `${event.id}-${cue!.stage}`,
    tag: judged ? event.eliminatedId ? '탈락 판정' : '판세 변화' : kindLabels[event.kind],
    title: judged ? outcome!.title : event.title,
    detail: judged ? outcome!.summary : event.detail,
    urgent: true,
  } : normalBeat;
  const boxBeat = countBeat(elapsed);
  const counting = phase === 'counting' || phase === 'winner';

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    let reset: number | undefined;
    const resize = new ResizeObserver(() => {
      element.classList.add('is-resizing');
      window.clearTimeout(reset);
      reset = window.setTimeout(() => element.classList.remove('is-resizing'), 180);
    });
    resize.observe(element);
    return () => { resize.disconnect(); window.clearTimeout(reset); element.classList.remove('is-resizing'); };
  }, [counting]);

  useEffect(() => {
    const dialog = reviewDialog.current;
    if (reviewed && dialog && !dialog.open) dialog.showModal();
    if (!reviewed && dialog?.open) dialog.close();
  }, [reviewed]);

  function review(event: ElectionEvent) {
    resumeAfterReview.current = !paused && !finished;
    if (resumeAfterReview.current) onPause();
    setReviewed(event);
  }

  function closeReview() {
    setReviewed(undefined);
    if (resumeAfterReview.current) onPause();
    resumeAfterReview.current = false;
  }

  const { winner, gapVotes: finalGap } = finalResultGap(result);
  const voteFraction = Math.max(0, Math.min(1, (elapsed - 5000) / (COUNT_START - 5000)));
  const sealed = phase === 'counting' && boxBeat.state === 'sealed';
  const finalSprint = phase === 'counting' && frame.progress >= 90;
  const closeRace = hasTally && gap < 0.12;
  const stageIndex = cue ? storyStages.indexOf(cue.stage) : -1;
  const reviewedOutcome = reviewed ? outcomes.find(item => item.eventId === reviewed.id) : undefined;
  const latestEvent = history.at(-1);
  const latestOutcome = latestEvent ? outcomes.find(item => item.eventId === latestEvent.id) : undefined;
  const boardStyle = { '--candidate-count': result.candidates.length, '--compact-count': Math.ceil(result.candidates.length / 2) } as CSSProperties;

  return <div className={`show-layout cinematic-layout phase-${phase} ${sealed ? 'box-sealed' : ''} ${event ? `story-active story-${event.kind} story-stage-${cue!.stage}` : ''} ${finalSprint ? 'final-sprint' : ''} ${paused ? 'is-paused' : ''}`} style={boardStyle}>
    <section className="broadcast-card cinematic-broadcast" aria-label="픽셀 투표 쇼">
      <div className="broadcast-head"><span className="live-pill"><span />{paused ? 'PAUSED · 잠깐 쉬어가는 중' : finished ? 'ELECTION COMPLETE' : 'LIVE · 특별 개표 방송'}</span><div className="broadcast-tools"><span>PIXEL TV / CH.01</span>{!finished && <button type="button" className="playback-button" onClick={onPause} aria-pressed={paused}>{paused ? '▶ 계속 보기' : 'Ⅱ 잠깐 멈춤'}</button>}</div></div>
      <div className={`stage-screen ${sealed ? 'suspense' : ''}`}>
        <GameStage phase={phase} candidates={result.candidates} winnerId={result.winnerId} topic={topic} percentages={frame.percentages} finalPercentages={result.percentages} finalVotes={result.votes} progress={frame.progress} totalVotes={result.totalVotes} runId={runId} reducedMotion={reducedMotion} elapsed={elapsed} events={result.events} storyOutcomes={outcomes} paused={paused} />
        <div className="cinema-hud" aria-hidden="true"><span>{cue ? `사건 ${String(cue.index).padStart(2, '0')} · ${stageLabels[stageIndex]}` : phase === 'counting' ? finalSprint ? '막판 접전 · 마지막 표' : '실시간 개표' : ['출마 특별판', '전국 투표 현장', '개표 특보', '당선 세리머니'][phases.indexOf(phase)]}</span><span>{paused ? '일시정지' : finished ? '확정' : 'LIVE'}</span></div>
        <div key={beat.id} className={`news-lower-third ${beat.urgent ? 'urgent' : ''}`}><span className="news-tag">{beat.tag}</span><div><strong>{beat.title}</strong><span>{phase === 'winner' ? winnerPromise(topic) : beat.detail}</span></div></div>
        {phase !== 'winner' && <div key={`${runId}-${phase}`} className="scene-wipe" aria-hidden="true" />}
        {sealed && <div className="suspense-vignette" aria-hidden="true" />}
      </div>
      <div className="news-ticker"><span>{event ? '사건 속보' : 'PIXEL NEWS'}</span><div><p>{topic}　 ◆　 {beat.detail}　 ◆　 모든 후보 동일 확률　 ◆　 {topic}　 ◆　 {beat.detail}</p></div></div>
      <div className="broadcast-topic"><span>TODAY'S BIG DECISION</span><strong>{topic}</strong></div>
      <div className={`timeline ${cue ? 'incident-steps' : ''}`} aria-label={cue ? '사건 진행 단계' : '진행 단계'}>{(cue ? stageLabels : ['출마 선언', '투표', '개표', '당선']).map((item, index) => {
        const current = cue ? stageIndex : phases.indexOf(phase);
        return <div key={item} className={`timeline-item ${current >= index ? 'reached' : ''} ${current === index ? 'current' : ''}`}><span className="timeline-dot" />{item}</div>;
      })}</div>
    </section>

    <aside className="results-card live-desk" aria-live={finished ? 'polite' : 'off'}>
      <div className="results-top"><span className="mini-label">LIVE ELECTION DESK</span><span className="issue-number">#001</span></div>
      <div className="results-heading"><span className="results-eyebrow">{phase === 'winner' ? 'FINAL RESULT' : phase === 'counting' ? `LIVE COUNT · ${sorted.length}명 경합` : 'ELECTION SPECIAL'}</span><h2>{phase === 'winner' ? '오늘의 당선자' : phase === 'counting' ? finalSprint ? '마지막 표, 누가 앞설까요?' : '사건이 바꾼 판세' : phase === 'voting' ? '운명의 표가 쌓이는 중' : '오늘의 출마 후보'}</h2><p>{phase === 'winner' ? '최종 개표 결과가 확정되었습니다.' : phase === 'counting' ? `${leader.name} · ${runner.name} 후보가 선두에서 경합합니다.` : phase === 'voting' ? '투표함에 표가 모이고 있습니다.' : '출마 선언이 끝나면 투표가 시작됩니다.'}</p></div>
      {counting ? <>
        <div className="count-progress"><div><span>{cue && !judged ? '개표 잠시 정지' : '개표율'}</span><strong>{frame.progress.toFixed(1)}%</strong></div><div className="progress-track"><span style={{ width: `${frame.progress}%` }} /></div><small>집계 {format.format(countedVotes)}표</small></div>
        {cue && outcome ? <section className={`incident-desk ${judged ? 'has-verdict' : ''}`} aria-label={`사건 ${cue.index}: ${event!.title}`}>
          <div className="incident-desk-meta"><span>사건 {String(cue.index).padStart(2, '0')} / 03 · {kindLabels[event!.kind]}</span><b>{stageLabels[stageIndex]}</b></div>
          <h3>{event!.title}</h3>
          {judged ? <RankChanges actors={outcome.actors} /> : <>
            <p className="incident-explanation">{event!.detail}</p>
            <div className="incident-evidence"><b>{cue.stage === 'action' ? '현장 증거' : '당사자'}</b><span>{cue.stage === 'action' ? event!.evidence : outcome.actors.map(actor => actor.name).join(' · ')}</span></div>
          </>}
        </section> : phase === 'counting' && <div className={`margin-card race-margin ${closeRace ? 'close-race' : ''}`}><span>{hasTally ? `${leader.name} ↔ ${runner.name}` : '첫 표가 들어오고 있습니다'}</span><strong>{hasTally ? format.format(gapVotes) : '—'}<small>{hasTally ? '표 차이' : ''}</small></strong></div>}
        <div ref={board} className="animated-leaderboard live-count-board" aria-label="후보별 실시간 득표율">
          {result.candidates.map((candidate, index) => {
            const rank = sorted.findIndex(item => item.id === candidate.id);
            const dropped = eliminated.has(candidate.id);
            const impact = phase === 'counting' ? latestOutcome?.actors.find(actor => actor.id === candidate.id) : undefined;
            const change = impact?.afterRank !== null && impact?.afterRank !== undefined ? impact.beforeRank - impact.afterRank : 0;
            const received = dropped ? 0 : tallyVotes(candidate.id, frame.percentages, frame.progress, result.totalVotes, result.votes);
            const slot = phase === 'winner' ? [...result.candidates].sort((a, b) => frame.percentages[b.id] - frame.percentages[a.id]).findIndex(item => item.id === candidate.id) : index;
            const style = { '--rank': slot, '--compact-row': Math.floor(slot / 2), '--compact-column': slot % 2, '--candidate-color': candidate.color } as CSSProperties;
            return <div className={`vote-row moving-row ${hasTally && rank === 0 ? 'is-leading' : ''} ${dropped ? 'is-disqualified' : ''} ${event?.actors.includes(candidate.id) ? 'event-actor' : ''} ${phase === 'winner' && candidate.id === winner.id ? 'elected' : ''}`} key={candidate.id} style={style} aria-label={`${candidate.name}${dropped ? ' · 탈락' : ''}`} title={candidate.name}>
              <span className="vote-info"><span className="rank">{dropped ? '×' : hasTally ? String(rank + 1).padStart(2, '0') : '—'}</span><span className="vote-color" style={{ backgroundColor: candidate.color }} /><span className="vote-name">{candidate.name}</span>{change !== 0 && <span className={`row-event-marker ${change > 0 ? 'is-up' : 'is-down'}`} title={impact!.label}>{change > 0 ? '↑' : '↓'}{Math.abs(change)}</span>}<span className="vote-tally"><strong>{dropped ? '탈락' : hasTally ? `${frame.percentages[candidate.id].toFixed(2)}%` : '—'}</strong><small aria-label={`받은 표 ${format.format(received)}표`}>{format.format(received)}표</small></span></span>
              <span className="vote-track"><span style={{ width: `${hasTally && !dropped ? frame.percentages[candidate.id] : 0}%`, backgroundColor: candidate.color }} /></span>
            </div>;
          })}
        </div>
        {history.length > 0 && <section className="incident-history" aria-label="지난 사건 기록"><h3>사건 기록 <span>눌러서 다시 보기</span></h3><div>{history.map((past, index) => <button type="button" key={past.id} className="history-entry" onClick={() => review(past)} aria-label={`${past.title} 사건 기록 보기`} title={outcomes.find(item => item.eventId === past.id)!.summary}>
          <b>{String(index + 1).padStart(2, '0')} · {kindLabels[past.kind]}</b><span>{past.title}</span>
        </button>)}</div></section>}
        {phase === 'winner' && <div className="winner-summary"><span>✦ 사건 끝에 살아남은 주인공</span><strong title={winner.name}>{winner.name}</strong><small>{format.format(result.votes[winner.id])}표 · {format.format(finalGap)}표 차</small><p>{winnerPromise(topic)}</p></div>}
      </> : <>
        {phase === 'voting' && <div className="voting-counter"><span>투표함에 모인 표</span><strong>{format.format(Math.floor(result.totalVotes * voteFraction))}</strong></div>}
        <div className="candidate-roll" aria-label="출마 후보">{result.candidates.map((candidate, index) => <div key={candidate.id} style={{ animationDelay: `${index * 80}ms` }}><span style={{ backgroundColor: candidate.color }}>{String(index + 1).padStart(2, '0')}</span><strong>{candidate.name}</strong></div>)}</div>
      </>}
      <div className="show-actions">{finished ? <><button type="button" className="start-button" onClick={onReplay}>같은 후보로 다시 뽑기 <span aria-hidden="true">▶</span></button><button type="button" className="secondary-button" onClick={onReset}>후보 수정하기</button></> : <button type="button" className="secondary-button skip-button" onClick={onSkip}>연출 건너뛰고 결과 보기</button>}</div>
    </aside>

    <dialog ref={reviewDialog} className="incident-review" aria-labelledby="incident-review-title" onCancel={event => { event.preventDefault(); closeReview(); }}>
      {reviewed && reviewedOutcome && <>
        <div className="incident-review-meta"><span>{kindLabels[reviewed.kind]} · 사건 기록</span><button type="button" onClick={closeReview} aria-label="사건 기록 닫기">×</button></div>
        <h2 id="incident-review-title">{reviewed.title}</h2><p>{reviewed.detail}</p>
        <blockquote>“{reviewed.dialogue}”</blockquote><div className="incident-evidence"><b>현장 증거</b><span>{reviewed.evidence}</span></div>
        <RankChanges actors={reviewedOutcome.actors} /><p className="incident-review-summary">{reviewedOutcome.summary}</p>
        <button type="button" className="secondary-button" onClick={closeReview}>{resumeAfterReview.current ? '닫고 계속 보기' : '기록 닫기'}</button>
      </>}
    </dialog>
  </div>;
}
