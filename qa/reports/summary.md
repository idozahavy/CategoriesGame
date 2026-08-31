# QA summary — playtest swarm 2026-08-31 (4 Sonnet players)

Personas: rusher (P1), completionist (P2), chaos (P3), explorer/Join-Game (P4).
Fun scores: 6 / 8 / 7 / 7. Zero console errors and no XSS across all runs.

## Top issues by priority

**P0 — Rapid-click navigation bypasses guards (two symptoms, one root cause class)**

- Spam-clicking "Next" on an EMPTY player step skips all wizard validation → playable game with phantom "Player 1" and no mode/category choices (P3, repro'd end-to-end).
- Double-clicking "Next round" on Review skips an entire round (1→3 of 3) (P1).
  Buttons never disable while a transition is in flight; step/round advance isn't idempotent.

**P0 — Round counter off-by-one: "Round 4 of 3"**
After the final round, "Next round" still appeared and started an extra round labeled
"Round 4 of 3"; only after playing it did "See scores" show (P1). `startNextRound` /
the is-last-round check needs a hard bound.

**P1 — Save list grows unbounded and keeps finished games**
One playthrough produced 3 separate save entries ("Round 1/2/3 of 3") instead of one
updated slot, and completed games remain resumable forever — Continue just reopens the
scoreboard (P3). Needs investigation: same game id should upsert one record.

**P2 — Silent no-ops confuse kids**
Next with empty name does nothing (no message); custom category rejected (too long/empty)
with zero feedback; duplicate player names accepted; default 5-of-10 category preselection
unexplained (P1, P2, P3).

**P2 — Timer expiry has no "time's up!" beat** — cuts straight to next player's handoff (P4).

**P2 — Browser back exits the app to about:blank** (no history integration); autosave rescues
the data but the experience is jarring on touch devices (P3).

## What's confirmed solid

Scoring math exact across 30 engineered entries (unique 10 / shared 5 / invalid 0, totals
correct). Single-category mode rotates correctly. Timer countdown, warn state, auto-submit,
and mid-round resume after reload all work. Hebrew/RTL toggle clean. Join Game reads as a
friendly intentional placeholder (clear copy, two ways back) — not broken.

## Suggested fixes (max 3)

1. Make every advance idempotent: disable/debounce action buttons on press, validate inside
   the Next handler synchronously, clamp `startNextRound` to `roundCount`.
2. Fix save upsert (one record per game id), hide finished games from Resume (or move to a
   "Finished" section showing the final score).
3. Feedback pass: inline error for empty/duplicate names and rejected custom categories,
   plus a short "Time's up!" overlay before timer auto-advance.
