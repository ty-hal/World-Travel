import { test, expect } from '@playwright/test'

// Infra smoke: the Sign In page renders (VITE_E2E=1 disables dev auto-login).
test('login screen renders with email and Sign In button', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
  await expect(page.locator('input[type="password"]').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible()
})
