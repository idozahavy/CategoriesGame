# Playtest report — Player 2 ("completionist")

**Date:** 2026-08-31
**Setup:** 3 players (Maya, Dad, Zoe), classic mode (all categories, one letter), categories: Animal, Food, City, Name, Thing (default 5 selected), unique scoring (10 unique / 5 shared), no timer, 2 rounds.

## Flow walkthrough

1. Home → New Game. Step 1 (players): first input pre-filled placeholder "Name 1", "Add player" correctly appends new inputs. Added Maya, Dad, Zoe with no friction.
2. Step 2 (mode): "All categories, one letter" was already selected by default, with a clear helper line "The usual way — fill every category!" under it. Category chips pre-selected 5 of 10 (Animal, Food, City, Name, Thing) by default — reasonable default, though it's not obvious to a new user _why_ those 5 and not e.g. Country/Sport. Chips are icon + label, easy to read.
3. Step 3 (points & timer): "Unique word 10 · same as someone 5" was pre-selected and clearly explained inline — good, a kid/parent can understand the scoring rule without leaving the screen. Timer chips (No timer / Relaxed / Normal / Fast) — Normal was the default; switched to "No timer" successfully. Rounds stepper (−/+) worked, moved 3 → 2 in one click.
4. Start! → per-player handoff overlay ("🙈 Maya, it's your turn!" / OK) appeared correctly before each player's turn each round, preventing peeking — good design for pass-and-play with kids.
5. Round screen shows round counter ("Round 1 of 2"), big letter tile, and one input per category with icon+label. Straightforward.
6. Review screen ("Let's check the words!") auto-scored every word with no manual dictionary/group-vote modal needed in either round (all test words matched the bundled word lists) — validation was fast and did not interrupt the flow.
7. Scoreboard at the end lists players sorted by score with a crown on the winner and a "Zoe wins! 🎉" banner. "Play again" and "Home" buttons present.

## Scoring verification (the main thing I was asked to check)

### Round 1 — letter G

| Category        | Maya                                                                    | Dad                      | Zoe                        |
| --------------- | ----------------------------------------------------------------------- | ------------------------ | -------------------------- |
| Animal          | Goat → **5** (Same word)                                                | Goat → **5** (Same word) | Giraffe → **10** (Unique!) |
| Food            | Grapes → **10**                                                         | Garlic → **10**          | Gravy → **10**             |
| City            | Berlin → **0** (Not counted — correctly flagged as not starting with G) | Geneva → **10**          | Glasgow → **10**           |
| Name            | Gina → **5** (Same word)                                                | Gina → **5** (Same word) | George → **10**            |
| Thing           | Glass → **10**                                                          | Guitar → **10**          | Gate → **10**              |
| **Round total** | **30**                                                                  | **40**                   | **50**                     |

All values matched expectations exactly: duplicate valid word → 5/5, unique valid word → 10, word not starting with the round letter → 0 ("Not counted"). Math per row verified by hand.

### Round 2 — letter K

| Category        | Maya                        | Dad              | Zoe               |
| --------------- | --------------------------- | ---------------- | ----------------- |
| Animal          | Koala → **5**               | Koala → **5**    | Kangaroo → **10** |
| Food            | Kiwi → **10**               | Ketchup → **10** | Kale → **10**     |
| City            | Paris → **0** (Not counted) | Kyoto → **10**   | Kingston → **10** |
| Name            | Kevin → **5**               | Kevin → **5**    | Kate → **10**     |
| Thing           | Kite → **10**               | Key → **10**     | Kettle → **10**   |
| **Round total** | **30**                      | **40**           | **50**            |

Again exactly as engineered/expected.

### Final scoreboard

- Zoe: 100 (expected 50+50 = 100) ✓
- Dad: 80 (expected 40+40 = 80) ✓
- Maya: 60 (expected 30+30 = 60) ✓

All totals add up correctly across both rounds. Scoring logic (unique=10, shared=5, invalid=0) is implemented correctly and consistently, and the "not counted" reason is shown per word rather than just a bare 0, which is good for a kid to understand why they lost points.

## UI text / wording notes

- All copy read naturally and was easy to understand; nothing a child would misread.
- "Let's check the words!" / "Same word · 5" / "Unique! · 10" / "Not counted · 0" labels on the review screen are clear and appropriately encouraging (exclamation point on "Unique!" makes it feel like a reward rather than just a number).
- Handoff overlay copy ("🙈 <Name>, it's your turn!") is friendly and clearly signals "look away" via the emoji, good for pass-and-play trust with siblings.
- No typos found in any screen visited (home, wizard steps 1–3, round play, review, scoreboard).
- Minor: on the mode-selection step, the default category chip selection (Animal/Food/City/Name/Thing chosen, Country/Plant/Job/Sport/Color unchosen) isn't explained — a first-time parent might wonder why only half are pre-checked. Not a bug, just a small clarity gap.

## Bugs / issues found

- No functional or scoring bugs found in this run. Word validation, duplicate detection, invalid-letter detection, and score aggregation all worked correctly across 2 rounds x 3 players x 5 categories (30 data points).
- Only soft/cosmetic note: the reason for the default category subset (5 of 10 pre-selected) is not surfaced to the user — could confuse a parent setting this up for the first time, but not a defect.

## Verdict

Game mechanics and scoring math are solid and match the documented rules exactly; no bugs encountered in a full 3-player, 2-round classic game.
