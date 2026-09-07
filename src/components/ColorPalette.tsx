import { COLOR_NOTES } from "../audio/noteMapping";

type Props = {
  activeColor: string;
  onSelect: (color: string) => void;
  size?: "default" | "small";
};

export default function ColorPalette({ activeColor, onSelect, size = "default" }: Props) {
  return (
    <div
      className={`palette${size === "small" ? " palette--small" : ""}`}
      role="radiogroup"
      aria-label="Color and note"
    >
      {COLOR_NOTES.map(({ color, label, note }) => {
        const isActive = color === activeColor;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${label} — note ${note}`}
            className={`swatch${isActive ? " swatch--active" : ""}`}
            style={{ "--swatch-color": color } as React.CSSProperties}
            onClick={() => onSelect(color)}
          >
            <span className="swatch__note">{note}</span>
          </button>
        );
      })}
    </div>
  );
}
