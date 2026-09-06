import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

test.describe('the dashboard renders its layout', () => {
  test('presents a grid holding the tiles the store supplied', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);

    await dashboard.open({ fixture: 'three' });

    await expect(dashboard.tiles).toHaveCount(3);
    await expect(dashboard.tile('alpha')).toBeAttached();
    await expect(dashboard.tile('bravo')).toBeAttached();
    await expect(dashboard.tile('charlie')).toBeAttached();
  });

  test('projects the host template into every tile', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);

    await dashboard.open({ fixture: 'three' });

    await expect(dashboard.tile('alpha')).toContainText('Alpha');
  });

  test('opens in live mode', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);

    await dashboard.open({ fixture: 'three' });

    expect(await dashboard.mode()).toBe('live');
  });
});
