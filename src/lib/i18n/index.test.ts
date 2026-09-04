import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import { availablePacks, categoryName, getPack, t, uiLanguage } from './index';

describe('language packs', () => {
  it('ships six packs, each with a direction and a letter wheel', () => {
    const packs = availablePacks();
    expect(packs.map((p) => p.code).sort()).toEqual(['ar', 'en', 'es', 'fr', 'he', 'ru']);
    for (const p of packs) {
      expect(['ltr', 'rtl']).toContain(p.dir);
      expect(p.letters.length).toBeGreaterThan(0);
    }
  });

  it('marks Hebrew and Arabic as RTL', () => {
    expect(getPack('he').dir).toBe('rtl');
    expect(getPack('ar').dir).toBe('rtl');
    expect(getPack('en').dir).toBe('ltr');
  });

  it('falls back to English for an unknown code', () => {
    expect(getPack('xx').code).toBe('en');
  });
});

describe('t (UI translation)', () => {
  it('translates in the current UI language', () => {
    uiLanguage.set('he');
    expect(get(t)('common.cancel')).toBe(getPack('he').ui['common.cancel']);
    uiLanguage.set('en');
  });

  it('falls back to English, then to the key itself', () => {
    uiLanguage.set('he');
    const translate = get(t);
    expect(translate('no.such.key')).toBe('no.such.key');
    uiLanguage.set('en');
  });
});

describe('categoryName', () => {
  it('prefers a custom name, then the localized built-in name, then the key', () => {
    uiLanguage.set('en');
    const name = get(categoryName);
    expect(name({ customName: 'Dinosaurs', nameKey: 'animal' })).toBe('Dinosaurs');
    expect(name({ nameKey: 'animal' })).toBe(getPack('en').categoryNames['animal']);
    expect(name({ nameKey: 'not-a-category' })).toBe('not-a-category');
    expect(name({})).toBe('');
  });
});
