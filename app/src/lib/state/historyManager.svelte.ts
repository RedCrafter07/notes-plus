import {
  canvasManager,
  type Tool,
} from "#lib/editor/state/canvasManager.svelte.ts";
import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
import { selectionFromIds, selectionIds } from "#lib/editor/tools/lasso.ts";
import type { Block, Page } from "#lib/tauri/bindings.ts";
import { contentManager } from "./contentManager.svelte";

/*
 * Two kinds of change are recorded:
 *
 * - Layer patches: the before/after `blocks` array of each touched layer.
 * - Page structure: the before/after `pages` array, for adding, deleting or
 *   reordering pages, page setup, and layer add/remove/rename.
 *
 * Both are cheap because they store references, not copies. That only works
 * because nothing is edited in place: a changed block gets a new id, a changed
 * page or layer list gets a new object. `contentManager` follows that rule for
 * every structural edit.
 */

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
  pageIndexAfter: number;
  patches: LayerPatch[]; // empty for a selection-only entry
  /** Set when pages were added, removed, replaced or reordered. */
  pages?: { before: Page[]; after: Page[] };
  selectionBefore: EditorState;
  selectionAfter: EditorState;
}

export class HistoryManager {
  index: number = $state(-1);
  entries: HistoryEntry[] = $state([]);

  #label?: string;
  #cached = new Map<string, Block[]>();
  #pages?: Page[];
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
    this.#currentSelection = selectionIds(lassoManager.selection);
    this.#pages = contentManager.pages.slice();

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

    if (historyEntry.patches.length > 0 || historyEntry.pages) {
      contentManager.updateEditDate();
      canvasManager.cleanCache();
    }

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

      if (entry.pages) contentManager.pages = entry.pages.before;
      contentManager.currentPage = entry.pageIndex;
      this.applyPatches(entry.patches, "before");
      this.restoreEditorState(entry.selectionBefore);

      this.index--;

      canvasManager.cleanCache();
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

      if (entry.pages) contentManager.pages = entry.pages.after;
      contentManager.currentPage = entry.pages
        ? entry.pageIndexAfter
        : entry.pageIndex;
      this.applyPatches(entry.patches, "after");
      this.restoreEditorState(entry.selectionAfter);

      this.index++;

      canvasManager.cleanCache();
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

  /** Label of the step undo would revert, for tooltips. */
  get undoLabel() {
    return this.canUndo ? this.entries[this.index].label : undefined;
  }
  get redoLabel() {
    return this.canRedo ? this.entries[this.index + 1].label : undefined;
  }

  get isDirty() {
    return this.contentId !== this.#savedContentId;
  }

  markSaved(contentId = this.contentId) {
    this.#savedContentId = contentId;
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

    const pagesBefore = this.#pages ?? [];
    const pagesAfter = contentManager.pages;
    const pages = itemsChanged(pagesBefore, pagesAfter)
      ? { before: pagesBefore, after: pagesAfter.slice() }
      : undefined;

    const selection = selectionIds(lassoManager.selection);
    const contentChanged = patches.length > 0 || pages !== undefined;

    if (!contentChanged && !idsChanged(this.#currentSelection, selection))
      return null;

    return {
      contentId: contentChanged ? ++this.#nextContentId : this.contentId,
      label: this.#label,
      pageIndex: this.#currentPage,
      pageIndexAfter: contentManager.currentPage,
      patches,
      pages,
      selectionBefore: {
        selectedBlockIds: this.#currentSelection,
        tool: this.#currentTool,
      },
      selectionAfter: {
        selectedBlockIds: selection,
        tool: canvasManager.tool,
      },
    };
  }

  private cleanup() {
    this.#cached.clear();
    this.#pages = undefined;
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

/** Shallow, by identity: relies on blocks and pages never being edited in place. */
function itemsChanged<T>(a: readonly T[], b: readonly T[]) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  return false;
}
const blocksChanged = itemsChanged<Block>;

function idsChanged(a: string[], b: string[]) {
  if (a.length !== b.length) return true;
  const set = new Set(a);
  return b.some((id) => !set.has(id));
}
