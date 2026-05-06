import { Minus, Plus } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (seconds: number) => void;
}

function smartStep(value: number): number {
  if (value < 60) return 1;
  if (value < 300) return 15;
  return 30;
}

function formatDisplay(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export function DurationInput({ label, value, min = 0, step, onChange }: Props) {
  const safe = Math.max(min, Math.floor(value || 0));
  const stepDown = step ?? smartStep(safe);
  // Stepping up from "just under a threshold" should snap into the
  // bigger step (e.g., 59s + → 1m 14s feels weird; 59s + → 60s feels
  // right). Using the *current* value's step both ways accomplishes
  // this naturally because thresholds align with where step changes.
  const stepUp = step ?? smartStep(safe + 1);

  const adjust = (delta: number) => {
    const next = Math.max(min, safe + delta);
    onChange(next);
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="duration-stepper">
        <button
          type="button"
          className="step-btn"
          onClick={() => adjust(-stepDown)}
          disabled={safe <= min}
          aria-label={`Decrease ${label} by ${stepDown} seconds`}
        >
          <Minus size={18} />
        </button>
        <div className="duration-value" aria-live="polite">
          {formatDisplay(safe)}
        </div>
        <button
          type="button"
          className="step-btn"
          onClick={() => adjust(stepUp)}
          aria-label={`Increase ${label} by ${stepUp} seconds`}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
