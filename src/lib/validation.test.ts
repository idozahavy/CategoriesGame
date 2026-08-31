import { describe, expect, it } from 'vitest';

import { checkWord, inBundledList, type WordCheckOptions } from './validation';
import { ensureWords } from './words';

function opts(overrides: Partial<WordCheckOptions> = {}): WordCheckOptions {
  return {
    categoryId: 'animal',
    letter: 'a',
    language: 'en',
    mode: 'bundled',
    ...overrides,
  };
}

describe('checkWord letter rules (no network)', () => {
  it('rejects lone letters and words on the wrong letter', async () => {
    await expect(checkWord('a', opts())).resolves.toBe('invalid');
    await expect(checkWord('  b ', opts())).resolves.toBe('invalid');
    await expect(checkWord('dog', opts())).resolves.toBe('invalid');
  });

  it('solo play accepts any word that fits the letter, without lookups', async () => {
    await expect(checkWord('axolotl', opts({ solo: true, mode: 'hybrid' }))).resolves.toBe('valid');
  });

  it("mode 'none' accepts and mode 'vote' defers to the group", async () => {
    await expect(checkWord('ant', opts({ mode: 'none' }))).resolves.toBe('valid');
    await expect(checkWord('ant', opts({ mode: 'vote' }))).resolves.toBe('vote');
  });
});

describe("checkWord mode 'bundled' (offline word lists)", () => {
  it('accepts a word from the bundled list', async () => {
    await expect(checkWord('Ant', opts())).resolves.toBe('valid');
    await expect(checkWord(' alligator ', opts())).resolves.toBe('valid');
  });

  it('sends an unknown word to the group vote', async () => {
    await expect(checkWord('aqzzt', opts())).resolves.toBe('vote');
  });
});

describe('inBundledList', () => {
  it('matches nothing before the language is loaded, case-insensitively after', async () => {
    expect(inBundledList('hormiga', 'animal', 'es-not-loaded')).toBe(false);
    await ensureWords('en');
    expect(inBundledList(' ANT ', 'animal', 'en')).toBe(true);
    expect(inBundledList('ant', 'no-such-category', 'en')).toBe(false);
  });
});
