import { describe, expect, it } from 'vitest'
import { assessCrowdMonth, assessHolidayMonth, assessMonth, assessNaturalHazardMonth, climateCellKey, inferNearbyCountries, scheduledMonths, type SeasonLocation } from './tripSeasonsModel'
import type { DashboardTrip } from './dashboardModel'

const months = (min: number, max: number, rain = 0, days = 60) => Array.from({ length: 12 }, (_, month) => ({ month: month + 1, meanMinC: min, meanMaxC: max, precipitationMm: rain, days }))
const trip = (start: string, end: string): DashboardTrip => ({ id: 1, user_id: 1, title: 'Trip', start_date: start, end_date: end, currency: 'USD', is_archived: 0, reminder_days: 0 })

describe('trip seasons model', () => {
  it('weights by itinerary days and caps a strong route when one leg is challenging', () => {
    const locations: SeasonLocation[] = [
      { key: 'long', name: 'Long stay', lat: 0, lng: 0, days: 3, months: months(20, 20) },
      { key: 'hard', name: 'Hard leg', lat: 1, lng: 1, days: 1, months: months(-24, -24, 400) },
    ]
    expect(assessMonth(locations, 8)).toMatchObject({ fit: 'tradeoffs', score: 75, coverage: 2, locations: 2 })
  })

  it('scores available located route areas and excludes stops without coordinates', () => {
    const locations: SeasonLocation[] = [
      { key: 'known', name: 'Known', lat: 0, lng: 0, days: 1, months: months(20, 20) },
      { key: 'missing', name: 'Missing', lat: null, lng: null, days: 1 },
      { key: 'unrated', name: 'No climate', lat: 1, lng: 1, days: 1 },
    ]
    expect(assessMonth(locations, 8)).toMatchObject({ fit: 'best', coverage: 1, locations: 2 })
    expect(assessMonth([], 8)).toMatchObject({ fit: 'unknown', coverage: 0, locations: 0 })
  })

  it('requires at least 50 valid days before scoring two-year monthly climate', () => {
    const location: SeasonLocation = { key: 'sparse', name: 'Sparse', lat: 0, lng: 0, days: 1, months: months(20, 20, 0, 30) }
    expect(assessMonth([location], 8)).toMatchObject({ fit: 'unknown', coverage: 0, locations: 1 })
  })

  it('marks a scheduled trip across its month boundary', () => {
    expect([...scheduledMonths(trip('2027-09-28', '2027-10-04'))]).toEqual([8, 9])
  })

  it('groups nearby city stops onto one climate cell', () => {
    expect(climateCellKey(35.68, 139.69)).toBe(climateCellKey(35.71, 139.74))
    expect(climateCellKey(35.68, 139.69)).toBe(climateCellKey(35.44, 139.64))
    expect(climateCellKey(35.68, 139.69)).not.toBe(climateCellKey(36.2, 140.2))
  })

  it('counts one crowd region once even when the itinerary has multiple nearby stops', () => {
    const locations: SeasonLocation[] = [
      { key: 'a', name: 'Athens', lat: 38, lng: 23, days: 3, crowd: { region: 'EL30', period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: [{ month: 9, relativeDemand: 0.7, samples: 4 }] } },
      { key: 'b', name: 'Piraeus', lat: 37, lng: 23, days: 1, crowd: { region: 'EL30', period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: [{ month: 9, relativeDemand: 0.7, samples: 4 }] } },
      { key: 'c', name: 'Crete', lat: 35, lng: 25, days: 2, crowd: { region: 'EL43', period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: [{ month: 9, relativeDemand: 1.3, samples: 4 }] } },
    ]
    const result = assessCrowdMonth(locations, 8)
    expect(result).toMatchObject({ level: 'typical', coverage: 2, locations: 2 })
    expect(result.relativeDemand).toBeCloseTo(0.94)
  })

  it('excludes unlocated stops from visitor-demand coverage', () => {
    const result = assessCrowdMonth([
      { key: 'known', name: 'Tokyo', lat: 35, lng: 139, crowdLat: 35, crowdLng: 139, days: 2, crowd: { region: 'country:JP', period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: [{ month: 9, relativeDemand: 0.8, samples: 4 }] } },
      { key: 'missing', name: 'Unknown place', lat: null, lng: null, days: 1 },
    ], 8)
    expect(result).toMatchObject({ level: 'lower', relativeDemand: 0.8, coverage: 1, locations: 1 })
  })

  it('scores available visitor-demand regions and reports their coverage', () => {
    const result = assessCrowdMonth([
      { key: 'known', name: 'Tokyo', lat: 35, lng: 139, crowdLat: 35, crowdLng: 139, days: 2, crowd: { region: 'country:JP', period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: [{ month: 9, relativeDemand: 0.8, samples: 4 }] } },
      { key: 'uncovered', name: 'Place without demand', lat: 36, lng: 140, crowdLat: 36, crowdLng: 140, days: 1 },
      { key: 'unlocated', name: 'No coordinates', lat: null, lng: null, days: 1 },
    ], 8)
    expect(result).toMatchObject({ level: 'lower', relativeDemand: 0.8, coverage: 1, locations: 2 })
  })

  it('keeps unknown holiday coverage distinct from a month with no holidays', () => {
    const locations: SeasonLocation[] = [
      { key: 'a', name: 'Athens', lat: 38, lng: 23, days: 2, countryCode: 'GR' },
      { key: 'b', name: 'Paris', lat: 49, lng: 2, days: 2, countryCode: 'FR' },
    ]
    const calendars = {
      GR: { countryCode: 'GR', year: 2027, holidays: [{ date: '2027-09-14', name: 'National Day' }] },
      FR: { countryCode: 'FR', year: 2027, holidays: [] },
    }
    expect(assessHolidayMonth(locations, calendars, 8, 2027)).toMatchObject({ level: 'dates', count: 1, coverage: 2, locations: 2 })
    expect(assessHolidayMonth(locations, { GR: calendars.GR }, 8, 2027)).toMatchObject({ level: 'dates', coverage: 1, locations: 2 })
    expect(assessHolidayMonth(locations, {}, 8, 2027).level).toBe('unknown')
    expect(assessHolidayMonth([...locations, { key: 'missing', name: 'Unknown', lat: null, lng: null, days: 1 }], calendars, 8, 2027)).toMatchObject({ level: 'dates', coverage: 2, locations: 2 })
  })

  it('deduplicates shared holiday dates and sorts the calendar days', () => {
    const locations: SeasonLocation[] = [
      { key: 'a', name: 'Athens', lat: 38, lng: 23, days: 2, countryCode: 'GR' },
      { key: 'b', name: 'Paris', lat: 49, lng: 2, days: 2, countryCode: 'FR' },
    ]
    const calendars = {
      GR: { countryCode: 'GR', year: 2027, holidays: [{ date: '2027-09-14', name: 'National Day' }] },
      FR: { countryCode: 'FR', year: 2027, holidays: [{ date: '2027-09-20', name: 'Local Day' }, { date: '2027-09-14', name: 'Regional Day' }, { date: '2027-09-01', name: 'Early Month Day' }] },
    }
    expect(assessHolidayMonth(locations, calendars, 8, 2027)).toMatchObject({ count: 3, dates: [{ date: '2027-09-01' }, { date: '2027-09-14' }, { date: '2027-09-20' }] })
  })

  it('infers an unmapped destination country only from a nearby mapped trip stop', () => {
    const inferred = inferNearbyCountries([
      { key: 'known', name: 'Tokyo', lat: 35.68, lng: 139.69, crowdLat: 35.68, crowdLng: 139.69, countryCode: 'JP', days: 1 },
      { key: 'nearby', name: 'Nearby stop', lat: 35.70, lng: 139.71, crowdLat: 35.70, crowdLng: 139.71, days: 1 },
      { key: 'far', name: 'Far stop', lat: 48.85, lng: 2.35, crowdLat: 48.85, crowdLng: 2.35, days: 1 },
      { key: 'unlocated', name: 'Unlocated', lat: null, lng: null, days: 1 },
    ])
    expect(inferred.map(location => location.countryCode ?? null)).toEqual(['JP', 'JP', null, null])
    expect(inferred[1].countryInferred).toBe(true)
  })

  it('does not call sparse event samples missing geographic coverage', () => {
    const locations: SeasonLocation[] = [{
      key: 'coast', name: 'Coast', lat: 0, lng: 0, days: 1,
      hazards: {
        earthquakes: { source: 'NOAA', period: '1980–2025', radiusKm: 278, events: 5, months: [{ month: 9, events: 4, relativeActivity: 1.4 }] },
        tsunamis: { source: 'NOAA', period: '1980–2025', radiusKm: 278, events: 1, months: [{ month: 9, events: 1, relativeActivity: null }] },
      },
    }]
    expect(assessNaturalHazardMonth(locations, 8)).toMatchObject({ level: 'higher', relativeActivity: 1.4, coverage: 1, locations: 1 })
  })

  it('does not treat unsupported cyclone basins as missing hazard catalog coverage', () => {
    const locations: SeasonLocation[] = [{
      key: 'asia', name: 'Asia', lat: 10, lng: 100, days: 1, cycloneUnsupported: true,
      hazards: { earthquakes: { source: 'USGS', period: '1980–2025', radiusKm: 278, events: 8, months: [{ month: 9, events: 1, relativeActivity: 0.7 }] } },
    }]
    expect(assessNaturalHazardMonth(locations, 8)).toMatchObject({ level: 'lower', relativeActivity: 0.7, coverage: 1, locations: 1 })
  })

  it('scores covered hazard catalogs without turning missing route data into a partial state', () => {
    const locations: SeasonLocation[] = [
      { key: 'covered', name: 'Covered', lat: 10, lng: 100, days: 1, hazards: { earthquakes: { source: 'USGS', period: '1980–2025', radiusKm: 278, events: 8, months: [{ month: 9, events: 1, relativeActivity: 0.7 }] } } },
      { key: 'missing', name: 'Missing', lat: 11, lng: 101, days: 1, hazardUnavailable: true },
    ]
    expect(assessNaturalHazardMonth(locations, 8)).toMatchObject({ level: 'lower', relativeActivity: 0.7, coverage: 1, locations: 2 })
  })

})
