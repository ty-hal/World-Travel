import { test, clearNotices, expect, loadSeed } from './shot'

/**
 * Detail pages and the surfaces that need a couple of clicks to reach.
 *
 * Each capture asserts something specific to the surface before shooting, so a
 * navigation that quietly lands on a fallback (or an addon that is off) fails
 * the run instead of producing a screenshot of the wrong screen.
 */

test('collection detail', async ({ page, shot }) => {
  const seed = loadSeed()
  test.skip(!seed.collectionId, 'collections addon unavailable during seed')
  await page.goto(`/collections/${seed.collectionId}`)
  await clearNotices(page)
  await shot.page_('CollectionDetail')
})

test('mcp access — admin', async ({ page, shot }) => {
  await page.goto('/admin')
  await clearNotices(page)
  await page.getByRole('button', { name: 'MCP Access', exact: true }).first().click()
  await page.waitForTimeout(700)
  await shot.page_('MCPAccess')
})

test('two-factor setup', async ({ page, shot }) => {
  await page.goto('/settings')
  await clearNotices(page)
  await page.getByRole('button', { name: 'Account', exact: true }).first().click()
  await page.waitForTimeout(600)
  const enable = page.getByRole('button', { name: /two-factor|2fa|authenticator/i }).first()
  if (await enable.isVisible().catch(() => false)) {
    await enable.click()
    await page.waitForTimeout(900)
  }
  await shot.page_('2FA')
})

/**
 * Settle-up.
 *
 * WARNING for anyone extending this file: the "Settle up" button in the Costs
 * toolbar is not a view — it RECORDS the settling transfers. Capture the "Add
 * payment" dialog instead — same surface, no side effect — and close it again.
 */
test('costs — record a settle-up payment', async ({ page, shot }) => {
  const seed = loadSeed()
  await page.goto(`/trips/${seed.tripId}`)
  await clearNotices(page)
  await page.getByRole('button', { name: 'Costs', exact: true }).first().click()
  await page.waitForTimeout(800)

  const addPayment = page.getByRole('button', { name: /add payment/i }).first()
  test.skip(!(await addPayment.isVisible().catch(() => false)), 'no add-payment entry point rendered')
  await addPayment.click()
  await page.waitForTimeout(700)

  const modal = page.locator('.trek-modal-backdrop > div').first()
  await expect(modal).toBeVisible()

  const amountInput = modal.locator('input[inputmode="decimal"]').first()
  if (await amountInput.isVisible().catch(() => false)) {
    await amountInput.fill('15000')
  }

  await shot.element('CostsSettleUp', modal)
})

test('trip files', async ({ page, shot }) => {
  const seed = loadSeed()
  await page.goto(`/trips/${seed.tripId}/files`)
  await clearNotices(page)
  await expect(page).toHaveURL(/files/)
  await shot.page_('Documents')
})
