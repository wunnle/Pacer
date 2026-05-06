export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export const HAPTIC_TICK = 20;
export const HAPTIC_TRANSITION = [60, 40, 60];
export const HAPTIC_FINISH = [120, 60, 120, 60, 200];
