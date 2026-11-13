import React, { useEffect, useMemo, useState } from 'react'
import { daysApi, placesApi, seasonsApi, weatherApi } from '../../api/client'
import type { DashboardTrip } from './dashboardModel'
import { tripDurationDays } from './dashboardModel'
import { assessCrowdMonth, assessHolidayMonth, assessMonth, assessNaturalHazardMonth, climateCell, FIT_ORDER, inferNearbyCountries, scheduledMonths, type ClimateMonth, type CrowdAssessment, type HolidayAssessment, type HolidayCalendar, type NaturalHazardAssessment, type SeasonAssessment, type SeasonLocation, type SeasonalFit } from './tripSeasonsModel'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const FIT_LABEL: Record<SeasonalFit, string> = { best: 'Best', good: 'Good', tradeoffs: 'Some trade-offs', challenging: 'Challenging', unknown: 'Unavailable' }
const FIT_MARK: Record<SeasonalFit, string> = { best: '★', good: '✓', tradeoffs: '≈', challenging: '!', unknown: '·' }

type DayResponse = { days: Array<{ assignments?: Array<{ place?: { id?: number; name?: string; lat?: number | null; lng?: number | null } }> }> }
type TripPlacesResponse = { places?: Array<{ id?: number; name?: string; lat?: number | null; lng?: number | null }> }
type TripClimate = { locations: SeasonLocation[]; loading: boolean; error: boolean; climateError: boolean; crowdError: boolean; crowdLoading: boolean; hazardLoading: boolean; hazardError: boolean }
type Detail = { tripId: number; month: number }
type Factor = 'weather' | 'crowd' | 'holidays' | 'hazards'

function fitClass(fit: SeasonalFit): string { return `fit-${fit}` }

function seasonRetryDelay(errors: Array<string | undefined>): number | undefined {
  const message = errors.find(error => error && /HTTP 429|HTTP 5\d\d|rate limit|cooling down|budget reached|retry deferred|temporarily|unreachable/i.test(error))
  if (!message) return undefined
  const seconds = Number(/retry in (\d+) seconds/i.exec(message)?.[1])
  if (seconds) return seconds * 1_000 + 5_000
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 5) - now.getTime()
}

function noClimateReason(data: TripClimate): string {
  if (data.loading) return 'Loading typical weather…'
  if (data.error) return 'We could not load this trip’s destinations.'
  if (data.climateError) {
    return 'Weather history is temporarily unavailable. Please try again later.'
  }
  if (!data.locations.length) return 'Add destinations to see typical weather.'
  if (!data.locations.some(location => location.lat != null && location.lng != null)) return 'Add destination locations to see typical weather.'
  return 'Typical weather information is not available.'
}

function Cell({ fit, scheduled, selected, label, onClick }: { fit: SeasonalFit; scheduled: boolean; selected: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={`trip-season-cell ${fitClass(fit)}${scheduled ? ' scheduled' : ''}${selected ? ' selected' : ''}`} aria-pressed={selected} aria-label={`${label}: ${FIT_LABEL[fit]}${scheduled ? ', scheduled' : ''}`} onClick={onClick}>
    <span aria-hidden="true">{FIT_MARK[fit]}</span><span className="sr-only">{FIT_LABEL[fit]}</span>
    {scheduled && <span className="season-scheduled-dot" aria-hidden="true">●</span>}
  </button>
}

const CROWD_LABEL: Record<CrowdAssessment['level'], string> = { lower: 'Quieter than usual', typical: 'Typical', higher: 'Busier than usual', unknown: 'Unavailable' }
const CROWD_MARK: Record<CrowdAssessment['level'], string> = { lower: '↓', typical: '·', higher: '↑', unknown: '·' }

function CrowdCell({ assessment, scheduled, selected, label, onClick }: { assessment: CrowdAssessment; scheduled: boolean; selected: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={`trip-season-cell crowd-${assessment.level}${scheduled ? ' scheduled' : ''}${selected ? ' selected' : ''}`} aria-pressed={selected} aria-label={`${label}: ${CROWD_LABEL[assessment.level]}${assessment.relativeDemand == null ? '' : `, ${assessment.relativeDemand.toFixed(2)} times average monthly visitor demand`}${scheduled ? ', scheduled' : ''}`} onClick={onClick}>
    <span aria-hidden="true">{CROWD_MARK[assessment.level]}</span><span className="sr-only">{CROWD_LABEL[assessment.level]}</span>
    {scheduled && <span className="season-scheduled-dot" aria-hidden="true">●</span>}
  </button>
}

const HOLIDAY_LABEL: Record<HolidayAssessment['level'], string> = { dates: 'Public holidays', none: 'No public holidays', unknown: 'Unavailable' }
const HAZARD_LABEL: Record<NaturalHazardAssessment['level'], string> = { lower: 'Fewer past events', typical: 'Typical past activity', higher: 'More past events', unknown: 'Limited history' }

function HolidayCell({ assessment, scheduled, selected, label, onClick }: { assessment: HolidayAssessment; scheduled: boolean; selected: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={`trip-season-cell holiday-${assessment.level}${scheduled ? ' scheduled' : ''}${selected ? ' selected' : ''}`} aria-pressed={selected} aria-label={`${label}: ${assessment.count ? `${assessment.count} holiday ${assessment.count === 1 ? 'date' : 'dates'}` : HOLIDAY_LABEL[assessment.level]}${scheduled ? ', scheduled' : ''}`} onClick={onClick}>
    <span aria-hidden="true">{assessment.count || (assessment.level === 'none' ? '—' : '·')}</span><span className="sr-only">{HOLIDAY_LABEL[assessment.level]}</span>
    {scheduled && <span className="season-scheduled-dot" aria-hidden="true">●</span>}
  </button>
}

function HazardCell({ assessment, scheduled, selected, label, onClick }: { assessment: NaturalHazardAssessment; scheduled: boolean; selected: boolean; label: string; onClick: () => void }) {
  const marker = assessment.level === 'lower' ? '↓' : assessment.level === 'higher' ? '↑' : '·'
  return <button type="button" className={`trip-season-cell hazard-${assessment.level}${scheduled ? ' scheduled' : ''}${selected ? ' selected' : ''}`} aria-pressed={selected} aria-label={`${label}: ${assessment.relativeActivity == null ? HAZARD_LABEL[assessment.level] : `${assessment.relativeActivity.toFixed(2)} times usual recorded activity`}${scheduled ? ', scheduled' : ''}`} onClick={onClick}>
    <span aria-hidden="true">{marker}</span><span className="sr-only">{HAZARD_LABEL[assessment.level]}</span>
    {scheduled && <span className="season-scheduled-dot" aria-hidden="true">●</span>}
  </button>
}

export function TripSeasonsView({ trips, onOpen }: { trips: DashboardTrip[]; onOpen: (id: number) => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [query, setQuery] = useState('')
  const [factor, setFactor] = useState<Factor>('weather')
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear())
  const [holidayCalendars, setHolidayCalendars] = useState<Record<string, HolidayCalendar>>({})
  const [holidayLoadFailedYear, setHolidayLoadFailedYear] = useState<number | null>(null)
  const [climateByTrip, setClimateByTrip] = useState<Record<number, TripClimate>>({})
  const [climateRetry, setClimateRetry] = useState(0)
  const [crowdRetry, setCrowdRetry] = useState(0)
  const [hazardRetry, setHazardRetry] = useState(0)
  const tripIdsKey = trips.map(trip => trip.id).join(',')

  useEffect(() => {
    let active = true
    let retryTimer: number | undefined
    const tripIds = tripIdsKey ? tripIdsKey.split(',').map(Number) : []
    setClimateByTrip(Object.fromEntries(tripIds.map(id => [id, { locations: [], loading: true, error: false, climateError: false, crowdError: false, crowdLoading: false, hazardLoading: false, hazardError: false }])))
    void (async () => {
      const tripsWithLocations = await Promise.all(tripIds.map(async tripId => {
        try {
          const [{ days }, { places = [] }] = await Promise.all([
            daysApi.list(tripId) as Promise<DayResponse>,
            placesApi.list(tripId) as Promise<TripPlacesResponse>,
          ])
          const locations = new Map<string, SeasonLocation & { assignedDays: Set<number>; placeNames: Set<string> }>()
          const rememberPlace = (place: NonNullable<DayResponse['days'][number]['assignments']>[number]['place']) => {
            if (!place) return ''
            const grid = place.lat != null && place.lng != null ? climateCell(Number(place.lat), Number(place.lng)) : undefined
            const key = grid?.key ?? `place:${place.id ?? place.name ?? 'unknown'}`
            let location = locations.get(key)
            if (!location) {
              location = { key, name: place.name || 'Unnamed destination', lat: grid?.lat ?? null, lng: grid?.lng ?? null, crowdLat: place.lat == null ? null : Number(place.lat), crowdLng: place.lng == null ? null : Number(place.lng), days: 0, assignedDays: new Set(), placeNames: new Set() }
              locations.set(key, location)
            }
            if (place.name) location.placeNames.add(place.name)
            return key
          }
          days.forEach((day, dayIndex) => {
            const dayLocations = new Set<string>()
            day.assignments?.forEach(({ place }) => { const key = rememberPlace(place); if (key) dayLocations.add(key) })
            dayLocations.forEach(key => locations.get(key)?.assignedDays.add(dayIndex))
          })
          places.forEach(place => { rememberPlace(place) })
          return { tripId, locations: [...locations.values()].map(location => {
            const { assignedDays, placeNames, ...seasonLocation } = location
            return { ...seasonLocation, names: [...placeNames], days: Math.max(1, assignedDays.size) }
          }), error: false }
        } catch {
          return { tripId, locations: [] as SeasonLocation[], error: true }
        }
      }))
      const climateLocations = new Map<string, { key: string; lat: number; lng: number }>()
      tripsWithLocations.forEach(({ locations }) => locations.forEach(location => {
        if (location.lat != null && location.lng != null) climateLocations.set(location.key, { key: location.key, lat: location.lat, lng: location.lng })
      }))
      let climates: Awaited<ReturnType<typeof weatherApi.getClimateBatch>> = []
      let climateRequestError: string | undefined
      try { if (climateLocations.size) climates = await weatherApi.getClimateBatch([...climateLocations.values()]) }
      catch (error: unknown) { climateRequestError = error instanceof Error ? error.message : 'Weather data request failed' }
      const retryDelay = seasonRetryDelay([climateRequestError, ...climates.map(item => item.error)])
      if (retryDelay != null) retryTimer = window.setTimeout(() => setClimateRetry(value => value + 1), retryDelay)
      const climateByKey = new Map(climates.map(item => [item.key, item]))
      if (active) setClimateByTrip(Object.fromEntries(tripsWithLocations.map(({ tripId, locations, error }) => [tripId, {
        locations: locations.map(location => {
          const climate = climateByKey.get(location.key)
          return { ...location, ...(climate?.months ? { months: climate.months as ClimateMonth[], source: climate.source, period: climate.period } : {}), ...(climate?.error ? { climateError: climate.error } : {}) }
        }), loading: false, error,
        climateError: !!climateRequestError || locations.some(location => !!climateByKey.get(location.key)?.error),
        crowdError: false,
        crowdLoading: false,
        hazardLoading: false,
        hazardError: false,
      }])))
    })()
    return () => { active = false; if (retryTimer != null) window.clearTimeout(retryTimer) }
  }, [tripIdsKey, climateRetry])

  const crowdLocations = [...new Map(Object.values(climateByTrip).flatMap(data => data.locations
    .filter(location => Number.isFinite(location.crowdLat) && Number.isFinite(location.crowdLng))
    .map(location => [location.key, { key: location.key, lat: location.crowdLat!, lng: location.crowdLng! }] as const)))].sort((a, b) => a[0].localeCompare(b[0])).map(([, location]) => location)
  const crowdLocationsKey = JSON.stringify(crowdLocations)
  useEffect(() => {
    if (factor !== 'crowd' || !crowdLocations.length) return
    let active = true
    let retryTimer: number | undefined
    setClimateByTrip(current => Object.fromEntries(Object.entries(current).map(([id, data]) => [id, { ...data, crowdLoading: true, crowdError: false }])))
    const locations = JSON.parse(crowdLocationsKey) as typeof crowdLocations
    void seasonsApi.getCrowdBatch(locations).then(results => {
      if (!active) return
      const byKey = new Map(results.map(item => [item.key, item]))
      const retryDelay = seasonRetryDelay(results.map(item => item.error))
      if (retryDelay != null) retryTimer = window.setTimeout(() => setCrowdRetry(value => value + 1), retryDelay)
      setClimateByTrip(current => Object.fromEntries(Object.entries(current).map(([id, data]) => [id, {
        ...data, crowdLoading: false,
        crowdError: results.some(item => !!seasonRetryDelay([item.error])),
        locations: data.locations.map(location => {
          const result = byKey.get(location.key)
          return result ? { ...location, crowd: result.region && result.data ? { ...result.data, region: result.region } : undefined, countryCode: result.countryCode ?? location.countryCode, crowdUnavailable: !!result.error, crowdError: result.error } : location
        }),
      }])))
    }).catch(() => {
      if (active) {
        retryTimer = window.setTimeout(() => setCrowdRetry(value => value + 1), seasonRetryDelay(['temporarily unavailable'])!)
        setClimateByTrip(current => Object.fromEntries(Object.entries(current).map(([id, data]) => [id, {
          ...data, crowdLoading: false, crowdError: true,
          locations: data.locations.map(location => location.crowd ? location : { ...location, crowdUnavailable: true, crowdError: 'Visitor-demand request failed' }),
        }])))
      }
    })
    return () => { active = false; if (retryTimer != null) window.clearTimeout(retryTimer) }
  }, [factor, crowdLocationsKey, crowdRetry])

  const geographyLocations = [...new Map(Object.values(climateByTrip).flatMap(data => data.locations
    .filter(location => !location.countryCode && Number.isFinite(location.crowdLat) && Number.isFinite(location.crowdLng))
    .map(location => [location.key, { key: location.key, lat: location.crowdLat!, lng: location.crowdLng! }] as const)))].sort((a, b) => a[0].localeCompare(b[0])).map(([, location]) => location)
  const geographyLocationsKey = JSON.stringify(geographyLocations)
  useEffect(() => {
    if (factor !== 'holidays' || !geographyLocations.length) return
    let active = true
    const locations = JSON.parse(geographyLocationsKey) as typeof geographyLocations
    void seasonsApi.getGeographyBatch(locations).then(results => {
      if (!active) return
      const byKey = new Map(results.map(item => [item.key, item]))
      setClimateByTrip(current => Object.fromEntries(Object.entries(current).map(([id, data]) => [id, {
        ...data, locations: data.locations.map(location => {
          const result = byKey.get(location.key)
          return { ...location, ...(result?.countryCode ? { countryCode: result.countryCode } : {}) }
        }),
      }])))
    }).catch(() => { if (active) setHolidayLoadFailedYear(holidayYear) })
    return () => { active = false }
  }, [factor, holidayYear, geographyLocationsKey])

  const holidayLocations = Object.values(climateByTrip).map(data => inferNearbyCountries(data.locations))
  const holidayCodesKey = [...new Set(holidayLocations.flatMap(locations => locations.flatMap(location => location.countryCode ? [location.countryCode] : [])))].sort().join(',')
  useEffect(() => {
    if (factor !== 'holidays' || !holidayCodesKey) return
    const missingCodes = holidayCodesKey.split(',').filter(code => holidayCalendars[code]?.year !== holidayYear)
    if (!missingCodes.length) return
    let active = true
    setHolidayLoadFailedYear(null)
    void seasonsApi.getHolidays(holidayYear, missingCodes.slice(0, 16)).then(results => {
      if (!active) return
      const deferred = results.filter(item => item.error && /daily request budget reached|cooling down|HTTP 429|HTTP 5\d\d|retry deferred/i.test(item.error)).map(item => item.countryCode)
      setHolidayCalendars(current => ({ ...current, ...Object.fromEntries(results.map(item => [item.countryCode, item])) }))
      if (deferred.length) {
        const now = new Date()
        const retryAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 5)
        window.setTimeout(() => setHolidayCalendars(current => {
          const next = { ...current }
          deferred.forEach(code => { if (next[code]?.year === holidayYear && next[code].error) delete next[code] })
          return next
        }), retryAt - now.getTime())
      }
    }).catch(() => { if (active) setHolidayLoadFailedYear(holidayYear) })
    return () => { active = false }
  }, [factor, holidayYear, holidayCodesKey, holidayCalendars])

  const hazardLocations = [...new Map(Object.values(climateByTrip).flatMap(data => data.locations
    .filter(location => Number.isFinite(location.crowdLat) && Number.isFinite(location.crowdLng))
    .map(location => [location.key, { key: location.key, lat: location.crowdLat!, lng: location.crowdLng! }] as const)))].sort((a, b) => a[0].localeCompare(b[0])).map(([, location]) => location)
  const hazardLocationsKey = JSON.stringify(hazardLocations)
  useEffect(() => {
    if (factor !== 'hazards' || !hazardLocationsKey || hazardLocations.length === 0) return
    const locations = JSON.parse(hazardLocationsKey) as typeof hazardLocations
    let active = true
    let retryTimer: number | undefined
    setClimateByTrip(current => Object.fromEntries(Object.entries(current).map(([id, data]) => [id, { ...data, hazardLoading: true, hazardError: false }])))
    void seasonsApi.getNaturalHazards(locations).then(results => {
      if (!active) return
      const byKey = new Map(results.map(item => [item.key, item]))
      const retryDelay = seasonRetryDelay(results.map(item => item.error))
      if (retryDelay != null) retryTimer = window.setTimeout(() => setHazardRetry(value => value + 1), retryDelay)
      setClimateByTrip(current => Object.fromEntries(Object.entries(current).map(([id, data]) => [id, {
        ...data, hazardLoading: false,
        hazardError: results.some(item => !!item.error),
        locations: data.locations.map(location => {
          const result = byKey.get(location.key)
          return { ...location, ...(result?.hazards && Object.keys(result.hazards).length ? { hazards: result.hazards } : {}), ...(result?.cyclones ? { cyclones: result.cyclones } : {}), cycloneUnsupported: result?.cycloneCoverage === 'unsupported', cycloneUnavailable: result?.cycloneCoverage === 'unavailable', hazardUnavailable: !!result?.error }
        }),
      }])))
    }).catch(() => {
      if (active) {
        retryTimer = window.setTimeout(() => setHazardRetry(value => value + 1), seasonRetryDelay(['temporarily unavailable'])!)
        setClimateByTrip(current => Object.fromEntries(Object.entries(current).map(([id, data]) => [id, {
          ...data, hazardLoading: false, hazardError: true,
          locations: data.locations.map(location => ({ ...location, cycloneUnavailable: true, hazardUnavailable: true })),
        }])))
      }
    })
    return () => { active = false; if (retryTimer != null) window.clearTimeout(retryTimer) }
  }, [factor, hazardLocationsKey, hazardRetry])

  const rows = useMemo(() => trips
    .map(trip => {
      const data = climateByTrip[trip.id] || { locations: [], loading: true, error: false, climateError: false, crowdError: false, crowdLoading: false, hazardLoading: false, hazardError: false }
      const assessments = MONTHS.map((_, month): SeasonAssessment => ({ ...assessMonth(data.locations, month), matchedMonth: month }))
      const crowdAssessments = MONTHS.map((_, month) => assessCrowdMonth(data.locations, month))
      const tripHolidayLocations = inferNearbyCountries(data.locations)
      const holidayAssessments = MONTHS.map((_, month) => assessHolidayMonth(tripHolidayLocations, holidayCalendars, month, holidayYear))
      const hazardAssessments = MONTHS.map((_, month) => assessNaturalHazardMonth(data.locations, month))
      const unlocatedCount = data.locations.filter(location => !Number.isFinite(location.crowdLat) || !Number.isFinite(location.crowdLng)).length
      const unmappedCountryCount = tripHolidayLocations.filter(location => Number.isFinite(location.crowdLat) && Number.isFinite(location.crowdLng) && !location.countryCode).length
      const inferredCountryCount = tripHolidayLocations.filter(location => location.countryInferred).length
      const supported = assessments.filter(item => item.fit !== 'unknown')
      const best = [...supported].sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || (b.score ?? -1) - (a.score ?? -1))[0]
      const quietest = crowdAssessments.map((item, month) => ({ ...item, month })).filter(item => item.relativeDemand != null).sort((a, b) => (a.relativeDemand ?? Infinity) - (b.relativeDemand ?? Infinity))[0]
      const duration = tripDurationDays(trip)
      return { trip, assessments, crowdAssessments, holidayAssessments, hazardAssessments, best, quietest, data, tripHolidayLocations, unlocatedCount, unmappedCountryCount, inferredCountryCount, durationLabel: duration ? `${duration} ${duration === 1 ? 'day' : 'days'}` : trip.start_date ? 'Dates set' : 'Open dates' }
    })
    .filter(({ trip }) => trip.title.toLowerCase().includes(query.trim().toLowerCase())), [trips, climateByTrip, query, holidayCalendars, holidayYear])

  return <section className="trip-seasons" aria-label="Trip seasons">
    <header className="trip-seasons-heading">
      <div><h4>Seasonal factors</h4><p>{factor === 'weather' ? 'Typical weather for each month of your trip' : factor === 'crowd' ? 'Past visitor and hotel activity by month; coverage varies by destination' : factor === 'holidays' ? `Public holidays in ${holidayYear}; some places may close or be busier` : 'Past earthquakes, tsunamis, volcanic eruptions, and cyclones (1980–2025)'}</p></div>
      <label><span className="sr-only">Search trips</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a trip" /></label>
    </header>
    <div className="trip-seasons-factors" role="group" aria-label="Seasonal factor">
      <button type="button" aria-pressed={factor === 'weather'} onClick={() => setFactor('weather')}>Weather</button>
      <button type="button" aria-pressed={factor === 'crowd'} onClick={() => setFactor('crowd')}>Visitor demand</button>
      <button type="button" aria-pressed={factor === 'holidays'} onClick={() => setFactor('holidays')}>Public holidays</button>
      <button type="button" aria-pressed={factor === 'hazards'} onClick={() => setFactor('hazards')}>Natural hazards</button>
      {factor === 'holidays' && <label className="trip-seasons-year">Calendar year <select value={holidayYear} onChange={event => setHolidayYear(Number(event.target.value))}>{Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i).map(year => <option key={year} value={year}>{year}</option>)}</select></label>}
    </div>
    {rows.length === 0 ? <p className="trip-seasons-empty">No planned trips match “{query}”.</p> : <div className="trip-seasons-scroll">
      <table className="trip-seasons-table"><thead><tr><th scope="col">Planned trip</th>{MONTHS.map(month => <th key={month} scope="col">{month}</th>)}</tr></thead>
        <tbody>{rows.map(({ trip, assessments, crowdAssessments, holidayAssessments, hazardAssessments, best, quietest, data, tripHolidayLocations, unlocatedCount, unmappedCountryCount, inferredCountryCount, durationLabel }) => {
          const scheduled = scheduledMonths(trip)
          const selectedMonth = detail?.tripId === trip.id ? detail.month : undefined
          const detailAssessment = selectedMonth == null ? undefined : assessments[selectedMonth]
          const detailCrowd = selectedMonth == null ? undefined : crowdAssessments[selectedMonth]
          const crowdSource = data.locations.find(location => location.crowd)?.crowd
          const countryCrowdOnly = data.locations.some(location => location.crowd?.level === 'country') && data.locations.every(location => !location.crowd || location.crowd.level === 'country')
          const detailHoliday = selectedMonth == null ? undefined : holidayAssessments[selectedMonth]
          const detailHazard = selectedMonth == null ? undefined : hazardAssessments[selectedMonth]
          const holidayError = tripHolidayLocations.map(location => location.countryCode ? holidayCalendars[location.countryCode] : undefined).find(calendar => calendar?.year === holidayYear && calendar.error)?.error
          return <React.Fragment key={trip.id}>
            <tr className="trip-season-row">
              <th scope="row"><button className="trip-season-expand" type="button" onClick={() => onOpen(trip.id)}><span>{trip.title}<small>{durationLabel}</small></span></button>
              {factor === 'weather' && best && <span className="trip-season-best">Weather · {FIT_LABEL[best.fit]} in {MONTHS[best.matchedMonth ?? 0]}</span>}
              {factor === 'crowd' && quietest && <span className="trip-season-best">Quieter month · {MONTHS[quietest.month]}</span>}
              {factor === 'holidays' && <span className="trip-season-best">Public holidays · {holidayYear}</span>}
              {factor === 'hazards' && <span className="trip-season-best">Past natural hazards</span>}
              </th>
              {assessments.map((assessment, month) => <td key={month}>{factor === 'weather'
                ? <Cell fit={data.loading ? 'unknown' : assessment.fit} scheduled={scheduled.has(month)} selected={selectedMonth === month} label={`${trip.title}, ${FULL_MONTHS[month]}`} onClick={() => setDetail(current => current?.tripId === trip.id && current.month === month ? null : { tripId: trip.id, month })} />
                : factor === 'crowd'
                  ? <CrowdCell assessment={data.loading || data.crowdLoading ? { level: 'unknown', relativeDemand: null, coverage: 0, locations: 0 } : crowdAssessments[month]} scheduled={scheduled.has(month)} selected={selectedMonth === month} label={`${trip.title}, ${FULL_MONTHS[month]}`} onClick={() => setDetail(current => current?.tripId === trip.id && current.month === month ? null : { tripId: trip.id, month })} />
                  : factor === 'holidays'
                    ? <HolidayCell assessment={data.loading ? { level: 'unknown', count: 0, coverage: 0, locations: 0, dates: [] } : holidayAssessments[month]} scheduled={scheduled.has(month)} selected={selectedMonth === month} label={`${trip.title}, ${FULL_MONTHS[month]}`} onClick={() => setDetail(current => current?.tripId === trip.id && current.month === month ? null : { tripId: trip.id, month })} />
                    : <HazardCell assessment={data.loading || data.hazardLoading ? { level: 'unknown', relativeActivity: null, coverage: 0, locations: 0, components: [] } : hazardAssessments[month]} scheduled={scheduled.has(month)} selected={selectedMonth === month} label={`${trip.title}, ${FULL_MONTHS[month]}`} onClick={() => setDetail(current => current?.tripId === trip.id && current.month === month ? null : { tripId: trip.id, month })} />}</td>)}
            </tr>
            {(detailAssessment || detailCrowd || detailHoliday || detailHazard) && <tr className="trip-season-detail-row"><td colSpan={13}><div className="trip-season-inline-detail">
              {factor === 'weather' && <><strong className={fitClass(detailAssessment!.fit)}>{FULL_MONTHS[selectedMonth!]} · {FIT_LABEL[detailAssessment!.fit]}</strong>
              <span>{data.error ? 'We could not load this trip’s destinations.' : detailAssessment!.coverage ? `Weather history is available for ${detailAssessment!.coverage} of ${detailAssessment!.locations} destinations.` : noClimateReason(data)}{unlocatedCount ? ` ${unlocatedCount} ${unlocatedCount === 1 ? 'destination has no location; it is' : 'destinations have no location; they are'} not included.` : ''}</span></>}
              {factor === 'crowd' && <><strong className={`crowd-${detailCrowd!.level}`}>{FULL_MONTHS[selectedMonth!]} · {CROWD_LABEL[detailCrowd!.level]}</strong>
              <span>{data.error ? 'We could not load this trip’s destinations.' : detailCrowd!.relativeDemand != null ? `Visitor activity was ${detailCrowd!.relativeDemand.toFixed(2)}× the monthly average. This uses ${countryCrowdOnly ? 'country visitor totals' : 'regional hotel stays'}${crowdSource?.period ? ` from ${crowdSource.period}` : ''}, so it reflects overall travel activity rather than crowds at individual attractions.` : data.crowdError ? 'Visitor activity information is temporarily unavailable. Please try again later.' : data.locations.some(location => location.crowdLat != null && location.crowdLng != null) ? 'Visitor activity information is not available for these destinations.' : 'Add destination locations to see visitor activity.'}</span></>}
              {factor === 'holidays' && <><strong className={`holiday-${detailHoliday!.level}`}>{FULL_MONTHS[selectedMonth!]} · {HOLIDAY_LABEL[detailHoliday!.level]}</strong>
              <span>{holidayLoadFailedYear === holidayYear ? 'Holiday information is temporarily unavailable. Please try again later. ' : detailHoliday!.locations ? `Holiday calendars are available for ${detailHoliday!.coverage} of ${detailHoliday!.locations} destination countries. ` : ''}{inferredCountryCount ? `We matched ${inferredCountryCount} ${inferredCountryCount === 1 ? 'destination country' : 'destination countries'} using a nearby stop. ` : ''}{unmappedCountryCount ? `${unmappedCountryCount} ${unmappedCountryCount === 1 ? 'destination could' : 'destinations could'} not be matched to a country and ${unmappedCountryCount === 1 ? 'is' : 'are'} not included. ` : ''}{holidayError ? 'Some holiday calendars could not be loaded. ' : ''}{detailHoliday!.dates.length ? detailHoliday!.dates.map(item => `${item.date}: ${item.name || item.localName || 'Holiday'}`).join(' · ') : detailHoliday!.level === 'none' ? `No national holidays were found for ${holidayYear} in the countries checked.` : 'Holiday dates are not available for these destinations.'}</span></>}
              {factor === 'hazards' && <><strong className={`hazard-${detailHazard!.level}`}>{FULL_MONTHS[selectedMonth!]} · {HAZARD_LABEL[detailHazard!.level]}</strong>
              <span>{data.hazardLoading ? 'Loading past hazard records…' : data.hazardError ? 'Some past hazard records could not be loaded. ' : ''}{detailHazard!.components.length ? detailHazard!.components.map(item => `${item.hazard}: ${item.events} ${item.events === 1 ? 'event' : 'events'}${item.relativeActivity == null ? '' : ` (${item.relativeActivity.toFixed(2)}× the usual monthly level)`}`).join('; ') + '. ' : 'No events were found for this route and month. '}{detailHazard!.components.some(item => item.relativeActivity == null) ? 'There are too few nearby records to compare this month with usual levels.' : ''}</span></>}
              <button type="button" onClick={() => onOpen(trip.id)}>Open trip</button>
            </div></td></tr>}
          </React.Fragment>
        })}</tbody>
      </table>
    </div>}
    <p className="trip-seasons-legend" aria-label={`${factor} legend`}>{factor === 'weather'
      ? (['best', 'good', 'tradeoffs', 'challenging', 'unknown'] as SeasonalFit[]).map(fit => <span key={fit}><b className={fitClass(fit)}>{FIT_MARK[fit]}</b> {FIT_LABEL[fit]}</span>)
      : factor === 'crowd'
        ? (['lower', 'typical', 'higher', 'unknown'] as CrowdAssessment['level'][]).map(level => <span key={level}><b className={`crowd-${level}`}>{CROWD_MARK[level]}</b> {CROWD_LABEL[level]}</span>)
        : factor === 'holidays' ? <><span><b className="holiday-dates">1+</b> Days with holidays</span><span><b className="holiday-none">—</b> No public holidays</span><span><b className="holiday-unknown">·</b> Unavailable</span></> : <><span><b className="hazard-lower">↓</b> Fewer past events</span><span><b className="hazard-typical">·</b> Typical past activity</span><span><b className="hazard-higher">↑</b> More past events</span><span><b className="hazard-unknown">·</b> Limited history</span></>}<span><b className="season-scheduled-dot">●</b> Scheduled dates</span></p>
  </section>
}
