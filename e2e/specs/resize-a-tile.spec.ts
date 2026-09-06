import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/** L2-015 through L2-018: the handle, the span it proposes, and the limits it respects. */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('L2-015 the resize handle is reachable and unambiguous', () => {
  test('offers exactly one handle, at the bottom-right corner', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await expect(dashboard.handleOf('alpha')).toHaveCount(1);

    const tile = await dashboard.tile('alpha').boundingBox();
    const handle = await dashboard.handleOf('alpha').boundingBox();
    expect(handle!.x + handle!.width).toBeLessThanOrEqual(tile!.x + tile!.width + 1);
    expect(handle!.y + handle!.height).toBeLessThanOrEqual(tile!.y + tile!.height + 1);
  });

  test('resizes without moving the tile it belongs to', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    // A tile with rows free beneath it, so growing down is a resize and not a refusal.
    await dashboard.open({ fixture: 'at-column-9', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('edge');

    await dashboard.resizeTileBy('edge', 0, 2 * (await dashboard.rowPitch()));

    await expect.poll(async () => (await dashboard.geometryOf('edge')).rows).toBe(before.rows + 2);
    const after = await dashboard.geometryOf('edge');
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });

  test('starts a resize from anywhere in the target without a jump', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');

    // Press the inner edge of the target rather than its corner, and move by almost nothing.
    const handle = await dashboard.handleOf('alpha').boundingBox();
    await page.mouse.move(handle!.x + 2, handle!.y + 2);
    await page.mouse.down();
    await page.mouse.move(handle!.x + 6, handle!.y + 2, { steps: 3 });

    const shadow = await dashboard.shadowGeometry();
    expect(shadow).toMatchObject({ cols: before.cols, rows: before.rows });
    await dashboard.releasePointer();
  });
});

test.describe('L2-016 resizing snaps to whole cells with a shadow preview', () => {
  test('previews a whole-cell span while the pointer moves in pixels', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'empty', columns: 12 });
    await dashboard.addTile();
    await dashboard.enterEditMode();

    await dashboard.pressHandle('added-1');
    await dashboard.movePointerBy(2 * (await dashboard.columnPitch()), 0);

    await expect.poll(async () => (await dashboard.shadowGeometry()).cols).toBe(5);
    await dashboard.releasePointer();
  });

  test('does not change the span while the pointer stays inside one cell', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'empty', columns: 12 });
    await dashboard.addTile();
    await dashboard.enterEditMode();

    await dashboard.pressHandle('added-1');
    await dashboard.movePointerBy(6, 0);
    const first = await dashboard.shadowGeometry();
    await dashboard.movePointerBy(6, 0);

    expect(await dashboard.shadowGeometry()).toMatchObject({ cols: first.cols });
    await dashboard.releasePointer();
  });

  test('adopts the previewed span on release', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'empty', columns: 12 });
    await dashboard.addTile();
    await dashboard.enterEditMode();

    await dashboard.resizeTileBy('added-1', 2 * (await dashboard.columnPitch()), 0);

    await expect.poll(async () => (await dashboard.geometryOf('added-1')).cols).toBe(5);
    await expect(dashboard.shadow).toHaveCount(0);
  });
});

test.describe('L2-017 resizing respects declared size limits', () => {
  test('stops at the width left of a pinned origin', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    // The tile sits at column 9 of twelve, so it has three columns to grow into.
    await dashboard.open({ fixture: 'at-column-9', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressHandle('edge');
    await dashboard.movePointerBy(4000, 0);

    await expect.poll(async () => (await dashboard.shadowGeometry()).cols).toBe(3);
    expect((await dashboard.shadowGeometry()).x).toBe(9);
    await dashboard.releasePointer();
  });

  test('holds a span at a declared minimum', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressHandle('attitude');
    await dashboard.movePointerBy(-4000, 0);

    await expect.poll(async () => (await dashboard.shadowGeometry()).cols).toBe(2);
    await dashboard.releasePointer();
  });

  test('holds a span at a declared maximum', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressHandle('attitude');
    await dashboard.movePointerBy(0, 4000);

    await expect.poll(async () => (await dashboard.shadowGeometry()).rows).toBe(4);
    await dashboard.releasePointer();
  });

  test('keeps a shadow held at a limit valid rather than refusing it', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'at-column-9', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressHandle('edge');
    await dashboard.movePointerBy(4000, 0);

    await expect.poll(async () => dashboard.shadowIsValid()).toBe(true);
    await dashboard.releasePointer();
  });
});

test.describe('L2-018 a resize that would overlap is refused', () => {
  test('marks a span reaching over a neighbour invalid, in colour and in border', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    // alpha spans columns 0-2; bravo holds 3-5 of the same row.
    await dashboard.pressHandle('alpha');
    await dashboard.movePointerBy(2 * (await dashboard.columnPitch()), 0);

    await expect.poll(async () => dashboard.shadowIsValid()).toBe(false);
    expect(await dashboard.shadowBorderStyle()).toBe('dashed');
    await dashboard.releasePointer();
  });

  test('returns the tile to its span and emits nothing on release', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressHandle('alpha');
    await dashboard.movePointerBy(2 * (await dashboard.columnPitch()), 0);
    await expect.poll(async () => dashboard.shadowIsValid()).toBe(false);
    await dashboard.releasePointer();

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
  });

  test('returns the tile to its span on Escape', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'empty', columns: 12 });
    await dashboard.addTile();
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('added-1');
    const emissions = await dashboard.emissions();

    await dashboard.pressHandle('added-1');
    await dashboard.movePointerBy(2 * (await dashboard.columnPitch()), 0);
    await page.keyboard.press('Escape');

    expect(await dashboard.geometryOf('added-1')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
    await expect(dashboard.shadow).toHaveCount(0);
    await dashboard.releasePointer();
  });
});
