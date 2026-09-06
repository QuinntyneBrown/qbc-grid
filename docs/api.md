# API and integration guide

[README](../README.md) · [Demo](demo.md) · [Public exports](../src/qbc-grid/public-api.ts)

The public package exports `GridComponent`, `GridTileTemplateDirective`, and the types
`GridTile`, `GridMode`, and `AddTileRequest`. Import them from `qbc-grid`; internal helper
files are not part of the package API.

## Component inputs and output

Use the standalone `<qbc-grid>` component and a `*qbcGridTile="let tile"` template.
The [README example](../README.md#usage) shows all required wiring.

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `layout` | `readonly GridTile[]` | Required | Host-supplied layout; a new value replaces the current layout |
| `columns` | `number` | `12` | Number of equal-width columns |
| `rowHeight` | `number` | `60` | Row height in CSS pixels |
| `gap` | `number` | `8` | Gap between cells in CSS pixels |
| `mode` | `'live' \| 'edit'` | `'live'` | Whether unlocked tiles can be moved and resized |

`layoutChange` emits a fresh `GridTile[]` after a committed change, successful add or
remove, or repair of supplied data. Pointer previews, refused moves, cancelled gestures,
and no-op operations do not emit changed layouts. Valid supplied layouts are not echoed
back as changes. Treat emitted records as immutable and update the host's layout signal:

```html
<qbc-grid [layout]="layout()" (layoutChange)="layout.set($event)">
  <div *qbcGridTile="let tile">{{ tile.label ?? tile.id }}</div>
</qbc-grid>
```

`columns` is floored and bounded to at least one; `rowHeight` is bounded to at least one
pixel and `gap` to zero. Non-finite numeric options use their defaults. If gaps would
consume the available width, they shrink so columns can still render. Container resizing
changes column width, not cell coordinates or column count, and does not emit a new layout.

## Tile records

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Unique, nonblank identity; stable across updates |
| `x`, `y` | `number` | Zero-based column and row of the top-left corner |
| `cols`, `rows` | `number` | Positive whole-cell spans |
| `locked` | `boolean?` | `true` prevents user movement and resizing even in edit mode |
| `minCols`, `minRows` | `number?` | Minimum spans |
| `maxCols`, `maxRows` | `number?` | Maximum spans |
| `label` | `string?` | Accessible tile name; a blank or missing label falls back to `id` |

A lock controls user layout interaction. It does not prevent a host from replacing or
removing the tile. Keep application-specific widget data in your own model keyed by tile
ID; arbitrary extra properties are not part of the normalized layout contract.

## Read, add, and remove

The component's `tiles()` signal exposes its current normalized layout for reading.
`addTile(request: AddTileRequest): void` and `removeTile(id: string): void` are public
methods. Use an Angular view query after the grid is rendered:

```ts
import { viewChild } from '@angular/core';
import { GridComponent } from 'qbc-grid';

// Members inside your dashboard component:
readonly grid = viewChild.required(GridComponent);

addTelemetry(): void {
  this.grid().addTile({ id: 'telemetry', cols: 3, rows: 2, label: 'Telemetry' });
}

addAtPosition(): void {
  this.grid().addTile({ id: 'status', x: 6, y: 0, cols: 3, rows: 2, label: 'Status' });
}

removeTelemetry(): void {
  this.grid().removeTile('telemetry');
}
```

An add request accepts the tile fields above, with `x` and `y` optional. Omit both to
choose the first fitting position in row-major order. Supply both to request an explicit
position. If it is occupied, the grid finds a free position. Duplicate IDs are refused;
removing an unknown ID is a no-op. Both methods work independently of live/edit mode.
Validate IDs in your application before constructing typed add requests.

Removing a focused tile moves focus to the next unlocked tile in edit order, then the
previous one, or finally the grid if neither exists. Removing a tile that does not
contain focus leaves focus alone.

## Interaction rules

In edit mode, press an unlocked tile's bare surface and drag with a mouse. The grid shows
an elevated tile, destination shadow, and cell overlay. Invalid destinations use a dashed
border as well as color. Release to commit a valid destination; a collision restores the
original geometry. The bottom-right handle resizes with the top-left origin pinned.

Arrow keys move a focused tile. Shift + Arrow resizes, and Ctrl + Arrow jumps to the
nearest fitting position in that direction. Commands respect collisions and size limits.
The grid supplies instructions and live-region announcements; the template should give
its own controls meaningful labels.

Escape cancels an active pointer gesture. Changing mode, replacing the layout, or locking
the active tile cancels an in-flight gesture too. Keyboard commands commit individually;
Escape is not an undo command. Button, link, field, and editable-region interactions
belong to the projected content and do not start a drag.

## Layout ownership and persistence

Use `layoutChange` to update the host signal and persist data through your application's
service interface and injection token. Restore by supplying the saved array to `layout`.
The grid does not inject a storage service or perform HTTP requests.

The acceptance application provides a concrete example:

- [Service contract](../src/e2e-app/app/dashboard/i-dashboard-service.ts)
- [Injection token](../src/e2e-app/app/dashboard/dashboard-service.token.ts)
- [Browser storage adapter](../src/e2e-app/app/dashboard/dashboard-service.ts)
- [Dashboard integration](../src/e2e-app/app/dashboard/dashboard.ts)
- [Deterministic test adapter](../src/e2e-app/app/dashboard/mock-dashboard-service.ts)

The ordinary app stores only layout records under `qbc-grid.dashboard`. Projected field
values and widget data are separate application state; they are preserved during tile
movement but are not automatically saved across reloads. If storage is unavailable, the
example adapter keeps the current in-memory layout usable.

## Supplied-layout repair

Incoming data is normalized in input order. Non-record entries and records without usable
IDs are discarded. For duplicate IDs, the first record wins. Non-finite or invalid
coordinates and spans receive defaults, finite values are floored, and geometry is bounded.
Invalid size limits are removed; a maximum below its minimum is raised to that minimum.
The grid boundary takes precedence over a width minimum that cannot fit.

When records overlap, later records move downward to the first free row at or below their
requested row. This repairs supplied layouts; interactive collisions are refused. A
repair emits the corrected layout once so the host can retain it. See
[normalization criteria](specs/L2.md) for boundary cases.

Normalization does not sanitize arbitrary widget HTML or authorize changes. Continue to
validate application data at its trust boundary, as described in [SECURITY.md](../SECURITY.md).

## Theming and motion

Import `@qbc/design-system/qbc-tokens.css` globally, then override the documented `--qbc-*`
tokens. See the [design system guide](../design-system/README.md). The grid's internal
geometry properties are implementation details; configure geometry through inputs and
tile records. Respect `prefers-reduced-motion` when overriding duration tokens.

## Verification and limitations

The repository tests desktop Chromium behavior, pure geometry functions, design tokens,
and installation in an isolated Angular consumer. The sixty-tile performance scenario is
defined in [frame-budget.spec.ts](../e2e/specs/frame-budget.spec.ts); it is not a universal
frame-rate guarantee. Mobile, touch, pen, and server-rendering compatibility are not
established by those checks. Full product boundaries are listed in [L1](specs/L1.md).
