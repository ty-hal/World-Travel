# AGENTS.md

TREK travel planner monorepo. Workspace standard commands: see [../AGENTS.md](../AGENTS.md) (`make setup`, `make start`, `make test`, `make check`, `make capture`).

## Visual capture (`make capture`)

Playwright drives the app and writes **staging artifacts** (not committed):

| Path | Contents |
|------|----------|
| `client/e2e/.tmp/shots/<Name>.png` | Screenshot |
| `client/e2e/.tmp/shots/<Name>.html` | Captured DOM |
| `client/e2e/.tmp/shots/<Name>.css.json` | Stylesheet + computed-style snapshot |

`client/e2e/.tmp/` is gitignored — use `make capture-open` or `open client/e2e/.tmp/shots` to browse.

**Important:** `make capture` sets `CI=1` so Playwright does **not** reuse an existing Vite dev server on `:5173`. If you run `npm run shots` while `make start` is up, seeding hits your personal database instead of the isolated E2E DB (`e2e@trek.local`).

The E2E seed (`client/e2e/seed.ts`) creates **three trips**, hotel/activity bookings, atlas countries + bucket list, ~30 archaeological wonders (catalog in `client/e2e/fixtures/atlas-wonders.json`), and two collections.

**Workflow**

1. Stop any dev server on `:5173` / `:3001`, or just use `make capture` (forces isolated stack).
2. `make capture` — runs `playwright test --project=screenshots` (`client/e2e/screenshots/*.shot.ts`).
3. Review files under `client/e2e/.tmp/shots/`.
4. `make capture-promote` — resizes PNGs into `wiki/assets/` (HTML/CSS stay in staging only).
5. Optional dry run: `make capture-promote ARGS=--dry`.

`docs/screenshots/` in the README is separate marketing artwork, not this harness.
