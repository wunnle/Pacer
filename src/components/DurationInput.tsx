interface Props {
  label: string;
  value: number; // seconds
  min?: number; // seconds
  onChange: (seconds: number) => void;
}

export function DurationInput({ label, value, min = 0, onChange }: Props) {
  const safe = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  const update = (m: number, s: number) => {
    const total = Math.max(min, m * 60 + s);
    onChange(total);
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="duration-input">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={minutes}
          onChange={(e) => {
            const m = Math.max(0, Math.floor(Number(e.target.value) || 0));
            update(m, seconds);
          }}
          aria-label={`${label} minutes`}
        />
        <span className="duration-unit">min</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={seconds}
          onChange={(e) => {
            const raw = Math.floor(Number(e.target.value) || 0);
            const s = Math.max(0, Math.min(59, raw));
            update(minutes, s);
          }}
          aria-label={`${label} seconds`}
        />
        <span className="duration-unit">sec</span>
      </div>
    </div>
  );
}
