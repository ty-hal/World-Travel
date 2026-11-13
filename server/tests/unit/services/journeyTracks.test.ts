import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    testDb: db,
    dbMock: {
      db,
      closeDb: () => {},
      reinitialize: () => {},
      canAccessTrip: () => null,
    },
  };
});

vi.mock('../../../src/db/database', () => dbMock);
vi.mock('../../../src/websocket', () => ({ broadcastToUser: vi.fn() }));
vi.mock('../../../src/services/avatarUrl', () => ({ avatarUrl: () => null }));
vi.mock('../../../src/services/memories/photoResolverService', () => ({
  getOrCreateTrekPhoto: vi.fn(),
  getOrCreateLocalTrekPhoto: vi.fn(),
  setTrekPhotoProvider: vi.fn(),
  deleteTrekPhotoIfOrphan: vi.fn(),
}));

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { createPlace, createTrip, createUser } from '../../helpers/factories';
import { resetTestDb } from '../../helpers/test-db';
import { listJourneyTracks } from '../../../src/services/journeyService';

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => resetTestDb(testDb));
afterAll(() => testDb.close());

describe('listJourneyTracks', () => {
  it('returns valid linked GPX routes to journey contributors and hides them from other users', () => {
    const owner = createUser(testDb).user;
    const viewer = createUser(testDb).user;
    const stranger = createUser(testDb).user;
    const trip = createTrip(testDb, owner.id, { start_date: '2026-01-01', end_date: '2026-01-02' });
    const unlinkedTrip = createTrip(testDb, owner.id);
    const route = createPlace(testDb, trip.id, { name: 'Coastal walk' });
    const invalid = createPlace(testDb, trip.id, { name: 'Broken route' });
    const unlinkedRoute = createPlace(testDb, unlinkedTrip.id, { name: 'Private route' });
    const journeyId = Number(testDb.prepare(
      'INSERT INTO journeys (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run(owner.id, 'Coast journey', Date.now(), Date.now()).lastInsertRowid);

    testDb.prepare('INSERT INTO journey_trips (journey_id, trip_id, added_at) VALUES (?, ?, ?)').run(journeyId, trip.id, Date.now());
    testDb.prepare('INSERT INTO journey_contributors (journey_id, user_id, role, added_at) VALUES (?, ?, ?, ?)').run(journeyId, viewer.id, 'viewer', Date.now());
    testDb.prepare('UPDATE places SET route_geometry = ? WHERE id = ?').run(JSON.stringify([[48.1, 2.1, 12], [48.2, 2.2, 13]]), route.id);
    testDb.prepare('UPDATE places SET route_geometry = ? WHERE id = ?').run('{invalid json', invalid.id);
    testDb.prepare('UPDATE places SET route_geometry = ? WHERE id = ?').run(JSON.stringify([[40, -70], [41, -71]]), unlinkedRoute.id);

    expect(listJourneyTracks(journeyId, owner.id)).toEqual([{
      place_id: route.id,
      trip_id: trip.id,
      name: 'Coastal walk',
      color: (testDb.prepare('SELECT color FROM categories WHERE id = ?').get(route.category_id) as { color: string }).color,
      points: [[48.1, 2.1], [48.2, 2.2]],
    }]);
    expect(listJourneyTracks(journeyId, viewer.id)).toHaveLength(1);
    expect(listJourneyTracks(journeyId, stranger.id)).toBeNull();
  });
});
