/** Free Leaflet raster basemap — no API key required. */
export const OPENSTREETMAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

const PAID_TILE_HOST_MARKERS = [
  'basemaps.cartocdn.com',
  'stadiamaps.com',
  'api.mapbox.com',
  'api.maptiler.com',
]

/** True when the URL looks like a self-hostable / open tile endpoint (not Carto/Stadia/etc.). */
export function isFreeLeafletTileUrl(url?: string | null): boolean {
  const trimmed = (url || '').trim()
  if (!trimmed.startsWith('https://')) return false
  try {
    const sample = trimmed
      .replace(/\{s\}/g, 'a')
      .replace(/\{x\}/g, '0')
      .replace(/\{y\}/g, '0')
      .replace(/\{r\}/g, '')
    const { hostname } = new URL(sample)
    return !PAID_TILE_HOST_MARKERS.some(marker => hostname.includes(marker))
  } catch {
    return false
  }
}

/** Pick a Leaflet tile URL, falling back to OSM when unset or pointing at a paid provider. */
export function resolveLeafletTileUrl(userTileUrl?: string | null): string {
  const trimmed = (userTileUrl || '').trim()
  if (trimmed && isFreeLeafletTileUrl(trimmed)) return trimmed
  return OPENSTREETMAP_TILE_URL
}

/** Letterbox / ocean fill for Atlas (no raster basemap). Light mode is locked. */
export const OPENSTREETMAP_OCEAN_LIGHT = '#aad3df'
/** Soft mid-teal — lighter than the old #2d4f5c so white land doesn't float on black water. */
export const OPENSTREETMAP_OCEAN_DARK = '#5a8494'

export function atlasMapBackground(dark: boolean): string {
  return dark ? OPENSTREETMAP_OCEAN_DARK : OPENSTREETMAP_OCEAN_LIGHT
}

/**
 * World-view latitude. Higher = inhabited land sits closer to the top of the
 * viewport (Arctic ocean is clipped). Vertical pan is locked at world zoom.
 */
export const ATLAS_WORLD_LAT = 42
export const ATLAS_WORLD_ZOOM = 2
export const ATLAS_LNG_BOUNDS: [number, number] = [-220, 220]

/** Zoom so the world fills the viewport width (no side letterbox). Snapped to 0.25. */
export function atlasWorldZoom(viewportWidth: number): number {
  if (!(viewportWidth > 0)) return ATLAS_WORLD_ZOOM
  const fill = Math.min(3, Math.max(ATLAS_WORLD_ZOOM, Math.log2(viewportWidth / 256)))
  return Math.round(fill * 4) / 4
}

export function atlasMaxBounds(zoom: number, worldZoom: number = ATLAS_WORLD_ZOOM): [[number, number], [number, number]] {
  if (zoom <= worldZoom + 0.08) {
    return [[ATLAS_WORLD_LAT - 0.02, ATLAS_LNG_BOUNDS[0]], [ATLAS_WORLD_LAT + 0.02, ATLAS_LNG_BOUNDS[1]]]
  }
  return [[-85, ATLAS_LNG_BOUNDS[0]], [85, ATLAS_LNG_BOUNDS[1]]]
}

/** Unvisited land on the ocean-only Atlas basemap (no city raster tiles). */
export function atlasUnvisitedLandFill(dark: boolean): { fillColor: string; fillOpacity: number; color: string; weight: number } {
  return dark
    ? { fillColor: '#ffffff', fillOpacity: 0.96, color: '#d4d4d8', weight: 0.5 }
    : { fillColor: '#f8fafc', fillOpacity: 0.96, color: '#cbd5e1', weight: 0.5 }
}

/** Atlas no longer uses raster tiles; kept for planner/other Leaflet maps. */
export function atlasLeafletTileUrl(userTileUrl?: string | null): string {
  return resolveLeafletTileUrl(userTileUrl)
}
