import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/**
 * L2-010: the dragged tile is lifted and follows the pointer.
 *
 * The lift and the shadow are different things on purpose. The tile tracks the pointer
 * continuously so the operator's hand and what moves under it agree; the shadow snaps to
 * cells so what a release would commit is legible before it happens.
 */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('L2-010 the dragged tile is lifted and follows the pointer', () => {
  test('translates by exactly the distance the pointer travelled', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const resting = await dashboard.boxOf('plain');

    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(37, 12);
    await expect(dashboard.shadow).toBeAttached();

    const lifted = await dashboard.boxOf('plain');
    expect(lifted.left - resting.left).toBeCloseTo(37, 0);
    expect(lifted.top - resting.top).toBeCloseTo(12, 0);
    await dashboard.releasePointer();
  });

  test('follows the pointer in pixels while the shadow snaps to cells', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const resting = await dashboard.boxOf('plain');

    // A third of a column: too little to snap the shadow, and visible on the tile.
    const third = Math.round((await dashboard.columnPitch()) / 3);
    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(third, 0);
    await expect(dashboard.shadow).toBeAttached();

    expect((await dashboard.boxOf('plain')).left - resting.left).toBeCloseTo(third, 0);
    expect(await dashboard.shadowGeometry()).toMatchObject({ x: 3 });
    await dashboard.releasePointer();
  });

  test('paints the dragged tile above the tiles it passes over', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(-2 * (await dashboard.columnPitch()), 0);
    await expect(dashboard.shadow).toBeAttached();

    expect(await dashboard.stackingLevelOf('plain')).toBeGreaterThan(
      await dashboard.stackingLevelOf('attitude'),
    );
    await dashboard.releasePointer();
  });

  test('raises only the dragged tile, and only while the drag runs', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const resting = await dashboard.elevationOf('plain');

    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(60, 0);
    await expect(dashboard.shadow).toBeAttached();

    expect(await dashboard.elevationOf('plain')).not.toBe(resting);
    expect(await dashboard.elevationOf('attitude')).toBe(resting);
    await dashboard.releasePointer();

    // The compositor promotion is taken once and released once, so nothing outlives the
    // gesture that asked for it.
    await expect.poll(async () => dashboard.elevationOf('plain')).toBe(resting);
    expect(await dashboard.promotedTileCount()).toBe(0);
  });

  test('leaves no offset behind after a drag that reverted', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const resting = await dashboard.boxOf('plain');

    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(-2 * (await dashboard.columnPitch()), 0);
    await expect.poll(async () => dashboard.shadowIsValid()).toBe(false);
    await dashboard.releasePointer();

    await expect.poll(async () => (await dashboard.boxOf('plain')).left).toBeCloseTo(
      resting.left,
      0,
    );
    expect(await dashboard.draggedTileHasOffset('plain')).toBe(false);
    expect(await dashboard.promotedTileCount()).toBe(0);
  });
});
