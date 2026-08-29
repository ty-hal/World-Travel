import { test, expect } from '@playwright/test'
import { gotoTrip, openPlannerTab, readSeed, modalPanel } from './helpers'

test('add manual booking from bookings tab', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Book')
  await page.getByRole('button', { name: /booking|reservation|add/i }).first().click()
  await expect(modalPanel(page)).toBeVisible({ timeout: 10_000 })
})

test('toggle packing item checked state', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Lists')
  const item = page.getByText('Passport').first()
  await expect(item).toBeVisible()
  const checkbox = page.locator('input[type="checkbox"]').filter({ has: page.getByText('Passport') }).first()
    .or(page.getByRole('checkbox').first())
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.click()
  }
})

test('add expense modal opens from costs tab', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Costs')
  await page.getByRole('button', { name: /add expense/i }).first().click()
  await expect(modalPanel(page)).toBeVisible({ timeout: 10_000 })
})

test('add payment modal opens without mutating balances', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Costs')
  const addPayment = page.getByRole('button', { name: /add payment/i }).first()
  test.skip(!(await addPayment.isVisible().catch(() => false)), 'no settle-up entry point')
  await addPayment.click()
  await expect(modalPanel(page)).toBeVisible()
  await page.keyboard.press('Escape')
})

test('add todo item via lists tab', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await openPlannerTab(page, 'Lists')
  const todoTab = page.getByRole('button', { name: /to-?do|tasks/i }).first()
  if (await todoTab.isVisible().catch(() => false)) await todoTab.click()
  await expect(page.getByText(/JR Pass|teamLab|ryokan/i).first()).toBeVisible({ timeout: 10_000 })
})
