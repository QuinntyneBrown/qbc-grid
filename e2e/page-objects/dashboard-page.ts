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
}
