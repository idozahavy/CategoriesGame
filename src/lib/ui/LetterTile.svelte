<script lang="ts">
  let { letter, size = 96 }: { letter: string; size?: number } = $props();
</script>

<div class="tile" style="inline-size:{size}px;block-size:{size}px;font-size:{Math.round(size * 0.58)}px;">
  {letter}
</div>

<style>
  .tile {
    background: var(--color-accent);
    color: var(--color-on-accent);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-display);
    box-shadow: var(--shadow-card);
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
    .tile {
      animation: none;
    }
  }
</style>
