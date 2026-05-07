import { loadSettings } from './settings';

let ctx: AudioContext | null = null;
let primed = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  // Tell iOS Safari this is playback audio (Safari 16.4+), so it
  // plays even with the physical silent switch flipped on. Without
  // this the audio session defaults to "auto" which is ambient and
  // honors the mute switch — most users don't think to toggle it.
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'playback';
    } catch {
      /* ignore */
    }
  }
  // iOS Safari refuses to fully initialize the audio output until
  // *something* plays from a user gesture. Without this, the very
  // first tone scheduled in the same call stack as the start tap can
  // be dropped before ctx.resume() resolves. Playing a silent
  // 1-sample buffer is the canonical workaround.
  if (!primed) {
    try {
      const buffer = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.connect(c.destination);
      src.start(0);
      primed = true;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.getVoices();
    } catch {
      /* ignore */
    }
  }
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.18): void {
  if (!loadSettings().sfxEnabled) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g).connect(c.destination);
  const now = c.currentTime;
  const dur = durationMs / 1000;
  g.gain.linearRampToValueAtTime(gain, now + 0.01);
  g.gain.linearRampToValueAtTime(gain, now + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, now + dur);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export function beepTick(): void {
  tone(880, 80, 'sine', 0.12);
}

export function beepCountdown(remainingSec: number): void {
  // Soft ascending sine chime instead of a square-wave alarm.
  // 3 → 2 → 1 climbs in pitch with a touch more presence on the
  // last tone, so it feels like "ready to switch" not "alert".
  const freqs: Record<number, number> = { 3: 620, 2: 740, 1: 880 };
  const freq = freqs[remainingSec] ?? 740;
  const gain = remainingSec === 1 ? 0.14 : 0.12;
  tone(freq, 80, 'sine', gain);
}

export function beepStart(): void {
  tone(523, 90, 'triangle');
  setTimeout(() => tone(784, 160, 'triangle'), 110);
}

export function beepTransition(): void {
  tone(440, 110, 'sine');
  setTimeout(() => tone(660, 110, 'sine'), 130);
}

export function beepFinish(): void {
  // Arcade "level complete" jingle
  const notes: [number, number, number][] = [
    [523, 80, 0],
    [659, 80, 90],
    [784, 80, 180],
    [1047, 80, 270],
    [784, 80, 360],
    [1047, 200, 450],
  ];
  notes.forEach(([freq, dur, delay]) => setTimeout(() => tone(freq, dur, 'square', 0.14), delay));
}

// Distinct cues for tai chi set boundaries: a low, soft "done" tone
// and a higher, brighter "start" tone. At a set→set transition both
// play in sequence with a short gap so you hear "set ended → new set".
export function setDoneSound(): void {
  tone(440, 130, 'sine', 0.22);
}

export function setStartSound(): void {
  tone(880, 110, 'triangle', 0.22);
}

// ---- Voice ----

let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedVoiceLookup = 0;

const PREFERRED_VOICE_NAMES = [
  // Chrome / Google
  'Google UK English Female',
  'Google US English',
  'Google UK English Male',
  // macOS / iOS — natural-sounding Siri-class voices
  'Samantha',
  'Karen',
  'Daniel',
  'Moira',
  'Tessa',
  'Allison',
  'Ava',
  'Serena',
];

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const now = Date.now();
  if (cachedVoice && now - cachedVoiceLookup < 30_000) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const enUs = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = enUs.length > 0 ? enUs : voices;

  // Prefer names containing "Enhanced", "Premium", or "Neural"
  const upgraded = pool.find((v) => /enhanced|premium|neural/i.test(v.name));
  if (upgraded) {
    cachedVoice = upgraded;
    cachedVoiceLookup = now;
    return upgraded;
  }

  // Then known-good named voices
  for (const name of PREFERRED_VOICE_NAMES) {
    const v = pool.find((vc) => vc.name === name || vc.name.startsWith(name));
    if (v) {
      cachedVoice = v;
      cachedVoiceLookup = now;
      return v;
    }
  }

  // Fallback: any en-US voice
  cachedVoice = pool[0] ?? null;
  cachedVoiceLookup = now;
  return cachedVoice;
}

export function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!loadSettings().voiceEnabled) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
