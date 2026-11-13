import { test, clearNotices, loadSeed, expect } from './shot'
import { stubSeasonalClimate } from './seasonalClimate'

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes('trip list failure and retry') || testInfo.title.includes('trip list delayed loading')) return
  await page.goto('/dashboard')
  await clearNotices(page)
})

test('dashboard', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await shot.page_('DashboardWidgets')
})

test('trip list title spacing', async ({ page, shot }) => {
  await page.getByRole('button', { name: 'List' }).click()
  const card = page.locator('.trip-card').filter({ hasText: 'Climate sampler:' }).first()
  const title = card.locator('.trip-name')
  const status = card.locator('.trip-status')
  await expect(title).toBeVisible()
  await expect(status).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  const titleBox = await title.boundingBox()
  const statusBox = await status.boundingBox()
  expect(titleBox && statusBox && titleBox.y >= statusBox.y + statusBox.height).toBe(true)
  await shot.page_('TripListFormatting')
})

test('planned trips seasonal comparison', async ({ page, shot }) => {
  await stubSeasonalClimate(page)
  await page.getByRole('button', { name: 'Seasons' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.locator('.trip-season-row')).toHaveCount(3)
  await expect(page.locator('.trip-seasons-month-picker')).toHaveCount(0)
  await expect(page.locator('.page-sidebar')).toBeVisible()
  await shot.page_('TripSeasons-Collage')
  await page.getByRole('button', { name: /Climate sampler: tropics, desert & highlands, September:/ }).click()
  await expect(page.locator('.trip-season-detail-row')).toContainText('September')
  await expect(page.locator('.trip-season-detail-row')).toContainText('located route areas')
  await shot.page_('TripSeasons-MonthFit')
  await page.getByPlaceholder('Find a trip').fill('Climate sampler')
  await expect(page.locator('.trip-season-row')).toHaveCount(1)
  await expect(page.getByRole('row', { name: /Autumn in Japan/ })).toHaveCount(0)
  await shot.page_('TripSeasons-Search')
  await page.getByPlaceholder('Find a trip').fill('no matching trip')
  await expect(page.getByText(/No planned trips match/)).toBeVisible()
  await page.getByPlaceholder('Find a trip').fill('')
  await page.getByRole('button', { name: /Autumn in Japan, September:/ }).click()
  await expect(page.locator('.trip-season-detail-row')).toContainText('September')
  await shot.page_('TripSeasons')
})

test('dashboard while offline', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
  await page.context().setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
  await shot.page_('DashboardOffline')
})

test('dashboard with unavailable travel stats', async ({ page, shot }) => {
  await page.route('**/api/auth/travel-stats', route => route.abort())
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
  await expect(page.locator('.atlas-card').filter({ hasText: 'TRIPS TOTAL' }).locator('.value')).toHaveText('—')
  await shot.page_('DashboardStatsUnavailable')
})

test('dashboard trip list failure and retry', async ({ page, shot }) => {
  let failTripListRequests = true
  await page.route('**/api/trips**', async route => {
    if (failTripListRequests && route.request().method() === 'GET' && new URL(route.request().url()).pathname.endsWith('/api/trips')) {
      await route.fulfill({ status: 500, json: { error: 'Unavailable' } })
      return
    }
    await route.continue()
  })
  await page.goto('/dashboard')
  const error = page.getByRole('alert')
  await expect(error).toContainText("Couldn't reach the server")
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No trips yet' })).toHaveCount(0)
  await shot.page_('DashboardTripsUnavailable')
  failTripListRequests = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(error).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Autumn in Japan' })).toBeVisible()
})

test('dashboard trip list delayed loading', async ({ page, shot }) => {
  let releaseTrips: () => void = () => {}
  let tripsRequested = false
  const heldTrips = new Promise<void>(resolve => { releaseTrips = resolve })
  await page.route('**/api/trips**', async route => {
    if (route.request().method() === 'GET' && new URL(route.request().url()).pathname === '/api/trips') {
      tripsRequested = true
      await heldTrips
    }
    await route.continue()
  })

  const navigation = page.goto('/dashboard')
  try {
    await expect.poll(() => tripsRequested).toBe(true)
    await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Autumn in Japan' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'No trips yet' })).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveText('Loading trips...')
    const heroSkeleton = page.locator('.dash-hero-skeleton')
    await expect(heroSkeleton).toBeVisible()
    const tripGrid = page.locator('.trips')
    await expect(tripGrid).toHaveAttribute('aria-busy', 'true')
    await expect(tripGrid.locator('.trip-card-skeleton')).toHaveCount(3)
    await shot.page_('DashboardTripsLoading')
    const heroHeightWhileLoading = (await heroSkeleton.boundingBox())!.height
    const gridTopWhileLoading = (await tripGrid.boundingBox())!.y
    releaseTrips()
    await navigation
    await expect(page.getByRole('heading', { name: 'Autumn in Japan' })).toBeVisible()
    const loadedHero = page.locator('.hero-trip').first()
    await expect(loadedHero).toBeVisible()
    expect(Math.abs((await loadedHero.boundingBox())!.height - heroHeightWhileLoading)).toBeLessThanOrEqual(1)
    await expect(tripGrid.locator('.trip-card-skeleton')).toHaveCount(0)
    await expect(tripGrid).toHaveAttribute('aria-busy', 'false')
    expect(Math.abs((await tripGrid.boundingBox())!.y - gridTopWhileLoading)).toBeLessThanOrEqual(1)
  } finally {
    releaseTrips()
  }
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
  const tripStartDate = loadSeed().tripStartDate
  const tripYear = tripStartDate.slice(0, 4)
  await page.goto('/calendar')
  const yearOption = page.locator('div.grid.grid-cols-4.gap-1').getByText(tripYear, { exact: true })
  await expect(yearOption).toBeVisible()
  await yearOption.click()
  const ptoDate = new Date(`${tripStartDate}T00:00:00Z`)
  while (ptoDate.getUTCDay() === 0 || ptoDate.getUTCDay() === 6) ptoDate.setUTCDate(ptoDate.getUTCDate() + 1)
  const ptoDateKey = ptoDate.toISOString().slice(0, 10)
  await expect(page.locator(`[data-date="${ptoDateKey}"]`)).toHaveAttribute('data-planned-vacation', 'true')
  await shot.page_('Vacay')
})

test('vacay planned-day details', async ({ page, shot }) => {
  const tripStartDate = loadSeed().tripStartDate
  const tripYear = tripStartDate.slice(0, 4)
  const yearOption = page.locator('div.grid.grid-cols-4.gap-1').getByText(tripYear, { exact: true })
  const date = new Date(`${tripStartDate}T00:00:00Z`)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1)
  const dateKey = date.toISOString().slice(0, 10)
  await page.goto('/calendar')
  await expect(yearOption).toBeVisible()
  await yearOption.click()
  const day = page.locator(`[data-date="${dateKey}"]`)
  await expect(day).toBeVisible()
  await day.click()
  await expect(day).toHaveAttribute('data-planned-vacation', 'true')
  await expect(page.getByRole('button', { name: 'Remove Vacation' })).toBeVisible()
  await shot.page_('VacayDayDetails')
})

test('collections', async ({ page, shot }) => {
  await page.goto('/collections')
  const search = page.getByRole('textbox', { name: 'Search places' })
  await expect(search).toBeVisible()
  await shot.page_('Collections')
  await search.fill('zzzx-no-match')
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible()
  await shot.page_('CollectionsNoMatches')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.col-lrow').first()).toBeVisible()
})

test('notifications inbox', async ({ page, shot }) => {
  await page.goto('/notifications')
  await shot.page_('NotificationsInbox')
})

test('notifications inbox request failure and retry', async ({ page, shot }) => {
  let allowRetry = false
  await page.route('**/api/notifications/in-app*', route => {
    if (new URL(route.request().url()).pathname.endsWith('/in-app') && !allowRetry) {
      return route.fulfill({ status: 503, json: { error: 'Unavailable' } })
    }
    return route.continue()
  })
  await page.goto('/notifications')
  await expect(page.getByRole('alert')).toContainText("Couldn't load notifications.")
  await expect(page.getByText('Count unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark all read' })).toBeVisible()
  await shot.page_('NotificationsLoadError')
  allowRetry = true
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete all' })).toBeVisible()
})

test('notifications pagination failure pauses automatic retries', async ({ page, shot }) => {
  let allowRetry = false
  let pageFailures = 0
  let pageRetrySucceeded = false
  await page.route('**/api/notifications/in-app*', async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.endsWith('/in-app')) return route.continue()
    const offset = Number(url.searchParams.get('offset') || 0)
    if (offset === 0) {
      const response = await route.fetch()
      const body = await response.json()
      return route.fulfill({ response, json: { ...body, total: body.notifications.length + 1 } })
    }
    if (!allowRetry) {
      pageFailures += 1
      return route.fulfill({ status: 503, json: { error: 'Unavailable' } })
    }
    const response = await route.fetch()
    pageRetrySucceeded = response.ok()
    return route.fulfill({ response })
  })

  await page.goto('/notifications')
  await expect(page.getByText('Trip Reminder')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText("Couldn't load notifications.")
  await expect.poll(() => pageFailures).toBeGreaterThan(0)
  const attemptsAfterFailure = pageFailures
  await shot.page_('NotificationsPaginationError')
  await page.waitForTimeout(500)
  expect(pageFailures).toBe(attemptsAfterFailure)

  const laterPage = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname.endsWith('/in-app') && Number(url.searchParams.get('offset')) > 0 && response.ok()
  })
  allowRetry = true
  await page.getByRole('button', { name: 'Try again' }).click()
  await laterPage
  expect(pageRetrySucceeded).toBe(true)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('travel timeline', async ({ page, shot }) => {
  await page.goto('/timeline')
  await expect(page.getByRole('heading', { name: 'Travel timeline' })).toBeVisible()
  await shot.page_('Timeline')
})

test('public Journey delayed loading', async ({ page, shot }) => {
  let releaseChunk: () => void = () => {}
  let requested = false
  const heldChunk = new Promise<void>(resolve => { releaseChunk = resolve })
  await page.route('**/src/pages/JourneyPublicPage.tsx*', async route => {
    requested = true
    await heldChunk
    await route.continue()
  })

  const navigation = page.goto('/public/journey/delayed-loading-check')
  try {
    await expect.poll(() => requested).toBe(true)
    await expect(page.getByRole('status')).toContainText(/loading/i)
    await shot.page_('JourneyPublicRouteLoading')
  } finally {
    releaseChunk()
  }
  await navigation
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

test('in-app help', async ({ page, shot }) => {
  await page.goto('/help')
  await shot.page_('HelpInApp')
})

test('help search opens an article', async ({ page, shot }) => {
  await page.goto('/help')
  const sidebar = page.locator('aside')
  const search = sidebar.getByRole('textbox', { name: /search docs/i })
  await expect(search).toBeVisible()
  await search.fill('Quick Start')
  const articleLink = sidebar.getByRole('link', { name: 'Quick Start', exact: true })
  await expect(articleLink).toBeVisible()
  await articleLink.click()
  await expect(page).toHaveURL(/\/help\/Quick-Start$/)
  await expect(page.getByRole('heading', { name: 'Quick Start', exact: true })).toBeVisible()
  await shot.page_('HelpQuickStart')
})

test('help article announces delayed loading', async ({ page, shot }) => {
  let releaseRequest!: () => void
  const requestGate = new Promise<void>(resolve => { releaseRequest = resolve })
  await page.route('**/api/help/page/Quick-Start', async route => {
    await requestGate
    await route.continue()
  })
  const navigation = page.goto('/help/Quick-Start')
  const loading = page.locator('main [role="status"]')
  await expect(loading).toContainText('Loading')
  try {
    await shot.page_('HelpArticleLoading')
  } finally {
    releaseRequest()
  }
  await navigation
  await expect(page.locator('article').getByRole('heading', { name: 'Quick Start', exact: true })).toBeVisible()
})

test('help article failure can be retried', async ({ page, shot }) => {
  let attempts = 0
  let allowRetry = false
  await page.route('**/api/help/page/Quick-Start', async route => {
    attempts += 1
    if (!allowRetry) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) })
    } else {
      await route.continue()
    }
  })
  await page.goto('/help/Quick-Start')
  const error = page.getByRole('alert')
  await expect(error).toContainText("Couldn't load this page")
  await shot.page_('HelpArticleError')
  allowRetry = true
  await error.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('article').getByRole('heading', { name: 'Quick Start', exact: true })).toBeVisible()
  expect(attempts).toBeGreaterThan(1)
  await shot.page_('HelpArticleRetry')
})

test('files', async ({ page, shot }) => {
  const seed = loadSeed()
  await page.goto(`/trips/${seed.tripId}/files`)
  await shot.page_('Files')
})
