<script lang="ts">
  let {
    name,
    score,
    colorIndex,
  }: { name: string; score: number; colorIndex: number } = $props();
</script>

<div class="row">
  <div class="avatar" style="background: var(--color-player-{colorIndex});">
    {name.slice(0, 1).toLocaleUpperCase()}
  </div>
  <b class="name">{name}</b>
  <span class="score">{score}</span>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-block: var(--space-2);
    padding-inline: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-bg);
  }
  .avatar {
    inline-size: 40px;
    block-size: 40px;
    border-radius: var(--radius-pill);
    color: var(--color-surface);
    font-weight: var(--font-weight-display);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .score {
    margin-inline-start: auto;
    font-weight: var(--font-weight-display);
    font-variant-numeric: tabular-nums;
    font-size: 20px;
  }
</style>
