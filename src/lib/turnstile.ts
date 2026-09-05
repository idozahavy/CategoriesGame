/**
 * Cloudflare Turnstile — a bot check that proves to /turn-credentials the
 * request comes from a real browser on this site, not a script with forged
 * headers. Without a site key (local dev, deploys that skipped the setup) it
 * yields no token and the endpoint decides whether to insist on one.
 */

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback': () => void;
  /** Stay invisible unless the challenge genuinely needs the player's input. */
  appearance: 'interaction-only';
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Loading the widget plus solving a non-interactive challenge normally takes < 2 s. */
const TOKEN_TIMEOUT_MS = 10_000;

let scriptPromise: Promise<void> | null = null;

/** Loads the api script once; the api object itself is read fresh from `window` after. */
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.turnstile !== undefined) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('turnstile script failed to load'));
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    // A failed load isn't remembered — the next room tries again.
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

/**
 * Solves one challenge and returns its single-use token, or null when Turnstile
 * is not configured, fails, or takes too long. Never throws.
 */
export async function getTurnstileToken(): Promise<string | null> {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (siteKey === undefined || siteKey === '') return null;
  try {
    await loadScript();
    const api = window.turnstile;
    if (api === undefined) throw new Error('turnstile api missing after load');
    const container = document.createElement('div');
    document.body.append(container);
    let widgetId: string | undefined;
    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        resolve(null);
      }, TOKEN_TIMEOUT_MS);
      const finish = (value: string | null): void => {
        clearTimeout(timer);
        resolve(value);
      };
      widgetId = api.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: finish,
        'error-callback': () => {
          finish(null);
        },
      });
    });
    if (widgetId !== undefined) api.remove(widgetId);
    container.remove();
    return token;
  } catch (error) {
    console.error('turnstile unavailable', error);
    return null;
  }
}
