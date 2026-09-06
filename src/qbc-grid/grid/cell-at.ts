import { GridCell } from './grid-cell';
import { GridMetrics } from './grid-metrics';

/**
 * The cell nearest a lifted tile's top-left corner, clamped into the grid.
 *
 * Clamping inside the snap is why dragging far past an edge parks the shadow at the edge
 * rather than marking it invalid: leaving the grid is not a collision, and an operator who
 * overshoots is told where the tile would land rather than that it cannot.
 */
export function cellAt(
  left: number,
  top: number,
  span: GridCell,
  metrics: GridMetrics,
): GridCell {
  const columnPitch = metrics.columnWidth + metrics.gap;
  const rowPitch = metrics.rowHeight + metrics.gap;

  const x = columnPitch > 0 ? Math.round(left / columnPitch) : 0;
  const y = rowPitch > 0 ? Math.round(top / rowPitch) : 0;

  return {
    x: Math.min(Math.max(0, x), Math.max(0, metrics.columns - span.cols)),
    y: Math.max(0, y),
    cols: span.cols,
    rows: span.rows,
  };
}
