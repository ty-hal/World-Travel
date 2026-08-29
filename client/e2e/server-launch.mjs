// Boots the TREK backend for the Playwright E2E run against a fresh, isolated
// SQLite database. The DB file is deleted first so every run starts clean, then
// the server's own startup seeds a known admin from ADMIN_EMAIL/ADMIN_PASSWORD.
//
// The server is built once and launched as a SINGLE node process (not the
// watch-mode `npm run dev`, which spawns tsc -w + node --watch grandchildren
// that survive Playwright's teardown and then linger on :3001 with stale DB
// state). A single child is killed cleanly when Playwright tears the run down.
import { rmSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 3001

/** Kill anything still bound to our port from a prior aborted E2E or dev run. */
function freePort(port) {
  if (process.platform === 'win32') return
  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', shell: true })
  } catch {}
}

const here = path.dirname(fileURLToPath(import.meta.url))
const dbFile = path.join(here, '.tmp', 'e2e.db')
const serverDir = path.join(here, '..', '..', 'server')

freePort(PORT)

for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
  try { rmSync(f, { force: true }) } catch {}
}

// Build once (no watcher) — the resulting process is a single killable node.
execSync('node scripts/build.mjs', { cwd: serverDir, stdio: 'inherit' })

const env = {
  ...process.env,
  TREK_DB_FILE: dbFile,
  ADMIN_EMAIL: 'e2e@trek.local',
  ADMIN_PASSWORD: 'E2eTest12345!',
  PORT: String(PORT),
  NODE_ENV: 'development',
  // Prevent the admin update banner from polluting E2E screenshots when GitHub
  // reports a newer release than the local package version.
  APP_VERSION: '99.0.0',
}

const child = spawn(process.execPath, ['--require', 'tsconfig-paths/register', 'dist/index.js'], {
  cwd: serverDir,
  env,
  stdio: 'inherit',
})

function stop() {
  if (!child?.pid) return
  try { child.kill('SIGTERM') } catch {}
  try { child.kill('SIGKILL') } catch {}
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
process.on('exit', stop)
child.on('exit', code => process.exit(code ?? 0))
