import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Signal,
  Injector,
  afterNextRender,
  computed,
  contentChild,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';

import { GridMode } from './grid-mode';
import { GridTile } from './grid-tile';
import { GridTileTemplateDirective } from './grid-tile-template';
import { GridWidthObserver } from './grid-width-observer';
import { AddTileRequest } from './add-tile-request';
import { canPlace } from './can-place';
import { clampTile } from './clamp-tile';
import { coerceGridOptions } from './coerce-grid-options';
import { findFreeCell } from './find-free-cell';
import { layoutsEqual } from './layouts-equal';
import { normalizeLayout } from './normalize-layout';

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
  private readonly injector = inject(Injector);
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

  /** The metrics the grid renders with, derived from the configuration and the container. */
  readonly metrics = computed(() =>
    coerceGridOptions(this.columns(), this.rowHeight(), this.gap(), this.widthObserver.width()),
  );

  /**
   * The supplied layout, repaired. A fresh object every time the input or the column count
   * changes, which is what lets the repair report belong to the layout that arrived rather
   * than to a flag: two malformed layouts in a row are two repairs and two reports, and a
   * boolean recording only that the last one needed repair cannot tell them apart.
   */
  private readonly repair = computed(() =>
    normalizeLayout(this.layout(), this.metrics().columns),
  );

  /**
   * The tiles the grid holds. A linked signal rather than a computed one, because it is
   * read from two directions: a new layout from the host replaces it wholesale, and
   * `commit` writes it directly, so an interaction, an add, and a remove each change it
   * without a round trip through the host.
   */
  private readonly tileState = linkedSignal({
    source: () => this.repair(),
    computation: (repair) => repair.tiles,
  });

  /** Collaborators receive the tiles as a plain signal, so the write stays the grid's own. */
  readonly tiles: Signal<readonly GridTile[]> = this.tileState.asReadonly();

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

  /** Whether the grid offers interaction at all. */
  readonly editable = computed(() => this.mode() === 'edit');

  /**
   * The one predicate the pointer path, the keyboard path, and the tab order all consult.
   * A locked tile and `live` mode are the same answer here, which is what keeps the three
   * from drifting apart.
   */
  isInteractive(tile: GridTile): boolean {
    return this.editable() && tile.locked !== true;
  }

  /**
   * Tiles enter the tab order only where they can be operated. The order itself comes from
   * document order, which `orderedTiles` already sorts into reading order, so no positive
   * tabindex is needed to make it row-major.
   */
  protected tabIndexOf(tile: GridTile): number {
    return this.isInteractive(tile) ? 0 : -1;
  }

  /** The row the grid extends to, which is the row the lowest tile ends on. */
  readonly rowCount = computed(() =>
    this.tiles().reduce((lowest, tile) => Math.max(lowest, tile.y + tile.rows), 0),
  );

  constructor() {
    this.widthObserver.observe(this.host.nativeElement);
    inject(DestroyRef).onDestroy(() => this.widthObserver.disconnect());

    // Repair is reported for the layout that needed it. The computation itself is pure and
    // lazy, so the emission cannot happen there; this watches its result instead.
    effect(() => {
      const repair = this.repair();
      if (repair.repaired) untracked(() => this.layoutChange.emit(this.snapshot(repair.tiles)));
    });
  }

  /**
   * Adds a tile. A request naming a position takes it when the cells are free and falls
   * through to the first fitting position when they are not, so an add never overlaps and
   * never silently fails. A request repeating an id is refused outright, because the id is
   * how a host addresses the tile it already has.
   */
  addTile(request: AddTileRequest): void {
    const tiles = this.tileState();
    if (tiles.some((tile) => tile.id === request.id)) return;

    const columns = this.metrics().columns;
    const clamped = clampTile({ ...request, x: request.x ?? 0, y: request.y ?? 0 }, columns);

    const asked =
      request.x !== undefined && request.y !== undefined
        ? { x: clamped.x, y: clamped.y, cols: clamped.cols, rows: clamped.rows }
        : null;

    const cell =
      asked !== null && canPlace(tiles, asked, columns)
        ? asked
        : findFreeCell(tiles, clamped.cols, clamped.rows, columns);

    this.commit([...tiles, { ...clamped, ...cell }]);
  }

  /**
   * Removes the tile with the given id, leaving every other geometry as it was. An id the
   * grid does not hold is a no-op rather than an error.
   */
  removeTile(id: string): void {
    const tiles = this.tileState();
    if (!tiles.some((tile) => tile.id === id)) return;

    const destination = this.focusDestinationFor(id);
    this.commit(tiles.filter((tile) => tile.id !== id));
    if (destination !== null) {
      afterNextRender({ write: () => destination() }, { injector: this.injector });
    }
  }

  /**
   * Where focus goes when a removal takes it, and `null` when the removal does not.
   *
   * The grid renders no chrome of its own, so a removal control lives inside the tile's
   * own content and disappears with it. Focus would otherwise fall to the document and the
   * operator would lose their place. It is moved only when the removed subtree held it: a
   * removal triggered from somewhere else leaves focus where the operator put it.
   */
  private focusDestinationFor(id: string): (() => void) | null {
    const active = this.host.nativeElement.ownerDocument.activeElement;
    const removed = this.tileElement(id);
    if (removed === null || active === null || !removed.contains(active)) return null;

    const ordered = this.orderedTiles();
    const index = ordered.findIndex((tile) => tile.id === id);
    const following = ordered.slice(index + 1).find((tile) => this.isInteractive(tile));
    const preceding = [...ordered.slice(0, index)].reverse().find((tile) => this.isInteractive(tile));
    const neighbour = following ?? preceding;

    return () => {
      const target =
        neighbour === undefined ? this.host.nativeElement : this.tileElement(neighbour.id);
      (target ?? this.host.nativeElement).focus();
    };
  }

  private tileElement(id: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(
      `[data-qbc-tile="${CSS.escape(id)}"]`,
    );
  }

  /**
   * The one gate every change routes through. It adopts the proposed tiles and emits only
   * when something a host can observe moved.
   */
  private commit(next: readonly GridTile[]): void {
    if (layoutsEqual(this.tileState(), next)) return;
    this.tileState.set(next);
    this.layoutChange.emit(this.snapshot(next));
  }

  /**
   * A detached copy of the layout. Detaching is what keeps a host writing to what it
   * received from reaching the grid's own state; the records stay ordinary and mutable,
   * because freezing them would raise an error in the host's code instead.
   */
  private snapshot(tiles: readonly GridTile[]): GridTile[] {
    return tiles.map((tile) => ({ ...tile }));
  }
}
