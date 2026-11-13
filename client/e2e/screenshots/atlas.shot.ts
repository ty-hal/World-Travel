import { test, clearNotices, expect } from './shot'

test.beforeEach(async ({ page }) => {
  await page.goto('/atlas')
  await clearNotices(page)
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.locator('.leaflet-control-attribution').getByRole('link', { name: 'Boundary data from geoBoundaries' }))
    .toHaveAttribute('href', 'https://www.geoboundaries.org/')
  await expect(page.locator('.atlas-chrome a[href="https://www.geoboundaries.org/"]')).toHaveCount(0)
})

for (const tab of ['Stats', 'Bucket List', 'Wonders']) {
  test(`atlas ${tab.toLowerCase()} view`, async ({ page, shot }) => {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await page.waitForTimeout(500)
    if (tab === 'Wonders') {
      await expect(page.getByRole('button', { name: 'Machu Picchu', exact: true })).toBeVisible()
    }
    await shot.page_(`Atlas-${tab.replaceAll(' ', '')}`)
  })
}

test('atlas bucket list add form', async ({ page, shot }) => {
  await page.getByRole('button', { name: 'Bucket List', exact: true }).click()
  await page.getByRole('button', { name: /add place/i }).click()
  await expect(page.getByRole('button', { name: 'Month' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Year' })).toBeVisible()
  await shot.page_('AtlasBucketListAddForm')
})

test('atlas dark theme', async ({ page, shot }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto('/atlas')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await shot.page_('AtlasDark')
})

test('atlas stats request failure', async ({ page, shot }) => {
  await page.route('**/api/addons/atlas/stats', route => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  await page.goto('/atlas')
  await expect(page.getByRole('alert')).toContainText(/atlas data could not be loaded/i)
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await shot.page_('AtlasLoadError')
})
