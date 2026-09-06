import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  contentChild,
  inject,
  input,
  output,
} from '@angular/core';

import { GridMode } from './grid-mode';
import { GridTile } from './grid-tile';
import { GridTileTemplateDirective } from './grid-tile-template';
import { GridWidthObserver } from './grid-width-observer';
import { coerceGridOptions } from './coerce-grid-options';

/**
 * Arranges tiles on a cell-based grid. The layout reaches the grid as plain data and
 * leaves it the same way; the grid reads no store and injects no service of its own.
 */
@Component({
  selector: 'qbc-grid',
  imports: [NgTemplateOutlet],
  templateUrl: './grid.html',
  styleUrl: './grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-qbc-grid': '',
    tabindex: '-1',
    '[attr.data-mode]': 'mode()',
    '[attr.data-empty]': 'rowCount() === 0 ? "" : null',
    '[style.--qbc-grid-columns]': 'metrics().columns',
    '[style.--qbc-grid-column-width]': 'columnWidthPx()',
    '[style.--qbc-grid-row-height]': 'rowHeightPx()',
    '[style.--qbc-grid-gap]': 'gapPx()',
    '[style.--qbc-grid-rows]': 'rowCount()',
  },
})
export class GridComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly widthObserver = new GridWidthObserver();

  readonly layout = input.required<readonly GridTile[]>();
  readonly columns = input(12);
  readonly rowHeight = input(60);
  readonly gap = input(8);
  readonly mode = input<GridMode>('live');

  /**
   * The layout, emitted when a committed interaction, an add, a remove, or a repair
   * changes it. Every path that writes the layout routes through one gate, so this fires
   * in one place or not at all.
   */
  readonly layoutChange = output<GridTile[]>();

  protected readonly tileTemplate = contentChild(GridTileTemplateDirective);

  /** The tiles the grid currently holds, in the order it received them. */
  readonly tiles: typeof this.layout = this.layout;

  /** The metrics the grid renders with, derived from the configuration and the container. */
  readonly metrics = computed(() =>
    coerceGridOptions(this.columns(), this.rowHeight(), this.gap(), this.widthObserver.width()),
  );

  /**
   * The three grid properties carry lengths and the four tile properties carry unitless
   * numbers, because `calc()` multiplies a number by a length and rejects a length by a
   * length. The units are attached here so the stylesheet can rely on them.
   */
  protected readonly columnWidthPx = computed(() => `${this.metrics().columnWidth}px`);
  protected readonly rowHeightPx = computed(() => `${this.metrics().rowHeight}px`);
  protected readonly gapPx = computed(() => `${this.metrics().gap}px`);

  /**
   * The only list the template iterates, sorted by row, then column, then id. Position
   * comes from custom properties rather than document flow, so the sort has no visual
   * effect; it exists so document order matches reading order, which is what gives the tab
   * order its row-major sequence without a positive tabindex.
   */
  readonly orderedTiles = computed(() =>
    [...this.tiles()].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)),
  );

  /** The row the grid extends to, which is the row the lowest tile ends on. */
  readonly rowCount = computed(() =>
    this.tiles().reduce((lowest, tile) => Math.max(lowest, tile.y + tile.rows), 0),
  );

  constructor() {
    this.widthObserver.observe(this.host.nativeElement);
    inject(DestroyRef).onDestroy(() => this.widthObserver.disconnect());
  }
}
