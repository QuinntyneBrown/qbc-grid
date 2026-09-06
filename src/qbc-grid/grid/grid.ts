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
  signal,
  untracked,
} from '@angular/core';

import { GridMode } from './grid-mode';
import { GridTile } from './grid-tile';
import { GridTileTemplateDirective } from './grid-tile-template';
import { GridWidthObserver } from './grid-width-observer';
import { AddTileRequest } from './add-tile-request';
import { GridCell } from './grid-cell';
import { GridFrameScheduler } from './grid-frame-scheduler';
import { GridGestureCache } from './grid-gesture-cache';
import { GridInteraction } from './grid-interaction';
import { GridInteractionKind } from './grid-interaction-kind';
import { GridPointerSession } from './grid-pointer-session';
import { GridShadow } from './grid-shadow';
import { GridCommandOutcome } from './grid-command-outcome';
import { accessibleNameOf } from './accessible-name-of';
import { announcementFor } from './announcement-for';
import { canPlace } from './can-place';
import { cellAt } from './cell-at';
import { gridKeyboardCandidate } from './grid-keyboard-candidate';
import { clampSpan } from './clamp-span';
import { spanAt } from './span-at';
import { clampTile } from './clamp-tile';
import { coerceGridOptions } from './coerce-grid-options';
import { rectOf } from './rect-of';
import { findFreeCell } from './find-free-cell';
import { layoutsEqual } from './layouts-equal';
import { normalizeLayout } from './normalize-layout';

/** Instruction elements are identified per grid, so two grids on a page describe themselves. */
let gridInstances = 0;
const nextGridId = (): number => (gridInstances += 1);

/**
 * Where a press belongs to the content rather than to the grid. A control, a field, an
 * editable region, or a link owns its own input, and a press landing on one starts no
 * gesture and suppresses nothing.
 */
/**
 * How long a run of keyboard commands stays open with no further command. It is an
 * interval the component keeps rather than a motion token, so a request for reduced motion
 * shortens the animations and leaves the run alone.
 */
const SETTLE_MS = 400;

const INTERACTIVE_DESCENDANTS =
  'button, input, select, textarea, a[href], [contenteditable], [role="button"], [role="slider"], [role="textbox"]';

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
    role: 'group',
    'aria-roledescription': 'dashboard grid',
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
  private readonly scheduler = new GridFrameScheduler();
  private readonly session = new GridPointerSession({
    measure: (kind, tile, pressX, pressY) => this.measureGesture(kind, tile, pressX, pressY),
    propose: (kind, tile, event) => this.proposeCell(kind, tile, event),
    schedule: (write) => this.scheduler.schedule(write),
    paint: (interaction) => this.paintPreview(interaction),
    clear: () => this.clearPreview(),
    settle: (cell, tileId) => this.settleGesture(cell, tileId),
  });
  private dragged: HTMLElement | null = null;
  private run: {
    tileId: string;
    kind: GridInteractionKind;
    cell: GridCell;
    outcome: GridCommandOutcome;
  } | null = null;
  private runTimer: ReturnType<typeof setTimeout> | null = null;
  private announcedSlot = 1;

  /** The identifier of this grid's own instructions, so two grids on a page differ. */
  protected readonly instructionsId = `qbc-grid-instructions-${nextGridId()}`;

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

  /** The pair of polite live regions, written alternately with the region beside cleared. */
  protected readonly announcements = signal<readonly [string, string]>(['', '']);

  /** Whether a run of keyboard commands is still open, which is what keeps the overlay up. */
  protected readonly settling = signal(false);

  /** The rectangle a release would take, and whether those cells are free. */
  readonly shadow = computed<GridShadow | null>(() => this.session.interaction()?.shadow ?? null);

  /**
   * The overlay is shown for the duration of an interaction and removed when it ends,
   * whether the interaction committed or reverted.
   */
  readonly overlayVisible = computed(
    () => this.session.interaction() !== null || this.settling(),
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

  /** The name assistive technology reads for a tile. */
  protected nameOf(tile: GridTile): string {
    return accessibleNameOf(tile);
  }

  /** Begins a press on a tile, which becomes a drag once the pointer has travelled far enough. */
  protected onPointerDown(bound: GridTile, event: PointerEvent): void {
    if (!this.isInteractive(bound)) return;
    // A press that lands on a control or a field belongs to that descendant, not the grid.
    if (this.ownsPress(event) === false) return;
    const tile = this.tileState().find((held) => held.id === bound.id);
    if (tile !== undefined) this.session.press('move', tile, event);
  }

  /**
   * Runs one keyboard command, and keeps the run it belongs to open.
   *
   * The key is consumed only while the tile element itself holds focus, so an arrow inside
   * a projected field moves the caret and an arrow inside a slider changes its value, and
   * the tile stays where it is. A pointer gesture in flight owns the tile, so a command
   * arriving during one is refused rather than racing it.
   */
  protected onKeyDown(bound: GridTile, event: KeyboardEvent): void {
    if (!this.isInteractive(bound) || this.session.isActive) return;
    if (event.target !== this.tileElement(bound.id)) return;

    // The template binding holds the tile as the last render saw it, and a commit writes
    // state before that render happens. A second command arriving inside the same frame
    // would otherwise propose the cell the first one already took, find it free because a
    // tile never blocks itself, and commit a change of nothing.
    const tile = this.tileState().find((held) => held.id === bound.id);
    if (tile === undefined) return;

    const columns = this.metrics().columns;
    const candidate = gridKeyboardCandidate(event, tile, this.tileState(), columns);
    if (candidate === null) return;
    event.preventDefault();

    const { kind, cell } = candidate;
    const unchanged =
      cell.x === tile.x && cell.y === tile.y && cell.cols === tile.cols && cell.rows === tile.rows;

    let outcome: GridCommandOutcome;
    if (unchanged) {
      outcome = kind === 'resize' ? 'blocked-limit' : 'blocked-bounds';
    } else if (!canPlace(this.tileState(), cell, columns, tile.id)) {
      outcome = 'blocked-occupied';
    } else {
      outcome = 'accepted';
      this.commit(
        this.tileState().map((held) =>
          held.id === tile.id ? { ...held, ...cell } : held,
        ),
      );
      afterNextRender(
        { read: () => this.tileElement(tile.id)?.scrollIntoView({ block: 'nearest' }) },
        { injector: this.injector },
      );
    }

    this.openRun(tile.id, kind, outcome === 'accepted' ? cell : tile, outcome);
  }

  /**
   * Opens or extends the run this command belongs to.
   *
   * A held arrow commits at the keyboard's repeat rate, and a polite region queues rather
   * than interrupts, so announcing each step would read a backlog of positions the tile
   * passed through minutes after it stopped at the last of them. A second command extends
   * the window rather than opening another, so a run reveals the grid once, hides it once,
   * and is announced once.
   */
  private openRun(
    tileId: string,
    kind: GridInteractionKind,
    cell: GridCell,
    outcome: GridCommandOutcome,
  ): void {
    this.run = { tileId, kind, cell, outcome };
    this.settling.set(true);
    if (this.runTimer !== null) clearTimeout(this.runTimer);
    this.runTimer = setTimeout(() => this.closeRun(), SETTLE_MS);
  }

  /** Closes a run, whether the key was released, focus was lost, or the interval passed. */
  protected closeRun(): void {
    if (this.runTimer !== null) clearTimeout(this.runTimer);
    this.runTimer = null;
    this.settling.set(false);

    const run = this.run;
    this.run = null;
    if (run === null) return;

    const tile = this.tileState().find((held) => held.id === run.tileId);
    const resting = tile === undefined ? run.cell : tile;
    const text = announcementFor(
      accessibleNameOf(tile ?? { id: run.tileId, ...run.cell }),
      run.kind,
      run.kind === 'move' ? resting : run.cell,
      run.outcome,
    );

    // A live region speaks when its contents change, and alternation alone covers two
    // repeats: the third write returns to the region that received the first, which
    // already holds that sentence, so nothing is spoken. Clearing the region not being
    // written makes the next write to it a change whatever the text says.
    this.announcedSlot = this.announcedSlot === 0 ? 1 : 0;
    this.announcements.set(this.announcedSlot === 0 ? [text, ''] : ['', text]);
  }

  /**
   * Begins a resize. The press stops here rather than reaching the tile beneath it, so a
   * press on the handle starts a resize and never a move.
   */
  protected onHandlePointerDown(bound: GridTile, event: PointerEvent): void {
    if (!this.isInteractive(bound)) return;
    event.stopPropagation();
    const tile = this.tileState().find((held) => held.id === bound.id);
    if (tile !== undefined) this.session.press('resize', tile, event);
  }

  /**
   * Whether the press belongs to the grid rather than to something inside the tile.
   *
   * Restoring selection when a gesture ends does not leave projected content usable: the
   * next attempt to select is a press and a drag across the same surface, it crosses the
   * same threshold, and it starts another drag. So ownership is decided by where the press
   * lands, and an interactive or editable descendant keeps its own input.
   */
  private ownsPress(event: PointerEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return true;
    return target.closest(INTERACTIVE_DESCENDANTS) === null;
  }

  private measureGesture(
    kind: GridInteractionKind,
    tile: GridTile,
    pressX: number,
    pressY: number,
  ): GridGestureCache {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const metrics = this.metrics();
    const origin = rectOf(tile, metrics);

    // A move measures the press against the corner the tile carries; a resize measures it
    // against the corner the operator drags. That is what lets a press anywhere inside the
    // handle's target start the gesture at the span the tile already has, rather than
    // jumping it by the distance between the press and the corner.
    const anchorX = kind === 'move' ? origin.left : origin.left + origin.width;
    const anchorY = kind === 'move' ? origin.top : origin.top + origin.height;

    return {
      gridLeft: rect.left,
      gridTop: rect.top,
      columnWidth: metrics.columnWidth,
      rowHeight: metrics.rowHeight,
      gap: metrics.gap,
      columns: metrics.columns,
      grabOffsetX: pressX - rect.left - anchorX,
      grabOffsetY: pressY - rect.top - anchorY,
    };
  }

  /**
   * Derives the cell a release would take from the cached measurement alone. No element is
   * read here, which is what keeps a pointer event free of layout work.
   */
  private proposeCell(
    kind: GridInteractionKind,
    tile: GridTile,
    event: PointerEvent,
  ): GridInteraction {
    const cache =
      this.session.gestureCache ??
      this.measureGesture(kind, tile, event.clientX, event.clientY);
    const metrics = {
      columns: cache.columns,
      columnWidth: cache.columnWidth,
      rowHeight: cache.rowHeight,
      gap: cache.gap,
    };
    const origin = { x: tile.x, y: tile.y, cols: tile.cols, rows: tile.rows };

    const box = rectOf(origin, metrics);

    let cell: GridCell;
    let lift: GridInteraction['lift'];
    if (kind === 'move') {
      const left = event.clientX - cache.gridLeft - cache.grabOffsetX;
      const top = event.clientY - cache.gridTop - cache.grabOffsetY;
      cell = cellAt(left, top, origin, metrics);
      lift = { x: left - box.left, y: top - box.top, width: box.width, height: box.height };
    } else {
      const width = event.clientX - cache.gridLeft - cache.grabOffsetX - box.left;
      const height = event.clientY - cache.gridTop - cache.grabOffsetY - box.top;
      // Clamping never invalidates the shadow: a span held at a limit is one the operator
      // can commit, where a span reaching over a neighbour is not.
      cell = clampSpan(tile, spanAt(width, height, origin, metrics), cache.columns);
      lift = { x: 0, y: 0, width: Math.max(1, width), height: Math.max(1, height) };
    }

    return {
      kind,
      tileId: tile.id,
      origin,
      pointerId: event.pointerId,
      shadow: { cell, valid: canPlace(this.tileState(), cell, cache.columns, tile.id) },
      lift,
    };
  }

  /**
   * Paints the preview. This runs inside the scheduled write, so it applies once a frame
   * however many pointer events arrived. The tile follows the pointer in pixels while the
   * shadow snaps to cells, and those two elements are the whole per-frame cost whatever
   * the tile count.
   */
  private paintPreview(interaction: GridInteraction): void {
    {
      const element = this.tileElement(interaction.tileId);
      if (element === null) return;

      // The elevation and the compositor promotion ride on one class, taken once when the
      // gesture starts and dropped once when it ends. Adding it every frame would cost a
      // second attribute write per frame: `classList.add` rewrites the attribute whether or
      // not the token was already there.
      if (this.dragged !== element) {
        this.dragged = element;
        element.classList.add('qbc-grid__tile--dragging');
      }
      // The tile follows the pointer in pixels; the shadow snaps. Writing the snapped
      // geometry here as well would make the lift stutter and say nothing the shadow was
      // not already saying.
      if (interaction.kind === 'move') {
        element.style.setProperty(
          '--qbc-drag-offset',
          `${interaction.lift.x}px ${interaction.lift.y}px`,
        );
      } else {
        element.style.setProperty('--qbc-drag-width', `${interaction.lift.width}px`);
        element.style.setProperty('--qbc-drag-height', `${interaction.lift.height}px`);
      }
    }
  }

  /** Drops everything the gesture put on the screen, including its compositor promotion. */
  private clearPreview(): void {
    this.scheduler.stop();
    const element = this.dragged;
    this.dragged = null;
    if (element === null) return;

    // The tile settles back to the geometry it held. The transition is carried by a class
    // added here and dropped once it is over, so the drag itself is never transitioned.
    element.classList.add('qbc-grid__tile--settling');
    setTimeout(() => element.classList.remove('qbc-grid__tile--settling'), SETTLE_MS);

    element.classList.remove('qbc-grid__tile--dragging');
    element.style.removeProperty('--qbc-drag-offset');
    element.style.removeProperty('--qbc-drag-width');
    element.style.removeProperty('--qbc-drag-height');
  }

  /**
   * Adopts the resolved cell, or leaves the committed geometry as it was. A drop landing
   * on the cells it started from reaches `commit` and emits nothing, because nothing moved.
   */
  private settleGesture(cell: GridCell | null, tileId: string): void {
    if (cell === null) return;
    this.commit(
      this.tileState().map((tile) =>
        tile.id === tileId
          ? { ...tile, x: cell.x, y: cell.y, cols: cell.cols, rows: cell.rows }
          : tile,
      ),
    );
  }

  /** The row the grid extends to, which is the row the lowest tile ends on. */
  readonly rowCount = computed(() =>
    this.tiles().reduce((lowest, tile) => Math.max(lowest, tile.y + tile.rows), 0),
  );

  constructor() {
    this.widthObserver.observe(this.host.nativeElement);
    inject(DestroyRef).onDestroy(() => {
      this.widthObserver.disconnect();
      this.scheduler.stop();
      this.session.destroy();
      if (this.runTimer !== null) clearTimeout(this.runTimer);
    });

    // Repair is reported for the layout that needed it. The computation itself is pure and
    // lazy, so the emission cannot happen there; this watches its result instead.
    effect(() => {
      const repair = this.repair();
      if (repair.repaired) untracked(() => this.layoutChange.emit(this.snapshot(repair.tiles)));
    });

    // A gesture holds a proposed cell and a measurement of the grid it was proposed
    // against. A host replacing the layout, changing the configuration, leaving edit mode,
    // or locking the tile under the pointer leaves that proposal describing a grid that no
    // longer exists, and committing it afterwards would overwrite the state the host has
    // just supplied with a drop computed against the state it replaced. The operator loses
    // a drag they can repeat; the alternative loses an update they cannot.
    //
    // A change of container width is deliberately not among these. Nothing the host
    // believes has changed there — the same layout in the same columns over different
    // pixels — so `L2-030` has the gesture carry on against a rebased measurement.
    effect(() => {
      this.layout();
      this.columns();
      this.rowHeight();
      this.gap();
      this.editable();
      // Reaching here at all means one of those changed, so an active gesture is stale.
      untracked(() => this.session.cancel());
    });

    // A container-width change is the one thing a gesture survives, because the layout and
    // the columns are the ones it was proposed against — only the pixels beneath them
    // differ. The grab offset is rebased with the metrics: a column width that changed
    // under a lifted tile moved the corner the offset was measured from, and refreshing one
    // without the other slides the tile out from under the cursor.
    effect(() => {
      this.widthObserver.width();
      untracked(() => {
        const cache = this.session.gestureCache;
        const dragged = this.tileState().find((tile) => tile.id === this.session.tileId);
        if (cache === null || dragged === undefined) return;
        const metrics = this.metrics();
        const rect = this.host.nativeElement.getBoundingClientRect();

        // The offset holds its fraction of the tile, so the cursor keeps the spot it
        // grabbed. The tile's own width is what scales, not the column pitch: a tile
        // spanning three columns carries two gaps that do not scale with them.
        const before = rectOf(dragged, {
          columns: cache.columns,
          columnWidth: cache.columnWidth,
          rowHeight: cache.rowHeight,
          gap: cache.gap,
        }).width;
        const after = rectOf(dragged, metrics).width;
        const scale = before > 0 ? after / before : 1;

        this.session.rebase({
          gridLeft: rect.left,
          gridTop: rect.top,
          columnWidth: metrics.columnWidth,
          rowHeight: metrics.rowHeight,
          gap: metrics.gap,
          columns: metrics.columns,
          grabOffsetX: cache.grabOffsetX * scale,
          grabOffsetY: cache.grabOffsetY,
        });
      });
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
