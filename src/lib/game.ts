import type { GameSettings, GameState, PlayerDef, RoundState } from './types';
import { getPack } from './i18n';

export const DEFAULT_CATEGORY_IDS = ['animal', 'food', 'city', 'name', 'object'] as const;

export function newId(): string {
  return crypto.randomUUID();
}

export function createGame(settings: GameSettings, players: PlayerDef[]): GameState {
  const now = Date.now();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    settings,
    players,
    rounds: [],
    currentRound: 0,
    usedLetters: [],
    status: 'playing',
  };
}

export function drawLetter(state: GameState): string {
  const letters = getPack(state.settings.language).letters;
  const unused = letters.filter((l) => !state.usedLetters.includes(l));
  const pool = unused.length > 0 ? unused : letters;
  const letter = pool[Math.floor(Math.random() * pool.length)] ?? 'A';
  return letter;
}

export function startNextRound(state: GameState): RoundState {
  const letter = drawLetter(state);
  state.usedLetters.push(letter);
  const { mode, categories } = state.settings;
  const singleCategory = categories[state.rounds.length % categories.length] ?? categories[0];
  const categoryIds =
    mode === 'single' && singleCategory ? [singleCategory.id] : categories.map((c) => c.id);
  const round: RoundState = {
    index: state.rounds.length,
    letter,
    categoryIds,
    answers: [],
    phase: 'entry',
    activePlayerId: state.players[0]?.id ?? null,
  };
  state.rounds.push(round);
  state.currentRound = round.index;
  return round;
}

export function setAnswer(
  round: RoundState,
  playerId: string,
  categoryId: string,
  word: string,
): void {
  const existing = round.answers.find(
    (a) => a.playerId === playerId && a.categoryId === categoryId,
  );
  const trimmed = word.trim();
  if (existing) {
    existing.word = trimmed;
    existing.status = 'pending';
    existing.points = 0;
  } else if (trimmed !== '') {
    round.answers.push({ playerId, categoryId, word: trimmed, status: 'pending', points: 0 });
  }
}

function normalize(word: string): string {
  return word.trim().toLocaleLowerCase();
}

/** Does the word start with the round letter (locale-insensitive)? */
export function matchesLetter(word: string, letter: string): boolean {
  return normalize(word).startsWith(letter.toLocaleLowerCase());
}

/**
 * Assign points after validity was decided (answers with status 'invalid' stay 0).
 * unique: unique valid word 10, shared valid word 5. simple: any valid word 10.
 */
export function scoreRound(state: GameState, round: RoundState): void {
  const { scoring } = state.settings;
  for (const categoryId of round.categoryIds) {
    const inCategory = round.answers.filter((a) => a.categoryId === categoryId);
    for (const answer of inCategory) {
      if (answer.status === 'invalid' || answer.word === '') {
        answer.points = 0;
        continue;
      }
      const sameWord = inCategory.filter(
        (o) =>
          o !== answer && o.status !== 'invalid' && normalize(o.word) === normalize(answer.word),
      );
      if (scoring === 'unique' && sameWord.length > 0) {
        answer.status = 'shared';
        answer.points = 5;
      } else {
        answer.status = 'valid';
        answer.points = 10;
      }
    }
  }
  round.phase = 'done';
}

export function totalScores(state: GameState): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of state.players) totals.set(p.id, 0);
  for (const round of state.rounds) {
    for (const a of round.answers) {
      totals.set(a.playerId, (totals.get(a.playerId) ?? 0) + a.points);
    }
  }
  return totals;
}

export function isFinished(state: GameState): boolean {
  return state.rounds.filter((r) => r.phase === 'done').length >= state.settings.roundCount;
}
