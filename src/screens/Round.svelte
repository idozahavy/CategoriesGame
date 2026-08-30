<script lang="ts">
  import { onMount } from 'svelte';
  import { game, screen, updateGame } from '../lib/stores';
  import { t, categoryName } from '../lib/i18n';
  import { setAnswer, matchesLetter } from '../lib/game';
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

  // Pass-the-device panel at round entry when several players share the screen.
  onMount(() => {
    handoffOpen = players.length > 1;
  });

  const round = $derived($game ? $game.rounds[$game.currentRound] : null);
  const players = $derived($game?.players ?? []);
  const activePlayer = $derived(players.find((p) => p.id === round?.activePlayerId) ?? null);

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
    const seconds = $game?.settings.timerSeconds ?? null;
    const pid = activePlayer?.id;
    const phase = round?.phase;
    if (!seconds || !pid || phase !== 'entry' || handoffOpen) {
      timeLeft = null;
      return;
    }
    timeLeft = seconds;
    const id = setInterval(() => {
      timeLeft = (timeLeft ?? 1) - 1;
      if ((timeLeft ?? 0) <= 0) {
        clearInterval(id);
        handleTimeUp();
      }
    }, 1000);
    return () => clearInterval(id);
  });

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
    setTimeout(() => {
      showTimeUp = false;
      submitTurn();
    }, 1200);
  }

  function onBack() {
    showLeaveConfirm = true;
  }

  function confirmLeave() {
    showLeaveConfirm = false;
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
    />

    <div class="letter-row">
      <LetterTile letter={round.letter} />
      {#if $game.settings.timerSeconds}
        <TimerPill seconds={timeLeft ?? $game.settings.timerSeconds} />
      {/if}
    </div>

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
