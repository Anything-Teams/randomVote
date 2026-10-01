import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import GameStage from './GameStage';
import BroadcastShow from './BroadcastShow';
import RacingShow from './RacingShow';
import ArenaShow from './ArenaShow';
import LadderShow from './LadderShow';
import { CANDIDATE_COLORS, MAX_CANDIDATES, createDrama, createElection, frameAt, type Candidate, type DramaFrame, type ElectionResult } from './election';
import { countProgress, phaseFor, SHOW_DURATION } from './show';
import { readSession, saveSession, type Entry } from './session';
import { createSportsOrder, type GameMode } from './sports';
import { basePlaybackDuration, createPlaybackDuration } from './playbackTiming';

type Status = 'setup' | 'running' | 'finished';
const templates = ['오늘 커피 쏠 사람은?', '점심값 낼 사람은?', '벌칙 받을 사람은?', '청소 담당은?', '발표할 사람은?'];
const games = {
  election: { label: '투표', noun: '후보', title: '오늘의 당선자를 뽑아볼까요?', detail: '60가지 사건이 판세를 뒤흔드는 픽셀 투표 쇼.', action: '투표 시작', instruction: '몸싸움과 돌발 사건을 지나, 마지막 한 표의 주인공을 지켜보세요.' },
  racing: { label: '경마', noun: '말', title: '결승선까지, 순위는 모릅니다.', detail: '출발 게이트부터 마지막 직선까지, 순위를 뒤집는 픽셀 경마.', action: '경주 시작', instruction: '코너 추월부터 마지막 질주와 사진 판정까지, 모든 말의 순위를 지켜보세요.' },
  arena: { label: '난투', noun: '선수', title: '모래판의 마지막 한 사람은?', detail: '전원이 동시에 맞붙는 모래판. 끝까지 버티는 픽셀 장외 난투.', action: '난투 시작', instruction: '모두 한꺼번에 싸웁니다. 모래판 밖으로 밀려난 순서대로 순위가 확정됩니다.' },
  ladder: { label: '사다리', noun: '참가자', title: '하늘 보물은 누구 손에?', detail: '보물 비행선으로 올라가는 쟁탈전. 옆줄 습격과 돌풍을 버티고 황금 보물을 차지하세요.', action: '보물 쟁탈전 시작', instruction: '황금 보물이 든 상자를 고르세요. 그 상자에 도착한 사람이 당첨됩니다.' },
} as const;
const gameOrder = ['arena', 'racing', 'election', 'ladder'] as const;

export default function App() {
  const [saved] = useState(readSession);
  const [entries, setEntries] = useState<Entry[]>(saved.entries);
  const [topic, setTopic] = useState(templates.includes(saved.topic) ? saved.topic : templates[0]);
  const [mode, setMode] = useState<GameMode>(saved.mode ?? 'arena');
  const [ladderTarget, setLadderTarget] = useState(() => Math.min(saved.ladderTarget ?? 0, Math.max(2, saved.entries.filter(entry => entry.name.trim()).length) - 1));
  const [runTarget, setRunTarget] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('setup');
  const [result, setResult] = useState<ElectionResult | null>(null);
  const [drama, setDrama] = useState<DramaFrame[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [runDuration, setRunDuration] = useState(SHOW_DURATION);
  const [paused, setPaused] = useState(false);
  const [runId, setRunId] = useState(0);
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const timer = useRef<number | null>(null);
  const playback = useRef({ elapsed: 0, startedAt: 0, paused: false, duration: SHOW_DURATION });
  const nextId = useRef(saved.entries.length + 1);

  useEffect(() => () => { if (timer.current !== null) window.clearInterval(timer.current); }, []);
  useEffect(() => { saveSession({ entries, topic, mode, ladderTarget }); }, [entries, topic, mode, ladderTarget]);

  const candidates: Candidate[] = useMemo(() => entries.map((entry, index) => ({ id: String(entry.id), name: entry.name.trim(), color: CANDIDATE_COLORS[index] })).filter(candidate => candidate.name), [entries]);
  const game = games[mode];
  const ladderLaneCount = Math.max(2, candidates.length);
  const targetLane = Math.min(ladderTarget, ladderLaneCount - 1);
  const duration = status === 'setup' ? basePlaybackDuration(mode) : runDuration;
  const phase = status === 'setup' ? 'declaration' : phaseFor(elapsed);
  const progress = countProgress(elapsed);
  const snapshot = result && drama.length ? frameAt(drama, progress) : null;

  function changeEntry(id: number, name: string) {
    updateEntries(entries.map(entry => entry.id === id ? { ...entry, name } : entry));
  }

  function updateEntries(next: Entry[]) {
    setEntries(next);
    setLadderTarget(previous => Math.min(previous, Math.max(2, next.filter(entry => entry.name.trim()).length) - 1));
    setError('');
  }

  function addEntry() {
    if (entries.length >= MAX_CANDIDATES) return;
    setEntries(previous => [...previous, { id: nextId.current++, name: '' }]);
    setError('');
  }

  function start() {
    const names = entries.map(entry => entry.name.trim()).filter(Boolean);
    if (names.length < 2) { setError(`${game.noun} 이름을 2개 이상 입력해 주세요.`); return; }
    if (names.length > MAX_CANDIDATES) { setError(`최대 ${MAX_CANDIDATES}명까지 입력할 수 있어요.`); return; }
    if (new Set(names.map(name => name.toLocaleLowerCase('ko-KR'))).size !== names.length) {
      setError('같은 이름이 있어요. 이름을 다르게 입력해 주세요.'); return;
    }
    const nextDuration = createPlaybackDuration(mode);
    setRunDuration(nextDuration);
    setRunTarget(targetLane);
    if (mode === 'election') {
      const election = createElection(candidates);
      setResult(election);
      setDrama(createDrama(election));
    } else {
      setOrder(createSportsOrder(candidates));
      setResult(null);
      setDrama([]);
    }
    setElapsed(0);
    setPaused(false);
    setRunId(previous => previous + 1);
    setError('');
    window.scrollTo(0, 0);
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    playback.current = { elapsed: 0, startedAt: performance.now(), paused: false, duration: nextDuration };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      playback.current.elapsed = nextDuration;
      setElapsed(nextDuration);
      setStatus('finished');
      return;
    }
    setStatus('running');
    timer.current = window.setInterval(() => {
      const clock = playback.current;
      if (clock.paused) return;
      const next = Math.min(nextDuration, clock.elapsed + performance.now() - clock.startedAt);
      setElapsed(next);
      if (next >= nextDuration) {
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        setStatus('finished');
      }
    }, 50);
  }

  function finishNow() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setElapsed(playback.current.duration);
    playback.current.elapsed = playback.current.duration;
    setPaused(false);
    playback.current.paused = false;
    setStatus('finished');
  }

  function reset() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setResult(null);
    setDrama([]);
    setOrder([]);
    setElapsed(0);
    setPaused(false);
    playback.current.paused = false;
    setStatus('setup');
    window.scrollTo(0, 0);
  }

  function togglePause() {
    if (status !== 'running') return;
    const clock = playback.current;
    if (clock.paused) {
      clock.startedAt = performance.now();
      clock.paused = false;
    } else {
      clock.elapsed = Math.min(clock.duration, clock.elapsed + performance.now() - clock.startedAt);
      if (clock.elapsed >= clock.duration) { finishNow(); return; }
      clock.paused = true;
      setElapsed(clock.elapsed);
    }
    setPaused(clock.paused);
  }

  function chooseGame(next: GameMode) {
    if (next === mode) return;
    reset();
    setError('');
    setMode(next);
  }

  const sportsProps = { candidates, order, elapsed, duration, paused, preview: status === 'setup' };
  const sportsScene = mode === 'racing' ? <RacingShow {...sportsProps} /> : mode === 'ladder' ? <LadderShow {...sportsProps} targetLane={status === 'setup' ? targetLane : runTarget} onTargetChange={status === 'setup' ? setLadderTarget : undefined} /> : <ArenaShow {...sportsProps} />;

  return (
    <div className={`site-shell ${status !== 'setup' ? 'show-mode' : ''}`}>
      <header className="site-header">
        <div className="brand"><span className="brand-icon" aria-hidden="true"><img src="/favicon.svg?v=2" alt="" /></span><span>PIXEL<span className="brand-accent">SHOW</span></span></div>
        <nav className="game-picker" aria-label="추첨 게임 선택">{gameOrder.map((value, index) => <button type="button" key={value} onClick={() => chooseGame(value)} aria-pressed={mode === value}><small aria-hidden="true">0{index + 1}</small>{games[value].label}</button>)}</nav>
        <span className="header-badge">RANDOM DRAW SHOW <span className="badge-star">✦</span> 001</span>
      </header>

      <main className="page-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-square" /> 아주 진지한 랜덤 추첨</div>
            <h1>{game.title}</h1>
            <p>{game.detail}</p>
          </div>
          <div className="heading-seal" aria-hidden="true"><span>VOTE</span><strong>★</strong><span>SHOW</span></div>
        </div>

        {status === 'setup' ? (
          <div className="setup-grid">
            <section className="input-card" aria-labelledby="setup-title">
              <div className="card-heading"><span className="card-index">0{gameOrder.indexOf(mode) + 1}</span><div><h2 id="setup-title">{game.label} 준비</h2><p>{game.noun} 이름 2~10개를 입력해 주세요.</p></div></div>
              <div className="candidates-block">
              <div className="section-row"><label className="field-label" htmlFor="candidate-1">{game.noun} 명단</label><span className="field-count">{candidates.length} / {MAX_CANDIDATES}</span></div>
              <div className="candidate-list" style={{ gridTemplateRows: `repeat(${Math.ceil(entries.length / 2)}, minmax(0, 1fr))` }}>
                {entries.map((entry, index) => (
                  <div className="candidate-row" key={entry.id}>
                    <span className="candidate-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="candidate-swatch" style={{ backgroundColor: CANDIDATE_COLORS[index] }} aria-hidden="true" />
                    <input id={index === 0 ? 'candidate-1' : undefined} aria-label={`${index + 1}번 ${game.noun} 이름`} value={entry.name} onChange={event => changeEntry(entry.id, event.target.value)} maxLength={16} placeholder={`${game.noun} 이름`} />
                    <button className="remove-button" type="button" aria-label={`${index + 1}번 ${game.noun} 삭제`} title="명단에서 삭제" onClick={() => updateEntries(entries.filter(item => item.id !== entry.id))} disabled={entries.length <= 2}>×</button>
                  </div>
                ))}
              </div>
              <button className="add-button" type="button" onClick={addEntry} disabled={entries.length >= MAX_CANDIDATES}><span aria-hidden="true">＋</span> {game.noun} 추가</button>
              </div>

              <div className="setup-options">
              {mode === 'election' ? <div className="topic-block">
                <span className="field-label">추첨 테마</span>
                <div className="template-list" aria-label="투표 테마 선택">
                  {templates.map((template, index) => <button key={template} type="button" aria-pressed={topic === template} className={topic === template ? 'template active' : 'template'} onClick={() => { setTopic(template); setError(''); }}>{['☕', '🍽', '🎯', '🧹', '🎤'][index]} {['커피 쏘기', '점심값', '벌칙자', '청소 담당', '발표자'][index]}</button>)}
                </div>
              </div> : mode === 'ladder' ? <fieldset className="ladder-goal-selector">
                <legend className="field-label">황금 보물 위치 선택</legend>
                <div className="goal-choice-grid" style={{ '--goal-columns': ladderLaneCount, '--goal-mobile-columns': ladderLaneCount > 5 ? Math.ceil(ladderLaneCount / 2) : ladderLaneCount } as CSSProperties}>
                  {Array.from({ length: ladderLaneCount }, (_, lane) => <button key={lane} type="button" aria-label={`${lane + 1}번 당첨 지점`} aria-pressed={targetLane === lane} onClick={() => { setLadderTarget(lane); setError(''); }}><span className="goal-door-icon" aria-hidden="true" /><span>{String(lane + 1).padStart(2, '0')}</span></button>)}
                </div>
                <p><b>{targetLane + 1}번 상자</b>의 보물을 차지한 사람이 당첨됩니다. 옆줄 습격과 함정을 지켜보세요.</p>
              </fieldset> : <div className="game-instruction"><b>{mode === 'racing' ? '한 번의 경주, 모든 순위' : '전원 동시 장외 난투'}</b><p>{game.instruction}</p></div>}
              {error && <p className="error-message" role="alert">{error}</p>}
              <button className="start-button" type="button" onClick={start}>{game.action} <span aria-hidden="true">▶</span></button>
              <p className="privacy-note">명단은 이 탭에 저장돼요 · 모두 같은 {mode === 'ladder' ? '당첨' : '1등'} 확률</p>
              </div>
            </section>

            {mode === 'election' ? <section className="preview-card" aria-label="픽셀 투표 무대 미리보기">
              <div className="preview-top"><span className="live-pill"><span /> PREVIEW</span><span>PIXEL TV · CH 03</span></div>
              <div className="preview-stage"><GameStage phase="declaration" candidates={candidates} winnerId="" topic={topic} preview reducedMotion={reducedMotion} /></div>
              <div className="preview-bottom"><div><span className="mini-label">TODAY'S ISSUE</span><strong>{topic}</strong></div><span className="preview-arrow" aria-hidden="true">✦</span></div>
              <p className="preview-caption">몸싸움부터 간식 뇌물까지, 60가지 사건이 판세를 뒤흔듭니다. 누가 끝까지 살아남을까요?</p>
            </section> : <section className="preview-card sports-preview" aria-label={`${game.label} 미리보기`}><div className="preview-top"><span className="live-pill"><span /> PREVIEW</span><span>PIXEL {mode === 'ladder' ? 'CLIMB' : 'SPORTS'} · CH 0{gameOrder.indexOf(mode) + 1}</span></div><div className="sports-preview-body">{sportsScene}</div></section>}
          </div>
        ) : (
          mode === 'election' ? result && snapshot && <BroadcastShow result={result} frame={snapshot} drama={drama} phase={phase} topic={topic} elapsed={elapsed} finished={status === 'finished'} runId={runId} reducedMotion={reducedMotion} paused={paused} onPause={togglePause} onSkip={finishNow} onReplay={start} onReset={reset} /> : <section className={`sports-shell ${paused ? 'is-paused' : ''}`} aria-label={`${game.label} 경기`}>
            <div className="sports-toolbar"><span><b>{game.label}</b> {status === 'finished' ? mode === 'ladder' ? '보물 주인 확정' : '최종 순위 확정' : paused ? '일시정지' : mode === 'ladder' ? '보물 비행선을 향해' : '경기 중계 중'}</span>{status !== 'finished' && <button type="button" className="playback-button" onClick={togglePause} aria-pressed={paused}>{paused ? '▶ 계속 보기' : 'Ⅱ 잠깐 멈춤'}</button>}</div>
            <div className="sports-body" key={`${mode}-${runId}`}>{sportsScene}</div>
            <div className="sports-actions">{status === 'finished' ? <><button type="button" className="start-button" onClick={start}>같은 명단으로 다시 뽑기 <span aria-hidden="true">▶</span></button><button type="button" className="secondary-button" onClick={reset}>명단 수정하기</button></> : <button type="button" className="secondary-button" onClick={finishNow}>연출 건너뛰고 {mode === 'ladder' ? '당첨자' : '순위'} 보기</button>}</div>
          </section>
        )}
      </main>
      <footer className="site-footer"><span>PIXEL SHOW © 2026</span><span>공정한 추첨 · 거창한 발표</span></footer>
    </div>
  );
}
