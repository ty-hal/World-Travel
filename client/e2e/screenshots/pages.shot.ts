import { test, clearNotices, loadSeed } from './shot'

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
})

test('dashboard', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await shot.page_('DashboardWidgets')
})

test('trip planner', async ({ page, shot }) => {
  const seed = loadSeed()
  await page.goto(`/trips/${seed.tripId}`)
  await shot.page_('TripPlanner')
})

test('atlas', async ({ page, shot }) => {
  await page.goto('/atlas')
  await shot.page_('Atlas')
})

test('vacay', async ({ page, shot }) => {
  await page.goto('/vacay')
  await shot.page_('Vacay')
})

test('collections', async ({ page, shot }) => {
  await page.goto('/collections')
  await shot.page_('Collections')
})

test('notifications inbox', async ({ page, shot }) => {
  await page.goto('/notifications')
  await shot.page_('NotificationsInbox')
})

test('in-app help', async ({ page, shot }) => {
  await page.goto('/help')
  await shot.page_('HelpInApp')
})

test('files', async ({ page, shot }) => {
  const seed = loadSeed()
  await page.goto(`/trips/${seed.tripId}/files`)
  await shot.page_('Files')
})
