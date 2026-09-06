import { GridCell } from './grid-cell';
import { GridTile } from './grid-tile';
import { canPlace } from './can-place';

/**
 * The first position in row-major order where a span of `cols` by `rows` fits, or column
 * zero on the first row below the lowest occupied row when none does.
 *
 * Only a handful of rows are worth testing. If a span fits at row `y`, and no tile ends at
 * `y`, then it fits at `y - 1` as well: the tiles covering the two rows are the same set,
 * because a tile covering `y - 1` and not `y` is a tile that ends at `y`. The first fit in
 * row-major order is therefore always at row zero or immediately below some tile's bottom
 * edge, and there are at most as many of those as there are tiles.
 *
 * That is what keeps the search bounded by the records rather than by the coordinates they
 * carry. Walking row by row to the lowest occupied row is bounded too, on paper, and a
 * single tile declaring a billion rows makes that bound worthless.
 */
export function findFreeCell(
  tiles: readonly GridTile[],
  cols: number,
  rows: number,
  columns: number,
): GridCell {
  const span = Math.max(1, Math.min(cols, columns));
  const height = Math.max(1, rows);
  const lowest = tiles.reduce((low, tile) => Math.max(low, tile.y + tile.rows), 0);

  const candidateRows = [...new Set([0, ...tiles.map((tile) => tile.y + tile.rows)])].sort(
    (a, b) => a - b,
  );

  for (const y of candidateRows) {
    if (y > lowest) break;
    for (let x = 0; x + span <= columns; x += 1) {
      const candidate = { x, y, cols: span, rows: height };
      if (canPlace(tiles, candidate, columns)) return candidate;
    }
  }

  return { x: 0, y: lowest, cols: span, rows: height };
}
