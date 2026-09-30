import { useEffect, useMemo, useRef, useState } from 'react';
import GameStage from './GameStage';
import BroadcastShow from './BroadcastShow';
import { CANDIDATE_COLORS, MAX_CANDIDATES, createDrama, createElection, frameAt, type Candidate, type DramaFrame, type ElectionResult } from './election';
import { countProgress, phaseFor, SHOW_DURATION } from './show';
import { readSession, saveSession, type Entry } from './session';

type Status = 'setup' | 'running' | 'finished';
const templates = ['오늘 커피 쏠 사람은?', '점심값 낼 사람은?', '벌칙 받을 사람은?', '청소 담당은?', '발표할 사람은?'];

export default function App() {
  const [saved] = useState(readSession);
  const [entries, setEntries] = useState<Entry[]>(saved.entries);
  const [topic, setTopic] = useState(saved.topic);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('setup');
  const [result, setResult] = useState<ElectionResult | null>(null);
  const [drama, setDrama] = useState<DramaFrame[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState(0);
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const timer = useRef<number | null>(null);
  const nextId = useRef(saved.entries.length + 1);

  useEffect(() => () => { if (timer.current !== null) window.clearInterval(timer.current); }, []);
  useEffect(() => { saveSession({ entries, topic }); }, [entries, topic]);

  const candidates: Candidate[] = useMemo(() => status === 'setup'
    ? entries.map((entry, index) => ({ id: String(entry.id), name: entry.name.trim(), color: CANDIDATE_COLORS[index] })).filter(candidate => candidate.name)
    : (result?.candidates ?? []), [entries, status, result]);
  const phase = status === 'setup' ? 'declaration' : phaseFor(elapsed);
  const progress = countProgress(elapsed);
  const snapshot = result && drama.length ? frameAt(drama, progress) : null;

  function changeEntry(id: number, name: string) {
    setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, name } : entry));
    setError('');
  }

  function addEntry() {
    if (entries.length >= MAX_CANDIDATES) return;
    setEntries(previous => [...previous, { id: nextId.current++, name: '' }]);
    setError('');
  }

  function start() {
    const names = entries.map(entry => entry.name.trim()).filter(Boolean);
    if (names.length < 2) { setError('후보를 2명 이상 입력해 주세요.'); return; }
    if (names.length > MAX_CANDIDATES) { setError(`후보는 최대 ${MAX_CANDIDATES}명까지 입력할 수 있어요.`); return; }
    if (new Set(names.map(name => name.toLocaleLowerCase('ko-KR'))).size !== names.length) {
      setError('같은 이름의 후보가 있어요. 이름을 다르게 입력해 주세요.'); return;
    }
    if (!topic.trim()) { setError('추첨 주제를 입력해 주세요.'); return; }
    const list = candidates;
    const election = createElection(list);
    const frames = createDrama(election);
    setResult(election);
    setDrama(frames);
    setElapsed(0);
    setRunId(previous => previous + 1);
    setError('');
    window.scrollTo(0, 0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setElapsed(SHOW_DURATION);
      setStatus('finished');
      return;
    }
    setStatus('running');
    const startTime = performance.now();
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const next = Math.min(SHOW_DURATION, performance.now() - startTime);
      setElapsed(next);
      if (next >= SHOW_DURATION) {
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        setStatus('finished');
      }
    }, 50);
  }

  function finishNow() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setElapsed(SHOW_DURATION);
    setStatus('finished');
  }

  function reset() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setResult(null);
    setDrama([]);
    setElapsed(0);
    setStatus('setup');
    window.scrollTo(0, 0);
  }

  return (
    <div className={`site-shell ${status !== 'setup' ? 'show-mode' : ''}`}>
      <header className="site-header">
        <div className="brand"><span className="brand-icon" aria-hidden="true"><span /></span><span>PIXEL<span className="brand-accent">ELECTION</span></span></div>
        <span className="header-badge">RANDOM DRAW SHOW <span className="badge-star">✦</span> 001</span>
      </header>

      <main className="page-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-square" /> 아주 진지한 랜덤 추첨</div>
            <h1>오늘의 당선자를 뽑아볼까요?</h1>
            <p>후보를 적고 시작하세요. 사소한 결정을 거대한 픽셀 선거 쇼로 발표합니다.</p>
          </div>
          <div className="heading-seal" aria-hidden="true"><span>VOTE</span><strong>★</strong><span>SHOW</span></div>
        </div>

        {status === 'setup' ? (
          <div className="setup-grid">
            <section className="input-card" aria-labelledby="setup-title">
              <div className="card-heading"><span className="card-index">01</span><div><h2 id="setup-title">선거 준비</h2><p>후보 2~10명과 추첨 주제를 정해 주세요.</p></div></div>
              <div className="candidates-block">
              <div className="section-row"><label className="field-label" htmlFor="candidate-1">후보 명단</label><span className="field-count">{entries.filter(entry => entry.name.trim()).length} / {MAX_CANDIDATES}명</span></div>
              <div className="candidate-list" style={{ gridTemplateRows: `repeat(${Math.ceil(entries.length / 2)}, minmax(0, 1fr))` }}>
                {entries.map((entry, index) => (
                  <div className="candidate-row" key={entry.id}>
                    <span className="candidate-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="candidate-swatch" style={{ backgroundColor: CANDIDATE_COLORS[index] }} aria-hidden="true" />
                    <input id={index === 0 ? 'candidate-1' : undefined} aria-label={`${index + 1}번 후보 이름`} value={entry.name} onChange={event => changeEntry(entry.id, event.target.value)} maxLength={16} placeholder="후보 이름" />
                    <button className="remove-button" type="button" aria-label={`${index + 1}번 후보 삭제`} title="후보 삭제" onClick={() => { setEntries(previous => previous.filter(item => item.id !== entry.id)); setError(''); }} disabled={entries.length <= 2}>×</button>
                  </div>
                ))}
              </div>
              <button className="add-button" type="button" onClick={addEntry} disabled={entries.length >= MAX_CANDIDATES}><span aria-hidden="true">＋</span> 후보 추가</button>
              </div>

              <div className="setup-options">
              <div className="topic-block">
                <label className="field-label" htmlFor="topic">오늘의 선거 주제</label>
                <input id="topic" className="topic-input" value={topic} onChange={event => { setTopic(event.target.value); setError(''); }} maxLength={60} placeholder="무엇을 뽑을까요?" />
                <div className="template-list" aria-label="주제 예시">
                  {templates.map((template, index) => <button key={template} type="button" className={topic === template ? 'template active' : 'template'} onClick={() => { setTopic(template); setError(''); }}>{['☕', '🍽', '🎯', '🧹', '🎤'][index]} {['커피 쏘기', '점심값', '벌칙자', '청소 담당', '발표자'][index]}</button>)}
                </div>
              </div>
              {error && <p className="error-message" role="alert">{error}</p>}
              <button className="start-button" type="button" onClick={start}>선거 시작 <span aria-hidden="true">▶</span></button>
              <p className="privacy-note">명단은 이 탭에 저장돼요 · 모든 후보의 당선 확률은 같아요</p>
              </div>
            </section>

            <section className="preview-card" aria-label="픽셀 선거 무대 미리보기">
              <div className="preview-top"><span className="live-pill"><span /> PREVIEW</span><span>PIXEL TV · CH 01</span></div>
              <div className="preview-stage"><GameStage phase="declaration" candidates={candidates} winnerId="" topic={topic} preview reducedMotion={reducedMotion} /></div>
              <div className="preview-bottom"><div><span className="mini-label">TODAY'S ISSUE</span><strong>{topic.trim() || '오늘의 주제를 입력해 주세요'}</strong></div><span className="preview-arrow" aria-hidden="true">✦</span></div>
              <p className="preview-caption">몸싸움부터 간식 뇌물까지, 60가지 사건이 판세를 뒤흔듭니다. 누가 끝까지 살아남을까요?</p>
            </section>
          </div>
        ) : (
          result && snapshot && <BroadcastShow result={result} frame={snapshot} phase={phase} topic={topic.trim()} elapsed={elapsed} finished={status === 'finished'} runId={runId} reducedMotion={reducedMotion} onSkip={finishNow} onReplay={start} onReset={reset} />
        )}
      </main>
      <footer className="site-footer"><span>PIXEL ELECTION © 2026</span><span>공정한 추첨 · 거창한 발표 · 실제 투표 아님</span></footer>
    </div>
  );
}
