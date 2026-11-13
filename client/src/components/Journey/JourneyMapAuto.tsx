import { forwardRef, lazy, Suspense, useImperativeHandle, useRef } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import JourneyMap, { type JourneyMapHandle } from './JourneyMap'
import type { JourneyMapGLHandle } from './JourneyMapGL'
import { resolveInteractiveGlProvider } from '../Map/glProviders'
import type { JourneyTrack } from '@trek/shared'

// Lazy-load the GL renderer (and its ~230 KB gzip engine).
const JourneyMapGL = lazy(() => import('./JourneyMapGL'))

// Unified handle — both providers expose the same three methods.
export type JourneyMapAutoHandle = JourneyMapHandle

interface MapEntry {
  id: string
  lat: number
  lng: number
  title?: string | null
  location_name?: string | null
  mood?: string | null
  entry_date: string
  dayColor?: string
  dayLabel?: number
}

interface Props {
  checkins: unknown[]
  entries: MapEntry[]
  tracks?: JourneyTrack[]
  trail?: { lat: number; lng: number }[]
  height?: number
  dark?: boolean
  activeMarkerId?: string | null
  onMarkerClick?: (id: string, type?: string) => void
  fullScreen?: boolean
  paddingBottom?: number
}

const JourneyMapAuto = forwardRef<JourneyMapAutoHandle, Props>(function JourneyMapAuto(props, ref) {
  const provider = useSettingsStore(s => s.settings.map_provider)
  const token = useSettingsStore(s => s.settings.mapbox_access_token)
  const leafletRef = useRef<JourneyMapHandle>(null)
  const glRef = useRef<JourneyMapGLHandle>(null)

  // Same rule as MapViewAuto: never stay on Leaflet OSM for interactive maps —
  // raster tiles cannot honor account language (Chinese labels over China, etc.).
  const glProvider = resolveInteractiveGlProvider(provider, token)

  useImperativeHandle(ref, () => ({
    highlightMarker: (id) => glRef.current?.highlightMarker(id) ?? leafletRef.current?.highlightMarker(id),
    focusMarker: (id) => glRef.current?.focusMarker(id) ?? leafletRef.current?.focusMarker(id),
    invalidateSize: () => glRef.current?.invalidateSize() ?? leafletRef.current?.invalidateSize(),
  }), [])

  return (
    <Suspense fallback={<JourneyMap ref={leafletRef} {...(props as any)} />}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <JourneyMapGL ref={glRef} {...(props as any)} glProvider={glProvider} />
    </Suspense>
  )
})

export default JourneyMapAuto
