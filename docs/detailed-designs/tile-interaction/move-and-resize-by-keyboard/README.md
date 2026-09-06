# Move and resize by keyboard

## Overview

An operator dashboard is a workplace, and a grid that can only be arranged with a mouse
excludes anyone who does not use one. Every move and every resize the pointer can perform
is therefore available from the keyboard, on the same rules and with the same outcomes.

The command set is four keys and one modifier. With an unlocked tile focused in `edit`
mode, an arrow key moves the tile one cell in that direction, and `Shift` with an arrow
changes the span by one column or one row. There is no separate grab-and-drop state to
enter and leave: each key press is a complete, committed command. A modal keyboard drag
would need an entry key, an exit key, a cancel key, and a way to tell the operator which
state they are in — all to reproduce what one arrow press already does.

Because each press is a whole command, `Escape` has nothing to cancel here. The way to
undo a keyboard move is the opposite arrow, which needs no explanation.

Refusal follows the pointer's rules exactly. A command that would take the tile outside
the grid, past a declared size limit, or onto cells another tile occupies is refused: the
tile does not move, nothing is emitted, and the operator is told. Silently absorbing the
key press would leave a screen-reader user pressing an arrow with no way to know the tile
had stopped.

Announcement is what makes refusal legible. A polite live region reports each committed
command with the tile's name and its new one-based column and row, and reports each refused
command as blocked. One-based numbers are used because "column 5" is what an operator
counts, while the stored geometry is zero-based.

## Description

The keyboard path reuses every rule the pointer path uses, and adds naming and
announcement.

- **`GridComponent.onKeyDown(tile, event)`** — bound on each tile. It returns immediately
  unless `isInteractive(tile)` is true, so a locked tile and `live` mode are both handled
  by the predicate already described in [`lock-a-tile`](../lock-a-tile/). It calls
  `preventDefault` only for a key it consumes, leaving `Tab` and every other key to the
  browser.
- **`gridKeyboardCandidate(event, tile, columns)`** — pure function mapping a key event to a
  candidate `GridCell`, or `null` for a key the grid does not consume. An unmodified arrow
  shifts `x` or `y` by one; `Shift` with a horizontal arrow changes `cols` and with a
  vertical arrow changes `rows`. A resize candidate passes through `clampTile`, so
  `minCols`, `minRows`, `maxCols`, and the grid's column bound apply exactly as they do to a
  pointer resize.
- **`canPlace`** — the same overlap and bounds test the drag shadow uses. A candidate that
  fails it is refused.
- **`accessibleNameOf(tile)`** — returns the tile's `label` when the host supplied one, and
  otherwise derives a name from the `id`. Every tile therefore has a non-empty accessible
  name, and a host that supplies none still gets a usable announcement rather than an
  unlabelled control.
- **`announcementFor(name, cell, accepted)`** — composes the live region text: the tile
  name with its one-based column and row for a committed move, the new span for a committed
  resize, and a statement that the command was blocked for a refusal.
- **The instruction element** — one visually hidden element in the grid, carrying the
  sentence that names the commands, with every unlocked tile in `edit` mode pointing at it
  through `aria-describedby`. Each tile also carries an `aria-roledescription` naming it a
  dashboard tile, so what is focused is identified before what can be done to it.

  Announcing a result is not the same as offering a command. Without the description a
  screen-reader user reaches a tile, hears its name, and has no way to learn that the arrow
  keys do anything at all — the keyboard path is present and undiscoverable, which for the
  operator it exists to serve is close to absent. One shared element rather than one per
  tile, because sixty copies of the same sentence is sixty nodes carrying no extra meaning.
- **`GridComponent.announcement`** — signal bound into a pair of polite `aria-live` regions
  in the grid's template, written alternately. Writing text into an existing region, rather
  than inserting one, is what makes the announcement reliable; alternating between two is
  what makes a repeat audible.

  A live region speaks when its contents change, so writing the same sentence twice is not an
  event and says nothing. An operator at column 0 presses the left arrow, hears that the move
  was blocked, presses it again to be sure, and hears silence — which reads as the second
  press having worked, the opposite of what happened. Refusals are the announcements most
  likely to repeat, because an operator who has just been blocked is the operator most likely
  to try again. Alternating the two regions makes every write a change in one of them,
  without padding the text with characters a screen reader would read out.

  It is written once a run of commands settles, on the same window the overlay uses, and not
  once per command. A held arrow key commits at the keyboard's repeat rate, and a polite
  region queues rather than interrupts, so announcing each step would read a backlog of
  positions the tile passed through minutes after it stopped at the last of them. The
  operator this feature exists for would be listening to history. The saves coalesce and the
  overlay coalesces for the same burst; the announcement is the third thing riding that
  window, and the one where the cost of missing it falls on somebody who has no other way to
  know where the tile ended up.
- **`GridComponent.settling`** — the window during which the overlay stays visible after a
  keyboard command. Its length is an interval the component keeps rather than a motion
  token, so a request for reduced motion shortens the animations and leaves it alone. A keyboard command has no gesture duration of its own, so without the window
  [`reveal-the-grid`](../reveal-the-grid/) would flash the overlay for a single frame or
  not show it at all. A second command while the window is open extends it rather than
  opening another, so holding an arrow key reveals the grid once and hides it once, and the
  timer is cleared when the component is destroyed along with everything else the grid holds
  past a frame.

Focus stays on the tile across a committed command, and the reason is not the one the
transform supplies. A command that carries a tile past another changes its place in the
row-major order the template iterates, so Angular moves the element among its siblings, as
[`project-tile-content`](../../library-delivery/project-tile-content/) describes. Focus rides
on the same guarantee the projected view rides on: the loop is tracked by `id`, so the
element is moved rather than destroyed and rebuilt, and a moved node keeps focus where a
rebuilt one would lose it. The custom properties account for where the tile appears; the
tracking accounts for its still being the same element when it gets there, and an operator
can press an arrow four times to move four cells.

Surviving is not the same as being visible. Repositioning through a transform moves nothing
the browser considers a focus change, so a tile walked downward with the arrow key keeps
focus while sliding out of the viewport, leaving a keyboard operator driving something they
cannot see. Each committed command therefore scrolls the tile into view by the smallest
amount that works, which also makes the keyboard the usable route for the long moves a
pointer drag cannot reach at all.

An accepted command routes through the same private `commit` method as every other change,
so a keyboard move emits once, exactly like a drag.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement
refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-027` | `L1-010` | With an unlocked tile focused in `edit` mode, each arrow key shall move the tile one cell in that direction, shall refuse a move that leaves the grid or overlaps another tile, and shall retain focus on the tile. |
| `L2-028` | `L1-010` | With an unlocked tile focused in `edit` mode, `Shift` with a horizontal arrow shall change `cols` by one and `Shift` with a vertical arrow shall change `rows` by one, subject to the size limits and overlap rules of a pointer resize. |
| `L2-029` | `L1-010` | The grid shall give every tile a non-empty accessible name and shall announce each committed or refused keyboard move or resize through a polite live region, and shall describe on a tile focused in `edit` mode the keys that move and resize it, and shall announce a run of commands once, when the tile comes to rest, and shall announce a repeated outcome as often as it occurs. |

## Diagrams

The system context and container views are shared across every feature and are held at
the [tree root](../../README.md#where-the-c4-levels-live).

### Components

The key event is mapped to a candidate, clamped where it is a resize, validated by the same
`canPlace` the pointer path uses, and reported through the live region.

![C4 component view for keyboard move and resize](diagrams/c4-component.png)

### Class structure

`gridKeyboardCandidate` produces a candidate cell; `clampTile` and `canPlace` decide
whether it stands. `accessibleNameOf` and `announcementFor` turn the outcome into text.

![Class diagram for keyboard move and resize](diagrams/class-structure.png)

### Behaviour — move a focused tile with an arrow key

One press is one complete command: map, validate, commit, scroll the tile back into
view, emit, announce, and keep focus.

![Sequence diagram for moving a focused tile with an arrow key](diagrams/sequence-keyboard-move.png)

### Behaviour — resize by keyboard, and a refused command

A resize candidate is clamped before it is validated. A blocked or clamped-to-unchanged
command alters nothing, emits nothing, and is announced as blocked.

![Sequence diagram for a keyboard resize and a refused command](diagrams/sequence-keyboard-resize-refused.png)
