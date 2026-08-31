import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import type { GameState, PlayerProfile, SaveSummary } from './types';

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
  profiles: {
    key: string;
    value: PlayerProfile;
  };
}

const DB_NAME = 'categories-game';
const STORE = 'saves';
const LEARNED_STORE = 'learned';
const PROFILE_STORE = 'profiles';

let dbPromise: Promise<IDBPDatabase<GameDB>> | null = null;

function db(): Promise<IDBPDatabase<GameDB>> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 3, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const store = database.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (oldVersion < 2) {
          database.createObjectStore(LEARNED_STORE, { keyPath: 'key' });
        }
        if (oldVersion < 3) {
          database.createObjectStore(PROFILE_STORE, { keyPath: 'key' });
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

/** Remove one learned word; drops the whole entry when it was the last word. */
export async function removeLearnedWord(
  language: string,
  categoryId: string,
  word: string,
): Promise<void> {
  const key = learnedKey(language, categoryId);
  const d = await db();
  const entry = await d.get(LEARNED_STORE, key);
  if (!entry) return;
  entry.words = entry.words.filter((w) => w !== word);
  if (entry.words.length === 0) await d.delete(LEARNED_STORE, key);
  else await d.put(LEARNED_STORE, entry);
}

function profileKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** Profiles by most recently played. */
export async function listProfiles(): Promise<PlayerProfile[]> {
  const all = await (await db()).getAll(PROFILE_STORE);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Remember (or refresh) a player's name + avatar when a game starts. */
export async function touchProfile(name: string, avatar: string | undefined): Promise<void> {
  const key = profileKey(name);
  if (key === '') return;
  const d = await db();
  const existing = await d.get(PROFILE_STORE, key);
  const profile: PlayerProfile = existing ?? {
    key,
    name: name.trim(),
    gamesPlayed: 0,
    wins: 0,
    totalPoints: 0,
    updatedAt: 0,
  };
  profile.name = name.trim();
  if (avatar !== undefined) profile.avatar = avatar;
  profile.updatedAt = Date.now();
  await d.put(PROFILE_STORE, profile);
}

/** Add one finished game to a player's lifetime stats. */
export async function recordGameResult(name: string, points: number, won: boolean): Promise<void> {
  const key = profileKey(name);
  if (key === '') return;
  const d = await db();
  const profile = await d.get(PROFILE_STORE, key);
  if (!profile) return; // only players saved at game start are tracked
  profile.gamesPlayed += 1;
  if (won) profile.wins += 1;
  profile.totalPoints += points;
  profile.updatedAt = Date.now();
  await d.put(PROFILE_STORE, profile);
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
      endless: g.settings.endless === true,
      language: g.settings.language,
      status: g.status,
      remote: g.settings.remote === true,
    }));
}
