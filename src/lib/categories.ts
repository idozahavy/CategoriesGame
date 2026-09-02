/** Built-in category emoji, shared by every screen that renders a category chip or card. */
import type { CategoryDef } from './types';

export const CATEGORY_EMOJI: Record<string, string> = {
  animal: '🐶',
  food: '🍕',
  city: '🏙️',
  country: '🌍',
  name: '🧑',
  plant: '🌸',
  profession: '💼',
  object: '📦',
  sport: '⚽',
  color: '🎨',
  fruit: '🍎',
  ocean: '🐠',
  vehicle: '🚗',
  kitchen: '🍴',
  clothing: '👕',
  body: '👃',
};

export const DEFAULT_EMOJI = '📝';

/** Custom category's own emoji first, then the built-in map, then the fallback. */
export function categoryEmoji(cat: CategoryDef | string): string {
  if (typeof cat === 'string') return CATEGORY_EMOJI[cat] ?? DEFAULT_EMOJI;
  return cat.emoji ?? CATEGORY_EMOJI[cat.id] ?? DEFAULT_EMOJI;
}
