type Props = { paused: boolean; onClick: () => void };

export default function PlaybackButton({ paused, onClick }: Props) {
  return <button type="button" className="playback-button" onClick={onClick} aria-pressed={paused}>
    <span className={`playback-symbol ${paused ? 'playback-symbol-play' : 'playback-symbol-pause'}`} aria-hidden="true" />
    {paused ? '계속 보기' : '잠깐 멈춤'}
  </button>;
}
