<script lang="ts">
  import { onMount } from 'svelte';
  import { game, screen, updateGame } from '../lib/stores';
  import { t, categoryName } from '../lib/i18n';
  import { setAnswer, matchesLetter } from '../lib/game';
  import { getActiveRoom, setActiveRoom, type GuestMessage } from '../lib/p2p';
  import TopBar from '../lib/ui/TopBar.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Button from '../lib/ui/Button.svelte';
  import Card from '../lib/ui/Card.svelte';
  import TextInput from '../lib/ui/TextInput.svelte';
  import LetterTile from '../lib/ui/LetterTile.svelte';
  import TimerPill from '../lib/ui/TimerPill.svelte';

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
  let showTimeUp = $state(false);
  let timeLeft = $state<number | null>(null);

  // Prefill inputs for the active player each time the turn changes (fresh & empty
  // at turn start, or resumed from existing answers if reloading mid-turn).
  $effect(() => {
    const r = round;
    const pid = activePlayer?.id;
    if (!r || !pid) return;
    const prefill: Record<string, string> = {};
    for (const catId of r.categoryIds) {
      const existing = r.answers.find((a) => a.playerId === pid && a.categoryId === catId);
      prefill[catId] = existing?.word ?? '';
    }
    answers = prefill;
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
      if ((timeLeft ?? 0) <= 0) {
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
      roundCount: g.settings.roundCount,
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
    getActiveRoom()?.sendTo(playerId, { type: 'received' });
    if (allIn) screen.set('review');
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

  function submitTurn() {
    if (!$game || !round || !activePlayer) return;
    const currentPid = activePlayer.id;
    let movedToReview = false;
    updateGame((g) => {
      const r = g.rounds[g.currentRound];
      if (!r) return;
      for (const catId of r.categoryIds) {
        const word = answers[catId] ?? '';
        if (word.trim() !== '') setAnswer(r, currentPid, catId, word);
      }
      const idx = g.players.findIndex((p) => p.id === currentPid);
      const next = g.players[idx + 1];
      if (next) {
        r.activePlayerId = next.id;
      } else {
        r.phase = 'review';
        movedToReview = true;
      }
    });
    if (movedToReview) {
      screen.set('review');
    } else {
      handoffOpen = true;
    }
  }

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
      <div class="handoff-emoji">🙈</div>
      <p class="handoff-text">{$t('round.yourTurn').replace('{name}', activePlayer?.name ?? '')}</p>
      <Button variant="primary" block onclick={() => (handoffOpen = false)}
        >{$t('common.ok')}</Button
      >
    </div>
  {:else}
    <TopBar
      title={$t('round.title')
        .replace('{n}', String(round.index + 1))
        .replace('{total}', String($game.settings.roundCount))}
      onback={onBack}
      backLabel={$t('setup.back')}
    />

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
        {#each round.categoryIds as catId (catId)}
          {@const cat = categoryFor(catId)}
          {@const val = answers[catId] ?? ''}
          <Card>
            <div class="cat-header">
              <span class="cat-emoji">{CATEGORY_EMOJI[catId] ?? DEFAULT_EMOJI}</span>
              <span class="cat-name">{cat ? $categoryName(cat) : catId}</span>
            </div>
            <TextInput
              bind:value={() => answers[catId] ?? '', (v) => (answers[catId] = v)}
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
  .modal-text {
    font-weight: var(--font-weight-subheading);
    margin-block-end: var(--space-4);
  }
  .modal-actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
