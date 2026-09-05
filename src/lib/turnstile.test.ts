import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTurnstileToken } from './turnstile';

/**
 * Minimal DOM: `document.head.append(script)` hands the script to the test
 * (which installs a fake `window.turnstile` and fires onload), while
 * `document.body.append` and `Element.remove` are no-ops.
 */
interface FakeScript {
  src?: string;
  async?: boolean;
  onload?: () => void;
  onerror?: () => void;
}

function stubDom(onScript: (script: FakeScript) => void): { appended: number } {
  const stats = { appended: 0 };
  vi.stubGlobal('document', {
    createElement: (tag: string) => (tag === 'script' ? {} : { remove: () => undefined }),
    head: {
      append: (script: FakeScript) => {
        stats.appended += 1;
        queueMicrotask(() => {
          onScript(script);
        });
      },
    },
    body: { append: () => undefined },
  });
  return stats;
}

interface RenderOptions {
  sitekey: string;
  appearance: string;
  callback: (token: string) => void;
  'error-callback': () => void;
}

function installTurnstile(behaviour: 'token' | 'error'): {
  removed: string[];
  rendered: RenderOptions[];
} {
  const removed: string[] = [];
  const rendered: RenderOptions[] = [];
  vi.stubGlobal('window', {
    turnstile: {
      render: (_container: unknown, options: RenderOptions) => {
        rendered.push(options);
        queueMicrotask(() => {
          if (behaviour === 'token') options.callback('the-token');
          else options['error-callback']();
        });
        return 'widget-1';
      },
      remove: (id: string) => {
        removed.push(id);
      },
    },
  });
  return { removed, rendered };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('getTurnstileToken', () => {
  it('yields no token without a site key and touches no DOM', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const stats = stubDom(() => undefined);
    await expect(getTurnstileToken()).resolves.toBeNull();
    expect(stats.appended).toBe(0);
  });

  it('loads the api script once, renders an interaction-only widget and returns its token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    vi.stubGlobal('window', {});
    let seen: FakeScript | undefined;
    let turnstile: ReturnType<typeof installTurnstile> | undefined;
    const stats = stubDom((script) => {
      seen = script;
      turnstile = installTurnstile('token');
      script.onload?.();
    });

    await expect(getTurnstileToken()).resolves.toBe('the-token');
    await expect(getTurnstileToken()).resolves.toBe('the-token');

    expect(seen?.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    expect(stats.appended).toBe(1);
    expect(turnstile?.rendered[0]).toMatchObject({
      sitekey: 'site-key',
      appearance: 'interaction-only',
    });
    expect(turnstile?.removed).toEqual(['widget-1', 'widget-1']);
  });

  it('returns null when the widget reports an error', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installTurnstile('error');
    stubDom(() => undefined);
    await expect(getTurnstileToken()).resolves.toBeNull();
  });
});
