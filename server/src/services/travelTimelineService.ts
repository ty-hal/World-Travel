import { db } from '../db/database';

export interface TimelineItem {
  id: string;
  kind: 'trip' | 'change' | 'country';
  date: string;
  title: string;
  subtitle?: string;
  trip_id?: number;
  trip_title?: string;
  meta?: Record<string, unknown>;
}

/** Account-level chronological feed across trips, visits, and change events. */
export function getUserTravelTimeline(userId: number, limit = 200): TimelineItem[] {
  const items: TimelineItem[] = [];

  const trips = db.prepare(`
    SELECT t.id, t.title, t.start_date, t.end_date
    FROM trips t
    WHERE t.user_id = ?
       OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = ?)
    ORDER BY COALESCE(t.end_date, t.start_date) DESC
    LIMIT 80
  `).all(userId, userId) as Array<{ id: number; title: string; start_date: string | null; end_date: string | null }>;

  for (const trip of trips) {
    if (trip.end_date) {
      items.push({
        id: `trip-end-${trip.id}`,
        kind: 'trip',
        date: trip.end_date,
        title: trip.title || 'Trip',
        subtitle: 'Trip ended',
        trip_id: trip.id,
        trip_title: trip.title,
      });
    }
    if (trip.start_date) {
      items.push({
        id: `trip-start-${trip.id}`,
        kind: 'trip',
        date: trip.start_date,
        title: trip.title || 'Trip',
        subtitle: 'Trip started',
        trip_id: trip.id,
        trip_title: trip.title,
      });
    }
  }

  const visits = db.prepare(`
    SELECT country, map_country, first_visited
    FROM atlas_visits
    WHERE user_id = ? AND first_visited IS NOT NULL
    ORDER BY first_visited DESC
    LIMIT 60
  `).all(userId) as Array<{ country: string; map_country: string; first_visited: string }>;

  for (const visit of visits) {
    items.push({
      id: `visit-${visit.country}-${visit.first_visited}`,
      kind: 'country',
      date: visit.first_visited,
      title: visit.map_country || visit.country,
      subtitle: 'Country first visited',
    });
  }

  const changes = db.prepare(`
    SELECT e.id, e.trip_id, e.action, e.entity_type, e.created_at, t.title AS trip_title
    FROM trip_change_events e
    JOIN trips t ON t.id = e.trip_id
    WHERE e.user_id = ?
       OR t.user_id = ?
       OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = ?)
    ORDER BY e.created_at DESC
    LIMIT ?
  `).all(userId, userId, userId, Math.min(limit, 120)) as Array<{
    id: number; trip_id: number; action: string; entity_type: string; created_at: string; trip_title: string;
  }>;

  for (const event of changes) {
    const day = String(event.created_at).slice(0, 10);
    items.push({
      id: `change-${event.id}`,
      kind: 'change',
      date: day,
      title: event.action,
      subtitle: `${event.entity_type} · ${event.trip_title}`,
      trip_id: event.trip_id,
      trip_title: event.trip_title,
      meta: { entity_type: event.entity_type },
    });
  }

  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return items.slice(0, limit);
}
