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
  /** How many grids the page renders, so two on one page can be told apart. */
  grids?: number;
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
    if (options.grids !== undefined) params.set('grids', String(options.grids));

    const route = ROUTES[options.tokens ?? 'default'];
    const query = params.toString();
    await this.page.goto(query === '' ? route : `${route}?${query}`);
    await this.grid.waitFor({ state: 'attached' });
  }

  /** The first grid on the page. A page rendering two of them names them apart explicitly. */
  get grid(): Locator {
    return this.page.locator('[data-qbc-grid]').first();
  }

  tile(id: string): Locator {
    return this.page.locator(`[data-qbc-tile="${id}"]`).first();
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
    await this.page
      .locator('[data-qbc-grid][data-mode="edit"]')
      .first()
      .waitFor({ state: 'attached' });
  }

  async leaveEditMode(): Promise<void> {
    await this.page.locator('[data-qbc-mode-toggle]').click();
    await this.page
      .locator('[data-qbc-grid][data-mode="live"]')
      .first()
      .waitFor({ state: 'attached' });
  }

  async addTile(): Promise<void> {
    await this.page.locator('[data-qbc-add-tile]').click();
  }

  /** Removes a tile through the control inside its own projected content. */
  async removeTile(id: string): Promise<void> {
    await this.tile(id).locator('[data-qbc-remove-tile]').click();
  }

  /**
   * Removes a tile without focus ever entering it, which is how a host removes a tile for
   * a reason of its own while the operator is working somewhere else. A click would focus
   * the control it presses, and the criterion is about the case where it does not.
   */
  async removeTileWithoutFocusing(id: string): Promise<void> {
    await this.tile(id).locator('[data-qbc-remove-tile]').dispatchEvent('click');
  }

  /** Removes a tile from the keyboard, so focus is inside the subtree that disappears. */
  async removeTileFromKeyboard(id: string): Promise<void> {
    await this.tile(id).locator('[data-qbc-remove-tile]').focus();
    await this.page.keyboard.press('Enter');
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

  async focusTile(id: string): Promise<void> {
    await this.tile(id).focus();
  }

  /** The text the most recently written live region holds. */
  async announcement(): Promise<string> {
    const texts = await this.page
      .locator('[data-qbc-announcer]')
      .evaluateAll((regions) => regions.map((region) => region.textContent?.trim() ?? ''));
    return texts.find((text) => text !== '') ?? '';
  }

  /**
   * Counts every write that a screen reader would speak: a change to a region's text that
   * leaves it non-empty. Clearing the other region is what makes a repeated sentence a
   * change rather than silence, and it is not itself an announcement.
   */
  async watchAnnouncements(): Promise<void> {
    await this.page.evaluate(() => {
      const store = window as unknown as { __qbcSpoken: string[] };
      store.__qbcSpoken = [];
      for (const region of document.querySelectorAll('[data-qbc-announcer]')) {
        new MutationObserver(() => {
          const text = region.textContent?.trim() ?? '';
          if (text !== '') store.__qbcSpoken.push(text);
        }).observe(region, { childList: true, characterData: true, subtree: true });
      }
    });
  }

  async announcementCount(): Promise<number> {
    return this.page.evaluate(
      () => (window as unknown as { __qbcSpoken: string[] }).__qbcSpoken.length,
    );
  }

  /**
   * Holds an arrow key down for several commands and releases it once.
   *
   * A discrete press is its own run and is announced on its own; the criterion is about a
   * key held long enough for several moves to commit, which is one keydown, the repeats the
   * keyboard sends, and one keyup.
   */
  async holdArrow(key: string, presses: number): Promise<void> {
    await this.page.keyboard.down(key);
    for (let repeat = 1; repeat < presses; repeat += 1) {
      await this.page.evaluate((held) => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: held, bubbles: true, repeat: true }),
        );
      }, key);
    }
    await this.page.keyboard.up(key);
  }

  /** Waits out the interval a run of commands stays open with no further command. */
  async waitForRunToSettle(): Promise<void> {
    await this.page.waitForTimeout(500);
  }

  /** The accessible name a tile carries, which is what assistive technology reads. */
  async accessibleNameOf(id: string): Promise<string | null> {
    return this.tile(id).getAttribute('aria-label');
  }

  /** The text a tile's description resolves to, followed through aria-describedby. */
  async descriptionOf(id: string): Promise<string> {
    return this.tile(id).evaluate((element) => {
      const target = element.getAttribute('aria-describedby');
      if (target === null) return '';
      return element.ownerDocument.getElementById(target)?.textContent?.trim() ?? '';
    });
  }

  /** The instruction element each grid on the page points its tiles at. */
  async instructionIdsPerGrid(): Promise<(string | null)[]> {
    return this.page.locator('[data-qbc-grid]').evaluateAll((grids) =>
      grids.map((grid) => grid.querySelector('[data-qbc-tile]')?.getAttribute('aria-describedby') ?? null),
    );
  }

  /** The value a projected widget took at construction, so a rebuild can be told from a move. */
  async widgetInstanceOf(id: string): Promise<string | null> {
    return this.tile(id).locator('[data-qbc-widget-instance]').getAttribute('data-qbc-widget-instance');
  }

  async typeInWidget(id: string, text: string): Promise<void> {
    await this.tile(id).locator('[data-qbc-widget-field]').fill(text);
  }

  async widgetFieldValue(id: string): Promise<string> {
    return this.tile(id).locator('[data-qbc-widget-field]').inputValue();
  }

  async scrollWidget(id: string, top: number): Promise<void> {
    await this.tile(id)
      .locator('[data-qbc-widget-scroll]')
      .evaluate((element, offset) => {
        element.scrollTop = offset;
      }, top);
  }

  async widgetScrollTop(id: string): Promise<number> {
    return this.tile(id)
      .locator('[data-qbc-widget-scroll]')
      .evaluate((element) => element.scrollTop);
  }

  /** Whether a hostile string reached the DOM as markup rather than as text. */
  async scriptExecuted(): Promise<boolean> {
    return this.page.evaluate(
      () => (window as unknown as { __qbcExecuted?: boolean }).__qbcExecuted === true,
    );
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

  get overlay(): Locator {
    return this.page.locator('[data-qbc-overlay]');
  }

  get shadow(): Locator {
    return this.page.locator('[data-qbc-shadow]');
  }

  async shadowIsValid(): Promise<boolean> {
    return (await this.shadow.getAttribute('data-valid')) === 'true';
  }

  /** The dashed border is the channel that survives the shadow being rendered without colour. */
  async shadowBorderStyle(): Promise<string> {
    return this.shadow.evaluate((element) => getComputedStyle(element).borderTopStyle);
  }

  /** The distance from one column to the next, which is what a cell-sized drag travels. */
  async columnPitch(): Promise<number> {
    const metrics = await this.metrics();
    return metrics.columnWidth + metrics.gap;
  }

  async rowPitch(): Promise<number> {
    const metrics = await this.metrics();
    return metrics.rowHeight + metrics.gap;
  }

  /** Drags a tile by a whole number of columns, which is how the criteria are written. */
  async dragTileByColumns(id: string, columns: number): Promise<void> {
    await this.dragTileBy(id, columns * (await this.columnPitch()), 0);
  }

  /**
   * Presses the tile's own surface, without yet moving far enough to begin a drag.
   *
   * A press that lands on a control or a field belongs to that descendant, so this finds a
   * point the grid actually owns rather than assuming the centre is bare. On a tile full of
   * widgets the centre rarely is, which is the arrangement an operator meets.
   */
  async pressTile(id: string): Promise<void> {
    const point = await this.tile(id).evaluate((tile) => {
      const box = tile.getBoundingClientRect();
      const interactive =
        'button, input, select, textarea, a[href], [contenteditable], [role="button"], [role="slider"], [role="textbox"]';
      const candidates = [
        [0.5, 0.5],
        [0.95, 0.06],
        [0.5, 0.06],
        [0.03, 0.5],
        [0.97, 0.97],
      ];
      for (const [across, down] of candidates) {
        const x = box.left + box.width * across!;
        const y = box.top + box.height * down!;
        const under = document.elementFromPoint(x, y);
        if (under?.closest('[data-qbc-tile]') !== tile) continue;
        if (under.closest(interactive) !== null) continue;
        return { x, y };
      }
      throw new Error('No bare surface on this tile to press');
    });
    await this.page.mouse.move(point.x, point.y);
    await this.page.mouse.down();
  }

  async movePointerBy(dx: number, dy: number, steps = 8): Promise<void> {
    const position = await this.pointerPosition();
    await this.page.mouse.move(position.x + dx, position.y + dy, { steps });
  }

  async releasePointer(): Promise<void> {
    await this.page.mouse.up();
  }

  private async pointerPosition(): Promise<{ x: number; y: number }> {
    return this.page.evaluate(() => {
      const tracked = (window as unknown as { __qbcPointer?: { x: number; y: number } })
        .__qbcPointer;
      return tracked ?? { x: 0, y: 0 };
    });
  }

  /** Tracks the pointer so a relative move can be expressed the way a criterion states it. */
  async trackPointer(): Promise<void> {
    await this.page.addInitScript(() => {
      const store = window as unknown as { __qbcPointer?: { x: number; y: number } };
      store.__qbcPointer = { x: 0, y: 0 };
      addEventListener(
        'pointermove',
        (event) => {
          store.__qbcPointer = { x: event.clientX, y: event.clientY };
        },
        true,
      );
    });
  }

  /**
   * Activates a control from the keyboard, which is the only route while a gesture holds
   * pointer capture: the pointer is routed to the tile until the gesture ends, so no
   * control on the page can be reached with it.
   */
  async activateControlFromKeyboard(selector: string): Promise<void> {
    await this.page.locator(selector).evaluate((element: HTMLElement) => {
      element.focus();
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      element.click();
    });
  }

  /** Whether the tile still holds the pointer, which every terminal path has to release. */
  async tileHoldsPointerCapture(id: string): Promise<boolean> {
    return this.tile(id).evaluate((element) => {
      for (let pointerId = 0; pointerId < 8; pointerId += 1) {
        if (element.hasPointerCapture(pointerId)) return true;
      }
      return false;
    });
  }

  /** The cell geometry the shadow currently previews. */
  async shadowGeometry(): Promise<TileGeometryReading> {
    return this.shadow.evaluate((element) => {
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

  /** Presses the resize handle at the centre of its target. */
  async pressHandle(id: string): Promise<void> {
    const box = await this.handleOf(id).boundingBox();
    if (box === null) throw new Error(`No handle for tile ${id}`);
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
  }

  /** Resizes a tile by dragging its handle by a pixel offset. */
  async resizeTileBy(id: string, dx: number, dy: number): Promise<void> {
    await this.pressHandle(id);
    await this.movePointerBy(dx, dy);
    await this.releasePointer();
  }

  /** Drags a tile by a pixel offset, crossing the threshold on the way. */
  async dragTileBy(id: string, dx: number, dy: number): Promise<void> {
    await this.pressTile(id);
    await this.movePointerBy(dx, dy);
    await this.releasePointer();
  }

  /**
   * Playwright's mouse produces neither `pointercancel` nor `lostpointercapture`, and both
   * are terminal paths the grid has to answer, so the specification dispatches them.
   */
  async dispatchPointerEvent(id: string, type: 'pointercancel' | 'lostpointercapture'): Promise<void> {
    await this.tile(id).evaluate((element, eventType) => {
      element.dispatchEvent(
        new PointerEvent(eventType, { bubbles: true, pointerId: 1, isPrimary: true }),
      );
    }, type);
  }

  /**
   * Watches every tile for style-attribute mutations, grouped by animation frame. A write
   * is one mutation of the style attribute rather than one property assignment, because
   * one render transaction is what reaches the browser.
   */
  async watchTileMutations(): Promise<void> {
    await this.page.evaluate(() => {
      const record: { frame: number; id: string }[] = [];
      let frame = 0;
      const tick = () => {
        frame += 1;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const element = mutation.target as HTMLElement;
          const id = element.getAttribute('data-qbc-tile');
          if (id !== null) record.push({ frame, id });
        }
      });
      for (const tile of document.querySelectorAll('[data-qbc-tile]')) {
        observer.observe(tile, { attributes: true, attributeFilter: ['style', 'class'] });
      }
      (window as unknown as { __qbcWrites: typeof record }).__qbcWrites = record;
    });
  }

  async tileMutationsPerFrame(): Promise<{ frame: number; writes: number }[]> {
    return this.page.evaluate(() => {
      const record = (window as unknown as { __qbcWrites: { frame: number }[] }).__qbcWrites;
      const byFrame = new Map<number, number>();
      for (const entry of record) byFrame.set(entry.frame, (byFrame.get(entry.frame) ?? 0) + 1);
      return [...byFrame.entries()].map(([frame, writes]) => ({ frame, writes }));
    });
  }

  async mutatedTileIds(): Promise<string[]> {
    return this.page.evaluate(() => {
      const record = (window as unknown as { __qbcWrites: { id: string }[] }).__qbcWrites;
      return [...new Set(record.map((entry) => entry.id))];
    });
  }

  async watchShadowMutations(): Promise<void> {
    await this.page.evaluate(() => {
      const store = window as unknown as { __qbcShadowWrites: number };
      store.__qbcShadowWrites = 0;
      const shadow = document.querySelector('[data-qbc-shadow]');
      if (shadow === null) return;
      new MutationObserver((mutations) => {
        store.__qbcShadowWrites += mutations.length;
      }).observe(shadow, { attributes: true, attributeFilter: ['style', 'data-valid'] });
    });
  }

  async shadowMutationCount(): Promise<number> {
    return this.page.evaluate(
      () => (window as unknown as { __qbcShadowWrites: number }).__qbcShadowWrites,
    );
  }

  /**
   * Counts reads of the properties that force the browser to lay out before answering.
   * A pointer event that reaches any of them has done layout work the budget forbids.
   */
  async watchLayoutReads(): Promise<void> {
    await this.page.evaluate(() => {
      const store = window as unknown as { __qbcLayoutReads: number };
      store.__qbcLayoutReads = 0;
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function patched(this: Element) {
        store.__qbcLayoutReads += 1;
        return original.call(this);
      };
      for (const name of ['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
        if (descriptor?.get === undefined) continue;
        const getter = descriptor.get;
        Object.defineProperty(HTMLElement.prototype, name, {
          ...descriptor,
          get(this: HTMLElement) {
            store.__qbcLayoutReads += 1;
            return getter.call(this);
          },
        });
      }
    });
  }

  async layoutReadCount(): Promise<number> {
    return this.page.evaluate(
      () => (window as unknown as { __qbcLayoutReads: number }).__qbcLayoutReads,
    );
  }

  /** Dispatches many pointer moves inside a single animation frame. */
  async dispatchPointerMovesInOneFrame(id: string, count: number): Promise<void> {
    await this.tile(id).evaluate(async (element, moves) => {
      const box = element.getBoundingClientRect();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          for (let step = 0; step < moves; step += 1) {
            element.dispatchEvent(
              new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                isPrimary: true,
                clientX: box.left + 10 + step * 7,
                clientY: box.top + 10,
              }),
            );
          }
          resolve();
        }),
      );
    }, count);
    await this.page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  }

  /** Moves and releases inside one frame, so the release outruns the scheduled write. */
  async moveAndReleaseInOneFrame(dx: number, dy: number): Promise<void> {
    const position = await this.pointerPosition();
    await this.page.evaluate(
      async ({ x, y }) => {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => {
            const target = document.elementFromPoint(
              Math.min(Math.max(x, 0), innerWidth - 1),
              Math.min(Math.max(y, 0), innerHeight - 1),
            );
            const options = { bubbles: true, pointerId: 1, isPrimary: true, clientX: x, clientY: y };
            (target ?? document.body).dispatchEvent(new PointerEvent('pointermove', options));
            (target ?? document.body).dispatchEvent(new PointerEvent('pointerup', options));
            resolve();
          }),
        );
      },
      { x: position.x + dx, y: position.y + dy },
    );
  }

  /** Moves and cancels inside one frame, leaving a scheduled write behind. */
  async moveAndCancelInOneFrame(dx: number, dy: number): Promise<void> {
    const position = await this.pointerPosition();
    await this.page.evaluate(
      async ({ x, y }) => {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => {
            const options = { bubbles: true, pointerId: 1, isPrimary: true, clientX: x, clientY: y };
            document.body.dispatchEvent(new PointerEvent('pointermove', options));
            dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            resolve();
          }),
        );
      },
      { x: position.x + dx, y: position.y + dy },
    );
    await this.page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  }

  async draggedTileHasOffset(id: string): Promise<boolean> {
    return this.tile(id).evaluate((element) => {
      const offset = element.style.getPropertyValue('--qbc-drag-offset-x');
      return offset !== '' || element.classList.contains('qbc-grid__tile--dragging');
    });
  }

  /**
   * Drags a tile for a fixed time and reports the main-thread work each frame spent on it.
   *
   * The quantity is work rather than the interval between frames. An unblocked 60Hz stream
   * presents every 1000/60 ms, or 16.667, so a budget of 16ms read as an interval fails a
   * run in which nothing was dropped at all.
   */
  async measureDragFrames(options: { seconds: number; runs: number }): Promise<
    { p95: number; max: number; samples: number }[]
  > {
    const results: { p95: number; max: number; samples: number }[] = [];
    // A warm-up run, discarded, so the first-run compilation cost is not measured.
    for (let run = 0; run <= options.runs; run += 1) {
      const measured = await this.measureOneDrag(options.seconds);
      if (run > 0) results.push(measured);
    }
    return results;
  }

  private async measureOneDrag(
    seconds: number,
  ): Promise<{ p95: number; max: number; samples: number }> {
    const box = await this.tile('tile-0').boundingBox();
    if (box === null) throw new Error('No tile to drag');
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 2 });

    const durations = await this.page.evaluate(
      async ({ duration, originX, originY }) => {
        const frames: number[] = [];
        const start = performance.now();
        let offset = 0;

        await new Promise<void>((resolve) => {
          const step = () => {
            const began = performance.now();

            // Drive the gesture from inside the frame, so the work being measured is the
            // work a moving pointer causes rather than an idle grid's.
            offset = (offset + 13) % 400;
            const x = originX + offset;
            const y = originY + (offset % 80);
            const target = document.elementFromPoint(
              Math.min(Math.max(x, 0), innerWidth - 1),
              Math.min(Math.max(y, 0), innerHeight - 1),
            );
            (target ?? document.body).dispatchEvent(
              new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                isPrimary: true,
                clientX: x,
                clientY: y,
              }),
            );

            // A task queued from inside the frame runs once the browser has finished
            // rendering it, so this span covers script, style, layout, and paint — the work
            // the frame did, rather than the interval until the next one. An unblocked 60Hz
            // stream presents every 1000/60 ms, and measuring that interval against a 16ms
            // budget fails a run in which nothing was dropped.
            setTimeout(() => frames.push(performance.now() - began), 0);

            if (performance.now() - start < duration) requestAnimationFrame(step);
            else setTimeout(resolve, 50);
          };
          requestAnimationFrame(step);
        });
        return frames.slice(1);
      },
      { duration: seconds * 1000, originX: box.x + box.width / 2, originY: box.y + box.height / 2 },
    );

    await this.page.mouse.up();

    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return {
      p95: sorted[index] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      samples: sorted.length,
    };
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
