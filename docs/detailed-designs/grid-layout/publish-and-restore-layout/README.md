# Publish and restore the layout

## Overview

A dashboard arrangement outlives the session that made it. This feature is the contract
through which an arrangement leaves the grid and comes back: what the grid emits, when it
emits, and what guarantee the emitted data carries when it is supplied back.

The contract is plain data. A layout is an array of records holding `id`, `x`, `y`,
`cols`, `rows`, and `locked` — no class instances, no methods, nothing that survives
`JSON.stringify` badly. That is what lets a host persist a layout anywhere without
knowing anything about the grid.

An emitted record carries the whole tile, not only its geometry. Any `label`, `minCols`,
`minRows`, `maxCols`, and `maxRows` the host supplied are carried through unchanged, so a
save and restore does not quietly strip a tile's accessible name or its size limits. A
grid that emitted geometry alone would return a layout whose tiles announce themselves by
`id` and resize past the bounds their host set.

Timing matters as much as shape. The grid emits on **change**, not on **movement**. A
drag across 300 pixels of pointer travel produces one emission at release, not one per
pointer event — and a drag that wanders across the grid and returns to where it began
produces none at all, because nothing changed. Emitting per event would flood any
persistence the host attaches and would publish geometries the operator never chose, since
a drag passes over many cells on the way to the one it lands on.

The round trip carries one guarantee: a layout the grid emitted, supplied back to a grid
with the same configuration, renders identically and emits nothing. Emitting on restore
would mean the grid disagreed with data it had just produced, which would make a
save-on-emit host write forever in a loop. The one case where restore does emit is a
layout that needed repair, which is the subject of
[`normalize-supplied-layout`](../normalize-supplied-layout/).

## Description

The slice runs from the grid's output through the `domain` library to the `api` library's
service contract.

- **`GridComponent.layoutChange`** — Angular output carrying `GridTile[]`. It fires from
  the private `commit` method and from nowhere else, which is why the "exactly once per
  change" guarantee holds across add, remove, interaction, and repair alike.
- **`GridComponent.commit`** — the single emission gate. It compares the proposed tiles
  with the current ones and returns without emitting when every geometry is identical, so a
  drag that lands a tile back on the cells it started from is not a change and produces
  nothing. When something did change, it builds a fresh array of fresh records before
  emitting: handing out the grid's own array would let a host mutate the grid's state by
  accident, and a copy makes the emitted value inert.
- **`DashboardComponent`** — in the `domain` library. It injects `DASHBOARD_SERVICE`,
  binds the loaded layout into `qbc-grid`, and calls `save` on each emission. It holds the
  layout in a signal rather than an observable, since the layout is state rather than a
  stream.
- **`IDashboardService`** — the contract in the `api` library, declaring `load` and
  `save`. It carries no HTTP type, so `domain` stays free of transport concerns.
- **`DASHBOARD_SERVICE`** — the `InjectionToken` every consumer injects. The interface,
  the token, and each implementation live in separate files.
- **`DashboardService`** — the production adapter. It reads and writes the layout as JSON
  in browser storage, and converts the stored value to a signal at the boundary.
- **`MockDashboardService`** — the adapter bound under Playwright, returning a fixed
  layout so an acceptance test never depends on stored state.

The grid itself injects none of these. It takes a layout in and hands a layout out, which
is what keeps `GridComponent` publishable from the `components` library with no
application dependency.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement
refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-023` | `L1-008` | The grid shall expose the layout as plain tile records, shall emit it only when a committed interaction, an add, a remove, or a repair changes it, and shall not emit during a drag or resize. |
| `L2-024` | `L1-008` | A layout emitted by the grid shall reproduce the same rendered geometry when supplied back to a grid with the same configuration, and shall emit nothing on load when no repair is needed. |

## Diagrams

The system context and container views are shared across every feature and are held at
the [tree root](../../README.md#where-the-c4-levels-live).

### Components

The grid emits into `DashboardComponent`, which reaches storage only through the
`DASHBOARD_SERVICE` token. Two implementations satisfy the contract: the storage adapter
in production and a deterministic mock under Playwright.

![C4 component view for publishing and restoring the layout](diagrams/c4-component.png)

### Class structure

`DashboardComponent` depends on the token and the interface, never on a concrete adapter.
`GridComponent` depends on neither.

![Class diagram for publishing and restoring the layout](diagrams/class-structure.png)

### Behaviour — publish a changed layout

Pointer moves change the shadow and emit nothing. Release commits once, freezes a copy,
and the host persists it.

![Sequence diagram for publishing a changed layout](diagrams/sequence-publish.png)

### Behaviour — restore a saved layout

The loaded layout passes through repair. A clean layout emits nothing; a repaired one
emits once so the host can persist the correction.

![Sequence diagram for restoring a saved layout](diagrams/sequence-restore.png)
