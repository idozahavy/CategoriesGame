/** Core game domain types — the shared contract for all screens and services. */

export type LanguageCode = string; // BCP-47-ish short code: 'en', 'he', ...

/**
 * classic: one letter per round, players fill ALL categories (usual gameplay).
 * single: one letter + ONE category per round.
 */
export type GameMode = 'classic' | 'single';

/**
 * unique: valid unique answer = 10, valid but shared with another player = 5, invalid = 0.
 * simple: any valid answer = 10.
 */
export type ScoringSystem = 'unique' | 'simple';

/** Word checking strategy (advanced settings can change it; 'none' = don't check). */
export type ValidationMode = 'hybrid' | 'bundled' | 'dictionary' | 'vote' | 'none';

export interface CategoryDef {
  id: string;
  /** i18n key for built-in categories (resolved via language pack). */
  nameKey?: string;
  /** User-created category name (advanced settings). */
  customName?: string;
  emoji?: string;
}

export interface PlayerDef {
  id: string;
  name: string;
  /** 1..8 — maps to --color-player-N token. */
  colorIndex: number;
}

export interface GameSettings {
  language: LanguageCode;
  mode: GameMode;
  scoring: ScoringSystem;
  validation: ValidationMode;
  categories: CategoryDef[];
  roundCount: number;
  /** null = no timer. */
  timerSeconds: number | null;
}

export type AnswerStatus = 'pending' | 'valid' | 'shared' | 'invalid';

export interface AnswerEntry {
  playerId: string;
  categoryId: string;
  word: string;
  status: AnswerStatus;
  points: number;
}

export type RoundPhase = 'entry' | 'review' | 'done';

export interface RoundState {
  index: number;
  letter: string;
  /** Categories in play this round (one entry in 'single' mode). */
  categoryIds: string[];
  answers: AnswerEntry[];
  phase: RoundPhase;
  /** Which player is currently entering words (pass-&-play), null = simultaneous/host. */
  activePlayerId: string | null;
}

export type GameStatus = 'setup' | 'playing' | 'finished';

export interface GameState {
  id: string;
  createdAt: number;
  updatedAt: number;
  settings: GameSettings;
  players: PlayerDef[];
  rounds: RoundState[];
  currentRound: number;
  usedLetters: string[];
  status: GameStatus;
}

/** Summary row shown in the Resume list (cheap to read, no full state). */
export interface SaveSummary {
  id: string;
  updatedAt: number;
  playerNames: string[];
  roundsPlayed: number;
  roundCount: number;
  language: LanguageCode;
  status: GameStatus;
}

export type Screen =
  | 'home'
  | 'new-game'
  | 'join'
  | 'resume'
  | 'round'
  | 'review'
  | 'scoreboard';

/** A language pack bundles UI strings + game content for one language. */
export interface LanguagePack {
  code: LanguageCode;
  /** Native display name, e.g. "English", "עברית". */
  name: string;
  dir: 'ltr' | 'rtl';
  /** Letters the round wheel may draw. */
  letters: string[];
  /** UI strings. */
  ui: Record<string, string>;
  /** Built-in category names by nameKey. */
  categoryNames: Record<string, string>;
  /** Bundled word lists: categoryId -> lowercase words (may be partial). */
  words: Record<string, string[]>;
}
