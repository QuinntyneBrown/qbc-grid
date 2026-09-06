import { describe, expect, it } from 'vitest';

import { MAX_ROW } from './max-row';
import { normalizeLayout } from './normalize-layout';

const tile = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  x: 0,
  y: 0,
  cols: 1,
  rows: 1,
  ...over,
});

describe('normalizeLayout envelope', () => {
  it('treats a value that is not an array as an empty layout', () => {
    for (const supplied of [null, 7, 'layout', { id: 'a' }, true]) {
      expect(normalizeLayout(supplied, 12).tiles).toEqual([]);
    }
  });

  it('reports no repair for an absent layout rather than inventing one', () => {
    expect(normalizeLayout(undefined, 12).repaired).toBe(false);
    expect(normalizeLayout([], 12).repaired).toBe(false);
  });

  it('drops entries that are not records', () => {
    const result = normalizeLayout([null, 3, tile(), ['x']], 12);
    expect(result.tiles).toHaveLength(1);
    expect(result.repaired).toBe(true);
  });

  it('drops a record with a missing, blank, or non-string id', () => {
    const result = normalizeLayout(
      [tile({ id: undefined }), tile({ id: '   ' }), tile({ id: 4 }), tile({ id: 'kept' })],
      12,
    );
    expect(result.tiles.map((t) => t.id)).toEqual(['kept']);
  });

  it('keeps the first of a duplicated id', () => {
    const result = normalizeLayout([tile({ x: 0 }), tile({ x: 5 })], 12);
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0]?.x).toBe(0);
    expect(result.repaired).toBe(true);
  });
});

describe('normalizeLayout coercion and bounds', () => {
  it('clamps a span and a coordinate into range', () => {
    const result = normalizeLayout([tile({ x: -3, cols: 40, rows: 0 })], 12);
    expect(result.tiles[0]).toMatchObject({ x: 0, cols: 12, rows: 1 });
    expect(result.repaired).toBe(true);
  });

  it('renders a non-finite coordinate at a finite row', () => {
    for (const y of ['abc', Number.POSITIVE_INFINITY, Number.NaN, null]) {
      const result = normalizeLayout([tile({ y })], 12);
      expect(Number.isFinite(result.tiles[0]?.y)).toBe(true);
    }
  });

  it('floors a fractional coordinate', () => {
    expect(normalizeLayout([tile({ x: 3.9, y: 2.7 })], 12).tiles[0]).toMatchObject({
      x: 3,
      y: 2,
    });
  });

  it('clamps a row beyond what the grid can represent', () => {
    const result = normalizeLayout([tile({ y: 2 ** 53 })], 12);
    expect(result.tiles[0]?.y).toBe(MAX_ROW);
    expect(result.repaired).toBe(true);
  });

  it('raises a maximum that sits below its own minimum', () => {
    const result = normalizeLayout([tile({ minCols: 8, maxCols: 2, cols: 4 })], 12);
    expect(result.tiles[0]?.minCols).toBe(8);
    expect(result.tiles[0]?.maxCols).toBe(8);
    expect(result.tiles[0]?.cols).toBe(8);
  });

  it('drops a size limit that is not a usable integer', () => {
    const result = normalizeLayout([tile({ minCols: 'two', maxRows: 0 })], 12);
    expect(result.tiles[0]?.minCols).toBeUndefined();
    expect(result.tiles[0]?.maxRows).toBeUndefined();
  });

  it('keeps a label only when it is a string, and lock only when it is true', () => {
    const result = normalizeLayout([tile({ label: 7, locked: 'yes' })], 12);
    expect(result.tiles[0]?.label).toBeUndefined();
    expect(result.tiles[0]?.locked).toBeUndefined();
  });

  it('keeps valid metadata untouched', () => {
    const supplied = tile({ cols: 2, label: 'Attitude', minCols: 2, maxRows: 4, locked: true });
    const result = normalizeLayout([supplied], 12);
    expect(result.tiles[0]).toMatchObject({
      label: 'Attitude',
      minCols: 2,
      maxRows: 4,
      locked: true,
    });
    expect(result.repaired).toBe(false);
  });
});

describe('normalizeLayout separation', () => {
  it('moves a later overlapping record down to the first row that fits', () => {
    const result = normalizeLayout(
      [tile({ id: 'a', cols: 4, rows: 2 }), tile({ id: 'b', cols: 4, rows: 2 })],
      12,
    );
    expect(result.tiles[1]?.y).toBe(2);
    expect(result.repaired).toBe(true);
  });

  it('leaves records that do not overlap where they were', () => {
    const result = normalizeLayout(
      [tile({ id: 'a', x: 0, cols: 4 }), tile({ id: 'b', x: 4, cols: 4 })],
      12,
    );
    expect(result.tiles.map((t) => t.y)).toEqual([0, 0]);
    expect(result.repaired).toBe(false);
  });

  it('skips past a blocker rather than stepping through its rows', () => {
    const started = Date.now();
    const result = normalizeLayout(
      [
        tile({ id: 'blocker', cols: 12, rows: 1_000_000_000 }),
        tile({ id: 'after', cols: 12, rows: 1 }),
      ],
      12,
    );
    expect(result.tiles[1]?.y).toBe(result.tiles[0]!.y + result.tiles[0]!.rows);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('settles five hundred records in work proportional to the records', () => {
    const many = Array.from({ length: 500 }, (_, index) => tile({ id: `t${index}`, cols: 12 }));
    const started = Date.now();
    const result = normalizeLayout(many, 12);
    expect(result.tiles).toHaveLength(500);
    expect(new Set(result.tiles.map((t) => t.y)).size).toBe(500);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('normalizeLayout is a fixed point', () => {
  it('leaves a repaired layout alone the second time', () => {
    const messy = [
      tile({ id: 'a', x: -3, cols: 40, rows: 0 }),
      tile({ id: 'a', x: 2 }),
      tile({ id: 'b', y: 'abc', minCols: 8, maxCols: 2 }),
      null,
    ];
    const once = normalizeLayout(messy, 12);
    expect(once.repaired).toBe(true);

    const twice = normalizeLayout(once.tiles, 12);
    expect(twice.repaired).toBe(false);
    expect(twice.tiles).toEqual(once.tiles);
  });
});
