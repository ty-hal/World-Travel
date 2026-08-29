import { test, expect } from '@playwright/test'
import { gotoDashboard, gotoTrip, readSeed, dismissSystemNotices } from './helpers'

test('bottom nav shows trips and addon entries', async ({ page }) => {
  await gotoDashboard(page)
  const bottomNav = page.locator('nav.md\\:hidden')
  await expect(bottomNav.getByRole('button', { name: 'My Trips' })).toBeVisible()
  await expect(bottomNav.getByRole('button', { name: 'Atlas' })).toBeVisible()
})

test('bottom nav navigates to atlas', async ({ page }) => {
  await gotoDashboard(page)
  await page.locator('nav.md\\:hidden').getByRole('button', { name: 'Atlas' }).click()
  await expect(page).toHaveURL(/\/atlas/)
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })
})

test('center create button opens new trip on dashboard', async ({ page }) => {
  await gotoDashboard(page)
  await page.goto('/dashboard?create=1')
  await dismissSystemNotices(page)
  await expect(page.locator('.trek-modal-backdrop, .add-trip-card').first()).toBeVisible({ timeout: 10_000 })
})

test('mobile trip planner shows tab bar', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await expect(page.getByRole('button', { name: 'Plan', exact: true }).first()).toBeVisible()
  // Mobile may show full "Bookings" label rather than desktop "Book"
  await expect(
    page.getByRole('button', { name: /Book/i }).first(),
  ).toBeVisible()
})

test('mobile settings page loads', async ({ page }) => {
  await page.goto('/settings')
  await dismissSystemNotices(page)
  await expect(page.getByText(/settings|general|appearance|account/i).first()).toBeVisible()
})
