# Render the grid

## Overview

`qbc-grid` arranges dashboard tiles on a grid of equal-width columns. This feature is
the foundation the other thirteen rest on: it turns a list of tile records and four
configuration values into positioned elements on screen.

The grid is described in **cells**. A *cell* is one column wide by one row height tall.
A *tile geometry* is the record `{ x, y, cols, rows }` locating a tile in whole cells
from the origin at the top-left. Cells are a logical unit; pixels are derived. Column
width is not configured — it is computed from the width the host container gives the
grid, so the same layout fills a 1280 px panel and a 2560 px panel without any tile
record changing.

Rows behave differently from columns. The column count is fixed by configuration and
never changes, which is what makes a saved layout portable. Rows are unbounded: the
grid grows downward to whatever the lowest occupied tile needs.

Configuration reaching the grid is coerced rather than trusted, because the grid is a
published library and a caller can pass `0`, `-4`, or `NaN`. Coercion keeps a bad value
from producing a division by zero or an unrenderable grid.

## Description

The feature lives in the `components` library, at
`frontend/projects/components/src/lib/grid/`. One file holds one type, as the
repository requires.

- **`GridComponent`** — Angular standalone component with selector `qbc-grid`. It holds
  the signal inputs `layout`, `columns`, `rowHeight`, `gap`, and `mode`, and the output
  `layoutChange`. It exposes the computed signals `tiles`, `metrics`, and `rowCount`,
  and the methods `addTile` and `removeTile`.
- **`GridTileTemplateDirective`** — directive with selector `[qbcGridTile]`. It captures
  the `TemplateRef` the host declares for a tile's content and hands it to
  `GridComponent`, which instantiates it once per tile with the tile as the implicit
  context.
- **`GridTile`** — the tile record: `id`, `x`, `y`, `cols`, `rows`, and the optional
  `locked`, `minCols`, `minRows`, `maxCols`, `maxRows`, and `label`.
- **`GridCell`** — the geometry `{ x, y, cols, rows }` without identity. Every placement
  rule in the library is written against `GridCell`, so a drag preview, a keyboard
  nudge, and a repair all share one vocabulary.
- **`GridMetrics`** — the derived render context: `columns`, `columnWidth`, `rowHeight`,
  and `gap`. It is recomputed when the container width changes and at no other time.
- **`coerceGridOptions`** — pure function applying `L2-004`. It floors `columns` to at
  least 1, raises `rowHeight` to at least 1, raises `gap` to at least 0, and substitutes
  the documented default for any non-finite value.
- **`rectOf`** — pure function converting a `GridCell` and a `GridMetrics` into the pixel
  `Rectangle` the tile occupies.

`GridComponent` writes the metrics onto its host element as the custom properties
`--qbc-grid-columns`, `--qbc-grid-column-width`, `--qbc-grid-row-height`, and
`--qbc-grid-gap`, and writes each tile's geometry onto that tile's element as
`--qbc-tile-x`, `--qbc-tile-y`, `--qbc-tile-cols`, and `--qbc-tile-rows`. Position is
then a `transform: translate3d(...)` built with `calc()` in the stylesheet, and size is
a `calc()` width and height. Keeping the arithmetic in CSS means a container resize
repositions every tile without the component touching a single element.

Sub-pixel column widths are kept as fractions rather than rounded per tile. Rounding
each tile independently accumulates drift across a row and leaves the last tile short
of the container edge; deriving every edge from the unrounded `columnWidth` keeps the
final edge flush within one pixel.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement
refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-001` | `L1-001` | The grid shall render `columns` equal-width columns that fill the host container content width, deriving column width as `(containerWidth - gap * (columns - 1)) / columns`. |
| `L2-002` | `L1-001` | The grid shall place a tile with geometry `{ x, y, cols, rows }` at column `x` and row `y`, spanning `cols` columns and `rows` rows, separated from adjacent tiles by `gap` pixels on both axes. |
| `L2-003` | `L1-001` | The grid shall size its host to the lowest occupied row and shall impose no maximum row. |
| `L2-004` | `L1-001` | The grid shall coerce `columns` to `max(1, floor(columns))`, `rowHeight` to `max(1, rowHeight)`, and `gap` to `max(0, gap)`, and shall fall back to the documented default for a non-finite value. |

## Diagrams

The system context and container views are shared across every feature and are held at
the [tree root](../../README.md#where-the-c4-levels-live).

### Components

`GridComponent` coerces its configuration, repairs the supplied layout, publishes
`GridMetrics`, and positions each tile through `rectOf`. The per-tile template comes
from `GridTileTemplateDirective`, declared by the host.

![C4 component view for rendering the grid](diagrams/c4-component.png)

### Class structure

`GridTile` extends `GridCell` with identity and constraints. `GridComponent` renders
many tiles against one `GridMetrics`, and depends on the two pure functions rather than
holding the arithmetic itself.

![Class diagram for rendering the grid](diagrams/class-structure.png)

### Behaviour — render a supplied layout

The container width is measured once, `columnWidth` is derived from it, the layout is
repaired, and each tile's geometry is written as custom properties. The grid host height
follows the lowest occupied row.

![Sequence diagram for rendering a supplied layout](diagrams/sequence-render.png)
