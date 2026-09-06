import { describe, expect, it } from 'vitest';

import { GridCell } from './grid-cell';
import { overlaps } from './overlaps';

const cell = (x: number, y: number, cols = 1, rows = 1): GridCell => ({ x, y, cols, rows });

describe('overlaps', () => {
  it('reports a shared cell', () => {
    expect(overlaps(cell(0, 0, 2, 2), cell(1, 1, 2, 2))).toBe(true);
  });

  it('reports no overlap for rectangles that only touch along a column edge', () => {
    expect(overlaps(cell(0, 0, 3, 1), cell(3, 0, 3, 1))).toBe(false);
  });

  it('reports no overlap for rectangles that only touch along a row edge', () => {
    expect(overlaps(cell(0, 0, 1, 2), cell(0, 2, 1, 2))).toBe(false);
  });

  it('reports no overlap for rectangles that are far apart', () => {
    expect(overlaps(cell(0, 0), cell(5, 5))).toBe(false);
  });

  it('reports an overlap when one rectangle contains the other', () => {
    expect(overlaps(cell(0, 0, 4, 4), cell(1, 1))).toBe(true);
  });

  it('is symmetric', () => {
    const a = cell(2, 2, 3, 3);
    const b = cell(4, 4, 3, 3);
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});
