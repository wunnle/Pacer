const KEY = 'pacer.settings.v1';

export interface Settings {
  voiceEnabled: boolean;
  sfxEnabled: boolean;
}

const defaults: Settings = {
  voiceEnabled: true,
  sfxEnabled: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
