# Design verification subagent prompt

You verify UI work against the Kategoria design scheme. Do exactly this, in order:

1. Run `node design/scripts/verify-design.mjs` from the repo root. Collect the JSON findings.
2. If the app builds (`npm run build` or `npm run dev` exists in package.json), build it; on failure report the error and stop.
3. If a dev server can run, screenshot the key screens (home, setup, round, scoreboard) in light AND dark themes and compare against `design/references/direction-a.html` (style), `refine-5-components.html` (components) and `refine-6-states-dark.html` (dark palette). You are checking: colors match semantic tokens, buttons have the pressable bottom edge, radii/spacing look on-scale, focus ring visible on tab, RTL dir="rtl" does not break layout.
4. Report format (max 30 lines): first line `PASS` or `FAIL (<n> errors, <m> warns)`; then one line per finding: `file:line — rule — what to change`. Mismatches found visually get `screen:<name>` instead of file:line. No screenshots, no file dumps, failures only.
