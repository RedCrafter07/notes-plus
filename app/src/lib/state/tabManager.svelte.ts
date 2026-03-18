import type { NoteData } from "$lib/tauri/bindings";
import { contentManager } from "./contentManager.svelte";

class TabManager {
  #tabs = $state<NoteData[]>([]);
  #activeTab = $state(-1);

  add(noteData: NoteData, setActive: boolean = false) {
    const l = this.#tabs.push(noteData);

    if (setActive) {
      this.activeTab = l - 1;
    }
  }

  async remove(index: number) {
    this.#tabs.splice(index, 1);
  }

  get activeTab() {
    return this.#activeTab;
  }

  set activeTab(tabIndex: number) {
    if (tabIndex < this.#tabs.length && tabIndex >= 0) {
      this.#tabs[this.#activeTab] = contentManager.export();

      this.#activeTab = tabIndex;

      contentManager.import(tabManager.tabs[tabManager.activeTab]);
    }
  }

  get tabs() {
    return this.#tabs;
  }
}

export const tabManager = new TabManager();
