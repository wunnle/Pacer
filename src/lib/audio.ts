import { loadSettings } from './settings';

let ctx: AudioContext | null = null;

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
  getCtx();
  // Pre-warm speech synthesis with a silent utterance so the first real one isn't laggy.
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

export function beepCountdown(): void {
  tone(660, 120, 'square', 0.14);
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
  tone(523, 140, 'triangle');
  setTimeout(() => tone(659, 140, 'triangle'), 160);
  setTimeout(() => tone(784, 240, 'triangle'), 320);
}

// Distinct cues for tai chi set boundaries: a low, soft "done" tone
// and a higher, brighter "start" tone. At a set→set transition both
// play in sequence with a short gap so you hear "set ended → new set".
export function setDoneSound(): void {
  tone(440, 110, 'sine', 0.16);
}

export function setStartSound(): void {
  tone(880, 90, 'triangle', 0.16);
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
