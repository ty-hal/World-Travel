import { clearNotices, expect, loadSeed, test } from './shot';

export function registerBeliCaptures() {
  test('Beli private connection states', async ({ page, shot }) => {
    let state = 'connected';
    await page.route('**/api/integrations/beli', (route) =>
      route.fulfill({
        json: {
          connected: state === 'connected' || state === 'reconnect',
          state,
          syncedAt: ['disconnected', 'error'].includes(state) ? null : '2026-01-01T12:00:00Z',
          ratedCount: ['disconnected', 'error'].includes(state) ? 0 : 40,
          predictionCount: ['disconnected', 'error'].includes(state) ? 0 : 500,
        },
      })
    );
    await page.goto('/settings?tab=integrations');
    await expect(page.getByRole('heading', { name: 'Beli', exact: true })).toBeVisible();
    await clearNotices(page);
    await shot.page_('BeliConnected');
    if ((page.viewportSize()?.width ?? 1440) >= 768) {
      await page.getByRole('button', { name: 'Dark Mode', exact: true }).click();
      await shot.page_('BeliConnectedDark');
      await page.getByRole('button', { name: 'Light Mode', exact: true }).click();
    }
    state = 'reconnect';
    await page.reload();
    await expect(page.getByText('Reconnect', { exact: true })).toBeVisible();
    await shot.page_('BeliReconnect');
    state = 'disconnected';
    await page.reload();
    await expect(page.getByLabel('Beli password')).toBeVisible();
    await shot.page_('BeliDisconnected');
    await page.route('**/api/integrations/beli/connect', route => {
      state = 'error';
      return route.fulfill({ status: 400, json: { error: 'Beli rejected this sign-in. Try again later.' } });
    });
    await page.getByLabel('Beli email or phone').fill('synthetic@example.test');
    await page.getByLabel('Beli password').fill('synthetic-test-only');
    await page.getByRole('button', { name: 'Connect Beli', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Beli rejected this sign-in.');
    await expect(page.getByLabel('Beli password')).toHaveValue('');
    await shot.page_('BeliSignInRejected');
  });

  test('Beli private food suggestions', async ({ page, shot }) => {
    let empty = false;
    await page.route('**/api/integrations/beli/recommendations', (route) =>
      route.fulfill({
        json: {
          origin: { name: 'Sample hotel', lat: 35.68, lng: 139.75 },
          syncedAt: '2026-01-01T12:00:00Z',
          discoveredAt: '2026-01-02T12:00:00Z',
          stale: true,
          total: empty ? 0 : 2,
          scored: empty ? 0 : 1,
          suggestions: empty
            ? []
            : [
                {
                  id: 90001,
                  name: 'Sample Italian Restaurant',
                  lat: 35.68,
                  lng: 139.75,
                  placeId: null,
                  cuisines: ['Italian'],
                  price: 3,
                  distanceKm: 0.42,
                  prediction: 8.6,
                  evidence: 'both',
                  reasons: ['6 RES ratings tagged Italian, averaging 8.9/10', 'Beli personalized prediction available'],
                  historyMatches: 6,
                  statusVerified: true,
                },
                {
                  id: 90002,
                  name: 'Sample Neighborhood Bakery',
                  lat: 35.68,
                  lng: 139.75,
                  placeId: null,
                  cuisines: ['Bakery'],
                  price: 1,
                  distanceKm: 0.65,
                  prediction: null,
                  evidence: 'history',
                  reasons: ['On your Beli want-to-try list'],
                  historyMatches: 0,
                  statusVerified: false,
                },
              ],
        },
      })
    );
    await page.goto(`/trips/${loadSeed().tripId}`);
    await clearNotices(page);
    const food = page.getByRole('button', { name: 'Food for you', exact: true });
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await page.getByRole('button', { name: 'Places', exact: true }).first().click();
    } else {
      await expect(page.getByRole('button', { name: /^(Expand|Collapse) places panel$/ })).toBeVisible();
      const expand = page.getByRole('button', { name: 'Expand places panel', exact: true });
      if (await expand.isVisible()) await expand.click();
    }
    await food.click();
    await page.getByRole('button', { name: 'Find food', exact: true }).click();
    await expect(page.getByText('Sample Neighborhood Bakery', { exact: true })).toBeVisible();
    await shot.page_('BeliFoodPartial');
    empty = true;
    await page.getByRole('button', { name: 'Find food', exact: true }).click();
    await expect(page.getByText('No unvisited places found in this area.', { exact: false })).toBeVisible();
    await shot.page_('BeliFoodEmpty');
  });
}
