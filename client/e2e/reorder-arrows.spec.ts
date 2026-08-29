import { test, expect } from '@playwright/test'
import { createTrip } from './helpers'

// The day-plan reorder arrows are hover-revealed on desktop.
test('desktop: reorder arrows are hidden-and-inert until the row is hovered', async ({ page }) => {
  const { tripId } = await createTrip(page)

  const daysRes = await (await page.request.get(`/api/trips/${tripId}/days`)).json()
  const dayId = (daysRes.days ?? daysRes)[0].id
  for (const name of ['Alpha', 'Beta']) {
    const res = await page.request.post(`/api/trips/${tripId}/places`, {
      data: { name, lat: 48.85, lng: 2.35 },
    })
    const body = await res.json()
    await page.request.post(`/api/trips/${tripId}/days/${dayId}/assignments`, {
      data: { place_id: body.place?.id ?? body.id },
    })
  }
  await page.reload()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })

  const row = page.locator('.dp-row').filter({ hasText: 'Alpha' }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  const arrows = row.locator('.reorder-buttons')

  const idle = await arrows.evaluate(el => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { opacity: cs.opacity, hitsArrow: !!hit?.closest('.reorder-buttons') }
  })
  expect(idle.opacity, 'arrows hidden until hover').toBe('0')
  expect(idle.hitsArrow, 'hidden arrows must not swallow clicks').toBe(false)

  await row.hover()
  await expect(arrows).toHaveCSS('opacity', '1')
  await expect(arrows).toHaveCSS('pointer-events', 'auto')
})
