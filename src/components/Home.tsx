import type { Workout } from '../types';
import { workoutTotalSeconds } from '../types';
import { deleteWorkout } from '../lib/storage';
import { formatDuration } from '../lib/format';

interface Props {
  workouts: Workout[];
  onChange: (next: Workout[]) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onStart: (id: string) => void;
}

export function Home({ workouts, onChange, onNew, onEdit, onStart }: Props) {
  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    onChange(deleteWorkout(id));
  };

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Pacer</h1>
          <div className="subtitle">Real-time workout pacing</div>
        </div>
        <button className="primary" onClick={onNew}>+ New</button>
      </header>

      {workouts.length === 0 ? (
        <div className="empty">
          No workouts yet.<br />
          Tap <strong>+ New</strong> to build one.
        </div>
      ) : (
        <div className="list">
          {workouts.map((w) => (
            <div key={w.id} className="workout-row">
              <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                <div className="name">{w.name || 'Untitled'}</div>
                <div className="meta">
                  {w.exercises.length} {w.exercises.length === 1 ? 'block' : 'blocks'} · {formatDuration(workoutTotalSeconds(w))}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="icon ghost" onClick={() => onEdit(w.id)} aria-label="Edit">✎</button>
                <button className="icon ghost" onClick={() => handleDelete(w.id, w.name)} aria-label="Delete">🗑</button>
                <button className="primary" onClick={() => onStart(w.id)}>Start</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
