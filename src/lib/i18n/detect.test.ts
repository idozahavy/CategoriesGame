import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The UI language is detected once, when the module loads - so every case
// imports a fresh copy after arranging storage and the browser languages.
async function loadI18n(saved: string | null, languages: string[]) {
  const store = new Map<string, string>();
  if (saved !== null) store.set('categories-ui-language', saved);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  vi.stubGlobal('navigator', { languages });
  vi.resetModules();
  const i18n = await import('./index');
  return { i18n, store };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initial UI language', () => {
  it('uses the saved choice when it is a known pack', async () => {
    const { i18n } = await loadI18n('he', ['en-US']);
    expect(get(i18n.uiLanguage)).toBe('he');
  });

  it('otherwise takes the first browser language that has a pack, ignoring the region', async () => {
    const { i18n } = await loadI18n(null, ['xx', 'fr-CA', 'en']);
    expect(get(i18n.uiLanguage)).toBe('fr');
  });

  it('ignores a saved code that has no pack and falls through to the browser', async () => {
    const { i18n } = await loadI18n('zz', ['ES-es']);
    expect(get(i18n.uiLanguage)).toBe('es');
  });

  it('ends up in English when nothing matches', async () => {
    const { i18n } = await loadI18n(null, ['xx', 'yy']);
    expect(get(i18n.uiLanguage)).toBe('en');
  });
});

describe('persistLanguage', () => {
  it('remembers the choice under the storage key the next load reads', async () => {
    const { i18n, store } = await loadI18n(null, ['en']);
    i18n.persistLanguage('ar');
    expect(store.get('categories-ui-language')).toBe('ar');
  });
});

describe('applyDir', () => {
  it('stamps the current pack direction and code on the document root', async () => {
    const { i18n } = await loadI18n('en', ['en']);
    const documentElement = { dir: '', lang: '' };
    vi.stubGlobal('document', { documentElement });
    i18n.uiLanguage.set('he');
    i18n.applyDir();
    expect(documentElement).toEqual({ dir: 'rtl', lang: 'he' });
    i18n.uiLanguage.set('fr');
    i18n.applyDir();
    expect(documentElement).toEqual({ dir: 'ltr', lang: 'fr' });
  });
});
