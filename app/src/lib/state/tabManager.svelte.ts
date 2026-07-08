import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { NoteData } from "$lib/tauri/bindings";
import { contentManager } from "./contentManager.svelte";
import { overlayManager } from "./overlayManager.svelte";

type Tab = NoteData & { unsaved: boolean; path?: string };

class TabManager {
  #tabs = $state<Tab[]>([]);
  #activeTab = $state(-1);

  add(noteData: NoteData, setActive: boolean = false, path?: string) {
    const tabByID = this.#tabs.findIndex((t) => t.meta.id === noteData.meta.id);

    if (tabByID !== -1) {
      if (setActive) {
        this.#activeTab = tabByID;
        goto(resolve("/edit/[id]", { id: noteData.meta.id }));
      }
      return;
    }

    const l = this.#tabs.push({
      ...noteData,
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

    if (index === this.#activeTab) {
      const newIndex = Math.min(index, this.#tabs.length - 2); // -2 since one tab gets removed
      this.#activeTab = newIndex;
      contentManager.import(this.#tabs[newIndex]);
    } else if (index < this.#activeTab) {
      this.#activeTab--;
    }

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
    if (tabIndex === -1 || (tabIndex < this.#tabs.length && tabIndex >= 0)) {
      this.#tabs[this.#activeTab] = {
        ...contentManager.export(),
        unsaved: this.activeNote?.unsaved ?? false,
      };

      this.#activeTab = tabIndex;

      if (tabIndex !== -1) contentManager.import(this.activeNote!);
    }
  }

  setEdited() {
    const tab = this.#tabs[this.#activeTab];
    if (!tab) return;
    tab.unsaved = true;
    contentManager.updateEditDate();
  }

  get tabs() {
    return this.#tabs;
  }

  get tab(): Tab {
    return this.#tabs[this.#activeTab];
  }

  get current() {
    return this.#tabs[this.#activeTab];
  }
  set current(data: NoteData) {
    this.#tabs[this.#activeTab] = { ...data, unsaved: true };
  }

  set currentPath(path: string) {
    this.#tabs[this.#activeTab].path = path;
  }
}

export const tabManager = new TabManager();
