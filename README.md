# Kategoria 🎪

**Play it:** https://kategoria.pages.dev · **Source:** https://github.com/idozahavy/Kategoria

A kid-friendly Scattergories-style word game. Play alone, together on one shared screen, or with everyone joining from their own phone via a room code (WebRTC — a static web app, plus one tiny optional Pages Function for TURN credentials).

## Features

- **Modes**: classic (one letter, all categories) or one category per round
- **Scoring**: unique-words-win-big (10 unique / 5 shared) or every-good-word-counts
- **Word checking**: hybrid — bundled word lists → learned words → Wikidata category check → public dictionary (Wiktionary) → group vote; selectable or off in advanced settings
- **Languages**: English, Hebrew (RTL), Spanish, Arabic (RTL), French and Russian, extensible via language packs
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
2. Add a word list at `src/lib/words/<code>.json` (categoryId → lowercase words) — it is picked up by filename and lazy-loaded when the language is first played.
3. Register the pack in the `packs` map in `src/lib/i18n/index.ts`.
4. Run `npm run check:i18n` — it fails if any key is missing. The language then appears automatically in the Home switcher and the game-language setting; RTL layouts come free via logical CSS.

## Remote rooms (WebRTC + TURN)

Phones-join rooms use PeerJS: the free public broker for signaling, then a direct peer-to-peer connection. Direct connections fail on restrictive networks (cellular ↔ WiFi, office firewalls), so on Cloudflare deploys a Pages Function ([functions/turn-credentials.ts](functions/turn-credentials.ts)) mints short-lived TURN relay credentials from Cloudflare Realtime. One-time setup per Pages project:

1. Cloudflare dashboard → **Realtime → TURN** → create a TURN key (note its **Key ID** and **API token**).
2. ```bash
   npx wrangler pages secret put TURN_KEY_ID --project-name=kategoria
   ```
3. ```bash
   npx wrangler pages secret put TURN_API_TOKEN --project-name=kategoria
   ```
4. Redeploy (`npm run deploy`) so the function ships.
5. Recommended: add a **rate-limiting rule** for the path `/turn-credentials` (dashboard → your zone/site → Security → WAF → Rate limiting rules; e.g. 10 requests per minute per IP). The function already rejects cross-origin callers (403), but a scripted caller can forge headers — the rate limit caps how much relay quota anyone could mint.

Without the secrets — and in local dev, where the endpoint doesn't exist — the app silently falls back to STUN-only, and same-network play works exactly as before. Security headers for the deployed site live in [public/_headers](public/_headers).

## Design system

The full design scheme (tokens, components, rules, style guide) lives in [design/](design/) — see [design/scheme.md](design/scheme.md). UI work must follow the `design-system` skill in `.claude/skills/design-system/`.

## Stack

Svelte 5 + Vite + TypeScript · idb · peerjs (WebRTC rooms) · qrcode · vite-plugin-pwa · self-hosted Nunito (via Fontsource)
