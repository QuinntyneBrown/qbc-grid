import { GridCell } from './grid-cell';
import { GridCommandOutcome } from './grid-command-outcome';
import { GridInteractionKind } from './grid-interaction-kind';

/** Cell coordinates are stored from zero and spoken from one, which is what an operator counts. */
const oneBased = (value: number): number => value + 1;

const REASONS: Record<Exclude<GridCommandOutcome, 'accepted'>, string> = {
  'blocked-occupied': 'blocked by another tile',
  'blocked-bounds': 'blocked by the edge of the grid',
  'blocked-limit': 'blocked by its size limit',
};

/**
 * The sentence a run of commands leaves in the live region.
 *
 * A run that moved and then met an obstacle reports both, because a message saying only
 * that something was blocked withholds the position the operator was listening for.
 */
export function announcementFor(
  name: string,
  kind: GridInteractionKind,
  cell: GridCell,
  outcome: GridCommandOutcome,
): string {
  const place =
    kind === 'move'
      ? `column ${oneBased(cell.x)}, row ${oneBased(cell.y)}`
      : `${cell.cols} by ${cell.rows}`;
  const settled = kind === 'move' ? `${name} at ${place}` : `${name} sized ${place}`;

  return outcome === 'accepted' ? `${settled}.` : `${settled}, ${REASONS[outcome]}.`;
}
