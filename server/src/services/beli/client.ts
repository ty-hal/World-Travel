import { beliCategorySchema, type BeliCategory, type BeliCredentials } from '@trek/shared';

import { z } from 'zod';

const ONBOARD = 'https://backoffice-service-onboarding-t57o3dxfca-nn.a.run.app';
const API = 'https://backoffice-service-t57o3dxfca-nn.a.run.app';
const RECS = 'https://backoffice-service-recs-t57o3dxfca-nn.a.run.app';
export class BeliError extends Error {
  constructor(
    public readonly status: number,
    message = 'Beli is unavailable. Your previous data was retained.',
    public readonly authFailure?: { phase: 'login' | 'refresh'; upstreamStatus: number; reason: string },
  ) {
    super(message);
  }
}

async function authFailureReason(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return 'unknown';
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) return 'unknown';
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const codes: Record<string, string> = {
      no_active_account: 'account_not_accepted',
      authentication_failed: 'account_not_accepted',
      user_inactive: 'inactive_account',
      user_not_found: 'account_not_found',
      token_not_valid: 'token_rejected',
      invalid_token: 'token_rejected',
      session_expired: 'session_expired',
      permission_denied: 'permission_denied',
      not_authenticated: 'authentication_required',
      throttled: 'rate_limited',
      otp_required: 'verification_required',
      mfa_required: 'verification_required',
    };
    const details: Record<string, string> = {
      'No active account found with the given credentials': 'account_not_accepted',
      'User is inactive': 'inactive_account',
      'Authentication credentials were not provided.': 'authentication_required',
      'You do not have permission to perform this action.': 'permission_denied',
      'Given token not valid for any token type': 'token_rejected',
    };
    const code = typeof body?.code === 'string' ? body.code.trim().toLowerCase() : '';
    if (Object.hasOwn(codes, code)) return codes[code];
    if (typeof body?.detail === 'string' && Object.hasOwn(details, body.detail)) return details[body.detail];
    return 'unknown';
  } catch {
    return 'unknown';
  } finally {
    await reader.cancel().catch(() => {});
  }
}
const businessSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(500),
  place_id: z.string().max(500).nullish(),
  lat: z
    .union([z.number(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().min(-90).max(90)),
  lng: z
    .union([z.number(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().min(-180).max(180)),
  cuisines: z.array(z.string().max(100)).max(100).nullish(),
  price: z.number().min(0).max(4).nullish(),
  status: z.string().max(100).nullish(),
});
export type BeliBusiness = z.infer<typeof businessSchema>;
export interface BeliRating {
  business: BeliBusiness;
  category: BeliCategory;
  score: number;
}
export interface BeliPrediction {
  business_id: number;
  expected_percentile: number;
}
export interface BeliSnapshot {
  ratings: BeliRating[];
  bookmarks: number[];
  predictions: BeliPrediction[];
  syncedAt: string;
}
const ratingSchema = z.object({
  business: businessSchema,
  category: beliCategorySchema,
  score: z.number().min(0).max(10),
});
const predictionSchema = z.object({
  business_id: z.number().int().positive(),
  expected_percentile: z.number().finite(),
});

async function request(
  url: string,
  token?: string,
  body?: unknown,
  phase: 'login' | 'refresh' | 'read' = 'read',
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json',
        Origin: 'capacitor://localhost',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      if (phase !== 'read' && [400, 401, 403, 429].includes(response.status)) {
        const reason = response.status === 429 ? 'rate_limited' : await authFailureReason(response);
        if (response.status === 429) await response.body?.cancel();
        const messages: Record<string, string> = {
          account_not_accepted: 'Beli reports no active account for this sign-in.',
          inactive_account: 'Beli reports that this account is inactive.',
          account_not_found: 'Beli could not find this account.',
          session_expired: phase === 'login'
            ? 'Beli reports “session expired” during sign-in. Check sign-in in the Beli app.'
            : 'Beli rejected the saved session. Sign in again.',
          token_rejected:
            phase === 'login'
              ? 'Beli rejected authentication before sign-in could complete.'
              : 'Beli rejected the saved session. Sign in again.',
          permission_denied: 'Beli blocked this sign-in request.',
          authentication_required: 'Beli requires additional authentication for this request.',
          verification_required: 'Beli requires account verification.',
          rate_limited: 'Beli is limiting sign-in attempts. Try later.',
        };
        throw new BeliError(
          response.status === 429 ? 429 : phase === 'login' ? 400 : 409,
          messages[reason] ??
            (phase === 'login'
              ? 'Beli rejected this sign-in. Try again later.'
              : 'Beli rejected the saved session. Sign in again.'),
          { phase, upstreamStatus: response.status, reason },
        );
      }
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403)
        throw new BeliError(409, 'Beli could not authorize this data request. Reconnect your account.');
      if (response.status === 429) throw new BeliError(429, 'Beli request limit reached. Try again later.');
      throw new BeliError(502);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new BeliError(502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 20 * 1024 * 1024) {
        await reader.cancel();
        throw new BeliError(502);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof BeliError) throw error;
    throw new BeliError(502);
  }
}

export function tokenIdentity(access: string): string {
  try {
    const claims = JSON.parse(Buffer.from(access.split('.')[1], 'base64url').toString('utf8'));
    return z.uuid().parse(claims.user_id ?? claims.sub);
  } catch {
    throw new BeliError(502);
  }
}
export async function authenticate(body: BeliCredentials | { refresh: string }) {
  const refresh = 'refresh' in body;
  try {
    const result = z
      .object({ access: z.string().min(1), refresh: z.string().min(1).optional() })
      .parse(
        await request(
          `${ONBOARD}/api/token/${refresh ? 'refresh/' : ''}`,
          undefined,
          body,
          refresh ? 'refresh' : 'login',
        ),
      );
    return {
      access: result.access,
      refresh: result.refresh ?? (refresh ? body.refresh : null),
      identity: tokenIdentity(result.access),
    };
  } catch (error) {
    if (error instanceof BeliError && [400, 409, 429].includes(error.status)) throw error;
    throw new BeliError(502, 'Beli sign-in failed. Check your details or try again later.');
  }
}

export async function collection(endpoint: string, access: string): Promise<unknown[]> {
  const base = new URL(API + endpoint);
  if (
    !['/api/get-ranking/', '/api/get-bookmark/'].includes(base.pathname) &&
    !/^\/api\/user-scores\/[0-9a-f-]{36}\/$/.test(base.pathname)
  )
    throw new BeliError(502);
  let next: string | null = base.href;
  const seen = new Set<string>();
  const rows: unknown[] = [];
  while (next) {
    const url = new URL(next, base);
    if (
      url.origin !== API ||
      url.pathname !== base.pathname ||
      url.username ||
      url.password ||
      url.hash ||
      seen.has(url.href) ||
      seen.size >= 100
    )
      throw new BeliError(502);
    seen.add(url.href);
    const page = (await request(url.href, access)) as Record<string, unknown> | unknown[];
    let batch: unknown[];
    if (Array.isArray(page)) batch = page;
    else if (page && Array.isArray(page.results)) batch = page.results;
    else if (base.pathname === '/api/get-bookmark/' && page && Object.values(page).every(Array.isArray))
      batch = Object.values(page).flat();
    else throw new BeliError(502);
    rows.push(...batch);
    if (rows.length > 50_000) throw new BeliError(502);
    const link = !Array.isArray(page) && page.next;
    if (link && typeof link !== 'string') throw new BeliError(502);
    next = typeof link === 'string' ? new URL(link, url).href : null;
  }
  return rows;
}

export async function snapshot(access: string, identity: string): Promise<BeliSnapshot> {
  try {
    const scores = z
      .array(
        z.object({
          category: beliCategorySchema,
          business_id: z.number().int().positive(),
          value: z.number().min(0).max(10),
        }),
      )
      .parse(await collection(`/api/user-scores/${identity}/`, access));
    const categories = new Set<BeliCategory>(['RES', ...scores.map((s) => s.category)]);
    const ratings: BeliRating[] = [];
    const bookmarks: number[] = [];
    for (const category of categories) {
      const query = new URLSearchParams({ user: identity, category });
      const ranked = z.array(ratingSchema).parse(await collection(`/api/get-ranking/?${query}`, access));
      if (ranked.some((r) => r.category !== category)) throw new BeliError(502);
      ratings.push(...ranked);
      const saved = z
        .array(z.object({ business: z.object({ id: z.number().int().positive() }) }))
        .parse(await collection(`/api/get-bookmark/?${query}`, access));
      bookmarks.push(...saved.map((b) => b.business.id));
    }
    const scoreMap = new Map(scores.map((s) => [`${s.category}:${s.business_id}`, s.value]));
    if (
      scoreMap.size !== scores.length ||
      ratings.length !== scores.length ||
      new Set(ratings.map((r) => `${r.category}:${r.business.id}`)).size !== ratings.length ||
      // The scores endpoint rounds to four decimals; ranking scores retain more precision.
      ratings.some((r) => Math.abs(r.score - (scoreMap.get(`${r.category}:${r.business.id}`) ?? -100)) > 0.0001)
    )
      throw new BeliError(502);
    const predictions = z
      .array(predictionSchema)
      .max(100_000)
      .parse(await request(`${RECS}/api/recs/${identity}/`, access));
    return { ratings, bookmarks: [...new Set(bookmarks)], predictions, syncedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof BeliError) throw error;
    throw new BeliError(502);
  }
}

export async function discover(
  access: string,
  identity: string,
  category: BeliCategory,
  lat: number,
  lng: number,
): Promise<BeliBusiness[]> {
  try {
    const data = z.object({ businesses: z.array(z.unknown()).max(20_000) }).parse(
      await request(`${API}/api/filter-list/`, access, {
        filters: [{ key: 'CITY', value: ['Current Location'] }],
        list_field: 'TRENDING',
        user: identity,
        user2: identity,
        category,
        bounds: null,
        sort_method: 'Most Trending',
        coords: `${lat},${lng}`,
        ids: [],
        load_businesses: true,
      }),
    );
    // A single ungeocoded discovery row must not discard the whole search.
    return data.businesses.flatMap((b) => {
      const parsed = businessSchema.safeParse(b);
      return parsed.success ? [parsed.data] : [];
    });
  } catch (error) {
    if (error instanceof BeliError) throw error;
    throw new BeliError(502);
  }
}
