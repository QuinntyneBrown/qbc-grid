import { Signal, signal } from '@angular/core';

import { GridCell } from './grid-cell';
import { GridGestureCache } from './grid-gesture-cache';
import { GridInteraction } from './grid-interaction';
import { GridInteractionKind } from './grid-interaction-kind';
import { GridTile } from './grid-tile';

/** What the session is doing with the pointer that pressed a tile. */
type SessionPhase = 'idle' | 'pressed' | 'active';

/** How far the pointer travels before a press becomes a drag. */
const THRESHOLD = 3;

/** What the session needs from the component to run a gesture. */
export interface GridSessionHost {
  /**
   * Measures the grid and the grab offset once. The offset is taken from where the press
   * landed, not from where the gesture became active: activation happens on the first move
   * past the threshold, and a pointer arriving in one large step is already far from the
   * corner the offset describes.
   */
  measure(
    kind: GridInteractionKind,
    tile: GridTile,
    pressX: number,
    pressY: number,
  ): GridGestureCache;
  /** Derives the cell a release would take, and whether it is free. */
  propose(kind: GridInteractionKind, tile: GridTile, event: PointerEvent): GridInteraction;
  /** Runs a write on the next animation frame, replacing any write already waiting. */
  schedule(write: () => void): void;
  /** Paints the preview. Called from inside a scheduled write, never from a handler. */
  paint(interaction: GridInteraction): void;
  /** Clears everything a gesture put on the screen. */
  clear(): void;
  /** Adopts the cell a release resolved for a tile, or reverts when it resolved nothing. */
  settle(cell: GridCell | null, tileId: string): void;
}

/**
 * Recognizes the gesture, and owns every way it can end.
 *
 * The session is idle, pressed, or active. A press records where it started and takes no
 * capture; it becomes a gesture when the pointer has travelled far enough. That middle
 * state is the one the design had no name for, and events arrive in it: a press one pixel
 * inside a tile edge is followed by a move already outside the tile, and a listener bound
 * to the tile never sees the move that crosses the threshold. So the pressed state listens
 * on the document, and stops the moment it resolves in either direction.
 */
export class GridPointerSession {
  private phase: SessionPhase = 'idle';
  private tile: GridTile | null = null;
  private kind: GridInteractionKind = 'move';
  private pointerId = -1;
  private startX = 0;
  private startY = 0;
  private captured: HTMLElement | null = null;
  private detach: (() => void)[] = [];
  private cache: GridGestureCache | null = null;
  private latest: PointerEvent | null = null;

  private readonly current = signal<GridInteraction | null>(null);

  readonly interaction: Signal<GridInteraction | null> = this.current.asReadonly();

  constructor(private readonly host: GridSessionHost) {}

  /** The measurement taken at gesture start, refreshed only when the container width changes. */
  get gestureCache(): GridGestureCache | null {
    return this.cache;
  }

  /** Whether a gesture is running, as opposed to a press that has not become one. */
  get isActive(): boolean {
    return this.phase === 'active';
  }

  /** The id of the tile under gesture, so a host change can ask whether it concerns this one. */
  get tileId(): string | null {
    return this.tile?.id ?? null;
  }

  /**
   * Replaces the cached geometry mid-gesture, which only a container-width change does.
   * The grab offset is rebased with the metrics, because a column width that changed under
   * a lifted tile moves the corner the offset was measured against.
   */
  rebase(cache: GridGestureCache): void {
    if (this.phase !== 'active') return;
    this.cache = cache;
    // No pointer event follows a container resize, so without this the preview would keep
    // showing the cell the old column width chose and only catch up on the next move.
    this.host.schedule(() => this.applyFrame());
  }

  press(kind: GridInteractionKind, tile: GridTile, event: PointerEvent): void {
    // Only the primary button drags, and a session already running owns the pointer.
    if (this.phase !== 'idle' || event.button !== 0) return;
    const element = this.tileElementOf(event);
    if (element === null) return;

    this.phase = 'pressed';
    this.kind = kind;
    this.tile = tile;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.captured = element;

    const doc = element.ownerDocument;
    this.listen(doc, 'pointermove', (moved) => this.track(moved as PointerEvent));
    this.listen(doc, 'pointerup', (released) => this.finish(released as PointerEvent));
    this.listen(doc, 'pointercancel', (cancelled) => {
      if ((cancelled as PointerEvent).pointerId === this.pointerId) this.cancel();
    });
  }

  private track(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId || this.tile === null) return;

    if (this.phase === 'pressed') {
      const travelled = Math.hypot(event.clientX - this.startX, event.clientY - this.startY);
      if (travelled < THRESHOLD) return;
      this.activate();
    }
    if (this.phase !== 'active') return;

    // The event records its sample and asks for a frame. Deriving the candidate and
    // scanning for occupancy here would do that work once per event, which is twenty times
    // for a frame that paints once; the frame does it against the last sample it received.
    this.latest = event;
    this.host.schedule(() => this.applyFrame());
  }

  private applyFrame(): void {
    const event = this.latest;
    if (event === null || this.tile === null || this.phase !== 'active') return;
    const interaction = this.host.propose(this.kind, this.tile, event);
    this.current.set(interaction);
    this.host.paint(interaction);
  }

  private activate(): void {
    this.phase = 'active';
    this.cache = this.host.measure(this.kind, this.tile!, this.startX, this.startY);

    // Capture routes every later event for this pointer to the tile even once the cursor
    // has left it, which is why no window-level pointer listener is needed past this point.
    if (this.captured !== null) {
      this.captured.setPointerCapture(this.pointerId);
      this.listen(this.captured, 'lostpointercapture', () => this.onCaptureLost());
      const view = this.captured.ownerDocument.defaultView;
      if (view !== null) {
        this.listen(view, 'blur', () => this.cancel());
        this.listen(view, 'keydown', (key) => {
          if ((key as KeyboardEvent).key === 'Escape') this.cancel();
        });
      }
      this.listen(this.captured.ownerDocument, 'dragstart', (drag) => drag.preventDefault());
    }
  }

  /**
   * Ends the gesture the way a release ends it. The release holds a sample newer than
   * anything queued, so it resolves its own rather than flushing what was scheduled.
   */
  private finish(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    if (this.phase !== 'active') {
      this.reset();
      return;
    }
    const tile = this.tile;
    const proposed = tile === null ? null : this.host.propose(this.kind, tile, event);
    const target = proposed?.shadow.valid === true ? proposed.shadow.cell : null;
    this.reset();
    if (tile !== null) this.host.settle(target, tile.id);
  }

  /**
   * Capture loss the grid did not cause. The browser raises this when the captured element
   * leaves the document, which removing a dragged tile does deliberately, and raises it
   * again after every release the grid performs itself — by which time the phase is idle
   * and there is nothing to cancel, so handling it twice is safe.
   */
  private onCaptureLost(): void {
    if (this.phase === 'active') this.cancel();
  }

  /** Ends the gesture with nothing adopted, whatever state it was in. */
  cancel(): void {
    if (this.phase === 'idle') return;
    const tile = this.tile;
    const wasActive = this.phase === 'active';
    this.reset();
    if (wasActive && tile !== null) this.host.settle(null, tile.id);
  }

  destroy(): void {
    this.reset();
  }

  private reset(): void {
    for (const off of this.detach) off();
    this.detach = [];
    if (this.captured !== null && this.captured.hasPointerCapture(this.pointerId)) {
      this.captured.releasePointerCapture(this.pointerId);
    }
    this.captured = null;
    this.latest = null;
    this.phase = 'idle';
    this.tile = null;
    this.pointerId = -1;
    this.cache = null;
    this.current.set(null);
    this.host.clear();
  }

  private tileElementOf(event: PointerEvent): HTMLElement | null {
    return event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>('[data-qbc-tile]')
      : null;
  }

  private listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    this.detach.push(() => target.removeEventListener(type, handler));
  }
}
