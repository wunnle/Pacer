import { useState } from 'react';
import { Mic, MicOff, Pencil, Play, Plus, Trash2, Volume2, VolumeX } from 'lucide-react';
import type { Workout } from '../types';
import { workoutTotalSeconds } from '../types';
import { deleteWorkout } from '../lib/storage';
import { formatDuration } from '../lib/format';
import { loadSettings, saveSettings } from '../lib/settings';

interface Props {
  workouts: Workout[];
  onChange: (next: Workout[]) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onStart: (id: string) => void;
}

export function Home({ workouts, onChange, onNew, onEdit, onStart }: Props) {
  const [voiceEnabled, setVoiceEnabled] = useState(() => loadSettings().voiceEnabled);
  const [sfxEnabled, setSfxEnabled] = useState(() => loadSettings().sfxEnabled);

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveSettings({ voiceEnabled: next });
  };
  const toggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    saveSettings({ sfxEnabled: next });
  };

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
        <div className="row" style={{ gap: 4 }}>
          <button
            className={`icon toggle ${sfxEnabled ? 'on' : 'off'}`}
            onClick={toggleSfx}
            aria-label={sfxEnabled ? 'Disable sounds' : 'Enable sounds'}
            title={sfxEnabled ? 'Sounds on' : 'Sounds off'}
          >
            {sfxEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            className={`icon toggle ${voiceEnabled ? 'on' : 'off'}`}
            onClick={toggleVoice}
            aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
            title={voiceEnabled ? 'Voice on' : 'Voice off'}
          >
            {voiceEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button className="primary" onClick={onNew} style={{ marginLeft: 4 }}>
            <Plus size={16} />
            <span>New</span>
          </button>
        </div>
      </header>

      {workouts.length === 0 ? (
        <div className="empty">
          No workouts yet.<br />
          Tap <strong>New</strong> to build one.
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
              <div className="row" style={{ gap: 4 }}>
                <button className="icon ghost" onClick={() => onEdit(w.id)} aria-label="Edit">
                  <Pencil size={16} />
                </button>
                <button className="icon ghost danger" onClick={() => handleDelete(w.id, w.name)} aria-label="Delete">
                  <Trash2 size={16} />
                </button>
                <button className="primary icon" onClick={() => onStart(w.id)} aria-label="Start">
                  <Play size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
