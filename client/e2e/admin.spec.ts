import { test, expect } from '@playwright/test'
import { dismissSystemNotices } from './helpers'

const ADMIN_TABS = ['Users', 'User Defaults', 'Personalization', 'Addons', 'Plugins', 'GitHub', 'Backup', 'Audit'] as const

test.describe('admin panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await dismissSystemNotices(page)
  })

  test('admin overview loads', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  for (const tab of ADMIN_TABS) {
    test(`${tab} tab renders`, async ({ page }) => {
      await page.getByRole('button', { name: tab, exact: true }).first().click()
      await page.waitForTimeout(600)
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    })
  }

  test('addons tab lists collections and atlas', async ({ page }) => {
    await page.getByRole('button', { name: 'Addons', exact: true }).first().click()
    await page.waitForTimeout(600)
    await expect(page.getByText(/collections|atlas|vacay/i).first()).toBeVisible()
  })

  test('MCP access tab', async ({ page }) => {
    await page.getByRole('button', { name: 'MCP Access', exact: true }).first().click()
    await page.waitForTimeout(600)
    await expect(page.locator('body')).toBeVisible()
  })
})
