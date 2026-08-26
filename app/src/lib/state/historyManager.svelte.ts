import {
  canvasManager,
  type Tool,
} from "$lib/editor/state/canvasManager.svelte";
import { lassoManager } from "$lib/editor/state/lassoManager.svelte";
import { selectionFromIds } from "$lib/editor/tools/lasso";
import type { Block } from "$lib/tauri/bindings";
import { contentManager } from "./contentManager.svelte";

interface LayerPatch {
  layerId: string;
  before: Block[];
  after: Block[];
}

interface EditorState {
  selectedBlockIds: string[];
  tool: Tool;
}

interface HistoryEntry {
  contentId: number;
  label: string;
  pageIndex: number;
  patches: LayerPatch[]; // empty for a selection-only entry
  selectionBefore: EditorState;
  selectionAfter: EditorState;
}

export class HistoryManager {
  index: number = $state(-1);
  entries: HistoryEntry[] = $state([]);

  #label?: string;
  #cached = new Map<string, Block[]>();
  #currentPage?: number;
  #currentTool?: Tool;
  #currentSelection: string[] = [];
  #nextContentId = 0;
  #savedContentId = $state(0);
  #applying = false;
  #baseContentId = $state(0);

  begin(label: string) {
    if (this.#applying) return;
    this.#cached.clear();
    this.#label = label;
    this.#currentPage = contentManager.currentPage;
    this.#currentTool = canvasManager.tool;
    this.#currentSelection = selectedIds();

    contentManager.layers.forEach((l) => {
      this.#cached.set(l.id, [...l.blocks]);
    });
  }

  commit() {
    const historyEntry = this.buildEntry();
    this.cleanup();

    if (!historyEntry) return;

    // clean undo history
    this.entries.splice(this.index + 1);

    const l = this.entries.push(historyEntry);
    this.index = l - 1;

    if (historyEntry.patches.length > 0) contentManager.updateEditDate();

    this.limitHistory();
  }

  abort() {
    this.cleanup();
  }

  transact(label: string, fn: () => void) {
    if (this.#label !== undefined) return fn();

    this.begin(label);
    try {
      fn();
    } finally {
      this.commit();
    }
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    if (this.#label !== undefined) return false; // a gesture is currently active

    this.#applying = true;

    try {
      const entry = this.entries[this.index];

      contentManager.currentPage = entry.pageIndex;
      this.applyPatches(entry.patches, "before");
      this.restoreEditorState(entry.selectionBefore);

      this.index--;

      canvasManager.cleanCache();
      canvasManager.redrawStrokes();
    } finally {
      this.#applying = false;
    }

    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    if (this.#label !== undefined) return false;

    this.#applying = true;
    try {
      const entry = this.entries[this.index + 1];

      contentManager.currentPage = entry.pageIndex;
      this.applyPatches(entry.patches, "after");
      this.restoreEditorState(entry.selectionAfter);

      this.index++;

      canvasManager.cleanCache();
      canvasManager.redrawStrokes();
    } finally {
      this.#applying = false;
    }

    return true;
  }

  private applyPatches(patches: LayerPatch[], part: "before" | "after") {
    for (const p of patches) {
      const layer = contentManager.layers.find((l) => l.id === p.layerId);
      if (!layer) continue;

      layer.blocks = [...p[part]];
    }
  }

  private restoreEditorState(s: EditorState) {
    const selection = selectionFromIds(s.selectedBlockIds);
    lassoManager.reset();

    if (!selection) return;

    canvasManager.tool = s.tool;
    lassoManager.selection = selection;
    lassoManager.isSelecting = false;
  }

  get canUndo(): boolean {
    return this.index >= 0;
  }
  get canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  get contentId() {
    return this.index >= 0
      ? this.entries[this.index].contentId
      : this.#baseContentId;
  }

  get isDirty() {
    return this.contentId !== this.#savedContentId;
  }

  markSaved() {
    this.#savedContentId = this.contentId;
  }

  private buildEntry(): HistoryEntry | null {
    if (this.#label === undefined) return null;
    if (this.#currentPage === undefined) return null;
    if (this.#currentTool === undefined) return null;

    const patches: LayerPatch[] = [];

    for (const l of contentManager.layers) {
      const before = this.#cached.get(l.id);
      if (!before) continue;
      if (!blocksChanged(before, l.blocks)) continue;

      patches.push({ layerId: l.id, before, after: [...l.blocks] });
    }

    if (
      patches.length === 0 &&
      !idsChanged(this.#currentSelection, selectedIds())
    )
      return null;

    return {
      contentId: patches.length > 0 ? ++this.#nextContentId : this.contentId,
      label: this.#label,
      pageIndex: this.#currentPage,
      patches,
      selectionBefore: {
        selectedBlockIds: this.#currentSelection,
        tool: this.#currentTool,
      },
      selectionAfter: {
        selectedBlockIds: selectedIds(),
        tool: canvasManager.tool,
      },
    };
  }

  private cleanup() {
    this.#cached.clear();
    this.#label = undefined;
    this.#currentPage = undefined;
    this.#currentTool = undefined;
    this.#currentSelection = [];
  }

  private limitHistory() {
    const excess = this.entries.length - 100;
    if (excess <= 0) return;

    this.#baseContentId = this.entries[excess - 1].contentId;
    this.entries.splice(0, excess);
    this.index -= excess;
  }
}

function blocksChanged(a: Block[], b: Block[]) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  return false;
}

function selectedIds(): string[] {
  const s = lassoManager.selection;
  if (!s) return [];
  return Object.values(s).flatMap((e) => e.map((x) => x.block.Stroke.id));
}

function idsChanged(a: string[], b: string[]) {
  if (a.length !== b.length) return true;
  const set = new Set(a);
  return b.some((id) => !set.has(id));
}
