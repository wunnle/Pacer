import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Pause,
  Play,
  Rabbit,
  RotateCcw,
  SkipForward,
  Turtle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Exercise, Workout } from '../types';
import { EXERCISE_LABELS } from '../types';
import { formatClock } from '../lib/format';
import {
  beepCountdown,
  beepFinish,
  beepStart,
  beepTransition,
  clickSound,
  speak,
  unlockAudio,
} from '../lib/audio';
import { HAPTIC_FINISH, HAPTIC_TICK, HAPTIC_TRANSITION, vibrate } from '../lib/haptics';
import { loadSettings, saveSettings } from '../lib/settings';

type Phase =
  | { kind: 'warmup'; total: number }
  | { kind: 'fast'; total: number; rep: number; ofRepeats: number }
  | { kind: 'slow'; total: number; rep: number; ofRepeats: number }
  | { kind: 'taichi'; label: string; total: number; setIndex: number; ofSets: number }
  | { kind: 'cooldown'; total: number };

interface PlanItem {
  phase: Phase;
  exerciseIndex: number;
  exercise: Exercise;
}

function buildPlan(workout: Workout): PlanItem[] {
  const out: PlanItem[] = [];
  workout.exercises.forEach((ex, exIdx) => {
    if (ex.type === 'warmup') {
      out.push({ phase: { kind: 'warmup', total: ex.duration }, exerciseIndex: exIdx, exercise: ex });
    } else if (ex.type === 'cooldown') {
      out.push({ phase: { kind: 'cooldown', total: ex.duration }, exerciseIndex: exIdx, exercise: ex });
    } else if (ex.type === 'fastslow') {
      for (let r = 0; r < ex.repeats; r++) {
        out.push({
          phase: { kind: 'fast', total: ex.fastDuration, rep: r + 1, ofRepeats: ex.repeats },
          exerciseIndex: exIdx,
          exercise: ex,
        });
        out.push({
          phase: { kind: 'slow', total: ex.slowDuration, rep: r + 1, ofRepeats: ex.repeats },
          exerciseIndex: exIdx,
          exercise: ex,
        });
      }
    } else if (ex.type === 'taichi') {
      for (let s = 0; s < ex.sets; s++) {
        out.push({
          phase: { kind: 'taichi', label: ex.name || 'Tai chi', total: ex.moveDuration, setIndex: s + 1, ofSets: ex.sets },
          exerciseIndex: exIdx,
          exercise: ex,
        });
      }
    }
  });
  return out;
}

interface Props {
  workout: Workout;
  onExit: () => void;
}

export function WorkoutRunner({ workout, onExit }: Props) {
  const plan = useMemo(() => buildPlan(workout), [workout]);
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => loadSettings().voiceEnabled);
  const [sfxEnabled, setSfxEnabled] = useState(() => loadSettings().sfxEnabled);

  const startedAtRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastCountdownSecRef = useRef<number>(-1);

  const current = plan[stepIdx];
  const next = plan[stepIdx + 1];
  const phaseTotalMs = current ? current.phase.total * 1000 : 0;
  const remainingMs = Math.max(0, phaseTotalMs - elapsedMs);
  const fraction = phaseTotalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / phaseTotalMs)) : 0;

  const totalSec = useMemo(() => plan.reduce((s, p) => s + p.phase.total, 0), [plan]);
  const elapsedAcrossSec = useMemo(() => {
    let s = 0;
    for (let i = 0; i < stepIdx; i++) s += plan[i].phase.total;
    return s + elapsedMs / 1000;
  }, [plan, stepIdx, elapsedMs]);

  // All plan items belonging to the current exercise — these become the
  // segments shown in the unified bar.
  const exerciseSegments = useMemo(() => {
    if (!current) return [];
    return plan.filter((p) => p.exerciseIndex === current.exerciseIndex);
  }, [plan, current]);
  const currentSegmentIdx = useMemo(() => {
    if (!current) return 0;
    return exerciseSegments.indexOf(current);
  }, [exerciseSegments, current]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const now = performance.now();
      const start = startedAtRef.current ?? now;
      const e = baseElapsedRef.current + (now - start);
      setElapsedMs(e);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  useEffect(() => {
    if (!running || !current) return;
    if (elapsedMs >= phaseTotalMs && phaseTotalMs > 0) {
      const nextIdx = stepIdx + 1;
      if (nextIdx >= plan.length) {
        if (current.phase.kind === 'taichi') clickSound();
        setRunning(false);
        setDone(true);
        beepFinish();
        vibrate(HAPTIC_FINISH);
        speak('Workout complete');
      } else {
        const nextItem = plan[nextIdx];
        if (current.phase.kind === 'taichi' && nextItem.phase.kind === 'taichi') {
          clickSound();
        } else {
          beepTransition();
          vibrate(HAPTIC_TRANSITION);
          announce(nextItem.phase);
        }
        setStepIdx(nextIdx);
        setElapsedMs(0);
        baseElapsedRef.current = 0;
        startedAtRef.current = performance.now();
        lastCountdownSecRef.current = -1;
      }
    }
  }, [elapsedMs, phaseTotalMs, running, current, stepIdx, plan]);

  useEffect(() => {
    if (!running || !current) return;
    if (current.phase.kind === 'taichi') return;
    const remainingSec = Math.ceil((phaseTotalMs - elapsedMs) / 1000);
    if (remainingSec > 0 && remainingSec <= 3 && remainingSec !== lastCountdownSecRef.current) {
      lastCountdownSecRef.current = remainingSec;
      beepCountdown();
      vibrate(HAPTIC_TICK);
    }
  }, [elapsedMs, phaseTotalMs, running, current]);

  useEffect(() => {
    if (!running) return;
    let lock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };
    if (nav.wakeLock) {
      nav.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => { /* ignore */ });
    }
    const onVis = () => {
      if (document.visibilityState === 'visible' && nav.wakeLock && !lock) {
        nav.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => { /* ignore */ });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => { /* ignore */ });
    };
  }, [running]);

  const start = () => {
    unlockAudio();
    if (done) {
      setStepIdx(0);
      setElapsedMs(0);
      baseElapsedRef.current = 0;
      setDone(false);
    }
    if (!current) return;
    if (stepIdx === 0 && elapsedMs === 0) {
      if (plan[0].phase.kind === 'taichi') {
        clickSound();
      } else {
        beepStart();
        vibrate([40, 40, 40]);
        announce(plan[0].phase);
      }
    }
    startedAtRef.current = performance.now();
    setRunning(true);
  };

  const pause = () => {
    setRunning(false);
    baseElapsedRef.current = elapsedMs;
  };

  const skip = () => {
    if (!current) return;
    setElapsedMs(phaseTotalMs);
  };

  const restart = () => {
    setStepIdx(0);
    setElapsedMs(0);
    baseElapsedRef.current = 0;
    setRunning(false);
    setDone(false);
    lastCountdownSecRef.current = -1;
  };

  const toggleVoice = () => {
    const v = !voiceEnabled;
    setVoiceEnabled(v);
    saveSettings({ voiceEnabled: v });
  };
  const toggleSfx = () => {
    const v = !sfxEnabled;
    setSfxEnabled(v);
    saveSettings({ sfxEnabled: v });
  };

  if (!current) {
    return (
      <>
        <header className="app-header">
          <button className="ghost icon" onClick={onExit} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        </header>
        <div className="empty">This workout has no blocks.</div>
      </>
    );
  }

  const phaseClass = current.phase.kind;

  return (
    <div className={`runner ${phaseClass}`}>
      <header className="app-header">
        <button className="ghost icon" onClick={onExit} aria-label="Exit">
          <ArrowLeft size={20} />
        </button>
        <div className="subtitle">{workout.name}</div>
        <div className="row" style={{ gap: 4 }}>
          <button
            className={`icon toggle ${sfxEnabled ? 'on' : 'off'}`}
            onClick={toggleSfx}
            aria-label={sfxEnabled ? 'Disable sounds' : 'Enable sounds'}
            title={sfxEnabled ? 'Sounds on' : 'Sounds off'}
          >
            {sfxEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            className={`icon toggle ${voiceEnabled ? 'on' : 'off'}`}
            onClick={toggleVoice}
            aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
            title={voiceEnabled ? 'Voice on' : 'Voice off'}
          >
            {voiceEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
        </div>
      </header>

      <div className="stage">
        <div className="phase-label">{phaseLabel(current.phase)}</div>
        <div className="phase-title">
          {current.phase.kind === 'fast' && <Rabbit size={26} aria-hidden />}
          {current.phase.kind === 'slow' && <Turtle size={26} aria-hidden />}
          <span>{phaseHeadline(current.phase)}</span>
        </div>

        {exerciseSegments.length <= 1 ? (
          <ProgressRing
            phaseKind={current.phase.kind}
            fraction={fraction}
            remainingMs={remainingMs}
            done={done}
          />
        ) : (
          <>
            <div className="clock">{done ? 'Done' : formatClock(remainingMs / 1000)}</div>
            <SegmentBar
              segments={exerciseSegments}
              currentIdx={currentSegmentIdx}
              fraction={fraction}
            />
          </>
        )}
      </div>

      <div className="footer-strip">
        {next && !done ? (
          <div className="footer-row">
            <div className="footer-label">Up next</div>
            <div className="footer-name">{phaseHeadline(next.phase)}</div>
            <div className="footer-time">{formatClock(next.phase.total)}</div>
          </div>
        ) : (
          <div className="footer-row">
            <div className="footer-label">Final segment</div>
            <div className="footer-name">{done ? 'Workout complete' : phaseHeadline(current.phase)}</div>
            <div className="footer-time" />
          </div>
        )}
        <div className="footer-row dim">
          <div className="footer-label">Workout</div>
          <div className="footer-name">{Math.min(plan.length, stepIdx + 1)} / {plan.length}</div>
          <div className="footer-time">
            {formatClock(elapsedAcrossSec)} / {formatClock(totalSec)}
          </div>
        </div>
      </div>

      <div className="controls">
        <button onClick={restart} aria-label="Restart">
          <RotateCcw size={18} />
          <span>Restart</span>
        </button>
        {running ? (
          <button className="primary" onClick={pause} aria-label="Pause">
            <Pause size={18} />
            <span>Pause</span>
          </button>
        ) : (
          <button className="primary" onClick={start} aria-label={done ? 'Restart' : 'Start'}>
            <Play size={18} />
            <span>{done ? 'Again' : (elapsedMs > 0 ? 'Resume' : 'Start')}</span>
          </button>
        )}
        <button onClick={skip} disabled={done} aria-label="Skip">
          <SkipForward size={18} />
          <span>Skip</span>
        </button>
      </div>
    </div>
  );
}

function ProgressRing({
  phaseKind,
  fraction,
  remainingMs,
  done,
}: {
  phaseKind: Phase['kind'];
  fraction: number;
  remainingMs: number;
  done: boolean;
}) {
  const r = 100;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap">
      <svg className={`progress-ring ${phaseKind}`} viewBox="0 0 220 220">
        <circle className="track" cx="110" cy="110" r={r} />
        <circle
          className="bar"
          cx="110"
          cy="110"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
        />
      </svg>
      <div className="ring-center">
        <div className="clock">{done ? 'Done' : formatClock(remainingMs / 1000)}</div>
      </div>
    </div>
  );
}

function SegmentBar({
  segments,
  currentIdx,
  fraction,
}: {
  segments: PlanItem[];
  currentIdx: number;
  fraction: number;
}) {
  if (segments.length === 0) return null;
  return (
    <div className="seg-bar" role="progressbar" aria-valuenow={currentIdx + fraction} aria-valuemin={0} aria-valuemax={segments.length}>
      {segments.map((s, i) => {
        const status = i < currentIdx ? 'past' : i === currentIdx ? 'current' : 'future';
        const kind = s.phase.kind;
        const scale = status === 'past' ? 1 : status === 'current' ? fraction : 0;
        return (
          <div
            key={i}
            className={`seg ${kind} ${status}`}
            style={{ flex: `${s.phase.total} 0 0` }}
          >
            <div className="seg-track" />
            <div className="seg-fill" style={{ transform: `scaleY(${scale})` }} />
          </div>
        );
      })}
    </div>
  );
}

function phaseLabel(p: Phase): string {
  switch (p.kind) {
    case 'warmup': return EXERCISE_LABELS.warmup;
    case 'cooldown': return EXERCISE_LABELS.cooldown;
    case 'fast': return `Fast · rep ${p.rep}/${p.ofRepeats}`;
    case 'slow': return `Slow · rep ${p.rep}/${p.ofRepeats}`;
    case 'taichi': return `Tai chi · set ${p.setIndex}/${p.ofSets}`;
  }
}

function phaseHeadline(p: Phase): string {
  switch (p.kind) {
    case 'warmup': return 'Warm-up walk';
    case 'cooldown': return 'Cool-down walk';
    case 'fast': return 'Walk fast';
    case 'slow': return 'Walk slow';
    case 'taichi': return p.label;
  }
}

function announce(p: Phase): void {
  switch (p.kind) {
    case 'warmup': speak('Warm up walk'); return;
    case 'cooldown': speak('Cool down walk'); return;
    case 'fast': speak('Fast'); return;
    case 'slow': speak('Slow'); return;
    case 'taichi': return;
  }
}
