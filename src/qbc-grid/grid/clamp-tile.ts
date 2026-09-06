import { GridTile } from './grid-tile';
import { MAX_ROW } from './max-row';

/** Floors a value to a finite integer, substituting `fallback` for anything else. */
function integerOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
}

/** A declared size limit survives only as a finite integer of at least one. */
function limitOf(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const floored = Math.floor(value);
  return floored >= 1 ? floored : undefined;
}

/**
 * Repairs one supplied record into a tile the grid can render: coerces its numbers,
 * resolves its size limits, and clamps its span and coordinates into range.
 *
 * Where a span no longer fits the grid this narrows the tile and, where that is not
 * enough, moves it back inside. That relocation is what makes this the wrong function for
 * a resize, which pins the origin the operator is not dragging; `clampSpan` is its
 * sibling for that case.
 */
export function clampTile(tile: GridTile, columns: number): GridTile {
  const minCols = limitOf(tile.minCols);
  const minRows = limitOf(tile.minRows);
  // A maximum below its own minimum is raised to it, so the pair cannot describe a tile
  // that can be neither grown nor shrunk.
  const maxCols = limitOf(tile.maxCols);
  const maxRows = limitOf(tile.maxRows);
  const resolvedMaxCols =
    maxCols === undefined ? undefined : Math.max(maxCols, minCols ?? 1);
  const resolvedMaxRows =
    maxRows === undefined ? undefined : Math.max(maxRows, minRows ?? 1);

  let cols = Math.max(1, integerOr(tile.cols, 1));
  let rows = Math.max(1, integerOr(tile.rows, 1));
  if (minCols !== undefined) cols = Math.max(cols, minCols);
  if (minRows !== undefined) rows = Math.max(rows, minRows);
  if (resolvedMaxCols !== undefined) cols = Math.min(cols, resolvedMaxCols);
  if (resolvedMaxRows !== undefined) rows = Math.min(rows, resolvedMaxRows);

  cols = Math.min(cols, columns);
  rows = Math.min(rows, MAX_ROW);

  const x = Math.min(Math.max(0, integerOr(tile.x, 0)), columns - cols);
  const y = Math.min(Math.max(0, integerOr(tile.y, 0)), MAX_ROW);

  const repaired: GridTile = { id: tile.id, x, y, cols, rows };
  if (tile.locked === true) repaired.locked = true;
  if (typeof tile.label === 'string') repaired.label = tile.label;
  if (minCols !== undefined) repaired.minCols = minCols;
  if (minRows !== undefined) repaired.minRows = minRows;
  if (resolvedMaxCols !== undefined) repaired.maxCols = resolvedMaxCols;
  if (resolvedMaxRows !== undefined) repaired.maxRows = resolvedMaxRows;
  return repaired;
}
