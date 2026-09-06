# grid-layout

## Overview

The `grid-layout` subsystem owns the cell model and the layout data contract. It
answers three questions: where a tile sits on screen, what the layout looks like as
plain data, and what happens when the data supplied to the grid is wrong.

The subsystem's decisions are deterministic: the same layout and the same column count
always produce the same result. The pure functions it introduces — `coerceGridOptions`,
`normalizeLayout`, `clampTile`, `overlaps`, `canPlace`, `findFreeCell`, and `rectOf` —
take values and return values, which is what lets the interaction subsystem reuse them
for a drag preview and a keyboard nudge without duplicating the rules.

One measurement is not pure and cannot be. `GridComponent` reads its host's content width
to derive `columnWidth`, because no arithmetic can know how wide a container the host
gave it. That read is made once per width change, never inside a gesture, and it is the
subsystem's only contact with the DOM.

## Features

| Feature | Concern | L2 requirements |
|---------|---------|-----------------|
| [`render-grid`](render-grid/) | Column geometry, tile placement, vertical growth, configuration coercion | `L2-001`–`L2-004` |
| [`add-and-remove-tiles`](add-and-remove-tiles/) | Explicit and automatic placement, removal by id | `L2-020`–`L2-022` |
| [`publish-and-restore-layout`](publish-and-restore-layout/) | The emitted contract and its round trip | `L2-023`, `L2-024` |
| [`normalize-supplied-layout`](normalize-supplied-layout/) | Deterministic repair of malformed or stale layouts | `L2-025`, `L2-026` |

## Shared C4 levels

The system context and container views for every feature in this subsystem are held
in the [tree root](../README.md#where-the-c4-levels-live).
