import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/** L2-027 through L2-029: what the keyboard reaches, and what an operator is told about it. */

test.describe('L2-027 arrow keys move a focused tile', () => {
  test('moves one cell and emits once', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    await dashboard.focusTile('plain');
    await page.keyboard.press('ArrowDown');

    await expect.poll(async () => (await dashboard.geometryOf('plain')).y).toBe(1);
    await expect.poll(async () => dashboard.emissions()).toBe(emissions + 1);
  });

  test('refuses a move that would leave the grid', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    await dashboard.focusTile('attitude');
    await page.keyboard.press('ArrowLeft');

    expect(await dashboard.geometryOf('attitude')).toMatchObject({ x: 0 });
    expect(await dashboard.emissions()).toBe(emissions);
  });

  test('refuses a move onto cells another tile holds', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    await dashboard.focusTile('attitude');
    await page.keyboard.press('ArrowRight');

    expect(await dashboard.geometryOf('attitude')).toMatchObject({ x: 0 });
    expect(await dashboard.emissions()).toBe(emissions);
  });

  test('keeps focus on the tile across a move that changes its place in the order', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    // attitude holds columns 0 to 2 and plain holds 3 to 5, so the rows below are clear.
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    // attitude sorts first; carrying it below plain makes it sort last.
    await dashboard.focusTile('attitude');
    for (let step = 0; step < 4; step += 1) await page.keyboard.press('ArrowDown');

    await expect.poll(async () => (await dashboard.geometryOf('attitude')).y).toBe(4);
    expect(await dashboard.renderedOrder()).toEqual(['plain', 'attitude']);
    expect(await dashboard.focusedTileElement()).toBe('attitude');
  });

  test('reveals the overlay for the run and hides it when the run settles', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.focusTile('plain');
    await page.keyboard.down('ArrowDown');
    await expect(dashboard.overlay).toBeVisible();

    await page.keyboard.up('ArrowDown');
    await expect(dashboard.overlay).toHaveCount(0);
  });

  test('reaches past an obstruction with Control and an arrow', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    // rover at the origin, with a locked full-width row directly beneath it.
    await dashboard.open({ fixture: 'locked-row', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    await dashboard.focusTile('rover');
    await page.keyboard.press('Control+ArrowDown');

    await expect.poll(async () => (await dashboard.geometryOf('rover')).y).toBe(2);
    expect(await dashboard.geometryOf('barrier')).toMatchObject({ y: 1, cols: 12 });
    await expect.poll(async () => dashboard.emissions()).toBe(emissions + 1);
  });

  test('moves one cell with Control when the neighbour is already free', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.focusTile('plain');
    await page.keyboard.press('Control+ArrowDown');

    await expect.poll(async () => (await dashboard.geometryOf('plain')).y).toBe(1);
  });

  test('refuses a jump that would leave the grid', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'locked-row', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    await dashboard.focusTile('rover');
    await page.keyboard.press('Control+ArrowLeft');

    expect(await dashboard.geometryOf('rover')).toMatchObject({ x: 0, y: 0 });
    expect(await dashboard.emissions()).toBe(emissions);
  });

  test('leaves an arrow inside a projected field to that field', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const before = await dashboard.geometryOf('plain');
    const emissions = await dashboard.emissions();

    await dashboard.tile('plain').locator('[data-qbc-lock-toggle]').focus();
    await page.keyboard.press('ArrowDown');

    expect(await dashboard.geometryOf('plain')).toEqual(before);
    expect(await dashboard.emissions()).toBe(emissions);
  });
});

test.describe('L2-028 Shift and arrow keys resize a focused tile', () => {
  test('grows the span by one column and emits once', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'at-column-9', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    await dashboard.focusTile('edge');
    await page.keyboard.press('Shift+ArrowDown');

    await expect.poll(async () => (await dashboard.geometryOf('edge')).rows).toBe(3);
    await expect.poll(async () => dashboard.emissions()).toBe(emissions + 1);
  });

  test('holds a tile at its declared minimum', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    // attitude declares minCols of 2 and already spans 3, so one shrink is allowed.
    await dashboard.focusTile('attitude');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect.poll(async () => (await dashboard.geometryOf('attitude')).cols).toBe(2);
    await page.keyboard.press('Shift+ArrowLeft');

    expect(await dashboard.geometryOf('attitude')).toMatchObject({ cols: 2 });
    await expect.poll(async () => dashboard.emissions()).toBe(emissions + 1);
  });

  test('refuses growth that would overlap a neighbour', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    const emissions = await dashboard.emissions();

    await dashboard.focusTile('attitude');
    await page.keyboard.press('Shift+ArrowRight');

    expect(await dashboard.geometryOf('attitude')).toMatchObject({ cols: 3 });
    expect(await dashboard.emissions()).toBe(emissions);
  });
});

test.describe('L2-029 keyboard changes are announced', () => {
  test('announces a committed move in one-based terms', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.focusTile('attitude');
    await page.keyboard.press('ArrowDown');

    await expect.poll(async () => dashboard.announcement()).toContain('Attitude');
    expect(await dashboard.announcement()).toContain('column 1, row 2');
  });

  test('announces the new span for a resize', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'at-column-9', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.focusTile('edge');
    await page.keyboard.press('Shift+ArrowDown');

    await expect.poll(async () => dashboard.announcement()).toContain('3 by 3');
  });

  test('announces a refusal as blocked', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.focusTile('attitude');
    await page.keyboard.press('ArrowRight');

    await expect.poll(async () => dashboard.announcement()).toContain('blocked');
  });

  test('names a tile whose label is absent or blank from its id', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'blank-labels', columns: 12 });
    await dashboard.enterEditMode();

    expect(await dashboard.accessibleNameOf('nameless')).toBe('nameless');
    expect(await dashboard.accessibleNameOf('blank')).toBe('blank');
  });

  test('describes the commands on a tile focused in edit mode', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    const description = await dashboard.descriptionOf('attitude');
    expect(description).toContain('Arrow keys');
    expect(description).toContain('Control');
    expect(description).toContain('Shift');
  });

  test('resolves each grid description to its own instructions', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12, grids: 2 });
    await dashboard.enterEditMode();

    const ids = await dashboard.instructionIdsPerGrid();
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  test('announces a run of commands once, naming where the tile came to rest', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    await dashboard.watchAnnouncements();

    await dashboard.focusTile('plain');
    await dashboard.holdArrow('ArrowDown', 4);
    await expect.poll(async () => (await dashboard.geometryOf('plain')).y).toBe(4);

    await expect.poll(async () => dashboard.announcementCount()).toBe(1);
    expect(await dashboard.announcement()).toContain('row 5');
  });

  test('announces three separately settled refusals three times', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    await dashboard.watchAnnouncements();

    await dashboard.focusTile('attitude');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.keyboard.press('ArrowLeft');
      await dashboard.waitForRunToSettle();
    }

    // Alternating two regions covers two repeats and leaves the third silent, because the
    // region due to receive it already holds that sentence.
    expect(await dashboard.announcementCount()).toBe(3);
  });

  test('names the resting position together with the refusal that ended a run', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    // attitude starts at column 0, so a left arrow after two moves down is refused by the
    // edge of the grid rather than by a neighbour.
    await dashboard.focusTile('attitude');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');

    await expect.poll(async () => dashboard.announcement()).toContain('blocked');
    const spoken = await dashboard.announcement();
    expect(spoken).toContain('row 3');
  });
});
