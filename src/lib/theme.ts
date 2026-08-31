import { writable } from 'svelte/store';
import { readStorage, writeStorage } from './storage';

/** Light/dark theme — dark values live under [data-theme="dark"] in the design tokens. */
export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'categories-theme';

/** Saved choice first, then the device's preference. */
function detectInitialTheme(): Theme {
  const saved = readStorage(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(detectInitialTheme());

/** Remember the choice for the next visit. Called reactively from App.svelte. */
export function persistTheme(value: Theme): void {
  writeStorage(THEME_STORAGE_KEY, value);
}
