export type GlMapProvider = 'mapbox-gl' | 'maplibre-gl'

export interface GlStylePreset {
  name: string
  url: string
  tags?: string[]
}

export const MAPBOX_DEFAULT_STYLE = 'mapbox://styles/mapbox/standard'
export const OPENFREEMAP_DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export const MAPBOX_STYLE_PRESETS: GlStylePreset[] = [
  { name: 'Mapbox Standard', url: MAPBOX_DEFAULT_STYLE, tags: ['3D', 'Apple-like'] },
  { name: 'Standard Satellite', url: 'mapbox://styles/mapbox/standard-satellite', tags: ['3D', 'Satellite'] },
  { name: 'Streets', url: 'mapbox://styles/mapbox/streets-v12', tags: ['3D', 'Classic'] },
  { name: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12', tags: ['3D', 'Terrain'] },
  { name: 'Light', url: 'mapbox://styles/mapbox/light-v11', tags: ['3D', 'Minimal'] },
  { name: 'Dark', url: 'mapbox://styles/mapbox/dark-v11', tags: ['3D', 'Dark'] },
  { name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-v9', tags: ['3D', 'Satellite'] },
  { name: 'Satellite Streets', url: 'mapbox://styles/mapbox/satellite-streets-v12', tags: ['3D', 'Satellite'] },
  { name: 'Navigation Day', url: 'mapbox://styles/mapbox/navigation-day-v1', tags: ['3D', 'Apple-like'] },
  { name: 'Navigation Night', url: 'mapbox://styles/mapbox/navigation-night-v1', tags: ['3D', 'Dark'] },
]

export const OPENFREEMAP_STYLE_PRESETS: GlStylePreset[] = [
  { name: 'OpenFreeMap Liberty', url: OPENFREEMAP_DEFAULT_STYLE, tags: ['OpenFreeMap', '2D'] },
  { name: 'OpenFreeMap Bright', url: 'https://tiles.openfreemap.org/styles/bright', tags: ['OpenFreeMap', 'Classic'] },
  { name: 'OpenFreeMap Positron', url: 'https://tiles.openfreemap.org/styles/positron', tags: ['OpenFreeMap', 'Minimal'] },
]

export function getStylePresets(provider: GlMapProvider): GlStylePreset[] {
  return provider === 'maplibre-gl' ? OPENFREEMAP_STYLE_PRESETS : MAPBOX_STYLE_PRESETS
}

export function defaultStyleForProvider(provider: GlMapProvider): string {
  return provider === 'maplibre-gl' ? OPENFREEMAP_DEFAULT_STYLE : MAPBOX_DEFAULT_STYLE
}

export function isOpenFreeMapStyle(style?: string | null): boolean {
  return (style || '').trim().startsWith('https://tiles.openfreemap.org/')
}

export function isOpenFreeMapLightStyle(style?: string | null): boolean {
  return /^https:\/\/tiles\.openfreemap\.org\/styles\/(?:liberty|bright|positron)(?:[?#]|$)/.test((style || '').trim())
}

export function normalizeStyleForProvider(provider: GlMapProvider, style?: string | null): string {
  const trimmed = (style || '').trim()
  if (!trimmed) return defaultStyleForProvider(provider)
  if (provider === 'maplibre-gl') {
    return isOpenFreeMapStyle(trimmed) ? trimmed : OPENFREEMAP_DEFAULT_STYLE
  }
  return trimmed
}

/** The settings key that holds the style for a given GL provider. */
export function styleSettingKey(provider: GlMapProvider): 'mapbox_style' | 'maplibre_style' {
  return provider === 'maplibre-gl' ? 'maplibre_style' : 'mapbox_style'
}

/**
 * Each GL provider keeps its style in its own slot (mapbox_style / maplibre_style), so
 * switching providers never overwrites the other one's custom style. Picks and normalizes
 * the style for the active provider.
 */
export function styleForActiveProvider(
  provider: GlMapProvider,
  mapboxStyle?: string | null,
  maplibreStyle?: string | null,
): string {
  return normalizeStyleForProvider(provider, provider === 'maplibre-gl' ? maplibreStyle : mapboxStyle)
}

// A few TREK UI language codes differ from what the GL basemap expects for its labels.
const BASEMAP_LANG_OVERRIDES: Record<string, string> = {
  br: 'pt',          // TREK 'br' = Brazilian Portuguese
  gr: 'el',          // TREK 'gr' = Greek
  zh: 'zh-Hans',
  zhTw: 'zh-Hant',
  'zh-TW': 'zh-Hant',
}

/**
 * Maps a TREK UI language code to the label language the GL basemap expects. Used to pin
 * Mapbox Standard's basemap labels to the user's language so they don't fall back to the
 * browser/OS locale and stack multiple scripts per place (#1299).
 */
export function basemapLanguage(uiLang: string | undefined): string {
  const code = (uiLang || 'en').trim()
  return BASEMAP_LANG_OVERRIDES[code] ?? code
}

/** True when a symbol layer's text-field expression references place `name*` props. */
export function layerUsesPlaceName(textField: unknown): boolean {
  if (textField == null) return false
  if (typeof textField === 'string') return /\bname(_|:|$|\b)/.test(textField) || textField.includes('{name')
  try {
    return /"name[_:]|"name"/.test(JSON.stringify(textField))
  } catch {
    return false
  }
}

/**
 * Single-script label expression for classic Mapbox / OpenMapTiles styles.
 * Prefers the account language, then English, then Latin script, then local `name`.
 *
 * OpenFreeMap Liberty defaults to concatenating `name:latin` + `name:nonlatin`, which
 * shows Chinese (etc.) even when the UI is English — we replace that with one script.
 */
export function labelTextFieldExpression(uiLang: string | undefined): unknown[] {
  const lang = basemapLanguage(uiLang)
  const fields: unknown[] = [
    ['get', `name_${lang}`],
    ['get', `name:${lang}`],
  ]
  // Mapbox Streets often stores Chinese under name_zh; OpenMapTiles under name:zh.
  if (lang.startsWith('zh')) {
    fields.push(['get', 'name_zh'], ['get', 'name:zh'])
  }
  if (lang !== 'en') {
    fields.push(['get', 'name_en'], ['get', 'name:en'])
  }
  // Latin transliteration before raw local `name` (often Hanzi / other non-Latin script).
  fields.push(['get', 'name:latin'], ['get', 'name_latin'], ['get', 'name'])
  return ['coalesce', ...fields]
}

/**
 * Interactive trip/journey maps always use a GL provider that can honor account
 * language. Leaflet + OSM raster tiles bake in local-script labels and cannot.
 */
export function resolveInteractiveGlProvider(
  provider: string | undefined,
  mapboxToken?: string | null,
): GlMapProvider {
  if (provider === 'mapbox-gl' && mapboxToken) return 'mapbox-gl'
  return 'maplibre-gl'
}

type GlMapLike = {
  /** Mapbox GL JS v3+ — the working API for Standard label language (setConfigProperty is a no-op). */
  setLanguage?: (language: string) => void
  setConfigProperty?: (importId: string, property: string, value: unknown) => void
  getStyle?: () => { layers?: Array<{ id: string; type: string; layout?: Record<string, unknown> }> } | undefined
  setLayoutProperty?: (layerId: string, property: string, value: unknown) => void
}

/**
 * Pin basemap place labels to the user's account language on every GL style.
 *
 * Mapbox Standard: use `map.setLanguage()` (and the Map `language` constructor
 * option). `setConfigProperty('basemap', 'language')` silently does nothing in
 * GL JS ≥3.18 — without setLanguage, Standard falls back to local-script labels
 * (e.g. Chinese over China even when the UI is English).
 *
 * Classic Mapbox / OpenFreeMap: rewrite symbol `text-field` to a single script.
 */
export function applyBasemapLabelLanguage(
  map: GlMapLike | null | undefined,
  uiLang: string | undefined,
  styleUrl?: string | null,
): void {
  if (!map) return
  const lang = basemapLanguage(uiLang)
  const style = (styleUrl || '').trim()
  const isStandard = style === 'mapbox://styles/mapbox/standard'
    || style === 'mapbox://styles/mapbox/standard-satellite'

  if (typeof map.setLanguage === 'function') {
    try { map.setLanguage(lang) } catch { /* MapLibre / older SDKs */ }
  }
  // Kept as a best-effort for docs/examples that still mention it; harmless no-op on current GL JS.
  if (isStandard && typeof map.setConfigProperty === 'function') {
    try { map.setConfigProperty('basemap', 'language', lang) } catch { /* ignore */ }
  }
  if (isStandard) return

  const layers = map.getStyle?.()?.layers
  if (!layers || typeof map.setLayoutProperty !== 'function') return
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue
    const textField = layer.layout?.['text-field']
    if (!layerUsesPlaceName(textField)) continue
    try {
      map.setLayoutProperty(layer.id, 'text-field', labelTextFieldExpression(uiLang))
    } catch { /* layer may be immutable or missing */ }
  }
}
