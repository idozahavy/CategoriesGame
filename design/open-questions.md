# Open design questions

_Log undefined visual decisions here instead of improvising; the next `design-scheme revise` run turns them into real decisions._

- App name/logo: mockups use a placeholder "🎪 Categories!" title. A real name + wordmark treatment is undecided.
- Shared-screen (TV) type scale: provisionally implemented as `zoom: 1.3` + 560px shell on remote-host screens (App.svelte `.shell.tv`, design-ignore pragma). A real tokenized TV scale (per-size overrides instead of zoom) is still an open decision.
- Confetti/celebration visual spec (colors, particle count, duration) — motion tokens exist, the celebration composition itself is undefined.
- Room-code display (P2P lobby): provisionally a surface card with the code in `--font-size-display` primary color at 0.25em letter-spacing (NewGame.svelte `.code-card`). Needs a real decision (own token/pattern? QR code?).
- Remote waiting chips (host round screen): provisional pill chips flipping to success colors when a player has submitted (Round.svelte `.wait-chip`). Register as a component if kept.
