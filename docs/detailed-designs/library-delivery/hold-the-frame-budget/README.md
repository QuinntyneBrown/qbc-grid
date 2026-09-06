# Hold the frame budget

## Overview

A drag is judged entirely on whether it feels attached to the hand. At 60 frames per
second a frame lasts about 16 ms, and a dashboard carrying 60 tiles gives the grid no
slack to waste. This feature is the set of decisions that keep a drag inside that budget,
and the reason none of the other interaction features have to think about it.

Three costs threaten a drag loop, and each is removed rather than reduced.

**Reading the DOM during the gesture.** Asking an element for its position mid-gesture
forces the browser to compute layout before it can answer. Every geometric value the drag
needs is therefore measured once, when the gesture starts, and cached for its duration.
Nothing in the loop reads an element.

**Writing more often than the screen updates.** A browser can deliver many pointer events
between two frames, and acting on each one does work no eye will ever see. Writes are
therefore scheduled rather than applied: many events in one frame collapse into the single
write that frame will paint.

**Writing properties that force layout.** Position is applied as a `transform`, which the
compositor can apply without recomputing layout. A resize changes width and height, which
does cost layout, but on exactly one element.

The fourth decision is what is *not* touched. During a drag only the dragged tile and the
shadow have their styles mutated. The other 59 tiles are inert, so the cost of a drag does
not grow with the size of the dashboard.

## Description

The budget is held by one small class and one cached record, used by every gesture.

- **`GridFrameScheduler`** — holds at most one pending write and one outstanding
  `requestAnimationFrame` handle. `schedule(write)` replaces the pending write and requests
  a frame only when none is outstanding, so 20 pointer events in one frame produce one
  write, not 20. `stop` cancels the outstanding handle and drops the pending write, which
  release, cancellation, and destruction all use so no write outlives the gesture.

  A write is one mutation of an element's style attribute rather than one property
  assignment. The two drag offsets set in a single callback are one write, because one
  render transaction reaches the browser; counting properties would make the budget a
  statement about how the position happens to be expressed.

  Release does not flush the pending write, and the difference matters. The scheduled
  callback holds the preview belonging to the last frame, while the release holds a pointer
  sample newer than it. Applying the stale one and then the committed geometry paints a
  position the operator has already moved past, and applying it after the commit paints a
  preview over a finished drag. So release resolves its own final sample, calls `stop` to
  discard whatever was queued, adopts the result, and clears the preview styles, in that
  order. Cancellation takes the same path without the adoption, which is why a cancelled
  gesture with a frame outstanding paints nothing when that frame would have run.
- **`GridGestureCache`** — the values measured once at gesture start: the grid's left and
  top in client coordinates, the column width, the row height, the gap, and the offset
  between the pointer and the tile's top-left corner. `GridPointerSession` holds one for the
  life of a gesture.
  It is refreshed on a container resize and at no other time, described in
  [`fill-the-desktop-viewport`](../fill-the-desktop-viewport/). Measuring once is the rule
  for pointer events, which arrive by the dozen in a frame; a resize arrives rarely and
  invalidates the cached geometry outright, so holding the stale numbers would trade a
  correct drop for a measurement nobody would have noticed. The refresh rebases the grab
  offset along with the metrics, because a column width that changed under a lifted tile
  moves the corner the offset was measured against, and refreshing one without the other
  slides the tile out from under the cursor.

  Every other change a host can make during a gesture cancels it rather than refreshing it,
  as [`switch-grid-mode`](../../tile-interaction/switch-grid-mode/) describes. A width
  change is the one case where the layout the gesture was proposed against still stands.
The frame does the work, and the event only records the sample. A handler that derives a
candidate and scans for occupancy before scheduling has already done that work twenty times
in a frame that paints once; batching the write alone leaves nineteen scans and nineteen
discarded closures behind it. So a pointer event stores its sample and requests a frame,
and the scheduled callback derives the candidate, tests it, and writes — once, against the
last sample the frame received.

Where the listener is registered matters as much under zoneless change detection as the
scan does. There is no zone to step outside of, and a bound template listener notifies the
scheduler on every event whether or not the handler changes anything. The high-frequency
listeners are therefore registered directly on the tile and removed with the gesture, and
the signals a template reads change when the gesture's state changes rather than when a
pointer moves.

- **`cellAt`** and **`canPlace`** — pure functions over numbers and cell rectangles. Neither
  touches an element, which is what makes the per-event work a few arithmetic operations
  and an overlap scan rather than a layout pass.
- **The drag offset properties** — `--qbc-drag-offset-x` and `--qbc-drag-offset-y` on the
  dragged tile. The stylesheet composes them with the tile's cell position inside a single
  `transform: translate3d(...)`, so the per-frame write is two custom property assignments
  on one element.
- **`--qbc-elevation-drag`** — applied through a class on the dragged tile at gesture start
  and removed at its end, rather than per frame, so the lift costs one style change for the
  whole gesture. The same class carries `will-change: transform`, and the timing is the
  reason it is worth naming. Promoting the tile to its own compositor layer is what keeps
  the per-frame transform off the main thread, but a promotion costs memory and a paint, so
  a grid that declared it on every tile would hold sixty layers to move one. Declaring it
  only for the tile under the pointer, for only as long as the gesture lasts, is what buys
  the compositing without the standing cost. `L2-010` binds the release as well as the
  taking, because a promotion that is never dropped costs exactly what scoping it was
  meant to save and passes every criterion that only looks at a drag in flight.

The overlap scan in `canPlace` is linear in the tile count, which at 60 tiles is far below
the cost of a single layout pass. It is left simple rather than indexed, because the
measured budget holds without an index and a spatial index would be code the requirements
do not need.

The budget `L2-031` sets is a budget for the grid, and the criterion says so by fixing what
the tiles hold: static content that neither animates nor updates. Without that condition the
measurement would answer a different question every time it ran — sixty empty elements pass
it trivially, and sixty live telemetry widgets fail it while the grid does nothing wrong.
A number that moves with an unstated variable measures the variable.

What the grid can promise is therefore bounded, and the bound is worth stating plainly. It
touches two elements per frame however many tiles exist, and it leaves the resting tiles
alone. It cannot make room for a host that re-renders sixty widgets on every telemetry tick;
that work lands in the same frames, and no amount of care inside the grid recovers it. The
projection seam is what leaves that cost where it can be fixed — in the host's components,
which own their own change detection — rather than burying it inside a library that has no
view of it.

The threshold is a quantity before it is a number, and the quantity is the main-thread work
a frame spends on the gesture: script, style, layout, and paint. The interval between
frames is the reading that looks equivalent and is not. An unblocked 60Hz stream presents
every `1000 / 60` ms, or 16.667 ms, so a suite measuring animation-frame timestamps against
a 16 ms budget reports a failure on a run that dropped nothing. Measuring only the time
spent inside the callback has the opposite fault: it passes while style, layout, or paint
miss the frame the work belonged to.

A number without the conditions that produced it is not reproducible, so the benchmark
fixes them. It runs a production build on the reference runner — the acceptance suite's
Chromium at a pinned CPU throttling factor, recorded with the browser and version, the
device scale, and the display cadence — over the 60-tile static fixture. It warms up, then
takes three measured two-second drags, and reports each run's 95th percentile, its maximum,
its sample count, and its dropped frames, retaining the raw traces. The write-count
instrumentation runs separately, because a `MutationObserver` watching every tile changes
the thing the timing run is measuring.

## Requirements

The feature realizes the following level-2 (L2) requirement. It refines a level-1 (L1)
requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-031` | `L1-012` | The grid shall apply position and size through compositor-friendly style writes batched to at most one style-attribute mutation per animation frame per moved element, shall measure gesture geometry once at gesture start and again only when the container width changes, shall resolve the final pointer sample on release and discard any pending preview write, and shall hold the 95th percentile of per-frame main-thread work at or below 16 ms while one tile among 60 is dragged. |

## Diagrams

The system context and container views are shared across every feature and are held at
the [tree root](../../README.md#where-the-c4-levels-live).

### Components

The session measures once and computes from cached numbers; the scheduler decides when the
result reaches the DOM; the stylesheet keeps a move on the compositor.

![C4 component view for holding the frame budget](diagrams/c4-component.png)

### Class structure

`GridFrameScheduler` holds one pending write and one frame handle. `GridGestureCache` holds
everything the loop would otherwise have to measure.

![Class diagram for holding the frame budget](diagrams/class-structure.png)

### Behaviour — collapse pointer events into one write per frame

Twenty pointer events in one frame produce one write, on one element, composited without
layout.

![Sequence diagram for collapsing pointer events into one write per frame](diagrams/sequence-frame-budget.png)
