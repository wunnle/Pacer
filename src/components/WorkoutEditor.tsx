import { useState } from 'react';
import type { Exercise, ExerciseType, Workout } from '../types';
import { EXERCISE_LABELS, exerciseTotalSeconds, workoutTotalSeconds } from '../types';
import { uid, upsertWorkout } from '../lib/storage';
import { formatDuration } from '../lib/format';

interface Props {
  workout?: Workout;
  onSaved: (w: Workout) => void;
  onCancel: () => void;
}

function newExercise(type: ExerciseType): Exercise {
  const id = uid();
  switch (type) {
    case 'warmup':
      return { id, type, duration: 300 };
    case 'fastslow':
      return { id, type, fastDuration: 60, slowDuration: 90, repeats: 6 };
    case 'taichi':
      return { id, type, name: 'Move', sets: 8, moveDuration: 6 };
    case 'cooldown':
      return { id, type, duration: 180 };
  }
}

export function WorkoutEditor({ workout, onSaved, onCancel }: Props) {
  const [name, setName] = useState(workout?.name ?? 'My workout');
  const [exercises, setExercises] = useState<Exercise[]>(workout?.exercises ?? []);

  const updateAt = (idx: number, patch: Partial<Exercise>) => {
    setExercises((xs) => xs.map((x, i) => (i === idx ? ({ ...x, ...patch } as Exercise) : x)));
  };
  const removeAt = (idx: number) => setExercises((xs) => xs.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    setExercises((xs) => {
      const j = idx + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const add = (type: ExerciseType) => setExercises((xs) => [...xs, newExercise(type)]);

  const save = () => {
    const now = Date.now();
    const w: Workout = {
      id: workout?.id ?? uid(),
      name: name.trim() || 'Untitled',
      exercises,
      createdAt: workout?.createdAt ?? now,
      updatedAt: now,
    };
    upsertWorkout(w);
    onSaved(w);
  };

  const total = workoutTotalSeconds({ ...(workout ?? ({} as Workout)), exercises } as Workout);

  return (
    <>
      <header className="app-header">
        <button className="ghost" onClick={onCancel}>← Back</button>
        <div className="subtitle">{formatDuration(total)} total</div>
      </header>

      <div className="col" style={{ gap: 12 }}>
        <div className="field">
          <label>Workout name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning walk" />
        </div>

        <div className="list">
          {exercises.map((ex, i) => (
            <ExerciseEditor
              key={ex.id}
              exercise={ex}
              onChange={(patch) => updateAt(i, patch)}
              onRemove={() => removeAt(i)}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < exercises.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
        </div>

        {exercises.length === 0 && (
          <div className="empty">Add a block to begin.</div>
        )}

        <div className="add-buttons">
          <button onClick={() => add('warmup')}>+ Warm-up walk</button>
          <button onClick={() => add('fastslow')}>+ Fast & slow</button>
          <button onClick={() => add('taichi')}>+ Tai chi</button>
          <button onClick={() => add('cooldown')}>+ Cool-down walk</button>
        </div>
      </div>

      <div className="bottom-bar">
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={save} disabled={exercises.length === 0}>Save</button>
      </div>
    </>
  );
}

function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
  onUp,
  onDown,
}: {
  exercise: Exercise;
  onChange: (patch: Partial<Exercise>) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div className="exercise-card">
      <div className="head">
        <div className="type">{EXERCISE_LABELS[exercise.type]}</div>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon ghost" disabled={!onUp} onClick={onUp} aria-label="Move up">↑</button>
          <button className="icon ghost" disabled={!onDown} onClick={onDown} aria-label="Move down">↓</button>
          <button className="icon danger" onClick={onRemove} aria-label="Remove">✕</button>
        </div>
      </div>

      {exercise.type === 'warmup' || exercise.type === 'cooldown' ? (
        <div className="fields-grid">
          <NumField
            label="Duration (sec)"
            value={exercise.duration}
            min={5}
            onChange={(v) => onChange({ duration: v } as Partial<Exercise>)}
          />
          <Readout label="Total" value={formatDuration(exerciseTotalSeconds(exercise))} />
        </div>
      ) : exercise.type === 'fastslow' ? (
        <div className="fields-grid">
          <NumField
            label="Fast (sec)"
            value={exercise.fastDuration}
            min={5}
            onChange={(v) => onChange({ fastDuration: v } as Partial<Exercise>)}
          />
          <NumField
            label="Slow (sec)"
            value={exercise.slowDuration}
            min={5}
            onChange={(v) => onChange({ slowDuration: v } as Partial<Exercise>)}
          />
          <NumField
            label="Repeats"
            value={exercise.repeats}
            min={1}
            onChange={(v) => onChange({ repeats: v } as Partial<Exercise>)}
          />
          <Readout label="Total" value={formatDuration(exerciseTotalSeconds(exercise))} />
        </div>
      ) : (
        <>
          <div className="field">
            <label>Move name</label>
            <input
              value={exercise.name}
              onChange={(e) => onChange({ name: e.target.value } as Partial<Exercise>)}
              placeholder="Wave hands like clouds"
            />
          </div>
          <div className="fields-grid">
            <NumField
              label="Sets"
              value={exercise.sets}
              min={1}
              onChange={(v) => onChange({ sets: v } as Partial<Exercise>)}
            />
            <NumField
              label="Move duration (sec)"
              value={exercise.moveDuration}
              min={1}
              onChange={(v) => onChange({ moveDuration: v } as Partial<Exercise>)}
            />
            <Readout label="Total" value={formatDuration(exerciseTotalSeconds(exercise))} />
          </div>
        </>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(min, Math.floor(n)) : min);
        }}
      />
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 10, color: 'var(--muted)' }}>
        {value}
      </div>
    </div>
  );
}
