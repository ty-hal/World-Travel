import { db, canAccessTrip } from '../db/database';

export type TripChangeEvent = {
  id: number;
  trip_id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
};

function parse(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

export function listTripChanges(tripId: number | string, userId: number, limit = 100): TripChangeEvent[] {
  if (!canAccessTrip(tripId, userId)) return [];
  const rows = db.prepare(`
    SELECT id, trip_id, user_id, action, entity_type, entity_id,
           before_json, after_json, created_at
    FROM trip_change_events
    WHERE trip_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(tripId, Math.min(Math.max(limit, 1), 250)) as Array<Record<string, unknown>>;
  return rows.map(row => ({
    id: Number(row.id), trip_id: Number(row.trip_id), user_id: Number(row.user_id),
    action: String(row.action), entity_type: String(row.entity_type),
    entity_id: row.entity_id == null ? null : String(row.entity_id),
    before: parse(row.before_json as string | null), after: parse(row.after_json as string | null),
    created_at: String(row.created_at),
  }));
}

export function recordTripChange(input: {
  tripId: number | string;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number | string | null;
  before?: unknown;
  after?: unknown;
}): TripChangeEvent | null {
  if (!canAccessTrip(input.tripId, input.userId)) return null;
  const result = db.prepare(`
    INSERT INTO trip_change_events
      (trip_id, user_id, action, entity_type, entity_id, before_json, after_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.tripId, input.userId, input.action, input.entityType,
    input.entityId == null ? null : String(input.entityId),
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
  );
  return listTripChanges(input.tripId, input.userId, 1)[0] || null;
}
