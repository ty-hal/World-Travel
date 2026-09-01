import path from 'node:path'
import type { APIRequestContext } from '@playwright/test'

/**
 * Demo data for the documentation screenshots.
 *
 * Seeded over the REST API (not the DB) so it exercises the same paths a real
 * user would and stays honest about validation. The session cookie comes from
 * the storageState that auth.setup.ts writes, so `page.request` is already
 * authenticated as the seeded admin.
 *
 * Design notes that matter for the screenshots:
 *  - The trip is in **JPY**, deliberately. A EUR trip hides the entire v3.4.0
 *    currency rework (per-trip currency, frozen FX rates, foreign-currency
 *    settle-up) — the reader would see nothing new.
 *  - Two extra members exist so splits, avatars and sharing tiers render with
 *    real names instead of a lonely single-user state.
 *  - Dates sit ~2 months out so "upcoming" surfaces (What's Next, reservations)
 *    have something to show.
 */

const TRIP = {
  title: 'Autumn in Japan',
  description: 'Two weeks chasing momiji season from Tokyo down to Kyoto.',
  start_date: '2026-09-12',
  end_date: '2026-09-21',
  currency: 'JPY',
  reminder_days: 3,
}

const MEMBERS = [
  { username: 'mira', email: 'mira@example.com', password: 'DemoSeed12345!', role: 'user' },
  { username: 'jonas', email: 'jonas@example.com', password: 'DemoSeed12345!', role: 'user' },
]

/** Real coordinates — the map surfaces are a big part of what we're capturing. */
const PLACES = [
  { name: 'Senso-ji Temple', lat: 35.7148, lng: 139.7967, address: '2-3-1 Asakusa, Taito City, Tokyo',
    description: "Tokyo's oldest temple, approached through the Nakamise shopping street.",
    notes: 'Go before 08:00 — the gate is empty and the light is better.',
    duration_minutes: 90, price: 0, currency: 'JPY', day: 0, place_time: '08:00' },
  { name: 'teamLab Planets', lat: 35.6486, lng: 139.7900, address: '6-1-16 Toyosu, Koto City, Tokyo',
    description: 'Immersive digital art museum you walk through barefoot.',
    notes: 'Timed entry — book at least a week ahead.',
    duration_minutes: 120, price: 3800, currency: 'JPY', day: 0, place_time: '14:00', end_time: '16:00' },
  { name: 'Shibuya Crossing', lat: 35.6595, lng: 139.7005, address: 'Shibuya City, Tokyo',
    description: 'The scramble. Best viewed from the Shibuya Sky observation deck.',
    duration_minutes: 45, price: 0, currency: 'JPY', day: 1, place_time: '10:30' },
  { name: 'Meiji Jingu', lat: 35.6764, lng: 139.6993, address: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo',
    description: 'Forest shrine in the middle of the city.',
    duration_minutes: 75, price: 0, currency: 'JPY', day: 1, place_time: '09:00', end_time: '10:15' },
  { name: 'Fushimi Inari Taisha', lat: 34.9671, lng: 135.7727, address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto',
    description: 'Thousands of vermilion torii gates climbing Mount Inari.',
    notes: 'The crowds thin out after the first 20 minutes of climbing.',
    duration_minutes: 150, price: 0, currency: 'JPY', day: 4, place_time: '07:30' },
  { name: 'Arashiyama Bamboo Grove', lat: 35.0170, lng: 135.6716, address: 'Ukyo Ward, Kyoto',
    description: 'Bamboo path leading to the Okochi Sanso villa gardens.',
    duration_minutes: 60, price: 0, currency: 'JPY', day: 5, place_time: '08:00' },
  { name: 'Nishiki Market', lat: 35.0050, lng: 135.7649, address: 'Nakagyo Ward, Kyoto',
    description: "Five covered blocks of food stalls — 'Kyoto's kitchen'.",
    notes: 'Come hungry. Try the tamagoyaki.',
    duration_minutes: 90, price: 2500, currency: 'JPY', day: 5, place_time: '11:00', end_time: '12:30' },
]

const EXPENSES = [
  { name: 'Flights FRA → HND', category: 'transport', total_price: 890, currency: 'EUR',
    expense_date: '2026-09-12', note: 'Booked with miles, taxes only.' },
  { name: 'Ryokan in Hakone', category: 'accommodation', total_price: 48000, currency: 'JPY',
    expense_date: '2026-09-15', note: '2 nights, kaiseki dinner included.' },
  { name: 'JR Pass (14 days)', category: 'transport', total_price: 80000, currency: 'JPY',
    expense_date: '2026-09-12', note: 'Green car, activated on arrival.' },
  { name: 'teamLab Planets tickets', category: 'activities', total_price: 11400, currency: 'JPY',
    expense_date: '2026-09-13' },
  { name: 'Dinner at Nishiki', category: 'food', total_price: 7200, currency: 'JPY',
    expense_date: '2026-09-17' },
]

const PACKING = [
  { category: 'Documents', items: ['Passport', 'JR Pass voucher', 'Travel insurance'] },
  { category: 'Clothing', items: ['Rain jacket', 'Walking shoes', 'Light layers'] },
  { category: 'Electronics', items: ['Type-A adapter', 'Power bank', 'Camera'] },
]

const TODOS = [
  { name: 'Book teamLab Planets slot', category: 'Before departure', due_date: '2026-08-15', priority: 2 },
  { name: 'Activate JR Pass', category: 'On arrival', due_date: '2026-09-12', priority: 1 },
  { name: 'Reserve ryokan dinner', category: 'Before departure', due_date: '2026-08-20' },
]

const EXTRA_TRIPS = [
  {
    title: 'Mediterranean Highlights',
    description: 'Ten days through Rome, Florence, and Athens — ruins, food, and ferries.',
    start_date: '2026-05-04',
    end_date: '2026-05-13',
    currency: 'EUR',
    reminder_days: 5,
    places: [
      { name: 'Colosseum', lat: 41.8902, lng: 12.4922, address: 'Piazza del Colosseo, Rome',
        description: 'Roman amphitheatre — book the underground tour.', duration_minutes: 120, price: 24, currency: 'EUR', day: 0 },
      { name: 'Vatican Museums', lat: 41.9065, lng: 12.4536, address: 'Vatican City',
        description: 'Sistine Chapel and Raphael Rooms.', duration_minutes: 180, price: 20, currency: 'EUR', day: 1 },
      { name: 'Pompeii Archaeological Park', lat: 40.7489, lng: 14.4897, address: 'Pompeii',
        description: 'Frozen Roman city under Vesuvius.', duration_minutes: 240, price: 18, currency: 'EUR', day: 3 },
      { name: 'Acropolis of Athens', lat: 37.9715, lng: 23.7267, address: 'Athens',
        description: 'Parthenon at sunrise before the cruise ships arrive.', duration_minutes: 150, price: 15, currency: 'EUR', day: 7 },
    ],
    expenses: [
      { name: 'Rome apartment (4 nights)', category: 'accommodation', total_price: 620, currency: 'EUR', expense_date: '2026-05-04' },
      { name: 'Athens ferry', category: 'transport', total_price: 89, currency: 'EUR', expense_date: '2026-05-10' },
      { name: 'Trattoria dinner', category: 'food', total_price: 112, currency: 'EUR', expense_date: '2026-05-05' },
    ],
    bookings: [
      { title: 'Hotel Artemide Rome', type: 'hotel', reservation_time: '2026-05-04T15:00:00', location: 'Rome',
        confirmation_number: 'ART-44921', status: 'confirmed', day: 0 },
      { title: 'Vatican timed entry', type: 'activity', reservation_time: '2026-05-05T09:00:00', location: 'Vatican City',
        confirmation_number: 'VAT-88310', status: 'confirmed', day: 1 },
      { title: 'Athens Plaka Hotel', type: 'hotel', reservation_time: '2026-05-10T14:00:00', location: 'Athens',
        confirmation_number: 'PLK-22018', status: 'confirmed', day: 7 },
    ],
    transports: [
      { title: 'AZ611 FCO → ATH', type: 'flight', reservation_time: '2026-05-10T10:35:00',
        reservation_end_time: '2026-05-10T13:50:00', confirmation_number: 'AZ611', status: 'confirmed',
        location: 'Rome Fiumicino', metadata: { airline: 'ITA Airways', flight_number: 'AZ611' },
        endpoints: [
          { role: 'from', sequence: 0, name: 'Rome Fiumicino', code: 'FCO', lat: 41.8003, lng: 12.2389, timezone: 'Europe/Rome', local_date: '2026-05-10', local_time: '10:35' },
          { role: 'to', sequence: 1, name: 'Athens International', code: 'ATH', lat: 37.9364, lng: 23.9445, timezone: 'Europe/Athens', local_date: '2026-05-10', local_time: '13:50' },
        ] },
    ],
  },
  {
    title: 'American Southwest',
    description: 'National parks loop: Zion, Bryce, and the Grand Canyon.',
    start_date: '2027-03-18',
    end_date: '2027-03-25',
    currency: 'USD',
    reminder_days: 7,
    places: [
      { name: 'Zion Canyon Scenic Drive', lat: 37.2982, lng: -113.0263, address: 'Zion National Park, UT',
        description: 'Shuttle up the canyon to the Narrows trailhead.', duration_minutes: 180, price: 0, currency: 'USD', day: 1 },
      { name: 'Grand Canyon South Rim', lat: 36.0544, lng: -112.1401, address: 'Grand Canyon Village, AZ',
        description: 'Mather Point at golden hour.', duration_minutes: 120, price: 35, currency: 'USD', day: 4 },
      { name: 'Bryce Amphitheater', lat: 37.593, lng: -112.1871, address: 'Bryce Canyon National Park, UT',
        description: 'Sunrise over the hoodoos.', duration_minutes: 90, price: 0, currency: 'USD', day: 3 },
    ],
    expenses: [
      { name: 'SUV rental (8 days)', category: 'transport', total_price: 412, currency: 'USD', expense_date: '2027-03-18' },
      { name: 'Zion lodge', category: 'accommodation', total_price: 289, currency: 'USD', expense_date: '2027-03-19' },
    ],
    bookings: [
      { title: 'Zion Lodge', type: 'hotel', reservation_time: '2027-03-19T16:00:00', location: 'Springdale, UT',
        confirmation_number: 'ZION-7712', status: 'confirmed', day: 1 },
      { title: 'Grand Canyon mule ride', type: 'activity', reservation_time: '2027-03-22T08:00:00', location: 'South Rim',
        confirmation_number: 'GC-MULE-04', status: 'confirmed', day: 4 },
    ],
    transports: [],
  },
  {
    title: 'India Temple Circuit',
    description: 'Rock-cut marvels and Mughal architecture across Maharashtra and Uttar Pradesh.',
    start_date: '2027-11-08',
    end_date: '2027-11-14',
    currency: 'INR',
    reminder_days: 14,
    places: [
      { name: 'Kailasa Temple', lat: 20.024, lng: 75.1793, address: 'Ellora Caves, Maharashtra',
        description: 'Monolithic rock-cut temple dedicated to Shiva — Cave 16 at Ellora.',
        duration_minutes: 180, price: 600, currency: 'INR', day: 0 },
      { name: 'Taj Mahal', lat: 27.1751, lng: 78.0421, address: 'Agra, Uttar Pradesh',
        description: 'Mughal mausoleum at dawn before the tour buses arrive.', duration_minutes: 150, price: 1100, currency: 'INR', day: 3 },
    ],
    expenses: [
      { name: 'Aurangabad guesthouse', category: 'accommodation', total_price: 18500, currency: 'INR', expense_date: '2027-11-08' },
      { name: 'Agra hotel', category: 'accommodation', total_price: 22000, currency: 'INR', expense_date: '2027-11-11' },
    ],
    bookings: [
      { title: 'Ellora guided tour', type: 'activity', reservation_time: '2027-11-09T08:30:00', location: 'Ellora',
        confirmation_number: 'ELL-1609', status: 'confirmed', day: 0 },
      { title: 'Taj Mahal sunrise entry', type: 'activity', reservation_time: '2027-11-12T06:00:00', location: 'Agra',
        confirmation_number: 'TAJ-0600', status: 'confirmed', day: 3 },
    ],
    transports: [
      { title: 'AI 644 BOM → IXU', type: 'flight', reservation_time: '2027-11-08T07:15:00',
        reservation_end_time: '2027-11-08T08:20:00', confirmation_number: 'AI644', status: 'confirmed',
        location: 'Mumbai', metadata: { airline: 'Air India', flight_number: '644' },
        endpoints: [
          { role: 'from', sequence: 0, name: 'Mumbai', code: 'BOM', lat: 19.0896, lng: 72.8656, timezone: 'Asia/Kolkata', local_date: '2027-11-08', local_time: '07:15' },
          { role: 'to', sequence: 1, name: 'Aurangabad', code: 'IXU', lat: 19.8627, lng: 75.3981, timezone: 'Asia/Kolkata', local_date: '2027-11-08', local_time: '08:20' },
        ] },
    ],
  },
]

const ATLAS_COUNTRIES = ['JP', 'DE', 'FR', 'IT', 'ES', 'US', 'GB', 'GR', 'PT', 'NL', 'AT', 'CH', 'MX', 'EG', 'JO', 'IN']

const ATLAS_REGIONS = [
  { code: 'DE-BY', name: 'Bavaria', country_code: 'DE' },
  { code: 'DE-NW', name: 'North Rhine-Westphalia', country_code: 'DE' },
  { code: 'US-AZ', name: 'Arizona', country_code: 'US' },
]

const BUCKET_LIST = [
  { name: 'Patagonia W Trek', country_code: 'CL', lat: -51.253, lng: -72.331, notes: 'Torres del Paine circuit', target_date: '2028-01-15' },
  { name: 'Santorini caldera hike', country_code: 'GR', lat: 36.3932, lng: 25.4615, target_date: '2027-06-01' },
  { name: 'Petra by night', country_code: 'JO', lat: 30.322, lng: 35.4517, notes: 'Candle-lit Siq', target_date: '2027-04-10' },
  { name: 'Banff Icefields Parkway', country_code: 'CA', lat: 51.4968, lng: -115.9281, target_date: '2027-09-01' },
  { name: 'Lofoten midnight sun', country_code: 'NO', lat: 68.15, lng: 13.61, target_date: '2028-06-21' },
]

/** Places pinned on wonder coordinates so Atlas marks them visited (within ~2 km). */
const WONDER_TOUCHPOINTS = [
  { name: 'Horyu-ji Temple', lat: 34.6147, lng: 135.7358, address: 'Nara, Japan', day: 6 },
  { name: 'Itsukushima Shrine', lat: 34.2958, lng: 132.3199, address: 'Miyajima, Japan', day: 8 },
  { name: 'Todai-ji Great Buddha', lat: 34.689, lng: 135.8398, address: 'Nara, Japan', day: 6 },
]

const JAPAN_BOOKINGS = [
  { title: 'Hotel Granvia Kyoto', type: 'hotel', reservation_time: '2026-09-15T15:00:00', location: 'Kyoto Station',
    confirmation_number: 'GRV-90214', status: 'confirmed', day: 3 },
  { title: 'Gion kaiseki dinner', type: 'restaurant', reservation_time: '2026-09-16T18:30:00', location: 'Kyoto',
    confirmation_number: 'GION-551', status: 'confirmed', day: 5 },
  { title: 'teamLab Planets entry', type: 'activity', reservation_time: '2026-09-13T14:00:00', location: 'Toyosu, Tokyo',
    confirmation_number: 'TLP-1400', status: 'confirmed', day: 0 },
  { title: 'Hakone ryokan stay', type: 'hotel', reservation_time: '2026-09-14T16:00:00', location: 'Hakone',
    confirmation_number: 'HAK-7781', status: 'confirmed', day: 2 },
]

const JAPAN_TRANSPORTS = [
  {
    title: 'Nozomi 204 Tokyo → Kyoto',
    type: 'train',
    reservation_time: '2026-09-15T09:33:00',
    reservation_end_time: '2026-09-15T11:44:00',
    confirmation_number: 'JR-N204',
    status: 'confirmed',
    location: 'Tokyo Station',
    metadata: { operator: 'JR Central', train_number: '204' },
    endpoints: [
      { role: 'from', sequence: 0, name: 'Tokyo Station', code: 'TYO', lat: 35.6812, lng: 139.7671, timezone: 'Asia/Tokyo', local_date: '2026-09-15', local_time: '09:33' },
      { role: 'to', sequence: 1, name: 'Kyoto Station', code: 'KYO', lat: 34.9858, lng: 135.7588, timezone: 'Asia/Tokyo', local_date: '2026-09-15', local_time: '11:44' },
    ],
  },
]

export interface SeedResult {
  tripId: number
  tripIds: number[]
  memberIds: number[]
  dayIds: number[]
  placeIds: number[]
  collectionId?: number
  collectionIds?: number[]
}

/** Throws with the response body on failure — a silent 4xx here would produce
 *  a screenshot of an empty screen, which is worse than a loud crash. */
async function call<T>(api: APIRequestContext, method: 'post' | 'put' | 'get' | 'patch',
                       path: string, body?: unknown): Promise<T> {
  const res = await api[method](path, body === undefined ? {} : { data: body })
  if (!res.ok()) {
    throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}\n${await res.text()}`)
  }
  return (await res.json()) as T
}

export type ContextFactory = (token?: string) => Promise<APIRequestContext>

type PlaceSeed = typeof PLACES[number] & { place_time?: string; end_time?: string }
type BookingSeed = typeof JAPAN_BOOKINGS[number]
type TransportSeed = typeof JAPAN_TRANSPORTS[number]

async function seedPlacesOnTrip(
  api: APIRequestContext,
  tripId: number,
  dayIds: number[],
  places: PlaceSeed[],
): Promise<number[]> {
  const placeIds: number[] = []
  for (const p of places) {
    const { day, place_time, end_time, ...payload } = p
    const { place } = await call<{ place: { id: number } }>(
      api, 'post', `/api/trips/${tripId}/places`, payload)
    placeIds.push(place.id)
    const dayId = dayIds[day]
    if (dayId) {
      const assigned = await call<{ assignment?: { id: number }; id?: number }>(
        api, 'post', `/api/trips/${tripId}/days/${dayId}/assignments`,
        { place_id: place.id }).catch(() => null)
      const assignmentId = assigned?.assignment?.id ?? assigned?.id
      if (assignmentId && place_time) {
        await call(api, 'put', `/api/trips/${tripId}/assignments/${assignmentId}/time`, {
          place_time,
          end_time: end_time || null,
        }).catch(() => {})
      }
    }
  }
  return placeIds
}

async function seedTripFiles(api: APIRequestContext, tripId: number): Promise<void> {
  const uploads: Array<{ name: string; mimeType: string; body: string; description: string }> = [
    { name: 'teamLab-tickets.pdf', mimeType: 'application/pdf', body: '%PDF-1.4 teamLab confirmation', description: 'teamLab Planets entry tickets' },
    { name: 'jr-pass-voucher.pdf', mimeType: 'application/pdf', body: '%PDF-1.4 JR Pass voucher', description: 'JR Pass exchange voucher' },
    { name: 'travel-insurance.txt', mimeType: 'text/plain', body: 'Policy #WT-88291 — valid through 2026-10-01', description: 'Travel insurance policy summary' },
  ]
  for (const file of uploads) {
    const res = await api.post(`/api/trips/${tripId}/files`, {
      multipart: {
        file: { name: file.name, mimeType: file.mimeType, buffer: Buffer.from(file.body) },
        description: file.description,
      },
    })
    if (!res.ok()) {
      console.log(`seed file ${file.name} → ${res.status()} ${await res.text()}`)
    }
  }
}

async function seedBookingsForTrip(
  api: APIRequestContext,
  tripId: number,
  dayIds: number[],
  bookings: BookingSeed[],
): Promise<void> {
  for (const booking of bookings) {
    const { day, ...payload } = booking
    const dayId = dayIds[day]
    await call(api, 'post', `/api/trips/${tripId}/reservations`, {
      ...payload,
      ...(dayId ? { day_id: dayId } : {}),
    }).catch(() => {})
  }
}

async function seedTransportsForTrip(
  api: APIRequestContext,
  tripId: number,
  transports: TransportSeed[],
): Promise<void> {
  for (const transport of transports) {
    await call(api, 'post', `/api/trips/${tripId}/reservations`, transport).catch(() => {})
  }
}

async function seedExpensesForTrip(
  api: APIRequestContext,
  tripId: number,
  memberIds: number[],
  expenses: typeof EXPENSES,
): Promise<void> {
  const allMembers = [1, ...memberIds]
  for (const e of expenses) {
    await call(api, 'post', `/api/trips/${tripId}/budget`, {
      ...e,
      payers: [{ user_id: 1, amount: e.total_price }],
      member_ids: allMembers,
    }).catch(() => {})
  }
}

async function seedAtlasLandscape(api: APIRequestContext): Promise<void> {
  for (const code of ATLAS_COUNTRIES) {
    await call(api, 'post', `/api/addons/atlas/country/${code}/mark`).catch(() => {})
  }
  for (const region of ATLAS_REGIONS) {
    await call(api, 'post', `/api/addons/atlas/region/${region.code}/mark`, {
      name: region.name,
      country_code: region.country_code,
    }).catch(() => {})
  }
  for (const item of BUCKET_LIST) {
    await call(api, 'post', '/api/addons/atlas/bucket-list', item).catch(() => {})
  }
}

async function seedExtraTrip(
  api: APIRequestContext,
  memberIds: number[],
  def: typeof EXTRA_TRIPS[number],
): Promise<{ tripId: number; placeIds: number[] }> {
  const { places, expenses, bookings, transports, ...trip } = def
  const { trip: created } = await call<{ trip: { id: number } }>(api, 'post', '/api/trips', trip)
  const tripId = created.id

  for (const m of MEMBERS) {
    await call(api, 'post', `/api/trips/${tripId}/members`, { identifier: m.email }).catch(() => {})
  }

  const days = await call<Array<{ id: number }> | { days: Array<{ id: number }> }>(
    api, 'get', `/api/trips/${tripId}/days`)
  const dayIds = (Array.isArray(days) ? days : days.days).map(d => d.id)

  const placeIds = await seedPlacesOnTrip(api, tripId, dayIds, places as PlaceSeed[])
  await seedExpensesForTrip(api, tripId, memberIds, expenses as typeof EXPENSES)
  await seedBookingsForTrip(api, tripId, dayIds, bookings as BookingSeed[])
  await seedTransportsForTrip(api, tripId, transports as TransportSeed[])

  return { tripId, placeIds }
}

export async function seedDemoData(
  api: APIRequestContext,
  newContext?: ContextFactory,
): Promise<SeedResult> {
  // 1. Addons first — the Collections and Journey guards run ahead of auth, so
  //    every later call to those modules 403s until these are flipped.
  for (const id of ['collections', 'packing', 'budget', 'atlas', 'vacay', 'mcp', 'documents', 'collab']) {
    await call(api, 'put', `/api/admin/addons/${id}`, { enabled: true })
  }
  await call(api, 'put', '/api/admin/bag-tracking', { enabled: true }).catch(() => {})

  // 1b. Units, pinned explicitly so the screenshots don't silently change meaning
  //     when a default does. They match the current defaults (ba3733da made
  //     celsius/metric/24h consistent across the store and the settings UI) —
  //     stating them here keeps the captures reproducible either way.
  await call(api, 'post', '/api/settings/bulk', {
    settings: { temperature_unit: 'celsius', distance_unit: 'metric' },
  })

  // 2. Extra members. Ignore 409 so a re-run against a warm DB still works.
  const memberIds: number[] = []
  for (const m of MEMBERS) {
    const res = await api.post('/api/admin/users', { data: m })
    if (res.ok()) {
      const { user } = (await res.json()) as { user: { id: number } }
      memberIds.push(user.id)
    } else if (res.status() !== 409) {
      throw new Error(`create user ${m.username} → ${res.status()}\n${await res.text()}`)
    }
  }

  // 3. The trip, in JPY.
  const { trip } = await call<{ trip: { id: number } }>(api, 'post', '/api/trips', TRIP)
  const tripId = trip.id

  for (const m of MEMBERS) {
    await call(api, 'post', `/api/trips/${tripId}/members`, { identifier: m.email }).catch(() => {})
  }

  // 4. Days are auto-generated by trip creation — read them back for assignment.
  const days = await call<Array<{ id: number }> | { days: Array<{ id: number }> }>(
    api, 'get', `/api/trips/${tripId}/days`)
  const dayIds = (Array.isArray(days) ? days : days.days).map(d => d.id)

  // 5. Places, then pin each onto its day.
  const placeIds = await seedPlacesOnTrip(api, tripId, dayIds, PLACES)
  const wonderPlaceIds = await seedPlacesOnTrip(api, tripId, dayIds, WONDER_TOUCHPOINTS as PlaceSeed[])
  placeIds.push(...wonderPlaceIds)

  // 6. A day note, so the itinerary shows more than places.
  if (dayIds[0]) {
    await call(api, 'post', `/api/trips/${tripId}/days/${dayIds[0]}/notes`, {
      text: 'Pick up the JR Pass at the airport counter before taking the train in.',
      time: '08:15', icon: 'train',
    }).catch(() => {})
  }

  // 7. Costs. Split across everyone so the settle-up view has real balances.
  await seedExpensesForTrip(api, tripId, memberIds, EXPENSES)

  // A foreign-currency settle-up payment — the v3.4.0 feature worth showing.
  if (memberIds[0]) {
    await call(api, 'post', `/api/trips/${tripId}/budget/settlements`, {
      from_user_id: memberIds[0], to_user_id: 1, amount: 120, currency: 'EUR',
    }).catch(() => {})
  }

  // 8. Packing — category is free text on the item, there is no category resource.
  for (const group of PACKING) {
    for (const name of group.items) {
      await call(api, 'post', `/api/trips/${tripId}/packing`, {
        name, category: group.category, visibility: 'common',
      }).catch(() => {})
    }
  }

  for (const t of TODOS) {
    await call(api, 'post', `/api/trips/${tripId}/todo`, t).catch(() => {})
  }

  // 9. Bookings (hotels, restaurants, activities) and extra transports.
  await seedBookingsForTrip(api, tripId, dayIds, JAPAN_BOOKINGS)
  await seedTransportsForTrip(api, tripId, JAPAN_TRANSPORTS)
  await seedTripFiles(api, tripId)

  // 10. A multi-leg flight. Coordinates are mandatory — endpoints without them
  //    are silently dropped by the server, leaving a booking with no route.
  await call(api, 'post', `/api/trips/${tripId}/reservations`, {
    title: 'LH716 FRA → HND',
    type: 'flight',
    reservation_time: '2026-09-12T13:05:00',
    reservation_end_time: '2026-09-13T08:25:00',
    confirmation_number: 'X7K2QP',
    status: 'confirmed',
    location: 'Frankfurt Airport',
    metadata: { airline: 'Lufthansa', flight_number: 'LH716',
                departure_airport: 'FRA', arrival_airport: 'HND' },
    endpoints: [
      { role: 'from', sequence: 0, name: 'Frankfurt Airport', code: 'FRA',
        lat: 50.0379, lng: 8.5622, timezone: 'Europe/Berlin',
        local_date: '2026-09-12', local_time: '13:05' },
      { role: 'to', sequence: 1, name: 'Tokyo Haneda', code: 'HND',
        lat: 35.5494, lng: 139.7798, timezone: 'Asia/Tokyo',
        local_date: '2026-09-13', local_time: '08:25' },
    ],
  }).catch(() => {})

  // 11. A collection, populated from the trip's own places.
  const collectionIds: number[] = []
  let collectionId: number | undefined
  try {
    const created = await call<{ id: number } | { collection: { id: number } }>(
      api, 'post', '/api/addons/collections',
      { name: 'Kyoto shortlist', description: 'Places we want to reach on the second week.',
        color: '#ef4444', icon: 'MapPin' })
    collectionId = 'id' in created ? created.id : created.collection.id
    collectionIds.push(collectionId)
    for (const placeId of placeIds.slice(4)) {
      await call(api, 'post', '/api/addons/collections/places/from-trip', {
        collection_id: collectionId, source_trip_id: tripId, source_place_id: placeId, force: true,
      }).catch(() => {})
    }

    const tokyo = await call<{ id: number } | { collection: { id: number } }>(
      api, 'post', '/api/addons/collections',
      { name: 'Tokyo first-timer hits', description: 'Temples, crossings, and digital art.',
        color: '#2563eb', icon: 'Sparkles' })
    const tokyoId = 'id' in tokyo ? tokyo.id : tokyo.collection.id
    collectionIds.push(tokyoId)
    for (const placeId of placeIds.slice(0, 4)) {
      await call(api, 'post', '/api/addons/collections/places/from-trip', {
        collection_id: tokyoId, source_trip_id: tripId, source_place_id: placeId, force: true,
      }).catch(() => {})
    }
  } catch { /* collections addon unavailable — screenshots for it will be skipped */ }

  // 12. More trips + atlas stats/bucket list for a data-rich dashboard.
  const extraResults: Array<{ tripId: number; placeIds: number[] }> = []
  const extraTripIds: number[] = []
  for (const extra of EXTRA_TRIPS) {
    const seeded = await seedExtraTrip(api, memberIds, extra)
    extraTripIds.push(seeded.tripId)
    extraResults.push(seeded)
  }
  await seedAtlasLandscape(api)

  // 13. Collab: chat, notes and polls.
  //
  //      Chat is only convincing with more than one voice, and every collab
  //      write is attributed to the acting user — so messages and votes are
  //      posted as the members themselves, via their own bearer tokens, not as
  //      the admin. A single-speaker chat log would misrepresent the feature.
  //      Each member gets its OWN request context. Logging in through the shared
  //      one would set the trek_session cookie on it, and extractToken()
  //      (server/src/middleware/auth.ts:9) reads the cookie BEFORE the
  //      Authorization header — so every later write, including the admin's,
  //      would silently be attributed to whoever logged in last.
  const members: Record<string, APIRequestContext> = {}
  for (const m of MEMBERS) {
    if (!newContext) break
    const anon = await newContext()
    const res = await anon.post('/api/auth/login', { data: { email: m.email, password: m.password } })
    if (!res.ok()) { await anon.dispose(); continue }
    const { token } = (await res.json()) as { token?: string }
    await anon.dispose()
    if (token) members[m.username] = await newContext(token)
  }
  /** The member's own context, or the admin's as a visible fallback. */
  const as = (username: string): APIRequestContext => members[username] ?? api

  const collab = `/api/trips/${tripId}/collab`

  for (const n of [
    { title: 'Rail passes', category: 'Transport', color: '#3b82f6',
      content: 'The 14-day JR Pass covers the Tokyo–Kyoto legs. Activate it at the airport counter on arrival, not before.' },
    { title: 'Ryokan etiquette', category: 'Accommodation', color: '#ef4444',
      content: 'Shoes off at the entrance, yukata for dinner. Dinner is served at 18:30 sharp — being late is genuinely rude.' },
    { title: 'Rainy-day alternatives', category: 'Ideas', color: '#22c55e',
      content: 'teamLab Planets, the Kyoto Railway Museum and Nishiki Market all work in bad weather.' },
  ]) {
    await api.post(`${collab}/notes`, { data: n }).catch(() => {})
  }

  const pollRes = await api.post(`${collab}/polls`, {
    data: {
      question: 'Which day should we keep free for Nara?',
      options: ['Wed, Sep 16', 'Thu, Sep 17', 'Sat, Sep 19'],
      multiple: false,
    },
  })
  if (pollRes.ok()) {
    const { poll } = (await pollRes.json()) as { poll: { id: number | string } }
    await api.post(`${collab}/polls/${poll.id}/vote`, { data: { option_index: 1 } }).catch(() => {})
    await as('mira').post(`${collab}/polls/${poll.id}/vote`, { data: { option_index: 1 } }).catch(() => {})
    await as('jonas').post(`${collab}/polls/${poll.id}/vote`, { data: { option_index: 2 } }).catch(() => {})
  }
  await api.post(`${collab}/polls`, {
    data: { question: 'Ryokan or city hotel in Hakone?', options: ['Ryokan with onsen', 'City hotel'], multiple: false },
  }).catch(() => {})

  const conversation: Array<[string, string]> = [
    ['admin', 'Flights are booked — we land at Haneda 08:25 on the 13th.'],
    ['mira', 'Nice. Should we go straight to the hotel or drop bags and head out?'],
    ['jonas', 'Drop bags. I want to be at Senso-ji before the crowds.'],
    ['admin', "Agreed. I've put it on day 1 with a note to go before 08:00."],
    ['mira', 'Booked the teamLab slot for the 13th, 14:00. Tickets are in the Files tab.'],
  ]
  for (const [who, text] of conversation) {
    const ctx = who === 'admin' ? api : as(who)
    await ctx.post(`${collab}/messages`, { data: { text } }).catch(() => {})
  }

  for (const ctx of Object.values(members)) await ctx.dispose()

  const allPlaceIds = [...placeIds, ...extraResults.flatMap(r => r.placeIds)]

  // 14. Plugins, installed from the community registry.
  //
  //     Registry install is the ONLY path that produces a representative
  //     screenshot. Dev-link and sideload both stamp the plugin card with a
  //     badge ("Dev-Link" / "Sideloaded", AdminPluginsPanel.tsx:307,361) that no
  //     ordinary install shows, and TREK_PLUGINS_DEV_LINK additionally reveals a
  //     "Link a local plugin" row in the panel. Documenting either would show
  //     readers a UI they will never have.
  //
  //     Needs network. If the registry is unreachable the plugin screenshots are
  //     skipped loudly rather than silently captured in a misleading state.
  for (const id of ['koffi', 'trip-doctor']) {
    const res = await api.post('/api/admin/plugins/install', { data: { id } })
    if (!res.ok()) {
      console.log(`PLUGIN INSTALL FAILED ${id} → ${res.status()} ${await res.text()}`)
      continue
    }
    await api.post(`/api/admin/plugins/${id}/activate`, { data: {} })
  }

  return {
    tripId,
    tripIds: [tripId, ...extraTripIds],
    memberIds,
    dayIds,
    placeIds: allPlaceIds,
    collectionId,
    collectionIds,
  }
}
