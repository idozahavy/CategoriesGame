import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequestPost } from './turn-credentials';

const env = { TURN_KEY_ID: 'key-1', TURN_API_TOKEN: 'secret-token' };

function request(headers: Record<string, string> = { 'Sec-Fetch-Site': 'same-origin' }): Request {
  return new Request('https://kategoria.pages.dev/turn-credentials', { method: 'POST', headers });
}

function stubUpstream(impl: () => Promise<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /turn-credentials', () => {
  it('refuses cross-site callers before touching the TURN API', async () => {
    const fetchMock = stubUpstream(() => Promise.resolve(Response.json({})));
    const res = await onRequestPost({ request: request({ 'Sec-Fetch-Site': 'cross-site' }), env });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'forbidden' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the Origin header when Sec-Fetch-Site is missing', async () => {
    stubUpstream(() => Promise.resolve(Response.json({ iceServers: [] })));
    const same = await onRequestPost({
      request: request({ Origin: 'https://kategoria.pages.dev' }),
      env,
    });
    const other = await onRequestPost({
      request: request({ Origin: 'https://evil.example' }),
      env,
    });
    const none = await onRequestPost({ request: request({}), env });
    expect(same.status).toBe(200);
    expect(other.status).toBe(403);
    expect(none.status).toBe(403);
  });

  it('answers 503 when the TURN secrets are not configured', async () => {
    const fetchMock = stubUpstream(() => Promise.resolve(Response.json({})));
    const res = await onRequestPost({ request: request(), env: { TURN_KEY_ID: 'key-1' } });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'turn-not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mints 24 h credentials with the bearer token and passes the ice servers through', async () => {
    const body = { iceServers: [{ urls: 'turn:relay', username: 'u', credential: 'c' }] };
    const fetchMock = stubUpstream(() => Promise.resolve(Response.json(body)));

    const res = await onRequestPost({ request: request(), env });

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key-1/credentials/generate-ice-servers',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    expect(JSON.parse(init.body as string)).toEqual({ ttl: 86_400 });
  });

  it('reports an upstream failure as 502, whether it answered badly or not at all', async () => {
    stubUpstream(() => Promise.resolve(new Response('down', { status: 500 })));
    const bad = await onRequestPost({ request: request(), env });
    expect(bad.status).toBe(502);
    await expect(bad.json()).resolves.toEqual({ error: 'turn-upstream' });

    stubUpstream(() => Promise.reject(new Error('timeout')));
    const thrown = await onRequestPost({ request: request(), env });
    expect(thrown.status).toBe(502);
  });
});
