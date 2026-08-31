<script lang="ts">
  import { onMount } from 'svelte';
  import { screen } from './lib/stores';
  import { pack, uiLanguage, persistLanguage } from './lib/i18n';
  import Home from './screens/Home.svelte';
  import NewGame from './screens/NewGame.svelte';
  import Join from './screens/Join.svelte';
  import Resume from './screens/Resume.svelte';
  import Round from './screens/Round.svelte';
  import Review from './screens/Review.svelte';
  import Scoreboard from './screens/Scoreboard.svelte';

  // Keep <html dir/lang> in sync with the active language (RTL support),
  // and remember the choice across visits.
  $effect(() => {
    document.documentElement.dir = $pack.dir;
    document.documentElement.lang = $pack.code;
    persistLanguage($uiLanguage);
  });

  // The app has no router, so the browser back button would leave the page
  // entirely (jarring mid-game, especially back-swipes on touch). Keep one
  // sentinel entry so back returns to the Home screen instead — any running
  // game is already autosaved and reachable via Resume.
  onMount(() => {
    history.pushState({ inApp: true }, '');
    const onPop = (): void => {
      history.pushState({ inApp: true }, '');
      screen.set('home');
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  });
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
