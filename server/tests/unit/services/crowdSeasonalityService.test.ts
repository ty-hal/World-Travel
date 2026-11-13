import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { countryAtPoint, nuts2AtPoint, nutsCountryCode, parseEurostat, summarizeCrowd } from '../../../src/services/crowdSeasonalityService';

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
afterAll(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); testDb.close(); });

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
}

function eurostatFixture() {
  const geo = { EL43: 0 }, month = { TOTAL: 0, ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`M${String(i + 1).padStart(2, '0')}`, i + 1])) };
  const values = Array.from({ length: 52 }, (_, index) => {
    const monthIndex = Math.floor(index / 4);
    const year = index % 4;
    return monthIndex === 0 ? null : (monthIndex === 7 ? 2 : 1) * new Date(Date.UTC(2022 + year, monthIndex, 0)).getUTCDate() * 100;
  });
  return {
    id: ['freq', 'c_resid', 'nace_r2', 'month', 'unit', 'geo', 'time'], size: [1, 1, 1, 13, 1, 1, 4],
    dimension: {
      freq: { category: { index: { A: 0 } } }, c_resid: { category: { index: { TOTAL: 0 } } },
      nace_r2: { category: { index: { 'I551-I553': 0 } } }, month: { category: { index: month } },
      unit: { category: { index: { NR: 0 } } }, geo: { category: { index: geo } },
      time: { category: { index: { 2022: 0, 2023: 1, 2024: 2, 2025: 3 } } },
    }, value: values,
  };
}

describe('crowd seasonality data', () => {
  it('does not fetch reference geography for an empty location batch', async () => {
    const { getCrowdSeasonality, resolveCountryGeography, resolveSeasonGeography } = await import('../../../src/services/crowdSeasonalityService');
    expect(await getCrowdSeasonality([])).toEqual([]);
    expect(await resolveCountryGeography([])).toEqual([]);
    expect(await resolveSeasonGeography([])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps a point into a NUTS polygon and excludes polygon holes', () => {
    const regions = [{ code: 'EL43', geometry: { type: 'Polygon' as const, coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ] } }];
    expect(nuts2AtPoint(2, 2, regions)).toBe('EL43');
    expect(nuts2AtPoint(5, 5, regions)).toBeUndefined();
    expect(nuts2AtPoint(20, 20, regions)).toBeUndefined();
  });

  it('maps NUTS prefixes with non-ISO country codes to Nager country codes', () => {
    expect(nutsCountryCode('EL30')).toBe('GR');
    expect(nutsCountryCode('UKI32')).toBe('GB');
    expect(nutsCountryCode(undefined)).toBeUndefined();
  });

  it('resolves country boundaries worldwide and reuses the durable boundary cache', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ features: [
      { properties: { CNTR_ID: 'MX' }, geometry: { type: 'Polygon', coordinates: [[[-120, 10], [-80, 10], [-80, 35], [-120, 35], [-120, 10]]] } },
      { properties: { CNTR_ID: 'JP' }, geometry: { type: 'Polygon', coordinates: [[[130, 30], [150, 30], [150, 46], [130, 46], [130, 30]]] } },
      { properties: { CNTR_ID: 'EL' }, geometry: { type: 'Polygon', coordinates: [[[19, 34], [30, 34], [30, 42], [19, 42], [19, 34]]] } },
      { properties: { CNTR_ID: 'UK' }, geometry: { type: 'Polygon', coordinates: [[[-8, 49], [2, 49], [2, 59], [-8, 59], [-8, 49]]] } },
    ] }) as Response);
    const { resolveCountryGeography } = await import('../../../src/services/crowdSeasonalityService');
    const locations = [
      { key: 'mexico', lat: 19, lng: -99 }, { key: 'japan', lat: 36, lng: 139 },
      { key: 'greece', lat: 37, lng: 23 }, { key: 'uk', lat: 51, lng: 0 },
    ];
    expect(await resolveCountryGeography(locations)).toEqual([
      { key: 'mexico', countryCode: 'MX' }, { key: 'japan', countryCode: 'JP' },
      { key: 'greece', countryCode: 'GR' }, { key: 'uk', countryCode: 'GB' },
    ]);
    expect(await resolveCountryGeography(locations)).toEqual([
      { key: 'mexico', countryCode: 'MX' }, { key: 'japan', countryCode: 'JP' },
      { key: 'greece', countryCode: 'GR' }, { key: 'uk', countryCode: 'GB' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('selects only the requested Eurostat dimensions and retains source flags', () => {
    const stat = {
      id: ['freq', 'c_resid', 'nace_r2', 'month', 'unit', 'geo', 'time'],
      size: [1, 1, 1, 13, 1, 1, 2],
      dimension: {
        freq: { category: { index: { A: 0 } } },
        c_resid: { category: { index: { TOTAL: 0 } } },
        nace_r2: { category: { index: { 'I551-I553': 0 } } },
        month: { category: { index: { TOTAL: 0, ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`M${String(i + 1).padStart(2, '0')}`, i + 1])) } } },
        unit: { category: { index: { NR: 0 } } },
        geo: { category: { index: { EL43: 0 } } },
        time: { category: { index: { 2024: 0, 2025: 1 } } },
      },
      value: Array.from({ length: 26 }, (_, i) => 100 + i),
      status: { '2': 'p' },
    };
    const rows = parseEurostat(stat);
    expect(rows.EL43).toHaveLength(24);
    expect(rows.EL43[0]).toMatchObject({ year: 2024, month: 1, nights: 102, status: 'p' });
    expect(rows.EL43[1]).toMatchObject({ year: 2025, month: 1, nights: 103 });
  });

  it('uses only complete years and calculates month-length-adjusted relative demand', () => {
    const observations = [2022, 2023].flatMap(year => Array.from({ length: 12 }, (_, idx) => ({
      year, month: idx + 1,
      nights: (idx === 6 ? 2 : 1) * new Date(Date.UTC(year, idx + 1, 0)).getUTCDate() * 100,
      ...(year === 2023 && idx === 0 ? { status: 'p' } : {}),
    })));
    observations.pop();
    const summary = summarizeCrowd(observations, 2022, 2023);
    expect(summary?.years).toEqual([2022]);
    expect(summary?.months[0].relativeDemand).toBeCloseTo(12 / 13);
    expect(summary?.months[6].relativeDemand).toBeCloseTo(24 / 13);
    expect(summary?.provisional).toBe(false);
  });

  it('maps route points once and reuses cached boundaries and Eurostat results', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ features: [{ properties: { NUTS_ID: 'EL43' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] } }] }) as Response)
      .mockResolvedValueOnce(jsonResponse(eurostatFixture()) as Response);
    const { getCrowdSeasonality } = await import('../../../src/services/crowdSeasonalityService');
    const input = [{ key: 'first', lat: 2, lng: 2 }, { key: 'second', lat: 3, lng: 3 }];
    const first = await getCrowdSeasonality(input);
    const second = await getCrowdSeasonality(input);
    expect(first.map(item => item.region)).toEqual(['EL43', 'EL43']);
    expect(first[0].data?.months[6].relativeDemand).toBeGreaterThan(first[0].data!.months[0].relativeDemand);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const eurostatUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(eurostatUrl.searchParams.getAll('geo')).toEqual(['EL43']);
    expect(eurostatUrl.searchParams.has('geoLevel')).toBe(false);
    expect(testDb.prepare('SELECT COUNT(*) AS count FROM seasonal_provider_state').get()).toEqual({ count: 2 });
  });

  it('uses one cached global country-seasonality response as a non-European fallback', async () => {
    vi.stubEnv('TOURISM_API_KEY', 'test-key');
    const fetchMock = vi.mocked(fetch);
    const polygon = [[[100, 0], [110, 0], [110, 10], [100, 10], [100, 0]]];
    fetchMock.mockResolvedValueOnce(jsonResponse({ features: [] }) as Response)
      .mockResolvedValueOnce(jsonResponse({ features: [{ properties: { CNTR_ID: 'SG' }, geometry: { type: 'Polygon', coordinates: polygon } }] }) as Response)
      .mockResolvedValueOnce(jsonResponse({ data: [{ iso: 'SG', index: [80, 90, 100, 110, 120, 130, 120, 110, 100, 90, 80, 70], years: 3, through: '2025-09', measure: 'arrivals' }] }) as Response);
    const { getCrowdSeasonality } = await import('../../../src/services/crowdSeasonalityService');
    const input = [{ key: 'singapore', lat: 1, lng: 103 }];
    const result = await getCrowdSeasonality(input);
    expect(result[0]).toMatchObject({
      countryCode: 'SG', region: 'country:SG',
      data: { source: 'tourismapi', level: 'country', years: [2023, 2024, 2025] },
    });
    expect(result[0].data?.months[0]).toEqual({ month: 1, relativeDemand: 0.8, samples: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({ 'X-API-Key': 'test-key' });
    expect(await getCrowdSeasonality(input)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const cache = testDb.prepare('SELECT fetched_at, expires_at FROM seasonal_data_cache WHERE cache_key = ?').get('tourismapi:seasons:v1') as { fetched_at: number; expires_at: number };
    expect(cache.expires_at - cache.fetched_at).toBe(90 * 24 * 60 * 60 * 1_000);
  });
});
