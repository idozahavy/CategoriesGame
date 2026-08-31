import { afterEach, describe, expect, it, vi } from 'vitest';

import { readStorage, removeStorage, writeStorage } from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubWorkingStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  return store;
}

function stubThrowingStorage(): void {
  const boom = (): never => {
    throw new Error('denied');
  };
  vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
}

describe('storage helpers', () => {
  it('round-trips values when storage works', () => {
    stubWorkingStorage();
    expect(readStorage('k')).toBeNull();
    writeStorage('k', 'v');
    expect(readStorage('k')).toBe('v');
    removeStorage('k');
    expect(readStorage('k')).toBeNull();
  });

  it('degrades to null / no-op instead of throwing when storage is blocked', () => {
    stubThrowingStorage();
    expect(readStorage('k')).toBeNull();
    expect(() => {
      writeStorage('k', 'v');
    }).not.toThrow();
    expect(() => {
      removeStorage('k');
    }).not.toThrow();
  });
});
