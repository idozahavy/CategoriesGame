import { readStorage, removeStorage, writeStorage } from './storage';
import type { GameState, Screen } from './types';

/**
 * Remembers which game was on screen so a page reload (or the mobile browser
 * discarding the tab) drops the player back into the running game instead of
 * the home screen. Only the game id is stored — the state itself lives in
 * IndexedDB and the screen is re-derived from the loaded game's phase.
 */

const SESSION_KEY = 'categories-active-game';

/** Screens that show a running game and are worth returning to after a reload. */
const GAME_SCREENS: readonly Screen[] = ['round', 'review', 'scoreboard'];

export function readActiveGameId(): string | null {
  return readStorage(SESSION_KEY);
}

/** Called reactively from App.svelte on every screen/game change. */
export function persistActiveGame(screen: Screen, game: GameState | null): void {
  if (game && GAME_SCREENS.includes(screen) && game.status !== 'finished') {
    writeStorage(SESSION_KEY, game.id);
  } else {
    removeStorage(SESSION_KEY);
  }
}
