/** Local HTTP development origins are allowed alongside a configured deployment origin. */
export function isLocalDevOrigin(origin: string | undefined): boolean {
  if (!origin || process.env.NODE_ENV?.toLowerCase() === 'production') return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}
