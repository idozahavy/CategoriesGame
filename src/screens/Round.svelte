<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { game, screen, updateGame } from '../lib/stores';
  import { t, categoryName } from '../lib/i18n';
  import { setAnswer, matchesLetter, TIMER_OPTIONS } from '../lib/game';
  import type { ScoringSystem, ValidationMode } from '../lib/types';
  import Chip from '../lib/ui/Chip.svelte';
  import { prefetchWordCheck } from '../lib/validation';
  import { botAnswers, BOT_THINK_MS } from '../lib/bot';
  import { playTick } from '../lib/sound';
  import { getActiveRoom, setActiveRoom, type GuestMessage } from '../lib/p2p';
  import TopBar from '../lib/ui/TopBar.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Button from '../lib/ui/Button.svelte';
  import Card from '../lib/ui/Card.svelte';
  import TextInput from '../lib/ui/TextInput.svelte';
  import LetterTile from '../lib/ui/LetterTile.svelte';
  import TimerPill from '../lib/ui/TimerPill.svelte';
  import Avatar from '../lib/ui/Avatar.svelte';

  const CATEGORY_EMOJI: Record<string, string> = {
    animal: '🐶',
    food: '🍕',
    city: '🏙️',
    country: '🌍',
    name: '🧑',
    plant: '🌸',
    profession: '💼',
    object: '📦',
    sport: '⚽',
    color: '🎨',
    fruit: '🍎',
    ocean: '🐠',
    vehicle: '🚗',
    kitchen: '🍴',
    clothing: '👕',
    body: '👃',
  };
  const DEFAULT_EMOJI = '📝';

  // Guard: this screen assumes a running game.
  $effect(() => {
    if (!$game) screen.set('home');
  });

  const remote = $derived($game?.settings.remote === true);

  // Pass-the-device panel at round entry when several players share the screen
  // (remote guests each have their own device — no handoff needed).
  onMount(() => {
    handoffOpen = !remote && players.length > 1;
    const room = remote ? getActiveRoom() : null;
    if (!room) return;
    room.onGuestMessage((playerId, msg) => {
      handleGuestAnswers(playerId, msg);
    });
    return () => {
      room.onGuestMessage(null);
    };
  });

  const round = $derived($game ? $game.rounds[$game.currentRound] : null);
  const players = $derived($game?.players ?? []);
  const activePlayer = $derived(players.find((p) => p.id === round?.activePlayerId) ?? null);
  const submittedSet = $derived(new Set(round?.submittedIds ?? []));
  // Primitive-valued deriveds so the timer effect below only restarts when the
  // turn/round actually changes — not on every game clone (e.g. remote answers).
  const timerSeconds = $derived($game?.settings.timerSeconds ?? null);
  const activePid = $derived(round?.activePlayerId ?? null);
  const roundPhase = $derived(round?.phase ?? null);
  const roundIndex = $derived(round?.index ?? -1);

  let answers = $state<Record<string, string>>({});
  let handoffOpen = $state(false);
  let showLeaveConfirm = $state(false);
  let showSettings = $state(false);
  let showTimeUp = $state(false);
  let timeLeft = $state<number | null>(null);

  // Settings stay editable while nothing has been played yet — a wrong timer
  // or round count is cheap to fix on round one, pointless to fix later.
  const canEditSettings = $derived(!remote && roundIndex === 0 && roundPhase === 'entry');

  // Prefill inputs for the active player each time the turn changes (fresh & empty
  // at turn start, or resumed from existing answers if reloading mid-turn).
  // Keyed on the turn primitives only: every updateGame clones the game, and
  // tracking the round object would wipe words being typed (e.g. mid-round
  // settings edits).
  $effect(() => {
    void roundIndex;
    const pid = activePid;
    if (!pid) return;
    answers = untrack(() => {
      const r = round;
      const prefill: Record<string, string> = {};
      for (const catId of r?.categoryIds ?? []) {
        const existing = r?.answers.find((a) => a.playerId === pid && a.categoryId === catId);
        prefill[catId] = existing?.word ?? '';
      }
      return prefill;
    });
  });

  // Per-turn countdown; paused while the handoff panel is covering the screen.
  $effect(() => {
    void roundIndex; // restart per round
    if (!timerSeconds || !activePid || roundPhase !== 'entry' || handoffOpen) {
      timeLeft = null;
      return;
    }
    timeLeft = timerSeconds;
    const id = setInterval(() => {
      timeLeft = (timeLeft ?? 1) - 1;
      const left = timeLeft ?? 0;
      if (left > 0 && left <= 10) playTick();
      if (left <= 0) {
        clearInterval(id);
        handleTimeUp();
      }
    }, 1000);
    return () => clearInterval(id);
  });

  // Host: send each new round to the guests' devices exactly once.
  let lastBroadcastIndex = -1;
  $effect(() => {
    const g = $game;
    const r = round;
    if (!remote || !g || !r || r.phase !== 'entry' || r.index === lastBroadcastIndex) return;
    lastBroadcastIndex = r.index;
    getActiveRoom()?.broadcast({
      type: 'round',
      roundIndex: r.index,
      // 0 = endless; guests render it as ∞.
      roundCount: g.settings.endless ? 0 : g.settings.roundCount,
      letter: r.letter,
      seconds: g.settings.timerSeconds,
      categories: r.categoryIds.map((catId) => {
        const cat = categoryFor(catId);
        return {
          id: catId,
          label: cat ? $categoryName(cat) : catId,
          emoji: CATEGORY_EMOJI[catId] ?? DEFAULT_EMOJI,
        };
      }),
    });
  });

  function handleGuestAnswers(playerId: string, msg: GuestMessage): void {
    if (msg.type !== 'answers') return;
    let allIn = false;
    updateGame((g) => {
      const r = g.rounds[g.currentRound];
      if (!r || r.phase !== 'entry' || r.index !== msg.roundIndex) return;
      for (const catId of r.categoryIds) {
        const word = msg.answers[catId];
        if (word !== undefined && word.trim() !== '') setAnswer(r, playerId, catId, word);
      }
      const submitted = new Set(r.submittedIds ?? []);
      submitted.add(playerId);
      r.submittedIds = [...submitted];
      if (g.players.every((p) => submitted.has(p.id))) {
        r.phase = 'review';
        allIn = true;
      }
    });
    prefetchSubmitted(msg.answers);
    getActiveRoom()?.sendTo(playerId, { type: 'received' });
    if (allIn) screen.set('review');
  }

  /** Start checking submitted words in the background so the review screen is instant. */
  function prefetchSubmitted(words: Record<string, string | undefined>): void {
    const g = $game;
    const r = round;
    if (!g || !r) return;
    const solo = g.players.length === 1;
    for (const [catId, word] of Object.entries(words)) {
      if (word !== undefined && word.trim() !== '') {
        prefetchWordCheck(
          word,
          catId,
          r.letter,
          g.settings.language,
          g.settings.validation,
          solo,
          g.settings.wikidataCheck !== false,
        );
      }
    }
  }

  function forceReview(): void {
    updateGame((g) => {
      const r = g.rounds[g.currentRound];
      if (r && r.phase === 'entry') r.phase = 'review';
    });
    screen.set('review');
  }

  function categoryFor(catId: string) {
    return $game?.settings.categories.find((c) => c.id === catId) ?? null;
  }

  /** Commit one player's words, then hand the device on or move to review. */
  function commitTurn(pid: string, words: Record<string, string | undefined>): void {
    let movedToReview = false;
    updateGame((g) => {
      const r = g.rounds[g.currentRound];
      if (!r || r.activePlayerId !== pid) return;
      for (const catId of r.categoryIds) {
        const word = words[catId] ?? '';
        if (word.trim() !== '') setAnswer(r, pid, catId, word);
      }
      const idx = g.players.findIndex((p) => p.id === pid);
      const next = g.players[idx + 1];
      if (next) {
        r.activePlayerId = next.id;
      } else {
        r.phase = 'review';
        movedToReview = true;
      }
    });
    prefetchSubmitted(words);
    if (movedToReview) {
      screen.set('review');
    } else {
      handoffOpen = true;
    }
  }

  function submitTurn() {
    if (!$game || !round || !activePlayer) return;
    commitTurn(activePlayer.id, answers);
  }

  /** Enter hops to the next category's input; on the last one it submits the turn. */
  function onAnswerKeydown(e: KeyboardEvent, index: number): void {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (index >= (round?.categoryIds.length ?? 0) - 1) {
      submitTurn();
      return;
    }
    const inputs = document.querySelectorAll<HTMLInputElement>('.cards .inp');
    inputs[index + 1]?.focus();
  }

  // The robot plays its own turn: think briefly, then answer from the lists.
  let botTurnKey = '';
  $effect(() => {
    const g = $game;
    const r = round;
    const p = activePlayer;
    if (!g || !r || !p || remote || roundPhase !== 'entry' || p.isBot !== true) return;
    const key = `${String(roundIndex)}:${p.id}`;
    if (botTurnKey === key) return;
    botTurnKey = key;
    void (async () => {
      const [words] = await Promise.all([
        botAnswers(g.settings.language, r.letter, r.categoryIds),
        new Promise((resolve) => setTimeout(resolve, BOT_THINK_MS)),
      ]);
      commitTurn(p.id, words);
    })();
  });

  function handleTimeUp() {
    showTimeUp = true;
    // The 1.2s pause doubles as a grace window in remote mode: guests'
    // buzzer-beater answers still land while the round is officially open.
    setTimeout(() => {
      showTimeUp = false;
      if (remote) forceReview();
      else submitTurn();
    }, 1200);
  }

  function setTimer(value: number | null): void {
    updateGame((g) => {
      g.settings.timerSeconds = value;
    });
  }

  function adjustRounds(delta: number): void {
    updateGame((g) => {
      g.settings.endless = false;
      g.settings.roundCount = Math.min(10, Math.max(1, g.settings.roundCount + delta));
    });
  }

  function toggleEndless(): void {
    updateGame((g) => {
      g.settings.endless = g.settings.endless !== true;
    });
  }

  function setScoring(value: ScoringSystem): void {
    updateGame((g) => {
      g.settings.scoring = value;
    });
  }

  function setValidation(value: ValidationMode): void {
    updateGame((g) => {
      g.settings.validation = value;
    });
  }

  function toggleWikidata(): void {
    updateGame((g) => {
      g.settings.wikidataCheck = g.settings.wikidataCheck === false;
    });
  }

  function toggleFunFacts(): void {
    updateGame((g) => {
      g.settings.funFacts = g.settings.funFacts === false;
    });
  }

  function onBack() {
    showLeaveConfirm = true;
  }

  function confirmLeave() {
    showLeaveConfirm = false;
    if (remote) setActiveRoom(null); // ends the room; guests are told
    screen.set('home');
  }
</script>

{#if round && $game}
  {#if handoffOpen}
    <div class="handoff">
      {#if activePlayer !== null && activePlayer.avatar !== undefined}
        <div class="handoff-emoji">
          <Avatar
            name={activePlayer.name}
            avatar={activePlayer.avatar}
            colorIndex={activePlayer.colorIndex}
            size={96}
          />
        </div>
      {:else}
        <div class="handoff-emoji">🙈</div>
      {/if}
      {#if activePlayer?.isBot === true}
        <p class="handoff-text">
          {$t('round.botThinking').replace('{name}', activePlayer.name)}
        </p>
      {:else}
        <p class="handoff-text">
          {$t('round.yourTurn').replace('{name}', activePlayer?.name ?? '')}
        </p>
        <Button variant="primary" block onclick={() => (handoffOpen = false)}
          >{$t('common.ok')}</Button
        >
      {/if}
    </div>
  {:else}
    <TopBar
      title={$t('round.title')
        .replace('{n}', String(round.index + 1))
        .replace('{total}', $game.settings.endless ? '∞' : String($game.settings.roundCount))}
      onback={onBack}
      backLabel={$t('setup.back')}
    >
      {#snippet action()}
        {#if canEditSettings}
          <button
            type="button"
            class="settings-btn"
            aria-label={$t('round.settings')}
            onclick={() => (showSettings = true)}
          >
            ⚙️
          </button>
        {/if}
      {/snippet}
    </TopBar>

    <div class="letter-row">
      <LetterTile letter={round.letter} />
      {#if $game.settings.timerSeconds}
        <TimerPill seconds={timeLeft ?? $game.settings.timerSeconds} />
      {/if}
    </div>

    {#if remote}
      <div class="waiting-box">
        <p class="waiting-title">{$t('round.waitingFor')}</p>
        <div class="waiting-chips">
          {#each players as p (p.id)}
            <span class="wait-chip" class:done={submittedSet.has(p.id)}>
              {submittedSet.has(p.id) ? '✔ ' : ''}{p.name}
            </span>
          {/each}
        </div>
      </div>
      <Button variant="secondary" block onclick={forceReview}>{$t('round.finishNow')}</Button>
    {:else}
      <div class="cards">
        {#each round.categoryIds as catId, i (catId)}
          {@const cat = categoryFor(catId)}
          {@const val = answers[catId] ?? ''}
          <Card>
            <div class="cat-header">
              <span class="cat-emoji">{CATEGORY_EMOJI[catId] ?? DEFAULT_EMOJI}</span>
              <span class="cat-name">{cat ? $categoryName(cat) : catId}</span>
            </div>
            <TextInput
              bind:value={() => answers[catId] ?? '', (v) => (answers[catId] = v)}
              enterkeyhint={i === round.categoryIds.length - 1 ? 'done' : 'next'}
              onkeydown={(e) => onAnswerKeydown(e, i)}
              error={val !== '' && !matchesLetter(val, round.letter)
                ? $t('round.letterHint').replace('{letter}', round.letter)
                : ''}
            />
          </Card>
        {/each}
      </div>

      <Button variant="primary" block onclick={submitTurn}>{$t('round.done')}</Button>
    {/if}
  {/if}

  <Modal open={showLeaveConfirm}>
    <p class="modal-text">{$t('round.leaveConfirm')}</p>
    <div class="modal-actions">
      <Button variant="secondary" block onclick={() => (showLeaveConfirm = false)}
        >{$t('common.cancel')}</Button
      >
      <Button variant="danger" block onclick={confirmLeave}>{$t('common.ok')}</Button>
    </div>
  </Modal>

  <Modal open={showTimeUp}>
    <p class="modal-text">{$t('round.timeUp')}</p>
  </Modal>

  <Modal open={showSettings}>
    <div class="settings-body">
      <p class="settings-title">{$t('round.settings')}</p>

      <div class="settings-group">
        <span class="field-label">{$t('setup.timer')}</span>
        <div class="chip-row">
          {#each TIMER_OPTIONS as opt (String(opt.value))}
            <Chip on={$game.settings.timerSeconds === opt.value} onclick={() => setTimer(opt.value)}
              >{$t(opt.key)}</Chip
            >
          {/each}
        </div>
      </div>

      <div class="settings-group">
        <span class="field-label">{$t('setup.rounds')}</span>
        <div class="stepper">
          <Button variant="secondary" onclick={() => adjustRounds(-1)}>−</Button>
          <span class="stepper-value"
            >{$game.settings.endless ? '∞' : $game.settings.roundCount}</span
          >
          <Button variant="secondary" onclick={() => adjustRounds(1)}>+</Button>
          <Chip on={$game.settings.endless === true} onclick={toggleEndless}
            >{$t('setup.rounds.endless')}</Chip
          >
        </div>
      </div>

      {#if players.length > 1}
        <div class="settings-group">
          <span class="field-label">{$t('setup.scoring')}</span>
          <div class="chip-row">
            <Chip on={$game.settings.scoring === 'unique'} onclick={() => setScoring('unique')}
              >{$t('setup.scoring.unique')}</Chip
            >
            <Chip on={$game.settings.scoring === 'simple'} onclick={() => setScoring('simple')}
              >{$t('setup.scoring.simple')}</Chip
            >
          </div>
        </div>
      {/if}

      <label class="settings-group">
        <span class="field-label">{$t('setup.validation')}</span>
        <select
          class="native-select"
          value={$game.settings.validation}
          onchange={(e) => setValidation(e.currentTarget.value as ValidationMode)}
        >
          <option value="hybrid">{$t('setup.validation.hybrid')}</option>
          <option value="bundled">{$t('setup.validation.bundled')}</option>
          <option value="dictionary">{$t('setup.validation.dictionary')}</option>
          <option value="vote">{$t('setup.validation.vote')}</option>
          <option value="none">{$t('setup.validation.none')}</option>
        </select>
      </label>

      <div class="settings-group">
        <span class="field-label">{$t('setup.online')}</span>
        <div class="chip-row">
          <Chip on={$game.settings.wikidataCheck !== false} onclick={toggleWikidata}
            >{$game.settings.wikidataCheck !== false ? '✓ ' : ''}{$t('setup.wikidata')}</Chip
          >
          <Chip on={$game.settings.funFacts !== false} onclick={toggleFunFacts}
            >{$game.settings.funFacts !== false ? '✓ ' : ''}{$t('setup.funFact')}</Chip
          >
        </div>
      </div>

      <Button variant="primary" block onclick={() => (showSettings = false)}
        >{$t('common.close')}</Button
      >
    </div>
  </Modal>
{/if}

<style>
  .handoff {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-5);
    padding: var(--space-5);
    text-align: center;
  }
  .handoff-emoji {
    font-size: 64px;
  }
  .handoff-text {
    font-size: var(--font-size-h1);
    font-weight: var(--font-weight-heading);
    line-height: var(--line-height-h1);
    max-inline-size: 320px;
  }
  .handoff :global(.btn) {
    max-inline-size: 320px;
  }
  .letter-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    justify-content: center;
    /* Pinned while the (often long) category list scrolls, so the letter and
       the ticking timer stay in view. Bleeds into the shell padding so cards
       vanish cleanly behind it. */
    position: sticky;
    inset-block-start: 0;
    z-index: var(--z-sticky);
    background: var(--color-bg);
    margin-inline: calc(-1 * var(--space-4));
    padding-inline: var(--space-4);
    padding-block: var(--space-2);
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
  }
  .waiting-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }
  .waiting-title {
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-heading);
  }
  .waiting-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }
  .wait-chip {
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-pill);
    padding-block: var(--space-2);
    padding-inline: var(--space-4);
    font-weight: var(--font-weight-subheading);
  }
  .wait-chip.done {
    background: var(--color-success);
    color: var(--color-on-success);
    border-color: var(--color-success);
  }
  .cat-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-block-end: var(--space-2);
  }
  .cat-emoji {
    font-size: 24px;
  }
  .cat-name {
    font-weight: var(--font-weight-subheading);
    font-size: var(--font-size-body);
  }
  .settings-btn {
    inline-size: 48px;
    block-size: 48px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .settings-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    text-align: start;
  }
  .settings-title {
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-heading);
    line-height: var(--line-height-h2);
  }
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .field-label {
    font-weight: var(--font-weight-subheading);
    font-size: var(--font-size-small);
    color: var(--color-muted);
  }
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .stepper-value {
    font-size: var(--font-size-h1);
    font-weight: var(--font-weight-display);
    font-variant-numeric: tabular-nums;
    min-inline-size: 2ch;
    text-align: center;
  }
  .native-select {
    inline-size: 100%;
    min-block-size: 48px;
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: var(--font-weight-body);
    font-family: inherit;
    padding-inline: var(--space-4);
  }
  .modal-text {
    font-weight: var(--font-weight-subheading);
    margin-block-end: var(--space-4);
  }
  .modal-actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
