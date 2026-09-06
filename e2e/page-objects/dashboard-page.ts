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
