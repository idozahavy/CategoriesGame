<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '../lib/ui/Button.svelte';
  import TextInput from '../lib/ui/TextInput.svelte';
  import Card from '../lib/ui/Card.svelte';
  import TopBar from '../lib/ui/TopBar.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Avatar from '../lib/ui/Avatar.svelte';
  import { AVATAR_EMOJI, fileToAvatar } from '../lib/avatar';
  import LetterTile from '../lib/ui/LetterTile.svelte';
  import TimerPill from '../lib/ui/TimerPill.svelte';
  import { t } from '../lib/i18n';
  import { screen } from '../lib/stores';
  import { matchesLetter } from '../lib/game';
  import { joinRoom, normalizeRoomCode, type GuestSession, type HostMessage } from '../lib/p2p';

  type GuestPhase = 'form' | 'connecting' | 'lobby' | 'entry' | 'waiting' | 'scores' | 'error';
  type RoundMsg = Extract<HostMessage, { type: 'round' }>;
  type ScoresMsg = Extract<HostMessage, { type: 'scores' }>;

  let phase = $state<GuestPhase>('form');
  let code = $state('');
  let name = $state('');
  let avatar = $state<string | undefined>(undefined);
  let codeError = $state('');
  let nameError = $state('');
  let errorKey = $state('join.error.network');
  let avatarPickerOpen = $state(false);
  let avatarFileInput: HTMLInputElement | undefined = $state();

  let session: GuestSession | null = null;
  let roster = $state<string[]>([]);

  // Remember who/where this tab joined so a reload (or dropped connection)
  // can jump straight back into the running game — the host keeps the seat.
  const GUEST_SESSION_KEY = 'categories-guest';
  try {
    const saved = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (saved !== null) {
      const s = JSON.parse(saved) as { code?: string; name?: string; avatar?: string };
      code = s.code ?? '';
      name = s.name ?? '';
      avatar = s.avatar;
    }
  } catch {
    // storage unavailable — start with an empty form
  }
  // Arrived by scanning the host's QR code — the room code rides in the URL.
  const scannedCode = new URLSearchParams(location.search).get('join');
  if (scannedCode !== null && scannedCode !== '') code = scannedCode;
  // Consume the param: a later reload should land wherever the player left off,
  // not be dragged back to the join screen (the code stays prefilled above).
  if (scannedCode !== null) history.replaceState(history.state, '', location.pathname);

  function rememberSession(): void {
    try {
      sessionStorage.setItem(
        GUEST_SESSION_KEY,
        JSON.stringify({ code: normalizeRoomCode(code), name: name.trim(), avatar }),
      );
    } catch {
      // storage unavailable — rejoin just won't be prefilled
    }
  }

  function forgetSession(): void {
    try {
      sessionStorage.removeItem(GUEST_SESSION_KEY);
    } catch {
      // storage unavailable — nothing to forget
    }
  }
  let round = $state<RoundMsg | null>(null);
  let scores = $state<ScoresMsg | null>(null);
  let answers = $state<Record<string, string>>({});
  let submitted = $state(false);
  let timeLeft = $state<number | null>(null);

  onDestroy(() => {
    session?.close();
    session = null;
  });

  function handleMessage(msg: HostMessage): void {
    if (msg.type === 'roster') {
      roster = msg.names;
    } else if (msg.type === 'round') {
      round = msg;
      answers = {};
      submitted = false;
      phase = 'entry';
    } else if (msg.type === 'scores') {
      scores = msg;
      phase = 'scores';
    } else if (msg.type === 'ended') {
      forgetSession();
      // Final scores stay up even when the host closes the room afterwards.
      if (phase !== 'scores') {
        errorKey = 'join.error.hostLeft';
        phase = 'error';
      }
    }
  }

  async function join(): Promise<void> {
    codeError = normalizeRoomCode(code) === '' ? $t('join.error.emptyCode') : '';
    nameError = name.trim() === '' ? $t('join.error.emptyName') : '';
    if (codeError !== '' || nameError !== '') return;
    phase = 'connecting';
    try {
      session = await joinRoom(code, name.trim(), avatar);
      rememberSession();
      session.onMessage(handleMessage);
      session.onClose(() => {
        if (phase !== 'scores' && phase !== 'error') {
          errorKey = 'join.error.disconnected';
          phase = 'error';
        }
      });
      phase = 'lobby';
    } catch (e) {
      errorKey =
        e instanceof Error && e.message === 'not-found'
          ? 'join.error.notFound'
          : 'join.error.network';
      phase = 'error';
    }
  }

  function submitAnswers(): void {
    const r = round;
    if (!session || !r || submitted) return;
    submitted = true;
    session.send({ type: 'answers', roundIndex: r.roundIndex, answers: { ...answers } });
    phase = 'waiting';
  }

  /** Enter hops to the next category's input; on the last one it sends the answers. */
  function onAnswerKeydown(e: KeyboardEvent, index: number): void {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (index >= (round?.categories.length ?? 0) - 1) {
      submitAnswers();
      return;
    }
    const inputs = document.querySelectorAll<HTMLInputElement>('.cards .inp');
    inputs[index + 1]?.focus();
  }

  // Local countdown mirroring the host's; auto-sends when it runs out.
  $effect(() => {
    const seconds = phase === 'entry' ? (round?.seconds ?? null) : null;
    if (!seconds) {
      timeLeft = null;
      return;
    }
    timeLeft = seconds;
    const id = setInterval(() => {
      timeLeft = (timeLeft ?? 1) - 1;
      if ((timeLeft ?? 0) <= 0) {
        clearInterval(id);
        submitAnswers();
      }
    }, 1000);
    return () => {
      clearInterval(id);
    };
  });

  function leave(): void {
    forgetSession();
    session?.close();
    session = null;
    screen.set('home');
  }

  function retry(): void {
    session?.close();
    session = null;
    phase = 'form';
  }

  function pickAvatar(a: string | undefined): void {
    avatar = a;
    avatarPickerOpen = false;
  }

  async function onAvatarFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const picked = await fileToAvatar(file);
    if (picked !== null) pickAvatar(picked);
  }

  const roundTitle = $derived(
    round
      ? $t('round.title')
          .replace('{n}', String(round.roundIndex + 1))
          .replace('{total}', round.roundCount === 0 ? '∞' : String(round.roundCount))
      : '',
  );
</script>

<div class="join">
  <TopBar title={$t('join.title')} onback={leave} backLabel={$t('setup.back')} />

  {#if phase === 'form'}
    <div class="content">
      <div class="emoji">📱</div>
      <TextInput
        label={$t('join.codeLabel')}
        bind:value={code}
        placeholder="ABCD"
        error={codeError}
        oninput={() => (codeError = '')}
      />
      <div class="name-row">
        <button
          type="button"
          class="avatar-btn"
          aria-label={$t('setup.avatar')}
          onclick={() => (avatarPickerOpen = true)}
        >
          <Avatar {name} {avatar} size={44} />
        </button>
        <TextInput
          label={$t('join.nameLabel')}
          bind:value={name}
          error={nameError}
          oninput={() => (nameError = '')}
        />
      </div>
      <Button variant="accent" block onclick={() => void join()}>{$t('join.go')}</Button>
    </div>
  {:else if phase === 'connecting'}
    <div class="center">
      <div class="spinner" role="status" aria-label={$t('join.connecting')}></div>
      <p class="muted">{$t('join.connecting')}</p>
    </div>
  {:else if phase === 'lobby'}
    <div class="center">
      <div class="emoji">🎉</div>
      <p class="big">{$t('join.lobby')}</p>
      <div class="roster">
        {#each roster as n (n)}
          <span class="roster-chip">{n}</span>
        {/each}
      </div>
    </div>
  {:else if phase === 'entry' && round}
    <div class="letter-row">
      <LetterTile letter={round.letter} />
      {#if round.seconds}
        <TimerPill seconds={timeLeft ?? round.seconds} />
      {/if}
    </div>
    <p class="round-title">{roundTitle}</p>
    <div class="cards">
      {#each round.categories as cat, i (cat.id)}
        {@const val = answers[cat.id] ?? ''}
        <Card>
          <div class="cat-header">
            <span class="cat-emoji">{cat.emoji}</span>
            <span class="cat-name">{cat.label}</span>
          </div>
          <TextInput
            bind:value={() => answers[cat.id] ?? '', (v) => (answers[cat.id] = v)}
            enterkeyhint={i === round.categories.length - 1 ? 'done' : 'next'}
            onkeydown={(e) => onAnswerKeydown(e, i)}
            error={val !== '' && !matchesLetter(val, round.letter)
              ? $t('round.letterHint').replace('{letter}', round.letter)
              : ''}
          />
        </Card>
      {/each}
    </div>
    <Button variant="primary" block disabled={submitted} onclick={submitAnswers}
      >{$t('round.done')}</Button
    >
  {:else if phase === 'waiting'}
    <div class="center">
      <div class="emoji">👀</div>
      <p class="big">{$t('join.waiting')}</p>
    </div>
  {:else if phase === 'scores' && scores}
    <div class="content">
      <h1 class="scores-title">{$t('score.title')}</h1>
      <div class="score-rows">
        {#each scores.rows as row (row.name)}
          <Card>
            <div class="score-row">
              <span class="score-name">{row.name}</span>
              <b class="score-value">{row.score}</b>
            </div>
          </Card>
        {/each}
      </div>
      <p class="big">{$t('score.winner').replace('{name}', scores.winner)}</p>
      <Button variant="primary" block onclick={leave}>{$t('score.home')}</Button>
    </div>
  {:else if phase === 'error'}
    <div class="center">
      <div class="emoji">🙈</div>
      <p class="big">{$t(errorKey)}</p>
      <div class="error-actions">
        <Button variant="primary" onclick={retry}>{$t('join.tryAgain')}</Button>
        <Button variant="ghost" onclick={leave}>{$t('score.home')}</Button>
      </div>
    </div>
  {/if}
</div>

<Modal open={avatarPickerOpen}>
  <p class="avatar-title">{$t('setup.avatar')}</p>
  <div class="emoji-grid">
    {#each AVATAR_EMOJI as emoji (emoji)}
      <button type="button" class="emoji-option" onclick={() => pickAvatar(emoji)}>{emoji}</button>
    {/each}
  </div>
  <div class="avatar-actions">
    <Button variant="secondary" block onclick={() => avatarFileInput?.click()}
      >{$t('setup.avatar.upload')}</Button
    >
    <Button variant="ghost" block onclick={() => pickAvatar(undefined)}
      >{$t('common.remove')}</Button
    >
    <Button variant="ghost" block onclick={() => (avatarPickerOpen = false)}
      >{$t('common.close')}</Button
    >
  </div>
  <input
    type="file"
    accept="image/*"
    hidden
    bind:this={avatarFileInput}
    onchange={(e) => void onAvatarFile(e)}
  />
</Modal>

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
    justify-content: center;
    gap: var(--space-3);
  }
  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    text-align: center;
  }
  .emoji {
    font-size: 64px;
    text-align: center;
  }
  .big {
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-heading);
    line-height: var(--line-height-h2);
    max-inline-size: 320px;
    text-align: center;
    margin-inline: auto;
  }
  .muted {
    color: var(--color-muted);
  }
  .roster {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }
  .roster-chip {
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-pill);
    padding-block: var(--space-1);
    padding-inline: var(--space-3);
    font-weight: var(--font-weight-subheading);
  }
  .name-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }
  .name-row :global(.field) {
    flex: 1;
  }
  .avatar-btn {
    background: none;
    border: none;
    padding: var(--space-1);
    min-inline-size: 48px;
    min-block-size: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: var(--radius-pill);
  }
  .avatar-title {
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-heading);
    margin-block-end: var(--space-3);
  }
  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
    margin-block-end: var(--space-4);
  }
  .emoji-option {
    min-block-size: 48px;
    font-size: 28px;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .avatar-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .letter-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    justify-content: center;
    /* Pinned while the (often long) category list scrolls, so the letter and
       the ticking timer stay in view. Bleeds into the shell padding so cards
       vanish cleanly behind it. */
    position: sticky;
    inset-block-start: 0;
    z-index: var(--z-sticky);
    background: var(--color-bg);
    margin-inline: calc(-1 * var(--space-4));
    padding-inline: var(--space-4);
    padding-block: var(--space-2);
  }
  .round-title {
    text-align: center;
    color: var(--color-muted);
    font-weight: var(--font-weight-subheading);
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
  }
  .cat-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-block-end: var(--space-2);
  }
  .cat-emoji {
    font-size: 24px;
  }
  .cat-name {
    font-weight: var(--font-weight-subheading);
    font-size: var(--font-size-body);
  }
  .scores-title {
    font-size: var(--font-size-h1);
    font-weight: var(--font-weight-display);
    text-align: center;
  }
  .score-rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .score-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .score-name {
    font-weight: var(--font-weight-subheading);
  }
  .score-value {
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-h2);
  }
  .error-actions {
    display: flex;
    gap: var(--space-2);
  }
  .spinner {
    inline-size: 40px;
    block-size: 40px;
    border-radius: var(--radius-pill);
    border: 5px solid var(--color-border);
    border-block-start-color: var(--color-primary);
    animation: spin 800ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
