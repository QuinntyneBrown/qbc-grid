# qbc-grid

## Purpose

The following description was supplied when this file was generated, quoted for reference:
```text
C:\projects\qbc-grid\docs\prompt.md
```

## Speed Is Not the Goal

Quality and completeness beat finishing fast. Finish the whole task - edge cases,
error paths, no stubs or `TODO`s. If it is bigger than it looked, complete it and
say what it cost rather than quietly narrowing scope.

## Technology

- Use Angular. This repository is an Angular library and the applications that
  exercise it; there is no server and no other runtime.
- Prefer signals over RxJS, and hold state in signals. Reach for RxJS only for
  genuine streams and events.

## Architecture and Design

- Implement requirements radically simply: the least code that satisfies the
  acceptance criteria, and nothing more. Simple in design, never reduced in scope.
- Apply SOLID principles throughout the codebase.
- Organize features and behaviors into vertical slices.
- One file per type. Every class, interface, type, and enum gets its own file,
  named for the type it holds.
- Folders and names agree. A folder is named for the feature it holds, and a file
  is named for the single type inside it.
- No single-file components. Template, styles, and class each live in their own file.

## Repository shape

The layout follows [`angular/components`](https://github.com/angular/components):
every package and every application is a sibling directory under `src/`, tests sit
beside the code they cover, and the tooling lives at the root.

- `src/qbc-grid` is the published library, and the only thing that ships. Inside it,
  a folder per feature holds that feature's components, directives, types and pure
  functions, and `public-api.ts` names the exported surface.
- `src/dev-app` is the harness for working on the library by hand. It is not
  published and no acceptance test drives it.
- `src/e2e-app` is the application the acceptance specifications drive. It owns its
  routing, its layout persistence, its fixtures, and the attributes page objects
  hold on to.

There is no `api` project and no `domain` project. A library that reaches a service
through a token and an application that provides one are the two halves of that
arrangement, and both halves live in the project that needs them.

### Where code belongs

Placement follows what a piece of code knows, and it is not negotiable.

- `src/qbc-grid`: components, directives and pure functions that take inputs and
  emit outputs. The library injects no service defined outside itself and imports
  nothing from an application. An Angular primitive is fine; an application's
  contract is not. That leaf position is what lets the library publish to npm.
- `src/dev-app` and `src/e2e-app`: routed pages, persistence, guards and dialogs.
  Anything that knows where data comes from lives in an application.
- Dependencies run one way. An application depends on the library; the library
  depends on no application, and the two applications depend on each other never.
- A library component that turns out to need a service has found an application
  concern, and the concern moves to the application rather than the service moving
  into the library.

### Reaching a service through a token

Every service an application consumes is reached through an interface and an
`InjectionToken`. No component, store, or feature imports a concrete implementation.

- `IDashboardService` declares the contract and `DASHBOARD_SERVICE` is its
  `InjectionToken`; the interface, the token, and each implementation live in
  separate files, inside the application that consumes them.
- Contracts are named `I<Entity>Service`, singular, with no `Api` suffix. Data
  shapes (`GridTile`) take no prefix, and the production implementation takes the
  unprefixed name (`DashboardService`), never an `Impl` suffix.
- Consumers call `inject(DASHBOARD_SERVICE)` only. Composition binds the storage
  adapter for ordinary use and a deterministic mock under Playwright, so a test
  never reaches real storage.
- Storage access and any conversion to a signal stay inside the implementations.
  The library itself injects nothing: it takes a layout in and hands a layout out.

## Design System

The design system is a deliverable in its own right, not a folder inside the
library. It sits at `design-system/`, beside `src/`, with its own `package.json`,
its own tests, and its own build, deploys as its own static site, and carries no
runtime dependency on the library or its applications.

It owns the design tokens - colour, spacing, type scale, radius - as CSS
custom properties under one prefix, and that copy is authoritative. Consumers
depend on the published token file rather than copying its values, and every
component stylesheet reads them as `var(--<prefix>-<role>)`. A hard-coded hex,
dimension, or font stack in a component stylesheet is a defect: add the missing
token to the design system first.

## Testing Approach

Use acceptance test-driven development (ATDD): begin with a failing acceptance
test, link it to explicit criteria written using the Given-When-Then format,
implement until it passes, and keep criteria, tests, and implementation aligned.

Acceptance tests are Playwright, driving `src/e2e-app`, using the Page Object
Model - one page object per screen, owning the selectors and the interactions.
Tests state intent; page objects know the DOM. Never put a selector in a test.

Unit tests for the library's pure functions sit beside the code they cover, as
`angular/components` places its own.

### Never write architecture tests

Never add a test that asserts the shape of the codebase rather than its behavior:
no structure, layout, or naming tests; no banned-API scans; no traceability tests
that parse the specifications. Those constraints belong to the compiler, the
formatter, and review. A test suite exists to prove behavior.

## Folder Structure

```text
qbc-grid/
|-- src/
|   |-- qbc-grid/          the published library
|   |   |-- grid/          one folder per feature
|   |   `-- public-api.ts  the exported surface
|   |-- dev-app/           manual harness, not published
|   `-- e2e-app/           the application the acceptance specs drive
|-- e2e/
|   |-- page-objects/
|   `-- specs/
|-- design-system/
|-- tools/
`-- docs/
    |-- specs/
    |-- detailed-designs/
    `-- tools/
```
