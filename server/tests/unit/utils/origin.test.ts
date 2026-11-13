import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLocalDevOrigin } from '../../../src/utils/origin';

afterEach(() => vi.unstubAllEnvs());

describe('development browser origins', () => {
  it.each(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])('permits %s only outside production', (origin) => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isLocalDevOrigin(origin)).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isLocalDevOrigin(origin)).toBe(false);
  });

  it.each([undefined, 'invalid', 'https://localhost:5173', 'http://localhost.evil.example', 'https://untrusted.example'])('rejects %s as a development exception', (origin) => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isLocalDevOrigin(origin)).toBe(false);
  });
});
