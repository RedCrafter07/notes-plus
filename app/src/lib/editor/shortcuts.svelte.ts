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
      } else {
        popupManager.add({
          message: "An error occurred while saving the note.",
          type: "destructive",
        });
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
        popupManager.add({
          message: "An error occurred while saving the file. Please try again",
          type: "destructive",
        });
      }
    }
  }
}
