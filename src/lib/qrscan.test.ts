import { describe, expect, it } from 'vitest';

import { roomCodeFromScan } from './qrscan';

describe('roomCodeFromScan', () => {
  it('extracts the code from the host join URL', () => {
    expect(roomCodeFromScan('https://kategoria.pages.dev/?join=ABCD')).toBe('ABCD');
  });

  it('handles a path before the query and extra params', () => {
    expect(roomCodeFromScan('http://localhost:5173/app/?lang=he&join=wxyz')).toBe('wxyz');
  });

  it('falls back to the raw payload when it is not a URL', () => {
    expect(roomCodeFromScan('  ABCD ')).toBe('ABCD');
  });

  it('keeps a URL without a join param as-is and returns empty for an empty payload', () => {
    expect(roomCodeFromScan('https://example.com/')).toBe('https://example.com/');
    expect(roomCodeFromScan('')).toBe('');
  });
});
