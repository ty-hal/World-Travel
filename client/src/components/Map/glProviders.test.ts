import { describe, expect, it, vi } from 'vitest'
import {
  MAPBOX_DEFAULT_STYLE,
  OPENFREEMAP_DEFAULT_STYLE,
  isOpenFreeMapStyle,
  isOpenFreeMapLightStyle,
  normalizeStyleForProvider,
  styleForActiveProvider,
  basemapLanguage,
  layerUsesPlaceName,
  labelTextFieldExpression,
  applyBasemapLabelLanguage,
  resolveInteractiveGlProvider,
} from './glProviders'

describe('glProviders', () => {
  it('keeps OpenFreeMap styles for MapLibre', () => {
    const style = 'https://tiles.openfreemap.org/styles/bright'

    expect(normalizeStyleForProvider('maplibre-gl', style)).toBe(style)
  })

  it('falls back to OpenFreeMap for MapLibre styles outside the CSP allowlist', () => {
    expect(normalizeStyleForProvider('maplibre-gl', 'https://demotiles.maplibre.org/style.json')).toBe(
      OPENFREEMAP_DEFAULT_STYLE,
    )
    expect(normalizeStyleForProvider('maplibre-gl', MAPBOX_DEFAULT_STYLE)).toBe(OPENFREEMAP_DEFAULT_STYLE)
  })

  it('leaves Mapbox styles unchanged for Mapbox GL', () => {
    expect(normalizeStyleForProvider('mapbox-gl', MAPBOX_DEFAULT_STYLE)).toBe(MAPBOX_DEFAULT_STYLE)
  })

  it('matches the OpenFreeMap CSP host', () => {
    expect(isOpenFreeMapStyle('https://tiles.openfreemap.org/styles/liberty')).toBe(true)
    expect(isOpenFreeMapStyle('https://demotiles.maplibre.org/style.json')).toBe(false)
  })

  it('identifies only the known light OpenFreeMap presets', () => {
    expect(isOpenFreeMapLightStyle(OPENFREEMAP_DEFAULT_STYLE)).toBe(true)
    expect(isOpenFreeMapLightStyle('https://tiles.openfreemap.org/styles/bright')).toBe(true)
    expect(isOpenFreeMapLightStyle('https://tiles.openfreemap.org/styles/positron')).toBe(true)
    expect(isOpenFreeMapLightStyle('https://tiles.openfreemap.org/styles/dark')).toBe(false)
    expect(isOpenFreeMapLightStyle('mapbox://styles/mapbox/dark-v11')).toBe(false)
    expect(isOpenFreeMapLightStyle('https://tiles.openfreemap.org.evil.test/styles/liberty')).toBe(false)
  })

  it('rejects host/userinfo spoofing and http downgrade', () => {
    expect(isOpenFreeMapStyle('https://tiles.openfreemap.org.evil.com/styles/x')).toBe(false)
    expect(isOpenFreeMapStyle('https://evil.com/@tiles.openfreemap.org/styles/x')).toBe(false)
    expect(isOpenFreeMapStyle('http://tiles.openfreemap.org/styles/liberty')).toBe(false)
    expect(isOpenFreeMapStyle('  https://tiles.openfreemap.org/styles/liberty  ')).toBe(true)
  })

  it('falls back to provider defaults for empty/whitespace styles', () => {
    expect(normalizeStyleForProvider('maplibre-gl', '')).toBe(OPENFREEMAP_DEFAULT_STYLE)
    expect(normalizeStyleForProvider('maplibre-gl', '   ')).toBe(OPENFREEMAP_DEFAULT_STYLE)
    expect(normalizeStyleForProvider('mapbox-gl', '')).toBe(MAPBOX_DEFAULT_STYLE)
    expect(normalizeStyleForProvider('mapbox-gl', null)).toBe(MAPBOX_DEFAULT_STYLE)
  })

  it('styleForActiveProvider reads each provider\'s own style slot', () => {
    const mb = 'mapbox://styles/me/custom'
    const ofm = 'https://tiles.openfreemap.org/styles/bright'
    expect(styleForActiveProvider('mapbox-gl', mb, ofm)).toBe(mb)
    expect(styleForActiveProvider('maplibre-gl', mb, ofm)).toBe(ofm)
    // An empty MapLibre slot falls back to the OpenFreeMap default, leaving mapbox untouched.
    expect(styleForActiveProvider('maplibre-gl', mb, '')).toBe(OPENFREEMAP_DEFAULT_STYLE)
  })

  it('basemapLanguage maps TREK UI codes to basemap label codes (#1299)', () => {
    // Pass-through for plain ISO 639-1 codes.
    expect(basemapLanguage('en')).toBe('en')
    expect(basemapLanguage('de')).toBe('de')
    expect(basemapLanguage('fr')).toBe('fr')
    // TREK-specific overrides.
    expect(basemapLanguage('br')).toBe('pt')
    expect(basemapLanguage('gr')).toBe('el')
    expect(basemapLanguage('zh')).toBe('zh-Hans')
    expect(basemapLanguage('zhTw')).toBe('zh-Hant')
    expect(basemapLanguage('zh-TW')).toBe('zh-Hant')
    // Falls back to English when unset.
    expect(basemapLanguage(undefined)).toBe('en')
    expect(basemapLanguage('')).toBe('en')
  })

  it('layerUsesPlaceName detects name-based label fields', () => {
    expect(layerUsesPlaceName(['get', 'name'])).toBe(true)
    expect(layerUsesPlaceName(['coalesce', ['get', 'name_en'], ['get', 'name']])).toBe(true)
    expect(layerUsesPlaceName('{name_en}')).toBe(true)
    expect(layerUsesPlaceName(['get', 'ref'])).toBe(false)
    expect(layerUsesPlaceName(['get', 'point_count_abbreviated'])).toBe(false)
  })

  it('labelTextFieldExpression prefers account language then English then Latin', () => {
    expect(labelTextFieldExpression('en')).toEqual([
      'coalesce',
      ['get', 'name_en'],
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name_latin'],
      ['get', 'name'],
    ])
    expect(labelTextFieldExpression('de')).toEqual([
      'coalesce',
      ['get', 'name_de'],
      ['get', 'name:de'],
      ['get', 'name_en'],
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name_latin'],
      ['get', 'name'],
    ])
  })

  it('resolveInteractiveGlProvider upgrades Leaflet to MapLibre for language-capable tiles', () => {
    expect(resolveInteractiveGlProvider('leaflet')).toBe('maplibre-gl')
    expect(resolveInteractiveGlProvider('maplibre-gl')).toBe('maplibre-gl')
    expect(resolveInteractiveGlProvider('mapbox-gl', '')).toBe('maplibre-gl')
    expect(resolveInteractiveGlProvider('mapbox-gl', 'pk.test')).toBe('mapbox-gl')
  })

  it('applyBasemapLabelLanguage uses setLanguage for Standard (setConfigProperty is a no-op in GL JS ≥3.18)', () => {
    const setLanguage = vi.fn()
    const setConfigProperty = vi.fn()
    applyBasemapLabelLanguage(
      { setLanguage, setConfigProperty },
      'en',
      MAPBOX_DEFAULT_STYLE,
    )
    expect(setLanguage).toHaveBeenCalledWith('en')
    expect(setConfigProperty).toHaveBeenCalledWith('basemap', 'language', 'en')
  })

  it('applyBasemapLabelLanguage setLanguage works for non-English account language', () => {
    const setLanguage = vi.fn()
    applyBasemapLabelLanguage(
      { setLanguage },
      'de',
      MAPBOX_DEFAULT_STYLE,
    )
    expect(setLanguage).toHaveBeenCalledWith('de')
  })

  it('applyBasemapLabelLanguage rewrites classic symbol name layers', () => {
    const setLayout: Array<[string, string, unknown]> = []
    applyBasemapLabelLanguage(
      {
        getStyle: () => ({
          layers: [
            { id: 'place-label', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
            { id: 'road-shield', type: 'symbol', layout: { 'text-field': ['get', 'ref'] } },
            { id: 'water', type: 'fill' },
          ],
        }),
        setLayoutProperty: (id, prop, value) => { setLayout.push([id, prop, value]) },
      },
      'en',
      'mapbox://styles/mapbox/streets-v12',
    )
    expect(setLayout).toHaveLength(1)
    expect(setLayout[0][0]).toBe('place-label')
    expect(setLayout[0][1]).toBe('text-field')
    expect(setLayout[0][2]).toEqual(labelTextFieldExpression('en'))
  })
})
