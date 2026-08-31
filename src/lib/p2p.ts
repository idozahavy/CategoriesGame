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
    /** null while the guest is disconnected (kept for reconnects after lock). */
    conn: DataConnection | null;
    name: string;
  }
  const seats = new Map<string, Seat>();
  let locked = false;
  let guestsChangeCb: ((guests: GuestInfo[]) => void) | null = null;
  let guestMessageCb: ((playerId: string, msg: GuestMessage) => void) | null = null;
  let seatCounter = 0;
  // Replayed to reconnecting guests so they land on the current screen.
  let lastRound: HostMessage | null = null;
  let lastScores: HostMessage | null = null;

  const guests = (): GuestInfo[] =>
    [...seats.entries()].map(([playerId, s]) => ({ playerId, name: s.name }));

  const broadcast = (msg: HostMessage): void => {
    if (msg.type === 'round') {
      lastRound = msg;
      lastScores = null;
    } else if (msg.type === 'scores') {
      lastScores = msg;
    }
    for (const s of seats.values()) if (s.conn) void s.conn.send(msg);
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
    let seatId: string | null = null;

    conn.on('data', (data) => {
      if (!isGuestMessage(data)) return;
      if (data.type === 'hello') {
        if (seatId) return; // duplicate hello on this connection
        const wanted = sanitizeName(data.name);
        if (locked) {
          // After lock, only a known player may come back (reload / dropped
          // connection) — matched by name, since names were deduplicated.
          const existing = [...seats.entries()].find(
            ([, s]) => s.name.toLocaleLowerCase() === wanted.toLocaleLowerCase(),
          );
          if (!existing) {
            void conn.send({ type: 'busy' } satisfies HostMessage);
            setTimeout(() => {
              conn.close();
            }, 500);
            return;
          }
          const [playerId, seat] = existing;
          seat.conn?.close(); // supersede a stale duplicate connection
          seat.conn = conn;
          seatId = playerId;
          void conn.send({ type: 'welcome', playerId } satisfies HostMessage);
          void conn.send({ type: 'roster', names: guests().map((g) => g.name) });
          if (lastScores) void conn.send(lastScores);
          else if (lastRound) void conn.send(lastRound);
          return;
        }
        seatCounter += 1;
        const playerId = `guest-${String(seatCounter)}-${String(Date.now() % 100000)}`;
        seats.set(playerId, { conn, name: uniqueName(wanted) });
        seatId = playerId;
        void conn.send({ type: 'welcome', playerId } satisfies HostMessage);
        notifyRoster();
        return;
      }
      if (seatId && seats.get(seatId)?.conn === conn) guestMessageCb?.(seatId, data);
    });

    const dropped = (): void => {
      if (!seatId) return;
      const seat = seats.get(seatId);
      if (!seat || seat.conn !== conn) return; // superseded by a reconnect
      if (locked) {
        seat.conn = null; // keep the seat so the player can come back
      } else if (seats.delete(seatId)) {
        notifyRoster(); // in the lobby, leaving really means leaving
      }
    };
    conn.on('close', dropped);
    conn.on('error', dropped);
  });

  return {
    code,
    guests,
    broadcast,
    sendTo: (playerId, msg) => {
      const conn = seats.get(playerId)?.conn;
      if (conn) void conn.send(msg);
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
