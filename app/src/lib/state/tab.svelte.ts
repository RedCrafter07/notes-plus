import type { NoteData } from "#lib/tauri/bindings.ts";
import { HistoryManager } from "./historyManager.svelte";

/** What was saved: compared against the live state to decide "unsaved". */
export interface SaveToken {
  edits: number;
  content: number;
}

export class Tab {
  note = $state<NoteData>()!;
  path = $state<string>();
  history = new HistoryManager();
  /** True while a save of this tab is in flight. */
  saving = false;
  /** Counts edits history does not track (title, folder). */
  #edits = $state(0);
  #savedEdits = $state(0);

  constructor(data: NoteData, path?: string) {
    this.note = data;
    this.path = path;
  }

  get unsaved() {
    return this.#edits !== this.#savedEdits || this.history.isDirty;
  }

  /** Changes whenever anything that gets saved changes. Autosave watches it. */
  get version() {
    return `${this.#edits}:${this.history.contentId}`;
  }

  markEdited() {
    this.#edits++;
  }

  /**
   * Take this *before* an async save starts, and pass it to `markSaved` when
   * the save finishes. Edits made while the file was being written then stay
   * unsaved instead of being silently marked as saved.
   */
  saveToken(): SaveToken {
    return { edits: this.#edits, content: this.history.contentId };
  }

  markSaved(token: SaveToken = this.saveToken()) {
    this.#savedEdits = token.edits;
    this.history.markSaved(token.content);
  }
}
