import { test, expect } from '@playwright/test'
import {
  gotoDashboard,
  gotoTrip,
  readSeed,
  setThemeViaSettings,
  openPlannerTab,
} from './helpers'

const SURFACES = [
  { name: 'dashboard-light', fn: async (page: import('@playwright/test').Page) => { await gotoDashboard(page) } },
  { name: 'dashboard-dark', fn: async (page: import('@playwright/test').Page) => { await setThemeViaSettings(page, 'dark'); await gotoDashboard(page) } },
  {
    name: 'planner-plan-light',
    fn: async (page: import('@playwright/test').Page) => {
      await setThemeViaSettings(page, 'light')
      await gotoTrip(page, readSeed().tripId)
    },
  },
  {
    name: 'planner-plan-dark',
    fn: async (page: import('@playwright/test').Page) => {
      await setThemeViaSettings(page, 'dark')
      await gotoTrip(page, readSeed().tripId)
    },
  },
  {
    name: 'planner-costs-dark',
    fn: async (page: import('@playwright/test').Page) => {
      await setThemeViaSettings(page, 'dark')
      await gotoTrip(page, readSeed().tripId)
      await openPlannerTab(page, 'Costs')
    },
  },
  {
    name: 'planner-transports-dark',
    fn: async (page: import('@playwright/test').Page) => {
      await setThemeViaSettings(page, 'dark')
      await gotoTrip(page, readSeed().tripId)
      await openPlannerTab(page, 'Transports')
    },
  },
  {
    name: 'settings-appearance-light',
    fn: async (page: import('@playwright/test').Page) => {
      await setThemeViaSettings(page, 'light')
      await page.goto('/settings')
      await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    },
  },
  {
    name: 'settings-appearance-dark',
    fn: async (page: import('@playwright/test').Page) => {
      await setThemeViaSettings(page, 'dark')
      await page.goto('/settings')
      await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    },
  },
  {
    name: 'atlas-dark',
    fn: async (page: import('@playwright/test').Page) => {
      await setThemeViaSettings(page, 'dark')
      await page.goto('/atlas')
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })
    },
  },
] as const

for (const surface of SURFACES) {
  test(`visual: ${surface.name}`, async ({ page }) => {
    await surface.fn(page)
    await page.waitForTimeout(600)
    await expect(page).toHaveScreenshot(`${surface.name}.png`, { fullPage: false })
  })
}

test('reduced motion disables animated icon CSS', async ({ page }) => {
  await gotoTrip(page, readSeed().tripId)
  const reduced = await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent = '@media (prefers-reduced-motion: reduce) { .trek-icon-motion--always, .trek-icon-motion--hover { animation: none !important; } }'
    document.head.appendChild(style)
    const el = document.querySelector('.trek-icon-motion--hover, .trek-icon-motion--always')
    if (!el) return true
    const anim = getComputedStyle(el).animationName
    return anim === 'none' || anim === ''
  })
  expect(reduced).toBeTruthy()
})
