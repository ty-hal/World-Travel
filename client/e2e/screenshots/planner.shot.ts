import { test, clearNotices, loadSeed, expect } from './shot'

/**
 * Trip-planner tabs and dialogs.
 *
 * Tabs are reached by their visible label rather than a test id, deliberately:
 * if a label is renamed (as Budget → Costs was in 3.3.0) this run fails loudly
 * instead of silently capturing the wrong panel — which is exactly how the
 * current wiki ended up with screenshots the text contradicts.
 */

test.beforeEach(async ({ page }) => {
  await page.goto(`/trips/${loadSeed().tripId}`)
  await clearNotices(page)
})

async function openTab(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).first().click()
  await page.waitForTimeout(700)
}

test('costs panel', async ({ page, shot }) => {
  await openTab(page, 'Costs')
  await shot.page_('Costs')
})

test('lists — packing', async ({ page, shot }) => {
  await openTab(page, 'Lists')
  await shot.page_('PackingList')
})

test('transports', async ({ page, shot }) => {
  await openTab(page, 'Transports')
  await shot.page_('Transports')
})

test('bookings', async ({ page, shot }) => {
  await openTab(page, 'Bookings')
  await shot.page_('Bookings')
})

test('photo albums', async ({ page, shot }) => {
  const seed = loadSeed()
  const media = [
    { key: 'trips/autumn-in-japan/sensoji-at-dusk.jpg', size: 1, contentType: 'image/jpeg', uploaded: '2026-10-01T12:00:00Z' },
    { key: 'trips/autumn-in-japan/fushimi-torii-path.jpg', size: 1, contentType: 'image/jpeg', uploaded: '2026-10-02T12:00:00Z' },
    { key: 'trips/autumn-in-japan/kinkakuji-golden-pavilion.jpg', size: 1, contentType: 'image/jpeg', uploaded: '2026-10-03T12:00:00Z' },
    { key: 'trips/autumn-in-japan/arashiyama-bamboo-grove.jpg', size: 1, contentType: 'image/jpeg', uploaded: '2026-10-04T12:00:00Z' },
  ]
  const images = [
    'https://images.unsplash.com/photo-1731160762891-2919e8cb6fed?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1670707199207-ac6d444e6e83?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1705579687385-7c9c2a1961b9?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1527974361724-67fd5ebfd6d2?auto=format&fit=crop&w=900&q=80',
  ]
  await page.route(`**/api/trips/${seed.tripId}/files/media`, route => route.fulfill({
    json: { prefix: 'trips/autumn-in-japan/', objects: media, prefixes: [], truncated: false },
  }))
  await page.route(`**/api/trips/${seed.tripId}/files/media/object?*`, route => {
    const index = media.findIndex(object => route.request().url().includes(encodeURIComponent(object.key)))
    return index < 0 ? route.abort() : route.fulfill({ status: 302, headers: { location: images[index] } })
  })
  await openTab(page, 'Photos')
  await expect(page.getByRole('button', { name: /View .*\.jpg/ })).toHaveCount(4)
  await shot.page_('PhotoAlbums')
})
