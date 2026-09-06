import { GridCell } from './grid-cell';
import { GridInteractionKind } from './grid-interaction-kind';
import { GridTile } from './grid-tile';
import { canPlace } from './can-place';
import { clampSpan } from './clamp-span';
import { overlaps } from './overlaps';

/** A key the grid consumed, and the geometry it proposes. */
export interface GridKeyboardCandidate {
  kind: GridInteractionKind;
  cell: GridCell;
}

const STEPS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

/**
 * Maps a key event to the geometry it proposes, or `null` for a key the grid leaves alone.
 *
 * An unmodified arrow moves the tile one cell. `Shift` with an arrow changes the span, and
 * passes through `clampSpan` so the declared limits and the pinned origin apply exactly as
 * they do to a pointer resize. `Control` with an arrow moves the tile to the nearest
 * position in that direction where it fits.
 *
 * The jump is what makes `L1-010` true. A locked tile spanning every column divides the
 * grid in two for one-cell steps: no sequence of them crosses it, and shrinking does not
 * help a tile already at its minimum, while a pointer crosses the same row in one drag.
 */
export function gridKeyboardCandidate(
  event: KeyboardEvent,
  tile: GridTile,
  tiles: readonly GridTile[],
  columns: number,
): GridKeyboardCandidate | null {
  const step = STEPS[event.key];
  if (step === undefined || event.altKey || event.metaKey) return null;

  const origin: GridCell = { x: tile.x, y: tile.y, cols: tile.cols, rows: tile.rows };

  if (event.shiftKey) {
    const grown = {
      ...origin,
      cols: origin.cols + step.dx,
      rows: origin.rows + step.dy,
    };
    return { kind: 'resize', cell: clampSpan(tile, grown, columns) };
  }

  if (event.ctrlKey) {
    const jumped = nearestFit(tiles, origin, step, columns, tile.id);
    return { kind: 'move', cell: jumped ?? origin };
  }

  return {
    kind: 'move',
    cell: { ...origin, x: origin.x + step.dx, y: origin.y + step.dy },
  };
}

/**
 * The nearest position in one direction where the tile fits, or `null` when none does.
 *
 * Horizontally the candidates are bounded by the column count, so the search steps. On the
 * rows it skips, for the reason every other search in this library skips: a candidate that
 * intersects an occupant cannot fit at any row before that occupant ends, and stepping
 * would walk a billion rows for a tile that declares them.
 */
function nearestFit(
  tiles: readonly GridTile[],
  origin: GridCell,
  step: { dx: number; dy: number },
  columns: number,
  id: string,
): GridCell | null {
  if (step.dx !== 0) {
    for (let x = origin.x + step.dx; x >= 0 && x + origin.cols <= columns; x += step.dx) {
      const candidate = { ...origin, x };
      if (canPlace(tiles, candidate, columns, id)) return candidate;
    }
    return null;
  }

  const others = tiles.filter((tile) => tile.id !== id);

  if (step.dy > 0) {
    let y = origin.y + 1;
    for (let moved = true; moved; ) {
      moved = false;
      for (const other of others) {
        if (overlaps({ ...origin, y }, other)) {
          y = other.y + other.rows;
          moved = true;
        }
      }
    }
    return { ...origin, y };
  }

  let y = origin.y - 1;
  while (y >= 0) {
    const blocker = others.find((other) => overlaps({ ...origin, y }, other));
    if (blocker === undefined) return { ...origin, y };
    // Clearing this occupant upward needs the tile's whole height above its top edge.
    y = blocker.y - origin.rows;
  }
  return null;
}
