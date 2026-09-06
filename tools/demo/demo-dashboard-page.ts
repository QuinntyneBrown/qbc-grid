import { readFileSync } from 'node:fs';
import { Page } from '@playwright/test';
import { DashboardPageObject } from '../../e2e/page-objects/dashboard-page';
import { AddTileRequest, GridComponent } from '../../src/qbc-grid/public-api';

/** Recording annotations surround the real dashboard; all interactions stay in this page object. */
export class DemoDashboardPage extends DashboardPageObject {
  constructor(
    private readonly screen: Page,
    private readonly paced: boolean,
  ) {
    super(screen);
  }

  async seed(layout: unknown, rowHeight = 64): Promise<void> {
    await this.screen.goto('/');
    await this.screen.evaluate(
      (value) => localStorage.setItem('qbc-grid.dashboard', JSON.stringify(value)),
      layout,
    );
    await this.screen.goto(`/?rowHeight=${rowHeight}&gap=12`);
    await this.grid.waitFor();
    await this.screen.waitForFunction(
      () => !!getComputedStyle(document.documentElement).getPropertyValue('--qbc-color-accent'),
    );
  }

  async present(
    chapter: { title: string; eyebrow: string; detail: string },
    index: number,
  ): Promise<void> {
    await this.screen.addStyleTag({ content: readFileSync('tools/demo/presentation.css', 'utf8') });
    const markup = readFileSync('tools/demo/presentation.html', 'utf8');
    await this.screen.evaluate(
      ({ markup, chapter, index }) => {
        document.body.insertAdjacentHTML('beforeend', markup);
        (document.querySelector('app-dashboard') as HTMLElement).style.inlineSize = '1080px';
        document.querySelector('#demo-title')!.textContent = chapter.title;
        document.querySelector('#demo-eyebrow')!.textContent = chapter.eyebrow;
        document.querySelector('#demo-detail')!.textContent = chapter.detail;
        (document.querySelector('#demo-progress') as HTMLElement).style.width =
          `${((index + 1) / 15) * 100}%`;
        const cursor = document.querySelector('#demo-cursor') as HTMLElement;
        addEventListener(
          'pointermove',
          (event) => {
            cursor.style.left = `${event.clientX}px`;
            cursor.style.top = `${event.clientY}px`;
          },
          true,
        );
        addEventListener('pointerdown', () => (cursor.style.background = '#ffffffaa'), true);
        addEventListener('pointerup', () => (cursor.style.background = '#73bbff40'), true);
        const update = () => {
          const host = document.querySelector('qbc-grid')!;
          const tiles = [...host.querySelectorAll('[data-qbc-tile]')];
          const style = getComputedStyle(host);
          document.querySelector('#demo-grid')!.textContent =
            `${tiles.length} tiles / ${style.getPropertyValue('--qbc-grid-columns')} cols`;
          document.querySelector('#demo-commits')!.textContent = document
            .querySelector('[data-qbc-emissions]')!
            .getAttribute('data-qbc-emissions');
          const reading = document.querySelector('#demo-reading') as HTMLElement;
          if (!reading.dataset['fixed']) {
            reading.textContent = tiles
              .slice(0, 5)
              .map((tile) => {
                const s = getComputedStyle(tile);
                return `${tile.getAttribute('aria-label')}\n  x:${s.getPropertyValue('--qbc-tile-x')} y:${s.getPropertyValue('--qbc-tile-y')}  ${s.getPropertyValue('--qbc-tile-cols')} × ${s.getPropertyValue('--qbc-tile-rows')}`;
              })
              .join('\n');
          }
          document.querySelector('#demo-announcement')!.textContent = [
            ...host.querySelectorAll('[data-qbc-announcer]'),
          ]
            .map((node) => node.textContent?.trim())
            .filter(Boolean)
            .join(' ');
        };
        update();
        new MutationObserver(update).observe(document.querySelector('app-dashboard')!, {
          subtree: true,
          attributes: true,
          childList: true,
          characterData: true,
        });
      },
      { markup, chapter, index },
    );
  }

  async caption(text: string): Promise<void> {
    await this.screen
      .locator('#demo-caption')
      .evaluate((node, text) => (node.textContent = text), text);
  }

  async reading(label: string, text: string): Promise<void> {
    await this.screen
      .locator('#demo-reading-label')
      .evaluate((node, value) => (node.textContent = value), label);
    await this.screen.locator('#demo-reading').evaluate((node: HTMLElement, value) => {
      node.dataset['fixed'] = 'true';
      node.textContent = value;
    }, text);
  }

  async pause(seconds: number): Promise<void> {
    await this.screen.waitForTimeout(this.paced ? seconds * 1000 : 150);
  }

  async glide(dx: number, dy: number): Promise<void> {
    for (let step = 0; step < 24; step++) {
      await this.movePointerBy(dx / 24, dy / 24, 1);
      if (this.paced) await this.screen.waitForTimeout(45);
    }
  }

  async pointerMove(id: string, columns: number, rows = 0): Promise<void> {
    await this.pressTile(id);
    await this.glide(columns * (await this.columnPitch()), rows * (await this.rowPitch()));
    await this.pause(2);
    await this.releasePointer();
  }

  async key(key: string): Promise<void> {
    await this.screen.keyboard.press(key);
    await this.pause(1);
  }

  async explicitAdd(request: AddTileRequest): Promise<void> {
    // Dev-mode introspection calls the exported API without adding recording controls to the app.
    await this.grid.evaluate((element, request) => {
      const angular = (window as unknown as { ng: { getComponent(node: Element): GridComponent } })
        .ng;
      angular.getComponent(element).addTile(request);
    }, request);
  }

  async reload(): Promise<void> {
    await this.screen.reload();
    await this.grid.waitFor();
  }

  async containerWidth(width: number): Promise<void> {
    await this.screen
      .locator('app-dashboard')
      .evaluate((node: HTMLElement, width) => (node.style.inlineSize = `${width}px`), width);
    await this.screen.waitForTimeout(150);
  }

  async scrollDashboard(): Promise<void> {
    await this.screen
      .locator('app-dashboard')
      .evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' }));
  }

  async theme(): Promise<void> {
    await this.screen.evaluate(() => {
      const tokens = {
        '--qbc-color-accent': '#b4a0ff',
        '--qbc-color-accent-soft': '#39275e',
        '--qbc-color-focus': '#dccfff',
        '--qbc-color-surface': '#211b31',
        '--qbc-color-surface-raised': '#302741',
        '--qbc-color-border': '#695489',
        '--qbc-color-grid-line': '#675180',
      };
      for (const [name, value] of Object.entries(tokens))
        document.documentElement.style.setProperty(name, value);
    });
    await this.screen.emulateMedia({ reducedMotion: 'reduce' });
  }

  async durations(): Promise<string[]> {
    return this.screen.evaluate(() =>
      ['--qbc-duration-fast', '--qbc-duration-settle'].map((name) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      ),
    );
  }

  async dense(): Promise<void> {
    await this.screen.evaluate(() => document.body.classList.add('demo-dense'));
  }

  async stored(): Promise<unknown> {
    return this.screen.evaluate(() =>
      JSON.parse(localStorage.getItem('qbc-grid.dashboard') ?? 'null'),
    );
  }
}
