<script lang="ts">
  import Button from '../lib/ui/Button.svelte';
  import TopBar from '../lib/ui/TopBar.svelte';
  import { t } from '../lib/i18n';
  import { screen } from '../lib/stores';
</script>

<div class="join">
  <TopBar title={$t('join.title')} onback={() => screen.set('home')} />
  <div class="content">
    <div class="emoji">📱</div>
    <p class="hint">{$t('join.soon')}</p>
    <Button variant="primary" block onclick={() => screen.set('home')}>{$t('score.home')}</Button>
  </div>
</div>

<style>
  .join {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    text-align: center;
  }
  .emoji {
    font-size: 72px;
  }
  .hint {
    color: var(--color-muted);
    max-inline-size: 320px;
    margin-block-end: var(--space-3);
  }
  .content :global(.btn) {
    max-inline-size: 320px;
  }
</style>
