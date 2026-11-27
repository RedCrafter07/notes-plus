# RedNotes Plus

An SVG-based, stylus-first note-taking app built with Tauri 2 + Svelte 5 + Rust.
Primary targets are **Windows** and **Linux** (both must work; Windows is
the daily driver), then Android tablets, maybe phones (see `ROADMAP.md`). The
author uses it for taking notes in class.
Goal: a free, offline, no-subscription alternative to OneNote/Notability.

## Commands

Task runner is [mise](https://mise.jdx.dev). Package manager is **bun** (not npm).

```bash
mise run dev            # alias: d   -- start in dev mode (cd app && bun tauri dev)
mise run build          # alias: b   -- production build
mise run check          # alias: c   -- rust + frontend checks
mise run check-rust     # alias: crs -- cargo check + clippy, both crates
mise run check-frontend # alias: cfr -- svelte-check
cd app && bun test      # vitest
```

**Regenerating TypeScript bindings:** `app/src/lib/tauri/bindings.ts` is generated
by specta and kept out of git. Dev builds export it on every start; a
production build runs `prebuild`. Manually:

```bash
cd app && bun run bindings       # release profile, as `tauri build` compiles it
cd app && bun run bindings dev   # debug profile (CI, quick local runs)
```

Both run the `export_bindings` example (`app/scripts/bindings.ts`). The
release variant uses the same profile and `tauri/custom-protocol` feature as
`tauri build`, so the two share every compiled dependency; the old
`cargo test` export built the whole tree a second time in the debug profile.
Never hand-edit `bindings.ts`. Change the Rust type, then regenerate.

**CI** (`.github/workflows/`): `ci.yml` runs clippy (`-D warnings`), the Rust
and frontend tests and svelte-check on Windows and Ubuntu for every push to
`main` and every PR. `release.yml` builds the installers on a `v*` tag and
attaches them to a draft release. Commits follow Conventional Commits.

## Architecture

Cargo workspace with two crates plus a SvelteKit 3 frontend:

- **`common/`** — the data model and file I/O. UI-independent on purpose; this is
  what makes a future renderer swap cheap.
- **`app/src-tauri/`** — Tauri commands, settings, window/lifecycle, drag-drop.
- **`app/src/`** — SvelteKit (static adapter) frontend. There is no
  `svelte.config.js`: the adapter and preprocessor are options of the
  `sveltekit()` plugin in `vite.config.ts`, and `tsconfig.json` extends the
  generated `$app/tsconfig`.

### Data model (`common/src/structs/data/`)

```
NoteData { meta, content, state }
  Meta    -> id, title, folder, tags, created_at, edited_at
  Content -> pages: Vec<Page>
    Page  -> id (unique, stable), section: Option<PageSection { id, name }>,
             layers, width, height, pattern, pattern_scale, colors, name,
             background_asset (imported PDF page),
             regions: Vec<ExportRegion> (export order; format id or "free")
             default is A4 (794 x 1123 units, 96 units per inch);
             width/height of -1.0 means INFINITE
    Layer -> id, blocks, visible, locked, name
    Block -> #[serde(tag = "type")] enum { Stroke, Text, Image }
             TS: ({ type: "Stroke" } & Stroke) | ... -- every variant has `id`
    Stroke-> id, points (x, y, pressure), color, thickness, opacity,
             smoothed (optional: points are the drawn centre line, as left
             by the eraser; drawn without smoothing again, see `strokeToPath`),
             thinning (optional: pressure response it was drawn with, from
             the `pen_pressure` setting; absent = even width)
  State   -> zoom, pan_x, pan_y, current_page, current_layer,
             collapsed_sections  (persisted per note)
  attachments are not in NoteData: blocks/pages hold an asset id, and the
  bytes stay in the archive or the cache (see "Attachments" below)
```

### File format: `.rnpf`

A zip archive (`common/src/io/archive.rs`) containing `meta`, `data`, `state`,
`version`, `assets/index` + `assets/<id>` (raw attachment bytes), and an
optional `preview` (PNG of the first page, rewritten on every save, read by the
file browser; absent in older files, which show an icon). Current
version is **5** (v5 added page ids and sections). `common/src/io/migrate.rs` upgrades older `data` JSON step by
step before deserializing; to change the format, bump `CURRENT_VERSION` and add
a `vN_to_vN+1`.

### Attachments (`app/src-tauri/src/assets.rs`, `lib/editor/assets.ts`)

Images and PDF page renders never travel to the frontend as data and are
never all in memory. Each open tab has an **asset session** (`Tab.assets`,
from `OpenData.assets` or a fresh UUID for a new note). The webviews load an
attachment from `rnasset://localhost/<session>/<id>` (`http://rnasset.localhost/`
on Windows/Android; `sessionAssets()` builds it), which `AssetStore` answers
from the note's file, or from a cache file in `<app cache>/assets/<session>/`
for new attachments (`addAsset` sends one once, as a data URL) and for ones a
save dropped. Saves send no attachment data: `AssetStore::save` writes them
from the cache and copies the rest from the old file as raw zip entries
(`AssetSources`). An attachment used but found nowhere fails the save
(`MissingAsset`) instead of vanishing.

Unused attachments leave the file at save time, never on delete, and the
session keeps a cache copy, so undo can restore a block whose asset was
"removed". Closing a tab deletes its cache; the cache is also emptied at
startup. Responses carry `Access-Control-Allow-Origin: *` and images load with
`crossOrigin = "anonymous"`, or canvases drawing them could not be exported.
SVG export embeds attachments as data URLs (`assetDataUrl`). The decoded
image cache (`render/images.ts`) keeps the 48 most recently used.

### Frontend state (`app/src/lib/state/`)

Singleton classes using Svelte 5 runes:

- `tabManager` — open tabs; each `Tab` owns its `NoteData` and a `HistoryManager`.
- `contentManager` — a **view onto the active tab's note** (`get #note() { return tabManager.note }`).
- `canvasManager` (`lib/editor/state/`) — tool, colour, per-tool sizes, view
  (pan/zoom, `fitPage`, `clampPan`) and painting the layer canvases.
- `historyManager` — per-tab undo/redo; gesture-scoped. Records before/after
  block arrays per layer, and before/after `pages` arrays for structural edits
  (add/delete/move page, page setup, layers). Capped at 100 entries.
- `lassoManager`, `textEditor`, `overlayManager`, `popupManager`,
  `settingsStore` (`updateSettings(patch)`), `fsStore`.

**Immutability rule:** blocks, pages and layer lists are never edited in place.
A change assigns a new object/array (a changed block gets a new id). History
diffs by identity, the renderer watches identity, and the geometry caches are
keyed by block id — all three rely on this.

### Rendering

One `<canvas>` per layer, stacked, over `Paper.svelte` (sheet, PDF background
and ruling as SVG in content space). Painting is reactive: `canvasManager.watch()`
runs in one `$effect`, and any change schedules a single repaint through
`render/scheduler.ts` (one rAF loop, dirty flag). Blocks outside the viewport
are culled using cached bounds (`blocks.ts`). The in-progress stroke is an SVG
`<path>` overlay, committed on pointer-up. The lasso selection is drawn on its
own canvas above the layers (same `drawBlocks`), which a drag only moves with
a CSS transform; the frame and the lasso loop stay SVG. Gestures that change
many blocks (eraser, lasso drop) work outside the note's deep `$state` and
assign once at the end; per-move writes into it were the cause of their lag.

Ink: stored points are the input as recorded. At render time `denoise`
(`lib/editor/denoise.ts`) removes the device-pixel staircase WebView2 puts
into pen positions, then perfect-freehand outlines the stroke
(`lib/editor/svg.ts`; `centerLine` for the eraser goes through the same
steps, so cuts match the ink).

`render/draw.ts` holds pure draw functions shared by the live canvas, page
thumbnails and export (`render/page.ts`), so what you see is what you export.
Block-type logic lives behind exhaustive switches in `lib/editor/blocks.ts`.

Input is handled in `lib/editor/canvasController.svelte.ts`: pointer events with
`getCoalescedEvents()` for pen, one-finger pan, two-finger pinch-zoom, two-/three-
finger tap for undo/redo, touch ignored while the pen is down, wheel zoom/pan.
Tools are defined once in `lib/editor/tools/registry.ts`.

## Decisions made

### Stay on Tauri — do not rewrite in GPUI

Evaluated and rejected (Nov 2026). Reasons, in order of weight:

1. **GPUI has no stylus pressure API.** zed#63250 ("Report stylus pressure on the
   mouse events") has been open and unmerged since Aug 2026; zed#66706 (Wayland
   graphics tablet support) was closed unmerged. The only `pressure` in GPUI
   today is macOS force-touch trackpads. Pressure-sensitive pen input is this
   app's whole premise, and the webview provides it for free on every platform.
2. **Windows is GPUI's youngest backend** (DirectX 11, official around Oct 2025)
   and is generally ranked behind macOS and Linux — and Windows is the primary
   target here.
3. **No mobile story.** `gpui-mobile` is third-party at 0.1.0 and depends on Zed
   crates not published to crates.io. Tauri has first-party iOS/Android, and
   Android icons already exist in `app/src-tauri/icons/android/`.

If rendering performance ever becomes the wall, move **only the canvas** to
WebGPU inside Tauri and keep the Svelte shell. `common/` already isolates the
data model, so that is not a rewrite.

### Replace the radial toolbar with a conventional bar (done)

The radial menu (`lib/editor/Toolbar.svelte` + `PenToolbar.svelte`) is pinned to
`right-0 top-1/2`, which is exactly where a right-handed user's palm rests. It
also has nowhere to put a thickness slider, which is why stroke width and eraser
size currently have **no UI at all**.

The swap is low-risk: both files are self-contained, `<Toolbar />` is mounted in
exactly one place, `toRadian` is used nowhere else, and the toolbar renders
_outside_ the `use:canvasController` element, so there is no pointer-event
plumbing to redo. `ColorEditPopup` is a full-screen overlay and is unaffected.

Carry over when rewriting: tool selection, the swatch list from
`settingsStore.store.colors`, the add-colour button, and `ColorEditPopup`.
Replace the `ondblclick`-to-edit interaction (bad with a stylus) with long-press
or an explicit edit affordance. Add while in there: **thickness, eraser size,
and undo/redo buttons**.

Done: `Toolbar.svelte` + `ViewControls.svelte` (zoom, pages). The toolbar docks
to any edge (`toolbar_dock` setting, drag the grip); it snaps rather than
floating freely on purpose. The tab bar doubles as the window title bar
(`decorations: false`, `data-tauri-drag-region`, `WindowControls.svelte`),
with a `system_title_bar` setting to bring back the OS bar. On Windows the
drag regions are also `app-region: drag` (app.css; wry enables WebView2's
non-client regions), so Windows drags the window for mouse, pen and touch;
Tauri's script-driven `start_dragging` only works with a mouse there. On
Linux, `penWindowDrag.ts` moves the window for pen and touch.
Do not maintain both shapes. If a radial menu returns later, it belongs as a
long-press context menu at the pen tip, not as a second primary toolbar.

## Roadmap

The forward plan, in phases, is in `ROADMAP.md`. This section records what is
done and how it was built.

### Pages

A note is a list of pages. Each page has a format (A4 default; A5, Letter,
16:9, 4:3, Square, or Infinite) recognised from its width/height
(`lib/editor/pageFormats.ts`). Fixed pages are drawn as a sheet on a desk, ink
is clipped to the sheet, and panning is clamped so the sheet cannot be lost.

### Tier 1 — blockers for real classroom use

- [x] **Autosave.** 1.5 s after the last change; also on quit. Setting to turn off.
- [x] **Text blocks.** Text tool, textarea overlay, wrap shared with the canvas.
- [x] **Images and attachments.** Toolbar or paste; stored as archive assets.
      Missing: resizing (needs selection scaling, see Tier 2).
- [x] **PDF import + annotation.** A dialog (`import/PdfImportDialog.svelte`)
      shows page thumbnails; pick pages by tapping or ranges ("1-3, 7"), then
      insert them as new pages (PDF page as background; after the current page
      or at the end) or as images on the current page. From the sidebar or the
      toolbar's insert button.
- [x] **Export.** Dedicated page (`routes/export/[id]`, Ctrl+E): all/current
      pages, the lasso selection, or **regions** saved on each page (a
      format such as A4 or free-form; drag to move/resize, drag handle to
      reorder, all undoable; "Cover content" tiles the drawing). PDF, PNG, JPG, SVG; resolution and "include paper" options.
      PDF is raster (JPEG); SVG is vector.
- [x] **Touch-only operation.** Undo/redo buttons and 2-/3-finger taps.
- [x] **Highlighter.** `Stroke.opacity`. Drawn over ink; a multiply blend would
      keep ink underneath crisper.

### Tier 2 — competitive

- [ ] Shapes and straightedge: hold-to-snap shapes (`shapes.ts`) and the
      ruler (`ruler.ts`) done; arrows still missing
- [x] Layer panel
- [x] Page navigator with real thumbnails, reorder, duplicate
- [x] Page overview (`PageOverview.svelte`, Ctrl+G or the page counter):
      grid of all pages, drag to move (grip, or anywhere with a mouse),
      select several to duplicate/delete/make a section, context menus.
- [x] Sections: a section is a run of consecutive pages with the same
      `Page.section` id; every page carries the name, so section edits are
      ordinary `pages` changes and undo works unchanged. Pure helpers in
      `lib/editor/sections.ts` (tested); `contentManager.restructure(label,
      fn)` applies one as an undo step and stays on the same page. A run
      split in two becomes two sections (`splitRepeats`). Folding is view
      state (`State.collapsed_sections`), not an undo step.
- [ ] Vertical-scroll mode (one continuously growing page)
- [x] Pen presets (saved colour + width, one-tap switch)
- [ ] Search across notes (the index carries titles only; `tags` has no UI)
- [ ] Stroke eraser vs pixel eraser; erase-by-lasso
- [ ] Selection transforms: move, scale, rotate, cross-page/cross-note paste
- [ ] Snapping, stroke stabilization (straight-line snap: hold at the end)
- [x] Hold-to-switch tools: the `barrel_button` setting (lasso, or eraser /
      highlighter while held)

### Presenter mode

F5 or the tab-bar button opens an `audience` window (`routes/present`) full
screen on a second display, or as a normal window to share in a video call.
OS *mirroring* cannot show different content on desktop, hence a separate
window on an *extended* display. The audience window renders only the page:
the root layout skips the app shell when the window label is `audience`. The
editor streams messages (`lib/present/protocol.ts`, coalesced per frame):
page per committed edit (with the asset session, so images load by URL),
view, live in-progress ink, laser.
Fit/Follow, Freeze and Blank live in `PresenterBar`. The laser tool is never
saved. On Wayland the compositor decides where the window opens.
Later: iPad/Android external displays need a native plugin (UIScene external
display role / Android `Presentation`).

### Tier 3 — beyond class

- [ ] Audio recording synced to strokes (tap a stroke, hear that moment)
- [ ] Mobile/tablet builds
- [ ] Sync (folder-based may be enough, given the file format)
- [ ] Templates: Cornell, graph, isometric, staff paper
- [ ] LaTeX blocks, shape/handwriting recognition
- [ ] Note linking and backlinks, custom themes

## Tech debt / known issues

Resolved in Nov 2026: the `cleanCache()` page/tab bug, viewport culling, the
manual redraw call sites, `Block` typing, the duplicated tool lists, one command
per setting, the missing format migration, and the `contentManager` ↔
`canvasManager` import cycle. Still open:

1. **History stores full before/after block arrays** per layer per entry.
   Stroke-level patches would be lighter and would make sync/merge feasible later.
2. **Text and images cannot be rotated.** Selections move, scale (corner
   handles, `scaleBlock`) and, with the `transform_anywhere` setting, rotate
   by a two-finger twist (`transformBlock`); ink rotates, but text and
   images have no stored rotation and stay upright.
3. **Text layout is measured with canvas `measureText`** and the editing
   `<textarea>` wraps with the browser's own algorithm; they agree closely but
   not perfectly for unusual text.
4. **Every page is still kept in the frontend** as JSON (strokes, text,
   asset ids). Attachments are not, but a note with thousands of strokes per
   page is loaded and saved whole.

## File problems

`get_notebooks` returns the folder tree **and** `problems`: files that could
not be indexed, classified by `common::io::index::FileProblem` (newer version,
unknown version, damaged, not a note, unreadable). They are listed on the
dashboard's Problems page (sidebar badge + home banner) with "Show in folder"
(opener plugin) and "Move to trash" (`trash_note_file`, which only accepts
`.rnpf` files inside the notebooks folder and uses the system trash).

## Notebook management

Notebooks have a context menu (`use:contextMenu` action: right-click, or a
long press with pen/touch; plus a ⋯ button) with Open, Rename, Move to folder,
Duplicate, Show in file manager and Move to trash; folders have Open and
Rename. Commands live in `commands/library.rs` and rewrite metadata with
`Rnpf::update_meta`, after checking the path is a note in the notebooks
folder. A notebook that is **open in a tab** is changed in the tab and saved
from there instead, or the tab's next save would undo the change. Folders
exist only as `Meta.folder` of the notes in them, so renaming a folder rewrites
every note below it (`rename_folder`).

## UI/UX issues

- **Dark paper** exists as a preset, but ink colours are not adapted to it and
  there is no invert-for-display mode that keeps exports white.
- **Thumbnails** render only once scrolled near the view, and are cached by
  page and content identity (`PageThumbnail.svelte`), shared by the side
  panel and the overview. An edited page still re-renders its thumbnail
  (debounced) as a whole.

## Conventions

- Import library code via `#lib/...` **with the file extension**
  (`#lib/tauri/bindings.ts`, `#lib/state/tabManager.svelte.ts`); it is a Node
  subpath import in `package.json`. `$lib` no longer exists in SvelteKit 3.
- `resolve()` takes route ids, which include route groups: home is
  `resolve("/(dashboard)")`, not `resolve("/")`.
- Runes (`$state`, `$state.snapshot`, ...) only in `.svelte` / `.svelte.ts`
  files. In a plain `.ts` file they type-check and build, then throw
  `rune_outside_svelte` at runtime; `src/lib/runes.test.ts` guards this.
- Rendering errors show `ErrorPanel` (a `<svelte:boundary>` in the editor
  layout and the app shell) instead of silently navigating away; other
  uncaught errors and rejected promises show a toast (`AppShell`).
- No `<style>` blocks in components; put shared CSS in `app.css` (Tailwind
  `@theme` / `@layer components`). Component style blocks become virtual CSS
  modules, and a stale webview after a dev-server restart could make Tailwind
  parse a whole `.svelte` file as CSS ("Invalid declaration").
- `specta`/`tauri-specta` are pinned to their current release candidates on
  purpose: newer ones type every `f32` as `number | null`.

- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) — not stores.
- Tailwind v4 with semantic tokens (`bg-base-1`, `text-content-2`, `fill-primary`),
  derived from Catppuccin Mocha. Do not hard-code palette hexes in components.
- Icons come from `@tabler/icons-svelte`.
- Interactive elements use `active:scale-95` / `active:scale-90` for feedback.
- UI that overlays the canvas must carry `data-ui="true"` so `isUIEvent()` in
  `canvasController` ignores it — only needed for elements _inside_ the
  `use:canvasController` element.
- The author writes all application code personally; AI is used for research and
  review, not wholesale code generation. Keep suggestions reviewable.
