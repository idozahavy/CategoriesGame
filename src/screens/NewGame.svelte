<script lang="ts">
  import Button from '../lib/ui/Button.svelte';
  import TextInput from '../lib/ui/TextInput.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import TopBar from '../lib/ui/TopBar.svelte';
  import { t, categoryName, uiLanguage, availablePacks } from '../lib/i18n';
  import { screen, game } from '../lib/stores';
  import { saveGame } from '../lib/db';
  import { createGame, startNextRound, newId, DEFAULT_CATEGORY_IDS } from '../lib/game';
  import type {
    CategoryDef,
    GameMode,
    GameSettings,
    PlayerDef,
    ScoringSystem,
    ValidationMode,
  } from '../lib/types';

  type PlayerDraft = { id: string; name: string };

  const CATEGORY_EMOJI: Record<string, string> = {
    animal: '🐶',
    food: '🍕',
    city: '🏙️',
    country: '🌍',
    name: '📛',
    plant: '🌱',
    profession: '💼',
    object: '📦',
    sport: '⚽',
    color: '🎨',
  };
  const BUILTIN_CATEGORY_KEYS = [
    'animal',
    'food',
    'city',
    'country',
    'name',
    'plant',
    'profession',
    'object',
    'sport',
    'color',
  ];
  const builtinCategories: CategoryDef[] = BUILTIN_CATEGORY_KEYS.map((k) => ({
    id: k,
    nameKey: k,
    emoji: CATEGORY_EMOJI[k],
  }));

  const TIMER_OPTIONS: { value: number | null; key: string }[] = [
    { value: null, key: 'setup.timer.none' },
    { value: 180, key: 'setup.timer.relaxed' },
    { value: 120, key: 'setup.timer.normal' },
    { value: 60, key: 'setup.timer.fast' },
  ];

  let step = $state(1);

  // Step 1
  let players = $state<PlayerDraft[]>([{ id: newId(), name: '' }]);

  // Step 2
  let mode = $state<GameMode>('classic');
  let customCategories = $state<CategoryDef[]>([]);
  let selectedCategoryIds = $state<string[]>([...DEFAULT_CATEGORY_IDS]);
  let newCategoryName = $state('');

  // Step 3
  let scoring = $state<ScoringSystem>('unique');
  let timerSeconds = $state<number | null>(120);
  let roundCount = $state(3);
  let validation = $state<ValidationMode>('hybrid');
  let gameLanguage = $state('en');

  const allCategories: CategoryDef[] = $derived([...builtinCategories, ...customCategories]);
  const canProceedCategories = $derived(selectedCategoryIds.length > 0);
  const stepTitle = $derived.by(() => {
    if (step === 1) return $t('setup.players');
    if (step === 2) return $t('setup.mode');
    return $t('setup.step3');
  });

  function addPlayer(): void {
    if (players.length >= 8) return;
    players = [...players, { id: newId(), name: '' }];
  }

  function removePlayer(id: string): void {
    if (players.length <= 1) return;
    players = players.filter((p) => p.id !== id);
  }

  function toggleCategory(id: string): void {
    selectedCategoryIds = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter((x) => x !== id)
      : [...selectedCategoryIds, id];
  }

  function addCustomCategory(): void {
    const name = newCategoryName.trim();
    if (!name) return;
    const cat: CategoryDef = { id: newId(), customName: name };
    customCategories = [...customCategories, cat];
    selectedCategoryIds = [...selectedCategoryIds, cat.id];
    newCategoryName = '';
  }

  function removeCustomCategory(id: string): void {
    customCategories = customCategories.filter((c) => c.id !== id);
    selectedCategoryIds = selectedCategoryIds.filter((x) => x !== id);
  }

  function goBack(): void {
    if (step > 1) step -= 1;
    else screen.set('home');
  }

  function startGame(): void {
    const finalPlayers: PlayerDef[] = players.map((p, i) => ({
      id: p.id,
      name: p.name.trim() || `Player ${i + 1}`,
      colorIndex: i + 1,
    }));
    const categories = allCategories.filter((c) => selectedCategoryIds.includes(c.id));
    const settings: GameSettings = {
      language: gameLanguage,
      mode,
      scoring: finalPlayers.length === 1 ? 'simple' : scoring,
      validation,
      categories,
      roundCount,
      timerSeconds,
    };
    const state = createGame(settings, finalPlayers);
    startNextRound(state);
    void saveGame(state);
    game.set(state);
    screen.set('round');
  }
</script>

<div class="wizard">
  <TopBar title={stepTitle} onback={goBack} />

  <div class="step-content">
    {#if step === 1}
      <div class="players-list">
        {#each players as player, i (player.id)}
          <div class="player-row">
            <TextInput
              bind:value={player.name}
              placeholder={`${$t('setup.playerName')} ${i + 1}`}
            />
            {#if i > 0}
              <Button variant="ghost" onclick={() => removePlayer(player.id)}>✕</Button>
            {/if}
          </div>
        {/each}
      </div>
      <Button variant="secondary" onclick={addPlayer} disabled={players.length >= 8}>
        {$t('setup.addPlayer')}
      </Button>
    {:else if step === 2}
      <div class="mode-grid">
        <button
          type="button"
          class="mode-card"
          class:selected={mode === 'classic'}
          onclick={() => (mode = 'classic')}
        >
          <span class="mode-title">{$t('setup.mode.classic')}</span>
          <span class="mode-hint">{$t('setup.mode.classic.hint')}</span>
        </button>
        <button
          type="button"
          class="mode-card"
          class:selected={mode === 'single'}
          onclick={() => (mode = 'single')}
        >
          <span class="mode-title">{$t('setup.mode.single')}</span>
          <span class="mode-hint">{$t('setup.mode.single.hint')}</span>
        </button>
      </div>

      <h2 class="section-title">{$t('setup.categories')}</h2>
      <div class="chip-grid">
        {#each builtinCategories as cat (cat.id)}
          <Chip on={selectedCategoryIds.includes(cat.id)} onclick={() => toggleCategory(cat.id)}>
            {cat.emoji}
            {$categoryName(cat)}
          </Chip>
        {/each}
        {#each customCategories as cat (cat.id)}
          <div class="custom-chip">
            <Chip on={selectedCategoryIds.includes(cat.id)} onclick={() => toggleCategory(cat.id)}>
              {cat.customName}
            </Chip>
            <button
              type="button"
              class="chip-remove"
              aria-label="Remove"
              onclick={() => removeCustomCategory(cat.id)}
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
      <div class="add-category">
        <TextInput bind:value={newCategoryName} placeholder={$t('setup.addCategory')} />
        <Button variant="secondary" onclick={addCustomCategory}>{$t('setup.addCategory')}</Button>
      </div>
    {:else}
      {#if players.length > 1}
        <h2 class="section-title">{$t('setup.scoring')}</h2>
        <div class="mode-grid">
          <button
            type="button"
            class="mode-card"
            class:selected={scoring === 'unique'}
            onclick={() => (scoring = 'unique')}
          >
            <span class="mode-title">{$t('setup.scoring.unique')}</span>
            <span class="mode-hint">{$t('setup.scoring.unique.hint')}</span>
          </button>
          <button
            type="button"
            class="mode-card"
            class:selected={scoring === 'simple'}
            onclick={() => (scoring = 'simple')}
          >
            <span class="mode-title">{$t('setup.scoring.simple')}</span>
            <span class="mode-hint">{$t('setup.scoring.simple.hint')}</span>
          </button>
        </div>
      {/if}

      <h2 class="section-title">{$t('setup.timer')}</h2>
      <div class="chip-row">
        {#each TIMER_OPTIONS as opt (String(opt.value))}
          <Chip on={timerSeconds === opt.value} onclick={() => (timerSeconds = opt.value)}
            >{$t(opt.key)}</Chip
          >
        {/each}
      </div>

      <h2 class="section-title">{$t('setup.rounds')}</h2>
      <div class="stepper">
        <Button variant="secondary" onclick={() => (roundCount = Math.max(1, roundCount - 1))}
          >−</Button
        >
        <span class="stepper-value">{roundCount}</span>
        <Button variant="secondary" onclick={() => (roundCount = Math.min(10, roundCount + 1))}
          >+</Button
        >
      </div>

      <details class="advanced">
        <summary>{$t('setup.advanced')}</summary>
        <label class="select-field">
          <span class="select-label">{$t('setup.validation')}</span>
          <select class="native-select" bind:value={validation}>
            <option value="hybrid">{$t('setup.validation.hybrid')}</option>
            <option value="bundled">{$t('setup.validation.bundled')}</option>
            <option value="dictionary">{$t('setup.validation.dictionary')}</option>
            <option value="vote">{$t('setup.validation.vote')}</option>
            <option value="none">{$t('setup.validation.none')}</option>
          </select>
        </label>
        <label class="select-field">
          <span class="select-label">{$t('setup.language')}</span>
          <select
            class="native-select"
            bind:value={gameLanguage}
            onchange={() => uiLanguage.set(gameLanguage)}
          >
            {#each availablePacks() as p (p.code)}
              <option value={p.code}>{p.name}</option>
            {/each}
          </select>
        </label>
      </details>
    {/if}
  </div>

  <div class="footer">
    {#if step < 3}
      <Button
        variant="accent"
        block
        disabled={step === 2 && !canProceedCategories}
        onclick={() => (step += 1)}
      >
        {$t('setup.next')}
      </Button>
    {:else}
      <Button variant="accent" block onclick={startGame}>{$t('setup.start')}</Button>
    {/if}
  </div>
</div>

<style>
  .wizard {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-block-size: 0;
  }
  .step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    overflow-y: auto;
  }
  .players-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .player-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .player-row :global(.field) {
    flex: 1;
  }
  .section-title {
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-heading);
    line-height: var(--line-height-h2);
    margin-block-start: var(--space-2);
  }
  .mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .mode-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    text-align: start;
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--space-4);
    min-block-size: 48px;
    cursor: pointer;
    transition: border-color var(--duration-fast) var(--easing-standard);
  }
  .mode-card.selected {
    border-color: var(--color-primary);
    border-width: var(--border-edge-width);
  }
  .mode-title {
    font-weight: var(--font-weight-display);
    font-size: var(--font-size-body);
  }
  .mode-hint {
    color: var(--color-muted);
    font-size: var(--font-size-small);
  }
  .chip-grid,
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .custom-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .chip-remove {
    min-inline-size: 44px;
    min-block-size: 44px;
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add-category {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .add-category :global(.field) {
    flex: 1;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .stepper-value {
    font-size: var(--font-size-h1);
    font-weight: var(--font-weight-display);
    font-variant-numeric: tabular-nums;
    min-inline-size: 2ch;
    text-align: center;
  }
  .advanced {
    margin-block-start: var(--space-2);
  }
  .advanced summary {
    font-weight: var(--font-weight-subheading);
    color: var(--color-primary);
    cursor: pointer;
    padding-block: var(--space-2);
  }
  .select-field {
    display: block;
    margin-block-start: var(--space-2);
  }
  .select-label {
    display: block;
    font-weight: var(--font-weight-subheading);
    font-size: var(--font-size-small);
    color: var(--color-muted);
    margin-block-end: var(--space-1);
  }
  .native-select {
    inline-size: 100%;
    min-block-size: 48px;
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: var(--font-weight-body);
    font-family: inherit;
    padding-inline: var(--space-4);
  }
  .footer {
    flex-shrink: 0;
  }
</style>
