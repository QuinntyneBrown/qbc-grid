import { describe, expect, it } from 'vitest';

import { coerceGridOptions } from './coerce-grid-options';
import { rectOf } from './rect-of';

const metrics = coerceGridOptions(12, 60, 8, 1528);

describe('rectOf', () => {
  it('places the origin cell at the container corner', () => {
    expect(rectOf({ x: 0, y: 0, cols: 1, rows: 1 }, metrics)).toEqual({
      left: 0,
      top: 0,
      width: 120,
      height: 60,
    });
  });

  it('derives a row offset from the row height and the gap', () => {
    const rect = rectOf({ x: 0, y: 2, cols: 1, rows: 3 }, metrics);
    expect(rect.top).toBeCloseTo(136, 10);
    expect(rect.height).toBeCloseTo(196, 10);
  });

  it('counts one fewer gap than the span', () => {
    const rect = rectOf({ x: 0, y: 0, cols: 3, rows: 1 }, metrics);
    expect(rect.width).toBeCloseTo(3 * 120 + 2 * 8, 10);
  });

  it('leaves a full-width tile flush with the container', () => {
    const rect = rectOf({ x: 0, y: 0, cols: 12, rows: 1 }, metrics);
    expect(rect.left + rect.width).toBeCloseTo(1528, 10);
  });

  it('leaves the last column flush when the column width is fractional', () => {
    const odd = coerceGridOptions(7, 60, 5, 1000);
    const last = rectOf({ x: 6, y: 0, cols: 1, rows: 1 }, odd);
    expect(last.left + last.width).toBeCloseTo(1000, 6);
  });
});
