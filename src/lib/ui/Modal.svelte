<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open = false, children }: { open?: boolean; children: Snippet } = $props();
</script>

{#if open}
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="modal">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--color-text) 50%, transparent);
    z-index: var(--z-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
  }
  .modal {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    max-inline-size: 360px;
    inline-size: 100%;
    text-align: center;
    z-index: var(--z-modal);
    animation: pop var(--duration-enter) var(--easing-spring) both;
  }
  @keyframes pop {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    70% {
      transform: scale(1.08);
      opacity: 1;
    }
    100% {
      transform: scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .modal {
      animation: none;
    }
  }
</style>
