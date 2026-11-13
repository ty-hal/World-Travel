import { test, clearNotices, expect, loadSeed } from './shot'
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

test('journey detail dark map', async ({ page, shot }) => {
  await page.goto(`/journey/${loadSeed().journeyId}`)
  await clearNotices(page)
  const mapCanvas = page.locator('.maplibregl-canvas').first()
  await expect(mapCanvas).toBeVisible()
  await expect(mapCanvas).toHaveCSS('filter', 'brightness(0.5) contrast(1.1)')
  await expect(page.locator('[data-basemap-tone="light"]')).toBeVisible()
  await shot.page_('JourneyDetail-DarkMap')
})

test('collections no-match dark', async ({ page, shot }) => {
  await page.goto('/collections')
  await clearNotices(page)
  await page.getByRole('textbox', { name: 'Search places' }).fill('zzzx-no-match')
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible()
  await shot.page_('CollectionsNoMatches-Dark')
})

test('collections dark map', async ({ page, shot }) => {
  await page.goto('/collections')
  await clearNotices(page)
  const mapCanvas = page.locator('.maplibregl-canvas')
  await expect(mapCanvas).toBeVisible()
  await expect(mapCanvas).toHaveCSS('filter', 'brightness(0.5) contrast(1.1)')
  await expect(page.locator('[data-basemap-tone="light"]')).toBeVisible()
  const attribution = page.locator('.maplibregl-ctrl-attrib')
  const attributionBox = await attribution.boundingBox()
  const compassBox = await page.getByRole('button', { name: 'Reset map north' }).boundingBox()
  const locationBox = await page.getByRole('button', { name: 'Show my location' }).boundingBox()
  expect(compassBox!.y).toBeGreaterThanOrEqual(attributionBox!.y + attributionBox!.height + 4)
  expect(locationBox!.y).toBeGreaterThanOrEqual(attributionBox!.y + attributionBox!.height + 4)
  await shot.page_('CollectionsDarkMap')
})

test('settings appearance dark', async ({ page, shot }) => {
  await page.goto('/settings')
  await clearNotices(page)
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.waitForTimeout(600)
  await shot.page_('UsrSettingsAppearance-Dark')
})

test('settings map preview dark', async ({ page, shot }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Map', exact: true }).first().click()
  const mapCanvas = page.locator('.maplibregl-canvas')
  await expect(mapCanvas).toBeVisible()
  await expect(page.locator('[data-basemap-tone="light"]')).toBeVisible()
  await expect(mapCanvas).toHaveCSS('filter', 'brightness(0.5) contrast(1.1)')
  const previewBox = await page.locator('.map-settings-preview').boundingBox()
  const attributionBox = await page.locator('.map-settings-preview .maplibregl-ctrl-attrib').boundingBox()
  expect(previewBox!.y + previewBox!.height - (attributionBox!.y + attributionBox!.height)).toBeLessThanOrEqual(24)
  await shot.page_('SettingsMapPreview-Dark')
})
