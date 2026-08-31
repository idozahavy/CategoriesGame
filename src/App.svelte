<script lang="ts">
  import { onMount } from 'svelte';
  import { screen, game } from './lib/stores';
  import { pack, uiLanguage, persistLanguage } from './lib/i18n';
  import { theme, persistTheme } from './lib/theme';
  import { loadGame } from './lib/db';
  import { screenForGame } from './lib/game';
  import { readActiveGameId, persistActiveGame } from './lib/session';
  import { reopenRoom, setActiveRoom } from './lib/p2p';
  import Home from './screens/Home.svelte';
  import NewGame from './screens/NewGame.svelte';
  import Join from './screens/Join.svelte';
  import Resume from './screens/Resume.svelte';
  import Round from './screens/Round.svelte';
  import Review from './screens/Review.svelte';
  import Scoreboard from './screens/Scoreboard.svelte';
  import LearnedWords from './screens/LearnedWords.svelte';
  import Leaderboard from './screens/Leaderboard.svelte';

  // Keep <html dir/lang> in sync with the active language (RTL support),
  // and remember the choice across visits.
  $effect(() => {
    document.documentElement.dir = $pack.dir;
    document.documentElement.lang = $pack.code;
    persistLanguage($uiLanguage);
  });

  // Apply + remember the theme (tokens switch on [data-theme="dark"]).
  $effect(() => {
    document.documentElement.dataset.theme = $theme;
    persistTheme($theme);
  });

  // Hosting a phones-join game, this screen is the shared "TV" — scale it up
  // so letter, timer and scores read from across the room.
  const tvMode = $derived(
    $game?.settings.remote === true &&
      ($screen === 'round' || $screen === 'review' || $screen === 'scoreboard'),
  );

  // Captured before the persist effect below first runs (it clears the record
  // while the screen is still 'home').
  const restoreGameId = readActiveGameId();

  // Remember which game is on screen, so a reload lands back in it.
  $effect(() => {
    persistActiveGame($screen, $game);
  });

  /** Reload/tab-restore mid-game: load the save and jump back to its screen. */
  async function restoreActiveGame(id: string): Promise<void> {
    try {
      const loaded = await loadGame(id);
      // Bail if the game is gone/over, or the player already navigated away.
      if (!loaded || loaded.status === 'finished' || $screen !== 'home') return;
      if (loaded.settings.remote === true && loaded.settings.roomCode !== undefined) {
        try {
          setActiveRoom(
            await reopenRoom(
              loaded.settings.roomCode,
              loaded.players.map((p) => ({
                playerId: p.id,
                name: p.name,
                avatar: p.avatar,
                deviceId: p.deviceId,
              })),
            ),
          );
        } catch {
          // Room couldn't be reopened — the host can still end the round alone.
        }
      }
      if ($screen !== 'home') return; // navigated away while the room reopened
      game.set(loaded);
      screen.set(screenForGame(loaded));
    } catch {
      // Storage failed — stay on the home screen.
    }
  }

  // The app has no router, so the browser back button would leave the page
  // entirely (jarring mid-game, especially back-swipes on touch). Keep one
  // sentinel entry so back returns to the Home screen instead — any running
  // game is already autosaved and reachable via Resume.
  onMount(() => {
    // Opened from a scanned QR code (?join=CODE) — jump straight to joining.
    if (new URLSearchParams(location.search).get('join') !== null) screen.set('join');
    else if (restoreGameId !== null) void restoreActiveGame(restoreGameId);
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

<main class="shell" class:tv={tvMode}>
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
  {:else if $screen === 'learned'}
    <LearnedWords />
  {:else if $screen === 'leaderboard'}
    <Leaderboard />
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
  .shell.tv {
    max-inline-size: 560px;
    /* design-ignore: provisional shared-screen scale — real TV type tokens are an open design question */
    zoom: 1.3;
  }
</style>
