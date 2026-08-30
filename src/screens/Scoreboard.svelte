<script lang="ts">
  import { game, screen, updateGame } from '../lib/stores';
  import { t } from '../lib/i18n';
  import { totalScores, createGame, startNextRound } from '../lib/game';
  import { saveGame } from '../lib/db';
  import Button from '../lib/ui/Button.svelte';
  import ScoreRow from '../lib/ui/ScoreRow.svelte';

  $effect(() => {
    if (!$game) screen.set('home');
  });

  // Reaching the scoreboard ends the game.
  $effect(() => {
    if ($game && $game.status !== 'finished') {
      updateGame((g) => {
        g.status = 'finished';
      });
    }
  });

  const standings = $derived.by(() => {
    if (!$game) return [];
    const totals = totalScores($game);
    return $game.players
      .map((p) => ({ player: p, score: totals.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);
  });

  const topScore = $derived(standings[0]?.score ?? 0);
  const winnerNames = $derived(
    standings.filter((s) => s.score === topScore).map((s) => s.player.name),
  );
  const winnerText = $derived($t('score.winner').replace('{name}', winnerNames.join(' & ')));

  const confettiDots = Array.from({ length: 24 }, (_, i) => i);
  function dotColor(i: number) {
    return `var(--color-player-${(i % 8) + 1})`;
  }
  function dotLeft(i: number) {
    return `${(i * 37) % 100}%`;
  }
  function dotDelay(i: number) {
    return `${(i % 6) * 0.08}s`;
  }

  function playAgain() {
    if (!$game) return;
    const fresh = createGame($game.settings, $game.players);
    startNextRound(fresh);
    game.set(fresh);
    void saveGame(fresh);
    screen.set('round');
  }

  function goHome() {
    updateGame((g) => {
      g.status = 'finished';
    });
    screen.set('home');
  }
</script>

{#if $game}
  <div class="confetti" aria-hidden="true">
    {#each confettiDots as i (i)}
      <span
        class="dot"
        style="inset-inline-start:{dotLeft(i)}; background:{dotColor(i)}; animation-delay:{dotDelay(
          i,
        )};"
      ></span>
    {/each}
  </div>

  <h1 class="title">{$t('score.title')}</h1>

  <div class="rows">
    {#each standings as s (s.player.id)}
      <div class="row-wrap" class:top={s.score === topScore}>
        {#if s.score === topScore}<span class="crown">👑</span>{/if}
        <ScoreRow name={s.player.name} score={s.score} colorIndex={s.player.colorIndex} />
      </div>
    {/each}
  </div>

  <p class="winner">{winnerText}</p>

  <div class="actions">
    <Button variant="accent" block onclick={playAgain}>{$t('score.playAgain')}</Button>
    <Button variant="secondary" block onclick={goHome}>{$t('score.home')}</Button>
  </div>
{/if}

<style>
  .confetti {
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: var(--z-toast);
  }
  .dot {
    position: absolute;
    inset-block-start: -8px;
    inline-size: 8px;
    block-size: 8px;
    border-radius: var(--radius-pill);
    animation: fall 1.5s ease-in forwards;
  }
  @keyframes fall {
    to {
      transform: translateY(110vh) rotate(180deg);
      opacity: 0.4;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .confetti {
      display: none;
    }
  }
  .title {
    font-size: var(--font-size-display);
    font-weight: var(--font-weight-display);
    line-height: var(--line-height-display);
    text-align: center;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex: 1;
  }
  .row-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .row-wrap.top {
    transform: scale(1.05);
  }
  .row-wrap :global(.row) {
    flex: 1;
  }
  .crown {
    font-size: 24px;
    flex-shrink: 0;
  }
  .winner {
    text-align: center;
    font-size: var(--font-size-h1);
    font-weight: var(--font-weight-heading);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
