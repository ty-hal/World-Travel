import { test, clearNotices } from './shot'
import { setThemeViaSettings } from '../helpers'

/**
 * Dark-mode documentation captures — pairs with pages.shot.ts light variants.
 */

test.beforeEach(async ({ page }) => {
  await setThemeViaSettings(page, 'dark')
})

test('dashboard dark', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await shot.page_('DashboardWidgets-Dark')
})

test('trip planner dark', async ({ page, shot }) => {
  const seed = JSON.parse(
    await page.evaluate(async () => {
      const res = await fetch('/api/trips')
      const trips = await res.json()
      const t = (trips.trips ?? trips).find((x: { title: string }) => x.title === 'Autumn in Japan')
      return JSON.stringify({ tripId: t?.id })
    }),
  ) as { tripId: number }
  test.skip(!seed.tripId, 'demo trip missing')
  await page.goto(`/trips/${seed.tripId}`)
  await clearNotices(page)
  await shot.page_('TripPlanner-Dark')
})

test('settings appearance dark', async ({ page, shot }) => {
  await page.goto('/settings')
  await clearNotices(page)
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.waitForTimeout(600)
  await shot.page_('UsrSettingsAppearance-Dark')
})
