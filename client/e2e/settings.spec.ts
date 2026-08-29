import { test, expect } from '@playwright/test'
import { dismissSystemNotices, setThemeViaSettings, expectDarkMode } from './helpers'

const SETTINGS_TABS = ['General', 'Appearance', 'Map', 'Notifications', 'Offline', 'Account'] as const

test.describe('user settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await dismissSystemNotices(page)
  })

  for (const tab of SETTINGS_TABS) {
    test(`${tab} tab renders`, async ({ page }) => {
      await page.getByRole('button', { name: tab, exact: true }).first().click()
      await page.waitForTimeout(500)
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    })
  }

  test('appearance theme chips persist dark mode', async ({ page }) => {
    await setThemeViaSettings(page, 'dark')
    await page.reload()
    await dismissSystemNotices(page)
    await expectDarkMode(page, true)
    await setThemeViaSettings(page, 'light')
    await page.reload()
    await dismissSystemNotices(page)
    await expectDarkMode(page, false)
  })
})
