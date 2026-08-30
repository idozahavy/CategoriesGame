<script lang="ts">
  import { screen } from './lib/stores';
  import Home from './screens/Home.svelte';
  import NewGame from './screens/NewGame.svelte';
  import Join from './screens/Join.svelte';
  import Resume from './screens/Resume.svelte';
  import Round from './screens/Round.svelte';
  import Review from './screens/Review.svelte';
  import Scoreboard from './screens/Scoreboard.svelte';
</script>

<main class="shell">
  {#if $screen === 'home'}
    <Home />
  {:else if $screen === 'new-game'}
    <NewGame />
  {:else if $screen === 'join'}
    <Join />
  {:else if $screen === 'resume'}
    <Resume />
  {:else if $screen === 'round'}
    <Round />
  {:else if $screen === 'review'}
    <Review />
  {:else if $screen === 'scoreboard'}
    <Scoreboard />
  {/if}
</main>

<style>
  .shell {
    inline-size: 100%;
    max-inline-size: 480px;
    min-block-size: 100dvh;
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    gap: var(--space-4);
  }
</style>
