import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

function stubEnvironment(saved: string | null, prefersDark: boolean): Map<string, string> {
  const store = new Map<string, string>();
  if (saved !== null) store.set('categories-theme', saved);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: prefersDark }) });
  return store;
}

/** The module reads its initial theme at import time, so each case gets a fresh import. */
async function loadTheme(): Promise<typeof import('./theme')> {
  vi.resetModules();
  return import('./theme');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('uses the saved choice over the device preference', async () => {
    stubEnvironment('light', true);
    const { theme } = await loadTheme();
    expect(get(theme)).toBe('light');
  });

  it('follows the device preference when nothing is saved', async () => {
    stubEnvironment(null, true);
    expect(get((await loadTheme()).theme)).toBe('dark');
    stubEnvironment(null, false);
    expect(get((await loadTheme()).theme)).toBe('light');
  });

  it('ignores a corrupt saved value', async () => {
    stubEnvironment('neon', false);
    const { theme } = await loadTheme();
    expect(get(theme)).toBe('light');
  });

  it('persists a choice for the next visit', async () => {
    const store = stubEnvironment(null, false);
    const { persistTheme } = await loadTheme();
    persistTheme('dark');
    expect(store.get('categories-theme')).toBe('dark');
  });
});
