/**
 * Collapses any number of pointer events in one animation frame into a single write.
 *
 * `schedule` replaces the pending write rather than queueing beside it, and requests a
 * frame only when none is outstanding, so twenty events in a frame produce one write. The
 * write itself carries the whole per-frame job: the candidate is derived and tested inside
 * it rather than in the handler, because scanning per event does that work twenty times
 * for a frame that paints once.
 */
export class GridFrameScheduler {
  private handle: number | null = null;
  private pending: (() => void) | null = null;

  schedule(write: () => void): void {
    this.pending = write;
    if (this.handle !== null) return;
    this.handle = requestAnimationFrame(() => {
      this.handle = null;
      const due = this.pending;
      this.pending = null;
      due?.();
    });
  }

  /**
   * Cancels the outstanding frame and drops the write it was going to apply.
   *
   * Release uses this rather than flushing. The queued write holds the preview from the
   * frame before, and the release holds a pointer sample newer than it: applying the stale
   * one paints a position the operator has already moved past, and applying it after the
   * commit paints a preview over a finished drag.
   */
  stop(): void {
    if (this.handle !== null) cancelAnimationFrame(this.handle);
    this.handle = null;
    this.pending = null;
  }
}
