import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRoom } from './p2p';
import { FakePeer, flush } from './p2p.test-helpers';

vi.mock('peerjs', async () => {
  const { FakePeer: Peer } = await import('./p2p.test-helpers');
  return { default: Peer };
});

// A successful TURN lookup is remembered for the whole page load (module
// state), so this file holds only that case; the not-remembered failure cases
// live in p2p.host.test.ts where they cannot poison later tests.

beforeEach(() => {
  FakePeer.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openRoom(): Promise<FakePeer> {
  const pending = createRoom();
  await flush();
  const peer = FakePeer.last();
  peer.emit('open');
  await pending;
  return peer;
}

describe('TURN credentials for the peer', () => {
  it('asks /turn-credentials once and hands the ice servers to every peer afterwards', async () => {
    const iceServers = [{ urls: 'turn:relay.example', username: 'u', credential: 'c' }];
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(Response.json({ iceServers })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await openRoom();
    const second = await openRoom();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/turn-credentials');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(first.options).toEqual({ config: { iceServers } });
    expect(second.options).toEqual({ config: { iceServers } });
  });
});
