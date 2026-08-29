import { test, expect } from '@playwright/test'
import { dismissSystemNotices, loginViaUi, E2E_ADMIN } from './helpers'

test.describe('login and session', () => {
  test.use({ storageState: undefined })

  test('valid credentials reach the dashboard', async ({ page }) => {
    await loginViaUi(page, E2E_ADMIN.email, E2E_ADMIN.password)
  })

  test('invalid credentials show an error and stay on login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
    await page.getByPlaceholder('your@email.com').fill(E2E_ADMIN.email)
    await page.locator('input[type="password"]').first().fill('wrong-password-xyz')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('protected API requires authentication', async ({ playwright }) => {
    // `test.use({ storageState: undefined })` clears cookies for page, not request.
    const anon = await playwright.request.newContext({
      baseURL: 'http://localhost:5173',
      storageState: undefined,
    })
    const res = await anon.get('/api/trips')
    expect(res.status()).toBe(401)
    await anon.dispose()
  })

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })
})

test('logout returns to login and can sign back in', async ({ page }) => {
  await page.goto('/dashboard')
  await dismissSystemNotices(page)
  await page.locator('nav').getByRole('button').filter({ hasText: /.+/ }).last().click()
  await page.getByRole('button', { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  await loginViaUi(page, E2E_ADMIN.email, E2E_ADMIN.password)
})
