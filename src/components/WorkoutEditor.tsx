import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Snowflake,
  Sparkles,
  Sun,
  Trash2,
  Waves,
} from 'lucide-react';
import type { Exercise, ExerciseType, Workout } from '../types';
import { EXERCISE_LABELS, exerciseTotalSeconds } from '../types';
import { uid, upsertWorkout } from '../lib/storage';
import { formatDuration } from '../lib/format';
import { DurationInput } from './DurationInput';

interface Props {
  workout?: Workout;
  onSaved: (w: Workout) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function newExercise(type: ExerciseType): Exercise {
  const id = uid();
  switch (type) {
    case 'warmup':
      return { id, type, duration: 300 };
    case 'fastslow':
      return { id, type, fastDuration: 60, slowDuration: 90, repeats: 6 };
    case 'taichi':
      return { id, type, name: 'Move', sets: 8, moveDuration: 6, restDuration: 5 };
    case 'cooldown':
      return { id, type, duration: 180 };
  }
}

const exerciseIconMap: Record<ExerciseType, typeof Sun> = {
  warmup: Sun,
  fastslow: Waves,
  taichi: Sparkles,
  cooldown: Snowflake,
};

export function WorkoutEditor({ workout, onSaved, onCancel, onDelete }: Props) {
  const [name, setName] = useState(workout?.name ?? 'My workout');
  const [exercises, setExercises] = useState<Exercise[]>(workout?.exercises ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateAt = (id: string, patch: Partial<Exercise>) => {
    setExercises((xs) => xs.map((x) => (x.id === id ? ({ ...x, ...patch } as Exercise) : x)));
  };
  const removeAt = (id: string) => setExercises((xs) => xs.filter((x) => x.id !== id));
  const add = (type: ExerciseType) => setExercises((xs) => [...xs, newExercise(type)]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setExercises((xs) => {
      const oldIdx = xs.findIndex((x) => x.id === active.id);
      const newIdx = xs.findIndex((x) => x.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return xs;
      return arrayMove(xs, oldIdx, newIdx);
    });
  };

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

  return (
    <>
      <div className="col" style={{ gap: 12 }}>
        <div className="field">
          <label>Workout name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning walk" />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={exercises.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className="list">
              {exercises.map((ex) => (
                <SortableExerciseCard
                  key={ex.id}
                  exercise={ex}
                  onChange={(patch) => updateAt(ex.id, patch)}
                  onRemove={() => removeAt(ex.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {exercises.length === 0 && (
          <div className="empty">Add a block to begin.</div>
        )}

        <div className="add-buttons">
          {(['warmup', 'fastslow', 'taichi', 'cooldown'] as ExerciseType[]).map((t) => {
            const Icon = exerciseIconMap[t];
            return (
              <button key={t} onClick={() => add(t)} className="add-btn">
                <Plus size={16} />
                <Icon size={16} />
                <span>{EXERCISE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>

        {onDelete && (
          <button className="ghost danger" style={{ width: '100%' }} onClick={() => {
            if (confirm(`Delete "${name.trim() || 'Untitled'}"?`)) onDelete();
          }}>
            <Trash2 size={16} />
            <span>Delete workout</span>
          </button>
        )}
      </div>

      <div className="bottom-bar">
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={save} disabled={exercises.length === 0}>Save</button>
      </div>
    </>
  );
}

function SortableExerciseCard({
  exercise,
  onChange,
  onRemove,
}: {
  exercise: Exercise;
  onChange: (patch: Partial<Exercise>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };
  const Icon = exerciseIconMap[exercise.type];

  return (
    <div ref={setNodeRef} style={style} className="exercise-card">
      <div className="head">
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <button
            className="drag-handle"
            {...attributes}
            {...listeners}
            aria-label="Reorder"
            type="button"
          >
            <GripVertical size={18} />
          </button>
          <Icon size={16} className="ex-icon" />
          <div className="type">{EXERCISE_LABELS[exercise.type]}</div>
        </div>
        <button className="icon ghost danger" onClick={onRemove} aria-label="Remove">
          <Trash2 size={16} />
        </button>
      </div>

      {exercise.type === 'warmup' || exercise.type === 'cooldown' ? (
        <DurationInput
          label="Duration"
          value={exercise.duration}
          min={5}
          onChange={(v) => onChange({ duration: v } as Partial<Exercise>)}
        />
      ) : exercise.type === 'fastslow' ? (
        <div className="col" style={{ gap: 10 }}>
          <div className="fields-grid">
            <DurationInput
              label="Fast"
              value={exercise.fastDuration}
              min={5}
              onChange={(v) => onChange({ fastDuration: v } as Partial<Exercise>)}
            />
            <DurationInput
              label="Slow"
              value={exercise.slowDuration}
              min={5}
              onChange={(v) => onChange({ slowDuration: v } as Partial<Exercise>)}
            />
          </div>
          <div className="fields-grid">
            <NumField
              label="Repeats"
              value={exercise.repeats}
              min={1}
              onChange={(v) => onChange({ repeats: v } as Partial<Exercise>)}
            />
            <Readout label="Total" value={formatDuration(exerciseTotalSeconds(exercise))} />
          </div>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
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
            <DurationInput
              label="Move duration"
              value={exercise.moveDuration}
              min={1}
              secondsOnly
              onChange={(v) => onChange({ moveDuration: v } as Partial<Exercise>)}
            />
            <DurationInput
              label="Rest between sets"
              value={exercise.restDuration ?? 0}
              min={0}
              secondsOnly
              onChange={(v) => onChange({ restDuration: v } as Partial<Exercise>)}
            />
            <Readout label="Total" value={formatDuration(exerciseTotalSeconds(exercise))} />
          </div>
        </div>
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
        onFocus={(e) => e.target.select()}
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
      <div className="readout">{value}</div>
    </div>
  );
}
