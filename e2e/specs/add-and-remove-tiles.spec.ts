import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/** L2-020, L2-021 and L2-022: what an add takes, what it is given, and what a removal leaves. */

test.describe('L2-020 a tile can be added at an explicit position', () => {
  test('adds a tile and emits the layout once', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    const before = await dashboard.emissions();

    await dashboard.addTile();

    await expect(dashboard.tiles).toHaveCount(4);
    expect(await dashboard.emissions()).toBe(before + 1);
  });

  test('leaves every other tile where it was', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    const before = await dashboard.geometryOf('alpha');

    await dashboard.addTile();

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
  });

  test('never overlaps a tile that is already placed', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });

    await dashboard.addTile();
    await dashboard.addTile();

    const boxes = await Promise.all(
      ['alpha', 'bravo', 'charlie', 'added-1', 'added-2'].map((id) => dashboard.geometryOf(id)),
    );
    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        const first = boxes[a]!;
        const second = boxes[b]!;
        const apart =
          first.x + first.cols <= second.x ||
          second.x + second.cols <= first.x ||
          first.y + first.rows <= second.y ||
          second.y + second.rows <= first.y;
        expect(apart).toBe(true);
      }
    }
  });
});

test.describe('L2-021 a tile added without a position is placed automatically', () => {
  test('places the first tile at the origin of an empty grid', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'empty' });

    await dashboard.addTile();

    expect(await dashboard.geometryOf('added-1')).toMatchObject({ x: 0, y: 0 });
  });

  test('fills the gap left in an occupied first row', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'first-row-through-5', columns: 12 });

    await dashboard.addTile();

    expect(await dashboard.geometryOf('added-1')).toMatchObject({ x: 6, y: 0 });
  });

  test('drops below the lowest occupied row when no row has space', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'locked-row', columns: 12 });

    await dashboard.addTile();

    // rover holds row 0 and barrier spans all twelve columns of row 1.
    expect(await dashboard.geometryOf('added-1')).toMatchObject({ x: 0, y: 2 });
  });

  test('clears a blocker of a billion rows without walking them', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'billion-rows', columns: 12 });

    await dashboard.addTile();

    const after = await dashboard.geometryOf('after');
    expect(await dashboard.geometryOf('added-1')).toMatchObject({ y: after.y + after.rows });
  });
});

test.describe('L2-022 a tile can be removed by id', () => {
  test('removes the tile and emits once, leaving the others alone', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    const before = await dashboard.geometryOf('charlie');
    const emissions = await dashboard.emissions();

    await dashboard.removeTile('bravo');

    await expect(dashboard.tiles).toHaveCount(2);
    expect(await dashboard.emissions()).toBe(emissions + 1);
    expect(await dashboard.geometryOf('charlie')).toEqual(before);
  });

  test('shrinks the host when the lowest row empties', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', rowHeight: 60, gap: 8 });
    expect(await dashboard.hostHeight()).toBeCloseTo(264, 0);

    await dashboard.removeTile('charlie');

    // The lowest remaining tile ends at row 2: 2 * 60 + 1 * 8 = 128.
    await expect.poll(async () => dashboard.hostHeight()).toBeCloseTo(128, 0);
  });

  test('moves focus to the next tile that can hold it', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();

    await dashboard.removeTileFromKeyboard('alpha');

    await expect.poll(async () => dashboard.focusedTileElement()).toBe('bravo');
  });

  test('falls back to the preceding tile when the last one is removed', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();

    await dashboard.removeTileFromKeyboard('charlie');

    await expect.poll(async () => dashboard.focusedTileElement()).toBe('bravo');
  });

  test('skips a locked neighbour, which could not hold focus', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'locked-row' });
    await dashboard.enterEditMode();

    // rover is followed by the locked barrier, so focus falls back to the grid host.
    await dashboard.removeTileFromKeyboard('rover');

    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.hasAttribute('data-qbc-grid')))
      .toBe(true);
  });

  test('leaves focus alone when the removal came from elsewhere', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three' });
    await dashboard.enterEditMode();
    await page.locator('[data-qbc-add-tile]').focus();

    await dashboard.removeTileWithoutFocusing('alpha');

    await expect(dashboard.tiles).toHaveCount(2);
    expect(
      await page.evaluate(() => document.activeElement?.hasAttribute('data-qbc-add-tile')),
    ).toBe(true);
  });
});
