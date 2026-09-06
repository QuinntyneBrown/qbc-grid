import { GridCell } from './grid-cell';

/**
 * Whether two cell rectangles share any cell. Edges that touch do not overlap: a tile
 * ending at column 3 and a tile starting at column 3 sit side by side.
 */
export function overlaps(a: GridCell, b: GridCell): boolean {
  return (
    a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows
  );
}
