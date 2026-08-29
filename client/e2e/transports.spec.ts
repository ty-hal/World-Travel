import { test, expect } from '@playwright/test'
import { gotoTrip, openPlannerTab, readSeed, modalPanel, modalBackdrop } from './helpers'

const TRANSPORT_TYPES = [
  'Flight',
  'Train',
  'Bus',
  'Car',
  'Taxi',
  'Bicycle',
  'Cruise',
  'Ferry',
  'Other',
]

test.describe('transport modal', () => {
  test.beforeEach(async ({ page }) => {
    const { tripId } = readSeed()
    await gotoTrip(page, tripId)
    await openPlannerTab(page, 'Transports')
    await page.getByRole('button', { name: /^Transport$/i }).first().click()
    await expect(modalPanel(page)).toBeVisible()
  })

  test('create modal shows Add transport title', async ({ page }) => {
    await expect(page.getByText(/add transport/i).first()).toBeVisible()
  })

  for (const type of TRANSPORT_TYPES) {
    test(`type chip: ${type}`, async ({ page }) => {
      const chip = modalPanel(page).getByRole('button', { name: type, exact: true })
      await expect(chip).toBeVisible()
      await chip.hover()
      await page.waitForTimeout(200)
      await chip.click()
      await expect(chip).toBeVisible()
    })
  }

  test('save a manual bus transport', async ({ page }) => {
    const title = `E2E Bus ${Date.now()}`
    await modalPanel(page).getByRole('button', { name: 'Bus', exact: true }).click()
    await modalPanel(page).locator('input[type="text"]').first().fill(title)
    await modalBackdrop(page).getByRole('button', { name: /^Add$/i }).click()
    await expect(modalPanel(page)).toBeHidden({ timeout: 15_000 })
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 })
  })
})

test('transports tab lists seeded data area', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Transports')
  await expect(page.getByText(/transport/i).first()).toBeVisible()
})
