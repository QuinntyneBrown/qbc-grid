"""Compare docs/specs against docs/detailed-designs and report every gap.

Exit code is the number of gaps found, so a loop iteration can tell whether
anything changed without reading prose.
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path

ROOT = (Path(sys.argv[1]) if len(sys.argv) > 1
        else Path(__file__).resolve().parents[2])
SPECS = ROOT / "docs" / "specs"
DESIGNS = ROOT / "docs" / "detailed-designs"

STYLE_BLOCKERS = [
    (r"(?<![\w-])(we|our|us|I)(?![\w-])", "first person"),
    (r"(?<![\w-])(you|your)(?![\w-])", "second person"),
    (r"(?<![\w-])must(?![\w-])", "obligation outside shall/should/may"),
    (r"(?<![\w-])(very|really|quite|simply|obviously|basically|essentially)(?![\w-])", "intensifier or filler"),
    (r"(?<![\w-])(robust|seamless|powerful|cutting-edge|world-class|best-in-class|state-of-the-art)(?![\w-])", "hype adjective"),
    (r"(?<![\w-])(leverage|utilize|synergize)(?![\w-])", "hype verb"),
    (r"(?<![\w-])(shall ideally|should always|must absolutely|shall try to)(?![\w-])", "diluted obligation"),
    (r"in order to", "empty opener"),
    (r"in this (sentence|paragraph)|in an earlier (draft|version)|used to be"
     r"|(document|design|readme) (was|is) (generated|auto-produced|written)"
     r"|will now describe|previously (said|stated|read)"
     r"|no longer says", "self-reference to how the document was made"),
]

gaps: list[str] = []


def read(p: Path) -> str:
    with io.open(p, encoding="utf-8") as h:
        return h.read()


def strip_code(text: str) -> str:
    """Drop fenced blocks and inline code so identifiers are not style-checked."""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    return re.sub(r"`[^`]*`", " ", text)


# ---------------------------------------------------------------- specs
l1_text = read(SPECS / "L1.md")
l2_text = read(SPECS / "L2.md")

l1_ids = re.findall(r"^## (L1-\d{3}):", l1_text, re.M)

l2_blocks = re.split(r"^## (?=L2-\d{3}:)", l2_text, flags=re.M)[1:]
l2: dict[str, dict[str, str]] = {}
for block in l2_blocks:
    ident = re.match(r"(L2-\d{3}):", block).group(1)
    traces = re.search(r"^\*\*Traces to:\*\*\s*(L1-\d{3})", block, re.M)
    statement = re.search(r"^\*\*Requirement:\*\*\s*(.+)$", block, re.M)
    criteria = re.findall(r"^\d+\. Given ", block, re.M)
    l2[ident] = {
        "traces": traces.group(1) if traces else "",
        "statement": statement.group(1).strip() if statement else "",
        "criteria": str(len(criteria)),
    }

for ident, rec in sorted(l2.items()):
    if not rec["traces"]:
        gaps.append(f"spec {ident}: no Traces-to line")
    elif rec["traces"] not in l1_ids:
        gaps.append(f"spec {ident}: traces to {rec['traces']}, which no L1 defines")
    if not rec["statement"]:
        gaps.append(f"spec {ident}: no shall-form Requirement line")
    if int(rec["criteria"]) == 0:
        gaps.append(f"spec {ident}: no Given/When/Then acceptance criteria")

# An unconditional promise to emit, contradicted by an acceptance criterion that says
# nothing is emitted, means the spec disagrees with itself. The carve-out has to qualify
# the emit clause itself, so only the tail of the statement from "emit" onward is tested;
# a conditional earlier in the sentence qualifies something else.
CARVE_OUT = ("when", "unless", " if ", "no-op", "reject", "refuse", "only", "nothing")
for ident, rec in sorted(l2.items()):
    statement = rec["statement"].lower()
    if "emit" not in statement:
        continue
    tail = statement[statement.index("emit"):]
    if any(word in tail for word in CARVE_OUT):
        continue
    block = next(b for b in l2_blocks if b.startswith(ident + ":"))
    silent = [line for line in block.splitlines()
              if re.match(r"^\d+\. Given ", line)
              and re.search(r"(no layout is emitted|nothing is emitted|emits nothing)", line, re.I)]
    if silent:
        gaps.append(
            f"spec {ident}: the statement promises emission with no carve-out, but "
            f"{len(silent)} acceptance criterion/criteria say nothing is emitted")

# The repository forbids tests that assert the shape of the codebase. An acceptance
# criterion that inspects a manifest, a source file, or a stylesheet asks for exactly
# that, however it is worded.
ARTIFACT_INSPECTION = re.compile(
    r"the (built )?librar(y|ies) (source|package)|its dependencies are inspected"
    r"|the grid stylesheets|package\.json|when the (source|manifest|bundle) is",
    re.I)
for ident, rec in sorted(l2.items()):
    block = next(b for b in l2_blocks if b.startswith(ident + ":"))
    for line in block.splitlines():
        if re.match(r"^\d+\. Given ", line) and ARTIFACT_INSPECTION.search(line):
            gaps.append(
                f"spec {ident}: an acceptance criterion inspects an artifact rather than "
                f"observing behaviour, which the repository forbids")

covered_l1 = {rec["traces"] for rec in l2.values()}
for ident in l1_ids:
    if ident not in covered_l1:
        gaps.append(f"spec {ident}: no L2 refines it")

# ------------------------------------------------------------- designs
feature_readmes = sorted(
    p for p in DESIGNS.rglob("README.md")
    if p.parent.parent != DESIGNS.parent and (p.parent / "diagrams").is_dir()
)

design_rows: dict[str, list[Path]] = {}
for readme in feature_readmes:
    text = read(readme)
    rel = readme.relative_to(ROOT).as_posix()

    for heading in ("## Overview", "## Description", "## Requirements", "## Diagrams"):
        if heading not in text:
            gaps.append(f"design {rel}: missing heading {heading}")

    rows = re.findall(r"^\|\s*`(L2-\d{3})`\s*\|\s*`(L1-\d{3})`\s*\|\s*(.+?)\s*\|$", text, re.M)
    if not rows:
        gaps.append(f"design {rel}: requirements table has no L2 rows")
    for ident, parent, quoted in rows:
        design_rows.setdefault(ident, []).append(readme)
        if ident not in l2:
            gaps.append(f"design {rel}: cites {ident}, which no spec defines")
            continue
        if parent != l2[ident]["traces"]:
            gaps.append(
                f"design {rel}: {ident} shown refining {parent}, spec says {l2[ident]['traces']}")
        if quoted != l2[ident]["statement"]:
            gaps.append(f"design {rel}: {ident} requirement text differs from the spec")

    if re.search(r"^\|\s*`?L1-\d{3}`?\s*\|", text, re.M):
        gaps.append(f"design {rel}: an L1 requirement stands alone in the table")

    for link in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", text):
        target = (readme.parent / link).resolve()
        if not target.is_file():
            gaps.append(f"design {rel}: image link does not resolve: {link}")

for ident in sorted(l2):
    homes = design_rows.get(ident, [])
    if not homes:
        gaps.append(f"gap {ident}: no feature design realizes it")
    elif len(homes) > 1:
        names = ", ".join(h.parent.name for h in homes)
        gaps.append(f"gap {ident}: claimed by more than one feature ({names})")

# ------------------------------------------------------------- diagrams
for puml in sorted(DESIGNS.rglob("*.puml")):
    rel = puml.relative_to(ROOT).as_posix()
    png = puml.with_suffix(".png")
    if not png.is_file():
        gaps.append(f"diagram {rel}: no rendered .png")
    body = read(puml)
    if "<C4/" in body:
        for raw in re.findall(r"^\s*(rectangle|component|node)\s", body, re.M):
            gaps.append(f"diagram {rel}: raw {raw} shape inside a C4 diagram")
        for line in body.splitlines():
            if re.match(r"^\s*\w+\s*-+(\|)?>+\s*\w+", line) and "Rel" not in line:
                gaps.append(f"diagram {rel}: bare arrow inside a C4 diagram: {line.strip()}")

for png in sorted(DESIGNS.rglob("*.png")):
    if not png.with_suffix(".puml").is_file():
        gaps.append(f"diagram {png.relative_to(ROOT).as_posix()}: stale .png with no .puml source")

# ------------------------------------------------------- index integrity
def expand_ids(cell: str) -> set[str]:
    """Expand a table cell like `L2-001`-`L2-004`, `L2-020` into explicit ids."""
    out: set[str] = set()
    for lo, hi in re.findall(r"`(L2-\d{3})`\s*[-–—]\s*`(L2-\d{3})`", cell):
        for n in range(int(lo[3:]), int(hi[3:]) + 1):
            out.add(f"L2-{n:03d}")
    ranged = re.sub(r"`L2-\d{3}`\s*[-–—]\s*`L2-\d{3}`", " ", cell)
    out.update(re.findall(r"`(L2-\d{3})`", ranged))
    return out


# Every relative markdown link in the tree must resolve.
for md in sorted(DESIGNS.rglob("*.md")):
    rel = md.relative_to(ROOT).as_posix()
    for target in re.findall(r"(?<!!)\[[^\]]*\]\(([^)]+)\)", read(md)):
        if target.startswith(("http://", "https://", "#", "mailto:")):
            continue
        path = (md.parent / target.split("#", 1)[0].rstrip("/")).resolve()
        if not path.exists():
            gaps.append(f"link {rel}: does not resolve: {target}")

# A subsystem index must name the features it actually holds, with their real L2 ids.
subsystems = sorted(d for d in DESIGNS.iterdir()
                    if d.is_dir() and (d / "README.md").is_file())
owned: dict[str, set[str]] = {}
for readme in feature_readmes:
    owned[readme.parent.name] = set(
        re.findall(r"^\|\s*`(L2-\d{3})`\s*\|", read(readme), re.M))

for sub in subsystems:
    rel = (sub / "README.md").relative_to(ROOT).as_posix()
    text = read(sub / "README.md")
    listed: dict[str, set[str]] = {}
    for name, cell in re.findall(r"^\|\s*\[`([^`]+)`\]\([^)]*\)\s*\|[^|]*\|([^|]*)\|",
                                 text, re.M):
        listed[name] = expand_ids(cell)
    actual = {d.name for d in sub.iterdir() if d.is_dir() and (d / "README.md").is_file()}
    for missing in sorted(actual - set(listed)):
        gaps.append(f"index {rel}: feature {missing} exists but is not listed")
    for extra in sorted(set(listed) - actual):
        gaps.append(f"index {rel}: lists feature {extra}, which does not exist")
    for name, ids in sorted(listed.items()):
        if name in owned and ids != owned[name]:
            gaps.append(
                f"index {rel}: {name} listed as {sorted(ids)}, "
                f"requirements table says {sorted(owned[name])}")

# The root index must count the features each subsystem actually holds.
root_text = read(DESIGNS / "README.md")
for name, count in re.findall(r"^\|\s*\[`([^`]+)`\]\([^)]*\)\s*\|[^|]*\|\s*(\d+)\s*\|",
                              root_text, re.M):
    target = DESIGNS / name
    real = len([d for d in target.iterdir()
                if d.is_dir() and (d / "README.md").is_file()]) if target.is_dir() else 0
    if int(count) != real:
        gaps.append(f"index root README: {name} counted as {count}, holds {real}")

# -------------------------------------------------- cross-feature drift
# Runtime custom properties the component writes; these are computed values,
# not design tokens, so they are not expected in the catalogue.
RUNTIME_PROPS = ("--qbc-grid-", "--qbc-tile-", "--qbc-drag-offset-")

catalogue: set[str] = set()
cat_src = DESIGNS / "library-delivery/theme-the-grid/diagrams/class-structure.puml"
if cat_src.is_file():
    catalogue = set(re.findall(r"\+(--qbc-[a-z0-9-]+)", read(cat_src)))
if not catalogue:
    gaps.append("catalogue: no design tokens found in the theme-the-grid class diagram")

used: dict[str, set[str]] = {}
for f in sorted(list(DESIGNS.rglob("README.md")) + list(DESIGNS.rglob("*.puml"))):
    if f == cat_src:
        continue
    for token in set(re.findall(r"--qbc-[a-z0-9-]+", read(f))):
        used.setdefault(token, set()).add(f.relative_to(ROOT).as_posix())

for token, where in sorted(used.items()):
    if token.startswith(RUNTIME_PROPS):
        continue
    if token not in catalogue:
        gaps.append(
            f"token {token}: used in {sorted(where)[0]} but absent from the design-system catalogue")

# A member declared for the same class in two diagrams must be declared identically.
members: dict[tuple[str, str], dict[str, set[str]]] = {}
for puml in sorted(DESIGNS.rglob("*.puml")):
    rel = puml.relative_to(ROOT).as_posix()
    for cls, body in re.findall(r"^(?:class|interface|enum)\s+(\w+)[^{]*\{(.*?)^\}",
                                read(puml), re.M | re.S):
        for line in body.splitlines():
            line = line.strip()
            if not line.startswith(("+", "-")):
                continue
            name = re.match(r"[+-]\s*([\w-]+)", line)
            if not name:
                continue
            members.setdefault((cls, name.group(1)), {}).setdefault(line, set()).add(rel)

for (cls, name), forms in sorted(members.items()):
    if len(forms) > 1:
        shown = " | ".join(sorted(forms))
        gaps.append(f"drift {cls}.{name}: declared {len(forms)} ways -> {shown[:200]}")

# Every requirement id cited inside a diagram must exist in the specs.
for puml in sorted(DESIGNS.rglob("*.puml")):
    rel = puml.relative_to(ROOT).as_posix()
    for ident in sorted(set(re.findall(r"\bL[12]-\d{3}\b", read(puml)))):
        if ident.startswith("L2-") and ident not in l2:
            gaps.append(f"diagram {rel}: cites {ident}, which no spec defines")
        if ident.startswith("L1-") and ident not in l1_ids:
            gaps.append(f"diagram {rel}: cites {ident}, which no spec defines")

# Every observation or control hook named in the tree must be listed in the root
# testing seam. A hook described only in the feature that uses it is a hook a page
# object author never finds.
HOOK = re.compile("data-qbc-[a-z-]+")
seam_hooks = set(HOOK.findall(read(DESIGNS / "README.md")))
for md in sorted(DESIGNS.rglob("*.md")):
    if md == DESIGNS / "README.md":
        continue
    for hook in sorted(set(HOOK.findall(read(md)))):
        if hook not in seam_hooks:
            gaps.append(
                f"hook {hook}: named in {md.relative_to(ROOT).as_posix()} "
                f"but absent from the testing seam")

# A requirement a feature owns should be traceable into at least one of that
# feature's own diagrams, or the pictures document a slice the requirements do not.
for readme in feature_readmes:
    owned = set(re.findall(r"^\|\s*`(L2-\d{3})`\s*\|", read(readme), re.M))
    cited = set()
    for puml in sorted((readme.parent / "diagrams").glob("*.puml")):
        cited |= set(re.findall(r"L2-\d{3}", read(puml)))
    for ident in sorted(owned - cited):
        gaps.append(
            f"coverage {readme.parent.name}: owns {ident} but cites it in no diagram")

# The same diagram embedded twice in one document is an editing slip, and it reads
# as two figures that happen to be identical.
for md in sorted(DESIGNS.rglob("*.md")):
    embedded = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", read(md))
    for target in sorted(set(embedded)):
        if embedded.count(target) > 1:
            gaps.append(
                f"figure {md.relative_to(ROOT).as_posix()}: embeds {target} "
                f"{embedded.count(target)} times")

# Eight sentences in the design state counts of the specification -- how many criteria
# turn on emission, fix a starting arrangement, act through a control. None can be
# recomputed from its prose, so this is a tripwire rather than a proof: when the number
# of acceptance criteria changes, those sentences need rereading, and the run says so.
EXPECTED_CRITERIA = 155
actual_criteria = len(re.findall(r"^\d+\. Given ", l2_text, re.M))
if actual_criteria != EXPECTED_CRITERIA:
    gaps.append(
        f"counts: the specification holds {actual_criteria} acceptance criteria, not the "
        f"{EXPECTED_CRITERIA} recorded here. Reread the count claims in the design, then "
        f"update EXPECTED_CRITERIA")

# A criterion whose "then" cannot be falsified is not a test. These phrases were
# found in one criterion that had survived forty-five passes, and they read as
# assertions while forbidding nothing.
VAGUE_THEN = re.compile(
    "ends cleanly|works correctly|behaves as expected|behaves correctly"
    "|as expected|properly|appropriately|as intended|without issue", re.I)
for ident in sorted(l2):
    block = next(b for b in l2_blocks if b.startswith(ident + ":"))
    for line in block.splitlines():
        if re.match(r"^\d+\. Given ", line) and VAGUE_THEN.search(line):
            gaps.append(
                f"spec {ident}: an acceptance criterion asserts an outcome no "
                f"implementation could fail -> {VAGUE_THEN.search(line).group(0)!r}")

# A criterion that states columns, gap, container width and the column width that
# follows is asserting arithmetic, and arithmetic can be checked. The first criterion
# in the specification carried a wrong number through forty-seven review passes.
COLUMN_MATH = re.compile(
    r"`columns` of (\d+) and `gap` of (\d+) in a container (\d+)px wide"
    r".*?each column is (\d+)px wide", re.S)
for ident in sorted(l2):
    block = next(b for b in l2_blocks if b.startswith(ident + ":"))
    for cols, gap, width, claimed in COLUMN_MATH.findall(block):
        cols, gap, width, claimed = int(cols), int(gap), int(width), int(claimed)
        actual = (width - gap * (cols - 1)) / cols
        if abs(actual - claimed) > 0.001:
            gaps.append(
                f"spec {ident}: {cols} columns and a {gap} px gap in a {width} px container "
                f"give {actual:.4f} px, not the {claimed} px claimed")

# ---------------------------------------------------------------- style
for readme in sorted(DESIGNS.rglob("README.md")):
    rel = readme.relative_to(ROOT).as_posix()
    prose = strip_code(read(readme))
    for pattern, label in STYLE_BLOCKERS:
        for hit in set(m.group(0) for m in re.finditer(pattern, prose, re.I)):
            gaps.append(f"style {rel}: {label} -> {hit!r}")
    if "?" in prose:
        for line in prose.splitlines():
            if line.strip().endswith("?"):
                gaps.append(f"style {rel}: rhetorical question -> {line.strip()[:60]}")

# --------------------------------------------------------------- report
print(f"specs: {len(l1_ids)} L1, {len(l2)} L2")
print(f"designs: {len(feature_readmes)} features, "
      f"{len(list(DESIGNS.rglob('*.puml')))} diagrams")
if gaps:
    print(f"\n{len(gaps)} gap(s):")
    for g in gaps:
        print(f"  - {g}")
else:
    print("\nno gaps")
sys.exit(min(len(gaps), 250))
