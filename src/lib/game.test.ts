import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createGame,
  drawWeighted,
  isFinished,
  matchesLetter,
  newId,
  normalizeWord,
  scoreRound,
  screenForGame,
  setAnswer,
  startNextRound,
  totalScores,
} from './game';
import { getPack } from './i18n';
import type { AnswerEntry, GameSettings, GameState, PlayerDef, RoundState } from './types';

function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    language: 'en',
    mode: 'classic',
    scoring: 'unique',
    validation: 'none',
    categories: [
      { id: 'animal', nameKey: 'animal' },
      { id: 'food', nameKey: 'food' },
    ],
    roundCount: 2,
    timerSeconds: null,
    ...overrides,
  };
}

function makePlayers(count: number): PlayerDef[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${String(i + 1)}`,
    name: `Player ${String(i + 1)}`,
    colorIndex: i + 1,
  }));
}

function answer(playerId: string, categoryId: string, word: string): AnswerEntry {
  return { playerId, categoryId, word, status: 'pending', points: 0 };
}

function makeRound(
  index: number,
  answers: AnswerEntry[],
  overrides: Partial<RoundState> = {},
): RoundState {
  return {
    index,
    letter: 'A',
    categoryIds: ['animal', 'food'],
    answers,
    phase: 'entry',
    activePlayerId: null,
    ...overrides,
  };
}

describe('normalizeWord', () => {
  it('trims and lowercases', () => {
    expect(normalizeWord('  Dog ')).toBe('dog');
    expect(normalizeWord('ÉCLAIR')).toBe('éclair');
  });
});

describe('matchesLetter', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(matchesLetter(' Apple', 'a')).toBe(true);
    expect(matchesLetter('apple', 'A')).toBe(true);
    expect(matchesLetter('banana', 'A')).toBe(false);
  });
});

describe('newId', () => {
  it('produces unique UUID-shaped ids', () => {
    const a = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(a);
  });
});

describe('startNextRound', () => {
  it('starts round 0 with all categories in classic mode', () => {
    const state = createGame(makeSettings(), makePlayers(2));
    const round = startNextRound(state);
    expect(round).not.toBeNull();
    expect(round?.index).toBe(0);
    expect(round?.categoryIds).toEqual(['animal', 'food']);
    expect(getPack('en').letters).toContain(round?.letter);
    expect(state.usedLetters).toContain(round?.letter);
  });

  it('uses exactly one of the selected categories per round in single mode', () => {
    const state = createGame(makeSettings({ mode: 'single', roundCount: 3 }), makePlayers(2));
    const first = startNextRound(state);
    expect(first?.categoryIds).toHaveLength(1);
    expect(['animal', 'food']).toContain(first?.categoryIds[0]);
    if (first) first.phase = 'done';
    const second = startNextRound(state);
    expect(second?.categoryIds).toHaveLength(1);
    expect(['animal', 'food']).toContain(second?.categoryIds[0]);
  });

  it('refuses while the current round is unfinished (double-tap guard)', () => {
    const state = createGame(makeSettings(), makePlayers(2));
    startNextRound(state);
    expect(startNextRound(state)).toBeNull();
    expect(state.rounds).toHaveLength(1);
  });

  it('stops at roundCount unless the game is endless', () => {
    const state = createGame(makeSettings({ roundCount: 1 }), makePlayers(2));
    const round = startNextRound(state);
    if (round) round.phase = 'done';
    expect(startNextRound(state)).toBeNull();

    const endless = createGame(makeSettings({ roundCount: 1, isEndless: true }), makePlayers(2));
    const r1 = startNextRound(endless);
    if (r1) r1.phase = 'done';
    expect(startNextRound(endless)).not.toBeNull();
  });
});

describe('drawWeighted', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined for an empty pool', () => {
    const empty: string[] = [];
    expect(drawWeighted(empty, () => 0)).toBeUndefined();
  });

  it('halves the chance of an item used once (weight 1/(1+uses))', () => {
    const uses = (item: string): number => (item === 'a' ? 1 : 0);
    // Weights: a=0.5, b=1, total=1.5 — rolls up to 0.5 land on 'a', the rest on 'b'.
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // roll 0.45
    expect(drawWeighted(['a', 'b'], uses)).toBe('a');
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // roll 0.6
    expect(drawWeighted(['a', 'b'], uses)).toBe('b');
  });

  it('still allows a repeat — used items keep a positive weight', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(drawWeighted(['a', 'b'], () => 5)).toBe('a');
  });
});

describe('setAnswer', () => {
  it('adds a trimmed answer and ignores empty new ones', () => {
    const round = makeRound(0, []);
    setAnswer(round, 'p1', 'animal', '  ant ');
    expect(round.answers).toEqual([answer('p1', 'animal', 'ant')]);
    setAnswer(round, 'p2', 'animal', '   ');
    expect(round.answers).toHaveLength(1);
  });

  it('resets status and points when an answer is replaced', () => {
    const round = makeRound(0, [{ ...answer('p1', 'animal', 'ant'), status: 'valid', points: 10 }]);
    setAnswer(round, 'p1', 'animal', 'ape');
    expect(round.answers[0]).toEqual(answer('p1', 'animal', 'ape'));
  });
});

describe('scoreRound', () => {
  function scored(state: GameState, round: RoundState): Map<string, number> {
    scoreRound(state, round);
    return new Map(round.answers.map((a) => [`${a.playerId}:${a.categoryId}`, a.points]));
  }

  it('unique scoring: unique 10, shared 5, invalid/empty 0', () => {
    const state = createGame(makeSettings(), makePlayers(3));
    const round = makeRound(0, [
      answer('p1', 'animal', 'Ant'),
      answer('p2', 'animal', ' ant '),
      answer('p3', 'animal', 'ape'),
      { ...answer('p1', 'food', 'apple'), status: 'invalid' },
      answer('p2', 'food', ''),
    ]);
    const points = scored(state, round);
    expect(points.get('p1:animal')).toBe(5); // same word as p2 after normalization
    expect(points.get('p2:animal')).toBe(5);
    expect(points.get('p3:animal')).toBe(10);
    expect(points.get('p1:food')).toBe(0);
    expect(points.get('p2:food')).toBe(0);
    expect(round.phase).toBe('done');
  });

  it('simple scoring: shared words still score full points', () => {
    const state = createGame(makeSettings({ scoring: 'simple' }), makePlayers(2));
    const round = makeRound(0, [answer('p1', 'animal', 'ant'), answer('p2', 'animal', 'ant')]);
    const points = scored(state, round);
    expect(points.get('p1:animal')).toBe(10);
    expect(points.get('p2:animal')).toBe(10);
  });

  it('speed scoring: each later rank loses a point, unranked share last place', () => {
    const state = createGame(makeSettings({ hasSpeedScoring: true }), makePlayers(3));
    const round = makeRound(
      0,
      [answer('p1', 'animal', 'ant'), answer('p2', 'animal', 'ape'), answer('p3', 'animal', 'asp')],
      { finishTimes: { p1: 1000, p2: 2000 } },
    );
    const points = scored(state, round);
    expect(points.get('p1:animal')).toBe(10); // rank 0
    expect(points.get('p2:animal')).toBe(9); // rank 1
    expect(points.get('p3:animal')).toBe(8); // no time — last rank (2)
  });

  it('speed scoring never drops a valid word below 1 point', () => {
    const players = makePlayers(6);
    const state = createGame(makeSettings({ hasSpeedScoring: true }), players);
    const finishTimes = Object.fromEntries(players.map((p, i) => [p.id, (i + 1) * 1000]));
    // Everyone wrote the same word: shared = 5 points before the speed deduction.
    const round = makeRound(
      0,
      players.map((p) => answer(p.id, 'animal', 'ant')),
      { finishTimes },
    );
    const points = scored(state, round);
    expect(points.get('p1:animal')).toBe(5);
    expect(points.get('p5:animal')).toBe(1); // 5 − 4
    expect(points.get('p6:animal')).toBe(1); // 5 − 5 floors at 1
  });
});

describe('totalScores', () => {
  it('sums points per player across rounds', () => {
    const state = createGame(makeSettings(), makePlayers(2));
    state.rounds = [
      makeRound(0, [{ ...answer('p1', 'animal', 'ant'), points: 10 }], { phase: 'done' }),
      makeRound(1, [{ ...answer('p1', 'food', 'apple'), points: 5 }], { phase: 'done' }),
    ];
    const totals = totalScores(state);
    expect(totals.get('p1')).toBe(15);
    expect(totals.get('p2')).toBe(0);
  });
});

describe('isFinished / screenForGame', () => {
  it('finishes when all configured rounds are done, never when endless', () => {
    const state = createGame(makeSettings({ roundCount: 1 }), makePlayers(1));
    state.rounds = [makeRound(0, [], { phase: 'done' })];
    expect(isFinished(state)).toBe(true);
    expect(screenForGame(state)).toBe('scoreboard');

    state.settings.isEndless = true;
    expect(isFinished(state)).toBe(false);
    expect(screenForGame(state)).toBe('review');
  });

  it('reopens on the round screen while entry is in progress', () => {
    const state = createGame(makeSettings(), makePlayers(1));
    state.rounds = [makeRound(0, [])];
    expect(screenForGame(state)).toBe('round');
  });
});

describe('scoreRound edge cases', () => {
  it('an invalid duplicate does not make the valid word count as shared', () => {
    const state = createGame(makeSettings(), makePlayers(2));
    const round = makeRound(0, [
      answer('p1', 'animal', 'Ant'),
      { ...answer('p2', 'animal', 'ant'), status: 'invalid' },
    ]);
    scoreRound(state, round);
    expect(round.answers[0]?.status).toBe('valid');
    expect(round.answers[0]?.points).toBe(10);
    expect(round.answers[1]?.points).toBe(0);
  });

  it('duplicate detection ignores case and surrounding whitespace', () => {
    const state = createGame(makeSettings(), makePlayers(2));
    const round = makeRound(0, [answer('p1', 'animal', 'ANT'), answer('p2', 'animal', '  ant ')]);
    scoreRound(state, round);
    expect(round.answers.map((a) => a.status)).toEqual(['shared', 'shared']);
  });

  it('marks the round done even when nobody answered', () => {
    const state = createGame(makeSettings(), makePlayers(2));
    const round = makeRound(0, []);
    scoreRound(state, round);
    expect(round.phase).toBe('done');
  });
});

describe('matchesLetter in non-Latin scripts', () => {
  it('matches Hebrew and Cyrillic first letters', () => {
    expect(matchesLetter('כלב', 'כ')).toBe(true);
    expect(matchesLetter('כלב', 'ל')).toBe(false);
    expect(matchesLetter('Собака', 'с')).toBe(true);
  });
});

describe('totalScores', () => {
  it('lists every player, including ones with no answers yet', () => {
    const state = createGame(makeSettings(), makePlayers(3));
    const scored = { ...answer('p1', 'animal', 'ant'), points: 10 };
    const round = makeRound(0, [scored], { phase: 'done' });
    state.rounds.push(round);
    const totals = totalScores(state);
    expect([...totals.entries()]).toEqual([
      ['p1', 10],
      ['p2', 0],
      ['p3', 0],
    ]);
  });
});
