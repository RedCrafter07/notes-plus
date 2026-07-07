import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import type { Note, NoteData, Page, State } from "$lib/tauri/bindings";
import { defaultsStore } from "./defaultsStore.svelte";
import { overlayManager } from "./overlayManager.svelte";
import { settingsStore } from "./settingsStore.svelte";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;

class ContentManager {
  #id: string = $state(crypto.randomUUID());
  tags: string[] = $state([]);
  title: string = $state("New Notebook");
  #createdAt: string = Math.floor(Date.now() / 1000).toString();
  #editedAt: string = Math.floor(Date.now() / 1000).toString();
  #pages: Page[] = $state([]);
  folder = $state<string | null>(null);

  #activePage = $state(0); // first page
  #activeLayer = $state(0); // 0 is the bottom layer

  #zoom = $state(1);
  panX = $state(0);
  panY = $state(0);

  public import(data: NoteData) {
    const { content: note, id, state } = data;
    this.title = note.title;
    this.#createdAt = note.created_at;
    this.#editedAt = note.edited_at;
    this.tags = note.tags;
    if (id) this.#id = id;

    this.zoom = state.zoom;
    this.panX = state.pan_x;
    this.panY = state.pan_y;
    this.#activeLayer = state.current_layer;
    this.#activePage = state.current_page;

    this.#pages = note.pages;

    if (note.folder !== undefined) this.folder = note.folder;
  }

  public updateEditDate() {
    this.#editedAt = Math.floor(Date.now() / 1000).toString();
  }

  public export(): NoteData {
    const content: Note = {
      pages: this.#pages,
      created_at: this.#createdAt,
      edited_at: this.#editedAt,
      tags: this.tags,
      title: this.title,
      folder: this.folder,
    };

    const state: State = {
      current_layer: this.#activeLayer,
      current_page: this.#activePage,
      pan_x: this.panX,
      pan_y: this.panY,
      zoom: this.zoom,
    };

    return {
      content,
      id: this.#id,
      state,
    };
  }

  public addNewPage(forceDefault: boolean = false, total = this.pages.length) {
    const settingsSource =
      settingsStore.store.use_last_page_settings && !forceDefault
        ? this.currentPage
        : defaultsStore.store.page;

    const newPage = {
      ...settingsSource,
      layers: [$state.snapshot(defaultsStore.store.layer)], // when using defaultsStore.store.layer directly, the new layer gets bound to the default value, which is not what is expected here
      name: `Page ${total + 1}`,
    };

    console.log(newPage);

    this.pages.push(newPage);
    this.activePage = total;
  }

  public deletePage(i: number) {
    if (this.#pages.length === 1) {
      this.addNewPage(false, 0);
    } else {
      if (i === this.#activePage) {
        const newIndex = Math.min(i, this.#pages.length - 2);
        this.activePage = newIndex;
      } else if (i < this.#activePage) {
        this.#activePage--;
      }
    }

    this.pages.splice(i, 1);
    canvasManager.redrawStrokes();
    overlayManager.close();
  }

  get size(): { width: number; height: number } | "Infinite" {
    const { width, height } = this.#pages[this.#activePage];
    if (width < 0 || height < 0) return "Infinite";
    return { width, height };
  }

  get layers() {
    return this.#pages[this.#activePage].layers;
  }

  get editedAt() {
    return this.#editedAt;
  }

  get createdAt() {
    return this.#createdAt;
  }

  get id() {
    return this.#id;
  }

  set id(id: string) {
    this.#id = id;
  }

  get activeLayer() {
    return this.#activeLayer;
  }

  get activePage() {
    return this.#activePage;
  }

  set activePage(page: number) {
    if (page >= 0 && page < this.#pages.length) this.#activePage = page;
  }

  get currentPage() {
    return this.#pages[this.#activePage];
  }

  get pages() {
    return this.#pages;
  }

  get zoom() {
    return this.#zoom;
  }

  set zoom(input: number) {
    this.#zoom = Math.min(Math.max(input, MIN_ZOOM), MAX_ZOOM);
  }
}

export const contentManager = new ContentManager();
