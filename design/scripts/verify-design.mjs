#!/usr/bin/env node
// Design-rule linter. Scans src/**/*.{svelte,ts,css,html} and design/tokens.json.
// Prints a JSON array of findings to stdout (or a table with --pretty).
// Exit code 1 if any error-severity finding exists, else 0.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readJson,
  findDesignRoot,
  flattenAndResolve,
  isHexColor,
  contrastRatio,
  CONTRAST_PAIRS,
} from './lib/tokens.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const designRoot = findDesignRoot(scriptDir);
const repoRoot = path.dirname(designRoot);
const srcRoot = path.join(repoRoot, 'src');
const tokensPath = path.join(designRoot, 'tokens.json');
const schemePath = path.join(designRoot, 'scheme.md');

const pretty = process.argv.includes('--pretty');

const findings = [];
function addFinding(file, line, rule, severity) {
  findings.push({ file, line, rule, severity });
}

// ---------------------------------------------------------------------------
// Gather source files
// ---------------------------------------------------------------------------

const SRC_EXTENSIONS = new Set(['.svelte', '.ts', '.css', '.html']);

function walkDir(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkDir(full, out);
    } else if (SRC_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const srcFiles = existsSync(srcRoot) ? walkDir(srcRoot, []) : [];

// ---------------------------------------------------------------------------
// Quarantine list from design/scheme.md "## Quarantine" section
// ---------------------------------------------------------------------------

function readQuarantineList() {
  if (!existsSync(schemePath)) return new Set();
  const text = readFileSync(schemePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^##\s+Quarantine\s*$/i.test(l.trim()));
  if (startIdx === -1) return new Set();
  const paths = new Set();
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line.trim())) break; // next section
    const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (m) {
      paths.add(m[1].trim().replace(/`/g, ''));
    }
  }
  return paths;
}

const quarantine = readQuarantineList();

function isQuarantined(absFile) {
  const rel = path.relative(repoRoot, absFile).split(path.sep).join('/');
  for (const q of quarantine) {
    const normalizedQ = q.split(path.sep).join('/');
    if (rel === normalizedQ || rel.startsWith(normalizedQ.replace(/\/$/, '') + '/')) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Per-file line-based rules
// ---------------------------------------------------------------------------

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
const RGB_HSL_RE = /\b(?:rgb|rgba|hsl|hsla)\s*\(/g;
const DESIGN_IGNORE_RE = /\/\*\s*design-ignore:\s*[^*]*\*\//;
const SPACING_PROP_RE = /\b(margin(?:-block(?:-start|-end)?|-inline(?:-start|-end)?|-top|-bottom|-left|-right)?|padding(?:-block(?:-start|-end)?|-inline(?:-start|-end)?|-top|-bottom|-left|-right)?|gap|row-gap|column-gap|inset(?:-block(?:-start|-end)?|-inline(?:-start|-end)?|-top|-bottom|-left|-right)?)\s*:\s*([^;]+);/g;
const PX_RE = /(-?\d+(?:\.\d+)?)px/g;
const ALLOWED_SPACING_PX = new Set([0, 4, 8, 12, 16, 24, 32, 48]);
const FONT_FAMILY_RE = /font-family\s*:\s*([^;]+);/g;
const URL_FONT_RE = /url\(\s*['"]?(https?:)?\/\/[^)'"]*\.(?:woff2?|ttf|otf|eot)[^)'"]*['"]?\s*\)/gi;
const LINK_FONT_RE = /<link[^>]+href\s*=\s*["'](https?:)\/\/[^"']*(?:font|Font)[^"']*["'][^>]*>/g;
const AT_IMPORT_FONT_RE = /@import\s+(?:url\()?["']?(https?:)\/\/[^"')]*(?:font|Font)[^"')]*["']?\)?/g;
const PHYSICAL_PROP_RE = /\b(margin-left|margin-right|padding-left|padding-right|left|right)\s*:/g;

for (const file of srcFiles) {
  const rel = path.relative(repoRoot, file).split(path.sep).join('/');
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const quarantined = isQuarantined(file);

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    // An inline pragma suppresses every rule on its line (collected in the debt report).
    const hasIgnorePragma = DESIGN_IGNORE_RE.test(lineText);
    if (hasIgnorePragma) return;

    // hardcoded-color
    if (!quarantined && !hasIgnorePragma) {
      const hexMatches = lineText.match(HEX_RE);
      if (hexMatches) {
        addFinding(rel, lineNum, 'hardcoded-color', 'error');
      } else if (RGB_HSL_RE.test(lineText)) {
        addFinding(rel, lineNum, 'hardcoded-color', 'error');
      }
      RGB_HSL_RE.lastIndex = 0;
    }

    // off-scale-spacing
    let spacingMatch;
    SPACING_PROP_RE.lastIndex = 0;
    while ((spacingMatch = SPACING_PROP_RE.exec(lineText))) {
      const valueText = spacingMatch[2];
      let pxMatch;
      PX_RE.lastIndex = 0;
      while ((pxMatch = PX_RE.exec(valueText))) {
        const num = Math.abs(parseFloat(pxMatch[1]));
        if (!ALLOWED_SPACING_PX.has(num)) {
          addFinding(rel, lineNum, 'off-scale-spacing', 'error');
        }
      }
    }

    // foreign-font
    let fontMatch;
    FONT_FAMILY_RE.lastIndex = 0;
    const CASCADE_KEYWORDS = new Set(['inherit', 'unset', 'initial', 'revert', 'revert-layer']);
    while ((fontMatch = FONT_FAMILY_RE.exec(lineText))) {
      const value = fontMatch[1].trim();
      if (CASCADE_KEYWORDS.has(value)) continue; // defers to an ancestor's font-family, not a foreign font itself
      if (!value.includes('Nunito') && !value.includes('var(--font-family-base)')) {
        addFinding(rel, lineNum, 'foreign-font', 'error');
      }
    }

    // external-font-url
    if (URL_FONT_RE.test(lineText) || LINK_FONT_RE.test(lineText) || AT_IMPORT_FONT_RE.test(lineText)) {
      addFinding(rel, lineNum, 'external-font-url', 'error');
    }
    URL_FONT_RE.lastIndex = 0;
    LINK_FONT_RE.lastIndex = 0;
    AT_IMPORT_FONT_RE.lastIndex = 0;

    // physical-property (CSS-ish files only)
    if (path.extname(file) === '.css' || path.extname(file) === '.svelte' || path.extname(file) === '.html') {
      if (PHYSICAL_PROP_RE.test(lineText)) {
        addFinding(rel, lineNum, 'physical-property', 'warn');
      }
      PHYSICAL_PROP_RE.lastIndex = 0;
    }
  });
}

// design-ignore debt report
let ignoreCount = 0;
for (const file of srcFiles) {
  const text = readFileSync(file, 'utf8');
  const matches = text.match(/\/\*\s*design-ignore:/g);
  if (matches) ignoreCount += matches.length;
}

// ---------------------------------------------------------------------------
// tokens-schema rule
// ---------------------------------------------------------------------------

const tokensRelPath = path.relative(repoRoot, tokensPath).split(path.sep).join('/');
let tokens;
try {
  tokens = readJson(tokensPath);
} catch (err) {
  addFinding(tokensRelPath, 1, 'tokens-schema', 'error');
  tokens = null;
}

let flat = {};
if (tokens) {
  const primitives = tokens.color?.primitive || {};
  for (const [name, node] of Object.entries(primitives)) {
    if (!node || !isHexColor(node.$value)) {
      addFinding(tokensRelPath, 1, 'tokens-schema', 'error');
    }
  }
  for (const theme of ['light', 'dark']) {
    const semanticGroup = tokens.color?.[theme] || {};
    for (const [key, node] of Object.entries(semanticGroup)) {
      if (key.startsWith('$')) continue;
      const ref = node && node.$value;
      const m = typeof ref === 'string' && ref.match(/^\{color\.primitive\.([^}]+)\}$/);
      if (!m || !primitives[m[1]]) {
        addFinding(tokensRelPath, 1, 'tokens-schema', 'error');
      }
    }
  }

  const resolved = flattenAndResolve(tokens);
  flat = resolved.flat;
  for (const e of resolved.errors) {
    addFinding(tokensRelPath, 1, 'tokens-schema', 'error');
  }
}

// ---------------------------------------------------------------------------
// contrast rule
// ---------------------------------------------------------------------------

if (tokens) {
  for (const theme of ['light', 'dark']) {
    for (const [fgKey, bgKey] of CONTRAST_PAIRS) {
      const fg = flat[`color.${theme}.${fgKey}`];
      const bg = flat[`color.${theme}.${bgKey}`];
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) {
        addFinding(tokensRelPath, 1, `contrast:${theme}:${fgKey}-on-${bgKey}:${ratio.toFixed(2)}`, 'error');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Debt report
// ---------------------------------------------------------------------------

findings.push({ rule: 'debt-report', severity: 'warn', count: ignoreCount });

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (pretty) {
  const rows = findings.map((f) =>
    'file' in f
      ? [f.file, String(f.line), f.rule, f.severity]
      : ['-', '-', `${f.rule} (count=${f.count})`, f.severity]
  );
  const header = ['file', 'line', 'rule', 'severity'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const printRow = (r) => console.log(r.map((c, i) => c.padEnd(widths[i])).join('  '));
  printRow(header);
  printRow(widths.map((w) => '-'.repeat(w)));
  for (const r of rows) printRow(r);
} else {
  console.log(JSON.stringify(findings, null, 2));
}

const hasError = findings.some((f) => f.severity === 'error');
process.exit(hasError ? 1 : 0);
