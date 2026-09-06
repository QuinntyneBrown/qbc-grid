"""Mutation-test gapcheck.py.

Every rule in gapcheck is asserted to FIRE on a tree that carries the defect it
exists to catch. A rule that stays silent under its own mutation is worthless -
iteration 7 shipped one such rule and only caught it by testing.

Each case starts from a fresh copy of docs/, applies one defect, and asserts the
expected message appears.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[2]
GAPCHECK = Path(__file__).with_name("gapcheck.py")

D = "docs/detailed-designs"
S = "docs/specs"


def sub(rel, old, new, count=1):
    """A mutation that replaces text in a file."""
    def apply(root: Path):
        p = root / rel
        s = p.read_text(encoding="utf-8")
        assert old in s, f"anchor missing in {rel}: {old[:60]!r}"
        p.write_text(s.replace(old, new, count), encoding="utf-8", newline="\n")
    return apply


def append(rel, text):
    def apply(root: Path):
        p = root / rel
        p.write_text(p.read_text(encoding="utf-8") + text, encoding="utf-8", newline="\n")
    return apply


def delete(rel):
    def apply(root: Path):
        (root / rel).unlink()
    return apply


def create(rel, data=b"not a real png"):
    def apply(root: Path):
        (root / rel).write_bytes(data)
    return apply


LOCK = f"{D}/tile-interaction/lock-a-tile/README.md"
MOVE = f"{D}/tile-interaction/move-a-tile/README.md"
RESIZE = f"{D}/tile-interaction/resize-a-tile/README.md"
RENDER = f"{D}/grid-layout/render-grid/README.md"
GLIDX = f"{D}/grid-layout/README.md"
ROOTMD = f"{D}/README.md"
C4 = f"{D}/tile-interaction/lock-a-tile/diagrams/c4-component.puml"
NORMPUML = f"{D}/grid-layout/normalize-supplied-layout/diagrams/sequence-normalize.puml"

L2008 = ("| `L2-008` | `L1-003` | The grid shall exclude a tile with `locked` of `true` from "
         "every pointer and keyboard interaction while in `edit` mode, and shall present no "
         "interaction affordance on it. |")

CASES = [
    ("L2 with no Traces-to line",
     sub(f"{S}/L2.md", "## L2-001: Column geometry derives from the container\n**Traces to:** L1-001",
         "## L2-001: Column geometry derives from the container"),
     "no Traces-to line"),

    ("L2 tracing to an L1 that does not exist",
     sub(f"{S}/L2.md", "**Traces to:** L1-003", "**Traces to:** L1-099"),
     "which no L1 defines"),

    ("acceptance criteria numbered out of sequence",
     sub(f"{S}/L2.md",
         "2. Given a focused tile at column 0, when the user presses `ArrowLeft`",
         "3. Given a focused tile at column 0, when the user presses `ArrowLeft`"),
     "does not name one criterion"),

    ("L2 with no shall-form Requirement line",
     sub(f"{S}/L2.md", "**Requirement:** The grid shall size its host to the lowest occupied row"
                       " and shall impose no maximum row.", ""),
     "no shall-form Requirement line"),

    ("L1 that no L2 refines",
     append(f"{S}/L1.md", "\n## L1-099: Orphaned capability\nThe grid shall do something.\n"),
     "no L2 refines it"),

    ("feature README missing a required heading",
     sub(LOCK, "## Description", "## What it does"),
     "missing heading ## Description"),

    ("feature README with no L2 rows",
     sub(LOCK, L2008, ""),
     "requirements table has no L2 rows"),

    ("design citing an L2 no spec defines",
     sub(LOCK, "| `L2-008` |", "| `L2-099` |"),
     "cites L2-099"),

    ("design showing the wrong L1 parent",
     sub(LOCK, "| `L2-008` | `L1-003` |", "| `L2-008` | `L1-002` |"),
     "shown refining L1-002"),

    ("design misquoting the requirement text",
     sub(LOCK, "and shall present no interaction affordance on it. |",
         "and shall present no interaction affordance at all. |"),
     "requirement text differs"),

    ("an L1 standing alone in a requirements table",
     sub(LOCK, L2008, L2008 + "\n| `L1-003` | - | Locked tiles. |"),
     "an L1 requirement stands alone"),

    ("image link that does not resolve",
     sub(LOCK, "diagrams/c4-component.png", "diagrams/missing.png"),
     "image link does not resolve"),

    ("L2 realized by no feature design",
     sub(RESIZE, "| `L2-018` | `L1-005` |", "| `L2-118` | `L1-005` |"),
     "no feature design realizes it"),

    ("L2 claimed by two features",
     sub(MOVE, "| `L2-014` | `L1-004` |", L2008 + "\n| `L2-014` | `L1-004` |"),
     "claimed by more than one feature"),

    ("puml with no rendered png",
     delete(f"{D}/tile-interaction/lock-a-tile/diagrams/c4-component.png"),
     "no rendered .png"),

    ("raw shape inside a C4 diagram",
     sub(C4, "@enduml", "rectangle foo\n@enduml"),
     "raw rectangle shape"),

    ("bare arrow inside a C4 diagram",
     sub(C4, "@enduml", "grid --> tile\n@enduml"),
     "bare arrow"),

    ("stale png with no puml source",
     create(f"{D}/tile-interaction/lock-a-tile/diagrams/orphan.png"),
     "stale .png"),

    ("token absent from the design-system catalogue",
     sub(LOCK, "`data-locked`", "`--qbc-color-invented`"),
     "absent from the design-system catalogue"),

    ("class member declared two ways across diagrams",
     sub(f"{D}/tile-interaction/lock-a-tile/diagrams/class-structure.puml",
         "  +x: number", "  +x: string"),
     "drift GridCell.x"),

    ("diagram citing a requirement no spec defines",
     sub(NORMPUML, "L2-025", "L2-925"),
     "cites L2-925"),

    ("broken relative markdown link",
     sub(LOCK, "](../../README.md#where-the-c4-levels-live)",
         "](../../NOPE.md#where-the-c4-levels-live)"),
     "does not resolve"),

    ("subsystem index omitting a feature that exists",
     sub(GLIDX, "| [`render-grid`](render-grid/)", "| [`x-render-grid`](render-grid/)"),
     "exists but is not listed"),

    ("subsystem index listing a feature that does not exist",
     sub(GLIDX, "| [`render-grid`](render-grid/)", "| [`ghost-feature`](ghost-feature/)"),
     "which does not exist"),

    ("subsystem index with the wrong L2 ids",
     sub(GLIDX, "| `L2-001`\u2013`L2-004` |", "| `L2-001`\u2013`L2-003` |"),
     "requirements table says"),

    ("root index with the wrong feature count",
     sub(ROOTMD, "and its repair | 4 |", "and its repair | 5 |"),
     "counted as 5"),

    ("house-style blocker in design prose",
     sub(RENDER, "## Overview", "## Overview\n\nWe leverage a very robust approach.\n"),
     "style"),

    ("requirement owned by a feature but cited in none of its diagrams",
     sub(f"{D}/library-delivery/fill-the-desktop-viewport/diagrams/sequence-container-resize.puml",
         "L2-030", "the width rule", 99),
     "cites it in no diagram"),

    ("same diagram embedded twice in one document",
     sub(LOCK, "![Class diagram for locking a tile](diagrams/class-structure.png)",
         "![Class diagram for locking a tile](diagrams/class-structure.png)"
         " ![Class diagram for locking a tile](diagrams/class-structure.png)"),
     "times"),

    ("acceptance criterion count drifting from the recorded total",
     sub(f"{S}/L2.md", "1. Given a grid with `columns` of 12 and `gap` of 8",
         "1. Given an added criterion, when it is added, then the total moves.{}1. Given a grid with `columns` of 12 and `gap` of 8".format(chr(10))),
     "acceptance criteria, not the"),

    ("acceptance criterion asserting an unfalsifiable outcome",
     sub(f"{S}/L2.md", "then the overlay and the shadow are removed, no error is raised",
         "then the interaction ends cleanly"),
     "no implementation could fail"),

    ("criterion whose column arithmetic does not hold",
     sub(f"{S}/L2.md", "in a container 1528px wide", "in a container 1544px wide"),
     "not the 120 px claimed"),

    ("prose describing the document's own editing history",
     sub(LOCK, "## Overview",
         "## Overview" + chr(10) + chr(10) + "The figure that used to be here is gone."),
     "self-reference to how the document was made"),

    ("hook named in a feature but absent from the testing seam",
     sub(f"{D}/library-delivery/project-tile-content/README.md",
         "data-qbc-widget-instance", "data-qbc-widget-identity"),
     "absent from the testing seam"),

    ("acceptance criterion inspecting an artifact instead of behaviour",
     sub(f"{S}/L2.md",
         "1. Given a host redefines every token in the `qbc` catalogue",
         "1. Given the grid stylesheets, when they are inspected, then no literal"
         " appears." + chr(10) +
         "1. Given a host redefines every token in the `qbc` catalogue"),
     "inspects an artifact rather than observing behaviour"),

    ("statement promising emission that an AC contradicts",
     sub(f"{S}/L2.md",
         "emit the complete layout exactly once when the adopted geometry differs from the"
         " geometry the tile held.", "emit the complete layout exactly once."),
     "promises emission with no carve-out"),
]


LEGITIMATE_PROSE = [
    "the override sheet was generated from the installed token package",
    "the demonstration page was generated by the build rather than written by hand",
    "the class used to carry the elevation is applied once at gesture start",
    "the property used to read the container width is measured once",
    "the note used to say why a fallback is safe",
    "the token used to sit at the corner",
    "the geometry as it stood before the drag is restored",
    "each token is read with a fallback to the design system default",
    "a locked tile is excluded from every interaction path",
    "repair walks the records in order and moves a later one down",
    "the grid imposes no padding of its own on projected content",
    "the frame scheduler holds one pending write and one frame handle",
]


def check_no_false_positives():
    """Assert no style blocker rejects prose the house style permits."""
    import re
    source = GAPCHECK.read_text(encoding="utf-8")
    block = re.search(r"STYLE_BLOCKERS = \[(.*?)\n\]", source, re.S).group(0)
    ns = {}
    exec(block, ns)
    out = []
    for phrase in LEGITIMATE_PROSE:
        for pattern, label in ns["STYLE_BLOCKERS"]:
            hit = re.search(pattern, phrase, re.I)
            if hit:
                out.append(label + " rejects " + repr(hit.group(0)) + " in: " + phrase)
    return out



def run(root: Path) -> str:
    out = subprocess.run([sys.executable, str(GAPCHECK), str(root)],
                         capture_output=True, text=True)
    return out.stdout + out.stderr


def main() -> int:
    base = Path(tempfile.mkdtemp(prefix="gapcheck-proof-"))
    clean = base / "clean"
    shutil.copytree(SOURCE / "docs", clean / "docs")

    baseline = run(clean)
    if "no gaps" not in baseline:
        print("BASELINE IS NOT CLEAN - cannot prove anything\n" + baseline)
        return 1
    print("baseline copy: clean\n")

    failures = []
    for i, (name, mutate, expected) in enumerate(CASES):
        work = base / f"case{i:02d}"
        shutil.copytree(clean, work)
        try:
            mutate(work)
        except AssertionError as exc:
            failures.append((name, f"mutation could not be applied: {exc}"))
            print(f"  ANCHOR  {name}")
            continue
        output = run(work)
        if expected in output:
            print(f"  fires   {name}")
        else:
            failures.append((name, "rule stayed silent"))
            print(f"  SILENT  {name}  (expected {expected!r})")

    fp = check_no_false_positives()
    for item in fp:
        print("  FALSE POSITIVE  " + item)
    if not fp:
        print("  no style rule rejects legitimate prose"
              " (" + str(len(LEGITIMATE_PROSE)) + " samples)")
    print(f"\n{len(CASES) - len(failures)}/{len(CASES)} rules proven,"
          f" {len(fp)} false positive(s)")
    failures.extend((item, "rejects legitimate prose") for item in fp)
    for name, why in failures:
        print(f"  - {name}: {why}")
    shutil.rmtree(base, ignore_errors=True)
    return len(failures)


if __name__ == "__main__":
    sys.exit(main())
