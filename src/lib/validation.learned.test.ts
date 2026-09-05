import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addLearnedWord, getLearnedWords, removeLearnedWord } from './db';

// IndexedDB is the boundary; the in-memory learned cache in front of it is
// module state, so every case imports a fresh copy of the module.
vi.mock('./db', () => ({
  getLearnedWords: vi.fn(() => Promise.resolve([])),
  addLearnedWord: vi.fn(() => Promise.resolve()),
  removeLearnedWord: vi.fn(() => Promise.resolve()),
}));

async function loadValidation(): Promise<typeof import('./validation')> {
  vi.resetModules();
  return import('./validation');
}

beforeEach(() => {
  vi.mocked(getLearnedWords).mockReset().mockResolvedValue([]);
  vi.mocked(addLearnedWord).mockReset().mockResolvedValue(undefined);
  vi.mocked(removeLearnedWord).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('learnWord', () => {
  it('stores the normalized word once, however it was typed', async () => {
    const { learnWord, inLearnedList } = await loadValidation();
    await learnWord('en', 'animal', '  Okapi ');
    await learnWord('en', 'animal', 'okapi');
    await learnWord('en', 'animal', 'OKAPI');
    expect(addLearnedWord).toHaveBeenCalledTimes(1);
    expect(addLearnedWord).toHaveBeenCalledWith('en', 'animal', 'okapi');
    await expect(inLearnedList('Okapi', 'animal', 'en')).resolves.toBe(true);
  });

  it('never learns under a custom category - its id would not survive to the next game', async () => {
    const { learnWord } = await loadValidation();
    await learnWord('en', 'c9f1a-custom', 'okapi');
    expect(addLearnedWord).not.toHaveBeenCalled();
  });

  it('never learns a lone letter', async () => {
    const { learnWord } = await loadValidation();
    await learnWord('en', 'animal', ' a ');
    expect(addLearnedWord).not.toHaveBeenCalled();
  });

  it('keeps the word for this session even when storage refuses to save it', async () => {
    vi.mocked(addLearnedWord).mockRejectedValue(new Error('quota'));
    const { learnWord, inLearnedList } = await loadValidation();
    await expect(learnWord('en', 'animal', 'okapi')).resolves.toBeUndefined();
    await expect(inLearnedList('okapi', 'animal', 'en')).resolves.toBe(true);
  });
});

describe('inLearnedList', () => {
  it('reads the stored list once per language and category, then answers from memory', async () => {
    vi.mocked(getLearnedWords).mockResolvedValue(['okapi', 'emu']);
    const { inLearnedList } = await loadValidation();
    await expect(inLearnedList('EMU', 'animal', 'en')).resolves.toBe(true);
    await expect(inLearnedList('yak', 'animal', 'en')).resolves.toBe(false);
    await expect(inLearnedList('okapi', 'food', 'en')).resolves.toBe(true);
    expect(getLearnedWords).toHaveBeenCalledTimes(2);
    expect(getLearnedWords).toHaveBeenCalledWith('en', 'animal');
    expect(getLearnedWords).toHaveBeenCalledWith('en', 'food');
  });

  it('behaves as if nothing was learned when storage is unavailable', async () => {
    vi.mocked(getLearnedWords).mockRejectedValue(new Error('blocked'));
    const { inLearnedList } = await loadValidation();
    await expect(inLearnedList('okapi', 'animal', 'en')).resolves.toBe(false);
  });
});

describe('forgetWord', () => {
  it('drops the word from memory and from storage', async () => {
    vi.mocked(getLearnedWords).mockResolvedValue(['okapi']);
    const { forgetWord, inLearnedList } = await loadValidation();
    await expect(inLearnedList('okapi', 'animal', 'en')).resolves.toBe(true);
    await forgetWord('en', 'animal', ' Okapi ');
    await expect(inLearnedList('okapi', 'animal', 'en')).resolves.toBe(false);
    expect(removeLearnedWord).toHaveBeenCalledWith('en', 'animal', 'okapi');
  });

  it('still removes from storage when the word was never loaded into memory', async () => {
    const { forgetWord } = await loadValidation();
    await forgetWord('en', 'animal', 'okapi');
    expect(removeLearnedWord).toHaveBeenCalledWith('en', 'animal', 'okapi');
    expect(getLearnedWords).not.toHaveBeenCalled();
  });

  it('does not throw when storage refuses the removal', async () => {
    vi.mocked(removeLearnedWord).mockRejectedValue(new Error('blocked'));
    const { forgetWord } = await loadValidation();
    await expect(forgetWord('en', 'animal', 'okapi')).resolves.toBeUndefined();
  });
});
