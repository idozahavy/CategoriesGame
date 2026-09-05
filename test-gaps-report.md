# Test gaps report - Kategoria

Mapped 2026-09-04 at commit 3120cba. Scope: whole repo. Runner: vitest 4.1.11 (node v24.18.0), colocated `*.test.ts`.

## Result so far (full run 2026-09-04 --top 15, plus write pass 2026-09-05 for GAP-016/017/020)

| Metric                      | Before             | After                       |
| --------------------------- | ------------------ | --------------------------- |
| tests                       | 66                 | 146                         |
| line_pct                    | 34.84              | 78.36                       |
| branch_pct_lit              | 40.3               | 80.5                        |
| dark_files (incl. types.ts) | 12                 | 3                           |
| functions_unexecuted        | 119                | 37                          |
| mutation_score              | n/a                | n/a                         |
| suite wall time             | 6.2 s (1 cold run) | 2.2 s (mean of 3 warm runs) |
| tests written / red-proven  | -                  | 80 / 80                     |

Gaps closed: Phase B 8 (GAP-001..008), Phase C 4 (GAP-009..012), Phase E 3 (GAP-013..015). Phase F regressions 82cd032 and ed9abc7 are inside GAP-013 and GAP-005; 25f020f was already covered. Phase G: no end-to-end harness, nothing written.

Reconciliation: p2p.ts at 98 % lines and BUG-001 (`p2p.ts:150`, host messages unvalidated on the guest) and BUG-002 (`p2p.ts:557`) are still open; one GAP-002 case is held back on BUG-002; one GAP-011 case is `needs-seam`; the user-named "game timeouts / waiting" behavior in the Svelte screens has no test because the repo has no DOM test environment (GAP-019, `needs-harness`).

Left open: GAP-018 db.ts and GAP-019 screens (`needs-harness`); GAP-021, GAP-022 (`needs-harness`, Low).

Suite health after Phase A: nothing un-skipped, deleted or quarantined - the suite was clean. One test written this run was deleted before commit as a tautology (see state file).

Commits: 3120cba coverage tooling, 5696728 map, 7cda361 Phase B, f0eb630 + 0b03989 Phase C, d3b5049 Phase E, 40f3058 second write pass (GAP-016/017/020).

## Before this run

Baseline at 3120cba: 66 tests, line_pct 34.84, branch_pct_lit 40.3, dark_files 12, functions_unexecuted 119, wall 6237 ms (single cold run). Per-file: p2p.ts 17.15 % lines, validation.ts 27.13 %, stores.ts 0 %, turn-credentials.ts 0 %, game.ts 97.72 %, i18n/index.ts 72.72 %, words/index.ts 87.5 %.

## 1. Must-cover violations

- **"game timeouts, waiting for game to proceed"** (opening question) - lives in `src/screens/Round.svelte` (round timer, time-up), `src/screens/Join.svelte` (guest waiting) and `src/screens/Scoreboard.svelte` (auto-continue). Zero tests; no DOM test environment exists (no jsdom, no @testing-library/svelte), so this is `needs-harness` (GAP-019). Smallest seam: extract the countdown into `src/lib/timer.ts` (pure tick function taking `now`) so the logic is testable without a DOM.
- `src/lib/p2p.ts` was at 17.15 % lines before this run; now 98.17 % (GAP-001..008 done).
- `src/lib/game.ts` at 97.72 % lines - compliant.

No `docs/project/CONVENTIONS.md` exists; no conflicts. No `CLEANUP.md`; nothing excluded by it. `/cleanup` hand-off found in `.cleanup-state.md` (flags: p2p host seat reclaim, network validation paths, db.ts untested) - all seeded into the map.

## 2. Suite health

- Failing: none (66/66 pass). Type check (`svelte-check`): 0 errors, 0 warnings.
- Skipped / todo / only: none.
- Flaky: two consecutive runs identical. Sweep hits: `Math.random` spied in bot.test.ts:11 and game.test.ts:141-148 (deterministic mocks, restored in afterEach) - fine. No real timers, network, or sleeps in tests.
- Tautologies: none found. storage.test.ts:41,44 use `not.toThrow()` but the same test also asserts the null read. qrscan.test.ts:45 error assertion carries its message.
- Snapshot tests: 0.
- Expired quarantines: none (no quarantine list existed).
- Slowest tests: not reported by the runner at this size (whole suite 106 ms of test time, 6.2 s wall including startup).

## 3. Tooling

| Tool                                | Status                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| vitest 4.1.11                       | found (repo devDependency)                                     |
| @vitest/coverage-v8 4.1.11          | was missing - added pinned to devDependencies (commit 3120cba) |
| svelte-check 4                      | found                                                          |
| mutation tool (Stryker)             | not installed - not added                                      |
| end-to-end harness                  | none                                                           |
| DOM environment (jsdom / happy-dom) | none                                                           |

Excluded from coverage (vitest.config.ts): `**/*.test.ts`, `src/vite-env.d.ts`, `src/main.ts`, `src/lib/i18n/{ar,en,es,fr,he,ru}.ts`, `src/lib/words/*.json`. Svelte components are not in the include list: the coverage provider cannot parse untransformed `.svelte` files, so every screen/component is a **Suspected** gap tagged `excluded-from-coverage`.

Baseline: line_pct 34.84, branch_pct_lit 40.3 (over the 11 files with at least one covered line), dark_files 12 (incl. 7 Svelte-free TS files + turn-credentials), functions_unexecuted 119 / 185, mutation_score n/a.

Two artifacts to keep in mind: raw branch % (37.25) is inflated by the synthetic branch of never-loaded files; bot/categories/session/storage/theme at 100 % are tiny modules.

## 4. Summary table

Rank = points / effort weight (S=1, M=2, L=4). Evidence: M = Measured by coverage, S = Suspected.

| #   | ID      | Unit (file:line)                                                    | Points | Effort | Ev  | Phase | Status        |
| --- | ------- | ------------------------------------------------------------------- | ------ | ------ | --- | ----- | ------------- |
| 1   | GAP-004 | p2p.ts:515 setActiveRoom / getActiveRoom                            | 9      | S      | M   | B     | done          |
| 2   | GAP-009 | game.ts:14 newId fallback (no crypto.randomUUID)                    | 7      | S      | M   | C     | done          |
| 3   | GAP-010 | game.ts:55 drawLetter / startNextRound defensive branches           | 6      | S      | M   | C     | done          |
| 4   | GAP-001 | p2p.ts:234 createRoom + buildHostRoom lobby                         | 10     | M      | M   | B     | done          |
| 5   | GAP-002 | p2p.ts:537 joinRoom (+ isHostMessage, getDeviceId)                  | 10     | M      | M   | B     | done          |
| 6   | GAP-003 | p2p.ts:316 host room after lock: reconnect, seat reclaim, close     | 10     | M      | M   | B     | done          |
| 7   | GAP-005 | stores.ts:15 updateGame                                             | 9      | M      | M   | B     | done          |
| 8   | GAP-008 | p2p.ts:275 reopenRoom                                               | 9      | M      | M   | B     | done          |
| 9   | GAP-006 | p2p.ts:190 fetchPeerOptions / getPeerOptions (TURN)                 | 8      | M      | M   | B     | done          |
| 10  | GAP-007 | functions/turn-credentials.ts:44 onRequestPost                      | 7      | M      | M   | B     | done          |
| 11  | GAP-013 | validation.ts:309 inPublicDictionary + lookupWiktionary             | 6      | M      | M   | E/F   | done          |
| 12  | GAP-014 | validation.ts:43 checkWord dictionary / hybrid paths                | 6      | M      | M   | E     | done          |
| 13  | GAP-015 | validation.ts:161 wordFact                                          | 6      | M      | M   | E     | done          |
| 14  | GAP-011 | words/index.ts:12 ensureWords unknown language / failed chunk       | 3      | S      | M   | C     | done          |
| 15  | GAP-012 | i18n/index.ts:36 detectInitialLanguage / persistLanguage / applyDir | 5      | M      | M   | C     | done          |
| 16  | GAP-016 | validation.ts:250 inWikidataCategory                                | 5      | M      | M   | E     | done          |
| 17  | GAP-017 | validation.ts:114 inLearnedList / learnWord / forgetWord            | 5      | M      | M   | E     | done          |
| 18  | GAP-018 | db.ts:62 all IndexedDB functions                                    | 8      | L      | M   | E     | needs-harness |
| 19  | GAP-020 | sound.ts soundOn + chimes                                           | 4      | M      | M   | E     | done          |
| 20  | GAP-019 | Round/Join/Scoreboard.svelte timers and waiting                     | 7      | L      | S   | G     | needs-harness |
| -   | GAP-021 | avatar.ts:32 fileToAvatar                                           | 4      | L      | M   | E     | needs-harness |
| -   | GAP-022 | qrscan.ts:23 hasCamera / decodeWithCanvas                           | 3      | L      | M   | E     | needs-harness |

Uniform signals: churn (+1) applies to every file in the top 15 except stores.ts and turn-credentials.ts; noted per gap.

## 5. Gaps in detail

### GAP-004 setActiveRoom / getActiveRoom - p2p.ts:515

Why it matters: 6 importers (every screen that touches the room), must-cover, 0 lines covered, churn.
Untested: replacing the room closes the previous one; setting the same room does not close it; null clears and closes.
Test plan:

- given room A active / when setActiveRoom(B) / then A.close() called once, getActiveRoom() is B
- given room A active / when setActiveRoom(A) / then A.close() not called
- given room A active / when setActiveRoom(null) / then A.close() called, getActiveRoom() null
  Boundaries: none (HostRoom is a plain object; use a hand-rolled fake).

### GAP-009 newId fallback - game.ts:14

Why: used for every game and player id; the manual UUIDv4 path runs on plain-HTTP LAN play; branch uncovered.
Plan: given crypto.randomUUID undefined / when newId() / then a v4-shaped UUID (version nibble 4, variant 8-b), and two calls differ.
Boundaries: `crypto` global (vi.stubGlobal with getRandomValues from node:crypto).

### GAP-010 drawLetter / startNextRound defensive branches - game.ts:55,71

Why: must-cover; branches at 59/88 uncovered.
Plan:

- given every pack letter already used / when drawLetter / then still returns a letter from the pack
- given a game with zero players / when startNextRound / then activePlayerId is null and the round is created
- regression 25f020f: double-tap guard - already covered at game.test.ts:108/115 (cross-reference).

### GAP-001 createRoom + lobby - p2p.ts:234, 316

Why: must-cover, 0 % covered, 3 importers via createRoom/reopenRoom, parses guest messages, >50 lines, churn.
Untested: open resolves a room with the code; 'unavailable-id' retries with a fresh code up to 3 times; other errors and the 12 s timeout reject with Error('network'); hello seats a guest and replies welcome + roster; duplicate names get " 2"; malformed data ignored; lobby drop removes the seat; sendTo/broadcast reach only connected seats; answers from a seated guest reach onGuestMessage, answers before hello do not.
Boundaries: `peerjs` (vi.mock with an EventEmitter-style fake Peer / DataConnection), timers (vi.useFakeTimers), `localStorage` (stubbed).

### GAP-002 joinRoom - p2p.ts:537

Untested: hello carries name + deviceId and avatar only when given; welcome resolves the session with playerId; busy before welcome rejects 'not-found'; peer-unavailable rejects 'not-found'; other peer error rejects 'network'; 12 s timeout rejects 'network'; malformed host data ignored; messages after welcome reach onMessage; conn close after welcome fires onClose; close() closes conn and destroys peer.
Boundaries: peerjs, timers, localStorage.

### GAP-003 host room after lock - p2p.ts:387-506

Untested: lock() then a stranger's hello gets 'busy' and the conn is closed after 500 ms; a known name with an empty seat reclaims it; a known name with a LIVE seat gets busy (anti-kick rule); a returning deviceId reclaims even a live seat and the stale conn is closed; reclaim replays the roster and the last round with seconds reduced by elapsed time; scores replay wins over round; a drop after lock keeps the seat (conn null) and is invisible to the roster; close() broadcasts 'ended', destroys the peer after 500 ms and clears seats.
Boundaries: peerjs, timers, Date.now (vi.setSystemTime).

### GAP-005 updateGame - stores.ts:15

Why: every game mutation flows through it; 6 importers; data mutation; regression ed9abc7 (structuredClone so `$derived` re-runs).
Plan:

- given a game in the store / when updateGame(mutate) / then the store holds a NEW object (not the same reference) with the mutation applied (regression ed9abc7)
- given a game / when updateGame / then saveGame called once with the mutated state
- given null / when updateGame / then mutate not called, saveGame not called, store stays null
  Boundaries: `./db` saveGame (vi.mock - IndexedDB boundary).

### GAP-008 reopenRoom - p2p.ts:275

Untested: resolves a locked room with one empty seat per known player (guests() lists them, conn null); code is normalized; 'unavailable-id' retries after 2 s; final failure rejects 'network'.
Boundaries: peerjs, timers.

### GAP-006 fetchPeerOptions / getPeerOptions - p2p.ts:190

Untested: valid iceServers body -> Peer constructed with config.iceServers; non-ok / malformed / thrown fetch -> {} and NOT cached (next room fetches again); success is cached (one fetch across two rooms).
Boundaries: `fetch` (vi.stubGlobal), observed through the fake Peer constructor's options.

### GAP-007 onRequestPost - functions/turn-credentials.ts:44

Why: mints 24 h relay credentials on the account's quota; auth check; parses upstream JSON.
Plan:

- Sec-Fetch-Site: cross-site -> 403 forbidden, no fetch
- no Sec-Fetch-Site, Origin matches request origin -> allowed; mismatching Origin -> 403
- secrets missing -> 503 turn-not-configured, no fetch
- upstream ok -> 200 with the body passed through, Authorization Bearer header, ttl 86400, Cache-Control no-store
- upstream non-ok -> 502; fetch throws -> 502
  Boundaries: `fetch` (vi.stubGlobal). Request/Response are native in Node 24.

### GAP-013 inPublicDictionary - validation.ts:309 (Phase E + F)

Plan:

- pages with an id other than -1 and no `missing` -> 'known'; pages {-1: {missing}} -> 'unknown'
- non-ok -> 'error'; fetch throws -> 'error'
- regression 82cd032: two concurrent calls for the same word issue ONE fetch; an 'error' verdict is evicted so the next call fetches again; a 'known' verdict is cached
- URL targets `<language>.wiktionary.org` with the lowercased word
  Boundaries: fetch.

### GAP-014 checkWord dictionary / hybrid paths - validation.ts:57-83

Plan (fetch stubbed, wikidata disabled unless stated):

- bundled hit -> 'valid' with no fetch (hybrid)
- dictionary known -> 'valid'; unknown in 'dictionary' mode -> 'vote'; unknown in 'hybrid' -> 'vote'; error -> 'vote'
- wikidata fit -> 'valid' without consulting Wiktionary; nofit -> 'vote' without Wiktionary; error -> falls through to Wiktionary
- prefetchWordCheck never rejects
  Boundaries: fetch, `./db` (mock so learnWord does not touch IndexedDB).

### GAP-015 wordFact - validation.ts:161

Plan: exact-match hit with a description -> that description; prefix-only match -> null; empty description -> null; non-ok -> null and not cached; result cached (second call no fetch).
Boundaries: fetch.

### GAP-011 ensureWords - words/index.ts:12

Plan: unknown language resolves and getWords returns {} ; second call for a loaded language resolves without reloading.
Boundaries: none (import.meta.glob resolved at build; only the 'no loader' path is reachable in tests).

### GAP-012 i18n init - i18n/index.ts:36-76

Plan (vi.resetModules + dynamic import per case):

- saved language 'he' in storage -> uiLanguage 'he'
- no saved, navigator.languages ['fr-CA','en'] -> 'fr'; ['xx'] -> 'en'
- saved but unknown code -> falls to navigator
- persistLanguage writes the storage key
- applyDir sets documentElement.dir/lang from the pack (document stubbed)
  Boundaries: localStorage, navigator, document.

### GAP-016 / GAP-017 (beyond --top)

inWikidataCategory: unmapped category 'error'; empty search -> 'nofit' cached; ASK true -> 'fit'; non-ok -> 'error' + 60 s cooldown short-circuits the next call; queue runs one at a time.
learnWord: custom category ignored; 1-char ignored; dedupe; storage failure tolerated. forgetWord drops from cache and store.

### GAP-018 db.ts - needs-harness

IndexedDB with `idb`. No `fake-indexeddb` in the repo; a vi.mock of `idb` would test the mock. Recommend adding `fake-indexeddb` (dev) in a separate decision, then: save/load round-trip, listSaves ordering and summary shape, deleteGame, learned-word add/remove including entry deletion when empty, touchProfile upsert, recordGameResult only for saved profiles.

### GAP-019 screens - needs-harness

Round.svelte timer (tick sound under 10 s, time-up forces review), Join.svelte waiting/reconnect states, Scoreboard.svelte 10 s auto-continue and its stop button. Needs a DOM environment plus @testing-library/svelte, or a seam: move the countdown into a pure `src/lib/timer.ts`.

## 6. Suspected bugs

- **BUG-001** (Medium) - `src/lib/p2p.ts:150` `isHostMessage` validates only the `type` string. A peer holding the room's id can send `{type:'welcome', playerId: {}}` or `{type:'round', categories: 'x'}` and the guest screen uses the fields as-is. Probably should validate each variant's shape like `isGuestMessage` does. Not tagged security: the guest only renders text and Svelte escapes it. Triage 2026-09-04: accepted, open for a separate fix.
- **BUG-002** (Low) - `src/lib/p2p.ts:557` after a successful join `fail()` returns early on `settled`, so a peer-level error (broker lost) never reaches `onClose`; only connection-level close/error does. The guest may sit on a dead room until the host's conn closes. Triage 2026-09-04: accepted, open for a separate fix; the held-back GAP-002 case follows it.

## 7. Top 5 quick wins

1. GAP-004 setActiveRoom - 3 tests, no mocks.
2. GAP-009 newId fallback - 1 test, stub `crypto`.
3. GAP-005 updateGame clone + persist - 3 tests, mock `./db`.
4. GAP-007 onRequestPost - 6 tests, stub `fetch`.
5. GAP-013 inPublicDictionary dedupe (regression 82cd032) - 5 tests, stub `fetch`.

## 8. Send to /cleanup, Checked fine, exclusions

Send to /cleanup: none found (no dead exports in scope; `/cleanup` Phase 1 already removed them).

Checked, found fine (skip while file unchanged):

- src/lib/bot.ts @3415020, src/lib/categories.ts @390975f, src/lib/session.ts @3415020, src/lib/storage.ts @4fa4c3a, src/lib/theme.ts @3415020 - 100 % lines and branches.
- src/lib/game.ts scoring/rounds/ids (game.test.ts, 24 tests) - only the nullish fallbacks listed in GAP-009/010 remain.
- src/lib/p2p.ts isGuestMessage / isIceServerArray / makeRoomCode / normalizeRoomCode - covered incl. hostile payloads.
- src/lib/qrscan.ts roomCodeFromScan / startQrScan permission error - covered.

Exclusions: type-only declarations 1 file (types.ts); barrel re-exports 0; generated 0; vendored 0; data files 12 (6 packs, 6 word lists); bootstrap wiring 2 (main.ts, vite-env.d.ts); test helpers 1 (vitest.setup.ts); Svelte screens/components 19 files tagged excluded-from-coverage (Suspected).
