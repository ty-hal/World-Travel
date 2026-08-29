// Populates the global atlas_wonders catalog for the isolated E2E database.
// Wonders are not user-owned — the table is empty on a fresh DB, which leaves
// Atlas → Wonders at 0/0 until this runs.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbFile = path.join(here, '.tmp', 'e2e.db')

if (!existsSync(dbFile)) {
  console.log('seed-atlas-catalog: no e2e.db yet — skipped')
  process.exit(0)
}

const require = createRequire(import.meta.url)
const sqliteRoots = [
  path.join(here, '..', '..', 'node_modules', 'better-sqlite3'),
  path.join(here, '..', '..', 'server', 'node_modules', 'better-sqlite3'),
]
const sqlitePath = sqliteRoots.find(p => existsSync(p))
if (!sqlitePath) {
  console.error('seed-atlas-catalog: better-sqlite3 not installed — run npm ci at repo root')
  process.exit(1)
}
const Database = require(sqlitePath)
const wonders = JSON.parse(readFileSync(path.join(here, 'fixtures', 'atlas-wonders.json'), 'utf8'))

const db = new Database(dbFile)
const insert = db.prepare(`
  INSERT INTO atlas_wonders (source_id, label, country, map_country, region, significance, lat, lng, source_url, image_urls_json)
  VALUES (@source_id, @label, @country, @map_country, @region, @significance, @lat, @lng, NULL, '[]')
  ON CONFLICT(source_id) DO UPDATE SET
    label = excluded.label,
    country = excluded.country,
    map_country = excluded.map_country,
    region = excluded.region,
    significance = excluded.significance,
    lat = excluded.lat,
    lng = excluded.lng
`)

const tx = db.transaction(rows => {
  for (const row of rows) {
    insert.run({ ...row, significance: row.significance ?? 'notable' })
  }
})
tx(wonders)
db.close()
console.log(`seed-atlas-catalog: ${wonders.length} wonders`)
