import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../../../tests/helpers/render'
import { ItineraryReadiness } from './ItineraryReadiness'

vi.mock('../Map/RouteCalculator', () => ({
  calculateRouteWithLegs: vi.fn().mockResolvedValue({ legs: [{ duration: 1800 }] }),
}))

const day = { id: 1, trip_id: 1, day_number: 1, date: '2027-01-01', title: null }
const place = { id: 2, trip_id: 1, name: 'Museum', lat: null, lng: null }
const booking = { id: 3, trip_id: 1, title: 'Train', type: 'train', status: 'pending', day_id: null, assignment_id: null, endpoints: [] }

afterEach(() => localStorage.clear())

describe('ItineraryReadiness', () => {
  it('FE-PLANNER-READINESS-001: surfaces actionable gaps and persists a dismiss reason', async () => {
    const onPlaceClick = vi.fn()
    const onDayClick = vi.fn()
    const onReservationClick = vi.fn()
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Booked separately')
    render(<ItineraryReadiness tripId={1} days={[day] as any} places={[place] as any} assignments={{}} reservations={[booking] as any} accommodations={[]} onPlaceClick={onPlaceClick} onDayClick={onDayClick} onReservationClick={onReservationClick} />)

    expect(screen.getByText('Museum is unscheduled')).toBeInTheDocument()
    expect(screen.getByText('Train is not assigned to a day')).toBeInTheDocument()
    expect(screen.getByText('No accommodation for day 1')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Museum is unscheduled'))
    expect(onPlaceClick).toHaveBeenCalledWith(2)

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss Museum is unscheduled' }))
    expect(screen.queryByText('Museum is unscheduled')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('trip-readiness-1') || '{}')).toEqual({ 'place-2': 'Booked separately' })
    prompt.mockRestore()
  })

  it('FE-PLANNER-READINESS-002: reports an impossible scheduled travel gap only on demand', async () => {
    const onDayClick = vi.fn()
    const first = { ...place, id: 4, name: 'First stop', lat: 48.8566, lng: 2.3522 }
    const second = { ...place, id: 5, name: 'Second stop', lat: 48.8584, lng: 2.2945 }
    render(<ItineraryReadiness tripId={1} days={[day] as any} places={[first, second] as any} assignments={{ '1': [
      { id: 10, day_id: 1, place_id: 4, order_index: 0, assignment_time: '09:00', assignment_end_time: '09:30', place: first },
      { id: 11, day_id: 1, place_id: 5, order_index: 1, assignment_time: '09:45', place: second },
    ] } as any} reservations={[]} accommodations={[]} onPlaceClick={vi.fn()} onDayClick={onDayClick} />)

    await userEvent.click(screen.getByRole('button', { name: 'Check driving travel times' }))
    const warning = await screen.findByText(/First stop → Second stop needs about 30 min, but only 15 min is scheduled/)
    await userEvent.click(warning)
    expect(onDayClick).toHaveBeenCalledWith(day)
  })

  it('FE-PLANNER-READINESS-003: lets travelers reveal and collapse checks beyond the first four', async () => {
    const places = Array.from({ length: 5 }, (_, index) => ({ ...place, id: index + 20, name: `Place ${index + 1}` }))
    render(<ItineraryReadiness tripId={1} days={[{ ...day, date: '2026-12-01' }] as any} places={places as any} assignments={{}} reservations={[]} accommodations={[]} onPlaceClick={vi.fn()} onDayClick={vi.fn()} />)

    expect(screen.getByText('Place 4 is unscheduled')).toBeInTheDocument()
    expect(screen.queryByText('Place 5 is unscheduled')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    expect(screen.getByText('Place 5 is unscheduled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(screen.queryByText('Place 5 is unscheduled')).not.toBeInTheDocument()
  })
})
