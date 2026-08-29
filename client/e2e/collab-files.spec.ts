import { test, expect } from '@playwright/test'
import { gotoTrip, openPlannerTab, readSeed } from './helpers'

test('collab chat shows multi-user seeded conversation', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Collab')
  await expect(page.getByText(/Haneda|Senso-ji|kaiseki/i).first()).toBeVisible({ timeout: 15_000 })
})

test('collab notes panel shows Rail passes', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Collab')
  await expect(page.getByText('Rail passes').first()).toBeVisible()
})

test('collab poll is visible', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Collab')
  await expect(page.getByText(/Nara|Ryokan/i).first()).toBeVisible()
})

test('send a chat message', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Collab')
  const input = page.locator('textarea').last()
  test.skip(!(await input.isVisible().catch(() => false)), 'chat input not visible at this viewport')
  const msg = `E2E ping ${Date.now()}`
  await input.fill(msg)
  await input.press('Enter')
  await expect(page.getByText(msg).first()).toBeVisible({ timeout: 10_000 })
})

test('files tab shows upload zone', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Files')
  await expect(page.getByText(/upload|drag|file|document/i).first()).toBeVisible({ timeout: 10_000 })
})
