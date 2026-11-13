import Database from 'better-sqlite3';

export function createBeliTables(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS beli_connections (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    generation TEXT NOT NULL,
    identity TEXT,
    refresh_cipher TEXT,
    snapshot_cipher TEXT,
    synced_at TEXT,
    rated_count INTEGER NOT NULL DEFAULT 0,
    prediction_count INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'syncing'
  )`);
}

/** Only call on the disposable backup copy, never the live database. */
export function omitBeliFromBackup(file: string): void {
  const snapshot = new Database(file);
  try {
    if (!snapshot.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'beli_connections'").get()) return;
    snapshot.exec('PRAGMA secure_delete = ON; DELETE FROM beli_connections; VACUUM;');
  } finally { snapshot.close(); }
}
