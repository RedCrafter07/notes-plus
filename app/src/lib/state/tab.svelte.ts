import type { NoteData } from "$lib/tauri/bindings";
import { HistoryManager } from "./historyManager.svelte";

export class Tab {
  note = $state<NoteData>()!;
  path = $state<string>();
  history = new HistoryManager();
  #otherEdits = $state(false);

  constructor(data: NoteData, path?: string) {
    this.note = data;
    this.path = path;
  }

  get unsaved() {
    return this.#otherEdits || this.history.isDirty;
  }

  markEdited() {
    this.#otherEdits = true;
  }
  markSaved() {
    this.#otherEdits = false;
    this.history.markSaved();
  }
}
