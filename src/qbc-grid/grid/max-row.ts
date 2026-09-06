/**
 * The lowest row a stored record may claim.
 *
 * Two things fail above it. Integer arithmetic stops advancing — at `2 ** 53` the
 * expression `y + 1` equals `y`, so a loop looking for the next free row never finds one —
 * and no target browser positions an element that far down, so a row surviving the
 * arithmetic would still not paint. This bounds what an input may claim; it is not a
 * ceiling on growth, and an operator moving a tile a cell at a time never meets it.
 */
export const MAX_ROW = 1_048_576;
