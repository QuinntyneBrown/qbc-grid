import { GridCell } from './grid-cell';
import { GridTile } from './grid-tile';
import { overlaps } from './overlaps';

/**
 * Whether a candidate rectangle is free: inside the grid, and covered by no other tile.
 *
 * `exceptId` names the tile the candidate belongs to. Every gesture validates against a
 * list that still holds the tile being moved, and without the exclusion that tile blocks
 * itself, so every drag would be refused and every keyboard move blocked. A locked tile
 * needs no special case here — it is an occupant like any other.
 */
export function canPlace(
  tiles: readonly GridTile[],
  candidate: GridCell,
  columns: number,
  exceptId?: string,
): boolean {
  if (candidate.x < 0 || candidate.y < 0) return false;
  if (candidate.cols < 1 || candidate.rows < 1) return false;
  if (candidate.x + candidate.cols > columns) return false;
  return !tiles.some((tile) => tile.id !== exceptId && overlaps(candidate, tile));
}
