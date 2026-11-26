# RedNotes Plus roadmap

Where the app goes from "works in class" to a notes app you would pick over
OneNote, Notability or GoodNotes. Written Nov 2026. CLAUDE.md keeps the record
of what is done and why; this file is the plan.

Sizes are rough: **S** an evening, **M** a few days, **L** a week or more.
Within a phase, items are in the suggested order.

---

## Phase 1 — Feel and reliability

Nothing here is a new feature. It is what makes the app feel solid during a
lecture, and it removes causes of lag that later features would otherwise
inherit.

- **Async backend commands** (S). `open_notes`, `save_note`, `get_notebooks`,
  `get_recent` and `add_asset` are synchronous, so Tauri runs them on the main
  thread and the window freezes while a zip is read or written. That includes
  every autosave, 1.5 s after you stop writing. Making them `async` (as was
  done for `start_presenting`) is the cheap, large win.
- **Loading state for big notes** (S, after the above). Once opening no longer
  blocks, a tab can show a spinner or skeleton page while `open_notes` runs.
- **Lasso lag** (M). Probably the same pattern the eraser had: moving a
  selection writes into the note's deep `$state` on every move. Work on a
  plain copy during the gesture and commit on release, as `finishErasing`
  does. Profile first, with the CDP script used for the eraser.
- **Lasso stays active after the selection is discarded** (S). A state bug in
  `lassoManager` / `returnFromTemporaryTool`; needs a repro.
- **Images don't match the greyed-out selection** (S). The selection overlay
  (`BlockSvg`) and the canvas draw images differently.
- **Native pen window drag** (M). The frontend drag works but trails the pen by
  an IPC round trip per frame. Move it to Rust: one command on pen-down, then
  follow `GetCursorPos` with `SetWindowPos` until the pen lifts.
- **Remember the workspace across restarts** (S). Last tool, per-tool sizes and
  colours, eraser mode, zoom lock. Settings or a small `workspace` store.
- **Laser stays selected after a stroke** (S).
- **Pen-friendly sliders** (S). A custom range control: large thumb, tap
  anywhere to jump, fine steps when dragging slowly, and it shows the value.
  Used for size, opacity and zoom.
- **Housekeeping** (S). `runes.test.ts` builds `C:\C:\…` paths on Windows, and
  `AppShell` calls `unlisten()` before its async listener exists, which blanks
  the window on hot reload.

## Phase 2 — Ink quality

The core of a handwriting app. Done well, people notice even if they cannot
say why.

- **Smoother ink** (M). Today every stroke goes through perfect-freehand with
  fixed options. Options, cheapest first:
  - Tune streamline and smoothing per input device. A pen at 240 Hz needs much
    less than a mouse.
  - Filter the input with a One Euro filter before outlining: low lag when
    fast, steady when slow.
  - Build the outline from a Catmull-Rom spline instead of the quadratic
    midpoints in `getSvgPathFromStroke`.
  - An own outliner if needed. `asStrokePoints` / `strokeToPath` already show
    where it would plug in.
- **Pressure** (S). `thinning` is 0, so pressure does nothing. Add a pressure
  curve setting (off / light / strong) and a per-pen preview.
- **Fractional stroke widths** (S). `Stroke.thickness` is already `f32`. Only
  the UI rounds (`step="1"`, `Math.round`). Needed for scaling and for thin
  pens on zoomed-out pages.
- **Scale, rotate and restyle selections** (M). Corner handles to scale
  (scaling thickness with it), a rotate handle, and, when the selection
  contains ink, a width and colour picker that applies to the selected
  strokes. This also unblocks image resizing.
- **Pen presets** (S). Saved colour, width and pen type; one tap to switch.
- **Straight lines and shapes** (M). Hold still at the end of a stroke to snap
  it to a line, rectangle, ellipse or arrow (shape recognition). Plus a ruler
  you can place and rotate with two fingers.
- **Hold-to-switch tools** (S). Barrel button erases while held and reverts on
  release; long-press for a radial menu at the pen tip.
- **Dark paper done properly** (M). Adapt ink colours on dark paper, and an
  invert-for-display mode that keeps exports white.

## Phase 3 — Pages and organisation

- **Page scale** (M). You suggested doubling the default page scale. The
  numbers in a file are not the problem; what feels wrong is how big pen
  widths and imported PDFs come out at normal zoom. Rather than changing what
  a unit means (which would break existing files), set the default zoom, pen
  presets and the PDF import resolution so a fitted A4 page writes like
  paper. Check the "stroke width 2 seems huge on PDF imports" case against
  this.
- **Move a selection to another page** (M), and **merge pages**: cut on one
  page, paste at the same position on the other, as one undo step.
- **Copy and move pages between notebooks** (M). A page clipboard. Assets live
  in per-tab asset sessions, so pasting into another note must copy the asset
  files across sessions, or the image is missing on save.
- **Date and time on pages** (S). Store `created_at` per page; optionally show
  it in the header margin. Useful for dating lectures.
- **Templates** (M). Lined, college-ruled, dotted, graph, isometric, Cornell,
  staff paper, weekly planner. Rulings are SVG in `Paper.svelte` already.
- **Vertical scroll mode** (L). One continuous growing page, like OneNote,
  plus continuous scrolling through fixed pages, GoodNotes style.
- **Outline and bookmarks** (S). Star a page; jump to it from the sidebar.
  Sections already exist.

## Phase 4 — Finding things

- **Quick open: Ctrl+K** (M). A palette over notebooks, pages, sections and
  commands ("New page", "Export…", "Present"). Ctrl+P could do the same.
- **Tab shortcuts** (S). Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+1…9, Ctrl+W,
  Ctrl+Shift+T to reopen a closed tab.
- **Search across notes** (M). Titles, tags, typed text and imported PDF text,
  from an index the backend keeps up to date. Tags get a UI (they exist in
  `Meta` but have none).
- **Searchable handwriting** (L). Windows has an offline handwriting
  recogniser (Windows Ink / `Windows.UI.Input.Inking`), so handwriting can be
  indexed without any cloud. Recognise per page in the background and store
  the text in the file.
- **Links between notes** (M). Link a selection to another page or note;
  backlinks in the sidebar.

## Phase 5 — Classroom superpowers

Features the big apps charge for.

- **Audio recording synced to ink** (L). Record a lecture; each stroke stores
  its timestamp; tap a stroke to hear that moment, and replay the page being
  written. Notability's best feature.
- **Zoom writing box** (M). A magnified strip at the bottom of the screen that
  you write into, landing small on the page, with auto-advance to the next
  line.
- **Split view** (M). Two notes or two pages side by side, e.g. lecture slides
  next to your notes. Drag a selection between them.
- **Study mode** (M). "Tape" over parts of a page that you tap to reveal, and
  flashcards made from selections.
- **LaTeX and handwriting-to-maths** (L). LaTeX blocks first; convert
  handwritten formulas later.
- **Presenter extras** (S each). Page-only laser trails, spotlight, a timer in
  `PresenterBar`.

## Phase 6 — Your notes everywhere

- **Folder sync that is safe** (L). Many people sync with OneDrive, Nextcloud
  or Synology Drive. Watch the notebooks folder for outside changes, reload
  open notes that changed on disk, and never overwrite: write a conflict copy,
  or merge stroke by stroke. Stroke-level history patches (tech debt 1) make
  merging feasible.
- **Version history and backups** (M). Keep the last N saves of each note
  inside the app's data folder; "Restore an earlier version".
- **Vector PDF export** (M). Today PDF export is raster (JPEG). Vector ink
  keeps files small and sharp and makes exports usable elsewhere.
- **Import from other apps** (L, research first). Realistic routes: PDFs
  exported from GoodNotes or Notability (already importable, but re-render
  their annotations as editable ink where the PDF has them as vector paths),
  and OneNote through the Microsoft Graph export. Native `.goodnotes` and
  `.one` files are undocumented; only attempt them after checking what open
  tools already parse.
- **Mobile and tablet builds** (L). Android first: Tauri supports it and icons
  exist. A tablet layout, then iPad.

## Phase 7 — Under the hood

Do these when a feature needs them, not up front.

- **Load pages lazily** (L, tech debt 4). Keep only visible pages' blocks in
  the frontend; needed for very large notes.
- **Stroke-level history patches** (M, tech debt 1). Lighter undo; needed for
  sync merging.
- **Raw note state** (L). The note is deep `$state`, so every block and point
  is proxied. The eraser now avoids that during gestures. Making block arrays
  `$state.raw` and relying on the immutability rule everywhere would remove
  the cost for good.
- **Rendering off the main thread** (M). Thumbnails, previews and export
  (`toDataURL` showed up in the eraser profile) can render in a Web Worker
  with `OffscreenCanvas`. If the live canvas becomes the limit, WebGPU inside
  Tauri, as CLAUDE.md already decided.
