import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3')
  const db = new Database(':memory:')
  return { testDb: db, dbMock: { db, closeDb: () => {}, reinitialize: () => {} } }
})

vi.mock('../../../src/db/database', () => dbMock)

import { createTables } from '../../../src/db/schema'
import { runMigrations } from '../../../src/db/migrations'
import { createUser } from '../../helpers/factories'
import { getUserTravelTimeline } from '../../../src/services/travelTimelineService'

beforeAll(() => {
  createTables(testDb)
  runMigrations(testDb)
})

afterAll(() => testDb.close())

describe('getUserTravelTimeline', () => {
  it('emits one country milestone using the earliest visit date', () => {
    const { user } = createUser(testDb)
    const insertVisit = testDb.prepare(`
      INSERT INTO atlas_visits (user_id, source_id, country, map_country, first_visited)
      VALUES (?, ?, ?, ?, ?)
    `)
    insertVisit.run(user.id, 'rome-place-1', 'Italy', 'Italy', '2025-06-01')
    insertVisit.run(user.id, 'rome-place-2', 'Italy', 'Italy', '2018-06-01')
    insertVisit.run(user.id, 'madrid-place', 'Spain', 'Spain', '2020-03-01')

    const { items } = getUserTravelTimeline(user.id)
    const milestones = items.filter(item => item.kind === 'country')

    expect(milestones.map(({ id, date, title }) => ({ id, date, title }))).toEqual([
      { id: 'visit-Spain', date: '2020-03-01', title: 'Spain' },
      { id: 'visit-Italy', date: '2018-06-01', title: 'Italy' },
    ])
  })
})
