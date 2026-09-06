/**
 * A request to add a tile. Omitting `x` and `y` leaves the placement to the grid,
 * which takes the first position the tile fits in row-major order.
 */
export interface AddTileRequest {
  id: string;
  cols: number;
  rows: number;
  x?: number;
  y?: number;
  locked?: boolean;
  label?: string;
  minCols?: number;
  minRows?: number;
  maxCols?: number;
  maxRows?: number;
}
