// Persisted visitor preferences. Storage can throw (private mode, blocked cookies): never let that break the UI.
const PREFIX = "ezo:";

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* not persisted, still works for this visit */
  }
}
