import { GridTile } from './grid-tile';

/** Every field a host can observe on a tile, and therefore every field a change can move. */
const FIELDS: (keyof GridTile)[] = [
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

/**
 * Whether two layouts hold the same records in the same order.
 *
 * This compares the whole record rather than its geometry. Dropping a duplicate id changes
 * a layout and moves nothing, and so does a corrected label or a new size limit; a gate
 * comparing coordinates alone reports no change on any of them and swallows an emission
 * the specification requires. Geometry-only comparison has one job, which is deciding
 * whether a move or resize came to rest where it started.
 */
export function layoutsEqual(a: readonly GridTile[], b: readonly GridTile[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((tile, index) => {
    const other = b[index];
    return other !== undefined && FIELDS.every((field) => tile[field] === other[field]);
  });
}
