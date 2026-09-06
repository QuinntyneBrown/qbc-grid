import { expect, test } from '@playwright/test';

import { DashboardPageObject } from '../page-objects/dashboard-page';

/**
 * L2-034: every visual value comes from a token.
 *
 * A literal is caught by overriding rather than by reading. A hard-coded colour or duration
 * is exactly the value that fails to move when every token is redefined, so the override
 * route detects it wherever it hides and does so without a scan of the source.
 */

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPageObject(page);
  await dashboard.trackPointer();
});

test.describe('L2-034 every visual value comes from a design token', () => {
  test('retains no library default when the whole catalogue is overridden', async ({ page }) => {
    const reference = new DashboardPageObject(page);
    await reference.open({ fixture: 'metadata', columns: 12 });
    await reference.enterEditMode();
    const painted = await reference.paintedValuesDuringDrag();

    const overridden = new DashboardPageObject(page);
    await overridden.open({ fixture: 'metadata', columns: 12, tokens: 'overridden' });
    await overridden.enterEditMode();
    const moved = await overridden.paintedValuesDuringDrag();

    const held: string[] = [];
    for (const [role, value] of Object.entries(painted)) {
      if (moved[role] === value) held.push(`${role} stayed at ${value}`);
    }
    expect(held).toEqual([]);
  });

  test('renders the shadow in the host colours when those tokens are redefined', async ({
    page,
  }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    await dashboard.redefineTokens({
      '--qbc-color-accent': 'rgb(1, 2, 3)',
      '--qbc-color-danger': 'rgb(4, 5, 6)',
    });

    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(0, 2 * (await dashboard.rowPitch()));
    await expect.poll(async () => dashboard.shadowIsValid()).toBe(true);

    expect(await dashboard.shadowBorderColour()).toBe('rgb(1, 2, 3)');
    await dashboard.releasePointer();
  });

  test('matches the reference render when the token file is absent', async ({ page }) => {
    const reference = new DashboardPageObject(page);
    await reference.open({ fixture: 'metadata', columns: 12 });
    await reference.enterEditMode();
    const withTokens = await reference.paintedValuesDuringDrag();

    const bare = new DashboardPageObject(page);
    await bare.open({ fixture: 'metadata', columns: 12, tokens: 'absent' });
    await bare.enterEditMode();
    const withoutTokens = await bare.paintedValuesDuringDrag();

    expect(withoutTokens).toEqual(withTokens);
  });
});

test.describe('L2-034 an operator who asks for reduced motion gets none', () => {
  test.use({ reducedMotion: 'reduce' });

  test('clears the overlay and settles a refused drop without a transition', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();

    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(0, 2 * (await dashboard.rowPitch()));
    await expect(dashboard.overlay).toBeVisible();

    expect(await dashboard.overlayTransitionDuration()).toBe('0s');
    await dashboard.releasePointer();
    await expect(dashboard.overlay).toHaveCount(0);
  });

  test('leaves the durations at zero even where a host redefines them', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    // The override route moves both duration tokens away from zero.
    await dashboard.open({ fixture: 'metadata', columns: 12, tokens: 'overridden' });
    await dashboard.enterEditMode();

    await dashboard.pressTile('plain');
    await dashboard.movePointerBy(0, 2 * (await dashboard.rowPitch()));
    await expect(dashboard.overlay).toBeVisible();

    // A preference the operator expressed outranks a theme that asks for movement.
    expect(await dashboard.overlayTransitionDuration()).toBe('0s');
    await dashboard.releasePointer();
  });

  test('still reveals the overlay for a run and still announces it once', async ({ page }) => {
    const dashboard = new DashboardPageObject(page);
    await dashboard.open({ fixture: 'metadata', columns: 12 });
    await dashboard.enterEditMode();
    await dashboard.watchAnnouncements();

    await dashboard.focusTile('plain');
    await dashboard.holdArrow('ArrowDown', 4);
    await expect.poll(async () => (await dashboard.geometryOf('plain')).y).toBe(4);

    await expect.poll(async () => dashboard.announcementCount()).toBe(1);
    await expect(dashboard.overlay).toHaveCount(0);
  });
});
