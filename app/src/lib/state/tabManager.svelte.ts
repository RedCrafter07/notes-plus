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
    const l = this.#tabs.push({
      ...noteData,
      unsaved: false,
      path,
    });

    if (setActive) {
      this.activeTab = l - 1;
      goto(resolve("/edit/[id]", { id: noteData.id }));
    }
  }

  remove(index: number, force = false) {
    if (this.activeNote?.unsaved && !force) {
      overlayManager.setOpen(`unsaved-${index}`);
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
    this.#tabs[this.#activeTab].unsaved = true;
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
