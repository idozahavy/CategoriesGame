import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameState, SaveSummary } from './types';

/** Words the app has confirmed over past games (dictionary hits, accepted votes). */
interface LearnedEntry {
  /** `${language}:${categoryId}` */
  key: string;
  language: string;
  categoryId: string;
  /** Normalized (trimmed, lowercased), deduplicated. */
  words: string[];
}

interface GameDB extends DBSchema {
  saves: {
    key: string;
    value: GameState;
    indexes: { updatedAt: number };
  };
  learned: {
    key: string;
    value: LearnedEntry;
  };
}

const DB_NAME = 'categories-game';
const STORE = 'saves';
const LEARNED_STORE = 'learned';

let dbPromise: Promise<IDBPDatabase<GameDB>> | null = null;

function db(): Promise<IDBPDatabase<GameDB>> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          const store = d.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (oldVersion < 2) {
          d.createObjectStore(LEARNED_STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

function learnedKey(language: string, categoryId: string): string {
  return `${language}:${categoryId}`;
}

export async function getLearnedWords(language: string, categoryId: string): Promise<string[]> {
  const entry = await (await db()).get(LEARNED_STORE, learnedKey(language, categoryId));
  return entry?.words ?? [];
}

/** Add one normalized word to the persistent per-language/category list (idempotent). */
export async function addLearnedWord(
  language: string,
  categoryId: string,
  word: string,
): Promise<void> {
  const key = learnedKey(language, categoryId);
  const d = await db();
  const entry = (await d.get(LEARNED_STORE, key)) ?? { key, language, categoryId, words: [] };
  if (entry.words.includes(word)) return;
  entry.words.push(word);
  await d.put(LEARNED_STORE, entry);
}

/** Everything learned so far, for export/inspection. */
export async function listLearnedWords(): Promise<LearnedEntry[]> {
  return (await db()).getAll(LEARNED_STORE);
}

export async function saveGame(state: GameState): Promise<void> {
  state.updatedAt = Date.now();
  await (await db()).put(STORE, state);
}

export async function loadGame(id: string): Promise<GameState | undefined> {
  return (await db()).get(STORE, id);
}

export async function deleteGame(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}

export async function listSaves(): Promise<SaveSummary[]> {
  const all = await (await db()).getAll(STORE);
  return all
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((g) => ({
      id: g.id,
      updatedAt: g.updatedAt,
      playerNames: g.players.map((p) => p.name),
      roundsPlayed: g.rounds.filter((r) => r.phase === 'done').length,
      roundCount: g.settings.roundCount,
      language: g.settings.language,
      status: g.status,
      remote: g.settings.remote === true,
    }));
}
