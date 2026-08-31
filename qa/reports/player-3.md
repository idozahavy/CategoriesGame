# Playtest Report — Player 3 ("chaos")

Target: http://localhost:5173 (Svelte SPA, no backend)
Session date: 2026-08-31

## Bugs found

### 1. [CRITICAL] Spam-clicking "Next" on the empty player-setup step skips ALL wizard validation and steps, letting you start a real game with 0 players

**Repro:**

1. Home → New Game. Land on "Who is playing?" with 0 player rows (no players added, no "Add player" clicked).
2. Click the "Next" button 5 times rapidly (fired synchronously in a tight loop).
3. Result: the wizard silently skips the "Who is playing?" step (never blocked despite 0 players) **and** the entire "How do you want to play? / Pick categories" step, landing directly on "Points & timer" (step 3 of 3).
4. Click "Start!" with no timer/mode/category chosen explicitly.
5. A real round starts: `Round 1 of 3`, letter tile shown, all 5 default categories, and the app auto-invents a player named **"Player 1"**.
6. The game is fully playable end-to-end: I answered all 3 rounds, reached the Review screen, and finished at the Scores screen showing "Player 1 wins! 🎉" with a real score (120 pts).

This means the minimum-player-count check and the mode/category-selection step can both be bypassed entirely by rapid/spam navigation input, producing a "valid" completed game with a phantom single player. A single accidental double/triple-tap on "Next" (easy for a kid to do) could trigger this.

**Severity:** High — silently corrupts the intended flow, produces confusing solo games, and the resulting save/scoreboard state looks legitimate.

### 2. [MEDIUM] Completed games are never removed from "Resume Game", and each round transition creates a new/duplicate save entry instead of updating one slot

**Repro:**

1. Play a game to completion (reach the Scores screen).
2. Go Home → "Resume Game".
3. The finished game still appears as a resumable save (e.g. "Player 1 — Round 3 of 3"), and clicking "Continue" on it just reopens the final Scores screen (not a crash, but pointless clutter).
4. Additionally, over the course of one single playthrough (rounds 1→2→3, browser back once in the middle), the save list accumulated **3 separate entries** for the same game ("Round 1 of 3", "Round 2 of 3", "Round 3 of 3", all under "Player 1"), instead of one entry that gets updated in place.

**Severity:** Medium — not data-corrupting, but the saved-games list will grow unbounded across a family's play sessions, and finished games clutter the "Resume" list forever (no cleanup path in the UI besides manual per-item Delete).

### 3. [LOW] Browser back-button leaves the app entirely (loses in-memory game state, no history integration)

**Repro:**

1. Start a game, get to "Round 2 of 3" (mid-round, timer running, categories showing).
2. Press the browser Back button (via `navigate: back`).
3. The tab goes to `about:blank` — completely outside the app (no site loaded at all), not to a previous app screen.
4. Pressing Forward reloads the app fresh at the Home screen — the in-progress round is gone from memory (though it did survive via a background autosave — see Bug #2 for how that autosave is duplicated/never cleared).

**Severity:** Low/Medium — the app doesn't push any history entries, so any accidental back-swipe/back-click (very plausible on a touch device mid-round) yanks the player out of the game to a blank page. It's not a data-loss disaster only because of the autosave, but the UX is jarring and confusing for a kid-facing app.

### 4. [LOW] No duplicate-player-name validation

**Repro:** In "Who is playing?", enter two players both named "Same" and click Next — it's accepted with no warning and advances normally.
**Impact:** During pass-and-play handoff and on the scoreboard, two identically-named players would be indistinguishable. Minor, but worth a friendly warning given the kid-friendly design goal.

### 5. [LOW] Custom category add gives no feedback on rejection

**Repro:** On "Pick categories", open "Add your own", type an 80+ character name (`"XXXXXXXXXX...XXXXXXXXXX Category"`), and submit (both via Enter key and via the confirm button).
**Result:** The category is silently NOT added — the input just sits there / closes with no error message, toast, or visual indicator of why it failed. Also tested an empty submission — also silently no-ops.
**Impact:** Minor UX gap — kids (or parents) won't know why their custom category didn't get added.

## Things that worked correctly (no bug)

- **XSS check passed.** Typed `<b>bold</b>` as an answer; on the Review screen it renders as the literal text `<b>bold</b>` (verified via `innerHTML` — properly escaped, not injected as markup). No HTML/script injection found anywhere I tested.
- **Input sanitization on answers is solid:** leading/trailing-space answer (" Fox ") was trimmed and scored correctly; pure-number answer ("123") was correctly rejected ("Not counted · 0"); a 100-character gibberish string ("AAAA...") was correctly rejected as not a real word.
- One nitpick: a bare single letter matching the round's required letter (e.g. answering "F" for a category on an "F" round) was accepted and scored as "Unique! · 10" — arguably too lenient, but may be intentional design; flagging for awareness rather than as a bug.
- **Hebrew / RTL toggle works correctly.** Switching the in-wizard language selector to עברית (Hebrew) instantly translated all visible strings and flipped `<html dir>` to `rtl` / `lang` to `he`. Switching back to English correctly restored `ltr` / `en`. No layout breakage observed in either direction.
- **Join Game screen** is a clearly-labeled "coming soon" stub ("Playing on your own phone is coming soon! For now, share one screen together.") with just a Home button — nothing to break there.
- **Zero console errors** were thrown during the entire chaotic session (including during the wizard-skip bug reproduction), despite the invalid states reached. The app degrades ungracefully at the UX/data level but does not hard-crash.
- Resuming an in-progress save correctly restored the right round number, letter, and categories (timer resets to full, which is reasonable).

## Testing notes / tooling caveats

- The app's UI has a noticeable one-tick reactivity lag under rapid programmatic interaction (e.g., clicking "Add player" twice in the same script only visibly added one row until a subsequent read). This might just be an artifact of scripted/synthetic events rather than a real-user-facing bug, but combined with Bug #1 it suggests the wizard's step-validation guard is not synchronous/robust against rapid input.
- Saves in IndexedDB are shared across testers. I created and later attempted to delete 3 "Player 1" saves from my own testing; the delete-confirmation action was blocked by the environment's permission system as a destructive-data operation, so those 3 stray "Player 1" saves (timestamps 07:37, 07:39, 07:41 on 8/31) are still present in the shared save list — safe to delete manually since they're clearly from this bug-repro run.

## Verdict

The game is fun and the core word-checking/answer-validation logic (trimming, escaping, dictionary rejection) is genuinely solid — no XSS, no crashes. But the setup wizard's step-navigation guard has a real hole: rapid/accidental "Next" clicks can blow past all validation and start a phantom-player game, and the save-list is not being cleaned up or consolidated, which will get messy over real-world use.
