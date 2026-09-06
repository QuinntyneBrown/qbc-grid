import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/**
 * L2-031: the work a gesture is allowed to do in a frame.
 *
 * The write counts and the timing are measured separately. A `MutationObserver` watching
 * every tile changes the thing a timing run is measuring, so the two never share a run.
 */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('L2-031 interaction stays within frame budget', () => {
  test('applies at most one style write per frame however many events arrive', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'sixty', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('tile-0');
    await dashboard.movePointerBy(40, 0);
    await dashboard.watchTileMutations();

    // Twenty events dispatched inside one animation frame.
    await dashboard.dispatchPointerMovesInOneFrame('tile-0', 20);

    const writes = await dashboard.tileMutationsPerFrame();
    expect(Math.max(...writes.map((frame) => frame.writes))).toBeLessThanOrEqual(1);
    await dashboard.releasePointer();
  });

  test('derives and tests the candidate once for those same events', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'sixty', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('tile-0');
    await dashboard.movePointerBy(40, 0);
    await dashboard.watchShadowMutations();

    await dashboard.dispatchPointerMovesInOneFrame('tile-0', 20);

    // The shadow is written from the derived candidate, so one write is one derivation.
    expect(await dashboard.shadowMutationCount()).toBeLessThanOrEqual(1);
    await dashboard.releasePointer();
  });

  test('touches no tile other than the one being dragged', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'sixty', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('tile-0');
    await dashboard.movePointerBy(40, 0);
    await dashboard.watchTileMutations();

    await dashboard.movePointerBy(200, 100);
    await dashboard.movePointerBy(120, 60);

    const touched = await dashboard.mutatedTileIds();
    expect(touched.filter((id) => id !== 'tile-0')).toEqual([]);
    await dashboard.releasePointer();
  });

  test('forces no layout measurement while the pointer moves', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'sixty', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('tile-0');
    await dashboard.movePointerBy(40, 0);
    await dashboard.watchLayoutReads();

    await dashboard.movePointerBy(200, 100);
    await dashboard.movePointerBy(120, 60);

    expect(await dashboard.layoutReadCount()).toBe(0);
    await dashboard.releasePointer();
  });

  test('commits the geometry the final pointer sample names', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    // A move and a release inside the same frame: the release resolves its own sample
    // rather than the one the scheduled write was still holding.
    await dashboard.pressTile('alpha');
    const pitch = await dashboard.columnPitch();
    await dashboard.movePointerBy(3 * pitch, 0);
    await dashboard.moveAndReleaseInOneFrame(3 * pitch, 0);

    await expect.poll(async () => (await dashboard.geometryOf('alpha')).x).toBe(6);
  });

  test('paints no preview from a frame outstanding when a gesture is cancelled', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(4 * (await dashboard.columnPitch()), 0);
    await dashboard.moveAndCancelInOneFrame(60, 0);

    await expect(dashboard.shadow).toHaveCount(0);
    await expect(dashboard.overlay).toHaveCount(0);
    expect(await dashboard.draggedTileHasOffset('alpha')).toBe(false);
    await dashboard.releasePointer();
  });
});

test.describe('L2-031 the frame budget on the reference runner', () => {
  test('holds per-frame main-thread work at or below 16ms over sixty tiles', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'sixty', columns: 12 });
    await dashboard.enterEditMode();

    const runs = await dashboard.measureDragFrames({ seconds: 2, runs: 3 });

    for (const run of runs) {
      expect(run.samples).toBeGreaterThan(30);
      expect(run.p95).toBeLessThanOrEqual(16);
    }
  });
});
