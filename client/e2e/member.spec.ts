import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.tmp/member-state.json' })

test('member cannot access admin panel', async ({ page }) => {
  await page.goto('/admin')
  // Non-admin should be redirected away or see an access error
  await page.waitForTimeout(1500)
  const url = page.url()
  const denied = !url.includes('/admin') || (await page.getByText(/denied|forbidden|not authorized|access/i).isVisible().catch(() => false))
  expect(denied).toBeTruthy()
})

test('member can open seeded trip', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('Autumn in Japan').first()).toBeVisible({ timeout: 20_000 })
})
