import { test as setup } from '@playwright/test'
import { loginViaUi, E2E_MEMBER } from './helpers'

const stateFile = 'e2e/.tmp/member-state.json'

setup('authenticate seeded member mira', async ({ page }) => {
  await loginViaUi(page, E2E_MEMBER.email, E2E_MEMBER.password)
  await page.context().storageState({ path: stateFile })
})
