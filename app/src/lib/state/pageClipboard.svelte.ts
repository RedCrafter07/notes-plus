import { freshCopy, pageAssets } from "#lib/editor/pageCopy.ts";
import { commands, type Page } from "#lib/tauri/bindings.ts";
import { contentManager } from "./contentManager.svelte";
import { popupManager } from "./popupManager.svelte";
import { tabManager } from "./tabManager.svelte";

/*
 * Copying and moving pages, within a note or between notes. The clipboard
 * holds page snapshots plus an asset session of its own: copying copies
 * the pages' attachments (PDF backgrounds, images) into it, and pasting
 * copies them on into the target note's session, where its next save
 * picks them up. So a paste still works after the source note is closed,
 * and a cut page's attachments survive its deletion.
 */

const plural = (n: number) => (n === 1 ? "1 page" : `${n} pages`);

class PageClipboard {
  pages = $state.raw<Page[]>([]);
  /** Title of the note they came from. */
  source = $state("");
  #session: string | undefined;

  /** Puts the pages at `indices` of the open note on the clipboard. */
  async copy(indices: number[], quiet = false): Promise<boolean> {
    const tab = tabManager.tab;
    if (!tab) return false;
    const pages = [...new Set(indices)]
      .sort((a, b) => a - b)
      .map((i) => contentManager.pages[i])
      .filter((p) => p !== undefined)
      .map((p) => $state.snapshot(p));
    if (!pages.length) return false;

    const session = `clip-${crypto.randomUUID()}`;
    const ids = pageAssets(pages);
    if (ids.length && !(await commands.copyAssets(tab.assets, session, ids))) {
      commands.closeAssetSession(session);
      return false;
    }
    if (this.#session) commands.closeAssetSession(this.#session);
    this.#session = session;
    this.pages = pages;
    this.source = tab.note.meta.title;
    if (!quiet) popupManager.add({ type: "success", message: `${plural(pages.length)} copied` });
    return true;
  }

  /** Copies, then deletes the pages from the open note (one undo step). */
  async cut(indices: number[]) {
    const tab = tabManager.tab;
    if (!(await this.copy(indices, true))) return;
    // The note may have been switched while the attachments were copied.
    if (tabManager.tab !== tab) return;
    contentManager.deletePages(indices, indices.length === 1 ? "Cut page" : "Cut pages");
    popupManager.add({ type: "success", message: `${plural(indices.length)} cut: paste ${indices.length === 1 ? "it" : "them"} where it belongs` });
  }

  /** Inserts the clipboard's pages into the open note at index `at` (one undo step). */
  async paste(at: number) {
    const tab = tabManager.tab;
    const pages = this.pages;
    if (!tab || !pages.length) return;
    const ids = pageAssets(pages);
    if (ids.length && this.#session && !(await commands.copyAssets(this.#session, tab.assets, ids))) return;
    if (tabManager.tab !== tab) return;
    contentManager.insertPages(pages.map(freshCopy), at, pages.length === 1 ? "Paste page" : "Paste pages");
  }
}

export const pageClipboard = new PageClipboard();
