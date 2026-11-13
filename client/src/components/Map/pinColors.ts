// A calmer, color-blind-friendlier pin palette. Photos remain the primary
// visual; color is only a category cue and must not carry meaning alone.
const PIN_COLORS: Record<string, string> = {
  hotel: '#2563EB', restaurant: '#D95D4F', attraction: '#7C3AED', shopping: '#B7791F',
  transport: '#64748B', activity: '#0F766E', 'bar/cafe': '#C2410C', beach: '#0891B2',
  nature: '#4D7C0F', other: '#475569',
}

/** Brighter variants for dark UI chrome (sidebar icons, chips) — map pins keep PIN_COLORS. */
const PIN_COLORS_DARK_UI: Record<string, string> = {
  hotel: '#60A5FA', restaurant: '#F87171', attraction: '#A78BFA', shopping: '#FBBF24',
  transport: '#94A3B8', activity: '#2DD4BF', 'bar/cafe': '#FB923C', beach: '#22D3EE',
  nature: '#A3E635', other: '#94A3B8',
}

function resolveCategoryKey(categoryName?: string | null): string | null {
  const key = categoryName?.trim().toLowerCase().replace(/\s+/g, '')
  if (!key) return null
  const aliases: Record<string, string> = {
    'bar&cafe': 'bar/cafe', cafe: 'bar/cafe', lodging: 'hotel',
    '🏨': 'hotel', '🍽️': 'restaurant', '🏛️': 'attraction', '🛍️': 'shopping',
    '🚌': 'transport', '🎯': 'activity', '☕': 'bar/cafe', '🏖️': 'beach',
    '🌿': 'nature', '📍': 'other',
  }
  return aliases[key] || key
}

export function getPinColor(categoryName?: string | null, fallback?: string | null): string {
  const key = resolveCategoryKey(categoryName)
  return (key && PIN_COLORS[key]) || (categoryName ? PIN_COLORS.other : fallback || PIN_COLORS.other)
}

/** Category color for text/icons on app surfaces (sidebars, inspector). Lightens on dark. */
export function getUiCategoryColor(categoryName?: string | null, fallback?: string | null): string {
  const key = resolveCategoryKey(categoryName)
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  if (dark) {
    if (key && PIN_COLORS_DARK_UI[key]) return PIN_COLORS_DARK_UI[key]
    if (fallback) return `color-mix(in srgb, ${fallback} 50%, white)`
    return PIN_COLORS_DARK_UI.other
  }
  return getPinColor(categoryName, fallback)
}
