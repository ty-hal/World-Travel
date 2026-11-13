# Trip Seasons — exploration and proposed plan

Status: prototype implemented and verified. Research reviewed October 31, 2026.

## User outcome

Answer two questions using the user's existing planned trips:

1. “I can travel in September or October. Which trips should I consider?”
2. “When during the year would this itinerary work best?”

The first release compares typical seasonal suitability. It does not predict weather for a particular future year. Trip names in the supplied screenshot establish the route complexity to design for; they are not enough to assign verified seasonal ratings.

## References and what to borrow

| Reference | Observed pattern | TREK application |
| --- | --- | --- |
| [Responsible Travel: where to go when](https://www.responsibletravel.com/holidays/where-to-go-when/travel-guide) | Month navigation and an at-a-glance regional calendar; explanations connect timing with activities, crowds, and weather. | An annual comparison grid plus month-first discovery. |
| [Audley: Japan climate guide](https://www.audleytravel.com/us/japan/best-time-to-visit) | Month-by-month guidance followed by a destination-by-month temperature/rainfall table. Regional and activity differences appear in the guidance. | Trip rows expandable into destination rows; concise reasons beside the seasonal rating. |
| [Weather & Climate: weather planner](https://weather-and-climate.com/weather-planner) | Filters for region, month, temperature, rain, and sunshine. | Start with month selection; add weather preferences only after the basic comparison works. |
| [GoWhereAndWhen](https://gowhereandwhen.com/) | Weather-comfort colors and explicit distinctions between weather, activities, prices, and crowds; grey means missing data. | Explain what the rating measures and make unknown data distinct from poor conditions. |

These are interaction references, not licensed data feeds. Do not scrape or copy their destination advice into TREK.

## Recommended experience

Add a labeled `Seasons` option beside Grid and List in **My Trips → Planned**. Keep the current view as the default. Give the comparison the main content width; collapse dashboard widgets in this view. Reuse the existing navigation rather than adding another top-level tab.

Layout, from top to bottom:

- Title: “When to go”, with “Typical seasonal conditions” as supporting text.
- Controls: trip search, selectable January–December buttons, and Clear. Default to all months with no implicit filter.
- Comparison: a sticky trip-name column and sticky Jan–Dec header. Each compact row shows a thumbnail, title, duration, and 12 seasonal cells. Aim to scan roughly 10–15 trips at a time on desktop.
- Legend: **Best fit**, **Good fit**, **Tradeoffs**, **Challenging**, **Unknown**. Use symbols/patterns and accessible labels alongside color. Avoid “safe/unsafe” or an unexplained 0–100 score.
- Selected-cell detail: trip, month, assessment basis, short explanation, destination breakdown, sources and coverage, and an Open trip link.

Selecting September and October highlights those columns and sorts trips by their best supported fit in **either** month. Display the matching month beside each trip so a strong September does not imply a strong October. Keep all 12 columns visible for comparison. Keep weaker and unknown matches below stronger matches rather than silently removing them. Sorting here never rewrites the user's manual trip order.

A month selection represents alternative travel opportunities. It does not claim that the whole trip fits inside one month or that September–October is one continuous travel interval. Exact departure dates and duration-aware boundary checking are a later step.

Clicking/tapping a cell opens the explanation. Expanding a trip exposes its destination rows on the same month axis. Existing scheduled dates appear as a separate outline with a text label; seasonal fill and scheduled timing remain distinguishable. Viewing or selecting a recommendation never changes dates. Include all planned trips, including any spotlight trip normally removed from the dashboard's remaining-card list.

On mobile, default to the selected month's ranked trip list with a compact 12-month strip per trip. Allow selecting another month and expanding the same explanations. Do not require a miniature desktop matrix to answer the core question. All month controls and detail actions work by keyboard and touch, with no hover-only information.

## Route-aware recommendations

The routes in the screenshot show why one country or capital-city lookup is insufficient: Peru plus Easter Island, three Central Asian countries, and Iceland plus Norway can each have competing seasonal windows.

- Resolve geography from itinerary places and their existing day assignments. Show which destinations were used; let the user correct or supply representative destinations when needed.
- Do not average coordinates across a route or infer the entire route from its title. Multiple attractions in one city should not give that city more influence than a longer stay elsewhere.
- For a complete itinerary, weight destination assessments by assigned itinerary days. If stay lengths are unavailable, use equal destination weights and label that assumption.
- Surface the weakest important leg alongside the overall assessment. A high average must not conceal a challenging required destination. Keep such a trip out of “Best fit” until the tradeoff is explained.
- Incomplete destination coverage yields a clearly labeled partial assessment; it cannot become a confidently recommended whole trip. No usable geography yields Unknown and a Select destinations action.
- Missing ratings are not zero scores. Show coverage separately from seasonal suitability, and distinguish user overrides from derived assessments.

The first release should offer a general sightseeing/weather basis. Hiking access, skiing, aurora, wildlife and festivals need their own sourced guidance; a warm/dry score cannot represent them. Add these as explicit goals later rather than guessing from a trip title.

## Data approach

Start with reviewed monthly destination profiles for a small validation set. Store source URL, assessment basis, region/coordinates, monthly category and reason, review date, and any user override separately from trip dates. The mockup's data must be labeled illustrative until reviewed. Use generic fixtures in committed tests, not the user's account export.

For wider coverage, use the existing Open-Meteo monthly archive aggregation over two complete years, on one representative coordinate per ~1° cell. Long requests count as multiple calls: a two-year daily request costs roughly 53 calls per location, even when several locations share an HTTP request (about 80% fewer estimated units than ten years). The backend caps estimated usage at 3,000/day, not raw HTTP requests, and pauses an unqualified 429 until the next UTC day. Two years is a recent seasonal baseline, not a climate normal, so label the period in the UI and avoid implying long-term climate certainty. See the [official pricing and call definition](https://open-meteo.com/en/pricing) and [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api).

Suggested pipeline: fetch historical observations/reanalysis → validate units, local dates, missing values and coverage → compute monthly temperature and precipitation summaries → apply a documented sightseeing rubric → combine destination assessments for the trip. Retain provider, dataset, reference years, coordinates, rubric version, and coverage with the derived result. Do not fill missing precipitation with zero.

Historical weather can support a **weather fit** assessment. It cannot establish live prices, crowd levels, seasonal road access or event dates. Keep those unknown until separately sourced. Monthly averages also cannot prove the absence of storms, extremes or other hazards.

Cache by destination coordinates, dataset, reference period and rubric version, with trip summaries invalidated by relevant route edits. Batch/cache shared destinations and bound provider concurrency. Load cached summaries first; provider failure must leave the planned-trip list usable and show unavailable or dated cached results. Send only required coordinates to a weather provider, never trip titles, notes, bookings or member details.

## Fit with the current repository

| Existing surface | Proposed use/change |
| --- | --- |
| `client/src/pages/DashboardPage.tsx` | Add Seasons view control and comparison container; reuse trip opening and dashboard styling. |
| `client/src/pages/dashboard/useDashboard.ts` | Extend persisted grid/list view state; derive the full planned-trip input including spotlight; keep seasonal sorting separate from manual priority. |
| `client/src/pages/dashboard/dashboardModel.ts` | Reuse trip status/duration helpers; keep new comparison logic small and separately testable. |
| `shared/src/trip/trip.schema.ts`, `shared/src/place/place.schema.ts` | Existing nullable trip dates, day count, and place coordinates support open-date planning. Add a dedicated validated seasonality response contract rather than overloading date fields. |
| `server/src/services/weatherService.ts` | Reuse provider conventions and error handling. Its current far-future branch samples approximately five days in one earlier year; do not use that result as monthly climate normals. |
| `server/src/services/travelTimelineService.ts` | This is a dated account activity/history feed. Seasonal suitability should have a separate response and UI. |
| Nest routes, service/database layer, client API and repository/cache | Add authorized summary retrieval, profile persistence/cache, and destination corrections using existing house patterns. Enforce trip membership and editor permissions on writes. |
| Dashboard translations/styles/tests and `client/e2e/screenshots/` | Add labels, keyboard/mobile states, generic fixtures, unit/integration coverage and isolated screenshots. |

No chart library is needed for 12 categorical month cells per row. A semantic table with native buttons and the existing components/styles is sufficient.

## Delivery stages

1. **Validate the interaction.** Build a contained prototype with generic reviewed/illustrative profiles, month selection, route expansion and mobile rendering. Check that someone can shortlist trips for September/October without opening every itinerary. No account edits.
2. **Ship a useful small release.** Add profile storage and an authorized summary endpoint, wire real planned trips and geography, show sources/unknown states, and allow destination corrections and editor-owned overrides. Keep coverage explicit rather than manufacturing ratings.
3. **Expand climate coverage.** Add multi-year aggregation, caching, the published rubric and route aggregation. Compare outputs against reviewed profiles, including conflicting climates, before enabling automatic recommendations broadly.
4. **Connect to scheduling.** Add an explicit year/date-range flow using trip duration and itinerary day offsets across month/year boundaries. Offer Set dates through the existing date-edit behavior, with reservation-shift rules preserved. Consider PTO/calendar overlays and activity-specific goals only after the seasonal comparison proves useful.

## Acceptance and verification plan

- Tens of planned trips remain searchable and comparable, including open dates, partial dates and the spotlight trip. Archive/completed behavior stays consistent with existing filters.
- Selecting Sep + Oct ranks on either month's supported assessment and shows which month matched; clearing restores the unfiltered view. It never persists a new manual trip order.
- Nov–Feb season windows, cross-month trips, missing coordinates, incomplete routes, duplicate attractions, provider failures and overrides have deliberate states. Exact trip-fit claims wait for date-aware evaluation.
- A route with a challenging required leg is visibly qualified; missing data cannot rank as a confident best choice.
- Service tests verify monthly denominators, missing precipitation, units, coverage, cache keys/invalidation, and permission boundaries. Client tests verify selection, ordering, details and view persistence.
- Use existing Vitest/server tests and `make check` for implementation. Run `make capture` with the isolated E2E stack and inspect desktop/mobile screenshots, keyboard focus, contrast, long titles, dark/light themes, and unknown/partial states. No new testing framework.

## Scope and remaining decisions

Recommended starting scope: My Trips Seasons view, all-year comparison, month selection, route breakdown and sourced explanations. Defer map mode, AI chat, airfare predictions, numerical preference sliders and automatic rescheduling.

The prototype now reads assigned trip locations, groups nearby attractions, and compares historical monthly climate using the Open-Meteo ERA5 archive. It uses assigned itinerary days for route weighting, reports missing destination coverage, and keeps seasonality separate from scheduled dates. The heuristic still needs review against representative multi-region routes before production use. Open-Meteo requires attribution; the UI links the source and identifies its transformed weather-fit rating. Its [free API is restricted to non-commercial use](https://open-meteo.com/en/terms), and its pricing page says historical data requires the Professional plan or higher. Confirm deployment terms and configure a licensed provider plan before enabling this for a commercial service. The prototype does not access or change the live account. Focused desktop and mobile screenshot cases exercise the comparison using deterministic climate responses; the full screenshot suite was not run to completion. Focused client, dashboard, weather service/controller tests and typechecks passed, and the client production build succeeded. The repository `make check` currently stops at formatting: it reports 323 existing file-format mismatches and a server `test/**/*.ts` glob with no matches. A direct full-suite attempt also hit sandbox `EPERM` errors when server integration tests opened local listeners.
