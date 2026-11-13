import { getSeasonalData, readSeasonalCache, writeSeasonalCache } from './seasonalDataCache';

const GEOGRAPHY_KEY = 'gisco:nuts2:2024:20m:4326';
const COUNTRY_GEOGRAPHY_KEY = 'gisco:countries:2024:20m:4326';
const GEOGRAPHY_TTL = 365 * 24 * 60 * 60 * 1_000;
const CROWD_TTL = 365 * 24 * 60 * 60 * 1_000;
const TOURISM_SEASONS_KEY = 'tourismapi:seasons:v1';
const TOURISM_SEASONS_TTL = 90 * 24 * 60 * 60 * 1_000;

type Point = { key: string; lat: number; lng: number };
type Ring = number[][];
type Polygon = Ring[];
type Region = { code: string; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Polygon | Polygon[] } };
type CountryRegion = Region;
type Observation = { year: number; month: number; nights: number; status?: string };
type RegionCrowd = { region?: string; source?: 'eurostat' | 'tourismapi'; level?: 'regional' | 'country'; period: string; years: number[]; provisional: boolean; months: Array<{ month: number; relativeDemand: number; samples: number }> };
type CountrySeason = { iso: string; index: number[]; years: number; through: string; measure: string };
type TourismSeasonsResponse = { data: CountrySeason[] };
type JsonStat = {
  id: string[];
  size: number[];
  dimension: Record<string, { category: { index: Record<string, number> | string[] } }>;
  value: number[] | Record<string, number>;
  status?: string[] | Record<string, string>;
};

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, polygon: Polygon): boolean {
  return pointInRing(lng, lat, polygon[0]) && !polygon.slice(1).some(ring => pointInRing(lng, lat, ring));
}

export function nuts2AtPoint(lng: number, lat: number, regions: Region[]): string | undefined {
  for (const region of regions) {
    const polygons = region.geometry.type === 'Polygon' ? [region.geometry.coordinates as Polygon] : region.geometry.coordinates as Polygon[];
    if (polygons.some(polygon => pointInPolygon(lng, lat, polygon))) return region.code;
  }
  return undefined;
}

export function nutsCountryCode(region: string | undefined): string | undefined {
  if (!region) return undefined;
  const code = region.slice(0, 2);
  return ({ EL: 'GR', UK: 'GB' } as Record<string, string>)[code] || code;
}

export function countryAtPoint(lng: number, lat: number, countries: CountryRegion[]): string | undefined {
  for (const country of countries) {
    const polygons = country.geometry.type === 'Polygon' ? [country.geometry.coordinates as Polygon] : country.geometry.coordinates as Polygon[];
    if (polygons.some(polygon => pointInPolygon(lng, lat, polygon))) return country.code;
  }
  return undefined;
}

function categories(stat: JsonStat, dimension: string): string[] {
  const index = stat.dimension[dimension]?.category.index;
  if (!index) throw new Error(`Eurostat dimension ${dimension} is missing`);
  return Array.isArray(index) ? index : Object.entries(index).sort((a, b) => a[1] - b[1]).map(([code]) => code);
}

export function parseEurostat(stat: JsonStat): Record<string, Observation[]> {
  if (!Array.isArray(stat.id) || !Array.isArray(stat.size) || stat.id.length !== stat.size.length) throw new Error('Invalid Eurostat JSON-stat dimensions');
  const codes = Object.fromEntries(stat.id.map(id => [id, categories(stat, id)]));
  for (const dimension of ['geo', 'month', 'time']) if (!codes[dimension]) throw new Error(`Eurostat dimension ${dimension} is missing`);
  const values = stat.value;
  const strides = stat.size.map((_, idx) => stat.size.slice(idx + 1).reduce((a, b) => a * b, 1));
  const result: Record<string, Observation[]> = {};
  const total = stat.size.reduce((a, b) => a * b, 1);
  for (let flat = 0; flat < total; flat++) {
    const value = Array.isArray(values) ? values[flat] : values[String(flat)];
    if (value == null || !Number.isFinite(Number(value))) continue;
    const indices = stat.size.map((size, idx) => Math.floor(flat / strides[idx]) % size);
    const cell = Object.fromEntries(stat.id.map((id, idx) => [id, codes[id][indices[idx]]]));
    if (cell.freq !== 'A' || cell.nace_r2 !== 'I551-I553' || cell.c_resid !== 'TOTAL' || cell.unit !== 'NR') continue;
    const month = Number(String(cell.month).slice(1));
    const year = Number(cell.time);
    if (!month || month > 12 || !Number.isInteger(year)) continue;
    const status = Array.isArray(stat.status) ? stat.status[flat] : stat.status?.[String(flat)];
    (result[cell.geo] ||= []).push({ year, month, nights: Number(value), ...(status ? { status } : {}) });
  }
  return result;
}

export function summarizeCrowd(observations: Observation[], firstYear: number, lastYear: number): RegionCrowd | undefined {
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  const byYear = new Map<number, Map<number, Observation>>();
  observations.forEach(item => {
    if (years.includes(item.year)) {
      const months = byYear.get(item.year) ?? new Map<number, Observation>();
      months.set(item.month, item);
      byYear.set(item.year, months);
    }
  });
  const ratios = Array.from({ length: 12 }, () => [] as number[]);
  const completeYears: number[] = [];
  let provisional = false;
  for (const year of years) {
    const months = byYear.get(year);
    if (!months || months.size !== 12 || Array.from({ length: 12 }, (_, i) => months.get(i + 1)).some(value => !value)) continue;
    const yearNights = Array.from(months.values()).reduce((sum, item) => sum + item.nights, 0);
    const yearDays = new Date(Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)).getTime() / 86_400_000;
    const annualDaily = yearNights / yearDays;
    if (!(annualDaily > 0)) continue;
    completeYears.push(year);
    for (let month = 1; month <= 12; month++) {
      const item = months.get(month)!;
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      ratios[month - 1].push((item.nights / days) / annualDaily);
      provisional ||= Boolean(item.status && /p/i.test(item.status));
    }
  }
  if (!completeYears.length) return undefined;
  const medians = ratios.map(values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  });
  return {
    period: `${completeYears[0]}–${completeYears[completeYears.length - 1]}`,
    years: completeYears,
    provisional,
    months: medians.map((relativeDemand, idx) => ({ month: idx + 1, relativeDemand, samples: ratios[idx].length })),
  };
}

async function getCountryCrowd(): Promise<Map<string, RegionCrowd>> {
  const apiKey = process.env.TOURISM_API_KEY;
  if (!apiKey) return new Map();
  let rows = readSeasonalCache<TourismSeasonsResponse>(TOURISM_SEASONS_KEY)?.data;
  if (!rows) {
    const result = await getSeasonalData<TourismSeasonsResponse>(
      'tourismapi-seasons', TOURISM_SEASONS_KEY, TOURISM_SEASONS_TTL,
      'https://api.tourismapi.com/v1/seasons?limit=1000',
      value => {
        const body = value as TourismSeasonsResponse;
        if (!Array.isArray(body?.data)) throw new Error('Tourism API returned an invalid season table');
        return { data: body.data.filter(row => /^[A-Z]{2}$/.test(row.iso) && Array.isArray(row.index)) };
      }, 'json', 15_000, { 'X-API-Key': apiKey },
    );
    rows = result.data?.data;
  }
  const summaries = new Map<string, RegionCrowd>();
  for (const row of rows ?? []) {
    if (!Array.isArray(row.index) || row.index.length !== 12 || !Number.isInteger(row.years) || row.years < 1 || !row.through) continue;
    if (!row.index.every(value => Number.isFinite(value) && value >= 0)) continue;
    const lastYear = Number(row.through.slice(0, 4));
    if (!Number.isInteger(lastYear)) continue;
    summaries.set(row.iso, {
      region: `country:${row.iso}`, source: 'tourismapi', level: 'country',
      period: `${lastYear - row.years + 1}–${lastYear}`,
      years: Array.from({ length: row.years }, (_, i) => lastYear - row.years + 1 + i),
      provisional: row.years < 3,
      months: row.index.map((relativeDemand, index) => ({ month: index + 1, relativeDemand: relativeDemand / 100, samples: row.years })),
    });
  }
  return summaries;
}

async function getRegions(): Promise<Region[]> {
  const cached = readSeasonalCache<Region[]>(GEOGRAPHY_KEY);
  if (cached) return cached;
  const result = await getSeasonalData<Region[]>('gisco-nuts2', GEOGRAPHY_KEY, GEOGRAPHY_TTL,
    'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2024_4326_LEVL_2.geojson', value => {
      const geojson = value as { features?: Array<{ properties?: { NUTS_ID?: string }; geometry?: Region['geometry'] }> };
      if (!Array.isArray(geojson.features)) throw new Error('GISCO returned no region geometry');
      return geojson.features.flatMap(feature => feature.properties?.NUTS_ID && feature.geometry
        ? [{ code: feature.properties.NUTS_ID, geometry: feature.geometry }]
        : []);
    });
  if (!result.data) throw new Error(result.error || 'NUTS2 boundaries unavailable');
  return result.data;
}

async function getCountries(): Promise<CountryRegion[]> {
  const cached = readSeasonalCache<CountryRegion[]>(COUNTRY_GEOGRAPHY_KEY);
  if (cached) return cached;
  const result = await getSeasonalData<CountryRegion[]>('gisco-country-boundaries', COUNTRY_GEOGRAPHY_KEY, GEOGRAPHY_TTL,
    'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_20M_2024_4326.geojson', value => {
      const geojson = value as { features?: Array<{ properties?: { CNTR_ID?: string }; geometry?: CountryRegion['geometry'] }> };
      if (!Array.isArray(geojson.features)) throw new Error('GISCO returned no country geometry');
      return geojson.features.flatMap(feature => feature.properties?.CNTR_ID && feature.geometry
        ? [{ code: feature.properties.CNTR_ID, geometry: feature.geometry }]
        : []);
    });
  if (!result.data) throw new Error(result.error || 'Country boundaries unavailable');
  return result.data;
}

export async function resolveSeasonGeography(locations: Point[]): Promise<Array<{ key: string; region?: string; countryCode?: string; error?: string }>> {
  if (!locations.length) return []
  const regions = await getRegions();
  return locations.map(location => {
    const region = nuts2AtPoint(location.lng, location.lat, regions);
    const countryCode = nutsCountryCode(region);
    return { key: location.key, ...(region ? { region } : {}), ...(countryCode ? { countryCode } : {}), ...(!region ? { error: 'No NUTS2 regional tourism coverage for this location' } : {}) };
  });
}

export async function resolveCountryGeography(locations: Point[]): Promise<Array<{ key: string; countryCode?: string; error?: string }>> {
  if (!locations.length) return []
  const countries = await getCountries();
  return locations.map(location => {
    const countryCode = nutsCountryCode(countryAtPoint(location.lng, location.lat, countries));
    return { key: location.key, ...(countryCode ? { countryCode } : {}), ...(!countryCode ? { error: 'No country boundary for this location' } : {}) };
  });
}

export async function getCrowdSeasonality(locations: Point[]): Promise<Array<{ key: string; region?: string; countryCode?: string; data?: RegionCrowd; error?: string }>> {
  if (!locations.length) return []
  const geography = await resolveSeasonGeography(locations);
  const byKey = geography.map(item => ({ ...item }));
  const missingCountry = byKey.filter(item => !item.countryCode);
  if (missingCountry.length) {
    try {
      const resolved = await resolveCountryGeography(locations.filter(location => missingCountry.some(item => item.key === location.key)));
      const countries = new Map(resolved.flatMap(item => item.countryCode ? [[item.key, item.countryCode] as const] : []));
      byKey.forEach(item => { item.countryCode ||= countries.get(item.key); });
    } catch { /* country-level data is an optional fallback */ }
  }
  const uniqueCodes = [...new Set(byKey.flatMap(item => item.region ? [item.region] : []))].sort();
  const lastYear = new Date().getUTCFullYear() - 1;
  const firstYear = lastYear - 3;
  const missingCodes = uniqueCodes.filter(code => !readSeasonalCache<RegionCrowd>(`eurostat:crowd:${code}:${firstYear}-${lastYear}:v1`));
  if (missingCodes.length) {
    const params = new URLSearchParams({
      freq: 'A', nace_r2: 'I551-I553', unit: 'NR', c_resid: 'TOTAL',
      sinceTimePeriod: String(firstYear), untilTimePeriod: String(lastYear), lang: 'EN',
    });
    missingCodes.forEach(code => params.append('geo', code));
    const cacheKey = `eurostat:crowd:nuts2:${missingCodes.join(',')}:${firstYear}-${lastYear}:v2`;
    const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tour_occ_nin2m?${params}`;
    const dataResult = await getSeasonalData('eurostat-tourism', cacheKey, CROWD_TTL, url, value => parseEurostat(value as JsonStat));
    if (dataResult.data) {
      for (const code of missingCodes) {
        const summary = summarizeCrowd(dataResult.data[code] || [], firstYear, lastYear);
        if (summary) writeSeasonalCache(`eurostat:crowd:${code}:${firstYear}-${lastYear}:v1`, { ...summary, region: code }, CROWD_TTL);
      }
    }
  }
  const eurostat = new Map<string, RegionCrowd>();
  for (const code of uniqueCodes) {
    const data = readSeasonalCache<RegionCrowd>(`eurostat:crowd:${code}:${firstYear}-${lastYear}:v1`);
    if (data) eurostat.set(code, { ...data, region: code, source: 'eurostat', level: 'regional' });
  }
  const needsCountryFallback = byKey.some(item => !item.region || !eurostat.has(item.region));
  const countryData = needsCountryFallback ? await getCountryCrowd() : new Map<string, RegionCrowd>();
  return byKey.map(item => {
    const data = (item.region && eurostat.get(item.region)) || (item.countryCode && countryData.get(item.countryCode));
    return {
      key: item.key,
      ...(data?.region ? { region: data.region } : item.region ? { region: item.region } : {}),
      ...(item.countryCode ? { countryCode: item.countryCode } : {}),
      ...(data ? { data } : {}),
      ...(!data ? { error: item.region ? 'No complete regional tourism observations or country-level fallback are available' : item.error || 'No visitor-demand coverage for this country' } : {}),
    };
  });
}

