import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/db/database';
import { searchTrip } from '../../../src/services/tripSearchService';

describe('tripSearchService', () => {
  let tripId: number;
  let userId: number;

  beforeEach(() => {
    // Minimal fixtures — reuse the shared test DB helpers if present; otherwise
    // insert directly into the in-memory / test SQLite used by the suite.
    const user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number } | undefined;
    if (!user) {
      userId = Number(db.prepare(
        "INSERT INTO users (username, email, password_hash) VALUES ('search-user', 'search@trek.local', 'x')"
      ).run().lastInsertRowid);
    } else {
      userId = user.id;
    }
    tripId = Number(db.prepare(
      'INSERT INTO trips (user_id, title, currency) VALUES (?, ?, ?)'
    ).run(userId, 'Search Trip', 'EUR').lastInsertRowid);

    const dayId = Number(db.prepare(
      'INSERT INTO days (trip_id, day_number, date, title, notes) VALUES (?, 1, ?, ?, ?)'
    ).run(tripId, '2026-07-01', 'Arrival', 'Land in Tokyo').lastInsertRowid);

    const placeId = Number(db.prepare(
      'INSERT INTO places (trip_id, name, address, lat, lng) VALUES (?, ?, ?, ?, ?)'
    ).run(tripId, 'Senso-ji Temple', 'Asakusa, Tokyo', 35.71, 139.79).lastInsertRowid);

    db.prepare(
      'INSERT INTO day_assignments (day_id, place_id, order_index) VALUES (?, ?, 0)'
    ).run(dayId, placeId);

    db.prepare(
      'INSERT INTO day_notes (trip_id, day_id, text) VALUES (?, ?, ?)'
    ).run(tripId, dayId, 'Buy goshuin book at the temple');

    db.prepare(
      `INSERT INTO reservations (trip_id, day_id, title, type, location, confirmation_number)
       VALUES (?, ?, ?, 'hotel', ?, ?)`
    ).run(tripId, dayId, 'Asakusa Hotel', 'Asakusa', 'CONF-TOKYO-1');
  });

  it('finds places, days, notes, and reservations by substring', () => {
    const byPlace = searchTrip(tripId, 'senso');
    expect(byPlace.some(r => r.type === 'place' && r.title.includes('Senso'))).toBe(true);

    const byDay = searchTrip(tripId, 'arrival');
    expect(byDay.some(r => r.type === 'day')).toBe(true);

    const byNote = searchTrip(tripId, 'goshuin');
    expect(byNote.some(r => r.type === 'note')).toBe(true);

    const byRes = searchTrip(tripId, 'CONF-TOKYO');
    expect(byRes.some(r => r.type === 'reservation')).toBe(true);
  });

  it('returns empty for blank query', () => {
    expect(searchTrip(tripId, '   ')).toEqual([]);
  });
});
