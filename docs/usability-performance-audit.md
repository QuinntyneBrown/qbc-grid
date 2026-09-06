# Usability and performance audit

## Scope and assessment

Audit date: 2026-09-06. Baseline: `4f0a806` (`4f0a806b70196ddb4c97d4e33e7636a105b32872`).
Sources are the [documentation handover](README.md), [product prompt](prompt.md),
[L1 requirements](specs/L1.md), [L2 requirements](specs/L2.md), and the
[detailed designs](detailed-designs/README.md).

The review covers all 14 L1 requirements, all 34 L2 requirements and their acceptance
criteria, all 14 feature designs, the subsystem indexes, and all 51 PlantUML sources.
The rendered resize component and frame-budget sequence diagrams were also inspected
to confirm two discrepancies reach the images readers see. Other PNGs were not
individually inspected. Source locations below refer to this baseline.

The design has a useful foundation: shared placement rules, separate preview and
committed geometry, no collision displacement, stable tile identities, deferred
storage writes, keyboard commands, non-colour invalid feedback, and explicit teardown.
The main risks arise where these decisions interact. A keyboard command cannot reach
every legal pointer destination; gesture caches can become stale outside width changes;
and repeat announcements lack a complete update protocol. Performance guarantees also
exceed the evidence and measurement design supplied.

This is a design audit, not a runtime defect report. No Angular workspace, application
implementation, browser acceptance suite, or performance trace exists at the baseline.
The findings identify contradictions and missing decisions in the proposed behaviour.
Browser-dependent outcomes require implementation and acceptance evidence.

The baseline already refreshes gesture measurements on container-width changes,
makes the grid host programmatically focusable, and separates keyboard settling from
motion tokens. Those improvements are credited below. They are not reported as missing.

The recommendations retain the small product scope. Collision pushing, touch and pen
support, edge auto-scroll, breakpoint reflow, nested grids, tile chrome, an undo stack,
and library-owned persistence remain explicit exclusions in L1. No finding treats
those exclusions as missing features. Storage findings apply only to the demonstration
application already included in the design.

## Reading the findings

**P1** means resolve before implementing the affected behaviour. **P2** means resolve
before its acceptance review or package release. Priority reflects operator impact and
implementation risk; it does not assert a measured production failure.

**Conflict** means documented statements cannot all hold as written. **Gap** means a
required or foreseeable path lacks a concrete mechanism. **Proposal** means an
improvement needs an explicit requirements decision. Recommendations and candidate
acceptance scenarios below are proposed follow-up work, not amendments to the specs.

| Finding | Priority | Kind | Main concern |
|---------|----------|------|--------------|
| [A01](#a01-keyboard-moves-cannot-reach-every-pointer-destination) | P1 | Conflict / proposal | Keyboard routes blocked by occupied rows |
| [A02](#a02-projected-content-and-grid-gestures-compete-for-the-same-input) | P1 | Gap / conflict | Widget controls and text selection trigger rearrangement |
| [A03](#a03-the-press-before-dragging-has-no-complete-lifecycle) | P1 | Gap | Lost events before capture and incomplete terminal events |
| [A04](#a04-active-gestures-only-refresh-the-cache-for-width-changes) | P1 | Gap / conflict | Other stale geometry, new locks, and concurrent edits |
| [A05](#a05-stable-angular-identity-does-not-guarantee-browser-state) | P1 | Gap | Focus and native content state after DOM reordering |
| [A06](#a06-accessible-semantics-and-focus-fallbacks-are-incomplete) | P1 | Gap | Tile roles, blank names, and focus on removal or mode change |
| [A07](#a07-announcement-runs-and-repeated-results-need-a-complete-protocol) | P1 | Gap | Run boundaries, repeat announcements, and final outcomes |
| [A08](#a08-normalization-does-not-define-the-whole-input-contract) | P1 | Gap / proposal | Malformed envelopes and contradictory size limits |
| [A09](#a09-a-row-bounded-search-is-not-a-work-bounded-search) | P1 | Conflict / proposal | Hostile coordinates can monopolize the main thread |
| [A10](#a10-valid-configuration-can-produce-invalid-pixel-geometry) | P1 | Conflict / gap | Negative widths, undefined defaults, and config changes |
| [A11](#a11-state-adoption-repair-and-output-copying-disagree) | P1 | Conflict / gap | Lost repairs, metadata changes, and mutable snapshots |
| [A12](#a12-batching-dom-writes-does-not-batch-all-gesture-work) | P1 | Gap | Per-event collision scans and Angular scheduling |
| [A13](#a13-frame-flushing-and-release-have-conflicting-contracts) | P1 | Conflict | Stale release geometry and more than one write per frame |
| [A14](#a14-the-performance-acceptance-measurement-is-not-reproducible) | P1 | Gap / proposal | Ambiguous frame metric and incomplete workload coverage |
| [A15](#a15-the-overlay-disappears-for-valid-layout-configurations) | P2 | Conflict / gap | Zero gaps, preview height, and fade lifecycle |
| [A16](#a16-pixel-boxes-and-resize-grab-offsets-need-one-definition) | P2 | Gap | Padding, borders, handle targeting, and resize jumps |
| [A17](#a17-token-fallbacks-do-not-fully-define-accessible-rendering) | P2 | Gap | Reduced motion without tokens and missing token values |
| [A18](#a18-the-installed-consumer-path-is-not-designed-end-to-end) | P2 | Gap | Public add contract and framework compatibility |
| [A19](#a19-demonstration-storage-has-no-recovery-or-final-save-path) | P2 | Gap | Blank dashboard or lost final edits on storage failure |
| [A20](#a20-diagrams-contradict-current-operator-behaviour) | P2 | Conflict | Stale handle size, speech, release, and public API diagrams |

## Findings

### A01 Keyboard moves cannot reach every pointer destination

**Evidence.** [L1-010](specs/L1.md#l1-010-keyboard-operation) promises every pointer
move and resize from the keyboard. L2-027 and the
[keyboard design](detailed-designs/tile-interaction/move-and-resize-by-keyboard/README.md#description)
allow only one-cell moves, rejecting every intermediate collision. Pointer dragging
in L2-012 can cross occupied cells and commit on free cells beyond them.

**Impact.** In a 12-column grid, place a 1-by-1 tile at `(0, 0)` and a locked
12-by-1 tile at `(0, 1)`. `(0, 2)` is a legal pointer destination. Every keyboard
route downward crosses the locked row; moving horizontally cannot get around it.
Shrinking cannot help a tile already at its minimum. The advertised keyboard
alternative for destinations below the fold is therefore incomplete.

**Recommendation.** L1 and L2 should agree on destination reachability. A proposed
additional keyboard command could jump to the next fitting position beyond an
obstruction, while ordinary arrows retain their current one-cell behaviour. A
coordinate-target operation is another possible requirements choice. Weakening L1-010
to neighbouring moves would reduce the current scope and should not happen implicitly.

**Candidate acceptance.** Given the full-width locked row above, when the operator
uses the documented keyboard destination command, then the tile reaches `(0, 2)`,
the locked row is unchanged, focus follows the tile, and one result is announced.
Given ordinary `ArrowDown` in the same arrangement, when it is pressed, then the
existing one-cell refusal rule still applies.

### A02 Projected content and grid gestures compete for the same input

**Evidence.** The [move design](detailed-designs/tile-interaction/move-a-tile/README.md#description)
starts from the tile's `pointerdown` and suppresses selection above 3 px. The
[keyboard handler](detailed-designs/tile-interaction/move-and-resize-by-keyboard/README.md#description)
checks editability but does not distinguish focus on the tile from a bubbling event
inside its content. L2-009 requires both a draggable surface and selectable text
after a drag. L2-032 permits arbitrary projected widgets.

**Impact.** Arrow keys in an input, slider, table, or editor can move its enclosing
tile. Dragging a selection or scrubbing a chart can start a grid drag. Merely
restoring `user-select` after a drag does not resolve the next selection gesture:
it crosses the same threshold and starts another drag. A grid-wide selection rule
can also affect content outside the active tile.

**Recommendation.** The design should define input ownership. Keyboard rearrangement
should consume commands only when the tile surface itself holds focus, and leave
descendant widget events and other modifiers alone. Pointer handling should exclude
interactive and editable descendants. A documented host-declared drag surface or
opt-out region is a proposed small contract addition for text and chart widgets.
The L2-009 selection criterion should state the mode and surface on which selection
is available, while preserving usable content in edit mode.

**Candidate acceptance.** Given a tile containing an input, slider, selectable text,
and a button, when their native interactions run in edit mode, then they operate
without geometry changes or emissions. Given focus on the tile surface instead,
when `ArrowRight` is pressed, then the tile moves once. Given a completed grid drag,
when the associated click arrives, then it does not activate a projected action;
a subsequent deliberate click still works.

Pointer cancellation alone is not a click-suppression mechanism; the Pointer Events
specification treats click dispatch separately. This supports an explicit completed-
gesture click policy, scoped so keyboard activation is preserved.
[W3C Pointer Events](https://www.w3.org/TR/pointerevents/#compatibility-mapping-with-mouse-events)

### A03 The press before dragging has no complete lifecycle

**Evidence.** [Move a tile](detailed-designs/tile-interaction/move-a-tile/README.md#description),
lines 72–74 and 100–109, delays capture until the threshold but keeps all pointer
listeners on the tile. It explicitly excludes window pointer listeners. The session
records a press before it publishes an active interaction, but the pending state,
its event delivery, and its teardown are not defined. L2-009 and L2-014 require
reliable starts and abandonment.

**Impact.** A press near an edge followed by a movement outside the tile can miss the
first qualifying move. A release outside it can leave a pending press alive. The
documented exits omit unexpected `lostpointercapture`; storing `pointerId` alone
does not establish that unrelated pointer events are ignored.

**Recommendation.** The session should distinguish idle, pressed, and active states.
Temporary document listeners during the pressed state can preserve ordinary clicks
while observing the threshold and outside release. Each terminal path should remove
listeners, clear queued work, and clear the pressed state. Guards should accept the
intended mouse button and active pointer only. Unexpected capture loss should cancel;
capture loss caused by a successful release should be an idempotent no-op. This
adds lifecycle completeness without adding touch or pen support.

**Candidate acceptance.** Given a press 1 px inside a tile edge, when the next mouse
event crosses the threshold outside the tile, then dragging begins. Given a press
released outside before activation, when the mouse later moves without a button,
then no drag begins. Given unexpected capture loss, when another tile is dragged,
then it responds and no old preview returns. Repeat the recovery check after right-
button input, cancellation, and component destruction.

Capture loss has its own event and can follow node removal; it is not equivalent
to `pointercancel`.
[W3C capture lifecycle](https://www.w3.org/TR/pointerevents/#implicit-release-of-pointer-capture)

### A04 Active gestures only refresh the cache for width changes

**Evidence.** The [gesture cache](detailed-designs/library-delivery/hold-the-frame-budget/README.md#description)
holds client-space origin and metrics and refreshes them on container-width changes. The
[width observer](detailed-designs/library-delivery/fill-the-desktop-viewport/README.md#description)
now supports that refresh explicitly through L2-030. The cache description excludes
other refresh causes. [Locking](detailed-designs/tile-interaction/lock-a-tile/README.md#description)
guards only entry points. Layout inputs replace `tiles`; keyboard commands commit
immediately; add and remove remain callable during a gesture. Only leaving edit mode
and removing the active tile have explicit cancellation rules.

**Impact.** Wheel scrolling, an ancestor scroll, a same-width position shift, or a change to
`columns`, `gap`, or `rowHeight` can separate the cached landing calculation from
the visible grid. Width refresh also needs a defined pointer/grab-offset rebase so
the lifted tile and new shadow remain consistent. Locking the active tile can leave
its existing gesture active.
Replacing the layout, inserting an obstacle, or using keyboard commands during a
pointer drag can invalidate a preview or overwrite newer state.

**Recommendation.** The design should define one interaction owner and an input
revision. Width changes should retain the remeasurement required by L2-030, with an
explicit coordinate conversion and release-validation order. L2-031's once-at-start
wording should acknowledge this exception. For other changes, the smallest proposed
policy is to cancel before adopting a relevant layout, configuration, or scroll change.
It should preserve new host data and emit no stale gesture result. An unchanged layout
echo should not cause a false change. The release path should recheck identity, lock,
bounds, and occupancy.
Keyboard rearrangement should not run concurrently with an active pointer operation.

**Candidate acceptance.** Given an active move or resize, when each listed change is
applied, then the documented cancellation or rebase rule occurs, new host state is
retained, and no stale drop commits. Given a pure container-width change, then the
gesture continues with updated geometry and no layout is emitted by the resize.
Given a later fresh drag, then its tile and shadow remain aligned.
Manual scrolling coverage does not introduce edge auto-scroll.

### A05 Stable Angular identity does not guarantee browser state

**Evidence.** The [keyboard design](detailed-designs/tile-interaction/move-and-resize-by-keyboard/README.md#description),
lines 95–103, credits focus retention to tracking by id during row-major DOM moves.
[Projection](detailed-designs/library-delivery/project-tile-content/README.md#description),
lines 60–67, acknowledges detachment can restart iframe or media state, then proposes
a wrapper. L2-027 explicitly tests focus after reordering; L2-032 tests preserved views.

**Impact.** An Angular component instance can survive while the browser loses focus
or reloads native content. Wrapping an iframe inside the same detached tile does not
keep that descendant connected. Operator input state and camera or chart content can
be interrupted by an otherwise successful move.

**Recommendation.** Focus should be captured by tile identity and, where applicable,
descendant before reorder, then restored after rendering only if the grid caused its
loss. Restoration should avoid stealing focus intentionally moved elsewhere. Scrolling
should follow the completed geometry update. The design should distinguish Angular
view identity from native DOM state. Native media preservation needs a verified
rendering strategy; a state-preserving DOM move is a candidate only after checking
the selected Angular renderer and supported browsers. The wrapper claim should be
removed unless its lifetime is demonstrably independent of the moved subtree.

**Candidate acceptance.** Given a focused tile whose next move changes DOM order,
when repeated keyboard moves run, then `activeElement` remains the intended tile
and it stays visible. Given projected scroll state and a focused input, when the
tile reorders, then both survive. If media preservation remains promised, the same
scenario should verify playback or iframe load state, not only a constructor counter.

Ordinary DOM insertion APIs remove and reinsert existing nodes. The browser's
state-preserving move API exists specifically to avoid the resulting state resets.
[Chrome: preserving state during DOM moves](https://developer.chrome.com/blog/movebefore-api)

### A06 Accessible semantics and focus fallbacks are incomplete

**Evidence.** L2-029 and the
[keyboard design](detailed-designs/tile-interaction/move-and-resize-by-keyboard/README.md#description)
specify names, descriptions, and `aria-roledescription`, but no base role or element
semantics. `accessibleNameOf` falls back only when a label is absent; normalization
accepts any string id, including empty strings. The
[removal design](detailed-designs/grid-layout/add-and-remove-tiles/README.md#description)
selects the next or previous tile without addressing locks or live mode. The render
design correctly gives the host `tabindex = -1` for the last-tile fallback.

**Impact.** A generic element does not acquire usable semantics from a role description.
Blank labels can produce empty names. Removing a tile can transfer focus onto a locked
surface, or steal focus when another control already holds it. Switching to live mode
or locking the focused tile changes its tab index without choosing a useful destination.

**Recommendation.** The design should choose a valid named grouping semantic and
document how assistive technology reaches the arrow commands; a dashboard layout
alone is not a reason to declare an ARIA data grid. Names should trim whitespace and
use a non-empty fallback. Instruction ids should be unique per grid instance.
Removal should relocate focus only when the removed subtree held it. The spec should
resolve next/previous *eligible* tile versus next/previous tile, using the already
focusable host as a named fallback when no eligible tile remains. Live-mode transitions
should leave projected content controls usable where the host intends that.

**Candidate acceptance.** Given two grids containing blank labels and locked neighbours,
when their accessible names and descriptions are read, then each is non-empty and
references its own instructions. Given removal of a focused descendant, then focus
lands on the agreed eligible neighbour or host. Given focus outside the removed tile,
then it remains there. Mode and lock changes should receive equivalent focus checks.

ARIA prohibits naming and role descriptions on the generic role. Keyboard operability
also needs manual verification with the chosen browser and screen-reader combinations.
[WAI-ARIA roles](https://www.w3.org/TR/wai-aria/#generic),
[WAI keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

### A07 Announcement runs and repeated results need a complete protocol

**Evidence.** The [keyboard design](detailed-designs/tile-interaction/move-and-resize-by-keyboard/README.md#description),
lines 65–93, now separates its settle interval from visual motion. L2-034 explicitly
preserves command batching under reduced motion. The interval length and termination
events are still unspecified. L2-029 requires one final announcement for a run of
commands and repeated announcements for repeated outcomes. Two live regions alternate,
but the text signal and clearing protocol are unspecified.

**Impact.** A timeout shorter than a user's initial keyboard repeat delay can split
one held key into multiple announced runs; a long timeout delays feedback for isolated
commands. Separating motion tokens solves the reduced-motion coupling, but does not
define those run boundaries. Alternation alone covers only the first two identical
outcomes: on the third, the first region can still contain
the same string. A string signal may suppress the update even earlier. After successful
moves followed by blocked repeats, a final message saying only “blocked” omits where
the tile actually ended up.

**Recommendation.** The new separation from animation duration should be retained.
Key release, focus loss, and a defined nonvisual fallback should close a run;
each command should still emit its committed layout as L2-027 requires. The announcement
state should identify a new outcome even when its text repeats, and specify clearing
and writing across render turns. A run's final message should include final geometry
and any refusal. `announcementFor(name, cell, accepted)` should receive operation kind
and outcome reason if it promises different move, resize, and refusal text.

**Candidate acceptance.** Given reduced motion and a held arrow key, when the key is
released, then one final position is announced and no motion transition runs. Given
three separately settled identical refusals, then all three are announced. Given a run
that moves twice and then hits an obstacle, then the final report identifies its resting
position and the obstruction. Repeat with overridden duration tokens and without the
token stylesheet. DOM text checks should be supplemented by a screen-reader check.

### A08 Normalization does not define the whole input contract

**Evidence.** [Normalization](detailed-designs/grid-layout/normalize-supplied-layout/README.md#description)
accepts `unknown` but describes only record identity and four geometry fields. It
does not define non-array input, null entries, empty ids, invalid labels, or invalid
lock values. Its `clampTile` handles geometry bounds, whereas the
[resize design](detailed-designs/tile-interaction/resize-a-tile/README.md#description)
also assigns all four size constraints to the same function. L2-024 preserves supplied
properties and L2-025 promises valid deterministic repair.

**Impact.** A parsed `null`, scalar, or mixed array can fail before numeric repair.
Contradictory limits such as `minCols: 8, maxCols: 2` have no resolution. A shared clamp
that relocates `x` to fit a larger width violates the pinned resize origin. Bad limits
can survive restore and fail only when an operator resizes.

**Recommendation.** The input boundary should define safe handling for JSON-compatible
envelopes and records, including invalid field types. Optional constraints should have
a deterministic precedence and finite integer policy. During resize, available width
is `columns - x`; the origin should remain fixed. Normalization may reposition an
input tile, so these contexts should share numeric rules without sharing an incompatible
relocation rule. L2-024 should clarify that valid metadata survives unchanged and how
invalid metadata is repaired. Arbitrary extension properties and nested data need an
explicit serialization/copy contract if “every tile property” includes them.

**Candidate acceptance.** Given `null`, a scalar, or an array containing null entries,
when supplied, then the grid reaches the documented valid state without throwing.
Given contradictory, fractional, or non-finite size limits, then repair is deterministic
and its output needs no second repair. Given a tile at `x = 9` in 12 columns, when
resized outward, then its span stops at 3 and its `x` remains 9.

### A09 A row-bounded search is not a work-bounded search

**Evidence.** [Normalization](detailed-designs/grid-layout/normalize-supplied-layout/README.md#description),
lines 52–54, calls separation bounded because it stops below the lowest occupant.
[Automatic placement](detailed-designs/grid-layout/add-and-remove-tiles/README.md#description)
tests each row-major candidate to the same boundary. L1-001 and L2-003 impose no
maximum row; L1-009 prohibits hanging on hostile input. L2-025 tests 500 records but
does not constrain their coordinate magnitude or spans.

**Impact.** A full-width tile with `rows = 1,000,000,000` at row zero makes a naive
first-fit or overlap-repair loop inspect up to a billion rows before placing the next
tile. Finite numeric input is not a safe loop bound: at `y = 2 ** 53`, JavaScript's
`y + 1` equals `y`. Large finite inputs can also overflow derived pixel heights.
Neither record count nor termination in mathematical integers prevents a frozen page.

**Recommendation.** Search should skip ranges known to be blocked using rectangle
boundaries on both axes, while retaining the exact first-fit result. For a fixed candidate column,
jumping to the bottom of a current intersecting blocker skips only starts that still
intersect it; compare feasible columns to retain row-major priority. Normalization
should retain its fixed-column downward rule. Runtime should depend on records and
candidate boundaries rather than empty coordinate magnitude or an enormous configured
column count. No spatial index or
worker is justified solely by a 60-tile target.

The specs also need a representability policy for unsafe integers, arithmetic overflow,
and browser pixel limits. A silent maximum-row cap would contradict L2-003. A proposed
clarification should separate unlimited ordinary downward growth from deterministic
repair of values the numeric and rendering systems cannot represent.

**Candidate acceptance.** Given a full-width billion-row blocker, when automatic
placement or collision repair runs, then the first legal row is returned without
iterating through every intervening row. Given unsafe integer or overflowing geometry,
then the agreed repair occurs once without a stalled page. The 500-record fixture
should include stacked collisions, huge spans, and sparse coordinates; its completion
budget should be explicit rather than inherited from a broad test timeout.

### A10 Valid configuration can produce invalid pixel geometry

**Evidence.** L2-004 bounds `columns` and `rowHeight` below and `gap` at zero, but
does not relate them to width. L2-001 applies
`(width - gap * (columns - 1)) / columns`. The
[render design](detailed-designs/grid-layout/render-grid/README.md#description)
says metrics change only with width, while the
[viewport design](detailed-designs/library-delivery/fill-the-desktop-viewport/README.md#description)
derives them from configuration too. Only the 60 px row-height default is fixed in
the specs; column and gap examples do not establish defaults.

**Impact.** At supported width 1024 px, 12 columns and a valid gap of 100 px produce
a negative column width of approximately -6.33 px. A temporarily hidden container
can produce the same problem before becoming visible. A column-count change can
leave tiles outside the grid if normalization observes only layout identity. Conversely,
recomputing a linked signal from an old host input can discard local committed edits.

**Recommendation.** Document defaults and the dependency rules for metrics and layout
repair. Width, gap, row height, and columns should recompute the relevant derived
values. A column change should repair the *current committed layout*, unless a new
layout is supplied in the same update, with one resulting repair emission. Width-only
changes should remain emission-free. Hidden or impossible geometry needs a documented
policy. Reducing an effective gap to preserve positive columns, or deferring rendering
until measurable, changes the current unconditional formula and belongs in the specs.

**Candidate acceptance.** Given each configuration input changes at constant width,
when rendered, then pixels follow the new configuration without losing a prior local
edit. Given a column reduction, then repair emits once. Given an initially hidden
container that becomes visible, then tiles and previews recover without invalid styles.
Given gap 100 in the 1024 px example, then the agreed usable-geometry policy applies.

### A11 State adoption, repair, and output copying disagree

**Evidence.** [Publishing](detailed-designs/grid-layout/publish-and-restore-layout/README.md#description)
assigns every emission to `commit`, comparing geometry and copying records. Its
[sequence](detailed-designs/grid-layout/publish-and-restore-layout/diagrams/sequence-publish.puml)
instead freezes emitted records. [Normalization](detailed-designs/grid-layout/normalize-supplied-layout/README.md#description)
adopts repaired tiles through a linked signal and emits from an effect. L2-023 tests
host mutation of the emitted record; L2-026 requires exactly one repair report.

**Impact.** A repaired value can already equal `tiles()` when the effect invokes a
geometry-based commit gate, suppressing the required report. An effect keyed only by
a boolean does not identify successive repaired inputs. Comparing geometry alone
does not define identity, ordering, lock, label, or size-limit changes. A frozen output
can make the demonstration's mutation action throw. The exposed `tiles` signal and
projected context can also leak internal mutable records even if output is copied.

**Recommendation.** Adoption, user-change detection, and repair reporting should have
one explicit order and separate reasons. Repair reporting should correspond to a
specific input revision, with no duplicate report on a clean echo. Equality should
include record identity and relevant contract fields; geometry-only equality belongs
to a move/resize no-op check. Emitted snapshots should be detached and mutable if the
existing mutation scenario is retained. Inputs, readable snapshots, and projected
records should have a consistent ownership policy. Copies belong at state boundaries,
not in every pointer event.

**Candidate acceptance.** Given two successive malformed layouts, when each is adopted,
then each repair reports once. Given a repaired layout echoed through `[(layout)]`,
then no extra emission occurs. Given a metadata-only host update, then the new metadata
is rendered and survives the next save. Given the host mutates an emitted record,
then no error occurs and the grid remains unchanged.

A read-only Angular signal does not prevent mutation of the object it returns.
[Angular signal ownership](https://angular.dev/guide/signals#writable-signals)

### A12 Batching DOM writes does not batch all gesture work

**Evidence.** The [performance sequence](detailed-designs/library-delivery/hold-the-frame-budget/diagrams/sequence-frame-budget.puml)
runs `cellAt` and a complete `canPlace` scan for each pointer event before scheduling.
The [performance prose](detailed-designs/library-delivery/hold-the-frame-budget/README.md#description)
acknowledges a linear scan but claims the measured budget holds without supplying a
measurement. [Rendering](detailed-designs/grid-layout/render-grid/README.md#description)
claims imperative properties avoid change detection; event registration and signal
notification boundaries are unspecified.

**Impact.** Twenty events can perform twenty collision scans and create twenty pending
closures even if only one is painted. Bound Angular listeners and template-consumed
signals can schedule view work; imperative CSS assignments alone do not prevent it.
Changing a tile's width and height can lay out its descendants. Two mutated elements
do not imply constant total browser work or resize cost confined to one box.

**Recommendation.** High-frequency handlers should retain the latest pointer sample
and schedule one frame. That frame should derive the candidate, check occupancy, and
write the preview. Candidate validity can be reused while the candidate and layout
revision are unchanged. The design should specify event registration outside Angular
change detection where appropriate, and publish signals on meaningful state changes.
Compatibility should cover the chosen ZoneJS and zoneless consumers. Keep the linear
rectangle check until measurements justify more code. Avoid adding containment that
clips projected content merely to improve a benchmark.

**Candidate acceptance.** Given 20 events within a frame, when it paints, then the
preview represents the latest sample and Angular profiling shows no per-event view
refresh. Given movement inside one snapped cell, then unrelated widgets remain idle.
Given resizing of projected static text and a representative chart, then traces identify
the real layout and paint work rather than counting only tile attribute mutations.

Angular documents both zone-triggered work and zoneless notifications from bound
listeners or template-read signals.
[Angular zone pollution](https://angular.dev/best-practices/zone-pollution),
[Angular zoneless notifications](https://angular.dev/guide/zoneless#requirements-for-zoneless-compatibility).
Layout and paint costs depend on affected rendering work, not just assignments.
[Browser rendering pipeline](https://web.dev/articles/rendering-performance)

### A13 Frame flushing and release have conflicting contracts

**Evidence.** [Scheduler prose](detailed-designs/library-delivery/hold-the-frame-budget/README.md#description)
says release calls `flush`, applying pending work immediately. The
[sequence](detailed-designs/library-delivery/hold-the-frame-budget/diagrams/sequence-frame-budget.puml)
calls `stop` on release instead. `release()` takes no final pointer sample. Two
custom-property assignments are called one style write, while L2-031 says at most
one write per element per animation frame. Committed bindings and imperative preview
properties share the same element without a defined handover.

**Impact.** A release before a scheduled frame can commit an old target or discard the
last preview. An immediate flush after an earlier frame update can exceed the literal
write limit. Updating committed coordinates before clearing the drag offset can double
the displacement; clearing it too early can flash the origin. A queued write can
restore a cancelled preview if `stop` cancels only the handle but leaves pending work.

**Recommendation.** The design should separate final geometry calculation from preview
painting. Release should resolve its final sample, validate current state, discard pending
preview work, adopt the result, and clear preview styles in a defined render transaction.
Cancellation should clear both the frame handle and pending callback. L2-031 should
define whether “write” means an assignment, a style-attribute mutation, or a batched
render transaction, and how start/end writes are counted. A terminal-write exception
is a requirements clarification, not something the test should silently ignore.

**Candidate acceptance.** Given a final move and release before the next frame, then
the committed geometry follows the documented final-sample rule, emits once at most,
and no later frame changes it. Given cancellation with a pending frame, then the next
frame shows no preview. Given release after an update in the same frame, then the
agreed write budget and visual handover both hold.

### A14 The performance acceptance measurement is not reproducible

**Evidence.** L2-031 specifies 60 static tiles, a two-second drag, and p95 frame
duration at most 16 ms. The
[testing seam](detailed-designs/README.md#observing-what-the-dom-does-not-show)
proposes a `MutationObserver` for write counts and a performance trace, without a
metric extraction protocol. The [performance design](detailed-designs/library-delivery/hold-the-frame-budget/README.md)
provides no trace, hardware profile, browser version, display cadence, or tile dimensions.
L1-012 includes resize, but the quantitative L2 scenario exercises only drag.

**Impact.** A smooth 60 Hz stream has an inter-frame interval of `1000 / 60`, or
16.67 ms. A test measuring animation-frame timestamp differences would fail the 16 ms
threshold even with no dropped frames. A test measuring only JavaScript duration can
pass while style, layout, or paint misses presentation. Mutation records expose attribute
changes, not browser recalculation, compositing, or the time each write occurred.

**Recommendation.** The spec should define the measured quantity before a benchmark
implements it. Keep the 16 ms requirement until that decision is explicit; do not
round samples down or loosen it to manufacture a pass. The benchmark should record
browser/OS, CPU/GPU, refresh rate, device scale, production build, fixture geometry,
content, and trace categories. It should specify warm-up, exact gesture boundaries,
sample count, percentile calculation, repetition, and treatment of invalid runs.
The reference runner and new resize/normalization budgets are **open decisions**.

One proposed protocol is three measured two-second runs after warm-up, reporting
each run's p95, maximum, sample count, and dropped/late frames, with raw traces retained.
Attribute-mutation instrumentation should run separately from the timing benchmark.
Pixel assertions should independently check visible movement; CSS geometry properties
alone can be correct while the transform or box model is wrong. Browser tracing can
attribute scripting, style, layout, and paint to the interaction.
[Chrome runtime performance analysis](https://developer.chrome.com/docs/devtools/performance)

**Candidate acceptance.** Given the agreed reference runner and static 60-tile fixture,
when the defined drag runs, then the named metric meets the existing threshold under
the agreed calculation. Given resize, long keyboard runs, and the adversarial 500-record
fixture, then separate measurements report their costs and meet their agreed budgets.
No claim that these budgets currently pass is supported by this audit.

### A15 The overlay disappears for valid layout configurations

**Evidence.** [Overlay CSS](detailed-designs/tile-interaction/reveal-the-grid/README.md#description),
lines 45–62, paints gutters with a coloured band whose width equals `gap`. L2-004
allows zero gap. The overlay covers the committed host height, while the host grows
on commit. Its `hidden` property changes immediately, yet the same design promises
an opacity fade. L2-019 requires visible cell structure throughout interaction.

**Impact.** With `gap = 0`, the coloured band has zero width. A drag or resize preview
below the last committed row can extend into an area with no grid guide. Toggling
ordinary hidden/display state does not by itself provide the specified fade lifecycle.
These effects weaken landing feedback precisely when choosing new space.

**Recommendation.** Overlay line thickness should come from a border token independently
of cell gap. A preview extent should cover at least the committed and candidate bottom
rows without changing the saved layout. The hidden/opacity lifecycle should be explicit,
including immediate removal under reduced motion and rapid cancellation/restart. The
existing forced-colour system-text treatment should remain scoped to the overlay.

**Candidate acceptance.** Given zero gap, when moving or resizing, then both axes remain
visible in normal and forced colours. Given a candidate below the current last row,
then cell lines cover its target area and no layout emits until commit. Given rapid
start/cancel/start, then the overlay reflects only the current gesture. Reduced motion
should remove it immediately at the end.

### A16 Pixel boxes and resize grab offsets need one definition

**Evidence.** [Rendering](detailed-designs/grid-layout/render-grid/README.md#description)
derives pixel dimensions with CSS while
[theming](detailed-designs/library-delivery/theme-the-grid/README.md#description)
adds configurable borders. [Viewport support](detailed-designs/library-delivery/fill-the-desktop-viewport/README.md#description)
claims host padding works; the overlay sets its own `background-origin: content-box`.
No common containing block, offset, or box-sizing rule is specified. The
[resize handle](detailed-designs/tile-interaction/resize-a-tile/README.md#description)
is inset and has a larger hit area, but `spanAt` consumes a corner position without
defining the offset from the actual press to that corner.

**Impact.** Borders outside computed width break exact gaps and the last-column edge.
An overlay child's content box is not automatically the padded host's content box.
Pressing the inner edge of a large handle can cause an immediate size jump if pointer
coordinates are treated as the tile corner. Large borders or handle tokens can also
make tiny coerced tiles physically impossible to render at their nominal cell size.

**Recommendation.** Tile, shadow, and overlay should share one content-space origin
and a documented border-box geometry. Padding and border offsets should enter the
gesture cache consistently. Resize should apply pointer delta to the initial rendered
size, preserving the corner grab offset. The design should distinguish continuous
pixel feedback from clamped cell geometry and define what happens past size limits.
Tiny-tile/large-handle conflicts should be resolved with the configuration policy in A10.

**Candidate acceptance.** Given a padded and bordered host, fractional columns, and
overridden border widths, then visible tile and shadow edges align within L2-001's
tolerance. Given presses at different points in the handle hit area, when the pointer
moves by the same delta, then resizing starts without a jump and preserves `x` and `y`.

Absolute containing blocks commonly use an ancestor's padding edge, while default
CSS sizing excludes borders and padding. Both need an explicit design choice here.
[CSS positioned layout](https://www.w3.org/TR/css-position-3/#def-cb),
[CSS box sizing](https://www.w3.org/TR/css-sizing-3/#box-sizing)

### A17 Token fallbacks do not fully define accessible rendering

**Evidence.** [The token catalogue](detailed-designs/library-delivery/theme-the-grid/README.md#description)
names tokens but supplies no values, contrast relationships, or motion cascade rules.
Reduced motion is handled by setting tokens to zero, yet the no-token route relies
on literal defaults in component styles. Host overrides are also intended to win.
L2-034 tests these conditions separately.

**Impact.** Without the token stylesheet, a media rule located only in that stylesheet
cannot override a non-zero component fallback. A host duration override can also
defeat a lower-priority reduced-motion declaration. Names such as `color-focus` do
not establish that the resulting indicator is visible against the actual tile surface.
The standalone gallery cannot verify states until it has concrete token values and
representative swatches or specimens.

**Recommendation.** The design should define effective transition durations under
reduced motion within the shipped library as well as the token package. The precedence
between user preference and theme overrides should be explicit. The catalogue should
publish defaults and accepted visual relationships, including focus, valid/invalid
borders, and forced-colour states. Defaults should come from the authoritative design
system and be mirrored through the build rather than maintained as independent choices.
The 24 px target floor should have a documented place in that token policy.

**Candidate acceptance.** Given each token route under both normal and reduced motion,
when a refused drop returns and the overlay clears, then user motion preference wins.
Given normal, overridden, and forced-colour palettes, then focus and the two target
states remain distinguishable in rendered output. Forced colours can remove box
shadows and non-URL background images, so those alone are insufficient indicators.
[CSS forced-colour adjustments](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-properties)

### A18 The installed consumer path is not designed end to end

**Evidence.** L2-033 requires a bare consuming application. The
[distribution design](detailed-designs/library-delivery/theme-the-grid/README.md#description)
describes demonstration routes but no installation of the built package into that
consumer. It declares Angular peers without a supported version range. The library
uses `linkedSignal`. `AddTileRequest` in the
[add design](detailed-designs/grid-layout/add-and-remove-tiles/README.md#description)
omits all size-limit fields even though tiles support them. Duplicate rejection returns
`void`, with no documented caller result.

**Impact.** A workspace route can pass while relying on workspace resolution, shared
styles, or providers unavailable after installation. Consumers cannot add constrained
tiles through the declared add contract without a second layout update. Partial
positions and duplicate ids give callers no clearly documented result to present.

**Recommendation.** The release design should include a packed library installed into
a minimal consumer with no workspace aliases or application services. It should exercise
the exact five intended exports, including `AddTileRequest`, and the no-token path.
The Angular peer range should follow the selected stable APIs; `linkedSignal` is marked
stable since Angular 20 in the official API. This is evidence for a compatibility
decision, not a directive to upgrade any existing application.
[Angular linkedSignal API](https://angular.dev/api/core/linkedSignal)

The add contract should accept the same optional constraints as restored tiles and
define partial-coordinate behaviour. Duplicate rejection should document whether it is
a silent no-op or a typed result; an observable result is a proposed API improvement.
The standalone design-system site and CSS artifact should have their own build/release
steps and visual examples, as already required by the repository instructions.

**Candidate acceptance.** Given a consumer with the packed artifact installed, when
drag, resize, keyboard operation, and an add with size limits run, then they work
without host providers. Given each supported Angular major, when the consumer builds
and runs, then those behaviours remain correct. Given duplicate or partially positioned
requests, when `addTile` receives them, then the documented result occurs.
Manifest and dependency constraints remain compiler/build/review responsibilities;
bootstrap success alone does not prove every dependency declaration.

### A19 Demonstration storage has no recovery or final-save path

**Evidence.** [Publishing and restoring](detailed-designs/grid-layout/publish-and-restore-layout/README.md#description)
uses JSON browser storage and coalesces saves. Neither the service contract nor the
sequences define parse failures, unavailable storage, write failures, disposal of
pending saves, or the relationship between current in-memory layout and delayed save.
Every Playwright run uses a mock, so the production adapter's failure paths are absent
from the described browser acceptance coverage.

**Impact.** Invalid JSON can fail before the grid's repair boundary receives anything.
A storage error can make the demonstration look broken even when the grid works.
Navigation immediately after a keyboard edit can discard the last coalesced write.
Using a saved layout as the source for a later lock toggle can overwrite an unsaved move.

**Recommendation.** The demonstration should update in-memory state immediately on
every emission and debounce only the storage side effect. Its adapter should define
empty/corrupt/unavailable states and keep edits usable after save failure. Controlled
navigation should flush pending changes; abrupt process termination cannot be promised
the same guarantee. Adapter behaviour can be exercised separately with a storage
substitute; grid Playwright tests should continue injecting the mock service.

**Candidate acceptance.** Given corrupt stored JSON, when the demonstration opens,
then it presents its documented recovery state. Given a storage write failure, when
a tile is moved, then the arrangement remains usable and unsaved state is visible.
Given an edit followed immediately by controlled navigation, then the latest layout
is saved once. Given a move followed by locking before the save delay ends, then both
changes survive. None of these behaviours belong inside the published grid library.

### A20 Diagrams contradict current operator behaviour

The following discrepancies change what an implementer could build, rather than
only how a diagram is labelled. The existing document consistency tools cannot
establish agreement of behavioural meaning.

| Evidence | Discrepancy | Required follow-up decision |
|----------|-------------|-----------------------------|
| [Resize C4 source](detailed-designs/tile-interaction/resize-a-tile/diagrams/c4-component.puml) and its PNG | Handle remains 16 by 16 px; L2-015 and the README require at least 24 by 24 px | Align the diagram with the existing 24 px requirement |
| [Frame sequence](detailed-designs/library-delivery/hold-the-frame-budget/diagrams/sequence-frame-budget.puml) and its PNG | Release calls `stop`; README says `flush`; cache is held for the whole gesture despite L2-030's width-refresh rule | Resolve A04/A13, then draw the refresh, final-sample, and teardown order |
| [Keyboard move sequence](detailed-designs/tile-interaction/move-and-resize-by-keyboard/diagrams/sequence-keyboard-move.puml) | Writes a live region for a single command before closing the settle window; no repeat aggregation or alternating-region protocol | Resolve A07 and diagram a complete repeated-command run |
| [Removal sequence](detailed-designs/grid-layout/add-and-remove-tiles/diagrams/sequence-remove-tile.puml) | Omits L2-022's focus transfer | Add the conditional transfer and fallback after removal |
| [Publishing sequence](detailed-designs/grid-layout/publish-and-restore-layout/diagrams/sequence-publish.puml) | Freezes records and lists only geometry/lock fields; prose promises copies and preserved label/limits | Resolve A11 and show the complete snapshot contract |
| [Distribution C4 source](detailed-designs/library-delivery/theme-the-grid/diagrams/c4-component.puml) | Exports `GridShadow` instead of the README/class diagram's `AddTileRequest` | Retain the agreed consumer surface and align its diagram |

**Recommendation.** Each affected diagram should be updated alongside its behavioural
decision and re-rendered. A semantic review should walk the same acceptance scenario
through prose and sequence. A source/PNG existence check cannot prove that a diagram
describes the right interaction. No code-shape or specification-parsing test is proposed.

**Candidate acceptance.** Given the agreed interaction and public contract, when its
behavioural acceptance scenario runs against the implementation, then the result matches
the requirement and the revised diagram. Diagram agreement itself remains a review task.

## Coverage of the specification and design tree

Every feature and requirement was considered, including the existing positive controls.
“Covered” below means covered by this audit; it does not mean implementation acceptance
has passed. Feature links lead to the full designs and their diagrams.

| Feature | L1 | L2 | Existing design strength | Findings |
|---------|----|----|--------------------------|----------|
| [Render grid](detailed-designs/grid-layout/render-grid/README.md) | 001 | 001–004 | Fractional arithmetic, cell model, downward host growth, sorted DOM order | A09, A10, A11, A16 |
| [Add/remove](detailed-designs/grid-layout/add-and-remove-tiles/README.md) | 007 | 020–022 | Deterministic first fit, duplicate refusal, active-tile removal cancellation | A04, A06, A08, A09, A11, A18, A20 |
| [Publish/restore](detailed-designs/grid-layout/publish-and-restore-layout/README.md) | 008 | 023–024 | Change-only emission, metadata round trip, service token, mock seam | A08, A10, A11, A19, A20 |
| [Normalize](detailed-designs/grid-layout/normalize-supplied-layout/README.md) | 009 | 025–026 | Ordered repair, first duplicate retained, explicit repaired flag | A06, A08, A09, A10, A11 |
| [Switch mode](detailed-designs/tile-interaction/switch-grid-mode/README.md) | 002 | 005–007 | Live default, edit affordances, cancellation on leaving edit | A02, A03, A04, A06, A07 |
| [Lock tile](detailed-designs/tile-interaction/lock-a-tile/README.md) | 003 | 008 | Shared editability check, locked occupancy, usable descendant unlock control | A01, A02, A04, A06, A11 |
| [Move tile](detailed-designs/tile-interaction/move-a-tile/README.md) | 004 | 009–014 | Separate continuous lift and snapped shadow, invalid border, no-op drop | A01, A02, A03, A04, A05, A12, A13, A15, A16 |
| [Resize tile](detailed-designs/tile-interaction/resize-a-tile/README.md) | 005 | 015–018 | One large target, pinned origin, shared validation, refusal paths | A02, A03, A04, A08, A13, A14, A15, A16, A20 |
| [Reveal grid](detailed-designs/tile-interaction/reveal-the-grid/README.md) | 006 | 019 | One gradient element, pointer transparency, forced-colour handling | A07, A12, A15, A16, A17 |
| [Keyboard operation](detailed-designs/tile-interaction/move-and-resize-by-keyboard/README.md) | 010 | 027–029 | Arrow/shift-arrow commands, instructions, final announcements, scroll intent | A01, A02, A04, A05, A06, A07, A08, A14, A20 |
| [Desktop viewport](detailed-designs/library-delivery/fill-the-desktop-viewport/README.md) | 011 | 030 | Host content-box observation, fixed columns, gesture refresh on width change | A04, A10, A14, A16 |
| [Frame budget](detailed-designs/library-delivery/hold-the-frame-budget/README.md) | 012 | 031 | Cached measurement, frame scheduler, temporary compositor promotion | A04, A09, A12, A13, A14 |
| [Projected content](detailed-designs/library-delivery/project-tile-content/README.md) | 013 | 032 | Template-only content, stable Angular view key, hostile text treated as data | A02, A05, A06, A11, A12, A16 |
| [Distribution/theme](detailed-designs/library-delivery/theme-the-grid/README.md) | 014 | 033–034 | Small exports, Angular peers, standalone tokens/gallery, theme fixtures | A07, A14, A16, A17, A18, A20 |

## Recommended order of work and verification

1. **Resolve requirements conflicts.** Decide keyboard destination reachability (A01),
   content/selection ownership (A02), unsafe numeric representation (A08–A10), and the
   performance metric and write definition (A13–A14). Retain the existing scope and
   record any accepted additions explicitly in L1/L2.
2. **Complete the interaction contract.** Specify pending/active/terminal states,
   input revision handling, final-sample release, and focus ownership (A03–A06, A13).
   Complete speech run boundaries while retaining motion independence (A07). These decisions prevent each
   slice from inventing a different exit path.
3. **Complete data and rendering contracts.** Define repair/adoption/emission order,
   numeric and constraint normalization, sparse placement, pixel boxes, overlay extent,
   and token precedence (A08–A12, A15–A17). Preserve shared arithmetic without applying
   input-repair relocation rules to a pinned resize.
4. **Prepare acceptance evidence.** After the requirements decisions, add the accepted
   candidate scenarios to the appropriate requirements, then begin implementation with
   failing behaviour tests. Playwright
   tests should state intent through the dashboard page object; that object should own
   selectors and interactions. Rendered geometry, actual focus, widget state, and output
   payloads should be observed independently. Manual screen-reader checks should cover
   key discovery, three repeated refusals, and reduced-motion command runs.
5. **Measure and package.** Run the agreed production benchmark, retain raw traces,
   exercise the installed consumer, and verify demonstration recovery (A14, A18–A19).
   Update and re-render the affected diagrams once the decisions settle (A20).

Useful benchmark coverage is deliberately split by workload:

| Workload | Evidence to collect | Current requirement status |
|----------|---------------------|----------------------------|
| 60 static tiles, two-second pointer drag | Named frame metric, p95, maximum, late/dropped frames, raw trace | L2-031 has a 16 ms threshold; metric and runner need definition |
| High event rate within one frame | Final visible preview, write transaction count, view-update profile | L2-031 requires batching; “write” needs definition |
| Resize of static text and a representative widget | Layout/paint cost, preview correctness, content state | L1-012 covers smooth resize; numerical acceptance budget is open |
| Held keyboard move/resize | Final focus/scroll position, emission count, speech count, save count | L2-027–029 define behaviour; run boundaries and repeated announcements need completion, with motion independence retained |
| 500 records with collisions and huge coordinates | Normalization duration, correct first-fit result, responsiveness | L2-025 prohibits hanging; concrete completion budget is open |
| Repeated mount, gesture, cancel, and unmount | No later preview/speech writes or duplicate gesture handlers; retained resources | Teardown is designed; no measured evidence is supplied |
| Container resize with padded host and themed borders | Actual tile/shadow edges and layout emission count | L2-001, L2-030, L2-034 already set the relevant behaviour |

## Audit evidence and limits

The keyboard obstruction and numeric examples were checked with a small, standalone
Node calculation using the specification's rectangle rules. These are counterexamples
to design assumptions, not application test results:

| Check | Result |
|-------|--------|
| Full-width row-1 obstacle, 1-by-1 tile at `(0, 0)` | Pointer target `(0, 2)` is free; one-cell keyboard search reaches only the 12 cells above the obstacle |
| `(1024 - 100 * 11) / 12` | `-6.333333333333333` px column width |
| Overlay gutter band at `gap = 0` | `0` px coloured band |
| `2 ** 53 + 1 === 2 ** 53` | `true`; row-by-row increment need not advance |
| `1000 / 60` | `16.666666666666668` ms between ideal 60 Hz frames |

Official Angular, W3C, and browser-engine documentation was consulted for the platform
claims cited next to the relevant findings. Recommendations drawn from those rules
are design inferences, not observations of a running qbc-grid implementation.
No application, accessibility, or performance acceptance is claimed as passed.
The audit is complete as a review deliverable; the findings remain proposed follow-up
work until the specs/designs and later implementation supply their own evidence.
