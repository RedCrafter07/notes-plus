import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { SvelteSet } from "svelte/reactivity";
import { saveTab } from "#lib/editor/handleSave.svelte.ts";
import { fsStore, loadNotebooks } from "#lib/state/fsStore.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import type { Tab } from "#lib/state/tab.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { commands, type File } from "#lib/tauri/bindings.ts";
import { rebaseFolder } from "#lib/util/fileSystem.svelte.ts";

/*
 * Notebook management from the dashboard. A notebook that is open in a tab
 * is changed in the tab and saved from there; writing the file directly
 * would be overwritten by the tab's next save.
 */

/** Which dialog is open: rename / move a notebook, or rename a folder. */
export const libraryDialog = $state<{
  current?:
    | { kind: "rename"; file: File }
    | { kind: "move"; file: File }
    | { kind: "renameFolder"; folder: string };
}>({});

const openTab = (path: string) => tabManager.tabs.find((t) => t.path === path);

async function viaTab(tab: Tab, change: () => void) {
  change();
  tab.markEdited();
  return saveTab(tab, { silent: true });
}

/** Notebooks being read from disk, by path; their cards show a spinner. */
export const opening = new SvelteSet<string>();

export async function openNotebook(file: File) {
  // A second tap while a big note loads would open it twice.
  if (opening.has(file.path)) return;
  opening.add(file.path);
  try {
    const { openNotes } = await import("#lib/util/notes.svelte.ts");
    openNotes(await commands.openNotes([file.path]));
  } finally {
    opening.delete(file.path);
  }
}

export async function renameNotebook(file: File, title: string) {
  title = title.trim();
  if (!title || title === file.title) return;
  const tab = openTab(file.path);
  const ok = tab
    ? await viaTab(tab, () => (tab.note.meta.title = title))
    : await commands.renameNote(file.path, title);
  if (ok) await loadNotebooks();
}

export async function moveNotebook(file: File, folder: string | null) {
  if ((folder ?? null) === (file.folder ?? null)) return;
  const tab = openTab(file.path);
  const ok = tab
    ? await viaTab(tab, () => (tab.note.meta.folder = folder))
    : await commands.moveNote(file.path, folder);
  if (ok) {
    popupManager.add({
      type: "success",
      message: `Moved "${file.title}" to ${folder ?? "the top level"}.`,
    });
    await loadNotebooks();
  }
}

export async function duplicateNotebook(file: File) {
  // Duplicate what is on screen, not an older saved version.
  const tab = openTab(file.path);
  if (tab?.unsaved) await saveTab(tab, { silent: true });

  if (await commands.duplicateNote(file.path)) {
    popupManager.add({ type: "success", message: `Duplicated "${file.title}".` });
    await loadNotebooks();
  }
}

export async function revealNotebook(file: File) {
  try {
    await revealItemInDir(file.path);
  } catch (e) {
    popupManager.add({ type: "destructive", message: `Could not show the file: ${e}` });
  }
}

/** Moves a notebook to the system trash, closing its tab first. */
export async function trashNotebook(file: File) {
  const index = tabManager.tabs.findIndex((t) => t.path === file.path);
  if (index !== -1) {
    if (tabManager.tabs[index].unsaved) {
      popupManager.add({
        type: "warning",
        message: `"${file.title}" is open with unsaved changes. Save or close it first.`,
      });
      return;
    }
    tabManager.remove(index, true);
  }

  if (await commands.trashNoteFile(file.path)) {
    popupManager.add({ type: "success", message: `Moved "${file.title}" to the trash.` });
    await loadNotebooks();
  }
}

/**
 * Renames a folder (or moves it, e.g. "Uni" -> "School/Uni"): every notebook
 * in it or below gets the new path. Open notebooks are updated in their tabs.
 */
export async function renameFolder(from: string, to: string) {
  const skip: string[] = [];
  for (const tab of tabManager.tabs) {
    const next = tab.note.meta.folder && rebaseFolder(tab.note.meta.folder, from, to);
    if (!next || !tab.path) continue;
    skip.push(tab.path);
    await viaTab(tab, () => (tab.note.meta.folder = next));
  }

  const moved = (await commands.renameFolder(from, to, skip)) + skip.length;
  popupManager.add({
    type: "success",
    message: `Renamed "${from}" to "${to}" (${moved} notebook${moved === 1 ? "" : "s"}).`,
  });
  // Stay where you were; if that was inside the renamed folder, follow it.
  const here = fsStore.store.path;
  await loadNotebooks(rebaseFolder(here, from, to) ?? here);
}
