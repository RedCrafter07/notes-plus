import { goto } from "$app/navigation";
import { CanvasManager } from "$lib/canvas/CanvasManager.svelte";
import { PageManager } from "$lib/canvas/PageManager.svelte";
import type { FileMeta } from "$lib/types/bindings/FileMeta";
import type { Note } from "$lib/types/bindings/Note";
import type { Tab } from "$lib/types/tabs";
import { invoke } from "@tauri-apps/api/core";

class TabManager {
  #tabs: Tab[] = $state([]);
  #tabNotes: { id: string; canvas: CanvasManager; page: PageManager }[] =
    $state([]);
  #viewport: { width: number; height: number } = $state({
    width: 0,
    height: 0,
  });

  #currentTab = $state(-1);

  public async loadFile(
    path: string,
    newTab: boolean = true,
    go: boolean = true,
  ) {
    const data: FileMeta = JSON.parse(await invoke("read", { path }));

    if (newTab) {
      this.addTab(
        {
          data: data.note,
          path,
        },
        go,
      );

      if (go) {
        goto("/edit");
      }
    }

    return data;
  }

  public addTab(
    file: { data: Note; path: string } | "new",
    go: boolean = true,
  ) {
    let id: string;
    if (file === "new") {
      id = crypto.randomUUID();
      this.#tabs.push({
        id,
        openedAt: Date.now(),
        saved: false,
        path: null,
      });

      const pageManager = new PageManager();
      const canvasManager = new CanvasManager(this.#viewport);
      canvasManager.setPage(
        pageManager.currentPage,
        pageManager.currentPageIndex,
      );
      this.#tabNotes.push({ id, page: pageManager, canvas: canvasManager });
    } else {
      const { data, path } = file;
      id = data.metadata.id;

      if (this.#tabs.findIndex((t) => t.id === id) >= 0) return;

      this.#tabs.push({
        id,
        openedAt: Date.now(),
        saved: true,
        path,
      });

      const pageManager = new PageManager();
      const canvasManager = new CanvasManager(this.#viewport);

      pageManager.import(data, canvasManager);

      this.#tabNotes.push({ page: pageManager, canvas: canvasManager, id });
    }

    if (go) this.#currentTab = this.#tabs.length - 1;
    else if (this.#currentTab < 0) this.#currentTab = 0;
  }

  public tabInfo(id: string) {
    const tabIndex = this.#tabs.findIndex((t) => t.id === id);

    if (tabIndex < 0) return null;

    const tab = this.#tabs[tabIndex];
    const note = this.#tabNotes[tabIndex];

    if (!tab || !note) {
      return null;
    }

    return {
      ...note.page.meta,
      saved: tab.saved,
      current: tabIndex === this.#currentTab,
    };
  }

  public deleteTab(index: number) {
    if (!this.validateIndex(index)) return;

    if (this.#currentTab === this.#tabs.length - 1) this.#currentTab--;
    else if (this.#currentTab < this.#tabs.length) this.#currentTab++;

    if (index < this.#currentTab) {
      this.#currentTab--;
    }

    this.#tabNotes.splice(index, 1);
    this.#tabs.splice(index, 1);
  }

  public setViewport(width: number, height: number, offset?: number) {
    this.#viewport = { width, height };

    this.#tabNotes.forEach((t) => {
      t.canvas.setViewport(width, height);
      if (offset) t.canvas.setOffset(offset);
    });
  }

  public unsetSelection() {
    this.#currentTab = -1;
  }

  public get currentPage() {
    return this.#tabNotes[this.#currentTab];
  }

  public get currentTab(): Tab {
    if (this.#currentTab === -1) {
      const tab: Tab = { id: "", openedAt: 0, path: "", saved: true };
      goto("/");
      return tab;
    }

    return this.tabs[this.#currentTab];
  }

  public get tabs(): readonly Tab[] {
    return this.#tabs;
  }

  public set currentTab(index: number) {
    if (!this.validateIndex(index)) return;

    this.#currentTab = index;
  }

  private validateIndex(index: number): boolean {
    return index >= 0 && index < this.#tabs.length;
  }
}

export const tabManager = new TabManager();
