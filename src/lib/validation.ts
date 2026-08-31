import type { ValidationMode } from './types';
import { getPack } from './i18n';
import { matchesLetter } from './game';
import { addLearnedWord, getLearnedWords } from './db';

export type WordVerdict =
  | 'valid' // accepted automatically
  | 'invalid' // rejected automatically (wrong letter / empty)
  | 'vote'; // could not decide — ask the group (or auto-accept solo)

/**
 * Decide a word according to the game's validation mode.
 * Never throws; network failure degrades to 'vote'.
 *
 * `solo`: playing alone there is no one to fool and no one to vote — only the
 * letter (and lone-letter) rules apply, and no lookups or network calls run.
 */
export async function checkWord(
  word: string,
  categoryId: string,
  letter: string,
  language: string,
  mode: ValidationMode,
  solo = false,
): Promise<WordVerdict> {
  const trimmed = word.trim();
  if (trimmed.length < 2) return 'invalid'; // a lone letter is never a word
  if (!matchesLetter(trimmed, letter)) return 'invalid';
  if (solo || mode === 'none') return 'valid';
  if (mode === 'vote') return 'vote';

  const useBundled = mode === 'hybrid' || mode === 'bundled';
  const useDictionary = mode === 'hybrid' || mode === 'dictionary';

  if (useBundled) {
    if (inBundledList(trimmed, categoryId, language)) return 'valid';
    if (await inLearnedList(trimmed, categoryId, language)) return 'valid';
  }

  if (useDictionary) {
    const known = await inPublicDictionary(trimmed, language);
    if (known === 'known') {
      // Remember it so future games validate instantly and offline.
      void learnWord(language, categoryId, trimmed);
      return 'valid';
    }
    if (known === 'unknown' && mode === 'dictionary') return 'vote';
  }

  if (mode === 'bundled') return 'vote';
  return 'vote';
}

/** In-memory cache over the persistent learned-words store, one set per lang:category. */
const learnedCache = new Map<string, Set<string>>();

async function learnedSet(language: string, categoryId: string): Promise<Set<string>> {
  const key = `${language}:${categoryId}`;
  const cached = learnedCache.get(key);
  if (cached) return cached;
  let set: Set<string>;
  try {
    set = new Set(await getLearnedWords(language, categoryId));
  } catch {
    set = new Set(); // storage unavailable — behave as if nothing was learned
  }
  learnedCache.set(key, set);
  return set;
}

export async function inLearnedList(
  word: string,
  categoryId: string,
  language: string,
): Promise<boolean> {
  return (await learnedSet(language, categoryId)).has(word.trim().toLocaleLowerCase());
}

/** Persist a confirmed word (dictionary hit or accepted group vote) for future games. */
export async function learnWord(language: string, categoryId: string, word: string): Promise<void> {
  // Custom categories get a fresh UUID every game — words learned under one
  // could never be looked up again. Only builtin category ids accumulate.
  if (!(categoryId in getPack(language).categoryNames)) return;
  const normalized = word.trim().toLocaleLowerCase();
  if (normalized.length < 2) return;
  const set = await learnedSet(language, categoryId);
  if (set.has(normalized)) return;
  set.add(normalized);
  try {
    await addLearnedWord(language, categoryId, normalized);
  } catch {
    // storage unavailable — the in-memory cache still helps this session
  }
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
