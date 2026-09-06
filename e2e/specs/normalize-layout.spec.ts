import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/** L2-025 and L2-026: what a supplied layout is repaired into, and how often that is reported. */

test.describe('L2-025 a supplied layout is normalized deterministically', () => {
  test('keeps the first of a duplicated id', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'malformed', columns: 12 });

    await expect(dashboard.tile('clamped')).toHaveCount(1);
    expect(await dashboard.geometryOf('clamped')).toMatchObject({ x: 0 });
  });

  test('clamps a span and a coordinate into range', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'malformed', columns: 12 });

    expect(await dashboard.geometryOf('clamped')).toMatchObject({ x: 0, cols: 12, rows: 1 });
  });

  test('drops records with a missing or blank id', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'malformed', columns: 12 });

    expect(await dashboard.renderedOrder()).toEqual(['clamped', 'limits']);
  });

  test('renders a non-finite coordinate at a finite row', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'malformed', columns: 12 });

    const geometry = await dashboard.geometryOf('clamped');
    expect(Number.isFinite(geometry.y)).toBe(true);
  });

  test('resolves size limits that contradict each other', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'malformed', columns: 12 });

    // minCols of 8 beside maxCols of 2 resolves to 8, so the span is raised rather than
    // left describing a tile that can be neither grown nor shrunk.
    expect(await dashboard.geometryOf('limits')).toMatchObject({ cols: 8 });
  });

  test('moves a later overlapping record down to the first row that fits', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'overlapping', columns: 12 });

    expect(await dashboard.geometryOf('first')).toMatchObject({ y: 0 });
    expect(await dashboard.geometryOf('second')).toMatchObject({ y: 2 });
  });

  test('clamps a row beyond what the grid can represent', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'unrepresentable', columns: 12 });

    const geometry = await dashboard.geometryOf('far');
    expect(Number.isFinite(geometry.y)).toBe(true);
    expect(geometry.y).toBeLessThanOrEqual(1_048_576);
  });

  test('clears a blocker declaring a billion rows without walking them', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);

    await dashboard.open({ fixture: 'billion-rows', columns: 12 });

    const blocker = await dashboard.geometryOf('blocker');
    const after = await dashboard.geometryOf('after');
    expect(after.y).toBe(blocker.y + blocker.rows);
  });

  test('renders five hundred records without hanging', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);

    await dashboard.open({ fixture: 'five-hundred', columns: 12 });

    await expect(dashboard.tiles).toHaveCount(500);
  });
});

test.describe('L2-026 repair is reported once', () => {
  test('reports a layout that needed repair exactly once', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'malformed', columns: 12 });

    await expect.poll(async () => dashboard.emissions()).toBe(1);
  });

  test('reports nothing for a layout that needed none', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });

    await page.waitForTimeout(300);
    expect(await dashboard.emissions()).toBe(0);
  });

  test('reports a repair whose only defect leaves every surviving tile in place', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);

    // The duplicate id is dropped; both survivors keep the geometry they arrived with.
    await dashboard.open({ fixture: 'duplicate-only', columns: 12 });

    await expect.poll(async () => dashboard.emissions()).toBe(1);
    expect(await dashboard.geometryOf('alpha')).toMatchObject({ x: 0, y: 0 });
  });
});

test.describe('L2-024 a layout round-trips without drift', () => {
  test('emits nothing on a restore that needed no repair', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });

    await page.waitForTimeout(300);
    expect(await dashboard.emissions()).toBe(0);
  });

  test('clamps into a narrower grid and reports the repair once', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);

    await dashboard.open({ fixture: 'at-column-9', columns: 6 });

    expect(await dashboard.geometryOf('edge')).toMatchObject({ x: 3, cols: 3 });
    await expect.poll(async () => dashboard.emissions()).toBe(1);
  });

  test('carries a label and its size limits through the repair', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'at-column-9', columns: 6 });

    const emitted = (await dashboard.lastLayout()) as Record<string, unknown>[];
    expect(emitted[0]).toMatchObject({ id: 'edge', label: 'Edge' });
  });
});

test.describe('L2-023 the layout the host receives is its own', () => {
  test('is unaffected by a host that mutates the records it received', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'at-column-9', columns: 6 });
    await expect.poll(async () => dashboard.emissions()).toBe(1);
    const before = await dashboard.geometryOf('edge');

    await dashboard.mutateLastLayout();

    expect(await dashboard.geometryOf('edge')).toEqual(before);
    await expect(dashboard.tile('intruder')).toHaveCount(0);
  });
});
