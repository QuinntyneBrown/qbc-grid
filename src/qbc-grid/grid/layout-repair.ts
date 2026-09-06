import { GridTile } from './grid-tile';

/**
 * The result of normalizing a supplied layout: the records the grid will render, and
 * whether producing them changed anything.
 */
export interface LayoutRepair {
  tiles: readonly GridTile[];
  repaired: boolean;
}
