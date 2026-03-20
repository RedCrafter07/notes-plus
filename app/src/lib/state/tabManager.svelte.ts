import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { NoteData } from "$lib/tauri/bindings";
import { contentManager } from "./contentManager.svelte";

class TabManager {
  #tabs = $state<(NoteData & { unsaved: boolean })[]>([]);
  #activeTab = $state(-1);

  add(noteData: NoteData, setActive: boolean = false) {
    const l = this.#tabs.push({
      ...noteData,
      unsaved: false,
    });

    if (setActive) {
      this.activeTab = l - 1;
      goto(resolve("/edit/[id]", { id: noteData.id }));
    }
  }

  remove(index: number, force = false) {
    if (this.activeNote?.unsaved && !force) {
      return;
    }
    this.#activeTab--;
    if (this.#activeTab === -1) goto(resolve("/"));
    this.#tabs.splice(index, 1);
  }

  get activeTab() {
    return this.#activeTab;
  }

  get activeNote() {
    if (this.#activeTab === -1) return null;
    return this.#tabs[this.#activeTab];
  }

  set activeTab(tabIndex: number) {
    if (tabIndex < this.#tabs.length && tabIndex >= 0) {
      this.#tabs[this.#activeTab] = {
        ...contentManager.export(),
        unsaved: this.activeNote?.unsaved ?? false,
      };

      this.#activeTab = tabIndex;

      contentManager.import(this.activeNote!);
    }
  }

  setEdited() {
    this.#tabs[this.#activeTab].unsaved = true;
  }

  get tabs() {
    return this.#tabs;
  }
}

export const tabManager = new TabManager();
