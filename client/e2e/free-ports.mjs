#!/usr/bin/env node
/**
 * Frees the ports Playwright E2E and local dev typically bind.
 *
 * Use when `npm run dev` shows EADDRINUSE on :3001 after an E2E run, or when
 * Playwright aborts mid-run and leaves the throwaway backend behind.
 *
 *   npm run e2e:free-ports
 */
import { execSync } from 'node:child_process'

const PORTS = [3001, 5173]

function freePort(port) {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
      const pids = [...new Set(
        out.split('\n')
          .map(l => l.trim().split(/\s+/).pop())
          .filter(pid => pid && /^\d+$/.test(pid)),
      )]
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }) } catch {}
      }
    } catch {}
    return
  }

  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', shell: true })
  } catch {}
}

for (const port of PORTS) freePort(port)
console.log(`Freed ports ${PORTS.join(', ')} (if anything was listening).`)
