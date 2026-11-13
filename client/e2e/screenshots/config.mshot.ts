import { test, expect } from './shot'

test('mobile app config failure and recovery', async ({ page, shot }) => {
  let configAvailable = false
  await page.route('**/api/auth/app-config', route =>
    configAvailable
      ? route.continue()
      : route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  )
  await page.goto('/dashboard')
  const status = page.getByRole('status').filter({ hasText: 'Server settings unavailable' })
  await expect(status).toBeVisible()
  const [statusBox, titleBox, notificationsBox] = await Promise.all([
    status.boundingBox(),
    page.getByRole('heading', { name: 'Autumn in Japan' }).boundingBox(),
    page.getByRole('button', { name: 'Notifications' }).boundingBox(),
  ])
  const viewport = page.viewportSize()!
  expect(statusBox!.y).toBeGreaterThanOrEqual(40)
  expect(statusBox!.y + statusBox!.height).toBeLessThanOrEqual(titleBox!.y)
  expect(statusBox!.x + statusBox!.width).toBeLessThan(notificationsBox!.x)
  expect(statusBox!.x).toBeGreaterThanOrEqual(0)
  expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(viewport.width)
  await shot.page_('AppConfigUnavailable')

  configAvailable = true
  await expect(status).toHaveCount(0, { timeout: 10_000 })
})
