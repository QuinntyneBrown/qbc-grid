import { describe, expect, it } from 'vitest';

import { GridTile } from './grid-tile';
import { clampSpan } from './clamp-span';
import { clampTile } from './clamp-tile';

const tile = (over: Partial<GridTile> = {}): GridTile => ({
  id: 'a',
  x: 0,
  y: 0,
  cols: 2,
  rows: 2,
  ...over,
});

const span = (x: number, cols: number, rows = 2) => ({ x, y: 0, cols, rows });

describe('clampSpan', () => {
  it('leaves a span inside every limit alone', () => {
    expect(clampSpan(tile(), span(0, 4), 12)).toMatchObject({ cols: 4, rows: 2 });
  });

  it('raises a span below its declared minimum', () => {
    expect(clampSpan(tile({ minCols: 2 }), span(0, 1), 12)).toMatchObject({ cols: 2 });
  });

  it('holds a span at its declared maximum', () => {
    expect(clampSpan(tile({ maxRows: 4 }), { x: 0, y: 0, cols: 2, rows: 6 }, 12)).toMatchObject({
      rows: 4,
    });
  });

  it('bounds the span by the width left of the origin, not by the grid', () => {
    // A tile at column 9 of twelve has three columns to grow into.
    expect(clampSpan(tile({ x: 9 }), span(9, 40), 12)).toMatchObject({ cols: 3 });
  });

  it('never moves the origin', () => {
    const clamped = clampSpan(tile({ x: 9 }), span(9, 40), 12);
    expect(clamped.x).toBe(9);
    expect(clamped.y).toBe(0);
  });

  it('parts company with clampTile exactly where the origin is concerned', () => {
    const pinned = tile({ x: 9, cols: 3 });
    const grown = { ...pinned, cols: 40 };

    // The repair widens the tile and slides it back inside the grid.
    expect(clampTile(grown, 12)).toMatchObject({ x: 0, cols: 12 });
    // The resize holds the corner the operator is not dragging.
    expect(clampSpan(pinned, span(9, 40), 12)).toMatchObject({ x: 9, cols: 3 });
  });

  it('lets a maximum wider than the grid reach only what fits', () => {
    expect(clampSpan(tile({ maxCols: 20 }), span(0, 20), 12)).toMatchObject({ cols: 12 });
  });

  it('raises a maximum that sits below its own minimum', () => {
    expect(clampSpan(tile({ minCols: 8, maxCols: 2 }), span(0, 4), 12)).toMatchObject({ cols: 8 });
  });
});
