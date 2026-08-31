// Verifies every language pack defines the same UI keys and category names.
// Usage: node scripts/check-i18n.mjs   (exit 1 on any gap)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const i18nDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'i18n');
const packFiles = readdirSync(i18nDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');

/** Extract the quoted keys of one `name: { ... }` object literal in the file. */
function blockKeys(source, blockName) {
  const start = source.indexOf(`${blockName}: {`);
  if (start === -1) return null;
  let depth = 0;
  let end = start;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = source.slice(start, end);
  return new Set([...body.matchAll(/'([^']+)':/g)].map((m) => m[1]));
}

const packs = packFiles.map((file) => {
  const source = readFileSync(join(i18nDir, file), 'utf8');
  return {
    file,
    ui: blockKeys(source, 'ui') ?? new Set(),
    categoryNames: blockKeys(source, 'categoryNames') ?? new Set(),
  };
});

let failed = false;
for (const section of ['ui', 'categoryNames']) {
  const union = new Set(packs.flatMap((p) => [...p[section]]));
  for (const pack of packs) {
    const missing = [...union].filter((k) => !pack[section].has(k));
    if (missing.length > 0) {
      failed = true;
      console.error(`${pack.file}: missing ${section} keys: ${missing.join(', ')}`);
    }
  }
}

if (failed) process.exit(1);
console.log(
  `i18n OK — ${String(packs.length)} packs, ${String(packs[0]?.ui.size ?? 0)} UI keys each`,
);
