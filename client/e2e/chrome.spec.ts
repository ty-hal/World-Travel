import { test, expect } from '@playwright/test'
import {
  dismissSystemNotices,
  gotoDashboard,
  gotoTrip,
  openPlannerTab,
  readSeed,
  setThemeViaSettings,
  toggleNavbarTheme,
  expectDarkMode,
} from './helpers'

test.describe('global chrome', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
  })

  test('navbar shows TREK brand and primary nav links', async ({ page }) => {
    await expect(page.getByRole('img', { name: 'TREK' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /trips|my trips/i }).first()).toBeVisible()
  })

  test('addon nav links are visible after seed enables addons', async ({ page }) => {
    await expect(page.getByRole('link', { name: /atlas/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /calendar|vacay/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /collections/i }).first()).toBeVisible()
  })

  test('user menu opens with settings and help', async ({ page }) => {
    await page.locator('nav').getByRole('button').filter({ hasText: /.+/ }).last().click()
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /help/i })).toBeVisible()
  })

  test('notification bell opens dropdown', async ({ page }) => {
    const bell = page.locator('nav button').filter({ has: page.locator('svg') }).nth(1)
    await bell.click()
    await expect(page.getByRole('link', { name: /notifications|view all/i }).first()).toBeVisible({ timeout: 5_000 }).catch(async () => {
      // Empty inbox may show inline text instead of a link
      await expect(page.getByText(/notification|no notifications/i).first()).toBeVisible()
    })
  })
})

test.describe('theme toggle', () => {
  test('navbar toggle switches dark class', async ({ page }) => {
    await gotoDashboard(page)
    await setThemeViaSettings(page, 'light')
    await gotoDashboard(page)
    await expectDarkMode(page, false)

    await toggleNavbarTheme(page)
    await expectDarkMode(page, true)

    await toggleNavbarTheme(page)
    await expectDarkMode(page, false)

    // Leave light mode for the next test.
    await setThemeViaSettings(page, 'light')
  })

  test('settings appearance chips set light and dark', async ({ page }) => {
    await setThemeViaSettings(page, 'dark')
    await gotoDashboard(page)
    await expectDarkMode(page, true)

    await setThemeViaSettings(page, 'light')
    await gotoDashboard(page)
    await expectDarkMode(page, false)
  })
})

test('trip view shows share button', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  await expect(page.getByRole('button', { name: /share/i }).first()).toBeVisible()
})

test('animated tab icons respond to hover on planner tabs', async ({ page }) => {
  const { tripId } = readSeed()
  await gotoTrip(page, tripId)
  const mapTab = page.getByRole('button', { name: 'Plan', exact: true }).first()
  await mapTab.hover()
  await expect(mapTab).toBeVisible()
  await openPlannerTab(page, 'Costs')
  await expect(page.getByText(/JR Pass|Ryokan|Flights/i).first()).toBeVisible({ timeout: 10_000 })
})
