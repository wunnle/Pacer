import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, Workout } from '../types';
import { EXERCISE_LABELS, exerciseTotalSeconds } from '../types';
import { formatClock } from '../lib/format';
import {
  beepCountdown,
  beepFinish,
  beepStart,
  beepTick,
  beepTransition,
  speak,
  unlockAudio,
} from '../lib/audio';
import { HAPTIC_FINISH, HAPTIC_TICK, HAPTIC_TRANSITION, vibrate } from '../lib/haptics';

type Phase =
  | { kind: 'warmup'; label: 'Warm-up'; total: number }
  | { kind: 'fast'; label: 'Fast'; total: number; rep: number; ofRepeats: number }
  | { kind: 'slow'; label: 'Slow'; total: number; rep: number; ofRepeats: number }
  | { kind: 'taichi'; label: string; total: number; setIndex: number; ofSets: number }
  | { kind: 'cooldown'; label: 'Cool-down'; total: number };

interface PlanItem {
  phase: Phase;
  exerciseIndex: number;
  exercise: Exercise;
}

function buildPlan(workout: Workout): PlanItem[] {
  const out: PlanItem[] = [];
  workout.exercises.forEach((ex, exIdx) => {
    if (ex.type === 'warmup') {
      out.push({ phase: { kind: 'warmup', label: 'Warm-up', total: ex.duration }, exerciseIndex: exIdx, exercise: ex });
    } else if (ex.type === 'cooldown') {
      out.push({ phase: { kind: 'cooldown', label: 'Cool-down', total: ex.duration }, exerciseIndex: exIdx, exercise: ex });
    } else if (ex.type === 'fastslow') {
      for (let r = 0; r < ex.repeats; r++) {
        out.push({
          phase: { kind: 'fast', label: 'Fast', total: ex.fastDuration, rep: r + 1, ofRepeats: ex.repeats },
          exerciseIndex: exIdx,
          exercise: ex,
        });
        out.push({
          phase: { kind: 'slow', label: 'Slow', total: ex.slowDuration, rep: r + 1, ofRepeats: ex.repeats },
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

  const startedAtRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickSecRef = useRef<number>(-1);
  const lastCountdownSecRef = useRef<number>(-1);

  const current = plan[stepIdx];
  const next = plan[stepIdx + 1];
  const phaseTotalMs = current ? current.phase.total * 1000 : 0;
  const remainingMs = Math.max(0, phaseTotalMs - elapsedMs);

  const totalSec = useMemo(() => plan.reduce((s, p) => s + p.phase.total, 0), [plan]);
  const elapsedAcrossSec = useMemo(() => {
    let s = 0;
    for (let i = 0; i < stepIdx; i++) s += plan[i].phase.total;
    return s + elapsedMs / 1000;
  }, [plan, stepIdx, elapsedMs]);

  // RAF tick loop
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

  // Phase transition
  useEffect(() => {
    if (!running || !current) return;
    if (elapsedMs >= phaseTotalMs && phaseTotalMs > 0) {
      const nextIdx = stepIdx + 1;
      if (nextIdx >= plan.length) {
        setRunning(false);
        setDone(true);
        beepFinish();
        vibrate(HAPTIC_FINISH);
        speak('Workout complete');
      } else {
        const nextItem = plan[nextIdx];
        beepTransition();
        vibrate(HAPTIC_TRANSITION);
        announce(nextItem.phase);
        setStepIdx(nextIdx);
        setElapsedMs(0);
        baseElapsedRef.current = 0;
        startedAtRef.current = performance.now();
        lastTickSecRef.current = -1;
        lastCountdownSecRef.current = -1;
      }
    }
  }, [elapsedMs, phaseTotalMs, running, current, stepIdx, plan]);

  // Per-second cues: tick for taichi, countdown beeps in last 3 seconds
  useEffect(() => {
    if (!running || !current) return;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const remainingSec = Math.ceil((phaseTotalMs - elapsedMs) / 1000);

    if (current.phase.kind === 'taichi' && elapsedSec !== lastTickSecRef.current) {
      lastTickSecRef.current = elapsedSec;
      if (elapsedSec > 0) {
        beepTick();
        vibrate(HAPTIC_TICK);
      }
    }

    if (remainingSec > 0 && remainingSec <= 3 && remainingSec !== lastCountdownSecRef.current) {
      lastCountdownSecRef.current = remainingSec;
      beepCountdown();
    }
  }, [elapsedMs, phaseTotalMs, running, current]);

  // Wake lock
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
      beepStart();
      vibrate([40, 40, 40]);
      announce(plan[0].phase);
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
    lastTickSecRef.current = -1;
    lastCountdownSecRef.current = -1;
  };

  if (!current) {
    return (
      <>
        <header className="app-header">
          <button className="ghost" onClick={onExit}>← Back</button>
        </header>
        <div className="empty">This workout has no blocks.</div>
      </>
    );
  }

  const phaseClass = current.phase.kind;

  return (
    <div className={`runner ${phaseClass}`}>
      <header className="app-header">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <div className="subtitle">{workout.name}</div>
      </header>

      <Stage
        phase={current.phase}
        remainingMs={remainingMs}
        totalMs={phaseTotalMs}
        done={done}
      />

      <ExtraVisuals item={current} elapsedMs={elapsedMs} />

      {next && !done && (
        <div className="up-next">
          <div className="col" style={{ gap: 2 }}>
            <div className="label">Up next</div>
            <div className="name">{phaseHeadline(next.phase)}</div>
          </div>
          <div className="meta" style={{ color: 'var(--muted)' }}>{formatClock(next.phase.total)}</div>
        </div>
      )}

      <div className="up-next">
        <div className="col" style={{ gap: 2 }}>
          <div className="label">Workout progress</div>
          <div className="name">{Math.min(plan.length, stepIdx + 1)} / {plan.length} segments</div>
        </div>
        <div className="meta" style={{ color: 'var(--muted)' }}>
          {formatClock(elapsedAcrossSec)} / {formatClock(totalSec)}
        </div>
      </div>

      <div className="controls">
        <button onClick={restart}>↺ Restart</button>
        {running ? (
          <button className="primary" onClick={pause}>⏸ Pause</button>
        ) : (
          <button className="primary" onClick={start}>{done ? '↻ Again' : (elapsedMs > 0 ? '▶ Resume' : '▶ Start')}</button>
        )}
        <button onClick={skip} disabled={done}>⏭ Skip</button>
      </div>
    </div>
  );
}

function Stage({
  phase,
  remainingMs,
  totalMs,
  done,
}: {
  phase: Phase;
  remainingMs: number;
  totalMs: number;
  done: boolean;
}) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 0;
  const r = 100;
  const c = 2 * Math.PI * r;
  return (
    <div className="stage">
      <div className="phase-label">{phaseLabel(phase)}</div>
      <div className="phase-title">{phaseHeadline(phase)}</div>
      <div style={{ position: 'relative' }}>
        <svg className="progress-ring" viewBox="0 0 220 220">
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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="clock">{done ? 'Done' : formatClock(remainingMs / 1000)}</div>
        </div>
      </div>
    </div>
  );
}

function ExtraVisuals({ item, elapsedMs }: { item: PlanItem; elapsedMs: number }) {
  const { phase, exercise } = item;

  if (phase.kind === 'taichi' && exercise.type === 'taichi') {
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const pulseOn = elapsedSec !== Math.floor((elapsedMs - 50) / 1000);
    return (
      <div className="card row between">
        <div className="col" style={{ gap: 2 }}>
          <div className="label" style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Set
          </div>
          <div style={{ fontWeight: 600 }}>{phase.setIndex} of {phase.ofSets}</div>
        </div>
        <div className={`tick-pulse ${pulseOn ? 'on' : ''}`} />
        <div className="dots">
          {Array.from({ length: phase.ofSets }).map((_, i) => (
            <div
              key={i}
              className={`dot ${i + 1 < phase.setIndex ? 'done' : i + 1 === phase.setIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if ((phase.kind === 'fast' || phase.kind === 'slow') && exercise.type === 'fastslow') {
    const totalSegments = exercise.repeats * 2;
    const currentSegment = (phase.rep - 1) * 2 + (phase.kind === 'fast' ? 0 : 1);
    return (
      <div className="card col" style={{ gap: 10 }}>
        <div className="row between">
          <div style={{ fontWeight: 600 }}>Rep {phase.rep} of {phase.ofRepeats}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            {phase.kind === 'fast' ? `then slow ${exercise.slowDuration}s` : `then fast ${exercise.fastDuration}s`}
          </div>
        </div>
        <div className="timeline">
          {Array.from({ length: totalSegments }).map((_, i) => {
            const isFast = i % 2 === 0;
            const flexBasis = isFast ? exercise.fastDuration : exercise.slowDuration;
            const cls = i < currentSegment ? '' : i === currentSegment ? '' : 'upcoming';
            return (
              <div
                key={i}
                className={`seg ${isFast ? 'fast' : 'slow'} ${cls}`}
                style={{ flex: `${flexBasis} 0 0` }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return null;
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
    case 'taichi': speak(p.label); return;
  }
}

void exerciseTotalSeconds;
