import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE seasonal_data_cache (cache_key TEXT PRIMARY KEY, payload_json TEXT NOT NULL, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE seasonal_provider_state (provider TEXT PRIMARY KEY, day TEXT NOT NULL, request_count INTEGER NOT NULL, next_allowed_at INTEGER NOT NULL, last_error_at INTEGER NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0);`);
  return { db };
});

vi.mock('../../../src/db/database', () => ({ db }));

import { getSeasonalData } from '../../../src/services/seasonalDataCache';

describe('seasonalDataCache provider errors', () => {
  beforeEach(() => db.exec('DELETE FROM seasonal_data_cache; DELETE FROM seasonal_provider_state;'));
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('caches a provider-specific 404 without cooling down the whole provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await getSeasonalData('nager-date', 'holiday:XX:2026', 60_000, 'https://example.test', value => value);
    const second = await getSeasonalData('nager-date', 'holiday:XX:2026', 60_000, 'https://example.test', value => value);
    const provider = db.prepare('SELECT last_error_at FROM seasonal_provider_state WHERE provider = ?').get('nager-date') as { last_error_at: number };

    expect(first.error).toBe('Provider returned HTTP 404');
    expect(second.error).toBe(first.error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider.last_error_at).toBe(0);
  });

  it('keeps the provider cooldown for a 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await getSeasonalData('eurostat-tourism', 'crowd:a', 60_000, 'https://example.test/a', value => value);
    const result = await getSeasonalData('eurostat-tourism', 'crowd:b', 60_000, 'https://example.test/b', value => value);
    const provider = db.prepare('SELECT last_error_at FROM seasonal_provider_state WHERE provider = ?').get('eurostat-tourism') as { last_error_at: number };

    expect(result.error).toBe('Provider temporarily cooling down');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider.last_error_at).toBeGreaterThan(0);
  });

  it('retries a throttled cache key once its persisted cooldown expires', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 7 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await getSeasonalData('nager-date', 'holiday:US:2026', 60_000, 'https://example.test', value => value);
    expect(first.error).toBe('Provider returned HTTP 429');
    await vi.advanceTimersByTimeAsync(60_000);

    const cached = db.prepare('SELECT payload_json FROM seasonal_data_cache WHERE cache_key = ?').get('holiday:US:2026') as { payload_json: string } | undefined;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cached && JSON.parse(cached.payload_json)).toEqual({ value: 7 });
    vi.useRealTimers();
  });
});
