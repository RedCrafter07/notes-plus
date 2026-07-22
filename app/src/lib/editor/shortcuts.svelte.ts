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
      if (tabManager.tab?.path) {
        const path = tabManager.tab.path;

        const success = await commands.saveNote(
          $state.snapshot(tabManager.note),
          path,
        );

        if (success) {
          popupManager.add({
            message: "Note saved successfully!",
            type: "success",
          });
          tabManager.tab.unsaved = false;
        }
        // do not show popup otherwise, as errors get handled and sent by the backend automatically.
      } else {
        const path = await commands.saveNoteToStorage(
          $state.snapshot(tabManager.note),
        );

        if (path) {
          popupManager.add({
            message: "Note saved successfully!",
            type: "success",
          });
          if (tabManager.tab) {
            tabManager.tab.unsaved = false;
            tabManager.tab.path = path;
          }
        }
      }
    } else {
      if (!tabManager.tab) return;
      const lastId = $state.snapshot(contentManager.id);

      // Save As: New file should get new ID.
      const id = tabManager.tab.path ? crypto.randomUUID() : lastId;
      contentManager.id = id;

      const path = await commands.saveNoteDialog(
        $state.snapshot(tabManager.note),
      );

      if (path) {
        tabManager.currentPath = path;
        if (tabManager.tab) tabManager.tab.unsaved = false;
      } else {
        // Revert ID, no saving since error occurred
        contentManager.id = lastId;
      }
    }
  }
}
