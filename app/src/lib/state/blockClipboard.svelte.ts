import { blockAsset, cloneBlock, translateBlock } from "#lib/editor/blocks.ts";
import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
import { selectionFromIds, selectionIds } from "#lib/editor/tools/lasso.ts";
import { commands, type Block } from "#lib/tauri/bindings.ts";
import { contentManager } from "./contentManager.svelte";
import { popupManager } from "./popupManager.svelte";
import { tabManager } from "./tabManager.svelte";

/*
 * Copy, cut and paste of a lasso selection, within a note or into another
 * one. Like the page clipboard (pageClipboard.svelte.ts), it keeps block
 * snapshots plus an asset session of its own for the images among them, so
 * a paste works after the source note is closed. Pasted blocks keep their
 * position (on the active layer) and are selected; pasted where they were
 * copied from, they are offset a little so they are visibly separate.
 */

/** Offset of a paste onto the page it was copied from, like Duplicate. */
const OFFSET = 16;

const plural = (n: number) => (n === 1 ? "1 element" : `${n} elements`);

class BlockClipboard {
  blocks = $state.raw<Block[]>([]);
  #session: string | undefined;
  /** Where they were copied from: a paste there is offset. */
  #from: { note: string; page: string } | undefined;
  /** How many pastes since copying, to fan out repeated ones. */
  #pastes = 0;

  /** Copies the lasso selection. */
  async copy(quiet = false): Promise<boolean> {
    const tab = tabManager.tab;
    const selection = lassoManager.selection;
    if (!tab || !selection) return false;
    // In drawing order, layer by layer.
    const blocks = Object.values(selection)
      .flatMap((entries) => [...entries].sort((a, b) => a.index - b.index).map((e) => e.block))
      .map((b) => $state.snapshot(b) as Block);
    if (!blocks.length) return false;

    const session = `clip-${crypto.randomUUID()}`;
    const ids = [...new Set(blocks.map(blockAsset).filter((a): a is string => !!a))];
    if (ids.length && !(await commands.copyAssets(tab.assets, session, ids))) {
      commands.closeAssetSession(session);
      return false;
    }
    if (this.#session) commands.closeAssetSession(this.#session);
    this.#session = session;
    this.blocks = blocks;
    this.#from = { note: tab.note.meta.id, page: contentManager.page.id };
    this.#pastes = 0;
    if (!quiet) popupManager.add({ type: "success", message: `${plural(blocks.length)} copied` });
    return true;
  }

  /** Copies the selection, then deletes it (one undo step). */
  async cut() {
    const tab = tabManager.tab;
    if (!(await this.copy(true))) return;
    if (tabManager.tab !== tab) return;
    const n = selectionIds(lassoManager.selection).length;
    lassoManager.deleteSelection();
    // A cut leaves nothing to keep apart from: paste right back in place.
    this.#from = undefined;
    popupManager.add({ type: "success", message: `${plural(n)} cut: paste with Ctrl+V or the paste button` });
  }

  /** Pastes onto the active layer of the open page (one undo step) and selects the result. */
  async paste() {
    const tab = tabManager.tab;
    const blocks = this.blocks;
    if (!tab || !blocks.length) return;
    const layer = contentManager.layers[contentManager.activeLayer];
    if (!layer || layer.locked || !layer.visible) {
      popupManager.add({ type: "warning", message: "The active layer is locked or hidden." });
      return;
    }
    const ids = [...new Set(blocks.map(blockAsset).filter((a): a is string => !!a))];
    if (ids.length && this.#session && !(await commands.copyAssets(this.#session, tab.assets, ids))) return;
    if (tabManager.tab !== tab) return;

    const here = this.#from?.note === tab.note.meta.id && this.#from.page === contentManager.page.id;
    const d = here ? OFFSET * ++this.#pastes : 0;
    const copies = blocks.map((b) => (d ? translateBlock(b, d, d) : cloneBlock(b)));

    tabManager.transact("Paste", () => {
      const l = contentManager.layers[contentManager.activeLayer];
      l.blocks = [...l.blocks, ...copies];
      canvasManager.tool = "lasso";
      lassoManager.selection = selectionFromIds(copies.map((b) => b.id)) ?? undefined;
      lassoManager.isSelecting = !lassoManager.selection;
    });
  }
}

export const blockClipboard = new BlockClipboard();
