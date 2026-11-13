import { test, clearNotices, loadSeed, expect, mockPagePlugin } from './shot'
import { stubSeasonalClimate } from './seasonalClimate'

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes('trip list failure and retry') || testInfo.title.includes('trip list delayed loading') || testInfo.title.includes('notifications inbox request failure and retry') || testInfo.title.includes('installed page plugin')) return
  await page.goto('/dashboard')
  await clearNotices(page)
})

test('mobile dashboard', async ({ page, shot }) => {
  await expect(page.locator('nav.md\\:hidden')).toBeVisible()
  await shot.page_('Dashboard')
  const scrollRegion = page.locator('div.flex-1.overflow-y-auto').first()
  await scrollRegion.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => scrollRegion.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  const finalWidget = page.locator('.page-sidebar .tool').filter({ hasText: /collections/i }).first()
  await expect(finalWidget).toBeVisible()
  const [widgetBox, navBox] = await Promise.all([
    finalWidget.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(widgetBox!.y + widgetBox!.height).toBeLessThan(navBox!.y - 8)
  await shot.page_('DashboardScrollEnd')
})

test('mobile planned trips seasonal comparison', async ({ page, shot }) => {
  await stubSeasonalClimate(page)
  await page.getByRole('button', { name: 'Seasons' }).click()
  await expect(page.getByRole('heading', { name: 'Seasonal factors' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  const september = page.getByRole('button', { name: /Autumn in Japan, September:/ })
  await september.evaluate(cell => {
    const scroller = cell.closest<HTMLElement>('.trip-seasons-scroll')!
    const cellRight = cell.getBoundingClientRect().right
    scroller.scrollLeft += cellRight - scroller.getBoundingClientRect().right + 8
  })
  await september.click()
  await expect(page.locator('.trip-season-detail-row')).toContainText('September')
  await page.locator('.trip-seasons').evaluate(element => {
    for (let parent = element as HTMLElement | null; parent; parent = parent.parentElement) {
      parent.scrollTop = 0
      parent.scrollLeft = 0
    }
    window.scrollTo(0, 0)
  })
  await shot.page_('TripSeasons')
})

test('mobile dashboard with unavailable travel stats', async ({ page, shot }) => {
  await page.route('**/api/auth/travel-stats', route => route.abort())
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
  await expect(page.locator('.atlas-card').filter({ hasText: 'TRIPS TOTAL' }).locator('.value')).toHaveText('—')
  await shot.page_('DashboardStatsUnavailable')
})

test('mobile dashboard trip list failure and retry', async ({ page, shot }) => {
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

test('mobile dashboard trip list delayed loading', async ({ page, shot }) => {
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
    await expect(page.getByRole('status')).toHaveText('Loading trips...')
    const heroSkeleton = page.locator('.dash-hero-skeleton')
    await expect(heroSkeleton).toBeVisible()
    const tripGrid = page.locator('.trips')
    await expect(tripGrid).toHaveAttribute('aria-busy', 'true')
    await expect(tripGrid.locator('.trip-card-skeleton')).toHaveCount(3)
    await expect(page.locator('.dash-pass-skeleton')).toBeVisible()
    await shot.page_('DashboardTripsLoadingMobile')
    const heroHeightWhileLoading = (await heroSkeleton.boundingBox())!.height
    const passHeightWhileLoading = (await page.locator('.dash-pass-skeleton').boundingBox())!.height
    const gridTopWhileLoading = (await tripGrid.boundingBox())!.y
    releaseTrips()
    await navigation
    await expect(page.getByRole('heading', { name: 'Autumn in Japan' })).toBeVisible()
    await expect(page.locator('.dash-pass-skeleton')).toHaveCount(0)
    const loadedHero = page.locator('.hero-trip').first()
    const loadedPass = page.locator('.pass-card').first()
    expect(Math.abs((await loadedHero.boundingBox())!.height - heroHeightWhileLoading)).toBeLessThanOrEqual(1)
    expect(Math.abs((await loadedPass.boundingBox())!.height - passHeightWhileLoading)).toBeLessThanOrEqual(1)
    await expect(tripGrid.locator('.trip-card-skeleton')).toHaveCount(0)
    expect(Math.abs((await tripGrid.boundingBox())!.y - gridTopWhileLoading)).toBeLessThanOrEqual(1)
  } finally {
    releaseTrips()
  }
})

test('mobile notifications inbox request failure and retry', async ({ page, shot }) => {
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
  await shot.page_('NotificationsLoadErrorMobile')
  allowRetry = true
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete all' })).toBeVisible()
})

test('mobile dashboard while offline', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
  await page.context().setOffline(true)
  const offlineStatus = page.getByRole('status').filter({ hasText: 'Offline' })
  await expect(offlineStatus).toBeVisible()
  await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
  const heroCover = page.locator('.hero-trip img.bg')
  await expect.poll(() => heroCover.evaluate(image => (image as HTMLImageElement).complete)).toBe(true)
  const brokenCoverVisible = await heroCover.evaluate(image => {
    const img = image as HTMLImageElement
    return img.naturalWidth === 0 && getComputedStyle(img).display !== 'none'
  })
  expect(brokenCoverVisible).toBe(false)
  const [bannerBox, navBox] = await Promise.all([
    offlineStatus.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(bannerBox).not.toBeNull()
  expect(navBox).not.toBeNull()
  expect(bannerBox!.y + bannerBox!.height).toBeLessThan(navBox!.y)
  await shot.page_('DashboardOffline')
})

test('mobile trip planner', async ({ page, shot }) => {
  const defaultFontRequests: string[] = []
  page.on('request', request => {
    if (decodeURIComponent(request.url()).includes('Open Sans Regular,Arial Unicode MS Regular')) {
      defaultFontRequests.push(request.url())
    }
  })
  await page.goto(`/trips/${loadSeed().tripId}`)
  await expect(page.getByRole('button', { name: 'Plan', exact: true }).first()).toBeVisible()
  const attribution = page.locator('.maplibregl-ctrl-attrib')
  await expect(attribution).toBeVisible()
  const poiPill = page.locator('[data-testid="mobile-poi-category-pill"]')
  await expect(poiPill).toBeVisible()
  const poiRail = poiPill.locator('[aria-label="Explore nearby places"]')
  const [poiRailBox, poiLabelBox] = await Promise.all([
    poiRail.boundingBox(),
    poiRail.getByText('Explore nearby', { exact: true }).boundingBox(),
  ])
  const [compassBox, locationButtonBox] = await Promise.all([
    page.getByRole('button', { name: 'Reset map north' }).boundingBox(),
    page.getByRole('button', { name: 'Show my location' }).boundingBox(),
  ])
  expect(poiRailBox!.x).toBeGreaterThanOrEqual(0)
  expect(poiRailBox!.x + poiRailBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  expect(poiLabelBox!.x).toBeGreaterThanOrEqual(poiRailBox!.x)
  expect(poiLabelBox!.x + poiLabelBox!.width).toBeLessThanOrEqual(poiRailBox!.x + poiRailBox!.width)
  expect(poiRailBox!.x + poiRailBox!.width).toBeLessThanOrEqual(compassBox!.x)
  expect(poiRailBox!.x + poiRailBox!.width).toBeLessThanOrEqual(locationButtonBox!.x)
  const [attributionBox, navBox] = await Promise.all([
    attribution.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(attributionBox!.y + attributionBox!.height).toBeLessThan(navBox!.y)
  expect(attributionBox!.y + attributionBox!.height).toBeLessThan((await poiPill.boundingBox())!.y)
  await shot.page_('TripPlanner')
  expect(defaultFontRequests).toEqual([])
})

test('mobile booking form', async ({ page, shot }) => {
  await page.goto(`/trips/${loadSeed().tripId}`)
  await page.getByRole('button', { name: 'Bookings', exact: true }).click()
  const addBooking = page.getByRole('button', { name: 'Manual Booking' })
  const addBookingBox = await addBooking.boundingBox()
  expect(addBookingBox!.width).toBeGreaterThanOrEqual(44)
  expect(addBookingBox!.height).toBeGreaterThanOrEqual(44)
  await addBooking.click()
  const dialog = page.getByRole('dialog', { name: 'New Reservation' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Title' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add' })).toBeVisible()
  const closeBox = await dialog.getByRole('button', { name: 'Close' }).boundingBox()
  expect(closeBox!.width).toBeGreaterThanOrEqual(44)
  expect(closeBox!.height).toBeGreaterThanOrEqual(44)

  const viewport = page.viewportSize()!
  const [dialogBox, dialogMetrics, bodyWidth] = await Promise.all([
    dialog.boundingBox(),
    dialog.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        height: rect.height,
        innerHeight: window.innerHeight,
        maxHeight: style.maxHeight,
        overflow: style.overflow,
      }
    }),
    page.locator('body').evaluate(element => element.scrollWidth),
  ])
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width)
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
  expect(dialogMetrics.height, JSON.stringify({ viewport, dialogMetrics })).toBeLessThanOrEqual(dialogMetrics.innerHeight)
  expect(bodyWidth).toBeLessThanOrEqual(viewport.width)
  await shot.page_('BookingsModal')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('mobile trip planner tabs expose names and selected state', async ({ page, shot }) => {
  await page.goto(`/trips/${loadSeed().tripId}`)
  const viewport = page.viewportSize()!
  const tabs = [
    ['Transports', 'TransportsMobile'],
    ['Bookings', 'BookingsMobile'],
    ['Lists', 'PackingMobile'],
    ['Costs', 'CostsMobile'],
    ['Files', 'FilesMobile'],
    ['Photos', 'PhotosMobile'],
    ['History', 'HistoryMobile'],
    ['Collab', 'CollaborationMobile'],
  ] as const

  for (const [label, screenshotName] of tabs) {
    const tab = page.getByRole('button', { name: label, exact: true }).first()
    await expect(tab).toHaveAttribute('aria-label', label)
    await tab.click()
    await expect(tab).toHaveAttribute('aria-pressed', 'true')
    const [width, height] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ])
    expect(width).toBeLessThanOrEqual(height)
    await shot.page_(screenshotName)
  }
})

test('mobile photo album distinguishes loading, empty, and failed refresh states', async ({ page, shot }) => {
  let releaseInitial: () => void = () => {}
  let requestedInitial = false
  let failRefresh = false
  const initialResponse = new Promise<void>(resolve => { releaseInitial = resolve })
  await page.route('**/api/trips/*/files/media*', async route => {
    if (failRefresh) {
      await route.fulfill({ status: 503, json: { error: 'Cloudflare is temporarily unavailable.' } })
      return
    }
    requestedInitial = true
    await initialResponse
    await route.fulfill({ json: { prefix: 'trips/autumn-in-japan/', objects: [] } })
  })

  await page.goto(`/trips/${loadSeed().tripId}`)
  await page.getByRole('button', { name: 'Photos', exact: true }).click()
  const album = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Cloudflare trip album' }) })
  await expect.poll(() => requestedInitial).toBe(true)
  await expect(album).toHaveAttribute('aria-busy', 'true')
  await expect(album.getByRole('button', { name: 'Load album' })).toBeDisabled()
  await expect(album.getByRole('status')).toContainText('Loading album…')
  await expect(album.getByText('No media in this folder yet.', { exact: false })).toHaveCount(0)
  const loadingStateBox = await album.getByRole('status').filter({ hasText: 'Loading album…' }).boundingBox()
  await shot.page_('PhotosLoadingMobile')

  releaseInitial()
  await expect(album).toHaveAttribute('aria-busy', 'false')
  await expect(album.getByText('No media in this folder yet.', { exact: false })).toBeVisible()
  const emptyStateBox = await album.getByText('No media in this folder yet.', { exact: false }).boundingBox()
  expect(emptyStateBox?.height).toBe(loadingStateBox?.height)
  await shot.page_('PhotosEmptyMobile')

  failRefresh = true
  await album.getByRole('button', { name: 'Load album' }).click()
  await expect(album.getByRole('status')).toContainText('Cloudflare is temporarily unavailable.')
  await shot.page_('PhotosRefreshErrorMobile')
})

test('mobile photo upload keyboard focus visibility', async ({ page, shot }) => {
  await page.goto(`/trips/${loadSeed().tripId}`)
  await page.getByRole('button', { name: 'Photos', exact: true }).click()
  const uploadInput = page.getByLabel('Upload photos or videos')
  await uploadInput.focus()
  await expect(uploadInput).toBeFocused()
  const uploadLabel = uploadInput.locator('..')
  await expect(uploadLabel).not.toHaveCSS('box-shadow', 'none')
  await shot.page_('PhotosUploadFocusMobile')
})

test('mobile trip planner dark theme', async ({ page, shot }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto(`/trips/${loadSeed().tripId}`)
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('button', { name: 'Plan', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset map north' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show my location' })).toBeVisible()
  await expect(page.locator('[data-basemap-tone="light"] .maplibregl-canvas').first()).toHaveCSS('filter', 'brightness(1)')
  await shot.page_('TripPlannerDarkMobile')
  await page.getByRole('button', { name: 'Photos', exact: true }).click()
  await shot.page_('PhotosDarkMobile')
})

test('mobile trip planner readiness checks', async ({ page, shot }) => {
  await page.goto(`/trips/${loadSeed().tripId}`)
  await page.getByRole('button', { name: 'Plan', exact: true }).last().click()
  const readiness = page.getByRole('region', { name: 'Itinerary readiness' })
  const showMore = readiness.getByRole('button', { name: /Show \d+ more/ })
  await expect(showMore).toBeVisible()
  await showMore.click()
  await expect(readiness.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true')
  const overlappingDays = await page.locator('.dp-day-header').evaluateAll(headers => headers.flatMap((header, index) => {
    const date = header.querySelector('.dp-day-header-content > div:first-child span:nth-child(2)')
    const actions = header.querySelector('.dp-day-actions')
    if (!date || !actions) return []
    const dateBox = date.getBoundingClientRect()
    const actionsBox = actions.getBoundingClientRect()
    return dateBox.right > actionsBox.left && dateBox.left < actionsBox.right && dateBox.bottom > actionsBox.top && dateBox.top < actionsBox.bottom ? [index + 1] : []
  }))
  expect(overlappingDays).toEqual([])
  await shot.page_('TripPlannerReadinessExpanded')
})

test('mobile delayed route loading keeps navigation visible', async ({ page, shot }) => {
  let releaseChunk: () => void = () => {}
  let requested = false
  const heldChunk = new Promise<void>(resolve => { releaseChunk = resolve })
  await page.route('**/src/pages/SettingsPage.tsx*', async route => {
    requested = true
    await heldChunk
    await route.continue()
  })

  const navigation = page.goto('/settings')
  try {
    await expect.poll(() => requested).toBe(true)
    await expect(page.getByRole('status')).toContainText(/loading/i)
    await shot.page_('MobileRouteLoadingSettings')
    await expect(page.locator('nav.md\\:hidden')).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByRole('status').locator('.animate-spin')).toHaveCSS('animation-name', 'none')
    await shot.page_('MobileRouteLoadingSettingsReducedMotion')
  } finally {
    releaseChunk()
  }
  await navigation
  await expect(page.getByRole('heading', { name: /settings/i }).first()).toBeVisible()
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

test('mobile dark route loading keeps navigation and contrast visible', async ({ page, shot }) => {
  let releaseChunk: () => void = () => {}
  let requested = false
  const heldChunk = new Promise<void>(resolve => { releaseChunk = resolve })
  await page.route('**/api/settings', async route => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({ response, json: { ...body, settings: { ...body.settings, dark_mode: true } } })
  })
  await page.route('**/src/pages/SettingsPage.tsx*', async route => {
    requested = true
    await heldChunk
    await route.continue()
  })

  const navigation = page.goto('/settings')
  try {
    await expect.poll(() => requested).toBe(true)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('status')).toContainText(/loading/i)
    await expect(page.getByRole('status').locator('.animate-spin')).toHaveCSS('border-top-color', 'rgb(244, 244, 245)')
    await shot.page_('MobileRouteLoadingSettingsDark')
    await expect(page.locator('nav.md\\:hidden')).toBeVisible()
  } finally {
    releaseChunk()
  }
  await navigation
  await expect(page.getByRole('heading', { name: /settings/i }).first()).toBeVisible()
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

test('mobile atlas', async ({ page, shot }) => {
  await page.goto('/atlas')
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })
  const source = page.getByRole('link', { name: 'Boundary data from geoBoundaries' })
  await expect(source).toBeVisible()
  const [sourceBox, searchBox] = await Promise.all([
    source.boundingBox(),
    page.getByRole('textbox', { name: /search a country/i }).boundingBox(),
  ])
  expect(sourceBox!.y).toBeGreaterThanOrEqual(searchBox!.y + searchBox!.height)
  expect(sourceBox!.x + sourceBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  const panel = page.locator('.atlas-bottom-panel')
  const stats = page.getByRole('region', { name: 'Stats' })
  const countries = stats.locator('.atlas-stat-hero').first()
  const [panelBox, countriesBox] = await Promise.all([panel.boundingBox(), countries.boundingBox()])
  expect(countriesBox!.x).toBeGreaterThanOrEqual(panelBox!.x)
  expect(countriesBox!.x + countriesBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width)
  await shot.page_('Atlas')

  const search = page.getByRole('textbox', { name: /search a country/i })
  await search.fill('zzzz no country')
  const noMatches = page.getByRole('status')
  await expect(noMatches).toHaveText('No countries match your search.')
  const [searchFieldBox, noMatchesBox] = await Promise.all([search.boundingBox(), noMatches.boundingBox()])
  expect(noMatchesBox!.y).toBeGreaterThanOrEqual(searchFieldBox!.y + searchFieldBox!.height)
  expect(noMatchesBox!.x + noMatchesBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await shot.page_('AtlasSearchNoMatchMobile')
})

test('mobile atlas dark theme', async ({ page, shot }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto('/atlas')
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('link', { name: 'Boundary data from geoBoundaries' })).toBeVisible()
  await shot.page_('AtlasDarkMobile')
})

test('mobile atlas bucket list add form', async ({ page, shot }) => {
  await page.goto('/atlas')
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Bucket List', exact: true }).click()
  await page.getByRole('button', { name: /add place/i }).click()
  const month = page.getByRole('button', { name: 'Month' })
  const year = page.getByRole('button', { name: 'Year' })
  const cancel = page.getByRole('button', { name: 'Cancel' })
  const add = page.getByRole('button', { name: 'Add', exact: true })
  await expect(month).toBeVisible()
  await expect(year).toBeVisible()
  await expect(cancel).toBeVisible()
  await expect(add).toBeVisible()
  const [monthBox, yearBox, cancelBox, addBox, navBox] = await Promise.all([
    month.boundingBox(),
    year.boundingBox(),
    cancel.boundingBox(),
    add.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  for (const box of [monthBox, yearBox, cancelBox, addBox]) {
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    expect(box!.y + box!.height).toBeLessThan(navBox!.y)
  }
  await shot.page_('AtlasBucketListAddForm')
})

test('mobile atlas stats request failure', async ({ page, shot }) => {
  await page.route('**/api/addons/atlas/stats', route => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  await page.goto('/atlas')
  await expect(page.getByRole('alert')).toContainText(/atlas data could not be loaded/i)
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await shot.page_('AtlasLoadError')
})

test('mobile vacation calendar', async ({ page, shot }) => {
  await page.goto('/calendar')
  await expect(page.locator('[data-date]').first()).toBeVisible()
  await shot.page_('Vacay')
  const scrollRegion = page.locator('.app-route-scroll')
  const lastDate = page.locator('[data-date]').last()
  await scrollRegion.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => scrollRegion.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await expect(lastDate).toBeInViewport()
  const [dateBox, navBox] = await Promise.all([
    lastDate.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(dateBox!.y + dateBox!.height).toBeLessThan(navBox!.y - 8)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  )
  await shot.page_('VacayScrollEnd')
})

test('mobile collections', async ({ page, shot }) => {
  await page.goto('/collections')
  await expect(page.getByRole('heading', { name: 'All saved' })).toBeVisible()
  const search = page.getByRole('textbox', { name: 'Search places' })
  const searchBox = await search.boundingBox()
  expect(searchBox?.width).toBeGreaterThan(200)
  expect(searchBox!.x + searchBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await shot.page_('Collections')
  await search.fill('zzzx-no-match')
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible()
  await shot.page_('CollectionsNoMatches')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.col-lrow').first()).toBeVisible()
  const scrollRegion = page.locator('.app-route-scroll')
  await scrollRegion.evaluate(element => { element.scrollTop = element.scrollHeight })
  const lastPlace = page.locator('.col-lrow').last()
  await expect(lastPlace).toBeVisible()
  const [placeBox, navBox] = await Promise.all([
    lastPlace.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(placeBox!.y + placeBox!.height).toBeLessThan(navBox!.y - 8)
  await shot.page_('CollectionsScrollEnd')
})

test('mobile collection detail', async ({ page, shot }) => {
  const seed = loadSeed()
  test.skip(!seed.collectionId, 'collections addon unavailable during seed')
  await page.goto(`/collections/${seed.collectionId}`)
  await clearNotices(page)
  await expect(page.getByRole('heading', { name: 'Kyoto & Nara shortlist' })).toBeVisible()
  await expect(page.getByText('Kiyomizu-dera', { exact: true })).toBeVisible()
  expect(await page.locator('body').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await shot.page_('CollectionDetail')
  const scrollRegion = page.locator('.app-route-scroll')
  await scrollRegion.evaluate(element => { element.scrollTop = element.scrollHeight })
  const lastPlace = page.locator('.col-lrow').last()
  await expect(lastPlace).toBeVisible()
  const [placeBox, navBox] = await Promise.all([
    lastPlace.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(placeBox!.y + placeBox!.height).toBeLessThan(navBox!.y - 8)
  await shot.page_('CollectionDetailScrollEnd')
})

test('mobile public Journey delayed loading', async ({ page, shot }) => {
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

test('mobile journey', async ({ page, shot }) => {
  await page.goto('/journey')
  await expect(page.getByRole('heading', { name: 'Across Japan, Slowly' })).toBeVisible()
  await shot.page_('Journey')
})

test('mobile journey detail map and timeline', async ({ page, shot }) => {
  const { journeyId, tripId } = loadSeed()
  const entriesResponse = await page.request.get(`/api/journeys/${journeyId}/entries`)
  expect(entriesResponse.ok()).toBeTruthy()
  const entries = (await entriesResponse.json()).entries as Array<{ id: number }>
  expect(entries.length).toBeGreaterThan(0)
  const providerRowsResponse = await page.request.get(`/api/journal-entry-rows/${entries[0].id}`)
  expect(providerRowsResponse.status()).toBe(200)
  expect(Array.isArray((await providerRowsResponse.json()).providers)).toBe(true)
  await page.route(`**/api/journeys/${journeyId}/tracks`, route => route.fulfill({
    json: { tracks: [{ place_id: 901, trip_id: tripId, name: 'Sample GPX trail', color: '#ef4444', points: [[35.68, 139.76], [35.05, 137.2], [34.7, 135.5], [34.4, 132.45]] }] },
  }))
  await page.goto(`/journey/${journeyId}`)
  await expect(page.getByText('First morning in Asakusa')).toBeVisible()
  await expect(page.locator('.maplibregl-map, .leaflet-container').first()).toBeVisible()
  const card = page.locator('[data-idx="0"]')
  const attribution = page.locator('.maplibregl-ctrl-attrib, .leaflet-control-attribution').first()
  const assertMobileJourneyClearance = async () => {
    const [cardBox, navBox, attributionBox, addBox] = await Promise.all([
      card.boundingBox(),
      page.locator('nav.md\\:hidden').boundingBox(),
      attribution.boundingBox(),
      page.getByRole('button', { name: 'Add entry' }).boundingBox(),
    ])
    expect(cardBox!.y + cardBox!.height).toBeLessThan(navBox!.y - 8)
    expect(attributionBox!.y + attributionBox!.height).toBeLessThan(navBox!.y - 8)
    expect(addBox!.y + addBox!.height).toBeLessThan(cardBox!.y - 8)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const overlaps = cardBox!.x < attributionBox!.x + attributionBox!.width &&
      cardBox!.x + cardBox!.width > attributionBox!.x &&
      cardBox!.y < attributionBox!.y + attributionBox!.height &&
      cardBox!.y + cardBox!.height > attributionBox!.y
    expect(overlaps, JSON.stringify({ cardBox, attributionBox, navBox })).toBe(false)
  }
  await assertMobileJourneyClearance()
  await shot.page_('JourneyDetail')
  await page.setViewportSize({ width: 375, height: 667 })
  await page.waitForTimeout(250)
  await assertMobileJourneyClearance()
  await shot.page_('JourneyDetailShortViewport')
})

test('mobile settings', async ({ page, shot }) => {
  await page.goto('/settings')
  await expect(page.getByText(/settings|general|appearance|account/i).first()).toBeVisible()
  await shot.page_('Settings')
  const scrollRegion = page.locator('.app-route-scroll')
  await scrollRegion.evaluate(element => { element.scrollTop = element.scrollHeight })
  const lastControl = page.locator('.app-route-scroll button').last()
  const [controlBox, navBox] = await Promise.all([
    lastControl.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(controlBox!.y + controlBox!.height).toBeLessThan(navBox!.y - 8)
  await shot.page_('SettingsScrollEnd')
})

test('mobile help navigation search and article', async ({ page, shot }) => {
  await page.goto('/help')
  await expect(page.locator('article')).toBeVisible()
  await page.getByRole('button', { name: 'Contents' }).click()

  const close = page.getByRole('button', { name: 'Close' })
  const closeBox = await close.boundingBox()
  expect(closeBox!.width).toBeGreaterThanOrEqual(44)
  expect(closeBox!.height).toBeGreaterThanOrEqual(44)

  const drawer = page.locator('#help-navigation-drawer')
  const search = drawer.getByRole('textbox', { name: /search docs/i })
  await search.fill('no-help-page-matches-this')
  await expect(drawer.getByText('No matching pages.')).toBeVisible()
  await shot.page_('HelpSearchNoResultsMobile')

  await search.fill('Quick Start')
  await drawer.getByRole('link', { name: 'Quick Start', exact: true }).click()
  await expect(page).toHaveURL(/\/help\/Quick-Start$/)
  await expect(page.locator('article').getByRole('heading', { name: 'Quick Start', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Contents' })).toHaveAttribute('aria-expanded', 'false')
  await shot.page_('HelpQuickStartMobile')

  const finalArticleBlock = page.locator('article > :last-child')
  await finalArticleBlock.scrollIntoViewIfNeeded()
  const [finalBlockBox, navBox] = await Promise.all([
    finalArticleBlock.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(finalBlockBox!.y + finalBlockBox!.height).toBeLessThan(navBox!.y - 8)
  await shot.page_('HelpQuickStartScrollEndMobile')
})

test('mobile settings and admin navigation touch targets', async ({ page, shot }) => {
  for (const { path, capture, nextTab } of [
    { path: '/settings', capture: 'SettingsNavDrawerMobile', nextTab: 'Appearance' },
    { path: '/admin', capture: 'AdminNavDrawerMobile', nextTab: 'User Defaults' },
  ]) {
    await page.goto(path)
    await clearNotices(page)
    const opener = page.getByRole('button', { name: 'Open navigation' })
    const openerBox = await opener.boundingBox()
    expect(openerBox!.width).toBeGreaterThanOrEqual(44)
    expect(openerBox!.height).toBeGreaterThanOrEqual(44)
    await opener.click()

    const drawer = page.locator('aside').filter({ has: page.getByRole('button', { name: 'Close navigation' }) })
    await expect(drawer).toBeVisible()
    const drawerLayer = Number(await drawer.evaluate(element => getComputedStyle(element).zIndex))
    const bottomNavLayer = Number(await page.locator('nav.md\\:hidden').evaluate(element => getComputedStyle(element).zIndex))
    expect(drawerLayer).toBeGreaterThan(bottomNavLayer)
    const closeBox = await drawer.getByRole('button', { name: 'Close navigation' }).boundingBox()
    expect(closeBox!.width).toBeGreaterThanOrEqual(44)
    expect(closeBox!.height).toBeGreaterThanOrEqual(44)
    const rowHeights = await drawer.locator('nav button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height))
    expect(rowHeights.length).toBeGreaterThan(0)
    expect(rowHeights.every(height => height >= 44)).toBe(true)
    await shot.page_(capture)
    await drawer.getByRole('button', { name: nextTab, exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveCount(0)
  }
})

test('mobile timeline', async ({ page, shot }) => {
  await page.goto('/timeline')
  await expect(page.getByRole('heading', { name: 'Travel timeline' })).toBeVisible()
  await shot.page_('Timeline')
})

test('mobile public journey', async ({ page, shot }) => {
  const token = await page.evaluate(async (journeyId) => {
    const response = await fetch(`/api/journeys/${journeyId}/share-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_timeline: true, share_gallery: false, share_map: false }),
    })
    if (!response.ok) throw new Error(`Journey share link failed: ${response.status}`)
    return (await response.json()).token as string
  }, loadSeed().journeyId)
  await page.goto(`/public/journey/${token}`)
  await expect(page.getByText('Across Japan, Slowly')).toBeVisible()
  expect(await page.locator('body').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await shot.page_('JourneyPublic')
})

test('mobile public journey shared map', async ({ page, shot }) => {
  const mapErrors: string[] = []
  page.on('pageerror', error => {
    if (/Cannot read properties of (?:undefined \(reading 'x'\)|null \(reading 'updateTransitions'\))/.test(error.message)) {
      mapErrors.push(error.stack || error.message)
    }
  })
  const token = await page.evaluate(async (journeyId) => {
    const response = await fetch(`/api/journeys/${journeyId}/share-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_timeline: true, share_gallery: false, share_map: true }),
    })
    if (!response.ok) throw new Error(`Journey share link failed: ${response.status}`)
    return (await response.json()).token as string
  }, loadSeed().journeyId)
  await page.goto(`/public/journey/${token}`)
  await expect(page.getByText('Across Japan, Slowly')).toBeVisible()
  await expect(page.locator('.maplibregl-map, .leaflet-container').first()).toBeVisible()
  const attribution = page.locator('.maplibregl-ctrl-attrib, .leaflet-control-attribution').first()
  await expect(attribution).toBeVisible()
  const [cardBox, attributionBox] = await Promise.all([
    page.locator('[data-idx="0"]').boundingBox(),
    attribution.boundingBox(),
  ])
  const viewport = page.viewportSize()!
  expect(attributionBox!.x).toBeGreaterThanOrEqual(0)
  expect(attributionBox!.x + attributionBox!.width).toBeLessThanOrEqual(viewport.width)
  expect(attributionBox!.y + attributionBox!.height).toBeLessThanOrEqual(viewport.height)
  const overlaps = cardBox!.x < attributionBox!.x + attributionBox!.width &&
    cardBox!.x + cardBox!.width > attributionBox!.x &&
    cardBox!.y < attributionBox!.y + attributionBox!.height &&
    cardBox!.y + cardBox!.height > attributionBox!.y
  expect(overlaps, JSON.stringify({ cardBox, attributionBox })).toBe(false)
  await shot.page_('JourneyPublicMap')
  await page.setViewportSize({ width: 375, height: 667 })
  await page.waitForTimeout(250)
  await expect(attribution).toBeVisible()
  const [shortCardBox, shortAttributionBox] = await Promise.all([
    page.locator('[data-idx="0"]').boundingBox(),
    attribution.boundingBox(),
  ])
  const shortViewport = page.viewportSize()!
  expect(shortAttributionBox!.x).toBeGreaterThanOrEqual(0)
  expect(shortAttributionBox!.x + shortAttributionBox!.width).toBeLessThanOrEqual(shortViewport.width)
  expect(shortAttributionBox!.y + shortAttributionBox!.height).toBeLessThanOrEqual(shortViewport.height)
  const shortOverlap = shortCardBox!.x < shortAttributionBox!.x + shortAttributionBox!.width &&
    shortCardBox!.x + shortCardBox!.width > shortAttributionBox!.x &&
    shortCardBox!.y < shortAttributionBox!.y + shortAttributionBox!.height &&
    shortCardBox!.y + shortCardBox!.height > shortAttributionBox!.y
  expect(shortOverlap, JSON.stringify({ shortCardBox, shortAttributionBox })).toBe(false)
  const shortTooltip = page.locator('.trek-journey-popup').first()
  await expect(shortTooltip).toBeVisible()
  expect(mapErrors, mapErrors.join('\n')).toEqual([])
  const shortTooltipBox = await shortTooltip.boundingBox()
  expect(shortTooltipBox!.x).toBeGreaterThanOrEqual(0)
  expect(shortTooltipBox!.x + shortTooltipBox!.width).toBeLessThanOrEqual(shortViewport.width)
  await shot.page_('JourneyPublicMapShortViewport')
})

test('mobile shared trip', async ({ page, shot }) => {
  const token = await page.evaluate(async (tripId) => {
    const response = await fetch(`/api/trips/${tripId}/share-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_map: false, share_bookings: true }),
    })
    if (!response.ok) throw new Error(`Trip share link failed: ${response.status}`)
    return (await response.json()).token as string
  }, loadSeed().tripId)
  await page.goto(`/shared/${token}`)
  await expect(page.getByRole('heading', { name: 'Autumn in Japan' })).toBeVisible()
  const bodyWidth = await page.locator('body').evaluate(element => element.scrollWidth)
  expect(bodyWidth, `Shared trip document is ${bodyWidth}px wide`).toBeLessThanOrEqual(page.viewportSize()!.width)
  await shot.page_('SharedTrip')
})

test('mobile installed page plugin', async ({ page, shot }) => {
  const plugin = await mockPagePlugin(page)
  await page.goto(`/plugins/${plugin.id}`)
  const frame = page.locator(`iframe[title="${plugin.name}"]`)
  await expect(frame).toBeVisible()
  await expect(page.frameLocator(`iframe[title="${plugin.name}"]`).getByRole('heading', { name: 'Sample plugin workspace' })).toBeVisible()
  await shot.page_('PluginPageMobile')
  const moreButton = page.getByRole('button', { name: 'More destinations' })
  await expect(moreButton).toBeVisible()
  await moreButton.click()
  const moreDestinations = page.getByRole('group', { name: 'More destinations' })
  await expect(moreDestinations.getByRole('button', { name: plugin.name })).toBeVisible()
  await shot.page_('PluginPageMobileMoreOpen')
  await page.keyboard.press('Escape')
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false')
  const [frameBox, navBox] = await Promise.all([
    frame.boundingBox(),
    page.locator('nav.md\\:hidden').boundingBox(),
  ])
  expect(frameBox!.y + frameBox!.height).toBeLessThan(navBox!.y - 8)
})

test('mobile trip invite preview', async ({ page, shot }) => {
  const token = await page.evaluate(async (tripId) => {
    const response = await fetch(`/api/trips/${tripId}/invite-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!response.ok) throw new Error(`Trip invite link failed: ${response.status}`)
    return (await response.json()).token as string
  }, loadSeed().tripId)
  await page.goto(`/join/${token}`)
  await expect(page.getByRole('heading', { name: 'Join this trip' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join trip' })).toBeEnabled()
  expect(await page.locator('body').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await shot.page_('JoinTripPreview')
})

test('mobile collections dark map tone', async ({ page, shot }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.goto('/collections')
  await page.getByRole('button', { name: 'Map', exact: true }).click()
  const mapCanvas = page.locator('.maplibregl-canvas')
  await expect(mapCanvas).toBeVisible()
  await expect(page.locator('[data-basemap-tone="light"]')).toBeVisible()
  await expect(mapCanvas).toHaveCSS('filter', 'brightness(0.5) contrast(1.1)')
  const attributionBox = await page.locator('.maplibregl-ctrl-attrib').boundingBox()
  const compassBox = await page.getByRole('button', { name: 'Reset map north' }).boundingBox()
  const locationBox = await page.getByRole('button', { name: 'Show my location' }).boundingBox()
  expect(compassBox!.y).toBeGreaterThanOrEqual(attributionBox!.y + attributionBox!.height + 4)
  expect(locationBox!.y).toBeGreaterThanOrEqual(attributionBox!.y + attributionBox!.height + 4)
  await shot.page_('CollectionsDarkMapMobile')

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Map', exact: true }).first().click()
  const previewCanvas = page.locator('.maplibregl-canvas')
  await expect(previewCanvas).toBeVisible()
  await expect(page.locator('[data-basemap-tone="light"]')).toBeVisible()
  await expect(previewCanvas).toHaveCSS('filter', 'brightness(0.5) contrast(1.1)')
  const previewBox = await page.locator('.map-settings-preview').boundingBox()
  const previewAttributionBox = await page.locator('.map-settings-preview .maplibregl-ctrl-attrib').boundingBox()
  expect(previewBox!.y + previewBox!.height - (previewAttributionBox!.y + previewAttributionBox!.height)).toBeLessThanOrEqual(24)
  await shot.page_('SettingsMapPreview-DarkMobile')
})
