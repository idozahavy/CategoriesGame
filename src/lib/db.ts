import { openDB, type IDBPDatabase } from 'idb';
import type { GameState, SaveSummary } from './types';

const DB_NAME = 'categories-game';
const STORE = 'saves';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        const store = d.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      },
    });
  }
  return dbPromise;
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
  const all: GameState[] = await (await db()).getAll(STORE);
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
    }));
}
