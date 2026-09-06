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
}
