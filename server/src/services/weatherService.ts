import { db } from '../db/database';
import { resolveCountryGeography } from './crowdSeasonalityService';

// ── Interfaces ──────────────────────────────────────────────────────────

export interface WeatherResult {
  temp: number;
  temp_max?: number;
  temp_min?: number;
  main: string;
  description: string;
  type: string;
  sunrise?: string | null;
  sunset?: string | null;
  precipitation_sum?: number;
  precipitation_probability_max?: number;
  wind_max?: number;
  hourly?: HourlyEntry[];
  error?: string;
}

export interface HourlyEntry {
  hour: number;
  temp: number;
  precipitation: number;
  precipitation_probability: number;
  main: string;
  wind: number;
  humidity: number;
}

interface OpenMeteoForecast {
  error?: boolean;
  reason?: string;
  current?: { temperature_2m: number; weathercode: number };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    windspeed_10m_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    weathercode?: number[];
    windspeed_10m?: number[];
    relativehumidity_2m?: number[];
  };
}

// ── WMO code mappings ───────────────────────────────────────────────────

const WMO_MAP: Record<number, string> = {
  0: 'Clear', 1: 'Clear', 2: 'Clouds', 3: 'Clouds',
  45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Drizzle', 57: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Rain', 66: 'Rain', 67: 'Rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow',
  80: 'Rain', 81: 'Rain', 82: 'Rain',
  85: 'Snow', 86: 'Snow',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

const WMO_DESCRIPTION_DE: Record<number, string> = {
  0: 'Klar', 1: 'Uberwiegend klar', 2: 'Teilweise bewolkt', 3: 'Bewolkt',
  45: 'Nebel', 48: 'Nebel mit Reif',
  51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen',
  56: 'Gefrierender Nieselregen', 57: 'Starker gefr. Nieselregen',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen',
  66: 'Gefrierender Regen', 67: 'Starker gefr. Regen',
  71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneekorner',
  80: 'Leichte Regenschauer', 81: 'Regenschauer', 82: 'Starke Regenschauer',
  85: 'Leichte Schneeschauer', 86: 'Starke Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Starkes Gewitter mit Hagel',
};

const WMO_DESCRIPTION_EN: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snowfall', 73: 'Snowfall', 75: 'Heavy snowfall', 77: 'Snow grains',
  80: 'Light rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
  85: 'Light snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
};

// ── Cache management ────────────────────────────────────────────────────

const weatherCache = new Map<string, { data: WeatherResult; expiresAt: number }>();
const inFlight = new Map<string, Promise<WeatherResult>>();
const CACHE_MAX_ENTRIES = 1000;
const CACHE_PRUNE_TARGET = 500;
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface MonthlyClimate { month: number; meanMaxC: number; meanMinC: number; precipitationMm: number; days: number }
type MonthlyClimateResponse = { error?: boolean; reason?: string; daily?: { time?: string[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[]; precipitation_sum?: (number | null)[] } }
const monthlyClimateInFlight = new Map<string, Promise<MonthlyClimate[]>>()
let activeMonthlyClimateRequests = 0
const monthlyClimateQueue: Array<() => void> = []
const climateWarmQueue = new Map<string, { key: string; lat: number; lng: number }>()
let climateWarmTimer: ReturnType<typeof setTimeout> | undefined
let climateWarmTimerAt = 0
let openMeteoQueue = Promise.resolve()
const OPEN_METEO_DAILY_LIMIT = 3_000 // shortcut: reserve 70% of Open-Meteo's free daily quota for headroom; revisit only if account plan changes.
const OPEN_METEO_MIN_INTERVAL_MS = 5_000
const MONTHLY_CLIMATE_BATCH_SIZE = 10
const monthlyClimateBatchInFlight = new Map<string, Promise<Array<{ key: string; months?: MonthlyClimate[]; error?: string }>>>()
const MONTHLY_CLIMATE_YEARS = 2
const MONTHLY_CLIMATE_GRID_DEGREES = 1
const MAX_CLIMATE_SAMPLES_PER_COUNTRY = 2

function monthlyClimateYears(): [number, number] {
  const lastYear = new Date().getUTCFullYear() - 1
  return [lastYear - MONTHLY_CLIMATE_YEARS + 1, lastYear]
}

function estimateOpenMeteoCallUnits(url: string): number {
  const params = new URL(url).searchParams
  const locations = Math.max(1, params.get('latitude')?.split(',').length ?? 1)
  const variables = ['current', 'daily', 'hourly', 'minutely_15', 'six_hourly', 'weekly']
    .flatMap(key => params.getAll(key)).flatMap(value => value.split(',')).filter(Boolean).length
  const start = params.get('start_date'), end = params.get('end_date')
  const parsedDays = start && end ? (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1 : 14
  const days = Number.isFinite(parsedDays) ? Math.max(1, parsedDays) : 14
  return Math.ceil(locations * Math.max(1, days / 14) * Math.max(1, variables / 10))
}

export function monthlyClimatePeriod(): string {
  const [firstYear, lastYear] = monthlyClimateYears()
  return `${firstYear}–${lastYear}`
}

async function fetchOpenMeteo(url: string): Promise<Response> {
  const callUnits = estimateOpenMeteoCallUnits(url)
  const run = openMeteoQueue.then(async () => {
    let state: { day: string; request_count: number; next_allowed_at: number; last_error_at: number; retry_count: number } | undefined
    while (true) {
      const now = Date.now()
      state = db.prepare('SELECT day, request_count, next_allowed_at, last_error_at, retry_count FROM seasonal_provider_state WHERE provider = ?').get('open-meteo') as typeof state
      const waitMs = (state?.next_allowed_at ?? 0) - now
      if (waitMs > 0 && state?.last_error_at) throw new ApiError(429, `Open-Meteo rate limited; retry in ${Math.ceil(waitMs / 1000)} seconds`)
      if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs))
      const requestAt = Date.now()
      const day = new Date(requestAt).toISOString().slice(0, 10)
      const claim = db.transaction(() => {
        const latest = db.prepare('SELECT day, request_count, next_allowed_at, last_error_at FROM seasonal_provider_state WHERE provider = ?').get('open-meteo') as { day: string; request_count: number; next_allowed_at: number; last_error_at: number } | undefined
        if (latest?.last_error_at && latest.next_allowed_at > requestAt) return 'cooldown'
        if (latest && latest.next_allowed_at > requestAt) return 'wait'
        const count = latest?.day === day ? latest.request_count : 0
        if (count + callUnits > OPEN_METEO_DAILY_LIMIT) return 'budget'
        db.prepare(`INSERT INTO seasonal_provider_state (provider, day, request_count, next_allowed_at, last_error_at, retry_count)
          VALUES ('open-meteo', ?, ?, ?, 0, 0) ON CONFLICT(provider) DO UPDATE SET day = excluded.day,
          request_count = ?, next_allowed_at = excluded.next_allowed_at`)
          .run(day, callUnits, requestAt + OPEN_METEO_MIN_INTERVAL_MS, count + callUnits)
        return 'claimed'
      })()
      if (claim === 'claimed') break
      if (claim === 'budget') throw new ApiError(429, 'Open-Meteo daily request budget reached; try again after UTC midnight')
      if (claim === 'cooldown') throw new ApiError(429, 'Open-Meteo is temporarily cooling down; retry later')
    }
    const day = new Date().toISOString().slice(0, 10)

    let response: Response
    try { response = await fetch(url) }
    catch {
      const nextAllowed = Date.now() + 10 * 60 * 1000
      db.prepare(`UPDATE seasonal_provider_state SET next_allowed_at = ?, last_error_at = ?, retry_count = retry_count + 1 WHERE provider = 'open-meteo'`).run(nextAllowed, Date.now())
      throw new ApiError(503, 'Open-Meteo is temporarily unreachable; retry after the cooldown')
    }
    if (response.status === 429) {
      const retryAfter = response.headers?.get('retry-after')
      const retryAt = retryAfter && Number.isFinite(Number(retryAfter))
        ? Date.now() + Math.max(0, Number(retryAfter)) * 1000
        : retryAfter ? Date.parse(retryAfter) : NaN
      const nextUtcDay = new Date()
      nextUtcDay.setUTCHours(24, 0, 5, 0)
      const fallbackMs = nextUtcDay.getTime() - Date.now()
      const delayMs = Number.isFinite(retryAt) && retryAt > Date.now() ? Math.min(retryAt - Date.now(), 24 * 60 * 60 * 1000) : fallbackMs
      const nextAllowed = Date.now() + delayMs
      db.prepare(`INSERT INTO seasonal_provider_state (provider, day, request_count, next_allowed_at, last_error_at, retry_count)
        VALUES ('open-meteo', ?, 1, ?, ?, 1) ON CONFLICT(provider) DO UPDATE SET
        day = excluded.day, next_allowed_at = excluded.next_allowed_at, last_error_at = excluded.last_error_at, retry_count = seasonal_provider_state.retry_count + 1`)
        .run(day, nextAllowed, Date.now())
    } else if (response.status >= 500) {
      const delayMs = Math.min(10 * 60 * 1000 * 2 ** (state?.retry_count ?? 0), 24 * 60 * 60 * 1000)
      const failedAt = Date.now()
      db.prepare(`UPDATE seasonal_provider_state SET next_allowed_at = ?, last_error_at = ?, retry_count = retry_count + 1 WHERE provider = 'open-meteo'`).run(failedAt + delayMs, failedAt)
    } else if (response.ok) {
      db.prepare(`INSERT INTO seasonal_provider_state (provider, day, request_count, next_allowed_at, last_error_at, retry_count)
        VALUES ('open-meteo', ?, 1, 0, 0, 0) ON CONFLICT(provider) DO UPDATE SET last_error_at = 0, retry_count = 0`)
        .run(day)
    }
    return response
  })
  openMeteoQueue = run.then(() => undefined, () => undefined)
  return run
}

async function fetchMonthlyClimate(url: string): Promise<Response> {
  if (activeMonthlyClimateRequests >= 1) await new Promise<void>(resolve => monthlyClimateQueue.push(resolve))
  activeMonthlyClimateRequests++
  try {
    return await fetchOpenMeteo(url)
  }
  finally { activeMonthlyClimateRequests--; monthlyClimateQueue.shift()?.() }
}

function climateCacheKey(lat: number, lng: number): string {
  // One representative per ~1° cell avoids repeat archive work for nearby cities.
  const [firstYear, lastYear] = monthlyClimateYears()
  const representativeLat = Math.round(lat / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES
  const representativeLng = Math.round(lng / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES
  return `${representativeLat.toFixed(2)}_${representativeLng.toFixed(2)}_era5_${firstYear}_${lastYear}_v3`
}

function scheduleClimateWarm(delayMs: number): void {
  if (!climateWarmQueue.size) return
  const runAt = Date.now() + delayMs
  if (climateWarmTimer && climateWarmTimerAt <= runAt) return
  if (climateWarmTimer) clearTimeout(climateWarmTimer)
  climateWarmTimerAt = runAt
  climateWarmTimer = setTimeout(() => {
    climateWarmTimer = undefined
    climateWarmTimerAt = 0
    const batch = [...climateWarmQueue.values()]
    climateWarmQueue.clear()
    void getMonthlyClimateBatch(batch, true).then(results => {
      const failed = results.filter(result => !result.months).length
      if (failed) {
        const missing = (db.prepare('SELECT lat, lng FROM weather_climate_country_samples').all() as Array<{ lat: number; lng: number }>)
          .filter(sample => !getCachedMonthlyClimate(climateCacheKey(sample.lat, sample.lng))).length
        console.warn(`[weather] Background climate warm incomplete: ${missing ? `${missing} representative point(s) remain uncached` : 'some destinations could not be mapped to a country'}`)
      }
    }).catch(() => console.warn('[weather] Background climate warm failed'))
  }, delayMs)
}

function climateCooldownMs(error: ApiError): number {
  if (error.message.includes('after UTC midnight')) {
    const tomorrow = new Date()
    tomorrow.setUTCHours(24, 0, 1, 0)
    return tomorrow.getTime() - Date.now()
  }
  const state = db.prepare('SELECT next_allowed_at FROM seasonal_provider_state WHERE provider = ?').get('open-meteo') as { next_allowed_at: number } | undefined
  return Math.max(5_000, (state?.next_allowed_at ?? 0) - Date.now())
}

function getCachedMonthlyClimate(key: string): MonthlyClimate[] | null {
  const row = db.prepare('SELECT climate_json FROM weather_climate_cache WHERE cache_key = ?').get(key) as { climate_json: string } | undefined
  if (!row) return null
  try {
    const data: unknown = JSON.parse(row.climate_json)
    if (Array.isArray(data) && data.length === 12) return data as MonthlyClimate[]
  } catch { /* discard invalid persisted cache data */ }
  db.prepare('DELETE FROM weather_climate_cache WHERE cache_key = ?').run(key)
  return null
}

function cacheMonthlyClimate(key: string, data: MonthlyClimate[]): void {
  db.prepare(`INSERT INTO weather_climate_cache (cache_key, climate_json)
    VALUES (?, ?) ON CONFLICT(cache_key) DO UPDATE SET climate_json = excluded.climate_json`)
    .run(key, JSON.stringify(data))
}

function monthlyClimateFromDaily(data: MonthlyClimateResponse): MonthlyClimate[] {
  const buckets = Array.from({ length: 12 }, () => ({ max: 0, min: 0, rain: 0, days: 0 }))
  for (let i = 0; i < (data.daily?.time?.length ?? 0); i++) {
    const bucket = buckets[Number(data.daily!.time![i].slice(5, 7)) - 1]
    const max = data.daily?.temperature_2m_max?.[i], min = data.daily?.temperature_2m_min?.[i], rain = data.daily?.precipitation_sum?.[i]
    if (bucket && max != null && min != null && rain != null) { bucket.max += max; bucket.min += min; bucket.rain += rain; bucket.days++ }
  }
  return buckets.map((b, i) => ({ month: i + 1, meanMaxC: b.days ? Math.round(b.max / b.days * 10) / 10 : 0, meanMinC: b.days ? Math.round(b.min / b.days * 10) / 10 : 0, precipitationMm: b.days ? Math.round(b.rain / (b.days / 30.44) * 10) / 10 : 0, days: b.days }))
}

function hasClimateObservations(months: MonthlyClimate[]): boolean { return months.some(month => month.days > 0) }

/** Fetch selected representatives in multi-coordinate provider calls. */
async function fetchMonthlyClimateBatch(locations: Array<{ key: string; lat: number; lng: number }>) {
  const [firstYear, lastYear] = monthlyClimateYears()
  const unique = new Map<string, { lat: number; lng: number; keys: string[] }>()
  for (const { key, lat, lng } of locations) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) continue
    const cacheKey = climateCacheKey(lat, lng)
    const entry = unique.get(cacheKey) ?? {
      lat: Math.round(lat / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES,
      lng: Math.round(lng / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES,
      keys: [],
    }
    entry.keys.push(key)
    unique.set(cacheKey, entry)
  }
  const results = new Map<string, { months?: MonthlyClimate[]; error?: string }>()
  const missing = [...unique].filter(([key]) => {
    const cached = getCachedMonthlyClimate(key)
    if (cached) {
      unique.get(key)!.keys.forEach(locationKey => results.set(locationKey, { months: cached }))
      return false
    }
    return true
  })
  for (let offset = 0; offset < missing.length; offset += MONTHLY_CLIMATE_BATCH_SIZE) {
    const chunk = missing.slice(offset, offset + MONTHLY_CLIMATE_BATCH_SIZE)
    try {
      const params = new URLSearchParams({
        latitude: chunk.map(([, item]) => item.lat).join(','),
        longitude: chunk.map(([, item]) => item.lng).join(','),
        start_date: `${firstYear}-01-01`, end_date: `${lastYear}-12-31`,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum', timezone: 'auto', models: 'era5',
      })
      const response = await fetchMonthlyClimate(`https://archive-api.open-meteo.com/v1/archive?${params}`)
      const body = await response.json() as MonthlyClimateResponse | MonthlyClimateResponse[]
      if (!response.ok || !Array.isArray(body) && body.error) throw new ApiError(response.status || 502, !Array.isArray(body) && body.reason || 'Open-Meteo climate API error')
      const entries = Array.isArray(body) ? body : [body]
      if (entries.length !== chunk.length) throw new ApiError(502, 'Open-Meteo returned an unexpected number of climate locations')
      entries.forEach((data, index) => {
        const [cacheKey, item] = chunk[index]
        if (data.error) {
          item.keys.forEach(locationKey => results.set(locationKey, { error: data.reason || 'Climate data unavailable' }))
          return
        }
        const months = monthlyClimateFromDaily(data)
        if (!hasClimateObservations(months)) {
          item.keys.forEach(locationKey => results.set(locationKey, { error: 'No historical climate observations returned' }))
          return
        }
        cacheMonthlyClimate(cacheKey, months)
        item.keys.forEach(locationKey => results.set(locationKey, { months }))
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Climate data unavailable'
      if (err instanceof ApiError && (err.status === 429 || err.status === 503)) {
        for (const [key, item] of missing.slice(offset)) {
          climateWarmQueue.set(key, { key, lat: item.lat, lng: item.lng })
          item.keys.forEach(locationKey => results.set(locationKey, { error: message }))
        }
        scheduleClimateWarm(climateCooldownMs(err))
        break
      }
      chunk.forEach(([, item]) => item.keys.forEach(locationKey => results.set(locationKey, { error: message })))
    }
  }
  for (const location of locations) if (!results.has(location.key)) results.set(location.key, { error: 'Invalid coordinates' })
  return locations.map(({ key }) => ({ key, ...results.get(key) }))
}

function climateDistanceSquared(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const meanLat = (a.lat + b.lat) / 2 * Math.PI / 180
  return (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * Math.cos(meanLat)) ** 2
}

async function loadMonthlyClimateBatch(locations: Array<{ key: string; lat: number; lng: number }>, ensureCountrySamples = false) {
  const unique = new Map<string, { lat: number; lng: number; keys: string[] }>()
  for (const { key, lat, lng } of locations) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) continue
    const cacheKey = climateCacheKey(lat, lng)
    const entry = unique.get(cacheKey) ?? {
      lat: Math.round(lat / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES,
      lng: Math.round(lng / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES,
      keys: [],
    }
    entry.keys.push(key)
    unique.set(cacheKey, entry)
  }

  const results = new Map<string, { months?: MonthlyClimate[]; error?: string }>()
  const cached = new Map<string, MonthlyClimate[]>()
  for (const [key, item] of unique) {
    const months = getCachedMonthlyClimate(key)
    if (months) {
      cached.set(key, months)
      item.keys.forEach(locationKey => results.set(locationKey, { months }))
    }
  }
  const pending = [...unique].filter(([key]) => !cached.has(key))
  if (pending.length || ensureCountrySamples) {
    let geography: Array<{ key: string; countryCode?: string }>
    let geographyFailed = false
    try {
      geography = await resolveCountryGeography([...unique].map(([key, item]) => ({ key, lat: item.lat, lng: item.lng })))
    } catch {
      geographyFailed = true
      geography = []
    }
    if (geographyFailed) {
      for (const [key, item] of pending) climateWarmQueue.set(key, { key, lat: item.lat, lng: item.lng })
      scheduleClimateWarm(6 * 60 * 60 * 1000)
    }
    const countryByKey = new Map(geography.flatMap(item => item.countryCode ? [[item.key, item.countryCode] as const] : []))
    const byCountry = new Map<string, Array<{ key: string; lat: number; lng: number; cached: boolean }>>()
    for (const [key, item] of unique) {
      const countryCode = countryByKey.get(key)
      if (!countryCode) {
        if (!cached.has(key)) item.keys.forEach(locationKey => results.set(locationKey, { error: 'Could not identify destination country; climate request deferred' }))
        continue
      }
      const group = byCountry.get(countryCode) ?? []
      group.push({ key, lat: item.lat, lng: item.lng, cached: cached.has(key) })
      byCountry.set(countryCode, group)
    }

    const representatives = new Map<string, { key: string; lat: number; lng: number }>()
    const representativeByLocation = new Map<string, string>()
    for (const [countryCode, candidates] of byCountry) {
      const samples = db.prepare('SELECT slot, lat, lng FROM weather_climate_country_samples WHERE country_code = ? ORDER BY slot').all(countryCode) as Array<{ slot: number; lat: number; lng: number }>
      const selected = [...samples]
      const selectedKeys = new Set(selected.map(sample => climateCacheKey(sample.lat, sample.lng)))
      const remaining = candidates.filter(candidate => !selectedKeys.has(candidate.key)).sort((a, b) => Number(b.cached) - Number(a.cached) || a.key.localeCompare(b.key))
      while (selected.length < MAX_CLIMATE_SAMPLES_PER_COUNTRY && remaining.length) {
        const candidate = (selected.length ? [...remaining].sort((a, b) => {
          const distanceA = Math.min(...selected.map(sample => climateDistanceSquared(a, sample)))
          const distanceB = Math.min(...selected.map(sample => climateDistanceSquared(b, sample)))
          return distanceB - distanceA || Number(b.cached) - Number(a.cached) || a.key.localeCompare(b.key)
        })[0] : remaining[0])
        remaining.splice(remaining.findIndex(item => item.key === candidate.key), 1)
        const slot = selected.length
        db.prepare('INSERT OR IGNORE INTO weather_climate_country_samples (country_code, slot, lat, lng) VALUES (?, ?, ?, ?)').run(countryCode, slot, candidate.lat, candidate.lng)
        selected.push({ slot, lat: candidate.lat, lng: candidate.lng })
      }
      const samplePoints = selected.map(sample => ({ key: climateCacheKey(sample.lat, sample.lng), lat: sample.lat, lng: sample.lng }))
      samplePoints.forEach(sample => representatives.set(sample.key, sample))
      candidates.forEach(candidate => {
        if (cached.has(candidate.key)) return
        const nearest = samplePoints.reduce((best, sample) => climateDistanceSquared(candidate, sample) < climateDistanceSquared(candidate, best) ? sample : best)
        representativeByLocation.set(candidate.key, nearest.key)
      })
    }

    const fetched = new Map((await fetchMonthlyClimateBatch([...representatives.values()])).map(result => [result.key, result]))
    for (const [key, item] of unique) {
      if (cached.has(key)) continue
      const representativeKey = representativeByLocation.get(key)
      const result = representativeKey ? fetched.get(representativeKey) : undefined
      item.keys.forEach(locationKey => results.set(locationKey, result?.months ? { months: result.months } : { error: result?.error || 'Climate history unavailable for this destination' }))
    }
  }
  return locations.map(({ key }) => ({ key, ...(results.get(key) ?? { error: 'Invalid coordinates' }) }))
}

export function getMonthlyClimateBatch(locations: Array<{ key: string; lat: number; lng: number }>, ensureCountrySamples = false) {
  const requestKey = JSON.stringify([ensureCountrySamples, locations.map(({ key, lat, lng }) => [key, climateCacheKey(lat, lng)]).sort(([a], [b]) => String(a).localeCompare(String(b)))])
  const existing = monthlyClimateBatchInFlight.get(requestKey)
  if (existing) return existing
  const request = loadMonthlyClimateBatch(locations, ensureCountrySamples)
  monthlyClimateBatchInFlight.set(requestKey, request)
  void request.finally(() => { if (monthlyClimateBatchInFlight.get(requestKey) === request) monthlyClimateBatchInFlight.delete(requestKey) })
  return request
}

export function scheduleMonthlyClimateWarm(locations: Array<{ lat?: number | null; lng?: number | null }>): void {
  if (process.env.TREK_E2E === '1') return
  for (const { lat, lng } of locations) {
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    const gridLat = Math.round(lat / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES
    const gridLng = Math.round(lng / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES
    const key = climateCacheKey(gridLat, gridLng)
    climateWarmQueue.set(key, { key, lat: gridLat, lng: gridLng })
  }
  if (!climateWarmQueue.size) return
  const state = db.prepare('SELECT next_allowed_at, last_error_at FROM seasonal_provider_state WHERE provider = ?').get('open-meteo') as { next_allowed_at: number; last_error_at: number } | undefined
  const cooldown = state?.last_error_at ? Math.max(0, state.next_allowed_at - Date.now()) : 0
  scheduleClimateWarm(Math.max(50, cooldown))
}

/** Rolling two-year ERA5 monthly averages, kept separate from forecast/cache semantics. */
export async function getMonthlyClimate(lat: number, lng: number): Promise<MonthlyClimate[]> {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new ApiError(400, 'Invalid coordinates')
  const key = climateCacheKey(lat, lng)
  const cached = getCachedMonthlyClimate(key)
  if (cached) return cached
  const pending = monthlyClimateInFlight.get(key)
  if (pending) return pending
  const gridLat = Math.round(lat / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES
  const gridLng = Math.round(lng / MONTHLY_CLIMATE_GRID_DEGREES) * MONTHLY_CLIMATE_GRID_DEGREES
  const request = (async () => {
    const result = (await getMonthlyClimateBatch([{ key, lat: gridLat, lng: gridLng }]))[0]
    if (result?.months) return result.months
    const message = result?.error || 'Climate history unavailable'
    throw new ApiError(/rate limit|daily request budget|cooling down/i.test(message) ? 429 : 503, message)
  })()
  monthlyClimateInFlight.set(key, request)
  try { return await request }
  finally { if (monthlyClimateInFlight.get(key) === request) monthlyClimateInFlight.delete(key) }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of weatherCache) {
    if (now > entry.expiresAt) weatherCache.delete(key);
  }
  if (weatherCache.size > CACHE_MAX_ENTRIES) {
    const entries = [...weatherCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toDelete = entries.slice(0, entries.length - CACHE_PRUNE_TARGET);
    toDelete.forEach(([key]) => weatherCache.delete(key));
  }
}, CACHE_CLEANUP_INTERVAL);

const TTL_FORECAST_MS = 60 * 60 * 1000;      // 1 hour
const TTL_CURRENT_MS  = 15 * 60 * 1000;      // 15 minutes
const TTL_CLIMATE_MS  = 24 * 60 * 60 * 1000; // 24 hours

export function cacheKey(lat: string, lng: string, date?: string): string {
  const rlat = parseFloat(lat).toFixed(2);
  const rlng = parseFloat(lng).toFixed(2);
  return `${rlat}_${rlng}_${date || 'current'}`;
}

function getCached(key: string): WeatherResult | null {
  const entry = weatherCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    weatherCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: WeatherResult, ttlMs: number): void {
  weatherCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function estimateCondition(tempAvg: number, precipMm: number): string {
  if (precipMm > 5) return tempAvg <= 0 ? 'Snow' : 'Rain';
  if (precipMm > 1) return tempAvg <= 0 ? 'Snow' : 'Drizzle';
  if (precipMm > 0.3) return 'Clouds';
  return tempAvg > 15 ? 'Clear' : 'Clouds';
}

// ── getWeather ──────────────────────────────────────────────────────────

async function _getWeatherImpl(
  lat: string,
  lng: string,
  date: string | undefined,
  lang: string,
): Promise<WeatherResult> {
  const ck = cacheKey(lat, lng, date);

  if (date) {
    const cached = getCached(ck);
    if (cached) return cached;

    const targetDate = new Date(date);
    const now = new Date();
    const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Forecast range (-1 .. +16 days)
    if (diffDays >= -1 && diffDays <= 16) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=16`;
      const response = await fetchOpenMeteo(url);
      const data = await response.json() as OpenMeteoForecast;

      if (!response.ok || data.error) {
        throw new ApiError(response.status || 500, data.reason || 'Open-Meteo API error');
      }

      const dateStr = targetDate.toISOString().slice(0, 10);
      const idx = (data.daily?.time || []).indexOf(dateStr);

      if (idx !== -1) {
        const code = data.daily!.weathercode[idx];
        const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

        const result: WeatherResult = {
          temp: Math.round((data.daily!.temperature_2m_max[idx] + data.daily!.temperature_2m_min[idx]) / 2),
          temp_max: Math.round(data.daily!.temperature_2m_max[idx]),
          temp_min: Math.round(data.daily!.temperature_2m_min[idx]),
          main: WMO_MAP[code] || 'Clouds',
          description: descriptions[code] || '',
          type: 'forecast',
        };

        setCache(ck, result, TTL_FORECAST_MS);
        return result;
      }
    }

    // Past date: use archive API for the actual date
    if (diffDays < -1) {
      const dateStr = targetDate.toISOString().slice(0, 10);
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&timezone=auto`;
      const response = await fetchOpenMeteo(url);
      const data = await response.json() as OpenMeteoForecast;

      if (!response.ok || data.error) {
        throw new ApiError(response.status || 500, data.reason || 'Open-Meteo Archive API error');
      }

      const daily = data.daily;
      if (daily && daily.time && daily.time.length > 0 && daily.temperature_2m_max[0] != null) {
        const code = daily.weathercode?.[0];
        const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;
        const tMax = daily.temperature_2m_max[0];
        const tMin = daily.temperature_2m_min[0];
        const result: WeatherResult = {
          temp: Math.round((tMax + tMin) / 2),
          temp_max: Math.round(tMax),
          temp_min: Math.round(tMin),
          main: WMO_MAP[code!] || estimateCondition((tMax + tMin) / 2, daily.precipitation_sum?.[0] || 0),
          description: descriptions[code!] || '',
          type: 'forecast',
        };
        setCache(ck, result, TTL_CLIMATE_MS);
        return result;
      }
      return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
    }

    // Climate / archive fallback (far-future dates)
    if (diffDays > -1) {
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      let refYear = targetDate.getFullYear() - 1;
      // Archive API only has data up to yesterday — go back further if needed
      const yesterday = new Date(now.getTime() - 86400000);
      if (new Date(refYear, month - 1, day + 2) > yesterday) refYear--;
      const startDate = new Date(refYear, month - 1, day - 2);
      const endDate = new Date(refYear, month - 1, day + 2);
      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
      const response = await fetchOpenMeteo(url);
      const data = await response.json() as OpenMeteoForecast;

      if (!response.ok || data.error) {
        throw new ApiError(response.status || 500, data.reason || 'Open-Meteo Climate API error');
      }

      const daily = data.daily;
      if (!daily || !daily.time || daily.time.length === 0) {
        return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
      }

      let sumMax = 0, sumMin = 0, sumPrecip = 0, count = 0;
      for (let i = 0; i < daily.time.length; i++) {
        if (daily.temperature_2m_max[i] != null && daily.temperature_2m_min[i] != null) {
          sumMax += daily.temperature_2m_max[i];
          sumMin += daily.temperature_2m_min[i];
          sumPrecip += daily.precipitation_sum![i] || 0;
          count++;
        }
      }

      if (count === 0) {
        return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
      }

      const avgMax = sumMax / count;
      const avgMin = sumMin / count;
      const avgTemp = (avgMax + avgMin) / 2;
      const avgPrecip = sumPrecip / count;
      const main = estimateCondition(avgTemp, avgPrecip);

      const result: WeatherResult = {
        temp: Math.round(avgTemp),
        temp_max: Math.round(avgMax),
        temp_min: Math.round(avgMin),
        main,
        description: '',
        type: 'climate',
      };

      setCache(ck, result, TTL_CLIMATE_MS);
      return result;
    }

    return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
  }

  // No date supplied -> current weather
  const cached = getCached(ck);
  if (cached) return cached;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode&timezone=auto`;
  const response = await fetchOpenMeteo(url);
  let data: OpenMeteoForecast;
  try { data = await response.json() as OpenMeteoForecast }
  catch { throw new ApiError(502, 'Open-Meteo returned invalid weather data') }

  if (!response.ok || data.error) {
    throw new ApiError(response.status || 500, data.reason || 'Open-Meteo API error');
  }

  if (!data.current || !Number.isFinite(data.current.temperature_2m) || !Number.isFinite(data.current.weathercode)) {
    throw new ApiError(502, 'Open-Meteo returned incomplete current weather data')
  }
  const code = data.current.weathercode;
  const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

  const result: WeatherResult = {
    temp: Math.round(data.current.temperature_2m),
    main: WMO_MAP[code] || 'Clouds',
    description: descriptions[code] || '',
    type: 'current',
  };

  setCache(ck, result, TTL_CURRENT_MS);
  return result;
}

export async function getWeather(
  lat: string,
  lng: string,
  date: string | undefined,
  lang: string,
): Promise<WeatherResult> {
  const ck = cacheKey(lat, lng, date);
  const cached = getCached(ck);
  if (cached) return cached;

  const inFlightKey = `${ck}:${lang}`;
  const existing = inFlight.get(inFlightKey);
  if (existing) return existing;
  const promise = _getWeatherImpl(lat, lng, date, lang);
  inFlight.set(inFlightKey, promise);
  try { return await promise; } finally { inFlight.delete(inFlightKey); }
}

// ── getDetailedWeather ──────────────────────────────────────────────────

async function _getDetailedWeatherImpl(
  lat: string,
  lng: string,
  date: string,
  lang: string,
): Promise<WeatherResult> {
  const ck = `detailed_${cacheKey(lat, lng, date)}`;

  const cached = getCached(ck);
  if (cached) return cached;

  const targetDate = new Date(date);
  const now = new Date();
  const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const dateStr = targetDate.toISOString().slice(0, 10);
  const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

  // Climate / archive path (> 16 days out)
  if (diffDays > 16) {
    let refYear = targetDate.getFullYear() - 1;
    // Archive API only has data up to yesterday — go back further if needed
    const yesterday = new Date(now.getTime() - 86400000);
    if (new Date(refYear, targetDate.getMonth(), targetDate.getDate()) > yesterday) refYear--;
    const refDateStr = `${refYear}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}`
      + `&start_date=${refDateStr}&end_date=${refDateStr}`
      + `&hourly=temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m`
      + `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max,sunrise,sunset`
      + `&timezone=auto`;
    const response = await fetchOpenMeteo(url);
    const data = await response.json() as OpenMeteoForecast;

    if (!response.ok || data.error) {
      throw new ApiError(response.status || 500, data.reason || 'Open-Meteo Climate API error');
    }

    const daily = data.daily;
    const hourly = data.hourly;
    if (!daily || !daily.time || daily.time.length === 0) {
      return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
    }

    const idx = 0;
    const code = daily.weathercode?.[idx];
    const avgMax = daily.temperature_2m_max[idx];
    const avgMin = daily.temperature_2m_min[idx];

    const hourlyData: HourlyEntry[] = [];
    if (hourly?.time) {
      for (let i = 0; i < hourly.time.length; i++) {
        const hour = new Date(hourly.time[i]).getHours();
        const hCode = hourly.weathercode?.[i];
        hourlyData.push({
          hour,
          temp: Math.round(hourly.temperature_2m[i]),
          precipitation: hourly.precipitation?.[i] || 0,
          precipitation_probability: 0,
          main: WMO_MAP[hCode!] || 'Clouds',
          wind: Math.round(hourly.windspeed_10m?.[i] || 0),
          humidity: hourly.relativehumidity_2m?.[i] || 0,
        });
      }
    }

    let sunrise: string | null = null, sunset: string | null = null;
    if (daily.sunrise?.[idx]) sunrise = daily.sunrise[idx].split('T')[1]?.slice(0, 5);
    if (daily.sunset?.[idx]) sunset = daily.sunset[idx].split('T')[1]?.slice(0, 5);

    const result: WeatherResult = {
      type: 'climate',
      temp: Math.round((avgMax + avgMin) / 2),
      temp_max: Math.round(avgMax),
      temp_min: Math.round(avgMin),
      main: WMO_MAP[code!] || estimateCondition((avgMax + avgMin) / 2, daily.precipitation_sum?.[idx] || 0),
      description: descriptions[code!] || '',
      precipitation_sum: Math.round((daily.precipitation_sum?.[idx] || 0) * 10) / 10,
      wind_max: Math.round(daily.windspeed_10m_max?.[idx] || 0),
      sunrise,
      sunset,
      hourly: hourlyData,
    };

    setCache(ck, result, TTL_CLIMATE_MS);
    return result;
  }

  // Forecast path (<= 16 days)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
    + `&hourly=temperature_2m,precipitation_probability,precipitation,weathercode,windspeed_10m,relativehumidity_2m`
    + `&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,precipitation_probability_max,precipitation_sum,windspeed_10m_max`
    + `&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

  const response = await fetchOpenMeteo(url);
  const data = await response.json() as OpenMeteoForecast;

  if (!response.ok || data.error) {
    throw new ApiError(response.status || 500, data.reason || 'Open-Meteo API error');
  }

  const daily = data.daily;
  const hourly = data.hourly;

  if (!daily || !daily.time || daily.time.length === 0) {
    return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
  }

  const dayIdx = 0;
  const code = daily.weathercode[dayIdx];

  const formatTime = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const hourlyData: HourlyEntry[] = [];
  if (hourly && hourly.time) {
    for (let i = 0; i < hourly.time.length; i++) {
      const h = new Date(hourly.time[i]).getHours();
      hourlyData.push({
        hour: h,
        temp: Math.round(hourly.temperature_2m[i]),
        precipitation_probability: hourly.precipitation_probability![i] || 0,
        precipitation: hourly.precipitation![i] || 0,
        main: WMO_MAP[hourly.weathercode![i]] || 'Clouds',
        wind: Math.round(hourly.windspeed_10m![i] || 0),
        humidity: Math.round(hourly.relativehumidity_2m![i] || 0),
      });
    }
  }

  const result: WeatherResult = {
    type: 'forecast',
    temp: Math.round((daily.temperature_2m_max[dayIdx] + daily.temperature_2m_min[dayIdx]) / 2),
    temp_max: Math.round(daily.temperature_2m_max[dayIdx]),
    temp_min: Math.round(daily.temperature_2m_min[dayIdx]),
    main: WMO_MAP[code] || 'Clouds',
    description: descriptions[code] || '',
    sunrise: formatTime(daily.sunrise![dayIdx]),
    sunset: formatTime(daily.sunset![dayIdx]),
    precipitation_sum: daily.precipitation_sum![dayIdx] || 0,
    precipitation_probability_max: daily.precipitation_probability_max![dayIdx] || 0,
    wind_max: Math.round(daily.windspeed_10m_max![dayIdx] || 0),
    hourly: hourlyData,
  };

  setCache(ck, result, TTL_FORECAST_MS);
  return result;
}

export async function getDetailedWeather(
  lat: string,
  lng: string,
  date: string,
  lang: string,
): Promise<WeatherResult> {
  const ck = `detailed_${cacheKey(lat, lng, date)}`;
  const cached = getCached(ck);
  if (cached) return cached;

  const inFlightKey = `${ck}:${lang}`;
  const existing = inFlight.get(inFlightKey);
  if (existing) return existing;
  const promise = _getDetailedWeatherImpl(lat, lng, date, lang);
  inFlight.set(inFlightKey, promise);
  try { return await promise; } finally { inFlight.delete(inFlightKey); }
}

// ── ApiError ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
