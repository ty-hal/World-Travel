# Free-API Feature Plan

Updated: 2026-08-24

## Non-negotiable constraint

TREK will not pay for API access for these features. New functionality may use:

- Existing TREK services and local calculations
- Open-source software run locally
- Open data with a free public endpoint
- A hosted free tier only when it does not require payment to remain useful

There must be no silent paid fallback, credit-card-dependent feature, monthly minimum, or automatic provider upgrade. Every provider must be cached, rate-limited, attributed, and replaceable.

If a source does not provide reliable data, TREK must show `unknown` or `approximate` rather than infer a false value.

## Scope decisions

### Keep: constraint-aware day optimizer

No external API is required for the first version.

Use TREK's existing coordinates, assignment order, route calculations, reservations, and day-level optimizer.

Implementation:

1. Calculate a proposed order without saving it.
2. Show moved stops, estimated time/distance change, and conflicts.
3. Apply the entire reorder as one mutation.
4. Store the original order as one atomic undo snapshot.
5. Show `Undo optimized route` immediately.
6. Keep `Revert optimization` available until a later manual reorder replaces it.

The optimizer should remain day-scoped initially. Fixed-time reservations, lodging, locked places, and explicit start/end anchors must not move.

### Keep: verified recommendations, using free sources only

Use the providers already present in TREK:

- OpenStreetMap/Nominatim for deliberate geocoding and user searches
- Overpass for nearby POI/category discovery
- Wikimedia Commons for landmark and historic-site imagery

Do not add Google Places, Yelp, Foursquare, or another paid/restricted business-data provider.

The recommendation record must include provider, provider ID, source URL, fetched time, category, and business-status confidence. Permanently closed OSM-tagged businesses should be filtered, but OSM-only results must be labeled as limited verification because OSM does not provide dependable reviews or current business status.

The click flow is preview first, add second. A candidate must never be added immediately merely because it was clicked on the map.

Nominatim's public service is limited to light, deliberate queries; it is not an autocomplete or bulk-search backend. Cache results and follow the [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

### Drop: live flight and disruption tracking

TREK already integrates with AirTrail for flight history/import/synchronization, so keep that integration for existing data.

Do not add a new live-disruption provider in this plan:

- OpenSky is free but explicitly does not provide commercial schedules or airline delay/cancellation data.
- Aviationstack and AirLabs free tiers are too limited and provider terms/quotas can change.
- FlightAware is high quality but is paid beyond a small allowance.

Without a dependable free source for gate changes, cancellations, and airline disruptions, this feature is dropped. TREK may still display any status fields AirTrail already exposes, without promising live alerts.

### Keep: itinerary change history

This requires no external API.

Add a small append-only trip change log for meaningful operations only:

- Optimizer apply/revert
- Place add/delete/update
- Assignment and reorder changes
- Imports and bulk edits
- Reservation and budget changes

The current in-memory undo stack remains for immediate undo. Durable history supports refresh-safe review and restoration later. Do not log every keystroke.

### Keep: travel timeline

Use existing trip, Journey, place, reservation, and photo data. No external API is required.

Add an account-level chronological view with filters for year, trip, country, state, completed/planned, and photo availability. Preserve exact, month-only, year-only, and unknown date precision.

### Keep: packing intelligence

Use deterministic local rules and data TREK already has:

- Trip duration and date precision
- Destinations
- Place categories and activities
- Baggage allowances
- Traveler and bag settings
- Existing packing templates

Weather suggestions may use Open-Meteo if the existing integration remains within its free-use terms. Weather is advisory and must show forecast/source time. Do not make an LLM or paid weather service a dependency.

Generated items go into a review queue with a reason. Existing checklist items are never silently deleted.

### Keep: cost intelligence

Use the existing local budget model. No API is needed.

Add planned/actual, paid/unpaid, estimated/confirmed, discount, cashback, destination, day, and category breakdowns while preserving original amounts and currencies. Do not automatically change user-entered costs.

### Keep: train and route statistics

Use the sources already available in TREK:

- Existing OSRM-compatible routing for driving, walking, and cycling
- Transitous for public transit, trains, buses, ferries, transfers, and walking segments
- Airport coordinates and local Haversine calculations for flight great-circle distance
- AirTrail flight tracks when available for actual flown distance

OSRM public endpoints are free but best-effort only. Cache route results and keep the provider configurable. Do not claim routed distance when only straight-line distance exists.

Transitous is free and open but depends on regional GTFS/GTFS-RT coverage. Missing coverage must be shown as unknown, not replaced by invented durations.

Use a normalized transport-leg result with `distanceSource` values such as `osrm`, `transitous`, `air-great-circle`, `air-actual-track`, `manual`, and `unknown`.

Do not add GraphHopper, FlightAware, or OpenRouteService as required dependencies. They may be evaluated later only if their free terms remain sufficient and no payment is needed.

### Keep: public trip pages

Extend TREK's existing token-based sharing and Journey public pages. No external API is required.

Add redacted public overview, map, day plan, photos, and optional packing/cost sections. Hide confirmation numbers, private notes, documents, and financial details by default. Support revocation and expiration.

### Do not build: new calendar synchronization

Do not add Google Calendar OAuth, import, export, or two-way synchronization as part of this feature plan. Existing ICS functionality can remain unchanged.

## Implementation order

### Phase 1: Planner correctness

1. Atomic optimizer preview/apply/revert — immediate revert and durable History tab implemented
2. Durable trip change history — SQLite events and protected API implemented
3. Free-source recommendation provenance and preview-before-add
4. Closed/unknown recommendation filtering — lifecycle-tag filtering implemented

### Phase 2: Transport facts

1. Normalize transport legs
2. Add OSRM/Transitous source and cache metadata
3. Calculate mode-specific distance, duration, transfers, and flight totals
4. Label approximate and unknown values

### Phase 3: Offline and packing

1. Explicit offline trip-pack download — existing Settings → Offline sync foundation reused; trip-page shortcut remains
2. Trip data, selected photos, documents, and map-tile status
3. Packing suggestions from local rules and free weather data where available
4. Offline queued mutations and conflict review

### Phase 4: Retrospective and sharing

1. Account travel timeline
2. Photo-first completed-trip views
3. Public trip overview and timeline
4. Redaction, expiration, and revocation tests

## Dropped features

| Feature | Reason |
|---|---|
| Live airline disruption alerts | No dependable fully free source for commercial delays, cancellations, gates, and rebooking data |
| Google Places enrichment | Paid/usage-billed beyond free thresholds and not necessary for the OSM-based baseline |
| Google Calendar synchronization | Explicitly removed from scope |
| Paid routing/aviation fallbacks | Violates the free-only product constraint |

## Acceptance criteria

- No new provider requires payment or a credit card for normal use.
- Provider failures leave the itinerary usable.
- Every external result stores its source and fetch time.
- Public services are cached and rate-limited.
- Approximate and unknown values are visibly labeled.
- Optimizer changes can be reverted in one action immediately and through durable history later.
- Tests cover provider failure, missing data, closed recommendations, optimizer revert, and public-share redaction.
