import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import type { Accommodation, AssignmentsMap, Day, Place, Reservation } from '../../types'
import { isDayInAccommodationRange } from '../../utils/dayOrder'
import { calculateRouteWithLegs } from '../Map/RouteCalculator'

type Props = {
  tripId: number
  days: Day[]
  places: Place[]
  assignments: AssignmentsMap
  reservations: Reservation[]
  accommodations: Accommodation[]
  onPlaceClick: (placeId: number) => void
  onDayClick: (day: Day) => void
  onReservationClick?: (reservation: Reservation) => void
}

type Warning = { id: string; text: string; action: () => void }
type TravelWarning = Warning

function readDismissals(tripId: number): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(`trip-readiness-${tripId}`) || '{}') } catch { return {} }
}

function minutes(value: string | null | undefined): number | null {
  const match = value?.match(/(?:T|^)(\d{1,2}):(\d{2})/)
  if (!match) return null
  const result = Number(match[1]) * 60 + Number(match[2])
  return result >= 0 && result < 24 * 60 ? result : null
}

export function ItineraryReadiness({ tripId, days, places, assignments, reservations, accommodations, onPlaceClick, onDayClick, onReservationClick }: Props) {
  const [dismissals, setDismissals] = useState(() => readDismissals(tripId))
  const [checkingTravel, setCheckingTravel] = useState(false)
  const [showAllWarnings, setShowAllWarnings] = useState(false)
  const [travelWarnings, setTravelWarnings] = useState<TravelWarning[] | null>(null)
  const [unassessedTravelLegs, setUnassessedTravelLegs] = useState(0)
  const warnings = useMemo(() => {
    const assigned = new Set(Object.values(assignments).flat().map(a => a.place_id))
    const incompleteTransport = new Set(['flight', 'train', 'bus', 'ferry', 'car_rental', 'transit'])
    const result: Warning[] = []
    for (const place of places) if (!assigned.has(place.id)) result.push({ id: `place-${place.id}`, text: `${place.name} is unscheduled`, action: () => onPlaceClick(place.id) })
    for (const reservation of reservations) {
      if (!reservation.day_id && !reservation.assignment_id) result.push({ id: `booking-${reservation.id}`, text: `${reservation.title} is not assigned to a day`, action: () => onReservationClick?.(reservation) })
      if (incompleteTransport.has(reservation.type) && (reservation.endpoints?.length || 0) < 2) result.push({ id: `transport-${reservation.id}`, text: `${reservation.title} is missing transport endpoints`, action: () => onReservationClick?.(reservation) })
    }
    for (const day of days) {
      const overnightTransport = reservations.some(reservation =>
        incompleteTransport.has(reservation.type) &&
        reservation.reservation_time?.slice(0, 10) === day.date &&
        (reservation.reservation_end_time?.slice(0, 10) || '') > day.date,
      )
      if (!overnightTransport && !accommodations.some(accommodation => isDayInAccommodationRange(day, accommodation.start_day_id, accommodation.end_day_id, days))) {
        result.push({ id: `stay-${day.id}`, text: `No accommodation for day ${day.day_number}`, action: () => onDayClick(day) })
      }
    }
    return result
  }, [days, places, assignments, reservations, accommodations, onPlaceClick, onDayClick, onReservationClick])
  const visible = warnings.filter(warning => !dismissals[warning.id])
  const tripDays = days.map(day => day.date).filter((date): date is string => !!date).sort()
  const lastTripDay = tripDays[tripDays.length - 1]
  const tripHasEnded = !!lastTripDay && lastTripDay < new Date().toISOString().slice(0, 10)

  if (tripHasEnded) return (
    <section aria-label="Itinerary readiness" className="border-b border-edge-secondary px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
        <CheckCircle2 size={14} /> Trip completed
      </div>
    </section>
  )

  const dismiss = (id: string) => {
    const reason = window.prompt('Why is this warning safe to dismiss?')?.trim()
    if (!reason) return
    const next = { ...dismissals, [id]: reason }
    setDismissals(next)
    localStorage.setItem(`trip-readiness-${tripId}`, JSON.stringify(next))
  }

  const checkTravelTimes = async () => {
    setCheckingTravel(true)
    const next: TravelWarning[] = []
    let unassessed = 0
    try {
      for (const day of days) {
        const ordered = [...(assignments[String(day.id)] || [])].sort((a, b) => a.order_index - b.order_index)
        for (let index = 1; index < ordered.length; index += 1) {
          const previous = ordered[index - 1]
          const current = ordered[index]
          const prevStart = minutes(previous.assignment_time ?? previous.place.place_time)
          const prevEnd = minutes(previous.assignment_end_time ?? previous.place.end_time) ?? (prevStart != null && previous.place.duration_minutes != null ? prevStart + previous.place.duration_minutes : prevStart)
          const currentStart = minutes(current.assignment_time ?? current.place.place_time)
          if (prevEnd == null || currentStart == null || previous.place.lat == null || previous.place.lng == null || current.place.lat == null || current.place.lng == null) {
            unassessed += 1
            continue
          }
          try {
            const route = await calculateRouteWithLegs([{ lat: previous.place.lat, lng: previous.place.lng }, { lat: current.place.lat, lng: current.place.lng }])
            const travelMinutes = Math.ceil((route.legs[0]?.duration || 0) / 60)
            if (travelMinutes > currentStart - prevEnd) next.push({
              id: `travel-${previous.id}-${current.id}`,
              text: `${previous.place.name} → ${current.place.name} needs about ${travelMinutes} min, but only ${Math.max(0, currentStart - prevEnd)} min is scheduled`,
              action: () => onDayClick(day),
            })
          } catch { unassessed += 1 }
        }
      }
      setTravelWarnings(next)
      setUnassessedTravelLegs(unassessed)
    } finally {
      setCheckingTravel(false)
    }
  }

  return (
    <section aria-label="Itinerary readiness" className="border-b border-edge-secondary px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-content">
        {visible.length ? <AlertTriangle size={14} className="text-amber-600" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
        {visible.length ? `${visible.length} planning check${visible.length === 1 ? '' : 's'}` : 'Itinerary ready'}
      </div>
      {visible.length > 0 && (
        <>
          <ul id={`itinerary-readiness-warnings-${tripId}`} className="mt-1 space-y-1">
            {visible.slice(0, showAllWarnings ? visible.length : 4).map(warning => (
              <li key={warning.id} className="flex items-center gap-1 text-xs text-content-secondary">
                <button type="button" onClick={warning.action} className="min-w-0 flex-1 truncate text-left hover:underline">{warning.text}</button>
                <button type="button" onClick={() => dismiss(warning.id)} aria-label={`Dismiss ${warning.text}`} className="rounded p-0.5 text-content-faint hover:bg-surface-hover"><X size={12} /></button>
              </li>
            ))}
          </ul>
          {visible.length > 4 && (
            <button type="button" aria-expanded={showAllWarnings} aria-controls={`itinerary-readiness-warnings-${tripId}`} onClick={() => setShowAllWarnings(value => !value)} className="mt-1 text-xs text-content-faint hover:underline">
              {showAllWarnings ? 'Show fewer' : `Show ${visible.length - 4} more`}
            </button>
          )}
        </>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={checkTravelTimes} disabled={checkingTravel} className="rounded border border-edge px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-hover disabled:opacity-60">
          {checkingTravel ? 'Checking travel times…' : 'Check driving travel times'}
        </button>
        {travelWarnings?.length === 0 && !checkingTravel && <span className="text-xs text-content-faint">No impossible travel gaps found.</span>}
      </div>
      <p className="mt-1 text-xs text-content-faint">Uses local itinerary times and a driving-route estimate; it never changes your order.</p>
      {travelWarnings && travelWarnings.length > 0 && (
        <ul className="mt-1 space-y-1">
          {travelWarnings.map(warning => <li key={warning.id}><button type="button" onClick={warning.action} className="text-left text-xs text-amber-700 hover:underline">{warning.text}</button></li>)}
        </ul>
      )}
      {travelWarnings && unassessedTravelLegs > 0 && <p className="mt-1 text-xs text-content-faint">Cannot assess {unassessedTravelLegs} leg{unassessedTravelLegs === 1 ? '' : 's'} without times, coordinates, or a route.</p>}
    </section>
  )
}
