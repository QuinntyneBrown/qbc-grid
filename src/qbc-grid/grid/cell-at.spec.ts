import { describe, expect, it } from 'vitest';

import { cellAt } from './cell-at';
import { coerceGridOptions } from './coerce-grid-options';

const metrics = coerceGridOptions(12, 60, 8, 1528);
const span = { x: 0, y: 0, cols: 3, rows: 2 };

describe('cellAt', () => {
  it('snaps the origin to the first cell', () => {
    expect(cellAt(0, 0, span, metrics)).toMatchObject({ x: 0, y: 0 });
  });

  it('snaps to the nearest cell rather than the one just passed', () => {
    const pitch = metrics.columnWidth + metrics.gap;
    expect(cellAt(pitch * 4 - 2, 0, span, metrics)).toMatchObject({ x: 4 });
    expect(cellAt(pitch * 4 + 2, 0, span, metrics)).toMatchObject({ x: 4 });
  });

  it('does not move while the pointer stays inside one cell', () => {
    const pitch = metrics.columnWidth + metrics.gap;
    const inside = [pitch * 2 - pitch / 4, pitch * 2, pitch * 2 + pitch / 4];
    const snapped = inside.map((left) => cellAt(left, 0, span, metrics).x);
    expect(new Set(snapped).size).toBe(1);
  });

  it('parks a tile dragged past the right edge at the last column that fits', () => {
    expect(cellAt(100_000, 0, span, metrics)).toMatchObject({ x: 9 });
  });

  it('parks a tile dragged above the first row at row zero', () => {
    expect(cellAt(0, -500, span, metrics)).toMatchObject({ y: 0 });
  });

  it('keeps the span it was given', () => {
    expect(cellAt(500, 500, span, metrics)).toMatchObject({ cols: 3, rows: 2 });
  });

  it('reports the origin when the container has no width to divide', () => {
    const empty = coerceGridOptions(12, 60, 8, 0);
    expect(cellAt(0, 0, span, empty)).toMatchObject({ x: 0, y: 0 });
  });
});
