import { test as setup } from '@playwright/test'
import { dismissSystemNotices, loginViaUi, E2E_ADMIN } from './helpers'

const stateFile = 'e2e/.tmp/state.json'

setup('authenticate the seeded admin (incl. forced password change)', async ({ page }) => {
  await loginViaUi(page, E2E_ADMIN.email, E2E_ADMIN.seedPassword, {
    newPassword: E2E_ADMIN.password,
  })
  await dismissSystemNotices(page)
  await page.context().storageState({ path: stateFile })
})
