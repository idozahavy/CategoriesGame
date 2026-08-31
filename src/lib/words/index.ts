/**
 * Per-language bundled word lists, split into ./<code>.json chunks so no list
 * is downloaded until its language is actually played.
 */
const modules = import.meta.glob<{ default: Record<string, string[]> }>('./*.json');

const cache = new Map<string, Record<string, string[]>>();

/** Load (and cache) the word lists for a language. Never throws. */
export async function ensureWords(language: string): Promise<void> {
  if (cache.has(language)) return;
  const loader = modules[`./${language}.json`];
  if (!loader) {
    cache.set(language, {}); // no bundled lists for this language
    return;
  }
  try {
    const mod = await loader();
    cache.set(language, mod.default);
  } catch {
    cache.set(language, {}); // chunk failed to load — dictionary/vote still work
  }
}

/** Synchronous view of the loaded lists; empty until ensureWords() resolves. */
export function getWords(language: string): Record<string, string[]> {
  return cache.get(language) ?? {};
}
