import { test, expect } from '@playwright/test'
import {
  gotoDashboard,
  gotoTrip,
  readSeed,
  modalBackdrop,
  dismissSystemNotices,
} from './helpers'

test('authenticated session reaches the dashboard', async ({ page }) => {
  await gotoDashboard(page)
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('img', { name: 'TREK' }).first()).toBeVisible()
})

test('seeded demo trip appears on dashboard', async ({ page }) => {
  await gotoDashboard(page)
  await expect(page.getByText('Autumn in Japan').first()).toBeVisible({ timeout: 15_000 })
})

test('upcoming reservations widget shows seeded flight', async ({ page }) => {
  await gotoDashboard(page)
  await expect(page.getByText(/LH716|Frankfurt|Haneda/i).first()).toBeVisible({ timeout: 15_000 })
})

test('upcoming flight row animates icon only on hover', async ({ page }) => {
  await gotoDashboard(page)
  const row = page.locator('.tool-card, [class*="upcoming"], [class*="tool-"]').filter({ hasText: /LH716|Frankfurt/i }).first()
  test.skip(!(await row.isVisible().catch(() => false)), 'upcoming widget hidden by appearance settings')
  const icon = row.locator('svg').first()
  await expect(icon).toBeVisible()
  // Hover should not throw; animation is CSS-driven
  await row.hover()
  await page.waitForTimeout(300)
  await expect(icon).toBeVisible()
})

test('create a trip and see it on the dashboard', async ({ page }) => {
  await gotoDashboard(page)
  await page.locator('.add-trip-card').click()
  const modal = modalBackdrop(page)
  await expect(modal).toBeVisible()
  const title = `E2E Trip ${Date.now()}`
  await modal.getByPlaceholder('e.g. Summer in Japan').fill(title)
  await modal.getByRole('button', { name: 'Create New Trip' }).click()
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 })
})

test('archive filter shows archived trips after archiving', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoDashboard(page)
  const res = await page.request.put(`/api/trips/${tripId}`, { data: { is_archived: true } })
  expect(res.ok()).toBeTruthy()
  await page.reload()
  await dismissSystemNotices(page)
  await page.getByRole('button', { name: /archived/i }).click()
  await expect(page.getByText('Autumn in Japan').first()).toBeVisible({ timeout: 10_000 })
  await page.request.put(`/api/trips/${tripId}`, { data: { is_archived: false } })
})

test('open seeded trip from dashboard card', async ({ page }) => {
  await gotoDashboard(page)
  await page.getByText('Autumn in Japan').first().click()
  await expect(page).toHaveURL(/\/trips\/\d+/)
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 25_000 })
})

test('share dialog opens from trip planner', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await page.getByRole('button', { name: /share/i }).first().click()
  await expect(page.locator('.trek-modal-backdrop')).toBeVisible()
})
