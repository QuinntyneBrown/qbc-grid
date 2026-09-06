# qbc-grid

A focused Angular grid for desktop dashboards. Arrange projected Angular widgets in
whole cells, with pointer and keyboard movement, resizing, tile locks, live/edit modes,
deterministic layout repair, and host-owned layout persistence.

- [Getting started and usage](https://github.com/QuinntyneBrown/qbc-grid#readme)
- [API guide](https://github.com/QuinntyneBrown/qbc-grid/blob/main/docs/api.md)
- [Five-minute demo](https://github.com/QuinntyneBrown/qbc-grid/blob/main/docs/demo.md)
- [Contributing](https://github.com/QuinntyneBrown/qbc-grid/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/QuinntyneBrown/qbc-grid/blob/main/SECURITY.md)

The library declares Angular 21 peer dependencies. Import `GridComponent` and
`GridTileTemplateDirective` from `qbc-grid`, supply `[layout]`, and handle `(layoutChange)`.
Install the separate `@qbc/design-system` token package and import
`@qbc/design-system/qbc-tokens.css` in global CSS.

The acceptance suite covers desktop Chromium. Mobile, touch, pen, automatic collision
resolution, and breakpoint-based column collapsing are outside the product scope.

Licensed under the MIT License; see `LICENSE` in this package.
