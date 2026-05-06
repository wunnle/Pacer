export type ExerciseType = 'warmup' | 'fastslow' | 'taichi' | 'cooldown';

export interface WarmUpWalk {
  id: string;
  type: 'warmup';
  duration: number;
}

export interface FastSlowWalk {
  id: string;
  type: 'fastslow';
  fastDuration: number;
  slowDuration: number;
  repeats: number;
}

export interface TaichiMoves {
  id: string;
  type: 'taichi';
  name: string;
  sets: number;
  moveDuration: number;
}

export interface CoolDownWalk {
  id: string;
  type: 'cooldown';
  duration: number;
}

export type Exercise = WarmUpWalk | FastSlowWalk | TaichiMoves | CoolDownWalk;

export interface Workout {
  id: string;
  name: string;
  exercises: Exercise[];
  createdAt: number;
  updatedAt: number;
}

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  warmup: 'Warm-up walk',
  fastslow: 'Fast & slow walk',
  taichi: 'Tai chi moves',
  cooldown: 'Cool-down walk',
};

export function exerciseTotalSeconds(ex: Exercise): number {
  switch (ex.type) {
    case 'warmup':
    case 'cooldown':
      return ex.duration;
    case 'fastslow':
      return (ex.fastDuration + ex.slowDuration) * ex.repeats;
    case 'taichi':
      return ex.moveDuration * ex.sets;
  }
}

export function workoutTotalSeconds(w: Workout): number {
  return w.exercises.reduce((sum, ex) => sum + exerciseTotalSeconds(ex), 0);
}
