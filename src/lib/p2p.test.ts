import { describe, expect, it } from 'vitest';

import { isGuestMessage, makeRoomCode, normalizeRoomCode } from './p2p';

describe('room codes', () => {
  it('makes 4-letter codes from the kid-safe alphabet', () => {
    for (let i = 0; i < 20; i++) {
      expect(makeRoomCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    }
  });

  it('normalizes typed codes: trim, uppercase, strip inner spaces', () => {
    expect(normalizeRoomCode(' ab cd ')).toBe('ABCD');
    expect(normalizeRoomCode('wxyz')).toBe('WXYZ');
  });
});

describe('isGuestMessage (untrusted P2P input)', () => {
  it('accepts a well-formed hello, with null treated as absent for optionals', () => {
    expect(isGuestMessage({ type: 'hello', name: 'Ida' })).toBe(true);
    expect(isGuestMessage({ type: 'hello', name: 'Ida', avatar: null, deviceId: null })).toBe(true);
    expect(isGuestMessage({ type: 'hello', name: 'Ida', avatar: '🦋', deviceId: 'abc' })).toBe(
      true,
    );
  });

  it('accepts well-formed answers', () => {
    expect(isGuestMessage({ type: 'answers', roundIndex: 0, answers: { animal: 'ant' } })).toBe(
      true,
    );
  });

  it('rejects malformed or hostile payloads', () => {
    expect(isGuestMessage(null)).toBe(false);
    expect(isGuestMessage('hello')).toBe(false);
    expect(isGuestMessage({ type: 'hello' })).toBe(false); // no name
    expect(isGuestMessage({ type: 'hello', name: 42 })).toBe(false);
    expect(isGuestMessage({ type: 'hello', name: 'A', deviceId: 'x'.repeat(65) })).toBe(false);
    expect(isGuestMessage({ type: 'answers', roundIndex: '0', answers: {} })).toBe(false);
    expect(isGuestMessage({ type: 'answers', roundIndex: 0, answers: { a: 1 } })).toBe(false);
    expect(isGuestMessage({ type: 'answers', roundIndex: 0, answers: null })).toBe(false);
    expect(isGuestMessage({ type: 'nonsense' })).toBe(false);
  });
});
