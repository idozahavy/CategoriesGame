<script lang="ts">
  import Avatar from './Avatar.svelte';

  let {
    name,
    score,
    colorIndex,
    avatar = undefined,
  }: { name: string; score: number; colorIndex: number; avatar?: string } = $props();
</script>

<div class="row">
  <Avatar {name} {avatar} {colorIndex} size={40} />
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
