# qbc-grid detailed designs

## Overview

`qbc-grid` is an Angular component library that arranges dashboard tiles on a
cell-based grid and lets an operator move and resize those tiles with a pointer or
the keyboard. It targets Open MCT style operator dashboards on large desktop
screens, and its feature surface is deliberately small: the requirements in
`docs/specs/L1.md` name what the library does, and the "Out of Scope" section
there names what it deliberately does not.

Terms used across every design in this tree, defined once here:

- **cell** — one grid column wide by one row height tall
- **tile geometry** — the record `{ x, y, cols, rows }` locating a tile in whole
  cells from the origin at the top-left of the grid
- **shadow** — rectangle drawn at the cell geometry a tile would take if the
  interaction in progress were released
- **overlay** — cell structure painted behind the tiles for the duration of an
  interaction
- **commit** — adoption of a proposed geometry, followed by emission of the layout
  when the adoption changed something, and by no emission when it did not
- **revert** — restoration of the geometry a tile held before an interaction,
  with no emission

## Subsystems

| Subsystem | Concern | Features |
|-----------|---------|----------|
| [`grid-layout`](grid-layout/) | The cell model, the layout data contract, and its repair | 4 |
| [`tile-interaction`](tile-interaction/) | What the operator does to a tile, and what the grid shows in return | 6 |
| [`library-delivery`](library-delivery/) | How the grid fills a viewport, holds its frame budget, projects content, and ships | 4 |

## Where the C4 levels live

The system context and container views are identical for all 14 features: one
operator, one dashboard application, one component library, one browser. They are
held once here rather than repeated 14 times, and each feature carries the C4
**component** view scoped to its own slice, along with its class and sequence
diagrams.

### System context

The operator arranges tiles in the dashboard application. The application renders
through the browser, which returns pointer, keyboard, and resize events. The
design system supplies the tokens the grid reads for every visual value.

![C4 system context for qbc-grid](diagrams/c4-context.png)

### Containers

The application project composes the `domain` library, which reaches the layout
store through the `DASHBOARD_SERVICE` token in the `api` library and renders the
grid from the `components` library. The `components` library is the published
deliverable and depends on nothing above it.

![C4 container view for qbc-grid](diagrams/c4-container.png)

## The testing seam

The front end is tested with Playwright and the Page Object Model: a page object owns the
selectors and a test states intent. There is one page object, because there is one screen.
The dashboard is served at three routes, and a route is a way of opening that screen rather
than a screen of its own, so the page object takes the token configuration and the named
layout fixture as parameters and the selectors are written once. Three page objects for three routes would put the same selector
in three files, which is the duplication the rule exists to prevent and the reason a
stylesheet change would then break the suite in three places instead of none. That division holds only where the grid publishes
something stable for a page object to hold on to. A page object written against internal
class names breaks at the next stylesheet change, and the acceptance criteria of 34
requirements break with it.

The grid therefore carries a small set of attributes and treats them as fixed. They are not
part of the package's public API — no consumer names them, and the exported surface stays at
the five entries [`theme-the-grid`](library-delivery/theme-the-grid/) lists. What depends on
them is this repository's own page objects, so changing one breaks the acceptance suite
rather than a consumer's build. That is a smaller blast radius than renaming an input and a
larger one than renaming an internal class, and it is worth stating at its real size rather
than borrowing the language of either.

| Attribute | Sits on | Carries |
|-----------|---------|---------|
| `data-qbc-grid` | the grid host | `data-mode`, of `live` or `edit` |
| `data-qbc-tile` | each tile | the tile's `id`, and `data-locked` when it is locked |
| `data-qbc-shadow` | the shadow | `data-valid`, of `true` or `false` |
| `data-qbc-overlay` | the overlay | its presence, which is the whole of its state |
| `data-qbc-handle` | the resize handle | its presence |
| `data-qbc-announcer` | each of the two live regions | the text last announced, in whichever of the pair was written most recently |

Each one exists because a criterion asks something the rendered pixels cannot answer.
`L2-012` asks whether the shadow is in its invalid state rather than its valid one;
`L2-008` asks whether a tile is locked; `L2-029` asks what was announced.

Geometry needs no attribute of its own. A page object reads `--qbc-tile-x`,
`--qbc-tile-y`, `--qbc-tile-cols`, and `--qbc-tile-rows` from a tile's computed style, and
`--qbc-grid-columns`, `--qbc-grid-column-width`, `--qbc-grid-row-height`, and
`--qbc-grid-gap` from the host's. Those return the cell coordinates and the column
arithmetic the criteria are already written in. The alternative — measuring pixel offsets
and dividing back down into cells — would reimplement the grid's own arithmetic inside the
tests that exist to check it, and would agree with the grid even when both were wrong.

The host affordances a specification needs are described where the behaviour they serve is
described: the [token configurations](library-delivery/theme-the-grid/#the-three-token-configurations)
and the [layout fixtures, configuration parameters, and emission record](grid-layout/publish-and-restore-layout/)
each sit beside the requirement that asks for them.

Two criteria ask that the grid not throw, and one that it not hang. Neither is a claim a
single assertion can carry, so both are standing conditions of the suite: a specification
fails on any uncaught page error, and a fixture of five hundred records renders inside the
suite's ordinary timeout or fails by exceeding it. Stating them once keeps every
specification from restating them and keeps a swallowed error from passing quietly.

### Observing what the DOM does not show

Twenty-seven of the acceptance criteria in `docs/specs/L2.md` are about emission: seventeen
assert that nothing was emitted, and seven that a layout was emitted exactly once. An
Angular output leaves no trace in the DOM, so none of the attributes above can answer any
of them, and a quarter of the specification would otherwise be unassertable.

The demonstration application records what the grid emits and renders the record, because
it is already test scaffolding by declaration and the published library is not. Two more
attributes therefore exist, and they belong to the demonstration page rather than to the
grid's published surface:

| Attribute | Sits on | Carries |
|-----------|---------|---------|
| `data-qbc-emissions` | the demonstration page | how many layouts the grid has emitted since load |
| `data-qbc-last-layout` | the demonstration page | the most recent emitted layout, as JSON |
| `data-qbc-widget-instance` | each projected widget | the instance value it took at construction |

Seven criteria act through a control rather than a gesture — the host adds a tile, removes
one by id, sets the mode, or mutates a record it was handed. Those controls belong to the
demonstration page and carry hooks of their own, for the same reason the observations do: a
page object binding a click to a button's text or a stylesheet class is a selector that
breaks on a wording change or a restyle.

| Attribute | Sits on | Drives |
|-----------|---------|--------|
| `data-qbc-mode-toggle` | the demonstration page | switching between `live` and `edit` |
| `data-qbc-add-tile` | the demonstration page | adding a tile through the grid's `addTile` |
| `data-qbc-remove-tile` | each tile's projected content | removing that tile by id |
| `data-qbc-lock-toggle` | each tile's projected content | locking and unlocking that tile |
| `data-qbc-mutate-layout` | the demonstration page | mutating the last emitted layout in place |

The remove control sits inside a tile's projected content rather than on the tile element,
because the grid renders no chrome of its own. It earns its keep twice: it is how `L2-022`
removes a tile, and it is the button inside a tile that `L2-009` requires to stay clickable
in `edit` mode, so the arrangement under test is the one an operator would meet.

The lock toggle is there because `L2-008` asks what happens when a tile *is unlocked while
the grid is in edit mode* — a transition, not a state, so a fixture that starts unlocked
cannot answer it. A control expressed in a criterion's *given* rather than its *when* is
easy to miss: the sweep that found the other four searched for what the host does, and this
one is written as something that happens to a tile.

Three criteria act while a gesture is still in flight: `L2-007` changes the mode during a
drag and again during a resize, and `L2-022` removes the tile that is being dragged. Pointer
capture turns each of them into a question of how. The pointer that began the gesture is
routed to the tile until the gesture ends, so no control anywhere on the page can be reached
with it — not the mode toggle, and not the remove control, even though that one sits inside
the tile the pointer is already over.

Every one of them is driven from the keyboard instead, which is a path an operator genuinely
has rather than a contrivance for the suite. It is also the only path, which is worth
knowing before writing the specifications: a suite that reached for a second click here would
find the gesture swallowing it and would read the result as a defect in the grid.

A count answers the negatives and the exactly-once criteria; the payload answers the rest,
such as `L2-013`, which asks that an emitted layout contain every tile with only the dragged
one's `x` and `y` changed. The saved layout cannot stand in for either, because
`DashboardComponent` coalesces its writes — after a burst of commits the number of saves and
the number of emissions deliberately differ.

`L2-023` asks that a host mutating a record it received leave the grid unaffected, which
needs a host willing to try. The demonstration page carries a control that mutates the last
emitted layout in place, so the specification can perform the abuse the requirement
describes rather than assume nobody will.

Four criteria resist attributes altogether. `L2-031` asks how many style writes land in an
animation frame, whether any layout-forcing measurement occurred, and whether any tile other
than the dragged one was touched. Those are answered by instrumentation the specification
installs — a `MutationObserver` over the tile elements for the write counts, and a
performance trace for the frame durations — not by anything the grid or the page publishes.

## Deliberate exclusions

`AGENTS.md` describes a .NET API, MediatR, and a `backend/` tree for this
repository. The requirements in `docs/specs/` name no server-side behaviour, so
this design introduces no backend. The layout is plain data that the grid emits;
the `api` library persists it through a browser storage adapter bound to the
`DASHBOARD_SERVICE` token, and a mock is bound in its place under Playwright. If a
shared or multi-user dashboard is later required, that adapter is the single seam
a .NET API would sit behind, and the grid itself would not change.

The design also excludes collision resolution during interaction, touch input,
nested grids, and breakpoint-driven column collapsing, each for the reason given
in `docs/specs/L1.md`.
