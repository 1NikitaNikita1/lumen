type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClear: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
};

const MIN_SPEED = 40;
const MAX_SPEED = 500;

export default function Controls({
  isPlaying,
  onTogglePlay,
  onClear,
  speed,
  onSpeedChange,
  volume,
  onVolumeChange,
}: Props) {
  return (
    <div className="controls">
      <button type="button" className="controls__play" onClick={onTogglePlay}>
        {isPlaying ? "Pause" : "Play"}
      </button>

      <label className="controls__slider">
        <span>Speed</span>
        <input
          type="range"
          min={MIN_SPEED}
          max={MAX_SPEED}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        />
      </label>

      <label className="controls__slider">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
        />
      </label>

      <button type="button" className="controls__clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
