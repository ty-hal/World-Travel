import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticate, collection, discover, snapshot } from '../../../src/services/beli/client';
import { beliConnectSchema, beliSearchSchema } from '@trek/shared';

const identity = '00000000-0000-4000-8000-000000000001';
const access = `fake.${Buffer.from(JSON.stringify({ user_id: identity })).toString('base64url')}.fake`;
afterEach(() => vi.unstubAllGlobals());
describe('Beli upstream trust boundaries', () => {
  it('recognizes Beli session-expired responses during fresh login without treating them as local expiry', async () => {
    for (const code of ['session_expired', 'SESSION_EXPIRED']) {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code, detail: 'synthetic-private-text' }), { status: 401 }))));
      await expect(authenticate({ email: 'fake@example.test', password: 'synthetic' })).rejects.toMatchObject({ status: 400, authFailure: { phase: 'login', upstreamStatus: 401, reason: 'session_expired' } });
    }
  });
  it('matches the original helper phone-number login payload', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ access, refresh: 'synthetic' }))));
    vi.stubGlobal('fetch', fetcher);
    const credentials = { phone_no: '+15555550100', password: 'synthetic' };
    expect(beliConnectSchema.safeParse(credentials).success).toBe(true);
    await authenticate(credentials);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(credentials);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it('retains only whitelisted authentication reasons, never echoed secrets', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code: 'no_active_account', detail: 'synthetic-private-password' }), { status: 401 }))));
    try {
      await authenticate({ email: 'fake@example.test', password: 'synthetic-private-password' });
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toMatchObject({ status: 400, authFailure: { phase: 'login', upstreamStatus: 401, reason: 'account_not_accepted' } });
      expect(JSON.stringify(error)).not.toContain('synthetic-private-password');
    }
    for (const code of ['synthetic-private-password', '__proto__', 'toString']) {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code, detail: 'synthetic-private-password' }), { status: 401 }))));
      await expect(authenticate({ refresh: 'synthetic' })).rejects.toMatchObject({ authFailure: { reason: 'unknown' } });
    }
  });
  it('bounds authentication error bodies before classification', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: 'x'.repeat(9000), code: 'no_active_account' }), { status: 401 }))));
    await expect(authenticate({ refresh: 'synthetic' })).rejects.toMatchObject({ authFailure: { reason: 'unknown' } });
  });
  it('distinguishes a rejected fresh login from a rejected saved session', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('synthetic-private-error', { status: 401 }))));
    await expect(authenticate({ email: 'fake@example.test', password: 'synthetic' })).rejects.toMatchObject({ status: 400, message: 'Beli rejected this sign-in. Try again later.' });
    await expect(authenticate({ refresh: 'synthetic' })).rejects.toMatchObject({ status: 409, message: 'Beli rejected the saved session. Sign in again.' });
  });
  it('accepts endpoint rounding differences while preserving original ranking scores', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const business = { id: 1, name: 'Synthetic', lat: 41.89, lng: -87.63 };
      const result = path.startsWith('/api/user-scores/') ? [{ category: 'RES', business_id: 1, value: 8.1235 }]
        : path === '/api/get-ranking/' ? { results: [{ business, category: 'RES', score: 8.123456 }] }
        : path === '/api/get-bookmark/' ? { Restaurants: [] } : [{ business_id: 2, expected_percentile: 8.2 }];
      return new Response(JSON.stringify(result));
    }));
    const result = await snapshot(access, identity);
    expect(result.ratings[0].score).toBe(8.123456);
    expect(result.predictions).toHaveLength(1);
  });
  it('sends credentials only to onboarding and refuses redirects', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access, refresh: 'synthetic-refresh' })));
    vi.stubGlobal('fetch', fetcher);
    expect(await authenticate({ email: 'a@example.test', password: 'synthetic' })).toMatchObject({ identity });
    expect(fetcher.mock.calls[0][0]).toBe('https://backoffice-service-onboarding-t57o3dxfca-nn.a.run.app/api/token/');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });
  it('discards error bodies instead of exposing credentials in diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('synthetic-secret', { status: 400 })));
    await expect(authenticate({ refresh: 'synthetic-refresh' })).rejects.toMatchObject({ status: 409 });
    try { await authenticate({ refresh: 'synthetic-refresh' }); } catch (error) { expect(String(error)).not.toContain('synthetic-secret'); }
  });
  it('refuses cross-host pagination before forwarding the bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [], next: 'https://example.test/api/get-ranking/' })));
    vi.stubGlobal('fetch', fetcher);
    await expect(collection(`/api/get-ranking/?user=${identity}&category=RES`, access)).rejects.toMatchObject({ status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('drops invalid discovery rows and strips unexpected secret fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ businesses: [
      { id: 1, name: 'Synthetic', lat: '41.89', lng: '-87.63', access_token: 'synthetic-secret' },
      { id: 2, name: 'Bad coordinates', lat: null, lng: null },
    ] })));
    vi.stubGlobal('fetch', fetcher);
    const rows = await discover(access, identity, 'BAK', 41.89, -87.63);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('synthetic-secret');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ category: 'BAK', user: identity, user2: identity, coords: '41.89,-87.63' });
  });
  it('rejects caller-supplied account IDs and invalid numeric search inputs', () => {
    expect(beliConnectSchema.safeParse({ email: 'a@example.test', password: 'fake', userId: 2 }).success).toBe(false);
    for (const radiusKm of [NaN, Infinity, 0, 99]) expect(beliSearchSchema.safeParse({ tripId: 1, placeId: 1, radiusKm }).success).toBe(false);
    expect(beliSearchSchema.safeParse({ tripId: 1, placeId: 1, beliUserId: identity }).success).toBe(false);
  });
});
