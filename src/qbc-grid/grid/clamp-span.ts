import { GridCell } from './grid-cell';
import { GridTile } from './grid-tile';
import { MAX_ROW } from './max-row';

/**
 * Applies a tile's declared size limits to a proposed span, and bounds it by the width
 * left of its own origin.
 *
 * This is `clampTile`'s sibling, and the difference is the origin. `clampTile` repairs a
 * record arriving from storage, where an oversized span is corrected by narrowing the tile
 * and, where that is not enough, by moving it back inside the grid. A resize has no such
 * freedom: the origin corner is the one the operator is not dragging, and moving it turns a
 * resize into a move. A tile at column 9 of twelve grown without limit stops at 3 columns;
 * `clampTile` would widen it to 12 and slide it to column 0.
 *
 * The two share every numeric rule and differ in the one that cannot be shared.
 */
export function clampSpan(tile: GridTile, span: GridCell, columns: number): GridCell {
  const widthLeft = Math.max(1, columns - span.x);

  let cols = Math.max(1, Math.floor(span.cols));
  let rows = Math.max(1, Math.floor(span.rows));

  if (tile.minCols !== undefined) cols = Math.max(cols, tile.minCols);
  if (tile.minRows !== undefined) rows = Math.max(rows, tile.minRows);
  if (tile.maxCols !== undefined) cols = Math.min(cols, Math.max(tile.maxCols, tile.minCols ?? 1));
  if (tile.maxRows !== undefined) rows = Math.min(rows, Math.max(tile.maxRows, tile.minRows ?? 1));

  return {
    x: span.x,
    y: span.y,
    cols: Math.min(cols, widthLeft),
    rows: Math.min(rows, MAX_ROW),
  };
}
