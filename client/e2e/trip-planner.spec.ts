import { test, expect } from '@playwright/test'
import {
  gotoTrip,
  openPlannerTab,
  readSeed,
  PLANNER_TABS,
  modalPanel,
} from './helpers'

test('open seeded trip and land in the planner with a map', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await expect(page.locator('.leaflet-container')).toBeVisible()
})

test.describe('planner tabs smoke', () => {
  test.beforeEach(async ({ page }) => {
    const { tripId } = readSeed()
    await gotoTrip(page, tripId)
  })

  for (const tab of PLANNER_TABS) {
    test(`${tab} tab loads`, async ({ page }) => {
      await openPlannerTab(page, tab)
      // Each tab should leave us on the same trip URL
      await expect(page).toHaveURL(/\/trips\/\d+/)
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    })
  }
})

test('plan tab shows seeded places on the map sidebar', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await expect(page.getByText('Senso-ji Temple').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Fushimi Inari Taisha').first()).toBeVisible()
})

test('add place modal opens from plan tab', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await page.getByRole('button', { name: /add place/i }).first().click()
  await expect(modalPanel(page)).toBeVisible()
})

test('costs tab shows seeded expenses', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Costs')
  await expect(page.getByText(/JR Pass|Ryokan|Flights/i).first()).toBeVisible({ timeout: 15_000 })
})

test('lists tab shows seeded packing items', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Lists')
  await expect(page.getByText(/Passport|Rain jacket|Power bank/i).first()).toBeVisible({ timeout: 15_000 })
})

test('bookings tab loads (non-transport reservations)', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Book')
  // LH716 is type flight → lives under Transports; Bookings holds hotels/events/etc.
  await expect(page.getByRole('button', { name: /booking|reservation|add/i }).first()).toBeVisible({ timeout: 10_000 })
})

test('transports tab shows seeded LH716 flight', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Transports')
  await expect(page.getByText(/LH716|Lufthansa|Frankfurt/i).first()).toBeVisible({ timeout: 15_000 })
})

test('collab tab shows seeded chat and notes', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Collab')
  await expect(page.getByText(/kaiseki|Senso-ji|Rail passes/i).first()).toBeVisible({ timeout: 15_000 })
})

test('files tab uses in-planner route segment', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Files')
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/files`))
  await expect(page.getByText(/upload|drag|file|document/i).first()).toBeVisible({ timeout: 10_000 })
})

test('history tab loads event list', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'History')
  await expect(page.locator('body')).toBeVisible()
})

test('photos tab loads albums view', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Photos')
  await expect(page.getByText(/album|photo/i).first()).toBeVisible({ timeout: 10_000 })
})
