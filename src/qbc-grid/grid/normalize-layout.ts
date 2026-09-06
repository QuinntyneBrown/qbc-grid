import { GridCell } from './grid-cell';
import { GridTile } from './grid-tile';
import { LayoutRepair } from './layout-repair';
import { clampTile } from './clamp-tile';
import { overlaps } from './overlaps';

/** A record reaches the ordered stages only once the envelope around it is decided. */
function usableId(entry: Record<string, unknown>): string | null {
  const id = entry['id'];
  return typeof id === 'string' && id.trim() !== '' ? id : null;
}

/**
 * The lowest row at or below `from` where the span fits beside everything already placed.
 *
 * The search skips rather than steps. A candidate row intersecting an occupant cannot fit
 * at any row before that occupant ends, so the search resumes at that occupant's bottom
 * row. The work follows the number of records rather than the size of the coordinates: a
 * single record declaring a billion rows costs one comparison rather than a billion.
 */
function firstFreeRow(
  placed: readonly GridTile[],
  cell: GridCell,
  from: number,
): number {
  let y = from;
  for (let moved = true; moved; ) {
    moved = false;
    for (const other of placed) {
      if (overlaps({ ...cell, y }, other)) {
        y = other.y + other.rows;
        moved = true;
      }
    }
  }
  return y;
}

/**
 * Repairs whatever a host or a store supplied into a layout the grid can render, in one
 * deterministic order, and reports whether anything changed.
 *
 * The parameter is `unknown` rather than `GridTile[]` on purpose. `JSON.parse` returns
 * `any` and assigns to a typed array without complaint, which is how a stored layout
 * reaches the grid wearing a type nothing checked it against.
 */
export function normalizeLayout(supplied: unknown, columns: number): LayoutRepair {
  const entries = Array.isArray(supplied) ? supplied : [];
  let repaired = !Array.isArray(supplied) && supplied !== undefined && supplied !== null;

  const seen = new Set<string>();
  const accepted: GridTile[] = [];

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      repaired = true;
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = usableId(record);
    if (id === null || seen.has(id)) {
      repaired = true;
      continue;
    }
    seen.add(id);

    const clamped = clampTile(record as unknown as GridTile, columns);
    if (!sameTile(record, clamped)) repaired = true;
    accepted.push(clamped);
  }

  const placed: GridTile[] = [];
  for (const tile of accepted) {
    const y = firstFreeRow(placed, tile, tile.y);
    if (y !== tile.y) {
      repaired = true;
      placed.push({ ...tile, y });
    } else {
      placed.push(tile);
    }
  }

  return { tiles: placed, repaired };
}

/** Whether the repair left every field of a supplied record as it found it. */
function sameTile(supplied: Record<string, unknown>, repaired: GridTile): boolean {
  const fields: (keyof GridTile)[] = [
    'id',
    'x',
    'y',
    'cols',
    'rows',
    'locked',
    'label',
    'minCols',
    'minRows',
    'maxCols',
    'maxRows',
  ];
  return fields.every((field) => {
    const before = supplied[field];
    const after = repaired[field];
    if (after === undefined) return before === undefined || (field === 'locked' && before !== true);
    return before === after;
  });
}
