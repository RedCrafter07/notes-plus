import type { Metadata } from "$lib/types/bindings/Metadata";
import type { Note } from "$lib/types/bindings/Note";
import { Page } from "./Page.svelte";
import type { Page as PageData } from "$lib/types/bindings/Page";
import type { LastState } from "$lib/types/bindings/LastState";
import type { ToolSettings } from "$lib/types/canvas";
import { BlockManager, penDefaults } from "./BlockManager.svelte";
import type { CanvasManager } from "./CanvasManager.svelte";

export class PageManager {
  #meta: Metadata = $state({
    createdAt: `${Date.now()}`,
    lastModified: `${Date.now()}`,
    tags: [],
    title: "New Note",
    id: crypto.randomUUID(),
  });
  #state = $state<LastState>({
    lastLayer: 0,
    lastPage: 0,
    position: [0, 0],
    zoom: 100,
  });
  #pages: Page[] = $state([new Page()]);
  #tool: ToolSettings = penDefaults;

  constructor(pages?: PageData[], state?: LastState, meta?: Metadata) {
    if (pages) this.#pages = pages.map((p) => new Page(p));
    if (state) this.#state = state;
    if (meta) this.#meta = meta;
  }

  public input(x: number, y: number, pressure: number) {
    this.currentPage.layerManager.inputLocked = false;
    this.currentPage.layerManager.input(x, y, pressure);
  }

  public lockInput() {
    this.currentPage.layerManager.inputLocked = true;
  }

  public unlockInput() {
    this.currentPage.layerManager.inputLocked = false;
  }

  public finishInput() {
    this.currentPage.layerManager.finishInput();
  }

  public import(data: Note, canvasManager?: CanvasManager) {
    const { lastState, metadata, pages } = data;

    this.#pages = pages.map((p) => new Page(p));
    this.#meta = metadata;
    this.#state = lastState;

    if (canvasManager) {
      canvasManager.import(lastState);
      canvasManager.setPage(this.currentPage, this.currentPageIndex);
    }
  }

  public get currentPage() {
    return this.#pages[this.#state.lastPage];
  }

  public get currentPageIndex() {
    return this.#state.lastPage;
  }
  public set currentPageIndex(value: number) {
    const newCurrentPage = this.#pages[value];
    if (!newCurrentPage) return;

    this.#state.lastPage = value;

    const { type, ...options } = this.#tool;
    newCurrentPage.layerManager.changeTool(type as any, options);
  }

  public changeTool(
    ...args: Parameters<typeof BlockManager.prototype.changeTool>
  ) {
    const [tool, toolSettings] = args;

    this.#tool = {
      type: tool,
      ...toolSettings,
    } as ToolSettings;

    this.currentPage.layerManager.changeTool(tool, toolSettings);
  }

  public export(canvasState: LastState): Note {
    const data: Note = {
      lastState: canvasState,
      metadata: this.#meta,
      pages: this.#pages.map((p) => p.export()),
    };

    return data;
  }
}
