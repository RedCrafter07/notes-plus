import type {
  Block,
  Note,
  NoteData,
  Page,
  State,
  Stroke,
} from "$lib/tauri/bindings";

class ContentManager {
  #id: string = $state(crypto.randomUUID());
  tags: string[] = $state([]);
  title: string = $state("New Notebook");
  #path: string | null = $state(null);
  #createdAt: number = Math.floor(Date.now() / 1000);
  #editedAt: number = Math.floor(Date.now() / 1000);
  #pages: Page[] = $state([]);

  #activePage = $state(0); // first page
  #activeLayer = $state(0); // 0 is the bottom layer

  zoom = $state(1);
  panX = $state(0);
  panY = $state(0);

  public import(data: NoteData) {
    const { content: note, id, path, state } = data;
    this.title = note.title;
    this.#createdAt = note.created_at;
    this.#editedAt = note.edited_at;
    this.tags = note.tags;
    if (id) this.#id = id;
    if (path) this.#path = path;

    this.zoom = state.zoom;
    this.panX = state.pan_x;
    this.panY = state.pan_y;
    this.#activeLayer = state.current_layer;
    this.#activePage = state.current_page;

    this.#pages = note.pages;
  }

  public updateEditDate() {
    this.#editedAt = Math.floor(Date.now() / 1000);
  }

  public export(): NoteData {
    const content: Note = {
      pages: this.#pages,
      created_at: this.#createdAt,
      edited_at: Math.floor(Date.now() / 1000),
      tags: this.tags,
      title: this.title,
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
      path: this.#path,
      state,
    };
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

  get path() {
    return this.#path;
  }

  get activeLayer() {
    return this.#activeLayer;
  }

  get activePage() {
    return this.#activePage;
  }
}

export const contentManager = new ContentManager();
