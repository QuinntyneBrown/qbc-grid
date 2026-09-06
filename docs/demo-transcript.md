# Demo transcript

[Watch the video](media/qbc-grid-demo.mp4) · [Chapters and reproduction](demo.md)

## 00:00 — Your dashboard. Your Angular content.

Meet Q B C Grid, a focused Angular library for desktop dashboards. The grid owns tile placement and interaction. Your application supplies the widgets and decides where layouts are stored. This walkthrough uses the real Angular application, with a presentation frame and live measurements added for the recording.

## 00:20 — Move with a clear destination

Enter edit mode and drag a tile into free space. The tile lifts under the pointer, while a separate shadow previews its destination in whole cells. Grid lines appear during the gesture and disappear on release. One committed layout change reaches the host application.

## 00:40 — Predictable collision handling

An occupied destination shows an invalid, dashed preview. Releasing the pointer restores the original placement without pushing or swapping neighboring tiles. You can also press Escape during a drag to cancel it. Neither a refused move nor a cancelled gesture publishes a changed layout.

## 01:00 — Resize in whole cells

Drag the corner handle to resize a tile. Its top left corner stays fixed while the destination snaps to whole column and row spans. Each tile can declare minimum and maximum sizes. Here, growth stops at five columns and four rows, then shrinking stops at two by two.

## 01:20 — Control when editing is allowed

Live mode removes layout editing affordances while widget controls remain usable. Edit mode enables movement and resizing for unlocked tiles. Locking a tile removes its resize handle and blocks movement. Unlock it to restore editing. The host application owns these mode and lock controls.

## 01:40 — Work from the keyboard

Focus an unlocked tile and use the arrow keys to move one cell at a time. Hold Shift with an arrow to resize. The grid announces the resulting position or refusal through a live region. The panel on the right mirrors that actual announcement so you can see it.

## 02:00 — Reach space beyond an obstacle

Sometimes a single cell step cannot cross an obstacle. This locked tile spans every column, so Arrow Down is refused. Control plus Arrow Down finds the nearest fitting position beyond the barrier. Control plus Arrow Up returns the tile. Keyboard users can reach the same free regions as pointer users.

## 02:20 — Add, place, and remove

The Add tile control asks the grid to choose the first available position in row order. Applications can also call add Tile with explicit coordinates, as shown here. Removing a tile leaves its neighbors in place. When a focused tile is removed, focus moves to a nearby editable tile.

## 02:40 — Keep your widget state

Tiles contain real projected Angular components. Type a note and scroll the readings, then move the tile. The note, scroll position, and component instance remain intact. Input fields own their keyboard and pointer events, so interacting with a widget does not accidentally start a grid gesture.

## 03:00 — Save data. Restore the dashboard.

Layouts are plain records with tile identifiers, cell coordinates, spans, and optional metadata. After a move, this host stores the emitted layout as JSON in browser local storage. Reloading restores the same placement. Storage belongs to the application; the published grid has no persistence or backend dependency.

## 03:20 — Repair supplied layouts

Stored layouts can contain invalid records, duplicate identifiers, impossible dimensions, or overlapping tiles. The grid normalizes the supplied data in a deterministic order. Here, unusable records disappear, dimensions are clamped, and the later overlapping tile moves down. The repaired layout is then emitted to the host.

## 03:40 — Fit the desktop workspace

The grid responds to its container width without changing its column count. Watch the measured width change while the layout remains twelve columns wide. Tiles still use the same cell coordinates. Moving a tile into lower rows extends the dashboard vertically; the host provides the scrolling region.

## 04:00 — Make the grid your own

The separate Q B C design system owns the grid's CSS custom properties. Override those tokens to change surfaces, borders, focus color, and interaction previews. The same behavior works with the new theme. A reduced motion preference sets the overlay and settling durations to zero without changing interaction rules.

## 04:20 — A populated dashboard in motion

This dashboard contains sixty tiles. Dragging still previews a single destination, while the committed change counter stays steady until release. The implementation schedules visual updates by animation frame and avoids moving neighboring tiles. This is a functional demonstration; the repository's performance tests provide the separate measurement checks.

## 04:40 — Build on a small, open API

The package exposes a standalone grid component, a tile template directive, and plain layout types. Angular is a peer dependency, and the design tokens ship separately. Start with the README for setup, the API guide for integration, and the contribution guide to get involved. Q B C Grid is MIT licensed.
