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

  /** A layout carrying every defect the ordered repair stages exist to correct. */
  malformed: [
    null,
    7,
    { x: 0, y: 0, cols: 2, rows: 1 },
    { id: '   ', x: 0, y: 0, cols: 2, rows: 1 },
    { id: 'clamped', x: -3, y: 'abc', cols: 40, rows: 0 },
    { id: 'clamped', x: 6, y: 0, cols: 2, rows: 1 },
    { id: 'limits', x: 0, y: 1, cols: 4, rows: 1, minCols: 8, maxCols: 2 },
  ],

  /** Two records claiming the same cells, so the later one is moved down. */
  overlapping: [
    { id: 'first', x: 0, y: 0, cols: 4, rows: 2, label: 'First' },
    { id: 'second', x: 0, y: 0, cols: 4, rows: 2, label: 'Second' },
  ],

  /** A record beyond the rows the grid can represent, and one beside it. */
  unrepresentable: [
    { id: 'far', x: 0, y: 2 ** 53, cols: 2, rows: 1 },
    { id: 'near', x: 4, y: 0, cols: 2, rows: 1 },
  ],

  /** A blocker declaring a billion rows, and a record that has to clear it. */
  'billion-rows': [
    { id: 'blocker', x: 0, y: 0, cols: 12, rows: 1_000_000_000 },
    { id: 'after', x: 0, y: 0, cols: 12, rows: 1 },
  ],

  /** A duplicate id and nothing else wrong, so a repair moves no surviving tile. */
  'duplicate-only': [
    { id: 'alpha', x: 0, y: 0, cols: 3, rows: 2, label: 'Alpha' },
    { id: 'bravo', x: 3, y: 0, cols: 3, rows: 2, label: 'Bravo' },
    { id: 'alpha', x: 6, y: 0, cols: 3, rows: 2, label: 'Duplicate' },
  ],

  /** Tiles with no usable label, so the fallback to the id is what names them. */
  'blank-labels': [
    { id: 'nameless', x: 0, y: 0, cols: 3, rows: 2 },
    { id: 'blank', x: 3, y: 0, cols: 3, rows: 2, label: '   ' },
  ],

  /** A clean layout carrying metadata that has to survive a round trip. */
  metadata: [
    { id: 'attitude', x: 0, y: 0, cols: 3, rows: 2, label: 'Attitude', minCols: 2, maxRows: 4 },
    { id: 'plain', x: 3, y: 0, cols: 3, rows: 2 },
  ],
};
