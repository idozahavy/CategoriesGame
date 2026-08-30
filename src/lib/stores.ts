import { writable } from 'svelte/store';
import type { GameState, Screen } from './types';
import { saveGame } from './db';

export const screen = writable<Screen>('home');

export const game = writable<GameState | null>(null);

/** Update the running game and persist it to IndexedDB (fire-and-forget). */
export function updateGame(mutate: (g: GameState) => void): void {
  game.update((g) => {
    if (!g) return g;
    mutate(g);
    void saveGame(g);
    return g;
  });
}
