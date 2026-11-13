import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TripSeasonsView } from './TripSeasonsView'
import type { DashboardTrip } from './dashboardModel'

const { listDays, listPlaces, getClimateBatch, getCrowdBatch, getHolidayBatch, getGeographyBatch, getNaturalHazards } = vi.hoisted(() => ({ listDays: vi.fn(), listPlaces: vi.fn(), getClimateBatch: vi.fn(), getCrowdBatch: vi.fn(), getHolidayBatch: vi.fn(), getGeographyBatch: vi.fn(), getNaturalHazards: vi.fn() }))
vi.mock('../../api/client', () => ({ daysApi: { list: listDays }, placesApi: { list: listPlaces }, weatherApi: { getClimateBatch }, seasonsApi: { getCrowdBatch, getHolidays: getHolidayBatch, getGeographyBatch, getNaturalHazards } }))

beforeEach(() => {
  listDays.mockReset().mockResolvedValue({ days: [] })
  listPlaces.mockReset().mockResolvedValue({ places: [] })
  getClimateBatch.mockReset().mockResolvedValue([])
  getCrowdBatch.mockReset().mockResolvedValue([])
  getHolidayBatch.mockReset().mockImplementation((year: number, codes: string[]) => Promise.resolve(codes.map(countryCode => ({ countryCode, year, source: 'Nager.Date', holidays: [{ date: `${year}-09-14`, name: 'National Day' }] }))))
  getGeographyBatch.mockReset().mockImplementation((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }) => ({ key, region: 'EL30', countryCode: 'GR' }))))
  getNaturalHazards.mockReset().mockImplementation((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }) => ({
    key, cycloneCoverage: 'covered', hazards: {},
    cyclones: { source: 'NOAA HURDAT2', period: '1980–2025', radiusNm: 150, basins: ['Eastern Pacific'], events: 5,
      months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, events: index === 8 ? 2 : 0, tracksPer100Years: index === 8 ? 3.4 : 0, relativeActivity: index === 8 ? 1.3 : 0.5 })) },
  }))))
})

const trip = (id: number, title: string, date: string | null): DashboardTrip => ({
  id, user_id: 1, title, start_date: date, end_date: null, currency: 'USD', is_archived: 0, reminder_days: 0,
})

describe('TripSeasonsView', () => {
  it('keeps trips on the Y axis and months on the X axis without a travel-window filter', async () => {
    listDays.mockResolvedValue({ days: [{ assignments: [{ place: { id: 4, name: 'Tokyo', lat: 35.6, lng: 139.7 } }] }] })
    listPlaces.mockResolvedValue({ places: [{ id: 4, name: 'Tokyo', lat: 35.6, lng: 139.7 }, { id: 5, name: 'Kyoto', lat: 35, lng: 135.8 }] })
    getClimateBatch.mockImplementation((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }) => ({ key, months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, meanMaxC: 25, meanMinC: 15, precipitationMm: 100, days: 60 })) }))))
    render(<TripSeasonsView trips={[trip(1, 'Japan', null)]} onOpen={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Japan, September: Best' })).toBeInTheDocument()
    expect(screen.getByRole('table').querySelectorAll('thead th')).toHaveLength(13)
    expect(screen.getByRole('columnheader', { name: 'Sep' })).toBeInTheDocument()
    expect(screen.queryByText('Travel window')).not.toBeInTheDocument()
    expect(screen.queryByText('About seasonal fit')).not.toBeInTheDocument()
    expect(getClimateBatch).toHaveBeenCalledTimes(1)
    expect(getClimateBatch.mock.calls[0][0]).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Japan, September: Best' }))
    expect(screen.getByText(/September · Best/)).toBeInTheDocument()
    expect(screen.getByText(/Weather history is available for 2 of 2 destinations/)).toBeInTheDocument()
  })

  it('retries weather at the provider cooldown and replaces the no-data cells', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T12:00:00Z'))
    try {
      listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Tokyo', lat: 35.68, lng: 139.69 }] })
      getClimateBatch.mockResolvedValueOnce([{ key: '35.50,139.50', error: 'Open-Meteo rate limited; retry in 30 seconds' }])
        .mockImplementationOnce((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }) => ({ key, months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, meanMaxC: 25, meanMinC: 15, precipitationMm: 100, days: 60 })) }))))
      render(<TripSeasonsView trips={[trip(1, 'Japan', null)]} onOpen={vi.fn()} />)
      await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
      expect(getClimateBatch).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(35_000) })
      expect(getClimateBatch).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: 'Japan, September: Best' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('includes places saved outside itinerary days', async () => {
    listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Cusco', lat: -13.5, lng: -71.9 }] })
    getClimateBatch.mockImplementation((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }) => ({ key, months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, meanMaxC: 21, meanMinC: 11, precipitationMm: 70, days: 60 })) }))))
    render(<TripSeasonsView trips={[trip(4, 'Peru route', null)]} onOpen={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Peru route, January: Best' })).toBeInTheDocument()
    expect(getClimateBatch).toHaveBeenCalledTimes(1)
  })

  it('shows crowd seasonality as a separate matrix factor', async () => {
    listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Athens', lat: 37.98, lng: 23.72 }] })
    getCrowdBatch.mockImplementation((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }) => ({
      key, region: 'EL30', data: { period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, relativeDemand: index === 8 ? 0.72 : 1.1, samples: 4 })) },
    }))))
    render(<TripSeasonsView trips={[trip(5, 'Greece', null)]} onOpen={vi.fn()} />)
    expect(getCrowdBatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Visitor demand' }))
    expect(await screen.findByRole('button', { name: /Greece, September: Quieter than usual, 0.72 times average monthly visitor demand/ })).toBeInTheDocument()
    expect(getCrowdBatch).toHaveBeenCalled()
    expect(screen.getByText('Past visitor and hotel activity by month; coverage varies by destination')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Greece, September: Quieter than usual/ }))
    expect(screen.getByText(/regional hotel stays from 2022–2025/i)).toBeInTheDocument()
  })

  it('shows available demand as a trend while reporting route-area coverage', async () => {
    listPlaces.mockResolvedValue({ places: [
      { id: 8, name: 'Athens', lat: 37.98, lng: 23.72 },
      { id: 9, name: 'Crete', lat: 35.24, lng: 25.14 },
      { id: 10, name: 'Unlocated stop', lat: null, lng: null },
    ] })
    getCrowdBatch.mockImplementation((locations: Array<{ key: string }>) => Promise.resolve([
      { key: locations[0].key, region: 'EL30', data: { period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, relativeDemand: index === 8 ? 0.72 : 1.1, samples: 4 })) } },
      { key: locations[1].key, error: 'No visitor demand data for this region' },
    ]))
    render(<TripSeasonsView trips={[trip(5, 'Greece route', null)]} onOpen={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Visitor demand' }))
    const cell = await screen.findByRole('button', { name: /Greece route, September: Quieter than usual/ })
    expect(cell).toBeInTheDocument()
    fireEvent.click(cell)
    expect(screen.getByText(/Visitor activity was 0.72× the monthly average\. This uses regional hotel stays from 2022–2025/)).toBeInTheDocument()
    expect(screen.queryByText(/based on 1 of 2 destinations/)).not.toBeInTheDocument()
    expect(screen.queryByText(/destination has no location|destinations have no location/)).not.toBeInTheDocument()
    expect(screen.queryByText('Partial')).not.toBeInTheDocument()
  })

  it('retries transient visitor-demand failures and clears stale unavailable flags', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T12:00:00Z'))
    try {
      listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Tokyo', lat: 35.68, lng: 139.69 }] })
      getCrowdBatch.mockResolvedValueOnce([{ key: '35.50,139.50', error: 'Provider temporarily cooling down' }])
        .mockResolvedValueOnce([{ key: '35.50,139.50', region: 'country:JP', data: { period: '2022–2025', years: [2022, 2023, 2024, 2025], provisional: false, months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, relativeDemand: 0.72, samples: 4 })) } }])
      render(<TripSeasonsView trips={[trip(5, 'Japan', null)]} onOpen={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Visitor demand' }))
      await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
      expect(getCrowdBatch).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000 + 5_000) })
      expect(getCrowdBatch).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: /Japan, September: Quieter than usual/ })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads national holidays only when selected and labels their calendar year', async () => {
    listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Athens', lat: 37.98, lng: 23.72 }] })
    render(<TripSeasonsView trips={[trip(6, 'Greece', null)]} onOpen={vi.fn()} />)
    expect(getHolidayBatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Public holidays' }))
    const year = new Date().getFullYear()
    expect(await screen.findByRole('button', { name: 'Greece, September: 1 holiday date' })).toBeInTheDocument()
    expect(screen.getByText(`Public holidays in ${year}; some places may close or be busier`)).toBeInTheDocument()
    expect(getHolidayBatch).toHaveBeenCalledWith(year, ['GR'])
    fireEvent.click(screen.getByRole('button', { name: 'Greece, September: 1 holiday date' }))
    expect(screen.getByText(new RegExp(`${year}-09-14: National Day`))).toBeInTheDocument()
    expect(screen.queryByText(/Holidays may affect opening hours and local travel/)).not.toBeInTheDocument()
  })

  it('loads holiday calendars in bounded batches', async () => {
    listPlaces.mockResolvedValue({ places: Array.from({ length: 17 }, (_, id) => ({ id, name: `City ${id}`, lat: id, lng: id })) })
    getGeographyBatch.mockImplementation((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }, index) => ({ key, region: 'US', countryCode: `C${index}` }))))
    render(<TripSeasonsView trips={[trip(6, 'Multi-country route', null)]} onOpen={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Public holidays' }))
    await waitFor(() => expect(getHolidayBatch).toHaveBeenCalledTimes(2))
    expect(getHolidayBatch.mock.calls.map(([, codes]) => codes.length)).toEqual([16, 1])
  })

  it('infers a nearby unmapped holiday country and uses its calendar', async () => {
    listPlaces.mockResolvedValue({ places: [
      { id: 1, name: 'Mapped stop', lat: 37.2, lng: 23.72 },
      { id: 2, name: 'Nearby stop', lat: 37.3, lng: 23.72 },
    ] })
    let mappedKey: string | undefined
    getGeographyBatch.mockImplementation((locations: Array<{ key: string }>) => {
      mappedKey ||= locations[0]?.key
      return Promise.resolve(locations.map(({ key }) => key === mappedKey
        ? { key, region: 'GR', countryCode: 'GR' }
        : { key, region: 'unknown' }))
    })
    render(<TripSeasonsView trips={[trip(6, 'Greece route', null)]} onOpen={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Public holidays' }))
    const year = new Date().getFullYear()
    const cell = await screen.findByRole('button', { name: 'Greece route, September: 1 holiday date' })
    expect(getHolidayBatch).toHaveBeenCalledWith(year, ['GR'])
    fireEvent.click(cell)
    expect(screen.getByText(/We matched 1 destination country using a nearby stop/)).toBeInTheDocument()
    expect(screen.getByText(/Holiday calendars are available for 1 of 1 destination countries/)).toBeInTheDocument()
  })

  it('loads natural hazard history only when selected without extra source disclaimers', async () => {
    listPlaces.mockResolvedValue({ places: [{ id: 9, name: 'Acapulco', lat: 16.85, lng: -99.9 }] })
    render(<TripSeasonsView trips={[trip(9, 'Pacific Mexico', null)]} onOpen={vi.fn()} />)
    expect(getNaturalHazards).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Natural hazards' }))
    expect(await screen.findByRole('button', { name: /Pacific Mexico, September: 1.30 times usual recorded activity/ })).toBeInTheDocument()
    expect(screen.getByText(/Past earthquakes, tsunamis, volcanic eruptions, and cyclones/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pacific Mexico, September: 1.30 times usual/ }))
    expect(screen.queryByText(/not a forecast or personal risk estimate/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cyclone records cover the Atlantic/)).not.toBeInTheDocument()
    expect(getNaturalHazards).toHaveBeenCalledTimes(1)
  })

  it('shows hazard trends for covered locations when another route area has no catalog', async () => {
    listPlaces.mockResolvedValue({ places: [
      { id: 1, name: 'Covered', lat: 10, lng: 100 },
      { id: 2, name: 'Uncovered', lat: 20, lng: 110 },
    ] })
    getNaturalHazards.mockImplementation((locations: Array<{ key: string }>) => Promise.resolve([
      { key: locations[0].key, hazards: { earthquakes: { source: 'USGS', period: '1980–2025', radiusKm: 278, events: 8, months: [{ month: 9, events: 1, relativeActivity: 0.7 }] } } },
      { key: locations[1].key, error: 'Catalog unavailable' },
    ]))
    render(<TripSeasonsView trips={[trip(9, 'Hazard route', null)]} onOpen={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Natural hazards' }))
    const cell = await screen.findByRole('button', { name: /Hazard route, September: 0.70 times usual recorded activity/ })
    fireEvent.click(cell)
    expect(screen.queryByText(/Records are available for 1 of 2 destinations/)).not.toBeInTheDocument()
    expect(screen.queryByText('Partial coverage')).not.toBeInTheDocument()
  })

  it('retries deferred hazard history on the next UTC day', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T12:00:00Z'))
    try {
      listPlaces.mockResolvedValue({ places: [{ id: 9, name: 'Tokyo', lat: 35.68, lng: 139.69 }] })
      getNaturalHazards.mockResolvedValueOnce([{ key: '35.50,139.50', cycloneCoverage: 'unavailable', error: 'Provider returned HTTP 429' }])
      render(<TripSeasonsView trips={[trip(9, 'Japan', null)]} onOpen={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Natural hazards' }))
      await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
      expect(getNaturalHazards).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000 + 5_000) })
      expect(getNaturalHazards).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: /Japan, September: 1.30 times usual recorded activity/ })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('explains when climate cells are empty because destinations lack coordinates', async () => {
    listDays.mockResolvedValue({ days: [{ assignments: [{ place: { id: 5, name: 'Remote destination', lat: null, lng: null } }] }] })
    render(<TripSeasonsView trips={[trip(3, 'Remote trip', null)]} onOpen={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Remote trip, September: Unavailable' })).toBeInTheDocument()
    expect(screen.queryByText('Add destination locations to see typical weather.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remote trip, September: Unavailable' }))
    expect(screen.getByText(/Add destination locations to see typical weather\./)).toBeInTheDocument()
    expect(screen.getByText(/1 destination has no location and is not included\./)).toBeInTheDocument()
  })

  it('keeps climate request failures out of trip rows until a month is opened', async () => {
    listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Cusco', lat: -13.5, lng: -71.9 }] })
    getClimateBatch.mockRejectedValue(new Error('rate limited'))
    render(<TripSeasonsView trips={[trip(4, 'Peru route', null)]} onOpen={vi.fn()} />)
    const cell = await screen.findByRole('button', { name: 'Peru route, September: Unavailable' })
    expect(screen.queryByText('Weather history is temporarily unavailable. Please try again later.')).not.toBeInTheDocument()
    fireEvent.click(cell)
    expect(screen.getByText('Weather history is temporarily unavailable. Please try again later.')).toBeInTheDocument()
  })

  it('shows the climate provider error returned for a route location', async () => {
    listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Cusco', lat: -13.5, lng: -71.9 }] })
    getClimateBatch.mockImplementation((locations: Array<{ key: string }>) => Promise.resolve(locations.map(({ key }) => ({ key, error: 'Provider returned HTTP 400' }))))
    render(<TripSeasonsView trips={[trip(4, 'Peru route', null)]} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Peru route, September: Unavailable' }))
    expect(screen.getByText('Weather history is temporarily unavailable. Please try again later.')).toBeInTheDocument()
    expect(screen.queryByText(/HTTP 400/)).not.toBeInTheDocument()
  })

  it('shows why a holiday calendar is unavailable for a country', async () => {
    listPlaces.mockResolvedValue({ places: [{ id: 8, name: 'Athens', lat: 37.98, lng: 23.72 }] })
    getHolidayBatch.mockResolvedValue([{ countryCode: 'GR', year: new Date().getFullYear(), source: 'Nager.Date', error: 'Provider returned HTTP 404' }])
    render(<TripSeasonsView trips={[trip(6, 'Greece', null)]} onOpen={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Public holidays' }))
    await waitFor(() => expect(getHolidayBatch).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: 'Greece, September: Unavailable' }))
    expect(screen.getByText(/Some holiday calendars could not be loaded/)).toBeInTheDocument()
    expect(screen.queryByText(/HTTP 404/)).not.toBeInTheDocument()
  })

  it('searches table rows and opens the selected trip', async () => {
    const onOpen = vi.fn()
    render(<TripSeasonsView trips={[trip(1, 'Japan', null), trip(2, 'Peru', null)]} onOpen={onOpen} />)
    fireEvent.change(screen.getByPlaceholderText('Find a trip'), { target: { value: 'Peru' } })
    expect(screen.queryByRole('row', { name: /Japan/ })).not.toBeInTheDocument()
    const row = await screen.findByRole('row', { name: /Peru/ })
    fireEvent.click(within(row).getByRole('button', { name: /Open dates/ }))
    expect(onOpen).toHaveBeenCalledWith(2)
  })
})
