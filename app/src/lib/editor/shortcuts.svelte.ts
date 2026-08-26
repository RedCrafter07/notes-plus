import { tabManager } from "$lib/state/tabManager.svelte";
import { handleSave } from "./handleSave.svelte";

export function useShortcuts() {
  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        await handleSave(e.shiftKey);
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        tabManager[e.shiftKey ? "redo" : "undo"]();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        tabManager.redo();
      }
    };
    document.addEventListener("keydown", event);

    return () => {
      document.removeEventListener("keydown", event);
    };
  });
}
