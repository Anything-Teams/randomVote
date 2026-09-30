import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RacingShow from '../src/RacingShow';
import ArenaShow from '../src/ArenaShow';
import { CANDIDATE_COLORS } from '../src/election';
import { SPORT_DURATION } from '../src/sports';
import '../src/styles.css';
import '../src/viewport.css';
import '../src/games.css';

// Development-only controls make key moments repeatable without changing production clocks.
const candidates = CANDIDATE_COLORS.map((color, index) => ({ id: String(index + 1), name: index === 0 ? '가나다라마바사아자차카타파하다라' : index === 6 ? 'WWWWWWWWWWWWWWWW' : `참가자 ${index + 1}`, color }));
const order = ['4', '1', '7', '2', '9', '3', '5', '10', '6', '8'];
function Preview() {
  const [mode, setMode] = useState('racing');
  const [count, setCount] = useState(10);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const clock = useRef({ began: 0, age: 0 });
  useEffect(() => {
    if (!playing) return;
    clock.current = { began: performance.now(), age: elapsed };
    const timer = window.setInterval(() => {
      const next = Math.min(SPORT_DURATION, clock.current.age + performance.now() - clock.current.began);
      setElapsed(next);
      // The result clock stops at 44s; victory movements keep playing until paused.
    }, 50);
    return () => window.clearInterval(timer);
  }, [playing]);
  const props = { candidates: candidates.slice(0, count), order: order.filter(id => Number(id) <= count), elapsed, duration: SPORT_DURATION, paused: !playing, preview: false };
  return <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', padding: 8, gap: 8, background: '#101d2f' }}>
    <nav aria-label="스포츠 검증 조작" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {['racing', 'arena'].map(value => <button key={value} onClick={() => { setMode(value); setPlaying(false); setElapsed(0); }}>{value === 'racing' ? '경마' : '난투'}</button>)}
      <button onClick={() => setCount(count === 10 ? 2 : 10)}>{count}명 · 인원 변경</button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#d8e5ef', fontSize: 11 }}>인원
        <select aria-label="검증 참가자 수" value={count} onChange={event => { setCount(Number(event.target.value)); setPlaying(false); }}>
          {Array.from({ length: 9 }, (_, index) => index + 2).map(value => <option key={value} value={value}>{value}명</option>)}
        </select>
      </label>
      {[0, 5000, 12000, 20000, 28000, 36000, 39000, 44000].map(age => <button key={age} onClick={() => { setPlaying(false); setElapsed(age); }}>{age / 1000}초</button>)}
      <button onClick={() => setPlaying(value => !value)}>{playing ? '정지' : '재생'}</button>
    </nav>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d8e5ef', fontSize: 11, flex: 'none' }}>
      {`${(elapsed / 1000).toFixed(1)}초`}
      <input aria-label="장면 검증 시간" type="range" min={0} max={SPORT_DURATION} step={100} value={elapsed} onChange={event => { setPlaying(false); setElapsed(Number(event.target.value)); }} style={{ flex: 1, minWidth: 0 }} />
    </label>
    <div className="sports-body" key={`${mode}-${count}`}>{mode === 'racing' ? <RacingShow {...props} /> : <ArenaShow {...props} />}</div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
