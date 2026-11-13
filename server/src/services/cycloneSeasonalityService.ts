import { getSeasonalData } from './seasonalDataCache';

const SNAPSHOT_TTL = 10 * 365 * 24 * 60 * 60 * 1_000;
const FIRST_YEAR = 1980;
const LAST_YEAR = 2025;
const NEAR_TRACK_KM = 150 * 1.852;
const FILES = {
  atlantic: {
    cacheKey: 'noaa:hurdat2:atlantic:1851-2025:092326:v1',
    url: 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-092326.txt',
  },
  pacific: {
    cacheKey: 'noaa:hurdat2:nepac:1949-2025:092926:v1',
    url: 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-nepac-1949-2025-092926.txt',
  },
} as const;

type Point = { key: string; lat: number; lng: number };
type TrackPoint = { stormId: string; year: number; month: number; lat: number; lng: number };
type Basin = keyof typeof FILES;
type CycloneCalendar = { source: string; period: string; radiusNm: number; basins: string[]; events: number; months: Array<{ month: number; events: number; tracksPer100Years: number; relativeActivity: number | null }> };

function coordinate(value: string): number | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)([NSEW])$/i);
  if (!match) return undefined;
  const number = Number(match[1]);
  return /[SW]/i.test(match[2]) ? -Math.abs(number) : Math.abs(number);
}

export function parseHurdat2(text: string): TrackPoint[] {
  const rows: TrackPoint[] = [];
  let stormId = '';
  for (const line of text.split(/\r?\n/)) {
    const columns = line.split(',').map(value => value.trim());
    if (/^(AL|EP|CP)\d{6}$/i.test(columns[0])) {
      stormId = columns[0];
      continue;
    }
    if (!/^\d{8}$/.test(columns[0]) || !stormId) continue;
    const year = Number(columns[0].slice(0, 4));
    if (year < FIRST_YEAR || year > LAST_YEAR) continue;
    const lat = coordinate(columns[4]), lng = coordinate(columns[5]);
    if (lat == null || lng == null) continue;
    rows.push({ stormId, year, month: Number(columns[0].slice(4, 6)), lat, lng });
  }
  if (!rows.length) throw new Error('NHC returned no cyclone track points in the modern observation period');
  return rows;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(a.lat), lat2 = radians(b.lat);
  const dLat = lat2 - lat1, dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function basinsAtPoint(point: Point): Basin[] {
  // shortcut: use a longitude split for the overlapping Americas bounds; replace with basin polygons when coverage expands.
  if (point.lat >= 5 && point.lat <= 60 && point.lng >= -100 && point.lng <= 0) return ['atlantic'];
  if (point.lat >= 0 && point.lat <= 60 && point.lng >= -180 && point.lng < -100) return ['pacific'];
  return [];
}

async function getTracks(basin: Basin): Promise<TrackPoint[]> {
  const file = FILES[basin];
  const result = await getSeasonalData('noaa-hurdat2', file.cacheKey, SNAPSHOT_TTL, file.url, value => parseHurdat2(String(value)), 'text', 120_000);
  if (!result.data) throw new Error(result.error || 'NHC cyclone history is unavailable');
  return result.data;
}

export async function getCycloneSeasonality(locations: Point[]) {
  const needsByKey = new Map(locations.map(location => [location.key, basinsAtPoint(location)]));
  const needed = [...new Set([...needsByKey.values()].flat())];
  if (!needed.length) return locations.map(location => ({ key: location.key, coverage: 'unsupported' as const }));

  const tracks = new Map<Basin, TrackPoint[]>();
  const errors: string[] = [];
  for (const basin of needed) {
    try { tracks.set(basin, await getTracks(basin)); }
    catch (error) { errors.push(error instanceof Error ? error.message : 'Cyclone data unavailable'); }
  }
  return locations.map(location => {
    const basins = needsByKey.get(location.key) ?? [];
    if (!basins.length) return { key: location.key, coverage: 'unsupported' as const };
    if (basins.some(basin => !tracks.has(basin))) return { key: location.key, coverage: 'unavailable' as const, error: errors[0] || 'Cyclone data unavailable' };
    const stormsByMonth = Array.from({ length: 12 }, () => new Set<string>());
    for (const basin of basins) {
      for (const track of tracks.get(basin)!) {
        if (distanceKm(location, track) <= NEAR_TRACK_KM) stormsByMonth[track.month - 1].add(track.stormId);
      }
    }
    const basinsLabel = basins.map(basin => basin === 'atlantic' ? 'Atlantic' : 'Northeast and North-Central Pacific');
    const monthlyCounts = stormsByMonth.map(storms => storms.size);
    const eventMonths = monthlyCounts.reduce((sum, count) => sum + count, 0);
    const yearDays = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => new Date(Date.UTC(FIRST_YEAR + i + 1, 0, 1) - Date.UTC(FIRST_YEAR + i, 0, 1)).getTime() / 86_400_000).reduce((a, b) => a + b, 0);
    const calendar: CycloneCalendar = {
      source: 'NOAA National Hurricane Center HURDAT2',
      period: `${FIRST_YEAR}–${LAST_YEAR}`,
      radiusNm: 150,
      basins: basinsLabel,
      events: new Set(stormsByMonth.flatMap(storms => [...storms])).size,
      months: stormsByMonth.map((storms, index) => {
        const days = new Date(Date.UTC(FIRST_YEAR, index + 1, 0)).getUTCDate();
        return { month: index + 1, events: storms.size, tracksPer100Years: Math.round(storms.size / (LAST_YEAR - FIRST_YEAR + 1) * 100 * 10) / 10, relativeActivity: eventMonths >= 5 ? storms.size / eventMonths * (yearDays / (LAST_YEAR - FIRST_YEAR + 1)) / days : null };
      }),
    };
    return { key: location.key, coverage: 'covered' as const, calendar };
  });
}
