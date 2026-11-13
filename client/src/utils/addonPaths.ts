/** Frontend path for a global addon. Addon ids stay stable; some URLs are friendlier. */
const ADDON_PATHS: Record<string, string> = {
  vacay: '/calendar',
}

export function addonPath(addonId: string): string {
  return ADDON_PATHS[addonId] ?? `/${addonId}`
}
