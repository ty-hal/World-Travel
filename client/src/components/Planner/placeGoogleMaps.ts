import type { AssignmentPlace, Place } from '../../types'

type PlaceLike = Pick<Place | AssignmentPlace, 'name' | 'lat' | 'lng' | 'google_place_id' | 'google_ftid'>
const GOOGLE_FTID_RE = /^0x[0-9a-f]+:0x[0-9a-f]+$/i

/** Coords-only search URL (pin at a point, no business listing). */
export function getGoogleMapsUrlForCoords(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/**
 * Explore-POI link: search the place name anchored at lat/lng.
 * Name and coords stay in separate URL parts so RTL names cannot bidi-scramble
 * a free-text "name, lat, lng" query into something Google can't find.
 */
export function getGoogleMapsUrlForPoi(poi: { name: string; lat: number; lng: number }): string {
  const name = poi.name.trim()
  if (!name) return getGoogleMapsUrlForCoords(poi.lat, poi.lng)
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${poi.lat},${poi.lng},17z`
}

export function getGoogleMapsUrlForPlace(place: PlaceLike | null | undefined, detailsUrl?: string | null): string | null {
  if (!place) return null
  const ftid = place.google_ftid?.trim()
  if (ftid && GOOGLE_FTID_RE.test(ftid)) {
    return `https://www.google.com/maps/place/?q=${encodeURIComponent(place.name)}&ftid=${ftid}`
  }
  const placeId = place.google_place_id?.trim()
  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(placeId)}`
  }
  if (detailsUrl) return detailsUrl
  if (place.lat == null || place.lng == null) return null
  return getGoogleMapsUrlForCoords(place.lat, place.lng)
}
