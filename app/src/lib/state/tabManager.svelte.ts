import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { NoteData } from "$lib/tauri/bindings";
import { contentManager } from "./contentManager.svelte";
import { EMPTY_NOTE } from "./defaultsStore.svelte";
import { overlayManager } from "./overlayManager.svelte";

type Tab = { note: NoteData; unsaved: boolean; path?: string };

class TabManager {
  #tabs = $state<Tab[]>([]);
  #activeTab = $state(-1);

  add(noteData: NoteData, setActive: boolean = false, path?: string) {
    const tabByID = this.#tabs.findIndex(
      (t) => t.note.meta.id === noteData.meta.id,
    );

    if (tabByID !== -1) {
      if (setActive) {
        this.activeTab = tabByID;
        goto(resolve("/edit/[id]", { id: noteData.meta.id }));
      }
      return;
    }

    const l = this.#tabs.push({
      note: noteData,
      unsaved: false,
      path,
    });

    if (setActive) {
      this.activeTab = l - 1;
      goto(resolve("/edit/[id]", { id: noteData.meta.id }));
    }
  }

  remove(index: number, force = false) {
    if (this.#tabs[index]?.unsaved && !force) {
      overlayManager.setOpen(`unsaved-${index}`);
      return;
    }

    const wasActive = index === this.#activeTab;
    if (index < this.#activeTab) {
      this.#activeTab--;
    }

    this.#tabs.splice(index, 1);

    if (wasActive) {
      const newIndex = Math.min(index, this.#tabs.length - 1);
      this.#activeTab = newIndex;
    }

    if (this.#activeTab === -1) goto(resolve("/"));
  }

  get activeTab() {
    return this.#activeTab;
  }

  set activeTab(tabIndex: number) {
    if (tabIndex === -1 || (tabIndex < this.#tabs.length && tabIndex >= 0)) {
      this.#activeTab = tabIndex;
    }
  }

  /** Mark the active tab as edited */
  setEdited() {
    const tab = this.#tabs[this.#activeTab];
    if (!tab) return;
    tab.unsaved = true;
    contentManager.updateEditDate();
  }

  get tabs() {
    return this.#tabs;
  }

  /** Gets the entire active tab data */
  get tab(): Tab {
    return this.#tabs[this.#activeTab];
  }

  /** Gets the note of the active tab */
  get note() {
    return this.#tabs[this.#activeTab]?.note ?? EMPTY_NOTE;
  }

  set currentPath(path: string) {
    this.#tabs[this.#activeTab].path = path;
  }
}

export const tabManager = new TabManager();
