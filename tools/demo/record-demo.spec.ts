import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DemoDashboardPage } from './demo-dashboard-page';
import { layoutFixtures } from '../../src/e2e-app/app/dashboard/layout-fixtures';

const chapters = JSON.parse(readFileSync('tools/demo/chapters.json', 'utf8')) as {
  title: string;
  eyebrow: string;
  detail: string;
}[];
const paced = process.env['QBC_DEMO_DRY_RUN'] !== '1';
const standard = [
  { id: 'alpha', label: 'Telemetry', x: 0, y: 0, cols: 3, rows: 3 },
  { id: 'bravo', label: 'System status', x: 3, y: 0, cols: 3, rows: 3 },
  { id: 'charlie', label: 'Event readings', x: 0, y: 3, cols: 6, rows: 3 },
];

for (const [index, chapter] of chapters.entries()) {
  test(`${String(index + 1).padStart(2, '0')} ${chapter.title}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1600, height: 900 },
      ...(paced
        ? { recordVideo: { dir: 'tmp/demo/raw', size: { width: 1600, height: 900 } } }
        : {}),
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const dashboard = new DemoDashboardPage(page, paced);
    await dashboard.trackPointer();
    let layout: unknown = standard;
    if (index === 3) layout = [{ ...standard[0], minCols: 2, maxCols: 5, minRows: 2, maxRows: 4 }];
    if (index === 5) layout = [{ ...standard[0], x: 3 }];
    if (index === 6) layout = layoutFixtures['locked-row'];
    if (index === 10)
      layout = [
        null,
        { id: 'bad', x: -3, y: 0, cols: 40, rows: 0 },
        { id: 'bad', x: 0, y: 0, cols: 2, rows: 1 },
        { id: 'next', x: 0, y: 0, cols: 4, rows: 2 },
      ];
    if (index === 13) layout = layoutFixtures['sixty'];
    await dashboard.seed(layout, index === 13 ? 42 : 64);
    await dashboard.present(chapter, index);
    if (index === 13) await dashboard.dense();
    await dashboard.caption(chapter.detail);
    const began = Date.now();
    try {
      await dashboard.pause(2);
      switch (index) {
        case 0:
          await expect(dashboard.tiles).toHaveCount(3);
          await dashboard.reading(
            'PUBLIC CONTRACT',
            'layout: GridTile[]\nmode: live | edit\n\n(layoutChange)\n\nYour Angular template\nfor every tile',
          );
          await dashboard.typeInWidget('alpha', 'Mission control ready');
          await dashboard.pause(5);
          await dashboard.caption(
            'Layout and interaction in the library. Widgets and storage in your app.',
          );
          break;
        case 1:
          await dashboard.enterEditMode();
          await dashboard.pause(2);
          await dashboard.pressTile('alpha');
          await dashboard.glide(6 * (await dashboard.columnPitch()), 0);
          await expect(dashboard.shadow).toBeVisible();
          expect(await dashboard.shadowIsValid()).toBe(true);
          expect(await dashboard.emissions()).toBe(0);
          await dashboard.pause(5);
          await page.screenshot({ path: 'docs/media/qbc-grid-demo-poster.png' });
          await dashboard.releasePointer();
          expect((await dashboard.geometryOf('alpha')).x).toBe(6);
          expect(await dashboard.emissions()).toBe(1);
          await dashboard.caption('Released at column 6. Exactly one committed layout change.');
          break;
        case 2:
          await dashboard.enterEditMode();
          await dashboard.pressTile('alpha');
          await dashboard.glide(3 * (await dashboard.columnPitch()), 0);
          expect(await dashboard.shadowIsValid()).toBe(false);
          expect(await dashboard.shadowBorderStyle()).toBe('dashed');
          await dashboard.pause(3);
          await dashboard.releasePointer();
          expect((await dashboard.geometryOf('alpha')).x).toBe(0);
          await dashboard.caption(
            'Refused: neighboring tiles stay in place. Next, cancel with Escape.',
          );
          await dashboard.pause(2);
          await dashboard.pressTile('alpha');
          await dashboard.glide(6 * (await dashboard.columnPitch()), 0);
          await dashboard.key('Escape');
          await dashboard.releasePointer();
          expect(await dashboard.emissions()).toBe(0);
          break;
        case 3:
          await dashboard.enterEditMode();
          await dashboard.pressHandle('alpha');
          await dashboard.glide(
            4 * (await dashboard.columnPitch()),
            2 * (await dashboard.rowPitch()),
          );
          await dashboard.pause(3);
          await dashboard.releasePointer();
          expect(await dashboard.geometryOf('alpha')).toEqual({ x: 0, y: 0, cols: 5, rows: 4 });
          await dashboard.caption(
            'Maximum reached: 5 columns × 4 rows. Now shrink to the minimum.',
          );
          await dashboard.pause(2);
          await dashboard.pressHandle('alpha');
          await dashboard.glide(
            -4 * (await dashboard.columnPitch()),
            -3 * (await dashboard.rowPitch()),
          );
          await dashboard.pause(2);
          await dashboard.releasePointer();
          expect(await dashboard.geometryOf('alpha')).toEqual({ x: 0, y: 0, cols: 2, rows: 2 });
          break;
        case 4:
          await expect(dashboard.handleOf('alpha')).toHaveCount(0);
          await dashboard.typeInWidget('alpha', 'Controls work in live mode');
          await dashboard.pause(2);
          await dashboard.enterEditMode();
          await dashboard.toggleLockOf('alpha');
          await expect(dashboard.handleOf('alpha')).toHaveCount(0);
          await dashboard.pointerMove('alpha', 6);
          expect((await dashboard.geometryOf('alpha')).x).toBe(0);
          await dashboard.caption('Locked: no move and no resize handle. Unlock to edit again.');
          await dashboard.toggleLockOf('alpha');
          await expect(dashboard.handleOf('alpha')).toBeVisible();
          await dashboard.pause(2);
          await dashboard.leaveEditMode();
          await expect(dashboard.handleOf('alpha')).toHaveCount(0);
          break;
        case 5:
          await dashboard.enterEditMode();
          await dashboard.focusTile('alpha');
          await dashboard.key('ArrowRight');
          await dashboard.key('ArrowDown');
          await dashboard.caption(
            'Shift + Arrow changes the span; the live region describes the result.',
          );
          await dashboard.key('Shift+ArrowRight');
          await dashboard.key('Shift+ArrowDown');
          expect(await dashboard.geometryOf('alpha')).toEqual({ x: 4, y: 1, cols: 4, rows: 4 });
          expect(await dashboard.announcement()).not.toBe('');
          break;
        case 6:
          await dashboard.enterEditMode();
          await dashboard.focusTile('rover');
          await dashboard.key('ArrowDown');
          expect((await dashboard.geometryOf('rover')).y).toBe(0);
          await dashboard.pause(3);
          await dashboard.caption(
            'Ctrl + Arrow Down crosses the locked row to the nearest free position.',
          );
          await dashboard.key('Control+ArrowDown');
          expect((await dashboard.geometryOf('rover')).y).toBe(2);
          await dashboard.pause(3);
          await dashboard.key('Control+ArrowUp');
          expect((await dashboard.geometryOf('rover')).y).toBe(0);
          break;
        case 7:
          await dashboard.enterEditMode();
          await dashboard.addTile();
          expect((await dashboard.geometryOf('added-1')).x).toBe(6);
          await dashboard.pause(2);
          await dashboard.reading(
            'EXPORTED COMPONENT API',
            "grid.addTile({\n  id: 'positioned',\n  x: 9, y: 3,\n  cols: 3, rows: 2\n});",
          );
          await dashboard.explicitAdd({
            id: 'positioned',
            label: 'Positioned tile',
            x: 9,
            y: 3,
            cols: 3,
            rows: 2,
          });
          expect(await dashboard.geometryOf('positioned')).toEqual({
            x: 9,
            y: 3,
            cols: 3,
            rows: 2,
          });
          await dashboard.pause(4);
          await dashboard.caption('Remove the focused tile: its neighbors keep their coordinates.');
          await dashboard.removeTileFromKeyboard('alpha');
          await expect(dashboard.tiles).toHaveCount(4);
          expect(await dashboard.focusedTile()).toBe('bravo');
          break;
        case 8: {
          await dashboard.enterEditMode();
          await dashboard.typeInWidget('alpha', 'Keep this note after moving');
          await dashboard.scrollWidget('alpha', 150);
          const instance = await dashboard.widgetInstanceOf('alpha');
          const scroll = await dashboard.widgetScrollTop('alpha');
          await dashboard.pause(3);
          await dashboard.pointerMove('alpha', 6);
          expect(await dashboard.widgetFieldValue('alpha')).toBe('Keep this note after moving');
          expect(await dashboard.widgetInstanceOf('alpha')).toBe(instance);
          expect(await dashboard.widgetScrollTop('alpha')).toBe(scroll);
          await dashboard.reading(
            'PRESERVED WIDGET STATE',
            `Same instance: ${instance}\nNote value: preserved\nScroll offset: ${scroll}px\n\nActual projected\nAngular component`,
          );
          break;
        }
        case 9: {
          await dashboard.enterEditMode();
          await dashboard.pointerMove('alpha', 6);
          const stored = await dashboard.stored();
          await dashboard.reading(
            'HOST LOCAL STORAGE',
            JSON.stringify((stored as unknown[])[0], null, 2),
          );
          await dashboard.pause(4);
          await dashboard.reload();
          await dashboard.present(chapter, index);
          await dashboard.caption(
            'Browser reloaded. The host restored the saved layout in live mode.',
          );
          expect(await dashboard.stored()).toEqual(stored);
          expect((await dashboard.geometryOf('alpha')).x).toBe(6);
          expect(await dashboard.mode()).toBe('live');
          break;
        }
        case 10:
          await dashboard.reading(
            'SUPPLIED DATA (BEFORE REPAIR)',
            'null\nbad: x=-3, cols=40, rows=0\nbad: duplicate id\nnext: overlaps bad',
          );
          await expect(dashboard.tiles).toHaveCount(2);
          expect(await dashboard.geometryOf('bad')).toEqual({ x: 0, y: 0, cols: 12, rows: 1 });
          expect((await dashboard.geometryOf('next')).y).toBe(1);
          expect(await dashboard.emissions()).toBe(1);
          await dashboard.pause(6);
          await dashboard.reading(
            'REPAIRED OUTPUT',
            'bad: x=0, y=0, 12 × 1\nnext: x=0, y=1, 4 × 2\n\n2 valid tiles\n1 repaired layout emission',
          );
          break;
        case 11:
          await dashboard.reading(
            'MEASURED CONTAINER',
            `${await dashboard.hostWidth()}px wide\n12 fixed columns`,
          );
          await dashboard.pause(2);
          await dashboard.containerWidth(960);
          expect((await dashboard.metrics()).columns).toBe(12);
          await dashboard.reading(
            'MEASURED CONTAINER',
            `${await dashboard.hostWidth()}px wide\n12 fixed columns\nCell coordinates preserved`,
          );
          await dashboard.pause(3);
          await dashboard.containerWidth(1080);
          await dashboard.enterEditMode();
          await dashboard.focusTile('bravo');
          await dashboard.key('Control+ArrowDown');
          await dashboard.key('Control+ArrowDown');
          await dashboard.scrollDashboard();
          expect(await dashboard.hostHeight()).toBeGreaterThan(600);
          await dashboard.caption('Lower rows extend the grid. The host scrolls to show the tile.');
          break;
        case 12:
          await dashboard.enterEditMode();
          await dashboard.pause(2);
          await dashboard.theme();
          expect(await dashboard.durations()).toEqual(['0ms', '0ms']);
          await dashboard.reading(
            'TOKEN OVERRIDES',
            '--qbc-color-accent\n--qbc-color-surface\n--qbc-color-border\n\nReduced motion:\nfade 0ms / settle 0ms',
          );
          await dashboard.pointerMove('alpha', 6);
          expect((await dashboard.geometryOf('alpha')).x).toBe(6);
          break;
        case 13:
          await expect(dashboard.tiles).toHaveCount(60);
          await dashboard.enterEditMode();
          await dashboard.pressTile('tile-0');
          await dashboard.glide(
            5 * (await dashboard.columnPitch()),
            3 * (await dashboard.rowPitch()),
          );
          expect(await dashboard.emissions()).toBe(0);
          await dashboard.pause(3);
          await dashboard.glide(0, -3 * (await dashboard.rowPitch()));
          await dashboard.key('Escape');
          await dashboard.releasePointer();
          await dashboard.focusTile('tile-0');
          await dashboard.key('Control+ArrowDown');
          expect((await dashboard.geometryOf('tile-0')).y).toBe(10);
          expect(await dashboard.emissions()).toBe(1);
          await dashboard.caption(
            '60 tiles. Cancelled pointer preview: 0 commits. Keyboard move: 1 commit.',
          );
          break;
        case 14:
          await dashboard.enterEditMode();
          await dashboard.reading(
            'START HERE',
            'README.md\ndocs/api.md\nCONTRIBUTING.md\n\nAngular 21 peers\nSeparate design tokens\nMIT License',
          );
          await dashboard.pointerMove('alpha', 6);
          await dashboard.pause(2);
          await dashboard.leaveEditMode();
          await dashboard.caption('github.com/QuinntyneBrown/qbc-grid');
          break;
      }
      expect(errors).toEqual([]);
      mkdirSync('tmp/demo/stills', { recursive: true });
      await page.screenshot({ path: `tmp/demo/stills/${String(index + 1).padStart(2, '0')}.png` });
      const remaining = 20_000 - (Date.now() - began);
      if (paced) {
        expect(remaining, 'Scene actions must fit the twenty-second chapter').toBeGreaterThan(0);
        await page.waitForTimeout(remaining);
      }
    } finally {
      const video = page.video();
      await context.close();
      if (video) {
        mkdirSync('tmp/demo/scenes', { recursive: true });
        await video.saveAs(`tmp/demo/scenes/${String(index + 1).padStart(2, '0')}.webm`);
      }
    }
  });
}

test.afterAll(() => {
  writeFileSync('tmp/demo/recording-mode.txt', paced ? 'full recording' : 'dry run');
});
