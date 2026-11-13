import { db } from '../db/database';

export type TripSearchHit = {
  type: 'place' | 'day' | 'note' | 'reservation'
  id: number
  title: string
  snippet: string | null
  dayId: number | null
  dayNumber: number | null
  date: string | null
  placeId: number | null
}

const MAX_PER_TYPE = 8
const MAX_TOTAL = 24

function likePattern(q: string): string {
  return `%${q.replace(/[%_]/g, '')}%`
}

/**
 * Trip-scoped structured search over places, days, day notes, and reservations.
 * Uses bounded SQLite LIKE (no FTS/AI) — free-data and measurable.
 */
export function searchTrip(tripId: number | string, query: string): TripSearchHit[] {
  const q = query.trim()
  if (q.length < 1) return []
  const pattern = likePattern(q)
  const results: TripSearchHit[] = []

  const places = db.prepare(`
    SELECT p.id, p.name, p.address, p.description, p.notes,
      (SELECT da.day_id FROM day_assignments da WHERE da.place_id = p.id ORDER BY da.id LIMIT 1) AS day_id
    FROM places p
    WHERE p.trip_id = ?
      AND (
        p.name LIKE ? COLLATE NOCASE
        OR IFNULL(p.address, '') LIKE ? COLLATE NOCASE
        OR IFNULL(p.description, '') LIKE ? COLLATE NOCASE
        OR IFNULL(p.notes, '') LIKE ? COLLATE NOCASE
      )
    ORDER BY p.name COLLATE NOCASE
    LIMIT ?
  `).all(tripId, pattern, pattern, pattern, pattern, MAX_PER_TYPE) as Array<{
    id: number; name: string; address: string | null; description: string | null; notes: string | null; day_id: number | null
  }>

  for (const p of places) {
    const day = p.day_id
      ? db.prepare('SELECT id, day_number, date FROM days WHERE id = ?').get(p.day_id) as { id: number; day_number: number; date: string | null } | undefined
      : undefined
    results.push({
      type: 'place',
      id: p.id,
      title: p.name,
      snippet: p.address || p.description || p.notes || null,
      dayId: day?.id ?? null,
      dayNumber: day?.day_number ?? null,
      date: day?.date ?? null,
      placeId: p.id,
    })
  }

  const days = db.prepare(`
    SELECT id, day_number, date, title, notes
    FROM days
    WHERE trip_id = ?
      AND (
        IFNULL(title, '') LIKE ? COLLATE NOCASE
        OR IFNULL(notes, '') LIKE ? COLLATE NOCASE
      )
    ORDER BY day_number
    LIMIT ?
  `).all(tripId, pattern, pattern, MAX_PER_TYPE) as Array<{
    id: number; day_number: number; date: string | null; title: string | null; notes: string | null
  }>

  for (const d of days) {
    results.push({
      type: 'day',
      id: d.id,
      title: d.title || `Day ${d.day_number}`,
      snippet: d.notes || d.date || null,
      dayId: d.id,
      dayNumber: d.day_number,
      date: d.date,
      placeId: null,
    })
  }

  const notes = db.prepare(`
    SELECT dn.id, dn.text, dn.day_id, d.day_number, d.date
    FROM day_notes dn
    JOIN days d ON d.id = dn.day_id
    WHERE d.trip_id = ?
      AND dn.text LIKE ? COLLATE NOCASE
    ORDER BY d.day_number, dn.id
    LIMIT ?
  `).all(tripId, pattern, MAX_PER_TYPE) as Array<{
    id: number; text: string; day_id: number; day_number: number; date: string | null
  }>

  for (const n of notes) {
    const snippet = n.text.length > 120 ? `${n.text.slice(0, 117)}…` : n.text
    results.push({
      type: 'note',
      id: n.id,
      title: `Day ${n.day_number} note`,
      snippet,
      dayId: n.day_id,
      dayNumber: n.day_number,
      date: n.date,
      placeId: null,
    })
  }

  const reservations = db.prepare(`
    SELECT r.id, r.title, r.location, r.confirmation_number, r.notes, r.day_id, r.place_id,
      d.day_number, d.date
    FROM reservations r
    LEFT JOIN days d ON d.id = r.day_id
    WHERE r.trip_id = ?
      AND (
        IFNULL(r.title, '') LIKE ? COLLATE NOCASE
        OR IFNULL(r.location, '') LIKE ? COLLATE NOCASE
        OR IFNULL(r.confirmation_number, '') LIKE ? COLLATE NOCASE
        OR IFNULL(r.notes, '') LIKE ? COLLATE NOCASE
      )
    ORDER BY r.id DESC
    LIMIT ?
  `).all(tripId, pattern, pattern, pattern, pattern, MAX_PER_TYPE) as Array<{
    id: number; title: string | null; location: string | null; confirmation_number: string | null
    notes: string | null; day_id: number | null; place_id: number | null
    day_number: number | null; date: string | null
  }>

  for (const r of reservations) {
    results.push({
      type: 'reservation',
      id: r.id,
      title: r.title || 'Booking',
      snippet: r.location || r.confirmation_number || r.notes || null,
      dayId: r.day_id,
      dayNumber: r.day_number,
      date: r.date,
      placeId: r.place_id,
    })
  }

  return results.slice(0, MAX_TOTAL)
}
