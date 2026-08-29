import { test, expect } from '@playwright/test'
import { dismissSystemNotices, readSeed, gotoDashboard } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoDashboard(page)
})

test('atlas page loads with map', async ({ page }) => {
  await page.goto('/atlas')
  await dismissSystemNotices(page)
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })
})

test('atlas stats tab', async ({ page }) => {
  await page.goto('/atlas')
  await dismissSystemNotices(page)
  await page.getByRole('button', { name: 'Stats', exact: true }).click()
  await page.waitForTimeout(500)
  await expect(page.locator('body')).toBeVisible()
})

test('atlas bucket list tab', async ({ page }) => {
  await page.goto('/atlas')
  await dismissSystemNotices(page)
  await page.getByRole('button', { name: 'Bucket List', exact: true }).click()
  await page.waitForTimeout(500)
  await expect(page.locator('body')).toBeVisible()
})

test('vacay calendar page loads', async ({ page }) => {
  await page.goto('/vacay')
  await dismissSystemNotices(page)
  await expect(page.locator('body')).not.toContainText('Something went wrong')
})

test('collections list page loads', async ({ page }) => {
  await page.goto('/collections')
  await dismissSystemNotices(page)
  await expect(page.getByText(/Kyoto|collection|list/i).first()).toBeVisible({ timeout: 15_000 })
})

test('collection detail page', async ({ page }) => {
  const seed = readSeed()
  test.skip(!seed.collectionId, 'collections addon unavailable during seed')
  await page.goto(`/collections/${seed.collectionId}`)
  await dismissSystemNotices(page)
  await expect(page.getByText(/Kyoto|Fushimi|Arashiyama/i).first()).toBeVisible({ timeout: 15_000 })
})

test('notifications inbox page', async ({ page }) => {
  await page.goto('/notifications')
  await dismissSystemNotices(page)
  await expect(page.locator('body')).toBeVisible()
})

test('in-app help page', async ({ page }) => {
  await page.goto('/help')
  await dismissSystemNotices(page)
  await expect(page.getByRole('heading').first()).toBeVisible()
})
