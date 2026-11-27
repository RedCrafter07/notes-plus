# RedNotes Plus roadmap

Where the app goes from "works in class" to a notes app you would pick over
OneNote, Notability or GoodNotes. Written Nov 2026. CLAUDE.md keeps the record
of what is done and why; this file is the plan.

Sizes are rough: **S** an evening, **M** a few days, **L** a week or more.
Within a phase, items are in the suggested order. Items that only concern one
platform are tagged **[Windows]**, **[Linux]** or **[Android]**.

## Platforms

| Platform | Priority | Webview | Status |
| --- | --- | --- | --- |
| Windows | primary | WebView2 (Chromium) | daily use |
| Linux (X11 and Wayland) | primary | WebKitGTK | builds; title bar and presenter placement handled |
| Android tablets | next | Android System WebView (Chromium) | not started |
| Android phones | maybe | Android System WebView | not started |

Ground rules:

- **One codebase, no platform forks.** Platform code lives behind small seams:
  `#[cfg(...)]` in Rust, and in the frontend a `platform` module, not
  `userAgent` checks scattered through components.
- **Windows and Linux ship together.** A feature is done when it works on
  both. Windows-only APIs (handwriting recognition, the native pen drag) need
  either a Linux equivalent or a graceful fallback.
- **WebKitGTK is the odd one out.** Windows and Android both run Chromium, so
  most web-platform surprises show up on Linux first. Test pen input,
  performance and rendering there before calling something done.
- **Android assumes no plain file system.** Notes live in the app's storage;
  getting files in and out goes through the system file picker and share
  sheet.

---

## Platform track

This runs alongside the phases below rather than after them.

### Windows and Linux parity (with Phase 1)

- **CI for both** (M). GitHub Actions building Windows and Linux on every
  push, running `mise run check` and the tests, and producing installers:
  MSI/NSIS for Windows; AppImage, `.deb` and `.rpm` for Linux. Catches a
  Linux break the day it happens instead of the next time someone tries.
- **Pen input on WebKitGTK** [Linux] (M). Check pressure, the eraser end,
  barrel buttons and `getCoalescedEvents` (the controller already falls back
  to the single event) with a real tablet on X11 and on Wayland. Where
  WebKitGTK reports less than Chromium, document it in the app instead of
  failing silently.
- **Rendering performance on WebKitGTK** [Linux] (M). Canvas 2D on WebKitGTK
  can be much slower than on Chromium, depending on whether GPU acceleration
  is on. Profile a dense page (the "Lag" note) on Linux; this decides how
  early the WebGPU / off-main-thread work in Phase 7 is needed.
- **Window behaviour** [Linux] (S). Custom title bar dragging and resizing
  under GNOME, KDE and a tiling compositor; the pen window drag from Phase 1
  (on Wayland only the compositor may move a window, so use
  `start_dragging`, not cursor polling).
- **Desktop integration** [Linux] (S). `.rnpf` MIME type and icon, a
  `.desktop` file, "Open with", and single-instance handoff when a file is
  opened while the app runs.
- **Flatpak** [Linux] (M). One package for every distribution. The notebooks
  folder must then be reached through the file chooser portal or a granted
  folder.

### Android tablets (after Phase 3)

Tablets come first: they are what students write on, and the desktop layout
mostly fits.

- **Get it running** (M). `tauri android init`, a debug build on a real
  tablet, and the Rust parts that assume a desktop behind `cfg(desktop)`:
  window controls, the presenter window, drag and drop, single instance,
  opener.
- **Storage** [Android] (M). Notebooks in app storage; import and export
  through the system file picker and the share sheet ("Open with RedNotes"
  for `.rnpf` and PDF). Sync then has to work through a chosen folder or an
  app such as Nextcloud, not a path.
- **Lifecycle** [Android] (S). Android can kill a backgrounded app without
  warning: save on pause, not only 1.5 s after the last change, and restore
  open tabs on the next start.
- **Pen and touch** [Android] (M). Stylus pressure, the S Pen button, palm
  rejection while the pen hovers or touches, and two-finger gestures that
  must not fight the system's own edge gestures.
- **Tablet UI** (M). Bigger touch targets where needed, no window controls,
  the toolbar respecting display cutouts and the gesture bar, the on-screen
  keyboard not covering the text being typed.
- **Presenting** [Android] (L). An external display needs a native plugin
  (Android `Presentation` API), as already noted under presenter mode.
- **Release** (M). Signing, Play Store listing, and an F-Droid build to stay
  true to free and offline.

### Android phones (maybe, last)

A phone is a different app more than a smaller tablet: mostly reading,
quick notes and photos of the board.

- **Phone layout** (M). One panel at a time, a compact bottom toolbar, the
  page fitted to width with vertical scrolling (needs the vertical-scroll
  mode from Phase 3).
- **Capture** (M). Photograph the board or a handout straight onto a page,
  with perspective correction.
- **Read and find first** (S). Open quickly at the last page, search, and
  quick jot notes; full editing stays available but is not the focus.

---

## Phase 1 — Feel and reliability (done, Nov 2026)

Nothing here was a new feature: it made the app feel solid during a lecture
and removed causes of lag that later features would have inherited.

- **Eraser**: worked outside the note's reactive state and commits on lift;
  cut pieces keep their drawn shape (`Stroke.smoothed`); whole-stroke mode.
- **Async backend commands**: file I/O no longer freezes the window; a
  notebook card shows a spinner while its note opens.
- **Lasso**: selection drawn on its own canvas and dragged with a CSS
  transform; dropping is linear, not quadratic; a barrel-button lasso ends
  whenever the selection does; the page fades evenly (PDF pages included).
- **Pen and touch window drag**: on Windows the tab bar's drag regions are
  `app-region: drag`, so Windows moves the window itself (any input, with
  Snap). Following the cursor from Rust did not work: pen and touch do not
  move it. On Linux, a frontend drag moves the window (X11 only).
- **Workspace across restarts**: tool, per-tool colour and size, eraser mode,
  zoom lock (`editor/state/workspace.ts`, per device in localStorage).
- **Laser trail**: strokes stay while you keep pointing and fade together.
- **`Slider`**: pen-friendly range control (whole track is a target, slower
  when the pen moves away from it), used by tool size, line spacing and the
  colour picker.
- **Housekeeping**: `runes.test.ts` on Windows; async listeners in `AppShell`
  that threw on hot reload or were never removed (`util/listeners.ts`).

Still to confirm with a real pen: the barrel-button lasso and the window
drag (checked with the mouse: Windows handles the press, the page gets none).

## Phase 2 — Ink quality

The core of a handwriting app. Done well, people notice even if they cannot
say why.

- **Smoother ink** (done, first step). Measured on real handwriting: points
  are dense, but WebView2 rounds pen positions to whole device pixels, so
  curves arrive as a staircase (median turn of 18° per point). Fixed by
  `denoise` (Gaussian along the stroke, about one grid step, the grid read
  from each stroke) at render time, plus perfect-freehand's `smoothing` at
  its default 0.5. A spline would have kept the staircase. If more is
  needed later: sub-pixel pen input (Windows pointer API), or an own
  outliner (`asStrokePoints` / `strokeToPath` show where it would plug in).
- **Pressure** (done). `pen_pressure` setting (off / light / strong) with a
  preview; each stroke stores its `thinning`, so old ink keeps its look.
- **Fractional stroke widths** (done). The pen slider steps by 0.5.
- **Rotating text and images** (M). With "Move selections from anywhere",
  a two-finger twist rotates a selection, but text and images only move
  around the centre and stay upright: they have no stored rotation yet
  (data model, rendering, export, hit testing, bounds). A rotate handle on
  the frame for pen and mouse belongs here too.
- **Scale, rotate and restyle selections** (M). Done: the width control in the selection menu (absolute for a
  common width, a percentage for mixed widths, one undo step per drag;
  `lassoManager.scaleWidth`), and corner handles that scale proportionally
  around the opposite corner, ink width and font size included, so images
  can be resized (`scaleBlock`; previewed with a CSS transform). A toggle
  in the menu keeps line widths when scaling. The setting "Move selections
  from anywhere" (Concepts-style): drag anywhere to move, a tap outside
  deselects, two fingers move, scale and rotate (`transformBlock`, one undo
  step per touch sequence).
- **Arrange within a layer** (done). "Arrange" in the selection menu: to
  front, forward, backward, to back (`arrange.ts`, one undo step).
- **Lasso modes** (done). Select what the loop touches or only what it
  contains (toolbar, remembered), e.g. text over an image without it. A
  rotation lock for two-finger gestures sits in the selection menu.
- **Pen presets** (done). Saved pen or highlighter with colour and width,
  in Settings (same in every notebook); a tap switches, the bookmark button
  saves the current pen, hold or right-click removes (`presets.ts`).
- **Straight lines and shapes** (shapes done). Rest the pen at the end of a
  stroke and it snaps to a line (level/45° when close; its end then follows
  the pen), rectangle, other quadrilateral, triangle, circle or ellipse
  (`shapes.ts`, `shape_snap` setting). Stored as ordinary strokes drawn as
  they are (`smoothed`), so the file format is unchanged. A ruler (toolbar
  toggle; `ruler.ts`, `rulerManager`): one finger moves it, two turn it
  (snaps to 45°), a mouse drags it and the wheel turns it; a pen stroke
  starting on or next to it runs along the nearer edge. View state, not
  saved. Still to do: arrows.
- **Hold-to-switch tools** (done). Settings choose what the barrel button
  does: lasso (default, stays until nothing is selected), or eraser or
  highlighter only while held (`penButtons.ts`). Still open: a long-press
  radial menu at the pen tip.
- **Dark paper done properly** (done). Ink that is hard to read on dark
  paper is drawn with its lightness flipped (OKLab, hue kept), everywhere
  including export; stored colours never change (`inkColor.ts`). "Dark
  pages" (setting, moon button by the zoom) shows light pages dark in the
  editor only, PDF backgrounds inverted; exports, thumbnails and the
  presenter view keep the real colours.
- **Right-size scanned PDFs** (done). Scanners often store the page size
  as pixels at 72 dpi, so a 300 dpi A4 scan imported 4.2× too large.
  `import/pdfScale.ts` detects it (known paper shape × common scan dpi; A4
  and 300 dpi tried first, since A4 at 300 and A6 at 600 have the same
  pixels) and the import dialog then offers real size (preselected), the
  note's page width, as stored, or a percentage. Scans render at their own
  pixel count, which also makes them much smaller in the file.

## Phase 3 — Pages and organisation

- **Page scale** (M). You suggested doubling the default page scale. The
  numbers in a file are not the problem; what feels wrong is how big pen
  widths and imported PDFs come out at normal zoom. Rather than changing what
  a unit means (which would break existing files), set the default zoom, pen
  presets and the PDF import resolution so a fitted A4 page writes like
  paper. Check the "stroke width 2 seems huge on PDF imports" case against
  this.
  Checked on a real lecture note (Nov 2026): its PDF page was a cropped
  book scan stored at 2074 x 3045 pt (732 x 1074 mm), not a standard paper
  size, so ink needed widths of 40-50. The PDF import now flags such pages
  and preselects "A4 width" (factor 0.29, so 50 becomes about 14). What is
  left: a way to fix notes imported before that, e.g. "Resize page and
  content" in Page setup (scales the page, its background and every block
  together, one undo step).
- **Move a selection to another page** (done), and **merge pages** (done).
  "Move to page" in the selection menu: previous, next, a new page after
  this one, or any page by number. Same position, same layer (by position
  in the list; locked/hidden ones skipped), nudged onto a smaller sheet; one
  undo step, and the target page opens with the blocks still selected
  (`movePage.ts`). Merging: "Merge" for several selected pages in the
  page overview, or "Merge with next page" in a page's menu; everything
  goes onto the first page at the same positions, a merged page's PDF
  background becomes an image underneath, one undo step.
- **Copy and move pages between notebooks** (M). A page clipboard. Assets live
  in per-tab asset sessions, so pasting into another note must copy the asset
  files across sessions, or the image is missing on save.
- **Drag and drop attachments** (S–M). Drop images and PDFs from the file
  manager onto the editor: images land where they are dropped, PDFs open
  the import dialog. Tauri already catches drops natively (for `.rnpf`,
  `handle_drag_drop.rs`) and gets file paths plus the drop position, so
  the backend can add the file to the tab's asset session from its path
  (no data URL round trip; PDFs could be served to pdf.js through
  `rnasset://`). Drops from a browser carry no path and need the HTML5
  route, which Tauri's native handler swallows; out of scope at first.
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
- **Searchable handwriting** (L). Recognise each page in the background and
  store the text in the file, so search works on every platform once a page
  has been recognised anywhere. The recogniser differs per platform, behind
  one Rust trait:
  - [Windows] the built-in offline recogniser (`Windows.UI.Input.Inking`).
  - [Android] ML Kit Digital Ink Recognition, on device after a one-time
    model download.
  - [Linux] no system recogniser exists. Either a bundled open model (e.g. an
    ONNX handwriting model run in Rust), or Linux shows text found elsewhere
    and does not recognise new pages itself. Decide after trying a model.
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
- **Notes side by side** (M, then L). Lecture slides next to your notes,
  like GoodNotes on the iPad or OneNote on Windows. In two steps:
  1. **Several windows** (M). "Open in new window" in a tab's menu, or drag
     a tab out of the bar; Windows Snap or a tiling WM places them side by
     side. Cheaper than it sounds: each window runs its own copy of the
     frontend, so the singletons (`tabManager`, `canvasManager`, history)
     are per window already, and settings changes already reach every
     window (`settingsUpdate`). Needed: the backend tracks which window has
     which file open, so a note opens in one window only (opening it again
     focuses that window; two windows saving the same file would overwrite
     each other); files from Explorer or the command line open in the last
     focused window; quitting closes all windows after the unsaved-changes
     check in each.
  2. **Split view in one window** (L). Two editor panes in one window, then
     dragging a selection from one into the other. This needs per-pane view
     and editor state instead of the singletons, a larger refactor, so it
     comes after windows have shown what is used.
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
  merging feasible. Watching works differently per platform (the `notify`
  crate covers Windows and Linux); on Android, sync goes through a folder
  chosen in the system picker or through the sync app itself.
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
- **Mobile builds**: see the platform track (Android tablets, then phones).
  iOS/iPadOS is not planned.

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
  Tauri, as CLAUDE.md already decided. Check support first: WebGPU and
  `OffscreenCanvas` arrive later in WebKitGTK than in Chromium, so Linux may
  need the Canvas 2D path to stay.
