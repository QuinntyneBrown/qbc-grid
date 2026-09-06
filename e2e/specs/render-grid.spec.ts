import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/** L2-001 through L2-004: the cell model, and the pixels derived from it. */

test.describe('L2-001 column geometry derives from the container', () => {
  test('divides the container into equal columns', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1528, height: 1000 });

    await dashboard.open({ fixture: 'three', columns: 12, gap: 8 });

    const metrics = await dashboard.metrics();
    expect(metrics.columns).toBe(12);
    expect(metrics.columnWidth).toBeCloseTo(120, 1);
  });

  test('leaves the last column flush with the container edge', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1528, height: 1000 });
    await dashboard.open({ fixture: 'at-column-9', columns: 12, gap: 8 });

    const box = await dashboard.boxOf('edge');
    const width = await dashboard.hostWidth();

    expect(box.left + box.width).toBeCloseTo(width, 0);
  });

  test('repositions to a new column width without changing stored geometry', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1528, height: 1000 });
    await dashboard.open({ fixture: 'three', columns: 12, gap: 8 });
    const before = await dashboard.geometryOf('bravo');

    await page.setViewportSize({ width: 1200, height: 1000 });
    await expect
      .poll(async () => (await dashboard.metrics()).columnWidth)
      .toBeCloseTo((1200 - 8 * 11) / 12, 1);

    expect(await dashboard.geometryOf('bravo')).toEqual(before);
  });
});

test.describe('L2-002 tiles are positioned by cell coordinates', () => {
  test('derives a tile box from its cell geometry', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1528, height: 1000 });

    await dashboard.open({ fixture: 'three', columns: 12, rowHeight: 60, gap: 8 });

    // charlie sits at row 2 and spans 2 rows: 2 * 60 + 1 * 8 = 128 tall, 2 * (60 + 8) = 136 down.
    const box = await dashboard.boxOf('charlie');
    expect(box.height).toBeCloseTo(128, 0);
    expect(box.top).toBeCloseTo(136, 0);
  });

  test('separates neighbouring tiles by exactly the gap', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1528, height: 1000 });
    await dashboard.open({ fixture: 'three', columns: 12, gap: 8 });

    const alpha = await dashboard.boxOf('alpha');
    const bravo = await dashboard.boxOf('bravo');

    expect(bravo.left - (alpha.left + alpha.width)).toBeCloseTo(8, 0);
  });

  test('lets a full-width tile span the container', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1528, height: 1000 });
    await dashboard.open({ fixture: 'locked-row', columns: 12, gap: 8 });

    const box = await dashboard.boxOf('barrier');
    expect(box.width).toBeCloseTo(await dashboard.hostWidth(), 0);
  });
});

test.describe('L2-003 the grid grows downward to fit its content', () => {
  test('sizes the host to the lowest occupied row', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12, rowHeight: 60, gap: 8 });

    // The lowest tile ends at row 4: 4 * 60 + 3 * 8 = 264.
    expect(await dashboard.hostHeight()).toBeCloseTo(264, 0);
  });

  test('renders tiles in row-major order whatever order they were supplied in', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });

    expect(await dashboard.renderedOrder()).toEqual(['alpha', 'bravo', 'charlie']);
  });
});

test.describe('L2-004 grid configuration is coerced to a usable range', () => {
  test('renders one column when none was asked for', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 0 });

    expect((await dashboard.metrics()).columns).toBe(1);
  });

  test('floors a fractional column count', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 7.6 });

    expect((await dashboard.metrics()).columns).toBe(7);
  });

  test('raises a negative gap and replaces a non-finite row height', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', gap: -4, rowHeight: Number.NaN });

    const metrics = await dashboard.metrics();
    expect(metrics.gap).toBe(0);
    expect(metrics.rowHeight).toBe(60);
  });

  test('falls back to the documented defaults for non-finite configuration', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({
      fixture: 'three',
      columns: Number.NaN,
      gap: Number.POSITIVE_INFINITY,
    });

    const metrics = await dashboard.metrics();
    expect(metrics.columns).toBe(12);
    expect(metrics.gap).toBe(8);
  });

  test('keeps columns positive when the gap leaves nothing to divide', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await page.setViewportSize({ width: 1024, height: 900 });

    await dashboard.open({ fixture: 'at-column-9', columns: 12, gap: 100 });

    const metrics = await dashboard.metrics();
    expect(metrics.columnWidth).toBeGreaterThan(0);

    const box = await dashboard.boxOf('edge');
    expect(box.left + box.width).toBeLessThanOrEqual((await dashboard.hostWidth()) + 1);
  });
});
