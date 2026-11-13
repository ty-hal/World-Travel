import type { DashboardTrip } from './dashboardModel'

export type SeasonalFit = 'best' | 'good' | 'tradeoffs' | 'challenging' | 'unknown'
export interface ClimateMonth { month: number; meanMaxC: number; meanMinC: number; precipitationMm: number; days: number }
export interface CrowdMonth { month: number; relativeDemand: number; samples: number }
export interface CrowdSeasonality { region: string; source?: 'eurostat' | 'tourismapi'; level?: 'regional' | 'country'; period: string; years: number[]; provisional: boolean; months: CrowdMonth[] }
export interface SeasonHoliday { date: string; name?: string; localName?: string }
export interface HolidayCalendar { countryCode: string; year: number; holidays?: SeasonHoliday[]; error?: string }
export interface CycloneCalendar { source: string; period: string; radiusNm: number; basins: string[]; events: number; months: Array<{ month: number; events: number; tracksPer100Years: number; relativeActivity: number | null }> }
export type HazardKind = 'earthquakes' | 'tsunamis' | 'volcanoes' | 'cyclones'
export interface HazardCalendar { source: string; period: string; radiusKm: number; events: number; months: Array<{ month: number; events: number; relativeActivity: number | null }> }
export interface SeasonLocation { key: string; name: string; names?: string[]; lat: number | null; lng: number | null; crowdLat?: number | null; crowdLng?: number | null; countryCode?: string; countryInferred?: boolean; days: number; months?: ClimateMonth[]; source?: string; period?: string; climateError?: string; crowd?: CrowdSeasonality; crowdUnavailable?: boolean; crowdError?: string; hazards?: Partial<Record<Exclude<HazardKind, 'cyclones'>, HazardCalendar>>; cyclones?: CycloneCalendar; cycloneUnsupported?: boolean; cycloneUnavailable?: boolean; hazardUnavailable?: boolean }
export interface SeasonAssessment { fit: SeasonalFit; score: number | null; coverage: number; locations: number; matchedMonth?: number }
export interface CrowdAssessment { level: 'lower' | 'typical' | 'higher' | 'unknown'; relativeDemand: number | null; coverage: number; locations: number }
export interface HolidayAssessment { level: 'dates' | 'none' | 'unknown'; count: number; coverage: number; locations: number; dates: SeasonHoliday[] }
export interface NaturalHazardAssessment { level: 'lower' | 'typical' | 'higher' | 'unknown'; relativeActivity: number | null; coverage: number; locations: number; components: Array<{ hazard: HazardKind; events: number; relativeActivity: number | null; coverage: number }> }

export const FIT_ORDER: Record<SeasonalFit, number> = { best: 0, good: 1, tradeoffs: 2, challenging: 3, unknown: 4 }

function hasCoordinates(location: SeasonLocation): boolean {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng)
}

function hasCrowdCoordinates(location: SeasonLocation): boolean {
  return Number.isFinite(location.crowdLat ?? location.lat) && Number.isFinite(location.crowdLng ?? location.lng)
}

export function inferNearbyCountries(locations: SeasonLocation[]): SeasonLocation[] {
  const mapped = locations.filter(location => location.countryCode && !location.countryInferred && Number.isFinite(location.crowdLat ?? location.lat) && Number.isFinite(location.crowdLng ?? location.lng))
  return locations.map(location => {
    if (location.countryCode || !Number.isFinite(location.crowdLat ?? location.lat) || !Number.isFinite(location.crowdLng ?? location.lng)) return location
    const lat = (location.crowdLat ?? location.lat)! * Math.PI / 180
    const lng = (location.crowdLng ?? location.lng)! * Math.PI / 180
    let nearest: { countryCode: string; distance: number } | undefined
    for (const candidate of mapped) {
      const candidateLat = (candidate.crowdLat ?? candidate.lat)! * Math.PI / 180
      const candidateLng = (candidate.crowdLng ?? candidate.lng)! * Math.PI / 180
      const dLat = candidateLat - lat, dLng = candidateLng - lng
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat) * Math.cos(candidateLat) * Math.sin(dLng / 2) ** 2
      const distance = 12_742 * Math.asin(Math.sqrt(Math.min(1, a)))
      if (!nearest || distance < nearest.distance) nearest = { countryCode: candidate.countryCode!, distance }
    }
    // shortcut: infer only within 25 km of a mapped stop; use country boundaries for broader matching.
    return nearest && nearest.distance <= 25 ? { ...location, countryCode: nearest.countryCode, countryInferred: true } : location
  })
}

export function climateCell(lat: number, lng: number): { key: string; lat: number; lng: number } {
  const gridLat = Math.round(lat / 0.5) * 0.5
  const gridLng = Math.round(lng / 0.5) * 0.5
  return { key: `${gridLat.toFixed(2)},${gridLng.toFixed(2)}`, lat: gridLat, lng: gridLng }
}

export function climateCellKey(lat: number, lng: number): string { return climateCell(lat, lng).key }

export function climateComfort(min: number, max: number, rain: number): number {
  const temperature = Math.max(0, 1 - Math.abs((min + max) / 2 - 20) / 22)
  const rainfall = Math.max(0, 1 - rain / 400)
  return Math.round((temperature * 0.7 + rainfall * 0.3) * 100)
}

export function assessMonth(locations: SeasonLocation[], month: number): Omit<SeasonAssessment, 'matchedMonth' | 'duration'> {
  const located = locations.filter(hasCoordinates)
  const rated = located.flatMap(location => {
    const climate = location.months?.find(item => item.month === month + 1)
    return climate && climate.days >= 50 ? [{ score: climateComfort(climate.meanMinC, climate.meanMaxC, climate.precipitationMm), weight: location.days }] : []
  })
  if (!rated.length) return { fit: 'unknown', score: null, coverage: 0, locations: located.length }
  const weighted = rated.every(item => item.weight > 0)
  const totalWeight = rated.reduce((sum, item) => sum + (weighted ? item.weight : 1), 0)
  const score = Math.round(rated.reduce((sum, item) => sum + item.score * (weighted ? item.weight : 1), 0) / totalWeight)
  let fit: SeasonalFit = score >= 80 ? 'best' : score >= 65 ? 'good' : score >= 45 ? 'tradeoffs' : 'challenging'
  if (rated.some(item => item.score < 45) && FIT_ORDER[fit] < FIT_ORDER.tradeoffs) fit = 'tradeoffs'
  return { fit, score, coverage: rated.length, locations: located.length }
}

export function assessCrowdMonth(locations: SeasonLocation[], month: number): CrowdAssessment {
  const regions = new Map<string, { relativeDemand: number; days: number }>()
  const located = locations.filter(hasCrowdCoordinates)
  for (const location of located) {
    if (!location.crowd) continue
    const value = location.crowd.months.find(item => item.month === month + 1)?.relativeDemand
    if (value == null || !Number.isFinite(value)) continue
    const previous = regions.get(location.crowd.region)
    if (previous) previous.days = Math.max(previous.days, location.days)
    else regions.set(location.crowd.region, { relativeDemand: value, days: location.days })
  }
  const routeRegions = new Set(located.map(location => location.crowd?.region ?? `unknown:${location.key}`))
  if (!regions.size) return { level: 'unknown', relativeDemand: null, coverage: 0, locations: routeRegions.size }
  const entries = [...regions.values()]
  const totalWeight = entries.reduce((sum, item) => sum + Math.max(1, item.days), 0)
  const relativeDemand = entries.reduce((sum, item) => sum + item.relativeDemand * Math.max(1, item.days), 0) / totalWeight
  const level = relativeDemand < 0.85 ? 'lower' : relativeDemand > 1.15 ? 'higher' : 'typical'
  return { level, relativeDemand, coverage: regions.size, locations: routeRegions.size }
}

export function assessHolidayMonth(locations: SeasonLocation[], calendars: Record<string, HolidayCalendar>, month: number, year: number): HolidayAssessment {
  const countries = new Set(locations.filter(hasCoordinates).flatMap(location => location.countryCode ? [location.countryCode] : []))
  const dates = new Map<string, SeasonHoliday>()
  let coverage = 0
  for (const code of countries) {
    const calendar = calendars[code]
    if (!calendar || calendar.year !== year || calendar.error || !calendar.holidays) continue
    coverage++
    for (const holiday of calendar.holidays) {
      const date = new Date(`${holiday.date}T00:00:00Z`)
      if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month) continue
      const day = date.toISOString().slice(0, 10)
      if (!dates.has(day)) dates.set(day, holiday)
    }
  }
  const level = !countries.size || !coverage ? 'unknown' : dates.size ? 'dates' : 'none'
  const sortedDates = [...dates.values()].sort((a, b) => a.date.localeCompare(b.date))
  return { level, count: dates.size, coverage, locations: countries.size, dates: sortedDates }
}

export function assessNaturalHazardMonth(locations: SeasonLocation[], month: number): NaturalHazardAssessment {
  const located = locations.filter(hasCoordinates)
  const components: NaturalHazardAssessment['components'] = [];
  for (const hazard of ['earthquakes', 'tsunamis', 'volcanoes', 'cyclones'] as const) {
    const calendars = located.flatMap(location => {
      const calendar = hazard === 'cyclones' ? location.cyclones : location.hazards?.[hazard];
      const monthly = calendar?.months.find(item => item.month === month + 1);
      return calendar && monthly ? [{ calendar, monthly, days: Math.max(1, location.days) }] : [];
    });
    if (!calendars.length) continue;
    const rated = calendars.filter(item => item.monthly.relativeActivity != null);
    const totalWeight = rated.reduce((sum, item) => sum + item.days, 0);
    components.push({
      hazard,
      events: calendars.reduce((sum, item) => sum + item.monthly.events, 0),
      relativeActivity: rated.length ? rated.reduce((sum, item) => sum + item.monthly.relativeActivity! * item.days, 0) / totalWeight : null,
      coverage: calendars.length,
    });
  }
  const scored = components.filter(item => item.relativeActivity != null);
  const coverage = new Set(located.filter(location => location.cyclones || location.hazards && Object.keys(location.hazards).length).map(location => location.key)).size;
  if (!scored.length) return { level: 'unknown', relativeActivity: null, coverage, locations: located.length, components };
  const relativeActivity = scored.reduce((sum, item) => sum + item.relativeActivity!, 0) / scored.length;
  const level = relativeActivity < 0.85 ? 'lower' : relativeActivity > 1.15 ? 'higher' : 'typical';
  return { level, relativeActivity, coverage, locations: located.length, components };
}

export function scheduledMonths(trip: DashboardTrip): Set<number> {
  if (!trip.start_date) return new Set()
  const start = new Date(`${trip.start_date}T00:00:00`)
  const end = trip.end_date ? new Date(`${trip.end_date}T00:00:00`) : start
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return new Set()
  const result = new Set<number>()
  const month = start.getMonth()
  result.add(month)
  const current = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (current < last && result.size < 12) {
    current.setMonth(current.getMonth() + 1)
    result.add(current.getMonth())
  }
  return result
}
