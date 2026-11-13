import type { Page } from '@playwright/test'

export async function stubSeasonalClimate(page: Page) {
  await page.route('**/api/weather?*', route => route.fulfill({ json: { temp: 20, main: 'Clear', description: 'clear sky', type: 'forecast' } }))
  const climate = (lat: number, lng: number) => {
    const tropical = Math.abs(lat) < 12
    const highland = lat < -10 && lng > -80 && lng < -60
    const arid = lng < -100 || (lat > 25 && lat < 35 && lng > -15 && lng < 5)
    const cold = Math.abs(lat) > 55
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const phase = (month - 7 - (lat < 0 ? 6 : 0)) * Math.PI / 6
      const average = tropical ? 26 + 1.5 * Math.cos(phase) : (cold ? 10 : 16) + (cold ? 8 : 10) * Math.cos(phase)
      const wetSeason = (1 + Math.sin((month + (lng < 0 ? 3 : 0)) * Math.PI / 6)) / 2
      const precipitationMm = tropical
        ? 35 + wetSeason * 210
        : highland ? 20 + wetSeason * 180
          : arid ? 12 + wetSeason * 38
            : 25 + wetSeason * 95
      return { month, meanMaxC: average + 6, meanMinC: average - 6, precipitationMm, days: 60 }
    })
    return { source: 'Open-Meteo ERA5', period: '2024–2025', months }
  }
  await page.route('**/api/weather/climate**', route => {
    if (route.request().method() === 'POST') {
      const { locations } = route.request().postDataJSON() as { locations: Array<{ key: string; lat: number; lng: number }> }
      return route.fulfill({ json: locations.map(({ key, lat, lng }) => ({ key, ...climate(lat, lng) })) })
    }
    const params = new URL(route.request().url()).searchParams
    return route.fulfill({ json: climate(Number(params.get('lat')), Number(params.get('lng'))) })
  })
}
