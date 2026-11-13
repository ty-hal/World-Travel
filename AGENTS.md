# AGENTS.md

TREK travel planner monorepo. Workspace standard commands: see [../AGENTS.md](../AGENTS.md) (`make setup`, `make start`, `make test`, `make check`, `make capture`).

## Local development access and sandbox limits

The agent may be able to read and edit this repo while sandbox policy blocks access to local services. Treat `EPERM`/`EACCES` on `listen`, connection failures to Docker or the database, and browser errors reaching `localhost` as possible environment restrictions; check the command output and service state before diagnosing an application bug. Do not work around restrictions by changing ports, disabling auth/origin checks, or switching to a personal database.

- Use the repository's documented targets and isolated E2E setup. `make capture` uses `CI=1`; avoid `npm run shots` while the personal dev stack is running because it can seed the personal database.
- Docker-backed database work requires the Docker daemon and its socket to be reachable. If the sandbox blocks the daemon, report that clearly and request narrowly scoped elevated access for the needed command; do not silently substitute a different database.
- Local API and Vite servers need permission to bind their configured ports, and browser tests need permission to reach them. If the sandbox denies either, distinguish that from a server crash and use the approved local-access path rather than repeatedly restarting services.
- For visual checks, prefer the documented Playwright capture workflow and inspect its screenshots. Use interactive browser control only when that capability is available and relevant; the browser must be able to reach the same local app. Do not expose credentials or personal data in screenshots or logs.

## Visual capture (`make capture`)

Playwright drives the app and writes **staging artifacts** (not committed):

| Path | Contents |
|------|----------|
| `client/e2e/.tmp/shots/<Name>.png` | Screenshot |
| `client/e2e/.tmp/shots/<Name>.html` | Captured DOM |
| `client/e2e/.tmp/shots/<Name>.css.json` | Stylesheet + computed-style snapshot |

`client/e2e/.tmp/` is gitignored — use `make capture-open` or `open client/e2e/.tmp/shots` to browse.

**Important:** `make capture` sets `CI=1` so Playwright does **not** reuse an existing Vite dev server on `:5173`. If you run `npm run shots` while `make start` is up, seeding hits your personal database instead of the isolated E2E DB (`e2e@trek.local`).

The E2E seed (`client/e2e/seed.ts`) creates **two extra trips** (plus the main Japan trip), hotel/activity bookings, atlas countries + bucket list, ~30 archaeological wonders (catalog in `client/e2e/fixtures/atlas-wonders.json` and `server/src/db/seeds/atlas-wonders.json` — includes Kailasa Temple and Taj Mahal as Atlas wonders, not trips), and two collections.

**Workflow**

1. Stop any dev server on `:5173` / `:3001`, or just use `make capture` (forces isolated stack).
2. `make capture` — runs `playwright test --project=screenshots` (`client/e2e/screenshots/*.shot.ts`).
3. Review files under `client/e2e/.tmp/shots/`.
4. `make capture-promote` — resizes PNGs into `wiki/assets/` (HTML/CSS stay in staging only).
5. Optional dry run: `make capture-promote ARGS=--dry`.

`docs/screenshots/` in the README is separate marketing artwork, not this harness.
