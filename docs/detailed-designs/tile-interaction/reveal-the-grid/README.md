# Reveal the grid during an interaction

## Overview

A tile snaps to cells the operator cannot see. During a drag that is a problem: the shadow
says where the tile will land, but not what the landing choices are. Painting the cell
structure for the duration of the gesture answers that, and hiding it the rest of the time
keeps a watching dashboard free of scaffolding.

The *overlay* is the cell structure of the whole grid, drawn behind every tile. It appears
when a move or resize begins and disappears when the interaction ends, whether that
interaction committed or reverted. It is not a mode, not a toggle, and not visible while
the grid is idle in `edit` mode.

Two properties keep it from getting in the way. It is painted **behind** the tiles, so a
tile is never dimmed or obscured by it. And it is inert to the pointer, so a press that
lands on an overlay line reaches the tile or the grid beneath it. An overlay that
intercepted events would break a drag the moment the pointer crossed a gutter.

The overlay is drawn with two repeating gradients rather than with an element per cell. A
12-column grid 40 rows deep has 480 cells; rendering them as elements would put 480 nodes
into the document at the exact moment the frame budget matters most. Two gradients cost
one element and composite as a single layer.

## Description

The overlay is one element, one derived signal, and a stylesheet rule.

- **The overlay element** — a single element in `GridComponent`'s template, absolutely
  positioned to cover the grid host, with `pointer-events: none` and a stacking order below
  every tile. Its visibility is toggled through the `hidden` property rather than by adding
  and removing it, so showing it is an attribute write rather than a DOM insertion.
- **`GridComponent.overlayVisible`** — computed signal, true when
  `GridPointerSession.interaction()` is not `null`, or while the settle window of a
  keyboard command is open. One signal covers the pointer path and the keyboard path, so
  the overlay cannot appear for one and not the other.
- **`GridComponent.settling`** — the window a keyboard command holds the overlay open,
  an interval rather than a motion length, described in
  [`move-and-resize-by-keyboard`](../move-and-resize-by-keyboard/). A keyboard move has no
  gesture duration of its own, so without the window the overlay would flash.
- **`grid.css`** — draws the structure with two `repeating-linear-gradient` layers, whose
  periods come from the custom properties `GridComponent` already publishes for tile
  positioning, so the overlay cannot fall out of step with the cells it describes:

  ```css
  background-origin: content-box;
  background-image:
    repeating-linear-gradient(to right,
      transparent 0,
      transparent var(--qbc-grid-column-width),
      var(--qbc-color-grid-line) var(--qbc-grid-column-width),
      var(--qbc-color-grid-line) calc(var(--qbc-grid-column-width) + var(--qbc-grid-gap))),
    repeating-linear-gradient(to bottom,
      transparent 0,
      transparent var(--qbc-grid-row-height),
      var(--qbc-color-grid-line) var(--qbc-grid-row-height),
      var(--qbc-color-grid-line) calc(var(--qbc-grid-row-height) + var(--qbc-grid-gap)));
  ```

  What the overlay paints is the gutters, not the cell edges. A period runs one column wide
  and then one gap wide, so the first line falls after the first column and the last column
  ends flush with no trailing line — the same edges the tiles leave.

  `background-origin` is `content-box` rather than the default padding box, because
  `GridWidthObserver` measures the content box and every tile is positioned from that
  origin. A host that gives the grid padding would otherwise see the overlay drift from the
  tiles by exactly the padding, which is the kind of defect that looks like a rounding error
  and is not one.

  Painting with a background is also what puts the overlay at risk on the one platform this
  library targets. An operating system forcing its own colours removes background images
  outright, so the cell structure would not be there at all for an operator running a high
  contrast desktop — the accommodation is common on the workstations this grid is built for,
  and `L2-019` asks for the overlay during every interaction without exception. The overlay
  therefore declines the forced-colour substitution and draws its lines in the system's own
  text colour, so the structure survives and still arrives in the palette the operator chose
  rather than in the library's.

  What survives without help is worth naming beside it. The shadow's fill is replaced in that
  mode and its border is kept and recoloured, so a valid target and an invalid one stay apart
  on the solid and dashed borders alone. The signal an operator cannot afford to lose
  degrades gracefully; the one that assists it is the one that needed the rule.

  Two consequences follow from painting with gradients rather than elements, and both are
  accepted rather than solved. Column width is fractional, so the lines land on fractional
  device pixels and rasterize a little unevenly at some widths; the overlay is a guide for
  the eye during a gesture, not a rule to measure against, and evening it out would mean the
  per-cell elements this design rejects. And the two layers composite where they cross, so
  `--qbc-color-grid-line` is defined as an opaque colour — a translucent override would
  double-paint every intersection and stipple the overlay with darker dots.
- **Fade** — the overlay's opacity transitions over `--qbc-duration-fast`, so the reveal
  reads as part of the gesture rather than as a flicker.

`GridComponent` writes `--qbc-grid-column-width`, `--qbc-grid-row-height`, and
`--qbc-grid-gap` once per metrics change. The overlay reads them and needs no update of its
own during a gesture, which is why no overlay work happens inside the drag loop.

## Requirements

The feature realizes the following level-2 (L2) requirement. It refines a level-1 (L1)
requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-019` | `L1-006` | The grid shall show the cell overlay for the duration of a move or resize, shall remove it whether the interaction commits or reverts, shall paint it behind every tile, and shall not let it intercept pointer events, and shall remain visible where the operating system forces its own colours. |

## Diagrams

The system context and container views are shared across every feature and are held at
the [tree root](../../README.md#where-the-c4-levels-live).

### Components

The interaction in flight gates one derived signal, which toggles one element. The cell
structure itself comes from the metrics custom properties the grid already publishes.

![C4 component view for revealing the grid](diagrams/c4-component.png)

### Class structure

`overlayVisible` is derived from the pointer session and the keyboard settle window
together, so both interaction paths reveal the grid identically.

![Class diagram for revealing the grid](diagrams/class-structure.png)

### Behaviour — show and hide the overlay

The overlay appears when the gesture starts, stays untouched for the whole of it, and is
removed on both the committing and the reverting exit.

![Sequence diagram for showing and hiding the overlay](diagrams/sequence-overlay.png)
