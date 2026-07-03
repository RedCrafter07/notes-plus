import { contentManager } from "$lib/state/contentManager.svelte";
import { popupManager } from "$lib/state/popupManager.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import { commands } from "$lib/tauri/bindings";

export function useShortcuts() {
  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key === "s" && !e.shiftKey && tabManager.tab.path === undefined) {
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
      }
      if (e.key === "s" && !e.shiftKey && tabManager.tab.path !== undefined) {
        const saveSuccess = await commands.saveNote(
          contentManager.export(),
          tabManager.tab.path,
        );
        if (saveSuccess) {
          if (tabManager.activeNote) tabManager.activeNote.unsaved = false;
        } else {
          // TODO: Display error
        }
      }
      if (e.key === "S" || (e.key === "s" && e.shiftKey)) {
        if (!tabManager.activeNote) return;
        const id = tabManager.tab.path
          ? crypto.randomUUID()
          : contentManager.id;

        contentManager.id = id;

        const path = await commands.saveNoteDialog(contentManager.export());

        if (path) {
          tabManager.currentPath = path;
          console.log(tabManager.tab.path);
          if (tabManager.activeNote) tabManager.activeNote.unsaved = false;
        }
      }
    };
    document.addEventListener("keydown", event);

    return () => {
      document.removeEventListener("keydown", event);
    };
  });
}
