import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import type { Tab } from "#lib/state/tab.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { commands, type NoteData } from "#lib/tauri/bindings.ts";
import { sessionAssets } from "./assets.ts";
import { notePreview } from "./render/page";

/*
 * A save sends the note without attachments: those live in the backend (the
 * note's file or its cache, under the tab's session) and are written from
 * there.
 */

/** The first-page preview, rendered with the tab's attachments. */
function preview(tab: Tab, note: NoteData) {
  return notePreview(note, sessionAssets(tab.assets));
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
    const note = $state.snapshot(tab.note);
    const image = await preview(tab, note);

    let ok: boolean;
    if (tab.path) {
      ok = await commands.saveNote(tab.assets, note, tab.path, image);
    } else {
      const path = await commands.saveNoteToStorage(tab.assets, note, image);
      if (path) tab.path = path;
      ok = !!path;
    }

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

  // Saves run concurrently in the backend; never two of one tab at once, or
  // an autosave could land after Save As, in the old file.
  if (tab.saving) return;
  tab.saving = true;
  try {
    const lastId = $state.snapshot(contentManager.id);
    // Save As: the new file is a new note and needs its own id.
    const id = tab.path ? crypto.randomUUID() : lastId;
    contentManager.id = id;

    const token = tab.saveToken();
    const note = $state.snapshot(tab.note);
    const path = await commands.saveNoteDialog(tab.assets, note, await preview(tab, note));

    if (path) {
      tab.path = path;
      tab.markSaved(token);
    } else {
      // Revert ID, no saving since error occurred
      contentManager.id = lastId;
    }
  } finally {
    tab.saving = false;
  }
}
