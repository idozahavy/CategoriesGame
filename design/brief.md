# Design Brief — CategoriesGame

_Recorded 2026-08-30 (Phase 2 interview). Revisions must re-read intent from this file._

## Product
A categories (Scattergories-style) word game web app.
- Play alone or multiplayer.
- Multiplayer: pass-&-play on one shared main screen (Kahoot-style projector/TV use) first; WebRTC room-code joining from phones added on top.
- Multiple modes: one letter for all categories (classic), or one category + letter per round.
- Multi-language content and UI; word validation hybrid (bundled lists → public dictionary → group vote), selectable in settings.
- Game state saved/resumed via IndexedDB (multiple saves).
- Stack: Svelte + Vite + TypeScript, no backend API, static build.

## Users
Children and up. Family/party/classroom settings. Low technical level assumed.
→ Minimum 16px body text, 48px touch targets, minimal buttons per screen, minimal distractions.

## Feeling
Playful, friendly, simple, warm, energetic-but-not-chaotic.

## References
- **Duolingo** — friendly and rounded: soft shapes, cheerful but calm palette, approachable for kids.

## Anti-preferences checklist
- (none — designer's choice; no hard constraints recorded)

## Themes
Light AND dark; **light is primary** (designed first, default).

## Content & environment
- Dominant content: short words/word lists, timers, scores, forms (name/word entry).
- Screen patterns: wizard flow (setup), game round screen, scoreboard, lobby.
- Devices: both desktop/TV (main screen, viewed at distance) and mobile touch (players). Touch-first sizing.
- Languages: multi-language incl. RTL → **logical CSS properties only** (`margin-inline-start` etc.) is a locked scheme rule.
- Numbers: scores need tabular figures.

## Brand
No existing brand assets. New identity from scratch.

## Personality picks
- playful (vs serious)
- expressive-but-tidy (playful shapes/colors, minimal on-screen elements)
- microcopy voice: friendly, simple words a child can read

## Specifics
- Color mood: **candy-bright & playful** (saturated pinks/teals/oranges, toy-like), tempered for AA text contrast.
- Typography: **rounded & friendly** (Nunito/Quicksand-style), self-hosted or system only, must extend to multi-script/RTL.
- Shape: rounded (implied by reference + typography choice).
- Motion: **playful but purposeful** — bouncy tap feedback, timer pulses, score count-ups, confetti on wins; never animate during typing/thinking moments. Reduced-motion variants required.
- Accessibility: **WCAG AA + kid-friendly sizes** — 4.5:1 body contrast, ≥16px body, ≥48px touch targets.
- Theming: light + dark, user-selectable, light primary.
- Constraints: offline-capable app → loading/empty/error states matter; shared-screen legibility at distance (big scores, big letters).
- Longevity: **long-lived product** → verify strictness: error-heavy (hardcoded values are errors).
