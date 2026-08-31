import Peer, { type DataConnection } from 'peerjs';
import { newId } from './game';

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
  | { type: 'hello'; name: string; avatar?: string; deviceId?: string }
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
  avatar?: string;
  /** The guest browser's stable key — lets the same device reclaim its seat. */
  deviceId?: string;
}

export type JoinFailure = 'not-found' | 'network';

/** Peer-id namespace; the 4-letter code is the only part players type. */
const PEER_PREFIX = 'kidcategories-v1-';
/** No I/L/O/0/1 — kids must be able to read the code out loud without confusion. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;
const MAX_NAME_LENGTH = 20;
const MAX_DEVICE_ID_LENGTH = 64;
const JOIN_TIMEOUT_MS = 12000;

const DEVICE_ID_KEY = 'categories-device-id';
const sessionDeviceId = newId();
/**
 * Stable per-browser key sent with every hello, so a device that dropped and
 * reconnected reclaims its own seat instead of joining as "Name 2".
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing !== null && existing !== '') return existing;
    localStorage.setItem(DEVICE_ID_KEY, sessionDeviceId);
    return sessionDeviceId;
  } catch {
    // Storage unavailable — a one-off id still dedupes within this page load.
    return sessionDeviceId;
  }
}

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

/** Longest accepted avatar payload — a ≤512px WebP data URL stays well under this. */
const MAX_AVATAR_LENGTH = 400_000;

/** Accept only a short emoji string or a bounded data:image URL from guests. */
function sanitizeAvatar(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  if (raw.startsWith('data:image/') && raw.length <= MAX_AVATAR_LENGTH) return raw;
  if (!raw.startsWith('data:') && raw.length <= 8) return raw;
  return undefined;
}

function isGuestMessage(v: unknown): v is GuestMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  if (m['type'] === 'hello') {
    if (typeof m['name'] !== 'string') return false;
    // PeerJS's binary serialization turns undefined into null — accept both
    // as "absent" for the optional fields.
    const avatar = m['avatar'];
    if (
      avatar !== undefined &&
      avatar !== null &&
      (typeof avatar !== 'string' || avatar.length > MAX_AVATAR_LENGTH)
    ) {
      return false;
    }
    const deviceId = m['deviceId'];
    return (
      deviceId === undefined ||
      deviceId === null ||
      (typeof deviceId === 'string' && deviceId.length <= MAX_DEVICE_ID_LENGTH)
    );
  }
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

/**
 * Re-register a room under its original code after the host page reloaded.
 * The room starts locked with an empty (disconnected) seat per known player,
 * so guests rejoin their seats by name exactly like a dropped-connection
 * reconnect. Retries briefly — the broker may still hold the pre-reload peer.
 */
export function reopenRoom(code: string, players: GuestInfo[], attempts = 3): Promise<HostRoom> {
  return new Promise((resolve, reject) => {
    const normalized = normalizeRoomCode(code);
    const peer = new Peer(PEER_PREFIX + normalized);
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
      resolve(buildHostRoom(normalized, peer, players));
    });

    peer.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      peer.destroy();
      if (err.type === 'unavailable-id' && attempts > 1) {
        setTimeout(() => {
          resolve(reopenRoom(code, players, attempts - 1));
        }, 2000);
      } else {
        reject(new Error('network'));
      }
    });
  });
}

function buildHostRoom(code: string, peer: Peer, seed?: GuestInfo[]): HostRoom {
  interface Seat {
    /** null while the guest is disconnected (kept for reconnects after lock). */
    conn: DataConnection | null;
    name: string;
    avatar?: string;
    deviceId?: string;
  }
  const seats = new Map<string, Seat>();
  let locked = false;
  if (seed) {
    // Reopened room: every player already has a seat, waiting for its guest.
    for (const p of seed) {
      seats.set(p.playerId, { conn: null, name: p.name, avatar: p.avatar, deviceId: p.deviceId });
    }
    locked = true;
  }
  let guestsChangeCb: ((guests: GuestInfo[]) => void) | null = null;
  let guestMessageCb: ((playerId: string, msg: GuestMessage) => void) | null = null;
  let seatCounter = 0;
  // Replayed to reconnecting guests so they land on the current screen.
  let lastRound: Extract<HostMessage, { type: 'round' }> | null = null;
  let lastRoundAt = 0;
  let lastScores: HostMessage | null = null;

  const guests = (): GuestInfo[] =>
    [...seats.entries()].map(([playerId, s]) => ({
      playerId,
      name: s.name,
      avatar: s.avatar,
      deviceId: s.deviceId,
    }));

  const broadcast = (msg: HostMessage): void => {
    if (msg.type === 'round') {
      lastRound = msg;
      lastRoundAt = Date.now();
      lastScores = null;
    } else if (msg.type === 'scores') {
      lastScores = msg;
    }
    for (const s of seats.values()) if (s.conn) void s.conn.send(msg);
  };

  /** The saved round message with its timer reduced by the time already spent. */
  const replayRound = (): HostMessage | null => {
    if (!lastRound) return null;
    if (lastRound.seconds === null) return lastRound;
    const elapsed = Math.floor((Date.now() - lastRoundAt) / 1000);
    return { ...lastRound, seconds: Math.max(lastRound.seconds - elapsed, 0) };
  };

  const notifyRoster = (): void => {
    guestsChangeCb?.(guests());
    broadcast({ type: 'roster', names: guests().map((g) => g.name) });
  };

  /** Same visible name twice would be indistinguishable on the shared screen. */
  const uniqueName = (wanted: string, excludeId?: string): string => {
    const taken = new Set(
      [...seats.entries()]
        .filter(([id]) => id !== excludeId)
        .map(([, s]) => s.name.toLocaleLowerCase()),
    );
    if (!taken.has(wanted.toLocaleLowerCase())) return wanted;
    for (let n = 2; ; n++) {
      const candidate = `${wanted} ${String(n)}`;
      if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
    }
  };

  peer.on('connection', (conn) => {
    let seatId: string | null = null;

    /** Hand an existing seat to this (re)connection, superseding a stale one. */
    const reclaimSeat = (playerId: string, seat: Seat): void => {
      // Reassign before closing: the stale conn's close handler bails once the
      // seat no longer points at it, so it can't drop the reclaimed seat.
      const stale = seat.conn;
      seat.conn = conn;
      stale?.close();
      seatId = playerId;
      void conn.send({ type: 'welcome', playerId } satisfies HostMessage);
      if (locked) {
        void conn.send({ type: 'roster', names: guests().map((g) => g.name) });
        const round = replayRound();
        if (lastScores) void conn.send(lastScores);
        else if (round) void conn.send(round);
      } else {
        notifyRoster();
      }
    };

    conn.on('data', (data) => {
      if (!isGuestMessage(data)) return;
      if (data.type === 'hello') {
        if (seatId) return; // duplicate hello on this connection
        const wanted = sanitizeName(data.name);
        const deviceId =
          typeof data.deviceId === 'string' && data.deviceId !== '' ? data.deviceId : undefined;
        // A returning device reclaims its own seat — lobby or mid-game — even
        // when its old connection is still lingering as a zombie.
        const byDevice = deviceId
          ? [...seats.entries()].find(([, s]) => s.deviceId === deviceId)
          : undefined;
        if (byDevice) {
          const [playerId, seat] = byDevice;
          if (!locked) {
            // Still in the lobby: honor the latest name/avatar the guest picked.
            seat.name = uniqueName(wanted, playerId);
            seat.avatar = sanitizeAvatar(data.avatar) ?? seat.avatar;
          }
          reclaimSeat(playerId, seat);
          return;
        }
        if (locked) {
          // After lock, only a known player may come back (reload / dropped
          // connection) — matched by name for devices that lost their id.
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
          seat.deviceId ??= deviceId; // future drops match by device
          reclaimSeat(playerId, seat);
          return;
        }
        seatCounter += 1;
        const playerId = `guest-${String(seatCounter)}-${String(Date.now() % 100000)}`;
        seats.set(playerId, {
          conn,
          name: uniqueName(wanted),
          avatar: sanitizeAvatar(data.avatar),
          deviceId,
        });
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
export function joinRoom(code: string, name: string, avatar?: string): Promise<GuestSession> {
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
        // Undefined values don't survive the wire (they arrive as null) —
        // include optional keys only when they carry a value.
        const hello: Extract<GuestMessage, { type: 'hello' }> = {
          type: 'hello',
          name,
          deviceId: getDeviceId(),
        };
        if (avatar !== undefined) hello.avatar = avatar;
        void conn.send(hello);
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
