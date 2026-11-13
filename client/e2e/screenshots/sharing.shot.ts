import { test, clearNotices, loadSeed, expect, mockPagePlugin } from './shot'

test('shared trip', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  const token = await page.evaluate(async (tripId) => {
    const response = await fetch(`/api/trips/${tripId}/share-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_map: false, share_bookings: true }),
    })
    if (!response.ok) throw new Error(`Trip share link failed: ${response.status}`)
    return (await response.json()).token as string
  }, loadSeed().tripId)
  expect(token).toBeTruthy()
  await page.goto(`/shared/${token}`)
  await expect(page.getByRole('heading', { name: 'Autumn in Japan' })).toBeVisible()
  await shot.page_('SharedTrip')
})

test('trip invite preview', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  const token = await page.evaluate(async (tripId) => {
    const response = await fetch(`/api/trips/${tripId}/invite-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!response.ok) throw new Error(`Trip invite link failed: ${response.status}`)
    return (await response.json()).token as string
  }, loadSeed().tripId)
  expect(token).toBeTruthy()
  await page.goto(`/join/${token}`)
  await expect(page.getByRole('heading', { name: 'Join this trip' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join trip' })).toBeEnabled()
  await shot.page_('JoinTripPreview')
})

test('unknown plugin page', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await page.goto('/plugins/ui-audit-missing-plugin')
  await expect(page.getByText('Plugin not found')).toBeVisible()
  await shot.page_('PluginNotFound')
})

test('installed page plugin host', async ({ page, shot }) => {
  const plugin = await mockPagePlugin(page)
  await page.goto(`/plugins/${plugin.id}`)
  const frame = page.locator(`iframe[title="${plugin.name}"]`)
  await expect(frame).toBeVisible()
  await expect(page.frameLocator(`iframe[title="${plugin.name}"]`).getByRole('heading', { name: 'Sample plugin workspace' })).toBeVisible()
  await shot.page_('PluginPage')
})
