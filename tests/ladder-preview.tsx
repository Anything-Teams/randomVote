import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LadderShow from '../src/LadderShow';
import { CANDIDATE_COLORS, type Candidate } from '../src/election';
import '../src/styles.css';
import '../src/viewport.css';
import '../src/games.css';

// This entry point is development-only. The production bundle never imports these controls.
const DURATION = 44_000;
const doorOrder = ['4', '1', '7', '2', '9', '3', '5', '10', '6', '8'];
const nativeMatchMedia = window.matchMedia.bind(window);
let forceReduced = false;
window.matchMedia = media => {
  const query = nativeMatchMedia(media);
  if (!media.includes('prefers-reduced-motion')) return query;
  return new Proxy(query, {
    get(target, key) {
      if (key === 'matches') return forceReduced;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
};

function Preview() {
  const [count, setCount] = useState(10), [longNames, setLongNames] = useState(true);
  const [inputOrderArrival, setInputOrderArrival] = useState(false);
  const [targetLane, setTargetLane] = useState(0), [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false), [preview, setPreview] = useState(true);
  const [reduced, setReduced] = useState(false), [runId, setRunId] = useState(0), [storySeed, setStorySeed] = useState(1);
  const clock = useRef({ began: 0, age: 0 });
  useEffect(() => {
    if (!playing) return;
    clock.current = { began: performance.now(), age: elapsed };
    const timer = window.setInterval(() => setElapsed(Math.min(DURATION, clock.current.age + performance.now() - clock.current.began)), 50);
    // Hold the story clock at 44 seconds while the result's idle animation keeps running.
    return () => window.clearInterval(timer);
  }, [playing, runId]);
  const candidates: Candidate[] = useMemo(() => CANDIDATE_COLORS.slice(0, count).map((color, index) => ({
    id: String(index + 1), color,
    name: longNames ? index === 0 ? '가나다라마바사아자차카타파하다라' : index === 6 ? 'WWWWWWWWWWWWWWWW' : `이름이아주긴참가자${String(index + 1).padStart(2, '0')}번` : `참가자 ${index + 1}`,
  })), [count, longNames]);
  const order = useMemo(() => inputOrderArrival ? candidates.map(candidate => candidate.id) : doorOrder.filter(id => Number(id) <= count), [count, candidates, inputOrderArrival]);
  const selectTarget = (lane: number) => {
    setTargetLane(Math.max(0, Math.min(count - 1, lane))); setPlaying(false); setPreview(true); setElapsed(0); setRunId(id => id + 1);
  };
  const seek = (age: number) => { setPlaying(false); setPreview(false); setElapsed(age); };
  const togglePlay = () => { if (!playing) setPreview(false); setPlaying(value => !value); };
  return <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 8, gap: 7, background: '#101d2f', color: '#d8e5ef' }}>
    <nav aria-label="사다리 검증 조작" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 'none', fontSize: 11 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>인원
        <select aria-label="사다리 검증 참가자 수" value={count} onChange={event => {
          const next = Number(event.target.value); setCount(next); setTargetLane(lane => Math.min(lane, next - 1)); setPlaying(false); setPreview(true); setElapsed(0); setRunId(id => id + 1);
        }}>
          {Array.from({ length: 9 }, (_, index) => index + 2).map(value => <option key={value} value={value}>{value}명</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>당첨 지점
        <select aria-label="사다리 당첨 지점" value={targetLane} onChange={event => selectTarget(Number(event.target.value))}>
          {Array.from({ length: count }, (_, lane) => <option key={lane} value={lane}>위쪽 문 {lane + 1}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}><input type="checkbox" checked={longNames} onChange={event => setLongNames(event.target.checked)} />긴 이름</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}><input type="checkbox" checked={inputOrderArrival} onChange={event => {
        setInputOrderArrival(event.target.checked); setPlaying(false); setPreview(true); setElapsed(0); setRunId(id => id + 1);
      }} />입력 순서 도착 검증</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}><input type="checkbox" checked={reduced} onChange={event => { forceReduced = event.target.checked; setReduced(event.target.checked); setPlaying(false); }} />모션 줄이기</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>장면 시드<input aria-label="사다리 장면 시드" type="number" min={0} max={999} value={storySeed} onChange={event => { setStorySeed(Number(event.target.value)); setPlaying(false); setPreview(true); setElapsed(0); setRunId(id => id + 1); }} style={{ width: 42 }} /></label>
      <button type="button" onClick={() => { setPlaying(false); setPreview(true); setElapsed(0); setRunId(id => id + 1); }}>문 고르기</button>
      {[0, 5, 12, 20, 28, 36, 40, 44].map(second => <button type="button" key={second} onClick={() => seek(second * 1000)}>{second}초</button>)}
      <button type="button" onClick={togglePlay}>{playing ? '정지' : '재생'}</button>
      <button type="button" onClick={() => { setPreview(false); setElapsed(0); setPlaying(true); setRunId(id => id + 1); }}>처음부터</button>
    </nav>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, flex: 'none' }}>
      <output style={{ minWidth: 39 }}>{(elapsed / 1000).toFixed(1)}초</output>
      <input aria-label="사다리 검증 시간" aria-valuetext={`${(elapsed / 1000).toFixed(1)}초`} type="range" min={0} max={DURATION} step={100} value={elapsed} onChange={event => seek(Number(event.target.value))} style={{ flex: 1, minWidth: 0 }} />
      <span>{targetLane + 1}번 문 · 당첨 지점</span>
    </label>
    <div className="sports-body" key={`${count}-${runId}-${reduced}`} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
      <LadderShow candidates={candidates} order={order} elapsed={elapsed} duration={DURATION} paused={!playing} preview={preview} targetLane={targetLane} onTargetChange={selectTarget} storySeed={storySeed} />
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
