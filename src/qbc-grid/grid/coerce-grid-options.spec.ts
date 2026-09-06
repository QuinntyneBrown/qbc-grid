import { describe, expect, it } from 'vitest';

import { coerceGridOptions } from './coerce-grid-options';

describe('coerceGridOptions', () => {
  it('divides the container into equal columns', () => {
    const metrics = coerceGridOptions(12, 60, 8, 1528);
    expect(metrics.columns).toBe(12);
    expect(metrics.columnWidth).toBeCloseTo(120, 10);
  });

  it('keeps a sub-pixel column width as a fraction', () => {
    const metrics = coerceGridOptions(7, 60, 0, 100);
    expect(metrics.columnWidth).toBeCloseTo(100 / 7, 10);
  });

  it('raises a column count below one', () => {
    expect(coerceGridOptions(0, 60, 8, 1000).columns).toBe(1);
    expect(coerceGridOptions(-5, 60, 8, 1000).columns).toBe(1);
  });

  it('floors a fractional column count', () => {
    expect(coerceGridOptions(7.6, 60, 8, 1000).columns).toBe(7);
  });

  it('raises a row height below one', () => {
    expect(coerceGridOptions(12, 0, 8, 1000).rowHeight).toBe(1);
  });

  it('raises a negative gap to zero', () => {
    expect(coerceGridOptions(12, 60, -4, 1000).gap).toBe(0);
  });

  it('substitutes the documented default for a non-finite value', () => {
    const metrics = coerceGridOptions(Number.NaN, Number.NaN, Number.NaN, 1528);
    expect(metrics.columns).toBe(12);
    expect(metrics.rowHeight).toBe(60);
    expect(metrics.gap).toBe(8);
  });

  it('treats an infinite gap as absent rather than as a large one', () => {
    expect(coerceGridOptions(12, 60, Number.POSITIVE_INFINITY, 1528).gap).toBe(8);
  });

  it('reduces the gap when it leaves no width to divide', () => {
    // (1024 - 100 * 11) / 12 is about -6.33, which is not a width.
    const metrics = coerceGridOptions(12, 60, 100, 1024);
    expect(metrics.gap).toBeLessThan(100);
    expect(metrics.columnWidth).toBeGreaterThan(0);
  });

  it('leaves an ordinary gap untouched', () => {
    expect(coerceGridOptions(12, 60, 8, 1528).gap).toBe(8);
  });

  it('closes the gutters when the container is narrower than its column count', () => {
    const metrics = coerceGridOptions(12, 60, 8, 6);
    expect(metrics.gap).toBe(0);
    expect(metrics.columnWidth).toBeCloseTo(0.5, 10);
  });

  it('derives zero lengths from an unmeasurable container', () => {
    const metrics = coerceGridOptions(12, 60, 8, 0);
    expect(metrics.columnWidth).toBe(0);
    expect(metrics.gap).toBe(0);
    expect(metrics.columns).toBe(12);
  });

  it('ignores the gap when there is one column', () => {
    const metrics = coerceGridOptions(1, 60, 8, 500);
    expect(metrics.columnWidth).toBe(500);
    expect(metrics.gap).toBe(8);
  });

  it('never returns a negative column width', () => {
    for (const width of [0, 1, 5, 11, 12, 13, 1024]) {
      expect(coerceGridOptions(12, 60, 100, width).columnWidth).toBeGreaterThanOrEqual(0);
    }
  });
});
