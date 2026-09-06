/**
 * The named layouts the acceptance suite selects with the `fixture` URL parameter.
 *
 * The values are typed as they arrive from storage rather than as `GridTile[]`: several
 * fixtures exist to carry records the grid is required to repair, and those cannot be
 * expressed in the shape the grid hands back.
 */

const staticTiles = (count: number, columns = 12): unknown[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `tile-${index}`,
    x: (index * 2) % columns,
    y: Math.floor((index * 2) / columns),
    cols: 2,
    rows: 1,
    label: `Tile ${index}`,
  }));

export const layoutFixtures: Record<string, unknown> = {
  /** Nothing placed. */
  empty: [],

  /** Three tiles, supplied out of row-major order so a grid that never sorts is caught. */
  three: [
    { id: 'charlie', x: 0, y: 2, cols: 6, rows: 2, label: 'Charlie' },
    { id: 'bravo', x: 3, y: 0, cols: 3, rows: 2, label: 'Bravo' },
    { id: 'alpha', x: 0, y: 0, cols: 3, rows: 2, label: 'Alpha' },
  ],

  /** The first row taken through column 5, leaving column 6 onward free. */
  'first-row-through-5': [{ id: 'wide', x: 0, y: 0, cols: 6, rows: 1, label: 'Wide' }],

  /** One tile at column 9 of twelve, with three columns to its right. */
  'at-column-9': [{ id: 'edge', x: 9, y: 0, cols: 3, rows: 2, label: 'Edge' }],

  /** A locked tile spanning every column, dividing the grid for a one-cell keyboard step. */
  'locked-row': [
    { id: 'rover', x: 0, y: 0, cols: 1, rows: 1, label: 'Rover' },
    { id: 'barrier', x: 0, y: 1, cols: 12, rows: 1, locked: true, label: 'Barrier' },
  ],

  /** Sixty tiles of static content, the arrangement the frame budget is measured against. */
  sixty: staticTiles(60),

  /** Five hundred records, the scale normalization completes without hanging. */
  'five-hundred': staticTiles(500),
};
