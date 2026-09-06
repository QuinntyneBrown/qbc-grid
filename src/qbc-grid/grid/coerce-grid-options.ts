import { GridMetrics } from './grid-metrics';

/** The values a non-finite configuration falls back to. */
const DEFAULT_COLUMNS = 12;
const DEFAULT_ROW_HEIGHT = 60;
const DEFAULT_GAP = 8;

/** The narrowest column the grid will draw rather than collapse. */
const MIN_COLUMN_WIDTH = 1;

/**
 * Turns the four configuration values and the measured container width into the metrics
 * the grid renders with.
 *
 * Each value is coerced on its own, and then the gap is reconciled with the width. A
 * configuration can pass every individual rule and still leave nothing to divide: twelve
 * columns and a gap of 100 in a 1024px container ask for 1100px of gutters, and the
 * unqualified formula returns a column width of about -6.33px. The gutters give way
 * instead, which changes nothing in an ordinary configuration.
 */
export function coerceGridOptions(
  columns: number,
  rowHeight: number,
  gap: number,
  width: number,
): GridMetrics {
  const safeColumns = Number.isFinite(columns)
    ? Math.max(1, Math.floor(columns))
    : DEFAULT_COLUMNS;
  const safeRowHeight = Number.isFinite(rowHeight)
    ? Math.max(1, rowHeight)
    : DEFAULT_ROW_HEIGHT;
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : DEFAULT_GAP;
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;

  const gutters = safeColumns - 1;
  const widestUsableGap =
    gutters === 0
      ? safeGap
      : Math.max(0, (safeWidth - safeColumns * MIN_COLUMN_WIDTH) / gutters);
  const effectiveGap = Math.min(safeGap, widestUsableGap);

  return {
    columns: safeColumns,
    columnWidth: Math.max(0, (safeWidth - effectiveGap * gutters) / safeColumns),
    rowHeight: safeRowHeight,
    gap: effectiveGap,
  };
}
