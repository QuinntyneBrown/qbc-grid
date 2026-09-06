import { GridCell } from './grid-cell';
import { GridMetrics } from './grid-metrics';
import { Rectangle } from './rectangle';

/**
 * The pixel box a cell rectangle occupies. Every edge is derived from the unrounded
 * column width, so the last column in a row stays flush with the container rather than
 * drifting by the rounding of each tile before it.
 */
export function rectOf(cell: GridCell, metrics: GridMetrics): Rectangle {
  const { columnWidth, rowHeight, gap } = metrics;
  return {
    left: cell.x * (columnWidth + gap),
    top: cell.y * (rowHeight + gap),
    width: cell.cols * columnWidth + (cell.cols - 1) * gap,
    height: cell.rows * rowHeight + (cell.rows - 1) * gap,
  };
}
