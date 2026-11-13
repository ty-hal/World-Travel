# Beli food recommendations — integration plan

Status: **Paused by user request (2026-11-07).** The Beli API module is unregistered and Settings/Planner entry points are removed. Saved Beli tokens have been removed from Keychain and the local app database. Existing encrypted history, predictions and privacy protections are retained. The local linking command is also disabled. Do not run Beli login, refresh, sync, discovery, diagnostics or the local linking helper until the user explicitly resumes access. The implementation below is retained for reference and is not currently exposed in the app.

## Product decision

Add an optional, per-user Beli connection and a **Food for you** view near a selected trip place, accommodation, or map location. Combine imported personal history with Beli's personalized predictions and nearby discovery. Saving a suggestion uses TREK's existing place/collection flows; it never writes to Beli.

Keep the initial implementation in a small Nest module without a feature flag, following the existing AirTrail integration pattern. Linking remains opt-in per account. Reuse core authentication, encryption, maps and place APIs. Do not extend the plugin SDK just for this connector: its current per-user settings surface is read-only, while refresh-token rotation needs secure writes. Reconsider a plugin if the host later supports the required credential lifecycle directly.

## Current personal version

- Settings → Integrations → Beli supports email/phone and password linking, full sync and disconnect/delete. Password inputs clear on submit and are never persisted. The token and latest normalized history/prediction snapshot are encrypted with the existing installation key in an account-owned table with cascading deletion.
- Plan → places panel → Food for you selects an existing geocoded trip place, category and radius. Results remain in component memory. Explicitly saved public place fields use the existing place repository and permissions; private recommendation evidence is not copied.
- Ranking uses transparent evidence groups (both signals, history only, Beli only, nearby only), preserves ties and category boundaries, and reserves suggestions without predictions. No learned weights, walking/transit estimates, scheduled sync, map recommendation overlays or personal-data export format were added.
- Run `npm run beli:link-local --workspace=server -- YOUR_TREK_USERNAME` from the repo root to reuse the reviewed prototype's Keychain session locally. The script requires the existing normal local database and macOS helper. Tokens cross only an anonymous child-process pipe, not shell arguments/environment/files/logs; a rotated token is updated in Keychain. Do not use it for deployed databases or guess the target username. If the session expires, sign in through the Beli settings form; no password belongs in chat.
- The connection card uses the UI UX Pro review: one-line purpose, two labeled fields, one primary action, concise status and collapsed privacy details. Fresh-login rejection is reported separately from a saved-session rejection; a 401 does not prove expiry.
- Upstream discovery is queried on demand. History/predictions refresh manually through Settings; the dialog labels snapshots older than one day. Refresh token rotation is serialized per account in this single-process personal deployment. Multi-process coordination is deferred.
- Beli responses bypass TREK's persistent idempotency cache and receive private/no-store headers. Unit tests and isolated captures must not persist their encryption key into the personal installation's key file. Exported database backups omit Beli connections and snapshots (and vacuum the disposable copy), so restoring requires reconnecting. If a safe snapshot cannot be created, backup stops instead of archiving the live database. Other TREK secrets remain subject to the existing backup format; protect backups as sensitive.
- Tests use synthetic fixtures. Local real-export compatibility checks retain private inputs in the Beli repo and print aggregate counts only. Private exports are never copied into source or E2E fixtures.

## Release dependency

The working local prototype demonstrates technical feasibility, not an officially supported integration. No official delegated Beli authorization flow was established during research. TREK's existing OAuth/MCP clients do not provide Beli authorization.

Beli's [published terms](https://beliapp.com/terms-of-service) restrict automated extraction, credential sharing, and third-party/non-personal use. Before offering live account linking to other users, establish permission and a supported authentication/data-use arrangement. [Beli partnerships](https://beliapp.com/partnerships) is a possible channel; no outreach is authorized by this plan. An import-only path for user-provided history can be developed independently, without representing it as live Beli linking or assuming permission to redistribute Beli's prediction feed.

## User flow

1. **Settings → Integrations → Beli.** Explain imported data, external requests, privacy, and disconnect behavior. Prefer supported delegated authorization if available. For an authorized password-based connector, accept email/password once over HTTPS, exchange server-side, discard the password immediately, and retain only an encrypted refresh token. Do not label this OAuth or imply a limited read scope: our code is read-only, but the credential may have broader account authority.
2. Show **Syncing → Connected**, last successful sync, category counts and coverage. A failed initial sync must not show a healthy connection. Later failures retain the last complete snapshot and mark it stale. Reauthentication is explicit; never repeatedly retry a bad password.
3. Open a trip and choose **Food for you** near a hotel, selected place, or explicit map point. Show the selected origin and radius. No device geolocation or whole-itinerary upload is required. A trip without geocoded places prompts for an origin rather than guessing a city center.
4. Show a compact list with matching markers, cuisine/price, distance, prediction availability, and a short evidence-based reason. Filters: restaurant/bakery/dessert, radius, price and already-visited. Use **Search this area** after moving the map, matching current explore behavior; do not fetch on every pan.
5. **Save to trip / collection** reuses the existing picker and permission checks. Only the saved place becomes shared trip content; personal ratings and recommendation reasons stay private.
6. **Disconnect and delete Beli data** removes credentials, imported history, predictions, profiles, and caches, cancels pending syncs, and prevents an in-flight response from recreating them. Previously saved trip places remain. Local disconnection is not an upstream token revocation unless Beli supports and confirms that operation.

## Recommendation pipeline

Keep stages inspectable: extract → normalize → identify places → derive preferences → rank. Record source, fetch time and coverage at every boundary.

- Sync all supported ranking categories and bookmarks into a complete per-user snapshot. Preserve original category, score, ties and source IDs; compare ratings within categories. Derive a small deterministic cuisine/price summary with sample counts. No LLM, embeddings or external profile upload is needed for v1.
- Fetch the personalized prediction feed separately from location-based discovery. The prototype's discovery query is trending nearby, not itself proof of personalization. Join predictions to candidates by exact Beli business ID.
- Validate finite coordinates, filter locally to the requested radius, exclude known closed businesses and deduplicate exact Google place IDs. Merge aliases without silently selecting between conflicting predictions. Do not fuzzy-merge separate branches; flag unresolved duplicates. Category queries overlap, so do not call every bakery-query result a bakery.
- Identify previous visits by Beli ID and Google place ID. Default to unvisited suggestions; retain bookmarks as a separate positive signal. Exact identity matches only; ambiguous records remain flagged.
- Preserve `expected_percentile` as an opaque raw value. Its units are undocumented: never display it as a predicted personal /10 rating, probability, or directly blend it with historical /10 scores.
- First evaluate a transparent reranker in the local prototype: convert each signal to an ordinal rank within the same category and candidate set; combine Beli order with supported historical cuisine/price fit, then use distance to resolve close results. Choose weights only after comparing actual shortlists with Beli-only and nearest-only baselines. Cuisine sample counts and contradictory ratings must reduce confidence; absence of a cuisine in history is unknown, not dislike.
- Always reserve visible suggestions for history matches without Beli predictions. Do not turn a missing prediction into zero or drop it from discovery. Display separate evidence labels such as **Beli prediction available**, **Matches cuisines you rate highly**, and **Limited history** rather than an invented accuracy percentage.
- Apply explicit budget/category filters before ranking. Straight-line distance is the initial availability measure. Add walking/transit estimates later using an appropriate existing/configured provider; never label straight-line distance as travel time or use a driving route as a walking estimate.

Prototype evidence supports this cautious combination: moderate historical rank agreement, stronger restaurant prediction coverage than bakery/dessert coverage, and important disagreements on inexpensive favorites. These observations are not independent new-visit accuracy measurements. Keep personal results in the private Beli repo, not this plan or test fixtures.

## Backend and storage

Implemented routes:

| Route | Purpose |
|---|---|
| `GET /api/integrations/beli` | Own connection status, sync times and coverage; no secrets |
| `POST /api/integrations/beli/connect` | Supported authorization exchange; password form only if authorized |
| `POST /api/integrations/beli/sync` | Bounded, deduplicated refresh of own data |
| `DELETE /api/integrations/beli` | Disconnect and erase imported data |
| `POST /api/integrations/beli/recommendations` | Trip/place IDs, category/radius; authenticated member's own personalization |

Derive TREK user identity from the session and Beli identity from authenticated Beli claims. Never accept another user's Beli ID from the browser. Enforce trip membership independently; recommendation reads do not grant place-write permissions.

Start with two additive SQLite tables: a user connection row (encrypted refresh token, Beli account ID, connection generation/state and sync timestamps), and one latest per-user data snapshot (version, fetched timestamps, normalized history and prediction payload). The prototype's tens-of-thousands prediction rows do not require a new search database. Normalize into additional indexed tables only if payload size or query measurements justify it. Use foreign keys with account deletion; explicitly test the actual cleanup path. Do not mutate the local prototype's raw exports.

Retain only the latest complete snapshot. Replace atomically after validation; retain previous good data on partial sync. Keep historical and prediction fetch timestamps separate. Use bounded, per-user in-memory discovery caching keyed by account/generation, category and search area; validate the exact requested radius after a cached lookup. Cap entries and expiry. Never share personalized results across users or cache them in service workers/shared HTTP caches.

Run sync on connection, explicit refresh and stale-on-demand recommendation requests; no scheduled worker is needed initially. Serialize refresh per connection to handle token rotation, persist rotated tokens promptly even if data sync fails, and use generation checks to reject work after disconnect. Honor 429 cooldowns, use bounded retries/timeouts/response sizes, and retain stale data with an explicit warning on transient failure. Revoked sessions become **Reconnect required**.

## Credential and privacy boundaries

- Reuse `server/src/services/apiKeyCrypto.ts` AES-GCM encryption, calling the strict encrypt function for new tokens and rejecting plaintext on this connector's read path. The shared decrypt helper accepts legacy plaintext and is insufficient by itself to enforce the new invariant.
- Passwords and tokens must not appear in frontend persistence, analytics, request-body logs, exception reports, URLs, exports, MCP responses or fixtures. Return only connection state. Refresh tokens stay server-side encrypted; access tokens stay in memory. Disable credential-bearing redirects and allowlist the three reviewed backend destinations/routes.
- Audit logging records action/status, not request payloads. Apply existing session/origin protections plus connection/sync rate limits. Do not retry unsupported Google/Apple login or MFA flows as email/password.
- Private recommendations and profiles are not trip-collaboration data. Return `Cache-Control: private, no-store`; clear client state when users switch/logout. Public share links, ordinary trip exports and offline bundles must not contain these payloads. Personal data downloads may include history/profile with provenance, never credentials.
- Integrate disconnect and full account deletion. New TREK database backups exclude Beli data entirely; restore requires reconnecting. Other TREK secrets can still be bundled with the encryption key. Protect backup handling and retention; do not claim immediate erasure from historical backups.

## Implementation sequence and acceptance

1. **Provider decision and local ranking check.** Establish the authorized linking path; compare combined, Beli-only and nearest-only top results in multiple trip regions and categories. Collect explicit user feedback, not clicks alone. If unsupported, proceed with history import and TREK's existing discovery only.
2. **Connection and snapshots.** Add Nest module/guard, schema migration, typed shared contracts and frontend API methods. Implement connect/status/sync/disconnect with fake upstream fixtures. Verify password nonpersistence, encrypted token storage, rotation, concurrency, ownership and deletion before adding the login UI.
3. **Recommendations API.** Port the reviewed Python request semantics to the existing TypeScript server; do not run Python or access a user's Mac Keychain from TREK. Add identity matching, per-category evidence, missing-prediction handling, finite-coordinate/radius bounds, exact deduplication, closed-status filtering, stale cache behavior and response limits.
4. **Settings and trip UI.** Reuse integration sections, map exploration and save pickers. Add localization, accessible labels/focus, cancellation, empty/partial/error/reconnect states and a provider kill switch. Verify both map renderers through existing interfaces, without creating a second saved-place model.
5. **Private pilot, then release decision.** Use own account only after the provider decision. Check relevant real trip locations without batch-uploading the itinerary. Review usefulness, missing coverage, latency and request volume before considering wider availability.

Verification: focused unit/controller tests for account isolation, trip access, rotation races, no plaintext/secret leaks, disconnect-during-sync, failure rollback, malformed upstream data, tied ranks, closed/duplicate businesses and missing predictions. Integration tests must use fake accounts and fixtures, not personal exports. Run existing frontend/API checks, then the documented isolated `make capture` workflow and inspect screenshots for connected/reconnect/stale/empty/partial states and mobile layouts. No personal data or credentials in screenshots. The personal implementation has focused service/controller/privacy and frontend tests plus isolated desktop/mobile captures. Live account verification remains blocked by rejected authentication in both clients; no password was requested in chat and no automatic sign-in retry is scheduled.

## Concrete repository touchpoints

- `server/src/nest/integrations/` and `server/src/nest/app.module.ts`: optional Beli module following AirTrail conventions.
- `server/src/nest/integrations/beli.module.ts`: authenticated opt-in connection, without an instance feature flag.
- `server/src/db/` and `server/src/services/userCleanupService.ts`: additive schema, ownership, account deletion; account export and `backupService.ts` review.
- `server/src/services/apiKeyCrypto.ts`: reuse encryption without changing legacy consumers.
- `client/src/components/Settings/IntegrationsTab.tsx`: connection section; existing client API/shared contracts and i18n.
- `client/src/components/Map/usePoiExplore.ts` and planner/save flows: reuse search-area interaction, marker/list selection and save permissions; keep existing OSM exploration working.
- Synthetic server/client fixtures, controller/service/unit tests, and isolated screenshot scenarios.
