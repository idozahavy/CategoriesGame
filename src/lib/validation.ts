import type { ValidationMode } from './types';
import { getPack } from './i18n';
import { matchesLetter } from './game';

export type WordVerdict =
  | 'valid' // accepted automatically
  | 'invalid' // rejected automatically (wrong letter / empty)
  | 'vote'; // could not decide — ask the group (or auto-accept solo)

/**
 * Decide a word according to the game's validation mode.
 * Never throws; network failure degrades to 'vote'.
 */
export async function checkWord(
  word: string,
  categoryId: string,
  letter: string,
  language: string,
  mode: ValidationMode,
): Promise<WordVerdict> {
  const trimmed = word.trim();
  if (trimmed.length < 2) return 'invalid'; // a lone letter is never a word
  if (!matchesLetter(trimmed, letter)) return 'invalid';
  if (mode === 'none') return 'valid';
  if (mode === 'vote') return 'vote';

  const useBundled = mode === 'hybrid' || mode === 'bundled';
  const useDictionary = mode === 'hybrid' || mode === 'dictionary';

  if (useBundled && inBundledList(trimmed, categoryId, language)) return 'valid';

  if (useDictionary) {
    const known = await inPublicDictionary(trimmed, language);
    if (known === 'known') return 'valid';
    if (known === 'unknown' && mode === 'dictionary') return 'vote';
  }

  if (mode === 'bundled') return 'vote';
  return 'vote';
}

export function inBundledList(word: string, categoryId: string, language: string): boolean {
  const list = getPack(language).words[categoryId];
  if (!list) return false;
  const w = word.trim().toLocaleLowerCase();
  return list.includes(w);
}

const dictCache = new Map<string, 'known' | 'unknown'>();

/**
 * Check word existence in Wiktionary (public dictionary, no key needed).
 * Category fit is NOT verified — only that the word exists in the language.
 */
export async function inPublicDictionary(
  word: string,
  language: string,
): Promise<'known' | 'unknown' | 'error'> {
  const key = `${language}:${word.toLocaleLowerCase()}`;
  const cached = dictCache.get(key);
  if (cached) return cached;
  try {
    const domain = language === 'en' ? 'en' : language;
    const url = `https://${domain}.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(
      word.toLocaleLowerCase(),
    )}&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return 'error';
    const data = (await res.json()) as { query?: { pages?: Record<string, { missing?: string }> } };
    const pages = data.query?.pages ?? {};
    const found = Object.entries(pages).some(([id, page]) => id !== '-1' && !('missing' in page));
    const verdict = found ? 'known' : 'unknown';
    dictCache.set(key, verdict);
    return verdict;
  } catch {
    return 'error';
  }
}
