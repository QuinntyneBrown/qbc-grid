# tile-interaction

## Overview

The `tile-interaction` subsystem owns everything the operator does to a tile and
everything the grid shows back. It covers the two grid modes, the per-tile lock, the
pointer move, the pointer resize, the overlay that reveals the cell structure during
an interaction, and the keyboard equivalents of move and resize.

One rule shapes every feature here: the grid never resolves a collision. A tile lands
where it fits or it does not land. That decision removes a push-and-float engine from
the library and makes each interaction predictable — the shadow shown before release
is exactly the result after release.

A second rule shapes the implementation: an interaction is a value, not a mutation in
flight. `GridPointerSession` holds a `GridInteraction` describing the gesture, and the
committed tile list changes once, at release. Reverting is therefore discarding a
value, not undoing a mutation.

## Features

| Feature | Concern | L2 requirements |
|---------|---------|-----------------|
| [`switch-grid-mode`](switch-grid-mode/) | Live is inert, edit offers affordances, leaving edit cancels | `L2-005`–`L2-007` |
| [`lock-a-tile`](lock-a-tile/) | A locked tile is excluded from every interaction path | `L2-008` |
| [`move-a-tile`](move-a-tile/) | Threshold, lift, shadow, refusal, commit, abandonment | `L2-009`–`L2-014` |
| [`resize-a-tile`](resize-a-tile/) | Handle, cell snapping, size limits, refusal | `L2-015`–`L2-018` |
| [`reveal-the-grid`](reveal-the-grid/) | The overlay shown for the duration of an interaction | `L2-019` |
| [`move-and-resize-by-keyboard`](move-and-resize-by-keyboard/) | Arrow and shift-arrow commands, and their announcements | `L2-027`–`L2-029` |

## Shared C4 levels

The system context and container views for every feature in this subsystem are held
in the [tree root](../README.md#where-the-c4-levels-live).
