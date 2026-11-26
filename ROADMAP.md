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
