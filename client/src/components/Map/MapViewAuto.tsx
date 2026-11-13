import { lazy, Suspense } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { MapView } from './MapView'
import { resolveInteractiveGlProvider } from './glProviders'

// MapLibre/Mapbox pull in a ~230 KB (gzip) GL engine. Lazy-load the GL renderer so
// it is only downloaded when the trip/journey map mounts.
const MapViewGL = lazy(() => import('./MapViewGL').then(m => ({ default: m.MapViewGL })))

// Auto-selects the map renderer based on user settings.
//
// Leaflet + OpenStreetMap raster tiles bake labels into the PNG (local script over
// China, Japan, etc.) and cannot follow account language. Interactive maps always
// use MapLibre/OpenFreeMap (tokenless) or Mapbox GL when a token is set.
// Atlas still imports Leaflet directly. Offline tile prefetch remains Leaflet-only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MapViewAuto(props: any) {
  const provider = useSettingsStore(s => s.settings.map_provider)
  const token = useSettingsStore(s => s.settings.mapbox_access_token)
  const glProvider = resolveInteractiveGlProvider(provider, token)

  // Leaflet as Suspense fallback only — brief flash before the GL chunk loads.
  return (
    <Suspense fallback={<MapView {...props} />}>
      <MapViewGL {...props} glProvider={glProvider} />
    </Suspense>
  )
}
