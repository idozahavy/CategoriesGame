import { writable } from 'svelte/store';

/** Light/dark theme — dark values live under [data-theme="dark"] in the design tokens. */
export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'categories-theme';

/** Saved choice first, then the device's preference. */
function detectInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable — fall through to the media query
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(detectInitialTheme());

/** Remember the choice for the next visit. Called reactively from App.svelte. */
export function persistTheme(value: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // storage unavailable — the session still works, just won't be remembered
  }
}
