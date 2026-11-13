import { test, expect } from './shot'

test.use({ storageState: undefined })

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const width = await page.locator('body').evaluate(element => element.scrollWidth)
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width)
}

test('mobile login', async ({ page, shot }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await shot.page_('Login')
})

test('mobile login announces loading and rejected credentials', async ({ page, shot }) => {
  let releaseRequest: () => void = () => {}
  let requested = false
  const heldRequest = new Promise<void>(resolve => { releaseRequest = resolve })
  await page.route('**/api/auth/login', async route => {
    requested = true
    await heldRequest
    await route.fulfill({ status: 401, json: { error: 'Invalid credentials' } })
  })

  await page.goto('/login')
  await page.getByLabel('Email').fill('traveler@example.com')
  await page.getByLabel('Password').fill('wrong-password')
  const submit = page.locator('form button[type="submit"]')
  const submission = submit.click()
  try {
    await expect.poll(() => requested).toBe(true)
    await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('status')).toHaveText('Signing in…')
    await expect(submit).toBeDisabled()
    await shot.page_('LoginSubmitting')
  } finally {
    releaseRequest()
  }
  await submission
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials')
  await shot.page_('LoginRejected')
})

test('mobile MFA failure keeps the code entry available', async ({ page, shot }) => {
  await page.route('**/api/auth/login', route =>
    route.fulfill({ status: 200, json: { mfa_required: true, mfa_token: 'visual-test-token' } }),
  )
  await page.route('**/api/auth/mfa/verify-login', route =>
    route.fulfill({ status: 401, json: { error: 'Invalid or expired verification code' } }),
  )

  await page.goto('/login')
  await page.getByLabel('Email').fill('traveler@example.com')
  await page.getByLabel('Password').fill('not-a-real-password')
  await page.getByRole('button', { name: /sign in/i }).click()
  const code = page.getByLabel(/verification code/i)
  await expect(code).toBeVisible()
  await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /sign in with sso/i })).toHaveCount(0)
  await code.fill('123456')
  await page.getByRole('button', { name: /verify/i }).click()

  await expect(page.getByRole('alert')).toHaveText('Invalid or expired verification code')
  await expect(code).toHaveValue('123456')
  await expect(page.getByRole('button', { name: /verify/i })).toBeEnabled()
  await expectNoHorizontalOverflow(page)
  await shot.page_('MfaRejected')
})

test('mobile forced password change failure keeps the required form available', async ({ page, shot }) => {
  await page.route('**/api/auth/login', route =>
    route.fulfill({
      status: 200,
      json: { user: { id: 1, username: 'traveler', email: 'traveler@example.com', role: 'user', must_change_password: true } },
    }),
  )
  await page.route('**/api/auth/me/password', route =>
    route.fulfill({ status: 503, json: { error: 'Password service temporarily unavailable' } }),
  )

  await page.goto('/login')
  await page.getByLabel('Email').fill('traveler@example.com')
  await page.getByLabel('Password').fill('temporary-password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.getByPlaceholder('New password', { exact: true }).fill('NewTravelerPassword123')
  await page.getByPlaceholder('Confirm new password').fill('NewTravelerPassword123')
  await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /sign in with sso/i })).toHaveCount(0)
  await page.getByRole('button', { name: /update password/i }).click()

  await expect(page.getByRole('alert')).toHaveText('Password service temporarily unavailable')
  await expect(page.getByPlaceholder('New password', { exact: true })).toHaveValue('NewTravelerPassword123')
  await expect(page.getByRole('button', { name: /update password/i })).toBeEnabled()
  await expectNoHorizontalOverflow(page)
  await shot.page_('PasswordChangeRejected')
})

test('mobile registration', async ({ page, shot }) => {
  await page.goto('/register')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible()
  await expect(page.getByPlaceholder('admin')).toBeVisible()
  await expect(page.getByLabel('Username')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await shot.page_('Registration')
})

test('mobile registration announces server errors', async ({ page, shot }) => {
  await page.route('**/api/auth/register', route =>
    route.fulfill({ status: 409, json: { error: 'Username already taken' } }),
  )
  await page.goto('/register')
  await page.getByLabel('Username').fill('taken-user')
  await page.getByLabel('Email').fill('traveler@example.com')
  await page.getByLabel('Password').fill('ValidPassword123')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page.getByRole('alert')).toHaveText('Username already taken')
  await shot.page_('RegistrationRejected')
})

test('mobile password recovery', async ({ page, shot }) => {
  await page.goto('/forgot-password')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await shot.page_('PasswordReset')
})

test('mobile password recovery announces delayed submission', async ({ page, shot }) => {
  let releaseRequest: () => void = () => {}
  let requested = false
  const heldRequest = new Promise<void>(resolve => { releaseRequest = resolve })
  await page.route('**/api/auth/forgot-password', async route => {
    requested = true
    await heldRequest
    await route.fulfill({ status: 200, json: { ok: true } })
  })

  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill('traveler@example.com')
  const submission = page.getByRole('button', { name: 'Send reset link' }).click()
  try {
    await expect.poll(() => requested).toBe(true)
    await expect(page.getByRole('status')).toHaveText('Sending reset link…')
    await expect(page.getByRole('button', { name: 'Sending reset link…' })).toBeDisabled()
    await shot.page_('PasswordResetSubmitting')
  } finally {
    releaseRequest()
  }
  await submission
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
})

test('mobile invalid password reset link', async ({ page, shot }) => {
  await page.goto('/reset-password')
  await expect(page.getByText('Invalid reset link')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await shot.page_('ResetPasswordInvalid')
})

test('mobile invalid OAuth request', async ({ page, shot }) => {
  await page.goto('/oauth/consent?client_id=invalid&redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fcallback&response_type=code&scope=profile&state=visual-check&code_challenge=invalid&code_challenge_method=S256')
  await expect(page.getByRole('heading', { name: 'Authorization Error' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await shot.page_('OAuthInvalidRequest')
})

test('mobile OIDC exchange failure returns to login', async ({ page, shot }) => {
  await page.addInitScript(() => sessionStorage.setItem('oidc_redirect', '/oauth/consent?client_id=stale-client'))
  await page.route('**/api/auth/oidc/exchange**', route =>
    route.fulfill({ status: 503, json: { error: 'Identity provider temporarily unavailable' } }),
  )
  await page.goto('/login?oidc_code=failed-code')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toHaveText('Identity provider temporarily unavailable')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  expect(await page.evaluate(() => sessionStorage.getItem('oidc_redirect'))).toBeNull()
  await shot.page_('OIDCExchangeRejected')
})
