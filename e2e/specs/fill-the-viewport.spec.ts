import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/** L2-030: the range of container widths the grid is built for, and what a change costs. */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('L2-030 the grid is built for large desktop viewports', () => {
  test('renders the same column count across the supported range', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12, gap: 8 });

    for (const width of [1024, 1600, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(async () => (await dashboard.metrics()).columnWidth)
        .toBeCloseTo((width - 8 * 11) / 12, 1);

      const metrics = await dashboard.metrics();
      expect(metrics.columns).toBe(12);
      expect(await dashboard.hostWidth()).toBeCloseTo(width, 0);
    }
  });

  test('repositions without emitting a layout', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await dashboard.open({ fixture: 'three', columns: 12, gap: 8 });
    const emissions = await dashboard.emissions();
    const before = await dashboard.geometryOf('bravo');

    await page.setViewportSize({ width: 1200, height: 900 });
    await expect
      .poll(async () => (await dashboard.metrics()).columnWidth)
      .toBeCloseTo((1200 - 8 * 11) / 12, 1);

    expect(await dashboard.geometryOf('bravo')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
  });

  test('becomes denser below the supported range rather than reflowing', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 900, height: 900 });

    await dashboard.open({ fixture: 'three', columns: 12, gap: 8 });

    const metrics = await dashboard.metrics();
    expect(metrics.columns).toBe(12);
    expect(metrics.columnWidth).toBeCloseTo((900 - 8 * 11) / 12, 1);
  });

  test('re-measures a gesture in flight against the new column width', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await dashboard.open({ fixture: 'three', columns: 12, gap: 8 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    const pitchBefore = await dashboard.columnPitch();
    await dashboard.movePointerBy(6 * pitchBefore, 0);
    expect(await dashboard.shadowGeometry()).toMatchObject({ x: 6 });

    // Widen the container mid-gesture. No pointer event follows a resize, so the grid
    // repaints the preview itself against the new width rather than waiting for one.
    await page.setViewportSize({ width: 2560, height: 900 });
    await expect.poll(async () => dashboard.columnPitch()).toBeGreaterThan(pitchBefore);
    const pitchAfter = await dashboard.columnPitch();
    const settled = (await dashboard.shadowGeometry()).x;

    await dashboard.movePointerBy(pitchAfter, 0);

    // One column of the new width advances the shadow by exactly one column. Measured
    // against the width the gesture began with, this distance would have carried it past
    // one and a half.
    expect((await dashboard.shadowGeometry()).x).toBe(settled + 1);
    await dashboard.releasePointer();
  });
});
