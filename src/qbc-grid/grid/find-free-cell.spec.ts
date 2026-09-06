import { describe, expect, it } from 'vitest';

import { GridTile } from './grid-tile';
import { findFreeCell } from './find-free-cell';

const at = (id: string, x: number, y: number, cols: number, rows: number): GridTile => ({
  id,
  x,
  y,
  cols,
  rows,
});

describe('findFreeCell', () => {
  it('places the first tile at the origin', () => {
    expect(findFreeCell([], 3, 2, 12)).toEqual({ x: 0, y: 0, cols: 3, rows: 2 });
  });

  it('fills the gap left in an occupied row', () => {
    const tiles = [at('wide', 0, 0, 6, 1)];
    expect(findFreeCell(tiles, 3, 1, 12)).toMatchObject({ x: 6, y: 0 });
  });

  it('drops below the lowest occupied row when no row has space', () => {
    const tiles = [at('a', 0, 0, 12, 1), at('b', 0, 1, 12, 2)];
    expect(findFreeCell(tiles, 3, 1, 12)).toMatchObject({ x: 0, y: 3 });
  });

  it('clamps a span wider than the grid', () => {
    expect(findFreeCell([], 40, 1, 12)).toMatchObject({ cols: 12 });
  });

  it('keeps row-major order when an earlier row has a later gap', () => {
    const tiles = [at('a', 0, 0, 4, 1), at('b', 8, 0, 4, 1), at('c', 0, 1, 12, 1)];
    expect(findFreeCell(tiles, 4, 1, 12)).toMatchObject({ x: 4, y: 0 });
  });

  it('prefers the earliest row that fits, not the emptiest', () => {
    const tiles = [at('a', 0, 0, 9, 1)];
    expect(findFreeCell(tiles, 3, 1, 12)).toMatchObject({ x: 9, y: 0 });
  });

  it('clears a blocker of a billion rows without walking them', () => {
    const tiles = [at('blocker', 0, 0, 12, 1_000_000_000)];
    const started = Date.now();

    expect(findFreeCell(tiles, 3, 1, 12)).toMatchObject({ x: 0, y: 1_000_000_000 });

    expect(Date.now() - started).toBeLessThan(500);
  });

  it('places beside a blocker that leaves room in its own rows', () => {
    const tiles = [at('blocker', 0, 0, 6, 1_000_000_000)];
    expect(findFreeCell(tiles, 3, 1, 12)).toMatchObject({ x: 6, y: 0 });
  });
});
