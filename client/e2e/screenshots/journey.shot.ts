import { test, clearNotices, expect, loadSeed } from './shot'

test('journey overview', async ({ page, shot }) => {
  await page.goto('/journey')
  await clearNotices(page)
  await expect(page.getByText('Across Japan, Slowly')).toBeVisible()
  await shot.page_('Journey')
})

test('journey detail', async ({ page, shot }) => {
  const journeyId = loadSeed().journeyId
  const tracksResponse = await page.request.get(`/api/journeys/${journeyId}/tracks`)
  expect(tracksResponse.ok()).toBeTruthy()
  expect((await tracksResponse.json()).tracks).toEqual([])
  await page.route(`**/api/journeys/${journeyId}/tracks`, route => route.fulfill({
    json: { tracks: [{ place_id: 901, trip_id: loadSeed().tripId, name: 'Sample GPX trail', color: '#ef4444', points: [[35.68, 139.76], [35.05, 137.2], [34.7, 135.5], [34.4, 132.45]] }] },
  }))
  await page.goto(`/journey/${journeyId}`)
  await clearNotices(page)
  await expect(page.getByText('First morning in Asakusa')).toBeVisible()
  await expect(page.getByText('3 places synced', { exact: true }).first()).toBeVisible()
  await shot.page_('JourneyDetail')
  await page.getByRole('button', { name: 'Journey settings' }).last().click()
  await expect(page.getByRole('heading', { name: 'Journey settings' })).toBeVisible()
  await expect(page.getByText('2 places synced', { exact: true }).last()).toBeVisible()
})

test('public journey', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  const token = await page.evaluate(async (journeyId) => {
    const response = await fetch(`/api/journeys/${journeyId}/share-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_timeline: true, share_gallery: false, share_map: false }),
    })
    if (!response.ok) throw new Error(`Journey share link failed: ${response.status}`)
    return (await response.json()).token as string
  }, loadSeed().journeyId)
  expect(token).toBeTruthy()
  await page.goto(`/public/journey/${token}`)
  await expect(page.getByText('Across Japan, Slowly')).toBeVisible()
  await shot.page_('JourneyPublic')
})
