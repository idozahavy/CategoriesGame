<script lang="ts">
  import { onMount } from 'svelte';
  import { game, screen, updateGame } from '../lib/stores';
  import { t, categoryName } from '../lib/i18n';
  import { checkWord } from '../lib/validation';
  import { scoreRound, isFinished, startNextRound } from '../lib/game';
  import type { AnswerEntry } from '../lib/types';
  import TopBar from '../lib/ui/TopBar.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Button from '../lib/ui/Button.svelte';
  import Card from '../lib/ui/Card.svelte';

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

  $effect(() => {
    if (!$game) screen.set('home');
  });

  const round = $derived($game ? $game.rounds[$game.currentRound] : null);

  let checking = $state(true);
  let voteQueue = $state<AnswerEntry[]>([]);
  let currentVote = $state<AnswerEntry | null>(null);
  let scored = $state(false);
  let advancing = $state(false);

  function categoryFor(catId: string) {
    return $game?.settings.categories.find((c) => c.id === catId) ?? null;
  }

  function markInvalid(playerId: string, categoryId: string) {
    updateGame((g) => {
      const r = g.rounds[g.currentRound];
      const entry = r?.answers.find((a) => a.playerId === playerId && a.categoryId === categoryId);
      if (entry) entry.status = 'invalid';
    });
  }

  onMount(async () => {
    const g = $game;
    if (!g) return;
    const r = g.rounds[g.currentRound];
    if (!r) return;
    const pending = r.answers.filter((a) => a.status === 'pending' && a.word !== '');
    const votes: AnswerEntry[] = [];
    for (const a of pending) {
      let verdict: 'valid' | 'invalid' | 'vote';
      try {
        verdict = await checkWord(
          a.word,
          a.categoryId,
          r.letter,
          g.settings.language,
          g.settings.validation,
        );
      } catch {
        verdict = 'vote';
      }
      if (verdict === 'invalid') {
        markInvalid(a.playerId, a.categoryId);
      } else if (verdict === 'vote') {
        if (g.players.length > 1) votes.push(a);
        // solo: auto-accept, stays pending until scored
      }
    }
    checking = false;
    voteQueue = votes;
    advanceVote();
  });

  function advanceVote() {
    const head = voteQueue[0];
    if (!head) {
      currentVote = null;
      finalize();
      return;
    }
    currentVote = head;
  }

  function castVote(accept: boolean) {
    const a = currentVote;
    if (!a) return;
    if (!accept) markInvalid(a.playerId, a.categoryId);
    voteQueue = voteQueue.slice(1);
    advanceVote();
  }

  function finalize() {
    if (scored || !$game) return;
    scored = true;
    updateGame((g) => {
      const r = g.rounds[g.currentRound];
      if (r) scoreRound(g, r);
    });
  }

  function next() {
    if (advancing) return;
    advancing = true;
    updateGame((g) => {
      startNextRound(g);
    });
    screen.set('round');
  }

  function finish() {
    screen.set('scoreboard');
  }

  const voteQuestion = $derived.by(() => {
    if (!currentVote) return '';
    const cat = categoryFor(currentVote.categoryId);
    const catName = cat ? $categoryName(cat).toLocaleLowerCase() : currentVote.categoryId;
    return $t('review.vote.question')
      .replace('{word}', currentVote.word)
      .replace('{category}', catName);
  });
</script>

{#if round && $game}
  <TopBar title={$t('review.title')} />

  {#if checking}
    <div class="spinner-wrap">
      <div class="spinner" role="status" aria-label={$t('review.title')}></div>
    </div>
  {:else if round.phase === 'done'}
    <div class="results">
      {#each round.categoryIds as catId (catId)}
        {@const cat = categoryFor(catId)}
        <Card>
          <div class="cat-header">
            <span class="cat-emoji">{CATEGORY_EMOJI[catId] ?? DEFAULT_EMOJI}</span>
            <span class="cat-name">{cat ? $categoryName(cat) : catId}</span>
          </div>
          <ul class="answer-list">
            {#each $game.players as p (p.id)}
              {@const entry = round.answers.find(
                (a) => a.playerId === p.id && a.categoryId === catId,
              )}
              <li class="answer-row">
                <span class="player-name">{p.name}</span>
                {#if !entry || entry.word === ''}
                  <span class="word-empty">—</span>
                {:else}
                  <span class="word" class:invalid={entry.status === 'invalid'}>{entry.word}</span>
                  <span
                    class="badge"
                    class:success={entry.status === 'valid'}
                    class:warning={entry.status === 'shared'}
                    class:muted={entry.status === 'invalid'}
                  >
                    {entry.status === 'valid'
                      ? $t('review.unique')
                      : entry.status === 'shared'
                        ? $t('review.shared')
                        : $t('review.invalid')}
                    · {entry.points}
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        </Card>
      {/each}
    </div>

    <div class="bottom-actions">
      {#if isFinished($game)}
        <Button variant="accent" block onclick={finish}>{$t('review.finish')}</Button>
      {:else}
        <Button variant="primary" block disabled={advancing} onclick={next}
          >{$t('review.next')}</Button
        >
      {/if}
    </div>
  {/if}

  <Modal open={currentVote !== null}>
    <div class="vote-emoji">🤔</div>
    <p class="vote-question">{voteQuestion}</p>
    <div class="modal-actions">
      <Button variant="primary" block onclick={() => castVote(true)}>{$t('review.vote.yes')}</Button
      >
      <Button variant="danger" block onclick={() => castVote(false)}>{$t('review.vote.no')}</Button>
    </div>
  </Modal>
{/if}

<style>
  .spinner-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-block: var(--space-6);
  }
  .spinner {
    inline-size: 40px;
    block-size: 40px;
    border-radius: var(--radius-pill);
    border: 5px solid var(--color-border);
    border-block-start-color: var(--color-primary);
    animation: spin 800ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
  }
  .cat-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-block-end: var(--space-3);
  }
  .cat-emoji {
    font-size: 24px;
  }
  .cat-name {
    font-weight: var(--font-weight-subheading);
    font-size: var(--font-size-body);
  }
  .answer-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
  }
  .answer-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .player-name {
    font-weight: var(--font-weight-subheading);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .word-empty {
    color: var(--color-muted);
  }
  .word.invalid {
    color: var(--color-muted);
    text-decoration: line-through;
  }
  .badge {
    border-radius: var(--radius-pill);
    padding-block: var(--space-1);
    padding-inline: var(--space-3);
    font-weight: var(--font-weight-subheading);
    font-size: var(--font-size-small);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .badge.success {
    background: var(--color-success);
    color: var(--color-on-success);
  }
  .badge.warning {
    background: var(--color-warning);
    color: var(--color-on-warning);
  }
  .badge.muted {
    background: var(--color-border);
    color: var(--color-muted);
  }
  .bottom-actions {
    display: flex;
  }
  .vote-emoji {
    font-size: 48px;
  }
  .vote-question {
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-heading);
    margin-block: var(--space-3) var(--space-4);
  }
  .modal-actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
