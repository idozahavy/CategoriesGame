/**
 * Per-language bundled word lists, split into ./<code>.json chunks so no list
 * is downloaded until its language is actually played.
 */
const modules = import.meta.glob<{ default: Record<string, string[]> }>('./*.json');

const cache = new Map<string, Record<string, string[]>>();
/** One load per language even under concurrent callers (review checks all words at once). */
const loading = new Map<string, Promise<void>>();

/** Load (and cache) the word lists for a language. Never throws. */
export function ensureWords(language: string): Promise<void> {
  if (cache.has(language)) return Promise.resolve();
  const inFlight = loading.get(language);
  if (inFlight) return inFlight;
  const loader = modules[`./${language}.json`];
  if (!loader) {
    cache.set(language, {}); // no bundled lists for this language
    return Promise.resolve();
  }
  const load = loader()
    .then((mod) => {
      cache.set(language, mod.default);
    })
    .catch(() => {
      // Chunk failed to load — dictionary/vote still work. Do NOT cache: leave
      // the language absent so the next ensureWords() call retries the load.
    })
    .finally(() => {
      loading.delete(language);
    });
  loading.set(language, load);
  return load;
}

/** Synchronous view of the loaded lists; empty until ensureWords() resolves. */
export function getWords(language: string): Record<string, string[]> {
  return cache.get(language) ?? {};
}
