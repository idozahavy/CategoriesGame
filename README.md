# Categories! 🎪

A kid-friendly Scattergories-style word game. Play alone or together on one shared screen (phone-to-phone joining planned). No backend — a static web app.

## Features

- **Modes**: classic (one letter, all categories) or one category per round
- **Scoring**: unique-words-win-big (10 unique / 5 shared) or every-good-word-counts
- **Word checking**: hybrid — bundled word lists → public dictionary (Wiktionary) → group vote; selectable or off in advanced settings
- **Languages**: English (default) and Hebrew (RTL), extensible via language packs
- **Saves**: multiple games saved and resumed via IndexedDB
- **Timer**: optional, per turn (off / 3 min / 2 min / 1 min)

## Develop

```bash
npm install
npm run dev
```

- `npm run check` — type-check (svelte-check)
- `npm run verify:design` — design-scheme linter (tokens-only styling, contrast, RTL-safe CSS)
- `npm run build:styleguide` — regenerate `design/style-guide.html` + `design/exports/tokens.css` from `design/tokens.json`

## Design system

The full design scheme (tokens, components, rules, style guide) lives in [design/](design/) — see [design/scheme.md](design/scheme.md). UI work must follow the `design-system` skill in `.claude/skills/design-system/`.

## Stack

Svelte 5 + Vite + TypeScript · idb · self-hosted Nunito (via Fontsource)
