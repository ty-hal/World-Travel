import { describe, expect, it } from 'vitest'
import {
  applyTripOrder,
  moveTripId,
  sortCompletedTrips,
  sortTripsByPriority,
  tripDurationDays,
  type DashboardTrip,
} from './dashboardModel'

function trip(partial: Partial<DashboardTrip> & { id: number; title: string }): DashboardTrip {
  return {
    user_id: 1,
    currency: 'EUR',
    is_archived: 0,
    reminder_days: 3,
    ...partial,
  } as DashboardTrip
}

describe('dashboardModel trip ordering', () => {
  it('sorts planned trips by sort_order then date', () => {
    const trips = [
      trip({ id: 1, title: 'B', start_date: '2027-06-01', end_date: '2027-06-10', sort_order: 2 }),
      trip({ id: 2, title: 'A', start_date: '2027-04-01', end_date: '2027-04-10', sort_order: 0 }),
      trip({ id: 3, title: 'C', start_date: '2027-05-01', end_date: '2027-05-10', sort_order: 1 }),
    ]
    expect(sortTripsByPriority(trips).map(t => t.id)).toEqual([2, 3, 1])
  })

  it('applies a new order and stamps sort_order', () => {
    const trips = [
      trip({ id: 1, title: 'One', sort_order: 0 }),
      trip({ id: 2, title: 'Two', sort_order: 1 }),
      trip({ id: 3, title: 'Three', sort_order: 2 }),
    ]
    const next = applyTripOrder(trips, [3, 1, 2])
    expect(next.map(t => t.id)).toEqual([3, 1, 2])
    expect(next.map(t => t.sort_order)).toEqual([0, 1, 2])
  })

  it('moves ids within a list', () => {
    expect(moveTripId([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveTripId([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
    expect(moveTripId([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
  })

  it('sorts completed trips by duration and places', () => {
    const trips = [
      trip({ id: 1, title: 'Short', start_date: '2024-01-01', end_date: '2024-01-03', day_count: 3, place_count: 10 }),
      trip({ id: 2, title: 'Long', start_date: '2023-01-01', end_date: '2023-01-20', day_count: 20, place_count: 4 }),
    ]
    expect(sortCompletedTrips(trips, 'duration-desc').map(t => t.id)).toEqual([2, 1])
    expect(sortCompletedTrips(trips, 'places-asc').map(t => t.id)).toEqual([2, 1])
    expect(sortCompletedTrips(trips, 'date-asc').map(t => t.id)).toEqual([2, 1])
  })

  it('treats zero day_count as shortest even when calendar dates span longer', () => {
    const trips = [
      trip({ id: 1, title: 'Empty', start_date: '2020-01-01', end_date: '2020-12-31', day_count: 0, place_count: 0 }),
      trip({ id: 2, title: 'Week', start_date: '2024-01-01', end_date: '2024-01-07', day_count: 7, place_count: 3 }),
      trip({ id: 3, title: 'NoDays', day_count: 0, place_count: 0 }),
    ]
    expect(tripDurationDays(trips[0])).toBe(0)
    expect(sortCompletedTrips(trips, 'duration-desc').map(t => t.id)).toEqual([2, 1, 3])
    expect(sortCompletedTrips(trips, 'duration-asc').map(t => t.id)).toEqual([1, 3, 2])
  })

  it('computes duration from dates when day_count is missing', () => {
    expect(tripDurationDays(trip({
      id: 1, title: 'X', start_date: '2024-01-01', end_date: '2024-01-05',
    }))).toBe(5)
  })
})
