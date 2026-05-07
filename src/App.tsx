import { useEffect, useState } from 'react';
import type { Workout } from './types';
import { deleteWorkout, loadWorkouts } from './lib/storage';
import { Home } from './components/Home';
import { WorkoutEditor } from './components/WorkoutEditor';
import { WorkoutRunner } from './components/WorkoutRunner';

type Screen =
  | { name: 'home' }
  | { name: 'editor'; workoutId?: string }
  | { name: 'runner'; workoutId: string; autoStart?: boolean };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith('pacer.')) setWorkouts(loadWorkouts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (screen.name === 'home') {
    return (
      <Home
        workouts={workouts}
        onChange={setWorkouts}
        onNew={() => setScreen({ name: 'editor' })}
        onEdit={(id) => setScreen({ name: 'editor', workoutId: id })}
        onStart={(id) => setScreen({ name: 'runner', workoutId: id, autoStart: true })}
      />
    );
  }

  if (screen.name === 'editor') {
    return (
      <WorkoutEditor
        workout={workouts.find((w) => w.id === screen.workoutId)}
        onSaved={(saved) => {
          setWorkouts(loadWorkouts());
          setScreen({ name: 'home' });
          void saved;
        }}
        onCancel={() => setScreen({ name: 'home' })}
        onDelete={screen.workoutId ? () => {
          setWorkouts(deleteWorkout(screen.workoutId!));
          setScreen({ name: 'home' });
        } : undefined}
      />
    );
  }

  const workout = workouts.find((w) => w.id === screen.workoutId);
  if (!workout) {
    setScreen({ name: 'home' });
    return null;
  }
  return (
    <WorkoutRunner
      workout={workout}
      autoStart={screen.autoStart ?? false}
      onExit={() => setScreen({ name: 'home' })}
    />
  );
}
