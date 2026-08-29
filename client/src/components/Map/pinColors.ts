// A calmer, color-blind-friendlier pin palette. Photos remain the primary
// visual; color is only a category cue and must not carry meaning alone.
const PIN_COLORS: Record<string, string> = {
  hotel: '#2563EB', restaurant: '#D95D4F', attraction: '#7C3AED', shopping: '#B7791F',
  transport: '#64748B', activity: '#0F766E', 'bar/cafe': '#C2410C', beach: '#0891B2',
  nature: '#4D7C0F', other: '#475569',
}

export function getPinColor(categoryName?: string | null, fallback?: string | null): string {
  const key = categoryName?.trim().toLowerCase().replace(/\s+/g, '')
  const aliases: Record<string, string> = {
    'bar&cafe': 'bar/cafe', cafe: 'bar/cafe', lodging: 'hotel',
    '🏨': 'hotel', '🍽️': 'restaurant', '🏛️': 'attraction', '🛍️': 'shopping',
    '🚌': 'transport', '🎯': 'activity', '☕': 'bar/cafe', '🏖️': 'beach',
    '🌿': 'nature', '📍': 'other',
  }
  return (key && PIN_COLORS[aliases[key] || key]) || (categoryName ? PIN_COLORS.other : fallback || PIN_COLORS.other)
}
