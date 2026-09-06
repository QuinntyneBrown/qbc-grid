import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/** L2-032: what the grid does with host content, and what a move leaves of it. */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('L2-032 tile content is projected, never interpolated as markup', () => {
  test('constructs a projected component once', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.widgetInstanceOf('attitude');

    await dashboard.focusTile('attitude');
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await dashboard.geometryOf('attitude')).y).toBe(1);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => (await dashboard.geometryOf('attitude')).rows).toBe(3);

    expect(await dashboard.widgetInstanceOf('attitude')).toBe(before);
  });

  test('renders markup in an id or a label as text, and runs none of it', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'hostile', columns: 12 });

    await expect(dashboard.tiles).toHaveCount(2);
    expect(await dashboard.scriptExecuted()).toBe(false);
    expect(await page.locator('[data-qbc-tile] img').count()).toBe(0);

    // The hostile string reaches the accessible name as the text it is.
    const names = await page
      .locator('[data-qbc-tile]')
      .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('aria-label')));
    expect(names.some((name) => name?.includes('<img'))).toBe(true);
  });

  test('preserves projected state across a committed move', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.typeInWidget('attitude', 'holding');
    await dashboard.scrollWidget('attitude', 120);
    const instance = await dashboard.widgetInstanceOf('attitude');

    await dashboard.dragTileByColumns('attitude', 6);
    await expect.poll(async () => (await dashboard.geometryOf('attitude')).x).toBe(6);

    expect(await dashboard.widgetInstanceOf('attitude')).toBe(instance);
    expect(await dashboard.widgetFieldValue('attitude')).toBe('holding');
    expect(await dashboard.widgetScrollTop('attitude')).toBeGreaterThan(0);
  });

  test('preserves a scroll position and a focused field across a reorder', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.scrollWidget('attitude', 120);
    const before = await dashboard.widgetScrollTop('attitude');
    expect(before).toBeGreaterThan(0);

    // Carrying attitude below plain changes its place in the row-major order.
    await dashboard.focusTile('attitude');
    await dashboard.holdArrow('ArrowDown', 4);
    await expect.poll(async () => (await dashboard.geometryOf('attitude')).y).toBe(4);
    expect(await dashboard.renderedOrder()).toEqual(['plain', 'attitude']);

    // A constructor counter reports success even when the browser has reset what it holds,
    // so the assertions read the browser's own state instead.
    expect(await dashboard.widgetScrollTop('attitude')).toBe(before);
    expect(await dashboard.focusedTileElement()).toBe('attitude');
  });
});
