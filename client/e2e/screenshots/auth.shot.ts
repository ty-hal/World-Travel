import { test, expect } from './shot'

/**
 * Unauthenticated surfaces. `storageState: undefined` drops the admin session
 * this project otherwise inherits, so these render as a logged-out visitor sees
 * them — which is the entire point of the login and registration pages.
 */
test.use({ storageState: undefined })

test('login page', async ({ page, shot }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await shot.page_('Login')
})

test('MFA verification failure keeps the code entry available', async ({ page, shot }) => {
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
  await shot.page_('MfaRejected')
})

test('forced password change failure keeps the required form available', async ({ page, shot }) => {
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
  await shot.page_('PasswordChangeRejected')
})

test('registration page', async ({ page, shot }) => {
  await page.goto('/register')
  await page.waitForTimeout(500)
  await shot.page_('Registration')
})

test('forgot password', async ({ page, shot }) => {
  await page.goto('/forgot-password')
  await page.waitForTimeout(500)
  await shot.page_('PasswordReset')
})

test('reset password invalid link', async ({ page, shot }) => {
  await page.goto('/reset-password')
  await expect(page.getByText('Invalid reset link')).toBeVisible()
  await shot.page_('ResetPasswordInvalid')
})

test('OAuth invalid request', async ({ page, shot }) => {
  await page.goto('/oauth/consent?client_id=invalid&redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fcallback&response_type=code&scope=profile&state=visual-check&code_challenge=invalid&code_challenge_method=S256')
  await expect(page.getByRole('heading', { name: 'Authorization Error' })).toBeVisible()
  await shot.page_('OAuthInvalidRequest')
})

test('OIDC code exchange failure returns to login', async ({ page, shot }) => {
  await page.addInitScript(() => sessionStorage.setItem('oidc_redirect', '/oauth/consent?client_id=stale-client'))
  await page.route('**/api/auth/oidc/exchange**', route =>
    route.fulfill({ status: 503, json: { error: 'Identity provider temporarily unavailable' } }),
  )
  await page.goto('/login?oidc_code=failed-code')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toHaveText('Identity provider temporarily unavailable')
  await expect(page.getByLabel('Email')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('oidc_redirect'))).toBeNull()
  await shot.page_('OIDCExchangeRejected')
})
