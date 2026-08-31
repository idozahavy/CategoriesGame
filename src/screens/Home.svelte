<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../lib/ui/Button.svelte';
  import { t } from '../lib/i18n';
  import { screen } from '../lib/stores';
  import { listSaves } from '../lib/db';
  import { setActiveRoom } from '../lib/p2p';

  let hasSaves = $state(false);

  onMount(async () => {
    // Arriving home always ends any hosted room (e.g. via the browser back trap).
    setActiveRoom(null);
    try {
      hasSaves = (await listSaves()).some((s) => s.status !== 'finished' && !s.remote);
    } catch {
      hasSaves = false;
    }
  });
</script>

<div class="home">
  <div class="logo">🎪</div>
  <h1 class="title">{$t('app.title')}</h1>
  <p class="tagline">{$t('home.tagline')}</p>

  <div class="actions">
    <Button variant="accent" block onclick={() => screen.set('new-game')}>
      {$t('home.new')}
    </Button>
    <Button variant="primary" block onclick={() => screen.set('join')}>
      {$t('home.join')}
    </Button>
    {#if hasSaves}
      <Button variant="secondary" block onclick={() => screen.set('resume')}>
        {$t('home.resume')}
      </Button>
    {/if}
  </div>
</div>

<style>
  .home {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    text-align: center;
  }
  .logo {
    font-size: 72px;
  }
  .title {
    font-size: var(--font-size-display);
    font-weight: var(--font-weight-display);
    line-height: var(--line-height-display);
  }
  .tagline {
    color: var(--color-muted);
    margin-block-end: var(--space-5);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    inline-size: 100%;
    max-inline-size: 320px;
  }
</style>
