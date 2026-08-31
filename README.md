# Categories! 🎪

A kid-friendly Scattergories-style word game. Play alone, together on one shared screen, or with everyone joining from their own phone via a room code (WebRTC, no backend — a static web app).

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
- `npm run check:i18n` — every language pack must define every UI key and category name
- `npm run verify:design` — design-scheme linter (tokens-only styling, contrast, RTL-safe CSS)
- `npm run build:styleguide` — regenerate `design/style-guide.html` + `design/exports/tokens.css` from `design/tokens.json`

## Adding a language

1. Copy `src/lib/i18n/en.ts` to `<code>.ts` and translate every `ui` string and `categoryNames` entry; set `code`, native `name`, `dir` (`ltr`/`rtl`), and the `letters` the round wheel may draw.
2. Add a word list module in `src/lib/words/<code>.ts` (categoryId → lowercase words) and reference it from the pack.
3. Register the pack in the `packs` map in `src/lib/i18n/index.ts`.
4. Run `npm run check:i18n` — it fails if any key is missing. The language then appears automatically in the Home switcher and the game-language setting; RTL layouts come free via logical CSS.

## Design system

The full design scheme (tokens, components, rules, style guide) lives in [design/](design/) — see [design/scheme.md](design/scheme.md). UI work must follow the `design-system` skill in `.claude/skills/design-system/`.

## Stack

Svelte 5 + Vite + TypeScript · idb · self-hosted Nunito (via Fontsource)
