/**
 * A rectangle of whole cells, without identity. Every placement rule in the library is
 * written against this shape, so a drag preview, a keyboard nudge, and a repair share
 * one vocabulary.
 */
export interface GridCell {
  x: number;
  y: number;
  cols: number;
  rows: number;
}
