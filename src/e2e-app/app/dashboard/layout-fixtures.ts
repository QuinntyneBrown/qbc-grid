/**
 * The named layouts the acceptance suite selects with the `fixture` URL parameter.
 *
 * The values are typed as they arrive from storage rather than as `GridTile[]`: several
 * fixtures exist to carry records the grid is required to repair, and those cannot be
 * expressed in the shape the grid hands back.
 */
export const layoutFixtures: Record<string, unknown> = {
  empty: [],
  three: [
    { id: 'alpha', x: 0, y: 0, cols: 3, rows: 2, label: 'Alpha' },
    { id: 'bravo', x: 3, y: 0, cols: 3, rows: 2, label: 'Bravo' },
    { id: 'charlie', x: 0, y: 2, cols: 6, rows: 2, label: 'Charlie' },
  ],
};
