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
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null; // storage unavailable — nothing to restore
  }
}

/** Called reactively from App.svelte on every screen/game change. */
export function persistActiveGame(screen: Screen, game: GameState | null): void {
  try {
    if (game && GAME_SCREENS.includes(screen) && game.status !== 'finished') {
      localStorage.setItem(SESSION_KEY, game.id);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // storage unavailable — reload just won't restore the game
  }
}
