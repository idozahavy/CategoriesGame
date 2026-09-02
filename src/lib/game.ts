import { getPack } from './i18n';
import type { CategoryDef, GameSettings, GameState, PlayerDef, RoundState, Screen } from './types';

export const DEFAULT_CATEGORY_IDS = ['animal', 'food', 'city', 'name', 'object'] as const;

/** Timer presets offered in setup and in the round-one settings editor. */
export const TIMER_OPTIONS: { value: number | null; key: string }[] = [
  { value: null, key: 'setup.timer.none' },
  { value: 180, key: 'setup.timer.relaxed' },
  { value: 120, key: 'setup.timer.normal' },
  { value: 60, key: 'setup.timer.fast' },
];

export function newId(): string {
  // crypto.randomUUID only exists in secure contexts (https/localhost) — plain-HTTP
  // LAN play needs the manual UUIDv4 path via getRandomValues.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

/**
 * Weighted random pick: every previous use of an item proportionally shrinks
 * its chance (weight 1/(1+uses)), so repeats stay possible but get rarer the
 * more often an item has already come up.
 */
export function drawWeighted<T>(pool: readonly T[], uses: (item: T) => number): T | undefined {
  const weights = pool.map((item) => 1 / (1 + uses(item)));
  let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function drawLetter(state: GameState): string {
  const letters = getPack(state.settings.language).letters;
  const counts = new Map<string, number>();
  for (const l of state.usedLetters) counts.set(l, (counts.get(l) ?? 0) + 1);
  return drawWeighted(letters, (l) => counts.get(l) ?? 0) ?? 'A';
}

/** Single mode: draw the round's category, past picks proportionally less likely. */
export function drawCategory(state: GameState): CategoryDef | undefined {
  const counts = new Map<string, number>();
  for (const r of state.rounds) {
    for (const id of r.categoryIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return drawWeighted(state.settings.categories, (c) => counts.get(c.id) ?? 0);
}

export function startNextRound(state: GameState): RoundState | null {
  // No-op past the configured round count, and while a round is still in
  // progress — so a double-tap on "Next round" cannot skip or add rounds.
  const current = state.rounds[state.rounds.length - 1];
  if (!state.settings.isEndless && state.rounds.length >= state.settings.roundCount) return null;
  if (current && current.phase !== 'done') return null;
  const letter = drawLetter(state);
  state.usedLetters.push(letter);
  const { mode, categories } = state.settings;
  const singleCategory = mode === 'single' ? drawCategory(state) : undefined;
  const categoryIds = singleCategory ? [singleCategory.id] : categories.map((c) => c.id);
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

/** Canonical form for comparing player words: trimmed, locale-lowercased. */
export function normalizeWord(word: string): string {
  return word.trim().toLocaleLowerCase();
}

/** Does the word start with the round letter (locale-insensitive)? */
export function matchesLetter(word: string, letter: string): boolean {
  return normalizeWord(word).startsWith(letter.toLocaleLowerCase());
}

/**
 * Finish rank per player for speed scoring: 0 = fastest. Players without a
 * recorded time (bots, never-submitted guests) all share the last rank.
 */
function speedRanks(state: GameState, round: RoundState): Map<string, number> {
  const times = round.finishTimes ?? {};
  const ranked = state.players
    .filter((p) => times[p.id] !== undefined)
    .sort((a, b) => (times[a.id] ?? 0) - (times[b.id] ?? 0));
  const ranks = new Map<string, number>();
  ranked.forEach((p, i) => ranks.set(p.id, i));
  for (const p of state.players) if (!ranks.has(p.id)) ranks.set(p.id, ranked.length);
  return ranks;
}

/** Points for a valid word (any valid word in 'simple' scoring, unique ones in 'unique'). */
const VALID_POINTS = 10;
/** Points when another player wrote the same word ('unique' scoring only). */
const SHARED_POINTS = 5;
/** speedScoring never drops a valid word below this. */
const MIN_SPEED_POINTS = 1;

/**
 * Assign points after validity was decided (answers with status 'invalid' stay 0).
 * unique: unique valid word 10, shared valid word 5. simple: any valid word 10.
 * speedScoring: each finish rank after the fastest loses 1 point, never below 1.
 */
export function scoreRound(state: GameState, round: RoundState): void {
  const { scoring, hasSpeedScoring } = state.settings;
  const ranks = hasSpeedScoring === true ? speedRanks(state, round) : null;
  for (const categoryId of round.categoryIds) {
    const inCategory = round.answers.filter((a) => a.categoryId === categoryId);
    for (const answer of inCategory) {
      if (answer.status === 'invalid' || answer.word === '') {
        answer.points = 0;
        continue;
      }
      const sameWord = inCategory.filter(
        (o) =>
          o !== answer &&
          o.status !== 'invalid' &&
          normalizeWord(o.word) === normalizeWord(answer.word),
      );
      if (scoring === 'unique' && sameWord.length > 0) {
        answer.status = 'shared';
        answer.points = SHARED_POINTS;
      } else {
        answer.status = 'valid';
        answer.points = VALID_POINTS;
      }
      if (ranks) {
        answer.points = Math.max(
          answer.points - (ranks.get(answer.playerId) ?? 0),
          MIN_SPEED_POINTS,
        );
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

/**
 * Which screen a loaded (resumed/restored) game should open on. Scoreboard is
 * strictly the end-of-game screen (mounting it finalizes the game), so an
 * unfinished game with a scored round reopens on Review — it has the
 * "next round" / "see scores" actions.
 */
export function screenForGame(state: GameState): Screen {
  if (state.status === 'finished' || isFinished(state)) return 'scoreboard';
  const current = state.rounds[state.currentRound];
  if (!current || current.phase === 'entry') return 'round';
  return 'review';
}

export function isFinished(state: GameState): boolean {
  if (state.settings.isEndless) return false; // ends only when someone taps "See scores"
  return state.rounds.filter((r) => r.phase === 'done').length >= state.settings.roundCount;
}
