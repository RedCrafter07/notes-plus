import type { ExportRegion, Layer, Page } from "$lib/tauri/bindings";
import { defaultsStore } from "./defaultsStore.svelte";
import { settingsStore } from "./settingsStore.svelte";
import { tabManager } from "./tabManager.svelte";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;

/** Page fields that page setup may change. */
export type PageProps = Partial<
  Pick<
    Page,
    | "width"
    | "height"
    | "pattern"
    | "pattern_scale"
    | "pattern_color"
    | "background_color"
    | "name"
  >
>;

/**
 * A view onto the active tab's note.
 *
 * Structural edits (pages, layers) never mutate a page or layer list in
 * place: they assign a new object. That is what lets history record them as a
 * cheap before/after pair of references; see `historyManager`.
 */
class ContentManager {
  public updateEditDate() {
    this.#note.meta.edited_at = Math.floor(Date.now() / 1000).toString();
  }

  // ------------------------------------------------------------------ pages

  /** A blank page in the style of `source` (or the defaults). */
  #blankPage(source: Page | undefined, name: string): Page {
    const base = source ?? $state.snapshot(defaultsStore.store.page);
    return {
      ...$state.snapshot(base),
      // An imported PDF background and export regions belong to their page only.
      background_asset: null,
      regions: [],
      layers: [{ ...$state.snapshot(defaultsStore.store.layer), id: crypto.randomUUID(), blocks: [] }],
      name,
    };
  }

  /** Inserts a page after `after` (default: the current page) and opens it. */
  public addPage(after = this.currentPage) {
    const source =
      settingsStore.store.use_last_page_settings ? this.pages[after] : undefined;

    tabManager.transact("Add page", () => {
      const page = this.#blankPage(source, `Page ${this.pages.length + 1}`);
      const pages = this.pages.slice();
      pages.splice(after + 1, 0, page);
      this.pages = pages;
      this.currentPage = after + 1;
    });
  }

  /** Appends ready-made pages (e.g. from a PDF) and opens the first one. */
  public appendPages(newPages: Page[], label = "Insert pages") {
    if (newPages.length === 0) return;
    tabManager.transact(label, () => {
      const first = this.pages.length;
      this.pages = [...this.pages, ...newPages];
      this.currentPage = first;
    });
  }

  public duplicatePage(i: number) {
    const src = this.pages[i];
    if (!src) return;

    tabManager.transact("Duplicate page", () => {
      const copy: Page = {
        ...$state.snapshot(src),
        name: `${src.name} (copy)`,
        // Layer ids must be unique, block ids too (they key the render cache).
        layers: src.layers.map((l) => ({
          ...$state.snapshot(l),
          id: crypto.randomUUID(),
          blocks: l.blocks.map((b) => ({ ...$state.snapshot(b), id: crypto.randomUUID() })),
        })),
        regions: src.regions.map((r) => ({ ...$state.snapshot(r), id: crypto.randomUUID() })),
      };
      const pages = this.pages.slice();
      pages.splice(i + 1, 0, copy);
      this.pages = pages;
      this.currentPage = i + 1;
    });
  }

  public deletePage(i: number) {
    tabManager.transact("Delete page", () => {
      const pages = this.pages.filter((_, j) => j !== i);
      if (pages.length === 0) pages.push(this.#blankPage(this.page, "Page 1"));

      const current = this.currentPage;
      this.pages = pages;
      this.currentPage =
        i < current ? current - 1 : Math.min(current, pages.length - 1);
    });
  }

  public movePage(from: number, to: number) {
    if (from === to || to < 0 || to >= this.pages.length) return;

    tabManager.transact("Move page", () => {
      const pages = this.pages.slice();
      const [page] = pages.splice(from, 1);
      pages.splice(to, 0, page);
      const current = this.page;
      this.pages = pages;
      this.currentPage = pages.indexOf(current);
    });
  }

  /** Applies page setup to one page, or to every page with `all`. */
  public setPageProps(i: number | "all", props: PageProps, label = "Page setup") {
    tabManager.transact(label, () => {
      this.pages = this.pages.map((p, j) =>
        i === "all" || i === j ? { ...p, ...props } : p,
      );
    });
  }

  /** Replaces a page's export regions (one undo step). */
  public setRegions(i: number, regions: ExportRegion[], label = "Edit export regions") {
    if (!this.pages[i]) return;
    tabManager.transact(label, () => {
      this.pages = this.pages.map((p, j) => (j === i ? { ...p, regions } : p));
    });
  }

  // ----------------------------------------------------------------- layers

  #replaceLayers(label: string, fn: (layers: Layer[]) => Layer[]) {
    const i = this.currentPage;
    tabManager.transact(label, () => {
      this.pages = this.pages.map((p, j) =>
        j === i ? { ...p, layers: fn(p.layers.slice()) } : p,
      );
    });
  }

  public addLayer() {
    const n = this.layers.length + 1;
    this.#replaceLayers("Add layer", (layers) => [
      ...layers,
      {
        id: crypto.randomUUID(),
        name: `Layer ${n}`,
        blocks: [],
        visible: true,
        locked: false,
      },
    ]);
    this.activeLayer = this.layers.length - 1;
  }

  public deleteLayer(index: number) {
    if (this.layers.length <= 1) return;
    this.#replaceLayers("Delete layer", (layers) =>
      layers.filter((_, j) => j !== index),
    );
    if (this.activeLayer >= this.layers.length)
      this.activeLayer = this.layers.length - 1;
  }

  public moveLayer(from: number, to: number) {
    if (to < 0 || to >= this.layers.length) return;
    const active = this.layers[this.activeLayer];
    this.#replaceLayers("Move layer", (layers) => {
      const [l] = layers.splice(from, 1);
      layers.splice(to, 0, l);
      return layers;
    });
    this.activeLayer = this.layers.indexOf(active);
  }

  /** Rename, hide or lock a layer. */
  public setLayerProps(
    index: number,
    props: Partial<Pick<Layer, "name" | "visible" | "locked">>,
  ) {
    this.#replaceLayers("Layer settings", (layers) =>
      layers.map((l, j) => (j === index ? { ...l, ...props } : l)),
    );
  }

  // ---------------------------------------------------------------- getters

  get size(): { width: number; height: number } | "Infinite" {
    const { width, height } = this.page;
    if (width < 0 || height < 0) return "Infinite";
    return { width, height };
  }

  get layers() {
    return this.page.layers;
  }

  get editedAt() {
    return this.#note.meta.edited_at;
  }

  get createdAt() {
    return this.#note.meta.created_at;
  }

  get id() {
    return this.#note.meta.id;
  }
  set id(newID) {
    this.#note.meta.id = newID;
  }

  get activeLayer() {
    return Math.min(this.#note.state.current_layer, this.layers.length - 1);
  }

  set activeLayer(i: number) {
    if (i >= 0 && i < this.layers.length) this.#note.state.current_layer = i;
  }

  get currentPage() {
    return this.#note.state.current_page;
  }

  set currentPage(page: number) {
    if (page >= 0 && page < this.pages.length) {
      if (page !== this.#note.state.current_page)
        this.#note.state.current_layer = 0;
      this.#note.state.current_page = page;
    }
  }

  /** Gets the active page */
  get page() {
    return this.pages[this.currentPage] ?? this.pages[0];
  }

  get pages() {
    return this.#note.content.pages;
  }

  set pages(pages: Page[]) {
    this.#note.content.pages = pages;
  }

  get assets() {
    return this.#note.assets;
  }

  /** Stores binary data (as a data URL) and returns its asset id. */
  addAsset(dataUrl: string) {
    const id = crypto.randomUUID();
    this.#note.assets[id] = dataUrl;
    return id;
  }

  get zoom() {
    return this.#note.state.zoom;
  }

  set zoom(input: number) {
    this.#note.state.zoom = Math.min(Math.max(input, MIN_ZOOM), MAX_ZOOM);
  }

  get panX() {
    return this.#note.state.pan_x;
  }
  get panY() {
    return this.#note.state.pan_y;
  }
  set panX(x: number) {
    this.#note.state.pan_x = x;
  }
  set panY(y: number) {
    this.#note.state.pan_y = y;
  }

  get folder() {
    return this.#note.meta.folder;
  }

  set folder(folder: string | null) {
    if (folder === this.#note.meta.folder) return;
    this.#note.meta.folder = folder;
    tabManager.setEdited();
  }

  get #note() {
    return tabManager.note;
  }
  get title() {
    return this.#note.meta.title ?? "New Note";
  }
  set title(t: string) {
    this.#note.meta.title = t;
    tabManager.setEdited();
  }

  get tags() {
    return this.#note.meta.tags;
  }
  set tags(t) {
    this.#note.meta.tags = t;
  }
}

export const contentManager = new ContentManager();
