import type { Block, Note, Stroke } from "$lib/tauri/bindings";

class ContentManager {
  #strokes: Stroke[] = $state([]);
  #id: string = crypto.randomUUID();
  tags: string[] = $state([]);
  title: string = $state("New Notebook");
  #path: string | undefined = $state(undefined);
  #createdAt: number = Math.floor(Date.now() / 1000);
  #editedAt: number = Math.floor(Date.now() / 1000);

  public import(
    note: Note,
    meta: Partial<{
      id: string;
      path: string;
    }>,
  ) {
    this.#strokes = note.blocks
      .filter((b) => Object.keys(b).includes("Stroke"))
      .map((b) => b.Stroke);

    this.title = note.title;
    this.#createdAt = note.created_at;
    this.#editedAt = note.edited_at;
    this.tags = note.tags;
    if (meta.id) this.#id = meta.id;
    if (meta.path) this.#path = meta.path;

    this.#id = crypto.randomUUID();
  }

  public updateEditDate() {
    this.#editedAt = Math.floor(Date.now() / 1000);
  }

  public export(): Note {
    const blocks: Block[] = [
      ...this.strokes.map(
        (s) =>
          ({
            Stroke: s,
          }) as Block,
      ),
    ];

    return {
      blocks,
      created_at: this.#createdAt,
      edited_at: Math.floor(Date.now() / 1000),
      tags: this.tags,
      title: this.title,
    };
  }

  get strokes() {
    return this.#strokes;
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

  set strokes(strokes: Stroke[]) {
    this.updateEditDate();

    this.#strokes = strokes;
  }
}

export const contentManager = new ContentManager();
