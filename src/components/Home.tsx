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

      <footer className="app-footer">
        made for
        <svg width="72" height="29" viewBox="0 0 473 192" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="logo">
          <path d="M345.382 37C354.812 37.0001 362.498 44.4595 362.866 53.7998H362.882V86H362.912C363.445 77.0766 371.062 70 380.382 70C389.701 70.0001 397.318 77.0767 397.85 86H397.945C398.684 77.0373 405.984 70 414.882 70C423.779 70.0001 431.079 77.0373 431.818 86H431.882V104H431.643C429.127 130.373 406.914 151 379.882 151C352.85 151 330.636 130.373 328.12 104H327.882V53.7998H327.896C328.264 44.4594 335.951 37 345.382 37Z" fill="#E8C09C"/>
          <path d="M163.369 51.2893L134.946 53.008L126.37 78.6942L154.578 86.2287L163.369 51.2893Z" fill="#7E8FA0"/>
          <path d="M163.369 51.2894L144.772 64.9381L126.37 78.6942L154.578 86.2287L163.369 51.2894Z" fill="#657A8F"/>
          <circle cx="99.8964" cy="95.4793" r="55.6518" transform="rotate(-19.3478 99.8964 95.4793)" fill="#7E8FA0"/>
          <path d="M119.524 147.555C119.13 147.703 118.734 147.848 118.335 147.988L118.334 147.988C118.733 147.847 119.13 147.703 119.524 147.555Z" fill="#C4CED6"/>
          <path d="M123.324 145.963C124.907 145.23 126.442 144.43 127.927 143.567C127.359 124.602 114.794 108.691 97.6477 103.337C86.6001 98.1466 78.9502 86.9215 78.9502 73.9077C78.9504 55.9588 93.501 41.4082 111.45 41.408C112.076 41.408 112.698 41.4274 113.315 41.4623C130.875 45.8418 145.961 58.6897 152.405 77.0417C161.987 104.329 149.046 134.063 123.324 145.963Z" fill="#C4CED6"/>
          <circle cx="112.03" cy="72.4885" r="7.4325" transform="rotate(-5.24366 112.03 72.4885)" fill="#1E1E1E"/>
          <path d="M272.826 42.0134C292.072 42.5412 307.246 58.5711 306.718 77.8171C306.474 86.7124 302.916 94.7355 297.262 100.743L297.333 100.795L253.818 146.323C248.209 152.191 238.854 152.243 233.18 146.437L190.379 102.634C183.151 96.0412 178.724 86.4607 179.013 75.9137C179.541 56.6678 195.571 41.4933 214.817 42.0212C226.565 42.3434 236.794 48.4417 242.863 57.5212C249.299 47.8882 260.39 41.6724 272.826 42.0134Z" fill="#E66261"/>
        </svg>
        with love
      </footer>
    </>
  );
}
