import { derived, writable, get } from 'svelte/store';
import type { LanguagePack } from '../types';
import { en } from './en';
import { he } from './he';

const packs = new Map<string, LanguagePack>([
  [en.code, en],
  [he.code, he],
]);

export function registerPack(pack: LanguagePack): void {
  packs.set(pack.code, pack);
}

export function availablePacks(): LanguagePack[] {
  return [...packs.values()];
}

export function getPack(code: string): LanguagePack {
  return packs.get(code) ?? en;
}

/** Language of the UI (game content language can differ per game). */
export const uiLanguage = writable<string>('en');

export const pack = derived(uiLanguage, (code) => getPack(code));

/** Translate a UI key; falls back to English, then to the key itself. */
export const t = derived(pack, (p) => (key: string): string => {
  return p.ui[key] ?? en.ui[key] ?? key;
});

/** Category display name for the current UI language. */
export const categoryName = derived(
  pack,
  (p) =>
    (cat: { nameKey?: string; customName?: string }): string =>
      cat.customName ??
      (cat.nameKey
        ? (p.categoryNames[cat.nameKey] ?? en.categoryNames[cat.nameKey] ?? cat.nameKey)
        : ''),
);

/** Apply the current pack's direction/lang to <html>. Called reactively from App.svelte. */
export function applyDir(): void {
  const p = get(pack);
  document.documentElement.dir = p.dir;
  document.documentElement.lang = p.code;
}
