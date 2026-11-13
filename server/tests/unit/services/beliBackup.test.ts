import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { createBeliTables, omitBeliFromBackup } from '../../../src/db/beliSchema';

it('removes Beli credentials and history from the backup copy, including freed pages, without changing live data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trek-beli-backup-'));
  const live = new Database(':memory:');
  try {
    live.exec('CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1);');
    createBeliTables(live);
    live.prepare('INSERT INTO beli_connections(user_id,generation,refresh_cipher,snapshot_cipher) VALUES(1,?,?,?)').run('fake-generation', 'synthetic-refresh-cipher', 'synthetic-private-history');
    const path = join(directory, 'backup.db');
    live.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
    omitBeliFromBackup(path);
    const copy = new Database(path);
    try {
      expect(copy.prepare('SELECT * FROM beli_connections').all()).toEqual([]);
      expect(copy.prepare('SELECT * FROM users').all()).toHaveLength(1);
    } finally { copy.close(); }
    expect(live.prepare('SELECT * FROM beli_connections').all()).toHaveLength(1);
    expect(readFileSync(path).includes(Buffer.from('synthetic-refresh-cipher'))).toBe(false);
    expect(readFileSync(path).includes(Buffer.from('synthetic-private-history'))).toBe(false);
  } finally { live.close(); rmSync(directory, { recursive: true, force: true }); }
});
