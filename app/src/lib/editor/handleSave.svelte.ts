import { contentManager } from "$lib/state/contentManager.svelte";
import { popupManager } from "$lib/state/popupManager.svelte";
import type { Tab } from "$lib/state/tab.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import { commands } from "$lib/tauri/bindings";
import { notePreview } from "./render/page";

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
    const preview = await notePreview(note);

    let ok: boolean;
    if (tab.path) {
      ok = await commands.saveNote(note, tab.path, preview);
    } else {
      const path = await commands.saveNoteToStorage(note, preview);
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

  const lastId = $state.snapshot(contentManager.id);
  // Save As: the new file is a new note and needs its own id.
  const id = tab.path ? crypto.randomUUID() : lastId;
  contentManager.id = id;

  const token = tab.saveToken();
  const note = $state.snapshot(tab.note);
  const path = await commands.saveNoteDialog(note, await notePreview(note));

  if (path) {
    tab.path = path;
    tab.markSaved(token);
  } else {
    // Revert ID, no saving since error occurred
    contentManager.id = lastId;
  }
}
