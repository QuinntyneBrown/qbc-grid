# Specification and design checks

Two scripts guard `docs/specs/` and `docs/detailed-designs/`. Both take no
arguments and need only Python 3.

```bash
python docs/tools/gapcheck.py         # 35 rules over the specs and the designs
python docs/tools/prove_gapcheck.py   # asserts every rule still works
```

`gapcheck.py` exits non-zero with one line per gap. `prove_gapcheck.py` copies
`docs/` to a temporary tree, injects into each copy the single defect one rule
exists to catch, and asserts that rule fires — then checks that no style rule
rejects prose the house style permits.

Run the prover first. A rule that cannot fire reports success forever: one
regular expression in this checker was written with a mangled escape and
matched nothing for four rounds of review, and every run in that period said
"no gaps" while a whole class of defect went unexamined.

## What the rules cover

**Traceability.** Every L2 requirement traces to an L1 that exists, carries a
`shall`-form statement, and has at least one Given/When/Then criterion. Every L1
is refined by some L2. Every L2 is realized by exactly one feature design, and
every design quotes its requirements verbatim.

**Structure.** Each feature README carries the four required headings and a
requirements table of L2 rows only. Every subsystem index lists the features on
disk with their real requirement identifiers, and the root index counts them
correctly.

**Diagrams.** Every `.puml` has a rendered `.png` and no `.png` is orphaned. C4
diagrams use C4 macros rather than raw shapes or bare arrows. Every requirement
identifier cited inside a diagram exists, and every requirement a feature owns is
cited in at least one of that feature's diagrams.

**Names.** Every `--qbc-*` token used anywhere appears in the design-system
catalogue. Every `data-qbc-*` hook appears in the testing seam. A class member
declared in two diagrams is declared identically in both.

**Specification quality.** A requirement promising emission unconditionally while
a criterion says nothing is emitted. A criterion inspecting a manifest, a source
file or a stylesheet, which the repository forbids in favour of behaviour. A
criterion whose outcome cannot be falsified. Column arithmetic that does not
follow from the columns, gap and container width the criterion states.

**Prose.** The house style's blocking rules, and a tripwire on the number of
acceptance criteria — see below.

## When the criteria tripwire fires

Several sentences in the designs state counts of the specification: how many
criteria turn on emission, fix a starting arrangement, act through a host
control. None can be recomputed from its own prose. `gapcheck` records the total
and fails when it moves, which is the signal to reread those sentences and then
update `EXPECTED_CRITERIA`.

## What these checks cannot do

The list matters more than the rules do, because everything here was found by
reading rather than by running anything.

**They compare documents for consistent reference, never for agreement of
meaning.** A diagram may cite a real requirement and no longer describe what it
says. Six behaviours were found stale that way, each a correction that reached
the prose and stopped.

**They cannot tell whether a criterion is strong enough.** A criterion may be
specific, concrete, falsifiable, and still be satisfied by a wrong
implementation — because its Given quietly assumes the condition under test, or
because it watches a fix being applied and never being released. Several were
found in that state, including one guarding pointer-capture release on the only
path that normally takes it.

**They know nothing about the platform.** Nothing here checks that the design
describes buildable Angular. A signal was documented as `computed` while five
paths wrote to it, which no amount of document comparison would reveal.

**They know nothing about an operator.** The largest remaining class. Eight
accessibility defects were found in documents that agreed with each other
perfectly: information carried by colour alone, a keyboard path with no way to
discover it, a live region silent on a repeated refusal, focus lost on every
removal. Consistency checking walks past all of it.

A clean run means the documents agree with each other. It does not mean the
design is right.
