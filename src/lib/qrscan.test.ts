import { afterEach, describe, expect, it, vi } from 'vitest';

import { roomCodeFromScan, startQrScan } from './qrscan';

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

describe('startQrScan camera lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubCamera(): { stop: ReturnType<typeof vi.fn> } {
    const stop = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop }] }) },
    });
    vi.stubGlobal('document', { createElement: () => ({}) });
    return { stop };
  }

  function fakeVideo(play: () => Promise<void>): HTMLVideoElement {
    return { play, srcObject: null, readyState: 0 } as unknown as HTMLVideoElement;
  }

  it('releases the camera when playback is refused (autoplay policy)', async () => {
    const { stop } = stubCamera();
    const video = fakeVideo(() => Promise.reject(new Error('NotAllowedError')));
    await expect(startQrScan(video, () => undefined)).rejects.toThrow('NotAllowedError');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });

  it('keeps the camera open after a successful start until stop() is called', async () => {
    const { stop } = stubCamera();
    const video = fakeVideo(() => Promise.resolve());
    const stopScan = await startQrScan(video, () => undefined);
    expect(stop).not.toHaveBeenCalled();
    expect(video.srcObject).not.toBeNull();
    stopScan();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });
});
