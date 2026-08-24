import { test, clearNotices, expect } from './shot'

test.beforeEach(async ({ page }) => {
  await page.goto('/atlas')
  await clearNotices(page)
  await expect(page.locator('.leaflet-container')).toBeVisible()
})

for (const tab of ['Stats', 'Bucket List', 'Wonders']) {
  test(`atlas ${tab.toLowerCase()} view`, async ({ page, shot }) => {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await page.waitForTimeout(500)
    await shot.page_(`Atlas-${tab.replaceAll(' ', '')}`)
  })
}
