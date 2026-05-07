import type { Workout } from '../types';

const KEY = 'pacer.workouts.v1';

const DEFAULT_WORKOUT: Workout = {
  id: 'default-serce-parmak',
  name: 'Serçe Parmak',
  createdAt: 0,
  updatedAt: 0,
  exercises: [
    { id: 'def-wu', type: 'warmup', duration: 900 },
    { id: 'def-fs', type: 'fastslow', fastDuration: 240, slowDuration: 360, repeats: 4 },
    { id: 'def-tc1', type: 'taichi', name: 'Tai Chi 1', sets: 20, moveDuration: 3, restDuration: 2 },
    { id: 'def-tc2', type: 'taichi', name: 'Tai Chi 2', sets: 20, moveDuration: 3, restDuration: 2 },
    { id: 'def-tc3', type: 'taichi', name: 'Tai Chi 3', sets: 20, moveDuration: 3, restDuration: 2 },
    { id: 'def-tc4', type: 'taichi', name: 'Tai Chi 4', sets: 20, moveDuration: 3, restDuration: 2 },
    { id: 'def-tc5', type: 'taichi', name: 'Tai Chi 5', sets: 20, moveDuration: 3, restDuration: 2 },
    { id: 'def-tc6', type: 'taichi', name: 'Tai Chi 6', sets: 20, moveDuration: 3, restDuration: 2 },
    { id: 'def-tc7', type: 'taichi', name: 'Tai Chi 7', sets: 20, moveDuration: 3, restDuration: 2 },
    { id: 'def-cd', type: 'cooldown', duration: 900 },
  ],
};

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      saveWorkouts([DEFAULT_WORKOUT]);
      return [DEFAULT_WORKOUT];
    }
    const parsed = JSON.parse(raw) as Workout[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  localStorage.setItem(KEY, JSON.stringify(workouts));
}

export function upsertWorkout(workout: Workout): Workout[] {
  const all = loadWorkouts();
  const idx = all.findIndex((w) => w.id === workout.id);
  const next = [...all];
  if (idx >= 0) next[idx] = workout;
  else next.unshift(workout);
  saveWorkouts(next);
  return next;
}

export function deleteWorkout(id: string): Workout[] {
  const next = loadWorkouts().filter((w) => w.id !== id);
  saveWorkouts(next);
  return next;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
