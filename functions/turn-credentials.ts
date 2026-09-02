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
 */

interface Env {
  TURN_KEY_ID?: string;
  TURN_API_TOKEN?: string;
}

/** Credentials must outlive a whole game evening, not just the handshake. */
const CREDENTIAL_TTL_SECONDS = 86_400;
const UPSTREAM_TIMEOUT_MS = 8_000;

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

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  if (!isSameOrigin(context.request)) return json({ error: 'forbidden' }, 403);
  const { TURN_KEY_ID, TURN_API_TOKEN } = context.env;
  if (TURN_KEY_ID === undefined || TURN_API_TOKEN === undefined) {
    return json({ error: 'turn-not-configured' }, 503);
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
