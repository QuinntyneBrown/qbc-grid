import { describe, expect, it } from 'vitest';

import { coerceGridOptions } from './coerce-grid-options';
import { spanAt } from './span-at';

const metrics = coerceGridOptions(12, 60, 8, 1528);
const origin = { x: 0, y: 0, cols: 2, rows: 2 };
const columnPitch = metrics.columnWidth + metrics.gap;
const rowPitch = metrics.rowHeight + metrics.gap;

/** The rendered size of a span, which is what the gesture starts from. */
const widthOf = (cols: number) => cols * metrics.columnWidth + (cols - 1) * metrics.gap;
const heightOf = (rows: number) => rows * metrics.rowHeight + (rows - 1) * metrics.gap;

describe('spanAt', () => {
  it('reports the span the tile already has when the pointer has not moved', () => {
    expect(spanAt(widthOf(2), heightOf(2), origin, metrics)).toMatchObject({ cols: 2, rows: 2 });
  });

  it('grows a column once the pointer has crossed most of one', () => {
    expect(spanAt(widthOf(2) + columnPitch, heightOf(2), origin, metrics)).toMatchObject({
      cols: 3,
    });
  });

  it('grows a row the same way', () => {
    expect(spanAt(widthOf(2), heightOf(2) + rowPitch, origin, metrics)).toMatchObject({ rows: 3 });
  });

  it('does not change while the pointer stays inside one cell', () => {
    const sizes = [widthOf(3) - columnPitch / 4, widthOf(3), widthOf(3) + columnPitch / 4];
    const spans = sizes.map((width) => spanAt(width, heightOf(2), origin, metrics).cols);
    expect(new Set(spans).size).toBe(1);
  });

  it('never reports a span below one cell', () => {
    expect(spanAt(-500, -500, origin, metrics)).toMatchObject({ cols: 1, rows: 1 });
  });

  it('keeps the origin it was given', () => {
    const pinned = { x: 9, y: 4, cols: 3, rows: 1 };
    expect(spanAt(widthOf(6), heightOf(6), pinned, metrics)).toMatchObject({ x: 9, y: 4 });
  });
});
