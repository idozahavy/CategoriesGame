import Peer, { type DataConnection } from 'peerjs';

/**
 * P2P room layer (WebRTC via PeerJS + its free public broker for signaling).
 * The host screen is authoritative: guests only render what the host sends
 * and send back their name and answers. All incoming data is untrusted and
 * validated before use.
 */

/** Category as shown on a guest device (label pre-resolved in the game language). */
export interface RoundCategory {
  id: string;
  label: string;
  emoji: string;
}

export type GuestMessage =
  | { type: 'hello'; name: string }
  | { type: 'answers'; roundIndex: number; answers: Record<string, string> };

export type HostMessage =
  | { type: 'welcome'; playerId: string }
  | { type: 'roster'; names: string[] }
  | { type: 'busy' }
  | {
      type: 'round';
      roundIndex: number;
      roundCount: number;
      letter: string;
      seconds: number | null;
      categories: RoundCategory[];
    }
  | { type: 'received' }
  | { type: 'scores'; rows: { name: string; score: number }[]; winner: string }
  | { type: 'ended' };

export interface GuestInfo {
  playerId: string;
  name: string;
}

export type JoinFailure = 'not-found' | 'network';

/** Peer-id namespace; the 4-letter code is the only part players type. */
const PEER_PREFIX = 'kidcategories-v1-';
/** No I/L/O/0/1 — kids must be able to read the code out loud without confusion. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;
const MAX_NAME_LENGTH = 20;
const JOIN_TIMEOUT_MS = 12000;

export function makeRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)] ?? 'A';
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toLocaleUpperCase().replace(/\s+/g, '');
}

function sanitizeName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, MAX_NAME_LENGTH) : '';
  return name === '' ? 'Player' : name;
}

function isGuestMessage(v: unknown): v is GuestMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  if (m['type'] === 'hello') return typeof m['name'] === 'string';
  if (m['type'] === 'answers') {
    if (typeof m['roundIndex'] !== 'number') return false;
    const answers = m['answers'];
    if (typeof answers !== 'object' || answers === null) return false;
    return Object.values(answers).every((w) => typeof w === 'string');
  }
  return false;
}

function isHostMessage(v: unknown): v is HostMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m['type'] === 'string' &&
    ['welcome', 'roster', 'busy', 'round', 'received', 'scores', 'ended'].includes(m['type'])
  );
}

// ---------------------------------------------------------------------------
// Host side
// ---------------------------------------------------------------------------

export interface HostRoom {
  code: string;
  guests(): GuestInfo[];
  broadcast(msg: HostMessage): void;
  sendTo(playerId: string, msg: HostMessage): void;
  onGuestsChange(cb: ((guests: GuestInfo[]) => void) | null): void;
  onGuestMessage(cb: ((playerId: string, msg: GuestMessage) => void) | null): void;
  /** Stop accepting new joins (called when the game starts). */
  lock(): void;
  close(): void;
}

/** Open a room on the public broker; retries with a fresh code on collision. */
export function createRoom(attempts = 3): Promise<HostRoom> {
  return new Promise((resolve, reject) => {
    const code = makeRoomCode();
    const peer = new Peer(PEER_PREFIX + code);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      peer.destroy();
      reject(new Error('network'));
    }, JOIN_TIMEOUT_MS);

    peer.on('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(buildHostRoom(code, peer));
    });

    peer.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      peer.destroy();
      if (err.type === 'unavailable-id' && attempts > 1) {
        resolve(createRoom(attempts - 1));
      } else {
        reject(new Error('network'));
      }
    });
  });
}

function buildHostRoom(code: string, peer: Peer): HostRoom {
  interface Seat {
    conn: DataConnection;
    name: string;
  }
  const seats = new Map<string, Seat>();
  let locked = false;
  let guestsChangeCb: ((guests: GuestInfo[]) => void) | null = null;
  let guestMessageCb: ((playerId: string, msg: GuestMessage) => void) | null = null;
  let seatCounter = 0;

  const guests = (): GuestInfo[] =>
    [...seats.entries()].map(([playerId, s]) => ({ playerId, name: s.name }));

  const broadcast = (msg: HostMessage): void => {
    for (const s of seats.values()) void s.conn.send(msg);
  };

  const notifyRoster = (): void => {
    guestsChangeCb?.(guests());
    broadcast({ type: 'roster', names: guests().map((g) => g.name) });
  };

  /** Same visible name twice would be indistinguishable on the shared screen. */
  const uniqueName = (wanted: string): string => {
    const taken = new Set([...seats.values()].map((s) => s.name.toLocaleLowerCase()));
    if (!taken.has(wanted.toLocaleLowerCase())) return wanted;
    for (let n = 2; ; n++) {
      const candidate = `${wanted} ${String(n)}`;
      if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
    }
  };

  peer.on('connection', (conn) => {
    if (locked) {
      conn.on('open', () => {
        void conn.send({ type: 'busy' } satisfies HostMessage);
        setTimeout(() => {
          conn.close();
        }, 500);
      });
      return;
    }
    seatCounter += 1;
    const playerId = `guest-${String(seatCounter)}-${String(Date.now() % 100000)}`;
    conn.on('data', (data) => {
      if (!isGuestMessage(data)) return;
      if (data.type === 'hello') {
        if (seats.has(playerId)) return; // duplicate hello
        seats.set(playerId, { conn, name: uniqueName(sanitizeName(data.name)) });
        void conn.send({ type: 'welcome', playerId } satisfies HostMessage);
        notifyRoster();
        return;
      }
      if (seats.has(playerId)) guestMessageCb?.(playerId, data);
    });
    conn.on('close', () => {
      if (seats.delete(playerId)) notifyRoster();
    });
    conn.on('error', () => {
      if (seats.delete(playerId)) notifyRoster();
    });
  });

  return {
    code,
    guests,
    broadcast,
    sendTo: (playerId, msg) => {
      void seats.get(playerId)?.conn.send(msg);
    },
    onGuestsChange: (cb) => {
      guestsChangeCb = cb;
    },
    onGuestMessage: (cb) => {
      guestMessageCb = cb;
    },
    lock: () => {
      locked = true;
    },
    close: () => {
      broadcast({ type: 'ended' });
      setTimeout(() => {
        peer.destroy();
      }, 500);
      seats.clear();
    },
  };
}

/**
 * The live room survives across screens (lobby → rounds → scoreboard) but is
 * runtime-only — never part of GameState (connections can't be serialized).
 */
let activeRoom: HostRoom | null = null;

export function setActiveRoom(room: HostRoom | null): void {
  if (activeRoom && activeRoom !== room) activeRoom.close();
  activeRoom = room;
}

export function getActiveRoom(): HostRoom | null {
  return activeRoom;
}

// ---------------------------------------------------------------------------
// Guest side
// ---------------------------------------------------------------------------

export interface GuestSession {
  playerId: string;
  send(msg: GuestMessage): void;
  onMessage(cb: ((msg: HostMessage) => void) | null): void;
  onClose(cb: (() => void) | null): void;
  close(): void;
}

/** Join a room by code; rejects with Error('not-found' | 'network'). */
export function joinRoom(code: string, name: string): Promise<GuestSession> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    let settled = false;
    let messageCb: ((msg: HostMessage) => void) | null = null;
    let closeCb: (() => void) | null = null;

    const fail = (reason: JoinFailure): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      peer.destroy();
      reject(new Error(reason));
    };

    const timeout = setTimeout(() => {
      fail('network');
    }, JOIN_TIMEOUT_MS);

    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') fail('not-found');
      else fail('network');
    });

    peer.on('open', () => {
      const conn = peer.connect(PEER_PREFIX + normalizeRoomCode(code), { reliable: true });
      conn.on('open', () => {
        void conn.send({ type: 'hello', name } satisfies GuestMessage);
      });
      conn.on('data', (data) => {
        if (!isHostMessage(data)) return;
        if (!settled && data.type === 'welcome') {
          settled = true;
          clearTimeout(timeout);
          resolve({
            playerId: data.playerId,
            send: (msg) => {
              void conn.send(msg);
            },
            onMessage: (cb) => {
              messageCb = cb;
            },
            onClose: (cb) => {
              closeCb = cb;
            },
            close: () => {
              conn.close();
              peer.destroy();
            },
          });
          return;
        }
        if (!settled && data.type === 'busy') {
          fail('not-found');
          return;
        }
        messageCb?.(data);
      });
      conn.on('close', () => {
        if (!settled) fail('network');
        else closeCb?.();
      });
      conn.on('error', () => {
        if (!settled) fail('network');
        else closeCb?.();
      });
    });
  });
}
