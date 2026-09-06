# Contributing to qbc-grid

Thank you for helping improve qbc-grid. Small, complete changes that preserve its focused
desktop dashboard scope are easiest to review. Follow our [code of conduct](CODE_OF_CONDUCT.md).

## Before starting

- Search [existing issues](https://github.com/QuinntyneBrown/qbc-grid/issues) before filing a new one.
- For a bug, include a minimal reproduction, expected and actual behavior, and environment details.
- Discuss changes to public APIs or product scope in an issue before investing in an implementation.
- Send vulnerability reports through [SECURITY.md](SECURITY.md).

## Set up the workspace

Use Node.js 22.12+ in the 22.x line, npm 11, and Git. Python 3.12 is used for the
documentation checks. From your clone:

```sh
npm ci
npx playwright install chromium
npm run tokens
npm start
```

On Linux, `npx playwright install --with-deps chromium` also installs the browser's
system dependencies. The normal app uses local storage; acceptance tests replace its
service with deterministic fixtures. `npm run start:dev-app` opens the manual harness.

## Repository map

| Path                | Responsibility                                               |
| ------------------- | ------------------------------------------------------------ |
| `src/qbc-grid/`     | Published Angular library; public exports in `public-api.ts` |
| `src/dev-app/`      | Manual library harness                                       |
| `src/e2e-app/`      | Acceptance application, fixtures, routing, and persistence   |
| `e2e/page-objects/` | Screen selectors and interactions                            |
| `e2e/specs/`        | Playwright acceptance specifications                         |
| `design-system/`    | Independent token package and static gallery                 |
| `docs/`             | Requirements, designs, integration documentation, and demo   |
| `tools/`            | Build, verification, and recording utilities                 |

## Making a change

1. Create a branch from `main`.
2. For behavior changes, write or update explicit Given–When–Then criteria in
   `docs/specs/L2.md`, linked to the relevant L1 requirement.
3. Begin with a failing Playwright acceptance test that drives `src/e2e-app` through its
   page object. Add meaningful unit tests beside affected library pure functions.
4. Implement the complete behavior, including cancellation, invalid input, and focus
   handling where relevant. Update the public documentation for API changes.
5. Run the relevant checks below and describe the results in the pull request.

Documentation-only changes do not need artificial behavior tests. Check their links,
examples, and rendered output. Never add tests that enforce source layout, filenames,
banned APIs, or specification traceability.

## Code conventions

[AGENTS.md](AGENTS.md) defines repository conventions. In particular:

- Use Angular and signal-held state; reserve RxJS for real streams and events.
- Keep features in vertical slices and one class, interface, type, or enum per file.
- Keep component classes, templates, and styles in separate files.
- Keep the library independent of both apps. Persistence and application services belong
  in the consuming app and are reached through interfaces and injection tokens.
- Add visual tokens to the design system first; component styles consume CSS custom properties.
- Keep selectors in page objects and assertions about behavior in specifications.

## Checks

```sh
npm run lint
npm test
npm run build
npm run build:tokens
npm run e2e
npm run verify:consumer
npm run docs:prove
npm run docs:check
```

`verify:consumer` installs a packed library into a temporary Angular app and needs network
access. The documentation checks require Python. The [CI workflow](.github/workflows/ci.yml)
is the authoritative list of automated checks. Use `npx prettier --write` on the files you
changed; avoid formatting unrelated files. Diagram maintenance is described in
[docs/tools/README.md](docs/tools/README.md).

## Pull requests

Explain the user-visible problem, resulting behavior, linked criteria or issue, and
validation performed. Include a screenshot or recording for visual changes. Keep
unrelated refactoring separate. A maintainer reviews and merges changes; response times
depend on availability.

By contributing, you agree that your contributions are provided under this project's
[MIT License](LICENSE). Only submit work you have the right to contribute.
