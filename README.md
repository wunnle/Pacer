# Pacer

Real-time workout pacing and guidance. Web app (PWA) for guiding walks, intervals, and tai chi sets with beeps, voice, and haptics.

## Exercise blocks

- **Warm-up walk** — duration (timer)
- **Fast & slow walk** — fast duration, slow duration, repeats (timeline + transitions)
- **Tai chi moves** — name, sets, move duration (per-second tick + set counter)
- **Cool-down walk** — duration (timer)

## Stack

- Vite + React + TypeScript
- localStorage for workouts
- Web Audio API for beeps, SpeechSynthesis for voice cues
- Vibration API for haptics
- Wake Lock API to keep the screen on while running

## Develop

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` deploy to Vercel.
