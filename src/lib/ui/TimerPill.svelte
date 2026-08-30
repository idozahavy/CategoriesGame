<script lang="ts">
  let { seconds }: { seconds: number } = $props();

  const warn = $derived(seconds <= 15);
  const label = $derived(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
</script>

<span class="timer" class:warn>{label}</span>

<style>
  .timer {
    background: var(--color-primary);
    color: var(--color-on-primary);
    border-radius: var(--radius-pill);
    font-weight: var(--font-weight-display);
    font-size: var(--font-size-h2);
    font-variant-numeric: tabular-nums;
    padding-block: var(--space-2);
    padding-inline: var(--space-5);
  }
  .warn {
    background: var(--color-danger);
    color: var(--color-on-danger);
    animation: pulse var(--duration-pulse) ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.12);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .warn {
      animation: none;
    }
  }
</style>
