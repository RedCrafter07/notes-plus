import { contentManager } from "$lib/state/contentManager.svelte";
import { popupManager } from "$lib/state/popupManager.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import { commands } from "$lib/tauri/bindings";

export function useShortcuts() {
  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key.toLowerCase() === "s") await handleSave(e);
    };
    document.addEventListener("keydown", event);

    return () => {
      document.removeEventListener("keydown", event);
    };
  });

  async function handleSave(e: KeyboardEvent) {
    e.preventDefault();
    if (!e.shiftKey) {
      if (tabManager.activeNote?.path) {
        const path = tabManager.activeNote.path;

        const success = await commands.saveNote(contentManager.export(), path);

        if (success) {
          popupManager.add({
            message: "Note saved successfully!",
            type: "success",
          });
          tabManager.activeNote.unsaved = false;
        }
        // do not show popup otherwise, as errors get handled and sent by the backend automatically.
      } else {
        const path = await commands.saveNoteToStorage(contentManager.export());

        if (path) {
          popupManager.add({
            message: "Note saved successfully!",
            type: "success",
          });
          if (tabManager.activeNote) {
            tabManager.activeNote.unsaved = false;
            tabManager.currentPath = path;
          }
        }
      }
    } else {
      if (!tabManager.activeNote) return;
      const lastId = contentManager.id;

      // Save As: New file should get new ID.
      const id = tabManager.tab.path ? crypto.randomUUID() : contentManager.id;

      contentManager.id = id;

      const path = await commands.saveNoteDialog(contentManager.export());

      if (path) {
        tabManager.currentPath = path;
        if (tabManager.activeNote) tabManager.activeNote.unsaved = false;
      } else {
        // Revert ID, no saving since error occurred
        contentManager.id = lastId;
      }
    }
  }
}
