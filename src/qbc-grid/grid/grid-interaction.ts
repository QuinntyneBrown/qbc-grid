import { GridCell } from './grid-cell';
import { GridInteractionKind } from './grid-interaction-kind';
import { GridShadow } from './grid-shadow';

/**
 * A gesture as a value. Holding it beside the committed tile list, rather than mutating
 * that list, is what makes reverting free: the committed tiles were never touched.
 */
export interface GridInteraction {
  kind: GridInteractionKind;
  tileId: string;
  origin: GridCell;
  pointerId: number;
  shadow: GridShadow;

  /**
   * Where the pointer has carried the tile, in pixels from the geometry it started at.
   *
   * The lift and the shadow are deliberately different things. The tile follows the
   * pointer continuously, so the operator's hand and what moves under it agree; the shadow
   * snaps to cells, so what a release would commit is legible before it happens. A tile
   * that snapped with the shadow would stutter under the cursor and say nothing the shadow
   * was not already saying.
   */
  lift: { x: number; y: number; width: number; height: number };
}
