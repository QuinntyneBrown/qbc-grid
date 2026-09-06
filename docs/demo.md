# Five-minute feature walkthrough

[![qbc-grid running in edit mode](media/qbc-grid-demo-poster.png)](media/qbc-grid-demo.mp4)

**[Watch or download the demo (MP4)](media/qbc-grid-demo.mp4)** ·
[English captions (WebVTT)](media/qbc-grid-demo.vtt) ·
[Full transcript](demo-transcript.md)

The video runs for **5:00** at **1600 × 900**, with English narration, readable chapter
titles, an emphasized pointer, live layout measurements, and on-screen explanations.
The MP4 uses H.264 video and AAC audio and includes an English subtitle track and chapter
metadata. If your repository viewer does not play the file inline, download it or open
the raw file in a video player. The adjacent WebVTT file works with players that do not
read embedded MP4 subtitles.

## Chapters and coverage

| Time | Demonstration | Product requirements |
| --- | --- | --- |
| 00:00 | Desktop grid, Angular widgets, and host/library responsibilities | L1-001, L1-013, L1-014 |
| 00:20 | Pointer move, elevated tile, snapped shadow, and temporary grid overlay | L1-004, L1-006 |
| 00:40 | Collision refusal and Escape cancellation | L1-004, L1-006 |
| 01:00 | Pointer resizing with minimum and maximum dimensions | L1-005 |
| 01:20 | Live/edit modes, lock, unlock, and working projected controls | L1-002, L1-003 |
| 01:40 | Arrow movement, Shift + Arrow resizing, live-region announcements | L1-010 |
| 02:00 | Ctrl + Arrow crossing a locked full-width obstacle | L1-010 |
| 02:20 | Automatic addition, explicit coordinates, removal, and focus recovery | L1-007 |
| 02:40 | Preserved widget instance, note, and scroll state after movement | L1-013 |
| 03:00 | Emitted JSON saved by the host and restored after reload | L1-008 |
| 03:20 | Invalid records, duplicate IDs, geometry clamping, and overlap repair | L1-009 |
| 03:40 | Container width changes with fixed columns and downward growth | L1-001, L1-011 |
| 04:00 | Design token overrides and reduced-motion preference | L1-014 |
| 04:20 | Sixty tiles, pointer previews, cancellation, and committed output | L1-012 |
| 04:40 | Standalone public API, separate tokens, documentation, and MIT license | L1-014 |

See [L1](specs/L1.md) for feature scope and [L2](specs/L2.md) for the detailed acceptance
criteria. A five-minute demonstration illustrates each feature area; the acceptance suite
covers the full set of edge cases.

## What is being recorded

The footage captures the actual `src/e2e-app` Angular application using its ordinary
browser-storage adapter, in isolated Playwright browser contexts. The recorder seeds
sample layout data into those contexts. The save/restore chapter uses a real page reload
and the host's local-storage implementation.

The recording tools add a presentation header, chapter panel, cursor highlight, control
styling, and explanatory text. The panel reads actual rendered geometry, output counters,
and live-region text. These presentation annotations are not a shipped application UI.
The sixty-tile scene shows static labels using the existing projected widget template.

The explicit-position chapter calls the exported `GridComponent.addTile` method through
Angular's development inspection hook. Pointer, keyboard, and existing button interactions
use the dashboard page object. All chapters assert the behavior they describe and reject
page errors. Narration is synthesized locally using the Windows Microsoft Zira voice;
it does not impersonate a project contributor. There is no music or third-party stock footage.

The sixty-tile chapter is a functional demonstration. It does not measure a frame-rate
guarantee; the repository's separate [performance tests](../e2e/specs/frame-budget.spec.ts)
cover the implementation's frame-work criteria.

## Reproduce the recording

Install the repository dependencies and Chromium as described in
[CONTRIBUTING.md](../CONTRIBUTING.md). Recording uses the existing Angular application on
port **4382** and starts it automatically if the port is free. An existing service on that
port must be the ordinary `e2e-app` development configuration, with the storage adapter.

Rehearse without recording or long presentation pauses (PowerShell):

```powershell
$env:QBC_DEMO_DRY_RUN = '1'
npx playwright test --config tools/demo/playwright.config.ts
Remove-Item Env:QBC_DEMO_DRY_RUN
```

Record all fifteen twenty-second chapters:

```sh
npx playwright test --config tools/demo/playwright.config.ts
```

Generate the narration on Windows with Windows PowerShell and an installed speech voice:

```powershell
powershell -NoProfile -File tools/demo/narrate.ps1
```

The script defaults to `Microsoft Zira Desktop`; pass `-Voice` with another installed
voice name if needed. On other systems, provide your own narration as
`tmp/demo/audio/01.wav` through `15.wav`, each no longer than 19.5 seconds. Scripts and
narration text are in [tools/demo](../tools/demo/).

Install a full [FFmpeg build](https://ffmpeg.org/download.html) with `libx264`, AAC, and
`ffprobe`. Playwright's bundled video encoder alone cannot produce this MP4. Then run:

```sh
node tools/demo/compose-demo.mjs
```

If the executables are outside `PATH`, set `QBC_FFMPEG` and `QBC_FFPROBE` to their absolute
paths. Composition trims capture setup, encodes exactly twenty seconds per chapter,
normalizes narration loudness, joins chapters, and writes the MP4, captions, and transcript.
It checks narration length, total duration, codecs, resolution, and a complete decode.

Intermediate recordings, audio, encoded chapters, and stills stay under ignored `tmp/demo/`.
The final distributable files are under `docs/media/`. The recorder regenerates the poster
from the pointer-movement chapter. Review the finished video after changes to narration,
timing, fixtures, or presentation styles before committing updated media.

## Acceptance of this deliverable

- **Given** the current Angular library and demonstration host, **when** the scripted
  interactions run, **then** each chapter shows and asserts its described feature behavior.
- **Given** the fifteen captures and narration clips, **when** composition finishes,
  **then** the result is a decodable five-minute video with audio, subtitles, and chapters.
- **Given** a reader opening the root README, **when** they select the linked poster or
  demo text, **then** they can reach the actual MP4 and its accessible transcript.
