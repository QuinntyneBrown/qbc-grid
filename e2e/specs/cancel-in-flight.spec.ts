import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/**
 * L2-007: a host change cancels an interaction in flight.
 *
 * Every one of these acts while the pointer is still down. Pointer capture routes the
 * pointer to the tile until the gesture ends, so no control on the page can be reached
 * with it, and each is driven from the keyboard instead — a path an operator genuinely
 * has rather than a contrivance for the suite.
 */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('L2-007 a host change cancels an interaction in flight', () => {
  test('reverts a drag when the mode changes away from edit', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await expect(dashboard.shadow).toBeAttached();
    await dashboard.activateControlFromKeyboard('[data-qbc-mode-toggle]');

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    await expect(dashboard.overlay).toHaveCount(0);
    expect(await dashboard.emissions()).toBe(emissions);
    await dashboard.releasePointer();
  });

  test('reverts a resize when the mode changes, holding no pointer capture', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'at-column-9', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('edge');

    await dashboard.pressHandle('edge');
    await dashboard.movePointerBy(0, 2 * (await dashboard.rowPitch()));
    await expect(dashboard.shadow).toBeAttached();
    await dashboard.activateControlFromKeyboard('[data-qbc-mode-toggle]');

    expect(await dashboard.geometryOf('edge')).toEqual(before);
    expect(await dashboard.tileHoldsPointerCapture('edge')).toBe(false);
    await dashboard.releasePointer();
  });

  test('reverts a drag when the host supplies a different layout', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await expect(dashboard.shadow).toBeAttached();
    // Locking bravo hands the grid a new layout while the pointer is still down.
    await dashboard.activateControlFromKeyboard('[data-qbc-tile="bravo"] [data-qbc-lock-toggle]');

    await expect(dashboard.shadow).toHaveCount(0);
    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
    await dashboard.releasePointer();
  });

  test('reverts a drag when the tile under the pointer is locked', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await dashboard.activateControlFromKeyboard('[data-qbc-tile="alpha"] [data-qbc-lock-toggle]');

    await expect(dashboard.shadow).toHaveCount(0);
    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
    await dashboard.releasePointer();
  });

  test('leaves the host state it was handed in place after cancelling', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await dashboard.activateControlFromKeyboard('[data-qbc-tile="bravo"] [data-qbc-lock-toggle]');
    await dashboard.releasePointer();

    // The update that cancelled the gesture is the one that survives it.
    await expect(dashboard.tile('bravo')).toHaveAttribute('data-locked', '');
  });
});
