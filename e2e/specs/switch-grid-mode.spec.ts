import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/**
 * L2-006 and L2-008: what edit mode offers, and what a locked tile withholds.
 *
 * The criteria that assert a gesture does nothing live with the gesture that could do
 * something, in `move-a-tile`. Asserted here they would pass against a grid with no
 * pointer handler at all, and book a green that nobody would revisit.
 */

test.describe('L2-006 edit mode presents interaction affordances', () => {
  test('offers a resize handle on every unlocked tile without moving any of them', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    const before = await dashboard.geometryOf('alpha');
    await expect(dashboard.handleOf('alpha')).toHaveCount(0);

    await dashboard.enterEditMode();

    await expect(dashboard.handleOf('alpha')).toHaveCount(1);
    await expect(dashboard.handleOf('bravo')).toHaveCount(1);
    expect(await dashboard.geometryOf('alpha')).toEqual(before);
  });

  test('gives the handle a target of at least 24 by 24 pixels', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();

    const box = await dashboard.handleOf('alpha').boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  });

  test('visits tiles in row-major order, not the order they were supplied in', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    // The fixture supplies charlie, bravo, alpha; row-major order is alpha, bravo, charlie.
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();

    expect(await dashboard.tabThroughTiles(3)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  test('draws a focus indicator on a tile reached from the keyboard', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();

    await page.locator('[data-qbc-mutate-layout]').focus();
    await page.keyboard.press('Tab');

    expect(await dashboard.focusedTileElement()).toBe('alpha');
    expect(await dashboard.focusRingVisible()).toBe(true);
  });

  test('draws no focus indicator on a tile pressed with the pointer', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();

    await dashboard.tile('alpha').click({ position: { x: 5, y: 5 } });

    expect(await dashboard.focusedTile()).toBe('alpha');
    expect(await dashboard.focusRingVisible()).toBe(false);
  });

  test('withdraws every affordance when edit mode is left', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();

    await dashboard.leaveEditMode();

    await expect(dashboard.handleOf('alpha')).toHaveCount(0);
    expect(await dashboard.tabIndexOf('alpha')).toBe('-1');
  });
});

test.describe('L2-008 a locked tile cannot be moved or resized', () => {
  test('offers a locked tile no handle and no place in the tab order', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'locked-row' });
    await dashboard.enterEditMode();

    await expect(dashboard.handleOf('barrier')).toHaveCount(0);
    expect(await dashboard.tabIndexOf('barrier')).toBe('-1');
    expect(await dashboard.tabIndexOf('rover')).toBe('0');
  });

  test('restores the affordances when a tile is unlocked in edit mode', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'locked-row' });
    await dashboard.enterEditMode();
    await expect(dashboard.handleOf('barrier')).toHaveCount(0);

    await dashboard.toggleLockOf('barrier');

    await expect(dashboard.handleOf('barrier')).toHaveCount(1);
    await expect(dashboard.tile('barrier')).not.toHaveAttribute('data-locked', '');
    expect(await dashboard.tabIndexOf('barrier')).toBe('0');
  });
});
