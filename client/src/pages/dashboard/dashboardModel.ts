/**
 * Dashboard data model + pure helpers — shared by the data hook (useDashboard)
 * and the presentational components in DashboardPage. Kept free of React/IO so
 * both sides can import it without a cycle. Part of the FE "page = wiring
 * container + data hook" convention (see dashboard/README.md).
 */

import type { Trip } from '../../types'

// The dashboard works with the canonical Trip shape returned by the list/get
// endpoints (it already carries the computed day_count/place_count/is_owner/
// owner_username/shared_count fields). Kept as a named alias so the existing
// imports stay stable.
export type DashboardTrip = Trip & { trip_preview_image?: string | null }

export interface Member { id: number; username: string; avatar_url?: string | null }
export interface Place {
  id: number; name: string; image_url: string | null; lat: number | null; lng: number | null; address?: string | null
  google_place_id: string | null; osm_id: string | null
  category_name?: string | null
  category_color?: string | null; category_icon?: string | null
  category?: { name?: string | null; color?: string | null; icon?: string | null } | null
}
export interface HeroBundle { members: Member[]; places: Place[] }
export interface TravelStats { totalTrips?: number; totalDays?: number; totalPlaces?: number; totalDistanceKm?: number; countries?: string[] }
export interface UpcomingReservation {
  id: number; trip_id: number; title: string; type: string
  reservation_time?: string | null; day_date?: string | null
  location?: string | null; place_name?: string | null; trip_title?: string | null
}
export interface RecentActivity {
  entity_type: 'trip' | 'trip_updated' | 'place_added' | 'place_updated'
  entity_id: number
  trip_id: number
  trip_title: string
  item_title: string
  activity_at: string
}

export const MS_PER_DAY = 86400000

/** Completed-tab sort keys (client-only preference). */
export type CompletedSortKey =
  | 'date-desc'
  | 'date-asc'
  | 'duration-desc'
  | 'duration-asc'
  | 'places-desc'
  | 'places-asc'

export const COMPLETED_SORT_STORAGE_KEY = 'trek_completed_trip_sort'

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00'); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / MS_PER_DAY)
}

export function getTripStatus(trip: DashboardTrip): 'ongoing' | 'today' | 'tomorrow' | 'future' | 'past' | null {
  const today = new Date().toISOString().split('T')[0]
  if (trip.start_date && trip.end_date && trip.start_date <= today && trip.end_date >= today) return 'ongoing'
  const until = daysUntil(trip.start_date)
  if (until === null) return null
  if (until === 0) return 'today'
  if (until === 1) return 'tomorrow'
  if (until > 1) return 'future'
  return 'past'
}

export function tripDurationDays(trip: DashboardTrip): number {
  // Prefer itinerary day_count when present — including 0. Empty trips must sort
  // as shortest under "Longest trips", not fall through to a calendar span.
  if (typeof trip.day_count === 'number') return Math.max(0, trip.day_count)
  if (trip.start_date && trip.end_date) {
    const start = new Date(trip.start_date + 'T00:00:00').getTime()
    const end = new Date(trip.end_date + 'T00:00:00').getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.floor((end - start) / MS_PER_DAY) + 1
    }
  }
  return 0
}

/** Date-aware default ordering (spotlight / chronological fallback). */
export function sortTrips(trips: DashboardTrip[]): DashboardTrip[] {
  const today = new Date().toISOString().split('T')[0]
  const rank = (t: DashboardTrip) => {
    if (t.start_date && t.end_date && t.start_date <= today && t.end_date >= today) return 0
    if (t.start_date && t.start_date >= today) return 1
    return 2
  }
  return [...trips].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra !== rb) return ra - rb
    const ad = a.start_date || '', bd = b.start_date || ''
    if (ra <= 1) return ad.localeCompare(bd)
    return bd.localeCompare(ad)
  })
}

/**
 * Manual priority for planned/archived cards. Primary key is sort_order;
 * date-aware sortTrips is the stable tiebreaker so untouched lists still feel
 * chronological.
 */
export function sortTripsByPriority(trips: DashboardTrip[]): DashboardTrip[] {
  const byDate = sortTrips(trips)
  const dateRank = new Map(byDate.map((t, i) => [t.id, i]))
  return [...trips].sort((a, b) => {
    const ao = a.sort_order ?? 0
    const bo = b.sort_order ?? 0
    if (ao !== bo) return ao - bo
    return (dateRank.get(a.id) ?? 0) - (dateRank.get(b.id) ?? 0)
  })
}

export function sortCompletedTrips(trips: DashboardTrip[], sortKey: CompletedSortKey): DashboardTrip[] {
  const dir = sortKey.endsWith('-asc') ? 1 : -1
  const metric = sortKey.startsWith('date')
    ? (t: DashboardTrip) => t.start_date || t.end_date || ''
    : sortKey.startsWith('duration')
      ? (t: DashboardTrip) => tripDurationDays(t)
      : (t: DashboardTrip) => t.place_count ?? 0

  return [...trips].sort((a, b) => {
    const av = metric(a)
    const bv = metric(b)
    if (typeof av === 'string' && typeof bv === 'string') {
      if (av !== bv) return av.localeCompare(bv) * dir
    } else if (av !== bv) {
      return ((av as number) - (bv as number)) * dir
    }
    return (a.title || '').localeCompare(b.title || '')
  })
}

export function applyTripOrder(trips: DashboardTrip[], orderedIds: number[]): DashboardTrip[] {
  const byId = new Map(trips.map(t => [t.id, t]))
  const ordered: DashboardTrip[] = []
  orderedIds.forEach((id, index) => {
    const trip = byId.get(id)
    if (trip) {
      ordered.push({ ...trip, sort_order: index })
      byId.delete(id)
    }
  })
  // Keep any trips not included in the payload after the reordered set.
  for (const trip of byId.values()) ordered.push(trip)
  return ordered
}

export function moveTripId(orderedIds: number[], from: number, to: number): number[] {
  if (to < 0 || to >= orderedIds.length || from === to) return orderedIds
  const next = [...orderedIds]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
