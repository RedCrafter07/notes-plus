import { sessionAssets } from "#lib/editor/assets.ts";
import { startSection } from "#lib/editor/sections.ts";
import { mergePages } from "#lib/editor/movePage.ts";
import { resizePage } from "#lib/editor/resizePage.ts";
import { commands, type ExportRegion, type Layer, type Page } from "#lib/tauri/bindings.ts";
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
      id: crypto.randomUUID(),
      // An imported PDF background and export regions belong to their page only.
      background_asset: null,
      regions: [],
      layers: [{ ...$state.snapshot(defaultsStore.store.layer), id: crypto.randomUUID(), blocks: [] }],
      name,
    };
  }

  /**
   * Inserts a page after `after` (default: the current page) and opens it.
   * It joins the section of the page before it.
   */
  public addPage(after = this.currentPage) {
    tabManager.transact("Add page", () => {
      const page = this.newPageAfter(after);
      const pages = this.pages.slice();
      pages.splice(after + 1, 0, page);
      this.pages = pages;
      this.currentPage = after + 1;
    });
  }

  /**
   * The empty page `addPage` would insert after `after`, without inserting
   * it: set up like that page (or the default, by the setting), in its
   * section.
   */
  public newPageAfter(after: number): Page {
    const source = settingsStore.store.use_last_page_settings ? this.pages[after] : undefined;
    return {
      ...this.#blankPage(source, `Page ${this.pages.length + 1}`),
      section: $state.snapshot(this.pages[after]?.section) ?? null,
    };
  }

  /**
   * Inserts ready-made pages (e.g. from a PDF) at index `at` (default: the
   * end) and opens the first of them. They join the section of the page
   * before them. One undo step.
   */
  public insertPages(newPages: Page[], at = this.pages.length, label = "Insert pages") {
    if (newPages.length === 0) return;
    const section = $state.snapshot(this.pages[at - 1]?.section) ?? null;
    tabManager.transact(label, () => {
      const pages = this.pages.slice();
      pages.splice(at, 0, ...newPages.map((p) => ({ ...p, id: crypto.randomUUID(), section })));
      this.pages = pages;
      this.currentPage = at;
    });
  }

  /** A copy of a page with fresh ids (pages, layers and blocks must stay unique). */
  #copyOf(src: Page): Page {
    return {
      ...$state.snapshot(src),
      id: crypto.randomUUID(),
      name: `${src.name} (copy)`,
      // Block ids key the render caches, so copies need their own.
      layers: src.layers.map((l) => ({
        ...$state.snapshot(l),
        id: crypto.randomUUID(),
        blocks: l.blocks.map((b) => ({ ...$state.snapshot(b), id: crypto.randomUUID() })),
      })),
      regions: src.regions.map((r) => ({ ...$state.snapshot(r), id: crypto.randomUUID() })),
    };
  }

  public duplicatePage(i: number) {
    const src = this.pages[i];
    if (!src) return;

    tabManager.transact("Duplicate page", () => {
      const copy = this.#copyOf(src);
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

  /**
   * Replaces the pages with `fn(pages)` as one undo step, staying on the
   * same page (by id) if it still exists. For reordering, sections and
   * other edits of the page list as a whole (see `editor/sections.ts`).
   */
  public restructure(label: string, fn: (pages: Page[]) => Page[]) {
    const current = this.page?.id;
    tabManager.transact(label, () => {
      const pages = fn(this.pages);
      if (pages === this.pages) return;
      this.pages = pages;
      const i = pages.findIndex((p) => p.id === current);
      this.currentPage = i === -1 ? Math.min(this.currentPage, pages.length - 1) : i;
    });
  }

  /** Adds a blank page at the end, as the first page of a new section. */
  public addSection(name: string) {
    tabManager.transact("Add section", () => {
      this.addPage(this.pages.length - 1);
      const i = this.pages.length - 1;
      this.pages = startSection(this.pages, i, name);
      this.currentPage = i;
    });
  }

  /** Deletes several pages in one step (keeping at least one page). */
  public deletePages(indices: number[], label?: string) {
    const gone = new Set(indices);
    this.restructure(label ?? (gone.size === 1 ? "Delete page" : "Delete pages"), (pages) => {
      const rest = pages.filter((_, i) => !gone.has(i));
      return rest.length ? rest : [this.#blankPage(pages[0], "Page 1")];
    });
  }

  /**
   * Merges several pages into the first of them, in one step (see
   * `mergePages`), and opens it.
   */
  public mergePages(indices: number[]) {
    const first = Math.min(...indices);
    const id = this.pages[first]?.id;
    if (indices.length < 2 || !id) return;
    this.restructure("Merge pages", (pages) => mergePages(pages, indices, () => crypto.randomUUID()));
    const i = this.pages.findIndex((p) => p.id === id);
    if (i >= 0) this.currentPage = i;
  }

  /** Duplicates several pages, each copy right after the last of them. */
  public duplicatePages(indices: number[]) {
    const sorted = [...indices].sort((a, b) => a - b);
    if (sorted.length === 0) return;
    this.restructure(sorted.length === 1 ? "Duplicate page" : "Duplicate pages", (pages) => {
      const copies = sorted.map((i) => this.#copyOf(pages[i]));
      const out = pages.slice();
      out.splice(sorted.at(-1)! + 1, 0, ...copies);
      return out;
    });
  }

  /** Whether a section is folded away in the page list and overview. */
  public isCollapsed(section: string) {
    return this.#note.state.collapsed_sections?.includes(section) ?? false;
  }

  /** Folds or unfolds a section. View state, like zoom: not an undo step. */
  public toggleSection(section: string) {
    const list = this.#note.state.collapsed_sections ?? [];
    this.#note.state.collapsed_sections = list.includes(section)
      ? list.filter((s) => s !== section)
      : [...list, section];
  }

  /** Applies page setup to one page, or to every page with `all`. */
  public setPageProps(i: number | "all", props: PageProps, label = "Page setup") {
    tabManager.transact(label, () => {
      this.pages = this.pages.map((p, j) =>
        i === "all" || i === j ? { ...p, ...props } : p,
      );
    });
  }

  /** Scales pages and everything on them by `k` (one undo step, see resizePage.ts). */
  public resizePages(indices: number[], k: number) {
    const which = new Set(indices);
    this.restructure(which.size === 1 ? "Scale page" : "Scale pages", (pages) =>
      pages.map((p, i) => (which.has(i) ? resizePage(p, k) : p)),
    );
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

  /** Asset id -> URL, for the active tab's attachments. */
  get assets() {
    return sessionAssets(tabManager.tab?.assets ?? "none");
  }

  /**
   * Hands new binary data (as a data URL) to the backend once and returns its
   * asset id; from then on it is loaded by URL (see `editor/assets.ts`).
   * `null` if it could not be stored (the backend has said why). Pass the
   * tab explicitly from async flows that may outlive a tab switch.
   */
  async addAsset(dataUrl: string, tab = tabManager.tab): Promise<string | null> {
    if (!tab) return null;
    const id = crypto.randomUUID();
    return (await commands.addAsset(tab.assets, id, dataUrl)) ? id : null;
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
