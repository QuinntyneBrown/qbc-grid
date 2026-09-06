# qbc-grid documentation

`qbc-grid` is an Angular component library that arranges dashboard tiles on a
cell-based grid and lets an operator move and resize them with a pointer or the
keyboard. It targets Open MCT style operator dashboards on large desktop screens.
No code exists yet; everything here is specification and design.

## Where things are

| Path | Holds |
|------|-------|
| [`prompt.md`](prompt.md) | the original brief, seven lines, the source of every requirement |
| [`specs/L1.md`](specs/L1.md) | 14 high-level requirements, and the scope boundaries |
| [`specs/L2.md`](specs/L2.md) | 34 detailed requirements, 132 acceptance criteria |
| [`detailed-designs/`](detailed-designs/) | 3 subsystems, 14 feature designs, 51 diagrams |
| [`usability-performance-audit.md`](usability-performance-audit.md) | usability and performance findings, priorities, source evidence, and proposed acceptance scenarios |
| [`tools/`](tools/) | the checks, and the harness that proves the checks work |

Start at [`detailed-designs/README.md`](detailed-designs/README.md). It carries
the shared C4 context and container views, the vocabulary every feature uses, and
the testing seam.

Code has not been written yet. When it is, it goes where
[`angular/components`](https://github.com/angular/components) puts its own — every
package and application a sibling under `src/`:

| Path | Holds |
|------|-------|
| `src/qbc-grid` | the published library, a folder per feature, `public-api.ts` naming the exports |
| `src/dev-app` | a manual harness, not published and not driven by any acceptance test |
| `src/e2e-app` | the application the Playwright specifications drive |
| `e2e/` | the page objects and the specifications themselves |
| `design-system/` | the tokens, their gallery, and its own build |

There is no `api` project and no `domain` project. A service reached through a
token lives in the application that provides it; the library injects nothing.

## Checking the work

```bash
python docs/tools/prove_gapcheck.py   # 35 rules fire, 0 false positives
python docs/tools/gapcheck.py         # 0 gaps
python <skill>/scripts/render_puml.py docs/detailed-designs   # 51/51
```

Run the prover before trusting the checker. [`tools/README.md`](tools/README.md)
explains why, and — more usefully — what these checks cannot see.

## Decisions that shape everything else

Four choices constrain the rest of the design, and each is defended where it is
made rather than here.

**The grid never resolves a collision.** No push, no swap, no float, no
compaction. A tile lands where it fits or it does not land. This is the largest
divergence from `gridstack` and `react-grid-layout`, and it is what makes the
per-frame cost two elements rather than a cascade. It also makes the drop shadow
the only warning an operator gets, which is why that shadow carries a non-colour
channel.

**Locking is a property of a tile, not a third grid mode.** The brief said "lock
mode, edit or live mode"; two grid modes that both forbid interaction would be
indistinguishable, so the lock sits where `gridstack` and `react-grid-layout` put
it.

**A typed input is a promise to the compiler, not a fact about the value.**
`JSON.parse` returns `any` and assigns to `readonly GridTile[]` without complaint,
which is how a stored layout reaches the grid wearing a type nothing checked it
against. Repair accepts `unknown` for that reason.

**The demonstration application is test scaffolding, by declaration.** Its
fixtures, routes, configuration parameters and observation hooks exist so the
acceptance criteria can reach their own preconditions. None of it is a product
capability, and none of it is in the published package.

## Open, and needing a decision

**Edge auto-scroll during a drag.** A drag currently reaches as far as the
viewport showed when it began, so on a dashboard taller than the screen a tile
cannot be dragged below the fold at all; the keyboard is the route for a long
move. Every mainstream alternative implements auto-scroll. The exclusion is
recorded in [`specs/L1.md`](specs/L1.md) with its reasoning, and it is a product
decision rather than a technical one — a scrolling edge region has a speed, an
acceleration and a dead zone, and each is a judgement an operator did not ask to
be made. Worth revisiting before implementation starts.

## What review found, and what it did not

Sixty-four review passes over these documents produced 54 commits. The pattern in
what they found is more useful than the list.

**Consistency checking reached its limit early.** After about five passes the
documents agreed with each other, and every rule in `gapcheck` has reported clean
since. Everything found afterwards was found by reading.

**The largest class was documents agreeing and an operator still being failed.**
Information carried by colour alone on the one signal a refused drop provides. A
keyboard path with no way to discover it. A live region silent on a repeated
refusal, which reads as the second press having worked. Focus lost on every
keyboard-driven removal, guaranteed by the decision to render no chrome. A target
size set below the standard the design cited by name. None of these is an
inconsistency, and no amount of cross-checking would have surfaced any of them.

**The second largest was criteria too weak to bind the decision they existed
for.** A criterion can be specific, concrete and falsifiable and still be
satisfied by a wrong implementation — because its `Given` quietly assumes the
condition under test, or because it watches a fix being applied and never being
released. Pointer capture was bound on the two paths that fail and not on the one
every successful drag takes.

**Later passes mostly found defects introduced by earlier ones.** A correction
that reached the specifications and stopped before the diagrams. A number
corrected in one file and left in the sentence that cited it. A style rule that
rejected correct prose. When reviewing changes here, assume the most recent edit
is the most likely place for the next defect.

A clean run of the checks means the documents agree with each other. Whether the
design is right is a separate question, and it was answered — where it was
answered — by reading the documents against Angular, against the platform, and
against an operator.
