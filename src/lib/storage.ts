/**
 * localStorage that never throws — private mode, disabled cookies, or quota
 * errors degrade to "nothing stored" so callers keep their in-session behavior.
 */

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable — the session still works, just won't be remembered
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable — nothing was persisted anyway
  }
}
