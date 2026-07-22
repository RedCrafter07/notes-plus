import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import type { Page } from "$lib/tauri/bindings";
import { defaultsStore } from "./defaultsStore.svelte";
import { overlayManager } from "./overlayManager.svelte";
import { settingsStore } from "./settingsStore.svelte";
import { tabManager } from "./tabManager.svelte";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;

class ContentManager {
  #pages: Page[] = $derived(this.#note.content.pages);

  public updateEditDate() {
    this.#note.meta.edited_at = Math.floor(Date.now() / 1000).toString();
  }

  public addNewPage(forceDefault: boolean = false, total = this.pages.length) {
    const settingsSource =
      settingsStore.store.use_last_page_settings && !forceDefault
        ? this.activePage
        : defaultsStore.store.page;

    const newPage = {
      ...settingsSource,
      layers: [$state.snapshot(defaultsStore.store.layer)], // when using defaultsStore.store.layer directly, the new layer gets bound to the default value, which is not what is expected here
      name: `Page ${total + 1}`,
    };

    this.pages.push(newPage);
    this.currentPage = total;
  }

  public deletePage(i: number) {
    if (this.#pages.length === 1) {
      this.addNewPage(false, 0);
    } else {
      if (i === this.currentPage) {
        const newIndex = Math.min(i, this.#pages.length - 2);
        this.currentPage = newIndex;
      } else if (i < this.currentPage) {
        this.currentPage--;
      }
    }

    this.pages.splice(i, 1);
    canvasManager.redrawStrokes();
    overlayManager.close();
  }

  get size(): { width: number; height: number } | "Infinite" {
    const { width, height } = this.activePage;
    if (width < 0 || height < 0) return "Infinite";
    return { width, height };
  }

  get layers() {
    return this.activePage.layers;
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
    return this.#note.state.current_layer;
  }

  get currentPage() {
    return this.#note.state.current_page;
  }

  set currentPage(page: number) {
    if (page >= 0 && page < this.#pages.length)
      this.#note.state.current_page = page;
  }

  get activePage() {
    return this.#pages[this.currentPage];
  }

  get pages() {
    return this.#note.content.pages;
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
    if (tabManager.note.meta.id === this.#note.meta.id) {
      tabManager.setEdited();
    }
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
