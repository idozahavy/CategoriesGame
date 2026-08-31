<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '../lib/ui/Button.svelte';
  import TextInput from '../lib/ui/TextInput.svelte';
  import Card from '../lib/ui/Card.svelte';
  import TopBar from '../lib/ui/TopBar.svelte';
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
  let codeError = $state('');
  let nameError = $state('');
  let errorKey = $state('join.error.network');

  let session: GuestSession | null = null;
  let roster = $state<string[]>([]);

  // Remember who/where this tab joined so a reload (or dropped connection)
  // can jump straight back into the running game — the host keeps the seat.
  const GUEST_SESSION_KEY = 'categories-guest';
  try {
    const saved = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (saved !== null) {
      const s = JSON.parse(saved) as { code?: string; name?: string };
      code = s.code ?? '';
      name = s.name ?? '';
    }
  } catch {
    // storage unavailable — start with an empty form
  }

  function rememberSession(): void {
    try {
      sessionStorage.setItem(
        GUEST_SESSION_KEY,
        JSON.stringify({ code: normalizeRoomCode(code), name: name.trim() }),
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
      session = await joinRoom(code, name.trim());
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

  const roundTitle = $derived(
    round
      ? $t('round.title')
          .replace('{n}', String(round.roundIndex + 1))
          .replace('{total}', String(round.roundCount))
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
      <TextInput
        label={$t('join.nameLabel')}
        bind:value={name}
        error={nameError}
        oninput={() => (nameError = '')}
      />
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
      {#each round.categories as cat (cat.id)}
        {@const val = answers[cat.id] ?? ''}
        <Card>
          <div class="cat-header">
            <span class="cat-emoji">{cat.emoji}</span>
            <span class="cat-name">{cat.label}</span>
          </div>
          <TextInput
            bind:value={() => answers[cat.id] ?? '', (v) => (answers[cat.id] = v)}
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
  .letter-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    justify-content: center;
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
