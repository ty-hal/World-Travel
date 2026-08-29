import { expect, type Page, type Locator } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { SeedResult } from './seed'

export const SEED_FILE = path.join(process.cwd(), 'e2e', '.tmp', 'seed.json')

/** E2E admin — seeded by server-launch.mjs; password rotated in auth.setup.ts. */
export const E2E_ADMIN = {
  email: 'e2e@trek.local',
  seedPassword: 'E2eTest12345!',
  password: 'E2eChanged12345!',
} as const

/** Seeded trip member (see e2e/seed.ts). */
export const E2E_MEMBER = {
  email: 'mira@example.com',
  password: 'DemoSeed12345!',
} as const

/**
 * Sign in through the login page UI (the two-panel Sign In screen).
 *
 * Playwright runs with VITE_E2E=1 so /login renders this form instead of the
 * dev auto-login redirect. On a fresh DB the seeded admin must change password
 * once — pass `newPassword` to complete that step.
 */
export async function loginViaUi(
  page: Page,
  email: string,
  password: string,
  opts?: { newPassword?: string },
): Promise<void> {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible({ timeout: 20_000 })
  await page.getByPlaceholder('your@email.com').fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  if (opts?.newPassword) {
    await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible({
      timeout: 20_000,
    })
    const pw = page.locator('input[type="password"]')
    await expect(pw).toHaveCount(2, { timeout: 10_000 })
    await pw.nth(0).fill(opts.newPassword)
    await pw.nth(1).fill(opts.newPassword)
    await page.getByRole('button', { name: /Update password/i }).click()
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  await expect(page.getByRole('img', { name: 'TREK' }).first()).toBeVisible({ timeout: 15_000 })
}

/** Demo trip ids written by seed.setup.ts — shared across all authenticated specs. */
export function readSeed(): SeedResult {
  return JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedResult
}

/**
 * Dismiss the release-notice modal (SystemNoticeHost), which greets a freshly seeded
 * user on first load and covers the dashboard — its backdrop swallows clicks aimed at
 * anything underneath, `.add-trip-card` included.
 */
export async function dismissSystemNotices(page: Page): Promise<void> {
  const next = page.getByRole('button', { name: /next/i })
  for (let i = 0; i < 6 && (await next.isVisible().catch(() => false)); i++) {
    if (!(await next.isEnabled().catch(() => false))) break
    await next.click().catch(() => {})
  }

  for (const label of ['Dismiss', 'OK']) {
    const btn = page.getByRole('button', { name: label, exact: true })
    for (let i = 0; i < 4 && (await btn.isVisible().catch(() => false)); i++) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(300)
    }
  }
}

/** Shared Modal panel — backdrop has no role="dialog". */
export function modalPanel(page: Page): Locator {
  return page.locator('.trek-modal-backdrop > div').first()
}

export function modalBackdrop(page: Page): Locator {
  return page.locator('.trek-modal-backdrop')
}

export async function gotoDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard')
  await dismissSystemNotices(page)
}

export async function gotoTrip(page: Page, tripId?: number): Promise<number> {
  const id = tripId ?? readSeed().tripId
  await page.goto(`/trips/${id}`)
  await dismissSystemNotices(page)
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 25_000 })
  return id
}

/** Trip planner tab labels as shown in the UI (en). */
export const PLANNER_TABS = [
  'Plan',
  'Transports',
  'Book',
  'Lists',
  'Costs',
  'Files',
  'Photos',
  'History',
  'Collab',
] as const

export type PlannerTab = (typeof PLANNER_TABS)[number]

export async function openPlannerTab(page: Page, label: PlannerTab | string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).first().click()
  await page.waitForTimeout(600)
}

export async function openUserMenu(page: Page): Promise<void> {
  await page.locator('nav').getByRole('button').filter({ hasText: /.+/ }).last().click()
  await page.waitForTimeout(200)
}

/** Navbar sun/moon toggle (desktop). */
export async function toggleNavbarTheme(page: Page): Promise<void> {
  const btn = page.locator('nav button[title*="mode" i], nav button[title*="Mode" i]').first()
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await btn.click()
  await waitForDarkMode(page, !wasDark)
}

export async function setThemeViaSettings(
  page: Page,
  mode: 'light' | 'dark' | 'auto',
): Promise<void> {
  await page.goto('/settings')
  await dismissSystemNotices(page)
  await page.getByRole('button', { name: 'Appearance', exact: true }).first().click()
  await page.waitForTimeout(400)
  const label = mode === 'auto' ? 'Auto' : mode === 'dark' ? 'Dark' : 'Light'
  await page.getByRole('button', { name: label, exact: true }).click()
  if (mode === 'dark') await waitForDarkMode(page, true)
  else if (mode === 'light') await waitForDarkMode(page, false)
}

/** Poll until `<html class="dark">` matches the expected state (settings load is async). */
export async function waitForDarkMode(page: Page, dark: boolean): Promise<void> {
  await expect.poll(
    async () => page.evaluate(() => document.documentElement.classList.contains('dark')),
    { timeout: 10_000 },
  ).toBe(dark)
}

export async function expectDarkMode(page: Page, dark: boolean): Promise<void> {
  await waitForDarkMode(page, dark)
}

export async function waitForMap(page: Page): Promise<void> {
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 25_000 })
}

/** Create a throwaway trip when a spec must not mutate the shared demo trip. */
export async function createTrip(page: Page, title?: string): Promise<{ title: string; tripId: number }> {
  await gotoDashboard(page)
  const name = title ?? `E2E Trip ${Date.now()}`
  await page.locator('.add-trip-card').click()
  const modal = modalBackdrop(page)
  await expect(modal).toBeVisible()
  await modal.getByPlaceholder('e.g. Summer in Japan').fill(name)
  await modal.getByRole('button', { name: 'Create New Trip' }).click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 })
  await page.getByText(name).first().click()
  await expect(page).toHaveURL(/\/trips\/\d+/)
  const tripId = Number(page.url().match(/\/trips\/(\d+)/)![1])
  await waitForMap(page)
  return { title: name, tripId }
}
