const url = 'http://127.0.0.1:3001/api/health'
const deadline = Date.now() + 120_000

console.log('[dev] Waiting for the API before starting Vite...')
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
    const payload = await response.json()
    if (response.ok && (payload.status === 'ok' || payload.ok === true)) {
      console.log('[dev] API is ready; starting Vite.')
      process.exit(0)
    }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 250))
}

console.error(`[dev] API did not become ready within 120 seconds: ${url}`)
process.exit(1)
