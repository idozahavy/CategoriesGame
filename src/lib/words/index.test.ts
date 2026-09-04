import { describe, expect, it } from 'vitest';

import { ensureWords, getWords } from './index';

describe('ensureWords', () => {
  it('resolves for a language without bundled lists and then matches nothing', async () => {
    await expect(ensureWords('xx')).resolves.toBeUndefined();
    expect(getWords('xx')).toEqual({});
  });

  it('serves the bundled lists of a language once it has loaded', async () => {
    await ensureWords('en');
    expect(getWords('en')['animal']).toContain('ant');
  });

  it('reads as empty before a language was loaded', () => {
    expect(getWords('never-loaded')).toEqual({});
  });
});
