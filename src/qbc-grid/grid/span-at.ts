import { GridCell } from './grid-cell';
import { GridMetrics } from './grid-metrics';

/**
 * The whole-cell span a pixel size rounds to, relative to a pinned origin.
 *
 * The size is the tile's own rendered size plus however far the pointer has travelled
 * since the press, so pressing anywhere inside the handle's target starts the gesture at
 * the span the tile already has. Treating the pointer position as the corner would instead
 * jump the tile by the distance between the press and that corner, which is up to the
 * whole width of a target the requirement asks to be at least 24 pixels across.
 */
export function spanAt(
  width: number,
  height: number,
  origin: GridCell,
  metrics: GridMetrics,
): GridCell {
  const columnPitch = metrics.columnWidth + metrics.gap;
  const rowPitch = metrics.rowHeight + metrics.gap;

  const cols = columnPitch > 0 ? Math.round((width + metrics.gap) / columnPitch) : origin.cols;
  const rows = rowPitch > 0 ? Math.round((height + metrics.gap) / rowPitch) : origin.rows;

  return {
    x: origin.x,
    y: origin.y,
    cols: Math.max(1, cols),
    rows: Math.max(1, rows),
  };
}
