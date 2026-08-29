// Post-seed DB extras for richer screenshot surfaces: photo albums and varied
// in-app notifications. Runs after seedDemoData writes seed.json.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbFile = path.join(here, '.tmp', 'e2e.db')
const seedFile = path.join(here, '.tmp', 'seed.json')

if (!existsSync(dbFile) || !existsSync(seedFile)) {
  console.log('seed-extras: missing e2e.db or seed.json — skipped')
  process.exit(0)
}

const { tripId } = JSON.parse(readFileSync(seedFile, 'utf8'))
const adminId = 1

const require = createRequire(import.meta.url)
const sqliteRoots = [
  path.join(here, '..', '..', 'node_modules', 'better-sqlite3'),
  path.join(here, '..', '..', 'server', 'node_modules', 'better-sqlite3'),
]
const sqlitePath = sqliteRoots.find(p => existsSync(p))
if (!sqlitePath) {
  console.error('seed-extras: better-sqlite3 not installed')
  process.exit(1)
}

const Database = require(sqlitePath)
const db = new Database(dbFile)

const photoUrls = [
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
  'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800',
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800',
  'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=800',
]

db.prepare(`
  INSERT OR REPLACE INTO trip_media (
    user_id, trip_id, source_id, provider, kind, title, external_url, cover_url,
    caption, image_urls_json, video_urls_json, geotags_json, sort_order
  ) VALUES (?, ?, ?, ?, 'album', ?, ?, ?, ?, ?, '[]', '[]', ?)
`).run(
  adminId, tripId, `demo-album-${tripId}`, 'demo',
  'Autumn in Japan highlights',
  'https://example.com/albums/japan-2026',
  photoUrls[0],
  'Cherry gates, neon crossings, and temple mornings from the seeded trip.',
  JSON.stringify(photoUrls),
  0,
)

// Collab messages create duplicate "New Message" rows — mark them read so the
// inbox shows a mix of notification types instead of four identical entries.
db.prepare(`
  UPDATE notifications
  SET is_read = 1
  WHERE recipient_id = ? AND title_key = 'notif.collab_message.title'
`).run(adminId)

const insertNotif = db.prepare(`
  INSERT INTO notifications (
    type, scope, target, sender_id, recipient_id,
    title_key, title_params, text_key, text_params, is_read
  ) VALUES (?, 'trip', ?, NULL, ?, ?, ?, ?, ?, 0)
`)

const samples = [
  ['simple', tripId, adminId, 'notif.trip_reminder.title', '{}', 'notif.trip_reminder.text', JSON.stringify({ trip: 'Autumn in Japan' })],
  ['simple', tripId, adminId, 'notif.todo_due.title', '{}', 'notif.todo_due.text', JSON.stringify({ todo: 'Book teamLab Planets slot', trip: 'Autumn in Japan', due: '2026-08-15' })],
  ['simple', tripId, adminId, 'notif.booking_change.title', '{}', 'notif.booking_change.text', JSON.stringify({ actor: 'mira', trip: 'Autumn in Japan' })],
  ['simple', tripId, adminId, 'notif.photos_shared.title', '{}', 'notif.photos_shared.text', JSON.stringify({ actor: 'jonas', count: 4, trip: 'Autumn in Japan' })],
]

for (const row of samples) insertNotif.run(...row)

db.close()
console.log(`seed-extras: trip_media + ${samples.length} notifications for trip ${tripId}`)
