import { describe, expect, it } from 'vitest';

import { CATEGORY_EMOJI, categoryEmoji, DEFAULT_EMOJI } from './categories';

describe('categoryEmoji', () => {
  it('resolves built-in categories by id, as a string or a def', () => {
    expect(categoryEmoji('animal')).toBe(CATEGORY_EMOJI['animal']);
    expect(categoryEmoji({ id: 'animal', nameKey: 'animal' })).toBe(CATEGORY_EMOJI['animal']);
  });

  it("prefers a custom category's own emoji", () => {
    expect(categoryEmoji({ id: 'animal', emoji: '🦖' })).toBe('🦖');
  });

  it('falls back to the default for unknown categories', () => {
    expect(categoryEmoji('no-such-category')).toBe(DEFAULT_EMOJI);
    expect(categoryEmoji({ id: 'custom-1', customName: 'Dinosaurs' })).toBe(DEFAULT_EMOJI);
  });
});
