import { test, expect } from './shot'

test('app config failure and recovery', async ({ page, shot }) => {
  let configAvailable = false
  await page.route('**/api/auth/app-config', route =>
    configAvailable
      ? route.continue()
      : route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  )
  await page.goto('/dashboard')
  const status = page.getByRole('status').filter({ hasText: 'Server settings unavailable' })
  await expect(status).toBeVisible()
  const [statusBox, navBox, titleBox] = await Promise.all([
    status.boundingBox(),
    page.locator('nav').first().boundingBox(),
    page.getByRole('heading', { name: 'Autumn in Japan' }).boundingBox(),
  ])
  expect(statusBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height)
  expect(statusBox!.y + statusBox!.height).toBeLessThanOrEqual(titleBox!.y)
  await shot.page_('AppConfigUnavailable')

  configAvailable = true
  await expect(status).toHaveCount(0, { timeout: 10_000 })
})
