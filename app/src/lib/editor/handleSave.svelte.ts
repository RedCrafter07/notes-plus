import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import type { Tab } from "#lib/state/tab.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { commands, type NoteData } from "#lib/tauri/bindings.ts";
import { usedAssets } from "./blocks.ts";
import { notePreview } from "./render/page";

/**
 * What a save sends: the note, but with only the attachments its file
 * (`tab.path`) doesn't hold yet. The backend copies the others from that
 * file, so a note full of lecture PDFs doesn't push every page render
 * across IPC as base64 on each autosave. `used` is what the saved file will
 * hold; pass it to `saved`.
 */
function payload(tab: Tab): { note: NoteData; used: Set<string> } {
  const { meta, content, state } = $state.snapshot({
    meta: tab.note.meta,
    content: tab.note.content,
    state: tab.note.state,
  });
  const used = usedAssets(content.pages);
  const assets: Record<string, string> = {};
  for (const id of used) {
    const url = tab.note.assets[id];
    if (url !== undefined && !tab.storedAssets.has(id)) assets[id] = url;
  }
  return { note: { meta, content, state, assets }, used };
}

/** The first-page preview, rendered with every attachment, not just the sent ones. */
function preview(tab: Tab, note: NoteData) {
  return notePreview({ ...note, assets: tab.note.assets });
}

/**
 * Records what the file holds after a save. After a failure nothing is
 * assumed, so the next save sends every attachment again.
 */
function saved(tab: Tab, used: Set<string> | null) {
  tab.storedAssets = used ?? new Set();
}

/**
 * Saves a tab to its file, or into app storage if it has none yet.
 * `silent` skips the success toast (autosave). Errors are always reported by
 * the backend. Returns whether the save succeeded.
 */
export async function saveTab(tab: Tab, { silent = false } = {}): Promise<boolean> {
  if (tab.saving) return false;
  tab.saving = true;

  try {
    const token = tab.saveToken();
    const { note, used } = payload(tab);
    const image = await preview(tab, note);

    let ok: boolean;
    if (tab.path) {
      ok = await commands.saveNote(note, tab.path, image);
    } else {
      const path = await commands.saveNoteToStorage(note, image);
      if (path) tab.path = path;
      ok = !!path;
    }
    saved(tab, ok ? used : null);

    if (ok) {
      tab.markSaved(token);
      if (!silent)
        popupManager.add({ message: "Note saved successfully!", type: "success" });
    }
    return ok;
  } finally {
    tab.saving = false;
  }
}

export async function handleSave(saveAs: boolean) {
  const tab = tabManager.tab;
  if (!tab) return;

  if (!saveAs) {
    await saveTab(tab);
    return;
  }

  const lastId = $state.snapshot(contentManager.id);
  // Save As: the new file is a new note and needs its own id.
  const id = tab.path ? crypto.randomUUID() : lastId;
  contentManager.id = id;

  const token = tab.saveToken();
  // Attachments not sent are copied from the current file, if there is one.
  const { note, used } = payload(tab);
  const path = await commands.saveNoteDialog(note, await preview(tab, note), tab.path ?? null);

  if (path) {
    tab.path = path;
    saved(tab, used);
    tab.markSaved(token);
  } else {
    // Revert ID, no saving since error occurred
    contentManager.id = lastId;
  }
}
