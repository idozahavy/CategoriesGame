# Player 1 — "rusher" persona playtest report

**Setup:** Solo game, 1 player ("P1"), all defaults accepted (mode = "All categories, one letter", default category set, Normal timer 2:00, 3 rounds). Rushed through everything, mashed/double-clicked primary buttons, left most categories empty.

## Verdict

Got a full game to completion (Home → wizard → 3 configured rounds → Scoreboard) despite rushing, but round navigation is fragile under fast/double clicking and has at least one clear off-by-one bug.

## Bugs found (ranked by severity)

### 1. CRITICAL: Double-clicking "Next round" skips an entire round

On the Review screen after Round 1, I double-clicked the "Next round" button (as instructed, to simulate an impatient kid mashing buttons). Result: the game jumped straight from "Round 1 of 3" to **"Round 3 of 3"**, completely skipping Round 2. No round-2 words were ever collected for that round, and the round counter/state clearly does not guard against a second click firing before the UI transitions/disables the button. This is a real point-scoring integrity bug, not just cosmetic — a rushing kid mashing the "next" button (very plausible for this persona) will short the game a full round without any indication anything went wrong.

**Repro:** On the Review screen, click "Next round" twice in quick succession (before the next round's input screen has rendered). Expect: advance one round. Actual: advances two rounds.

### 2. HIGH: "Round 4 of 3" — off-by-one, last round doesn't end the game

After completing what should have been the final round (Round 3 of 3, due to the skip bug above this was actually only the 2nd round played), clicking "Next round" on the Review screen did **not** end the game — it advanced to a screen labeled **"Round 4 of 3"** and let me play another full round with a new letter. Only after submitting that round did the Review screen finally show a "See scores" button instead of "Next round".

This suggests the round-completion check compares against the wrong bound (off-by-one) or the "is this the last round" logic doesn't account for the actual current round reliably. Whether or not the earlier skip bug contributed to this exact instance, the label "Round 4 of 3" is user-visibly nonsensical on its own and should never be reachable — a kid will be confused seeing a round number exceed the stated total.

### 3. MEDIUM: No visible feedback that a submitted word doesn't match the round's letter

On Round 1, I typed "Zebra" and "Zucchini" for a round whose letter was "P". The input screen showed a small "Starts with 'P'?" hint under each field, but nothing blocked or strongly warned before submitting — I hit "Done!" and it went straight through to the Review screen, where the words were silently scored "Not counted · 0". For a rushing kid this is probably fine (don't block them), but the wrong-letter answer being accepted with no active resistance (e.g., no confirm-you-sure-this-is-wrong nudge) combined with a fairly subtle inline hint means many kids may not learn why they got 0 points until the Review screen, if they even check.

### 4. LOW: Buttons don't appear to disable while a transition is in-flight

Related to bug #1 — primary action buttons ("Next round", "Done!", "Start!") remained clickable (not disabled, no loading state observed) immediately after being clicked, at least long enough for a same-tick second click to register as a second, separate action. Recommend disabling the button (or debouncing) the instant it's pressed, until the resulting state transition completes.

## Timing / flow notes

- Home → New Game wizard → Start took ~4 fast interactions (name, mode/categories, points/timer, Start). No unnecessary friction; a rusher can complete setup very quickly.
- One player name field is required before "Next" advances on the players step (silently no-ops if empty) — not a bug, but worth noting there's no error message shown when Next is pressed with an empty required field; it just does nothing, which could read as "broken" to an impatient kid.
- No handoff overlay was shown between rounds/players in this solo 1-player game — went straight from setup into Round 1. Good, this is the fast path.
- Timer counted down as expected (2:00 default "Normal" shown as e.g. 1:44, 1:25 etc. after actions).
- Reached final Scoreboard successfully: "Player 1 wins! 🎉" with 20 points (from the two "Unique!" 10-point answers: "Apple" and "Banana"), plus 0 points from the mis-lettered Round 1 answers and whatever the skipped/extra round contributed.

## Fun/UX notes

- Category emoji icons (🐶🍕🏙️🧑📦) are a nice, clear kid-friendly touch for quick scanning.
- "Unique! · 10" and "Not counted · 0" scoring labels on the Review screen are simple and easy to read at a glance.
- Overall the happy-path flow (no double-clicking) felt fast and low-friction, appropriate for a rusher/kid persona — the round-count bugs are the main thing standing between this and a solid rushed-play experience.
