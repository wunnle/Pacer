import type { Workout } from '../types';

const KEY = 'pacer.workouts.v1';

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
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
