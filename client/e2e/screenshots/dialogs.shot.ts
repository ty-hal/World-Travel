import { test, clearNotices, expect, loadSeed } from './shot'

/**
 * Modals and dialogs.
 *
 * Captured as element screenshots (not full page) so the wiki gets the dialog
 * itself rather than a dimmed backdrop with a small box in the middle. Each one
 * asserts the dialog is actually open first — a missed click would otherwise
 * silently produce a screenshot of the page behind it.
 */

function dialog(page: import('@playwright/test').Page) {
  return page.locator('.trek-modal-backdrop > div').first()
}

test('create trip modal — with the new currency field', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await page.getByRole('button', { name: /new trip/i }).first().click()
  await expect(dialog(page)).toBeVisible()
  await shot.element('TripCreate', dialog(page))
})

test('share dialog', async ({ page, shot }) => {
  const seed = loadSeed()
  await page.goto(`/trips/${seed.tripId}`)
  await clearNotices(page)
  await page.getByRole('button', { name: /share/i }).first().click()
  await expect(dialog(page)).toBeVisible()
  await shot.element('Share', dialog(page))
})
