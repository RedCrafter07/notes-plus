import { contentManager } from "$lib/state/contentManager.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import { commands } from "$lib/tauri/bindings";

export function useShortcuts() {
  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key === "s" && !e.shiftKey && contentManager.path !== null) {
        const saveSuccess = await commands.saveNote(contentManager.export());
        if (saveSuccess) {
          if (tabManager.activeNote) tabManager.activeNote.unsaved = false;
        } else {
          // TODO: Display error
        }
      }
      if (
        e.key === "S" ||
        (e.key === "s" && e.shiftKey) ||
        (e.key === "s" && !e.shiftKey && contentManager.path === null)
      ) {
        if (!tabManager.activeNote) return;
        const id = contentManager.path
          ? crypto.randomUUID()
          : contentManager.id;

        contentManager.id = id;

        const path = await commands.saveNoteDialog(contentManager.export());

        if (path) {
          contentManager.path = path;
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
