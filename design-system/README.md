# @qbc/design-system

The independent CSS token package and static token gallery for qbc-grid. It has its own
package, build, and tests, with no runtime dependency on the grid library or either app.

## Consume the tokens

From a qbc-grid checkout, run `npm pack ./design-system`, then install the generated
`qbc-design-system-0.1.0.tgz` in your application. Import the package once in global CSS:

```css
@import '@qbc/design-system/qbc-tokens.css';
```

[`qbc-tokens.css`](qbc-tokens.css) is authoritative. Consumers reference its variables
instead of copying default values into component styles.

| Group             | Tokens                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors            | `--qbc-color-surface`, `surface-raised`, `border`, `accent`, `accent-soft`, `danger`, `danger-soft`, `grid-line`, `focus` (each with the `--qbc-color-` prefix) |
| Spacing           | `--qbc-space-1` through `--qbc-space-4`                                                                                                                         |
| Shape and targets | `--qbc-radius-sm`, `--qbc-radius-md`, `--qbc-border-width-hairline`, `--qbc-border-width-emphasis`, `--qbc-size-handle`                                         |
| Elevation         | `--qbc-elevation-resting`, `--qbc-elevation-drag`, `--qbc-layer-drag`                                                                                           |
| Motion            | `--qbc-duration-fast`, `--qbc-duration-settle`, `--qbc-easing-standard`                                                                                         |

Typography is supplied by the host application; this catalogue currently defines no
font-family or type-scale tokens.

## Customize

Declare theme overrides after importing the package:

```css
:root {
  --qbc-color-accent: #b4a0ff;
  --qbc-color-accent-soft: #39275e;
  --qbc-color-focus: #dccfff;
}
```

Keep sufficient contrast for focus, borders, and invalid destinations. The catalogue
sets both duration tokens to zero for `prefers-reduced-motion: reduce`. If you override
durations, preserve that preference in your theme.

## Build and test

From the repository root:

```sh
npm ci
npm run test:tokens
npm run build:tokens
```

Open `design-system/dist/index.html` to inspect the gallery. Deploy the contents of
`design-system/dist/` to a static host to publish the gallery independently. No deployment
is performed by the build command.

`npm run tokens` stages token stylesheets for the acceptance application; it does not
publish a package. See the [repository contribution guide](../CONTRIBUTING.md) for changes.

## License

[MIT](LICENSE). Copyright © 2026 Quinntyne Brown and qbc-grid contributors.
