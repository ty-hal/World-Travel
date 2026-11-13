import { useEffect, useState } from 'react'
import type { GlMapProvider } from './glProviders'

// Keep mutually exclusive WebGL engines out of the same route chunk. CSS is
// loaded with its engine so a Leaflet-only install never requests either one.
export function useGlRenderer(provider: GlMapProvider) {
  const [renderer, setRenderer] = useState<any>(null)

  useEffect(() => {
    let active = true
    setRenderer(null)
    const load = provider === 'maplibre-gl'
      ? import('maplibre-gl').then(async module => { await import('maplibre-gl/dist/maplibre-gl.css'); return module.default })
      : import('mapbox-gl').then(async module => { await import('mapbox-gl/dist/mapbox-gl.css'); return module.default })
    load.then(renderer => { if (active) setRenderer(renderer) })
    return () => { active = false }
  }, [provider])

  return renderer
}
