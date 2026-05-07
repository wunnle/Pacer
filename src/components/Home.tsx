import { useRef, useState } from 'react';
import { Pencil, Play, Plus, Volume2, VolumeX } from 'lucide-react';
import type { Workout } from '../types';
import { workoutTotalSeconds } from '../types';
import { formatDuration } from '../lib/format';
import { loadSettings, saveSettings } from '../lib/settings';


interface Props {
  workouts: Workout[];
  onChange: (next: Workout[]) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onStart: (id: string) => void;
}

const isSpsk = typeof window !== 'undefined' && window.location.hostname.startsWith('spsk.');
const appName = isSpsk ? 'SPSK' : 'Pacer';
const appSubtitle = isSpsk ? 'Serçe Parmak Spor Kulübü' : 'Real-time workout pacing';

const WORDS = ['pır', 'tık', 'mup', 'kırt'];

type Particle = { id: number; word: string; x: number };

export function Home({ workouts, onNew, onEdit, onStart }: Props) {
  const [soundEnabled, setSoundEnabled] = useState(() => loadSettings().sfxEnabled);
  const [particles, setParticles] = useState<Particle[]>([]);
  const queuedWordRef = useRef<string | null>(null);
  const lastWordRef = useRef<string | null>(null);
  const counterRef = useRef(0);

  const handleFooterTap = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let word: string;
    if (queuedWordRef.current) {
      word = queuedWordRef.current;
      queuedWordRef.current = null;
    } else {
      do {
        word = WORDS[Math.floor(Math.random() * WORDS.length)];
      } while (word === lastWordRef.current && WORDS.length > 1);
      queuedWordRef.current = word;
    }
    lastWordRef.current = word;
    const id = ++counterRef.current;
    setParticles((p) => [...p, { id, word, x }]);
    setTimeout(() => setParticles((p) => p.filter((pt) => pt.id !== id)), 900);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveSettings({ sfxEnabled: next, voiceEnabled: next });
  };


  return (
    <>
      <header className="app-header">
        <div>
          <h1>{appName}</h1>
          <div className="subtitle">{appSubtitle}</div>
        </div>
        <button
          className={`icon toggle ${soundEnabled ? 'on' : 'off'}`}
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Disable sound' : 'Enable sound'}
          title={soundEnabled ? 'Sound on' : 'Sound off'}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </header>

      {workouts.length === 0 ? (
        <div className="empty">
          No workouts yet.<br />
          Tap <strong>New</strong> to build one.
        </div>
      ) : (
        <div className="list">
          {workouts.map((w) => (
            <div key={w.id} className="workout-card-tall">
              <div className="row between" style={{ marginBottom: 8 }}>
                <div className="name">{w.name || 'Untitled'}</div>
                <div className="meta">{formatDuration(workoutTotalSeconds(w))}</div>
              </div>
              <div className="meta" style={{ marginBottom: 14 }}>
                {w.exercises.length} {w.exercises.length === 1 ? 'exercise' : 'exercises'}
              </div>
              <div className="workout-card-actions">
                <button className="ghost" onClick={() => onEdit(w.id)}>
                  <Pencil size={14} />
                  <span>Edit</span>
                </button>
                <button className="primary" onClick={() => onStart(w.id)}>
                  <Play size={14} />
                  <span>Start</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="primary" onClick={onNew} style={{ marginTop: 10, width: '100%' }}>
        <Plus size={16} />
        <span>New workout</span>
      </button>

      <footer className="app-footer" onClick={handleFooterTap} style={{ cursor: 'pointer' }}>
        <span className="app-footer-text">made for</span>
        <div className="logo-wrap">
        {particles.map((p) => (
          <span key={p.id} className="logo-particle" style={{ left: p.x }}>{p.word}</span>
        ))}
        <svg width="78" height="32" viewBox="0 0 473 192" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="logo">
          <path d="M358.5 37C367.93 37.0001 375.617 44.4595 375.984 53.7998H376V86H376.03C376.563 77.0766 384.181 70 393.5 70C402.819 70.0001 410.436 77.0767 410.969 86H411.063C411.803 77.0373 419.102 70 428 70C436.898 70.0001 444.197 77.0373 444.937 86H445V104H444.762C442.246 130.373 420.032 151 393 151C365.968 151 343.754 130.373 341.238 104H341V53.7998H341.015C341.382 44.4594 349.07 37 358.5 37Z" fill="#E8C09C"/>
          <path d="M142.898 51.2896L114.475 53.0083L105.899 78.6945L134.107 86.2289L142.898 51.2896Z" fill="#7E8FA0"/>
          <path d="M142.898 51.2896L124.301 64.9384L105.899 78.6945L134.107 86.2289L142.898 51.2896Z" fill="#657A8F"/>
          <circle cx="79.4254" cy="95.4795" r="55.6518" transform="rotate(-19.3478 79.4254 95.4795)" fill="#7E8FA0"/>
          <path d="M99.0525 147.555C98.6586 147.703 98.2626 147.849 97.8635 147.989L97.8624 147.988C98.2616 147.848 98.6585 147.703 99.0525 147.555Z" fill="#C4CED6"/>
          <path d="M102.853 145.963C104.436 145.23 105.971 144.43 107.456 143.567C106.888 124.602 94.3229 108.691 77.1766 103.337C66.1291 98.1468 58.4792 86.9218 58.4791 73.908C58.4794 55.959 73.03 41.4084 90.9789 41.4082C91.6047 41.4082 92.2271 41.4277 92.8442 41.4626C110.404 45.8421 125.49 58.69 131.934 77.0419C141.516 104.33 128.575 134.063 102.853 145.963Z" fill="#C4CED6"/>
          <circle cx="91.5593" cy="72.4882" r="7.4325" transform="rotate(-5.24366 91.5593 72.4882)" fill="#1E1E1E"/>
          <path d="M266.826 42.0134C286.072 42.5412 301.246 58.5711 300.718 77.8171C300.474 86.7124 296.916 94.7355 291.262 100.743L291.333 100.795L247.818 146.323C242.209 152.191 232.854 152.243 227.18 146.437L184.379 102.634C177.151 96.0412 172.724 86.4607 173.013 75.9137C173.541 56.6678 189.571 41.4933 208.817 42.0212C220.565 42.3434 230.794 48.4417 236.863 57.5212C243.299 47.8882 254.39 41.6724 266.826 42.0134Z" fill="#E66261"/>
        </svg>
        </div>
        <span className="app-footer-text">with love</span>
      </footer>
    </>
  );
}
