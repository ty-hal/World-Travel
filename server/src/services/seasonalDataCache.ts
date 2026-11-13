import { db } from '../db/database';

const DAILY_LIMITS: Record<string, number> = {
  'nager-date': 40,
  'open-holidays': 2,
  'eurostat-tourism': 12,
  'gisco-nuts2': 2,
  'gisco-country-boundaries': 2,
  'noaa-hurdat2': 2,
  'noaa-hazel': 20,
  'usgs-earthquakes': 2,
  'smithsonian-gvp': 1,
  'tourismapi-seasons': 1,
  'tourismapi-holidays': 1,
};
const MIN_INTERVAL_MS = 5_000;
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
const inFlight = new Map<string, Promise<unknown>>();
const providerQueues = new Map<string, Promise<void>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

type CachedRow = { payload_json: string; expires_at: number };
type ProviderRow = { day: string; request_count: number; next_allowed_at: number; last_error_at: number };
type CachedFailure = { __seasonalError: string };

export function readSeasonalCache<T>(cacheKey: string): T | undefined {
  const row = db.prepare('SELECT payload_json, expires_at FROM seasonal_data_cache WHERE cache_key = ?').get(cacheKey) as CachedRow | undefined;
  if (!row || row.expires_at <= Date.now()) return undefined;
  try { return JSON.parse(row.payload_json) as T; } catch { return undefined; }
}

export function writeSeasonalCache(cacheKey: string, data: unknown, ttlMs: number): void {
  const fetchedAt = Date.now();
  db.prepare(`INSERT INTO seasonal_data_cache (cache_key, payload_json, fetched_at, expires_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json,
    fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`).run(cacheKey, JSON.stringify(data), fetchedAt, fetchedAt + ttlMs);
}

function retryAfterCooldown(provider: string, cacheKey: string, retry: () => void): void {
  const timerKey = `${provider}:${cacheKey}`;
  if (retryTimers.has(timerKey)) return;
  const state = db.prepare('SELECT next_allowed_at FROM seasonal_provider_state WHERE provider = ?').get(provider) as { next_allowed_at: number } | undefined;
  const delayMs = Math.max(MIN_INTERVAL_MS, (state?.next_allowed_at ?? Date.now()) - Date.now());
  const timer = setTimeout(() => {
    retryTimers.delete(timerKey);
    retry();
  }, delayMs);
  (timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
  retryTimers.set(timerKey, timer);
}

export async function getSeasonalData<T>(
  provider: string,
  cacheKey: string,
  ttlMs: number,
  url: string,
  map: (value: unknown) => T,
  responseType: 'json' | 'text' = 'json',
  timeoutMs = 15_000,
  headers: Record<string, string> = {},
): Promise<{ data?: T; error?: string }> {
  const cached = readSeasonalCache<T | CachedFailure>(cacheKey);
  if (cached !== undefined) {
    if (cached && typeof cached === 'object' && '__seasonalError' in cached) return { error: (cached as CachedFailure).__seasonalError };
    return { data: cached as T };
  }
  const existing = inFlight.get(cacheKey);
  if (existing) return existing as Promise<{ data?: T; error?: string }>;

  const request = async (): Promise<{ data?: T; error?: string }> => {
    const spacing = db.prepare('SELECT next_allowed_at, last_error_at FROM seasonal_provider_state WHERE provider = ?').get(provider) as Pick<ProviderRow, 'next_allowed_at' | 'last_error_at'> | undefined;
    if (spacing && !spacing.last_error_at && spacing.next_allowed_at > Date.now()) {
      await new Promise(resolve => setTimeout(resolve, spacing.next_allowed_at - Date.now()));
    }
    const requestAt = Date.now();
    const day = new Date(requestAt).toISOString().slice(0, 10);
    const claim = db.transaction(() => {
      const state = db.prepare('SELECT day, request_count, next_allowed_at, last_error_at FROM seasonal_provider_state WHERE provider = ?').get(provider) as ProviderRow | undefined;
      const count = state?.day === day ? state.request_count : 0;
      if ((state?.next_allowed_at ?? 0) > requestAt) return 'cooldown';
      if (count >= (DAILY_LIMITS[provider] ?? 10)) {
        const now = new Date(requestAt);
        const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
        db.prepare('UPDATE seasonal_provider_state SET next_allowed_at = ?, last_error_at = ? WHERE provider = ?').run(nextDay, requestAt, provider);
        return 'budget';
      }
      db.prepare(`INSERT INTO seasonal_provider_state (provider, day, request_count, next_allowed_at, last_error_at)
        VALUES (?, ?, 1, ?, 0) ON CONFLICT(provider) DO UPDATE SET day = excluded.day,
        request_count = ?, next_allowed_at = excluded.next_allowed_at, last_error_at = 0`).run(provider, day, requestAt + MIN_INTERVAL_MS, count + 1);
      return 'claimed';
    })();
    if (claim !== 'claimed') {
      retryAfterCooldown(provider, cacheKey, () => { void getSeasonalData(provider, cacheKey, ttlMs, url, map, responseType, timeoutMs, headers); });
      return { error: claim === 'budget' ? 'Provider daily request budget reached' : 'Provider temporarily cooling down' };
    }

    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'TREK travel planner (seasonal planning)', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const error = `Provider returned HTTP ${response.status}`;
          writeSeasonalCache(cacheKey, { __seasonalError: error }, 24 * 60 * 60 * 1_000);
          return { error };
        }
        const retryAfter = response.headers.get('retry-after');
        const retryAt = retryAfter && /^\d+$/.test(retryAfter)
          ? Date.now() + Number(retryAfter) * 1_000
          : retryAfter ? Date.parse(retryAfter) : NaN;
        const fallbackMs = response.status === 429 ? 60 * 60 * 1_000 : response.status >= 500 ? 10 * 60 * 1_000 : 6 * 60 * 60 * 1_000;
        const retryMs = Number.isFinite(retryAt) && retryAt > Date.now()
          ? Math.min(MAX_COOLDOWN_MS, Math.max(60_000, retryAt - Date.now()))
          : fallbackMs;
        db.prepare('UPDATE seasonal_provider_state SET next_allowed_at = ?, last_error_at = ? WHERE provider = ?').run(Date.now() + retryMs, Date.now(), provider);
        retryAfterCooldown(provider, cacheKey, () => { void getSeasonalData(provider, cacheKey, ttlMs, url, map, responseType, timeoutMs, headers); });
        return { error: `Provider returned HTTP ${response.status}` };
      }
      const data = map(responseType === 'text' ? await response.text() : await response.json());
      writeSeasonalCache(cacheKey, data, ttlMs);
      return { data };
    } catch {
      const failedAt = Date.now();
      db.prepare('UPDATE seasonal_provider_state SET next_allowed_at = ?, last_error_at = ? WHERE provider = ?').run(failedAt + 10 * 60 * 1_000, failedAt, provider);
      retryAfterCooldown(provider, cacheKey, () => { void getSeasonalData(provider, cacheKey, ttlMs, url, map, responseType, timeoutMs, headers); });
      return { error: 'Provider request failed; retry deferred' };
    }
  };
  const prior = providerQueues.get(provider) ?? Promise.resolve();
  const pending = prior.then(request, request);
  providerQueues.set(provider, pending.then(() => undefined, () => undefined));
  inFlight.set(cacheKey, pending);
  try { return await pending; } finally { inFlight.delete(cacheKey); }
}
