import { db } from '../../db/database';
import { decrypt_api_key, encrypt_api_key } from '../apiKeyCrypto';
import { verifyTripAccess } from '../tripAccess';
import { authenticate, BeliError, discover, snapshot, type BeliSnapshot } from './client';
import { rankSuggestions } from './ranking';
import type { BeliRecommendations, BeliSearch, BeliStatus, BeliCredentials } from '@trek/shared';

import { randomUUID } from 'node:crypto';

interface Connection {
  user_id: number;
  generation: string;
  identity: string | null;
  refresh_cipher: string | null;
  snapshot_cipher: string | null;
  synced_at: string | null;
  rated_count: number;
  prediction_count: number;
  state: BeliStatus['state'];
}
const running = new Set<number>();
const cooldowns = new Map<number, number>();
function row(userId: number) {
  return db.prepare('SELECT * FROM beli_connections WHERE user_id = ?').get(userId) as Connection | undefined;
}
function current(userId: number, generation: string) {
  const connection = row(userId);
  if (!connection || connection.generation !== generation)
    throw new BeliError(409, 'Beli connection changed. Retry your request.');
  return connection;
}
function decrypt(cipher: string | null): string {
  if (!cipher?.startsWith('enc:v1:')) throw new BeliError(409, 'Reconnect your Beli account.');
  const value = decrypt_api_key(cipher);
  if (!value) throw new BeliError(409, 'Reconnect your Beli account.');
  return value;
}
export function getBeliStatus(userId: number): BeliStatus {
  const c = row(userId);
  return {
    connected: !!c?.refresh_cipher,
    state: c?.state ?? 'disconnected',
    syncedAt: c?.synced_at ?? null,
    ratedCount: c?.rated_count ?? 0,
    predictionCount: c?.prediction_count ?? 0,
  };
}
async function exclusive<T>(userId: number, task: () => Promise<T>): Promise<T> {
  if (running.has(userId)) throw new BeliError(409, 'A Beli request is already running.');
  if ((cooldowns.get(userId) ?? 0) > Date.now())
    throw new BeliError(429, 'Beli request limit reached. Try again later.');
  running.add(userId);
  const generation = row(userId)?.generation;
  try {
    return await task();
  } catch (error) {
    if (error instanceof BeliError && error.status === 429) {
      for (const [id, until] of cooldowns) if (until <= Date.now()) cooldowns.delete(id);
      if (cooldowns.size < 1000) cooldowns.set(userId, Date.now() + 60_000);
    }
    if (generation && row(userId)?.generation === generation)
      db.prepare('UPDATE beli_connections SET state = ? WHERE user_id = ? AND generation = ?').run(
        error instanceof BeliError && error.status === 409 ? 'reconnect' : 'error',
        userId,
        generation,
      );
    if (error instanceof BeliError) throw error;
    throw new BeliError(502);
  } finally {
    running.delete(userId);
  }
}
async function access(userId: number, c: Connection) {
  const auth = await authenticate({ refresh: decrypt(c.refresh_cipher) });
  current(userId, c.generation);
  if (auth.identity !== c.identity || !auth.refresh) throw new BeliError(409, 'Reconnect your Beli account.');
  db.prepare('UPDATE beli_connections SET refresh_cipher = ? WHERE user_id = ? AND generation = ?').run(
    encrypt_api_key(auth.refresh),
    userId,
    c.generation,
  );
  return auth.access;
}
async function syncWithAccess(userId: number, c: Connection, token: string) {
  db.prepare("UPDATE beli_connections SET state = 'syncing' WHERE user_id = ? AND generation = ?").run(
    userId,
    c.generation,
  );
  const data = await snapshot(token, c.identity!);
  current(userId, c.generation);
  db.prepare(
    "UPDATE beli_connections SET snapshot_cipher = ?, synced_at = ?, rated_count = ?, prediction_count = ?, state = 'connected' WHERE user_id = ? AND generation = ?",
  ).run(
    encrypt_api_key(JSON.stringify(data)),
    data.syncedAt,
    data.ratings.length,
    data.predictions.length,
    userId,
    c.generation,
  );
  return getBeliStatus(userId);
}
async function connect(
  userId: number,
  signIn: () => ReturnType<typeof authenticate>,
  onRotated?: (refresh: string) => void,
) {
  return exclusive(userId, async () => {
    const generation = randomUUID();
    db.prepare(
      "INSERT INTO beli_connections (user_id, generation) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET generation = excluded.generation, state = 'syncing'",
    ).run(userId, generation);
    try {
      const auth = await signIn();
      current(userId, generation);
      if (!auth.refresh) throw new BeliError(502);
      const previous = current(userId, generation);
      if (previous.identity === auth.identity) {
        db.prepare('UPDATE beli_connections SET refresh_cipher = ? WHERE user_id = ? AND generation = ?').run(
          encrypt_api_key(auth.refresh),
          userId,
          generation,
        );
      } else {
        db.prepare(
          'UPDATE beli_connections SET identity = ?, refresh_cipher = ?, snapshot_cipher = NULL, synced_at = NULL, rated_count = 0, prediction_count = 0 WHERE user_id = ? AND generation = ?',
        ).run(auth.identity, encrypt_api_key(auth.refresh), userId, generation);
      }
      onRotated?.(auth.refresh);
      return await syncWithAccess(userId, current(userId, generation), auth.access);
    } catch (error) {
      db.prepare('UPDATE beli_connections SET state = ? WHERE user_id = ? AND generation = ?').run(
        error instanceof BeliError && error.status === 409 ? 'reconnect' : 'error',
        userId,
        generation,
      );
      throw error;
    }
  });
}
export function connectBeli(userId: number, credentials: BeliCredentials) {
  return connect(userId, () => authenticate(credentials));
}
/** Local CLI only; never exposed as a browser token-import endpoint. */
export function connectBeliFromKeychain(userId: number, refresh: string, saveRotated: (refresh: string) => void) {
  return connect(userId, () => authenticate({ refresh }), saveRotated);
}
export async function syncBeli(userId: number) {
  return exclusive(userId, async () => {
    const c = row(userId);
    if (!c?.refresh_cipher) throw new BeliError(409, 'Connect your Beli account first.');
    return syncWithAccess(userId, c, await access(userId, c));
  });
}
export function disconnectBeli(userId: number) {
  db.prepare('DELETE FROM beli_connections WHERE user_id = ?').run(userId);
  cooldowns.delete(userId);
  return getBeliStatus(userId);
}
export async function recommendBeli(userId: number, query: BeliSearch): Promise<BeliRecommendations> {
  if (!verifyTripAccess(query.tripId, userId)) throw new BeliError(404, 'Trip not found.');
  const origin = db
    .prepare('SELECT name, lat, lng FROM places WHERE id = ? AND trip_id = ?')
    .get(query.placeId, query.tripId) as { name: string; lat: number | null; lng: number | null } | undefined;
  if (
    !origin ||
    origin.lat === null ||
    origin.lng === null ||
    !Number.isFinite(origin.lat) ||
    !Number.isFinite(origin.lng)
  )
    throw new BeliError(400, 'Choose a trip place with coordinates.');
  return exclusive(userId, async () => {
    const c = row(userId);
    if (!c?.snapshot_cipher) throw new BeliError(409, 'Connect and sync your Beli account first.');
    const data = JSON.parse(decrypt(c.snapshot_cipher)) as BeliSnapshot;
    const places = await discover(await access(userId, c), c.identity!, query.category, origin.lat!, origin.lng!);
    current(userId, c.generation);
    if (!verifyTripAccess(query.tripId, userId)) throw new BeliError(404, 'Trip not found.');
    return {
      origin: origin as { name: string; lat: number; lng: number },
      syncedAt: data.syncedAt,
      discoveredAt: new Date().toISOString(),
      stale: Date.now() - Date.parse(data.syncedAt) > 24 * 3600_000,
      ...rankSuggestions(data, places, query.category, origin as { lat: number; lng: number }, query.radiusKm),
    };
  });
}
