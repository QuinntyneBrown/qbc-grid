import { Locator, Page } from '@playwright/test';

/** How the dashboard screen is opened. */
export interface DashboardOptions {
  /** The named layout the deterministic store resolves. */
  fixture?: string;
  /** Which of the three token configurations the page loads. */
  tokens?: 'default' | 'absent' | 'overridden';
  columns?: number;
  rowHeight?: number;
  gap?: number;
}

const ROUTES = {
  default: '/',
  absent: '/tokens/absent',
  overridden: '/tokens/overridden',
} as const;

/**
 * The one screen the acceptance suite drives. This object owns every selector and every
 * interaction; a specification states intent and reaches the DOM only through here.
 */
export class DashboardPageObject {
  constructor(private readonly page: Page) {}

  async open(options: DashboardOptions = {}): Promise<void> {
    const params = new URLSearchParams();
    if (options.fixture !== undefined) params.set('fixture', options.fixture);
    if (options.columns !== undefined) params.set('columns', String(options.columns));
    if (options.rowHeight !== undefined) params.set('rowHeight', String(options.rowHeight));
    if (options.gap !== undefined) params.set('gap', String(options.gap));

    const route = ROUTES[options.tokens ?? 'default'];
    const query = params.toString();
    await this.page.goto(query === '' ? route : `${route}?${query}`);
    await this.grid.waitFor({ state: 'attached' });
  }

  get grid(): Locator {
    return this.page.locator('[data-qbc-grid]');
  }

  tile(id: string): Locator {
    return this.page.locator(`[data-qbc-tile="${id}"]`);
  }

  get tiles(): Locator {
    return this.page.locator('[data-qbc-tile]');
  }

  async mode(): Promise<string | null> {
    return this.grid.getAttribute('data-mode');
  }

  /**
   * The grid publishes its metrics and each tile's geometry as custom properties, so a
   * specification reads the cell coordinates and the column arithmetic it is written in
   * rather than measuring pixels and dividing back down into cells.
   */
  async metrics(): Promise<GridMetricsReading> {
    return this.grid.evaluate((host) => {
      const style = getComputedStyle(host);
      const read = (name: string) => Number.parseFloat(style.getPropertyValue(name));
      return {
        columns: read('--qbc-grid-columns'),
        columnWidth: read('--qbc-grid-column-width'),
        rowHeight: read('--qbc-grid-row-height'),
        gap: read('--qbc-grid-gap'),
      };
    });
  }

  async geometryOf(id: string): Promise<TileGeometryReading> {
    return this.tile(id).evaluate((element) => {
      const style = getComputedStyle(element);
      const read = (name: string) => Number.parseFloat(style.getPropertyValue(name));
      return {
        x: read('--qbc-tile-x'),
        y: read('--qbc-tile-y'),
        cols: read('--qbc-tile-cols'),
        rows: read('--qbc-tile-rows'),
      };
    });
  }

  /** The rendered box of a tile, in pixels relative to the grid host's content box. */
  async boxOf(id: string): Promise<BoxReading> {
    const tile = await this.tile(id).boundingBox();
    const host = await this.grid.boundingBox();
    if (tile === null || host === null) throw new Error(`No box for tile ${id}`);
    return {
      left: tile.x - host.x,
      top: tile.y - host.y,
      width: tile.width,
      height: tile.height,
    };
  }

  async hostHeight(): Promise<number> {
    return this.grid.evaluate((host) => host.getBoundingClientRect().height);
  }

  async hostWidth(): Promise<number> {
    return this.grid.evaluate((host) => host.getBoundingClientRect().width);
  }

  /** The tile ids in the order the grid renders them into the document. */
  async renderedOrder(): Promise<string[]> {
    return this.tiles.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-qbc-tile') ?? ''),
    );
  }

  async enterEditMode(): Promise<void> {
    await this.page.locator('[data-qbc-mode-toggle]').click();
    await this.page.locator('[data-qbc-grid][data-mode="edit"]').waitFor({ state: 'attached' });
  }

  async leaveEditMode(): Promise<void> {
    await this.page.locator('[data-qbc-mode-toggle]').click();
    await this.page.locator('[data-qbc-grid][data-mode="live"]').waitFor({ state: 'attached' });
  }

  async toggleLockOf(id: string): Promise<void> {
    await this.tile(id).locator('[data-qbc-lock-toggle]').click();
  }

  handleOf(id: string): Locator {
    return this.tile(id).locator('[data-qbc-handle]');
  }

  async tabIndexOf(id: string): Promise<string | null> {
    return this.tile(id).getAttribute('tabindex');
  }

  /** The id of the tile that currently holds focus, or null when no tile does. */
  async focusedTile(): Promise<string | null> {
    return this.page.evaluate(() => {
      const active = document.activeElement;
      return active?.closest('[data-qbc-tile]')?.getAttribute('data-qbc-tile') ?? null;
    });
  }

  /**
   * The id of the tile only when the tile element itself holds focus. A tile's projected
   * content carries controls of its own that stay tabbable, so the tab order interleaves
   * tiles with their contents; this reports the tiles.
   */
  async focusedTileElement(): Promise<string | null> {
    return this.page.evaluate(() => {
      const active = document.activeElement;
      return active?.matches('[data-qbc-tile]') === true
        ? active.getAttribute('data-qbc-tile')
        : null;
    });
  }

  /** Tabs forward, collecting the tile elements focus lands on, until it has `count`. */
  async tabThroughTiles(count: number, limit = 20): Promise<string[]> {
    await this.page.locator('[data-qbc-mutate-layout]').focus();
    const visited: string[] = [];
    for (let step = 0; step < limit && visited.length < count; step += 1) {
      await this.page.keyboard.press('Tab');
      const id = await this.focusedTileElement();
      if (id !== null) visited.push(id);
    }
    return visited;
  }

  /** Whether the focused tile is drawing the focus indicator. */
  async focusRingVisible(): Promise<boolean> {
    return this.page.evaluate(() => {
      const active = document.activeElement;
      if (active === null) return false;
      const tile = active.closest('[data-qbc-tile]');
      if (tile === null) return false;
      return tile.matches(':focus-visible');
    });
  }

  /** Drives the page into mutating the last layout the grid handed it. */
  async mutateLastLayout(): Promise<void> {
    await this.page.locator('[data-qbc-mutate-layout]').click();
  }

  async lastLayout(): Promise<unknown> {
    const raw = await this.page
      .locator('[data-qbc-last-layout]')
      .getAttribute('data-qbc-last-layout');
    return raw === null || raw === '' ? null : JSON.parse(raw);
  }

  async emissions(): Promise<number> {
    const value = await this.page.locator('[data-qbc-emissions]').getAttribute('data-qbc-emissions');
    return Number(value);
  }
}

export interface GridMetricsReading {
  columns: number;
  columnWidth: number;
  rowHeight: number;
  gap: number;
}

export interface TileGeometryReading {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface BoxReading {
  left: number;
  top: number;
  width: number;
  height: number;
}
