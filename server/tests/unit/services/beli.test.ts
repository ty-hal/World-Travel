import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../src/db/database';
import { decrypt_api_key } from '../../../src/services/apiKeyCrypto';
import { rankSuggestions } from '../../../src/services/beli/ranking';
import type { BeliBusiness, BeliSnapshot } from '../../../src/services/beli/client';
import { authenticate, BeliError, discover, snapshot } from '../../../src/services/beli/client';
import { connectBeli, disconnectBeli, getBeliStatus, recommendBeli, syncBeli } from '../../../src/services/beli/service';

vi.mock('../../../src/services/beli/client', async importOriginal => ({ ...await importOriginal<object>(), authenticate: vi.fn(), snapshot: vi.fn(), discover: vi.fn() }));
const identity = '00000000-0000-4000-8000-000000000001';
const origin = { lat: 41.89, lng: -87.63 };
const business = (id: number, fields: Partial<BeliBusiness> = {}): BeliBusiness => ({ id, name: `Synthetic ${id}`, ...origin, cuisines: ['Italian'], status: 'OPERATIONAL', ...fields });
const data = (): BeliSnapshot => ({ ratings: [1, 2, 3].map(id => ({ business: business(id), category: 'RES', score: 10 })), bookmarks: [6], predictions: [{ business_id: 5, expected_percentile: 8 }], syncedAt: new Date().toISOString() });
let user: number;
let other: number;
let trip: number;
let place: number;

beforeEach(() => {
  vi.resetAllMocks();
  db.prepare('DELETE FROM beli_connections').run();
  user = Number(db.prepare('INSERT INTO users(username,email,password_hash) VALUES (?,?,?)').run(crypto.randomUUID(), `${crypto.randomUUID()}@example.test`, 'fake').lastInsertRowid);
  other = Number(db.prepare('INSERT INTO users(username,email,password_hash) VALUES (?,?,?)').run(crypto.randomUUID(), `${crypto.randomUUID()}@example.test`, 'fake').lastInsertRowid);
  trip = Number(db.prepare('INSERT INTO trips(user_id,title) VALUES (?,?)').run(user, 'Synthetic').lastInsertRowid);
  place = Number(db.prepare('INSERT INTO places(trip_id,name,lat,lng) VALUES (?,?,?,?)').run(trip, 'Origin', origin.lat, origin.lng).lastInsertRowid);
  vi.mocked(authenticate).mockResolvedValue({ access: 'fake-access', refresh: 'fake-refresh', identity });
  vi.mocked(snapshot).mockResolvedValue(data());
  vi.mocked(discover).mockResolvedValue([business(5), business(6)]);
});

describe('Beli private connection', () => {
  it('keeps a complete snapshot when reconnecting the same account but the new sync fails', async () => {
    await connectBeli(user, { email: 'a@example.test', password: 'fake' });
    const before = db.prepare('SELECT snapshot_cipher FROM beli_connections WHERE user_id = ?').get(user);
    vi.mocked(snapshot).mockRejectedValue(new BeliError(502));
    await expect(connectBeli(user, { email: 'a@example.test', password: 'fake' })).rejects.toBeInstanceOf(BeliError);
    expect(db.prepare('SELECT snapshot_cipher FROM beli_connections WHERE user_id = ?').get(user)).toEqual(before);
  });
  it('encrypts token and complete snapshot, never password; status isolates users', async () => {
    await connectBeli(user, { email: 'synthetic@example.test', password: 'fake-password' });
    const stored = db.prepare('SELECT * FROM beli_connections WHERE user_id = ?').get(user) as Record<string, string>;
    expect(stored.refresh_cipher).toMatch(/^enc:v1:/);
    expect(stored.snapshot_cipher).toMatch(/^enc:v1:/);
    expect(decrypt_api_key(stored.refresh_cipher)).toBe('fake-refresh');
    expect(JSON.stringify(stored)).not.toContain('fake-password');
    expect(JSON.stringify(getBeliStatus(user))).not.toMatch(/fake-refresh|fake-access|Synthetic/);
    expect(getBeliStatus(other).connected).toBe(false);
  });
  it('rotates refresh immediately and keeps previous good data on failed sync', async () => {
    await connectBeli(user, { email: 'a@example.test', password: 'fake' });
    const before = db.prepare('SELECT snapshot_cipher FROM beli_connections WHERE user_id = ?').get(user);
    vi.mocked(authenticate).mockResolvedValue({ access: 'new-access', refresh: 'rotated', identity });
    vi.mocked(snapshot).mockRejectedValue(new BeliError(502));
    await expect(syncBeli(user)).rejects.toBeInstanceOf(BeliError);
    expect(db.prepare('SELECT snapshot_cipher FROM beli_connections WHERE user_id = ?').get(user)).toEqual(before);
    const stored = db.prepare('SELECT refresh_cipher FROM beli_connections WHERE user_id = ?').get(user) as { refresh_cipher: string };
    expect(decrypt_api_key(stored.refresh_cipher)).toBe('rotated');
  });
  it('blocks cross-user trip reads before any Beli request', async () => {
    await expect(recommendBeli(other, { tripId: trip, placeId: place, category: 'RES', radiusKm: 2 })).rejects.toMatchObject({ status: 404 });
    expect(authenticate).not.toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();
  });
  it('uses only the acting user snapshot, and disconnect erases it', async () => {
    await connectBeli(user, { email: 'a@example.test', password: 'fake' });
    const result = await recommendBeli(user, { tripId: trip, placeId: place, category: 'RES', radiusKm: 2 });
    expect(result.suggestions.map(s => s.id)).toEqual([6, 5]);
    expect(discover).toHaveBeenCalledWith('fake-access', identity, 'RES', origin.lat, origin.lng);
    disconnectBeli(user);
    expect(getBeliStatus(user).state).toBe('disconnected');
    expect(db.prepare('SELECT * FROM beli_connections WHERE user_id = ?').get(user)).toBeUndefined();
  });
  it('does not resurrect a disconnected account when sync completes', async () => {
    await connectBeli(user, { email: 'a@example.test', password: 'fake' });
    let finish!: (value: BeliSnapshot) => void;
    vi.mocked(snapshot).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = syncBeli(user);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    await expect(syncBeli(user)).rejects.toMatchObject({ status: 409 });
    disconnectBeli(user); finish(data());
    await expect(pending).rejects.toMatchObject({ status: 409 });
    expect(getBeliStatus(user).state).toBe('disconnected');
  });
  it('rejects plaintext tokens and cascades data deletion with the account', async () => {
    db.prepare('INSERT INTO beli_connections(user_id,generation,identity,refresh_cipher) VALUES (?,?,?,?)').run(user, 'fake', identity, 'plaintext');
    await expect(syncBeli(user)).rejects.toMatchObject({ status: 409 });
    expect(authenticate).not.toHaveBeenCalled();
    db.prepare('DELETE FROM places WHERE trip_id = ?').run(trip);
    db.prepare('DELETE FROM trips WHERE id = ?').run(trip);
    db.prepare('DELETE FROM users WHERE id = ?').run(user);
    expect(db.prepare('SELECT * FROM beli_connections WHERE user_id = ?').get(user)).toBeUndefined();
  });
});

describe('Beli ranking', () => {
  it('uses average tied ranks as positive evidence and keeps missing predictions visible', () => {
    const source = data();
    source.ratings.push(...[10, 11].map(id => ({ business: business(id, { cuisines: ['Other'] }), category: 'RES' as const, score: 1 })));
    const rows = [business(6), ...Array.from({ length: 40 }, (_, i) => business(100 + i))];
    source.predictions.push(...rows.slice(1).map(b => ({ business_id: b.id, expected_percentile: 8 })));
    const result = rankSuggestions(source, rows, 'RES', origin, 2);
    expect(result.suggestions.find(r => r.id === 100)).toMatchObject({ evidence: 'both', historyMatches: 3 });
    expect(result.suggestions.some(r => r.prediction === null)).toBe(true);
  });
  it('filters visits, closed and far places, deduplicates aliases and preserves unknown predictions', () => {
    const source = data();
    source.ratings[0].business.place_id = 'visited';
    const result = rankSuggestions(source, [business(1), business(50, { place_id: 'visited' }), business(5, { place_id: 'same' }), business(51, { place_id: 'same' }), business(6), business(7, { status: 'CLOSED_PERMANENTLY' }), business(8, { status: 'CLOSED_TEMPORARILY' }), business(9, { lat: 0 })], 'RES', origin, 2);
    expect(result.total).toBe(2);
    expect(result.suggestions.find(r => r.id === 5)?.prediction).toBe(8);
    expect(result.suggestions.find(r => r.id === 6)).toMatchObject({ prediction: null, evidence: 'history' });
  });
  it('never infers dislikes from absent history and does not mix categories or break ties', () => {
    const source = data();
    source.ratings.push(...[10, 11, 12].map(id => ({ business: business(id), category: 'BAK' as const, score: 10 })));
    const result = rankSuggestions(source, [business(5)], 'DES', origin, 2);
    expect(result.suggestions[0]).toMatchObject({ evidence: 'beli', historyMatches: 0 });
    expect(rankSuggestions(source, [business(5)], 'RES', origin, 2).suggestions[0].historyMatches).toBe(0);
  });
  it('flags conflicting alias predictions rather than choosing the larger one', () => {
    const source = data(); source.predictions.push({ business_id: 55, expected_percentile: 9 });
    const result = rankSuggestions(source, [business(5, { place_id: 'same' }), business(55, { place_id: 'same' })], 'RES', origin, 2);
    expect(result.suggestions[0].prediction).toBeNull();
  });
});
