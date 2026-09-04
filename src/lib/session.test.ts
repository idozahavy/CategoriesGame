import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGame } from './game';
import { persistActiveGame, readActiveGameId } from './session';
import type { GameState } from './types';

function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  return store;
}

function makeGame(): GameState {
  return createGame(
    {
      language: 'en',
      mode: 'classic',
      scoring: 'unique',
      validation: 'none',
      categories: [{ id: 'animal', nameKey: 'animal' }],
      roundCount: 1,
      timerSeconds: null,
    },
    [{ id: 'p1', name: 'Ada', colorIndex: 1 }],
  );
}

beforeEach(() => {
  stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistActiveGame', () => {
  it('remembers the game while a game screen is showing', () => {
    const game = makeGame();
    persistActiveGame('round', game);
    expect(readActiveGameId()).toBe(game.id);
    persistActiveGame('review', game);
    expect(readActiveGameId()).toBe(game.id);
  });

  it('forgets it on non-game screens or without a game', () => {
    const game = makeGame();
    persistActiveGame('round', game);
    persistActiveGame('home', game);
    expect(readActiveGameId()).toBeNull();
    persistActiveGame('round', null);
    expect(readActiveGameId()).toBeNull();
  });

  it('forgets a finished game so a reload lands on home, not the scoreboard', () => {
    const game = makeGame();
    persistActiveGame('scoreboard', game);
    expect(readActiveGameId()).toBe(game.id);
    persistActiveGame('scoreboard', { ...game, status: 'finished' });
    expect(readActiveGameId()).toBeNull();
  });
});
