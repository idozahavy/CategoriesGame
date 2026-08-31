# Playtest report — Player 4 ("explorer" persona)

Target: http://localhost:5173
Focus: Join Game flow, single-category mode, timer, resume.

## Join Game (primary assignment)

**Verdict: intentional, well-handled placeholder — not broken.**

- From Home, "Join Game" opens a dedicated screen titled "Join a game" with a 📱 emoji and the message: _"Playing on your own phone is coming soon! For now, share one screen together."_
- There is **no room-code input field at all** — nothing to type ABCD/1234/empty into. It's a pure informational stop, not a non-functional form. I could not test code entry because there is none to test.
- Two ways back: a top-left "Back" arrow (icon-only button, no visible label/aria-label but works) and a full-width "Home" button at the bottom. Both correctly return to the Home screen.
- No console errors on entering/leaving this screen.
- **Kid's-eye read:** this is good. The copy explains _why_ (phone play isn't ready yet) and gives an alternative ("share one screen together") instead of just a dead "Coming Soon" wall. A kid wouldn't be confused about whether something is broken — it reads as a friendly, deliberate placeholder. Two escape routes means no dead end.
- **Minor friction:** the icon-only "Back" button has no visible text and its accessible name only says "Back" in the a11y tree — fine for now, but worth a real aria-label check outside automated reads. Also, screen-transition animations mean a script (or a very fast child) reading text immediately after a click can see stale content for a moment — not a bug, just a timing note for anyone testing this flow programmatically.
- **Suggestion:** since the input never appears, consider whether "Join Game" should even be a separate primary button on Home today, vs. a smaller/secondary link, so kids aren't drawn to a feature that immediately dead-ends into "not yet."

## Single-category mode (2 players: Alice, Bob)

- New Game wizard: added a second player fine (default 1 name field + "Add player").
- Mode step offers "All categories, one letter" vs "One category, one letter" — labels and subtext are clear ("Quick rounds — one category at a time").
- Selected "One category, one letter" and picked 4 categories (Animal, Country, Name, Thing) via category chips (`aria-pressed` correctly toggles).
- **Note (low confidence, likely a test-script artifact, not a real bug):** firing 4 rapid scripted `.click()` calls back-to-back on different chips in the same tick only registered 1 of them; a single click issued on its own always worked correctly and reflected instantly in `aria-pressed`. Real users clicking one at a time would not hit this. Flagging only because it's the kind of thing that _could_ also affect a very fast double-tap from an excited kid — worth a manual click-spam check if there's time, but not confirmed as a real defect.
- Round 1: showed **exactly one category** ("🐶 Animal"), one letter (W), one text input, one "Done!" button — correctly single-category, not the full classic grid.
- Alice and Bob both played the _same_ round/category/letter (Animal/W) via the pass-and-play handoff screen ("Alice, it's your turn!" / "Bob, it's your turn!") — correct.
- Review screen ("Let's check the words!") correctly showed both answers (Wolf, Weasel) each scored "Unique! · 10".
- Round 2 showed a **different** category ("🌍 Country") and a different letter (L) — confirms rounds rotate through distinct single categories rather than repeating or showing the whole set.

## Timer

- Timer set to "Fast (1 min)" in settings; correctly labeled and selectable (`aria-pressed` toggled).
- In-round timer counted down accurately in real time (observed 0:57 → 0:52 → 0:49 → 0:25 → 0:01 matching elapsed wall-clock time within a second or two).
- At low time (0:01) the timer element gained a `warn` CSS class (`class="timer ... warn"`) — a low-time visual warning does exist.
- **Auto-submit on expiry confirmed:** when the timer hit 0 without the player pressing "Done!", the app automatically advanced to the next player's handoff screen ("Bob, it's your turn!"). No crash, no stuck state, no console error. Whatever was (not) typed was silently accepted as the answer — reasonable behavior, though there's no visible "time's up!" toast/message before the jump, which could feel abrupt to a kid mid-thought. Consider a brief "Time's up!" beat before cutting to the next player.

## Resume

- Reloaded the page mid-round (as Bob, with "Latvia" typed into the Country input but not submitted).
- Home screen still showed "Resume Game" as expected.
- "Resume Game" opens **"Your saved games"** — a shared list across all testers' saves (did not touch/delete anyone else's entries, per instructions). My save correctly appeared at the top as "Alice, Bob — Round 2 of 3" with a timestamp.
- Clicking "Continue" on the correct entry resumed exactly where expected: Bob's turn handoff screen, then into Round 2 of 3, category "Country", fresh 0:58 timer.
- The unsubmitted "Latvia" text was **not** preserved (input reset to empty) — expected and fine, since it was never confirmed with "Done!"; no data loss occurred for anything actually submitted (Round 1 answers were intact in the earlier review).
- No console errors across the reload/resume flow.

## Overall UX friction notes

- Icon-only Back button lacks a visibly-labeled affordance (relies on icon alone); low risk but worth a real accessibility/label pass.
- No "time's up" transitional feedback before auto-advancing rounds on timer expiry.
- Saved-games list has no visible way to tell _whose_ device/browser a save belongs to beyond player names — fine for local testing, but if this list is meant to be shared across devices someday it could get confusing with many similar entries (several "Player 1" saves at different times).
- Everything else — mode selection, category picking, pass-and-play handoff, scoring, round rotation, timer, resume — worked smoothly and consistently with no console errors observed at any point.
