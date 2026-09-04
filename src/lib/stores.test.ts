import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveGame } from './db';
import { createGame } from './game';
import { game, updateGame } from './stores';
import type { GameState } from './types';

// IndexedDB is the boundary: the store must persist, but never wait for it.
vi.mock('./db', () => ({ saveGame: vi.fn(() => Promise.resolve()) }));

function makeGame(): GameState {
  return createGame(
    {
      language: 'en',
      mode: 'classic',
      scoring: 'unique',
      validation: 'none',
      categories: [{ id: 'animal', nameKey: 'animal' }],
      roundCount: 2,
      timerSeconds: null,
    },
    [{ id: 'p1', name: 'Ada', colorIndex: 1 }],
  );
}

beforeEach(() => {
  vi.mocked(saveGame).mockClear();
  game.set(null);
});

describe('updateGame', () => {
  it('applies the mutation and publishes a fresh object so derived state re-runs (regression ed9abc7)', () => {
    const original = makeGame();
    game.set(original);

    updateGame((g) => {
      g.usedLetters.push('B');
    });

    const after = get(game);
    expect(after).not.toBeNull();
    expect(after).not.toBe(original);
    expect(after?.usedLetters).toEqual(['B']);
    expect(after?.id).toBe(original.id);
  });

  it('persists the mutated state exactly once per update', () => {
    game.set(makeGame());
    updateGame((g) => {
      g.status = 'finished';
    });
    expect(saveGame).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveGame).mock.calls[0]?.[0]).toMatchObject({ status: 'finished' });
  });

  it('does nothing when no game is running', () => {
    const mutate = vi.fn();
    updateGame(mutate);
    expect(mutate).not.toHaveBeenCalled();
    expect(saveGame).not.toHaveBeenCalled();
    expect(get(game)).toBeNull();
  });
});
