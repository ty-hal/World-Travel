import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { testDb } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  return { testDb: new Database(':memory:') };
});
vi.mock('../../../src/db/database', () => ({ db: testDb }));

beforeAll(() => testDb.exec(`
  CREATE TABLE seasonal_data_cache (cache_key TEXT PRIMARY KEY, payload_json TEXT NOT NULL, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE seasonal_provider_state (provider TEXT PRIMARY KEY, day TEXT NOT NULL, request_count INTEGER NOT NULL DEFAULT 0, next_allowed_at INTEGER NOT NULL DEFAULT 0, last_error_at INTEGER NOT NULL DEFAULT 0, retry_count INTEGER NOT NULL DEFAULT 0);
`));
beforeEach(() => {
  testDb.exec('DELETE FROM seasonal_data_cache; DELETE FROM seasonal_provider_state;');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => String(url).includes('earthquake.usgs.gov')
      ? { features: Array.from({ length: 5 }, (_, index) => ({ id: `eq-${index}`, properties: { time: Date.UTC(2000, 8, 1), mag: 6.4, tsunami: 1 }, geometry: { coordinates: [0, 0, 1] } })) }
      : String(url).includes('volcano.si.edu')
        ? { features: [{ properties: { Eruption_Number: 11, Volcano_Number: 1, StartDateYear: '2000', StartDateMonth: 9, ExplosivityIndexMax: 4 }, geometry: { coordinates: [0, 0] } }] }
        : { items: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, year: 2000, month: 9, latitude: 0, longitude: 0, eventValidity: 4 })), count: 5 },
  })));
});
afterAll(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); testDb.close(); });

describe('natural hazard seasonality', () => {
  it('skips the global catalog warm during E2E runs', async () => {
    vi.stubEnv('TREK_E2E', '1');
    const { warmNaturalHazardCatalog } = await import('../../../src/services/naturalHazardsService');
    warmNaturalHazardCatalog();
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('does not fetch global catalogs for an empty location batch', async () => {
    const { getNaturalHazardSeasonality } = await import('../../../src/services/naturalHazardsService');
    expect(await getNaturalHazardSeasonality([])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses USGS tsunami flags and Smithsonian eruption history while NOAA is cooling down', async () => {
    const now = Date.now();
    testDb.prepare('INSERT INTO seasonal_provider_state (provider, day, request_count, next_allowed_at, last_error_at) VALUES (?, ?, 1, ?, ?)')
      .run('noaa-hazel', new Date(now).toISOString().slice(0, 10), now + 60_000, now);
    const { getNaturalHazardSeasonality } = await import('../../../src/services/naturalHazardsService');
    const [result] = await getNaturalHazardSeasonality([{ key: 'origin', lat: 0, lng: 0 }]);

    expect(result.hazards.earthquakes?.events).toBe(5);
    expect(result.hazards.tsunamis).toMatchObject({ events: 5, source: 'USGS ComCat tsunami-flagged earthquakes' });
    expect(result.hazards.volcanoes).toMatchObject({ events: 1, source: 'Smithsonian Global Volcanism Program' });
    expect(fetch).toHaveBeenCalledTimes(2);
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.some(url => url.includes('earthquake.usgs.gov'))).toBe(true);
    expect(urls.some(url => url.includes('volcano.si.edu'))).toBe(true);
  });

  it('fetches each NOAA catalog once, caches it, and exposes monthly counts with sample-qualified activity', async () => {
    testDb.prepare('INSERT INTO seasonal_data_cache (cache_key, payload_json, fetched_at, expires_at) VALUES (?, ?, ?, ?)')
      .run('noaa-hazel:earthquakes:1980-2025:v1:page:1', JSON.stringify({ __seasonalError: 'Provider returned HTTP 404' }), Date.now(), Date.now() + 60_000);
    const { getNaturalHazardSeasonality } = await import('../../../src/services/naturalHazardsService');
    const locations = [{ key: 'origin', lat: 0, lng: 0 }];
    const first = await getNaturalHazardSeasonality(locations);
    const second = await getNaturalHazardSeasonality(locations);

    expect(first[0].hazards.earthquakes?.months[8]).toMatchObject({ events: 5, relativeActivity: expect.any(Number) });
    expect(first[0].hazards.tsunamis?.events).toBe(5);
    expect(first[0].hazards.volcanoes?.events).toBe(5);
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(3);
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.some(url => url.includes('/query?') && url.includes('minmagnitude=6'))).toBe(true);
    expect(urls.some(url => url.includes('/api/v1/tsunamis/events?'))).toBe(true);
    expect(urls.some(url => url.includes('/api/v1/volcanoes?') && url.includes('order=year%3Aasc'))).toBe(true);
    expect(testDb.prepare('SELECT COUNT(*) AS count FROM seasonal_data_cache').get()).toEqual({ count: 6 });
  });

  it('warms USGS immediately and waits for the NOAA provider cooldown', async () => {
    vi.useFakeTimers();
    const cooldownUntil = Date.now() + 10_000;
    testDb.prepare('INSERT INTO seasonal_provider_state (provider, day, request_count, next_allowed_at, last_error_at) VALUES (?, ?, 1, ?, ?)')
      .run('noaa-hazel', new Date().toISOString().slice(0, 10), cooldownUntil, Date.now());
    const { warmNaturalHazardCatalog } = await import('../../../src/services/naturalHazardsService');
    warmNaturalHazardCatalog();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('earthquake.usgs.gov'))).toBe(true);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('volcano.si.edu'))).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(testDb.prepare("SELECT COUNT(*) AS count FROM seasonal_data_cache WHERE cache_key LIKE 'noaa-hazel:%' AND cache_key NOT LIKE '%:page:%'").get()).toEqual({ count: 2 });
    vi.useRealTimers();
  });
});
