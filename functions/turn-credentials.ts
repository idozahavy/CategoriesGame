/**
 * Cloudflare Pages Function (deployed alongside dist/): POST /turn-credentials
 * mints short-lived TURN credentials via the Cloudflare Realtime TURN API, so
 * guests behind strict NATs/firewalls (cellular, office WiFi) can relay their
 * WebRTC connection. The client treats any failure as "no TURN" and keeps
 * working STUN-only, so this endpoint is safe to leave unconfigured.
 *
 * Setup (once per Pages project): create a TURN key in the Cloudflare
 * dashboard (Realtime → TURN), then store both values as Pages secrets:
 *   npx wrangler pages secret put TURN_KEY_ID --project-name=kategoria
 *   npx wrangler pages secret put TURN_API_TOKEN --project-name=kategoria
 * Recommended: a Turnstile widget (dashboard → Turnstile) whose site key goes
 * in `.env` as VITE_TURNSTILE_SITE_KEY and whose secret is a Pages secret:
 *   npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=kategoria
 * With the secret set, every mint must carry a fresh Turnstile token.
 */

interface Env {
  TURN_KEY_ID?: string;
  TURN_API_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
}

/**
 * Long enough for a game evening (the client re-fetches for rooms opened
 * later), short enough that a leaked credential is not a day-long free relay.
 */
const CREDENTIAL_TTL_SECONDS = 2 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 8_000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Only the game's own pages may mint credentials — each one is a 24h pass to
 * relay arbitrary traffic through the account's TURN quota. Browsers stamp
 * Sec-Fetch-Site on every request; Origin is the fallback for older ones.
 * (Scripted callers can forge both — the Cloudflare rate-limiting rule on
 * this path, see README, is the second layer.)
 */
function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite !== null) return fetchSite === 'same-origin';
  const origin = request.headers.get('Origin');
  return origin !== null && origin === new URL(request.url).origin;
}

/** The client sends `{ turnstileToken }`; anything else (no body, bad JSON) means no token. */
async function readTurnstileToken(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json();
    const token =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)['turnstileToken']
        : undefined;
    return typeof token === 'string' && token !== '' ? token : null;
  } catch {
    return null;
  }
}

type TurnstileVerdict = 'passed' | 'failed' | 'unavailable';

/**
 * Turnstile tokens are single-use and expire after five minutes, so a token
 * replayed from a real browser session is worth exactly one mint.
 */
async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
): Promise<TurnstileVerdict> {
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        ...(remoteIp === null ? {} : { remoteip: remoteIp }),
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return 'unavailable';
    const body: unknown = await res.json();
    const success =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)['success']
        : undefined;
    return success === true ? 'passed' : 'failed';
  } catch {
    return 'unavailable';
  }
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  if (!isSameOrigin(context.request)) return json({ error: 'forbidden' }, 403);
  const { TURN_KEY_ID, TURN_API_TOKEN, TURNSTILE_SECRET_KEY } = context.env;
  if (TURN_KEY_ID === undefined || TURN_API_TOKEN === undefined) {
    return json({ error: 'turn-not-configured' }, 503);
  }
  if (TURNSTILE_SECRET_KEY !== undefined) {
    const token = await readTurnstileToken(context.request);
    if (token === null) return json({ error: 'turnstile-required' }, 403);
    const verdict = await verifyTurnstile(
      TURNSTILE_SECRET_KEY,
      token,
      context.request.headers.get('CF-Connecting-IP'),
    );
    if (verdict === 'failed') return json({ error: 'turnstile-failed' }, 403);
    if (verdict === 'unavailable') return json({ error: 'turnstile-upstream' }, 502);
  }
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TURN_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
    if (!res.ok) return json({ error: 'turn-upstream' }, 502);
    // Passed through as-is: { iceServers: [{ urls, username?, credential? }] }.
    return json(await res.json(), 200);
  } catch {
    return json({ error: 'turn-upstream' }, 502);
  }
}
