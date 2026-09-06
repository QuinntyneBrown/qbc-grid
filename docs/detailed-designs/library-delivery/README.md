# library-delivery

## Overview

The `library-delivery` subsystem covers the properties that make the grid usable as a
published dependency rather than as application code: how it fills a desktop
container, how it stays inside a frame budget while a tile is dragged, how host
content reaches a tile without ever passing through markup interpolation, and how the
package and its tokens are shaped so a consumer can install and restyle it.

These features are behavioural, not decorative. Each one carries acceptance criteria
that a Playwright specification can assert against the demonstration dashboard.

## Features

| Feature | Concern | L2 requirements |
|---------|---------|-----------------|
| [`fill-the-desktop-viewport`](fill-the-desktop-viewport/) | Constant column count from 1024 px to 2560 px | `L2-030` |
| [`hold-the-frame-budget`](hold-the-frame-budget/) | One composited style write per frame, measured once per gesture | `L2-031` |
| [`project-tile-content`](project-tile-content/) | Template projection, preserved across a move | `L2-032` |
| [`theme-the-grid`](theme-the-grid/) | Package shape, peer dependencies, and token-only styling | `L2-033`, `L2-034` |

## Shared C4 levels

The system context and container views for every feature in this subsystem are held
in the [tree root](../README.md#where-the-c4-levels-live).
