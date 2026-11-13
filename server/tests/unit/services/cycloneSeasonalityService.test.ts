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
  vi.stubGlobal('fetch', vi.fn());
});
afterAll(() => { vi.unstubAllGlobals(); testDb.close(); });

const sample = [
  'AL012020, ARTHUR, 3,',
  '19790901, 0000, , TD, 30.0N, 78.0W, 25, 1008, 0, 0, 0, 0,',
  '20200516, 0000, , TD, 30.0N, 78.0W, 25, 1008, 0, 0, 0, 0,',
  '20200516, 0600, , TS, 30.2N, 78.1W, 35, 1005, 0, 0, 0, 0,',
].join('\n');

function textResponse(body: string) {
  return { ok: true, status: 200, headers: { get: () => null }, text: async () => body };
}

describe('cyclone seasonality', () => {
  it('parses storm IDs, UTC dates, signed coordinates, and skips observations before 1980', async () => {
    const { parseHurdat2 } = await import('../../../src/services/cycloneSeasonalityService');
    expect(parseHurdat2(sample)).toEqual([
      { stormId: 'AL012020', year: 2020, month: 5, lat: 30, lng: -78 },
      { stormId: 'AL012020', year: 2020, month: 5, lat: 30.2, lng: -78.1 },
    ]);
  });

  it('limits coverage to the NHC Atlantic and NE/NC Pacific basins', async () => {
    const { basinsAtPoint } = await import('../../../src/services/cycloneSeasonalityService');
    expect(basinsAtPoint({ key: 'mexico', lat: 19, lng: -99 })).toEqual(['atlantic']);
    expect(basinsAtPoint({ key: 'west-mexico', lat: 20, lng: -105 })).toEqual(['pacific']);
    expect(basinsAtPoint({ key: 'tokyo', lat: 35.6, lng: 139.7 })).toEqual([]);
  });

  it('deduplicates storm tracks by month and persists the source snapshot', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(textResponse(sample) as Response);
    const { getCycloneSeasonality } = await import('../../../src/services/cycloneSeasonalityService');
    const input = [{ key: 'track-area', lat: 30, lng: -78 }, { key: 'tokyo', lat: 35.6, lng: 139.7 }];
    const first = await getCycloneSeasonality(input);
    const second = await getCycloneSeasonality(input);
    expect(first[0]).toMatchObject({ coverage: 'covered', calendar: { period: '1980–2025', radiusNm: 150 } });
    expect(first[0].calendar?.months[0]).toMatchObject({ month: 1, events: 0, tracksPer100Years: 0 });
    expect(first[0].calendar?.months[4]).toMatchObject({ month: 5, events: 1, tracksPer100Years: 2.2 });
    expect(first[1]).toEqual({ key: 'tokyo', coverage: 'unsupported' });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(testDb.prepare('SELECT COUNT(*) AS count FROM seasonal_data_cache').get()).toEqual({ count: 1 });
    expect(testDb.prepare('SELECT COUNT(*) AS count FROM seasonal_provider_state').get()).toEqual({ count: 1 });
  });
});
