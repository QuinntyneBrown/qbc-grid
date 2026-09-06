import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/**
 * L2-009 through L2-014 and L2-019: the drag, what it shows, and every way it ends.
 *
 * The capture tests come first deliberately. A capture left held routes every later pointer
 * event to the tile that took it, so the dashboard looks identical and stops answering, and
 * the only criteria that notice are the ones that press a second tile afterwards.
 */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('pointer capture is released on every path', () => {
  test('lets a different tile be dragged after a committed drop', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.dragTileBy('alpha', 700, 0);
    await dashboard.pressTile('charlie');
    await dashboard.movePointerBy(0, 200);

    await expect(dashboard.shadow).toBeAttached();
    await dashboard.releasePointer();
  });

  test('lets the same tile be dragged again after an abandoned drag', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(60, 0);
    await page.keyboard.press('Escape');
    await dashboard.releasePointer();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(60, 0);
    await expect(dashboard.shadow).toBeAttached();
    await dashboard.releasePointer();
  });

  test('begins a drag when the threshold is crossed outside the tile', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    const box = await dashboard.tile('alpha').boundingBox();
    // A press one pixel inside the edge, and a move that is already outside the tile.
    await page.mouse.move(box!.x + box!.width - 1, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width + 40, box!.y + box!.height / 2, { steps: 6 });

    await expect(dashboard.shadow).toBeAttached();
    await dashboard.releasePointer();
  });

  test('starts no drag from a button other than the primary one', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    const box = await dashboard.tile('alpha').boundingBox();
    await page.mouse.move(box!.x + 10, box!.y + 10);
    await page.mouse.down({ button: 'right' });
    await dashboard.movePointerBy(80, 0);

    await expect(dashboard.shadow).toHaveCount(0);
    await page.mouse.up({ button: 'right' });
  });

  test('starts no drag when a press is released before the threshold', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(1, 1);
    await dashboard.releasePointer();
    await dashboard.movePointerBy(200, 200);

    await expect(dashboard.shadow).toHaveCount(0);
  });
});

test.describe('L2-009 a drag starts only after a movement threshold', () => {
  test('treats a press and release without movement as no drag at all', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.releasePointer();

    await expect(dashboard.overlay).toHaveCount(0);
    expect(await dashboard.emissions()).toBe(before);
  });

  test('leaves a button inside a tile clickable', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.tile('alpha').locator('[data-qbc-lock-toggle]').click();

    await expect(dashboard.tile('alpha')).toHaveAttribute('data-locked', '');
  });

  test('starts no drag from a press that lands on projected content', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    const button = await dashboard.tile('alpha').locator('[data-qbc-lock-toggle]').boundingBox();
    await page.mouse.move(button!.x + 2, button!.y + 2);
    await page.mouse.down();
    await dashboard.movePointerBy(120, 0);

    await expect(dashboard.shadow).toHaveCount(0);
    await dashboard.releasePointer();
  });

  test('lifts the tile once the pointer has travelled far enough', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(4, 0);

    await expect(dashboard.shadow).toBeAttached();
    await dashboard.releasePointer();
  });
});

test.describe('L2-011 a shadow marks the landing cell', () => {
  test('parks the shadow at the last column when dragged past the edge', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(4000, 0);

    // A three-column tile in a twelve-column grid stops at column 9.
    await expect.poll(async () => (await dashboard.shadowGeometry()).x).toBe(9);
    await dashboard.releasePointer();
  });

  test('parks the shadow at the first row when dragged above the grid', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('charlie');
    await dashboard.movePointerBy(0, -4000);

    await expect.poll(async () => (await dashboard.shadowGeometry()).y).toBe(0);
    await dashboard.releasePointer();
  });
});

test.describe('L2-012 an invalid landing cell is signalled and refused', () => {
  test('marks a shadow over an occupied region invalid, in colour and in border', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    // alpha spans columns 0-2 of row 0; bravo spans 3-5 of the same row.
    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(3 * (await dashboard.columnPitch()), 0);

    await expect.poll(async () => dashboard.shadowIsValid()).toBe(false);
    expect(await dashboard.shadowBorderStyle()).toBe('dashed');
    await dashboard.releasePointer();
  });

  test('returns the tile and emits nothing when an invalid shadow is released', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(3 * (await dashboard.columnPitch()), 0);
    await expect.poll(async () => dashboard.shadowIsValid()).toBe(false);
    await dashboard.releasePointer();

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
  });

  test('lands on free cells reached by crossing an occupied region', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(3 * (await dashboard.columnPitch()), 0);
    await expect.poll(async () => dashboard.shadowIsValid()).toBe(false);
    await dashboard.movePointerBy(3 * (await dashboard.columnPitch()), 0);
    await expect.poll(async () => dashboard.shadowIsValid()).toBe(true);
    await dashboard.releasePointer();

    await expect.poll(async () => (await dashboard.geometryOf('alpha')).x).toBe(6);
  });
});

test.describe('L2-013 a valid drop commits and emits the layout', () => {
  test('adopts the shadow geometry and clears the preview', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.dragTileByColumns('alpha', 6);

    await expect.poll(async () => (await dashboard.geometryOf('alpha')).x).toBe(6);
    await expect(dashboard.overlay).toHaveCount(0);
    await expect(dashboard.shadow).toHaveCount(0);
  });

  test('emits once, with only the dragged tile moved', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.emissions();

    await dashboard.dragTileByColumns('alpha', 6);

    await expect.poll(async () => dashboard.emissions()).toBe(before + 1);
    const emitted = (await dashboard.lastLayout()) as Record<string, number>[];
    expect(emitted).toHaveLength(3);
    expect(emitted.find((record) => record['id'] === 'bravo')).toMatchObject({ x: 3, y: 0 });
  });

  test('emits nothing for a drop on the cells it started from', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(8, 0);
    await dashboard.releasePointer();

    expect(await dashboard.emissions()).toBe(before);
  });
});

test.describe('L2-014 a drag can always be abandoned', () => {
  test('reverts on Escape, emitting nothing', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await page.keyboard.press('Escape');

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    await expect(dashboard.shadow).toHaveCount(0);
    await expect(dashboard.overlay).toHaveCount(0);
    expect(await dashboard.emissions()).toBe(emissions);
    await dashboard.releasePointer();
  });

  test('reverts when the browser cancels the pointer', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await dashboard.dispatchPointerEvent('alpha', 'pointercancel');

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    await expect(dashboard.shadow).toHaveCount(0);
    await dashboard.releasePointer();
  });

  test('reverts on unexpected loss of pointer capture', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await dashboard.dispatchPointerEvent('alpha', 'lostpointercapture');

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
    await dashboard.releasePointer();
  });

  test('leaves a committed drop alone when capture loss follows the release', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.dragTileByColumns('alpha', 6);
    await expect.poll(async () => (await dashboard.geometryOf('alpha')).x).toBe(6);
    const committed = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.dispatchPointerEvent('alpha', 'lostpointercapture');

    expect(await dashboard.geometryOf('alpha')).toEqual(committed);
    expect(await dashboard.emissions()).toBe(emissions);
  });

  test('reverts when the window loses focus', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('alpha');

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await page.evaluate(() => dispatchEvent(new Event('blur')));

    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    await expect(dashboard.shadow).toHaveCount(0);
    await dashboard.releasePointer();
  });
});

test.describe('L2-005 live mode is inert', () => {
  test('moves no tile and shows no shadow for a 200px drag', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    const before = await dashboard.geometryOf('alpha');
    const emissions = await dashboard.emissions();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(200, 0);

    await expect(dashboard.shadow).toHaveCount(0);
    await expect(dashboard.overlay).toHaveCount(0);
    await dashboard.releasePointer();
    expect(await dashboard.geometryOf('alpha')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
  });
});

test.describe('L2-008 a locked tile refuses the gesture', () => {
  test('does not move under a 200px drag', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'locked-row', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('barrier');

    await dashboard.pressTile('barrier');
    await dashboard.movePointerBy(200, 0);

    await expect(dashboard.shadow).toHaveCount(0);
    await dashboard.releasePointer();
    expect(await dashboard.geometryOf('barrier')).toEqual(before);
  });

  test('still occupies its cells, so a drag onto them is refused', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'locked-row', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('rover');
    await dashboard.movePointerBy(0, await dashboard.rowPitch());

    await expect.poll(async () => dashboard.shadowIsValid()).toBe(false);
    await dashboard.releasePointer();
  });
});

test.describe('L2-019 the overlay is shown only during an interaction', () => {
  test('is absent while the grid is idle in edit mode', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await expect(dashboard.overlay).toHaveCount(0);
  });

  test('appears for the duration of a drag and goes when it commits', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await expect(dashboard.overlay).toBeVisible();

    await dashboard.releasePointer();
    await expect(dashboard.overlay).toHaveCount(0);
  });

  test('goes when an interaction reverts instead', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);
    await expect(dashboard.overlay).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(dashboard.overlay).toHaveCount(0);
    await dashboard.releasePointer();
  });

  test('lets pointer events through to what sits beneath it', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'three', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('alpha');
    await dashboard.movePointerBy(6 * (await dashboard.columnPitch()), 0);

    const events = await dashboard.overlay.evaluate(
      (element) => getComputedStyle(element).pointerEvents,
    );
    expect(events).toBe('none');
    await dashboard.releasePointer();
  });
});
