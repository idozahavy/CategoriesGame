#!/usr/bin/env node
// Replaces exact hex color values with var(--color-*) equivalents, using the
// mapping baked into design/exports/tokens.css. Only replaces when a hex value
// maps to exactly one CSS variable. Usage:
//   node design/scripts/codemods/hex-to-token.mjs [--dry-run] <file> [<file> ...]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDesignRoot } from '../lib/tokens.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const designRoot = findDesignRoot(path.dirname(scriptDir));
const cssPath = path.join(designRoot, 'exports', 'tokens.css');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter((a) => a !== '--dry-run');

if (!existsSync(cssPath)) {
  console.error(`Cannot find ${cssPath}. Run build-style-guide.mjs first.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error('Usage: node design/scripts/codemods/hex-to-token.mjs [--dry-run] <file> [<file> ...]');
  process.exit(1);
}

// Parse tokens.css for `--name: #hex;` declarations.
const cssText = readFileSync(cssPath, 'utf8');
const VAR_DECL_RE = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;

const hexToVars = new Map(); // lowercase hex -> Set of var names
let m;
while ((m = VAR_DECL_RE.exec(cssText))) {
  const [, varName, hexValue] = m;
  const normalized = hexValue.toLowerCase();
  if (!hexToVars.has(normalized)) hexToVars.set(normalized, new Set());
  hexToVars.get(normalized).add(varName);
}

// Build a lookup of unique mappings only.
const uniqueMap = new Map(); // lowercase hex -> var name
const ambiguous = new Set();
for (const [hex, vars] of hexToVars.entries()) {
  if (vars.size === 1) {
    uniqueMap.set(hex, [...vars][0]);
  } else {
    ambiguous.add(hex);
  }
}

const HEX_LITERAL_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

let totalReplacements = 0;
const summary = [];

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`Skipping missing file: ${file}`);
    continue;
  }
  const original = readFileSync(file, 'utf8');
  let replacements = 0;
  const skippedAmbiguous = new Set();

  const updated = original.replace(HEX_LITERAL_RE, (hexLiteral) => {
    const normalized = hexLiteral.toLowerCase();
    if (uniqueMap.has(normalized)) {
      replacements++;
      return `var(${uniqueMap.get(normalized)})`;
    }
    if (ambiguous.has(normalized)) {
      skippedAmbiguous.add(hexLiteral);
    }
    return hexLiteral;
  });

  if (replacements > 0 && !dryRun) {
    writeFileSync(file, updated, 'utf8');
  }

  summary.push({
    file,
    replacements,
    skippedAmbiguous: [...skippedAmbiguous],
  });
  totalReplacements += replacements;
}

console.log(`hex-to-token${dryRun ? ' (dry run)' : ''}:`);
for (const s of summary) {
  console.log(`  ${s.file}: ${s.replacements} replacement(s)${s.skippedAmbiguous.length ? `, skipped ambiguous: ${s.skippedAmbiguous.join(', ')}` : ''}`);
}
console.log(`Total replacements: ${totalReplacements}${dryRun ? ' (not written — dry run)' : ''}`);
