import { getSeasonalData, readSeasonalCache, writeSeasonalCache } from './seasonalDataCache';
import { db } from '../db/database';

const FIRST_YEAR = 1980;
const LAST_YEAR = 2025;
const RADIUS_KM = 150 * 1.852;
const CACHE_TTL = 365 * 24 * 60 * 60 * 1_000;
const BASE_URL = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1';
const HAZARDS = ['earthquakes', 'tsunamis', 'volcanoes'] as const;
const ENDPOINTS: Record<typeof HAZARDS[number], string> = {
  earthquakes: 'earthquakes',
  tsunamis: 'tsunamis/events',
  volcanoes: 'volcanoes',
};

type HazardKind = typeof HAZARDS[number];
type Point = { key: string; lat: number; lng: number };
type HazardEvent = { id?: string | number; year?: number; month?: number; latitude?: number; longitude?: number; eventValidity?: number; eqMagnitude?: number; primaryMagnitude?: number; vei?: number; tsunamiFlag?: boolean; source?: string };
type HazardMonth = { month: number; events: number; relativeActivity: number | null };
type HazardCalendar = { source: string; period: string; radiusKm: number; events: number; months: HazardMonth[] };
type HazelResponse = { items?: HazardEvent[]; totalItems?: number; count?: number } | HazardEvent[];
type UsgsResponse = { features?: Array<{ id: string; properties?: { time?: number; mag?: number; tsunami?: number }; geometry?: { coordinates?: number[] } }> };
type GvpResponse = { features?: Array<{ properties?: Record<string, unknown>; geometry?: { coordinates?: number[] } }> };
const PAGE_SIZE = 200;
const MAX_PAGES = 100; // shortcut: cap each hazard catalog at 20,000 events; raise only if NOAA reports a larger result set.
const MAX_GVP_FEATURES = 20_000;
let cacheWarmTimer: ReturnType<typeof setTimeout> | undefined;

function distanceKm(a: Point, b: HazardEvent): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(a.lat), lat2 = radians(b.latitude!);
  const dLat = lat2 - lat1, dLng = radians(b.longitude! - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function loadUsgsEarthquakes(): Promise<HazardEvent[]> {
  const cacheKey = `usgs-earthquakes:${FIRST_YEAR}-${LAST_YEAR}:m6:v2`;
  const params = new URLSearchParams({ format: 'geojson', starttime: `${FIRST_YEAR}-01-01`, endtime: `${LAST_YEAR}-12-31`, minmagnitude: '6', orderby: 'time-asc', limit: '20000' });
  const result = await getSeasonalData<HazardEvent[]>('usgs-earthquakes', cacheKey, CACHE_TTL,
    `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`, value => {
      const features = (value as UsgsResponse).features ?? [];
      return features.flatMap(feature => {
        const time = feature.properties?.time, coordinates = feature.geometry?.coordinates;
        if (!Number.isFinite(time) || !coordinates || coordinates.length < 2) return [];
        const date = new Date(time!);
        return [{ id: feature.id, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, longitude: coordinates[0], latitude: coordinates[1], eqMagnitude: feature.properties?.mag, tsunamiFlag: Number(feature.properties?.tsunami) === 1, source: 'USGS ComCat' }];
      });
    });
  if (!result.data) throw new Error(result.error || 'USGS earthquake data is unavailable');
  return result.data;
}

async function loadGvpVolcanoEruptions(): Promise<HazardEvent[]> {
  const cacheKey = `smithsonian-gvp:eruptions:${FIRST_YEAR}-${LAST_YEAR}:v1`;
  const params = new URLSearchParams({
    service: 'WFS', version: '1.0.0', request: 'GetFeature',
    typeName: 'GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions',
    maxFeatures: String(MAX_GVP_FEATURES), outputFormat: 'application/json',
  });
  const result = await getSeasonalData<HazardEvent[]>('smithsonian-gvp', cacheKey, CACHE_TTL,
    `https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?${params}`, value => {
      const features = (value as GvpResponse).features;
      if (!Array.isArray(features) || !features.length || features.length >= MAX_GVP_FEATURES) {
        throw new Error('Smithsonian GVP returned an empty or capped eruption catalog');
      }
      const events = features.flatMap(feature => {
        const properties = feature.properties ?? {};
        const year = Number(properties.StartDateYear), month = Number(properties.StartDateMonth);
        const coordinates = feature.geometry?.coordinates;
        if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR || !Number.isInteger(month) || month < 1 || month > 12 || !coordinates || coordinates.length < 2 || !Number.isFinite(coordinates[0]) || coordinates[0] < -180 || coordinates[0] > 180 || !Number.isFinite(coordinates[1]) || coordinates[1] < -90 || coordinates[1] > 90) return [];
        return [{
          id: String(properties.Eruption_Number ?? `${properties.Volcano_Number}-${year}-${month}`),
          year, month, longitude: coordinates[0], latitude: coordinates[1],
          vei: properties.ExplosivityIndexMax != null && Number.isFinite(Number(properties.ExplosivityIndexMax)) ? Number(properties.ExplosivityIndexMax) : undefined,
          source: 'Smithsonian Global Volcanism Program',
        }];
      });
      if (!events.length) throw new Error('Smithsonian GVP returned no dated eruptions in the analysis period');
      return events;
    }, 'json', 30_000);
  if (!result.data) throw new Error(result.error || 'Smithsonian GVP eruption data is unavailable');
  return result.data;
}

async function loadEvents(kind: HazardKind): Promise<HazardEvent[]> {
  if (kind === 'earthquakes') return loadUsgsEarthquakes();
  const cacheKey = `noaa-hazel:${kind}:${FIRST_YEAR}-${LAST_YEAR}:v2`;
  const cached = readSeasonalCache<HazardEvent[]>(cacheKey);
  if (cached) return cached;
  const all: HazardEvent[] = [];
  let expected: number | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageKey = `${cacheKey}:page:${page}`;
    const params = new URLSearchParams({ minYear: String(FIRST_YEAR), maxYear: String(LAST_YEAR), itemsPerPage: String(PAGE_SIZE), page: String(page) });
    if (kind === 'volcanoes') params.set('order', 'year:asc');
    const result = await getSeasonalData<{ items?: HazardEvent[]; totalItems?: number }>('noaa-hazel', pageKey, CACHE_TTL,
      `${BASE_URL}/${ENDPOINTS[kind]}?${params}`, value => {
        const response = value as HazelResponse;
      return Array.isArray(response) ? { items: response } : { items: response.items, totalItems: response.totalItems ?? response.count };
      });
  if (!result.data && kind === 'volcanoes') return loadGvpVolcanoEruptions();
  if (!result.data) {
    if (kind === 'tsunamis') {
      const fallback = (await loadUsgsEarthquakes()).filter(event => event.tsunamiFlag).map(event => ({ ...event, source: 'USGS ComCat tsunami-flagged earthquakes' }));
      if (fallback.length) return fallback;
    }
    throw new Error(result.error || `NOAA ${kind} data is unavailable`);
  }
    const data = result.data;
    const items = data.items ?? [];
    if (Number.isFinite(data.totalItems)) expected = data.totalItems;
    all.push(...items.map(item => ({ ...item, source: 'NOAA NCEI HazEL' })));
    if (!items.length || (expected != null && all.length >= expected) || items.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) throw new Error(`NOAA ${kind} history exceeded the safe ${PAGE_SIZE * MAX_PAGES}-event download limit`);
  }
  if (!all.length) throw new Error(`NOAA ${kind} history returned no events`);
  writeSeasonalCache(cacheKey, all, CACHE_TTL);
  return all;
}

function validEvent(kind: HazardKind, event: HazardEvent): boolean {
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude) || !Number.isInteger(event.month) || event.month! < 1 || event.month! > 12) return false;
  if (!Number.isInteger(event.year) || event.year! < FIRST_YEAR || event.year! > LAST_YEAR) return false;
  if (kind === 'tsunamis' && event.tsunamiFlag !== true && (!Number.isFinite(event.eventValidity) || event.eventValidity! < 3)) return false;
  return true;
}

function summarize(kind: HazardKind, events: HazardEvent[], location: Point): HazardCalendar {
  const byMonth = Array.from({ length: 12 }, () => new Set<string | number | HazardEvent>());
  for (const event of events) {
    if (!validEvent(kind, event) || distanceKm(location, event) > RADIUS_KM) continue;
    byMonth[event.month! - 1].add(event.id ?? event);
  }
  const total = byMonth.reduce((sum, values) => sum + values.size, 0);
  const yearDays = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => new Date(Date.UTC(FIRST_YEAR + i + 1, 0, 1) - Date.UTC(FIRST_YEAR + i, 0, 1)).getTime() / 86_400_000).reduce((a, b) => a + b, 0);
  return {
    source: events[0]?.source ?? 'Natural hazards catalog',
    period: `${FIRST_YEAR}–${LAST_YEAR}`,
    radiusKm: RADIUS_KM,
    events: total,
    months: byMonth.map((values, index) => {
      const days = new Date(Date.UTC(FIRST_YEAR, index + 1, 0)).getUTCDate();
      const relativeActivity = total >= 5 ? values.size / total * (yearDays / (LAST_YEAR - FIRST_YEAR + 1)) / days : null;
      return { month: index + 1, events: values.size, relativeActivity };
    }),
  };
}

export async function getNaturalHazardSeasonality(locations: Point[]) {
  if (!locations.length) return [];
  const results = await Promise.all(HAZARDS.map(kind => loadEvents(kind).then(data => ({ kind, data }), error => ({ kind, error: error instanceof Error ? error.message : `${kind} data is unavailable` }))));
  const available = new Map(results.flatMap(result => 'data' in result ? [[result.kind, result.data] as const] : []));
  return locations.map(location => {
    const hazards = Object.fromEntries(HAZARDS.flatMap(kind => {
      const events = available.get(kind);
      return events ? [[kind, summarize(kind, events, location)]] : [];
    })) as Partial<Record<HazardKind, HazardCalendar>>;
    const errors = results.flatMap(result => 'error' in result ? [result.error] : []);
    return { key: location.key, hazards, ...(errors.length ? { error: errors.join('; ') } : {}) };
  });
}

/** Resume global catalog pagination after restarts and provider cooldowns. */
export function warmNaturalHazardCatalog(): void {
  if (process.env.TREK_E2E === '1') return;
  void getNaturalHazardSeasonality([{ key: 'cache-warm', lat: 0, lng: 0 }]).then(results => {
    const error = results[0]?.error;
    const state = db.prepare('SELECT next_allowed_at, last_error_at FROM seasonal_provider_state WHERE provider = ?').get('noaa-hazel') as { next_allowed_at: number; last_error_at: number } | undefined;
    const coolingDown = Boolean(state?.last_error_at && state.next_allowed_at > Date.now());
    if (!coolingDown && (!error || !/cooling down|budget reached|HTTP (?:429|5\d\d)|retry deferred/i.test(error))) return;
    const delay = Math.max(5_000, (state?.next_allowed_at ?? Date.now()) - Date.now());
    if (cacheWarmTimer) clearTimeout(cacheWarmTimer);
    cacheWarmTimer = setTimeout(() => {
      cacheWarmTimer = undefined;
      warmNaturalHazardCatalog();
    }, delay);
    (cacheWarmTimer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
  }).catch(error => {
    console.warn('[seasons] Natural hazard cache warm failed:', error instanceof Error ? error.message : 'unknown error');
  });
}
