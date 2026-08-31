import { matchesLetter } from './game';
import { ensureWords, getWords } from './words';

/** The robot player: picks words from the bundled lists on its turn. */

export const BOT_AVATAR = '🤖';

/** Chance the robot fills any given category — keeps it beatable for kids. */
const BOT_FILL_RATE = 0.65;

/** How long the robot pretends to think before answering. */
export const BOT_THINK_MS = 1400;

export async function botAnswers(
  language: string,
  letter: string,
  categoryIds: string[],
): Promise<Record<string, string>> {
  await ensureWords(language);
  const lists = getWords(language);
  const answers: Record<string, string> = {};
  for (const categoryId of categoryIds) {
    if (Math.random() > BOT_FILL_RATE) continue;
    const candidates = (lists[categoryId] ?? []).filter((w) => matchesLetter(w, letter));
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (pick !== undefined) answers[categoryId] = pick;
  }
  return answers;
}
